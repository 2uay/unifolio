import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, ChevronDown, ChevronUp, ArrowRight, TrendingUp, Layers,
  Globe, MapPin, Search, Sparkles, BookOpen, Info,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Content ─────────────────────────────────────────────────────────────
//
// NOT FINANCIAL ADVICE. Pure education on concepts so users can understand
// what Unifolio's metrics mean and how to act on them.

const TABS = [
  { id: 'general', label: 'General', icon: Globe, blurb: 'Universal investing concepts' },
  { id: 'us', label: 'US Investing', icon: TrendingUp, blurb: 'NYSE, NASDAQ, US ETFs, withholding tax' },
  { id: 'canadian', label: 'Canadian Investing', icon: MapPin, blurb: 'TFSA, RRSP, CDRs, Norbert’s Gambit' },
];

const GENERAL = [
  {
    id: 'stocks-101',
    title: 'What is a stock?',
    why: 'The foundation of everything you hold.',
    body: `A stock is a fractional ownership of a company. When you buy 1 share of Apple, you own roughly 1/16,000,000,000th of the business. The price moves based on what investors collectively expect that fractional ownership to be worth — driven by earnings, growth, interest rates, sentiment, and luck.

There are two ways stocks pay you back:
• **Capital appreciation** — you sell for more than you paid.
• **Dividends** — the company sends you a slice of its profit each quarter.

Most retail investors over-focus on price moves and under-focus on dividends, lot tracking, and tax efficiency. Unifolio surfaces all four.`,
    unifolio: 'Holdings shows you each position, its current price, your cost basis (what you paid), and your unrealized P&L. The Lots strip below each row breaks down your purchase history so you can see exactly when you bought.',
    link: '/holdings',
    linkLabel: 'See your holdings',
  },
  {
    id: 'etfs',
    title: 'What is an ETF?',
    why: 'Most retirees end up owning more ETFs than individual stocks — here’s why.',
    body: `An Exchange-Traded Fund (ETF) is a basket of stocks (or bonds, gold, Bitcoin, etc.) that trades on the stock market like a single ticker. When you buy 1 share of VOO, you instantly own a tiny slice of every company in the S&P 500 — about 500 stocks bundled into one trade.

Why ETFs win for most people:
• **Instant diversification** — one purchase = exposure to hundreds of companies.
• **Low fees** — VOO charges 0.03% per year. A typical mutual fund charges 1–2%. Over 30 years that fee gap can eat 30–40% of your returns.
• **Tax efficiency** — ETFs rarely trigger capital-gains distributions like mutual funds do.

The downside: you also own every dud in the index, and ETFs hide concentration. If you own VOO and AAPL directly, you might be 12% Apple without realizing it.`,
    unifolio: 'The Insights page is built specifically for this. Our ETF X-Ray decomposes every ETF you hold into its underlying stocks and shows your true exposure — direct + indirect. If you’re accidentally 15% Apple, you’ll see it in red the moment you load the page.',
    link: '/insights',
    linkLabel: 'Open ETF X-Ray',
  },
  {
    id: 'true-exposure',
    title: 'True Exposure & ETF Lookthrough',
    why: 'The single most underrated concept in personal investing.',
    body: `If you hold VOO (S&P 500 ETF), QQQ (NASDAQ 100), and SCHG (US Large Growth), you might think you’re diversified. You’re not. All three of those ETFs hold Apple, Microsoft, NVIDIA, Amazon, and Google as their top positions. You can easily end up with 25% of your portfolio in just five companies.

This is called **overlap risk**, and it’s how investors get blindsided when one sector crashes. In March 2020, every “diversified” portfolio that was actually 50% tech got hammered.

True Exposure is the calculation of what you really own once you look through every fund. The math:

\`\`\`
True exposure to AAPL = (your direct AAPL position $) + (VOO × 7.2%) + (QQQ × 9.0%) + (SCHG × 11.0%)
\`\`\`

If your portfolio is $100k and you hold $20k VOO + $20k QQQ + $20k SCHG + $5k AAPL, your true Apple exposure is closer to $11k, not $5k.`,
    unifolio: 'Insights shows this calculation for every overlapping stock, ranked by total exposure, with red flags on anything over 8% concentration. This is the single calculation no other Canadian portfolio tracker does.',
    link: '/insights',
    linkLabel: 'Check your true exposure',
  },
  {
    id: 'diversification',
    title: 'Diversification (and what it actually means)',
    why: 'Hint: it’s not "buy 30 stocks".',
    body: `Diversification is owning things that **don’t move together**. 30 tech stocks is not diversified — they all crash on the same Fed announcement. 30 stocks across tech, healthcare, energy, real estate, and bonds is diversified — different things drive each one.

Real diversification has multiple dimensions:
• **Sector** — tech, healthcare, energy, financials, consumer, etc.
• **Geography** — US, Canada, Europe, emerging markets.
• **Asset class** — stocks, bonds, gold, real estate, cash, crypto.
• **Currency** — USD vs CAD vs EUR exposure.
• **Style** — growth vs value, large-cap vs small-cap, dividend vs speculative.

A textbook “well-diversified” portfolio: 60% global stocks (mix of US/Canada/international) + 20% bonds + 10% real estate + 10% cash/gold. Most retail portfolios end up 90% US tech without realizing it.`,
    unifolio: 'Holdings page → Portfolio Breakdown section has 20+ donut charts: sector, country, currency, asset class, account type, institution, region, plus 3 we built specifically for retail: Risk Category (Defensive/Core/Growth/Speculative), Income Bucket (Dividend/Growth/Hybrid), and ETF Look-through.',
    link: '/holdings',
    linkLabel: 'View your breakdowns',
  },
  {
    id: 'cost-basis',
    title: 'Cost Basis, FIFO Lots & Average Price',
    why: 'You can’t calculate gains correctly without understanding this.',
    body: `Every share you buy creates a **lot** — a record of (date, qty, price). When you sell, you’re consuming lots in some order. The default in Canada and the US is FIFO (First In, First Out): your oldest lot is sold first.

Why this matters for taxes:
• If your oldest AAPL lot was bought at $50 and your newest at $200, selling 10 shares produces wildly different gains depending on which lot the broker counts. FIFO sells the $50 lot first — maximum gain, maximum tax.
• Some brokers let you specify the lot (“specific identification”) — useful for tax-loss harvesting.

**Average price** is just \`total cost / total quantity\`. It’s simpler but hides how much each individual lot has gained or lost.`,
    unifolio: 'Holdings shows your weighted average price below each position. Toggle "Show Lots" in the toolbar to see every individual purchase — with transferred-in shares marked as XFR pills so you don’t double-count cost basis.',
    link: '/holdings',
    linkLabel: 'Toggle Show Lots',
  },
  {
    id: 'realized-vs-unrealized',
    title: 'Realized vs Unrealized P&L',
    why: 'Only one of these triggers a tax bill.',
    body: `**Unrealized** = the gain (or loss) on something you still hold. It’s on paper. The market can take it back tomorrow. No tax owed.

**Realized** = the gain when you actually sell. The cash is yours. The tax is owed (in non-registered accounts).

Most investors mentally count unrealized gains as wealth (“I’m up $50k!”) and realized losses as not-real (“I’ll just hold until it recovers”). Both are biases that destroy returns over time.

Useful framing:
• If you wouldn’t buy this stock today at its current price, you’re holding for the wrong reason. Sell.
• If you would buy it today, ignore the unrealized gain — it’s noise.`,
    unifolio: 'Holdings shows both per position. Tax Report rolls realized gains up by year for filing. The Performance page tracks total return (realized + unrealized + dividends) over time so you see the real number, not just the optimistic one.',
    link: '/tax',
    linkLabel: 'See realized gains',
  },
  {
    id: 'dividends',
    title: 'Dividends — income, growth, or both?',
    why: 'Dividend yield + price growth = total return.',
    body: `A dividend is a quarterly cash payment from a profitable company to shareholders. Yield = annual dividend / share price.

Three dividend strategies:
• **Income** — high yields (3–7%) from stable companies (KO, JNJ, BCE, Enbridge). Less price growth, more cash now.
• **Growth** — low or no yields (0–1%) from companies reinvesting profits (NVDA, AMZN, SHOP). More price appreciation, less income.
• **Hybrid** — modest yield + steady growth (MSFT, AAPL, RY, TD).

The famous mistake: chasing the highest yields. A 9% dividend often signals the stock price is collapsing and the dividend is about to be cut. Sustainable yields are usually 2–6%.

Dividends in registered accounts (TFSA, Roth IRA) compound tax-free — a major reason to hold dividend stocks there.`,
    unifolio: 'The Insights page classifies every position as Dividend / Growth / Speculative / Hybrid based on yield + sector, so you can see at a glance whether you’re running a growth portfolio or an income portfolio. Tax Report breaks down dividend income by year, account, and currency.',
    link: '/insights',
    linkLabel: 'See income classification',
  },
  {
    id: 'concentration',
    title: 'Concentration Risk',
    why: 'When one position becomes big enough to ruin your year.',
    body: `If a single stock is more than 8–10% of your portfolio, that one stock’s next earnings call has more impact on your year than the entire market. That’s concentration risk.

Concentration is fine if it’s intentional (you work at NVDA, you have conviction). It’s dangerous when it accumulates by accident:
• You bought AAPL early, it grew, now it’s 30% of your portfolio.
• Your employer matched in company stock, now you’re 40% in one ticker.
• You hold 5 ETFs that all top-weight Microsoft.

The fix is rarely “sell everything” — it’s **trim and rebalance** quarterly. Sell 20% of the over-weight position, buy under-weighted areas with the cash.`,
    unifolio: 'Holdings flags positions over 8% with amber highlights. Insights shows true concentration after ETF look-through (often 2-3x the visible number). Both update live as the market moves.',
    link: '/holdings',
    linkLabel: 'Check concentration',
  },
];

