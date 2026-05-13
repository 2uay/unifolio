# Unifolio — Page Vocabulary

A structured map of every page so issues can be described with precision.
Format: `<route> / <section name>` — e.g. *"fix the Sector Allocation chart on Dashboard / section 5"*.

Last refreshed: 2026-05-13. Re-run the page-mapping agent whenever the route table or any page is restructured.

---

## / — Dashboard
**File:** [src/pages/Dashboard.jsx](../src/pages/Dashboard.jsx) (292 lines)
**Purpose:** Portfolio overview with KPIs, allocation, and top movers.

**Sections (top→bottom):**
1. **Page Header** — Title + SimulatedDataLabel badge.
2. **Stat Cards** — Total Portfolio · Daily P&L · Unrealized Gain · Cash Balance · Total Deposited.
3. **Portfolio Chart** — `DashboardPortfolioChart` (value over time).
4. **Account Allocation** — Donut by account type (TFSA, RRSP, etc.) + legend.
5. **Sector Allocation** — Donut by sector + legend.
6. **Top Movers Today** — 6-card grid: ticker, account type, daily change, mini sparkline.

**Hooks:** `usePortfolioData`, `usePrivacy`, `useCurrency`, `useLiveData`.
**Subcomponents:** DashboardPortfolioChart, StatCard, PnlValue, CustomPieTooltip.

---

## /holdings — Holdings
**File:** [src/pages/Holdings.jsx](../src/pages/Holdings.jsx) (large)
**Purpose:** Searchable, sortable, filterable position table.

**Sections (top→bottom):**
1. **Page Header** — Title, optional actions.
2. **Toolbar** — Search · filter pills (account type, currency, asset class) · "Show Lots" toggle · "Stack Assets" toggle · "Pop out" button · column-customize · heatmap mode selector.
3. **Holdings Table** — Draggable columns: Ticker, Security, Account, Qty, Avg Price, Current Price, Market Value, Daily P&L, Unrealized P&L, % Gain, Sector, Currency, Realized Gain Contrib%, …
4. **Lots Strip** (per row, when "Show Lots" on) — Weighted-avg purchase price + AVG/XFR pills (transferred shares marked). Currency-converted by `useCurrency`.
5. **Expanded Row Detail** (click chevron) — Cost basis, holding date, daily change, sparkline, performance vs portfolio, **inline "Edit security" panel** (security_identity / listing_exchange / listing_currency dropdowns).
6. **Custom Assets Rows** — Manually-tracked assets (real estate, metals, cards) interleaved or separate.
7. **PortfolioBreakdown** (below table, embedded only) — 20+ donut charts: sector, country, currency, asset class, account type, institution, concentration, region, **risk category, income bucket, etfLookthrough**.

**Hooks:** `usePortfolioData`, `useLiveData`, `usePrivacy`, `useCurrency`, `useFloatingHoldings`.
**Local state:** `expandedIds` / `expandedChildIds` (Sets — multi-row expansion), `showLots`, `stackAssets`, `previewMode` (heatmap hover preview).
**Subcomponents:** DraggableTableHeader, HoldingDetailRow, HeatmapModeSelector, ColumnCustomizeModal, PortfolioBreakdown, StockChart.

---

## /accounts — Accounts
**File:** [src/pages/Accounts.jsx](../src/pages/Accounts.jsx) (510 lines)
**Purpose:** Connected brokerages + custom asset management.

**Sections (top→bottom):**
1. **Page Header** — Title, "Import CSV" button, "Add Custom Asset" button.
2. **Net Value Summary** — Investment value + custom asset gross/net + liabilities.
3. **Quick Stats** — Total Deposited, Net Contributions, top-2 account types by value.
4. **Institution Sections** (one per institution) — Header (logo, name, last sync, account count) + account table: Name, **Type (editable inline pill — TFSA/RRSP/RESP/RDSP/FHSA/LIRA/Margin/Cash)**, Holdings $, Cash, Total, Daily P&L, Currency, Remove.
5. **Custom Assets Table** — Asset name, type, value, liability, net value, included toggle, edit/delete.
6. **MetalsBreakdownSection** (if metals held) — Per-metal weights and values.

**Hooks:** `usePortfolioData`, `useLiveData`, `useAuth`.
**Subcomponents:** NetValueSummary, AssetAppraisalModal, MetalsBreakdownSection, InstitutionLogo.

---

## /performance — Performance
**File:** [src/pages/Performance.jsx](../src/pages/Performance.jsx) (103 lines)
**Purpose:** Returns analysis, monthly breakdown, by-account performance.

