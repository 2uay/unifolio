import { safeNumber, safeDivide } from './safeNum.js';
import { getETFGroup } from './etfEquivalenceMap.js';

/**
 * Stacks holdings with the same ticker across multiple accounts into one combined row.
 *
 * Matching priority:
 *   1. asset_id (if present)
 *   2. ticker symbol (case-insensitive)
 *   3. name (fallback)
 *
 * @param {Array} holdings - Enriched, filtered holdings (active, quantity > 0)
 * @param {Object} helpers - { getAccount, getInstitutionForAccount }
 * @returns {Array} Stacked holdings array
 */
export function stackHoldings(holdings, { getAccount, getInstitutionForAccount } = {}) {
  const groups = new Map();
  const order = []; // preserve first-seen order

  holdings.forEach(h => {
    const key = (h.asset_id || h.ticker || h.name || 'unknown').toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(h);
  });

  return order.map(key => {
    const group = groups.get(key);

    // Single holding — return unchanged, just flag it
    if (group.length === 1) {
      return { ...group[0], _isStacked: false, _stackedChildren: group };
    }

    // Aggregate sums
    const totalQty = group.reduce((s, h) => s + safeNumber(h.quantity ?? h.position ?? 0), 0);
    const totalMarketValue = group.reduce((s, h) => s + safeNumber(h.market_value ?? h.marketValue ?? 0), 0);
    const totalCostBasis = group.reduce((s, h) => s + safeNumber(h.cost_basis ?? h.costBasis ?? 0), 0);
    const totalDailyPnl = group.reduce((s, h) => s + safeNumber(h.daily_pnl_amount ?? h.dailyPnl ?? 0), 0);
    const totalUnrealizedAmt = group.reduce((s, h) => s + safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt ?? 0), 0);
    const totalRealizedGain = group.reduce((s, h) => s + safeNumber(h.realized_gain_loss_amount ?? h.realizedGain ?? 0), 0);

    // Heatmap enrichment fields — sum portfolio-relative contributions
    const totalRealizedContrib = group.reduce((s, h) => s + safeNumber(h._realizedGainContribution ?? 0), 0);
    const totalPortfolioWeight = group.reduce((s, h) => s + safeNumber(h._portfolioWeight ?? 0), 0);

    // Weighted averages
    const avgPrice = totalQty > 0 ? safeDivide(totalCostBasis, totalQty) : 0;
    const unrealizedPct = totalCostBasis > 0 ? safeDivide(totalUnrealizedAmt, totalCostBasis) * 100 : 0;
    const prevDayValue = totalMarketValue - totalDailyPnl;
    const dailyPct = prevDayValue > 0 ? safeDivide(totalDailyPnl, prevDayValue) * 100 : 0;

    // Current price — same ticker should have same price; use first child
    const currentPrice = safeNumber(group[0].current_price ?? group[0].lastPrice ?? 0);

    // Sparkline — take first child's (all should be the same ticker)
    const sparkline = group[0].sparkline ?? [];

    // Account label
    const accountTypes = [...new Set(
      group.map(h => {
        const acc = getAccount ? getAccount(h.account_id ?? h.accountId) : null;
        return acc?.account_type ?? acc?.type ?? h.account_type ?? 'Unknown';
      })
    )];
    const accountLabel = accountTypes.length <= 2
      ? accountTypes.join(', ')
      : `${group.length} accounts`;

    // Institution label
    const instNames = [...new Set(
      group.map(h => {
        const inst = getInstitutionForAccount ? getInstitutionForAccount(h.account_id ?? h.accountId) : null;
        return inst?.name ?? 'Unknown';
      })
    )];
    const institutionLabel = instNames.length <= 2
      ? instNames.join(' + ')
      : `${instNames.length} institutions`;

    const ticker = group[0].ticker;

    return {
      // Preserve metadata from first child (asset class, sector, currency, etc.)
      ...group[0],

      // Identity
      id: `stacked-${key}`,
      ticker,
      _isStacked: true,
      _stackedCount: group.length,
      _stackedChildren: group,
      _accountLabel: accountLabel,
      _institutionLabel: institutionLabel,

      // Aggregated quantities
      quantity: totalQty,
      position: totalQty,

      // Aggregated financials
      market_value: totalMarketValue,
      marketValue: totalMarketValue,
      cost_basis: totalCostBasis,
      costBasis: totalCostBasis,
      daily_pnl_amount: totalDailyPnl,
      dailyPnl: totalDailyPnl,
      unrealized_gain_loss_amount: totalUnrealizedAmt,
      unrealizedAmt: totalUnrealizedAmt,
      realized_gain_loss_amount: totalRealizedGain,
      realizedGain: totalRealizedGain,

      // Weighted averages
      average_price: avgPrice,
      avgPrice: avgPrice,
      current_price: currentPrice,
      lastPrice: currentPrice,
      unrealized_gain_loss_percent: unrealizedPct,
      unrealizedPct: unrealizedPct,
      daily_pnl_percent: dailyPct,
      dailyPct: dailyPct,

      // Heatmap fields
      _realizedGainContribution: totalRealizedContrib,
      _portfolioWeight: totalPortfolioWeight,

      // Visual
      sparkline,
    };
  });
}

