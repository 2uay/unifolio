import { safeNumber, safeDivide } from './safeNum.js';

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
