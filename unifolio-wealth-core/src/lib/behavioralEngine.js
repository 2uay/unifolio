// ============================================================
// Unifolio Behavioral Finance Engine
// Surfaces patterns in the user's own trading history. Pure
// functions over transactions + realizedPositions + holdings +
// portfolio snapshots. No new external data sources required —
// every pattern below works from data Unifolio already imports.
//
// Voice rule: observational, never prescriptive.
//   "You bought X on 3 occasions after 3-day rallies." ✓
//   "You should stop chasing rallies." ✗
// ============================================================

import { safeNumber } from './safeNum.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function asDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
}

function asMs(d) {
  const t = asDate(d);
  return t ? t.getTime() : null;
}

function dayDiff(a, b) {
  const ma = asMs(a);
  const mb = asMs(b);
  if (ma == null || mb == null) return null;
  return Math.abs(ma - mb) / MS_PER_DAY;
}

function isBuy(t) {
  return String(t.transaction_type || t.type || '').toLowerCase() === 'buy';
}

function isSell(t) {
  return String(t.transaction_type || t.type || '').toLowerCase() === 'sell';
}

function txAmount(t) {
  return Math.abs(safeNumber(t.total_amount ?? t.total ?? (safeNumber(t.quantity) * safeNumber(t.price))));
}

// Local hour from an ISO timestamp. Returns null if the date string lacks a
// time component (most broker CSV imports are date-only — we can't infer
// hour from those). When tx.date is "2026-04-15" we return null; when it's
// "2026-04-15T23:47:00Z" we return the user's local hour.
function localHour(dateStr) {
  if (typeof dateStr !== 'string') return null;
  if (!/T\d{2}:\d{2}/.test(dateStr)) return null;
  const d = asDate(dateStr);
  return d ? d.getHours() : null;
}

// ─── 1. REVENGE TRADING ───────────────────────────────────────
// User sells a position at a loss, then buys back the same ticker within
// LOOKBACK_DAYS. The CRA superficial-loss rule would also catch this — but
// from a behavioral angle, even rebuys after the 30-day window are flagged
// because the pattern is "I just took a loss, I want it back".

const REVENGE_LOOKBACK_DAYS = 14;

export function detectRevengeTrades(transactions = [], realizedPositions = []) {
  if (!Array.isArray(transactions) || !Array.isArray(realizedPositions)) return [];

  // Index realized losses by ticker → list of close dates
  const lossesByTicker = {};
  realizedPositions.forEach(pos => {
    const gl = safeNumber(pos.realized_gain_loss_amount ?? (safeNumber(pos.total_sale_value) - safeNumber(pos.total_cost_basis)));
    if (gl >= 0) return;
    const tk = String(pos.ticker || '').toUpperCase();
    const close = pos.close_date;
    if (!tk || !close) return;
    if (!lossesByTicker[tk]) lossesByTicker[tk] = [];
    lossesByTicker[tk].push({ closeDate: close, loss: gl });
  });

  // Walk buys; check whether the same ticker was sold at a loss within the
  // prior LOOKBACK_DAYS window. Each matched pair = one revenge event.
  const events = [];
  transactions.filter(isBuy).forEach(buy => {
    const tk = String(buy.ticker || '').toUpperCase();
    const buyDate = buy.date;
    if (!tk || !buyDate) return;
    const losses = lossesByTicker[tk] || [];
    losses.forEach(loss => {
      const d = dayDiff(loss.closeDate, buyDate);
      if (d == null || d > REVENGE_LOOKBACK_DAYS) return;
      // Buy must come AFTER the loss-realizing close.
      if (asMs(buyDate) <= asMs(loss.closeDate)) return;
      events.push({
        ticker: tk,
        sellDate: loss.closeDate,
        buyDate,
        realizedLoss: loss.loss,
        amountInvested: txAmount(buy),
        daysBetween: Math.round(d),
      });
    });
  });

  return events.sort((a, b) => asMs(b.buyDate) - asMs(a.buyDate));
}

