# Unifolio — Bro-to-Bro Pitch (Canada)

Verified against the live site and shipped code. Every claim below
backs to a specific feature you can click on. Pick whichever length
fits the channel.

---

## The text (one friend)

> Bro. Open your Wealthsimple right now. If you hold XEQT + VFV + ZSP
> you're like 14% Apple/Microsoft/Nvidia combined and you don't even
> know it. Unifolio shows you that in 60 seconds. It also tells you
> which of your losers to sell in December to legally cut your tax bill,
> and spits out a T5008 in April. Free for 2 accounts. $8 CAD/mo for
> the full thing. No card, no email to try it → **unifolio.ca**. Trust
> me.

---

## The full pitch — with proof

Read the whole thing once. Then send it. The point of the pitch is
that every line is a thing the person can verify themselves on the
live demo in under a minute.

---

### Part 1 — The lie your broker tells you

Open Wealthsimple. Open Questrade. Open whatever you use. They show
you a list of tickers and a number that says "return." That is the
extent of what they tell you about your money.

**Here's what they're hiding.**

**1. You don't know what you own.**

If you hold three Canadian-favorite ETFs — XEQT, VFV, ZSP — your
broker shows you three tickers. The truth: those three ETFs combined
put roughly **12–15% of your portfolio in Apple, Microsoft, and
Nvidia.** You "diversified" by holding three funds. You actually
concentrated. Open Unifolio's Insights page → ETF X-Ray. It looks
INSIDE each fund and shows you a True Exposure table with your real
weighting in each underlying company. Your broker does not have this
screen.

**2. You don't know if you're winning.**

That "+11.4% YTD" your broker shows? Not annualized. Not
deposit-adjusted. Not benchmarked against anything. In a year where
the S&P 500 was up 24% and Canadian inflation was 3.8%, +11.4%
sounds great and is actually *losing* to both. Unifolio's
Performance page lets you overlay S&P 500, Nasdaq, TSX, Bitcoin, US
CPI, and Canadian CPI (live from Bank of Canada Valet API) on your
own return curve. The first time most people see this they discover
they're underperforming the index they thought they were beating.

**3. You're leaving free money on the floor every December.**

Canadian tax-loss harvesting math: if you sell a loser in your
non-registered account, that capital loss offsets your capital gains
elsewhere, at the 50% inclusion rate. Say you have $4,000 of
realized gains this year and you're sitting on a $2,500 unrealized
loss in another stock. Sell the loser, wait 31 days, rebuy. You
just saved ~$625 in tax (at a 50% marginal rate × 50% inclusion ×
$2,500). Your broker does not tell you to do this. It does not even
list which positions are eligible. **Unifolio's Loss Harvest Center
is a dedicated page that scans every lot you own, flags every
eligible loss, calculates the tax saving, and exports a year-end
harvest plan.** Then its Tax Optimizer flags any rebuy that would
trigger the 30-day superficial-loss rule and disallow the loss.

That feature alone pays for the entire subscription multiple times
over for anyone with a non-reg account.

**4. Your ACB is wrong.**

If you bought a stock in three lots over two years, your broker's
"average cost" is correct only if nothing weird ever happened. The
moment you transferred shares between accounts, or your broker
processed a DRIP slightly off, or you sold part of a position — your
cost basis displayed at the broker can drift from what the CRA
expects. Unifolio recomputes ACB per ticker per account from the
transaction log every time. When you sell, the gain it shows is the
one the CRA wants on your T1.

**5. CDRs vs underlyings — silent double-counting.**

You hold AAPL.NE (the Cboe Canada CDR of Apple) for the FX hedge.
You also hold AAPL on Nasdaq through IBKR. Your brokers see two
different tickers. Unifolio's stacking engine knows they're the same
underlying company, applies the right CAD/USD FX, and gives you ONE
true Apple exposure number. The Import wizard has a dedicated
Dual-Listing Panel to set this up.

**6. Your real net worth is a mystery.**

This is true with one account. It gets exponentially worse with
multiple — TFSA at Wealthsimple, RRSP at Questrade, FHSA at your
bank, IBKR for the US stuff. No broker shows you the total. Unifolio
stitches them all into one portfolio, with transfer detection so the
same shares don't double-count when they move between accounts, and
gives you per-account performance plus one rolled-up view.

---

### Part 2 — Walk through Unifolio in 90 seconds

Open **unifolio.ca**, click "Continue without logging in." A
realistic fake portfolio loads (no card, no email, no signup).
Click through in this order:

1. **Insights** — see ETF X-Ray. Notice how three "diversified"
   ETFs concentrate into the same top names. Look at the Health
   Score: a single 0–100 grade with 8 expandable factors
   (concentration, sector diversification via Herfindahl index,
   currency exposure, account-type mix, unrealized-gain buffer,
   cash utilization, asset-class mix, 30-day trend). Click any
   factor to see how it's calculated.
