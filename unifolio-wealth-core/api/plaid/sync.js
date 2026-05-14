// Manual user-triggered Plaid item sync. Auth via Bearer JWT.
// Webhook-driven async syncs use the same core (api/plaid/webhook.js).

import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from './_client.js';
import { syncItem } from './_sync-core.js';

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
      .select('access_token, institution_id, institution_name, institution_logo')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();
    if (fetchError || !item) return res.status(404).json({ error: 'Plaid item not found' });

    const result = await syncItem({
      userId: user.id,
      itemId,
      accessToken: item.access_token,
      institutionId: item.institution_id,
      institutionName: item.institution_name,
      institutionLogo: item.institution_logo,
      plaid,
      supabase,
    });

    res.json({ synced: true, ...result });
  } catch (err) {
    console.error('[Plaid sync]', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Sync failed' });
  }
}
