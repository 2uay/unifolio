// ============================================================
// Unifolio Portfolio Health Score
// Inputs: enriched holdings, accounts, cash info
// Output: { score, grade, summary, factors[] }
// ============================================================

function herfindahl(weights) {
  // Returns 0 (perfectly diversified) → 1 (100% concentrated)
  return weights.reduce((sum, w) => sum + w * w, 0);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function calcHealthScore({ holdings, accounts, totalValue, cashTotal, portfolioSnapshots }) {
  if (!holdings || holdings.length === 0 || totalValue <= 0) {
    return { score: 0, grade: 'N/A', summary: 'Add holdings to see your portfolio health score.', factors: [] };
  }

  const factors = [];
  let totalScore = 0;

  // ── 1. CONCENTRATION RISK (20 pts) ────────────────────────

  const mvByTicker = {};
  holdings.forEach(h => {
    const mv = (h.lastPrice ?? h.current_price ?? 0) * (h.position ?? h.quantity ?? 0);
    mvByTicker[h.ticker] = (mvByTicker[h.ticker] || 0) + mv;
  });
  const tickerWeights = Object.values(mvByTicker).map(mv => mv / totalValue);
  const sortedWeights = [...tickerWeights].sort((a, b) => b - a);
  const top1 = sortedWeights[0] || 0;
  const top5 = sortedWeights.slice(0, 5).reduce((s, w) => s + w, 0);

  let concentrationScore = 20;
  let concentrationNote = '';
  if (top1 > 0.4) { concentrationScore = 0; concentrationNote = `Top holding is ${(top1 * 100).toFixed(0)}% of portfolio — very high concentration.`; }
  else if (top1 > 0.25) { concentrationScore = 5; concentrationNote = `Top holding is ${(top1 * 100).toFixed(0)}% — consider trimming.`; }
  else if (top1 > 0.15) { concentrationScore = 12; concentrationNote = `Top holding is ${(top1 * 100).toFixed(0)}% — moderate concentration.`; }
  else if (top5 > 0.7) { concentrationScore = 14; concentrationNote = `Top 5 holdings are ${(top5 * 100).toFixed(0)}% of portfolio.`; }
  else { concentrationNote = `Good spread — top holding is ${(top1 * 100).toFixed(0)}% of portfolio.`; }

  totalScore += concentrationScore;
  factors.push({
    id: 'concentration',
    label: 'Concentration Risk',
    score: concentrationScore,
    max: 20,
    note: concentrationNote,
    good: concentrationScore >= 14,
  });

  // ── 2. SECTOR DIVERSIFICATION (15 pts) ─────────────────────

  const mvBySector = {};
  holdings.forEach(h => {
    const sector = h.sector || 'Other';
    const mv = (h.lastPrice ?? 0) * (h.position ?? h.quantity ?? 0);
    mvBySector[sector] = (mvBySector[sector] || 0) + mv;
  });
  const sectorWeights = Object.values(mvBySector).map(mv => mv / totalValue);
  const hhi = herfindahl(sectorWeights);
  const sectorCount = sectorWeights.length;

  let sectorScore = 0;
  let sectorNote = '';
  if (sectorCount === 1) { sectorScore = 2; sectorNote = 'Portfolio is in a single sector — high sector risk.'; }
  else if (hhi > 0.5) { sectorScore = 5; sectorNote = `Heavy sector concentration (${sectorCount} sectors).`; }
  else if (hhi > 0.3) { sectorScore = 9; sectorNote = `Moderate sector spread (${sectorCount} sectors).`; }
  else if (hhi > 0.15) { sectorScore = 12; sectorNote = `Good sector diversification (${sectorCount} sectors).`; }
  else { sectorScore = 15; sectorNote = `Well-diversified across ${sectorCount} sectors.`; }

  totalScore += sectorScore;
  factors.push({
    id: 'sector',
    label: 'Sector Diversification',
    score: sectorScore,
    max: 15,
    note: sectorNote,
    good: sectorScore >= 10,
  });

  // ── 3. CURRENCY DIVERSIFICATION (10 pts) ───────────────────

  const mvByCurrency = {};
  holdings.forEach(h => {
    const cur = h.currency || 'USD';
    const mv = (h.lastPrice ?? 0) * (h.position ?? h.quantity ?? 0);
    mvByCurrency[cur] = (mvByCurrency[cur] || 0) + mv;
  });
  const currencyWeights = Object.values(mvByCurrency).map(mv => mv / totalValue);
  const maxCurrencyPct = Math.max(...currencyWeights);

  let currencyScore = 0;
  let currencyNote = '';
  if (maxCurrencyPct > 0.95) { currencyScore = 3; currencyNote = `100% in one currency — no FX diversification.`; }
  else if (maxCurrencyPct > 0.8) { currencyScore = 5; currencyNote = `${(maxCurrencyPct * 100).toFixed(0)}% in one currency — limited FX exposure.`; }
  else if (maxCurrencyPct > 0.6) { currencyScore = 7; currencyNote = `${(maxCurrencyPct * 100).toFixed(0)}% in one currency — moderate FX exposure.`; }
  else { currencyScore = 10; currencyNote = `Good currency diversification across ${Object.keys(mvByCurrency).length} currencies.`; }

  totalScore += currencyScore;
  factors.push({
    id: 'currency',
    label: 'Currency Exposure',
    score: currencyScore,
    max: 10,
    note: currencyNote,
    good: currencyScore >= 7,
  });

  // ── 4. ACCOUNT TYPE DIVERSIFICATION (10 pts) ───────────────

  const accountTypes = [...new Set((accounts || []).filter(a => a.included_in_portfolio !== false).map(a => a.account_type ?? a.type ?? ''))].filter(Boolean);
  const hasRegistered = accountTypes.some(t => ['TFSA', 'RRSP', 'FHSA'].includes(t));
  const hasNonRegistered = accountTypes.some(t => ['Cash', 'Margin', 'Corporate'].includes(t));
  const acctTypeCount = accountTypes.length;

  let acctScore = 0;
  let acctNote = '';
  if (acctTypeCount === 0 || acctTypeCount === 1) { acctScore = 3; acctNote = 'Only one account type — consider diversifying across registered and non-registered.'; }
  else if (hasRegistered && hasNonRegistered) { acctScore = 10; acctNote = `Good mix — ${accountTypes.join(', ')} accounts.`; }
  else if (acctTypeCount >= 2) { acctScore = 6; acctNote = `${acctTypeCount} account types, but missing a mix of registered and non-registered.`; }

  totalScore += acctScore;
  factors.push({
    id: 'accountTypes',
    label: 'Account Type Mix',
    score: acctScore,
    max: 10,
    note: acctNote,
    good: acctScore >= 6,
  });

  // ── 5. UNREALIZED GAIN BUFFER (15 pts) ─────────────────────

  let totalUnrealized = 0;
  let totalCostBasis = 0;
  holdings.forEach(h => {
    const qty = h.position ?? h.quantity ?? 0;
    const avg = h.average_price ?? h.avgPrice ?? 0;
    const lp = h.lastPrice ?? 0;
    totalCostBasis += avg * qty;
    totalUnrealized += (lp - avg) * qty;
  });
  const unrealPct = totalCostBasis > 0 ? totalUnrealized / totalCostBasis : 0;

  let gainScore = 0;
  let gainNote = '';
  if (unrealPct > 0.3) { gainScore = 15; gainNote = `Strong unrealized gain of ${(unrealPct * 100).toFixed(0)}% — solid cushion.`; }
  else if (unrealPct > 0.1) { gainScore = 12; gainNote = `Healthy unrealized gain of ${(unrealPct * 100).toFixed(0)}%.`; }
  else if (unrealPct > 0) { gainScore = 8; gainNote = `Modest unrealized gain of ${(unrealPct * 100).toFixed(0)}%.`; }
  else if (unrealPct > -0.1) { gainScore = 4; gainNote = `Portfolio is slightly underwater (${(unrealPct * 100).toFixed(0)}% unrealized).`; }
  else { gainScore = 0; gainNote = `Portfolio is down ${(Math.abs(unrealPct) * 100).toFixed(0)}% unrealized — consider reviewing positions.`; }

  totalScore += gainScore;
  factors.push({
    id: 'unrealizedGain',
    label: 'Unrealized Gain Buffer',
    score: gainScore,
    max: 15,
    note: gainNote,
    good: gainScore >= 8,
  });

  // ── 6. CASH DRAG (10 pts) ──────────────────────────────────

  const cashPct = cashTotal / totalValue;
  let cashScore = 0;
  let cashNote = '';
  if (cashPct > 0.3) { cashScore = 1; cashNote = `${(cashPct * 100).toFixed(0)}% cash — significant drag on returns.`; }
  else if (cashPct > 0.15) { cashScore = 4; cashNote = `${(cashPct * 100).toFixed(0)}% cash — consider deploying idle cash.`; }
  else if (cashPct > 0.05) { cashScore = 7; cashNote = `${(cashPct * 100).toFixed(0)}% cash — reasonable buffer.`; }
  else { cashScore = 10; cashNote = `${(cashPct * 100).toFixed(0)}% cash — fully invested.`; }

  totalScore += cashScore;
  factors.push({
    id: 'cash',
    label: 'Cash Utilization',
    score: cashScore,
    max: 10,
    note: cashNote,
    good: cashScore >= 7,
  });

  // ── 7. ASSET CLASS MIX (10 pts) ────────────────────────────

  const assetClasses = [...new Set(holdings.map(h => h.asset_class ?? h.assetClass ?? 'Stock'))].filter(Boolean);
  const hasETF = assetClasses.some(ac => ac.toLowerCase().includes('etf'));
  const hasStock = assetClasses.some(ac => ['stock', 'equity'].includes(ac.toLowerCase()));
  const classCount = assetClasses.length;

  let assetScore = 0;
  let assetNote = '';
  if (classCount >= 3) { assetScore = 10; assetNote = `Diversified across ${classCount} asset classes.`; }
  else if (classCount === 2) { assetScore = 7; assetNote = `${assetClasses.join(' + ')} — consider adding more asset classes.`; }
  else if (hasETF) { assetScore = 6; assetNote = 'ETFs provide built-in diversification, but consider adding other classes.'; }
  else { assetScore = 3; assetNote = `Only ${assetClasses[0] || 'one asset class'} — limited diversification.`; }

  totalScore += assetScore;
  factors.push({
    id: 'assetClass',
    label: 'Asset Class Mix',
    score: assetScore,
    max: 10,
    note: assetNote,
    good: assetScore >= 6,
  });

  // ── 8. PERFORMANCE TREND (10 pts) ─────────────────────────

  const snapshots = Array.isArray(portfolioSnapshots) ? portfolioSnapshots : [];
  let trendScore = 5;
  let trendNote = 'Insufficient history to evaluate performance trend.';

  if (snapshots.length >= 30) {
    const recent = snapshots[snapshots.length - 1]?.value || 0;
    const month30ago = snapshots[Math.max(0, snapshots.length - 30)]?.value || 0;
    if (month30ago > 0) {
      const trendReturn = (recent - month30ago) / month30ago;
      if (trendReturn > 0.05) { trendScore = 10; trendNote = `Strong 30-day performance: +${(trendReturn * 100).toFixed(1)}%.`; }
      else if (trendReturn > 0) { trendScore = 7; trendNote = `Positive 30-day trend: +${(trendReturn * 100).toFixed(1)}%.`; }
      else if (trendReturn > -0.05) { trendScore = 4; trendNote = `Slight 30-day decline: ${(trendReturn * 100).toFixed(1)}%.`; }
      else { trendScore = 1; trendNote = `Significant 30-day decline: ${(trendReturn * 100).toFixed(1)}%.`; }
    }
  }

  totalScore += trendScore;
  factors.push({
    id: 'trend',
    label: 'Recent Performance',
    score: trendScore,
    max: 10,
    note: trendNote,
    good: trendScore >= 5,
  });

  // ── FINAL SCORE ────────────────────────────────────────────

  const score = Math.round(clamp(totalScore, 0, 100));

  let grade, summary;
  if (score >= 80) {
    grade = 'A';
    summary = 'Well-diversified portfolio with strong risk management.';
  } else if (score >= 65) {
    grade = 'B';
    const weakest = factors.filter(f => !f.good).map(f => f.label.toLowerCase());
    summary = weakest.length > 0 ? `Good foundation — room to improve ${weakest.slice(0, 2).join(' and ')}.` : 'Good overall portfolio health.';
  } else if (score >= 45) {
    grade = 'C';
    const issues = factors.filter(f => !f.good).length;
    summary = `${issues} areas need attention — review concentration and diversification.`;
  } else {
    grade = 'D';
    summary = 'Portfolio has significant concentration or risk concerns to address.';
  }

  return { score, grade, summary, factors };
}
