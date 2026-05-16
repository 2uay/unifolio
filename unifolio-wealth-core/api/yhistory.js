/**
 * Vercel serverless function — proxies Yahoo Finance historical chart API.
 * Returns daily OHLC + adjusted close for a given symbol over a date range.
 *
 * Used by the Behavioral v2 detectors (chase pattern, capitulation,
 * holding-period performance) to look up the price context around each
 * Buy/Sell transaction.
 *
 * Query params:
 *   symbol — single ticker (e.g. VFV.TO, SHOP, AAPL)
 *   from   — ISO date (YYYY-MM-DD) or unix-seconds — start of the window (inclusive)
 *   to     — ISO date (YYYY-MM-DD) or unix-seconds — end of the window (inclusive)
 *
 * Returns: {
 *   symbol, currency,
 *   bars: [{ date: 'YYYY-MM-DD', open, high, low, close, adjClose, volume }, ...]
 * }
 *
 * The Yahoo chart endpoint returns a sparse array (some indexes are null for
 * non-trading days), so we filter to bars where at least `close` is present.
 */

function toUnixSeconds(value) {
  if (value === undefined || value === null || value === '') return null;
  // Already unix seconds?
  if (typeof value === 'number') return Math.floor(value);
  const n = Number(value);
  if (Number.isFinite(n) && /^\d+$/.test(String(value))) return Math.floor(n);
  // Treat as ISO date — anchor to noon UTC to avoid timezone-edge surprises.
  const ms = Date.parse(`${value}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function toIsoDate(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const from = toUnixSeconds(req.query.from);
  const to = toUnixSeconds(req.query.to) ?? Math.floor(Date.now() / 1000);
  if (!from || from >= to) {
    return res.status(400).json({ error: 'from is required and must precede to' });
  }

  // Yahoo's `/v8/finance/chart` is the modern endpoint Yahoo's own web UI uses.
  // includePrePost=false keeps to regular session bars; events=split,div
  // gives us the data needed to back out adjusted closes if we ever want to
  // surface dividend / split context.
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${from}&period2=${to}&interval=1d&events=div%2Csplit&includePrePost=false`;

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
    const json = await upstream.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ error: 'No data for symbol/range' });
    }
    const timestamps = result.timestamp || [];
    const ind = result.indicators?.quote?.[0] || {};
    const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
    const bars = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = ind.close?.[i];
      if (close === null || close === undefined) continue;
      bars.push({
        date: toIsoDate(timestamps[i]),
        open: ind.open?.[i] ?? null,
        high: ind.high?.[i] ?? null,
        low: ind.low?.[i] ?? null,
        close,
        adjClose: adj[i] ?? null,
        volume: ind.volume?.[i] ?? null,
      });
    }

    // Cache aggressively at the edge — historical bars don't change once
    // the trading day is closed. 6h s-maxage with 12h SWR keeps Yahoo
    // happy and the cost-per-request near zero.
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=43200');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.json({
      symbol: result.meta?.symbol || symbol,
      currency: result.meta?.currency || null,
      bars,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
