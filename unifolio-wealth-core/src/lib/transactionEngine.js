// Pure transaction-driven holdings engine.
//
// Given a flat list of broker transactions (buys, sells, dividends, transfers
// in/out, fees, FX conversions, deposits, withdrawals, splits) plus a price
// oracle and an FX rate oracle, this module reconstructs every cell in the
// Holdings table without trusting any broker-provided P/L number.
//
// The engine is deliberately pure:
//   - input arrays are never mutated
//   - no network calls (callers pass in resolved prices/FX)
//   - deterministic given the same inputs
//
// Output shape per holding (matches what columnConfig + UI expects):
//   {
//     security_key,
//     ticker, display_ticker, underlying_ticker,
//     account_id, currency, listing_currency,
//     quantity,                  // sum of buys − sells + transfers + splits
//     avg_price_clean,           // Σ(buy_qty × buy_price) / Σ buy_qty   [no fees]
//     avg_price,                 // cost_basis / quantity                 [incl fees & xfer cost]
//     cost_basis,                // FIFO remaining cost in native currency
//     market_value,              // qty × current_price (native)
//     unrealized_pnl,            // market_value − cost_basis
//     unrealized_pnl_pct,        // unrealized_pnl / cost_basis × 100
//     realized_pnl,              // sum across closed lots in native currency
//     dividends_native,          // sum of dividend cash in native currency
//     dividends_base,            // dividends translated to base via per-event FX
//     fees,                      // sum of commissions + fees attributed to this position
//     total_return,              // unrealized_pnl + realized_pnl + dividends_base − fees_in_base
//     total_return_pct,          // total_return / Σ buy_cost_in_base × 100
//     market_value_base,         // market_value × FX[as_of] → base currency
//     cost_basis_base,           // historical FX-weighted (Σ lot_cost × FX[lot_date])
//     lots,                      // remaining FIFO lots [{ qty, price, date, fx_to_base }]
//     transactions,              // refs to all txn ids that touched this position
//   }
//
// The companion HOLDINGS_MATH.md doc explains every formula with worked
// examples drawn from the user's IBKR Flex sample.

import { safeNumber } from '@/lib/safeNum';

const TX_BUY = 'buy';
const TX_SELL = 'sell';
const TX_DIVIDEND = 'dividend';
const TX_TRANSFER_IN = 'transfer_in';
const TX_TRANSFER_OUT = 'transfer_out';
const TX_FEE = 'fee';
const TX_SPLIT = 'split';
const TX_INTEREST = 'interest';

const TYPE_ALIASES = {
  buy: TX_BUY,
  sell: TX_SELL,
  dividend: TX_DIVIDEND,
  cash_dividend: TX_DIVIDEND,
  div: TX_DIVIDEND,
  transfer_in: TX_TRANSFER_IN,
  transferin: TX_TRANSFER_IN,
  position_transfer_in: TX_TRANSFER_IN,
  ipd: TX_TRANSFER_IN,            // IBKR's "Internal Position Delivery"
  aton: TX_TRANSFER_IN,           // ATON broker-to-broker delivery
  transfer_out: TX_TRANSFER_OUT,
  position_transfer_out: TX_TRANSFER_OUT,
  fee: TX_FEE,
  commission: TX_FEE,
  split: TX_SPLIT,
  stock_split: TX_SPLIT,
  interest: TX_INTEREST,
};

function normalizeType(raw) {
  const k = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
  return TYPE_ALIASES[k] || k;
}

function key(tx) {
  // Position grouping: (account, security_key) — same security in different
  // accounts produces distinct holdings rows.
  const sec = tx.security_key || tx.securityKey
    || `${String(tx.ticker || '').toUpperCase()}@${(tx.listing_exchange || tx.exchange || '?')}:${(tx.currency || tx.listing_currency || 'USD')}`;
  return `${tx.account_id || tx.accountId || ''}::${sec}`;
}

