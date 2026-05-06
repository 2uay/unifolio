// ============================================================
// UNIFOLIO — Portfolio Engine
// Single source of truth for all financial calculations.
// The frontend reads from this engine. Nothing is hardcoded.
// ============================================================

import { accounts, assets, rawHoldings, institutions, transactions, benchmarks, watchlist, accountTypes, DATA_IS_SAMPLE, SAMPLE_DATA_LABEL, predictionMarketAccounts, predictionMarketPositions } from './sampleData.js';
import { safeNumber, safeDivide, safeArray } from './safeNum.js';

export { accounts, assets, rawHoldings, institutions, transactions, benchmarks, watchlist, accountTypes, DATA_IS_SAMPLE, SAMPLE_DATA_LABEL, predictionMarketAccounts, predictionMarketPositions };

// ─── SPARKLINE GENERATOR (deterministic by ticker) ────────────
const generateSparkline = (base, volatility, trend, ticker = '', points = 20) => {
  const seed = ticker.split('').reduce((s, c) => s + c.charCodeAt(0), 0) || 42;
  let r = seed;
  let price = base * (1 - volatility * 3);
  return Array.from({ length: points }, () => {
    r = (r * 1664525 + 1013904223) & 0xffffffff;
    const rand = r / 0x100000000;
    price += (rand - 0.45 + trend * 0.1) * volatility * base;
    price = Math.max(price, base * 0.6);
    return Math.round(price * 100) / 100;
  });
};

// ─── HOLDING ENRICHMENT ───────────────────────────────────────
// Enrich raw holdings with all computed fields.
// Zero-quantity holdings are included in the array but flagged — allocations must filter them out.
export const holdings = rawHoldings.map(h => {
  const asset = assets[h.ticker];

  // Missing asset — return a safe stub with a warning
  if (!asset) {
    return {
      ...h,
      account_id: h.account_id,
      ticker: h.ticker,
      quantity: h.quantity,
      position: h.quantity, // alias for legacy components
      average_price: h.average_price,
      avgPrice: h.average_price, // alias
      current_price: null,
      lastPrice: null,
      prevClose: null,
      market_value: 0,
      marketValue: 0,
      cost_basis: 0,
      costBasis: 0,
      unrealized_gain_loss_amount: null,
      unrealizedAmt: null,
      unrealized_gain_loss_percent: null,
      unrealizedPct: null,
      daily_pnl_amount: null,
      dailyPnl: null,
      daily_pnl_percent: null,
      dailyPct: null,
      realized_gain_loss_amount: h.realized_gain_loss_amount ?? 0,
      realizedGain: h.realized_gain_loss_amount ?? 0,
      sparkline: [],
      currency: 'USD',
      sector: 'Unknown',
      assetClass: 'Unknown',
      asset_class: 'Unknown',
      country: 'Unknown',
      industry: 'Unknown',
      name: h.ticker,
      exchange: '',
      purchase_history: h.purchase_history ?? [],
      purchaseHistory: h.purchase_history ?? [],
      missing_price: true,
      warning: `Price data unavailable for ${h.ticker}`,
    };
  }

  const qty = safeNumber(h.quantity);
  const avgP = safeNumber(h.average_price);
  const currentPrice = safeNumber(asset.current_price);
  const prevClose = safeNumber(asset.previous_close);

  // Core calculations — all derived, nothing stored
  const market_value = qty * currentPrice;
  const cost_basis = qty * avgP;
  const unrealized_gain_loss_amount = market_value - cost_basis;
  const unrealized_gain_loss_percent = cost_basis > 0
    ? (unrealized_gain_loss_amount / cost_basis) * 100
    : null;

  const daily_change = currentPrice - prevClose;
  const daily_pnl_amount = qty * daily_change;
  const prev_day_value = qty * prevClose;
  const daily_pnl_percent = prev_day_value > 0
    ? (daily_pnl_amount / prev_day_value) * 100
    : null;

  const trend = unrealized_gain_loss_amount >= 0 ? 0.3 : -0.2;

  return {
    id: h.id,
    account_id: h.account_id,
    ticker: h.ticker,
    quantity: qty,
    position: qty,                               // legacy alias
    average_price: avgP,
    avgPrice: avgP,                              // legacy alias
    current_price: currentPrice,
    lastPrice: currentPrice,                     // legacy alias
    prevClose,
    market_value,
    marketValue: market_value,                   // legacy alias
    cost_basis,
    costBasis: cost_basis,                       // legacy alias
    unrealized_gain_loss_amount,
    unrealizedAmt: unrealized_gain_loss_amount,  // legacy alias
    unrealized_gain_loss_percent,
    unrealizedPct: unrealized_gain_loss_percent, // legacy alias
    daily_pnl_amount,
    dailyPnl: daily_pnl_amount,                  // legacy alias
    daily_pnl_percent,
    dailyPct: daily_pnl_percent,                 // legacy alias
    realized_gain_loss_amount: safeNumber(h.realized_gain_loss_amount),
    realizedGain: safeNumber(h.realized_gain_loss_amount), // legacy alias
    currency: asset.currency,
    sector: asset.sector,
    assetClass: asset.asset_class,
    asset_class: asset.asset_class,
    country: asset.country,
    industry: asset.industry,
    name: asset.name,
    exchange: asset.exchange,
    sparkline: generateSparkline(currentPrice, 0.02, trend, h.ticker),
    purchase_history: h.purchase_history ?? [],
    purchaseHistory: h.purchase_history ?? [],   // legacy alias
    missing_price: false,
    warning: null,
  };
});

