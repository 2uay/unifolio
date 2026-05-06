// Sample news data per ticker — replace with real API later
// Structure is ready for: ticker, headline, source, published_at, summary, url, sentiment

const NEWS_POOL = [
  { headline: 'Fed signals rate pause amid strong jobs data', source: 'Reuters', summary: 'Federal Reserve officials hinted at holding rates steady after employment figures beat expectations.', sentiment: 'neutral' },
  { headline: 'Tech sector rallies on AI spending optimism', source: 'Bloomberg', summary: 'Major technology stocks surged as investors bet on continued enterprise AI investment through 2026.', sentiment: 'positive' },
  { headline: 'Earnings season kicks off with mixed results', source: 'WSJ', summary: 'S&P 500 companies are reporting better-than-expected revenue but cautious forward guidance.', sentiment: 'neutral' },
  { headline: 'Inflation data comes in cooler than expected', source: 'CNBC', summary: 'Core CPI rose 0.2% in April, below the 0.3% consensus, lifting hopes of rate cuts later this year.', sentiment: 'positive' },
  { headline: 'Global markets slip on China trade uncertainty', source: 'FT', summary: 'Concerns over renewed US-China tariffs weighed on global equities in early trading.', sentiment: 'negative' },
  { headline: 'Energy stocks under pressure as oil prices fall', source: 'MarketWatch', summary: 'Crude oil fell below $78 a barrel, dragging energy sector stocks lower.', sentiment: 'negative' },
  { headline: 'Consumer spending remains resilient in Q1', source: 'Bloomberg', summary: 'Retail sales data showed consumers kept spending despite high borrowing costs.', sentiment: 'positive' },
  { headline: 'Institutional investors increase tech holdings', source: 'Barron\'s', summary: 'Latest 13F filings show major funds added to positions in semiconductors and cloud software.', sentiment: 'positive' },
  { headline: 'Supply chain improvements boost margins outlook', source: 'Reuters', summary: 'Companies across sectors report improving logistics and lower input costs heading into Q2.', sentiment: 'positive' },
  { headline: 'Analysts raise price targets ahead of earnings', source: 'Goldman Sachs', summary: 'A wave of upward revisions has been issued as analysts price in better-than-expected margins.', sentiment: 'positive' },
  { headline: 'Dividend aristocrats outperform in volatile week', source: 'Morningstar', summary: 'High-yield and dividend growth stocks attracted defensive inflows during market turbulence.', sentiment: 'positive' },
  { headline: 'Short interest rises on valuation concerns', source: 'S3 Partners', summary: 'Short sellers have been increasing bets against richly valued growth stocks.', sentiment: 'negative' },
];

const TICKER_NEWS = {
  AAPL: [
    { headline: 'Apple reportedly testing foldable iPhone prototype', source: 'The Information', summary: 'Sources say Apple is evaluating a book-style foldable design for a potential 2027 release.', sentiment: 'positive' },
    { headline: 'App Store antitrust ruling forces Apple to open payments', source: 'Reuters', summary: 'A court order requires Apple to allow alternative payment processors in the EU.', sentiment: 'negative' },
    { headline: 'Apple Intelligence adoption growing faster than expected', source: 'Bloomberg', summary: 'Internal data suggests AI features are driving iPhone upgrade cycles globally.', sentiment: 'positive' },
  ],
  MSFT: [
    { headline: 'Microsoft Copilot reaches 100M enterprise users', source: 'Bloomberg', summary: 'Microsoft\'s AI assistant has hit a new milestone, fueling Azure cloud revenue growth.', sentiment: 'positive' },
    { headline: 'Azure cloud growth reaccelerates in Q2', source: 'CNBC', summary: 'Azure posted 31% growth, ahead of analyst estimates, driven by AI workload demand.', sentiment: 'positive' },
    { headline: 'Microsoft raises quarterly dividend by 10%', source: 'WSJ', summary: 'The software giant announced a dividend increase alongside a $60B buyback program.', sentiment: 'positive' },
  ],
  NVDA: [
    { headline: 'NVIDIA announces Blackwell Ultra GPU ahead of schedule', source: 'Reuters', summary: 'The next-gen chip is expected to deliver 2x performance over its predecessor.', sentiment: 'positive' },
    { headline: 'US export controls tighten on advanced AI chips', source: 'Bloomberg', summary: 'New rules restrict shipments of H100-class chips to additional countries.', sentiment: 'negative' },
    { headline: 'Data center demand for NVIDIA GPUs shows no signs of slowing', source: 'Barron\'s', summary: 'Hyperscalers continue ordering at record pace, keeping backlog elevated.', sentiment: 'positive' },
  ],
  TSLA: [
    { headline: 'Tesla Robotaxi launch delayed to late 2026', source: 'Reuters', summary: 'Sources indicate regulatory hurdles are pushing back the autonomous ride-hail launch.', sentiment: 'negative' },
    { headline: 'Tesla Q1 deliveries disappoint but energy business shines', source: 'Bloomberg', summary: 'Vehicle deliveries fell short of estimates while Megapack deployments hit a record.', sentiment: 'neutral' },
    { headline: 'Elon Musk hints at budget Model 2 reveal this year', source: 'CNBC', summary: 'The CEO posted a teaser suggesting a $25K vehicle announcement may come soon.', sentiment: 'positive' },
  ],
  GOOGL: [
    { headline: 'Alphabet ad revenue beats estimates despite AI competition', source: 'WSJ', summary: 'Search remained resilient as YouTube and Cloud drove upside in the quarter.', sentiment: 'positive' },
    { headline: 'Google faces DOJ antitrust remedy phase', source: 'Reuters', summary: 'The government is pushing for structural changes after Google lost its search monopoly case.', sentiment: 'negative' },
  ],
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function seededPick(pool, ticker, count) {
  const seed = ticker.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[(seed + i * 7) % pool.length]);
  }
  return result;
}

export function getNewsForTicker(ticker) {
  const specific = TICKER_NEWS[ticker] || [];
  const generic = seededPick(NEWS_POOL, ticker, Math.max(0, 5 - specific.length));
  return [...specific, ...generic].slice(0, 5).map((item, i) => ({
    ...item,
    ticker,
    published_at: daysAgo(i),
    url: '#',
    id: `${ticker}-news-${i}`,
  }));
}