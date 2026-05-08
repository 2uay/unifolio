# Unifolio — Project Changelog & Scope Tracker

This file tracks all significant feature additions, changes, and known limitations across the Unifolio codebase. Update it whenever a meaningful change is made.

---

## Project Overview

**Unifolio** is a personal portfolio command center built with React + Vite, deployed on **Vercel** at **https://unifolio.pro**. It aggregates investment holdings across multiple accounts and institutions, displaying P&L, heatmaps, realized positions, watchlists, prediction markets, and more.

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
| Auth | `src/lib/AuthContext.jsx` | Supabase auth + demo mode + `updateFullName()` |
| Deployment | `vercel.json` | SPA routing rewrites for Vercel |

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

### 2026-05-07

#### Auth: Fixed Infinite Loading Spinner
- **File:** `src/lib/AuthContext.jsx`
- `getSession()` was silently hanging (not rejecting) when Supabase tried to refresh a stale token with no network — `setIsLoadingAuth(false)` never fired
- Fix: removed `getSession()` call entirely; now uses `onAuthStateChange` INITIAL_SESSION event (fires synchronously from localStorage) + 3-second hard timeout fallback
- Also added `fullName` computed value (normalizes `user_metadata.full_name || user.full_name || email`) and `updateFullName()` function exposed on context

#### Settings: Editable Full Name
- **File:** `src/pages/Settings.jsx`
- Full Name field is now editable — pencil icon opens inline input with save (✓) / cancel (✗) buttons; Enter saves, Escape cancels
- `updateFullName()` updates both Supabase auth metadata (`supabase.auth.updateUser`) and `user_profiles` table; `onAuthStateChange` USER_UPDATED fires and propagates new name site-wide (Sidebar, Avatar, Settings card all update automatically)

#### Holdings: Heatmap Hover Preview
- **Files:** `src/pages/Holdings.jsx`, `src/components/holdings/HeatmapModeSelector.jsx`
- Hovering over any heatmap mode option in the dropdown previews that mode live on the table without committing; mouse-leave or dropdown close reverts to saved mode
- `previewMode` state in Holdings.jsx; `onModePreview`/`onPreviewEnd` props on HeatmapModeSelector; each DropdownMenuItem wires `onMouseEnter`/`onMouseLeave`
- Fixed: `enrichHoldingsForHeatmap` now always computes all enriched fields (`_portfolioWeight`, `_accountWeight`, `_realizedGainContribution`) regardless of active mode, so all 14 modes preview correctly

#### Holdings: Heatmap Concentration Color Follows Theme
- **Files:** `src/pages/Holdings.jsx`, `src/lib/heatmapColorEngine.js`
- Concentration heatmap (Portfolio Weight, Account Weight) now uses the active theme's `--primary` CSS variable instead of a hardcoded blue `#3B82F6`
- `getComputedStyle(document.documentElement).getPropertyValue('--primary')` read at render time; passed as `accentColor`; engine detects HSL string format and uses `hsl(H S% L% / opacity)` syntax
- Works for all 48 themes + custom monochrome; red/green P&L colors unchanged

#### Watchlist: Explore Carousel Rework
- **File:** `src/components/watchlist/ExploreCarousel.jsx`
- Complete card redesign: 2-row compact layout (`pt-1 px-2 pb-2`, `gap-0.5`), `w-40` width
- Row 1: ticker + mini sparkline SVG (44×16px, uses `liveHoldings[ticker].sparkline` or synthetic fallback trend)
- Row 2: price + change% inline (left) | add button (right); company name as 9px label below
- Simplified container: `bg-card/50`, no gradient, no glow lines, `p-1.5`; header reduced to single line

#### Deployment: Vercel + unifolio.pro
- **File:** `vercel.json` (new)
- App deployed to Vercel at https://unifolio.pro
- `vercel.json` adds SPA rewrite rule so React Router deep links work
- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FINNHUB_API_KEY`) set in Vercel project settings
- Old empty Vercel projects (`unifolio`, `unifolio2`, `project-r2lzd`) deleted — only `unifolio-wealth-core` remains
- DNS: unifolio.pro must point nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com` (currently on IONOS — pending user nameserver update)
- SSL: Vercel auto-provisions free Let's Encrypt certificate the moment DNS propagates — no third-party SSL needed

#### Holdings: Breakdown Row Rework
- **Files:** `src/components/holdings/HoldingDetailRow.jsx`, `src/components/charts/StockChart.jsx`
- Replaced basic Recharts AreaChart with the full `StockChart` component (same as WatchlistRow expanded detail)
- Breakdown now has: range selector (1M/3M/1Y), chart type toggle, interactive crosshair tooltip, fullscreen button
- `StockChart` gained optional `referenceLines` prop (`Array<{ price, label, color }>`) — renders as dashed horizontal lines inside the main ComposedChart at `yAxisId="price"`
- Purchase lots from `purchaseHistory` passed as purple (`#a78bfa`) dashed reference lines labeled "Lot 1", "Lot 2", etc. directly on the chart; avg price dashed line appears automatically via indicators
- `colSpan` changed from hardcoded `16` to `100` — always spans full table width regardless of visible column count
- Padding reduced (`p-4 md:p-6` → `p-3 md:p-4`), grid gap tightened (`gap-6` → `gap-4`)
- Purchase history badges below chart updated with "Lot N" purple label prefix matching chart reference line colors

