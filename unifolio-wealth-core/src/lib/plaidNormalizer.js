/**
 * Transforms Plaid API responses into Unifolio's Supabase table shapes.
 * Used by both api/plaid/exchange.js and api/plaid/sync.js.
 */

export function normalizePlaidData({
  userId,
  itemId,
  institutionId,
  institutionName,
  institutionLogo,
  plaidAccounts = [],
  plaidHoldings = [],
  plaidSecurities = [],
  plaidTransactions = [],
}) {
  const securityMap = Object.fromEntries(plaidSecurities.map(s => [s.security_id, s]));
  const instId = `plaid_${userId}_${institutionId || itemId}`;
  const syncBatchId = `plaid_sync_${itemId}_${Date.now()}`;
  const now = new Date().toISOString();

  const institutions = [{
    id: instId,
    user_id: userId,
    name: institutionName || 'Connected Brokerage',
    type: 'brokerage',
    logo: institutionLogo || null,
    connection_status: 'connected',
    api_supported: true,
    last_sync_time: now,
  }];

  const accounts = plaidAccounts.map(a => ({
    id: `plaid_${userId}_${a.account_id}`,
    user_id: userId,
    institution_id: instId,
    account_name: a.name || a.official_name || 'Account',
    account_type: mapAccountSubtype(a.subtype),
    base_currency: a.balances?.iso_currency_code || 'USD',
    cash_balance: a.balances?.available ?? a.balances?.current ?? 0,
    included_in_portfolio: true,
    last_updated: now,
  }));

  const holdings = plaidHoldings.map(h => {
    const sec = securityMap[h.security_id] || {};
    const ticker = sec.ticker_symbol || sec.name || 'UNKNOWN';
    const accountId = `plaid_${userId}_${h.account_id}`;
    const qty = h.quantity ?? 0;
    const costBasis = h.cost_basis ?? null;
    const avgPrice = costBasis != null && qty > 0 ? costBasis / qty : null;
    const currentPrice = sec.close_price ?? null;
    const marketValue = h.institution_value ?? (currentPrice != null && qty > 0 ? currentPrice * qty : null);
    const unrealized = costBasis != null && marketValue != null ? marketValue - costBasis : null;
    const unrealizedPct = costBasis != null && costBasis > 0 && unrealized != null ? (unrealized / costBasis) * 100 : null;

    return {
      id: `plaid_${userId}_${h.account_id}_${h.security_id}`,
      user_id: userId,
      account_id: accountId,
      ticker,
      display_ticker: ticker,
      asset_name: sec.name || ticker,
      asset_class: mapSecurityType(sec.type),
      sector: 'Unknown',
      quantity: qty,
      average_price: avgPrice,
      current_price: currentPrice,
      market_value: marketValue,
      cost_basis: costBasis,
      unrealized_gain_loss_amount: unrealized,
      unrealized_gain_loss_percent: unrealizedPct,
      currency: sec.iso_currency_code || 'USD',
      import_batch_id: syncBatchId,
      updated_at: now,
    };
  });

  const transactions = plaidTransactions.map(tx => {
    const sec = securityMap[tx.security_id] || {};
    const ticker = sec.ticker_symbol || sec.name || tx.name || 'UNKNOWN';
    return {
      id: `plaid_${userId}_tx_${tx.investment_transaction_id}`,
      user_id: userId,
      account_id: `plaid_${userId}_${tx.account_id}`,
      date: tx.date,
      transaction_type: mapTransactionType(tx.type, tx.subtype),
      ticker,
      display_ticker: ticker,
      asset_name: sec.name || ticker,
      asset_class: mapSecurityType(sec.type),
      quantity: Math.abs(tx.quantity ?? 0),
      price: tx.price ?? 0,
      total_amount: Math.abs(tx.amount ?? 0),
      fees: tx.fees ?? 0,
      currency: tx.iso_currency_code || 'USD',
      import_batch_id: syncBatchId,
    };
  });

  return { institutions, accounts, holdings, transactions };
}

function mapAccountSubtype(subtype) {
  const map = {
    brokerage: 'Brokerage',
    'traditional ira': 'IRA',
    roth: 'Roth IRA',
    roth_ira: 'Roth IRA',
    traditional_ira: 'IRA',
    '401k': '401(k)',
    '403b': '403(b)',
    rrsp: 'RRSP',
    tfsa: 'TFSA',
    rrif: 'RRIF',
    resp: 'RESP',
    cash: 'Cash',
  };
  return map[subtype?.toLowerCase()] ?? subtype ?? 'Brokerage';
}

function mapSecurityType(type) {
  const map = {
    equity: 'Stock',
    etf: 'ETF',
    mutual_fund: 'Mutual Fund',
    fixed_income: 'Bond',
    cash: 'Cash',
    derivative: 'Option',
    other: 'Other',
  };
  return map[type?.toLowerCase()] ?? 'Stock';
}

function mapTransactionType(type, subtype) {
  const combined = `${type}_${subtype}`.toLowerCase();
  if (combined.includes('buy') || combined.includes('purchase')) return 'Buy';
  if (combined.includes('sell') || combined.includes('sale')) return 'Sell';
  if (combined.includes('dividend')) return 'Dividend';
  if (combined.includes('transfer')) return 'Transfer';
  if (combined.includes('fee') || combined.includes('expense')) return 'Fee';
  if (combined.includes('interest')) return 'Interest';
  return 'Other';
}