// ─── 2. HOLDING PERIOD PERFORMANCE ────────────────────────────
// Compares realized P&L for positions held >30 days vs ≤30 days. The
// positive framing ("you consistently outperform when holding >30 days")
// reinforces good behavior when the data supports it.

const SHORT_HOLD_DAYS = 30;

export function analyzeHoldingPeriodPerformance(realizedPositions = []) {
  if (!Array.isArray(realizedPositions) || realizedPositions.length === 0) {
    return null;
  }

  const buckets = { short: [], long: [] };
  realizedPositions.forEach(pos => {
    const days = safeNumber(pos.holding_period_days);
    const cost = safeNumber(pos.total_cost_basis);
    const gl = safeNumber(pos.realized_gain_loss_amount ?? (safeNumber(pos.total_sale_value) - cost));
    if (cost <= 0 || days <= 0) return;
    const pctReturn = (gl / cost) * 100;
    (days > SHORT_HOLD_DAYS ? buckets.long : buckets.short).push({ pctReturn, gl, cost, days });
  });

  const summarize = (arr) => {
    if (arr.length === 0) return null;
    const totalCost = arr.reduce((s, p) => s + p.cost, 0);
    const totalGl = arr.reduce((s, p) => s + p.gl, 0);
    const weightedPct = totalCost > 0 ? (totalGl / totalCost) * 100 : 0;
    const winCount = arr.filter(p => p.pctReturn > 0).length;
    return {
      count: arr.length,
      weightedAvgReturnPct: weightedPct,
      winRatePct: arr.length > 0 ? (winCount / arr.length) * 100 : 0,
      totalGl,
    };
  };

  return {
    threshold: SHORT_HOLD_DAYS,
    short: summarize(buckets.short),
    long: summarize(buckets.long),
  };
}

// ─── 3. LATE-NIGHT TRADING ────────────────────────────────────
// Trades placed between 23:00 and 04:00 local time. Only works when the
// importing source supplies timestamps (Plaid + some brokers do; most CSV
// imports are date-only and yield zero late-night trades).

const LATE_START_HOUR = 23;
const LATE_END_HOUR = 4;

function isLateNightHour(hour) {
  return hour >= LATE_START_HOUR || hour < LATE_END_HOUR;
}

export function detectLateNightTrading(transactions = [], realizedPositions = []) {
  if (!Array.isArray(transactions)) return null;
  const tradeRows = transactions.filter(t => isBuy(t) || isSell(t));
  if (tradeRows.length === 0) return null;

  let timestampedCount = 0;
  const lateTrades = [];
  tradeRows.forEach(t => {
    const h = localHour(t.date);
    if (h == null) return;
    timestampedCount += 1;
    if (isLateNightHour(h)) {
      lateTrades.push({ ticker: String(t.ticker || '').toUpperCase(), date: t.date, hour: h, type: t.transaction_type });
    }
  });

  if (timestampedCount === 0) {
    // No timestamps in the data — we honestly can't tell. Return a marker
    // the UI can render as "import a source with timestamps to unlock this".
    return { available: false, reason: 'no-timestamps' };
  }

  // Correlate late-night trades with realized outcomes by date+ticker.
  const lossByKey = {};
  realizedPositions.forEach(pos => {
    const key = `${String(pos.ticker || '').toUpperCase()}::${(pos.close_date || '').slice(0, 10)}`;
    const gl = safeNumber(pos.realized_gain_loss_amount);
    lossByKey[key] = (lossByKey[key] || 0) + gl;
  });

  let lateWithRealized = 0;
  let lateNetGl = 0;
  lateTrades.forEach(t => {
    const key = `${t.ticker}::${(t.date || '').slice(0, 10)}`;
    if (key in lossByKey) {
      lateWithRealized += 1;
      lateNetGl += lossByKey[key];
    }
  });

  return {
    available: true,
    timestampedTradeCount: timestampedCount,
    lateTradeCount: lateTrades.length,
    lateTradePct: (lateTrades.length / timestampedCount) * 100,
    lateTradesWithRealizedOutcome: lateWithRealized,
    lateNetRealizedGl: lateNetGl,
    examples: lateTrades.slice(0, 5),
  };
}

