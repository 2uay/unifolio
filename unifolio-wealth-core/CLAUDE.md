# Unifolio — Project Changelog & Scope Tracker

This file tracks all significant feature additions, changes, and known limitations across the Unifolio codebase. Update it whenever a meaningful change is made.

---

## Project Overview

**Unifolio** is a personal portfolio command center built with React + Vite, deployed via the base44 platform. It aggregates investment holdings across multiple accounts and institutions, displaying P&L, heatmaps, realized positions, watchlists, prediction markets, and more.

---

## Architecture Summary

| Layer | Files | Role |
|---|---|---|
| Pages | `src/pages/*.jsx` | Top-level route views |
| Components | `src/components/**/*.jsx` | Reusable UI pieces |
| Data Engine | `src/lib/portfolioEngine.js` | All portfolio calculations, single source of truth |
| Sample Data | `src/lib/sampleData.js` | Raw demo holdings, accounts, institutions |
| Live Data | `src/lib/LiveDataContext.jsx` | Simulated real-time price updates |
| Auth | `src/lib/AuthContext.jsx` | base44 auth + demo mode |
| Heatmap | `src/lib/heatmapColorEngine.js` | Heatmap color + enrichment logic |
| Column Config | `src/lib/columnConfig.js` | Column definitions + localStorage persistence |
| Stacking | `src/lib/stackingEngine.js` | Stack same-ticker holdings across accounts |
| Backend | `base44/functions/` | Deno serverless functions (getUserProfile, saveUserProfile, etc.) |
| Entities | `base44/entities/` | base44 data schema definitions |

---

## Features Implemented

### 2026-05-06

#### Holdings: Realized Gain Contribution % Column
- **Files:** `src/lib/columnConfig.js`, `src/pages/Holdings.jsx`
- Added `realizedGainContrib` column to `COLUMN_DEFINITIONS`
- Renders `h._realizedGainContribution` (already computed by `enrichHoldingsForHeatmap`) as a PnlValue percentage
- Matches the "Realized Gain Contribution %" heatmap mode visually
- Fixed pre-existing duplicate column definitions (`unrealizedGainPct`, `pctPortfolio`, `pctAccount` appeared twice — removed duplicates)

#### Holdings: Stack Assets Toggle
- **Files:** `src/lib/stackingEngine.js` (new), `src/pages/Holdings.jsx`
- New toggle "Stack Assets" groups holdings with the same ticker across all accounts into one combined row
- Matching priority: `asset_id` → `ticker` → `name` (case-insensitive)
- **Aggregated:** quantity, market value, cost basis, daily P&L, unrealized G/L, realized G/L, `_realizedGainContribution`, `_portfolioWeight`
- **Weighted average:** average price (`costBasis / qty`), unrealized %, daily P&L %
- **Account column:** shows "TFSA, Cash" or "3 accounts" depending on count
- **Institution column:** shows "Wealthsimple + IBKR" or "2 institutions"
- **Expanded stacked row:** clicking opens an account-level breakdown showing each child holding's account type, institution, quantity, avg price, market value, daily P&L, unrealized G/L, and % of stacked position
- **Realized positions compatibility:** realized rows nest under their matching stacked active row; unmatched realized rows remain at bottom
- **Heatmap compatibility:** `visibleHoldings` passed to `calculateHeatmapStyle` uses `displayHoldings` so normalization is against stacked rows when stacking is on
- **Persistence:** `localStorage` key `unifolio_stack_assets`; default off
- **Privacy mode:** financial values in breakdown rows are masked when privacy is on

#### Stock API Integration (Finnhub)
- **Files:** `src/lib/stockApi.js` (new), `src/lib/LiveDataContext.jsx`
- Free Finnhub API (60 calls/min) fetches real quotes for all held + watchlist tickers on app load
- Quotes are cached in localStorage for 15 minutes (`unifolio_stock_quotes_v1`) to avoid redundant calls
- `LiveDataContext` seeds the live simulation from real fetched prices instead of hardcoded values
- Fallback chain for price seed: `real API price → static asset catalog → 100`
- Exposes `apiPricesLoaded`, `apiLastFetched`, `realPrices` from `useLiveData()` context
- Supports `.TO` → `:TSX` ticker format conversion for Canadian stocks (e.g. `VFV.TO` → `VFV:TSX`)
- API key stored in `.env.local` as `VITE_FINNHUB_API_KEY` — see `.env.local.example`
- Also exports `fetchCompanyProfile(ticker)` and `searchSymbols(query)` for research/watchlist features

---

## Known Limitations / TODOs

- **Stack Assets + historical date filter:** stacking works on filtered holdings, so historical snapshots stack correctly. However, if a date snapshot is used and a ticker was only in one account at that time, stacking won't show account breakdown for that period.
- **Sort fields for stacked rows:** only `ticker`, `price`, `quantity`, `marketValue` sort fields are wired via `SortHeader`. Other fields (unrealized %, daily %) don't have sort buttons yet — they still render correctly, just aren't sortable by header click.
- **Live data + stacking:** live price updates flow through `liveHoldings` per ticker, so stacked rows automatically use the same live price since all children share a ticker.
- **`pctAssetClass` column:** currently renders "N/A" for all holdings — not yet computed per-holding.
- **Real account data:** all data is currently sample/demo data from `sampleData.js`. Full integration with real brokerage APIs is a future milestone.

---

## File Reference

```
unifolio-wealth-core/
├── src/
│   ├── pages/
│   │   ├── Holdings.jsx          ← Stack Assets toggle, column rendering
│   │   ├── Dashboard.jsx
│   │   ├── Accounts.jsx
│   │   ├── Performance.jsx
│   │   ├── Watchlist.jsx
│   │   ├── Transactions.jsx
│   │   ├── TradeCenter.jsx
│   │   ├── PredictionMarkets.jsx
│   │   ├── Insights.jsx
│   │   ├── Settings.jsx
│   │   └── Welcome.jsx
│   ├── lib/
│   │   ├── portfolioEngine.js    ← Core calculations
│   │   ├── stackingEngine.js     ← Stack Assets logic (NEW 2026-05-06)
│   │   ├── columnConfig.js       ← Column definitions
│   │   ├── heatmapColorEngine.js ← Heatmap colors + enrichment
│   │   ├── heatmapModes.js       ← Heatmap mode constants
│   │   ├── realizedPositions.js  ← Realized position data
│   │   ├── LiveDataContext.jsx   ← Simulated live prices
│   │   └── sampleData.js        ← Demo data
│   └── components/
│       ├── holdings/
│       │   ├── ColumnCustomizeModal.jsx
│       │   ├── HoldingDetailRow.jsx
│       │   ├── HeatmapModeSelector.jsx
│       │   └── PortfolioBreakdown.jsx
│       └── layout/
│           └── AppLayout.jsx
├── base44/
│   ├── config.jsonc
│   ├── functions/               ← Deno serverless functions
│   └── entities/                ← Data schemas
└── CLAUDE.md                    ← This file
```