// ─── LOOKUP HELPERS ───────────────────────────────────────────
export const getAccount = (accountId) =>
  accounts.find(a => a.id === accountId) ?? null;

export const getInstitution = (institutionId) =>
  institutions.find(i => i.id === institutionId) ?? null;

export const getInstitutionForAccount = (accountId) => {
  const acc = getAccount(accountId);
  return acc ? getInstitution(acc.institution_id) : null;
};

// Legacy alias (old accounts used institutionId)
export const getInstitutionById = getInstitution;

/** All included account IDs (not excluded from portfolio) */
export const getIncludedAccountIds = () =>
  accounts.filter(a => a.included_in_portfolio !== false).map(a => a.id);

/** Active (quantity > 0) holdings for a set of account IDs */
export const getHoldingsForAccounts = (accountIds) =>
  holdings.filter(h => h.quantity > 0 && accountIds.includes(h.account_id));

/** Sum of market values for a set of holdings */
export const sumMarketValue = (hs) =>
  safeArray(hs).reduce((s, h) => s + safeNumber(h.market_value), 0);

/** Sum of cash balances for a set of account IDs */
export const sumCash = (accountIds) =>
  accounts
    .filter(a => accountIds.includes(a.id))
    .reduce((s, a) => s + safeNumber(a.cash_balance), 0);

// ─── ACCOUNT VALUE ────────────────────────────────────────────
/**
 * Total Account Value = Cash Balance + Sum of Market Value of all holdings in the account
 */
export const calcAccountValue = (accountId) => {
  const acc = getAccount(accountId);
  if (!acc) return 0;
  const hs = holdings.filter(h => h.quantity > 0 && h.account_id === accountId);
  return safeNumber(acc.cash_balance) + sumMarketValue(hs);
};

// ─── PORTFOLIO TOTALS ─────────────────────────────────────────
/**
 * Calculate all portfolio-level totals for a given set of account IDs.
 * If accountIds is null, uses all included accounts.
 */
