// Hint list of underlyings known to have a CIBC-issued Canadian Depositary
// Receipt. Used only as a fast-path for the verification step — the source of
// truth is `listingResolver.resolveListings()`, which queries Finnhub at import
// time and returns the actual symbol + exchange the CDR currently lists on.
//
// This file deliberately does NOT hardcode the CDR symbol or exchange. Some
// CDRs use the underlying ticker (LLY → LLY), others use a renamed ticker
// (ORCL → ORAC, T → ATTC), and exchange placement (TSX vs Cboe Canada/NEO) has
// changed for several issues. The resolver discovers all of that live.

const KNOWN_CDR_UNDERLYINGS = new Set([
  'AAPL','ABBV','ABNB','ADBE','AMD','AMZN','ASML','AVGO','AXP','BA','BAC',
  'BLK','BMY','C','CAT','COIN','COST','CRM','CRWD','CSCO','CVX','DIS','F',
  'GE','GM','GOOG','GOOGL','GS','HD','IBM','INTC','JNJ','JPM','KO','LLY',
  'MA','MCD','META','MRK','MRNA','MS','MSFT','NFLX','NKE','NVDA','ORCL',
  'PEP','PFE','PG','PLTR','PYPL','QCOM','ROKU','SBUX','SNAP','SNOW','T',
  'TGT','TM','TMUS','TSLA','UBER','UNH','UPS','V','VZ','WFC','WMT','XOM',
  'ZM',
]);

function normalizeUnderlying(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

// Hint only: returns true if this underlying is known to have a CDR. The
// resolver is still required to confirm the live symbol/exchange.
export function mayHaveCDR(underlyingTicker) {
  return KNOWN_CDR_UNDERLYINGS.has(normalizeUnderlying(underlyingTicker));
}

export function listKnownCDRUnderlyings() {
  return [...KNOWN_CDR_UNDERLYINGS].sort();
}

// Back-compat shims — older callers expect isValidCDR/getCDR. These now defer
// to the live resolver result if available on the row, otherwise fall back to
// the hint set with a null exchange (forcing the caller to verify).
export function isValidCDR(underlyingTicker) {
  return mayHaveCDR(underlyingTicker);
}

export function getCDR(underlyingTicker) {
  if (!mayHaveCDR(underlyingTicker)) return null;
  // Symbol/exchange are unknown without verification. Callers should treat
  // null fields as "needs resolveListings()".
  return { tsxSymbol: null, exchange: null, hedged: null };
}
