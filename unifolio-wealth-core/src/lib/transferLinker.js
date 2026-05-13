// Cross-broker transfer chain linker.
//
// Problem: when a user moves shares from broker A to broker B (e.g. an ATON
// transfer from Wealthsimple to IBKR), the destination broker statement
// records a transfer-IN with no purchase price. The source statement records
// a transfer-OUT but no longer holds the shares. As a result the IBKR
// position looks like "13 buys + 4 ghost shares" with no cost basis on the
// transferred shares.
//
// Fix: link the two halves of each transfer chain by (ticker, quantity, date
// proximity, user-entered hint), then propagate the original BUY price/date
// from the source account through to the destination account's transfer-in
// lot. Engine + UI read the linked metadata to render correct lots.
//
// The linker is pure: input is a transactions array, output is a new array
// where matched transfer-in rows have a `_linkedSource` field annotation.
// Source transfer-out rows get `_linkedDestination` for symmetry.

import { safeNumber } from '@/lib/safeNum';

const TYPES_OUT = new Set(['Transfer Out', 'Position Transfer Out', 'transfer_out', 'position_transfer_out']);
const TYPES_IN  = new Set(['Transfer In',  'Position Transfer In',  'transfer_in',  'position_transfer_in', 'ATON', 'aton', 'IPD', 'ipd']);

const DATE_TOLERANCE_DAYS = 7; // ATON settlements often span 3-5 business days
const QTY_TOLERANCE_PCT = 0.01; // 1% — accommodates fractional-share rounding

function ticker(tx) {
  return String(tx.ticker || tx.symbol || '').toUpperCase().replace(/\s+CDR$/i, '').replace(/\.(NE|NEO|TO|TSX)$/i, '');
}

function daysBetween(dateA, dateB) {
  const a = new Date(String(dateA).slice(0, 10));
  const b = new Date(String(dateB).slice(0, 10));
  if (isNaN(a) || isNaN(b)) return Infinity;
  return Math.abs((a - b) / 86400000);
}

function direction(tx) {
  const raw = tx.transferDirection || tx.transfer_direction || '';
  if (raw === 'in' || raw === 'out') return raw;
  const type = tx.type || tx.transaction_type || '';
  if (TYPES_IN.has(type)) return 'in';
  if (TYPES_OUT.has(type)) return 'out';
  return null;
}

// Pull the user-entered destination/source hint (from TransferContextStep)
// out of any of the places it might live. Returns a lowercased string for
// fuzzy matching, or null.
function hintFrom(tx) {
  const candidates = [
    tx.destinationAccount,
    tx.destination_account,
    tx.destination_account_id,
    tx.sourceAccount,
    tx.source_account,
    tx.source_account_id,
    tx.transfer_context?.destinationAccount,
    tx.transfer_context?.sourceAccount,
    tx.transfer_context?.notes,
    tx.transferContext?.destinationAccount,
    tx.transferContext?.sourceAccount,
    tx.transferContext?.notes,
    tx.notes,
  ].filter(Boolean).map(s => String(s).toLowerCase());
  if (candidates.length === 0) return null;
  return candidates.join(' ');
}

// Score how well an outbound transfer matches an inbound transfer. Higher is
// better. Returns -Infinity if a hard constraint fails (different ticker,
// quantities can't be reconciled, dates too far apart).
function scorePair(out, inn) {
  if (ticker(out) !== ticker(inn)) return -Infinity;
  if ((out.account || out.account_id) === (inn.account || inn.account_id)) return -Infinity; // same account
  const qOut = Math.abs(safeNumber(out.quantity));
  const qIn = Math.abs(safeNumber(inn.quantity));
  if (qOut <= 0 || qIn <= 0) return -Infinity;
  const qtyDelta = Math.abs(qOut - qIn) / Math.max(qOut, qIn);
  if (qtyDelta > QTY_TOLERANCE_PCT) return -Infinity;
  const dd = daysBetween(out.date, inn.date);
  if (dd > DATE_TOLERANCE_DAYS) return -Infinity;

  let score = 100 - dd * 5 - qtyDelta * 1000;

  // Boost when user provided an explicit hint that mentions the other side's
  // broker/institution. e.g. WS transfer-out with notes "to IBKR" + IBKR
  // transfer-in row → strong signal.
  const outHint = hintFrom(out);
  const inHint = hintFrom(inn);
  const otherInst = String(inn.institution || inn.broker || '').toLowerCase();
  const thisInst = String(out.institution || out.broker || '').toLowerCase();
  if (outHint && otherInst && outHint.includes(otherInst.split(' ')[0])) score += 30;
  if (inHint && thisInst && inHint.includes(thisInst.split(' ')[0])) score += 30;
  // Common cross-broker keywords
  ['ibkr', 'interactive', 'wealthsimple', 'questrade', 'rbc', 'td', 'cibc', 'bmo', 'scotia', 'aton'].forEach(kw => {
    if (outHint?.includes(kw) && inHint?.includes(kw)) score += 5;
  });
  return score;
}

