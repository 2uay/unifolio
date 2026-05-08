// ============================================================
// Unifolio ETF Holdings — Static lookup table
// Approximate top-10 holdings + weights for common ETFs.
// Weights are approximate as of early 2026 and are for
// illustrative overlap detection — not real-time data.
// ============================================================

export const ETF_HOLDINGS = {
  // ── US Large-Cap ────────────────────────────────────────────
  VOO: {
    name: 'Vanguard S&P 500',
    type: 'US Large-Cap',
    holdings: [
      { ticker: 'AAPL', weight: 0.070 }, { ticker: 'NVDA', weight: 0.065 }, { ticker: 'MSFT', weight: 0.063 },
      { ticker: 'AMZN', weight: 0.040 }, { ticker: 'META', weight: 0.031 }, { ticker: 'GOOGL', weight: 0.025 },
      { ticker: 'GOOG', weight: 0.022 }, { ticker: 'BRK.B', weight: 0.018 }, { ticker: 'LLY', weight: 0.017 },
      { ticker: 'AVGO', weight: 0.016 },
    ],
  },
  SPY: {
    name: 'SPDR S&P 500',
    type: 'US Large-Cap',
    holdings: [
      { ticker: 'AAPL', weight: 0.070 }, { ticker: 'NVDA', weight: 0.065 }, { ticker: 'MSFT', weight: 0.062 },
      { ticker: 'AMZN', weight: 0.040 }, { ticker: 'META', weight: 0.031 }, { ticker: 'GOOGL', weight: 0.025 },
      { ticker: 'GOOG', weight: 0.021 }, { ticker: 'BRK.B', weight: 0.018 }, { ticker: 'LLY', weight: 0.016 },
      { ticker: 'AVGO', weight: 0.015 },
    ],
  },
  IVV: {
    name: 'iShares Core S&P 500',
    type: 'US Large-Cap',
    holdings: [
      { ticker: 'AAPL', weight: 0.070 }, { ticker: 'NVDA', weight: 0.065 }, { ticker: 'MSFT', weight: 0.063 },
      { ticker: 'AMZN', weight: 0.040 }, { ticker: 'META', weight: 0.031 }, { ticker: 'GOOGL', weight: 0.025 },
      { ticker: 'GOOG', weight: 0.022 }, { ticker: 'BRK.B', weight: 0.018 }, { ticker: 'LLY', weight: 0.017 },
      { ticker: 'AVGO', weight: 0.016 },
    ],
  },

  // ── US Total Market ──────────────────────────────────────────
  VTI: {
    name: 'Vanguard Total Stock Market',
    type: 'US Total Market',
    holdings: [
      { ticker: 'AAPL', weight: 0.058 }, { ticker: 'NVDA', weight: 0.054 }, { ticker: 'MSFT', weight: 0.052 },
      { ticker: 'AMZN', weight: 0.033 }, { ticker: 'META', weight: 0.026 }, { ticker: 'GOOGL', weight: 0.021 },
      { ticker: 'GOOG', weight: 0.018 }, { ticker: 'BRK.B', weight: 0.015 }, { ticker: 'LLY', weight: 0.014 },
      { ticker: 'AVGO', weight: 0.013 },
    ],
  },

  // ── Tech / Nasdaq ────────────────────────────────────────────
  QQQ: {
    name: 'Invesco Nasdaq-100',
    type: 'US Tech',
    holdings: [
      { ticker: 'AAPL', weight: 0.090 }, { ticker: 'NVDA', weight: 0.087 }, { ticker: 'MSFT', weight: 0.083 },
      { ticker: 'AMZN', weight: 0.053 }, { ticker: 'META', weight: 0.048 }, { ticker: 'GOOGL', weight: 0.033 },
      { ticker: 'GOOG', weight: 0.028 }, { ticker: 'TSLA', weight: 0.027 }, { ticker: 'AVGO', weight: 0.025 },
      { ticker: 'COST', weight: 0.019 },
    ],
  },
  QQQM: {
    name: 'Invesco Nasdaq-100 (Mini)',
    type: 'US Tech',
    holdings: [
      { ticker: 'AAPL', weight: 0.090 }, { ticker: 'NVDA', weight: 0.087 }, { ticker: 'MSFT', weight: 0.083 },
      { ticker: 'AMZN', weight: 0.053 }, { ticker: 'META', weight: 0.048 }, { ticker: 'GOOGL', weight: 0.033 },
      { ticker: 'GOOG', weight: 0.028 }, { ticker: 'TSLA', weight: 0.027 }, { ticker: 'AVGO', weight: 0.025 },
      { ticker: 'COST', weight: 0.019 },
    ],
  },
  XLK: {
    name: 'Technology Select Sector SPDR',
    type: 'US Tech',
    holdings: [
      { ticker: 'NVDA', weight: 0.225 }, { ticker: 'AAPL', weight: 0.195 }, { ticker: 'MSFT', weight: 0.175 },
      { ticker: 'AVGO', weight: 0.055 }, { ticker: 'ORCL', weight: 0.025 }, { ticker: 'CRM', weight: 0.025 },
      { ticker: 'ACN', weight: 0.025 }, { ticker: 'AMD', weight: 0.024 }, { ticker: 'IBM', weight: 0.021 },
      { ticker: 'CSCO', weight: 0.019 },
    ],
  },

  // ── Canadian ETFs ────────────────────────────────────────────
  VFV: {
    name: 'Vanguard S&P 500 (CAD)',
    type: 'US Large-Cap (CAD)',
    holdings: [
      { ticker: 'AAPL', weight: 0.070 }, { ticker: 'NVDA', weight: 0.065 }, { ticker: 'MSFT', weight: 0.063 },
      { ticker: 'AMZN', weight: 0.040 }, { ticker: 'META', weight: 0.031 }, { ticker: 'GOOGL', weight: 0.025 },
      { ticker: 'GOOG', weight: 0.022 }, { ticker: 'BRK.B', weight: 0.018 }, { ticker: 'LLY', weight: 0.017 },
      { ticker: 'AVGO', weight: 0.016 },
    ],
  },
  XSP: {
    name: 'iShares Core S&P 500 (CAD Hedged)',
    type: 'US Large-Cap (CAD Hedged)',
    holdings: [
      { ticker: 'AAPL', weight: 0.070 }, { ticker: 'NVDA', weight: 0.065 }, { ticker: 'MSFT', weight: 0.062 },
      { ticker: 'AMZN', weight: 0.040 }, { ticker: 'META', weight: 0.031 }, { ticker: 'GOOGL', weight: 0.025 },
      { ticker: 'GOOG', weight: 0.021 }, { ticker: 'BRK.B', weight: 0.018 }, { ticker: 'LLY', weight: 0.016 },
      { ticker: 'AVGO', weight: 0.015 },
    ],
  },
  ZSP: {
    name: 'BMO S&P 500',
    type: 'US Large-Cap (CAD)',
    holdings: [
      { ticker: 'AAPL', weight: 0.070 }, { ticker: 'NVDA', weight: 0.065 }, { ticker: 'MSFT', weight: 0.063 },
      { ticker: 'AMZN', weight: 0.040 }, { ticker: 'META', weight: 0.031 }, { ticker: 'GOOGL', weight: 0.025 },
      { ticker: 'GOOG', weight: 0.022 }, { ticker: 'BRK.B', weight: 0.018 }, { ticker: 'LLY', weight: 0.017 },
      { ticker: 'AVGO', weight: 0.016 },
    ],
  },
  XIU: {
    name: 'iShares S&P/TSX 60',
    type: 'Canadian Large-Cap',
    holdings: [
      { ticker: 'RY', weight: 0.098 }, { ticker: 'TD', weight: 0.073 }, { ticker: 'SHOP', weight: 0.068 },
      { ticker: 'ENB', weight: 0.054 }, { ticker: 'CNR', weight: 0.050 }, { ticker: 'BN', weight: 0.045 },
      { ticker: 'CP', weight: 0.043 }, { ticker: 'BMO', weight: 0.035 }, { ticker: 'BNS', weight: 0.033 },
      { ticker: 'MFC', weight: 0.030 },
    ],
  },
  'XIC.TO': {
    name: 'iShares Core S&P/TSX Capped Composite',
    type: 'Canadian Total Market',
    holdings: [
      { ticker: 'RY', weight: 0.071 }, { ticker: 'TD', weight: 0.053 }, { ticker: 'SHOP', weight: 0.048 },
      { ticker: 'ENB', weight: 0.039 }, { ticker: 'CNR', weight: 0.037 }, { ticker: 'BN', weight: 0.033 },
      { ticker: 'CP', weight: 0.031 }, { ticker: 'BMO', weight: 0.026 }, { ticker: 'BNS', weight: 0.024 },
      { ticker: 'MFC', weight: 0.022 },
    ],
  },
  XIC: {
    name: 'iShares Core S&P/TSX Capped Composite',
    type: 'Canadian Total Market',
    holdings: [
      { ticker: 'RY', weight: 0.071 }, { ticker: 'TD', weight: 0.053 }, { ticker: 'SHOP', weight: 0.048 },
      { ticker: 'ENB', weight: 0.039 }, { ticker: 'CNR', weight: 0.037 }, { ticker: 'BN', weight: 0.033 },
      { ticker: 'CP', weight: 0.031 }, { ticker: 'BMO', weight: 0.026 }, { ticker: 'BNS', weight: 0.024 },
      { ticker: 'MFC', weight: 0.022 },
    ],
  },
  VCN: {
    name: 'Vanguard FTSE Canada All Cap',
    type: 'Canadian Total Market',
    holdings: [
      { ticker: 'RY', weight: 0.068 }, { ticker: 'TD', weight: 0.051 }, { ticker: 'SHOP', weight: 0.046 },
      { ticker: 'ENB', weight: 0.037 }, { ticker: 'CNR', weight: 0.035 }, { ticker: 'BN', weight: 0.031 },
      { ticker: 'CP', weight: 0.030 }, { ticker: 'BMO', weight: 0.025 }, { ticker: 'BNS', weight: 0.023 },
      { ticker: 'MFC', weight: 0.021 },
    ],
  },
  ZCN: {
    name: 'BMO S&P/TSX Capped Composite',
    type: 'Canadian Total Market',
    holdings: [
      { ticker: 'RY', weight: 0.071 }, { ticker: 'TD', weight: 0.053 }, { ticker: 'SHOP', weight: 0.048 },
      { ticker: 'ENB', weight: 0.039 }, { ticker: 'CNR', weight: 0.037 }, { ticker: 'BN', weight: 0.033 },
      { ticker: 'CP', weight: 0.031 }, { ticker: 'BMO', weight: 0.026 }, { ticker: 'BNS', weight: 0.024 },
      { ticker: 'MFC', weight: 0.022 },
    ],
  },

  // ── International / Global ───────────────────────────────────
  VXC: {
    name: 'Vanguard FTSE Global All Cap ex Canada',
    type: 'Global ex-Canada',
    holdings: [
      { ticker: 'AAPL', weight: 0.040 }, { ticker: 'NVDA', weight: 0.037 }, { ticker: 'MSFT', weight: 0.036 },
      { ticker: 'AMZN', weight: 0.023 }, { ticker: 'META', weight: 0.018 }, { ticker: 'GOOGL', weight: 0.014 },
      { ticker: 'GOOG', weight: 0.012 }, { ticker: 'BRK.B', weight: 0.010 }, { ticker: 'LLY', weight: 0.010 },
      { ticker: 'AVGO', weight: 0.009 },
    ],
  },
  XEQT: {
    name: 'iShares Core Equity ETF Portfolio',
    type: 'Global Equity',
    holdings: [
      { ticker: 'AAPL', weight: 0.030 }, { ticker: 'NVDA', weight: 0.028 }, { ticker: 'MSFT', weight: 0.027 },
      { ticker: 'AMZN', weight: 0.017 }, { ticker: 'RY', weight: 0.015 }, { ticker: 'META', weight: 0.013 },
      { ticker: 'TD', weight: 0.011 }, { ticker: 'GOOGL', weight: 0.010 }, { ticker: 'SHOP', weight: 0.010 },
      { ticker: 'ENB', weight: 0.009 },
    ],
  },
  VEQT: {
    name: 'Vanguard All-Equity ETF Portfolio',
    type: 'Global Equity',
    holdings: [
      { ticker: 'AAPL', weight: 0.028 }, { ticker: 'NVDA', weight: 0.026 }, { ticker: 'MSFT', weight: 0.025 },
      { ticker: 'AMZN', weight: 0.016 }, { ticker: 'RY', weight: 0.014 }, { ticker: 'META', weight: 0.012 },
      { ticker: 'TD', weight: 0.010 }, { ticker: 'GOOGL', weight: 0.010 }, { ticker: 'SHOP', weight: 0.009 },
      { ticker: 'ENB', weight: 0.008 },
    ],
  },
};

// Normalize ticker for lookup (handles .TO suffix)
export function normalizeTicker(ticker) {
  return (ticker || '').toUpperCase().replace(/\.TO$/, '');
}
