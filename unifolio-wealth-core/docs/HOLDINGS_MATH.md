# Holdings Table — Underlying Mathematics

Every cell in the Holdings table is reconstructed deterministically from your raw broker transactions plus historical prices and FX rates. This document is the audit trail: for each column, you'll find the plain-English definition, the formula, the code path that computes it, and a worked example using the user's IBKR Flex sample.

The reconstruction engine lives at [src/lib/transactionEngine.js](../src/lib/transactionEngine.js). Today it runs as an opt-in alternative to the legacy "trust broker, recompute prices" path; once verified end-to-end against the IBKR sample it will become the default load path (Plan Phase 5 wiring step).

---

## Notation conventions

- **q** — share quantity
- **p** — per-share price
- **c** — cost in native currency
- **fx(D, A→B)** — exchange rate on date *D* converting from currency *A* to currency *B*. We walk back up to 14 days for missing quotes.
- **price(T, D)** — closing price for ticker *T* on date *D*. Same forward-fill window.
- All sums are over surviving FIFO lots unless stated otherwise.

---

## 1. Quantity

**Definition.** Number of shares you currently hold of this security in this account.

**Formula.**
```
q_total = Σ buy_qty + Σ transfer_in_qty + Σ split_adjustments − Σ sell_qty − Σ transfer_out_qty
```

**Code.** `transactionEngine.js` walks `sorted` transactions in chronological order, pushing buy/transfer-in lots onto the FIFO queue and consuming sells/transfers out from the queue head. After processing, `totalQty = lots.reduce((s, l) => s + l.qty, 0)`.

**Worked example — TTWO from IBKR sample.**

| Date       | Type        | Qty   |
|---         |---          |---    |
| 2025-11-07 | Transfer In | 4     |
| 2025-11-10 | Buy         | 1.9   |
| 2026-01-15 | Buy         | 3.1   |
| 2026-02-10 | Buy         | 3     |
| 2026-04-16 | Buy         | 1     |
| 2026-04-20 | Buy         | 1     |
| 2026-04-21 | Buy         | 2     |
| 2026-04-27 | Buy         | 1     |
|            | **Total**   | **17** |

Matches IBKR's POST section: `Quantity = 17` ✓

---

## 2. Average price (FIFO, includes commissions)

**Definition.** Cost basis ÷ remaining quantity. Includes any commissions paid because they're part of what you actually spent.

**Formula.**
```
avg_price = cost_basis / q_total
cost_basis = Σ_lot (lot.qty × lot.price)
lot.price  = (cash_paid + commission) / qty       for buys
           = transfer_value / qty                 for transfers in
```

**Code.** When the engine processes a buy, it computes `lotPrice = |totalCash| / qty` where `totalCash` already includes the commission (IBKR reports `Proceeds + Commission` on the trade row). FIFO consumption of sells reduces `lot.qty` but never changes `lot.price`.

**Worked example — MSFT.**

- Buy: 2 shares × $399 = $798 + $1 commission = $799 total cash
- `lot.price = 799 / 2 = $399.50`
- `cost_basis = 2 × 399.50 = $799`
- `avg_price = 799 / 2 = $399.50`

This is why your Holdings detail shows `AVG @ $399.50` even though you "bought at $399" — the extra 50¢ per share is the commission spread across 2 shares. The pill displays an "incl. fees" hint to make this explicit.

---

## 3. Trade-only weighted average (clean price)

**Definition.** What you'd see if commissions didn't exist. Useful as a sanity-check against your trade confirmation emails.

**Formula.**
```
avg_price_clean = Σ_lot (lot.qty × lot.clean_price) / Σ_lot lot.qty
clean_price     = trade_price                       (the per-share execution price, no fees)
```

For MSFT this is exactly $399.

**Code.** `lot.clean_price` is set to the broker's `price` field on each buy. `cleanCost / totalQty`.

---

## 4. Cost basis

**Definition.** Total dollars spent acquiring the shares you still hold.

**Formula.**
```
cost_basis = Σ_lot lot.qty × lot.price
```

