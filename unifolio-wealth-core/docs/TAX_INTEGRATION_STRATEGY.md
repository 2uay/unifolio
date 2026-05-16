# Tax Integration Strategy — Canada + US

Companion to `TAX_OPTIMIZATION.md`. That doc covers the *rules* the current engine encodes. This doc covers *how Unifolio gets data into the engine* and *what insights become possible at each integration depth.* It also catalogs the loopholes worth programmatically detecting.

## The Thesis

The Tax Optimizer (`/optimize`) and Loss Harvest Center (`/harvest`) currently run on data the user manually imported. That's the floor. The ceiling is an always-on tax engine that:

1. Pulls slip data directly from the source (broker, CRA, IRS)
2. Reasons across an entire household (user + spouse + kids' RESPs)
3. Surfaces loopholes proactively — not just at the November harvest moment but throughout the year as triggering events happen
4. Speaks both Canadian and US tax fluently for cross-border investors (significant Unifolio user segment)

The defensible moat is the *cross-account, cross-year, cross-person reasoning layer* that no broker can do (each broker only sees its own slice) and no tax software does well (TurboTax / Wealthsimple Tax are reactive, single-year, often single-person).

## Available Data Sources

### Canada — tax slips & official sources

| Source | Data | Integration cost | User value | Notes |
|--------|------|------------------|------------|-------|
| **CRA Auto-fill My Return (AFR)** | T4, T5, T3, T5008, RC62, T2202, RRSP/TFSA contribution receipts | **Very high** — requires NETFILE certification with CRA + EFILE access. Multi-month process. | **Very high** — single source of truth | This is the prize. Wealthsimple Tax and TurboTax both have it. Becoming a NETFILE-certified service requires CRA approval, software certification, and meeting RC4018 specs. |
| **T5008 (Statement of Securities Transactions)** | All broker trades for the year, in CRA-prescribed format | **Low** — already exportable from most brokers; we already produce T5008 export for users | **Medium** — duplicates what users already have | We currently *export* T5008. The opposite direction (parse a T5008 the user uploads from a broker we don't otherwise integrate with) would unlock users on Questrade, BMO InvestorLine, etc. |
| **T5 / T3 slips** | Dividend/interest income from non-broker sources (mutual funds, trusts, distributions) | Medium — PDF OCR + format detection | High — non-broker income is invisible today | Most users don't realize T3 distributions (REITs, mutual fund trusts) have a separate tax character (capital gains vs. eligible dividends vs. ROC). |
| **RRSP / TFSA contribution receipts** | What you contributed, when, and your remaining room | Low for the slip; medium for the room (room data is only on CRA NOA) | Very high — drives the Contribution Sequencer | Without this, the sequencer is a rule of thumb. With it, it's personalized. |
| **CRA Notice of Assessment (NOA)** | Contribution room, prior-year carryforwards | High — only available via CRA MyAccount login (no public API) | Very high | Workaround: ask the user to upload a NOA PDF; OCR-parse it. |
| **Direct broker APIs** (Questrade, Wealthsimple, IBKR) | Live transactions + slip URLs | Medium per broker | High — eliminates the CSV import step | Questrade has a public API; Wealthsimple does not (but its mobile app proxies one); IBKR has Flex Query (already supported). |

### US — tax forms & official sources

| Source | Data | Integration cost | User value | Notes |
|--------|------|------------------|------------|-------|
| **Form 1099-B** | Brokerage proceeds + cost basis | Low (PDF parsing for major brokers) | High | Schwab / Fidelity / IBKR / Robinhood have predictable formats. |
| **Form 1099-DIV / 1099-INT** | Dividends and interest | Low (same PDFs as 1099-B usually) | High | Distinguishing qualified vs. ordinary dividends matters at the 20% LTCG bracket. |
| **Form 1099-R** | Retirement distributions | Low | Medium | Triggered by IRA / 401k withdrawals. |
| **IRS Direct File** | The IRS's own e-file system | **Very high** — IRS does not publish a programmatic API; Direct File is a hosted UI | N/A for integration | The IRS roadmap is unclear; Treasury's Modernized e-File (MeF) is gated to authorized e-file providers. |
| **Plaid Income** | W-2, paystubs | Low (we already use Plaid) | Medium | Useful for marginal-rate inference; less useful for portfolio tax. |
| **Tax-software import formats** (`.txf`, `.tax`, JSON) | Round-trippable to TurboTax / H&R Block / FreeTaxUSA | Low — well-documented schemas | **Very high** — Unifolio outputs a `.txf` and the user's tax software imports it in one click | This is the "delight moment." |

## Phased Integration Plan

### Phase 1 (4–6 weeks): Slip parsing
Both Canada and US. Add a slips page where users upload PDFs of T5008 / T3 / T5 / 1099-B / 1099-DIV. OCR + format detection populates a `tax_slips` table. The Tax Optimizer can then reason about income types it currently can't see (mutual fund distributions, foreign dividend withholding, etc.).

**Why first:** lowest integration cost, immediate user-visible value, no third-party dependency. Differentiates from Sharesight (which doesn't do this).

### Phase 2 (8–12 weeks): Tax-software output
Generate `.txf` (US) and Wealthsimple Tax CSV (Canada) from the user's data so they can one-click import into their existing tax tool. Becomes a sticky habit: every February, users come to Unifolio first to generate the export.

**Why second:** zero approval needed (just file format work). Captures the "I do my taxes" moment as a Unifolio touchpoint without competing with tax software.

### Phase 3 (3–6 months): CRA AFR + spouse linking
Apply for CRA NETFILE certification. Begin EFILE certification process. Add a spouse-linking flow (with the spouse's explicit consent) to enable household-level reasoning. Once AFR is integrated, the Tax Optimizer's data quality goes from "what the user told us" to "what CRA sees" — and the spouse extension unlocks superficial-loss detection across both portfolios (currently a known gap).

**Why third:** highest value, longest cost. Should only start after Phase 1+2 prove demand.

### Phase 4 (6–12 months): Continuous-loop tax engine
Replace the "open the Optimizer page" UX with a calendar-aware system that pushes recommendations at the right moment:

- January — RRSP deadline reminder with personalized contribution amount
- February — Tax-slip import nudge as slips arrive
- March — "We pre-filled your Wealthsimple Tax import — review and submit"
- April — Refund-arrival follow-up: "Use your $X refund to top up TFSA"
- October–November — Year-end loss harvest plan (the Nov campaign already specced)
- December 28 — last-call harvest

This is the long-term moat: **continuous tax presence** vs. annual tax software.

## Loophole / Optimization Catalog

Programmatically detectable from the data Unifolio holds (or could hold with the integrations above). Each entry includes: trigger condition + how much it saves + implementation difficulty.

### Canada — high-value, programmatically detectable

1. **Spousal capital-loss transfer.** User holds an unrealized loss in a non-reg account; spouse has realized gains. User can sell at a loss, transfer cash to spouse (gift, no attribution rule for capital), spouse buys the same security. After 30 days, user reacquires from spouse at FMV. The loss attaches to the spouse and offsets their gains.
   *Trigger:* `user_unrealized_loss > $1000 AND spouse_ytd_realized_gain > 0`.
   *Savings:* loss × 0.50 × spouse_marginal_rate. Often $500–$5000.
   *Difficulty:* High — requires spouse linking (Phase 3).

2. **In-kind donation of appreciated securities.** Donating a security with unrealized gain (vs. selling it and donating cash) eliminates the capital gains tax AND gives full FMV deduction.
   *Trigger:* `unrealized_gain > $1000 AND user_charitable_giving_history > 0`.
   *Savings:* gain × 0.50 × marginal_rate, plus the FMV deduction the user was going to take anyway.
   *Difficulty:* Low — engine already knows unrealized gains. Just needs a charitable-giving question at user setup.

3. **Tax-loss carryback (T1A).** A current-year capital loss can be carried back 3 years to offset gains the user paid tax on. Many users don't know.
   *Trigger:* `current_year_net_loss < 0 AND any_of_prior_3_years_net_gain > 0`.
   *Savings:* prior-year tax recovered at their then-marginal rate.
   *Difficulty:* Medium — needs prior-year T1 data (NOA upload or AFR).

4. **T1135 foreign asset reporting threshold.** If foreign assets cost > $100K CAD any time in the year, T1135 is required (penalties for failure to file are $25/day to $2,500). Many users blow through this without realizing.
   *Trigger:* `sum(foreign_holdings.cost_basis_CAD) > 100000 at any point in tax year`.
   *Savings:* avoids $25–$2500 penalty.
   *Difficulty:* Low — engine has cost basis + country.

5. **Pension income splitting at 65+.** Eligible pension income can be split with spouse for up to 50% tax savings.
   *Trigger:* `user_age >= 65 AND has_eligible_pension_income AND spouse_marginal_rate < user_marginal_rate`.
   *Savings:* (user_rate - spouse_rate) × (eligible_income × 0.5). Often $2K–$10K/yr.
   *Difficulty:* Medium — needs age + spouse data.

6. **RESP CESG + provincial grants maximization.** Federal grant matches 20% of contributions to $500/yr; lapses if unused (with limited catch-up). Many parents under-contribute.
   *Trigger:* `has_RESP AND contribution_ytd < $2500_per_beneficiary`.
   *Savings:* $500/yr/beneficiary in grants if maxed.
   *Difficulty:* Low — needs RESP account type + child count.

7. **Foreign tax credit recovery on US dividends in non-reg.** 15% US withholding tax on non-reg dividends is creditable. Most users don't claim because their tax software doesn't ask.
   *Trigger:* `sum(US_dividends_non_reg) > 0`.
   *Savings:* 15% of US dividend income.
   *Difficulty:* Low — engine has dividend currency + account type.

8. **Capital gains reserve for instalment sales.** A capital gain on a property/business sale can be spread over 5 years if payment is in instalments. Saves bracket-stacking pain.
   *Trigger:* `realized_gain > $50000 AND single_position`.
   *Savings:* could shift gain across years to stay in lower brackets.
   *Difficulty:* High — needs full lifecycle awareness.

### US — high-value, programmatically detectable

1. **Specific lot identification.** Default IRS treatment is FIFO. Choosing SpecID at sale (within 90 days of trade settlement) can save thousands by realizing the highest-cost lots first.
   *Trigger:* `partial_sale AND has_multiple_lots AND lot_cost_basis_spread > 10%`.
   *Savings:* (highest_lot_cost - lowest_lot_cost) × shares × LTCG_rate.
   *Difficulty:* Medium — engine has lots; needs a one-click "I'm planning to sell N shares — which lots?" tool.

2. **0% LTCG bracket harvest.** Long-term capital gains taxed at 0% federal up to $47,025 single / $94,050 MFJ taxable income (2026). Below those thresholds, *realizing* gains is tax-free — a strategy called "gain harvesting."
   *Trigger:* `projected_taxable_income < threshold AND has_unrealized_LTCG`.
   *Savings:* up to $47K of LTCG taxed at 0% instead of 15%/20%.
   *Difficulty:* Medium — needs income input from user.

3. **Mega-backdoor Roth (401(k) after-tax).** If the user's 401(k) plan allows after-tax contributions + in-plan Roth conversions, they can contribute up to ~$46K/yr after the regular $23K.
   *Trigger:* `has_401k AND high_income AND plan_allows_after_tax`.
   *Savings:* dramatic — tax-free growth on an extra $46K/yr.
   *Difficulty:* High — requires plan-specific data.

4. **Wash-sale detection across IRA and brokerage.** US wash-sale rule covers IRA buys too — selling a stock at a loss in brokerage and buying same in IRA within 30 days disallows the loss AND permanently lowers IRA basis. Most software misses this.
   *Trigger:* `loss_sell + same_ticker_buy_in_IRA within 30 days`.
   *Savings:* prevents permanently destroyed loss.
   *Difficulty:* Low — Unifolio already detects cross-account buys.

5. **HSA triple-tax-advantage maximization.** Most users use HSA as a current-year medical reimbursement; the actual play is to invest HSA balance, pay current medical out-of-pocket, and reimburse 30 years later tax-free.
   *Trigger:* `has_HSA AND HSA_invested < HSA_cash_balance × 0.5`.
   *Savings:* compounded tax-free growth.
   *Difficulty:* Medium — needs HSA account integration.

6. **Backdoor Roth IRA pro-rata trap.** When converting traditional → Roth, pro-rata rule applies across ALL traditional IRAs. Users with rollover IRAs lose most of the conversion benefit.
   *Trigger:* `attempting_backdoor_roth AND has_traditional_IRA_with_basis > 0`.
   *Savings:* avoids unexpected tax bill at conversion.
   *Difficulty:* High — needs all-IRA visibility.

## Differentiation vs. Competitors

| Capability | Unifolio (proposed) | TurboTax | Wealthsimple Tax | Sharesight | Wealthica |
|------------|---------------------|----------|------------------|------------|-----------|
| Pre-tax-year planning | ✅ Year-round (Optimizer, Harvester) | ❌ Reactive | ❌ Reactive | Partial | Limited |
| Cross-account reasoning | ✅ All accounts on one tax brain | ❌ Per-slip | ❌ Per-slip | ❌ Per-account | ✅ (legacy) |
| Spousal loss coordination | 🟡 Spec'd (Phase 3) | ❌ | ❌ | ❌ | ❌ |
| Behavioral context | ✅ Pro+ surfaces "you panic-sold X" | ❌ | ❌ | ❌ | ❌ |
| Multi-year carryback | 🟡 Phase 3 | ✅ | ✅ | ❌ | ❌ |
| Cross-border (CAD+US) | 🟡 Roadmap | Partial | ❌ | ✅ | ❌ |
| Loophole catalog | ✅ Encoded as rules | ❌ Human-driven | ❌ | ❌ | ❌ |
| Continuous monitoring (vs. annual) | ✅ Sprint plan | ❌ Annual | ❌ Annual | Partial | Limited |

The yellow cells are the moves that turn the green cells into deep moats. None of the competitors are well-positioned to build the behavioral + cross-account + cross-year + cross-border layer; either they're committed to a different distribution (TurboTax/WT have the user once per year), or they're already wound down (Wealthica), or they're global-generic (Sharesight).

## Recommended Next Sprint

Pick from these three, in order of bang-per-buck for a solo founder:

### Sprint A: Slip Parser (4 weeks)
- T5008 PDF parser (most CRA-prescribed format; predictable)
- 1099-B PDF parser (one parser per top-3 broker: Schwab, Fidelity, IBKR)
- New `/slips` page where users upload + review parsed data
- Feed parsed data into the Tax Optimizer's existing reasoning

**Why:** unblocks users on brokers we don't integrate (Questrade, BMO IL, RBC DI). Lowest cost. Most visible.

### Sprint B: Tax-software export (2 weeks)
- `.txf` exporter for US users (TurboTax / H&R Block / FreeTaxUSA / TaxAct all import)
- Wealthsimple Tax CSV exporter for Canadian users
- Email reminder on Feb 15 / March 15: "Your tax export is ready"

**Why:** fastest delight moment. Captures the once-a-year tax habit as a Unifolio touchpoint. Sets up Phase 3.

### Sprint C: Spousal linking + loss-transfer detector (6–8 weeks)
- Spouse invite flow (one-way: I add my spouse with their permission; they see opted-in data only)
- Schema additions: `household_links`, `spousal_consent_log`
- Detector: when user has unrealized loss + spouse has YTD gains, surface the spousal-transfer optimization

**Why:** highest single insight value (often $2K–$10K/yr saved). Establishes the household-graph foundation for everything in Phase 3+.

---

*Not tax advice. Strategy decisions should be made in conjunction with a qualified tax professional. The loophole catalog is researched from public CRA / IRS guidance, but rules change annually — every detector encoded in code needs to cite the current-year rule and update on tax-year boundaries.*
