// ============================================================
// Unifolio CSV Parser
// Parses uploaded broker CSV/TSV files, detects broker format,
// auto-maps columns, validates rows, and returns normalized data.
// ============================================================

import { buildSecurityAmbiguities, resolveSecurityIdentity, securityKey, verifyIdentities } from '@/lib/securityIdentity';

// ─── RAW CSV PARSING ──────────────────────────────────────────

export function parseCSVText(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(parseCSVLine(line));
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── BROKER DETECTION ─────────────────────────────────────────

const BROKER_SIGNATURES = {
  wealthsimple_holdings: ['account_id', 'account_type', 'symbol', 'quantity'],
  wealthsimple_activity: ['transaction_date', 'activity_type', 'activity_sub_type', 'net_cash_amount'],
  wealthsimple: ['activity type', 'account currency', 'net amount'],
  ibkr: ['asset category', 'financial instrument', 'trade date', 'execution price'],
  ibkr_flex: ['tradeid', 'accountid', 'assetcategory', 'symbol', 'tradeprice'],
  questrade: ['activity type', 'settlement date', 'gross amount'],
  unifolio: ['settlement date', 'institution', 'account type', 'ticker', 'asset name'],
  unifolio_holdings: ['institution', 'account', 'account type', 'ticker', 'market value', 'average price'],
  td: ['account number', 'transaction type', 'security name'],
  generic: [],
};

export function detectBroker(headers) {
  const normalized = headers.map(h => h.toLowerCase().trim());

  if (['transaction_date', 'account_id', 'account_type', 'activity_type', 'activity_sub_type', 'net_cash_amount'].every(h => normalized.includes(h))) return 'wealthsimple_activity';
  if (['account_id', 'account_type', 'symbol', 'quantity'].every(h => normalized.includes(h))
    && normalized.some(h => /market|value|price|book|cost/.test(h))) return 'wealthsimple_holdings';
  if (normalized.includes('tradeid') || normalized.includes('trade id') || normalized.includes('ibkr trade id')) return 'ibkr_flex';
  if (normalized.includes('asset category') && normalized.includes('symbol') && normalized.includes('trade price')) return 'ibkr';
  if (normalized.includes('average price') && normalized.includes('market value') && normalized.includes('account type') && !normalized.includes('date')) return 'unifolio_holdings';
  if (normalized.includes('settlement date') && normalized.includes('institution') && normalized.includes('asset name')) return 'unifolio';
  if (normalized.includes('activity type') && normalized.includes('account currency')) return 'wealthsimple';
  if (normalized.includes('activity type') && normalized.includes('gross amount')) return 'questrade';
  if (normalized.includes('account number') && normalized.includes('security name')) return 'td';
  return 'generic';
}

// ─── COLUMN MAPPING ───────────────────────────────────────────

// Returns a map from Unifolio field → detected CSV header index
export function autoMapColumns(headers, broker) {
  const normalized = headers.map(h => h.toLowerCase().trim());
  const find = (...candidates) => {
    for (const c of candidates) {
      const idx = normalized.findIndex(h => h.includes(c.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const maps = {
    unifolio: {
      date: find('date'),
      settlementDate: find('settlement date'),
      institution: find('institution'),
      account: find('account'),
      accountType: find('account type'),
      type: find('type', 'activity type', 'transaction type'),
      ticker: find('ticker', 'symbol'),
      name: find('asset name', 'name', 'description', 'security name'),
      assetClass: find('asset class', 'asset category'),
      quantity: find('quantity', 'qty', 'shares'),
      price: find('price', 'trade price', 'execution price'),
      grossAmount: find('gross amount'),
      fees: find('fees', 'commission', 'taxes'),
      netAmount: find('net amount'),
      currency: find('currency'),
      costBasis: find('cost basis'),
      proceeds: find('proceeds'),
      realizedGL: find('realized g/l', 'realized p/l', 'realized gain'),
      notes: find('notes'),
    },
    unifolio_holdings: {
      institution: find('institution'),
      account: find('account'),
      accountType: find('account type'),
      ticker: find('ticker'),
      name: find('asset name', 'name'),
      assetClass: find('asset class'),
      quantity: find('quantity'),
      price: find('price'),
      marketValue: find('market value'),
      currency: find('currency'),
      costBasis: find('cost basis'),
      avgPrice: find('average price', 'avg price'),
    },
    ibkr: {
      date: find('trade date', 'date/time', 'date'),
      type: find('buy/sell', 'activity type'),
      ticker: find('symbol'),
      name: find('description', 'financial instrument'),
      assetClass: find('asset category'),
      quantity: find('quantity'),
      price: find('trade price', 'price'),
      grossAmount: find('proceeds'),
      fees: find('commission', 'taxes'),
      currency: find('currency'),
      costBasis: find('cost basis'),
      realizedGL: find('realized p/l', 'realized gain/loss'),
    },
    ibkr_flex: {
      date: find('tradedate', 'settledate', 'date'),
      type: find('buysell', 'activitycode'),
      ticker: find('symbol'),
      name: find('description', 'longname'),
      assetClass: find('assetcategory'),
      quantity: find('quantity'),
      price: find('tradeprice', 'price'),
      grossAmount: find('proceeds'),
      fees: find('commission', 'taxes'),
      currency: find('currency'),
      account: find('accountid', 'account'),
      costBasis: find('costbasis'),
      realizedGL: find('fifopnlrealized', 'realizedpl'),
    },
    wealthsimple: {
      date: find('transaction_date', 'date'),
      settlementDate: find('settlement_date', 'settlement date'),
      type: find('activity type', 'type'),
      ticker: find('ticker', 'symbol'),
      name: find('name', 'security name'),
      quantity: find('quantity', 'qty'),
      price: find('unit_price', 'price'),
      grossAmount: find('gross amount', 'amount'),
      fees: find('commission', 'fees'),
      netAmount: find('net_cash_amount', 'net amount'),
      currency: find('account currency', 'currency'),
      account: find('account_id', 'account'),
      accountType: find('account_type'),
    },
    wealthsimple_holdings: {
      account: find('account_id', 'account'),
      accountType: find('account_type', 'account type'),
      ticker: find('symbol', 'ticker'),
      name: find('name', 'security name', 'description'),
      assetClass: find('asset_class', 'asset class', 'security type'),
      quantity: find('quantity', 'qty', 'shares'),
      price: find('current_price', 'market price', 'price', 'unit_price'),
      marketValue: find('market_value', 'market value', 'current_value', 'current value', 'value'),
      // Wealthsimple holdings exports both an "account currency" (always CAD
      // for a TFSA) and a "Market Price Currency" / "Market Value Currency"
      // (the security's native trading currency, e.g. USD for VOO held in a
      // CAD TFSA via WS's FX conversion). The latter is the source of truth
      // for security identity; the former is just the account's home cash.
      currency: find('market price currency', 'market value currency', 'currency', 'account currency'),
      // Real exchange + MIC are present in WS holdings exports — capture them
      // so we don't have to guess from the name field.
      exchange: find('exchange', 'listing exchange', 'mic'),
      listingExchange: find('exchange', 'listing exchange'),
      mic: find('mic'),
      costBasis: find('book_value', 'book value', 'cost basis', 'cost'),
      avgPrice: find('average_price', 'average price', 'avg price', 'book price'),
    },
    wealthsimple_activity: {
      date: find('transaction_date'),
      settlementDate: find('settlement_date'),
      account: find('account_id'),
      accountType: find('account_type'),
      type: find('activity_type'),
      subType: find('activity_sub_type'),
      direction: find('direction'),
      ticker: find('symbol'),
      name: find('name'),
      currency: find('currency'),
      quantity: find('quantity'),
      price: find('unit_price'),
      fees: find('commission'),
      netAmount: find('net_cash_amount'),
    },
    questrade: {
      date: find('trade date', 'date'),
      settlementDate: find('settlement date'),
      type: find('activity type', 'transaction type'),
      ticker: find('symbol', 'ticker'),
      name: find('description', 'security name'),
      quantity: find('quantity', 'qty'),
      price: find('price'),
      grossAmount: find('gross amount'),
      fees: find('commission'),
      netAmount: find('net amount'),
      currency: find('currency'),
      account: find('account number', 'account'),
    },
    td: {
      date: find('date', 'trade date'),
      type: find('transaction type', 'activity type'),
      ticker: find('symbol', 'ticker'),
      name: find('security name', 'description'),
      quantity: find('quantity', 'qty'),
      price: find('price'),
      grossAmount: find('amount', 'gross amount'),
      fees: find('commission', 'fees'),
      currency: find('currency'),
      account: find('account number', 'account'),
    },
  };

  return maps[broker] || maps.generic || maps.unifolio;
}

// ─── ROW NORMALIZATION ────────────────────────────────────────

function txnType(raw) {
  const v = (raw || '').toLowerCase().trim();
  if (['position transfer', 'asset transfer', 'security transfer', 'transfer of positions', 'transfer position'].some(k => v.includes(k))) return 'Position Transfer';
  if (['transfer in', 'tfr in', 'xfer in', 'inbound transfer'].some(k => v.includes(k))) return 'Transfer In';
  if (['transfer out', 'tfr out', 'xfer out', 'outbound transfer'].some(k => v.includes(k))) return 'Transfer Out';
  if (['buy', 'b', 'purchased', 'purchase'].some(k => v.includes(k))) return 'Buy';
  if (['sell', 's', 'sold', 'sale'].some(k => v.includes(k))) return 'Sell';
  if (['div', 'dividend', 'divend'].some(k => v.includes(k))) return 'Dividend';
  if (['dep', 'deposit', 'contribution', 'cash in'].some(k => v.includes(k))) return 'Deposit';
  if (['withdrawal', 'withdraw', 'cash out'].some(k => v.includes(k))) return 'Withdrawal';
  if (['interest', 'int'].some(k => v.includes(k))) return 'Interest';
  if (['fee', 'admin fee', 'management fee'].some(k => v.includes(k))) return 'Fee';
  if (['split', 'stock split'].some(k => v.includes(k))) return 'Stock Split';
  if (['fx', 'currency conversion', 'exchange'].some(k => v.includes(k))) return 'Currency Conversion';
  return raw || 'Unknown';
}

function transferDirection(type) {
  if (type === 'Transfer In' || type === 'Deposit') return 'in';
  if (type === 'Transfer Out' || type === 'Withdrawal') return 'out';
  return '';
}

function getCell(row, map, field) {
  const idx = map[field];
  if (idx === undefined || idx === -1) return '';
  return (row[idx] || '').trim();
}

function parseNum(s) {
  if (!s) return 0;
  const raw = String(s).trim();
  const isNegative = raw.startsWith('(') && raw.endsWith(')');
  const cleaned = raw.replace(/[($,\s)]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return isNegative ? -n : n;
}

function parseDate(s) {
  if (!s) return null;
  // Try ISO first
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  // Try DD/MM/YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 1000) return new Date(c, b - 1, a).toISOString().slice(0, 10);
    if (a > 1000) return new Date(a, b - 1, c).toISOString().slice(0, 10);
  }
  return null;
}

export function parseRows(rows, headers, columnMap) {
  const valid = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = getCell(row, columnMap, 'date');
    const rawTicker = getCell(row, columnMap, 'ticker');
    const rawQty = getCell(row, columnMap, 'quantity');
    const rawPrice = getCell(row, columnMap, 'price');
    const rawType = getCell(row, columnMap, 'type');

    const rowErrors = [];
    const date = parseDate(rawDate);
    if (!date && rawDate) rowErrors.push('Invalid date format');

    const ticker = rawTicker.toUpperCase().replace(/\s+/g, '');
    const quantity = parseNum(rawQty);
    const price = parseNum(rawPrice);
    const type = txnType(rawType);

    // Skip IBKR/broker header-continuation rows
    if (row[0] === headers[0]) continue;
    // Skip completely empty meaningful rows
    if (!ticker && !rawDate && quantity === 0) continue;

    const record = {
      date: date || rawDate,
      type,
      ticker: ticker || null,
      name: getCell(row, columnMap, 'name') || ticker,
      assetClass: getCell(row, columnMap, 'assetClass') || 'Equity',
      quantity,
      price,
      grossAmount: parseNum(getCell(row, columnMap, 'grossAmount')),
      fees: parseNum(getCell(row, columnMap, 'fees')),
      netAmount: parseNum(getCell(row, columnMap, 'netAmount')),
      currency: (getCell(row, columnMap, 'currency') || 'USD').toUpperCase(),
      account: getCell(row, columnMap, 'account') || '',
      accountType: getCell(row, columnMap, 'accountType') || '',
      institution: getCell(row, columnMap, 'institution') || '',
      costBasis: parseNum(getCell(row, columnMap, 'costBasis')),
      proceeds: parseNum(getCell(row, columnMap, 'proceeds')),
      realizedGL: parseNum(getCell(row, columnMap, 'realizedGL')),
      notes: getCell(row, columnMap, 'notes') || '',
    };

    if (rowErrors.length > 0) {
      errors.push({ rowIndex: i, row: record, errors: rowErrors });
    } else {
      valid.push(resolveSecurityIdentity(record));
    }
  }

  return { valid, errors };
}

// ─── HOLDINGS PARSING ─────────────────────────────────────────

export function parseHoldingsRows(rows, headers, columnMap) {
  const valid = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawTicker = getCell(row, columnMap, 'ticker');
    const rawQty = getCell(row, columnMap, 'quantity');
    const rawPrice = getCell(row, columnMap, 'price');

    if (!rawTicker) continue;

    const ticker = rawTicker.toUpperCase().trim();
    const quantity = parseNum(rawQty);
    const price = parseNum(rawPrice);
    const avgPrice = parseNum(getCell(row, columnMap, 'avgPrice')) || price;
    const marketValue = parseNum(getCell(row, columnMap, 'marketValue')) || quantity * price;
    const costBasis = parseNum(getCell(row, columnMap, 'costBasis')) || quantity * avgPrice;

    if (!ticker) {
      errors.push({ rowIndex: i, errors: ['Missing ticker'] });
      continue;
    }

    valid.push(resolveSecurityIdentity({
      ticker,
      name: getCell(row, columnMap, 'name') || ticker,
      assetClass: getCell(row, columnMap, 'assetClass') || 'Equity',
      quantity,
      price,
      avgPrice,
      marketValue,
      costBasis,
      currency: (getCell(row, columnMap, 'currency') || 'USD').toUpperCase(),
      account: getCell(row, columnMap, 'account') || '',
      accountType: getCell(row, columnMap, 'accountType') || '',
      institution: getCell(row, columnMap, 'institution') || '',
    }));
  }

  return { valid, errors };
}

// ─── IBKR FLEX SECTIONED REPORT PARSING ──────────────────────

function isIBKRSectionedReport(rows) {
  return rows.some(row => row[0] === 'BOF')
    && rows.some(row => row[0] === 'BOS')
    && rows.some(row => row[0] === 'HEADER')
    && rows.some(row => row[0] === 'DATA');
}

function normalizedAssetClass(value) {
  const v = (value || '').toUpperCase();
  if (v === 'STK') return 'Stock';
  if (v === 'CASH') return 'Cash';
  if (v === 'OPT') return 'Option';
  if (v === 'FUND') return 'Fund';
  if (v === 'BOND') return 'Bond';
  if (v === 'FUT') return 'Future';
  return value || 'Other';
}

function detailRow(row) {
  const level = (row.LevelOfDetail || '').toUpperCase();
  return !level || ['DETAIL', 'EXECUTION', 'SUMMARY'].includes(level);
}

function compactDate(value) {
  if (!value) return null;
  return parseDate(String(value).split(';')[0]);
}

function mapBySymbol(rows) {
  const map = {};
  rows.forEach(row => {
    const symbol = (row.Symbol || '').toUpperCase();
    if (symbol && !symbol.includes('TOTAL')) map[symbol] = row;
  });
  return map;
}

function getSectionRows(sections, code) {
  return sections[code]?.rows || [];
}

function daysBetweenDates(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function buildRealizedPositionsFromTrades(trades, account, securityBySymbol = {}, institution = 'Interactive Brokers') {
  const realized = [];
  const lotsByTicker = {};
  const sorted = [...trades]
    .filter(t => t.ticker && !String(t.ticker).includes('.') && ['Buy', 'Sell'].includes(t.type))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  sorted.forEach(trade => {
    const ticker = trade.ticker.toUpperCase();
    lotsByTicker[ticker] = lotsByTicker[ticker] || [];

    if (trade.type === 'Buy' && trade.quantity > 0) {
      lotsByTicker[ticker].push({
        date: trade.date,
        quantity: trade.quantity,
        price: trade.price,
        cost: Math.abs(trade.costBasis || trade.netAmount || trade.grossAmount || (trade.quantity * trade.price)),
      });
      return;
    }

    if (trade.type !== 'Sell') return;

    let remaining = Math.abs(trade.quantity);
    if (remaining <= 0) return;

    const matchedLots = [];
    while (remaining > 0 && lotsByTicker[ticker].length > 0) {
      const lot = lotsByTicker[ticker][0];
      const closedQty = Math.min(remaining, lot.quantity);
      matchedLots.push({
        openDate: lot.date,
        quantity: closedQty,
        buyPrice: lot.price,
        cost: closedQty * lot.price,
      });
      lot.quantity -= closedQty;
      remaining -= closedQty;
      if (lot.quantity <= 0.000001) lotsByTicker[ticker].shift();
    }

    // The TRADE's reported quantity is the source of truth for the avg_sell_price
    // denominator. matchedLots may be SHORTER than the trade qty when the
    // import file's date range cuts off prior buys (e.g. you sold 15 NVO on
    // 2026-02-02 but the file only contains 3 unmatched FIFO shares because
    // the original purchases were before the file's start date). Using the
    // matched qty as the divisor produced wrong per-share prices like
    // 868.35/3 = $289 for what was actually a $57.89 sale.
    const actualSellQty = Math.abs(trade.quantity);
    const matchedQty = matchedLots.reduce((sum, lot) => sum + lot.quantity, 0);
    const quantityClosed = actualSellQty || matchedQty;
    const matchedCostBasis = matchedLots.reduce((sum, lot) => sum + lot.cost, 0);
    const totalSaleValue = Math.abs(trade.proceeds || trade.grossAmount || (actualSellQty * trade.price));
    // For unmatched portion (no prior buy in this file), fall back to broker's
    // own CostBasis if present so cost-basis math still reconciles.
    const totalCostBasis = matchedQty < actualSellQty && trade.costBasis
      ? Math.abs(trade.costBasis)
      : (matchedCostBasis || Math.abs(trade.costBasis || 0));
    const realizedGL = trade.realizedGL || (totalSaleValue - totalCostBasis);
    const openDate = matchedLots[0]?.openDate || trade.date;
    const sec = securityBySymbol[ticker] || {};

    realized.push({
      id: `realized-${ticker}-${trade.tradeId || trade.id || trade.date}-${realized.length}`,
      account_id: trade.account,
      account: trade.account,
      accountType: trade.accountType || account.accountType,
      institution,
      ticker,
      raw_ticker: trade.raw_ticker || ticker,
      security_key: securityKey(trade),
      display_ticker: trade.display_ticker || ticker,
      quote_symbol: trade.quote_symbol || ticker,
      listing_exchange: trade.listing_exchange || sec.ListingExchange || '',
      listing_currency: trade.listing_currency || trade.currency || account.currency || 'USD',
      security_identity: trade.security_identity || '',
      identity_confidence: trade.identity_confidence || '',
      underlying_ticker: trade.underlying_ticker || ticker,
      name: trade.name || sec.Description || ticker,
      asset_class: trade.assetClass || normalizedAssetClass(sec.AssetClass),
      assetClass: trade.assetClass || normalizedAssetClass(sec.AssetClass),
      sector: 'Unknown',
      country: sec.IssuerCountryCode || '',
      exchange: sec.ListingExchange || '',
      currency: trade.currency || account.currency || 'USD',
      quantity: quantityClosed,
      // avg_buy_price and avg_sell_price both use actualSellQty as the
      // denominator so the displayed per-share prices match what the user
      // actually executed at, even when only a partial FIFO match was found.
      average_buy_price: quantityClosed ? totalCostBasis / quantityClosed : 0,
      average_sell_price: quantityClosed ? totalSaleValue / quantityClosed : trade.price,
      total_cost_basis: totalCostBasis,
      total_sale_value: totalSaleValue,
      realized_gain_loss_amount: realizedGL,
      realizedGain: realizedGL,
      realized_gain_loss_percent: totalCostBasis ? (realizedGL / totalCostBasis) * 100 : 0,
      open_date: openDate,
      close_date: trade.date,
      holding_period_days: daysBetweenDates(openDate, trade.date),
      position_status: 'Realized',
      sourceSection: trade.sourceSection,
      tradeId: trade.tradeId || trade.id || '',
    });
  });

  return realized;
}

// ─── WEALTHSIMPLE ACTIVITY EXPORT PARSING ────────────────────

function isWealthsimpleActivityReport(headers) {
  const normalized = headers.map(h => h.toLowerCase().trim());
  return ['transaction_date', 'account_id', 'account_type', 'activity_type', 'activity_sub_type', 'symbol', 'quantity', 'unit_price', 'net_cash_amount']
    .every(header => normalized.includes(header));
}

function isWealthsimpleHoldingsReport(headers) {
  const normalized = headers.map(h => h.toLowerCase().trim());
  return ['account_id', 'account_type', 'symbol', 'quantity'].every(header => normalized.includes(header))
    && normalized.some(header => /market|value|price|book|cost/.test(header));
}

function rowsToObjects(rows, headers) {
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
}

function inferAssetClass(symbol, name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('etf') || ['VOO', 'VFV', 'SCHG', 'SPRX', 'IBIT'].includes(String(symbol || '').toUpperCase())) return 'ETF';
  return 'Stock';
}

function inferWealthsimpleType(row) {
  const activity = String(row.activity_type || '').trim();
  const subType = String(row.activity_sub_type || '').trim().toUpperCase();
  const amount = parseNum(row.net_cash_amount);
  const quantity = parseNum(row.quantity);

  if (activity === 'Trade') {
    if (subType === 'BUY') return 'Buy';
    if (subType === 'SELL') return 'Sell';
  }
  if (activity === 'SecurityTransfer') return 'Position Transfer';
  if (activity === 'Dividend') return 'Dividend';
  if (activity === 'Interest') return 'Interest';
  if (activity === 'MoneyMovement') {
    if (subType.includes('TRF') || subType.includes('TRANSFER')) return amount < 0 || quantity < 0 ? 'Transfer Out' : 'Transfer In';
    if (subType.includes('EFT')) return amount < 0 || quantity < 0 ? 'Withdrawal' : 'Deposit';
    return amount < 0 || quantity < 0 ? 'Withdrawal' : 'Deposit';
  }
  return txnType(activity || subType || 'Other');
}

function cleanWsValue(value) {
  const v = String(value ?? '').trim();
  return v.toLowerCase() === 'null' ? '' : v;
}

function inferWealthsimpleAccountCurrency(accountId, rows) {
  if (String(accountId || '').toUpperCase().endsWith('CAD')) return 'CAD';
  if (String(accountId || '').toUpperCase().endsWith('USD')) return 'USD';
  const row = rows.find(r => r.account_id === accountId && String(r.currency || '').toUpperCase() === 'CAD')
    || rows.find(r => r.account_id === accountId && r.currency);
  return String(row?.currency || 'CAD').toUpperCase();
}

function parseWealthsimpleDate(value) {
  const v = cleanWsValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return parseDate(v);
}

function buildWealthsimpleTransaction(row, index) {
  const type = inferWealthsimpleType(row);
  const ticker = cleanWsValue(row.symbol).toUpperCase() || null;
  const quantityRaw = parseNum(row.quantity);
  const netAmount = parseNum(row.net_cash_amount);
  const commission = Math.abs(parseNum(row.commission));
  const isSecurityRow = Boolean(ticker);
  const unitPrice = parseNum(row.unit_price);
  const inferredTransferPrice = type === 'Position Transfer' && !unitPrice && quantityRaw
    ? Math.abs(netAmount) / Math.abs(quantityRaw)
    : unitPrice;
  const quantity = ['Dividend', 'Interest', 'Deposit', 'Withdrawal', 'Transfer In', 'Transfer Out'].includes(type) && !isSecurityRow
    ? 0
    : Math.abs(quantityRaw);
  const date = parseWealthsimpleDate(row.transaction_date);

  return resolveSecurityIdentity({
    id: `wealthsimple-${cleanWsValue(row.account_id) || 'account'}-${date || 'date'}-${index}`,
    date,
    settlementDate: parseWealthsimpleDate(row.settlement_date),
    type,
    ticker,
    name: cleanWsValue(row.name) || ticker || type,
    assetClass: isSecurityRow ? inferAssetClass(ticker, row.name) : 'Cash',
    asset_class: isSecurityRow ? inferAssetClass(ticker, row.name) : 'Cash',
    quantity,
    price: inferredTransferPrice,
    grossAmount: netAmount,
    fees: commission,
    netAmount,
    currency: String(cleanWsValue(row.currency) || 'CAD').toUpperCase(),
    account: cleanWsValue(row.account_id) || 'wealthsimple-account',
    account_id: cleanWsValue(row.account_id) || 'wealthsimple-account',
    accountType: cleanWsValue(row.account_type) || 'Brokerage',
    institution: 'Wealthsimple',
    costBasis: type === 'Buy' || type === 'Position Transfer' ? Math.abs(netAmount) : 0,
    proceeds: type === 'Sell' ? Math.abs(netAmount) : 0,
    realizedGL: 0,
    notes: [cleanWsValue(row.activity_type), cleanWsValue(row.activity_sub_type), cleanWsValue(row.direction)].filter(Boolean).join(' · '),
    sourceSection: 'WEALTHSIMPLE_ACTIVITY',
    tradeId: `ws-${row.account_id || 'account'}-${date || 'date'}-${index}`,
    transferDirection: type === 'Position Transfer'
      ? (quantityRaw < 0 || netAmount < 0 ? 'out' : 'in')
      : transferDirection(type),
    sourceAccount: '',
    destinationAccount: '',
    rawActivityType: cleanWsValue(row.activity_type),
    rawActivitySubType: cleanWsValue(row.activity_sub_type),
  });
}

function parseWealthsimpleActivityReport(dataRows, headers, filename) {
  const rawObjects = rowsToObjects(dataRows, headers)
    .map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cleanWsValue(value)])))
    .filter(row => Object.values(row).some(value => String(value || '').trim()));
  const transactions = rawObjects
    .map(buildWealthsimpleTransaction)
    .filter(row => row.date);
  const accountIds = [...new Set(transactions.map(row => row.account).filter(Boolean))];
  const first = transactions[0] || {};
  const account = {
    clientAccountId: accountIds[0] || 'wealthsimple-account',
    currency: inferWealthsimpleAccountCurrency(accountIds[0], rawObjects),
    name: 'Wealthsimple',
    accountType: first.accountType || 'Brokerage',
    country: 'CA',
  };
  const accounts = accountIds.map(id => {
    const row = transactions.find(t => t.account === id) || {};
    return {
      clientAccountId: id,
      currency: inferWealthsimpleAccountCurrency(id, rawObjects),
      name: 'Wealthsimple',
      accountType: row.accountType || 'Brokerage',
      country: 'CA',
    };
  });

  const lotsByKey = {};
  const purchaseHistoryByKey = {};
  const realizedPositions = [];
  const sorted = [...transactions]
    .filter(row => row.ticker)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)));

  const consumeLots = (key, quantity) => {
    let remaining = Math.abs(quantity);
    const matchedLots = [];
    while (remaining > 0.000001 && lotsByKey[key].length > 0) {
      const lot = lotsByKey[key][0];
      const originalQty = lot.quantity;
      const closedQty = Math.min(remaining, lot.quantity);
      const lotCost = lot.price ? closedQty * lot.price : (lot.cost * (closedQty / Math.max(originalQty, closedQty)));
      matchedLots.push({
        openDate: lot.date,
        quantity: closedQty,
        buyPrice: lot.price,
        cost: lotCost,
      });
      lot.quantity -= closedQty;
      lot.cost -= lotCost;
      remaining -= closedQty;
      if (lot.quantity <= 0.000001) lotsByKey[key].shift();
    }
    return { matchedLots, remaining };
  };

  sorted.forEach(row => {
    const key = `${row.account}::${securityKey(row)}`;
    lotsByKey[key] = lotsByKey[key] || [];
    purchaseHistoryByKey[key] = purchaseHistoryByKey[key] || [];

    if (['Buy', 'Position Transfer'].includes(row.type) && row.transferDirection !== 'out' && row.quantity > 0) {
      const price = row.price || (row.quantity ? Math.abs(row.netAmount) / row.quantity : 0);
      const cost = Math.abs(row.netAmount || row.costBasis || row.quantity * price);
      const lot = {
        date: row.date,
        quantity: row.quantity,
        originalQuantity: row.quantity,
        price,
        cost,
        originalCost: cost,
        fees: row.fees,
        currency: row.currency,
        tradeId: row.tradeId,
        sourceType: row.type,
        security_key: securityKey(row),
        display_ticker: row.display_ticker || row.ticker,
        quote_symbol: row.quote_symbol,
        sourceAccount: row.account,
      };
      lotsByKey[key].push(lot);
      purchaseHistoryByKey[key].push(lot);
      return;
    }

    if (row.type === 'Position Transfer' && row.transferDirection === 'out' && row.quantity > 0) {
      consumeLots(key, row.quantity);
      const remainingQuantity = lotsByKey[key].reduce((sum, lot) => sum + lot.quantity, 0);
      if (remainingQuantity > 0 && remainingQuantity <= 0.01) {
        lotsByKey[key] = [];
      }
      return;
    }

    if (row.type !== 'Sell' || row.quantity <= 0) return;

    const { matchedLots } = consumeLots(key, row.quantity);

    const quantityClosed = matchedLots.reduce((sum, lot) => sum + lot.quantity, 0) || row.quantity;
    const totalCostBasis = matchedLots.reduce((sum, lot) => sum + lot.cost, 0);
    const totalSaleValue = Math.abs(row.netAmount || row.proceeds || row.quantity * row.price);
    const realizedGL = totalSaleValue - totalCostBasis - Math.abs(row.fees || 0);
    const openDate = matchedLots[0]?.openDate || row.date;

    realizedPositions.push({
      id: `wealthsimple-realized-${row.account}-${row.ticker}-${row.date}-${realizedPositions.length}`,
      account_id: row.account,
      account: row.account,
      accountType: row.accountType,
      institution: 'Wealthsimple',
      ticker: row.ticker,
      raw_ticker: row.raw_ticker || row.ticker,
      security_key: securityKey(row),
      display_ticker: row.display_ticker || row.ticker,
      quote_symbol: row.quote_symbol || row.ticker,
      listing_exchange: row.listing_exchange || '',
      listing_currency: row.listing_currency || row.currency,
      security_identity: row.security_identity || '',
      identity_confidence: row.identity_confidence || '',
      underlying_ticker: row.underlying_ticker || row.ticker,
      name: row.name || row.ticker,
      asset_class: row.assetClass,
      assetClass: row.assetClass,
      sector: 'Unknown',
      country: 'CA',
      exchange: '',
      currency: row.currency,
      quantity: quantityClosed,
      average_buy_price: quantityClosed ? totalCostBasis / quantityClosed : 0,
      average_sell_price: quantityClosed ? totalSaleValue / quantityClosed : row.price,
      total_cost_basis: totalCostBasis,
      total_sale_value: totalSaleValue,
      realized_gain_loss_amount: realizedGL,
      realizedGain: realizedGL,
      realized_gain_loss_percent: totalCostBasis ? (realizedGL / totalCostBasis) * 100 : 0,
      open_date: openDate,
      close_date: row.date,
      holding_period_days: daysBetweenDates(openDate, row.date),
      position_status: 'Realized',
      sourceSection: 'WEALTHSIMPLE_ACTIVITY',
      tradeId: row.tradeId,
    });
  });

  const positions = Object.entries(lotsByKey)
    .map(([key, lots]) => {
      const [accountId, securityKeyValue] = key.split('::');
      const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
      if (Math.abs(quantity) <= 0.000001) return null;
      const costBasis = lots.reduce((sum, lot) => sum + Math.max(lot.cost || lot.quantity * lot.price, 0), 0);
      const avgPrice = quantity ? costBasis / quantity : 0;
      const source = transactions.find(row => row.account === accountId && securityKey(row) === securityKeyValue) || {};
      return {
        id: `holding-${accountId}-${securityKeyValue}`,
        ticker: source.display_ticker || source.ticker || securityKeyValue,
        raw_ticker: source.raw_ticker || source.ticker || '',
        security_key: securityKeyValue,
        display_ticker: source.display_ticker || source.ticker || securityKeyValue,
        quote_symbol: source.quote_symbol || source.ticker || securityKeyValue,
        listing_exchange: source.listing_exchange || '',
        listing_currency: source.listing_currency || source.currency || 'CAD',
        security_identity: source.security_identity || '',
        identity_confidence: source.identity_confidence || '',
        underlying_ticker: source.underlying_ticker || source.ticker || '',
        name: source.name || source.display_ticker || source.ticker || securityKeyValue,
        assetClass: source.assetClass || inferAssetClass(source.ticker, source.name),
        asset_class: source.assetClass || inferAssetClass(source.ticker, source.name),
        subCategory: '',
        quantity,
        position: quantity,
        price: avgPrice,
        current_price: avgPrice,
        lastPrice: avgPrice,
        avgPrice,
        average_price: avgPrice,
        marketValue: costBasis,
        market_value: costBasis,
        costBasis,
        cost_basis: costBasis,
        unrealizedGL: 0,
        unrealized_gain_loss_amount: 0,
        unrealizedAmt: 0,
        unrealized_gain_loss_percent: 0,
        unrealizedPct: 0,
        realizedGL: 0,
        realized_gain_loss_amount: 0,
        realizedGain: 0,
        daily_pnl_amount: 0,
        dailyPnl: 0,
        daily_pnl_percent: 0,
        dailyPct: 0,
        currency: source.currency || 'CAD',
        account: accountId,
        account_id: accountId,
        accountId: accountId,
        accountType: source.accountType || 'Brokerage',
        institution: 'Wealthsimple',
        country: 'CA',
        sector: 'Unknown',
        reportDate: transactions.map(row => row.date).filter(Boolean).sort().slice(-1)[0] || null,
        sourceSection: 'WEALTHSIMPLE_ACTIVITY_RECONSTRUCTED',
        valuation_status: 'activity_reconstructed_cost_basis',
        price_source: 'activity_cost_basis',
        purchase_history: (purchaseHistoryByKey[key] || []).map(lot => ({
          date: lot.date,
          quantity: lot.originalQuantity ?? lot.quantity,
          price: lot.price,
          fees: lot.fees,
          currency: lot.currency,
          tradeId: lot.tradeId,
          sourceType: lot.sourceType,
          sourceAccount: lot.sourceAccount,
          security_key: lot.security_key,
          display_ticker: lot.display_ticker,
          quote_symbol: lot.quote_symbol,
        })),
      };
    })
    .filter(Boolean);

  const sectionSummary = [
    { code: 'WS_ACTIVITY', name: 'Wealthsimple Activity Export', rowCount: transactions.length },
    { code: 'WS_OPEN', name: 'Reconstructed Open Holdings', rowCount: positions.length },
    { code: 'WS_REALIZED', name: 'FIFO Realized Positions', rowCount: realizedPositions.length },
  ];

  return {
    broker: 'wealthsimple_activity',
    headers: ['Account', 'Ticker', 'Quantity', 'Average Price', 'Cost Basis', 'Currency'],
    rawRows: dataRows,
    columnMap: {},
    valid: positions,
    transactions,
    errors: [],
    isHoldings: true,
    isSectioned: true,
    importBundle: {
      report: {
        name: filename || 'Wealthsimple Activity Export',
        fromDate: transactions.map(row => row.date).filter(Boolean).sort()[0] || null,
        toDate: transactions.map(row => row.date).filter(Boolean).sort().slice(-1)[0] || null,
      },
      account,
      accounts,
      positions,
      openHoldings: positions,
      realizedPositions,
      transactions,
      securityAmbiguities: buildSecurityAmbiguities([...positions, ...transactions, ...realizedPositions]),
      sectionSummary,
      securities: [],
    },
    headerRowIndex: 0,
  };
}