const US_TOPICS = [
  {
    id: 'us-markets',
    title: 'NYSE vs NASDAQ vs OTC',
    why: 'Where your stock trades changes fees, taxes, and trust level.',
    body: `Three main US listing venues:
• **NYSE** (New York Stock Exchange) — traditional, large established companies (JPM, KO, JNJ, BAC).
• **NASDAQ** — tech-heavy, growth (AAPL, MSFT, NVDA, GOOG, META, AMZN).
• **OTC** (Over The Counter / Pink Sheets) — small companies that don’t meet listing requirements. Higher risk, less disclosure. Avoid unless you really know what you’re doing.

For Unifolio purposes the venue mostly doesn’t matter — we treat NYSE and NASDAQ tickers identically. OTC stocks won’t have reliable price feeds and may not appear in our look-through tables.`,
    unifolio: 'Holdings tags each position with its listing exchange. CDRs are flagged separately (see Canadian tab) since they’re Canadian-listed even though the underlying is US.',
    link: '/holdings',
  },
  {
    id: 'us-etfs',
    title: 'The 6 ETFs you’ll see most often',
    why: 'You don’t need 50 ETFs. You need 2-4 good ones.',
    body: `• **VOO / SPY / IVV** — S&P 500. Top 500 US companies by market cap. The "default" US holding.
• **VTI / ITOT** — Total US Market. Like VOO but adds mid- and small-caps (~4,000 stocks).
• **QQQ** — NASDAQ 100. Top 100 non-financial NASDAQ companies. Tech-heavy (~50%).
• **SCHG / VUG** — US Large Growth. Tilts toward fast-growing companies.
• **SCHD / VYM** — US Dividend. Established companies paying steady yields.
• **VEA / IEFA** — Developed International. Europe + Japan + Australia.

Common mistake: holding both VOO and VTI. VTI is 80% VOO — you’re mostly duplicating exposure. Insights catches this.`,
    unifolio: 'When you import ETFs, our X-Ray automatically decomposes them into top-10 holdings + sector breakdown. You’ll see overlap warnings the moment two ETFs share the same top names.',
    link: '/insights',
  },
  {
    id: 'us-withholding',
    title: 'US Dividend Withholding for Non-US Investors',
    why: 'Canadians get hit with 15-30% extra tax on US dividends.',
    body: `When a US-listed stock pays a dividend to a Canadian, the IRS withholds tax before the dividend hits your account.

• **Non-registered or RRSP**: 15% withholding (treaty rate, requires W-8BEN form — your broker handles this).
• **TFSA**: 15% withholding, **and you can’t recover it**. The TFSA isn’t recognized as a retirement account by the IRS treaty.
• **No W-8BEN on file**: 30% withholding. Make sure your broker has it.

This is why Canadians often hold US dividend stocks in their **RRSP** (no withholding under the treaty) and Canadian dividend stocks in their **TFSA** (no withholding period).`,
    unifolio: 'Tax Report tracks dividend income by account type so you can see if your TFSA is leaking 15% to the IRS that wouldn’t leak from an RRSP. The Per-Account Performance section on the Performance page makes this gap visible.',
    link: '/tax',
  },
  {
    id: 'us-hours',
    title: 'US Market Hours (ET)',
    why: 'Pre-market and after-hours quotes can be misleading.',
    body: `• **Regular session**: 9:30 AM – 4:00 PM ET, Mon–Fri.
• **Pre-market**: 4:00 AM – 9:30 AM ET (low volume, wide spreads).
• **After-hours**: 4:00 PM – 8:00 PM ET (low volume, earnings-driven moves).

Trades made in pre/post hours often look great on the news but settle at much different prices when the regular session opens. Most platforms show "last trade" — in low-volume sessions that can be a single retail trade hours ago.`,
    unifolio: 'Live data is sourced from regular-session prices when available. The market-status pulse in the topbar (green = open, red = closed) tells you when prices are actively moving.',
    link: '/',
  },
];

