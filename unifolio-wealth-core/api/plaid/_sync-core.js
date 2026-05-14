// Shared Plaid item sync logic.
//
// Used by:
//   - api/plaid/sync.js (manual user-triggered sync)
//   - api/plaid/exchange.js (initial sync after public_token exchange)
//   - api/plaid/webhook.js (async re-sync triggered by Plaid notifications)
//
// Pulls holdings + accounts + investment transactions, normalizes via
// plaidNormalizer, upserts into Supabase, and updates plaid_items.status.

export async function syncItem({ userId, itemId, accessToken, institutionId, institutionName, institutionLogo, plaid, supabase }) {
  const { normalizePlaidData } = await import('../../src/lib/plaidNormalizer.js');

  let holdingsRes, accountsRes;
  try {
    [holdingsRes, accountsRes] = await Promise.all([
      plaid.investmentsHoldingsGet({ access_token: accessToken }),
      plaid.accountsGet({ access_token: accessToken }),
    ]);
  } catch (err) {
    const errorCode = err?.response?.data?.error_code || null;
    console.warn('[plaid sync-core] holdings/accounts fetch failed:', errorCode || err?.message);
    await supabase.from('plaid_items')
      .update({ status: errorCode ? 'login_required' : 'error', error_code: errorCode })
      .eq('item_id', itemId);
    throw err;
  }

  // Investment transactions are optional — some institutions don't support them.
  let plaidTransactions = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const txRes = await plaid.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: '2020-01-01',
      end_date: today,
    });
    plaidTransactions = txRes.data.investment_transactions || [];
  } catch {
    /* optional — continue without */
  }

  const { institutions, accounts, holdings, transactions } = normalizePlaidData({
    userId,
    itemId,
    institutionId,
    institutionName,
    institutionLogo,
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

  return { holdingCount: holdings.length, transactionCount: transactions.length };
}

// Mark a plaid_item with an error state (used by webhook ITEM events).
export async function markItemError({ supabase, itemId, errorCode, status = 'error' }) {
  return supabase.from('plaid_items')
    .update({ status, error_code: errorCode || null })
    .eq('item_id', itemId);
}