**Sections (top→bottom):**
1. **Page Header**.
2. **Stat Cards** — Total Return %, Realized Gains, Unrealized Gains, Period Start→End value.
3. **Portfolio Chart** — `PortfolioChart` (timeline w/ benchmarks dropdown including new **CPI_CA / CPI_US**).
4. **Two-Column Grid:**
   - **Monthly Returns Table** — Month × P&L % + absolute.
   - **Performance by Account** — Account-type/institution rollup.

**Hooks:** `usePortfolioData`.
**Subcomponents:** PortfolioChart, MonthlyReturnsTable, StatCard, PnlValue.

---

## /transactions — Transactions
**File:** [src/pages/Transactions.jsx](../src/pages/Transactions.jsx) (437 lines)
**Purpose:** Transaction log with filtering, transfer editing, tax export.

**Sections (top→bottom):**
1. **Page Header** — "Export for Taxes" button.
2. **TransactionAIAssistant** — Optional AI-powered analysis.
3. **Filter Controls** — Type · Account · Institution · Currency · Ticker · Status.
4. **Transactions Table** — Date, Type (icon + transfer context), Ticker, Security, Status badge, Qty, Price, Total, Fees, Account, Institution, Edit.
5. **Expanded Transaction Detail** (click row) — Trade info, position impact (was position closed?), realized G/L link, account context, totals, `SecurityHistoryPanel` chart.
6. **Inline Transfer Edit** (transfer/deposit/withdrawal types only) — Source/destination dropdowns + notes.

**Hooks:** `usePortfolioData`.
**Subcomponents:** TransactionAIAssistant, SecurityHistoryPanel, TaxExportModal, DraggableTableHeader.

---

## /insights — Insights (ETF X-Ray)
**File:** [src/pages/Insights.jsx](../src/pages/Insights.jsx) (~340 lines)
**Purpose:** Lookthrough to underlying holdings + true exposure analysis.

**Sections (top→bottom):**
1. **Page Header** — *"ETF X-Ray — see your true exposure once we look through every fund you hold."*
2. **HealthScoreCard** — 0–100 score, grade, expandable factors (diversification, concentration, cash, etc.).
3. **Hero Stats** — ETFs Held · Underlying Stocks Touched · Overlapping Positions · Concentrated >8%.
4. **Empty State** (if no ETFs held) — Prompt to buy any ETF.
5. **Search Bar** — Filter by ETF/fund/underlying ticker.
6. **Two-Pane Layout:**
   - **Left (3/5):** `EtfXRayCard` per held ETF. Header (ticker, name, $, % of portfolio, overlap count) + expanded table (top-10 holdings, weight heatmap, your $ via this ETF, OVERLAP badges) + "You also hold directly" pill row.
   - **Right (2/5, sticky):** True Exposure table — Asset · Direct ($+%) · Via ETFs ($+%) · Total %. >8% concentration highlighted amber.

**Hooks:** `usePortfolioData`, `useCurrency`, `usePrivacy`.
**Engine:** `buildEtfXRay`, `calcTrueExposure`, `calcHealthScore`.

---

## /import — Import Center
**File:** [src/pages/ImportCenter.jsx](../src/pages/ImportCenter.jsx) (large; multi-step wizard)
**Purpose:** Upload broker CSV/Flex, review, save to Supabase. Also serves as the connection-management surface (Institutions tab is gone).

**Top-level surface (no active import):**
1. **PlaidSection** — Plaid Canada connect button, connected items.
2. **Session Result Banner** — Last completed import summary.
3. **"New Import" Button** — Starts wizard at step 1.
4. **ImportHistory** — Per-row: institution logo, filename, broker, row count, date, **Re-import button (works for ALL entries — reconstructs parsed bundle from stored data when no snapshot exists)**, Download CSV, Delete.

**Wizard steps (StepIndicator at top):**
1. **Upload** — Drop file(s).
2. **Map & Preview** — Column mapping, preview tabs (Holdings / Realized / Transactions).
3. **Securities** (if needed) — Two panels:
   - **Dual-Listing Panel** (NEW) — Lists every underlying with both US + CDR/TSX rows; per-row pills (US/CDR/TSX) to override classification.
   - **Ambiguity Panel** — Finnhub-verified candidates per ambiguous row + manual entry form.
4. **Accounts** — Map import accounts → existing accounts or create new.
5. **Transfers** (if any) — Resolve cross-account transfers.
6. **Confirm** — Final summary + save to Supabase.