function parseWealthsimpleHoldingsReport(dataRows, headers, filename) {
  const columnMap = autoMapColumns(headers, 'wealthsimple_holdings');
  const { valid, errors } = parseHoldingsRows(dataRows, headers, columnMap);
  const positions = valid.map(row => {
    // The WS holdings export gives us the actual exchange (TSX/NYSE/etc.) and
    // the security's native currency. Pass them through to the resolver so it
    // takes the high-confidence "broker provided full identity" path instead
    // of guessing from the name.
    const enrichedRow = {
      ...row,
      listing_exchange: row.exchange || row.listingExchange || row.mic || row.listing_exchange,
      listing_currency: row.currency || row.listing_currency,
    };
    const resolved = resolveSecurityIdentity(enrichedRow);
    const accountId = row.account || 'wealthsimple-account';
    return {
      ...resolved,
      id: `holding-${accountId}-${securityKey(resolved)}`,
      account: accountId,
      account_id: accountId,
      accountId,
      accountType: row.accountType || 'Brokerage',
      institution: 'Wealthsimple',
      asset_class: row.assetClass || 'Stock',
      position: row.quantity,
      current_price: row.price,
      lastPrice: row.price,
      average_price: row.avgPrice,
      market_value: row.marketValue,
      cost_basis: row.costBasis,
      exchange: enrichedRow.listing_exchange,
      sourceSection: 'WEALTHSIMPLE_HOLDINGS',
      valuation_status: 'holdings_snapshot',
      price_source: 'broker_snapshot',
    };
  });
  const accountIds = [...new Set(positions.map(row => row.account).filter(Boolean))];
  const accounts = accountIds.map(id => {
    const row = positions.find(position => position.account === id) || {};
    return {
      clientAccountId: id,
      currency: row.currency || inferWealthsimpleAccountCurrency(id, []),
      name: 'Wealthsimple',
      accountType: row.accountType || 'Brokerage',
      country: 'CA',
    };
  });
  const account = accounts[0] || {
    clientAccountId: 'wealthsimple-account',
    currency: 'CAD',
    name: 'Wealthsimple',
    accountType: 'Brokerage',
    country: 'CA',
  };

  return {
    broker: 'wealthsimple_holdings',
    headers,
    rawRows: dataRows,
    columnMap,
    valid: positions,
    transactions: [],
    errors,
    isHoldings: true,
    isSectioned: true,
    importBundle: {
      report: { name: filename || 'Wealthsimple Holdings Report' },
      account,
      accounts,
      positions,
      openHoldings: positions,
      realizedPositions: [],
      transactions: [],
      securityAmbiguities: buildSecurityAmbiguities(positions),
      sectionSummary: [{ code: 'WS_HOLDINGS', name: 'Wealthsimple Holdings Report', rowCount: positions.length }],
      securities: [],
    },
    headerRowIndex: 0,
  };
}