const CANADIAN_TOPICS = [
  {
    id: 'ca-accounts',
    title: 'TFSA, RRSP, RESP, FHSA, RDSP — which is which?',
    why: 'Choosing the wrong account type can cost you years of growth.',
    body: `• **TFSA** (Tax-Free Savings Account) — Money in is post-tax. Growth and withdrawals are 100% tax-free. Best for high-growth holdings and Canadian dividend stocks. **2026 limit**: $7,000/year.
• **RRSP** (Registered Retirement Savings Plan) — Money in is pre-tax (refund). Growth is sheltered. Withdrawals are taxed at retirement income level (presumably lower). Best for US dividend stocks and retirement saving. **2026 limit**: 18% of earned income, up to $32,490.
• **FHSA** (First Home Savings Account) — Combines TFSA tax-free growth + RRSP tax deduction. **For first-time home buyers only**. $8,000/year, $40,000 lifetime.
• **RESP** (Registered Education Savings Plan) — For your kid’s education. Government adds 20% match (CESG) up to $500/year. Withdrawals taxed in the kid’s name (usually 0%).
• **RDSP** (Registered Disability Savings Plan) — For people eligible for the Disability Tax Credit. Government matches up to 300% on contributions.
• **Non-Registered** (Cash / Margin) — No tax shelter. Use for overflow when registered accounts are full.

The general optimization order: max your FHSA (if buying a home) → max your TFSA → max your RRSP → then non-registered.`,
    unifolio: 'Accounts page shows every account by type. The Tax Report separates capital gains by account type so you can see exactly how much tax shelter you’re using.',
    link: '/accounts',
  },
  {
    id: 'cdrs',
    title: 'CDRs (Canadian Depositary Receipts)',
    why: 'Buy US stocks for ~$30 each instead of $300+, in CAD, no FX conversion.',
    body: `A CDR is a Canadian-listed proxy for a US stock issued by **CIBC**. They trade on the **Cboe Canada (NEO)** exchange in **CAD**.

How they work:
• Each CDR represents a fraction of one underlying US share — e.g. AAPL.NE might represent ~1/15th of one Apple share.
• They trade in Canadian dollars — no FX conversion fee when buying or selling.
• Most are **currency-hedged**, meaning you only get exposure to the stock’s price moves, not the USD/CAD rate.
• CIBC charges a small annual fee (~0.6%) embedded in the spread — cheaper than most FX conversion costs for retail.

When CDRs make sense:
• You want to buy expensive US stocks (NVDA, GOOG, MSFT) in small dollar amounts.
• You want to avoid currency conversion fees (most Canadian brokers charge 1.5–2.5%).
• You want CAD-denominated reporting and don’t care about USD upside.

When CDRs are worse:
• You’re holding for a long time — the embedded 0.6% fee compounds.
• You hold them in your **RRSP** — you lose the US-Canada tax treaty benefit on dividends, since CDRs aren’t recognized as US securities by the IRS.
• You want USD price exposure (CDRs strip it out via hedging).

**The trap**: many Canadians own both LLY (US) and LLY-CDR (Canadian) without realizing it’s the same company — leading to accidental concentration in one stock.`,
    unifolio: 'During import we detect when both the US and CDR versions of the same stock appear in your file and let you confirm or remap each transaction. The Insights ETF X-Ray treats them as the same underlying so your true exposure is correct.',
    link: '/insights',
    linkLabel: 'Check CDR exposure',
  },
  {
    id: 'norberts-gambit',
    title: 'Norbert’s Gambit — cheap CAD↔USD conversion',
    why: 'Save 1-2% on every currency conversion. On $50k that’s $500-1000.',
    body: `Most Canadian brokers charge 1.5–2.5% to convert CAD to USD. On a $50,000 transfer that’s $750–$1,250 lost to your broker. Norbert’s Gambit gets you the institutional rate — typically <0.1%.

The mechanics:
1. Buy **DLR.TO** in your CAD account — a Horizons ETF that holds USD cash.
2. Wait 1-2 days for the trade to settle.
3. Call your broker (or click "journal" in some platforms) to convert your DLR.TO shares into the US-listed equivalent **DLR.U.TO**.
4. Sell **DLR.U.TO** in your USD account. The proceeds are USD.

Net result: $50k CAD becomes ~$36.5k USD at the institutional rate, vs ~$36k via your broker’s spread. The savings often pay for years of trading commissions.

**Caveats:**
• Most useful for converting $5k+ at a time.
• Some brokers charge a small "journal" fee (~$10).
• Wealthsimple now does this automatically when you switch currencies — you don’t have to do it manually.`,
    unifolio: 'When you log a CAD↔USD currency conversion, Unifolio tracks it as a separate transaction so it doesn’t inflate your gains. The Performance chart can be displayed in either currency to make the conversion impact visible.',
    link: '/transactions',
  },
  {
    id: 'ca-etfs',
    title: 'The 5 Canadian ETFs you’ll see most often',
    why: 'Most Canadian portfolios are built from these.',
    body: `• **VFV / XUS / ZSP** — S&P 500 in CAD. Same underlying as VOO. Mostly unhedged — you get USD/CAD moves baked in.
• **VEQT / XEQT** — All-equity all-in-one. ~45% US, 25% Canada, 25% International, 5% Emerging. The "set it and forget it" portfolio for new investors.
• **VGRO / XGRO** — 80/20 stocks/bonds version of VEQT/XEQT. For people who want some bond cushion.
• **XIC / VCN / ZCN** — S&P/TSX Composite. The 250 largest Canadian companies. Heavy in financials (banks) and energy.
• **HXS / HXT** — Horizons total-return swap ETFs. Use a derivative structure to defer dividend taxes — useful in non-registered accounts.

Common Canadian portfolio: 40% VFV (US) + 30% XIC (Canada) + 25% XEF (International) + 5% bonds. Or just 100% XEQT and call it a day.`,
    unifolio: 'All Canadian ETFs are mapped to their underlying US/Canadian basket in our ETF X-Ray, so you see your true sector and country exposure regardless of which wrapper you bought.',
    link: '/insights',
  },
  {
    id: 'ca-dividends',
    title: 'Canadian Dividend Tax Credit',
    why: 'Eligible dividends are taxed lower than salary income in Canada.',
    body: `When a Canadian company pays you a dividend, the federal government grants you a **Dividend Tax Credit** (DTC). The mechanism is messy (gross-up + credit) but the result is simple: a Canadian-source dividend is taxed at a much lower effective rate than the same dollar earned as employment income.

For someone in the middle bracket, $100 of Canadian dividends is taxed roughly the same as $50 of salary. That’s why Canadian dividend stocks (RY, TD, BCE, Enbridge) are popular for non-registered accounts.

• **Eligible dividends** — from large Canadian public companies. Best tax treatment.
• **Non-eligible dividends** — from small private CCPCs. Lower credit.
• **Foreign dividends** (US, international) — No DTC. Taxed as regular income.`,
    unifolio: 'Tax Report breaks dividend income out by source so you can see Canadian-eligible vs foreign at a glance — useful for tax planning and for deciding which dividend stocks belong in which account.',
    link: '/tax',
  },
  {
    id: 'ca-account-strategy',
    title: 'Which stock goes in which account?',
    why: 'Optimal placement adds 0.5–1.5% per year over 30 years — huge.',
    body: `The basic rule: hold the highest-tax-leak assets in the most-sheltered accounts.

A reasonable starting framework:
• **TFSA**: Canadian dividend stocks (no withholding, all growth tax-free), high-growth stocks you expect to triple, Canadian-listed CDRs of US growth stocks.
• **RRSP**: US dividend stocks (no withholding under treaty), US-listed ETFs (VOO, VTI), bonds.
• **FHSA**: Whatever you’re saving for the house — typically conservative (HISA ETFs, short-duration bonds).
• **Non-Registered**: Canadian dividend stocks (DTC helps), gold/cash, anything you might need in an emergency.

The **worst** placement: US dividend stocks in a TFSA — you eat 15% withholding tax forever and can’t recover it.`,
    unifolio: 'Accounts page lets you tag each account with its type. Tax Report shows realized gains + dividend income broken out by account, so you can spot mistakes (US dividends in TFSA, etc.) and plan around them.',
    link: '/accounts',
  },
];