---

## /tax — Tax Report
**File:** [src/pages/TaxReport.jsx](../src/pages/TaxReport.jsx) (331 lines)
**Purpose:** Capital gains, dividends, ACB, superficial loss detection.

**Sections:**
1. **Page Header** — Canadian tax disclaimer (50% inclusion, ACB, superficial loss).
2. **Summary Stats** — All-Time Net Gain, Dividend Income, TFSA/RRSP Sheltered, Superficial Losses count.
3. **ACB Table** — Per-ticker adjusted cost base, total shares, total cost, ACB/share, lot count (expandable).
4. **Per-Year Sections** (one per tax year): Net G/L, taxable inclusion (50%), dividend income, sheltered amount, **T5008 CSV export**, Capital Gains/Losses table, Dividends/Interest table.

**Hooks:** `usePortfolioData`.
**Engine:** `calcTaxSummary`, `calcACBByTicker`, `exportT5008CSV`.

---

## /instructions — Instructions
**File:** [src/pages/Instructions.jsx](../src/pages/Instructions.jsx) (145 lines)
**Purpose:** Bank-specific CSV export guides.

**Layout:**
- **Left:** Searchable list of banks with logos.
- **Right:** Selected bank — logo, supported export types, link buttons, numbered steps, screenshots placeholder, template downloads.

**Data:** `bankExportInstructions` (50+ institutions hardcoded).

---

## /privacy — Privacy & Data
**File:** [src/pages/PrivacyAndData.jsx](../src/pages/PrivacyAndData.jsx) (402 lines)
**Purpose:** Privacy commitments, data export, account deletion.

**Sections:**
1. **Page Header**.
2. **Hero Commitment Strip** — Read-only badge.
3. **Two-Column Grid** — What we store · Where data lives · Read-only connections · Demo & sample data.
4. **Export your data** — Full JSON · Holdings CSV · Transactions CSV · Realized CSV.
5. **Disconnect accounts** — Link to /import.
6. **Delete all data** — `DeleteConfirmModal` (2-step + checkbox).

---

## /community — Community
**File:** [src/pages/Community.jsx](../src/pages/Community.jsx) (108 lines)
**Purpose:** Discord invite hub.

**Sections:** Hero (Discord logo + Join button) · Why Join (4 cards) · Channels Preview · Footer note.

---

## /plans — Plans (also served standalone at unifolio.pro)
**File:** [src/pages/Plans.jsx](../src/pages/Plans.jsx) (~407 lines)
**Purpose:** Pricing & plan comparison.

**Sections (top→bottom):**
1. **Decorative Background** — `LoginBackgroundWheel` + ribbon wave + 50-floater snowglobe + corner gradient washes.
2. **Sign-in Link** (standalone unifolio.pro only) — Top-right.
3. **Hero** — Spinning logo + "Plans & Pricing".
4. **Billing Toggle** — Monthly / Annual (savings % badge).
5. **Plan Cards (3-col):**
   - **Starter** — Free.
   - **Pro** (highlighted) — $18/mo annual.
   - **Lifetime** — One-time **$346 USD / $480 CAD** (= 2 × annual × 0.8).
6. **Why Pro** — 4 benefit cards.
7. **FAQ** — 4 QA pairs.
8. **Bottom CTA** — `dev@unifolio.ca`.

---

## /settings — Settings
**File:** [src/pages/Settings.jsx](../src/pages/Settings.jsx) (~420 lines)
**Purpose:** Display, currency, security, notifications, account.

**Sections (top→bottom):**
1. **Demo Mode Notice** (logged out only).
2. **Account Card** — Avatar, name, email, role, link to /profile.
3. **Themes** — `ThemeSelector` · Accent Bars toggle · **Custom Cursor toggle (NEW)**.
4. **Data Cache & Retention** — `CacheManagement`.
5. **Currencies** — Default display currency · Available in switcher · FX rate status.
6. **Visible Accounts** — Per-account include/exclude toggles.
7. **Security & Privacy** — Change password · 2FA placeholder · sessions.
8. **Notifications** — Email Alerts · Price Alerts.
9. **Market Data** — Simulated data toggle.
10. **Session** — Sign Out.
11. **Danger Zone** — Export Holdings/Transactions/JSON · Delete Account (disabled).

---

## /profile — Profile
**File:** [src/pages/Profile.jsx](../src/pages/Profile.jsx) (327 lines)
**Purpose:** Personal details + photo + password.