// For a given source-account transfer-out, find the source-account BUYS that
// would FIFO-consume the transferred quantity. Returns the weighted average
// price + earliest date of those consumed lots, or null if no buys exist.
function originalLotFromBuys(transactions, outRow) {
  const accountId = outRow.account || outRow.account_id;
  const tk = ticker(outRow);
  if (!accountId || !tk) return null;

  // Look at all BUY transactions in the same account & ticker before the
  // transfer-out date. We'll FIFO consume them by qty.
  const buys = transactions
    .filter(t => (t.account === accountId || t.account_id === accountId)
      && ticker(t) === tk
      && (t.type === 'Buy' || t.transaction_type === 'buy')
      && new Date(String(t.date).slice(0, 10)) <= new Date(String(outRow.date).slice(0, 10)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (buys.length === 0) return null;
  let remaining = Math.abs(safeNumber(outRow.quantity));
  let cost = 0;
  let consumedQty = 0;
  let firstDate = null;
  for (const buy of buys) {
    const q = Math.abs(safeNumber(buy.quantity));
    if (q <= 0) continue;
    const px = safeNumber(buy.price)
      || (buy.grossAmount && q ? Math.abs(buy.grossAmount / q) : 0)
      || (buy.costBasis && q ? Math.abs(buy.costBasis / q) : 0);
    if (px <= 0) continue;
    const take = Math.min(q, remaining);
    cost += take * px;
    consumedQty += take;
    if (!firstDate) firstDate = buy.date;
    remaining -= take;
    if (remaining <= 0.0000001) break;
  }
  if (consumedQty <= 0) return null;
  const avgPrice = cost / consumedQty;
  return {
    price: avgPrice,
    date: firstDate || outRow.date,
    sourceAccountId: accountId,
    sourceBroker: outRow.institution || outRow.broker || '',
    consumedQty,
    note: `Cost basis carried from ${outRow.institution || 'source broker'} (${consumedQty.toFixed(2)} sh @ avg ${avgPrice.toFixed(2)})`,
  };
}

/**
 * Link transfer-out and transfer-in transactions across accounts/brokers.
 * Mutates a copy of the input array — original transactions are untouched.
 *
 * @param {Array} transactions  Flat list across all brokers.
 * @returns {Array}             Same length; transfer-in rows annotated with
 *                              `_linkedSource: { price, date, sourceAccountId,
 *                              sourceBroker, note }` when a match is found.
 *                              Transfer-out rows get `_linkedDestination`.
 */
export function linkTransferTransactions(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) return transactions;

  const annotated = transactions.map(t => ({ ...t })); // shallow copy

  const outs = [];
  const ins = [];
  annotated.forEach((tx, i) => {
    const dir = direction(tx);
    if (dir === 'out') outs.push({ tx, i });
    else if (dir === 'in') ins.push({ tx, i });
  });
  if (outs.length === 0 || ins.length === 0) return annotated;

  // Greedy bipartite match: rank all (out, in) pairs by score, take the best
  // mutually-unmatched pairs first.
  const candidates = [];
  outs.forEach(({ tx: out, i: oi }) => {
    ins.forEach(({ tx: inn, i: ii }) => {
      const s = scorePair(out, inn);
      if (s > -Infinity) candidates.push({ s, oi, ii });
    });
  });
  candidates.sort((a, b) => b.s - a.s);

  const usedOut = new Set();
  const usedIn = new Set();
  for (const c of candidates) {
    if (usedOut.has(c.oi) || usedIn.has(c.ii)) continue;
    usedOut.add(c.oi);
    usedIn.add(c.ii);

    const outRow = annotated[c.oi];
    const inRow  = annotated[c.ii];
    const original = originalLotFromBuys(annotated, outRow);

    inRow._linkedSource = {
      sourceTxId: outRow.id || outRow.tradeId,
      sourceAccountId: outRow.account || outRow.account_id,
      sourceBroker: outRow.institution || outRow.broker || '',
      transferDate: outRow.date,
      ...(original ? {
        price: original.price,
        date: original.date,
        note: original.note,
      } : {
        note: `Linked from ${outRow.institution || 'source broker'} transfer-out (no buys found in source — cost basis unavailable)`,
      }),
    };

    outRow._linkedDestination = {
      destinationTxId: inRow.id || inRow.tradeId,
      destinationAccountId: inRow.account || inRow.account_id,
      destinationBroker: inRow.institution || inRow.broker || '',
      transferDate: inRow.date,
    };
  }

  return annotated;
}

export const __TEST__ = { scorePair, originalLotFromBuys, direction, hintFrom };