/**
 * Groups holdings that track the same underlying ETF index across different
 * markets/currencies (e.g. VOO USD + VFV.TO CAD → one "S&P 500" row).
 *
 * Must be called AFTER stackHoldings(). Preserves first-seen order.
 *
 * @param {Array} holdings  - Already-stacked holdings (output of stackHoldings or raw)
 * @param {Object} options  - { convert, displayCurrency, getAccount, getInstitutionForAccount }
 */
export function stackCDRGroups(holdings, { convert, displayCurrency = 'CAD', getAccount, getInstitutionForAccount } = {}) {
  const conv = convert ?? ((v) => v);
  const result = [];
  const processedCanonicals = new Set();

  holdings.forEach((h) => {
    const ticker = h.ticker;
    if (!ticker) { result.push(h); return; }

    const group = getETFGroup(ticker);
    if (!group) { result.push(h); return; }

    const canonical = group.canonical;
    if (processedCanonicals.has(canonical)) return;
    processedCanonicals.add(canonical);

    // Collect all holdings in this canonical group
    const groupRows = holdings.filter(x => {
      if (!x.ticker) return false;
      return getETFGroup(x.ticker)?.canonical === canonical;
    });

    const uniqueTickers = [...new Set(groupRows.map(r => r.ticker))];

    // Only one distinct ticker in the group — no cross-market merging needed
    if (uniqueTickers.length <= 1) {
      result.push(...groupRows);
      return;
    }

    // Convert all financials to display currency and aggregate
    const totalMV    = groupRows.reduce((s, r) => s + conv(safeNumber(r.market_value  ?? r.marketValue  ?? 0), r.currency || 'USD'), 0);
    const totalCB    = groupRows.reduce((s, r) => s + conv(safeNumber(r.cost_basis    ?? r.costBasis    ?? 0), r.currency || 'USD'), 0);
    const totalDP    = groupRows.reduce((s, r) => s + conv(safeNumber(r.daily_pnl_amount ?? r.dailyPnl  ?? 0), r.currency || 'USD'), 0);
    const totalUG    = groupRows.reduce((s, r) => s + conv(safeNumber(r.unrealized_gain_loss_amount ?? r.unrealizedAmt ?? 0), r.currency || 'USD'), 0);
    const totalRG    = groupRows.reduce((s, r) => s + conv(safeNumber(r.realized_gain_loss_amount   ?? r.realizedGain ?? 0), r.currency || 'USD'), 0);
    const totalPW    = groupRows.reduce((s, r) => s + safeNumber(r._portfolioWeight         ?? 0), 0);
    const totalRC    = groupRows.reduce((s, r) => s + safeNumber(r._realizedGainContribution ?? 0), 0);

    const unrealizedPct = totalCB  > 0 ? safeDivide(totalUG, totalCB) * 100 : 0;
    const prevDayValue  = totalMV - totalDP;
    const dailyPct      = prevDayValue > 0 ? safeDivide(totalDP, prevDayValue) * 100 : 0;

    // Account/institution labels: prefer existing _labels from stacked children
    const acctTypes  = [...new Set(groupRows.flatMap(r =>
      r._isStacked && r._accountLabel
        ? [r._accountLabel]
        : [(getAccount?.(r.account_id ?? r.accountId)?.account_type ?? r.account_type ?? 'Unknown')]
    ))];
    const instNames  = [...new Set(groupRows.flatMap(r =>
      r._isStacked && r._institutionLabel
        ? [r._institutionLabel]
        : [(getInstitutionForAccount?.(r.account_id ?? r.accountId)?.name ?? 'Unknown')]
    ))];
    const accountLabel     = acctTypes.length <= 2 ? acctTypes.join(', ') : `${groupRows.length} accounts`;
    const institutionLabel = instNames.length  <= 2 ? instNames.join(' + ') : `${instNames.length} institutions`;

    result.push({
      ...groupRows[0],
      // Identity
      id:                  `cdr-${canonical.toLowerCase().replace(/\s+/g, '-')}`,
      ticker:              uniqueTickers.join(' + '),
      name:                canonical,
      _isCDRGroup:         true,
      _isCDRGroupName:     canonical,
      _isStacked:          true,
      _stackedCount:       groupRows.length,
      _stackedChildren:    groupRows,
      _accountLabel:       accountLabel,
      _institutionLabel:   institutionLabel,
      // All values already in display currency — set currency so convert() is a no-op
      currency:            displayCurrency,
      // Aggregated financials
      market_value:  totalMV,  marketValue:  totalMV,
      cost_basis:    totalCB,  costBasis:    totalCB,
      daily_pnl_amount: totalDP, dailyPnl:   totalDP,
      unrealized_gain_loss_amount: totalUG,  unrealizedAmt: totalUG,
      realized_gain_loss_amount:   totalRG,  realizedGain:  totalRG,
      // Percentages
      unrealized_gain_loss_percent: unrealizedPct, unrealizedPct,
      daily_pnl_percent: dailyPct, dailyPct,
      // Heatmap
      _portfolioWeight:         totalPW,
      _realizedGainContribution: totalRC,
      // Per-unit fields: not meaningful across currencies
      current_price:  null,  lastPrice: null,
      average_price:  null,  avgPrice:  null,
      quantity:       null,  position:  null,
    });
  });

  return result;
}
