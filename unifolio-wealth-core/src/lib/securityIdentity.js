import { safeNumber } from '@/lib/safeNum';
import { mayHaveCDR } from '@/lib/cdrRegistry';
import { resolveManyListings } from '@/lib/listingResolver';

// Two-phase identity resolution.
//
// Phase 1 — sync `resolveSecurityIdentity(row)`: produces a candidate identity
// from only what the broker row carries. IBKR rows arrive with conid +
// listingExchange and are resolved at high confidence here. Wealthsimple rows
// often arrive with just (symbol, currency, name) and are resolved at medium
// confidence with `_needs_verification: true`.
//
// Phase 2 — async `verifyIdentities(rows)`: for every row flagged as needing
// verification, batches Finnhub `/search` lookups via listingResolver and
// upgrades the row to a verified identity. Rows where Finnhub returns no
// matching listing are surfaced via `buildSecurityAmbiguities()` so the user
// can resolve them manually in the Import Center.
//
// Hard rules — the resolver NEVER:
//   • invents an exchange ("price < $125 ⇒ .NE CDR" — gone).
//   • assumes CAD-priced ⇒ TSX without verification (NVO has no CDR; if a
//     Wealthsimple row says "NVO, CAD, $X" it is unverifiable, not a CDR).
//   • collapses two listings of the same underlying into one. LLY (NYSE, USD)
//     and LLY-CDR (TSX, CAD) get distinct security_keys and remain two rows.
//
// `underlying_ticker` is always set to the bare US symbol regardless of which
// listing the row represents. This is the join key that lets a future
// "consolidated exposure" view aggregate LLY-USD + LLY-CDR-CAD across FX into
// a single Eli Lilly position.

const CDR_EXCHANGE_DEFAULT = 'NEO';

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function cleanTicker(value) {
  return upper(value).replace(/\s+/g, '');
}

function stripExchangeSuffix(ticker) {
  return cleanTicker(ticker).replace(/(\.NE|\.NEO|\.TO|\.TSX|:TSX|:NEO)$/i, '').replace(/\s*CDR$/i, '');
}

function hasCdrText(row = {}) {
  return /\bCDR\b|CANADIAN DEPOSITARY RECEIPT/i.test(`${row.name || row.asset_name || ''} ${row.notes || ''}`);
}

function normalizeExchange(value) {
  const exch = upper(value);
  if (!exch) return '';
  if (/NEO|CBOE\s*CANADA/.test(exch)) return 'NEO';
  if (/TSX|TORONTO|XTSE/.test(exch)) return 'TSX';
  if (/NASDAQ|XNAS/.test(exch)) return 'NASDAQ';
  if (/NYSE|XNYS|ARCA/.test(exch)) return 'NYSE';
  return exch;
}

function hasFullBrokerIdentity(row = {}) {
  const exch = row.listing_exchange || row.listingExchange || row.exchange;
  const currency = row.currency || row.listing_currency;
  const ticker = row.ticker || row.symbol;
  return Boolean(exch && currency && ticker);
}

function buildKey({ underlying, exchange, currency }) {
  return `${underlying}@${exchange || 'UNKNOWN'}:${currency || 'UNKNOWN'}`;
}

function makeIdentity({
  ticker,
  underlying,
  exchange,
  currency,
  identity,
  quoteSymbol,
  display,
  confidence,
  reason,
  needsVerification = false,
  conid = null,
}) {
  return {
    security_key: buildKey({ underlying, exchange, currency }),
    display_ticker: display || ticker || underlying,
    quote_symbol: quoteSymbol || ticker || underlying,
    listing_exchange: exchange || '',
    listing_currency: currency || '',
    underlying_ticker: underlying,
    security_identity: identity,
    identity_confidence: confidence,
    identity_reason: reason,
    conid: conid || null,
    _needs_verification: needsVerification,
  };
}