**Sections:**
1. **Page Header**.
2. **ProfilePictureSection** — Avatar upload / Gravatar.
3. **Personal Details Card** — Full Name, Display Name, Email (with edit), Phone, Location, Bio + Save.
4. **Two-Column Grid** — Contact Snapshot · Account Access (change password).

---

## /reset-password — Reset Password
**File:** [src/pages/ResetPassword.jsx](../src/pages/ResetPassword.jsx) (161 lines)
**Purpose:** Set new password from email link.

**States:** Verifying → Ready (form) → Success (countdown redirect) → Expired (back to sign-in).

---

## (logged-out home) — Welcome
**File:** [src/pages/Welcome.jsx](../src/pages/Welcome.jsx) (370 lines)
**Purpose:** Sign in / sign up / forgot password / demo entry.

**Sections (top→bottom):**
1. **Backgrounds** — `LoginIridescentBackground` · `ThemedWaveBackground` (ribbon variant w/ auto-drift Lissajous cursor blob) · `LoginBackgroundWheel` · `LoginBrandReveal`.
2. **Logo Section** — Spinning `UnifolioWheelLogo` (120px) + alpha badge.
3. **Main Card** — Tabs (Sign In / Create Account) + email/password form, Remember me, Forgot password link, Sign In button.
4. **Forgot Password Form** — Email input + send-reset CTA + success state.
5. **Demo Button** — *"Continue without logging in"*.
6. **Privacy Note**.

---

## Cross-cutting Layout

### AppLayout shell
**File:** [src/components/layout/AppLayout.jsx](../src/components/layout/AppLayout.jsx) (51 lines)
Wraps every authenticated route:
1. **Sidebar** (left, lg+).
2. **Main outlet** (responsive padding; `/plans` renders full-bleed without padding wrapper).
3. **FloatingWindowManager** — Research/floating windows.
4. **Hidden Holdings** — Off-screen mount for the floating Holdings popout.
5. **ThemedWaveBackground** — `density='snowglobe'` on `/plans`, `density='app'` elsewhere.

### Sidebar + Topbar
**File:** [src/components/layout/Sidebar.jsx](../src/components/layout/Sidebar.jsx) (~587 lines)

**Desktop sidebar (w-56, fixed):**
- Header — Menu label, user avatar, close.
- **Primary nav:** Dashboard · Holdings · Accounts · Performance · Transactions · Insights · Import · Tax.
- **Utility nav:** Plans & Pricing · Community · Instructions · Privacy & Data · Settings.
- **Bottom strip:** Market status pill (green pulse open / red closed) · Privacy toggle · Currency selector · Account section (profile popover or sign-in CTA).
- **Accent bars** (left edge, theme-aware, toggleable).

**Topbar (h-14, fixed):**
- Left — Sidebar toggle + Unifolio wheel logo + market pulse.
- Center — Wordmark (when `topbarLogoVisible` is true).
- Right — Privacy toggle, Currency selector, Profile avatar (popover).

**Mobile drawer** — Hamburger overlay with the same nav tree.

**ProfilePopover** — Avatar + name + email · "My Profile" · "Settings" · "Sign Out".

### Global elements
- **CustomCursor** — Unifolio wheel cursor overlay (toggleable in Settings → Themes).
- **FloatingHoldings** — Holdings table can be popped out as a fixed window.
- **Toaster** — Bottom-right toast notifications.

### Context providers (in order, outside-in)
`ThemeProvider` → `SecondaryColorsProvider` → `AccentBarsProvider` → `TopbarLogoProvider` → `StarredStocksProvider` → `AuthProvider` → `QueryClientProvider` → `PortfolioDataProvider` → `LiveDataProvider` → `Router` → `SidebarProvider` → `CurrencyProvider` → `PrivacyProvider` → `ResearchWindowProvider` → `ProfilePictureProvider` → `FloatingHoldingsProvider`.

### Theming
48+ themes including 10 Pro-only living themes (animated tri-color backgrounds) + 1 Lifetime-only Glass theme (Apple Liquid Glass aesthetic). Random theme on app load for unauthenticated visitors and signed-in users with no saved preference.

---

## How to use this doc

When describing an issue, name the page + section number/name:
- *"Plans / section 5 — Pro card price wraps on mobile"*
- *"Holdings / section 5 — expanded row's Edit security dropdown is misaligned"*
- *"Insights / left pane — EtfXRayCard heatmap colors too faint"*
- *"Sidebar / utility nav — add 'Community' badge"*

If a section number isn't obvious from the markdown, use the section name as written above.
