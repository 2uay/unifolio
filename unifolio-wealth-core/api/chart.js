/**
 * Vercel serverless function — proxies Yahoo Finance chart API.
 * No API key required. Runs server-side so no CORS issues.
 *
 * Query params:
 *   ticker   — stock symbol (e.g. AAPL, VFV.TO)
 *   interval — bar size: 5m, 15m, 60m, 1d, 1wk, 1mo
 *   range    — time window: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
 */
export default async function handler(req, res) {
  const { ticker, interval = '1d', range = '1y' } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
    }

    const data = await upstream.json();

    // Cache on Vercel CDN edge — 5 min for intraday, 1 hr for daily+
    const isIntraday = interval.endsWith('m') || interval === '60m';
    const maxAge = isIntraday ? 300 : 3600;
    res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