function parseIBKRSectionedReport(allRows, filename) {
  const sections = {};
  const report = {
    accountId: allRows[0]?.[1] || '',
    name: allRows[0]?.[2] || filename || 'IBKR Flex Report',
    fromDate: allRows[0]?.[4] || null,
    toDate: allRows[0]?.[5] || null,
    generatedAt: allRows[0]?.[6] || null,
  };

  let currentCode = null;
  for (const row of allRows) {
    const marker = row[0];
    const code = row[1];
    if (marker === 'BOS') {
      currentCode = code;
      sections[currentCode] = sections[currentCode] || {
        code: currentCode,
        name: row[2] || currentCode,
        headers: [],
        rows: [],
      };
    } else if (marker === 'HEADER' && code) {
      sections[code] = sections[code] || { code, name: code, headers: [], rows: [] };
      sections[code].headers = row.slice(2);
    } else if (marker === 'DATA' && code && sections[code]?.headers?.length) {
      const obj = {};
      sections[code].headers.forEach((header, index) => {
        obj[header] = row[index + 2] ?? '';
      });
      obj._section = code;
      obj._row = row;
      sections[code].rows.push(obj);
    } else if (marker === 'EOS') {
      currentCode = null;
    }
  }

  // IBKR account-type resolution.
  //   AccountType  → broad classification (Individual, Joint, Org, ...)
  //   CustomerType → registration status (Tax-Free Savings Account, RRSP, ...)
  // CustomerType is what users actually care about (TFSA vs RRSP vs Cash) and
  // is included only when the user enables it in their Flex Query config. We
  // prefer CustomerType when present and map common labels to short names.
  const CUSTOMER_TYPE_MAP = {
    'tax-free savings account':           'TFSA',
    'registered retirement savings plan': 'RRSP',
    'registered education savings plan':  'RESP',
    'registered disability savings plan': 'RDSP',
    'first home savings account':         'FHSA',
    'locked-in retirement account':       'LIRA',
    'tax-free first home savings account':'FHSA',
    'roth ira':                           'Roth IRA',
    'traditional ira':                    'IRA',
    '401(k)':                             '401(k)',
  };
  function resolveAccountType(row) {
    const ct = String(row.CustomerType || '').trim().toLowerCase();
    if (ct && CUSTOMER_TYPE_MAP[ct]) return CUSTOMER_TYPE_MAP[ct];
    if (ct) {
      // Unknown customer type — preserve the original casing
      return String(row.CustomerType).trim();
    }
    return row.AccountType || 'Brokerage';
  }

  const accountRows = getSectionRows(sections, 'ACCT');
  const accountRow = accountRows[0] || {};
  const account = {
    clientAccountId: accountRow.ClientAccountID || report.accountId,
    currency: accountRow.CurrencyPrimary || 'USD',
    name: accountRow.Name || 'Interactive Brokers',
    accountType: resolveAccountType(accountRow),
    dateOpened: accountRow.DateOpened || null,
    country: accountRow.Country || null,
    email: accountRow.PrimaryEmail || null,
  };
  const discoveredAccountIds = [...new Set([
    ...accountRows.map(row => row.ClientAccountID),
    ...getSectionRows(sections, 'POST').map(row => row.ClientAccountID),
    ...getSectionRows(sections, 'TRNT').map(row => row.ClientAccountID),
    ...getSectionRows(sections, 'CTRN').map(row => row.ClientAccountID),
    report.accountId,
  ].filter(id => id && id !== '-'))];
  const accounts = discoveredAccountIds.map(id => {
    const row = accountRows.find(accountRow => accountRow.ClientAccountID === id) || {};
    return {
      clientAccountId: id,
      currency: row.CurrencyPrimary || account.currency || 'USD',
      name: row.Name || 'Interactive Brokers',
      accountType: resolveAccountType(row) || account.accountType || 'Brokerage',
      dateOpened: row.DateOpened || null,
      country: row.Country || account.country || null,
      email: row.PrimaryEmail || account.email || null,
    };
  });
  const accountById = Object.fromEntries(accounts.map(row => [row.clientAccountId, row]));

  const fifoBySymbol = mapBySymbol(getSectionRows(sections, 'FIFO'));
  const securityBySymbol = mapBySymbol(getSectionRows(sections, 'SECU'));

  const positions = getSectionRows(sections, 'POST')
    .filter(row => row.ClientAccountID && row.ClientAccountID !== '-' && !String(row.Symbol || '').includes('Total'))
    .filter(row => (row.LevelOfDetail || '').toUpperCase() === 'SUMMARY')
    .map(row => {
      const ticker = (row.Symbol || '').toUpperCase();
      const fifo = fifoBySymbol[ticker] || {};
      const security = securityBySymbol[ticker] || {};
      const quantity = parseNum(row.Quantity);
      const price = parseNum(row.MarkPrice);
      const avgPrice = parseNum(row.CostBasisPrice || row.OpenPrice);
      const marketValue = parseNum(row.PositionValue || row.PositionValueInBase) || quantity * price;
      const costBasis = parseNum(row.CostBasisMoney) || quantity * avgPrice;
      const realizedGL = parseNum(fifo.TotalRealizedPnl);
      return resolveSecurityIdentity({
        id: `holding-${row.ClientAccountID || account.clientAccountId}-${ticker}`,
        ticker,
        name: row.Description || security.Description || ticker,
        assetClass: normalizedAssetClass(row.AssetClass || security.AssetClass),
        asset_class: normalizedAssetClass(row.AssetClass || security.AssetClass),
        subCategory: row.SubCategory || security.SubCategory || '',
        quantity,
        position: quantity,
        price,
        current_price: price,
        lastPrice: price,
        avgPrice,
        average_price: avgPrice,
        marketValue,
        market_value: marketValue,
        costBasis,
        cost_basis: costBasis,
        unrealizedGL: parseNum(row.FifoPnlUnrealized || row.UnrealizedCapitalGainsPnl),
        unrealized_gain_loss_amount: parseNum(row.FifoPnlUnrealized || row.UnrealizedCapitalGainsPnl),
        unrealizedAmt: parseNum(row.FifoPnlUnrealized || row.UnrealizedCapitalGainsPnl),
        unrealized_gain_loss_percent: costBasis ? (parseNum(row.FifoPnlUnrealized || row.UnrealizedCapitalGainsPnl) / costBasis) * 100 : 0,
        unrealizedPct: costBasis ? (parseNum(row.FifoPnlUnrealized || row.UnrealizedCapitalGainsPnl) / costBasis) * 100 : 0,
        realizedGL,
        realized_gain_loss_amount: realizedGL,
        realizedGain: realizedGL,
        daily_pnl_amount: 0,
        dailyPnl: 0,
        daily_pnl_percent: 0,
        dailyPct: 0,
        currency: row.CurrencyPrimary || security.CurrencyPrimary || account.currency || 'USD',
        account: row.ClientAccountID || account.clientAccountId,
        account_id: row.ClientAccountID || account.clientAccountId,
        accountId: row.ClientAccountID || account.clientAccountId,
        accountType: accountById[row.ClientAccountID]?.accountType || account.accountType,
        institution: 'Interactive Brokers',
        conid: row.Conid || security.Conid || '',
        listingExchange: row.ListingExchange || security.ListingExchange || '',
        exchange: row.ListingExchange || security.ListingExchange || '',
        country: row.IssuerCountryCode || security.IssuerCountryCode || '',
        sector: 'Unknown',
        reportDate: compactDate(row.ReportDate),
        sourceSection: 'POST',
      });
    });

  const tradeRows = getSectionRows(sections, 'TRNT')
    .filter(row => row.ClientAccountID && row.ClientAccountID !== '-' && detailRow(row))
    .filter(row => (row.LevelOfDetail || '').toUpperCase() === 'EXECUTION');

  const tradeTransactions = tradeRows.map(row => {
    const side = (row['Buy/Sell'] || '').toUpperCase();
    const ticker = (row.Symbol || '').toUpperCase();
    const isFx = (row.AssetClass || '').toUpperCase() === 'CASH' || ticker.includes('.');
    const rawTxnType = row.TransactionType || row.ActivityCode || row['Notes/Codes'] || '';
    const inferredType = txnType(rawTxnType);
    const qty = parseNum(row.Quantity);
    const type = inferredType === 'Position Transfer'
      ? 'Position Transfer'
      : isFx ? 'Currency Conversion' : side === 'SELL' || qty < 0 ? 'Sell' : side === 'BUY' ? 'Buy' : inferredType;
    return resolveSecurityIdentity({
      id: row.TransactionID || row.TradeID || row.IBExecID || '',
      date: compactDate(row.TradeDate || row.DateTime || row.ReportDate),
      settlementDate: compactDate(row.SettleDateTarget),
      type,
      ticker: isFx ? ticker : ticker || null,
      name: row.Description || ticker,
      assetClass: normalizedAssetClass(row.AssetClass),
      quantity: qty,
      price: parseNum(row.TradePrice),
      grossAmount: parseNum(row.TradeMoney || row.Proceeds),
      fees: Math.abs(parseNum(row.IBCommission || row.Taxes)),
      netAmount: parseNum(row.NetCash || row.NetCashInBase),
      currency: (row.IBCommissionCurrency || row.CurrencyPrimary || account.currency || 'USD').toUpperCase(),
      account: row.ClientAccountID || account.clientAccountId,
      accountType: accountById[row.ClientAccountID]?.accountType || account.accountType,
      institution: 'Interactive Brokers',
      costBasis: parseNum(row.CostBasis),
      proceeds: parseNum(row.Proceeds),
      realizedGL: parseNum(row.FifoPnlRealized || row.CapitalGainsPnl),
      notes: row['Notes/Codes'] || row.TransactionType || '',
      sourceSection: 'TRNT',
      tradeId: row.TradeID || '',
      transferDirection: transferDirection(type),
      sourceAccount: row.FromAccount || row.SourceAccount || '',
      destinationAccount: row.ToAccount || row.DestinationAccount || '',
    });
  });

  const cashTransactions = getSectionRows(sections, 'CTRN')
    .filter(row => row.ClientAccountID && row.ClientAccountID !== '-' && (row.LevelOfDetail || '').toUpperCase() === 'DETAIL')
    .map(row => {
      const rawType = row.Type || '';
      const amount = parseNum(row.Amount);
      let type = txnType(rawType);
      if (/dividend/i.test(rawType)) type = 'Dividend';
      else if (/withholding|tax|fee/i.test(rawType)) type = 'Fee';
      else if (/transfer/i.test(rawType) && amount >= 0) type = 'Transfer In';
      else if (/transfer/i.test(rawType) && amount < 0) type = 'Transfer Out';
      else if (/deposit/i.test(rawType) && amount >= 0) type = 'Deposit';
      else if (/withdraw/i.test(rawType) && amount < 0) type = 'Withdrawal';
      return resolveSecurityIdentity({
        id: row.TransactionID || row.TradeID || '',
        date: compactDate(row['Date/Time'] || row.ReportDate),
        settlementDate: compactDate(row.SettleDate),
        type,
        ticker: (row.Symbol || '').toUpperCase() || null,
        name: row.Description || rawType,
        assetClass: normalizedAssetClass(row.AssetClass),
        quantity: 0,
        price: 0,
        grossAmount: amount,
        fees: type === 'Fee' ? Math.abs(amount) : 0,
        netAmount: amount,
        currency: (row.CurrencyPrimary || account.currency || 'USD').toUpperCase(),
        account: row.ClientAccountID || account.clientAccountId,
        accountType: accountById[row.ClientAccountID]?.accountType || account.accountType,
        institution: 'Interactive Brokers',
        costBasis: 0,
        proceeds: 0,
        realizedGL: 0,
        notes: row.DividendType || row.ClientReference || rawType,
        sourceSection: 'CTRN',
        transferDirection: transferDirection(type),
        sourceAccount: row.FromAccount || row.SourceAccount || '',
        destinationAccount: row.ToAccount || row.DestinationAccount || '',
      });
    });

  const transactions = [...tradeTransactions, ...cashTransactions].filter(row => row.date);
  const purchaseHistoryByTicker = {};
  tradeTransactions
    .filter(row => row.type === 'Buy' && row.ticker && row.quantity > 0)
    .forEach(row => {
      purchaseHistoryByTicker[row.ticker] = purchaseHistoryByTicker[row.ticker] || [];
      purchaseHistoryByTicker[row.ticker].push({
        date: row.date,
        quantity: row.quantity,
        price: row.price,
        fees: row.fees,
        currency: row.currency,
        tradeId: row.tradeId,
      });
    });

  positions.forEach(position => {
    position.purchase_history = purchaseHistoryByTicker[position.ticker] || [];
    position.purchaseHistory = position.purchase_history;
  });

  const realizedPositions = buildRealizedPositionsFromTrades(tradeTransactions, account, securityBySymbol);

  const sectionSummary = Object.values(sections).map(section => ({
    code: section.code,
    name: section.name,
    rowCount: section.rows.length,
  }));

  return {
    broker: 'ibkr_activity_flex',
    headers: ['Section', 'Account', 'Ticker', 'Quantity', 'Price', 'Market Value', 'Currency'],
    rawRows: allRows,
    columnMap: {},
    valid: positions,
    transactions,
    errors: [],
    isHoldings: true,
    isSectioned: true,
    importBundle: {
      report,
      account,
      accounts,
      positions,
      openHoldings: positions,
      realizedPositions,
      transactions,
      securityAmbiguities: buildSecurityAmbiguities([...positions, ...transactions, ...realizedPositions]),
      fxBalances: getSectionRows(sections, 'FXPO'),
      conversionRates: getSectionRows(sections, 'RATE'),
      securities: getSectionRows(sections, 'SECU'),
      sectionSummary,
    },
    headerRowIndex: 0,
  };
}

