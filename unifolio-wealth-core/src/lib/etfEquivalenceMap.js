/**
 * ETF equivalence groups — maps tickers that track the same underlying index
 * across different markets/currencies (e.g. VOO USD ↔ VFV.TO CAD → "S&P 500").
 * Used by stackCDRGroups() to merge cross-market ETF positions.
 */
export const ETF_GROUPS = [
  { canonical: 'S&P 500', tickers: ['VOO', 'SPY', 'IVV', 'CSPX', 'VFV', 'VFV.TO', 'ZSP', 'ZSP.TO', 'XUS', 'XUS.TO', 'XSPX', 'XSPX.TO', 'SPLG'] },
  { canonical: 'NASDAQ 100', tickers: ['QQQ', 'QQQM', 'QQC', 'QQC.TO', 'XQQ', 'XQQ.TO', 'QQCF', 'QQCF.TO'] },
  { canonical: 'Total US Market', tickers: ['VTI', 'ITOT', 'SCHB', 'SPTM', 'VUN', 'VUN.TO'] },
  { canonical: 'TSX Composite', tickers: ['XIC', 'XIC.TO', 'VCN', 'VCN.TO', 'ZCN', 'ZCN.TO', 'TTP', 'TTP.TO'] },
  { canonical: 'S&P/TSX 60', tickers: ['XIU', 'XIU.TO', 'HXT', 'HXT.TO'] },
  { canonical: 'Global Equity', tickers: ['VT', 'ACWI', 'AWF', 'XEQT', 'XEQT.TO', 'VEQT', 'VEQT.TO'] },
  { canonical: 'Developed Markets', tickers: ['EFA', 'IEFA', 'VEA', 'SPDW', 'XEF', 'XEF.TO', 'ZEA', 'ZEA.TO', 'VDU', 'VDU.TO'] },
  { canonical: 'Emerging Markets', tickers: ['EEM', 'IEMG', 'VWO', 'SPEM', 'XEC', 'XEC.TO', 'ZEM', 'ZEM.TO', 'VEE', 'VEE.TO'] },
  { canonical: 'Gold', tickers: ['GLD', 'IAU', 'GLDM', 'SGOL', 'CGL', 'CGL.TO', 'PHYS', 'MNT', 'MNT.TO', 'GOLY', 'GOLY.TO'] },
  { canonical: 'Aggregate Bonds', tickers: ['AGG', 'BND', 'SCHZ', 'ZAG', 'ZAG.TO', 'XBB', 'XBB.TO', 'VAB', 'VAB.TO'] },
  { canonical: 'Short-Term Bonds', tickers: ['SHY', 'BSV', 'JPST', 'VSB', 'VSB.TO', 'XSB', 'XSB.TO', 'ZST', 'ZST.TO'] },
  { canonical: 'TIPS / Inflation', tickers: ['TIP', 'VTIP', 'SCHP', 'ZRR', 'ZRR.TO', 'XRB', 'XRB.TO'] },
  { canonical: 'Real Estate (REIT)', tickers: ['VNQ', 'SCHH', 'REET', 'IYR', 'XRE', 'XRE.TO', 'ZRE', 'ZRE.TO', 'VRE', 'VRE.TO'] },
  { canonical: 'Dividend Income', tickers: ['VYM', 'SCHD', 'DVY', 'HDV', 'CDZ', 'CDZ.TO', 'XDV', 'XDV.TO', 'VDY', 'VDY.TO', 'ZDV', 'ZDV.TO'] },
  { canonical: 'Bitcoin', tickers: ['IBIT', 'FBTC', 'GBTC', 'ARKB', 'BTCC', 'BTCC.TO', 'BTCX', 'BTCX.TO', 'EBIT', 'EBIT.TO', 'BTCQ', 'BTCQ.TO'] },
  { canonical: 'Ethereum', tickers: ['ETHA', 'FETH', 'ETHW', 'ETHH', 'ETHH.TO', 'ETHR', 'ETHR.TO', 'ETHQ', 'ETHQ.TO'] },
  { canonical: 'Healthcare', tickers: ['XLV', 'VHT', 'IYH', 'FHLC', 'XHC', 'XHC.TO', 'HHL', 'HHL.TO'] },
  { canonical: 'Financials', tickers: ['XLF', 'VFH', 'IYF', 'ZEB', 'ZEB.TO', 'XFN', 'XFN.TO'] },
  { canonical: 'Energy', tickers: ['XLE', 'VDE', 'IYE', 'FENY', 'XEG', 'XEG.TO', 'ZEO', 'ZEO.TO', 'ENS', 'ENS.TO'] },
  { canonical: 'Clean Energy', tickers: ['ICLN', 'ACES', 'CNRG', 'SMOG', 'ZNE', 'ZNE.TO', 'HCLN', 'HCLN.TO'] },
];

// Build a fast O(1) lookup table (ticker → group), normalised to uppercase.
const _lookup = new Map();
for (const group of ETF_GROUPS) {
  for (const ticker of group.tickers) {
    _lookup.set(ticker.toUpperCase(), group);
  }
}

/**
 * Returns the ETF group for a given ticker, or null if not recognised.
 * Case-insensitive.
 */
export function getETFGroup(ticker) {
  if (!ticker) return null;
  return _lookup.get(String(ticker).toUpperCase()) ?? null;
}