#### Stability + Visual Consistency Pass
- **Files:** `src/components/layout/Sidebar.jsx`, `src/pages/Accounts.jsx`, `src/pages/Holdings.jsx`, `src/components/accounts/MetalsBreakdownSection.jsx`, `src/components/accounts/MetalBreakdownCard.jsx`
- Top-left Unifolio Zap indicator now uses the same `marketOpen` source as the sidebar market status pill; green when markets are open, red when closed, with pulse preserved
- Accounts page now guards production-only failure paths: custom assets query fails closed to `[]`, Base44 custom-asset mutations check service availability, accounts/holdings arrays are normalized before rendering, and malformed precious-metal details no longer crash cards
- Holdings "Stacked by ticker" label now uses amber (`text-amber-400/80`) to match the stacked-row yellow vertical indicator

#### Stability: Default Theme, Profile Picture, Debts, Prediction Markets
- **Files:** `src/lib/ThemeContext.jsx`, `src/lib/themes.js`, `src/lib/ProfilePictureContext.jsx`, `src/pages/DebtsAndBalances.jsx`, `src/pages/PredictionMarkets.jsx`, `src/components/predictionmarkets/PredictionMarketPlatformCard.jsx`, `src/components/predictionmarkets/PredictionMarketPositionsTable.jsx`
- Default theme changed from `redblackwhiteaccent` to `royalpurple` so new/default users land on the purple Unifolio look
- Profile picture upload/sync now has explicit timeouts for storage upload, database sync, and removal; avatar URLs get a cache-busting `?v=` suffix so changed pictures refresh immediately instead of appearing stale
- Debts & Balances and Prediction Markets pages now fail closed when Base44 entities are unavailable or return non-array data, preventing production crashes while preserving existing empty states
- Prediction platform cards now guard unknown connection statuses; positions table normalizes incoming positions before sorting/rendering

#### Visual Polish: Theme Wave Background
- **Files:** `src/components/shared/ThemedWaveBackground.jsx`, `src/pages/Welcome.jsx`, `src/components/layout/AppLayout.jsx`, `src/App.jsx`, `src/lib/ThemeContext.jsx`
- Removed the login-screen top/bottom accent bars and replaced the old static ring/grid backdrop with a cursor-responsive, theme-aware wave field rising from the bottom of the viewport
- Added `ThemedWaveBackground`, a lightweight CSS/`requestAnimationFrame` component that reads current theme tokens (`--primary`, `--background`, `--card`, `--accent`, `--ring`) and respects `prefers-reduced-motion`
- Login screen now uses theme tokens for card, tabs, inputs, buttons, logo mark, feature tiles, and auth loading spinner instead of hardcoded amber/black styling
- App pages now receive the same subtle theme wave background behind page content, without changing page component structure
- Cached legacy default theme (`redblackwhiteaccent`) is migrated to `royalpurple` so returning browsers with the old default localStorage value see the new purple default

#### UX Polish: Heatmap Menu, Extracted Holdings, Instructions
- **Files:** `src/pages/Holdings.jsx`, `src/components/holdings/HeatmapModeMenu.jsx`, `src/pages/Instructions.jsx`, `src/lib/bankExportInstructions.js`, `src/App.jsx`, `src/components/layout/Sidebar.jsx`, `src/pages/Welcome.jsx`, `src/components/ui/dialog.jsx`, `src/components/settings/ProfilePictureModal.jsx`
- Heatmap mode selector is now a persistent panel with clickable previous/next controls, keyboard left/right cycling, hover/focus preview, and click/Enter/Space selection; it no longer opens over the holdings table
- Holdings can be extracted into a fixed in-app panel with shared state and a browser fullscreen toggle; filters, sorting, stacked rows, heatmap preview, column controls, and breakdown rows use the same state as embedded mode
- Login sign-in form now explicitly handles Enter with `requestSubmit()` and guards against duplicate loading submissions
- Added `/instructions` sidebar page backed by config-driven bank export instructions, official links, screenshot placeholders, and generated CSV/Flex Query downloads
- Profile picture modal close button is enforced at the top-right through dialog header spacing and the shared dialog close control now has `aria-label="Close modal"`

#### Dashboard Wave Background Fix
- **Files:** `src/pages/Dashboard.jsx`
- Removed the old dashboard-only fixed black SVG/ring backdrop so the shared theme-aware `ThemedWaveBackground` from `AppLayout` is visible on Dashboard like the rest of the app