// ─── MULTI-FILE IMPORT COMPOSITION ───────────────────────────

function isWealthsimpleParsed(parsed) {
  return ['wealthsimple', 'wealthsimple_activity', 'wealthsimple_holdings'].includes(parsed?.broker);
}

function uniqueBy(rows, keyFn) {
  const map = new Map();
  rows.filter(Boolean).forEach(row => {
    const key = keyFn(row);
    if (!key) return;
    map.set(key, { ...(map.get(key) || {}), ...row });
  });
  return [...map.values()];
}

function bundleRows(parsed, key) {
  const bundle = parsed?.importBundle || {};
  if (Array.isArray(bundle[key])) return bundle[key];
  if (key === 'positions') return parsed?.isHoldings ? parsed?.valid || [] : [];
  if (key === 'transactions') return !parsed?.isHoldings ? parsed?.valid || [] : [];
  return [];
}

function composeWealthsimpleFiles(files) {
  const holdingsFiles = files.filter(parsed => parsed.broker === 'wealthsimple_holdings' || (parsed.isHoldings && parsed.broker === 'wealthsimple'));
  const activityFiles = files.filter(parsed => parsed.broker === 'wealthsimple_activity');
  const sourceFiles = files.map(parsed => ({
    filename: parsed.filename,
    broker: parsed.broker,
    rowCount: parsed.valid?.length || 0,
    errorCount: parsed.errors?.length || 0,
  }));

  const accounts = uniqueBy(
    files.flatMap(parsed => parsed.importBundle?.accounts || []),
    account => account.clientAccountId || account.account_id || account.accountId || account.id,
  );
  const transactions = activityFiles.flatMap(parsed => bundleRows(parsed, 'transactions'));
  const realizedPositions = activityFiles.flatMap(parsed => bundleRows(parsed, 'realizedPositions'));
  const activityPositions = activityFiles.flatMap(parsed => bundleRows(parsed, 'positions'));
  const snapshotPositions = holdingsFiles.flatMap(parsed => bundleRows(parsed, 'positions'));
  const reconciliationWarnings = [];
  const activityByKey = Object.fromEntries(activityPositions.map(row => [`${row.account || row.account_id || row.accountId}::${securityKey(row)}`, row]));

  const positions = snapshotPositions.length
    ? snapshotPositions.map(position => {
      const key = `${position.account || position.account_id || position.accountId}::${securityKey(position)}`;
      const activityPosition = activityByKey[key];
      const snapshotQty = Number(position.quantity || 0);
      const activityQty = Number(activityPosition?.quantity || 0);
      if (activityPosition && Math.abs(snapshotQty - activityQty) > 0.0001) {
        reconciliationWarnings.push({
          account: position.account || position.account_id || position.accountId,
          ticker: position.ticker,
          message: `Holdings snapshot quantity ${snapshotQty} differs from activity reconstruction ${activityQty}; using holdings snapshot.`,
        });
      }
      return {
        ...activityPosition,
        ...position,
        purchase_history: activityPosition?.purchase_history || position.purchase_history || [],
        purchaseHistory: activityPosition?.purchase_history || activityPosition?.purchaseHistory || position.purchase_history || position.purchaseHistory || [],
        valuation_status: position.valuation_status || 'holdings_snapshot',
        price_source: position.price_source || 'broker_snapshot',
      };
    })
    : activityPositions;

  const sectionSummary = [
    ...files.flatMap(parsed => parsed.importBundle?.sectionSummary || []),
    { code: 'MULTI_FILE', name: 'Composed Wealthsimple import bundle', rowCount: files.length },
  ];
  const first = files[0] || {};
  const account = accounts[0] || first.importBundle?.account || {
    clientAccountId: positions[0]?.account || transactions[0]?.account || 'wealthsimple-account',
    currency: positions[0]?.currency || transactions[0]?.currency || 'CAD',
    name: 'Wealthsimple',
    accountType: positions[0]?.accountType || transactions[0]?.accountType || 'Brokerage',
    country: 'CA',
  };

  return {
    broker: 'wealthsimple',
    filename: `Wealthsimple import bundle (${files.length} files)`,
    headers: ['Account', 'Ticker', 'Quantity', 'Price', 'Market Value', 'Currency'],
    rawRows: files.flatMap(parsed => parsed.rawRows || []),
    columnMap: {},
    valid: positions,
    transactions,
    errors: files.flatMap(parsed => parsed.errors || []),
    isHoldings: true,
    isSectioned: true,
    sourceFiles,
    reconciliationWarnings,
    importBundle: {
      report: {
        name: `Wealthsimple import bundle (${files.length} files)`,
        sourceFiles,
      },
      account,
      accounts,
      positions,
      openHoldings: positions,
      realizedPositions,
      transactions,
      securityAmbiguities: buildSecurityAmbiguities([...positions, ...transactions, ...realizedPositions]),
      sectionSummary,
      securities: [],
      sourceFiles,
      reconciliationWarnings,
    },
    headerRowIndex: 0,
  };
}

