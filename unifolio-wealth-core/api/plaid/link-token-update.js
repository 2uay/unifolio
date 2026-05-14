// Update-mode link token.
//
// When an existing Plaid Item enters an error state (most commonly
// ITEM_LOGIN_REQUIRED — the user changed their bank password or MFA token
// expired), the user needs to re-authenticate WITHOUT losing the existing
// access_token + historical data. Plaid calls this "update mode": you create
// a link token bound to the existing access_token, then open Plaid Link with
// it; the user re-auths against the bank, the same access_token is reused,
// and Plaid clears the error state.
//
// POST { itemId } → { link_token } (Bearer JWT auth required)

import { CountryCodes } from 'plaid';
import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from './_client.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  const plaid = makePlaidClient();
  const supabase = makeServiceSupabase();

  try {
    const { data: item, error: fetchError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();
    if (fetchError || !item) return res.status(404).json({ error: 'Plaid item not found' });

    const webhookUrl = process.env.PLAID_WEBHOOK_URL || 'https://unifolio.ca/api/plaid/webhook';
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Unifolio',
      country_codes: [CountryCodes.Us, CountryCodes.Ca],
      language: 'en',
      access_token: item.access_token, // <-- update mode: reuse existing token, no `products`
      webhook: webhookUrl,
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('[Plaid link-token-update]', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error_message || 'Failed to create update-mode link token' });
  }
}