// Phase 1: best-effort identity from the row alone. Synchronous.
function candidateFor(row = {}) {
  const ticker = cleanTicker(row.ticker || row.symbol);
  const currency = upper(row.currency || row.listing_currency);
  const baseTicker = stripExchangeSuffix(ticker);

  if (!ticker) {
    return makeIdentity({
      ticker: '', underlying: '', exchange: '', currency: currency || 'USD',
      identity: 'unknown', confidence: 'low', reason: 'Missing ticker',
    });
  }

  // 1. IBKR-style row: trust broker fields verbatim, no verification needed.
  if (hasFullBrokerIdentity(row)) {
    const exch = normalizeExchange(row.listing_exchange || row.listingExchange || row.exchange);
    const isCdr = exch === 'NEO' || (exch === 'TSX' && hasCdrText(row));
    const isTsxNative = exch === 'TSX' && !isCdr;
    return makeIdentity({
      ticker,
      underlying: baseTicker,
      exchange: exch,
      currency,
      identity: isCdr ? 'cdr' : (isTsxNative ? 'tsx' : 'us'),
      quoteSymbol: ticker,
      display: ticker,
      confidence: 'high',
      reason: 'Broker statement specifies listing exchange and currency',
      conid: row.conid || row.Conid || null,
    });
  }

  // 2. Ticker carries an exchange suffix.
  if (/\.(NE|NEO)$/i.test(ticker) || /:NEO$/i.test(ticker)) {
    return makeIdentity({
      ticker, underlying: baseTicker, exchange: 'NEO', currency: currency || 'CAD',
      identity: 'cdr', quoteSymbol: `${baseTicker}.NE`, display: `${baseTicker} CDR`,
      confidence: 'high', reason: 'Ticker has a Cboe Canada CDR suffix',
    });
  }
  if (/\.(TO|TSX)$/i.test(ticker) || /:TSX$/i.test(ticker)) {
    const tsxSymbol = ticker.replace(/(\.TSX|:TSX)$/i, '.TO');
    // .TO with "CDR" in the name still means CDR — exchange just happens to be TSX
    // for the post-migration listings. Keep as CDR identity, exchange=TSX.
    const isCdr = hasCdrText(row);
    return makeIdentity({
      ticker, underlying: baseTicker, exchange: 'TSX',
      currency: currency || 'CAD',
      identity: isCdr ? 'cdr' : 'tsx',
      quoteSymbol: tsxSymbol,
      display: isCdr ? `${baseTicker} CDR` : tsxSymbol,
      confidence: 'high',
      reason: isCdr ? 'TSX-listed CDR (suffix + CDR in name)' : 'Native TSX listing (suffix)',
    });
  }

  // 3. Bare ticker — dispatch on the NAME field, not the trade currency.
  //    Wealthsimple shows `currency=CAD` for everything bought from a CAD
  //    account, even when the underlying is a US-listed stock that WS bought
  //    via FX conversion. The only reliable per-row signal is the security
  //    name: "Eli Lilly & Company" is the underlying, "Eli Lilly CDR (CAD
  //    Hedged)" is the CDR. Trade currency is meaningless for identity.

  // 3a. Name explicitly says CDR — trust it and resolve to the CDR identity
  // without any verification round-trip. We accept ANY underlying that's
  // listed in cdrRegistry; for unknown CDRs we still resolve at medium
  // confidence so downstream isn't blocked.
  if (hasCdrText(row)) {
    const isKnownCdr = mayHaveCDR(baseTicker);
    return makeIdentity({
      ticker, underlying: baseTicker, exchange: 'NEO', currency: 'CAD',
      identity: 'cdr',
      quoteSymbol: `${baseTicker}.NE`,
      display: `${baseTicker} CDR`,
      confidence: isKnownCdr ? 'high' : 'medium',
      reason: isKnownCdr
        ? 'Name explicitly identifies a known CIBC CDR'
        : 'Name says CDR — assumed Cboe Canada listing (mark for review if needed)',
      needsVerification: false,
    });
  }

  // 3b. No CDR signal in the name → it's the underlying security at its
  // native exchange. For tickers in the cdrRegistry (well-known US large-caps)
  // this is unambiguously the US listing. For other bare tickers we default
  // to US — Canadian-listed stocks typically have .TO suffixes, which were
  // already caught in step 2.
  return makeIdentity({
    ticker, underlying: baseTicker, exchange: 'NASDAQ/NYSE',
    currency: 'USD',
    identity: 'us',
    quoteSymbol: baseTicker,
    display: baseTicker,
    confidence: 'high',
    reason: currency === 'CAD'
      ? 'Bare ticker with no CDR text in name — US listing held via CAD account FX conversion'
      : (currency === 'USD'
          ? 'USD security resolves to the US listing'
          : 'Bare ticker, no CDR text — defaulting to US listing'),
    needsVerification: false,
  });
}