// ─── 4. CONCENTRATION ADDICTION ───────────────────────────────
// User adds to a ticker that's already a top-3 position. We don't have
// historical portfolio snapshots per-ticker, so we use the CURRENT weight
// as a proxy — imperfect but directional: if the user is *currently*
// over-weight a ticker AND has added to it more than once, it's the same
// behavioral signal.

export function detectConcentrationAddiction(transactions = [], holdings = []) {
  if (!Array.isArray(transactions) || !Array.isArray(holdings)) return [];

  const totalValue = holdings.reduce((s, h) => s + safeNumber(h.market_value), 0);
  if (totalValue <= 0) return [];

  // Build per-ticker current weight and buy count.
  const weightByTicker = {};
  const buyCountByTicker = {};
  const buyAmountByTicker = {};
  holdings.forEach(h => {
    const tk = String(h.ticker || '').toUpperCase();
    if (!tk) return;
    const mv = safeNumber(h.market_value);
    weightByTicker[tk] = (weightByTicker[tk] || 0) + mv / totalValue;
  });
  transactions.filter(isBuy).forEach(t => {
    const tk = String(t.ticker || '').toUpperCase();
    if (!tk) return;
    buyCountByTicker[tk] = (buyCountByTicker[tk] || 0) + 1;
    buyAmountByTicker[tk] = (buyAmountByTicker[tk] || 0) + txAmount(t);
  });

  const out = [];
  Object.entries(weightByTicker).forEach(([tk, weight]) => {
    // Flag positions that are >15% of the portfolio AND have been bought
    // at least 3 times. Single-buy positions aren't a pattern.
    if (weight < 0.15) return;
    const buys = buyCountByTicker[tk] || 0;
    if (buys < 3) return;
    out.push({
      ticker: tk,
      currentWeightPct: weight * 100,
      totalBuys: buys,
      totalInvested: buyAmountByTicker[tk] || 0,
      severity: weight > 0.30 ? 'high' : weight > 0.20 ? 'medium' : 'low',
    });
  });

  return out.sort((a, b) => b.currentWeightPct - a.currentWeightPct);
}

// ─── 5. EMOTIONAL VOLATILITY ──────────────────────────────────
// Trade frequency on big-move days (portfolio ±2% in a day) vs. baseline.
// "Your trading frequency spikes on volatile days" = a sign of reactive
// rather than scheduled behavior.

const VOLATILE_DAY_THRESHOLD_PCT = 2;

export function analyzeEmotionalVolatility(transactions = [], portfolioSnapshots = []) {
  if (!Array.isArray(transactions) || !Array.isArray(portfolioSnapshots)) return null;
  if (portfolioSnapshots.length < 30) {
    return { available: false, reason: 'need-30-days' };
  }

  // Compute daily portfolio return % from snapshots.
  const returns = [];
  for (let i = 1; i < portfolioSnapshots.length; i += 1) {
    const prev = safeNumber(portfolioSnapshots[i - 1].value);
    const curr = safeNumber(portfolioSnapshots[i].value);
    if (prev <= 0) continue;
    returns.push({
      date: portfolioSnapshots[i].date,
      pctReturn: ((curr - prev) / prev) * 100,
    });
  }
  if (returns.length === 0) return { available: false, reason: 'flat-snapshots' };

  const volatileDates = new Set(returns.filter(r => Math.abs(r.pctReturn) >= VOLATILE_DAY_THRESHOLD_PCT).map(r => r.date));
  const totalDays = returns.length;
  const volatileDayCount = volatileDates.size;
  const calmDayCount = totalDays - volatileDayCount;
  if (volatileDayCount === 0 || calmDayCount === 0) {
    return { available: false, reason: 'no-variance' };
  }

  // Count trades on each day type.
  let tradesOnVolatileDays = 0;
  let tradesOnCalmDays = 0;
  transactions.filter(t => isBuy(t) || isSell(t)).forEach(t => {
    const day = (t.date || '').slice(0, 10);
    if (!day) return;
    if (volatileDates.has(day)) tradesOnVolatileDays += 1;
    else tradesOnCalmDays += 1;
  });

  const ratePerVolatileDay = tradesOnVolatileDays / volatileDayCount;
  const ratePerCalmDay = tradesOnCalmDays / calmDayCount;
  const multiplier = ratePerCalmDay > 0 ? ratePerVolatileDay / ratePerCalmDay : null;

  return {
    available: true,
    volatileDayCount,
    calmDayCount,
    tradesOnVolatileDays,
    tradesOnCalmDays,
    ratePerVolatileDay,
    ratePerCalmDay,
    multiplier,
  };
}