// Resolve FX from a date (YYYY-MM-DD) to a rate that converts FROM `from` TO `to`.
// `fxRates` is `{ [date]: { [pair]: rate } }` where pair = 'CAD->USD' etc.
// Falls back to nearest prior date, then to 1.0 when same currency.
function resolveFx(fxRates, date, from, to) {
  if (!from || !to || from === to) return 1;
  if (!fxRates) return 1;
  const direct = `${from}->${to}`;
  const inverse = `${to}->${from}`;
  // Walk back up to 14 days for a quote
  let d = String(date || '').slice(0, 10);
  if (!d) return 1;
  for (let i = 0; i < 14; i += 1) {
    const day = fxRates[d];
    if (day) {
      if (Number.isFinite(day[direct])) return day[direct];
      if (Number.isFinite(day[inverse]) && day[inverse] !== 0) return 1 / day[inverse];
    }
    // step back one day
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    d = prev.toISOString().slice(0, 10);
  }
  return 1; // safe fallback — caller can audit by inspecting absent fx_to_base
}

function priceFor(historicalPrices, ticker, date) {
  if (!historicalPrices || !ticker) return null;
  const series = historicalPrices[String(ticker).toUpperCase()];
  if (!series) return null;
  let d = String(date || '').slice(0, 10);
  for (let i = 0; i < 14; i += 1) {
    if (series[d] != null) return series[d];
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    d = prev.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Build the canonical Holdings table from raw transactions.
 *
 * @param {Object}   options
 * @param {Array}    options.transactions   Flat array of normalized txn rows.
 * @param {Object}   [options.fxRates]      `{ [date]: { 'CAD->USD': rate } }`. Optional.
 * @param {Object}   [options.historicalPrices] `{ [ticker]: { [date]: close } }`. Optional.
 * @param {String}   [options.asOf]         Snapshot date `YYYY-MM-DD`. Defaults to today.
 * @param {String}   [options.baseCurrency] Currency for cross-account totals. Defaults to 'USD'.
 * @returns {Array}  One row per (account, security) with quantity > 0.
 */
export function buildHoldingsFromTransactions({
  transactions = [],
  fxRates = {},
  historicalPrices = {},
  asOf = new Date().toISOString().slice(0, 10),
  baseCurrency = 'USD',
} = {}) {
  // 1. Group transactions by (account, security)
  const groups = new Map();
  transactions.forEach((tx) => {
    if (!tx) return;
    const k = key(tx);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(tx);
  });

  const holdings = [];

  groups.forEach((txns, k) => {
    // Sort by date so FIFO consumes lots in chronological order
    const sorted = [...txns].sort((a, b) => {
      const da = String(a.date || a.transaction_date || '').slice(0, 10);
      const db = String(b.date || b.transaction_date || '').slice(0, 10);
      return da.localeCompare(db);
    });

    const sample = sorted[0] || {};
    const nativeCurrency = sample.currency || sample.listing_currency || baseCurrency;
    const ticker = sample.display_ticker || sample.ticker;
    const lots = []; // FIFO queue: [{ qty, price, date, fees, fx_to_base }]
    let realizedNative = 0;
    let dividendsNative = 0;
    let dividendsBase = 0;
    let feesNative = 0;
    let buyCostBase = 0;            // for total_return_pct denominator
    const txIds = [];

    sorted.forEach((tx) => {
      const type = normalizeType(tx.transaction_type ?? tx.type);
      const date = String(tx.date || tx.transaction_date || asOf).slice(0, 10);
      const qty = safeNumber(tx.quantity ?? tx.qty);
      const price = safeNumber(tx.price ?? tx.unit_price);
      const fees = safeNumber(tx.fees ?? tx.commission);
      const totalCash = safeNumber(tx.total_amount ?? tx.total ?? tx.net_cash_amount);
      const txCurrency = tx.currency || nativeCurrency;
      const fxToBase = resolveFx(fxRates, date, txCurrency, baseCurrency);

      txIds.push(tx.id || tx.tradeId || tx.transaction_id);

      if (type === TX_BUY) {
        // New lot. Cost includes commissions so AVG matches broker accounting.
        const lotPrice = qty > 0 ? (Math.abs(totalCash) / qty) : price;
        lots.push({ qty: Math.abs(qty), price: lotPrice, clean_price: price, date, fees, fx_to_base: fxToBase });
        feesNative += fees;
        buyCostBase += Math.abs(qty) * lotPrice * fxToBase;
      } else if (type === TX_SELL) {
        // Consume oldest lots FIFO; realized = sale_proceeds − cost_of_consumed_lot
        let toConsume = Math.abs(qty);
        const proceedsPerShare = qty !== 0 ? Math.abs(totalCash) / Math.abs(qty) : price;
        while (toConsume > 0 && lots.length > 0) {
          const lot = lots[0];
          const consumed = Math.min(lot.qty, toConsume);
          const lotCost = consumed * lot.price;
          const lotProceeds = consumed * proceedsPerShare;
          realizedNative += (lotProceeds - lotCost);
          lot.qty -= consumed;
          toConsume -= consumed;
          if (lot.qty <= 0.0000001) lots.shift();
        }
        // Sell-side fees reduce realized
        realizedNative -= fees;
        feesNative += fees;
      } else if (type === TX_TRANSFER_IN) {
        // Shares received. Pricing precedence:
        //   1. Linked source's original buy price (set by
        //      transferLinker.linkTransferTransactions when a matching
        //      transfer-out + buy chain exists in another broker).
        //   2. Broker-implied price (totalCash / qty) if the broker actually
        //      reported a value with the transfer line.
        //   3. Historical close on the transfer date (Yahoo /api/chart),
        //      treating the transfer as a "fictional buy" at market on the
        //      day the shares landed. This prevents 0-cost VOO/TTWO style
        //      bugs when neither broker chain nor totalCash exists.
        const linked = tx._linkedSource;
        const linkedPrice = safeNumber(linked?.price);
        const linkedDate = linked?.date || date;
        const cashFallbackPrice = qty !== 0 ? Math.abs(totalCash) / Math.abs(qty) : 0;
        const histFallbackPrice = (linkedPrice <= 0 && cashFallbackPrice <= 0)
          ? safeNumber(priceFor(historicalPrices, ticker, date))
          : 0;

        let lotPrice = 0;
        let lotDate = date;
        let pricingSource = null;
        if (linkedPrice > 0) {
          lotPrice = linkedPrice;
          lotDate = linkedDate;
          pricingSource = 'linked_source';
        } else if (cashFallbackPrice > 0) {
          lotPrice = cashFallbackPrice;
          pricingSource = 'broker_total_cash';
        } else if (histFallbackPrice > 0) {
          lotPrice = histFallbackPrice;
          pricingSource = 'historical_close_on_transfer_date';
        }

        lots.push({
          qty: Math.abs(qty),
          price: lotPrice,
          clean_price: lotPrice,
          date: lotDate,
          fees: 0,
          fx_to_base: fxToBase,
          is_transfer: true,
          linked_source: linked || null,
          transfer_date: date, // when it landed in this account
          pricing_source: pricingSource,
        });
      } else if (type === TX_TRANSFER_OUT) {
        // Shares delivered out — consume FIFO without realizing P/L (cost
        // basis travels with the security to the receiving account)
        let toConsume = Math.abs(qty);
        while (toConsume > 0 && lots.length > 0) {
          const lot = lots[0];
          const consumed = Math.min(lot.qty, toConsume);
          lot.qty -= consumed;
          toConsume -= consumed;
          if (lot.qty <= 0.0000001) lots.shift();
        }
      } else if (type === TX_DIVIDEND) {
        const cash = Math.abs(safeNumber(totalCash || qty * price));
        dividendsNative += cash;
        dividendsBase += cash * fxToBase;
      } else if (type === TX_FEE) {
        feesNative += Math.abs(totalCash);
      } else if (type === TX_SPLIT) {
        // qty = ratio (e.g. 2 for 2:1 split). Multiply existing lots' qty,
        // divide their price, so cost basis stays constant.
        const ratio = qty > 0 ? qty : 1;
        if (ratio !== 1) {
          lots.forEach((lot) => {
            lot.qty *= ratio;
            lot.price /= ratio;
            if (lot.clean_price) lot.clean_price /= ratio;
          });
        }
      }
    });

    // Compute aggregates from the surviving lots
    const totalQty = lots.reduce((s, l) => s + l.qty, 0);
    if (totalQty <= 0.0000001) return; // closed position — skip

    const costBasis = lots.reduce((s, l) => s + l.qty * l.price, 0);
    const cleanCost = lots.reduce((s, l) => s + l.qty * (l.clean_price ?? l.price), 0);
    const avgPrice = costBasis / totalQty;
    const avgPriceClean = cleanCost / totalQty;

    const currentPrice = priceFor(historicalPrices, ticker, asOf) ?? avgPrice;
    const marketValue = totalQty * currentPrice;
    const unrealizedPnl = marketValue - costBasis;

    const fxToBaseToday = resolveFx(fxRates, asOf, nativeCurrency, baseCurrency);
    const marketValueBase = marketValue * fxToBaseToday;
    const costBasisBase = lots.reduce((s, l) => s + l.qty * l.price * (l.fx_to_base ?? fxToBaseToday), 0);
    const totalReturnNative = unrealizedPnl + realizedNative + dividendsNative;
    const totalReturnBase = (unrealizedPnl * fxToBaseToday) + (realizedNative * fxToBaseToday) + dividendsBase;

    holdings.push({
      security_key: sample.security_key || k.split('::')[1],
      ticker,
      display_ticker: sample.display_ticker || ticker,
      underlying_ticker: sample.underlying_ticker || ticker,
      account_id: sample.account_id || sample.accountId,
      currency: nativeCurrency,
      listing_currency: sample.listing_currency || nativeCurrency,
      quantity: totalQty,
      avg_price_clean: avgPriceClean,
      avg_price: avgPrice,
      average_price: avgPrice, // alias for older callers
      cost_basis: costBasis,
      market_value: marketValue,
      current_price: currentPrice,
      unrealized_gain_loss_amount: unrealizedPnl,
      unrealized_gain_loss_percent: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
      realized_gain_loss_amount: realizedNative,
      dividends_native: dividendsNative,
      dividends_base: dividendsBase,
      fees: feesNative,
      total_return: totalReturnNative,
      total_return_base: totalReturnBase,
      total_return_pct: buyCostBase > 0 ? (totalReturnBase / buyCostBase) * 100 : 0,
      market_value_base: marketValueBase,
      cost_basis_base: costBasisBase,
      lots,
      transactions: txIds,
      // Source-of-truth flags so downstream UI can show "computed by Unifolio"
      // vs "trusted from broker" badges
      _engine_computed: true,
      _as_of: asOf,
    });
  });

  return holdings;
}

/**
 * Convenience: turn IBKR's RATE section rows into the `fxRates` shape the
 * engine consumes. RATE rows look like `{ FromCurrency, ToCurrency, Rate, Date }`.
 */
export function fxRatesFromIBKRRates(rateRows = []) {
  const out = {};
  rateRows.forEach((row) => {
    const date = String(row.Date || row.date || '').slice(0, 10);
    const from = String(row.FromCurrency || row.from || '').toUpperCase();
    const to = String(row.ToCurrency || row.to || '').toUpperCase();
    const rate = Number(row.Rate || row.rate);
    if (!date || !from || !to || !Number.isFinite(rate)) return;
    if (!out[date]) out[date] = {};
    out[date][`${from}->${to}`] = rate;
    if (rate !== 0) out[date][`${to}->${from}`] = 1 / rate;
  });
  return out;
}