export function resolveSecurityIdentity(row = {}) {
  const resolved = candidateFor(row);
  return {
    ...row,
    ...resolved,
    ticker: resolved.display_ticker || row.ticker,
    raw_ticker: row.raw_ticker || row.ticker || '',
  };
}

// ─── Phase 2: verification with Finnhub ────────────────────────────────

// Apply a verified-listings record to a row. Picks the listing that matches
// the row's currency (and CDR signal if present). Returns the row mutated to a
// 'confirmed' identity, or returns it unchanged with `_unresolvable: true` if
// no listing matches (caller will surface for manual entry).
function applyVerifiedListings(row, listings) {
  if (!listings) return { ...row, _unresolvable: true };
  const currency = upper(row.listing_currency || row.currency);
  const wantsCdr = row.security_identity === 'cdr' || hasCdrText(row);
  const underlying = cleanTicker(row.underlying_ticker || stripExchangeSuffix(row.ticker));

  let pick = null;
  if (currency === 'USD') {
    pick = listings.us;
  } else if (currency === 'CAD') {
    if (wantsCdr) {
      pick = listings.cdr || listings.tsx; // .TO CDR migrations classify as cdr OR tsx depending on description
    } else {
      // Bare CAD row, no CDR text. Prefer native TSX listing if it exists; if
      // only a CDR exists for this underlying, this row is most likely a CDR
      // the user mislabeled — but DO NOT silently assume. Mark unresolvable.
      if (listings.tsx) pick = listings.tsx;
      else if (listings.cdr) return { ...row, _unresolvable: true, _verification: listings };
    }
  }

  if (!pick) return { ...row, _unresolvable: true, _verification: listings };

  const identity = pick === listings.cdr ? 'cdr' : (pick === listings.tsx ? 'tsx' : 'us');
  const display = identity === 'cdr' ? `${underlying} CDR` : pick.displaySymbol || pick.symbol;
  return {
    ...row,
    security_key: buildKey({ underlying, exchange: pick.exchange, currency }),
    display_ticker: display,
    ticker: display,
    quote_symbol: pick.symbol,
    listing_exchange: pick.exchange,
    listing_currency: currency || pick.currency,
    underlying_ticker: underlying,
    security_identity: identity,
    identity_confidence: 'confirmed',
    identity_reason: `Verified via Finnhub (${pick.symbol} on ${pick.exchange})`,
    _needs_verification: false,
    _unresolvable: false,
    _verification: listings,
  };
}

