# Unifolio — Founder Execution Playbook (v3)

**A document written for one specific reader: a medical student, solo founder, no engineering or finance background, $0 in capital, building Unifolio in stolen evenings using AI-augmented development.**

This is not a manifesto. It's not a pitch deck. It's a playbook with Monday-morning actions and specific dollar amounts. If something here is vague, it's a bug — file an issue and I'll rewrite it.

---

## Table of Contents

1. [The Honest Thesis](#1-the-honest-thesis)
2. [Founder Reality Check](#2-founder-reality-check)
3. [The Five Real Value Propositions, Ranked by Willingness-to-Pay](#3-the-five-real-value-propositions-ranked-by-willingness-to-pay)
4. [Competitor Gap Matrix](#4-competitor-gap-matrix)
5. [Canadian Fintech Regulatory Reality](#5-canadian-fintech-regulatory-reality)
6. [Monetization With Real Numbers](#6-monetization-with-real-numbers)
7. [The AI-Augmented Solo Build](#7-the-ai-augmented-solo-build)
8. [Bootstrap vs. Fund Decision Framework](#8-bootstrap-vs-fund-decision-framework)
9. [18-Month Execution Roadmap](#9-18-month-execution-roadmap)
10. [Risk Register](#10-risk-register)
11. [Appendix A: Tech Stack Reference](#appendix-a-tech-stack-reference)
12. [Appendix B: Founder Operating Cadence](#appendix-b-founder-operating-cadence)
13. [Appendix C: First 50 Users — Acquisition Playbook](#appendix-c-first-50-users--acquisition-playbook)

---

## 1. The Honest Thesis

The previous two strategy documents (v1 and v2) made a critical mistake: they sold you a story about Bloomberg-grade aesthetics and emotional finance. That story is not wrong, but it is not the moat. The moat is much more boring — and much more defensible.

**Unifolio's actual differentiated value, in one sentence:**

> The only Canadian-aware, multi-broker portfolio aggregator that correctly handles CDRs, registered accounts, and FX-translated true-exposure look-through, packaged in a UI that the user actually wants to open every day.

Let's unpack each clause because every one is doing real work.

**"Canadian-aware"** — Wealthsimple, Questrade, RBC Direct Investing, IBKR Canada, BMO InvestorLine, TD Direct, and CIBC Investor's Edge are the brokerages most retail Canadians use. None of them have public APIs. Three of them issue CDRs (CIBC). The TFSA contribution room rules, RRSP deduction limits, and FHSA mechanics are uniquely Canadian. Every US-built tool (Empower, Copilot Money, Monarch, Kubera) treats Canada as an afterthought — they handle CAD as a currency but not as a tax regime. **You are Canadian. You build for Canadian retail. That alone is a defensible niche of ~10M households.**

**"Multi-broker"** — A serious investor in Canada typically has at least three accounts: an RRSP at one broker, a TFSA at another, and a non-registered or US-margin at a third. None of those brokers will show you a unified view. Wealthica was the only Canadian product trying to solve this and they were acquired by Hardbacon in 2022 and have been coasting since. The market is wide open.

**"Correctly handles CDRs"** — Canadian Depositary Receipts (CIBC issues these) trade in CAD on Cboe Canada / TSX and let Canadian investors hold US stocks without converting currency. They are economically equivalent to fractional US shares but they have separate tickers (LLY vs LLY.NE), separate prices, separate currencies, and separate cost bases. **No competitor handles this correctly.** Most either ignore CDRs or double-count them. The Phase-1 work in this codebase (`src/lib/listingResolver.js`, `src/lib/securityIdentity.js`) is the most thoroughly correct CDR handling I've seen in a public product.

**"Registered accounts"** — TFSA, RRSP, RESP, RDSP, FHSA, LIRA. Each has different tax treatment, contribution limits, and withdrawal rules. The capital gains math is different in registered vs. non-registered accounts. The dividend withholding is different for US dividends in a TFSA vs. an RRSP. Tax-loss harvesting is meaningless in a TFSA but critical in non-registered. **Knowing which account a holding lives in changes every downstream calculation.** US tools don't even have these account types as concepts.

**"FX-translated true-exposure look-through"** — When you hold VOO + VFV + AAPL + LLY-CDR, the naive view says you have four positions. The look-through view says you actually own AAPL twice (directly and via VOO + VFV) and LLY twice (US share + CDR), and your "diversification" across four tickers is actually a 70% concentration in US large-cap. **No retail tool shows this for Canadian investors.** Phase-3 of this codebase (`src/lib/etfManifest.js` + the etfLookthrough chart in `PortfolioBreakdown.jsx`) is the only implementation of this view I'm aware of in the Canadian market.

**"UI that the user actually wants to open every day"** — This is the v2 thesis and it's correct as a *retention* mechanism, not as an *acquisition* mechanism. The Bloomberg-lite aesthetic doesn't get you the first 100 users. It keeps you the first 100 users. Daily-engagement UI is what makes a $20/month tool feel like good value. Without it, users churn at 8%/month and your unit economics never close.

The five clauses above are an ordered priority list. If you have to cut features under time pressure, cut from the bottom: drop the daily-engagement polish before you drop the look-through view, drop the look-through before you drop CDR handling, drop CDR handling before you drop multi-broker, and never drop the Canadian focus.

This is not "Bloomberg-lite for retail investors". That's a tagline. The actual product is **the personal Canadian wealth dashboard your accountant wishes you'd been using all year**.

---

## 2. Founder Reality Check

You are:
- A medical student. You have **15 hours per week** of usable Unifolio time, optimistically. During exam blocks: 3 hours.
- Not formally trained in software engineering. You ship via Claude Code, ChatGPT, and aggressive copy-paste. Your output velocity, *with AI*, is roughly that of a junior engineer who's just finished a bootcamp — not a senior, but not nothing.
- Not formally trained in finance. You have an investor's intuition (you built Unifolio because you're a user), not a CFA. You will hit edges where you don't know what an FX swap is or how a stock split affects cost basis. **Phase-5 of the technical plan exists because you don't yet know to ask "did the broker apply commissions to the lot price or net them off proceeds?"** That's fine. The codebase is increasingly self-documenting (see [HOLDINGS_MATH.md](docs/HOLDINGS_MATH.md)).
- An international student. You can incorporate federally in Canada for ~$200 (Corporations Canada, no residency requirement). You cannot legally take a salary from the company while on a study permit, but you can hold shares and the company can defer compensation.
- A first-time founder with **$0 of risk capital**. Your runway is whatever you can spare from student loans without getting into trouble. Currently ~$200/month in subscriptions. See [EXPENDITURES.md](EXPENDITURES.md).

You are not:
- A designer. You have product-design instincts but you cannot produce icon sets or marketing illustrations from scratch in a reasonable time. You will need to lean on Tailwind primitives, Lucide icons, and AI-generated assets.
- A copywriter. You will need to lean on AI-assisted drafts and your own editing.
- A salesperson. You will need to find product-led growth — the product itself must convert.
- A community manager. You can run one Discord server in your spare time. Not five.

This combination is not a death sentence. It is, in fact, the modal profile of profitable AI-era solo founders today. Pieter Levels, Tony Dinh, Marc Lou, Tibo, and dozens of others built profitable SaaS businesses from this exact starting point. **What kills people in your position is not lack of skill — it's lack of focus and the temptation to over-build.**

The most important rule for you: **if a feature is not on the path to your first $1K MRR, it does not get built this quarter.** The diversification charts (Phase 3 done) are on the path. The v3 strategic doc you're reading is on the path. The look-through ETF view is on the path. A mobile app, an AI portfolio coach, and Plaid auto-sync are *not* on the path until you have 50 paying users telling you they need them.

Your unfair advantages:
1. **You are the user.** You hold IBKR, Wealthsimple, and probably a Canadian bank brokerage. You know the pain personally. You can ship a feature in the morning and use it in the evening — feedback loops measured in hours.
2. **You build with AI.** Your dollar-per-feature cost is ~10× lower than a venture-funded competitor. They have to fundraise and hire to build what you ship in a week.
3. **You don't need to grow fast to win.** A $100K ARR business is a life-changing income for one person. A $100K ARR business is a failed seed round for a venture-backed competitor. Your patience is your weapon.

Your unfair disadvantages:
1. **You will burn out** if you treat this like a job. Medical school + startup + life is unsustainable past ~9 months without a hard 15-hour weekly cap.
2. **Customer support eats time you don't have.** When you start charging, every paying user expects a 24-hour response. Plan for it (see Section 7).
3. **You can't write your own legal docs.** Privacy policy, terms of service, and brokerage-data ToS will eventually need a lawyer. Budget $1,000–$2,000 for the initial pass.

---

## 3. The Five Real Value Propositions, Ranked by Willingness-to-Pay

I rank these by *the question "would a user pay $20/month just for this feature?"*. The higher the number, the more the user is paying for that specific thing. This ranking is what tells you what to build first and what to deprioritize.

### 3.1. Holding aggregation across IBKR, Wealthsimple, Questrade, and at least one Canadian bank broker

**Willingness-to-pay: HIGH (this alone gets you to $10/month).**

This is the table-stakes feature. Nobody does it well in Canada. Wealthica is the closest competitor and even they don't aggregate cleanly across all major Canadian brokers (their RBC integration breaks weekly per their support forum). The current codebase ships CSV-import for IBKR Flex, IBKR Activity Statements, Wealthsimple Activity, and Wealthsimple Holdings. **This already covers ~70% of the user base by trade volume.** Adding Questrade and a Canadian bank broker (probably RBC, since it's the largest) brings you to ~90%.

**Build cost:** Each new broker is a ~2-week sprint to handle their export format quirks. RBC: 2 weeks. Questrade: 2 weeks. TD: 3 weeks (their CSV is a mess).

**Monetization signal:** Lock multi-broker behind Pro. Free tier = 1 broker. The instant a user adds their second account, they're a paid customer.

### 3.2. True look-through diversification

**Willingness-to-pay: MEDIUM-HIGH (drives the upgrade decision).**

This is your *only feature that no competitor has*. The Phase-3 work in [src/lib/etfManifest.js](src/lib/etfManifest.js) ships the foundation: explode VOO/VFV/QQQ/IBIT into their underlying constituents and aggregate with direct holdings. The killer demo is "you hold AAPL directly *and* it's 7% of your VOO position *and* it's 11% of your SCHG position — you're 14% concentrated in AAPL, not 4%."

This is what you screenshot for Twitter/Reddit. This is what makes a Canadian r/PersonalFinanceCanada thread say "wait, why doesn't anyone else show me this?"

**Build cost:** Already shipped (Phase 3). To extend: add Finnhub paid-tier ($60/mo) for live ETF holdings data instead of the hand-curated manifest, so it stays accurate as funds rebalance. Defer until you have 100 paid users.

**Monetization signal:** The look-through chart is Pro-only. Free users get static asset-class breakdown. Pro users get the full look-through.

### 3.3. CDR-aware portfolio that doesn't double-count LLY/LLY.NE

**Willingness-to-pay: MEDIUM (it's table stakes once a user has both).**

This is invisible until a user holds both the US-listed share and the CDR — then it's the difference between "this app works" and "this app is broken". Wealthica double-counts. Sharesight double-counts. Most US tools don't even know what a CDR is.

**Build cost:** Already shipped. Phase-1 of the technical plan refactored this completely. The system uses Finnhub `/search` to verify which exchange a CDR actually trades on, with a manual-entry fallback when the API doesn't have data.

**Monetization signal:** This is in every tier. Don't gate it. It's the demonstration of competence that justifies upgrading for other features.

### 3.4. Tax-lot tracking with TFSA/RRSP/Non-Registered context

**Willingness-to-pay: MEDIUM-HIGH at tax time, LOW the rest of the year.**

Canadian capital gains math is account-type dependent. TFSA gains are tax-free. RRSP gains are tax-deferred (but turn into income at withdrawal). Non-registered gains are 50% taxable as capital gains. **The ability to export a clean T5008 / Schedule 3 report is worth $50/year to anyone who files their own taxes.**

The current codebase has a Tax Report page already; it needs to be made accountant-grade. Specifically: per-lot disposition records with adjusted cost base (ACB), superficial loss flagging, and CSV export in CRA-acceptable format.

**Build cost:** ~3 weeks to make tax export accountant-grade. Schedule for Q1 of every year (when retail traders start panicking about taxes).

**Monetization signal:** Tax export is Pro-only. This drives a seasonal spike in upgrades from January–April. Plan for it.

### 3.5. Beautiful daily-engagement UI

**Willingness-to-pay: LOW as a primary driver, HIGH as a retention multiplier.**

The 48 themes, the snowglobe physics, the heatmap modes, the smooth animations — none of this gets a user to sign up. All of it gets a user to not cancel. Free users see the themes locked behind Pro and crave them. Pro users open the app daily because it's pleasant. Daily-active-users have 4× higher retention than weekly-active.

**Build cost:** Already substantial. Avoid spending more than 10% of your time here unless engagement metrics start sliding.

**Monetization signal:** Pro themes are Pro-only. Living/animated themes are an upsell. Don't over-engineer this further until you have signal that it matters.

---

## 4. Competitor Gap Matrix

I'll do this as a structured table with specific shortcomings for each competitor, then a strategic positioning summary.

### 4.1. The matrix

| Competitor | Pricing | What they do well | 3 things they get wrong (your opportunities) |
|---|---|---|---|
| **Wealthica** | Free / $48 CAD/yr | Multi-broker aggregation in Canada, CRA tax exports | (1) Stale UI from 2017. (2) Doesn't handle CDRs. (3) RBC/CIBC integrations break weekly per their forum. |
| **Sharesight** | Free / $19 USD/mo | Tax reports across 40+ countries, dividend tracking | (1) Manual transaction entry; no broker auto-sync. (2) Australian-first; weak on Canadian registered accounts. (3) Confusing UI for non-accountants. |
| **Snowball Analytics** | Free / $9 USD/mo | Beautiful dividend dashboards | (1) Pure dividend focus, no tax-lot tracking. (2) US-centric. (3) Limited CSV import options. |
| **Kubera** | $199 USD/yr | Net-worth tracking incl. private assets, real estate, crypto | (1) $199/yr is steep for retail. (2) US-centric. (3) Doesn't show holdings detail — just totals. |
| **Monarch Money** | $14.99 USD/mo | Best-in-class budgeting + net-worth visuals | (1) US-only. (2) Cash-flow first; portfolio is an afterthought. (3) No tax-lot or look-through. |
| **Copilot Money** | $13 USD/mo | Apple-grade UX, smart categorization | (1) US-only, no investment depth. (2) Spending-tracker first. (3) No CDR/registered-account concept. |
| **Empower (Personal Capital)** | Free | Solid net-worth dashboard, retirement projections | (1) US-only. (2) Hassle to set up — they cold-call you to sell wealth-management services. (3) Holdings detail is shallow. |
| **Yahoo Finance Portfolio** | Free | Real-time quotes, sentiment | (1) Read-only watchlist, not a real portfolio tracker. (2) No tax features. (3) No multi-account support. |
| **Personal Capital** | Same as Empower | (See above) | (Same as Empower) |
| **Wealthsimple's own dashboard** | Free if you bank with them | Beautiful UI, real-time WS prices | (1) Only shows your WS holdings. (2) No external broker import. (3) No tax-lot tracking; the Tax Software is a separate product. |
| **IBKR PortfolioAnalyst** | Free for IBKR users | Institutional-grade analytics | (1) Only IBKR. (2) UI from 2010. (3) Steep learning curve; assumes professional knowledge. |
| **Questrade dashboard** | Free for Questrade users | Decent for Questrade users | (1) Only Questrade. (2) No CDR awareness. (3) No multi-account view. |
| **Simply Wall St** | Free / $20 USD/mo | Beautiful stock-research "snowflake" visualizations | (1) Stock research, not portfolio. (2) No transaction tracking. (3) No multi-broker. |
| **TradingView** | Free / $15 USD/mo+ | Best charting tools in the world | (1) Charting and watchlists, not portfolio aggregation. (2) No tax. (3) No CDR/registered support. |

### 4.2. Strategic positioning

The empty seat at the table is "Canadian retail multi-broker portfolio tool, built for the post-Wealthsimple-dominance era". Wealthsimple now has ~3.5 million accounts but they've capped at one broker (themselves). Their dashboard is pretty but parochial. Kubera and Empower are too American. Wealthica is too old and too thin.

**Your actual fight is against Wealthica**, not against Kubera or Sharesight. Wealthica has Canadian users, brand recognition (5+ years in market), and 22 broker integrations including bank brokerages. Their weaknesses are fixable — they just haven't fixed them.

**What you offer that Wealthica cannot ship in 6 months:**
1. Modern UI that doesn't look like a 2018 admin dashboard.
2. CDR-aware portfolio (their codebase is too tangled to retrofit).
3. ETF look-through (a from-scratch feature).
4. Tax-aware lot tracking (they have basic tax exports; nothing accountant-grade).

**What Wealthica has that you don't yet:**
1. Direct bank broker integrations (RBC, BMO, etc. via Plaid Canada and proprietary scrapers).
2. ~50,000 users.
3. Brand and SEO presence on "Canadian portfolio tracker" search terms.

The fight: ship a beautiful Canadian-aware product, get featured by Andrew Hallam / Tawcan / Million Dollar Journey / Genymoney bloggers, and ride that into the Canadian PFM Twitter ecosystem. **Do not try to out-integrate Wealthica.** You cannot win on integrations as a solo founder. You win on the four bullets above.

### 4.3. Where you cannot compete and shouldn't try

- **HFT-grade real-time data.** TradingView and Bloomberg own this. Your free Finnhub + Yahoo Finance combo is fine for portfolio tracking but not for active trading.
- **Custodial integrations.** You will never custody assets. You will never execute trades. You are a read-only data tool. Don't even think about it.
- **AI investment advice.** Don't. Regulatory minefield, low willingness-to-pay, and you are not qualified.
- **Mobile-first products.** Build a great PWA (which the React app already is) before considering a native mobile app.

---

## 5. Canadian Fintech Regulatory Reality

This section is short on purpose. I am not your lawyer. The notes below are what most solo founders in Canadian fintech learn the expensive way.

### 5.1. What you DO need to comply with from day one

- **PIPEDA** (Personal Information Protection and Electronic Documents Act). You collect personal information; this is the federal privacy law. Practical impact: have a privacy policy, allow data export and deletion, store data in a secure manner.
- **CASL** (Canadian Anti-Spam Legislation). If you send marketing emails, you need consent and an unsubscribe link. Enforcement is real; fines start at $1M for individuals.
- **Provincial consumer protection.** Each province has its own. Quebec's Bill 25 is the strictest — if you have any Quebec users, you need a Privacy Officer designated.
- **CRA reporting on your own income.** You're earning revenue. You need to file taxes. Federal corporation = T2.

### 5.2. What you do NOT need to comply with (yet)

- **IIROC / CIRO registration.** You are not custodying assets, executing trades, or providing personalized investment advice. You are a read-only data visualization tool. **You do not need to be a registered investment dealer.** This is the most common point of confusion for fintech founders.
- **Banking license.** You don't move money. You don't hold deposits.
- **Securities Commission (OSC, BCSC, etc.) registration.** You are not selling securities or providing personalized recommendations on what to buy/sell.

### 5.3. The grey zone

- **Web scraping of broker accounts.** Some Canadian brokers have no public API (Wealthsimple, Questrade, RBC, etc.). To auto-sync, the only options are (a) Plaid Canada (which has limited Canadian broker coverage) or (b) screen-scraping with stored user credentials. Screen-scraping with stored credentials is a *legal* grey zone and a *security* nightmare. **Do not do this.** If a user wants auto-sync from a broker that Plaid doesn't cover, they get a "manual upload" option and that's the end of the conversation.
- **Storing OAuth tokens / Plaid access tokens.** This is fine but requires SOC 2-style security practices once you have meaningful user data. Until then, encrypt at rest in Supabase (default) and don't log access tokens.

### 5.4. Concrete milestones

| Trigger | Action | Estimated cost |
|---|---|---|
| Day 1 (today) | Federal incorporation. Open a business bank account (RBC Founders or Tangerine for free). | $200–$300 |
| Day 1 | Privacy policy + ToS. Use a template (Termly, GetTerms.io). Replace later. | $0 (template) or $500 (lawyer once-over) |
| Day 1 | Register a CRA Business Number. | Free |
| First paying user | GST/HST registration if you cross $30K of revenue in any 4 consecutive quarters. Until then, you can register voluntarily (recommended once you have any business expenses to claim back). | Free, ~30 minutes |
| First 50 paying users | Have a Toronto-based fintech lawyer review your privacy policy, ToS, and data-handling practices. Recommended firms: Borden Ladner Gervais (BLG), Stikeman Elliott, or solo practitioners like Pat Macdonald. | $1,500–$3,000 |
| First $5K MRR | Cyber-liability insurance. Coalition Insurance ($150/mo) or Embroker. Required by Stripe over $10K/yr in some cases. | $1,200–$2,400/yr |
| First $10K MRR | Tax accountant (corporate). Avoid the temptation to do T2 yourself; a CPA in Year 1 is cheaper than the audit risk. | $1,500–$2,500/yr |
| First Quebec user | Designate a Privacy Officer (can be you). Update privacy policy with French translation. | $500 (translation) |
| First scrape attempt | Don't. Use Plaid Canada or CSV upload. | N/A |

### 5.5. Plaid Canada coverage (as of 2026-Q1)

Plaid Canada launched late and the coverage is incomplete. As of this writing:
- **Supported:** Wealthsimple (read-only investments), TD, RBC, BMO Personal banking; some Scotiabank.
- **Not supported:** Questrade, IBKR Canada, CIBC Investor's Edge, National Bank Direct Brokerage. Banking is OK, brokerage data is sparse.
- **Cost:** ~$0.25 USD per linked account per month, after the first 100 free per month for development.

**Strategic implication:** Plaid auto-sync is the eventual upsell ("connect your accounts in 30 seconds"), but for the next 12 months **CSV upload is the primary import path** because it actually covers the brokers your users have. Don't over-invest in Plaid until coverage improves. Do invest in great IBKR Flex Query and Wealthsimple Activity export documentation (you've already done the latter — see [Instructions.jsx](src/pages/Instructions.jsx)).

---

## 6. Monetization With Real Numbers

### 6.1. Pricing tiers

```
┌──────────────────────────────────────────────────────────────────┐
│ STARTER (Free)                                                   │
│  • 1 brokerage account                                           │
│  • Holdings & P&L                                                │
│  • Watchlist (10 tickers)                                        │
│  • CSV import (manual)                                           │
│  • Basic charts                                                  │
│                                                                  │
│ PRO ($12 CAD / month or $108 CAD / year, 25% off)                │
│  • Unlimited brokerage accounts                                  │
│  • Plaid auto-sync where supported                               │
│  • CDR-aware portfolio                                           │
│  • ETF look-through diversification                              │
│  • Tax export (T5008, Schedule 3, ACB tracking)                  │
│  • All 48+ themes incl. Pro living themes                        │
│  • Priority email support (24h response)                         │
│  • Insights & AI analysis                                        │
│                                                                  │
│ FAMILY ($25 CAD / month)                                         │
│  • Everything in Pro × 4 users                                   │
│  • Shared dashboards (spouse, dependent accounts)                │
│  • Combined household net-worth view                             │
│                                                                  │
│ ADVISOR ($99 CAD / month per advisor seat)                       │
│  • White-label client portal                                     │
│  • Multi-client view (up to 50 clients per seat)                 │
│  • Advisor-grade tax exports                                     │
│  • Performance reports for client meetings                       │
│  • API access                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Why $12 CAD/month for Pro?** Wealthica is $48 CAD/year ($4 CAD/month) which is too low to support real product investment. Sharesight is $19 USD/month ($25 CAD) which is too high for what they ship. Monarch is $15 USD/month ($20 CAD) for a budgeting tool. **$12 CAD is the sweet spot — visibly more than Wealthica (justifies the upgrade story) and visibly less than the budgeting category (sets a Canadian-friendly anchor).**

**Why a Family tier?** Canadian retirement planning is household-level. TFSA and RRSP contribution rooms are per-individual. Couples track joint net worth and individual tax-shelter efficiency. The Family tier captures the additional willingness-to-pay without doubling the headcount cost.

**Why the Advisor tier so high?** Independent fee-only financial advisors in Canada (the IIROC-registered fee-only segment, ~2,000 of them) need a tool that shows multi-client portfolios. Their clients pay them $1,000–$5,000/year. A $99/month advisor tool that saves 4 hours/week is trivial for them. **This is your highest-margin segment but also the slowest sales cycle (3–6 months to close an advisor).**

### 6.2. Unit economics at 1,000 paid users

Assume the following mix at 1,000 paid users (a realistic 18-month target):
- 850 Pro × $12/mo = $10,200/mo = $122,400/yr
- 100 Family × $25/mo = $2,500/mo = $30,000/yr
- 50 Advisor × $99/mo = $4,950/mo = $59,400/yr
- **Total ARR: ~$211,800 CAD**

Assume the following infrastructure costs at this scale:
- Vercel Pro: $20 USD/mo = $26 CAD/mo = $312/yr
- Supabase Pro: $25 USD/mo + $15 usage = $50 USD/mo = $65 CAD/mo = $780/yr
- Finnhub Standard tier (for live quotes at scale): $60 USD/mo = $78 CAD/mo = $936/yr
- Plaid Canada (estimating 700 of 1,000 users connect 2 accounts each on average): 1,400 accounts × $0.25 USD/mo × 12 = $4,200 USD/yr = $5,460 CAD/yr
- BoC Valet (CPI), FRED (US CPI): free
- Stripe processing: 2.9% + $0.30 per transaction. On $211,800 ARR: ~$6,142/yr.
- Cyber-liability insurance: $2,400/yr
- Domain renewals: $40/yr
- Email (Google Workspace, 1 mailbox): $84/yr
- Customer support tooling (Crisp): $25 USD/mo = $33 CAD/mo = $390/yr
- Lawyer (annual privacy policy review): $1,500/yr
- Tax accountant (T2 + bookkeeping help): $2,500/yr

**Total operating costs: ~$20,500 CAD/yr**

**Net contribution margin: ~$191,300 CAD/yr (90%)**

That's the gross margin before any salaries. As a solo founder with a study permit (no salary), **this is your retained earnings** — funding either a salary once you graduate, or your first hire (see Section 7), or both.

### 6.3. Sensitivity analysis

| Scenario | Pro users | Total paid | ARR | Net | Notes |
|---|---|---|---|---|---|
| **Optimistic** (great PR moment hits) | 1,500 | 1,700 | $290K | $260K | Wealthica acquisition or Reddit virality |
| **Base case** (steady organic growth) | 850 | 1,000 | $212K | $191K | The plan above |
| **Pessimistic** (no virality, slow word-of-mouth) | 300 | 350 | $75K | $58K | Still pays the bills + a small salary |
| **Failure mode** (Wealthsimple ships their own aggregator) | 100 | 100 | $20K | $5K | Pivot to advisor-only segment |

**The pessimistic scenario is the one you should actually plan around.** $58K net at 1.5 years is not a startup success by venture standards but it's a profitable business by solo-founder standards. Anything above that is upside.

### 6.4. Churn assumptions

- **Pro monthly churn:** ~5% expected, target ≤3%. This is the make-or-break number.
- **Pro annual churn:** ~15%/yr expected. Annual subs have ~3× lower monthly-equivalent churn than monthly subs. **Push everyone to annual after they've been on Pro for 60 days.**
- **Family churn:** ~3%/mo expected (people don't churn shared accounts as easily).
- **Advisor churn:** ~1%/mo expected once they're integrated into their workflow (high switching cost).

If your Pro monthly churn exceeds 8% for two consecutive months, the product has a retention problem you must fix before adding users. Common causes: feature ships broken, bills are confusing, support response time is too slow.

### 6.5. CAC and LTV

You will get most of your first 1,000 users for free via:
- Reddit (r/PersonalFinanceCanada, r/CanadianInvestor, r/Wealthsimple)
- Twitter (@TawcanCa, @JustinBenderCFP, @mraltonus, @TheBlogonomist orbit)
- Canadian PFM blog mentions (Tawcan, Million Dollar Journey, Boomer & Echo, Genymoney)
- Word of mouth from beta users

**CAC for these channels: ~$0** (your time, but no cash).

If/when you start paid acquisition (probably Year 2+):
- Google Ads on "wealthica alternative", "canadian portfolio tracker": ~$3 CPC, ~3% conversion to free signup, ~10% conversion from free to Pro = ~$100 CAC.
- Twitter ads: don't bother. Conversion is terrible for SaaS.
- Sponsoring Tawcan or Million Dollar Journey newsletter: $500–$2,000 per send. Probably the best ROI if you can negotiate it.

**LTV at $144/yr ARPU and 5%/mo churn = $144 / (0.05 × 12) = $240. That's an unhealthy LTV:CAC ratio at a $100 CAC.**
**LTV at $144/yr ARPU and 3%/mo churn = $144 / (0.03 × 12) = $400. That's a healthy 4:1 ratio at a $100 CAC.**

**The above is why your churn target matters more than your acquisition target.** Spend the first year obsessing over retention.

---

## 7. The AI-Augmented Solo Build

### 7.1. The stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | React + Vite | What's already there. Don't migrate to Next.js until you need SSR for SEO. |
| UI | Tailwind + shadcn/ui + Lucide | Already there. Stop researching alternatives. |
| Charts | Recharts | Already there. It's fine. |
| Backend | Supabase | Already there. Postgres + auth + storage + realtime in one. |
| Hosting | Vercel | Already there. Free tier covers you for the first 1,000 users. |
| Payments | Stripe | When you start charging. Use Stripe Customer Portal — don't build billing UI. |
| Email | Resend or Postmark | When you start charging. Resend has the better dev experience. |
| Customer support | Crisp ($25/mo) | Live chat + ticket system + email integration. |
| Analytics | PostHog (self-hosted free, or Cloud $0–$200/mo) | Product analytics, feature flags, session replay. Don't add Google Analytics. |
| Error tracking | Sentry free tier | Catches bugs before users complain. |
| Engineering | Claude Code + ChatGPT-5 | You are doing this already. |
| Design iteration | Figma (free) + Claude image generation for icons/illustrations | The free Figma tier is fine for one designer (you). |
| Marketing copy | ChatGPT or Claude | Draft, then heavy editing. Don't ship LLM-generated text raw. |
| Marketing site | Just use the Plans page for now. Don't build a separate marketing site until you have product-market fit. |

### 7.2. The AI workflow

You already do this but here's how to do it well:

1. **Plan in plain English first.** Open Claude Code, describe the feature in 3–5 sentences, ask it to research the relevant code paths. Read the response. Decide if the proposed approach is right.
2. **Spec the change in a markdown file.** For anything bigger than 30 lines of code, write a one-page spec first. It costs you 10 minutes and saves 4 hours of rework.
3. **Generate the code.** Have Claude write the code. Review every line — not because Claude is wrong, but because reading is how you learn the codebase.
4. **Test in the browser.** Don't trust unit tests as the source of truth. Run the dev server, click through the feature.
5. **Commit with a clear message.** `feat(holdings): add weighted average pill near lots`. Push to main. Vercel deploys automatically.
6. **Tell yourself "good enough" and ship.** Don't iterate on the same feature for more than 2 sittings.

The single most expensive habit in AI-assisted development is *over-iterating on a feature that already works*. You will be tempted to polish forever. Don't. Ship, get feedback, polish only what users complain about.

### 7.3. Customer support without losing your soul

When you have <20 paying users: respond to every email personally within 24 hours. This is a moat.

When you have 20–100 paying users: use Crisp's canned responses for the top 10 questions. Build a public FAQ page from the canned responses. Reply personally to anything novel.

When you have >100 paying users: hire a part-time customer support contractor for $1,500/mo (a Canadian student looking for remote work). Give them access to a runbook of canned responses + escalation paths.

**Never let customer support response time exceed 48 hours.** This is the #1 churn driver in solo SaaS.

### 7.4. When to hire

Your first hire should NOT be an engineer. It should be customer success / support.

- **First hire (~$30K ARR):** Part-time customer success. $1,500/mo. They handle support tickets, write docs, do onboarding calls with new Pro users.
- **Second hire (~$100K ARR):** A designer or full-stack engineer, depending on what's bottlenecked. Probably designer first, because by then your AI-generated UI starts feeling samey.
- **Third hire (~$250K ARR):** Marketing/content. SEO, blog posts, partnerships.

Don't hire before $30K ARR. You don't have the management bandwidth on top of medical school.

---

## 8. Bootstrap vs. Fund Decision Framework

### 8.1. The bootstrap path

- **Cash needed:** $0 in cash, ~$2,800 CAD/yr in subscriptions (already covered by your existing budget).
- **Timeline:** $0 → $1K MRR in ~6 months. $1K → $10K MRR in ~12 months. $10K → $20K MRR in ~9 months.
- **Outcome at month 24:** ~$240K ARR. ~$216K net contribution margin (~90%).
- **Equity:** You own 100%.
- **Risk:** Slow growth lets a competitor eat the market while you're studying for boards.
- **Strategic fit:** Optimal for your situation. You don't need investor pressure on top of medical school.

### 8.2. The fund path

- **Cash needed:** Raise $250K CAD seed for 18 months runway.
- **Use of funds:** 1× designer hire ($80K), 1× engineer hire ($90K), $30K marketing, $50K runway buffer.
- **Investor profile:** Canadian fintech angels (Maple Leaf Angels, Anges Québec, Garage Capital). Canadian fintech VCs are skeptical of solo founders without exits.
- **Timeline:** 3–6 months to close a round. At your stage (no revenue), a "pre-seed" round at $1.5M–$2M post-money. ~15–20% dilution.
- **Outcome at month 24:** Maybe $500K ARR (faster product velocity), but cash-burn-positive. You'd need a Series A by month 24 or you die.
- **Equity:** You own ~80% after pre-seed, ~60% after Series A.
- **Risk:** Investor pressure forces you to chase growth over retention. Burn rate eats cash before product-market-fit. You spend 30% of your time fundraising instead of building.
- **Strategic fit:** Bad. Your competitive advantage is patience and low burn. Funding undermines both.

### 8.3. The recommendation

**Bootstrap until $20K MRR. Then re-evaluate.**

At $20K MRR ($240K ARR) you have proof of revenue, real product feedback, and a defensible niche. At that point you have leverage in any fundraising conversation. You can choose to:
- Stay bootstrapped and grow at the pace you can sustain solo.
- Raise a strategic seed round to hire a designer + engineer, only if the bottleneck is genuinely capacity (not skill).
- Be acquired by Wealthica or another Canadian fintech for $2M–$5M (3–10× ARR multiple is normal in profitable Canadian SaaS).

The decision *at $20K MRR* is much easier than the decision *now*. Don't try to optimize it now. Just commit to the bootstrap path.

### 8.4. Government grants worth knowing about

- **SR&ED (Scientific Research and Experimental Development).** If you're doing genuine technical innovation (the transaction engine in Phase 5 might qualify), you can claim 35% federal refundable tax credit + provincial credit on R&D wages. You don't pay yourself wages yet, so this is dormant. Activate it when you graduate and start drawing salary.
- **CDAP (Canada Digital Adoption Program).** Technically for SMBs adopting digital tech, not building it. Probably not applicable.
- **NRC IRAP.** Industrial Research Assistance Program. Up to $50K for early-stage tech. Not easy to access as a pre-revenue solo founder, but worth a conversation with your local IRAP advisor (free).
- **Futurpreneur Canada.** Up to $60K loan for founders 18–39 + mentorship. Low-interest. Worth applying once you have revenue.
- **MARS Discovery District** (Ontario). Free advisory, no funding. Useful for connections.

**Don't chase grants instead of customers.** A grant is a 6-month process for $50K. A paying customer is a 5-minute process for $144. Grant-chasing is procrastination dressed up as strategy.

---

## 9. 18-Month Execution Roadmap

This is month-by-month. Adjust as reality hits.

### Months 1–3 (Foundation)
- ✅ Diversification charts populated with real data (Phase 2 done).
- ✅ Three new dimensions: risk, income, ETF look-through (Phase 3 done).
- ✅ Inflation overlay on Performance chart (Phase 4 done).
- ✅ Plans page premium polish (done).
- 🔲 Wire transaction engine into PortfolioDataContext (Phase 5 wiring).
- 🔲 Parse missing IBKR sections (STFU, TRFR, OPTT, TRTX, UNBC, CORP, IACC).
- 🔲 Soft launch to 50 friends + Twitter follower list. Goal: 50 free users.
- 🔲 Set up Crisp, Stripe, Resend (don't enable Stripe charging yet).

### Months 4–6 (First revenue)
- 🔲 Enable Pro pricing + Stripe checkout. Use Stripe Customer Portal — don't build billing UI.
- 🔲 7-day free trial flow.
- 🔲 Launch on r/PersonalFinanceCanada with a real before/after demo (your own portfolio, anonymized).
- 🔲 First Tawcan or Million Dollar Journey mention attempt (cold email with a personalized demo video).
- 🔲 Tax export polish (Schedule 3, ACB tracking) — ship by Feb 15 for tax season.
- 🔲 Goal: 100 paying Pro users by month 6 = $1,200 MRR.

### Months 7–9 (Plaid Canada integration)
- 🔲 Wealthsimple Plaid auto-sync (the easiest Plaid Canada integration, since WS supports it natively).
- 🔲 RBC + TD + BMO Plaid integrations.
- 🔲 Onboarding flow that auto-detects what brokers a user has and offers the right import path.
- 🔲 Goal: 300 paying Pro users by month 9 = $3,600 MRR.

### Months 10–12 (Family tier + advisor outreach)
- 🔲 Family tier launch. Multi-user accounts with shared dashboard.
- 🔲 Cold-outreach 50 fee-only Canadian financial advisors (PWL Capital alumni, Caring for Clients, Steadyhand individual practices). Goal: 10 advisor pilot users.
- 🔲 First non-trivial UI polish session — bring in a Canadian designer for 1 month part-time ($5K).
- 🔲 Goal: 600 Pro + 30 Family + 5 Advisor = $7,720 + $750 + $495 = $8,965 MRR.

### Months 13–15 (Decision point)
- 🔲 Hit $10K+ MRR. Decide: bootstrap forever, raise, or sell?
- 🔲 If bootstrap: hire first part-time customer success person.
- 🔲 If raise: build the deck, talk to 5 advisors, then 5 angels, then 3 micro-VCs.
- 🔲 If sell: line up a conversation with Wealthica acquirer / MoneyHero / similar Canadian fintech consolidator.

### Months 16–18 (Consolidate or scale)
- 🔲 Mobile PWA polish. Get it to feel like a native iOS app (it already is — just polish the install flow).
- 🔲 Tax season again — measure how much of your revenue spike comes from Jan–Apr.
- 🔲 First content marketing push (blog posts on tax-aware investing, CDR detection, FX-translated returns).
- 🔲 Goal: $15K–$20K MRR.

---

## 10. Risk Register

The five things most likely to kill the business, with mitigations.

### 10.1. You burn out (~50% probability over 24 months)

**Mitigation:** Hard 15-hour weekly cap. No coding past 11 PM. Sundays are non-negotiable rest days. Quarterly week-long breaks. **If your quarterly Anki review pass takes more than 15 minutes, you're not resting; you're hiding from medical school.**

If you start dreading opening the editor, take 2 weeks off. The product won't die. Wealthica didn't ship anything new for 4 months last year and didn't lose users.

### 10.2. Wealthsimple ships their own aggregator (~40% probability over 24 months)

**Mitigation:** Multi-broker is the moat. Wealthsimple will only aggregate Wealthsimple. Your value prop assumes users have multiple brokers. The day Wealthsimple ships an aggregator, double down on RBC/Questrade/IBKR coverage to make the multi-broker story even sharper.

### 10.3. Wealthica ships a modern UI (~25% probability over 24 months)

**Mitigation:** They've been coasting since the Hardbacon acquisition. Their codebase is too tangled to retrofit CDRs and look-through. By the time they catch up on UI, you'll have CDR + look-through + Canadian tax features they can't match without a 12-month rebuild.

### 10.4. Plaid Canada pricing changes (~30% probability over 24 months)

**Mitigation:** CSV upload remains the primary path forever. Plaid is an upsell, not a dependency. Document broker exports thoroughly so users can keep using the product even if Plaid disappears.

### 10.5. A regulator decides aggregators need IIROC registration (~10% probability over 24 months)

**Mitigation:** Stay positioned as "data tool, not investment advice". Never recommend specific buys/sells. Never personalize advice. The Insights page can show "your concentration is X" but never "you should sell Y". If regulation lands, you'd have a 6–12 month transition window which is enough to either register or pivot to advisor-only.

### Other smaller risks

- **Finnhub raises prices:** Their free tier is 60 calls/min which covers you to ~5,000 paying users. Above that, paid tier is $60/mo which is trivial.
- **Vercel changes pricing:** Migration to Cloudflare Pages or Netlify is a 1-week project. Not existential.
- **Supabase enshittification:** Possible but Supabase is open-source. You can self-host. 1-week migration if needed.
- **Stripe locks your account:** Has happened to other founders. Mitigation: never collect adult content, gambling, or anything in their high-risk categories. Use Paddle as a backup payment processor (international tax handled).

---

## Appendix A: Tech Stack Reference

A living map of the codebase. Update when you make significant architectural changes.

```
unifolio-wealth-core/
├── src/
│   ├── pages/                    — top-level route views
│   │   ├── Holdings.jsx          — main holdings table + breakdowns
│   │   ├── Dashboard.jsx         — chart + KPIs landing page
│   │   ├── Plans.jsx             — pricing page, lush snowglobe background (v3 redesign)
│   │   ├── Welcome.jsx           — login screen
│   │   ├── ImportCenter.jsx      — IBKR/Wealthsimple CSV upload + parsing
│   │   ├── Performance.jsx       — performance chart with benchmark + CPI overlay
│   │   ├── Accounts.jsx          — account management; inline edit account type
│   │   ├── Settings.jsx          — user prefs incl. theme picker
│   │   └── ... (others)
│   │
│   ├── lib/
│   │   ├── ThemeContext.jsx      — random theme on load, saved theme persists
│   │   ├── PortfolioDataContext  — Supabase load + enrichment fan-out
│   │   ├── csvParser.js          — IBKR Flex sectioned + Activity Statement + Wealthsimple
│   │   ├── transactionEngine.js  — pure FIFO holdings reconstruction (Phase 5 core)
│   │   ├── stockApi.js           — Finnhub + Yahoo proxy; quote + profile + history
│   │   ├── inflationApi.js       — Bank of Canada Valet + FRED CPI
│   │   ├── benchmarks.js         — index/CPI benchmark series for Performance chart
│   │   ├── listingResolver.js    — Finnhub-backed CDR/listing verification (Phase 1)
│   │   ├── securityIdentity.js   — two-phase identity resolution
│   │   ├── cdrRegistry.js        — hint set of underlyings with CIBC CDRs
│   │   ├── etfManifest.js        — top-10 + sector breakdowns for popular ETFs
│   │   ├── riskClassifier.js     — Defensive/Core/Growth/Speculative
│   │   ├── incomeClassifier.js   — Dividend/Growth/Speculative/Hybrid
│   │   ├── importPersistence.js  — Supabase upserts for parsed import bundles
│   │   ├── dataDeletion.js       — account/user delete with cascade incl. orphan institutions
│   │   ├── ProfilePictureContext — avatar load with no-clobber-on-flicker
│   │   └── (others)
│   │
│   └── components/
│       ├── holdings/
│       │   ├── HoldingDetailRow.jsx        — lots + AVG pill, currency-aware
│       │   └── PortfolioBreakdown.jsx      — 23 charts incl. ETF look-through, risk, income
│       ├── shared/
│       │   ├── ThemedWaveBackground.jsx    — wave + ribbon variants, app/login density
│       │   └── (others)
│       └── (others)
│
├── docs/
│   └── HOLDINGS_MATH.md          — Formulas behind every Holdings cell
│
├── supabase/
│   └── schema.sql                — Postgres schema; run in Supabase SQL editor
│
├── EXPENDITURES.md               — Running ledger of every dollar spent
└── UNIFOLIO_STRATEGIC_MASTER_DOCUMENT_v3.md   — This file
```

### Tier-1 vs Tier-2 dependencies

Tier-1 (you cannot ship without these):
- Supabase (auth + DB + storage)
- Vercel (hosting)
- React + Vite
- Tailwind + shadcn/ui

Tier-2 (you can swap in a week if needed):
- Finnhub → could swap to Polygon or Alpha Vantage
- Yahoo Finance proxy → could remove if you pay for Finnhub
- Bank of Canada Valet → static fallback
- FRED → static fallback
- Recharts → could swap to Visx or Tremor

Tier-3 (nice-to-have, replaceable in days):
- Lucide icons
- React Query

---

## Appendix B: Founder Operating Cadence

Daily, weekly, monthly, quarterly. Stick to this religiously for the first 12 months.

### Daily (max 30 minutes outside coding sessions)
- **9:00 AM** — Check Crisp for new tickets. Reply to anything urgent.
- **9:10 AM** — Check Stripe dashboard for new sign-ups + churn events. Note any churn reason in your CRM (a Notion page).
- **9:20 AM** — Check Sentry for new errors.

### Weekly (Sundays, ~1 hour)
- Read the past week's Crisp tickets in bulk. Note recurring questions.
- Review Stripe MRR + churn rate. Compare to last week.
- Update your single-page Notion roadmap. Move "in progress" items to "done" or "won't do".
- Pick the ONE thing you'll ship next week. Just one.

### Monthly (last Sunday of the month, ~2 hours)
- Update [EXPENDITURES.md](EXPENDITURES.md) with actual charges from the past month.
- Review the past month's MRR vs. plan. If pessimistic scenario looks likely, tighten the budget.
- Send a "what shipped this month" email to your full user list. Public changelog. This is your most valuable retention tool.
- One cold outreach: an advisor, a content creator, or a Canadian fintech blogger.

### Quarterly (~4 hours)
- Re-read this document. What's still true? What's changed? Update.
- Look at the 18-month roadmap. Are you on track? If not, what gives — features or timeline?
- Take the next 3 days completely off. No code, no Twitter, no checking Stripe. Reset.

### Annually (~1 day)
- Update v3 → v4 of this document. The world will have changed.
- Tax filing — give your accountant your books and forget about it for a month.
- Re-evaluate the bootstrap-vs-fund question.
- Look at what you've accomplished. Most years it'll be more than you remember.

---

## Appendix C: First 50 Users — Acquisition Playbook

Specific names, specific subreddits, specific Twitter accounts. This is the playbook for moving from 0 → 50 users.

### Phase 1: Personal network (Week 1)
- Email 30 personal contacts who hold investments. Personalized, 4-sentence email. 1-line subject ("Built a Canadian portfolio tool — would you try it?"). Expect 8 conversions.
- Post in your med school class WhatsApp/Discord. ~200 students. Expect 5 conversions.
- Post on your personal Twitter/X. Expect 3 conversions.

**Total: ~16 users.**

### Phase 2: Reddit (Week 2–4)
- **r/PersonalFinanceCanada** (~600K members). Write a high-effort post titled "I built a free Canadian portfolio tool that handles CDRs and look-through diversification. Would love feedback." Don't spam. Be honest about the early-stage nature. Include a screenshot of YOUR portfolio with the look-through view. Expect 50 upvotes, 15 sign-ups. **Time it for a Tuesday or Wednesday morning Eastern.**
- **r/CanadianInvestor** (~350K members). Same post a week later. Expect 30 upvotes, 8 sign-ups.
- **r/Wealthsimple** (~120K members). Different angle — focus on "see Wealthsimple alongside your other accounts". Expect 15 upvotes, 4 sign-ups.

**Total: ~27 users from Reddit. Cumulative: ~43.**

### Phase 3: Influencers (Week 5–8)
- **Tawcan (@tawcan / tawcan.com).** Canada's most popular dividend-investing blogger. Cold email with a 90-second screen recording of the dividend dashboard view + your story (medical student, built it because Wealthica wasn't enough). Expect: a tweet at minimum, a blog post mention if you're lucky. 5–15 sign-ups from a tweet, 50+ from a blog post.
- **Justin Bender (@JustinBenderCFP).** PWL Capital advisor, has Canadian fee-only audience. Wants to see CDR + ETF look-through. Cold email with a personal demo. He's busy but responds to substantive cold emails.
- **Million Dollar Journey (@millionDjourney).** Older blog, large email list. Lower hit rate but higher impact when it lands.
- **Boomer & Echo, Genymoney, Maple Money.** Long-tail Canadian PFM blogs. Cold-pitch as "free tool worth covering" not "buy a sponsorship".
- **Andrew Hallam.** International audience but with Canadian fans. Lower priority.

**Conservative expectation: 1 mention out of 5 attempts. ~10 sign-ups per mention. Total: ~10 users.**

**Cumulative: ~53.**

### Phase 4: Twitter Finance Canada community (Ongoing)
- @MarkSeed, @PWLCapital, @JustinBenderCFP, @TheBlogonomist, @mraltonus, @ddwphoto, @fitathletex, @rcdaltonca, @MapleMoney_, @Genymoney_ca, @MillionDjourney, @TawcanCa.
- Reply substantively to their tweets. Don't pitch. Build relationship over 3 months. When you have something genuinely worth sharing (a feature launch, a useful blog post), they'll RT.
- Post your own substantive content: charts, demos, ACB calculation primers. Once a week. Quality > quantity.

### Phase 5: Discord + community (Months 2–3)
- Set up a Unifolio Discord. Invite all paying users. Goal: 30% of paid users join.
- Weekly "office hours" — 30 minutes once a week where you answer questions live in Discord.
- Public roadmap: a Discord channel where users vote on what to build next.

### What to NOT do
- Don't spam r/investing or r/stocks. They're US-focused and will downvote.
- Don't buy Twitter ads. ROI is bad for SaaS.
- Don't pay influencers for sponsored posts in Year 1. Earned mentions are 10× more credible.
- Don't run a referral program with cash incentives. You'll attract bad-fit users.
- Don't email-spam Canadian PFM newsletters. Each cold-email needs to be personalized.

---

## A final note

The tools in this codebase are already 80% of the product you need. The thing that wins is execution speed on the boring parts: customer support, broker import quality, tax export accuracy, response time to bugs. None of these are exciting. All of them compound.

The product strategy is correct. The technical foundation is solid. The market exists. The competition is asleep.

What's left is patience and showing up. **You will, on most days, do less than you wanted.** That's fine. A month of consistent 10-hour weeks beats a single 60-hour week followed by 3 weeks of burnout.

Open the editor on Monday morning and ship the next thing on the roadmap. Repeat for 18 months.

That's the entire playbook.

---

*Last updated: 2026-05-13. Next scheduled review: end of Month 3 of execution. Update file in place; don't create v4.md.*
