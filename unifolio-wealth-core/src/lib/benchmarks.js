import { safeNumber } from '@/lib/safeNum';
import { fetchBenchmarkViaFinnhub } from '@/lib/stockApi';
import { fetchInflationSeries, isInflationKey } from '@/lib/inflationApi';

export const BENCHMARKS = [
  { id: 'sp500',    label: 'S&P 500',        symbol: '^GSPC',    finnhubSymbol: 'SPY',             finnhubType: 'stock',  color: '#f59e0b', base: 5200,  seed: 111 },
  { id: 'nasdaq',   label: 'NASDAQ-100',     symbol: '^NDX',     finnhubSymbol: 'QQQ',             finnhubType: 'stock',  color: '#a78bfa', base: 18000, seed: 222 },
  { id: 'dow',      label: 'Dow Jones',      symbol: '^DJI',     finnhubSymbol: 'DIA',             finnhubType: 'stock',  color: '#60a5fa', base: 38000, seed: 333 },
  { id: 'russell',  label: 'Russell 2000',   symbol: '^RUT',     finnhubSymbol: 'IWM',             finnhubType: 'stock',  color: '#34d399', base: 2000,  seed: 444 },
  { id: 'btc',      label: 'Bitcoin',        symbol: 'BTC-USD',  finnhubSymbol: 'BINANCE:BTCUSDT', finnhubType: 'crypto', color: '#f97316', base: 65000, seed: 555 },
  { id: 'gold',     label: 'Gold',           symbol: 'GC=F',     finnhubSymbol: 'GLD',             finnhubType: 'stock',  color: '#fbbf24', base: 2300,  seed: 666 },
  { id: 'usmarket', label: 'US Total Mkt',   symbol: 'VTI',      finnhubSymbol: 'VTI',             finnhubType: 'stock',  color: '#22d3ee', base: 220,   seed: 777 },
  { id: 'camarket', label: 'CA Total Mkt',   symbol: 'XIC.TO',   finnhubSymbol: 'XIC:TSX',         finnhubType: 'stock',  color: '#fb7185', base: 180,   seed: 888 },
  { id: 'dxy',      label: 'US Dollar (DXY)',symbol: 'DX-Y.NYB', finnhubSymbol: 'UUP',             finnhubType: 'stock',  color: '#94a3b8', base: 104,   seed: 999 },
  // Inflation benchmarks — fetched from Bank of Canada Valet (CA) and FRED (US).
  // Monthly index series, not daily quotes — alignBenchmarkSeriesToDates handles
  // the forward-fill so the chart line stays smooth between releases.
  { id: 'cpi_ca',   label: 'Canadian CPI',   symbol: 'CPI-CA',   finnhubSymbol: null, finnhubType: 'inflation', country: 'CA', color: '#10b981', base: 158, seed: 1010 },
  { id: 'cpi_us',   label: 'US CPI',         symbol: 'CPI-US',   finnhubSymbol: null, finnhubType: 'inflation', country: 'US', color: '#ef4444', base: 310, seed: 1111 },
];

export const COMMON_BENCHMARKS = ['sp500', 'nasdaq', 'dow', 'btc', 'cpi_ca', 'cpi_us'];

const BENCHMARK_CACHE_KEY = 'unifolio_benchmark_series_v2';
const BENCHMARK_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const RANGE_BY_DAYS = [
  { max: 35,   range: '1mo'  },
  { max: 100,  range: '3mo'  },
  { max: 200,  range: '6mo'  },
  { max: 390,  range: '1y'   },
  { max: 800,  range: '2y'   },
  { max: 1900, range: '5y'   },
];

function yahooRangeForDays(days) {
  return RANGE_BY_DAYS.find(item => days <= item.max)?.range || 'max';
}

function readBenchmarkCache() {
  try { return JSON.parse(localStorage.getItem(BENCHMARK_CACHE_KEY) || '{}'); } catch { return {}; }
}

