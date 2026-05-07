/**
 * Finnhub Stock API client
 *
 * Free tier: 60 calls/min — well within our needs since we batch and cache.
 * API key: set VITE_FINNHUB_API_KEY in .env.local
 *
 * Cache TTL: 15 minutes in localStorage so prices stay fresh without
 * hammering the API on every page reload.
 */

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';
const CACHE_KEY = 'unifolio_stock_quotes_v1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Ticker format mapping ─────────────────────────────────────
// Unifolio uses Yahoo-style suffixes (.TO for TSX).
// Finnhub uses exchange prefix format (SHOP:TSX).
function toFinnhubSymbol(ticker) {
  if (ticker.endsWith('.TO')) return ticker.replace('.TO', ':TSX');
  if (ticker.endsWith('.TSX')) return ticker.replace('.TSX', ':TSX');
  return ticker;
}

// ─── Cache helpers ─────────────────────────────────────────────
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(quotes) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ quotes, ts: Date.now() }));
  } catch {
    // localStorage full — skip caching
  }
}

function isCacheValid(cache) {
  return cache?.ts && Date.now() - cache.ts < CACHE_TTL_MS;
}

// ─── Core fetch ────────────────────────────────────────────────
async function fetchQuote(finnhubSymbol) {
  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  // Finnhub returns c=0 for invalid symbols
  if (!data.c || data.c === 0) return null;
  return {
    current_price: data.c,
    previous_close: data.pc,
    open: data.o,
    high: data.h,
    low: data.l,
    change: data.d,
    change_pct: data.dp,
  };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Fetch quotes for multiple tickers.
 * Returns { [ticker]: { current_price, previous_close, ... } }
 * Tickers that fail or return no data are omitted from the result.
 * Results are cached for 15 minutes in localStorage.
 */
export async function fetchQuotes(tickers) {
  if (!API_KEY) {
    console.warn('[stockApi] VITE_FINNHUB_API_KEY not set — using static prices');
    return {};
  }

  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return {};

  // Check cache
  const cache = readCache();
  if (isCacheValid(cache)) {
    const cached = {};
    const missing = [];
    unique.forEach(t => {
      if (cache.quotes[t]) cached[t] = cache.quotes[t];
      else missing.push(t);
    });
    if (missing.length === 0) return cached;

    // Fetch only missing tickers and merge
    const fresh = await _fetchBatch(missing);
    const merged = { ...cache.quotes, ...fresh };
    writeCache(merged);
    return { ...cached, ...fresh };
  }

  // No valid cache — fetch everything
  const data = await _fetchBatch(unique);
  writeCache(data);
  return data;
}

async function _fetchBatch(tickers) {
  const results = {};
  await Promise.all(
    tickers.map(async ticker => {
      try {
        const quote = await fetchQuote(toFinnhubSymbol(ticker));
        if (quote) results[ticker] = quote;
      } catch (err) {
        // Non-fatal — ticker just won't have live data
        console.warn(`[stockApi] quote failed for ${ticker}: ${err.message}`);
      }
    })
  );
  return results;
}

/**
 * Fetch company profile (name, sector, logo, market cap, etc.)
 * Not cached — call sparingly (e.g. on research panel open).
 */
export async function fetchCompanyProfile(ticker) {
  if (!API_KEY) return null;
  try {
    const symbol = toFinnhubSymbol(ticker);
    const url = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return Object.keys(data).length ? data : null;
  } catch {
    return null;
  }
}

/**
 * Search for symbols by name or ticker.
 * Returns array of { description, displaySymbol, symbol, type }
 */
export async function searchSymbols(query) {
  if (!API_KEY || !query) return [];
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

// ─── Benchmark candle cache ────────────────────────────────────
const CANDLE_CACHE_KEY = 'unifolio_benchmark_candles_v1';
const CANDLE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (daily data changes slowly)

function readCandleCache() {
  try { return JSON.parse(localStorage.getItem(CANDLE_CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCandleCache(data) {
  try { localStorage.setItem(CANDLE_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

/**
 * Map from chart benchmark IDs to Finnhub-fetchable ETF proxies.
 * Using liquid ETFs instead of indices since Finnhub free tier covers ETFs.
 */
export const BENCHMARK_TICKER_MAP = {
  sp500:    'SPY',      // S&P 500
  nasdaq:   'QQQ',      // NASDAQ-100
  dow:      'DIA',      // Dow Jones
  russell:  'IWM',      // Russell 2000
  btc:      'BINANCE:BTCUSDT', // Bitcoin
  gold:     'GLD',      // Gold ETF
  usmarket: 'VTI',      // US Total Market
  camarket: 'XIC:TSX',  // CA Total Market (TSX)
};

/**
 * Fetch historical daily closes for benchmark ETF proxies.
 * Returns { [benchmarkId]: number[] } — closing prices ordered oldest → newest.
 * Cached for 1 hour since these are daily prices that change slowly.
 *
 * @param {string[]} benchmarkIds - subset of BENCHMARK_TICKER_MAP keys
 * @param {number} days - number of trading days to fetch
 */
export async function fetchBenchmarkCandles(benchmarkIds, days = 365) {
  if (!API_KEY) return {};

  const cacheEntry = readCandleCache();
  const cacheValid = cacheEntry?.ts && Date.now() - cacheEntry.ts < CANDLE_CACHE_TTL_MS;
  const cached = cacheValid ? (cacheEntry.data || {}) : {};

  const toFetch = benchmarkIds.filter(id => BENCHMARK_TICKER_MAP[id] && !cached[id]);
  if (toFetch.length === 0) {
    return Object.fromEntries(benchmarkIds.filter(id => cached[id]).map(id => [id, cached[id]]));
  }

  const now = Math.floor(Date.now() / 1000);
  // Add 40% buffer to get enough trading days
  const from = now - Math.round(days * 1.4) * 86400;

  const fresh = {};
  await Promise.all(toFetch.map(async (id) => {
    const symbol = BENCHMARK_TICKER_MAP[id];
    try {
      const url = `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.s === 'ok' && Array.isArray(data.c)) {
        // Take the last `days` data points
        fresh[id] = data.c.slice(-days);
      }
    } catch (err) {
      console.warn(`[stockApi] candle fetch failed for ${symbol}:`, err.message);
    }
  }));

  const merged = { ...cached, ...fresh };
  writeCandleCache(merged);

  return Object.fromEntries(benchmarkIds.filter(id => merged[id]).map(id => [id, merged[id]]));
}

/**
 * Invalidate the local quote cache (call after manual refresh).
 */
export function invalidateCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Return the timestamp of the last successful cache write, or null.
 */
export function getCacheAge() {
  const cache = readCache();
  return cache?.ts ?? null;
}
