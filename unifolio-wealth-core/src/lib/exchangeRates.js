// Exchange rates engine
// Sample rates — replace with live FX provider via getExchangeRates backend function

export const FX_PROVIDER    = 'Sample Data';
export const FX_IS_SAMPLE   = true;
export const FX_LAST_UPDATED = new Date().toISOString();

// Base rates relative to CAD (1 CAD = x currency)
// null = no rate available yet (future placeholder)
const RATES = {
  CAD: 1.0,
  USD: 0.74,    // 1 CAD = 0.74 USD
  EUR: null,    // not available yet
  GBP: null,    // not available yet
  JPY: null,    // not available yet
  AUD: null,    // not available yet
};

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