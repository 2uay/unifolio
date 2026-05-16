// @ts-nocheck
// Historical price cache for the Behavioral v2 detectors.
//
// The chase/capitulation detectors need price bars around every Buy/Sell
// transaction. Hitting api/yhistory.js once per transaction would be slow
// and wasteful, so we:
//   1. Group transactions by ticker, find the min/max trade date per ticker.
//   2. Fetch one wide window per ticker that covers all transactions PLUS
//      30 trading days of padding on either side (the chase/capitulation
//      lookback/lookforward window).
//   3. Index bars by date for O(1) lookups during detector execution.
//
// Cache is in-memory (per page load) PLUS localStorage with a 24h TTL so a
// quick page refresh doesn't re-fetch.

const STORAGE_PREFIX = 'unifolio_histprice_v1_';
const TTL_MS = 24 * 60 * 60 * 1000;
const PADDING_DAYS = 35;

function storageKey(symbol) {
  return `${STORAGE_PREFIX}${String(symbol).toUpperCase()}`;
}

function readFromStorage(symbol) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(symbol));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.bars || !parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(symbol, payload) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(symbol), JSON.stringify({
      ...payload,
      savedAt: Date.now(),
    }));
  } catch {
    // Quota or private-browsing — memoryCache still applies for the page.
  }
}

// In-memory cache survives across calls within a page load but resets on
// navigation. The localStorage layer handles cross-load persistence.
const memoryCache = new Map();

async function fetchOne(symbol, fromIso, toIso) {
  const url = `/api/yhistory?symbol=${encodeURIComponent(symbol)}&from=${fromIso}&to=${toIso}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`yhistory ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function paddingIsoDate(isoDate, dayDelta) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

// Cache key matches what the detectors lookup with: t.ticker.toUpperCase().
function localKey(t) {
  return String(t.ticker || '').trim().toUpperCase();
}

// Derive the underlying US-listed ticker by stripping Canadian exchange
// suffixes and the " CDR" qualifier. Mirrors `stripExchangeSuffix` in
// securityIdentity.js — replicated here so this module stays self-
// contained. Examples:
//   "META CDR"   → "META"
//   "LLY CDR"    → "LLY"
//   "SHOP.TO"    → "SHOP"
//   "AAPL.NE"    → "AAPL"
//   "ATD:NEO"    → "ATD"
function stripCdrAndExchange(symbol) {
  if (!symbol) return '';
  return String(symbol)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\.NE|\.NEO|\.TO|\.TSX|:TSX|:NEO)$/i, '')
    .replace(/\s*CDR$/i, '')
    .trim();
}

// Yahoo lookup symbols in priority order. We try each in turn until one
// returns bars. Order:
//   1. quote_symbol — the explicitly-normalized symbol set at import time
//      (e.g. SHOP.TO with the .TO suffix Yahoo needs)
//   2. underlying_ticker — for Canadian Depositary Receipts, the underlying
//      US ticker (e.g. AAPL for AAPL.NE) has richer history than the CDR
//   3. stripped(ticker) — strip " CDR" / .NE / .TO from the broker ticker
//      ("META CDR" → "META"). This is the workhorse for users whose import
//      didn't set underlying_ticker.
//   4. ticker — raw broker symbol as last resort
function fetchSymbolCandidates(t) {
  const candidates = [
    t.quote_symbol,
    t.underlying_ticker,
    stripCdrAndExchange(t.ticker),
    t.ticker,
  ];
  return [...new Set(
    candidates
      .map(c => (c == null ? '' : String(c).trim().toUpperCase()))
      .filter(Boolean),
  )];
}

function dateRangeForLocalKey(transactions, key) {
  let min = null;
  let max = null;
  transactions
    .filter(t => localKey(t) === key)
    .forEach(t => {
      const dt = t.date || t.trade_date;
      if (!dt) return;
      const iso = String(dt).slice(0, 10);
      if (!min || iso < min) min = iso;
      if (!max || iso > max) max = iso;
    });
  return [min, max];
}

/**
 * Fetches historical bars for every ticker that appears in `transactions`.
 * Returns a Map<localKey, { bars: [...], barsByDate: Map<isoDate, bar> }>
 * suitable for lookup by date. localKey is the broker ticker uppercased —
 * matches how the behavioral detectors do their `priceCache.get(ticker)`.
 *
 * For each ticker we try quote_symbol → underlying_ticker → ticker, in that
 * order, against /api/yhistory until one returns non-empty bars. This handles
 * Canadian Depositary Receipts (whose underlying US ticker has richer
 * history than the CDR itself) and broker symbols whose format Yahoo
 * doesn't recognize.
 */
