// Exchange rates engine
// Bootstraps with sample rates; fetchLiveRates() swaps in live ECB data via Frankfurter.app

export const FX_PROVIDER    = 'Sample Data';
export const FX_IS_SAMPLE   = true;
export const FX_LAST_UPDATED = new Date().toISOString();

// Base rates relative to CAD (1 CAD = x currency)
// null = no rate available yet (future placeholder)
const RATES = {
  CAD: 1.0,
  USD: 0.74,    // 1 CAD = 0.74 USD (updated by fetchLiveRates)
  EUR: null,
  GBP: null,
  JPY: null,
  AUD: null,
};

// ─── Live FX cache ─────────────────────────────────────────────
const FX_LIVE_CACHE_KEY = 'unifolio_fx_rates_v1';
const FX_LIVE_TTL_MS    = 60 * 60 * 1000; // 1 hour

let _liveRates  = null;
let _lastFetchMs = 0;

/**
 * Fetch live USD/CAD rates from Frankfurter.app (ECB, free, no key, CORS-ok).
 * Caches in localStorage for 1 hour. Updates module-level RATES on success.
 * Returns { usdToCad, cadToUsd, isLive, lastUpdated }.
 */
export async function fetchLiveRates() {
  // In-memory cache
  if (_liveRates && (Date.now() - _lastFetchMs) < FX_LIVE_TTL_MS) {
    return _liveRates;
  }

  // localStorage cache
  try {
    const raw = localStorage.getItem(FX_LIVE_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.ts && (Date.now() - cached.ts) < FX_LIVE_TTL_MS && cached.usdToCad) {
        RATES.USD = cached.cadToUsd;
        _liveRates = { usdToCad: cached.usdToCad, cadToUsd: cached.cadToUsd, isLive: true, lastUpdated: cached.lastUpdated };
        _lastFetchMs = cached.ts;
        return _liveRates;
      }
    }
  } catch { /* ignore */ }

  // Network fetch
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=CAD');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const usdToCad = data.rates?.CAD;
    if (!usdToCad) throw new Error('No CAD rate in response');

    const cadToUsd = 1 / usdToCad;
    const lastUpdated = new Date().toISOString();
    RATES.USD = cadToUsd; // keep convertCurrency accurate
    _liveRates = { usdToCad, cadToUsd, isLive: true, lastUpdated };
    _lastFetchMs = Date.now();

    try {
      localStorage.setItem(FX_LIVE_CACHE_KEY, JSON.stringify({ usdToCad, cadToUsd, lastUpdated, ts: Date.now() }));
    } catch { /* storage full */ }

    return _liveRates;
  } catch {
    return { usdToCad: 1 / RATES.USD, cadToUsd: RATES.USD, isLive: false, lastUpdated: null };
  }
}

/** Returns true if a real rate is available for the given currency code */
export function hasRate(code) {
  return RATES[code] !== undefined && RATES[code] !== null;
}

/** Convert amount from one currency to another via CAD as base.
 *  Falls back to the original amount if rates are missing. */
export function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  const fromRate = RATES[from];
  const toRate   = RATES[to];
  if (fromRate == null || toRate == null) return amount; // rate unavailable
  // Convert to CAD first, then to target
  const inCAD = amount / fromRate;
  return inCAD * toRate;
}

export function fx(amount, from, to) {
  return convertCurrency(amount, from, to);
}

/** Returns displayable rate rows for the settings panel */
export function getAllRates() {
  return [
    { base: 'USD', quote: 'CAD', rate: 1 / RATES.USD, source: FX_PROVIDER, last_updated: FX_LAST_UPDATED },
    { base: 'CAD', quote: 'USD', rate: RATES.USD,      source: FX_PROVIDER, last_updated: FX_LAST_UPDATED },
  ];
}

/** Returns full rate info for all currencies */
export function getCurrencyRates() {
  return Object.entries(RATES).map(([code, rate]) => ({
    code,
    rateToCAD: rate,
    available: rate !== null,
    source: rate !== null ? FX_PROVIDER : null,
    lastUpdated: rate !== null ? FX_LAST_UPDATED : null,
  }));
}