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

function dateRange(transactions, ticker) {
  let min = null;
  let max = null;
  transactions
    .filter(t => String(t.ticker || '').toUpperCase() === ticker)
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
 * Returns a Map<ticker, { bars: [...], barsByDate: Map<isoDate, bar> }>
 * suitable for lookup by date.
 *
 * Ignores symbols the upstream rejects (sets entry to null) so a single
 * delisted ticker doesn't break the whole batch.
 */
export async function loadHistoricalPricesForTransactions(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) return new Map();

  const tickers = [...new Set(
    transactions
      .map(t => String(t.ticker || '').toUpperCase())
      .filter(Boolean),
  )];

  const results = new Map();
  await Promise.all(tickers.map(async (ticker) => {
    if (memoryCache.has(ticker)) {
      results.set(ticker, memoryCache.get(ticker));
      return;
    }
    const cached = readFromStorage(ticker);
    if (cached) {
      const entry = { bars: cached.bars, barsByDate: indexBars(cached.bars) };
      memoryCache.set(ticker, entry);
      results.set(ticker, entry);
      return;
    }
    const [minIso, maxIso] = dateRange(transactions, ticker);
    if (!minIso || !maxIso) {
      results.set(ticker, null);
      return;
    }
    const fromIso = paddingIsoDate(minIso, -PADDING_DAYS);
    const toIso = paddingIsoDate(maxIso, PADDING_DAYS);
    try {
      const payload = await fetchOne(ticker, fromIso, toIso);
      const bars = Array.isArray(payload.bars) ? payload.bars : [];
      const entry = { bars, barsByDate: indexBars(bars) };
      memoryCache.set(ticker, entry);
      writeToStorage(ticker, { bars, fromIso, toIso });
      results.set(ticker, entry);
    } catch (err) {
      console.warn(`[historicalPriceCache] ${ticker} fetch failed:`, err?.message);
      results.set(ticker, null);
    }
  }));
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
