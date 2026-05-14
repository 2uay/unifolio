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
  const text = `${row.name || row.asset_name || ''} ${row.notes || ''} ${row.description || ''}`;
  // Primary signal: explicit "CDR" or "Canadian Depositary Receipt" in the name.
  // Secondary signals (Wealthsimple/Questrade variants): "(CAD Hedged)",
  // "CIBC Canadian Depositary Receipts", or "(CAD)" suffix on a US-listed name.
  return /\bCDR\b|CANADIAN DEPOSITARY RECEIPT|CIBC\s+(CANADIAN\s+)?DEPOSITARY|\(CAD\s*HEDGED\)|HEDGED\s*CDR/i.test(text);
}

function normalizeExchange(value) {
  const exch = upper(value);
  if (!exch) return '';
  if (/NEO|CBOE\s*CANADA/.test(exch)) return 'NEO';
  if (/TSX|TORONTO|XTSE/.test(exch)) return 'TSX';
  if (/TSXV|VENTURE/.test(exch)) return 'TSXV';
  if (/CSE|CNSX|XCNQ/.test(exch)) return 'CSE';
  if (/NASDAQ|XNAS/.test(exch)) return 'NASDAQ';
  if (/NYSE|XNYS|ARCA|NYSEARCA/.test(exch)) return 'NYSE';
  if (/BATS|BATY/.test(exch)) return 'BATS';
  if (/IEX|XIEX/.test(exch)) return 'IEX';
  if (/AMEX|XASE/.test(exch)) return 'AMEX';
  return exch;
}

