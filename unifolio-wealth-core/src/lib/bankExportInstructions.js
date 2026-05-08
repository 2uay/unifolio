const STANDARD_TEMPLATE = `Date,Settlement Date,Institution,Account,Account Type,Type,Ticker,Asset Name,Asset Class,Quantity,Price,Gross Amount,Fees,Net Amount,Currency,Exchange Rate (to CAD),CAD Equivalent,USD Equivalent,Cost Basis,Proceeds,Realized G/L,Realized G/L %,Dividend Amount,Interest Amount,Notes
2026-01-15,2026-01-17,Example Broker,TFSA,TFSA,Buy,AAPL,Apple Inc.,Equity,10,185.25,1852.50,0,1852.50,USD,1.37,2537.93,1852.50,,,,,,Imported sample row
`;

const HOLDINGS_TEMPLATE = `Institution,Account,Account Type,Ticker,Asset Name,Asset Class,Quantity,Price,Market Value,Currency,Cost Basis,Average Price
Example Broker,TFSA,TFSA,AAPL,Apple Inc.,Equity,10,185.25,1852.50,USD,1700.00,170.00
`;

const FLEX_QUERY_TEMPLATE = `# Unifolio IBKR Flex Query Field Checklist
# Create an Activity Flex Query in IBKR Client Portal and include these sections/fields.
Statement,Account Information,Trades,Transfers,Deposits & Withdrawals,Dividends,Interest,Fees,Positions,Open Positions,Realized & Unrealized Performance Summary
Fields,Account ID,Account Alias,Asset Category,Symbol,Description,Date/Time,Trade Date,Settle Date,Quantity,Trade Price,Proceeds,Commission,Taxes,Cost Basis,Realized P/L,Currency
Format,CSV or XML
`;

const commonDownloads = [
  { label: 'Download transaction CSV template', filename: 'unifolio-transaction-template.csv', type: 'text/csv', content: STANDARD_TEMPLATE },
  { label: 'Download holdings CSV template', filename: 'unifolio-holdings-template.csv', type: 'text/csv', content: HOLDINGS_TEMPLATE },
];