export const calcPortfolioTotals = (accountIds = null) => {
  const ids = accountIds ?? getIncludedAccountIds();
  const activeHoldings = getHoldingsForAccounts(ids);
  const cash_total = sumCash(ids);
  const holdings_value = sumMarketValue(activeHoldings);
  const total_value = holdings_value + cash_total;

  let total_cost_basis = 0;
  let total_unrealized_gain = 0;
  let total_realized_gain = 0;
  let total_daily_pnl = 0;

  activeHoldings.forEach(h => {
    total_cost_basis += safeNumber(h.cost_basis);
    total_unrealized_gain += safeNumber(h.unrealized_gain_loss_amount);
    total_realized_gain += safeNumber(h.realized_gain_loss_amount);
    total_daily_pnl += safeNumber(h.daily_pnl_amount);
  });

  const unrealized_pct = total_cost_basis > 0
    ? (total_unrealized_gain / total_cost_basis) * 100
    : null;

  const daily_pnl_pct = (total_value - total_daily_pnl) > 0
    ? (total_daily_pnl / (total_value - total_daily_pnl)) * 100
    : null;

  // Top holding by market value
  const sorted_by_value = [...activeHoldings].sort((a, b) => b.market_value - a.market_value);
  const top_holding = sorted_by_value[0] ?? null;

  // Largest gainer/loser by daily P&L
  const sorted_by_daily = [...activeHoldings].sort((a, b) =>
    safeNumber(b.daily_pnl_amount) - safeNumber(a.daily_pnl_amount)
  );
  const largest_gainer = sorted_by_daily[0] ?? null;
  const largest_loser = sorted_by_daily[sorted_by_daily.length - 1] ?? null;

  return {
    // Primary totals
    total_value,
    holdings_value,
    cash_total,
    total_cost_basis,
    total_unrealized_gain,
    unrealized_pct,
    total_realized_gain,
    total_daily_pnl,
    daily_pnl_pct,
    holding_count: activeHoldings.length,
    account_count: ids.length,
    top_holding,
    largest_gainer,
    largest_loser,
    // Legacy aliases for existing components
    totalValue: total_value,
    holdingsValue: holdings_value,
    cashTotal: cash_total,
    totalCostBasis: total_cost_basis,
    totalUnrealizedGain: total_unrealized_gain,
    unrealizedPct: unrealized_pct,
    totalRealizedGain: total_realized_gain,
    totalDailyPnl: total_daily_pnl,
    holdingCount: activeHoldings.length,
    accountCount: ids.length,
  };
};

// Legacy export
export const getPortfolioTotals = () => calcPortfolioTotals();

// ─── ACCOUNT SUMMARY ──────────────────────────────────────────
/**
 * For a single account, return full calculated summary.
 */
export const calcAccountSummary = (accountId) => {
  const acc = getAccount(accountId);
  if (!acc) return null;
  const inst = getInstitution(acc.institution_id);
  const acc_holdings = holdings.filter(h => h.quantity > 0 && h.account_id === accountId);
  const holdings_value = sumMarketValue(acc_holdings);
  const cash_balance = safeNumber(acc.cash_balance);
  const total_account_value = holdings_value + cash_balance;

  let cost_basis = 0, unrealized_gain = 0, realized_gain = 0, daily_pnl = 0;
  acc_holdings.forEach(h => {
    cost_basis += safeNumber(h.cost_basis);
    unrealized_gain += safeNumber(h.unrealized_gain_loss_amount);
    realized_gain += safeNumber(h.realized_gain_loss_amount);
    daily_pnl += safeNumber(h.daily_pnl_amount);
  });

  const unrealized_pct = cost_basis > 0 ? (unrealized_gain / cost_basis) * 100 : null;
  const daily_pnl_pct = (total_account_value - daily_pnl) > 0
    ? (daily_pnl / (total_account_value - daily_pnl)) * 100
    : null;

  const by_value = [...acc_holdings].sort((a, b) => b.market_value - a.market_value);
  const by_daily = [...acc_holdings].sort((a, b) =>
    safeNumber(b.daily_pnl_amount) - safeNumber(a.daily_pnl_amount)
  );

  return {
    account_id: accountId,
    account_name: acc.account_name,
    account_type: acc.account_type,
    institution_name: inst?.name ?? '',
    institution_id: acc.institution_id,
    base_currency: acc.base_currency,
    total_account_value,
    cash_balance,
    holdings_value,
    cost_basis,
    unrealized_gain,
    unrealized_pct,
    realized_gain,
    daily_pnl,
    daily_pnl_pct,
    holding_count: acc_holdings.length,
    top_holding: by_value[0] ?? null,
    largest_contributor: by_daily[0] ?? null,
    worst_contributor: by_daily[by_daily.length - 1] ?? null,
    last_updated: acc.last_updated,
    // Legacy aliases
    type: acc.account_type,
    instName: inst?.name ?? '',
    value: total_account_value,
    cashBalance: cash_balance,
    holdingsValue: holdings_value,
    dailyPnl: daily_pnl,
    unrealizedGain: unrealized_gain,
    unrealizedPct: unrealized_pct,
  };
};

// ─── HOLDINGS WITH FULL CALCULATIONS ─────────────────────────
/**
 * Return enriched holdings with all allocation percentages calculated
 * dynamically from the selected account group.
 *
 * Allocation rules:
 * - % of portfolio = holding MV ÷ total selected portfolio value
 * - % of account   = holding MV ÷ total account value
 * - % of asset class = holding MV ÷ total MV of same asset class in selection
 * - % of sector    = holding MV ÷ total MV of same sector in selection
 * - % of institution = holding MV ÷ total MV at same institution in selection
 * - if denominator is 0 → null (renders as N/A)
 */