#### Real Benchmark API Wiring
- **Files:** `src/lib/benchmarks.js`, `src/components/dashboard/DashboardPortfolioChart.jsx`, `src/components/performance/PortfolioChart.jsx`, `src/lib/stockApi.js`
- Dashboard and Performance benchmark dropdowns now share one benchmark config and fetch real benchmark series through the existing Yahoo Finance `/api/chart` proxy
- Benchmark symbols use real Yahoo index/asset tickers where available (`^GSPC`, `^NDX`, `^DJI`, `^RUT`, `BTC-USD`, `GC=F`) and ETF proxies for total-market benchmarks (`VTI`, `XIC.TO`)
- Benchmark series are cached in localStorage, aligned to portfolio snapshot dates, and fall back to synthetic data only when the API is unavailable
- Both charts now show a subtle status indicator for live benchmark data, loading, or fallback

#### Holdings Heatmap Compact Selector Restore
- **Files:** `src/components/holdings/HeatmapModeSelector.jsx`, `src/pages/Holdings.jsx`
- Replaced the persistent heatmap panel with a compact toolbar control: left arrow, current mode text/dropdown, and right arrow
- Heatmap mode controls now render only when the Heatmap toggle is on; the dropdown still supports hover/focus preview and click selection
- Removed the unused persistent `HeatmapModeMenu` component

#### Royal Purple Guest/Login Default
- **Files:** `src/lib/ThemeContext.jsx`, `src/pages/Welcome.jsx`
- Logged-out visitors and demo-mode entry now explicitly reset to the `royalpurple` theme so the login page and demo experience always use the purple Unifolio default
- Signed-in users still load their saved Supabase theme preference after auth resolves

#### Demo Sign-In Navigation Fix
- **Files:** `src/lib/AuthContext.jsx`, `src/components/layout/DemoModeButton.jsx`, `src/components/layout/Sidebar.jsx`
- Added explicit `exitDemoMode()` auth action so demo users can return to the login screen without a full reload
- Demo-mode sign-in buttons now clear demo mode and navigate to `/`, where the app immediately renders the `Welcome` login screen
- Signed-in logout behavior remains unchanged

#### Supabase Import Backend + IBKR Flex Parser
- **Files:** `src/lib/csvParser.js`, `src/lib/importPersistence.js`, `src/pages/ImportCenter.jsx`, `supabase/schema.sql`
- Added section-aware parsing for IBKR Flex/activity reports using `BOS`/`HEADER`/`DATA`/`EOS` blocks instead of treating the report as a flat CSV
- The importer now extracts account metadata, current positions, trades, dividends/fees/cash transactions, securities, FX balances, and section summaries from the uploaded IBKR export
- Confirming an import now saves normalized holdings and transactions to Supabase (`institutions`, `accounts`, `holdings`, `transactions`) and records an audit payload in the new `import_batches` table
- The raw broker file is not stored; large FX-rate sections are counted and trimmed in the audit payload to avoid turning imports into raw-file storage

#### Imported Portfolio Sync + Realized Preview
- **Files:** `src/lib/PortfolioDataContext.jsx`, `src/lib/csvParser.js`, `src/lib/importPersistence.js`, `src/pages/ImportCenter.jsx`, `supabase/schema.sql`
- IBKR imports now reconstruct realized/closed positions from execution history and show Open Holdings, Realized Positions, and Transactions preview tabs before saving
- Import preview uses the Holdings table column definitions so uploaded files expose the same fields users expect in the portfolio table
- Added Supabase fields/table support for complete holdings metadata, transaction metadata, `realized_positions`, and active import tracking
- Signed-in users with imported Supabase data now load that data through `PortfolioDataProvider`; demo/unsigned users continue to see sample data
- Dashboard, Holdings, Accounts, Performance, Transactions, Tax Report, Insights, Institutions, portfolio breakdowns, holding details, and tax exports now read through the imported portfolio data layer where applicable

---

## Known Limitations / TODOs

- **Stack Assets + historical date filter:** stacking works on filtered holdings, so historical snapshots stack correctly. However, if a date snapshot is used and a ticker was only in one account at that time, stacking won't show account breakdown for that period.
- **Sort fields for stacked rows:** only `ticker`, `price`, `quantity`, `marketValue` sort fields are wired via `SortHeader`. Other fields (unrealized %, daily %) don't have sort buttons yet — they still render correctly, just aren't sortable by header click.
- **Live data + stacking:** live price updates flow through `liveHoldings` per ticker, so stacked rows automatically use the same live price since all children share a ticker.
- **`pctAssetClass` column:** currently renders "N/A" for all holdings — not yet computed per-holding.
- **Real account data:** IBKR CSV/Flex imports now save to Supabase and populate the app through `PortfolioDataProvider`; users must apply the latest `supabase/schema.sql` changes before saving complete imported holdings/realized-position metadata.

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
