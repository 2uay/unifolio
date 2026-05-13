// Inflation / CPI series fetcher.
// - Canadian CPI: Bank of Canada Valet API (no key required, monthly NSA).
// - US CPI: FRED CPIAUCSL series (free with VITE_FRED_API_KEY in env).
//
// Both return `[{ date: 'YYYY-MM-DD', close: number, timestamp: ms }]` so the
// existing benchmarks pipeline can splice them straight into the Performance
// chart alongside index series.

const FRED_KEY = import.meta.env.VITE_FRED_API_KEY;
const CACHE_KEY = 'unifolio_inflation_series_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — CPI publishes monthly

const VALET_CA_CPI_SERIES = 'V41690973'; // CPI all items, monthly index, NSA

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}

function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function isFresh(entry) {
  return entry?.ts && Date.now() - entry.ts < CACHE_TTL_MS;
}

async function fetchCanadianCPI() {
  const cache = readCache();
  if (isFresh(cache.ca)) return cache.ca.data;
  try {
    // 240 monthly observations = 20 years, plenty for any chart range
    const url = `https://www.bankofcanada.ca/valet/observations/${VALET_CA_CPI_SERIES}/json?recent=240`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Valet ${res.status}`);
    const json = await res.json();
    const obs = Array.isArray(json?.observations) ? json.observations : [];
    const data = obs
      .map(o => {
        const date = String(o?.d || '').slice(0, 10);
        const v = Number(o?.[VALET_CA_CPI_SERIES]?.v);
        if (!date || !Number.isFinite(v)) return null;
        return { date, close: Math.round(v * 100) / 100, timestamp: new Date(date).getTime() };
      })
      .filter(Boolean);
    if (!data.length) throw new Error('Empty observations');
    cache.ca = { ts: Date.now(), data };
    writeCache(cache);
    return data;
  } catch (err) {
    console.warn('[inflationApi] Bank of Canada Valet failed:', err?.message || err);
    return cache.ca?.data || null;
  }
}

async function fetchUSCPI() {
  if (!FRED_KEY) return null;
  const cache = readCache();
  if (isFresh(cache.us)) return cache.us.data;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${FRED_KEY}&file_type=json&limit=240&sort_order=desc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FRED ${res.status}`);
    const json = await res.json();
    const obs = Array.isArray(json?.observations) ? json.observations : [];
    const data = obs
      .map(o => {
        const date = String(o?.date || '').slice(0, 10);
        const v = Number(o?.value);
        if (!date || !Number.isFinite(v)) return null;
        return { date, close: Math.round(v * 100) / 100, timestamp: new Date(date).getTime() };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!data.length) throw new Error('Empty observations');
    cache.us = { ts: Date.now(), data };
    writeCache(cache);
    return data;
  } catch (err) {
    console.warn('[inflationApi] FRED failed:', err?.message || err);
    return cache.us?.data || null;
  }
}

export async function fetchInflationSeries(country) {
  if (country === 'CA') return fetchCanadianCPI();
  if (country === 'US') return fetchUSCPI();
  return null;
}

export function isInflationKey(id) {
  return id === 'cpi_ca' || id === 'cpi_us';
}