// ─── BEHAVIORAL SCORE ─────────────────────────────────────────
// Composite 0–100 "discipline" rating. Inverse of detected patterns.

export function calcBehavioralScore({ revengeTrades, holdingPeriod, concentration, emotionalVolatility, lateNight }) {
  let score = 100;
  const factors = [];

  // Penalty 1: revenge trading. Cap at -25.
  if (revengeTrades && revengeTrades.length > 0) {
    const penalty = Math.min(25, revengeTrades.length * 5);
    score -= penalty;
    factors.push({
      id: 'revenge',
      label: 'Revenge trading',
      penalty,
      good: false,
      note: `${revengeTrades.length} rebuy event${revengeTrades.length === 1 ? '' : 's'} within ${REVENGE_LOOKBACK_DAYS} days of a loss.`,
    });
  } else {
    factors.push({ id: 'revenge', label: 'Revenge trading', penalty: 0, good: true, note: 'No rebuy-after-loss patterns detected.' });
  }

  // Bonus/penalty: holding period.
  if (holdingPeriod?.long && holdingPeriod?.short) {
    const diff = holdingPeriod.long.weightedAvgReturnPct - holdingPeriod.short.weightedAvgReturnPct;
    if (diff > 5) {
      score += 5;
      factors.push({
        id: 'holding',
        label: 'Patience pays',
        penalty: -5,
        good: true,
        note: `Long-held positions beat short-held by ${diff.toFixed(1)} pts.`,
      });
    } else if (diff < -5) {
      score -= 8;
      factors.push({
        id: 'holding',
        label: 'Long holds underperform',
        penalty: 8,
        good: false,
        note: `Your >30-day holds are returning ${diff.toFixed(1)} pts worse than your quick flips.`,
      });
    }
  }

  // Penalty: concentration addiction.
  if (concentration && concentration.length > 0) {
    const penalty = Math.min(20, concentration.length * 7);
    score -= penalty;
    factors.push({
      id: 'concentration',
      label: 'Concentration addiction',
      penalty,
      good: false,
      note: `${concentration.length} oversized position${concentration.length === 1 ? '' : 's'} you've added to repeatedly.`,
    });
  } else {
    factors.push({ id: 'concentration', label: 'Concentration addiction', penalty: 0, good: true, note: 'No oversized positions you keep adding to.' });
  }

  // Penalty: emotional volatility.
  if (emotionalVolatility?.available && emotionalVolatility.multiplier > 1.8) {
    const penalty = Math.min(15, Math.round((emotionalVolatility.multiplier - 1) * 5));
    score -= penalty;
    factors.push({
      id: 'emotional',
      label: 'Reactive trading',
      penalty,
      good: false,
      note: `You trade ${emotionalVolatility.multiplier.toFixed(1)}× more often on volatile days than on calm ones.`,
    });
  }

  // Penalty: late-night trading.
  if (lateNight?.available && lateNight.lateTradePct > 10) {
    const penalty = Math.min(10, Math.round(lateNight.lateTradePct / 5));
    score -= penalty;
    factors.push({
      id: 'late-night',
      label: 'Late-night trading',
      penalty,
      good: false,
      note: `${lateNight.lateTradePct.toFixed(0)}% of your trades happen between 11 PM and 4 AM.`,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let grade, summary;
  if (score >= 85) { grade = 'A'; summary = 'Disciplined. Your trading patterns suggest a long-horizon process.'; }
  else if (score >= 70) { grade = 'B'; summary = 'Mostly disciplined with a few patterns worth watching.'; }
  else if (score >= 55) { grade = 'C'; summary = 'Mixed signals. A handful of behavioral patterns are costing you returns.'; }
  else { grade = 'D'; summary = 'Several reactive patterns. The biggest gains may come from sitting on your hands more often.'; }

  return { score, grade, summary, factors };
}

// ─── ARCHETYPE ────────────────────────────────────────────────
// A 2-word personality label assigned from the dominant pattern.

export function calcArchetype({ revengeTrades, holdingPeriod, concentration, emotionalVolatility, lateNight }) {
  const tags = [];
  if (revengeTrades && revengeTrades.length >= 3) tags.push('Revenge');
  if (concentration && concentration.length >= 1) tags.push('Concentrator');
  if (emotionalVolatility?.available && emotionalVolatility.multiplier >= 2) tags.push('Reactive');
  if (lateNight?.available && lateNight.lateTradePct > 20) tags.push('Insomnia');

  if (holdingPeriod?.long && holdingPeriod?.short) {
    const diff = holdingPeriod.long.weightedAvgReturnPct - holdingPeriod.short.weightedAvgReturnPct;
    if (diff > 10 && (!revengeTrades || revengeTrades.length === 0)) tags.unshift('Patient');
  }

  if (tags.length === 0) return { label: 'Steady Investor', tags: [] };
  if (tags[0] === 'Patient') return { label: 'Patient Long-Holder', tags };
  if (tags.includes('Revenge') && tags.includes('Reactive')) return { label: 'Reactive Trader', tags };
  if (tags.includes('Concentrator')) return { label: 'Concentrated Buyer', tags };
  if (tags.includes('Insomnia')) return { label: 'Night-Owl Trader', tags };
  if (tags.includes('Reactive')) return { label: 'Volatile-Day Trader', tags };
  if (tags.includes('Revenge')) return { label: 'Revenge Trader', tags };
  return { label: 'Active Trader', tags };
}

// ─── BEHAVIORAL V2 — PRICE-CONTEXT DETECTORS ──────────────────
// Require historical price bars (loaded by historicalPriceCache.js).
// Each detector skips silently when its ticker has no bar data, so a single
// delisted symbol or fetch failure doesn't break the whole profile.

// Helper: percent-change from price A to price B, signed.
function pctChange(from, to) {
  if (!from || !to) return null;
  return (to - from) / from;
}

/**
 * CHASE PATTERN: how often the user buys after the price has already run up.
 * For each Buy, compute the % change from N=5 trading days before to the
 * trade date's close. If that change is >= +5%, count it as a "chase" buy.
 * High chase rates correlate with buying near local tops.
 */
export function detectChasePattern(transactions = [], priceCache) {
  if (!priceCache || priceCache.size === 0) {
    return { detected: false, sampleSize: 0, available: false };
  }
  const buys = (transactions || []).filter(isBuy);
  let analyzed = 0;
  let chased = 0;
  const examples = [];
  buys.forEach(t => {
    const ticker = String(t.ticker || '').toUpperCase();
    const data = priceCache.get(ticker);
    if (!data?.bars?.length) return;
    const tradeIso = String(t.date || t.trade_date || '').slice(0, 10);
    if (!tradeIso) return;
    const priorClose = getCloseAtOffsetSafe(data, tradeIso, -5);
    const tradeClose = getCloseAtOffsetSafe(data, tradeIso, 0);
    const change = pctChange(priorClose, tradeClose);
    if (change === null) return;
    analyzed += 1;
    if (change >= 0.05) {
      chased += 1;
      examples.push({ ticker, date: tradeIso, runUpPct: change });
    }
  });
  examples.sort((a, b) => b.runUpPct - a.runUpPct);
  const chaseRate = analyzed > 0 ? chased / analyzed : 0;
  return {
    detected: chaseRate >= 0.30 && analyzed >= 5,
    available: true,
    sampleSize: analyzed,
    chaseCount: chased,
    chaseRate,
    examples: examples.slice(0, 5),
  };
}

/**
 * CAPITULATION PATTERN: how often the user sells after a sharp recent drop.
 * For each Sell, compute the % change from N=7 trading days before to the
 * trade date's close. If <= -8%, count it as capitulation. High rates
 * suggest selling near local bottoms.
 */
export function detectCapitulationPattern(transactions = [], priceCache) {
  if (!priceCache || priceCache.size === 0) {
    return { detected: false, sampleSize: 0, available: false };
  }
  const sells = (transactions || []).filter(isSell);
  let analyzed = 0;
  let capitulations = 0;
  const examples = [];
  sells.forEach(t => {
    const ticker = String(t.ticker || '').toUpperCase();
    const data = priceCache.get(ticker);
    if (!data?.bars?.length) return;
    const tradeIso = String(t.date || t.trade_date || '').slice(0, 10);
    if (!tradeIso) return;
    const priorClose = getCloseAtOffsetSafe(data, tradeIso, -7);
    const tradeClose = getCloseAtOffsetSafe(data, tradeIso, 0);
    const change = pctChange(priorClose, tradeClose);
    if (change === null) return;
    analyzed += 1;
    if (change <= -0.08) {
      capitulations += 1;
      examples.push({ ticker, date: tradeIso, drawdownPct: change });
    }
  });
  examples.sort((a, b) => a.drawdownPct - b.drawdownPct);
  const capitulationRate = analyzed > 0 ? capitulations / analyzed : 0;
  return {
    detected: capitulationRate >= 0.25 && analyzed >= 4,
    available: true,
    sampleSize: analyzed,
    capitulationCount: capitulations,
    capitulationRate,
    examples: examples.slice(0, 5),
  };
}

/**
 * POST-TRADE REGRET: for each Buy, what was the price 30 trading days later?
 * Aggregate the average drawdown-from-purchase across all analyzable buys.
 * For each Sell, what was the price 30 trading days later? Aggregate the
 * average "missed gain". Together these measure "was your timing
 * value-additive vs noise?"
 */
export function analyzePostTradePriceAction(transactions = [], priceCache) {
  if (!priceCache || priceCache.size === 0) {
    return { detected: false, sampleSize: 0, available: false };
  }
  const buys = (transactions || []).filter(isBuy);
  const sells = (transactions || []).filter(isSell);
  let buyAnalyzed = 0;
  let buyTotalPctMove = 0;
  let sellAnalyzed = 0;
  let sellTotalPctMove = 0;

  const tally = (txList, isSellSide) => {
    let analyzed = 0;
    let totalMove = 0;
    txList.forEach(t => {
      const ticker = String(t.ticker || '').toUpperCase();
      const data = priceCache.get(ticker);
      if (!data?.bars?.length) return;
      const tradeIso = String(t.date || t.trade_date || '').slice(0, 10);
      if (!tradeIso) return;
      const tradeClose = getCloseAtOffsetSafe(data, tradeIso, 0);
      const afterClose = getCloseAtOffsetSafe(data, tradeIso, 30);
      const change = pctChange(tradeClose, afterClose);
      if (change === null) return;
      analyzed += 1;
      totalMove += isSellSide ? -change : change; // for sells, "missed gain" is positive when price kept rising
    });
    return { analyzed, totalMove };
  };

  const b = tally(buys, false);
  const s = tally(sells, true);
  buyAnalyzed = b.analyzed; buyTotalPctMove = b.totalMove;
  sellAnalyzed = s.analyzed; sellTotalPctMove = s.totalMove;

  const avgBuyMovePct = buyAnalyzed > 0 ? buyTotalPctMove / buyAnalyzed : null;
  const avgSellMovePct = sellAnalyzed > 0 ? sellTotalPctMove / sellAnalyzed : null;
  // Negative timing score = both your buys (subsequent loss) and your sells
  // (subsequent gain) work against you. Positive = your timing adds value.
  const timingScore = [avgBuyMovePct, avgSellMovePct === null ? null : -avgSellMovePct]
    .filter(v => v !== null);
  const compositeTimingPct = timingScore.length > 0
    ? timingScore.reduce((a, b) => a + b, 0) / timingScore.length
    : null;

  return {
    available: true,
    detected: compositeTimingPct !== null && compositeTimingPct < -0.02,
    sampleSize: buyAnalyzed + sellAnalyzed,
    buyAnalyzed,
    sellAnalyzed,
    avgBuyMovePct,         // average 30-day return after your buys (>0 = your buys appreciated)
    avgSellMovePct,        // average 30-day return after your sells (>0 = you "missed" gains)
    compositeTimingPct,    // averaged: positive = your timing is value-additive
  };
}

// Mirror of historicalPriceCache.getCloseAtOffset but inlined to avoid an
// import cycle (the engine is consumed by tests with no DOM access).
function getCloseAtOffsetSafe(tickerData, tradeIsoDate, offsetDays) {
  if (!tickerData?.bars?.length) return null;
  const d = new Date(`${tradeIsoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const targetIso = d.toISOString().slice(0, 10);
  if (offsetDays >= 0) {
    for (let i = 0; i < tickerData.bars.length; i++) {
      if (tickerData.bars[i].date >= targetIso) return tickerData.bars[i].close ?? null;
    }
    return tickerData.bars[tickerData.bars.length - 1]?.close ?? null;
  }
  for (let i = tickerData.bars.length - 1; i >= 0; i--) {
    if (tickerData.bars[i].date <= targetIso) return tickerData.bars[i].close ?? null;
  }
  return tickerData.bars[0]?.close ?? null;
}

// ─── COMPOSITE ────────────────────────────────────────────────
// Single entry point used by the UI.

export function buildBehavioralProfile({
  transactions = [],
  realizedPositions = [],
  holdings = [],
  portfolioSnapshots = [],
  priceCache = null,
} = {}) {
  const revengeTrades = detectRevengeTrades(transactions, realizedPositions);
  const holdingPeriod = analyzeHoldingPeriodPerformance(realizedPositions);
  const lateNight = detectLateNightTrading(transactions, realizedPositions);
  const concentration = detectConcentrationAddiction(transactions, holdings);
  const emotionalVolatility = analyzeEmotionalVolatility(transactions, portfolioSnapshots);
  // v2 detectors — require historical price bars. When priceCache is null
  // (page hasn't fetched yet, or fetch failed), each returns
  // {available: false} and the UI shows a "loading" / "couldn't load" tile.
  const chase = detectChasePattern(transactions, priceCache);
  const capitulation = detectCapitulationPattern(transactions, priceCache);
  const postTrade = analyzePostTradePriceAction(transactions, priceCache);

  const score = calcBehavioralScore({ revengeTrades, holdingPeriod, concentration, emotionalVolatility, lateNight });
  const archetype = calcArchetype({ revengeTrades, holdingPeriod, concentration, emotionalVolatility, lateNight });

  // Top-line stats for the page header.
  const totalTrades = transactions.filter(t => isBuy(t) || isSell(t)).length;
  const winners = realizedPositions.filter(p => safeNumber(p.realized_gain_loss_amount) > 0).length;
  const winRatePct = realizedPositions.length > 0 ? (winners / realizedPositions.length) * 100 : null;
  const avgHoldDays = realizedPositions.length > 0
    ? realizedPositions.reduce((s, p) => s + safeNumber(p.holding_period_days), 0) / realizedPositions.length
    : null;

  return {
    score,
    archetype,
    summary: {
      totalTrades,
      realizedPositionCount: realizedPositions.length,
      winRatePct,
      avgHoldDays,
    },
    patterns: {
      revengeTrades,
      holdingPeriod,
      lateNight,
      concentration,
      emotionalVolatility,
      // v2:
      chase,
      capitulation,
      postTrade,
    },
  };
}