// Run Finnhub verification on every row that needs it. Mutates and returns a
// new array. Rows that cannot be verified (offline, no matching listing) are
// returned with `_unresolvable: true` and should be surfaced in the import
// review step for manual resolution.
export async function verifyIdentities(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const needsVerification = rows.filter(r => r?._needs_verification);
  if (needsVerification.length === 0) return rows;

  const underlyings = [...new Set(needsVerification.map(r => cleanTicker(r.underlying_ticker || r.ticker)))];
  const verifiedMap = await resolveManyListings(underlyings);

  return rows.map(row => {
    if (!row?._needs_verification) return row;
    const underlying = cleanTicker(row.underlying_ticker || row.ticker);
    return applyVerifiedListings(row, verifiedMap[underlying]);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function securityKey(row = {}) {
  return row.security_key || row.securityKey || `${cleanTicker(row.ticker)}:${upper(row.currency || 'USD')}`;
}

export function displayTicker(row = {}) {
  return row.display_ticker || row.displayTicker || row.ticker || '';
}

// Group rows by (account, underlying) — but only return groups where the
// importer actually needs human input. After Phase 2 verification this should
// be empty in the common case.
//
// A group surfaces for review when:
//   • At least one row is `_unresolvable: true` (Finnhub returned no matching
//     listing or the resolver was unreachable), OR
//   • Two distinct security_keys for the same (account, underlying) where the
//     identity_confidence is below 'confirmed' (manual disambiguation).
function ambiguityKey(row = {}) {
  const raw = cleanTicker(row.raw_ticker || row.ticker);
  const underlying = cleanTicker(row.underlying_ticker || raw.replace(/\s*CDR$/i, ''));
  return `${row.account || row.account_id || row.accountId || ''}::${underlying || raw}`;
}

export function buildSecurityAmbiguities(rows = []) {
  const groups = new Map();
  rows.filter(row => row?.ticker).forEach(row => {
    const key = ambiguityKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  return [...groups.entries()].flatMap(([groupId, groupRows]) => {
    const hasUnresolvable = groupRows.some(r => r._unresolvable);
    const uniqueKeys = [...new Set(groupRows.map(securityKey).filter(Boolean))];
    const allConfirmed = groupRows.every(r => r.identity_confidence === 'confirmed' || r.identity_confidence === 'high');

    if (!hasUnresolvable && uniqueKeys.length <= 1 && allConfirmed) return [];

    const sample = groupRows[0] || {};
    const underlying = sample.underlying_ticker || stripExchangeSuffix(sample.ticker);
    const verification = groupRows.find(r => r._verification)?._verification;

    // Build candidate list from verified Finnhub data when available, else
    // from the row's own provisional identity. NEVER fabricate a candidate.
    const candidates = [];
    if (verification) {
      if (verification.us) candidates.push(verifiedToCandidate(underlying, verification.us, 'us'));
      if (verification.tsx) candidates.push(verifiedToCandidate(underlying, verification.tsx, 'tsx'));
      if (verification.cdr) candidates.push(verifiedToCandidate(underlying, verification.cdr, 'cdr'));
    } else {
      uniqueKeys.forEach(key => {
        const row = groupRows.find(r => securityKey(r) === key);
        if (row) candidates.push(rowToCandidate(row));
      });
    }

    return [{
      id: groupId,
      account: sample.account || sample.account_id || sample.accountId || '',
      rawTicker: sample.raw_ticker || underlying || sample.ticker,
      rows: groupRows.map(r => r.id || r.tradeId).filter(Boolean),
      underlying,
      candidates,
      verification: verification || null,
      // True when the importer cannot make a defensible auto-pick. UI should
      // require the user to choose or enter a manual identity.
      requiresManualEntry: hasUnresolvable && candidates.length === 0,
    }];
  });
}

function verifiedToCandidate(underlying, listing, identity) {
  const display = identity === 'cdr' ? `${underlying} CDR` : (listing.displaySymbol || listing.symbol);
  const exchange = listing.exchange || (identity === 'cdr' ? CDR_EXCHANGE_DEFAULT : (identity === 'tsx' ? 'TSX' : 'US'));
  const currency = listing.currency || (identity === 'us' ? 'USD' : 'CAD');
  return {
    security_key: buildKey({ underlying, exchange, currency }),
    display_ticker: display,
    quote_symbol: listing.symbol,
    listing_exchange: exchange,
    listing_currency: currency,
    security_identity: identity,
    confidence: 'verified',
    reason: `Finnhub: ${listing.description || listing.symbol}`,
    sample_price: null,
  };
}

function rowToCandidate(row) {
  return {
    security_key: securityKey(row),
    display_ticker: displayTicker(row),
    quote_symbol: row.quote_symbol || displayTicker(row),
    listing_exchange: row.listing_exchange || row.exchange || '',
    listing_currency: row.listing_currency || row.currency || '',
    security_identity: row.security_identity || '',
    confidence: row.identity_confidence || 'medium',
    reason: row.identity_reason || '',
    sample_price: safeNumber(row.price ?? row.current_price ?? row.avgPrice),
  };
}

export function applySecurityChoice(row = {}, choice = {}) {
  if (!choice?.security_key) return row;
  return {
    ...row,
    security_key: choice.security_key,
    display_ticker: choice.display_ticker || row.display_ticker || row.ticker,
    ticker: choice.display_ticker || row.ticker,
    quote_symbol: choice.quote_symbol || row.quote_symbol,
    listing_exchange: choice.listing_exchange || row.listing_exchange,
    listing_currency: choice.listing_currency || row.listing_currency || row.currency,
    security_identity: choice.security_identity || row.security_identity || 'manual',
    identity_confidence: 'confirmed',
    identity_reason: 'Confirmed during import review',
    _needs_verification: false,
    _unresolvable: false,
  };
}