export function composeParsedImports(parsedFiles) {
  const files = (parsedFiles || []).filter(Boolean);
  if (files.length <= 1) {
    return files.map(parsed => ({
      ...parsed,
      sourceFiles: [{ filename: parsed.filename, broker: parsed.broker, rowCount: parsed.valid?.length || 0, errorCount: parsed.errors?.length || 0 }],
      importBundle: {
        ...(parsed.importBundle || {}),
        sourceFiles: [{ filename: parsed.filename, broker: parsed.broker, rowCount: parsed.valid?.length || 0, errorCount: parsed.errors?.length || 0 }],
      },
    }));
  }

  const wealthsimpleFiles = files.filter(isWealthsimpleParsed);
  const otherFiles = files.filter(parsed => !isWealthsimpleParsed(parsed));
  return [
    ...(wealthsimpleFiles.length ? [composeWealthsimpleFiles(wealthsimpleFiles)] : []),
    ...otherFiles.map(parsed => ({
      ...parsed,
      sourceFiles: [{ filename: parsed.filename, broker: parsed.broker, rowCount: parsed.valid?.length || 0, errorCount: parsed.errors?.length || 0 }],
      importBundle: {
        ...(parsed.importBundle || {}),
        sourceFiles: [{ filename: parsed.filename, broker: parsed.broker, rowCount: parsed.valid?.length || 0, errorCount: parsed.errors?.length || 0 }],
      },
    })),
  ];
}