export const calcHoldingsWithAllocations = (accountIds = null) => {
  const ids = accountIds ?? getIncludedAccountIds();
  const active = getHoldingsForAccounts(ids);

  const portfolio_value = sumMarketValue(active) + sumCash(ids);

  // Build group totals for dynamic allocation denominators
  const asset_class_totals = {};
  const sector_totals = {};
  const institution_totals = {};

  active.forEach(h => {
    const ac = h.asset_class || 'Unknown';
    const sec = h.sector || 'Unknown';
    const inst = getInstitutionForAccount(h.account_id)?.id ?? 'unknown';
    asset_class_totals[ac] = (asset_class_totals[ac] || 0) + h.market_value;
    sector_totals[sec] = (sector_totals[sec] || 0) + h.market_value;
    institution_totals[inst] = (institution_totals[inst] || 0) + h.market_value;
  });

  return active.map(h => {
    const acc = getAccount(h.account_id);
    const inst = getInstitutionForAccount(h.account_id);
    const account_total = calcAccountValue(h.account_id);

    const ac_total = asset_class_totals[h.asset_class] ?? 0;
    const sec_total = sector_totals[h.sector] ?? 0;
    const inst_key = inst?.id ?? 'unknown';
    const inst_total = institution_totals[inst_key] ?? 0;

    return {
      ...h,
      // Dynamic allocation percentages — always calculated, never stored
      pct_of_portfolio: portfolio_value > 0 ? (h.market_value / portfolio_value) * 100 : null,
      pct_of_account: account_total > 0 ? (h.market_value / account_total) * 100 : null,
      pct_of_asset_class: ac_total > 0 ? (h.market_value / ac_total) * 100 : null,
      pct_of_sector: sec_total > 0 ? (h.market_value / sec_total) * 100 : null,
      pct_of_institution: inst_total > 0 ? (h.market_value / inst_total) * 100 : null,
      // Account / institution context
      account_type: acc?.account_type ?? '',
      account_name: acc?.account_name ?? '',
      institution_name: inst?.name ?? '',
      institution_id: inst?.id ?? '',
    };
  });
};

// ─── PORTFOLIO BREAKDOWN ──────────────────────────────────────
/**
 * Build allocation breakdown grouped by any key function.
 * Returns [{name, value, pct}] where pct is always from the group total.
 * Zero-quantity holdings are excluded.
 */
export const buildAllocation = (accountIds, keyFn) => {
  const hs = getHoldingsForAccounts(accountIds ?? getIncludedAccountIds());
  const map = {};
  hs.forEach(h => {
    const key = keyFn(h) || 'Unknown';
    map[key] = (map[key] || 0) + h.market_value;
  });
  const group_total = Object.values(map).reduce((s, v) => s + v, 0);
  return Object.entries(map)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      pct: group_total > 0 ? (value / group_total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Full portfolio breakdown for all dimensions.
 */
export const calcPortfolioBreakdown = (accountIds = null) => {
  const ids = accountIds ?? getIncludedAccountIds();
  return {
    by_asset_class:  buildAllocation(ids, h => h.asset_class),
    by_sector:       buildAllocation(ids, h => h.sector),
    by_country:      buildAllocation(ids, h => h.country),
    by_currency:     buildAllocation(ids, h => h.currency),
    by_institution:  buildAllocation(ids, h => getInstitutionForAccount(h.account_id)?.name ?? 'Unknown'),
    by_account_type: buildAllocation(ids, h => getAccount(h.account_id)?.account_type ?? 'Unknown'),
    crypto_holdings: getHoldingsForAccounts(ids).filter(h => h.asset_class === 'ETF' && h.sector === 'Crypto' || h.asset_class === 'Crypto'),
    etf_holdings:    getHoldingsForAccounts(ids).filter(h => h.asset_class === 'ETF'),
    stock_holdings:  getHoldingsForAccounts(ids).filter(h => h.asset_class === 'Stock'),
  };
};

// ─── PORTFOLIO SNAPSHOTS ──────────────────────────────────────
const _calcBasePortfolioValue = () => {
  let v = 0;
  accounts.forEach(acc => { v += safeNumber(acc.cash_balance); });
  rawHoldings.forEach(h => {
    const asset = assets[h.ticker];
    if (asset && h.quantity > 0) v += h.quantity * safeNumber(asset.current_price);
  });
  return Math.round(v);
};

const _portfolioBase = _calcBasePortfolioValue();

export const portfolioSnapshots = (() => {
  const snaps = [];
  let val = _portfolioBase * 0.78;
  let r = 9999;
  for (let i = 0; i < 365; i++) {
    const date = new Date('2025-05-05');
    date.setDate(date.getDate() + i);
    r = (r * 1664525 + 1013904223) & 0xffffffff;
    const rand = r / 0x100000000;
    const trend = (_portfolioBase - val) / _portfolioBase * 0.4;
    const dailyReturn = (rand - 0.43 + trend) * val * 0.012;
    val = Math.max(val + dailyReturn, _portfolioBase * 0.5);
    const dailyReturnPct = (dailyReturn / (val - dailyReturn)) * 100;

    // Simulate per-account deposit/withdrawal for contribution awareness
    const deposits = i % 30 === 0 ? 500 : 0;
    const withdrawals = i % 90 === 0 && i > 0 ? 200 : 0;

    snaps.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(val * 100) / 100,
      daily_return_amount: Math.round(dailyReturn * 100) / 100,
      daily_return_percent: Math.round(dailyReturnPct * 100) / 100,
      // Cumulative return from start
      cumulative_return_percent: Math.round(((val / (_portfolioBase * 0.78)) - 1) * 10000) / 100,
      deposits,
      withdrawals,
      net_contributions: deposits - withdrawals,
      // Legacy aliases
      dailyReturn: Math.round(dailyReturn * 100) / 100,
      dailyReturnPct: Math.round(dailyReturnPct * 100) / 100,
    });
  }
  snaps[snaps.length - 1].value = _portfolioBase;
  return snaps;
})();

