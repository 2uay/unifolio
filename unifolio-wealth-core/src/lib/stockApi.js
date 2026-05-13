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
const CACHE_KEY = 'unifolio_stock_quotes_v2';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_VALID_QUOTE_AGE_MS = 4 * 24 * 60 * 60 * 1000;
const QUOTE_MISMATCH_THRESHOLD = 0.08;

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
    timestamp: data.t ? data.t * 1000 : null,
    source: 'finnhub',
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

function asFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isFreshTimestamp(timestamp, maxAge = MAX_VALID_QUOTE_AGE_MS) {
  if (!timestamp) return false;
  return Date.now() - timestamp <= maxAge;
}

function isUsablePrice(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

// Maps a broker row to the Yahoo-format quote symbol used by the price proxy.
// Strict policy: never invent a `.NE` CDR ticker. A CDR symbol is only emitted
// when the row actually identifies as a CDR (via cdrRegistry-aware
// resolveSecurityIdentity) and the underlying has a real CIBC CDR.
function inferQuoteSymbol(row = {}) {
  // Prefer broker-provided quote_symbol if present.
  const explicit = String(row.quote_symbol || row.quoteSymbol || '').trim();
  if (explicit) return explicit.toUpperCase();

  const ticker = String(row.ticker || '').trim().toUpperCase();
  if (!ticker || ticker.includes('.') || ticker.includes(':')) return ticker;

  const currency = String(row.currency || row.listing_currency || '').toUpperCase();
  const identity = String(row.security_identity || '').toLowerCase();
  const listingExch = String(row.listing_exchange || row.exchange || '').toUpperCase();

  // Real CDR (resolved upstream by securityIdentity + cdrRegistry).
  if (identity === 'cdr' || /NEO|CBOE/.test(listingExch)) return `${ticker}.NE`;
  // Native TSX listing.
  if (identity === 'tsx' || /TSX|XTSE/.test(listingExch)) return `${ticker}.TO`;
  // Plain CAD with no CDR signal — assume native TSX listing.
  if (currency === 'CAD' && ticker !== 'CASH') return `${ticker}.TO`;
  return ticker;
}

function normalizeBrokerRows(rows = []) {
  return rows.reduce((acc, row) => {
    const ticker = row?.quote_symbol || row?.quoteSymbol || row?.ticker;
    if (!ticker || acc[ticker]) return acc;
    const brokerPrice = asFiniteNumber(row.current_price ?? row.lastPrice ?? row.price);
    if (isUsablePrice(brokerPrice)) {
      acc[ticker] = {
        current_price: brokerPrice,
        previous_close: brokerPrice,
        price_source: 'broker',
        valuation_status: 'broker_fallback',
        quote_symbol: row.quote_symbol || row.quoteSymbol || inferQuoteSymbol(row),
      };
    }
    return acc;
  }, {});
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Fetch current quotes from Yahoo Finance's v7 quote endpoint via /api/yquote proxy.
 * Returns { [ticker]: { current_price, previous_close, change_pct } }.
 * This is the most reliable source for regularMarketPreviousClose, especially for
 * TSX (.TO) tickers where Finnhub free-tier often returns null previous_close.
 */
export async function fetchYahooQuotes(tickers) {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const url = `/api/yquote?symbols=${encodeURIComponent(unique.join(','))}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = await res.json();
    const quotes = json?.quoteResponse?.result ?? [];
    return Object.fromEntries(
      quotes
        .filter(q => q.symbol && q.regularMarketPrice)
        .map(q => [q.symbol, {
          current_price:   q.regularMarketPrice,
          previous_close:  q.regularMarketPreviousClose ?? q.regularMarketPrice,
          change_pct:      q.regularMarketChangePercent ?? 0,
          currency:        q.currency ?? 'USD',
          source: 'yahoo_quote',
        }])
    );
  } catch (err) {
    console.warn('[stockApi] Yahoo quotes failed:', err.message);
    return {};
  }
}

async function fetchLatestYahooPrices(tickers) {
  const entries = await mapWithConcurrency(tickers, 5, async (ticker) => {
    try {
      const candles = await fetchStockCandles(ticker, '5D');
      if (!Array.isArray(candles) || candles.length === 0) return null;
      const latest = candles[candles.length - 1];
      const previous = candles[candles.length - 2] || latest;
      const currentPrice = asFiniteNumber(latest?.close);
      if (!isUsablePrice(currentPrice)) return null;
      return [ticker, {
        current_price: currentPrice,
        previous_close: asFiniteNumber(previous?.close, currentPrice),
        timestamp: latest?.timestamp ?? null,
        price_source: 'yahoo',
        valuation_status: 'market_closed_close',
      }];
    } catch (err) {
      console.warn(`[stockApi] Yahoo validation failed for ${ticker}: ${err.message}`);
      return null;
    }
  });

  return Object.fromEntries(entries.filter(Boolean));
}

function chooseValidatedQuote({ ticker, yahoo, finnhub, broker }) {
  const yahooPrice = asFiniteNumber(yahoo?.current_price);
  const finnhubPrice = asFiniteNumber(finnhub?.current_price);
  const brokerPrice = asFiniteNumber(broker?.current_price);
  const yahooUsable = isUsablePrice(yahooPrice);
  const finnhubUsable = isUsablePrice(finnhubPrice);
  const finnhubFresh = finnhubUsable && (!finnhub?.timestamp || isFreshTimestamp(finnhub.timestamp));

  if (yahooUsable && finnhubFresh) {
    const mismatchPct = Math.abs(finnhubPrice - yahooPrice) / Math.max(yahooPrice, 0.01);
    if (mismatchPct > QUOTE_MISMATCH_THRESHOLD) {
      return {
        ...yahoo,
        price_source: 'yahoo',
        valuation_status: 'quote_mismatch',
        rejected_quote: {
          source: 'finnhub',
          price: finnhubPrice,
          mismatch_pct: Math.round(mismatchPct * 10000) / 100,
        },
      };
    }

    return {
      ...yahoo,
      price_source: 'yahoo',
      valuation_status: 'live',
      validation_source: 'finnhub',
      validation_price: finnhubPrice,
    };
  }

  if (yahooUsable) {
    return {
      ...yahoo,
      price_source: 'yahoo',
      valuation_status: 'market_closed_close',
    };
  }

  if (finnhubFresh) {
    return {
      ...finnhub,
      price_source: 'finnhub',
      valuation_status: 'live',
    };
  }

  if (isUsablePrice(brokerPrice)) {
    return {
      ...broker,
      price_source: 'broker',
      valuation_status: finnhubUsable ? 'quote_stale' : 'broker_fallback',
      rejected_quote: finnhubUsable ? {
        source: 'finnhub',
        price: finnhubPrice,
        ticker,
      } : null,
    };
  }

  return null;
}

/**
 * Fetch market prices with guardrails for imported portfolio valuation.
 * Yahoo chart data validates Finnhub quotes so stale/bad point quotes cannot
 * overwrite broker import marks. Broker values are preserved as the fallback.
 */
export async function fetchValidatedPrices(tickers, brokerRows = []) {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return {};

  const brokerByTicker = normalizeBrokerRows(brokerRows);
  const quoteSymbolByTicker = Object.fromEntries(unique.map(ticker => [ticker, brokerByTicker[ticker]?.quote_symbol || ticker]));
  const quoteSymbols = [...new Set(Object.values(quoteSymbolByTicker).filter(Boolean))];
  const [finnhubQuotes, yahooCandleQuotes, yahooSpotQuotes] = await Promise.all([
    fetchQuotes(quoteSymbols).catch(error => {
      console.warn('[stockApi] Finnhub validation quotes failed:', error?.message || error);
      return {};
    }),
    fetchLatestYahooPrices(quoteSymbols),
    fetchYahooQuotes(quoteSymbols).catch(() => ({})),
  ]);

  // Patch previous_close with regularMarketPreviousClose from Yahoo spot quotes.
  // This is especially important for TSX (.TO) tickers where Finnhub returns null
  // and the candle approach gives the second-to-last bar rather than end-of-session.
  const yahooQuotes = { ...yahooCandleQuotes };
  Object.entries(yahooSpotQuotes).forEach(([ticker, spotData]) => {
    if (yahooQuotes[ticker]) {
      // Patch previous_close but keep candle's current_price (more reliable for closed markets)
      yahooQuotes[ticker] = { ...yahooQuotes[ticker], previous_close: spotData.previous_close };
    } else if (isUsablePrice(spotData.current_price)) {
      yahooQuotes[ticker] = spotData;
    }
  });

  return unique.reduce((acc, ticker) => {
    const quoteSymbol = quoteSymbolByTicker[ticker];
    const selected = chooseValidatedQuote({
      ticker,
      yahoo: yahooQuotes[quoteSymbol],
      finnhub: finnhubQuotes[quoteSymbol],
      broker: brokerByTicker[ticker],
    });
    if (selected) acc[ticker] = { ...selected, quote_symbol: quoteSymbol };
    return acc;
  }, {});
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

// ─── Company profile cache (sector/industry/country enrichment) ────
const PROFILE_CACHE_KEY = 'unifolio_company_profiles_v1';
const PROFILE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — sectors don't move

function readProfileCache() {
  try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writeProfileCache(cache) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

/**
 * Fetch company profile (name, sector, industry, country, market cap, logo).
 * Cached 30 days in localStorage so sector breakdowns don't burn API calls.
 */
export async function fetchCompanyProfile(ticker) {
  if (!API_KEY || !ticker) return null;
  const key = String(ticker).toUpperCase();
  const cache = readProfileCache();
  const entry = cache[key];
  if (entry?.ts && Date.now() - entry.ts < PROFILE_CACHE_TTL_MS) return entry.data;

  try {
    const symbol = toFinnhubSymbol(ticker);
    const url = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const profile = Object.keys(data).length ? data : null;
    cache[key] = { ts: Date.now(), data: profile };
    writeProfileCache(cache);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Batch profile fetch with concurrency control. Returns { [ticker]: profile|null }.
 * Uses the same 30-day cache so repeat tickers across imports cost zero API calls.
 */
export async function fetchManyProfiles(tickers) {
  const unique = [...new Set((tickers || []).filter(Boolean).map(t => String(t).toUpperCase()))];
  if (unique.length === 0) return {};
  const result = {};
  await mapWithConcurrency(unique, 5, async (ticker) => {
    result[ticker] = await fetchCompanyProfile(ticker);
  });
  return result;
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

// ─── Stock chart candle cache (Yahoo Finance via /api/chart proxy) ─
const CHART_CANDLE_CACHE_KEY = 'unifolio_chart_candles_v3';

// interval + yahoo range per app range button
const RANGE_TO_YAHOO = {
  '1D':  { interval: '5m',  yahooRange: '1d',  ttl: 5 * 60 * 1000 },
  '5D':  { interval: '15m', yahooRange: '5d',  ttl: 10 * 60 * 1000 },
  '1W':  { interval: '60m', yahooRange: '5d',  ttl: 15 * 60 * 1000 },
  '1M':  { interval: '1d',  yahooRange: '1mo', ttl: 60 * 60 * 1000 },
  '3M':  { interval: '1d',  yahooRange: '3mo', ttl: 60 * 60 * 1000 },
  '6M':  { interval: '1d',  yahooRange: '6mo', ttl: 2 * 60 * 60 * 1000 },
  '1Y':  { interval: '1d',  yahooRange: '1y',  ttl: 4 * 60 * 60 * 1000 },
  '2Y':  { interval: '1wk', yahooRange: '2y',  ttl: 12 * 60 * 60 * 1000 },
  '5Y':  { interval: '1wk', yahooRange: '5y',  ttl: 12 * 60 * 60 * 1000 },
  'All': { interval: '1mo', yahooRange: 'max', ttl: 24 * 60 * 60 * 1000 },
};

function readChartCandleCache() {
  try { return JSON.parse(localStorage.getItem(CHART_CANDLE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeChartCandleCache(cache) {
  try { localStorage.setItem(CHART_CANDLE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

/**
 * Fetch real OHLCV chart data via the /api/chart serverless proxy (Yahoo Finance).
 * Returns array of { date, open, high, low, close, volume, timestamp } —
 * drop-in compatible with generateOHLC(). Returns null on failure.
 */
export async function fetchStockCandles(ticker, range = '1M') {
  if (!ticker) return null;

  const cfg = RANGE_TO_YAHOO[range] || RANGE_TO_YAHOO['1M'];
  const { interval, yahooRange, ttl } = cfg;
  const cacheKey = `${ticker}_${interval}_${range}`;

  const cache = readChartCandleCache();
  const entry = cache[cacheKey];
  if (entry && Date.now() - entry.ts < ttl) return entry.data;

  try {
    const url = `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=${interval}&range=${yahooRange}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    const result = json.chart?.result?.[0];
    if (!result?.timestamp) return null;

    const timestamps = result.timestamp;
    const q = result.indicators?.quote?.[0];
    if (!q) return null;

    const isIntraday = interval.endsWith('m') || interval === '60m';

    const data = timestamps
      .map((ts, i) => {
        const close = q.close?.[i];
        if (!close || close <= 0) return null;
        return {
          date: new Date(ts * 1000).toLocaleString('en-US', isIntraday
            ? { hour: 'numeric', minute: '2-digit', hour12: true }
            : { month: 'short', day: 'numeric' }),
          open:      Math.round((q.open?.[i]   || close) * 100) / 100,
          high:      Math.round((q.high?.[i]   || close) * 100) / 100,
          low:       Math.round((q.low?.[i]    || close) * 100) / 100,
          close:     Math.round(close * 100) / 100,
          volume:    q.volume?.[i] || 0,
          timestamp: ts * 1000,
        };
      })
      .filter(Boolean);

    if (data.length < 2) return null;

    const keys = Object.keys(cache);
    if (keys.length >= 60) {
      const oldest = keys.sort((a, b) => (cache[a]?.ts || 0) - (cache[b]?.ts || 0))[0];
      delete cache[oldest];
    }
    cache[cacheKey] = { data, ts: Date.now() };
    writeChartCandleCache(cache);
    return data;
  } catch (err) {
    console.warn(`[stockApi] chart fetch failed for ${ticker}/${range}:`, err.message);
    return null;
  }
}

// ─── Historical prices (portfolio reconstruction) ─────────────
const HIST_PRICES_CACHE_KEY = 'unifolio_hist_prices_v1';
const HIST_PRICES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function daysFromDate(fromDate) {
  return Math.ceil((Date.now() - new Date(fromDate).getTime()) / 86400000);
}

function yahooRangeForHistoryDays(days) {
  if (days <= 35) return '1mo';
  if (days <= 100) return '3mo';
  if (days <= 200) return '6mo';
  if (days <= 390) return '1y';
  if (days <= 800) return '2y';
  if (days <= 1900) return '5y';
  return 'max';
}

function readHistPricesCache() {
  try { return JSON.parse(localStorage.getItem(HIST_PRICES_CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeHistPricesCache(cache) {
  try { localStorage.setItem(HIST_PRICES_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

/**
 * Fetch daily closing prices for multiple tickers via Yahoo Finance proxy.
 * Returns { [ticker]: { [YYYY-MM-DD]: close } } covering fromDate → today.
 * Cached per-ticker for 24 hours.
 */
export async function fetchHistoricalPricesForTickers(tickers, fromDate) {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return {};

  const days = daysFromDate(fromDate);
  const range = yahooRangeForHistoryDays(Math.max(days + 7, 14));
  const cache = readHistPricesCache();
  const result = {};

  await Promise.all(unique.map(async (ticker) => {
    const cacheKey = `${ticker}_${range}`;
    const entry = cache[cacheKey];
    if (entry?.data && Date.now() - (entry.ts || 0) < HIST_PRICES_CACHE_TTL_MS) {
      result[ticker] = entry.data;
      return;
    }

    try {
      const url = `/api/chart?ticker=${encodeURIComponent(ticker)}&interval=1d&range=${range}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      const apiResult = json.chart?.result?.[0];
      const timestamps = apiResult?.timestamp;
      const quote = apiResult?.indicators?.quote?.[0];
      if (!Array.isArray(timestamps) || !quote) return;

      const priceMap = {};
      timestamps.forEach((ts, i) => {
        const close = quote.close?.[i];
        if (close && close > 0) {
          priceMap[new Date(ts * 1000).toISOString().slice(0, 10)] = Math.round(close * 100) / 100;
        }
      });

      if (Object.keys(priceMap).length > 0) {
        result[ticker] = priceMap;
        cache[cacheKey] = { ts: Date.now(), data: priceMap };
      }
    } catch (err) {
      console.warn(`[stockApi] historical prices failed for ${ticker}:`, err.message);
    }
  }));

  // Prune oldest entries if cache grows large
  const keys = Object.keys(cache);
  if (keys.length > 120) {
    keys.sort((a, b) => (cache[a]?.ts || 0) - (cache[b]?.ts || 0))
      .slice(0, keys.length - 120)
      .forEach(k => delete cache[k]);
  }

  writeHistPricesCache(cache);
  return result;
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

/**
 * Fetch benchmark candle data from Finnhub using ETF proxies.
 * benchmarks: array of { id, finnhubSymbol, finnhubType } from BENCHMARKS
 * days: number of calendar days of history to fetch
 * Returns { [id]: [{date, close, timestamp}] }
 */
export async function fetchBenchmarkViaFinnhub(benchmarks, days) {
  if (!API_KEY) return {};
  const now = Math.floor(Date.now() / 1000);
  const from = now - Math.max(days, 30) * 86400;
  const results = {};
  await Promise.all(
    benchmarks.map(async ({ id, finnhubSymbol, finnhubType }) => {
      if (!finnhubSymbol) return;
      try {
        const endpoint = finnhubType === 'crypto' ? 'crypto/candle' : 'stock/candle';
        const url = `${BASE_URL}/${endpoint}?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (data.s !== 'ok' || !Array.isArray(data.t) || data.t.length < 2) return;
        results[id] = data.t
          .map((ts, i) => {
            const close = data.c?.[i];
            if (!close || close <= 0) return null;
            return {
              date: new Date(ts * 1000).toISOString().slice(0, 10),
              close: Math.round(close * 100) / 100,
              timestamp: ts * 1000,
            };
          })
          .filter(Boolean);
      } catch (err) {
        console.warn(`[stockApi] Finnhub benchmark failed for ${finnhubSymbol}:`, err.message);
      }
    })
  );
  return results;
}