export const bankExportInstructions = [
  {
    id: 'wealthsimple',
    name: 'Wealthsimple',
    country: 'CA',
    logo: '🟢',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [
      { label: 'Request a custom statement', url: 'https://help.wealthsimple.com/hc/en-ca/articles/35654428540571-Request-a-custom-statement', external: true },
      { label: 'View account activity', url: 'https://help.wealthsimple.com/hc/en-ca/articles/39449252453019-View-your-account-activity', external: true },
    ],
    steps: [
      { title: 'Download the Holdings report CSV', description: 'For the most accurate current portfolio snapshot, open Profile, Documents, Request documents, then choose Holdings report (CSV) and download it for each account you want in Unifolio.' },
      { title: 'Download the Activities export CSV', description: 'Open the Activity tab, select Download activities, choose the longest available period and the same account(s), then download the CSV.' },
      { title: 'Upload both files when possible', description: 'The holdings report provides exact current quantities, prices, and market values. The activities export provides trades, transfers, dividends, interest, and realized-history reconstruction.' },
      { title: 'Activity-only imports still work', description: 'If you only have an activities export, Unifolio reconstructs open holdings from buys/security transfers and values them with market data, with broker-cost fallback where live prices are unavailable.' },
    ],
    screenshots: [{ alt: 'Wealthsimple documents export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    country: 'US/CA',
    logo: '🔴',
    exportTypes: ['activity_csv', 'flex_query'],
    links: [
      { label: 'Flex Queries guide', url: 'https://www.ibkrguides.com/orgportal/performanceandstatements/flex.htm', external: true },
      { label: 'Run a Flex Query', url: 'https://www.ibkrguides.com/clientportal/performanceandstatements/runflex.htm', external: true },
    ],
    steps: [
      { title: 'Open Flex Queries', description: 'In Client Portal, go to Performance & Reports, then Flex Queries.' },
      { title: 'Create an Activity Flex Query', description: 'Add account information, trades, cash activity, dividends, fees, positions, and realized P&L fields.' },
      { title: 'Choose CSV or XML output', description: 'CSV is easiest for manual upload; XML can preserve richer IBKR structure if a parser is added later.' },
      { title: 'Run and save the query', description: 'Run the saved query for the desired period and upload the resulting file.' },
    ],
    screenshots: [{ alt: 'IBKR Flex Query setup placeholder', placeholder: true }],
    downloads: [
      ...commonDownloads,
      { label: 'Download IBKR Flex Query checklist', filename: 'unifolio-ibkr-flex-query-checklist.txt', type: 'text/plain', content: FLEX_QUERY_TEMPLATE },
    ],
  },
  {
    id: 'questrade',
    name: 'Questrade',
    country: 'CA',
    logo: '🟡',
    exportTypes: ['activity_csv'],
    links: [
      { label: 'Track account activity', url: 'https://www.questrade.com/learning/questrade-basics/track-your-account-activity', external: true },
      { label: 'Questrade account activity API', url: 'https://www.questrade.com/api/documentation/rest-operations/account-calls', external: true },
    ],
    steps: [
      { title: 'Open Account Activity', description: 'Log in to Questrade and open Accounts, then Activity.' },
      { title: 'Filter the period', description: 'Set the account and date filters before exporting.' },
      { title: 'Export CSV', description: 'Use the CSV export for trades, dividends, deposits, withdrawals, and other cash activity.' },
    ],
    screenshots: [{ alt: 'Questrade activity export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'td',
    name: 'TD Direct Investing',
    country: 'CA',
    logo: '🟢',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [{ label: 'TD Direct Investing login', url: 'https://webbroker.td.com/', external: true }],
    steps: [
      { title: 'Open WebBroker', description: 'Log in and choose the relevant investment account.' },
      { title: 'Export holdings or activity', description: 'Use account holdings or activity/download tools when available, keeping one account per file if possible.' },
      { title: 'Match template columns', description: 'If TD exports an Excel file, save as CSV and align with the Unifolio template.' },
    ],
    screenshots: [{ alt: 'TD WebBroker export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'rbc',
    name: 'RBC Direct Investing',
    country: 'CA',
    logo: '🔵',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [{ label: 'RBC Direct Investing login', url: 'https://www.rbcdirectinvesting.com/', external: true }],
    steps: [
      { title: 'Open RBC Direct Investing', description: 'Log in and select the account to export.' },
      { title: 'Download account data', description: 'Use holdings, activity, or statement download options and prefer CSV/Excel format.' },
      { title: 'Normalize before upload', description: 'Save Excel exports as CSV and map account, ticker, quantity, price, market value, and currency.' },
    ],
    screenshots: [{ alt: 'RBC export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'bmo',
    name: 'BMO InvestorLine',
    country: 'CA',
    logo: '🔵',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [{ label: 'BMO InvestorLine login', url: 'https://www.bmoinvestorline.com/', external: true }],
    steps: [
      { title: 'Open InvestorLine', description: 'Log in, choose your account, then open holdings or transaction history.' },
      { title: 'Export the table', description: 'Download or save the visible holdings/activity data as CSV or Excel.' },
      { title: 'Use templates if needed', description: 'Copy the required columns into the Unifolio template if the broker export is not directly supported yet.' },
    ],
    screenshots: [{ alt: 'BMO InvestorLine export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'scotia',
    name: 'Scotia iTRADE',
    country: 'CA',
    logo: '🔴',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [{ label: 'Scotia iTRADE login', url: 'https://www.scotiaitrade.com/', external: true }],
    steps: [
      { title: 'Open Scotia iTRADE', description: 'Choose the account and open holdings or activity.' },
      { title: 'Download CSV/Excel', description: 'Export the relevant report and preserve original column headers.' },
      { title: 'Upload to Unifolio', description: 'Use the matching import flow or the CSV template if the native export needs cleanup.' },
    ],
    screenshots: [{ alt: 'Scotia iTRADE export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'cibc',
    name: "CIBC Investor's Edge",
    country: 'CA',
    logo: '🔴',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [{ label: "CIBC Investor's Edge login", url: 'https://www.investorsedge.cibc.com/', external: true }],
    steps: [
      { title: 'Open Investor’s Edge', description: 'Log in and select the target investment account.' },
      { title: 'Export account information', description: 'Download holdings, transactions, or statement details in CSV/Excel where available.' },
      { title: 'Prepare the CSV', description: 'Keep ticker, quantity, price, market value, account, and currency columns intact.' },
    ],
    screenshots: [{ alt: 'CIBC export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'nbdb',
    name: 'National Bank Direct',
    country: 'CA',
    logo: '🔴',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [{ label: 'National Bank Direct Brokerage login', url: 'https://nbdb.ca/', external: true }],
    steps: [
      { title: 'Open NBDB', description: 'Log in and choose the brokerage account.' },
      { title: 'Export holdings or transactions', description: 'Use available table download, statement, or activity export tools.' },
      { title: 'Use Unifolio format', description: 'If the downloaded report is not CSV, save as CSV and map it to the template.' },
    ],
    screenshots: [{ alt: 'National Bank Direct export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'schwab',
    name: 'Charles Schwab',
    country: 'US',
    logo: '🇺🇸',
    exportTypes: ['holdings_csv', 'activity_csv'],
    links: [
      { label: 'Schwab positions export guide', url: 'https://help.streetsmart.schwab.com/edge/1.44/Content/Positions.htm', external: true },
    ],
    steps: [
      { title: 'Open Positions', description: 'Open the Positions tab in Schwab or StreetSmart Edge.' },
      { title: 'Use Actions export', description: 'Export Positions for top-level rows or Export Positions with Lots for lot-level cost basis.' },
      { title: 'Choose CSV', description: 'Save the file as CSV when prompted, then upload it to Unifolio.' },
    ],
    screenshots: [{ alt: 'Schwab positions export placeholder', placeholder: true }],
    downloads: commonDownloads,
  },
  {
    id: 'chase',
    name: 'Chase Bank',
    country: 'US',
    logo: '🇺🇸',
    exportTypes: ['activity_csv'],
    links: [{ label: 'Chase account login', url: 'https://secure.chase.com/', external: true }],
    steps: [
      { title: 'Open account activity', description: 'Log in to Chase and open the relevant account activity page.' },
      { title: 'Download transactions', description: 'Use CSV download/export for balances or transaction history.' },
      { title: 'Upload activity CSV', description: 'Use the activity template when mapping payment balances or debt/banking rows.' },
    ],
    screenshots: [{ alt: 'Chase transaction export placeholder', placeholder: true }],
    downloads: [commonDownloads[0]],
  },
];

export function downloadInstructionAsset(download) {
  const blob = new Blob([download.content], { type: `${download.type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = download.filename;
  link.click();
  URL.revokeObjectURL(url);
}