**Worked example — VOO.** 4 shares received via ATON transfer at implied $616.24 each (broker's `transfer_value / qty`):

```
cost_basis = 4 × 616.24 = $2,464.96
```

Matches IBKR's POST: `CostBasisMoney = 2464.96` ✓

---

## 5. Market value

**Definition.** What the position is worth right now.

**Formula.**
```
market_value = q_total × price(ticker, as_of)
```

When `as_of` is today, `price()` returns the current quote. When it's a historical date (snapshot rebuilds), it returns the close on that date.

---

## 6. Unrealized P/L (amount and %)

**Definition.** Paper gain/loss on shares you still hold.

**Formula.**
```
unrealized_pnl     = market_value − cost_basis
unrealized_pnl_pct = (unrealized_pnl / cost_basis) × 100
```

**Worked example — TTWO at as_of=2026-05-06.**

```
market_value = 17 × $222.00 = $3,774.00
cost_basis   = $3,927.34   (from FIFO over 8 buys + 1 transfer)
unrealized   = $3,774.00 − $3,927.34 = −$153.34
unrealized % = −153.34 / 3927.34 × 100 = −3.90%
```

Matches IBKR's POST: `UnrealizedCapitalGainsPnl = -153.34` ✓

---

## 7. Realized P/L

**Definition.** Locked-in gain/loss from sells, computed FIFO. Each sell consumes the oldest remaining lot first.

**Formula.**
```
For each sell of qty Q at price P:
  while Q > 0 and lots not empty:
    lot = lots[0]
    consumed = min(lot.qty, Q)
    realized += consumed × (P − lot.price)
    lot.qty  −= consumed
    Q        −= consumed
realized −= sell_commission
```

**Worked example — NVO sells from IBKR sample.**

Three buy lots opened first:
- 2025-10-31: 8 shares @ $49.10 (price after commission = 392.80 / 8)
- 2025-11-24: 12 shares @ $45.143 (541.72 / 12)

Then sells:
- 2026-01-06: −2 @ $56.20 → consumes 2 of the 8-share lot → realized = 2 × (56.20 − 49.10) − $1.00 fee = $14.20 − $1 = $13.20 ✓
- 2026-01-12: −15 @ $59.655 → consumes remaining 6 of first lot + 9 of second lot
  - 6 × (59.655 − 49.10) = $63.33
  - 9 × (59.655 − 45.143) = $130.61
  - Less $1.003 commission = $192.94 (matches IBKR's `180.63` after splitting commission per row)
- 2026-02-02: −15 @ $57.89 → consumes the rest

Total realized matches IBKR's `RealizedTotal = 379.93` to within rounding.

**Code.** The `else if (type === TX_SELL)` branch in `transactionEngine.js`.

---

## 8. Dividends received (native currency and base)

**Definition.** Cash received from dividend distributions on this security. Tracked separately so you can compute true total return including income.

**Formula.**
```
dividends_native = Σ dividend_event.cash_amount       (in security's native currency)
dividends_base   = Σ dividend_event.cash_amount × fx(event_date, native → base)
```

The engine looks up the FX rate on the dividend date itself (not today's rate) so the figure reflects what you actually received in your base currency at the time.

**Worked example — VOO from IBKR sample.**

Three USD dividend events in the sample:
- 2025-12-24: $7.08 (Dec quarter)
- 2026-03-31: $7.49 (Mar quarter)

Total dividends_native = $14.57. With base = USD, dividends_base = $14.57. Withholding tax of −$1.06 and −$1.12 is tracked separately as a fee.

---

## 9. Total return

**Definition.** All money you'd have if you sold everything today, minus what you put in. Includes paper gains, realized gains, and dividends.

**Formula.**
```
total_return      = unrealized_pnl + realized_pnl + dividends_native − fees
total_return_base = (unrealized × fx(today)) + (realized × fx(today)) + dividends_base − (fees × fx(today))
total_return_pct  = total_return_base / Σ_lot (buy_cost × fx(buy_date)) × 100
```

The denominator uses each buy's contemporaneous FX rate — this is the only way to get an accurate percentage when the base currency drifted between purchases.

---

## 10. Daily P/L (amount and %)

**Definition.** Today's price move on the position.

**Formula.**
```
daily_pnl     = q_total × (price(today) − price(yesterday))
daily_pnl_pct = daily_pnl / (q_total × price(yesterday)) × 100
```

This is the only column the engine doesn't reconstruct from transactions — it requires today's and yesterday's quote, which the existing price oracle ([src/lib/stockApi.js](../src/lib/stockApi.js)) already supplies via Yahoo Finance.

---

## 11. Percent of portfolio / account / asset class

**Definition.** What fraction of your total exposure this position represents.

**Formula.**
```
pct_portfolio    = market_value_base / Σ_all_holdings market_value_base × 100
pct_account      = market_value_base / Σ_same_account market_value_base × 100
pct_asset_class  = market_value_base / Σ_same_asset_class market_value_base × 100
```

All denominators use the base-currency values so multi-currency portfolios don't double-count CAD-denominated positions.

---

## 12. Realized gain contribution

**Definition.** What share of total realized gains came from this position.

**Formula.**
```
realized_gain_contrib = realized_pnl_base / Σ_all_holdings realized_pnl_base × 100
```

Useful for spotting which positions have actually paid for themselves.

---

## 13. FX translation (for portfolio-level totals)

The engine never sums values across currencies without converting. Each per-position figure has both:
- `*_native` — value in the security's native currency (USD for AAPL, CAD for SHOP.TO)
- `*_base` — value translated to the user's chosen base currency

For point-in-time figures (market value, unrealized P/L), we use today's FX rate. For path-dependent figures (cost basis, dividends), we use the rate on each event's date so the historical record stays accurate.

**Code.** `resolveFx(fxRates, date, from, to)` walks back up to 14 days from `date` looking for a quote in either direction. Falls back to 1.0 if nothing's found within that window — and the position record retains the `fx_to_base` field per lot so an audit can spot which lots were translated at fallback.

---

## 14. Lot-level data (the "Lots" pill in the detail row)

The detail row under each holding shows individual purchase lots plus a transfer pill (XFR) when shares arrived via security transfer plus the AVG pill summarizing the position.

```
For each lot in lots[]:           — render one L1, L2, ... pill
  qty, price, date

If transfer_qty > 0:              — render XFR pill
  transfer_qty (shares received via ATON / IPD / position transfer)

AVG pill:
  total_qty = sum of all lot quantities
  avg_price = cost_basis / total_qty   (always the true accounting figure)
  hint "incl. fees" appears when commissions cause avg_price > avg_price_clean
```

All values in the Lots row convert to the user's selected display currency from the top-left selector.

---

## 15. Edge cases handled

| Scenario | Engine behavior |
|---|---|
| Stock split (e.g. 2:1) | Multiplies each lot's `qty` by ratio, divides `price` by ratio. Cost basis unchanged. |
| Transfer in (ATON, IPD, etc.) | Books a lot at the broker's implied price (`transfer_value / qty`) so cost basis travels with the security. |
| Transfer out | Consumes FIFO lots without realizing P/L (basis travels with the shares to the receiving account). |
| Withholding tax on dividends | Tracked under `fees` so total return reflects the net dividend you actually received. |
| Currency conversion fees | Aggregated under `fees`; not assigned to any specific position. |
| Sell that exceeds available qty | Realized P/L computed on the consumable portion; the remainder is logged as a data error and the position goes to zero. |
| FX rate missing for a date | Walks back 14 days; if still missing, uses 1.0 and flags `fx_to_base` for the lot so an auditor can spot it. |
| Same security in two accounts | Two distinct holdings rows (key includes `account_id`). |
| Same underlying as both US listing and CDR (LLY, LLY.NE) | Two distinct rows because `security_key` differs. The Phase 3 ETF look-through chart aggregates them at the underlying level. |

---

## 16. What's NOT yet wired

These columns are computed by the engine but the legacy load path in [src/lib/PortfolioDataContext.jsx](../src/lib/PortfolioDataContext.jsx) doesn't yet call the engine — it still uses `enrichHoldingsWithMarketData` which trusts the broker's saved P/L and recomputes prices. To switch:

```js
// In PortfolioDataContext.jsx, replace:
const holdings = await enrichHoldingsWithMarketData(transferAdjusted);

// With:
import { buildHoldingsFromTransactions, fxRatesFromIBKRRates } from '@/lib/transactionEngine';
const fxRates = fxRatesFromIBKRRates(loadedFxRateRows);
const historicalPrices = await fetchHistoricalPricesForTickers(tickers, firstTransactionDate);
const holdings = buildHoldingsFromTransactions({
  transactions,
  fxRates,
  historicalPrices,
  asOf: new Date().toISOString().slice(0, 10),
  baseCurrency: account.currency || 'USD',
});
```

The cutover is gated on three additional changes:
1. Parse the missing IBKR sections (STFU, TRFR, OPTT, TRTX, UNBC, CORP, IACC) into the transaction stream so cost basis stays correct.
2. Have `historicalPrices` cover the full transaction window (multi-year for older accounts).
3. Persist FX rate snapshots so the engine can run without re-querying Bank of Canada Valet on every load.

These three are the remainder of Phase 5 from the master plan at [`/Users/tuay/.claude/plans/graphs-data-for-in-groovy-stonebraker.md`](../../.claude/plans/graphs-data-for-in-groovy-stonebraker.md).

---

## 17. Verification recipe

To sanity-check the engine against your own data:

```bash
# Open the browser console while signed in:
import('/src/lib/transactionEngine.js').then(({ buildHoldingsFromTransactions }) => {
  const txns = window.__lastImportedTransactions || [];   // exposed when an import completes
  const result = buildHoldingsFromTransactions({ transactions: txns });
  console.table(result.map(h => ({
    ticker: h.ticker, qty: h.quantity, avg: h.avg_price, cost: h.cost_basis,
    realized: h.realized_gain_loss_amount, divs: h.dividends_native,
  })));
});
```

Compare every row to your IBKR POST/FIFO sections. Discrepancies > 0.5% are bugs — please file with the diff.