2. **Holdings** — flip through the 15 heatmap modes (portfolio
   weight, daily P&L $/%, unrealized $/%, realized contribution,
   total return, volatility, custom risk). Scroll down to the
   23 portfolio breakdown donuts — every angle on your money.
3. **Performance** — overlay the CPI_CA benchmark on the return
   chart. See if the demo portfolio is beating Canadian inflation.
4. **Tax Optimizer** — see ACB tracked per ticker, superficial
   losses flagged.
5. **Loss Harvest Center** *(Pro+ feature; visible in demo)* —
   see the eligible losses ranked, the tax-saving estimate, the
   year-end harvest plan ready to export.

If you've made it this far on the demo and your reaction isn't
"oh fuck this is sick," you don't need this product. Close the
tab. No hard feelings.

If your reaction IS that — upload your real CSV from your broker
(step-by-step guides for Wealthsimple, Questrade, IBKR with the
Flex Query template, TD, RBC, BMO, Scotia, CIBC, NBDB, Schwab,
Chase — with screenshots and exact menu paths) and your actual
portfolio appears.

---

### Part 3 — Why everything else sucks

I've tried them. So have you. None of them do this.

| Tool | Why it fails |
|---|---|
| **Wealthica** | Last meaningful update was years ago. No ETF lookthrough. No active loss harvesting. Tax surface is bare minimum. |
| **Passiv** | Rebalancing tool for Questrade. Different category entirely. Not a portfolio tracker. |
| **Sharesight** | Australian product. Doesn't speak Canadian tax. No T5008. No CDRs. No FHSA. |
| **Snowball Analytics** | Global. Doesn't model Canadian registered accounts or tax rules. |
| **Wealthsimple / Questrade / RBC DI dashboards** | Silos. Each shows the slice you have with them. None shows what's INSIDE your ETFs. None tells you which lot to harvest in December. |
| **Spreadsheets** | We all swore we'd keep it updated. We didn't. |
| **Mint** | Dead. Never did investments properly anyway. |
| **Yahoo / Google Finance** | Watchlists with extra steps. No tax, no ACB, no T5008. |

Unifolio is the only thing that combines **Canadian-native tax
math + ETF X-Ray + multi-broker aggregation + active loss
harvesting + behavioral insights + AI analyst + CDR
reconciliation.** Not one competitor hits even four of those.

---

### Part 4 — The objections

**"I only have one account, this is overkill."**

No. The ETF X-Ray, Health Score, Tax Optimizer, Loss Harvest
Center, real benchmarks, and 23 breakdown donuts all work on a
single account. Multi-account is a bonus, not the value prop.

**"Wealthsimple already shows me my returns."**

It shows you a single number with no benchmark and no
deposit-adjustment. Unifolio shows you the same number plotted
against the S&P, TSX, Bitcoin, AND Canadian CPI. You will
discover within 30 seconds whether you're actually winning.

**"I don't trust giving my data to another app."**

Read-only Plaid Canada connections, or CSV import where you never
hand over credentials at all. Privacy mode one-clicks to hide
every dollar value if you want to use it in public.

**"$96/yr is a lot for a tracker."**

If you have a non-reg account and harvest one $1,000 loss you
otherwise would have missed, that's ~$250 in tax saved at a
typical marginal rate. The Loss Harvest Center alone pays for
multiple years of Pro+ the first December you use it.

**"I'll just use a spreadsheet."**

You won't.

---

### Part 5 — The plans (so you can recommend the right one)

| Plan | Price (CAD) | Accounts | Who it's for |
|---|---|---|---|
| **Free** | $0 | 2 | "I just want to see what this is." Holdings + P&L tracking, watchlist (10 tickers), demo mode. No card. |
| **Pro** | **$8/mo billed annually** ($96/yr, save 20% vs monthly) | 3 | The default. Plaid Canada, IBKR/CSV import, Tax Report + T5008, **Tax Optimizer**, Insights & ETF X-Ray, real-time prices, unlimited watchlist. **7-day free trial, no card until day 8.** |
| **Pro+** | **$22/mo billed annually** ($264/yr, save 12%) | 8 | Tax-aware investors. Everything in Pro + **Loss Harvest Center**, year-end harvest plan export, **Behavioral Insights**, **AI Investment Analyst**, 48+ custom themes. |
| **Pro Max** | **$42/mo billed annually** ($504/yr, save 13%) | Power users | Same feature set as Pro+, higher account ceiling. |
| **Lifetime** | **$806 one-time** | Forever | Break-even at ~24 months vs annual Pro Max. After that, free for life. Comes with **direct access to the founder.** |

**Add-on:** +$3/mo per extra brokerage account beyond the cap on
any paid tier.

---

### Part 6 — The one-line ask

Send this to one friend. They open unifolio.ca. They click
"Continue without logging in." 90 seconds later they either get it
or they don't. If they get it, they save more in tax in December
than they spend on Pro+ for the next two years. If they don't, they
close the tab.

That's the deal.

**unifolio.ca.** Go.
