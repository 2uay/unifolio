export const COLUMN_DEFINITIONS = [
  { id: 'ticker', label: 'Ticker', required: true },
  { id: 'trend', label: 'Trend', required: false },
  { id: 'company', label: 'Company / Asset Name', required: true },
  { id: 'price', label: 'Last Price', required: false },
  { id: 'quantity', label: 'Position Quantity', required: false },
  { id: 'account', label: 'Account', required: false },
  { id: 'institution', label: 'Institution', required: false },
  { id: 'accountType', label: 'Account Type', required: false },
  { id: 'marketValue', label: 'Current Market Value', required: false },
  { id: 'nativeMarketValue', label: 'Native Market Value', required: false },
  { id: 'avgPrice', label: 'Average Price', required: false },
  { id: 'costBasis', label: 'Cost Basis', required: false },
  { id: 'pctPortfolio', label: '% of Portfolio', required: false },
  { id: 'pctAccount', label: '% of Account', required: false },
  { id: 'pctAssetClass', label: '% of Asset Class', required: false },
  { id: 'dailyPnl', label: 'Daily P&L', required: false },
  { id: 'dailyPnlPct', label: 'Daily P&L %', required: false },
  { id: 'unrealizedGain', label: 'Unrealized Gain/Loss', required: false },
  { id: 'unrealizedGainPct', label: 'Unrealized Gain/Loss %', required: false },
  { id: 'realizedGain', label: 'Realized Gain/Loss', required: false },
  { id: 'unrealizedGainPct', label: 'Unrealized Gain/Loss %', required: false },
  { id: 'pctPortfolio', label: '% of Portfolio', required: false },
  { id: 'pctAccount', label: '% of Account', required: false },
  { id: 'currency', label: 'Currency', required: false },
  { id: 'assetClass', label: 'Asset Class', required: false },
  { id: 'sector', label: 'Sector', required: false },
  { id: 'country', label: 'Country', required: false },
  { id: 'exchange', label: 'Exchange', required: false },
];

const DEFAULT_VISIBLE_COLUMNS = ['ticker', 'company', 'price', 'quantity', 'account', 'marketValue', 'dailyPnl', 'dailyPnlPct', 'unrealizedGain', 'realizedGain', 'pctPortfolio', 'pctAccount'];

const COLUMN_STORAGE_KEY = 'unifolio_holdings_columns';

export function getDefaultColumnOrder() {
  return DEFAULT_VISIBLE_COLUMNS;
}

export function getSavedColumnOrder() {
  const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_VISIBLE_COLUMNS;
}

export function saveColumnOrder(columnIds) {
  localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columnIds));
}

export function getVisibleColumns(columnIds) {
  return columnIds.map(id => COLUMN_DEFINITIONS.find(c => c.id === id)).filter(Boolean);
}

export function getAvailableColumns(visibleColumnIds) {
  return COLUMN_DEFINITIONS.filter(c => !visibleColumnIds.includes(c.id));
}