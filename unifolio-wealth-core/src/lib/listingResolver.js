// Live listing resolver. Given a bare US ticker, queries Finnhub's symbol
// search to discover every exchange that ticker (or its CDR) is listed on, and
// returns one canonical record per category: { us, tsx, cdr }.
//
// Why this exists: the importer cannot reliably distinguish LLY (NYSE, USD)
// from LLY CDR (TSX/Cboe Canada, CAD) using only ticker + currency from a
// Wealthsimple CSV. Heuristics ("currency=CAD ⇒ TSX") fabricate exchanges that
// don't exist. This module asks Finnhub what actually trades and returns
// verified, citable records — or null when no listing of that kind exists.
//
// Output contract — `null` is meaningful and means "no listing of that kind":
//   {
//     us:  { symbol, displaySymbol, exchange, description } | null,
//     tsx: { symbol, displaySymbol, exchange, description } | null,
//     cdr: { symbol, displaySymbol, exchange, description, currency: 'CAD' } | null,
//     resolvedAt: ISO,
//     source: 'finnhub' | 'cache' | 'manual',
//   }
//
// Cache: localStorage `unifolio_listing_resolver_v1`, 30-day TTL. CDR listings
// are slow-moving (CIBC adds a handful per year). Manual overrides written
// through `setManualListing()` never expire and take precedence over Finnhub.

import { searchSymbols } from '@/lib/stockApi';
import { mayHaveCDR } from '@/lib/cdrRegistry';

const CACHE_KEY = 'unifolio_listing_resolver_v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function normalize(ticker) {
  return String(ticker || '').trim().toUpperCase().replace(/\s+/g, '');
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function isFresh(entry) {
  if (!entry?.resolvedAt) return false;
  if (entry.source === 'manual') return true;
  return Date.now() - new Date(entry.resolvedAt).getTime() < CACHE_TTL_MS;
}

// Classify a Finnhub /search result row into one of: 'us' | 'tsx' | 'cdr' | null.
// Finnhub returns rows like:
//   { symbol: 'LLY',     displaySymbol: 'LLY',     description: 'ELI LILLY & CO',     type: 'Common Stock' }
//   { symbol: 'LLY.NE',  displaySymbol: 'LLY.NE',  description: 'ELI LILLY & CO CDR', type: 'Common Stock' }
//   { symbol: 'LLY.TO',  displaySymbol: 'LLY.TO',  description: 'ELI LILLY & CO CDR', type: 'Common Stock' }
function classifyResult(result, underlying) {
  const symbol = String(result.symbol || '').toUpperCase();
  const displaySymbol = String(result.displaySymbol || symbol).toUpperCase();
  const description = String(result.description || '').toUpperCase();
  const type = String(result.type || '').toUpperCase();

  if (type && !/COMMON STOCK|EQUITY|ADR|DR/i.test(type)) return null;

  const baseSymbol = symbol.replace(/\.(NE|TO|TSX|V|CN)$/i, '').replace(/:.*$/, '');
  if (baseSymbol !== underlying) return null;

  const isCanadianSuffix = /\.(NE|TO|TSX)$/i.test(symbol);
  const descSaysCdr = /\bCDR\b|CANADIAN DEPOSITARY RECEIPT/.test(description);

  if (isCanadianSuffix && descSaysCdr) return 'cdr';
  if (isCanadianSuffix && !descSaysCdr) return 'tsx';
  if (!isCanadianSuffix && !symbol.includes('.')) return 'us';
  return null;
}

function exchangeFromSymbol(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (s.endsWith('.NE')) return 'NEO';
  if (s.endsWith('.TO')) return 'TSX';
  if (s.endsWith('.TSX')) return 'TSX';
  if (s.endsWith('.V')) return 'TSXV';
  if (s.endsWith('.CN')) return 'CSE';
  if (s.includes('.') || s.includes(':')) return s.split(/[.:]/).pop();
  return 'US'; // NYSE/NASDAQ — Finnhub /search doesn't disambiguate without an extra call
}

function toRecord(result) {
  if (!result) return null;
  const symbol = String(result.symbol || '').toUpperCase();
  return {
    symbol,
    displaySymbol: String(result.displaySymbol || symbol).toUpperCase(),
    exchange: exchangeFromSymbol(symbol),
    description: result.description || '',
  };
}

// Pick the best result per category. Prefers exact symbol matches (no extra
// suffix beyond the standard exchange suffix) over weird derivatives.
function pickBest(results, underlying, category) {
  const candidates = results.filter(r => classifyResult(r, underlying) === category);
  if (!candidates.length) return null;
  // Prefer the shortest symbol (simplest listing).
  candidates.sort((a, b) => String(a.symbol).length - String(b.symbol).length);
  return toRecord(candidates[0]);
}

async function resolveFromFinnhub(underlying) {
  const results = await searchSymbols(underlying);
  if (!Array.isArray(results) || results.length === 0) return null;
  const us = pickBest(results, underlying, 'us');
  const tsx = pickBest(results, underlying, 'tsx');
  const cdr = pickBest(results, underlying, 'cdr');
  if (cdr) cdr.currency = 'CAD';
  if (tsx) tsx.currency = 'CAD';
  if (us) us.currency = 'USD';
  return {
    us, tsx, cdr,
    resolvedAt: new Date().toISOString(),
    source: 'finnhub',
  };
}

// Resolve listings for one underlying ticker.
// Returns the verified record, or null if Finnhub is unreachable AND no cache
// entry exists. Caller decides what to do with null (typically: queue for
// manual resolution in the import review step).
export async function resolveListings(underlyingTicker) {
  const underlying = normalize(underlyingTicker);
  if (!underlying) return null;

  const cache = readCache();
  const cached = cache[underlying];
  if (isFresh(cached)) return cached;

  try {
    const fresh = await resolveFromFinnhub(underlying);
    if (fresh) {
      cache[underlying] = fresh;
      writeCache(cache);
      return fresh;
    }
  } catch (err) {
    console.warn(`[listingResolver] Finnhub lookup failed for ${underlying}:`, err?.message || err);
  }

  // Stale cache is better than nothing.
  if (cached) return cached;
  return null;
}

// Resolve listings for many underlyings in parallel. Returns
// { [underlying]: record | null }. Never throws.
export async function resolveManyListings(underlyings) {
  const unique = [...new Set((underlyings || []).map(normalize).filter(Boolean))];
  const out = {};
  await Promise.all(unique.map(async u => {
    out[u] = await resolveListings(u);
  }));
  return out;
}

// Manual override — writes a verified record from the user. Used when Finnhub
// is unreachable or a row truly needs human disambiguation. Manual entries
// never expire and take precedence over later Finnhub fetches.
export function setManualListing(underlyingTicker, record) {
  const underlying = normalize(underlyingTicker);
  if (!underlying || !record) return;
  const cache = readCache();
  cache[underlying] = {
    ...record,
    resolvedAt: new Date().toISOString(),
    source: 'manual',
  };
  writeCache(cache);
}

// Hint to the resolver that an underlying probably has a CDR even if Finnhub
// hasn't been queried yet. Used by the importer to decide whether a CDR
// disambiguation is plausible before doing the network round-trip.
export function probablyHasCDR(underlyingTicker) {
  return mayHaveCDR(underlyingTicker);
}

export function clearListingCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