// ─── PHASE 2: LIVE LISTING VERIFICATION ──────────────────────
//
// After Phase 1 (per-row sync `resolveSecurityIdentity`), some rows are tagged
// `_needs_verification: true` (typically Wealthsimple bare tickers where the
// exchange isn't given). This walks every row collection in a parsed bundle
// and replaces those rows with verified identities from Finnhub.
//
// Caller pattern:
//   const parsed = await composeParsedImports(files.map(parseFile));
//   const verified = await Promise.all(parsed.map(verifyParsedSecurities));
//
// After this runs, `importBundle.securityAmbiguities` reflects only the rows
// that genuinely need user input (Finnhub returned no listing, or the
// resolver was offline). The Securities Review step is empty otherwise.

export async function verifyParsedSecurities(parsed) {
  if (!parsed || parsed.error) return parsed;

  const bundle = parsed.importBundle || {};
  const sliceKeys = ['positions', 'openHoldings', 'transactions', 'realizedPositions'];
  const slices = {};
  sliceKeys.forEach(key => { if (Array.isArray(bundle[key])) slices[key] = bundle[key]; });
  if (Array.isArray(parsed.valid)) slices.valid = parsed.valid;

  const allRows = Object.values(slices).flat();
  if (allRows.length === 0) return parsed;

  // Single batched verification — listingResolver caches per-underlying so
  // duplicate underlyings across slices only hit Finnhub once.
  const verifiedAll = await verifyIdentities(allRows);

  // Map original-row identity → verified row, then re-distribute back into
  // each named slice. Use object identity to match (verifyIdentities preserves
  // input order and either returns the same row or a spread copy).
  const indexMap = new Map();
  let cursor = 0;
  Object.entries(slices).forEach(([key, rows]) => {
    indexMap.set(key, rows.map(() => verifiedAll[cursor++]));
  });

  const newBundle = { ...bundle };
  sliceKeys.forEach(key => { if (slices[key]) newBundle[key] = indexMap.get(key); });
  newBundle.securityAmbiguities = buildSecurityAmbiguities([
    ...(newBundle.positions || []),
    ...(newBundle.transactions || []),
    ...(newBundle.realizedPositions || []),
  ]);

  return {
    ...parsed,
    valid: slices.valid ? indexMap.get('valid') : parsed.valid,
    importBundle: newBundle,
  };
}

