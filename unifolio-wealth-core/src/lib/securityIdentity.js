import { safeNumber } from '@/lib/safeNum';

const CDR_EXCHANGE = 'NEO';

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function cleanTicker(value) {
  return upper(value).replace(/\s+/g, '');
}

function hasCdrText(row = {}) {
  return /\bCDR\b|CANADIAN DEPOSITARY RECEIPT/i.test(`${row.name || row.asset_name || ''} ${row.notes || ''}`);
}

function stripCdrSuffix(ticker) {
  return cleanTicker(ticker).replace(/(\.NE|\.TO|:TSX)$/i, '').replace(/CDR$/i, '');
}

function candidateFor(row = {}) {
  const ticker = cleanTicker(row.ticker);
  const currency = upper(row.currency || row.listing_currency);
  const name = String(row.name || row.asset_name || ticker);
  const price = safeNumber(row.price ?? row.current_price ?? row.lastPrice ?? row.avgPrice ?? row.average_price);
  const cdr = hasCdrText(row);
  const baseTicker = stripCdrSuffix(ticker);

  if (!ticker) {
    return {
      security_key: '',
      display_ticker: '',
      quote_symbol: '',
      listing_exchange: '',
      listing_currency: currency || 'USD',
      underlying_ticker: '',
      security_identity: 'unknown',
      identity_confidence: 'low',
      identity_reason: 'Missing ticker',
    };
  }

  if (cdr) {
    return {
      security_key: `${baseTicker}.CDR:${currency || 'CAD'}`,
      display_ticker: `${baseTicker} CDR`,
      quote_symbol: `${baseTicker}.NE`,
      listing_exchange: CDR_EXCHANGE,
      listing_currency: currency || 'CAD',
      underlying_ticker: baseTicker,
      security_identity: 'cdr',
      identity_confidence: 'high',
      identity_reason: 'Name or notes identify this as a CDR',
    };
  }

  if (ticker.endsWith('.TO') || ticker.endsWith('.TSX')) {
    return {
      security_key: `${ticker.replace('.TSX', '.TO')}:CAD`,
      display_ticker: ticker.replace('.TSX', '.TO'),
      quote_symbol: ticker.replace('.TSX', '.TO'),
      listing_exchange: 'TSX',
      listing_currency: currency || 'CAD',
      underlying_ticker: baseTicker,
      security_identity: 'tsx',
      identity_confidence: 'high',
      identity_reason: 'Ticker has a Canadian exchange suffix',
    };
  }

  if (ticker.endsWith('.NE')) {
    return {
      security_key: `${ticker}:CAD`,
      display_ticker: `${baseTicker} CDR`,
      quote_symbol: ticker,
      listing_exchange: CDR_EXCHANGE,
      listing_currency: currency || 'CAD',
      underlying_ticker: baseTicker,
      security_identity: 'cdr',
      identity_confidence: 'high',
      identity_reason: 'Ticker has a NEO CDR suffix',
    };
  }

  if (currency === 'CAD' && price > 0 && price < 125) {
    return {
      security_key: `${baseTicker}.CDR:CAD`,
      display_ticker: `${baseTicker} CDR`,
      quote_symbol: `${baseTicker}.NE`,
      listing_exchange: CDR_EXCHANGE,
      listing_currency: 'CAD',
      underlying_ticker: baseTicker,
      security_identity: 'cdr_candidate',
      identity_confidence: 'medium',
      identity_reason: 'CAD security with a low per-share price may be a CDR',
    };
  }

  if (currency === 'CAD') {
    return {
      security_key: `${baseTicker}.TO:CAD`,
      display_ticker: `${baseTicker}.TO`,
      quote_symbol: `${baseTicker}.TO`,
      listing_exchange: 'TSX',
      listing_currency: 'CAD',
      underlying_ticker: baseTicker,
      security_identity: 'tsx_candidate',
      identity_confidence: 'medium',
      identity_reason: 'CAD security without CDR wording is treated as Canadian-listed until reviewed',
    };
  }

  return {
    security_key: `${baseTicker}:USD`,
    display_ticker: baseTicker,
    quote_symbol: baseTicker,
    listing_exchange: 'NASDAQ/NYSE',
    listing_currency: currency || 'USD',
    underlying_ticker: baseTicker,
    security_identity: 'us',
    identity_confidence: currency === 'USD' ? 'high' : 'medium',
    identity_reason: currency === 'USD' ? 'USD security resolves to the US listing' : 'No Canadian listing evidence found',
  };
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

export function securityKey(row = {}) {
  return row.security_key || row.securityKey || `${cleanTicker(row.ticker)}:${upper(row.currency || 'USD')}`;
}

export function displayTicker(row = {}) {
  return row.display_ticker || row.displayTicker || row.ticker || '';
}

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
    const uniqueSecurityKeys = [...new Set(groupRows.map(securityKey).filter(Boolean))];
    const hasMedium = groupRows.some(row => row.identity_confidence === 'medium' || row.identity_confidence === 'low');
    if (uniqueSecurityKeys.length <= 1 && !hasMedium) return [];
    const sample = groupRows[0] || {};
    return [{
      id: groupId,
      account: sample.account || sample.account_id || sample.accountId || '',
      rawTicker: sample.raw_ticker || sample.underlying_ticker || sample.ticker,
      rows: groupRows.map(row => row.id || row.tradeId).filter(Boolean),
      candidates: uniqueSecurityKeys.map(key => {
        const row = groupRows.find(item => securityKey(item) === key) || {};
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
      }),
    }];
  });
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
  };
}