function writeBenchmarkCache(cache) {
  try { localStorage.setItem(BENCHMARK_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function fallbackSeries(benchmark, dates) {
  const data = [];
  let val = benchmark.base;
  let r = benchmark.seed;
  dates.forEach((date, i) => {
    r = (r * 1664525 + 1013904223) & 0xffffffff;
    const rand = (r / 0xffffffff) - 0.45 + 0.024;
    val += rand * benchmark.base * 0.012;
    val = Math.max(val, benchmark.base * 0.6);
    data.push({ date, close: Math.round(val * 100) / 100, timestamp: Date.now() - (dates.length - i) * 86400000, fallback: true });
  });
  return data;
}

export function getBenchmarkById(id) {
  return BENCHMARKS.find(b => b.id === id) || null;
}

export async function fetchBenchmarkSeries(benchmarkIds, days = 365) {
  const uniqueIds = [...new Set(benchmarkIds)].filter(Boolean);
  if (uniqueIds.length === 0) return { series: {}, status: {} };

  const cache = readBenchmarkCache();
  const range = yahooRangeForDays(Math.max(days, 30));
  const series = {};
  const status = {};

  // Check cache first
  const needsFetch = [];
  uniqueIds.forEach(id => {
    const benchmark = getBenchmarkById(id);
    if (!benchmark) return;
    const cacheKey = `${benchmark.finnhubSymbol || benchmark.symbol}_${range}`;
    const cached = cache[cacheKey];
    if (cached?.ts && Date.now() - cached.ts < BENCHMARK_CACHE_TTL_MS && Array.isArray(cached.data) && cached.data.length > 1) {
      series[id] = cached.data;
      status[id] = 'live';
    } else {
      needsFetch.push(id);
    }
  });

  if (needsFetch.length === 0) {
    writeBenchmarkCache(cache);
    return { series, status };
  }

  // Inflation series — Bank of Canada Valet / FRED. These don't go through
  // Finnhub or Yahoo, so we route them here first and remove from later steps.
  const inflationIds = needsFetch.filter(isInflationKey);
  await Promise.all(inflationIds.map(async (id) => {
    const benchmark = getBenchmarkById(id);
    if (!benchmark?.country) return;
    try {
      const data = await fetchInflationSeries(benchmark.country);
      if (Array.isArray(data) && data.length >= 2) {
        series[id] = data;
        status[id] = 'live';
        const cacheKey = `${benchmark.symbol}_${range}`;
        cache[cacheKey] = { data, ts: Date.now() };
      } else {
        status[id] = 'fallback';
      }
    } catch (err) {
      console.warn(`[benchmarks] inflation series failed for ${id}:`, err?.message || err);
      status[id] = 'fallback';
    }
  }));
  const remainingNeeds = needsFetch.filter(id => !isInflationKey(id));

  // Primary: Finnhub (authenticated, reliable)
  const finnhubBenchmarks = remainingNeeds
    .map(id => getBenchmarkById(id))
    .filter(b => b?.finnhubSymbol);

  const finnhubResults = await fetchBenchmarkViaFinnhub(finnhubBenchmarks, Math.max(days + 30, 60));

  const stillNeed = [];
  remainingNeeds.forEach(id => {
    const benchmark = getBenchmarkById(id);
    if (!benchmark) return;
    const data = finnhubResults[id];
    if (data && data.length >= 2) {
      series[id] = data;
      status[id] = 'live';
      const cacheKey = `${benchmark.finnhubSymbol || benchmark.symbol}_${range}`;
      cache[cacheKey] = { data, ts: Date.now() };
    } else {
      stillNeed.push(id);
    }
  });

  // Fallback: Yahoo Finance proxy
  if (stillNeed.length > 0) {
    await Promise.all(stillNeed.map(async (id) => {
      const benchmark = getBenchmarkById(id);
      if (!benchmark) return;
      try {
        const url = `/api/chart?ticker=${encodeURIComponent(benchmark.symbol)}&interval=1d&range=${range}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const result = json.chart?.result?.[0];
        const timestamps = result?.timestamp;
        const quote = result?.indicators?.quote?.[0];
        if (!Array.isArray(timestamps) || !quote) throw new Error('Invalid response');

        const data = timestamps
          .map((ts, i) => {
            const close = safeNumber(quote.close?.[i], null);
            if (!close || close <= 0) return null;
            return {
              date: new Date(ts * 1000).toISOString().slice(0, 10),
              close: Math.round(close * 100) / 100,
              timestamp: ts * 1000,
            };
          })
          .filter(Boolean);

        if (data.length < 2) throw new Error('Sparse response');

        series[id] = data;
        status[id] = 'live';
        const cacheKey = `${benchmark.finnhubSymbol || benchmark.symbol}_${range}`;
        cache[cacheKey] = { data, ts: Date.now() };
      } catch {
        status[id] = 'fallback';
      }
    }));
  }

  // Prune cache
  const keys = Object.keys(cache);
  while (keys.length > 80) {
    const oldest = keys.sort((a, b) => (cache[a]?.ts || 0) - (cache[b]?.ts || 0)).shift();
    if (oldest) delete cache[oldest];
  }
  writeBenchmarkCache(cache);

  return { series, status };
}

export function alignBenchmarkSeriesToDates(series, dates, fallbackBenchmark = null) {
  if (!Array.isArray(dates) || dates.length === 0) return [];

  const sorted = Array.isArray(series)
    ? [...series].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : [];

  if (sorted.length === 0) {
    return fallbackBenchmark
      ? fallbackSeries(fallbackBenchmark, dates)
      : dates.map(date => ({ date, close: null, fallback: true }));
  }

  let idx = 0;
  let last = sorted[0];
  return dates.map(date => {
    while (idx < sorted.length && sorted[idx].date <= date) {
      last = sorted[idx];
      idx += 1;
    }
    return {
      date,
      close: last?.close ?? null,
      timestamp: last?.timestamp,
      fallback: false,
    };
  });
}