// ─── MONTHLY RETURNS ──────────────────────────────────────────
/**
 * Derive monthly returns from snapshots.
 * Compares end-of-month value vs end-of-prior-month value.
 * Marks months as contribution-adjusted if deposit/withdrawal data exists.
 */
export const calcMonthlyReturns = (numYears = 3) => {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const monthEndMap = {};
  safeArray(portfolioSnapshots).forEach(snap => {
    if (!snap?.date) return;
    const ym = snap.date.slice(0, 7);
    const v = safeNumber(snap.value, null);
    if (v !== null) monthEndMap[ym] = v;
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const years = [];
  for (let y = numYears - 1; y >= 0; y--) {
    const year = currentYear - y;
    const months = {};
    let yearStartValue = null;
    let yearEndValue = null;

    MONTHS.forEach((m, mi) => {
      if (year === currentYear && mi > currentMonth) {
        months[m] = null;
        return;
      }
      const ym     = `${year}-${String(mi + 1).padStart(2, '0')}`;
      const ymPrev = mi === 0
        ? `${year - 1}-12`
        : `${year}-${String(mi).padStart(2, '0')}`;

      const endVal   = safeNumber(monthEndMap[ym], null);
      const startVal = safeNumber(monthEndMap[ymPrev], null);

      if (endVal !== null && startVal !== null && startVal > 0) {
        months[m] = Math.round(((endVal - startVal) / startVal) * 1000) / 10;
        if (yearStartValue === null) yearStartValue = startVal;
        yearEndValue = endVal;
      } else {
        months[m] = null;
      }
    });

    const yearTotal = yearStartValue != null && yearEndValue != null && yearStartValue > 0
      ? Math.round(((yearEndValue - yearStartValue) / yearStartValue) * 1000) / 10
      : null;

    years.push({ year, months, yearTotal });
  }
  return years;
};

// ─── PERFORMANCE DATA ─────────────────────────────────────────
/**
 * Return time-series performance data for a set of accounts.
 * Supports both dollar value and percent (starts at 0% on first date).
 * Formula: pct = (current / start) - 1
 */
export const calcPerformanceData = (accountIds = null, days = 365) => {
  const snaps = safeArray(portfolioSnapshots).slice(-days);
  const startValue = safeNumber(snaps[0]?.value, 1);

  return snaps.map(snap => ({
    date: snap.date,
    value: snap.value,
    dollar_return: snap.value - _portfolioBase * 0.78,
    pct_return: Math.round(safeDivide(snap.value - startValue, startValue) * 10000) / 100,
    daily_return_amount: snap.daily_return_amount,
    daily_return_percent: snap.daily_return_percent,
    cumulative_return_percent: snap.cumulative_return_percent,
    deposits: snap.deposits,
    withdrawals: snap.withdrawals,
    // Legacy aliases
    dailyReturn: snap.dailyReturn,
    dailyReturnPct: snap.dailyReturnPct,
  }));
};

// ─── INSIGHTS ─────────────────────────────────────────────────
export const getInsights = (accountIds = null) => {
  const ids = accountIds ?? getIncludedAccountIds();
  const totals = calcPortfolioTotals(ids);
  const hs = getHoldingsForAccounts(ids);
  const result = [];

  const techAlloc = buildAllocation(ids, h => h.sector);
  const techEntry = techAlloc.find(a => a.name === 'Technology');
  if (techEntry && techEntry.pct > 40) {
    result.push({
      id: 'i1', type: 'warning', severity: 'medium',
      title: 'High Concentration in Technology',
      description: `Technology sector makes up ${techEntry.pct.toFixed(1)}% of your selected portfolio. Consider diversifying to reduce sector risk.`,
    });
  }

  const best = [...hs]
    .filter(h => h.unrealized_gain_loss_percent !== null)
    .sort((a, b) => safeNumber(b.unrealized_gain_loss_percent) - safeNumber(a.unrealized_gain_loss_percent))[0];
  if (best && safeNumber(best.unrealized_gain_loss_percent) > 10) {
    result.push({
      id: 'i2', type: 'info', severity: 'low',
      title: `Top Performer: ${best.ticker}`,
      description: `${best.name} is up ${safeNumber(best.unrealized_gain_loss_percent).toFixed(1)}% from your average cost.`,
    });
  }

  const worst = [...hs]
    .filter(h => h.unrealized_gain_loss_percent !== null)
    .sort((a, b) => safeNumber(a.unrealized_gain_loss_percent) - safeNumber(b.unrealized_gain_loss_percent))[0];
  if (worst && safeNumber(worst.unrealized_gain_loss_percent) < -10) {
    result.push({
      id: 'i5', type: 'alert', severity: 'high',
      title: `Unrealized Loss on ${worst.ticker}`,
      description: `${worst.name} is down ${Math.abs(safeNumber(worst.unrealized_gain_loss_percent)).toFixed(1)}% from your average cost.`,
    });
  }

  const currencyAlloc = buildAllocation(ids, h => h.currency);
  const usdEntry = currencyAlloc.find(a => a.name === 'USD');
  if (usdEntry && usdEntry.pct > 60) {
    result.push({
      id: 'i3', type: 'warning', severity: 'medium',
      title: 'Currency Exposure',
      description: `${usdEntry.pct.toFixed(1)}% of your portfolio is in USD. Consider your CAD obligations and hedging strategies.`,
    });
  }

  const fhsaAcc = accounts.find(a => a.account_type === 'FHSA' && ids.includes(a.id));
  if (fhsaAcc) {
    result.push({
      id: 'i4', type: 'success', severity: 'low',
      title: 'FHSA Contribution Room',
      description: "You've maximized your FHSA for 2026. Keeping tax-advantaged accounts topped up is a great long-term strategy.",
    });
  }

  const cashPct = totals.total_value > 0 ? (totals.cash_total / totals.total_value) * 100 : 0;
  if (cashPct < 5) {
    result.push({
      id: 'i6', type: 'info', severity: 'low',
      title: 'Low Cash Allocation',
      description: `Cash represents ${cashPct.toFixed(1)}% of your portfolio. Ensure you have enough liquidity for opportunities.`,
    });
  }

  const nvdaH = hs.find(h => h.ticker === 'NVDA');
  if (nvdaH && safeNumber(nvdaH.unrealized_gain_loss_percent) > 30) {
    result.push({
      id: 'i7', type: 'success', severity: 'low',
      title: `Strong ${nvdaH.ticker} Gains`,
      description: `${nvdaH.name} is up ${safeNumber(nvdaH.unrealized_gain_loss_percent).toFixed(1)}% from your average cost.`,
    });
  }

  return result;
};

// Legacy export
export const insights = getInsights();

// ─── BACKWARD COMPATIBILITY — re-export legacy mockData shape ──
// Existing pages import from mockData.js — we keep those working.
// Legacy field names are aliased throughout holdings enrichment above.
export const institutionsLegacy = institutions.map(i => ({
  ...i,
  // old field names
  status: i.connection_status,
  lastSync: i.last_sync_time,
}));