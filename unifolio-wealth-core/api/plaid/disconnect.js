import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from './_client.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  const plaid = makePlaidClient();
  const supabase = makeServiceSupabase();

  try {
    // Fetch access_token to call Plaid item/remove
    const { data: item } = await supabase
      .from('plaid_items')
      .select('access_token, id')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();

    if (!item) return res.status(404).json({ error: 'Plaid item not found' });

    // Tell Plaid to revoke the item
    try {
      await plaid.itemRemove({ access_token: item.access_token });
    } catch {
      // If Plaid returns an error (e.g. already removed), continue cleanup anyway
    }

    // Remove from our DB; holdings/accounts remain (user may want historical data)
    await supabase.from('plaid_items').delete().eq('id', item.id);

    res.json({ disconnected: true });
  } catch (err) {
    console.error('[Plaid disconnect]', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Disconnect failed' });
  }
}
