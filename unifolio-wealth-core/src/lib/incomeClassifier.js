// Heuristic income-style classifier — pure function over a holding row.
// Returns one of: 'Dividend', 'Growth', 'Speculative', 'Hybrid'.
//
// We don't fetch dividend yields per holding (would require a separate API
// pull). Instead we use:
//   1. Hard ticker overrides for well-known income/growth/spec names
//   2. Asset class (Cash → Hybrid, Crypto → Speculative)
//   3. Sector mapping (Utilities/Telecom/REITs → Dividend, Tech → Growth)
//   4. Optional override: if a holding row carries a `dividend_yield` field
//      from a future Finnhub `/metric` enrichment, that wins over heuristics.

const DIVIDEND_TICKERS = new Set([
  'KO', 'PEP', 'PG', 'JNJ', 'XOM', 'CVX', 'T', 'VZ', 'BCE', 'TRP', 'ENB',
  'BNS', 'TD', 'RY', 'BMO', 'CM', 'NA', 'SU', 'CNQ', 'IMO',
  'O', 'MAIN', 'STAG', 'VICI', 'SPG', 'PLD',
  'SCHD', 'VYM', 'VIG', 'NOBL', 'SDY', 'DGRO', 'XEI', 'XDV', 'ZDV',
]);

const GROWTH_TICKERS = new Set([
  'NVDA', 'TSLA', 'META', 'GOOG', 'GOOGL', 'AMZN', 'AAPL', 'MSFT', 'NFLX',
  'CRM', 'NOW', 'PANW', 'CRWD', 'SNOW', 'DDOG', 'ABNB', 'UBER', 'SHOP',
  'PLTR', 'COIN', 'AVGO', 'AMD', 'ASML', 'TSM',
  'QQQ', 'SCHG', 'VUG', 'VGT', 'IWY', 'MGK', 'ARKK',
]);

const SPECULATIVE_TICKERS = new Set([
  'GME', 'AMC', 'BBBY', 'BBBYQ', 'KOSS',
  'MULN', 'NKLA', 'WKHS', 'CVNA',
  'IBIT', 'FBTC', 'BITO', 'GBTC', 'ETHE',
  'ELDN', 'GTEC', 'SPRX',
]);

const DIVIDEND_SECTORS = new Set([
  'Utilities', 'Real Estate', 'REIT',
  'Telecommunications', 'Telecom',
  'Consumer Defensive', 'Consumer Staples',
  'Banks', 'Insurance',
]);

const GROWTH_SECTORS = new Set([
  'Technology', 'Communication Services', 'Software',
  'Semiconductors', 'Internet', 'Biotechnology', 'Pharmaceuticals',
]);

const SPECULATIVE_SECTORS = new Set([
  'Cryptocurrency', 'Crypto', 'Cannabis', 'SPAC',
]);

function upperTicker(t) {
  return String(t || '').trim().toUpperCase().replace(/\.(NE|TO|TSX)$/i, '');
}

export function classifyIncome(holding = {}) {
  const ticker = upperTicker(holding.underlying_ticker || holding.ticker);
  const assetClass = String(holding.asset_class || holding.assetClass || '').toLowerCase();
  const sector = String(holding.sector || '').trim();

  // Optional explicit yield override (set by future Finnhub /metric enrichment)
  const yieldPct = Number(holding.dividend_yield);
  if (Number.isFinite(yieldPct) && yieldPct > 0) {
    if (yieldPct >= 3) return 'Dividend';
    if (yieldPct >= 1) return 'Hybrid';
    return 'Growth';
  }

  // 1. Hard ticker overrides
  if (DIVIDEND_TICKERS.has(ticker)) return 'Dividend';
  if (GROWTH_TICKERS.has(ticker)) return 'Growth';
  if (SPECULATIVE_TICKERS.has(ticker)) return 'Speculative';

  // 2. Asset-class shortcuts
  if (assetClass === 'cash' || assetClass === 'money market') return 'Hybrid';
  if (assetClass === 'crypto' || assetClass === 'cryptocurrency') return 'Speculative';
  if (assetClass === 'bond' || assetClass === 'fixed income') return 'Dividend';

  // 3. Sector mapping
  if (DIVIDEND_SECTORS.has(sector)) return 'Dividend';
  if (GROWTH_SECTORS.has(sector)) return 'Growth';
  if (SPECULATIVE_SECTORS.has(sector)) return 'Speculative';

  // Default — most general-market exposures fall here
  return 'Hybrid';
}

export const INCOME_BUCKETS = ['Dividend', 'Growth', 'Speculative', 'Hybrid'];