// ─── FULL PARSE PIPELINE ──────────────────────────────────────

export function parseFile(text, filename) {
  const allRows = parseCSVText(text);
  if (allRows.length < 2) return { error: 'File appears empty or has only one row.', broker: 'unknown', headers: [], columnMap: {}, valid: [], errors: [], isHoldings: false };

  if (isIBKRSectionedReport(allRows)) {
    return parseIBKRSectionedReport(allRows, filename);
  }

  // Find the actual header row (IBKR flex queries may have metadata rows at top)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i];
    if (row.some(cell => /date|symbol|ticker|account|quantity/i.test(cell))) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = allRows[headerRowIndex];
  const dataRows = allRows.slice(headerRowIndex + 1);

  if (isWealthsimpleActivityReport(headers)) {
    return parseWealthsimpleActivityReport(dataRows, headers, filename);
  }
  if (isWealthsimpleHoldingsReport(headers)) {
    return parseWealthsimpleHoldingsReport(dataRows, headers, filename);
  }

  const broker = detectBroker(headers);
  const columnMap = autoMapColumns(headers, broker);
  const isHoldings = broker === 'unifolio_holdings' || (filename || '').toLowerCase().includes('holding') || (filename || '').toLowerCase().includes('position');

  let valid, errors;
  if (isHoldings) {
    ({ valid, errors } = parseHoldingsRows(dataRows, headers, columnMap));
  } else {
    ({ valid, errors } = parseRows(dataRows, headers, columnMap));
  }

  return { broker, headers, rawRows: dataRows, columnMap, valid, errors, isHoldings, headerRowIndex };
}

