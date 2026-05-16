# Tax Optimization Rule Book

Companion to `HOLDINGS_MATH.md`. Documents the Canadian tax rules encoded in
`src/lib/taxOptimizer.js`. **Not tax advice.** All rules cite the practitioner
consensus or CRA guidance as of the writing date. Update when CRA changes a
treaty rate, contribution cap, or inclusion rate.

## Account Type Taxonomy

The optimizer groups Canadian account types into three buckets:

| Class         | Members                              | Tax treatment of growth    | Tax treatment of withdrawal |
|---------------|--------------------------------------|----------------------------|------------------------------|
| `tfsa_like`   | TFSA, FHSA                           | Tax-free                   | Tax-free (FHSA: home only)   |
| `rrsp_like`   | RRSP, LIRA, RESP, RDSP               | Tax-deferred               | Taxed as income (RRSP/LIRA)  |
| `taxable`     | Margin, Cash, Non-Registered, Joint  | Taxed in year realized     | Not applicable               |

Recommendations only suggest moves into account *classes* the user already
holds. We never tell users to "open an RRSP" — that's a financial-planning
question, not a tax optimization.

## Rule 1: US-Dividend Withholding in TFSA → Relocate to RRSP

**Rule:** US-source dividends paid into a TFSA / FHSA are subject to 15%
withholding tax under the Canada-US tax treaty. That withholding is **not
recoverable** because the TFSA isn't visible to the IRS as a taxable account
for treaty purposes. Inside an RRSP, the treaty *does* apply and US dividends
are paid in full.

**Citation:** Canada-United States Tax Convention, Article XVIII(7). CRA
Interpretation Bulletin IT-265R3 and subsequent IT-Folio guidance.

**Trigger:** Holding is in `tfsa_like`, has paid USD dividends in the last
365 days, and the user owns an `rrsp_like` account.

**Savings estimate:** `annual_USD_dividends × 0.15`.

**Caveat:** Selling in TFSA and rebuying in RRSP costs contribution room on
the RRSP side. In-kind transfer between registered accounts is also possible
but follows special rules. We surface the recommendation; the user decides
when (e.g. next contribution cycle).

## Rule 2: Interest-Bearing Assets in Taxable → Shelter

**Rule:** Interest income (bonds, GIC ETFs, HISA ETFs) is taxed at the
holder's full marginal rate when realized in a non-registered account. Inside
a TFSA or RRSP, that tax is eliminated or deferred.

**Trigger:** Holding is in a `taxable` account, classifies as fixed-income
(via asset class, a known bond-ETF prefix, or a history of `Interest`
transactions), pays meaningful annual income, and the user owns a `tfsa_like`
or `rrsp_like` account.

**Savings estimate:** `annual_interest_income × marginal_tax_rate`.

**Caveat:** Sheltering interest in TFSA uses contribution room that could
have hosted higher-growth assets. The optimizer surfaces the headline tax
saving; the asset-allocation trade-off is the user's call.

## Rule 3: Canadian Eligible Dividends in TFSA → Move to Non-Registered (Optional)

**Rule:** Canadian eligible dividends qualify for the dividend tax credit
(DTC) in a non-registered account, producing an effective marginal rate near
zero (or negative at lower brackets). Inside a TFSA, the DTC is wasted.

**Trigger:** Holding is in `tfsa_like`, pays CAD dividends, yield ≥ 3% (so it
matters), and the user owns a `taxable` account.

**Severity:** `medium`. Most users at high marginal rates still prefer
TFSA-tax-free growth over the DTC arbitrage. The optimizer surfaces it as
information, not a hard recommendation.

**Caveat:** Don't move growth equities out of TFSA chasing this — capital
gains tax-free still beats DTC for long-horizon holdings.

## Rule 4: Loss Harvesting in Taxable Accounts

**Rule:** Realizing a capital loss in a non-registered account offsets
capital gains (current year, carry back 3 years, or carry forward
indefinitely). Losses in TFSA / RRSP / FHSA are **not** tax-deductible — they
just shrink the account.

**Trigger:** Holding is in `taxable`, unrealized loss > $50.

**Savings estimate:** `|loss| × 0.50 × marginal_tax_rate` (Canadian 50%
capital gains inclusion).

**Replacement candidates:** To maintain market exposure without triggering
the **superficial loss rule** (CRA: identical property bought within ±30
days), the optimizer suggests ETFs from a *different* canonical index group
that still gives similar exposure. Example: selling VFV (S&P 500) at a loss
and immediately buying VUN (Total US Market) is generally acceptable because
they track different indexes.

**Caveats surfaced:**
- If a Buy of the same ticker happened in the last 30 days, the recommendation
  flags `wouldTriggerSuperficial: true` with a red badge.
- "Identical property" is a CRA judgment call for ETFs. Different indexes
  are practitioner-safe; different share classes of the same fund are not.
- Spousal accounts are part of the superficial-loss rule and **not** checked
  by the optimizer today (we don't have visibility into a spouse's portfolio).

## Rule 5: Contribution Sequencing

The sequence is a rule of thumb based on the user's marginal tax rate and
which registered accounts they already own:

| Marginal Rate | Order                                            |
|---------------|--------------------------------------------------|
| ≥ 32%         | FHSA (if held) → RRSP → TFSA                     |
| < 32%         | FHSA (if held) → TFSA → RRSP                     |

The 32% break-even is a practitioner heuristic: below it, the RRSP's deduction
is less valuable than tax-free TFSA growth.

**Not yet integrated:**
- CRA contribution room. Requires either CRA MyAccount integration or user
  self-report.
- Home-buying timeline (affects FHSA priority).
- Pension adjustments / DPSP / RRSP carry-forward room.

## Marginal Tax Rate Source

Set by the user in `/profile` under "Tax Settings". Stored on
`user_profiles.marginal_tax_rate` as a percent (e.g. `43.41` for 43.41%).
Defaults to 30% if unset. Common bracket presets are surfaced as quick-pick
buttons in the UI:

| Income range            | Approximate combined rate |
|-------------------------|---------------------------|
| ~$30K–$55K              | 24%                       |
| ~$55K–$110K             | 30%                       |
| ~$110K–$170K            | 38%                       |
| ~$170K–$245K            | 45%                       |
| $245K+                  | 53%                       |

Province-specific calibration is the next iteration — the `user_profiles.province`
field is already stored.

## What This Engine Does NOT Do (Yet)

- **Spousal account coordination** (superficial loss rule extends to spouse).
- **Pension adjustment / DPSP room** in RRSP calculations.
- **Year-end harvesting agent** that runs in Nov/Dec and emails the user a
  personalized harvest list (Feature 4 in the strategy memo).
- **In-kind transfer instructions** (which broker forms, contribution-room
  impact specifics).
- **Quebec-specific** dividend gross-up math (different from federal).
- **Currency conversion** to user's home currency for the headline number —
  savings are shown in the dividend's native currency.