export async function loadHistoricalPricesForTransactions(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) return new Map();

  // Group transactions by local cache key so each unique broker ticker
  // gets one fetch attempt — with all candidate Yahoo symbols available.
  const byKey = new Map();
  transactions.forEach(t => {
    const key = localKey(t);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, { candidates: new Set(), tx: [] });
    const bucket = byKey.get(key);
    fetchSymbolCandidates(t).forEach(c => bucket.candidates.add(c));
    bucket.tx.push(t);
  });

  const results = new Map();
  // We only put SUCCESSFUL fetches in `results`. Failures are tracked
  // separately so the consumer can distinguish "we never tried" from "we
  // tried for every ticker and they all failed" (which usually means
  // Yahoo's rate-limited the IP, the price service is down, or every
  // trade is for an unrecognized symbol).
  const failures = [];
  await Promise.all([...byKey.entries()].map(async ([key, { candidates }]) => {
    if (memoryCache.has(key)) {
      results.set(key, memoryCache.get(key));
      return;
    }
    const cached = readFromStorage(key);
    if (cached) {
      const entry = { bars: cached.bars, barsByDate: indexBars(cached.bars) };
      memoryCache.set(key, entry);
      results.set(key, entry);
      return;
    }
    const [minIso, maxIso] = dateRangeForLocalKey(transactions, key);
    if (!minIso || !maxIso) {
      failures.push({ key, reason: 'no-trade-dates' });
      return;
    }
    // Clamp the fetch window's upper bound to today's real-world date.
    // Yahoo returns empty bars for any range that extends into the future
    // (which happens when sample data or broker-imported data carries a
    // post-today trade date) — that empty result silently poisons the
    // detector with "Analyzed 0 buys" because every cache entry ends up
    // null. Clamping keeps the window valid.
    const todayIso = new Date().toISOString().slice(0, 10);
    let toIso = paddingIsoDate(maxIso, PADDING_DAYS);
    if (toIso > todayIso) toIso = todayIso;
    let fromIso = paddingIsoDate(minIso, -PADDING_DAYS);
    // If even the lower bound is past today, every trade for this ticker
    // is in the future — Yahoo has no useful data and the detector can't
    // analyze it. Bail with a clear log line rather than silently fetching
    // an empty range.
    if (fromIso > todayIso) {
      console.warn(`[historicalPriceCache] ${key} all trade dates are in the future (min=${minIso}, max=${maxIso}, today=${todayIso}) — no historical data possible`);
      failures.push({ key, reason: 'future-dates' });
      return;
    }
    if (fromIso >= toIso) {
      console.warn(`[historicalPriceCache] ${key} fetch window collapsed (from=${fromIso}, to=${toIso}) — likely all future trades`);
      failures.push({ key, reason: 'collapsed-window' });
      return;
    }

    // Try each candidate symbol in priority order; first non-empty bars wins.
    let bars = null;
    let failedSymbols = [];
    for (const symbol of candidates) {
      try {
        const payload = await fetchOne(symbol, fromIso, toIso);
        const candidateBars = Array.isArray(payload.bars) ? payload.bars : [];
        if (candidateBars.length > 0) {
          bars = candidateBars;
          break;
        }
        failedSymbols.push(`${symbol}(empty)`);
      } catch (err) {
        failedSymbols.push(`${symbol}(${err?.message || 'error'})`);
      }
    }

    if (!bars) {
      console.warn(`[historicalPriceCache] ${key} no usable bars from ${[...candidates].join('|')}: ${failedSymbols.join(', ')}`);
      failures.push({ key, reason: 'all-symbols-failed', detail: failedSymbols.join(', ') });
      return;
    }
    const entry = { bars, barsByDate: indexBars(bars) };
    memoryCache.set(key, entry);
    writeToStorage(key, { bars, fromIso, toIso });
    results.set(key, entry);
  }));

  // Attach failure context as a non-enumerable property so consumers that
  // iterate the Map (key/value pairs) aren't affected, but callers that
  // want to render a diagnostic can read it.
  if (failures.length > 0) {
    Object.defineProperty(results, '__failures', { value: failures, enumerable: false });
    Object.defineProperty(results, '__attempted', { value: byKey.size, enumerable: false });
    if (results.size === 0) {
      console.warn(`[historicalPriceCache] every fetch failed (${failures.length}/${byKey.size}). First few:`,
        failures.slice(0, 5).map(f => `${f.key}(${f.reason})`).join(', '));
    }
  }
  return results;
}

function indexBars(bars) {
  const map = new Map();
  bars.forEach(b => { if (b?.date) map.set(b.date, b); });
  return map;
}

/**
 * Returns the close price N trading days before/after `tradeDate` for
 * `ticker`, or null if the data isn't loaded. Walks backward/forward
 * through the bar list to handle non-trading days.
 */
export function getCloseAtOffset(tickerData, tradeIsoDate, offsetDays) {
  if (!tickerData?.bars?.length) return null;
  const targetIso = paddingIsoDate(tradeIsoDate, offsetDays);
  // Find the nearest available bar in the direction of the offset.
  if (offsetDays >= 0) {
    for (let i = 0; i < tickerData.bars.length; i++) {
      if (tickerData.bars[i].date >= targetIso) return tickerData.bars[i].close ?? null;
    }
    return tickerData.bars[tickerData.bars.length - 1]?.close ?? null;
  } else {
    for (let i = tickerData.bars.length - 1; i >= 0; i--) {
      if (tickerData.bars[i].date <= targetIso) return tickerData.bars[i].close ?? null;
    }
    return tickerData.bars[0]?.close ?? null;
  }
}

/**
 * Returns the close price ON `tradeDate` (or the nearest preceding trading
 * day for weekend/holiday trades).
 */
export function getCloseOnOrBefore(tickerData, tradeIsoDate) {
  if (!tickerData?.bars?.length) return null;
  for (let i = tickerData.bars.length - 1; i >= 0; i--) {
    if (tickerData.bars[i].date <= tradeIsoDate) return tickerData.bars[i].close ?? null;
  }
  return null;
}
