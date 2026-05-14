import { Products, CountryCodes } from 'plaid';
import { makePlaidClient, getAuthUser, cors } from './_client.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const plaid = makePlaidClient();
    // Webhook URL — Plaid will POST item / holdings / transactions updates
    // here. Defaults to production unifolio.ca; override via env for staging.
    const webhookUrl = process.env.PLAID_WEBHOOK_URL || 'https://unifolio.ca/api/plaid/webhook';
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Unifolio',
      products: [Products.Investments],
      country_codes: [CountryCodes.Us, CountryCodes.Ca],
      language: 'en',
      webhook: webhookUrl,
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('[Plaid link-token]', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error_message || 'Failed to create link token' });
  }
}
