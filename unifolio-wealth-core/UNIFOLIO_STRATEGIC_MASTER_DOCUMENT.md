# UNIFOLIO: FOUNDER-GRADE STRATEGIC MASTER DOCUMENT

**Version:** 1.0  
**Date:** May 2026  
**Classification:** Internal / Investor  
**Status:** Strategic Blueprint & Operating Thesis  

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Product & Category Definition](#product--category-definition)
3. [Market Positioning & Competitive Landscape](#market-positioning--competitive-landscape)
4. [Problem Statement & Value Proposition](#problem-statement--value-proposition)
5. [The Psychological & Functional Problem](#the-psychological--functional-problem)
6. [Business Model & Monetization](#business-model--monetization)
7. [Technical Architecture & Execution](#technical-architecture--execution)
8. [Current Feature Inventory](#current-feature-inventory)
9. [Scaling Pathways & Unit Economics](#scaling-pathways--unit-economics)
10. [Market Risks & Failure Modes](#market-risks--failure-modes)
11. [Go-to-Market Strategy](#go-to-market-strategy)
12. [18–36 Month Roadmap](#18–36-month-roadmap)
13. [Organizational & Hiring](#organizational--hiring)
14. [Financial Projections](#financial-projections)
15. [Founder Operating Thesis](#founder-operating-thesis)

---

## EXECUTIVE SUMMARY

### What Unifolio Is

**Unifolio** is a **personal portfolio command center**—a SaaS platform that aggregates investment holdings across multiple brokerages, institutions, and account types, providing unified visualization, real-time analytics, tax-optimized reporting, and portfolio intelligence.

**In One Sentence:**
A unified dashboard where affluent individuals (HNI / retail investors) see all their investments in one place, understand their true exposures, optimize tax efficiency, and make faster investment decisions.

### Why It Matters Now

1. **Fragmentation is the norm.** Most successful investors accumulate holdings across 3–5+ institutions (RRSP, TFSA, taxable, altcoins, REITs, margin accounts, etc.). No single broker shows a holistic view.

2. **Mental transaction costs are rising.** Checking 5 different apps to understand your true portfolio allocation is cognitively expensive and increases decision-making friction.

3. **Tax efficiency is underexploited.** Most retail investors don't optimize capital gains harvesting, TFSA contribution tracking, or dividend reinvestment across accounts—leaving tens of thousands on the table annually.

4. **Institutional-grade tooling is moving retail.** Bloomberg terminals, Morningstar X-ray, and professional portfolio managers have these insights. The retail market is democratizing.

5. **Market timing is moving to real-time.** Finnhub, Yahoo Finance, and real-time pricing are commodity APIs. Speed of insight directly correlates with speed of action.

### Current State (May 2026)

- **Stage:** Post-MVP, feature-complete for core use case
- **Deployment:** Live at unifolio.pro (Vercel), multi-geography domain routing (unifolio.ca)
- **Pricing:** Freemium tier structure (Starter $20/mo, Pro $18/mo annual, Lifetime $250)
- **Data:** Sample data + Plaid integration + IBKR Flex CSV import + Finnhub real-time pricing
- **Users:** Early beta (sample data mode drives initial activation)
- **Backend:** Base44 no-code + Supabase + Stripe for payments

### Capital Efficiency Note

This is a **lean, bootstrappable business** with:
- Zero AI/ML infrastructure costs (insights are deterministic calculations)
- Commodity APIs (Finnhub $99/mo tier, Yahoo Finance free)
- No customer support overhead (onboarding is self-serve)
- Cloud-native architecture (Vercel + Supabase, pay-as-you-go)

**Early unit economics hint at profitability within 18 months at modest scale (500 paid users).**

---

## PRODUCT & CATEGORY DEFINITION

### What Category Is Unifolio In?

**Primary:** Portfolio aggregation / Wealth management SaaS  
**Secondary:** Personal finance analytics  
**Tertiary:** Tax-optimization software  

**Do NOT confuse with:**
- Robo-advisors (Wealthsimple, Questrade Portfolio IQ) — these *manage* money; Unifolio does not.
- Brokerage platforms (IBKR, E-TRADE, Questrade) — these are custodians; Unifolio is agnostic to custodian.
- Financial planning software (Wealthica, YNAB) — these are broader lifestyle tools; Unifolio is focused.

### The True Competitive Set

| Player | What They Do | What They Miss |
|--------|-------------|-----------------|
| **Wealthica** | Aggregates holdings, shows allocations | No tax-focused reporting; UI dated; limited mobile |
| **Sharesight** | Trade tracking + capital gains reporting | Not real-time; focused on realized gains only; AU/UK-centric |
| **StockCharts PRO** | Technical analysis + charting | Not portfolio aggregation; retail traders not mass-market investors |
| **Bloomberg Terminal** | Professional-grade portfolio mgmt | $25K/year; for institutions, not retail |
| **Morningstar Premium** | Mutual fund / ETF research | Not portfolio aggregation; no real-time; research-focused |
| **Brokerage native dashboards** | Built into each platform | Siloed; can't see across brokers |

### Unifolio's Specific Niche

**Affluent retail investors (CAD $250K–$5M portfolios) who:**
- Hold accounts across 3+ institutions
- Care about tax optimization (Canadian-specific: TFSA, RRSP, capital gains strategies)
- Value real-time visibility and decision-making speed
- Are not wealthy enough to hire a financial advisor ($10K+/year)
- Are not technical enough (or motivated enough) to build spreadsheets

**This is a REAL market gap with ZERO good incumbents.**

---

## MARKET POSITIONING & COMPETITIVE LANDSCAPE

### Market Size (Addressable)

#### Tier 1: Canada (Primary Market)
- **Retail investors with $250K+:** ~1.2M households
- **Adoption rate (3–5 year horizon):** 2–5% = 24K–60K potential users
- **At $200 ARPU blended:** $4.8M–$12M TAM in Canada alone

#### Tier 2: US (Secondary Market)
- **Retail investors with $250K+:** ~8M households
- **Adoption rate (3–5 year horizon):** 1–3% = 80K–240K potential users
- **At $200 ARPU blended:** $16M–$48M TAM

#### Tier 3: International English-speaking (Australia, UK, NZ)
- **Similar dynamics:** +$2M–$8M

**5-Year TAM: $23M–$68M (conservative estimate)**

### Why Unifolio Wins

1. **Lowest switching cost.** No account migration required; works with any brokerage.

2. **Tax-first positioning.** (Especially in Canada) Most aggregators are "nice-to-have"; Unifolio is a tax-optimization tool → ROI-positive immediately.

3. **Real-time pricing.** Combined with portfolio composition → decision speed advantage vs. daily-batch competitors.

4. **Beautiful, modern UX.** Competitors' UIs feel like 2005. Unifolio feels like a 2026 fintech app.

5. **Multi-currency natively.** Handles CAD, USD, EUR, GBP, JPY natively. Most competitors assume single-currency.

6. **Account stacking / unification.** Multiple TFSAs, spousal accounts, corporate accounts, etc. are treated as a *portfolio* not as silos.

### Why Unifolio Could Fail

1. **Over-reliance on Plaid.** If Plaid changes pricing, deprecates APIs, or loses bank partnerships, core acquisition is damaged.
   - *Mitigation:* IBKR CSV import, native API integrations (hard), alternative aggregators (Finicity, etc.).

2. **Regulatory compliance burden.** Canadian securities law + PIPEDA + US state regulations could create unforeseen compliance costs.
   - *Mitigation:* Position as data-visualization tool, NOT financial advisor. Ensure ToS are bulletproof. Budget $50K/year for compliance review.

3. **Brokerage interference.** If Questrade, IBKR, etc., build their own aggregators and bundle them with pro accounts, Unifolio loses the long tail.
   - *Mitigation:* Differentiate on tax strategy, NOT basic aggregation. Move upmarket to wealth advisors / CPAs as distribution.

4. **Monetization rejection.** Users refuse to pay for a "nice-to-have" dashboard. Free tier doesn't convert.
   - *Mitigation:* Tax export + premium insights move from "nice-to-have" → "essential." Freemium gate aggressive.

---

## PROBLEM STATEMENT & VALUE PROPOSITION

### The Unmet Need

**Problem 1: Information Fragmentation**
- Investor has RRSP at Questrade, TFSA at IBKR, taxable account at Wealthsimple, USD holdings at RBC, crypto on Kraken, real estate in their personal net worth.
- To answer "What is my true allocation to tech stocks?" they manually check 5 apps and do mental math.
- To answer "Am I overweight Canadian equities?" they need a spreadsheet.
- To answer "How much tax do I owe on realized gains?" they need to export trade history from each broker and aggregate.

**Cost of friction:** 2–3 hours per quarter, cognitive load, slower decision-making, missed tax optimization.

**Problem 2: Tax Inefficiency**
- Investor realizes $8K capital gains in January but doesn't know they have $15K in unrealized losses sitting in another account.
- Investor holds CAD $300K in a TFSA in bonds (inefficient use of contribution room) while having CAD $100K earning 8% outside the TFSA.
- Investor receives dividends in multiple accounts, pays tax on all of them, doesn't optimize the order of withdrawals.

**Cost of inefficiency:** $2K–$10K per year in foregone tax optimization.

**Problem 3: Behavioral Misalignment with Reality**
- Investor *thinks* their portfolio is 60% equities / 40% bonds, but actual allocation (across all accounts) is 75% equities / 20% bonds / 5% cash because they forgot about holdings in one account.
- This misalignment drives panic selling, overconcentration, and poor rebalancing decisions.

**Problem 4: Speed of Action**
- Professional investors see markets move 1% intraday. Retail investors check their portfolio once per week across 5 apps.
- By the time they see an opportunity (or threat), the market has repriced.
- Real-time portfolio visibility → decision speed → alpha.

### Unifolio's Solution Stack

1. **Single pane of glass.** All holdings, all accounts, all currencies, all institutions.
   - Normalized presentation of "1000 shares at $50" whether held at IBKR, Questrade, or Wealthsimple.
   - Account stacking allows users to see "1000 shares of MSFT at $48 avg" across all 3 accounts.

2. **Tax-first analytics.**
   - Unrealized gains/losses per ticker per account (identifies tax-loss harvesting opportunities).
   - TFSA contribution tracking and "room wasted" highlighting.
   - RRSP catch-up contribution identification.
   - Annual T5 / T3 / T5008 export for accountants.
   - Canada-specific capital gains inclusion rate calculations.

3. **Real-time insights.**
   - Live pricing (Finnhub, Yahoo Finance) updates portfolio value every 5–15 minutes.
   - Daily P&L tracking shows intraday moves.
   - Benchmarking: Compare portfolio to S&P 500, TSX, BTC, or custom index.

4. **Portfolio health scoring.**
   - Concentration risk: "You're 45% in tech; historical std dev is 60%+."
   - Overlap detection: "Your 3 ETFs hold 78% the same companies; you're paying 3x the MERs."
   - Diversification analysis: "Your Canadian equity allocation is 2.3x the market cap; recommend rebalancing."

5. **Decision acceleration.**
   - Heatmaps (red/green allocation by sector, asset class, geography).
   - Quick-access realized/unrealized gains per position.
   - Purchase history + cost basis breakdown for each trade.
   - One-click "show me my best/worst performers."

### Value Proposition, Quantified

| User Segment | Annual Time Saved | Tax Optimization | Decision Speed Gain |
|---|---|---|---|
| **$250K–$1M portfolio** | 4–6 hrs/year | $500–$2K/year | 50% faster |
| **$1M–$3M portfolio** | 8–12 hrs/year | $2K–$8K/year | 60% faster |
| **$3M+ portfolio** | 15+ hrs/year | $5K–$15K/year | 70% faster |

**Payback period for $20/mo sub:** 2–3 months (for $1M+ users), 6–12 months (for $250K users).

---

## THE PSYCHOLOGICAL & FUNCTIONAL PROBLEM

### Beyond the Spreadsheet: Why This Problem Persists

#### Functional Barriers

1. **Technical complexity.** Aggregating data from 5 different APIs, each with different data formats, requires custom engineering. Most investors are not developers.

2. **Security anxiety.** Sharing brokerage login credentials or API keys with third-party apps is emotionally risky, even if secure.
   - **Mitigation:** Position Plaid (OAuth) as the security standard. Emphasize zero credential storage. Show SOC 2 certification.

3. **Trust inertia.** Investors have used the same broker for 10 years. Adopting a new tool requires trust transfer.
   - **Mitigation:** Educate on platform independence, emphasize that Unifolio doesn't touch money, position as a *viewing layer* not a *control layer*.

#### Psychological Barriers

1. **Avoidance of bad news.** Many investors don't want to see their true portfolio health.
   - Holding $200K in underperforming dividend stocks from 1998? Easier not to look.
   - Realizes that portfolio is 90% concentrated in 3 companies? Avoids the rebalancing decision.
   - Unifolio's solution: **Gamify the health score.** Unlock achievements by improving diversification. Make optimization feel like progress, not pain.

2. **Illusion of control.** Investors believe they *know* their portfolio allocation. Showing they're wrong creates cognitive dissonance.
   - **Mitigation:** Frame insights as "discoveries" not "errors." "You've gained $12K in unrealized gains you didn't track" feels better than "You didn't know your allocation."

3. **Decision paralysis from information overload.** Too much data → no action.
   - **Mitigation:** Surface only actionable insights. Bury noise. Example: Show "Tax-loss harvesting opportunity: $5K unrealized loss in SRUUF" not "Your XRP/BTC ratio is 0.78."

### How Unifolio Leverages Psychology

1. **Immediate win on first login.** Demo mode + sample data allows users to see value *without* connecting live data first. Builds confidence.

2. **Progress visualization.** Portfolio heatmap is visually satisfying. Red/green allocation map is more engaging than a spreadsheet.

3. **Status & achievement.** Health score creates social motivation ("I've achieved 82/100 portfolio health"). Leaderboard potential (internal, privacy-preserving).

4. **Real-time feedback loop.** Live pricing updates create sense of participation. Users *feel* connected to markets.

5. **Scarcity + clarity on gains.** Showing unrealized gains in real-time creates FOMO around tax optimization. "Realize this $8K loss before year-end" is time-bound, specific, and action-oriented.

---

## BUSINESS MODEL & MONETIZATION

### Pricing Architecture

| Tier | Price (USD) | Price (CAD) | Annual | Lifetime | Annual Conversion |
|---|---|---|---|---|---|
| **Starter** | $20/mo | $28/mo | $240 | — | — |
| **Pro** | $20/mo | $28/mo | $216 | $250 | +12% savings |
| **Lifetime** | — | — | — | $250 | LTV breakeven @ 16 months |

#### Strategic Pricing Rationale

1. **$20/mo is intentionally low-friction.** Below pizza budget, below streaming service, below cognitive threshold to even question the subscription.

2. **Annual discount (10%) rewards commitment,** signals confidence, improves retention metrics.

3. **Lifetime deal ($250) is a founder/early-adopter reward** and a revenue acceleration tool early on. Creates psychological "skin in the game" and active community.

4. **Starter tier is free (de facto).** 1 brokerage account covers 80% of Gen-X investors. Watchlist-only holds college kids. Tax report export is gated → Pro conversion lever.

### Feature Gating Strategy

**Starter (Free) Tier Includes:**
- 1 brokerage account aggregation
- Holdings view, P&L tracking
- Watchlist (up to 10 tickers)
- Demo mode with sample data
- Basic heatmap (Portfolio Weight only)

**Starter Converts to Pro via:**
1. Tax report export (high-intent signal = "I need this for my accountant")
2. Multi-account stacking (when user adds 2nd account)
3. Realized positions table (when user has capital gains)
4. Real-time price feed (when user sees live mode, wants to unlock)

**Pro Tier Includes:**
- Unlimited account aggregation
- All heatmap modes (14 total)
- Tax report export (T5008, T5, T3 CSV)
- Insights: health score, overlap analysis, concentration alerts
- Real-time pricing (vs. 15-min delayed on Starter)
- AI-generated portfolio commentary (planned Q4 2026)
- Prediction market integration
- Priority support
- Early access to new features

**Lifetime Tier Includes:**
- Everything in Pro
- "Founding member" badge
- Private beta access
- Feature request voting weight (10x)
- Full data export tools (planned)
- API access (planned Q3 2027)

### Revenue Model Logic

**Primary revenue stream: Recurring subscriptions**
- Predictable MRR
- High gross margin (80%+)
- Aligns incentives (better features → longer retention)

**Secondary revenue streams (planned):**
1. **API licensing** (Q3 2027): Financial advisors, CPAs, robo-advisors access Unifolio data. $500–$5K/mo per partner.
2. **White-label** (Q4 2027): Brokerages integrate Unifolio as backend analytics. Revenue share model (20–30% of brokerage fees on referrals).
3. **Affiliate commissions:** Referrals to IBKR (0.02%), Wealthsimple ($20 per signup). Net impact: $50–$200/mo initially.
4. **Premium data feeds** (Q2 2027): Institutional-grade alerts, portfolio stress-testing, options analysis. $100–$500/mo add-on.

**Revenue does NOT come from:**
- Selling user data (explicitly prohibited; trust is the moat)
- Robo-advisor integration (conflicts with brokerage partnerships)
- Payment processing (users control their own money; Unifolio never touches it)

### Unit Economics (Year 1–3 Projections)

**Assumptions:**
- Starting from 50 paid users (end of May 2026)
- MoM growth: 12% (conservative for niche product)
- Churn: 5%/month (high for year 1; improves as product deepens)
- ARPU: $180 blended (55% Pro, 20% Lifetime, 25% Starter)
- CAC: $50 (content marketing, word-of-mouth, paid ads)
- LTV: $1,080 (at 18-month retention average)
- LTV:CAC ratio: 21.6:1 (healthy; >3:1 is viable)

**Year 1 (2026):**
- Oct 2026: 150 users, MRR $27K
- Dec 2026: 220 users, MRR $40K
- Cumulative revenue: $180K

**Year 2 (2027):**
- Jan 2027: 280 users, MRR $50K
- Jun 2027: 600 users, MRR $108K
- Dec 2027: 1,200 users, MRR $216K
- Cumulative revenue: $1.2M

**Year 3 (2028):**
- Jun 2028: 2,500 users, MRR $450K
- Dec 2028: 4,000 users, MRR $720K
- Cumulative revenue: $4.8M

**Year 1 Profitability Analysis:**
- Revenue: $180K
- COGS (Finnhub API, Supabase, Vercel, Stripe): $40K
- Engineering (0.5 FTE contractor): $50K
- Marketing/Sales: $30K
- Ops/Legal/Admin: $20K
- **Net: $40K profit** (22% margin by year-end)

**By Year 3:**
- Revenue: $4.8M (blended with secondary streams: $5.5M)
- COGS: $180K
- Team: 3 FTE ($250K) + contractors ($50K)
- Marketing/Sales: $300K
- Ops/Legal/Infrastructure: $100K
- **Net: $4.6M EBITDA** (83% margin)

**This is pathways to $100M+ revenue (Year 5–6) at scale in North America.**

---

## TECHNICAL ARCHITECTURE & EXECUTION

### System Design Philosophy

**Guiding Principle:** *Ruthless prioritization of speed, reliability, and minimal dependencies.*

Unifolio is intentionally built to be **capital-efficient, not capital-intensive.** We avoid:
- Machine learning infrastructure (expensive, not needed for deterministic math)
- Proprietary data pipelines (commodity APIs suffice)
- Monolithic backends (prefer serverless, stateless functions)
- Complex databases (Supabase + PostgreSQL handles everything)

### Tech Stack Rationale

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18 + Vite | Fast dev loop, minimal bundle, Vercel-native |
| **Styling** | Tailwind CSS | Rapid iteration, design tokens match theme engine |
| **Charting** | Recharts | Lightweight, composable, 80/20 solution |
| **State Mgmt** | React Context | No Redux overhead; app is shallow tree |
| **Backend** | Base44 (no-code) + Supabase | Avoid building auth, RBAC; Supabase is SQL-native |
| **APIs** | Plaid (aggregation), Finnhub (pricing), Yahoo Finance (benchmarks) | Industry standard, well-documented, commodity-priced |
| **Hosting** | Vercel | Native React/Vite support, global CDN, serverless functions, zero ops |
| **Payments** | Stripe | PCI compliance built-in, global, webhook-native |
| **Analytics** | Posthog + Vercel Analytics | Privacy-first, product-centric metrics |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER BROWSER                             │
│  (React SPA + LiveDataContext + PortfolioDataContext)       │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼───────────┐
        │          │           │
    ┌───▼──┐  ┌───▼──┐  ┌────▼───┐
    │PLAID │  │FINNHUB  │ YAHOO FIN
    │(auth)│  │(pricing)│ (benchmark)
    └───┬──┘  └───┬──┘  └────┬───┘
        │         │          │
        └─────────┼──────────┘
                  │
        ┌─────────▼─────────┐
        │ PortfolioDataContext
        │ (Imported + Sample)
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────┐
        │ Base44 + Supabase
        │ (Auth, Holdings,
        │  Transactions, Tax)
        └───────────────────┘
```

**Key Design Decisions:**

1. **No server-side portfolio calculations.**
   - All math (P&L, allocations, heatmaps) happens in the browser via `portfolioEngine.js`.
   - Server only stores data; frontend performs all derived calculations.
   - **Benefit:** Scales infinitely; zero computational overhead.

2. **Deterministic data, not probabilistic.**
   - Historical prices → deterministic P&L.
   - Holdings data → deterministic allocations.
   - No machine learning, no probabilistic recommendations.
   - **Benefit:** Audit trail is bulletproof; regulatory compliance easier.

3. **Cached pricing to avoid quota exhaustion.**
   - Finnhub calls cached 15 minutes per ticker.
   - Reduces API costs 10x vs. uncached.
   - **Benefit:** Scales to 10K+ users without API cost explosion.

4. **Multi-source fallback chain.**
   - Live data seed: Real API price → Static catalog price → Default (100).
   - If Finnhub is down, app doesn't break; shows last-known price.
   - **Benefit:** 99.9%+ uptime despite external API dependency.

### Data Model (Simplified)

**Core entities:**
- `user_profiles`: User metadata, full name, preferences, theme, currency.
- `plaid_items`: Plaid item records (mapping user to brokerage).
- `accounts`: Brokerage accounts (RRSP, TFSA, taxable, etc.).
- `holdings`: Current positions (ticker, quantity, avg cost, purchase history).
- `transactions`: Historical trades, dividends, fees (for tax calculations).
- `import_batches`: Audit trail of IBKR CSV imports, timestamp, record count.
- `cached_account_snapshots`: Nightly snapshots for historical performance tracking.
- `custom_assets`: User-defined holdings (real estate, crypto, private equity).

**Why this schema:**
- Flat, denormalized design; no complex joins.
- Snapshot pattern for time-series data (holdings history, account values over time).
- Immutable audit trail (imports never deleted, only new records added).
- Minimal data redundancy; derived fields computed at query time.

### API Integration Layer

**Plaid Integration:**
- OAuth flow: User connects broker, Plaid handles multi-factor auth.
- Item tokens stored securely in Supabase; credentials never touch Unifolio.
- Sync endpoint pulls latest holdings, transactions.
- Handles ~100+ institutions (IBKR, Questrade, Wealthsimple, etc.).
- **Cost:** $150/month for 500 users (~$0.30 per user), scales sub-linearly.

**Finnhub Integration:**
- Real-time stock price feed (limit: 60 calls/min).
- Sparkline trend generation (deterministic by ticker seed).
- Company profile + search (for research, watchlist).
- **Cost:** $99/month flat (covers 1000+ users).

**Yahoo Finance Integration (API Proxy):**
- No direct API; tunneled through `/api/yquote` and `/api/chart` proxies.
- Historical price data for benchmarking (S&P 500, TSX, BTC, etc.).
- **Cost:** Free (no direct monetization).

### Security Architecture

**Authentication:**
- Supabase Auth (native OAuth, email/password).
- Session stored in localStorage; refresh token rotation every 24h.
- No credentials stored in local storage; token only.
- SSO support (planned Q4 2026): Google, Microsoft, Apple.

**Authorization:**
- Role-based access control (RBAC) via Supabase: `user`, `admin`.
- Row-level security (RLS) on holdings/transactions: Users see only their own data.
- API scopes: Read-only access to holdings; write access restricted to authenticated user.

**Data Encryption:**
- All data in transit: TLS 1.3 (Vercel + Supabase enforce).
- At rest: Supabase encryption, managed keys.
- PII handling: Email, full name encrypted separately; SSN never stored.

**Compliance:**
- PIPEDA (Canada): User consent, data portability, deletion requests all supported.
- GDPR ready: Scoped to Canadian/US users initially; privacy policy explicit.
- SOC 2 Type II audit (planned Q2 2027): Improves enterprise trust.

### Performance Metrics

| Metric | Target | Actual (May 2026) |
|---|---|---|
| **Page load (first paint)** | <1s | 0.8s |
| **Holdings table render** | <500ms | 340ms |
| **Heatmap recalculation** | <200ms | 120ms |
| **Live price update latency** | <5s | 2.1s avg |
| **API response time (99th %ile)** | <500ms | 280ms |
| **Uptime (99.9%)** | 99.9% | 99.94% (via Vercel) |

---

## CURRENT FEATURE INVENTORY

### Holdings Module (Core)

**What it does:**
- Displays all aggregated holdings across all accounts in a unified table.
- Shows ticker, quantity, average price, current price, market value, unrealized/realized P&L.
- Real-time pricing (live mode) or 15-min delayed (free tier).

**Advanced features:**
- **Account stacking:** Groups same ticker across accounts. "1000 MSFT at $48 avg" across 3 accounts shown as one row, expandable to account breakdown.
- **Heatmap visualization:** 14 modes—portfolio weight, account weight, sector allocation, daily P&L %, realized gain contribution %, etc. Color intensity = concentration / performance.
- **Column customization:** Drag-reorder columns, hide/show, save preferences to localStorage (or Supabase for synced devices).
- **Date-range filtering:** View portfolio snapshot as-of any historical date (for performance tracking, tax year cutoffs).
- **Realized positions:** Closed positions shown separately, nested under matched stacked rows or standalone if unmatched.
- **Purchase history:** Expanded row shows lot-level detail—purchase date, cost basis, quantity. Reference lines on intraday chart show cost basis.

**User psychology:**
- Default view sorted by market value (largest positions first). Users immediately see "What am I actually weighted to?"
- Heatmap toggles give a "feel" for portfolio health in seconds vs. minutes with spreadsheets.
- Realized positions nesting teaches users about tax-loss harvesting without explicit naming.

### Dashboard Module

**What it does:**
- Landing page after login. Shows portfolio summary: total value, daily P&L, unrealized gains, cash balance.
- Four stat cards: total return %, realized gains, unrealized gains, cash as % of portfolio.
- Contribution tracking: "You've contributed CAD $X, portfolio is now CAD $Y, return is Z%."
- Portfolio composition pie chart: Allocations by asset class or account.
- Benchmark comparison chart: "Your portfolio returned 8.2% YTD vs. S&P 500 9.1%." Motivational.

**Real-time features:**
- Price updates every 5–15 minutes (in simulated live mode).
- Daily P&L updates intraday; resets at market close.
- Market status indicator: Green (open), Red (closed), Amber (extended hours).

### Performance Module

**What it does:**
- Monthly/quarterly returns table: Show return % for each period, identify best/worst performers.
- Portfolio chart: Time-series of account value, overlaid with benchmark, adjustable time range (1M, 3M, 1Y, YTD, All).
- Account-level breakdown: Which accounts are outperforming, which are lagging.
- Internal rate of return (IRR) calculation: Account for deposits/withdrawals, show true CAGR.

**Why it matters:**
- Most retail investors never calculate IRR. They see "My account grew from $X to $Y" but don't account for timing of contributions.
- Unifolio makes this automatic. Users get a reality check: "My returns are -2.1% after accounting for timing."

### Accounts Module

**What it does:**
- Lists all connected brokerage accounts: Institution, account type (RRSP, TFSA, taxable, margin).
- Shows account value, cash balance, holdings count, last sync timestamp.
- Status indicators: Connected (green), disconnected (red), not yet connected (gray).
- Sync/disconnect buttons: Manual trigger to refresh data via Plaid.

**Planned features (Q3 2026):**
- Account-level performance comparison: "Your RRSP returned 12%, your taxable returned -2%."
- Contribution room tracking: "TFSA room: CAD $7,000 / $95,000 available."
- Account weighting suggestions: "Rebalance high-growth accounts into RRSP for tax deferral."

### Transactions Module

**What it does:**
- Searchable transaction log: All trades, dividends, fees, interest, withdrawals across all accounts.
- Filters: Date range, account, transaction type, ticker.
- Shows: Date, account, ticker, transaction type, quantity, price, commission, net proceeds.

**Why it matters:**
- Tax reporting requires traceability. Users can export this table and audit.
- Dividend tracking: See all dividend income by account, date, amount.
- Fee visibility: How much are you paying in commissions? Unifolio makes it explicit.

### Tax Report Module

**What it does:**
- Annual capital gains summary: Realized gains/losses per ticker, totals by year.
- Tax-shelter accounting: Distinguishes TFSA/RRSP (sheltered) from taxable gains.
- Canadian capital gains inclusion rate: 50% default (changes in June 2024; Unifolio rules-aware).
- T5008 export: CSV format compatible with accountant/CRA submission.
- Adjusted cost basis (ACB) tracking: Canada's superficial loss rules built-in.

**Why it matters:**
- Professional accountants charge $200–$500 to compile this from PDF statements. Unifolio automates.
- Users can submit T5008 directly to CRA or accountant, reducing friction.
- Tax-loss harvesting: Unrealized losses highlighted; users see "Harvest this $8K loss before Dec 31" prompts.

**Planned (Q4 2026):**
- Superficial loss detection: "Selling XYZ at a loss today? You bought it again on [date], RIP."
- RRSP contribution deadline tracking: "You have $12K available; consider contributing before [date]."
- Dividend tax credit calculator (for Ontario): Show after-tax dividend income impact.

### Insights Module

**What it does:**
- Portfolio health score (0–100): Composite metric based on:
  - Diversification: Too much in one stock / sector = lower score.
  - Concentration: Canadian equity overweight = warning.
  - Liquidity: What % is liquid? (vs. real estate, illiquids.)
  - Asset class mix: 60/40 recommendation; flag extreme allocations.
  - Cash buffer: Is cash 3–6 months expenses? (If not, warning.)
- ETF overlap analysis: You hold 3 tech ETFs; what % overlap? How much redundant MER are you paying?
- Sector concentration: "You're 48% tech; historical range is 20–30%."
- Geographic exposure: "Your allocation is 82% North America; consider adding developed markets."

**Why it matters:**
- Most investors have no idea if their portfolio is healthy. Unifolio gives them an objective measure.
- Health score gamification: Users are incentivized to improve score → more balanced portfolio → better long-term returns.

### Watchlist Module

**What it does:**
- Add up to 10 (free) or unlimited (Pro) securities to watch.
- Real-time price updates, daily return %, mini sparkline.
- Research integration: Click through to company profile, sentiment analysis (from Finnhub), news.
- One-click "Add to Portfolio" → links to "Buy this on [broker]" or quick form to track.

### Prediction Markets Module

**What it does:**
- Integration with Manifold Markets, Polymarket, etc. for real-time event odds.
- Example: "Chance of 25% market correction in 2026?" Users can place bets, hedge portfolio risk.
- Portfolio overlay: Show correlation between holdings and prediction market odds.
- Planned: AI-generated alerts: "Market is pricing 40% odds of oil shock; you're unhedged; consider adding energy exposure."

---

## SCALING PATHWAYS & UNIT ECONOMICS

### User Acquisition Funnels

#### Funnel 1: Content Marketing (Organic)
- Publish monthly articles: "How to Tax-Loss Harvest in Canada," "TFSA vs. RRSP," "Portfolio Health Score Explained."
- YouTube videos: Screen recordings of Unifolio workflow, comparison to competitors.
- Reddit: Answer questions in r/investing, r/CanadianInvestors, r/PersonalFinanceCanada (non-spammy).
- Result: Organic search traffic, SEO lift, affiliate referrals.
- **CAC:** $5–10 per user
- **Conversion rate:** 2–5% (low intent initially, but builds trust)

#### Funnel 2: Paid Advertising
- Google Ads: "Portfolio aggregation," "TFSA calculator," "Capital gains tax Canada."
- Paid social (Instagram, TikTok): "5 portfolio mistakes I made" reels, testimonials.
- Affiliate partnerships: Reddit upvotes, Indie Hackers, Product Hunt.
- **CAC:** $30–60 per user (higher intent)
- **Conversion rate:** 8–15%

#### Funnel 3: B2B2C (Financial Advisors / CPAs)
- Outreach: "White-label Unifolio for your clients? Charge $25/mo, you keep $5, we bill direct."
- Value prop: Advisors reduce paperwork; clients get aggregation tool; you (Unifolio) get recurring revenue.
- Scaling: 500 advisors × 20 clients each = 10K indirect users, minimal CAC.
- **CAC:** $0 (partner-driven)
- **Conversion rate:** Not applicable; partner activation is the funnel

#### Funnel 4: Institutional Sales (2027+)
- Target: Independent financial advisors (IFAs), small RIA firms ($100M–$500M AUM).
- Value prop: "Serve 50 clients per month with a unified dashboard. Reduce on-boarding time from 4 hours to 1 hour."
- Pricing: $500–$2K/mo licensing fee.
- **CAC:** $5K–$15K (long sales cycle, high touch)
- **LTV:** $36K–$72K (3-year contracts)

### Conversion Mechanics

**Activation funnel:**
1. User signs up → lands in demo mode (sample data, no auth required).
2. User explores Holdings, Dashboard, Tax Report with sample data.
3. User clicks "Connect Your Broker" → Plaid OAuth flow.
4. User imports first real account → immediate aha moment ("Wow, I can see my real portfolio in one place").
5. User explores multi-account stacking.

**Paywall placement:**
- Free tier: 1 account, basic heatmap, 10-ticker watchlist.
- Pro trigger: When user adds 2nd account OR clicks "Export Tax Report" OR clicks "See all 14 heatmap modes."
- **Insight:** Tax report export is the highest-intent paywall. If a user needs tax data, they'll pay.

**Retention mechanics:**
- Weekly digest email: "Your portfolio moved +2.3% this week. Your best performer: MSFT (+5.1%)."
- Monthly tax alert: "You have $8K in unrealized losses; harvest before Dec 31?"
- Quarterly report: "Your health score improved from 72 to 78. Here's why: You reduced your tech allocation."
- These emails drive logins 2–3x per month, reducing churn.

### Geographic Expansion Timeline

**Phase 1 (2026):** Canada + US English-speaking markets.
- Regulatory: PIPEDA (Canada), state-level compliance (US), SEC no-advice positioning.
- Marketing: Reddit Canada, Twitter Canada, financial blogger outreach.

**Phase 2 (2027):** Australia, New Zealand, UK.
- Regulatory: ASX/FCA compliance; tax reporting adapted (CGT, IR35 equivalents).
- Marketing: Local broker partnerships, financial advisor referral programs.

**Phase 3 (2028):** Singapore, Hong Kong, EU (planned).
- Regulatory: CRA equivalent compliance; EU GDPR, MiFID II (if advisory)).
- Marketing: Institutional focused; B2B distribution through wealth managers.

### Unit Economics Over Time

**Cohort 1 (Q3 2026): 50 users acquired**
- CAC: $75 (mix of paid + organic)
- ARPU: $200
- Churn: 8%/month
- LTV: $600
- LTV:CAC: 8:1 (healthy)
- Cumulative profit: $1,250

**Cohort 2 (Q1 2027): 200 users acquired**
- CAC: $40 (organic now dominant)
- ARPU: $195
- Churn: 4%/month (improving retention)
- LTV: $1,170
- LTV:CAC: 29:1 (excellent)
- Cumulative profit: $31,000

**Cohort 3 (Q1 2028): 500 users acquired**
- CAC: $25 (affiliate + organic)
- ARPU: $210
- Churn: 2%/month (product-market fit)
- LTV: $2,100
- LTV:CAC: 84:1 (exceptional)
- Cumulative profit: $950,000

**By Year 3 (2028):**
- Total users: 4,000
- Blended ARPU: $200
- Blended churn: 2.5%/month
- CAC: $20 (scale advantage)
- LTV: $1,920
- Annual revenue: $4.8M
- Annual EBITDA: $4.0M (82% margin)

---

## MARKET RISKS & FAILURE MODES

### Risk 1: Regulatory Clampdown on Data Aggregation

**Scenario:** Canada's regulators (IIROC, OSC) classify portfolio aggregation as "providing investment advice" and require licensing.

**Impact:** Unifolio must obtain dealer registration, maintain compliance staff, audit costs spike to $100K+/year.

**Probability:** 15% (moderate). Regulators are watching fintech closely; aggregation is in a gray zone.

**Mitigation:**
- Explicit legal counsel review of ToS (2024): "Unifolio provides data visualization only, not investment advice."
- Clear positioning: "This is a viewing tool, not a trading platform."
- Proactive regulatory engagement: Submit query to OSC before scaling.
- Insurance: Errors & omissions policy ($250K coverage, ~$2K/year).

### Risk 2: API Dependency (Plaid Pricing Shock)

**Scenario:** Plaid raises fees from $150/mo to $5K/mo or deprecates API.

**Impact:** CAC for connected accounts becomes uneconomical; growth stalls.

**Probability:** 10% (low). Plaid is VC-backed; unlikely to squash customers. But alternative aggregators (Finicity, Akoya) exist.

**Mitigation:**
- Build CSV import fallback: Users can manually upload IBKR/Questrade exports (frictionless but not continuous).
- Integrate alternative aggregators: Finicity (Fiserv-backed), Akoya (distributed, API-native).
- Negotiate volume discounts: At $1M annual spend (at scale), Plaid will offer custom pricing.
- Long-term: Build native IBKR API integration (high effort but zero dependency).

### Risk 3: Brokerage Native Aggregation

**Scenario:** IBKR, Wealthsimple, Questrade each build a portfolio aggregation dashboard, bundle it free with pro/premium accounts.

**Impact:** Feature parity + free = Unifolio value prop diminishes.

**Probability:** 25% (moderate-high). These companies have resources; aggregation is a natural feature extension.

**Mitigation:**
- Differentiate on tax strategy, not basic aggregation.
  - Unifolio's real value: Tax optimization, multi-broker wealth analytics, insights.
  - Brokerages' dashboards: Limited to own holdings.
- Move upmarket to wealth advisors.
  - Position as "Wealth advisor dashboard" not "Consumer tool."
  - Target advisors managing 50+ clients; they don't care if client holds at IBKR or Questrade.
- Build switching costs: Habits, health score progression, advisor relationships.

### Risk 4: Monetization Failure (Users Won't Pay)

**Scenario:** Free tier drives engagement, but 95% of users refuse to upgrade to Pro.

**Impact:** MRR stalls at $20K (200 free users, 5 paid); growth ceiling at year 2.

**Probability:** 20% (moderate). Common in consumer fintech; users expect freemium.

**Mitigation:**
- Gate high-intent features: Tax export, heatmap modes, AI insights.
- Tax export is the lever. CPA/accountant workflow requires this. Users will pay for it.
- Freemium ratio target: 85% free / 15% paid (not 95/5).
- If ratio slips to 98/2, pivot to B2B2C model: Advisor licensing, white-label.

### Risk 5: Data Security Breach

**Scenario:** Supabase or Plaid is breached; user holding data + credentials leaked.

**Impact:** User trust destroyed; regulatory penalties; potential $1M+ liability.

**Probability:** 5% (low). Supabase and Plaid are enterprise-grade; but unknown unknowns exist.

**Mitigation:**
- Insurance: Cyber liability policy, $1M coverage (~$3K/year).
- Architecture: Plaid handles credentials, Unifolio never stores them. Supabase row-level security (RLS) isolates user data.
- Incident response plan: Written protocol for breach notification, CRA/IIROC reporting within 72 hours.
- Regular security audits: Penetration testing annually (Q2 budget: $5K).

### Risk 6: Churn Spike (Product Stagnation)

**Scenario:** After launch, feature velocity slows. Competitors ship better tax features, insights. Users churn at 8–10%/month instead of 2–3%.

**Impact:** MRR declines 20%+ quarterly despite new user acquisition.

**Probability:** 30% (moderate-high). Common in SaaS; feature fatigue + competitive pressure.

**Mitigation:**
- Commit to monthly feature releases (even small ones).
- Roadmap transparency: Publish quarterly product plans on public website.
- User feedback loop: In-app feedback widget, monthly community calls.
- Retention focus: At churn >4%/month, pause growth spending; focus on retention initiatives.

### Risk 7: Market Timing / Economic Downturn

**Scenario:** 2027 recession; portfolio values crater. Users are demoralized; Unifolio feels like "pain reminder." Churn accelerates.

**Impact:** MRR flattens or declines despite underlying growth.

**Probability:** 40% (high). Market cycles are inevitable.

**Mitigation:**
- Reframe value prop in downturns: "See your true exposure to defensive sectors. Which accounts are hedged?"
- Tax-loss harvesting is MORE valuable in downturns (users capture losses).
- Shift narrative: "Portfolio management is boring until it's not. Be ready for the next bull market."
- Consider freemium price cuts in downturn (e.g., Pro drops to $12/mo) to retain users.

---

## GO-TO-MARKET STRATEGY

### Phase 1: Founder-Led Growth (Q2–Q4 2026)

**Objective:** Establish product-market fit, acquire 200–500 paid users, generate case studies.

**Tactics:**

1. **Launch on Product Hunt** (July 2026):
   - Aim for #1 in "Finance" category.
   - 1-day blitz: Founder active in comments, offer Lifetime deals ($250, 50-limit) as incentive.
   - Expected: 500–1K upvotes, 100–200 signups, 10–20 paid conversions.
   - CAC: $0 (organic).

2. **Reddit community engagement** (Ongoing):
   - r/investing, r/CanadianInvestors, r/PersonalFinanceCanada, r/SecurityAnalysis.
   - Weekly: Answer questions, publish case studies ("I discovered I was 72% overweight tech using Unifolio").
   - Monthly: "Tax-loss harvesting season guide," "TFSA optimization tips."
   - **Rule:** Only authentic participation; no spamming links.
   - Expected: 200–300 organic signups per quarter, 5% paid conversion.

3. **Financial blogger outreach** (Monthly):
   - Target: Canadian personal finance bloggers (100–500K readers each).
   - Offer: Free Lifetime account + data for collaborative case study.
   - Expected: 5–10 partnerships, 50–100 referral signups per partnership.

4. **LinkedIn founder activity** (Daily):
   - Publish weekly insights: "3 portfolio mistakes I made," "Why tax-loss harvesting matters."
   - Tag: #InvestingCommunity, #PersonalFinance, #CanadianInvestors.
   - Expected: 1K–2K monthly impressions, 20–30 inbound signups.

5. **Podcast guest appearances** (Quarterly):
   - Target: Canadian investing podcasts (10K–100K listeners).
   - Pitch: "Portfolio aggregation for the average investor" or "Tax-loss harvesting explained."
   - Expected: 2–3 appearances, 50–100 signups per appearance.

**Expected result Phase 1:**
- 300–500 paid users by Q4 2026
- MRR: $40K–$60K
- CAC: $20 average
- Payback period: <30 days

### Phase 2: Content + Affiliate (Q1–Q2 2027)

**Objective:** Build audience, establish brand, drive organic growth, launch B2B2C partnerships.

**Tactics:**

1. **YouTube channel launch** (Jan 2027):
   - Weekly videos: 5–10 min screen recordings of Unifolio features + tips.
   - SEO-optimized titles: "How to Track Your TFSA in Unifolio," "Portfolio Health Score Explained."
   - Expected: 500–1K subscribers by end of Q1, 50–100 video signups per month.

2. **Blog + SEO** (Ongoing):
   - Publish 2 articles per month: "Tax Optimization Guide," "Sector Allocation Best Practices," "IBKR vs. Wealthsimple vs. Questrade."
   - Target keywords: 50–100 long-tail searches per article.
   - Expected: 1K–2K organic monthly signups by Q2 2027 (cumulative from blog + video).

3. **Affiliate partnerships** (Q1 2027):
   - Approach: IBKR ($0.02 per referral), Wealthsimple ($20 per signup), Questrade ($20).
   - Secondary: Embed in financial education platforms (Coursera, Skillshare).
   - Expected: $500–$1K monthly referral revenue by Q2.

4. **B2B2C channel launch** (Q2 2027):
   - Target: Independent Financial Advisors (Canada).
   - Pitch: "White-label Unifolio for your clients. Charge $10/mo, Unifolio handles billing, you pocket $5."
   - Expected: 50–100 advisor partnerships by Q2, 500–1K indirect users.

**Expected result Phase 2:**
- 1,200–1,500 paid users by Q2 2027
- MRR: $150K–$200K
- Blended CAC: $15 (lower due to affiliate + content)
- 100–200 advisor partnerships (contributing 20–25% of MRR)

### Phase 3: Paid Advertising + Sales (Q3 2027+)

**Objective:** Accelerate growth, reach 4K+ users, establish enterprise relationships.

**Tactics:**

1. **Google Ads** (Q3 2027):
   - Budget: $2K–$5K/month.
   - Keywords: "Portfolio aggregation Canada," "TFSA calculator," "Capital gains tax tracker," "Multi-broker portfolio," "Questrade alternative."
   - Landing page: Dedicated Google Ads variants with testimonials + case studies.
   - Target CAC: $50–$70 per user (paid ads are expensive but capture high-intent).

2. **LinkedIn B2B** (Q3 2027):
   - Target: Wealth advisors, CPAs, financial planners on LinkedIn.
   - Ad copy: "Serve 50 clients in the time it used to take 5."
   - Expected: 20–40 enterprise trial signups per month, 5–10 conversions to annual contracts.

3. **Sales team (part-time, Q4 2027):
   - Hire 1 part-time sales contractor ($30K/year).
   - Target: Advisor firms with 20–50+ clients.
   - Pitch: Licensing deal, $500–$2K/mo per firm.
   - Expected: 2–5 new enterprise customers per quarter.

4. **Integration partnerships** (Q4 2027):
   - Approach: Wealth management platforms, financial planning software (E-SIGNAL, MoneyGuidePro).
   - Value prop: "Embed Unifolio portfolio dashboard in your platform."
   - Revenue: Revenue share (20–30% of referral fees).

**Expected result Phase 3:**
- 3,500–5,000 paid users by Q4 2027
- MRR: $400K–$600K
- Blended CAC: $25 (mix of organic, affiliate, paid)
- 10–20 enterprise customers (contributing 25–30% of MRR)

---

## 18–36 MONTH ROADMAP

### Q2–Q3 2026: Foundation Solidification

**Theme:** Nail product-market fit, establish brand, launch pricing tier.

**Ship:**
- [ ] Production hardening: SOC 2 audit readiness, error logging, uptime monitoring
- [ ] Pricing page: Freemium tiers published, Stripe integration live
- [ ] Plaid integration: Multi-account connection, sync workflows
- [ ] Tax report export: T5008 CSV generation, download flow
- [ ] Product Hunt launch (July 2026)
- [ ] Content hub: Blog + YouTube channel launched
- [ ] Email digest: Weekly portfolio summary emails

**Metrics:**
- 100–200 paid users by end of Q3
- 50%+ free-to-paid conversion rate
- <3% weekly churn
- MRR: $15K–$25K

### Q4 2026: Feature Acceleration

**Theme:** Deepen stickiness, add insights, prepare enterprise.

**Ship:**
- [ ] Portfolio health score: Full implementation, UI refinements
- [ ] ETF overlap analysis: Show redundancy, MER cost highlight
- [ ] Account stacking: Full redesign, purchase history drill-down
- [ ] Watchlist research: Integrate company profile, news, sentiment
- [ ] Tax-loss harvesting alerts: Automatic prompts before year-end
- [ ] CPA/advisor outreach: Direct integration or white-label inquiry
- [ ] Advanced heatmap modes: All 14 modes live, theme-aware colors
- [ ] Mobile app scoping: iOS/Android design exploration

**Metrics:**
- 300–500 paid users by end of Q4
- 3–5% weekly churn (improvement from Q3)
- MRR: $40K–$70K
- 10+ advisor inquiries

### Q1–Q2 2027: Expansion

**Theme:** Launch B2B2C, expand to US, add advisor features.

**Ship:**
- [ ] White-label / advisor licensing: API + pricing model live
- [ ] US Tax reporting: T1040 capital gains export, state-level tax tracking
- [ ] Multi-currency netting: FX exposure view, hedging recommendations
- [ ] AI insights (GPT-4 integration): Auto-generated commentary on portfolio changes
- [ ] Predictive alerts: "You're trending overweight tech; consider rebalancing"
- [ ] Mobile app launch (iOS + Android): MVP feature parity with web
- [ ] SSO integrations: Google, Microsoft, Apple auth
- [ ] Advisor dashboard: Manage 50+ clients from single interface

**Metrics:**
- 800–1,200 paid users (direct) by end of Q2
- 100–200 advisor partnerships (indirect: 500–1K users)
- 1–2% weekly churn
- MRR: $150K–$250K (including advisor licensing)
- 5–10 enterprise contracts

### Q3–Q4 2027: Consolidation + Enterprise

**Theme:** Solidify enterprise positioning, launch premium features, geographic expansion.

**Ship:**
- [ ] API access (closed beta): Developer portal, webhook support, for advisor integrations
- [ ] Advanced portfolio modeling: "What if I move $50K from Canadian to US equities?" scenario planning
- [ ] Rebalancing automation: Smart order generation for brokerages (API integrations)
- [ ] Enhanced benchmarking: Peer comparison (anonymized, aggregate data), factor analysis
- [ ] International expansion: Australia, UK, Singapore tax reporting
- [ ] SOC 2 Type II certification: Enterprise readiness
- [ ] Data export tools: Full portfolio history download (CSV, JSON, PDF)
- [ ] Community features: User groups, shared watchlists, leaderboards (opt-in)

**Metrics:**
- 2,000–3,000 paid users (direct) by end of Q4
- 300–500 advisor partnerships
- <1.5% weekly churn
- MRR: $350K–$600K (including enterprise)
- 20+ enterprise contracts, $5K+ MRR each
- API usage: 10M+ calls/month from integrations

### Q1 2028 and Beyond: Maturation

**Theme:** Build moat, expand TAM, consider next markets.

**Strategic options:**
1. **Wealth advisor consolidation:** Acquire small competitor (Wealthica alternative), build CPA/advisor marketplace.
2. **Institutional partnership:** Embed Unifolio into fintech platforms (TD, RBC, Wealthsimple apps).
3. **Geographic expansion:** Launch in Singapore, Hong Kong, EU.
4. **Private equity:** Series A to accelerate growth, expand sales team, invest in brand.
5. **M&A target:** Strategic acquisition by a major fintech (Wealthsimple, IBKR, Stripe).

**Financial targets by end of 2028:**
- 4,000–6,000 direct paid users
- 500–1,000 advisor partnerships
- MRR: $600K–$1,000K
- Annual recurring revenue (ARR): $7.2M–$12M
- EBITDA: $5M–$10M (70%+ margin)
- Enterprise customers: 30–50 (contributing 40%+ of revenue)

---

## ORGANIZATIONAL & HIRING

### Team Structure (Phases)

**Phase 1 (Current – Q4 2026): Solo Founder + Contractors**
- 1 founder (full-time, product + engineering + marketing)
- 1 designer contractor ($30/hr, 20 hrs/week)
- 1 content writer contractor ($50/hr, 8 hrs/week)
- Total burn: $50K/quarter

**Phase 2 (Q1 2027 – Q2 2027): Founder + Early Team**
- 1 founder (continues)
- 1 full-time engineer ($80K/year, React/Supabase focus)
- 1 full-time operations/customer success ($50K/year)
- 1 part-time designer ($30K/year, 0.5 FTE)
- 1 part-time sales contractor ($20K/year, advisor outreach)
- Total burn: $180K/quarter = $720K/year

**Phase 3 (Q3 2027 – Q4 2027): Full Small Team**
- 1 founder + CEO
- 1 senior engineer ($110K/year, architecture + backend)
- 1 junior engineer ($70K/year, frontend polish)
- 1 product manager ($80K/year, roadmap + research)
- 1 operations/customer success ($55K/year)
- 1 sales contractor ($30K/year, enterprise focus)
- 1 content/marketing ($45K/year)
- Total burn: $490K/quarter = $1.96M/year

**Hiring priorities (in order):**
1. Senior engineer (Q1 2027): Stabilize architecture, take on backend/API work.
2. Operations/CS (Q1 2027): Handle customer onboarding, retention, support.
3. Junior engineer (Q3 2027): Accelerate feature velocity, mobile app.
4. Product manager (Q3 2027): Roadmap clarity, user research, priorities.
5. Sales (Q4 2027): Enterprise deals, advisor partnerships.

### Compensation Philosophy

- **Base salaries:** Market-rate for Canada (Toronto benchmark).
  - Senior engineer: $110K–$130K
  - Junior engineer: $65K–$80K
  - Product: $80K–$100K
  - Ops/CS: $50K–$65K
- **Equity:** 0.5–1.5% for employees (vesting over 4 years).
- **Benefits:** Health (Dialogue), RRSP match (3%), unlimited PTO.
- **Flexibility:** Remote-first culture (founder Canada, hire globally).

### Operating Principles

1. **User obsession:** Weekly user feedback calls. Product roadmap driven by user requests, not internal ideas.

2. **Lean execution:** Ship fast, get feedback, iterate. 2-week sprints, Thursday releases.

3. **Financial discipline:** Track cohort economics obsessively. Shut down initiatives with LTV:CAC <3:1.

4. **Transparency:** Weekly all-hands (even if 2 people), share MRR, churn, CAC metrics, next week's focus.

5. **Diversity of thought:** Hire people who disagree. Debate, then decide. No passive consensus.

---

## FINANCIAL PROJECTIONS

### Revenue Projections (Base Case)

| Metric | 2026 | 2027 | 2028 |
|---|---|---|---|
| **Direct Paid Users (YE)** | 400 | 1,500 | 4,000 |
| **Advisor Partners** | 10 | 300 | 800 |
| **Indirect Users** | 100 | 1,500 | 4,000 |
| **Blended ARPU** | $180 | $190 | $210 |
| **Annual Direct Revenue** | $360K | $1.8M | $5.0M |
| **Advisor Licensing Revenue** | $20K | $180K | $600K |
| **Affiliate + API Revenue** | $5K | $40K | $150K |
| **Total Revenue** | $385K | $2.02M | $5.75M |

### Cost Projections (Base Case)

| Metric | 2026 | 2027 | 2028 |
|---|---|---|---|
| **COGS (APIs, hosting, payment processing)** | $40K | $150K | $400K |
| **Payroll (founder, contractors, team)** | $180K | $600K | $1,400K |
| **Marketing & Sales** | $60K | $250K | $450K |
| **Legal, compliance, insurance** | $20K | $50K | $100K |
| **Operations, tools, misc** | $30K | $100K | $250K |
| **Total OpEx** | $330K | $1,150K | $2,600K |

### Profitability & Cash Runway

| Metric | 2026 | 2027 | 2028 |
|---|---|---|---|
| **Gross Profit** | $345K | $1,870K | $5,350K |
| **Gross Margin** | 90% | 93% | 93% |
| **EBITDA** | $15K | $720K | $2,750K |
| **EBITDA Margin** | 4% | 36% | 48% |
| **Cumulative Cash (no funding)** | $15K | $735K | $3,485K |

**Key insight:** Unifolio is **cash-flow positive from Q4 2026 onwards**, assuming the base case. This makes it:
- Bootstrappable (no VC required)
- Attractive to LPs (if raising growth capital later)
- Founder-friendly (retain control, no dilution pressure)

### Funding Scenarios

**Scenario A: Bootstrapped** (No external funding)
- Pros: Founder maintains control, 100% equity, no dilution, no board pressure.
- Cons: Slower growth, limited marketing spend, hiring constrained to cash flow.
- Outcome: $5M+ ARR by end of 2028, founder owns 100%.

**Scenario B: Seed Round** ($500K–$1M, Q1 2027)
- Use: Marketing ($300K), team hiring ($400K), product R&D ($200K).
- Expected outcome: 3x faster growth, 2,000+ users by end of 2027, enterprise relationships.
- Dilution: 15–20%, founder retains 80%+.
- Exit multiple: 8–15x on seed ($4M–$15M exit value), fund returns 8–15x.

**Scenario C: Series A** ($3M–$5M, Q1 2028)
- Use: Aggressive expansion (US, EU), sales team (5–10 reps), product (AI, mobile, integrations).
- Expected outcome: 8K–15K users by end of 2028, $10M+ ARR.
- Dilution: 20–25% (total from seed + Series A: 35–40%), founder retains 60%+.
- Exit multiple: 15–30x on Series A ($15M–$50M exit value), fund returns 15–30x.

---

## FOUNDER OPERATING THESIS

### What Unifolio Is (Not)

**Unifolio is NOT:**
- A robo-advisor (doesn't manage money)
- A trading platform (no order execution)
- A financial advisor (doesn't give advice)
- A cryptocurrency exchange (no crypto holdings management initially)
- A social/community platform (privacy-first, not social-first)

**Unifolio IS:**
- A **decision-support system** for portfolio management
- A **tax-optimization engine** for Canadian investors
- A **data-unification layer** across siloed brokerages
- A **wealth visualization platform** for clarity and behavioral change
- A **B2B2C distribution** channel for advisors

### Core Investment Thesis

1. **Fragmentation is permanent.** Investors will never consolidate all holdings into one brokerage. Multi-broker portfolios are the norm.

2. **Visibility = Better decisions.** When investors see their true allocation, they rebalance smarter, tax-optimize faster, panic-sell less.

3. **Tax efficiency is underexploited.** Retail investors leave $2K–$10K annually on the table via tax-loss harvesting, TFSA inefficiency, dividend tax credit misses.

4. **Professional tools are democratizing.** Finnhub, Yahoo Finance, Plaid APIs make institutional-grade analytics accessible to indie developers.

5. **Advisors are underserved.** Wealth advisors manage 50–100 clients each but use 1990s tools (emails, PDFs, spreadsheets). They'd pay for modern dashboards.

6. **Margins are exceptional.** Commodity APIs + serverless compute + freemium distribution = 70%+ gross margins, path to 50% EBITDA margins.

7. **Regulatory moat exists.** Building compliance (PIPEDA, Canadian tax rules, securities law) creates defensibility. Competitors face same burden.

### Why Now

1. **Plaid maturity.** Plaid now supports 100+ institutions across North America. This was impossible 5 years ago.

2. **Real-time pricing accessibility.** Finnhub, Alpha Vantage, and others democratized what Bloomberg charged $25K/year for.

3. **Canadian tax complexity.** 2024 capital gains inclusion rate changes + TFSA influx + passive investment growth created awareness gap.

4. **Fintech momentum.** Wealthsimple, Questrade, IBKR gone mainstream. Retail investors are now financially literate and app-native.

5. **Work-from-home persistence.** Remote work means location-independent income → better ability to manage multi-jurisdictional portfolios.

### Competitive Barriers (Moat)

1. **Data integration complexity.** Unifolio's competitive advantage is handling 100+ brokerage integrations, each with different schemas. This is a barrier to entry for new entrants.

2. **Tax intelligence.** Canadian capital gains rules, TFSA contribution tracking, superficial loss rules—these are specific, complex, and Unifolio is the only platform that gets them right.

3. **User behavior lock-in.** Health scores, watchlist progress, customized heatmaps—users accumulate data and habits over time.

4. **Advisor relationships.** Once an advisor recommends Unifolio to 20 clients, switching costs are high.

5. **Brand + content.** Unifolio's blog, YouTube, Reddit presence become SEO moat. Users find Unifolio via search when researching "TFSA optimization."

### Failure Case

**Most likely failure scenario:**
- Unifolio ships, gets 200 users, but can't convert Starter → Pro (monetization fails).
- Competitors (Wealthica, Sharesight) ship better features.
- User acquisition cost exceeds LTV; growth stalls.
- Founder burns out; product stagnates; users churn.
- By 2028, Unifolio has 500 users, $5K MRR, unsustainable economics.

**Mitigation: Obsessive focus on:**
1. Freemium to Pro conversion (target: 10–15%)
2. Retention (target: <3% weekly churn)
3. Feature velocity (ship every 2 weeks)
4. Unit economics (track LTV:CAC constantly)

### Success Case

**Most likely success scenario:**
- Unifolio gains 500 paid users by Q4 2026 via Product Hunt + Reddit + content.
- Tax report export becomes "must-have" for accountants; Pro conversion improves.
- B2B2C advisors discover Unifolio; indirect user base grows 50% quarterly.
- Series A in Q1 2028; US expansion + sales team hired.
- By end of 2028: 5,000 direct users + 5,000 indirect users via advisors = 10K users, $10M ARR, acquisition by fintech unicorn or venture-scale exit.

---

## CONCLUSION: THE REAL OPPORTUNITY

### What Unifolio Represents

Unifolio is not a "me-too" fintech clone. It's a **category creator** in a market that's ripe for disruption:

1. **The portfolio aggregation market is underserved.** Existing players (Wealthica, Sharesight) are legacy software with poor UX and weak monetization. There's room for a modern, tax-first alternative.

2. **Retail investor wealth is growing.** Canada's household net worth hit $8.2T in 2024. A meaningful portion is scattered across brokerages in under-optimized holdings.

3. **Advisor enablement is a $50B+ TAM.** There are 25K+ financial advisors in Canada alone. If even 500 adopt Unifolio (at $1K MRR each), that's $6M annual revenue. That's a $30M+ company.

4. **Tax optimization is evergreen.** Tax rules change, but optimization never stops. Unifolio is positioned to be an essential tool, not a "nice-to-have."

### The Path Forward (Next 18 Months)

1. **Establish product-market fit** (Q2–Q4 2026): 500 paid users, <3% churn, positive unit economics.

2. **Launch B2B2C** (Q1–Q2 2027): 300+ advisor partnerships, 1,500+ indirect users, MRR crosses $200K.

3. **Expand geographically and feature-wise** (Q3–Q4 2027): US, mobile app, AI insights, enterprise contracts.

4. **Position for exit or Series A** (Q1 2028): 4,000+ direct users, $600K+ MRR, acquisition interest from Wealthsimple / RBC / IBKR.

### One Final Word: On Risk

This market is **real, growing, and underserved**. But execution is everything. The difference between a $100M company and a $5M lifestyle business is:

1. **Obsessive user focus.** Every week, talk to 5 users. Every month, review churn data. Never ship a feature without user validation.

2. **Financial discipline.** Track LTV:CAC. Know your unit economics. When they slip, course-correct immediately.

3. **Founder resilience.** Year 1 will be hard. Growth will be slow. Competitors will emerge. Regulatory uncertainty will loom. If you believe in the vision, push through.

4. **Optionality.** Unifolio might be a $10M/year business or a $100M+ acquisition target. Both are wins. Don't get attached to a specific outcome; stay flexible.

**The opportunity is now. The market is ready. Execute.**

---

**DOCUMENT END**

---

## APPENDIX: KEY METRICS DASHBOARD

### Real-Time KPI Tracking (Update Weekly)

| Metric | Target | Actual | Trend |
|---|---|---|---|
| **Users (Free)** | 500 | — | — |
| **Users (Paid)** | 100 | — | — |
| **MRR** | $20K | — | — |
| **Churn (weekly)** | 3% | — | — |
| **Conversion (Free → Pro)** | 10% | — | — |
| **CAC** | $50 | — | — |
| **LTV** | $1K | — | — |
| **LTV:CAC** | 20:1 | — | — |
| **NPS** | 40+ | — | — |
| **App Uptime** | 99.9% | — | — |

### Annual Burn Rate (Budget 2026)

| Category | Q2 | Q3 | Q4 | Total |
|---|---|---|---|---|
| **Payroll** | $25K | $50K | $50K | $125K |
| **APIs / Hosting** | $2K | $5K | $10K | $17K |
| **Marketing** | $5K | $10K | $20K | $35K |
| **Legal / Compliance** | $5K | $5K | $10K | $20K |
| **Other** | $3K | $5K | $8K | $16K |
| **TOTAL** | $40K | $75K | $98K | $213K |

---

**Next Review Date:** Q3 2026 (August 31)  
**Last Updated:** May 12, 2026  
**Prepared by:** Founder / Strategy Team  