// ─── Components ──────────────────────────────────────────────────────────

function TopicCard({ topic, expanded, onToggle }) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden transition-all', expanded ? 'border-primary' : 'border-border')}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{topic.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{topic.why}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border/30 px-5 py-4 space-y-4">
          <div className="prose-tight text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {topic.body.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="mb-3 last:mb-0">{renderInline(paragraph)}</p>
            ))}
          </div>
          {topic.unifolio && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">How Unifolio helps</p>
                  <p className="text-[12px] text-foreground/90 mt-1 leading-relaxed">{topic.unifolio}</p>
                  {topic.link && (
                    <Link to={topic.link} className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-primary hover:underline">
                      {topic.linkLabel || 'Try it'} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline renderer: handles **bold**, `code`, simple bullets via "• "
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-secondary border border-border/30 px-1 py-0.5 text-[11px] font-mono">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

function TopicList({ topics, search }) {
  const [openId, setOpenId] = useState(topics[0]?.id);
  const filtered = useMemo(() => {
    if (!search) return topics;
    const q = search.toLowerCase();
    return topics.filter(t => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q) || t.why.toLowerCase().includes(q));
  }, [topics, search]);
  return (
    <div className="space-y-3">
      {filtered.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-6 text-center">
          <p className="text-xs text-muted-foreground">No topics match "{search}".</p>
        </div>
      )}
      {filtered.map(topic => (
        <TopicCard
          key={topic.id}
          topic={topic}
          expanded={openId === topic.id}
          onToggle={() => setOpenId(prev => prev === topic.id ? null : topic.id)}
        />
      ))}
    </div>
  );
}

export default function Learn() {
  const [tab, setTab] = useState('general');
  const [search, setSearch] = useState('');
  const topics = tab === 'general' ? GENERAL : tab === 'us' ? US_TOPICS : CANADIAN_TOPICS;
  const activeTab = TABS.find(t => t.id === tab);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Learn"
        description="Investing fundamentals — explained without jargon, mapped to where Unifolio surfaces them."
      />

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground">Education, not financial advice</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Nothing on this page is personal investment advice. Examples are for clarity. Tax rules and treaty provisions change — confirm with a registered professional before acting.
          </p>
        </div>
      </div>

      {/* Hero / value proposition */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 relative overflow-hidden">
        <GraduationCap className="h-32 w-32 text-primary/5 absolute right-4 top-4" />
        <div className="relative space-y-3 max-w-2xl">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Why does any of this matter for $20/month?</h2>
          <p className="text-sm text-foreground/85 leading-relaxed">
            The difference between a portfolio that returns 5% per year and one that returns 8% per year compounds to <strong className="text-foreground">~2.4x more money over 30 years</strong>. That gap doesn’t come from picking better stocks — it comes from avoiding fee leaks, tax drag, accidental concentration, and currency conversion costs.
          </p>
          <p className="text-sm text-foreground/85 leading-relaxed">
            Unifolio surfaces every one of those leaks: ETF overlap, sector concentration, dividend withholding by account, FX inefficiency, ACB tracking, lot-level cost basis. Concepts most retail investors don’t even know to look for. <strong className="text-foreground">Start here, learn the vocabulary, then use the app to act on it.</strong>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                active
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border/40 bg-card hover:border-primary/40'
              )}
            >
              <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary/20' : 'bg-secondary')}>
                <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold', active ? 'text-primary' : 'text-foreground')}>{t.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${activeTab.label} topics…`}
          className="pl-9 h-10 text-sm"
        />
      </div>

      {/* Topic list */}
      <TopicList topics={topics} search={search} />

      {/* Bottom CTA */}
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <Layers className="h-8 w-8 text-primary mx-auto" />
        <h3 className="text-base font-bold text-foreground">Ready to apply this to your own portfolio?</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Import your broker statements, then run the ETF X-Ray, check your tax exposure by account, and see whether your "diversified" portfolio is actually diversified.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link to="/import">Import a Statement</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/insights">Open ETF X-Ray</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/holdings">View Holdings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