// ─── BROKER DISPLAY NAMES ─────────────────────────────────────

export const BROKER_LABELS = {
  wealthsimple: { name: 'Wealthsimple', logo: 'wealthsimple' },
  wealthsimple_holdings: { name: 'Wealthsimple Holdings Report', logo: 'wealthsimple' },
  wealthsimple_activity: { name: 'Wealthsimple Activity Export', logo: 'wealthsimple' },
  ibkr: { name: 'Interactive Brokers', logo: 'interactive-brokers' },
  ibkr_flex: { name: 'Interactive Brokers (Flex Query)', logo: 'interactive-brokers' },
  ibkr_activity_flex: { name: 'Interactive Brokers Activity Flex Report', logo: 'interactive-brokers' },
  questrade: { name: 'Questrade', logo: 'questrade' },
  unifolio: { name: 'Unifolio Transaction Template', logo: 'unifolio' },
  unifolio_holdings: { name: 'Unifolio Holdings Template', logo: 'unifolio' },
  td: { name: 'TD Direct Investing', logo: 'td' },
  generic: { name: 'Generic CSV', logo: 'generic' },
};

// ─── UNIFOLIO FIELD LABELS ────────────────────────────────────

export const FIELD_LABELS = {
  date: 'Date',
  settlementDate: 'Settlement Date',
  type: 'Transaction Type',
  ticker: 'Ticker',
  name: 'Asset Name',
  assetClass: 'Asset Class',
  quantity: 'Quantity',
  price: 'Price',
  grossAmount: 'Gross Amount',
  fees: 'Fees',
  netAmount: 'Net Amount',
  currency: 'Currency',
  account: 'Account',
  accountType: 'Account Type',
  institution: 'Institution',
  costBasis: 'Cost Basis',
  proceeds: 'Proceeds',
  realizedGL: 'Realized G/L',
  notes: 'Notes',
  avgPrice: 'Avg Price',
  marketValue: 'Market Value',
};
