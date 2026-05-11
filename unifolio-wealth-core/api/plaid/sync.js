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
    // Retrieve access_token via service key (client never sees this)
    const { data: item, error: fetchError } = await supabase
      .from('plaid_items')
      .select('access_token, institution_id, institution_name, institution_logo')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !item) return res.status(404).json({ error: 'Plaid item not found' });

    const { normalizePlaidData } = await import('../../src/lib/plaidNormalizer.js');

    const [holdingsRes, accountsRes] = await Promise.all([
      plaid.investmentsHoldingsGet({ access_token: item.access_token }),
      plaid.accountsGet({ access_token: item.access_token }),
    ]);

    // Optionally fetch transactions
    const today = new Date().toISOString().slice(0, 10);
    let plaidTransactions = [];
    try {
      const txRes = await plaid.investmentsTransactionsGet({
        access_token: item.access_token,
        start_date: '2020-01-01',
        end_date: today,
      });
      plaidTransactions = txRes.data.investment_transactions || [];
    } catch {
      // transactions optional — continue without them
    }

    const { institutions, accounts, holdings, transactions } = normalizePlaidData({
      userId: user.id,
      itemId,
      institutionId: item.institution_id,
      institutionName: item.institution_name,
      institutionLogo: item.institution_logo,
      plaidAccounts: accountsRes.data.accounts,
      plaidHoldings: holdingsRes.data.holdings,
      plaidSecurities: holdingsRes.data.securities,
      plaidTransactions,
    });

    if (institutions.length) await supabase.from('institutions').upsert(institutions, { onConflict: 'id' });
    if (accounts.length) await supabase.from('accounts').upsert(accounts, { onConflict: 'id' });
    if (holdings.length) await supabase.from('holdings').upsert(holdings, { onConflict: 'id' });
    if (transactions.length) {
      await supabase.from('transactions').upsert(transactions, { onConflict: 'id', ignoreDuplicates: true });
    }

    await supabase.from('plaid_items')
      .update({ last_synced_at: new Date().toISOString(), status: 'active', error_code: null })
      .eq('item_id', itemId);

    res.json({ synced: true, holdingCount: holdings.length, transactionCount: transactions.length });
  } catch (err) {
    const errorCode = err?.response?.data?.error_code || null;
    console.error('[Plaid sync]', err?.response?.data || err.message);

    // Mark item as errored so the UI can surface it
    await supabase.from('plaid_items')
      .update({ status: 'error', error_code: errorCode })
      .eq('item_id', itemId)
      .eq('user_id', user.id);

    res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Sync failed' });
  }
}
