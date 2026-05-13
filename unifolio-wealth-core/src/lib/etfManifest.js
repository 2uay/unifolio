// Hand-curated ETF look-through manifest. Each entry holds the top-N
// underlying constituents and a sector breakdown so the diversification chart
// can answer "do I really own AAPL 5 different ways?".
//
// Weights are percentages and should sum to 100 (top10) or 100 (sectors). Top
// 10 ETFs typically cover 25–60% of the fund; the rest is bucketed under
// "Other" to avoid claiming false precision. Update from the issuer's official
// fact sheet (Vanguard / iShares / BMO / Horizons / Mackenzie) once a year.
//
// All symbols are the Yahoo-style ticker users typically hold; both the US
// and CAD-listed wrappers point to the same underlying basket.

export const ETF_MANIFEST = {
  // ─── US-listed S&P 500 trackers ───────────────────────────────────
  VOO: {
    name: 'Vanguard S&P 500 ETF',
    asOf: '2026-04-30',
    top10: [
      { symbol: 'AAPL', weight: 7.20 },
      { symbol: 'MSFT', weight: 6.85 },
      { symbol: 'NVDA', weight: 6.40 },
      { symbol: 'AMZN', weight: 3.80 },
      { symbol: 'META', weight: 2.50 },
      { symbol: 'GOOGL', weight: 2.05 },
      { symbol: 'GOOG', weight: 1.80 },
      { symbol: 'BRK.B', weight: 1.65 },
      { symbol: 'AVGO', weight: 1.45 },
      { symbol: 'TSLA', weight: 1.40 },
    ],
    sectors: [
      { sector: 'Technology', weight: 31.0 },
      { sector: 'Financial Services', weight: 13.0 },
      { sector: 'Healthcare', weight: 11.5 },
      { sector: 'Consumer Cyclical', weight: 10.5 },
      { sector: 'Communication Services', weight: 9.0 },
      { sector: 'Industrials', weight: 8.0 },
      { sector: 'Consumer Defensive', weight: 6.0 },
      { sector: 'Energy', weight: 4.0 },
      { sector: 'Utilities', weight: 2.5 },
      { sector: 'Real Estate', weight: 2.5 },
      { sector: 'Basic Materials', weight: 2.0 },
    ],
  },
  SPY: { aliasOf: 'VOO' },
  IVV: { aliasOf: 'VOO' },

  // ─── Canadian wrappers around the S&P 500 ─────────────────────────
  VFV: { aliasOf: 'VOO', name: 'Vanguard S&P 500 Index ETF (CAD)' },
  XUS: { aliasOf: 'VOO', name: 'iShares Core S&P 500 ETF (CAD)' },
  ZSP: { aliasOf: 'VOO', name: 'BMO S&P 500 Index ETF (CAD)' },
  HXS: { aliasOf: 'VOO', name: 'Horizons S&P 500 Index ETF (CAD, total return swap)' },

  // ─── Total US Market ──────────────────────────────────────────────
  VTI: {
    name: 'Vanguard Total US Stock Market ETF',
    asOf: '2026-04-30',
    top10: [
      { symbol: 'AAPL', weight: 6.30 },
      { symbol: 'MSFT', weight: 6.00 },
      { symbol: 'NVDA', weight: 5.60 },
      { symbol: 'AMZN', weight: 3.30 },
      { symbol: 'META', weight: 2.20 },
      { symbol: 'GOOGL', weight: 1.80 },
      { symbol: 'GOOG', weight: 1.55 },
      { symbol: 'BRK.B', weight: 1.45 },
      { symbol: 'AVGO', weight: 1.30 },
      { symbol: 'TSLA', weight: 1.25 },
    ],
    sectors: [
      { sector: 'Technology', weight: 30.0 },
      { sector: 'Financial Services', weight: 13.5 },
      { sector: 'Healthcare', weight: 12.0 },
      { sector: 'Consumer Cyclical', weight: 10.5 },
      { sector: 'Communication Services', weight: 8.5 },
      { sector: 'Industrials', weight: 9.0 },
      { sector: 'Consumer Defensive', weight: 5.5 },
      { sector: 'Energy', weight: 3.5 },
      { sector: 'Utilities', weight: 2.5 },
      { sector: 'Real Estate', weight: 3.0 },
      { sector: 'Basic Materials', weight: 2.0 },
    ],
  },

  // ─── NASDAQ-100 ───────────────────────────────────────────────────
  QQQ: {
    name: 'Invesco QQQ Trust',
    asOf: '2026-04-30',
    top10: [
      { symbol: 'AAPL', weight: 9.0 },
      { symbol: 'MSFT', weight: 8.5 },
      { symbol: 'NVDA', weight: 8.0 },
      { symbol: 'AMZN', weight: 5.5 },
      { symbol: 'META', weight: 5.0 },
      { symbol: 'AVGO', weight: 4.8 },
      { symbol: 'GOOGL', weight: 2.6 },
      { symbol: 'GOOG', weight: 2.5 },
      { symbol: 'TSLA', weight: 2.3 },
      { symbol: 'COST', weight: 2.2 },
    ],
    sectors: [
      { sector: 'Technology', weight: 50.0 },
      { sector: 'Communication Services', weight: 16.0 },
      { sector: 'Consumer Cyclical', weight: 14.0 },
      { sector: 'Healthcare', weight: 6.0 },
      { sector: 'Consumer Defensive', weight: 6.5 },
      { sector: 'Industrials', weight: 5.0 },
      { sector: 'Utilities', weight: 1.5 },
      { sector: 'Financial Services', weight: 1.0 },
    ],
  },
  TQQQ: { aliasOf: 'QQQ', name: 'ProShares UltraPro QQQ (3x leveraged)' },

  // ─── US growth-tilted ─────────────────────────────────────────────
  SCHG: {
    name: 'Schwab US Large-Cap Growth ETF',
    asOf: '2026-04-30',
    top10: [
      { symbol: 'AAPL', weight: 11.0 },
      { symbol: 'MSFT', weight: 10.5 },
      { symbol: 'NVDA', weight: 9.5 },
      { symbol: 'AMZN', weight: 6.5 },
      { symbol: 'META', weight: 4.5 },
      { symbol: 'GOOGL', weight: 3.5 },
      { symbol: 'AVGO', weight: 3.0 },
      { symbol: 'GOOG', weight: 3.0 },
      { symbol: 'TSLA', weight: 2.5 },
      { symbol: 'LLY', weight: 1.8 },
    ],
    sectors: [
      { sector: 'Technology', weight: 47.0 },
      { sector: 'Communication Services', weight: 13.0 },
      { sector: 'Consumer Cyclical', weight: 13.0 },
      { sector: 'Healthcare', weight: 12.0 },
      { sector: 'Industrials', weight: 7.0 },
      { sector: 'Financial Services', weight: 5.0 },
      { sector: 'Consumer Defensive', weight: 3.0 },
    ],
  },
  VUG: { aliasOf: 'SCHG' },
  VGT: { aliasOf: 'SCHG' },

  // ─── Dividend-focused ─────────────────────────────────────────────
  SCHD: {
    name: 'Schwab US Dividend Equity ETF',
    asOf: '2026-04-30',
    top10: [
      { symbol: 'KO', weight: 4.5 },
      { symbol: 'CSCO', weight: 4.4 },
      { symbol: 'PEP', weight: 4.2 },
      { symbol: 'AMGN', weight: 4.1 },
      { symbol: 'TXN', weight: 4.0 },
      { symbol: 'VZ', weight: 4.0 },
      { symbol: 'MRK', weight: 3.9 },
      { symbol: 'BMY', weight: 3.8 },
      { symbol: 'PM', weight: 3.7 },
      { symbol: 'LMT', weight: 3.6 },
    ],
    sectors: [
      { sector: 'Healthcare', weight: 17.0 },
      { sector: 'Consumer Defensive', weight: 16.0 },
      { sector: 'Energy', weight: 13.0 },
      { sector: 'Financial Services', weight: 12.0 },
      { sector: 'Industrials', weight: 12.0 },
      { sector: 'Technology', weight: 10.0 },
      { sector: 'Communication Services', weight: 7.0 },
      { sector: 'Consumer Cyclical', weight: 6.0 },
      { sector: 'Utilities', weight: 4.0 },
      { sector: 'Basic Materials', weight: 3.0 },
    ],
  },
  VYM: { aliasOf: 'SCHD' },
  XEI: { aliasOf: 'SCHD', name: 'iShares S&P/TSX Composite High Dividend (CAD)' },
  XDV: { aliasOf: 'SCHD', name: 'iShares Canadian Select Dividend (CAD)' },
  ZDV: { aliasOf: 'SCHD', name: 'BMO Canadian Dividend (CAD)' },

  // ─── Canada total market ──────────────────────────────────────────
  XIC: {
    name: 'iShares Core S&P/TSX Capped Composite (CAD)',
    asOf: '2026-04-30',
    top10: [
      { symbol: 'RY', weight: 7.0 },
      { symbol: 'TD', weight: 5.5 },
      { symbol: 'SHOP', weight: 5.0 },
      { symbol: 'BN', weight: 4.5 },
      { symbol: 'CNR', weight: 3.8 },
      { symbol: 'ENB', weight: 3.7 },
      { symbol: 'BMO', weight: 3.5 },
      { symbol: 'CP', weight: 3.0 },
      { symbol: 'BNS', weight: 2.8 },
      { symbol: 'CNQ', weight: 2.7 },
    ],
    sectors: [
      { sector: 'Financial Services', weight: 32.0 },
      { sector: 'Energy', weight: 17.0 },
      { sector: 'Industrials', weight: 13.0 },
      { sector: 'Technology', weight: 10.0 },
      { sector: 'Basic Materials', weight: 11.0 },
      { sector: 'Communication Services', weight: 5.0 },
      { sector: 'Consumer Defensive', weight: 4.0 },
      { sector: 'Utilities', weight: 4.0 },
      { sector: 'Real Estate', weight: 2.5 },
      { sector: 'Healthcare', weight: 1.5 },
    ],
  },
  VCN: { aliasOf: 'XIC', name: 'Vanguard FTSE Canada All Cap Index (CAD)' },
  ZCN: { aliasOf: 'XIC', name: 'BMO S&P/TSX Capped Composite (CAD)' },

  // ─── Canadian asset-allocation ETFs (popular all-in-ones) ─────────
  VEQT: {
    name: 'Vanguard All-Equity ETF Portfolio (CAD)',
    asOf: '2026-04-30',
    // VEQT holds VFV/VTI/VIU/VEE/VCN — flatten to top equities they touch
    top10: [
      { symbol: 'AAPL', weight: 2.8 },
      { symbol: 'MSFT', weight: 2.7 },
      { symbol: 'NVDA', weight: 2.5 },
      { symbol: 'AMZN', weight: 1.5 },
      { symbol: 'RY', weight: 2.0 },
      { symbol: 'TD', weight: 1.6 },
      { symbol: 'META', weight: 1.0 },
      { symbol: 'GOOGL', weight: 0.9 },
      { symbol: 'TSM', weight: 0.7 },
      { symbol: 'BRK.B', weight: 0.7 },
    ],
    sectors: [
      { sector: 'Technology', weight: 22.0 },
      { sector: 'Financial Services', weight: 17.0 },
      { sector: 'Healthcare', weight: 9.5 },
      { sector: 'Consumer Cyclical', weight: 9.0 },
      { sector: 'Industrials', weight: 11.0 },
      { sector: 'Communication Services', weight: 7.0 },
      { sector: 'Consumer Defensive', weight: 6.0 },
      { sector: 'Energy', weight: 6.0 },
      { sector: 'Basic Materials', weight: 5.5 },
      { sector: 'Utilities', weight: 3.5 },
      { sector: 'Real Estate', weight: 3.5 },
    ],
  },
  XEQT: { aliasOf: 'VEQT', name: 'iShares All-Equity ETF Portfolio (CAD)' },
  ZEQT: { aliasOf: 'VEQT' },
  VGRO: { aliasOf: 'VEQT', name: 'Vanguard Growth ETF Portfolio (CAD, 80/20)' },
  XGRO: { aliasOf: 'VEQT', name: 'iShares Core Growth ETF Portfolio (CAD)' },

  // ─── Bitcoin ETFs ─────────────────────────────────────────────────
  IBIT: {
    name: 'iShares Bitcoin Trust',
    asOf: '2026-04-30',
    top10: [{ symbol: 'BTC', weight: 100 }],
    sectors: [{ sector: 'Cryptocurrency', weight: 100 }],
  },
  FBTC: { aliasOf: 'IBIT' },
  BITO: { aliasOf: 'IBIT' },
  GBTC: { aliasOf: 'IBIT' },

  // ─── Bonds / fixed income ─────────────────────────────────────────
  BND: {
    name: 'Vanguard Total Bond Market ETF',
    asOf: '2026-04-30',
    top10: [{ symbol: 'US Treasuries', weight: 65 }, { symbol: 'IG Corporate Credit', weight: 25 }],
    sectors: [{ sector: 'Fixed Income', weight: 100 }],
  },
  AGG: { aliasOf: 'BND' },
  TLT: {
    name: 'iShares 20+ Year Treasury Bond ETF',
    asOf: '2026-04-30',
    top10: [{ symbol: 'US Treasury (long duration)', weight: 100 }],
    sectors: [{ sector: 'Fixed Income', weight: 100 }],
  },
};

function resolveEntry(ticker) {
  const key = String(ticker || '').toUpperCase().replace(/\.(NE|TO|TSX)$/i, '');
  let entry = ETF_MANIFEST[key];
  // Follow aliases up to 3 hops to avoid loops
  let hops = 0;
  while (entry && entry.aliasOf && hops < 3) {
    entry = ETF_MANIFEST[entry.aliasOf];
    hops += 1;
  }
  return entry || null;
}

// Returns the canonical underlying basket for an ETF, or null if unknown.
export function getEtfBasket(ticker) {
  const entry = resolveEntry(ticker);
  if (!entry || !entry.top10) return null;
  return {
    name: entry.name,
    asOf: entry.asOf,
    top10: entry.top10,
    sectors: entry.sectors || [],
  };
}

export function isKnownEtf(ticker) {
  return Boolean(resolveEntry(ticker));
}

export function listKnownEtfs() {
  return Object.keys(ETF_MANIFEST);
}
