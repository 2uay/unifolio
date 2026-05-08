/**
 * Vercel serverless function — proxies Yahoo Finance quote API.
 * Returns regularMarketPrice, regularMarketPreviousClose, regularMarketChangePercent.
 *
 * Query params:
 *   symbols — comma-separated list of ticker symbols (e.g. VFV.TO,SHOP.TO,AAPL)
 */
export default async function handler(req, res) {
  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'symbols is required' });
  }

  const fields = 'regularMarketPrice,regularMarketPreviousClose,regularMarketChangePercent,currency';
  const url =
    `https://query1.finance.yahoo.com/v7/finance/quote` +
    `?symbols=${encodeURIComponent(symbols)}&fields=${fields}`;

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

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
