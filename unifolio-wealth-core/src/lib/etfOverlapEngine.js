// ============================================================
// Unifolio ETF Overlap Engine
// Computes true stock exposure after accounting for ETF holdings.
// ============================================================

import { ETF_HOLDINGS, normalizeTicker } from './etfHoldings.js';

/**
 * Calculate true exposure for each stock after ETF overlap.
 *
 * @param {Array} holdings - enriched holdings with lastPrice, position, currency
 * @param {number} portfolioTotal - total portfolio value in display currency
 * @param {Function} convert - currency converter
 * @returns {Array} sorted by totalPct desc, only entries with ETF overlap
 */
export function calcTrueExposure(holdings, portfolioTotal, convert) {
  if (!holdings || holdings.length === 0 || portfolioTotal <= 0) return [];

  // Build direct stock positions
  const directPct = {};
  const etfHoldings = [];

  holdings.forEach(h => {
    const ticker = normalizeTicker(h.ticker);
    const mv = convert(
      (h.lastPrice ?? 0) * (h.position ?? h.quantity ?? 0),
      h.currency || 'USD'
    );
    const pct = mv / portfolioTotal;

    if (ETF_HOLDINGS[ticker]) {
      // This holding IS an ETF
      etfHoldings.push({ ticker, pct, etfData: ETF_HOLDINGS[ticker] });
    } else {
      // Direct stock holding
      directPct[ticker] = (directPct[ticker] || 0) + pct;
    }
  });

  if (etfHoldings.length === 0) return []; // No ETFs held — no overlap to show

  // Build indirect exposure from ETFs
  const indirectSources = {}; // ticker → [{ etfTicker, contribution }]

  etfHoldings.forEach(({ ticker: etfTicker, pct: etfPct, etfData }) => {
    etfData.holdings.forEach(({ ticker: underlying, weight }) => {
      const contribution = etfPct * weight;
      if (!indirectSources[underlying]) indirectSources[underlying] = [];
      indirectSources[underlying].push({ etfTicker, etfName: etfData.name, contribution });
    });
  });

  // Merge direct + indirect for any stock that has EITHER direct holding with ETF overlap
  // OR a significant indirect contribution from multiple ETFs
  const results = [];
  const allTickers = new Set([...Object.keys(directPct), ...Object.keys(indirectSources)]);

  allTickers.forEach(ticker => {
    const direct = directPct[ticker] || 0;
    const sources = indirectSources[ticker] || [];
    const etfTotal = sources.reduce((s, src) => s + src.contribution, 0);
    const total = direct + etfTotal;

    // Only include if there is actual ETF overlap (stock appears in both direct + ETF, or in 2+ ETFs)
    const hasOverlap = (direct > 0 && etfTotal > 0) || sources.length >= 2;
    if (!hasOverlap) return;
    if (total < 0.001) return; // filter negligible

    const sourceLabels = [
      ...(direct > 0 ? [`Direct ${(direct * 100).toFixed(1)}%`] : []),
      ...sources.map(s => `${s.etfTicker} ${(s.contribution * 100).toFixed(1)}%`),
    ];

    results.push({
      ticker,
      directPct: direct * 100,
      etfPct: etfTotal * 100,
      totalPct: total * 100,
      sources: sourceLabels,
      isHighConcentration: total > 0.08,
    });
  });

  return results.sort((a, b) => b.totalPct - a.totalPct);
}

/**
 * Return just the ETF tickers in the holdings
 */
export function getHeldETFs(holdings) {
  return holdings.filter(h => ETF_HOLDINGS[normalizeTicker(h.ticker)]).map(h => ({
    ticker: normalizeTicker(h.ticker),
    name: ETF_HOLDINGS[normalizeTicker(h.ticker)].name,
  }));
}

/**
 * X-Ray view: build one rich record per held ETF with weighted underlyings
 * marked when the user also holds them directly. Used by Insights to render
 * the per-ETF panel + heatmap.
 */
export function buildEtfXRay(holdings, portfolioTotal, convert) {
  if (!holdings || holdings.length === 0) return [];

  const directTickers = new Set();
  holdings.forEach(h => {
    const t = normalizeTicker(h.ticker);
    if (!ETF_HOLDINGS[t]) directTickers.add(t);
  });

  const records = [];
  holdings.forEach(h => {
    const ticker = normalizeTicker(h.ticker);
    const meta = ETF_HOLDINGS[ticker];
    if (!meta) return;
    const qty = h.position ?? h.quantity ?? 0;
    const px = h.lastPrice ?? h.last_price ?? h.price ?? 0;
    let mv = convert(qty * px, h.currency || 'USD');
    if (!mv) mv = convert(h.market_value || 0, h.currency || 'USD');
    const portfolioPct = portfolioTotal > 0 ? (mv / portfolioTotal) * 100 : 0;

    const underlyings = (meta.holdings || []).map(u => ({
      ticker: u.ticker,
      weight: u.weight,
      weightPct: u.weight * 100,
      indirectValue: mv * u.weight,
      overlapDirect: directTickers.has(u.ticker),
    }));

    records.push({
      ticker,
      name: meta.name || ticker,
      type: meta.type || 'ETF',
      marketValue: mv,
      portfolioPct,
      underlyings,
      overlapTickers: underlyings.filter(u => u.overlapDirect).map(u => u.ticker),
      coveragePct: underlyings.reduce((s, u) => s + u.weight, 0) * 100,
    });
  });

  return records.sort((a, b) => b.marketValue - a.marketValue);
}
