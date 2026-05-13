// Heuristic risk classifier — no API call, pure function over a holding row.
// Returns one of: 'Defensive', 'Core', 'Growth', 'Speculative'.
//
// Order of decisions (first match wins):
//   1. Hard ticker overrides (well-known meme/penny stocks → Speculative)
//   2. Asset class shortcuts (Cash → Defensive, Crypto → Speculative)
//   3. Sector mapping (Utilities/Staples → Defensive, Tech/Comm → Growth, etc.)
//   4. Market-cap fallback (mega-cap → Core, micro-cap → Speculative)
//   5. Final fallback → Core

const SPECULATIVE_TICKERS = new Set([
  'GME', 'AMC', 'BBBY', 'BBBYQ', 'KOSS', 'EXPR', 'NOK', 'BB',
  'SAVE', 'MULN', 'CVNA', 'LCID', 'RIVN', 'NKLA', 'WKHS',
  'GTEC', 'ELDN', 'SPRX', 'IBIT', 'FBTC', 'BITO', 'GBTC', 'ETHE',
]);

const DEFENSIVE_SECTORS = new Set([
  'Utilities', 'Consumer Defensive', 'Consumer Staples',
  'Healthcare', 'Real Estate', 'Telecommunications',
]);

const CORE_SECTORS = new Set([
  'Financial Services', 'Financials', 'Banks',
  'Industrial Conglomerates', 'Industrials',
  'Consumer Cyclical', 'Consumer Discretionary',
  'Energy', 'Materials', 'Basic Materials',
]);

const GROWTH_SECTORS = new Set([
  'Technology', 'Communication Services', 'Media',
  'Software', 'Internet', 'Semiconductors',
  'Biotechnology', 'Pharmaceuticals',
]);

const SPECULATIVE_SECTORS = new Set([
  'Cryptocurrency', 'Crypto', 'Cannabis', 'Gambling',
  'SPAC', 'Penny Stock',
]);

// Market cap thresholds in USD (Finnhub returns in millions)
const MARKET_CAP_BUCKETS = {
  MEGA:    200_000, // $200B+ → Core
  LARGE:    50_000, // $50B+ → Core
  MID:      10_000, // $10B+ → context-dependent
  SMALL:     2_000, // $2B+ → Growth-leaning
  MICRO:        300, // $300M+ → Speculative-leaning
};

function upperTicker(t) {
  return String(t || '').trim().toUpperCase().replace(/\.(NE|TO|TSX)$/i, '');
}

export function classifyRisk(holding = {}) {
  const ticker = upperTicker(holding.underlying_ticker || holding.ticker);
  const assetClass = String(holding.asset_class || holding.assetClass || '').toLowerCase();
  const sector = String(holding.sector || '').trim();
  const marketCap = Number(holding.market_cap) || 0;

  // 1. Hard ticker overrides
  if (SPECULATIVE_TICKERS.has(ticker)) return 'Speculative';

  // 2. Asset-class shortcuts
  if (assetClass === 'cash' || assetClass === 'money market') return 'Defensive';
  if (assetClass === 'crypto' || assetClass === 'cryptocurrency') return 'Speculative';
  if (assetClass === 'bond' || assetClass === 'fixed income') return 'Defensive';

  // 3. Sector mapping
  if (DEFENSIVE_SECTORS.has(sector)) return 'Defensive';
  if (SPECULATIVE_SECTORS.has(sector)) return 'Speculative';
  if (GROWTH_SECTORS.has(sector)) {
    // Mega-cap growth (MSFT, NVDA, GOOGL) → Core; smaller growth → Growth
    if (marketCap >= MARKET_CAP_BUCKETS.MEGA) return 'Core';
    return 'Growth';
  }
  if (CORE_SECTORS.has(sector)) return 'Core';

  // 4. Market-cap fallback when sector is unknown
  if (marketCap >= MARKET_CAP_BUCKETS.LARGE) return 'Core';
  if (marketCap >= MARKET_CAP_BUCKETS.SMALL) return 'Growth';
  if (marketCap > 0 && marketCap < MARKET_CAP_BUCKETS.MICRO) return 'Speculative';

  // 5. Default
  return 'Core';
}

export const RISK_BUCKETS = ['Defensive', 'Core', 'Growth', 'Speculative'];
