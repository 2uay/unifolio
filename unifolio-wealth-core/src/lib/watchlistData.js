// Sample watchlists data
export const SAMPLE_WATCHLISTS = [
  { id: 'wl-main',     name: 'Main',     description: 'General watchlist',                color: '#3b82f6', icon: '⭐' },
  { id: 'wl-tech',     name: 'Tech',     description: 'Technology stocks',                color: '#8b5cf6', icon: '💻' },
  { id: 'wl-etfs',     name: 'ETFs',     description: 'Exchange-traded funds',            color: '#10b981', icon: '📊' },
  { id: 'wl-dividend', name: 'Dividend', description: 'High dividend yield stocks',       color: '#f59e0b', icon: '💰' },
];

// Sample explore stocks pool
export const EXPLORE_POOL = [
  { ticker: 'AAPL',  name: 'Apple Inc.',            price: 213.40, changePct: +1.20, industry: 'Technology',   sector: 'tech' },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',        price: 415.80, changePct: +0.85, industry: 'Technology',   sector: 'tech' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.',           price: 178.20, changePct: -0.42, industry: 'Technology',   sector: 'tech' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',        price: 198.50, changePct: +2.10, industry: 'Consumer',     sector: 'consumer' },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',           price: 875.30, changePct: +3.45, industry: 'Semiconductors', sector: 'tech' },
  { ticker: 'META',  name: 'Meta Platforms',         price: 521.70, changePct: -0.75, industry: 'Technology',   sector: 'tech' },
  { ticker: 'TSLA',  name: 'Tesla Inc.',             price: 248.60, changePct: +1.85, industry: 'Automotive',   sector: 'ev' },
  { ticker: 'JPM',   name: 'JPMorgan Chase',         price: 204.30, changePct: -0.30, industry: 'Financials',   sector: 'finance' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway',     price: 418.50, changePct: +0.15, industry: 'Financials',   sector: 'finance' },
  { ticker: 'UNH',   name: 'UnitedHealth Group',     price: 487.20, changePct: -1.10, industry: 'Healthcare',   sector: 'health' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',      price: 161.40, changePct: +0.25, industry: 'Healthcare',   sector: 'health' },
  { ticker: 'PFE',   name: 'Pfizer Inc.',            price: 28.90,  changePct: -0.55, industry: 'Pharma',       sector: 'health' },
  { ticker: 'VTI',   name: 'Vanguard Total Market',  price: 252.10, changePct: +0.40, industry: 'Broad Market', sector: 'etf' },
  { ticker: 'SPY',   name: 'SPDR S&P 500 ETF',       price: 527.30, changePct: +0.55, industry: 'Broad Market', sector: 'etf' },
  { ticker: 'QQQ',   name: 'Invesco QQQ Trust',      price: 460.70, changePct: +0.90, industry: 'Technology',   sector: 'etf' },
  { ticker: 'SCHD',  name: 'Schwab US Dividend',     price: 82.40,  changePct: +0.20, industry: 'Dividend',     sector: 'etf' },
  { ticker: 'VYM',   name: 'Vanguard High Dividend', price: 129.80, changePct: +0.10, industry: 'Dividend',     sector: 'etf' },
  { ticker: 'KO',    name: 'Coca-Cola Co.',          price: 68.20,  changePct: +0.05, industry: 'Consumer',     sector: 'consumer' },
  { ticker: 'PG',    name: 'Procter & Gamble',       price: 171.90, changePct: -0.15, industry: 'Consumer',     sector: 'consumer' },
  { ticker: 'COIN',  name: 'Coinbase Global',        price: 218.40, changePct: +4.20, industry: 'Crypto/Fintech', sector: 'crypto' },
  { ticker: 'MSTR',  name: 'MicroStrategy',          price: 1248.0, changePct: +5.10, industry: 'Crypto/Fintech', sector: 'crypto' },
  { ticker: 'RIOT',  name: 'Riot Platforms',         price: 12.80,  changePct: +3.60, industry: 'Crypto Mining',  sector: 'crypto' },
  { ticker: 'ABBV',  name: 'AbbVie Inc.',            price: 181.20, changePct: +0.45, industry: 'Pharma',       sector: 'health' },
  { ticker: 'MRK',   name: 'Merck & Co.',            price: 128.70, changePct: -0.35, industry: 'Pharma',       sector: 'health' },
  { ticker: 'NEE',   name: 'NextEra Energy',         price: 74.50,  changePct: +0.60, industry: 'Utilities',    sector: 'utilities' },
  { ticker: 'XOM',   name: 'Exxon Mobil',            price: 114.80, changePct: -0.80, industry: 'Energy',       sector: 'energy' },
  { ticker: 'INTC',  name: 'Intel Corp.',            price: 22.40,  changePct: -1.25, industry: 'Semiconductors', sector: 'tech' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices', price: 158.30, changePct: +2.70, industry: 'Semiconductors', sector: 'tech' },
];

// Pick 8 explore stocks based on the tickers in the active watchlist
export function getExploreStocks(watchlistTickers = [], seed = 0) {
  const lowerTickers = watchlistTickers.map(t => t.toLowerCase());

  // Determine dominant sectors from watchlist
  const sectorCounts = {};
  EXPLORE_POOL.forEach(s => {
    if (lowerTickers.includes(s.ticker.toLowerCase())) {
      sectorCounts[s.sector] = (sectorCounts[s.sector] || 0) + 2;
    }
  });

  // Score each stock
  const scored = EXPLORE_POOL
    .filter(s => !lowerTickers.includes(s.ticker.toLowerCase()))
    .map(s => ({
      ...s,
      score: (sectorCounts[s.sector] || 0) + ((s.ticker.charCodeAt(0) + seed) % 5),
    }))
    .sort((a, b) => b.score - a.score);

  // Take top 8 with a bit of shuffle variety via seed
  const shuffled = [...scored].sort((a, b) => {
    const va = a.score * 10 + ((a.ticker.charCodeAt(0) + seed) % 7);
    const vb = b.score * 10 + ((b.ticker.charCodeAt(0) + seed) % 7);
    return vb - va;
  });

  return shuffled.slice(0, 8);
}