// Listing exchange → canonical trading currency. The most reliable source of
// truth: NASDAQ-listed = USD, regardless of what the broker row says. This
// catches the IBKR/Wealthsimple bug where a USD security held in a CAD-base
// account inherits the account's base currency on its row.
const US_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'NYSEARCA', 'ARCA', 'BATS', 'IEX', 'AMEX']);
const CA_EXCHANGES = new Set(['TSX', 'NEO', 'TSXV', 'CSE']);
function currencyForExchange(exchange) {
  const exch = upper(exchange);
  if (US_EXCHANGES.has(exch)) return 'USD';
  if (CA_EXCHANGES.has(exch)) return 'CAD';
  return null;
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
    // Trust the listing exchange over the broker's row-level currency tag.
    // IBKR/Wealthsimple often emit `account.currency` (CAD-base account) on
    // POST/TRFR rows for USD-listed securities when CurrencyPrimary is blank.
    // The exchange is the unambiguous source of truth — NASDAQ = USD, full
    // stop. Only fall back to the row's currency for exchanges we don't
    // recognize (e.g. LSE, JPX, etc.).
    const exchangeImpliedCurrency = currencyForExchange(exch);
    const finalCurrency = exchangeImpliedCurrency || currency;
    return makeIdentity({
      ticker,
      underlying: baseTicker,
      exchange: exch,
      currency: finalCurrency,
      identity: isCdr ? 'cdr' : (isTsxNative ? 'tsx' : 'us'),
      quoteSymbol: ticker,
      display: ticker,
      confidence: 'high',
      reason: exchangeImpliedCurrency && currency && exchangeImpliedCurrency !== currency
        ? `Broker said ${exch} ${currency}; corrected to ${exch} ${exchangeImpliedCurrency} (exchange listing currency).`
        : 'Broker statement specifies listing exchange and currency',
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
  // Force the row's `currency` field to match the resolved listing_currency
  // when the resolver corrected it (e.g. NASDAQ → USD over a broker's
  // CAD-account-base tag). Downstream callers read `row.currency` directly
  // (transactionEngine grouping, importPersistence column writes), so just
  // spreading `resolved` isn't enough — the original `currency` field would
  // otherwise leak through.
  const finalCurrency = resolved.listing_currency || row.currency;
  return {
    ...row,
    ...resolved,
    currency: finalCurrency,
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

// ─── Dual-listing detection ───────────────────────────────────────────
//
// When a single import contains BOTH the underlying (US listing) AND the CDR
// of the same security — e.g. some "Eli Lilly" rows and some "Eli Lilly CDR"
// rows in one Wealthsimple file — we want to:
//   1. Confirm the parser auto-classified each row by its name (it does).
//   2. Surface the split to the user so they can verify or remap individual
//      rows that the parser got wrong (rare but possible if WS used the same
//      name field for both listings).
//
// Returns one entry per underlying that has 2+ distinct identities present:
//   { underlying, totalRows, buckets: [{ identity, rows: [{ id, ticker, name, date, qty }], ... }] }
export function buildDualListingGroups(rows = []) {
  const byUnderlying = new Map();
  rows.filter(r => r?.ticker).forEach(row => {
    const underlying = cleanTicker(row.underlying_ticker || stripExchangeSuffix(row.ticker));
    if (!underlying) return;
    if (!byUnderlying.has(underlying)) byUnderlying.set(underlying, []);
    byUnderlying.get(underlying).push(row);
  });
  const groups = [];
  byUnderlying.forEach((rs, underlying) => {
    const identities = new Set(rs.map(r => r.security_identity).filter(Boolean));
    if (identities.size < 2) return; // Only one listing — no dual case.
    const buckets = [...identities].map(identity => {
      const bucket = rs.filter(r => r.security_identity === identity);
      return {
        identity,
        display_ticker: bucket[0].display_ticker,
        listing_exchange: bucket[0].listing_exchange,
        listing_currency: bucket[0].listing_currency,
        security_key: bucket[0].security_key,
        quote_symbol: bucket[0].quote_symbol,
        rowCount: bucket.length,
        rows: bucket.map(r => ({
          id: r.id || r.tradeId || r.transaction_id,
          ticker: r.ticker,
          name: r.name || r.asset_name,
          date: r.date,
          quantity: r.quantity,
          price: r.price,
          type: r.type || r.transaction_type,
          security_identity: r.security_identity,
        })),
      };
    });
    groups.push({
      id: `dual::${underlying}`,
      underlying,
      totalRows: rs.length,
      buckets,
    });
  });
  return groups;
}

// Re-classify a single row by id to a target identity. Used by the dual-listing
// override UI to flip individual mis-classified rows.
export function reassignRowIdentity(row, targetIdentity) {
  const underlying = cleanTicker(row.underlying_ticker || stripExchangeSuffix(row.ticker));
  if (targetIdentity === 'cdr') {
    return {
      ...row,
      security_key: buildKey({ underlying, exchange: 'NEO', currency: 'CAD' }),
      display_ticker: `${underlying} CDR`,
      ticker: `${underlying} CDR`,
      quote_symbol: `${underlying}.NE`,
      listing_exchange: 'NEO',
      listing_currency: 'CAD',
      currency: 'CAD',
      security_identity: 'cdr',
      identity_confidence: 'confirmed',
      identity_reason: 'User reassigned during import review',
      _needs_verification: false,
    };
  }
  if (targetIdentity === 'tsx') {
    return {
      ...row,
      security_key: buildKey({ underlying, exchange: 'TSX', currency: 'CAD' }),
      display_ticker: `${underlying}.TO`,
      ticker: `${underlying}.TO`,
      quote_symbol: `${underlying}.TO`,
      listing_exchange: 'TSX',
      listing_currency: 'CAD',
      currency: 'CAD',
      security_identity: 'tsx',
      identity_confidence: 'confirmed',
      identity_reason: 'User reassigned during import review',
      _needs_verification: false,
    };
  }
  // default 'us'
  return {
    ...row,
    security_key: buildKey({ underlying, exchange: 'NASDAQ/NYSE', currency: 'USD' }),
    display_ticker: underlying,
    ticker: underlying,
    quote_symbol: underlying,
    listing_exchange: 'NASDAQ/NYSE',
    listing_currency: 'USD',
    currency: 'USD',
    security_identity: 'us',
    identity_confidence: 'confirmed',
    identity_reason: 'User reassigned during import review',
    _needs_verification: false,
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
