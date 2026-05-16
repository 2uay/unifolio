import React, { useEffect, useMemo, useState } from 'react';
import {
  Brain, Activity, Repeat, AlertTriangle, Layers, Moon, Clock,
  TrendingUp, TrendingDown, Info, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { buildBehavioralProfile } from '@/lib/behavioralEngine';
import { loadHistoricalPricesForTransactions } from '@/lib/historicalPriceCache';

const PM = '••••••';

function ArchetypeBanner({ archetype, score }) {
  const gradeColor =
    score.grade === 'A' ? 'from-emerald-500/20 via-background to-background border-emerald-500/30' :
    score.grade === 'B' ? 'from-primary/15 via-background to-background border-primary/30' :
    score.grade === 'C' ? 'from-amber-500/15 via-background to-background border-amber-500/30' :
                          'from-red-500/15 via-background to-background border-red-500/30';
  const scoreColor =
    score.grade === 'A' ? 'text-emerald-400' :
    score.grade === 'B' ? 'text-primary' :
    score.grade === 'C' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br p-6 sm:p-7', gradeColor)}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">Your Trading Archetype</span>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">{archetype.label}</p>
          {archetype.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {archetype.tags.map(tag => (
                <span key={tag} className="rounded-full bg-secondary border border-border px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-xl">{score.summary}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Discipline Score</p>
          <p className={cn('text-5xl sm:text-6xl font-bold font-mono leading-none mt-1', scoreColor)}>{score.score}</p>
          <p className={cn('text-sm font-mono font-bold mt-1', scoreColor)}>Grade {score.grade}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function FactorRow({ factor }) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg border px-3 py-2.5',
      factor.good ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5',
    )}>
      <div className={cn(
        'h-4 w-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center',
        factor.good ? 'bg-emerald-500/20' : 'bg-amber-500/20',
      )}>
        {factor.good
          ? <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
          : <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-foreground">{factor.label}</span>
          <span className={cn(
            'text-[10px] font-mono',
            factor.good ? 'text-emerald-400' : 'text-amber-400',
          )}>
            {factor.penalty === 0 ? '—' : (factor.penalty > 0 ? `-${factor.penalty}` : `+${Math.abs(factor.penalty)}`)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{factor.note}</p>
      </div>
    </div>
  );
}

function PatternCard({ icon: Icon, title, severity, children }) {
  const severityClass =
    severity === 'high' ? 'border-red-500/30 bg-red-500/5' :
    severity === 'medium' ? 'border-amber-500/30 bg-amber-500/5' :
    severity === 'good' ? 'border-emerald-500/30 bg-emerald-500/5' :
                          'border-border bg-card';
  return (
    <div className={cn('rounded-xl border p-4', severityClass)}>
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="text-xs text-foreground/85 leading-relaxed">{children}</div>
    </div>
  );
}

function RevengePatternCard({ events, privacyMode }) {
  if (!events || events.length === 0) {
    return (
      <PatternCard icon={Repeat} title="Revenge Trading" severity="good">
        <p>No rebuy-after-loss events detected. You're not buying back into positions you just sold for a loss.</p>
      </PatternCard>
    );
  }
  return (
    <PatternCard icon={Repeat} title="Revenge Trading" severity={events.length >= 3 ? 'high' : 'medium'}>
      <p className="mb-3">
        <span className="font-mono text-foreground">{events.length}</span> rebuy event{events.length === 1 ? '' : 's'} where you bought back a position within 14 days of selling it at a loss.
      </p>
      <ul className="space-y-1.5">
        {events.slice(0, 5).map((e, i) => (
          <li key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{e.ticker}</span>
            <span>·</span>
            <span>sold {e.sellDate} at loss of {privacyMode ? PM : formatCurrency(Math.abs(e.realizedLoss))}</span>
            <span>·</span>
            <span className="text-amber-400">rebought {e.buyDate} ({e.daysBetween}d later)</span>
            <span>·</span>
            <span>{privacyMode ? PM : formatCurrency(e.amountInvested)} invested</span>
          </li>
        ))}
        {events.length > 5 && (
          <li className="text-[11px] text-muted-foreground/70">+ {events.length - 5} more</li>
        )}
      </ul>
    </PatternCard>
  );
}

function HoldingPeriodCard({ data }) {
  if (!data || (!data.long && !data.short)) {
    return (
      <PatternCard icon={Clock} title="Holding Period Performance" severity="info">
        <p className="text-muted-foreground italic">Need a few realized positions to detect a holding-period pattern.</p>
      </PatternCard>
    );
  }
  const diff = (data.long?.weightedAvgReturnPct ?? 0) - (data.short?.weightedAvgReturnPct ?? 0);
  const isGood = diff > 5;
  const isBad = diff < -5;
  const severity = isGood ? 'good' : isBad ? 'medium' : 'info';

  return (
    <PatternCard icon={Clock} title="Holding Period Performance" severity={severity}>
      <p className="mb-3">
        {isGood && <>Your patient holds are paying off — long holds beat short flips by <span className="text-emerald-400 font-mono">{diff.toFixed(1)} pts</span> on weighted average return.</>}
        {isBad && <>Your quick flips are outperforming your long holds by <span className="text-amber-400 font-mono">{Math.abs(diff).toFixed(1)} pts</span> — worth examining which long positions are dragging.</>}
        {!isGood && !isBad && <>Long and short holds are performing similarly — no strong patience signal in either direction.</>}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Held &gt;{data.threshold} days</p>
          {data.long ? (
            <>
              <p className="text-base font-mono font-bold text-foreground">
                {data.long.weightedAvgReturnPct >= 0 ? '+' : ''}{data.long.weightedAvgReturnPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">{data.long.count} positions · {data.long.winRatePct.toFixed(0)}% win rate</p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">No data</p>
          )}
        </div>
        <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Held ≤{data.threshold} days</p>
          {data.short ? (
            <>
              <p className="text-base font-mono font-bold text-foreground">
                {data.short.weightedAvgReturnPct >= 0 ? '+' : ''}{data.short.weightedAvgReturnPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">{data.short.count} positions · {data.short.winRatePct.toFixed(0)}% win rate</p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">No data</p>
          )}
        </div>
      </div>
    </PatternCard>
  );
}

function ConcentrationCard({ items, privacyMode }) {
  if (!items || items.length === 0) {
    return (
      <PatternCard icon={Layers} title="Concentration Addiction" severity="good">
        <p>You don't have oversized positions you keep adding to. No single ticker dominates your portfolio AND has been bought repeatedly.</p>
      </PatternCard>
    );
  }
  return (
    <PatternCard icon={Layers} title="Concentration Addiction" severity={items[0]?.severity || 'medium'}>
      <p className="mb-3">
        You've added to {items.length} oversized position{items.length === 1 ? '' : 's'} repeatedly. Each one is &gt;15% of your current portfolio.
      </p>
      <ul className="space-y-1.5">
        {items.map(it => (
          <li key={it.ticker} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-sm text-foreground">{it.ticker}</span>
              <span className={cn(
                'text-[10px] uppercase tracking-wider font-semibold',
                it.severity === 'high' ? 'text-red-400' : 'text-amber-400',
              )}>
                {it.currentWeightPct.toFixed(0)}% of portfolio
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">{it.totalBuys} buys · {privacyMode ? PM : formatCurrency(it.totalInvested)} invested</p>
            </div>
          </li>
        ))}
      </ul>
    </PatternCard>
  );
}

function EmotionalVolatilityCard({ data }) {
  if (!data) {
    return null;
  }
  if (!data.available) {
    return (
      <PatternCard icon={Activity} title="Emotional Volatility" severity="info">
        <p className="text-muted-foreground italic">
          {data.reason === 'need-30-days' && 'Need at least 30 days of portfolio history to detect day-by-day patterns.'}
          {data.reason === 'flat-snapshots' && 'No daily returns detected in your portfolio history.'}
          {data.reason === 'no-variance' && 'Your portfolio hasn\'t had a volatile day (±2%) yet — nothing to compare against.'}
        </p>
      </PatternCard>
    );
  }
  const mult = data.multiplier;
  const severity = mult >= 2.5 ? 'high' : mult >= 1.8 ? 'medium' : mult <= 1 ? 'good' : 'info';
  return (
    <PatternCard icon={Activity} title="Emotional Volatility" severity={severity}>
      <p className="mb-2">
        On volatile days (portfolio ±2%) you trade{' '}
        <span className={cn('font-mono', mult >= 1.8 ? 'text-amber-400' : 'text-emerald-400')}>
          {mult ? mult.toFixed(2) + '×' : '—'}
        </span>{' '}
        as often as on calm days.
      </p>
      <p className="text-[11px] text-muted-foreground">
        {data.tradesOnVolatileDays} trades across {data.volatileDayCount} volatile days vs. {data.tradesOnCalmDays} trades across {data.calmDayCount} calm days. A ratio &gt;1 means you're a reactive trader; ≈1 means you trade on schedule regardless of the market.
      </p>
    </PatternCard>
  );
}

function LateNightCard({ data }) {
  if (!data) return null;
  if (!data.available) {
    return (
      <PatternCard icon={Moon} title="Late-Night Trading" severity="info">
        <p className="text-muted-foreground italic">
          Your import source doesn't include trade timestamps — only dates. We can detect late-night patterns once you connect a source that does (Plaid, IBKR with Flex Query time fields, or manual entries with times).
        </p>
      </PatternCard>
    );
  }
  const severity = data.lateTradePct >= 30 ? 'high' : data.lateTradePct >= 15 ? 'medium' : 'info';
  return (
    <PatternCard icon={Moon} title="Late-Night Trading" severity={severity}>
      <p className="mb-2">
        <span className="font-mono text-foreground">{data.lateTradePct.toFixed(0)}%</span> of your timestamped trades happened between 11 PM and 4 AM ({data.lateTradeCount} of {data.timestampedTradeCount}).
      </p>
      {data.lateTradesWithRealizedOutcome > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Net realized P&L on the late trades we can match to outcomes: <span className={cn('font-mono', data.lateNetRealizedGl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{data.lateNetRealizedGl >= 0 ? '+' : ''}{formatCurrency(data.lateNetRealizedGl)}</span> across {data.lateTradesWithRealizedOutcome} positions.
        </p>
      )}
    </PatternCard>
  );
}

function PriceCacheLoadingNote({ priceLoadState }) {
  if (priceLoadState === 'loading') {
    return <p className="text-muted-foreground italic">Loading historical price bars…</p>;
  }
  if (priceLoadState === 'error') {
    return <p className="text-muted-foreground italic">Couldn't load historical prices from Yahoo. Detector will run on your next visit.</p>;
  }
  return <p className="text-muted-foreground italic">Not enough analyzable trades yet (need ≥5 buys/sells with available price history).</p>;
}

function ChasePatternCard({ data, priceLoadState }) {
  if (!data || !data.available) {
    return (
      <PatternCard icon={TrendingUp} title="Chase Pattern" severity="info">
        <PriceCacheLoadingNote priceLoadState={priceLoadState} />
      </PatternCard>
    );
  }
  if (data.sampleSize < 5) {
    return (
      <PatternCard icon={TrendingUp} title="Chase Pattern" severity="info">
        <p className="text-muted-foreground italic">
          Analyzed {data.sampleSize} buy{data.sampleSize === 1 ? '' : 's'} — need at least 5 with available price history to call it a pattern.
        </p>
      </PatternCard>
    );
  }
  const ratePct = (data.chaseRate * 100).toFixed(0);
  const severity = data.chaseRate >= 0.50 ? 'high' : data.chaseRate >= 0.30 ? 'medium' : 'info';
  return (
    <PatternCard icon={TrendingUp} title="Chase Pattern" severity={severity}>
      <p className="mb-2">
        <span className="font-mono text-foreground">{ratePct}%</span> of your last {data.sampleSize} buys came after the security had already run up ≥5% in the prior 5 trading days ({data.chaseCount} of {data.sampleSize}).
      </p>
      {data.examples.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground mb-1.5">Hottest entries (largest 5-day run-up before your buy):</p>
          <ul className="space-y-1 text-[11px]">
            {data.examples.map((ex, i) => (
              <li key={`${ex.ticker}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-secondary/30 px-2 py-1">
                <span className="font-mono">{ex.ticker}</span>
                <span className="text-muted-foreground">{ex.date}</span>
                <span className="font-mono text-amber-400">+{(ex.runUpPct * 100).toFixed(1)}% prior 5d</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PatternCard>
  );
}

function CapitulationCard({ data, priceLoadState }) {
  if (!data || !data.available) {
    return (
      <PatternCard icon={TrendingDown} title="Capitulation Pattern" severity="info">
        <PriceCacheLoadingNote priceLoadState={priceLoadState} />
      </PatternCard>
    );
  }
  if (data.sampleSize < 4) {
    return (
      <PatternCard icon={TrendingDown} title="Capitulation Pattern" severity="info">
        <p className="text-muted-foreground italic">
          Analyzed {data.sampleSize} sell{data.sampleSize === 1 ? '' : 's'} — need at least 4 with available price history to call it a pattern.
        </p>
      </PatternCard>
    );
  }
  const ratePct = (data.capitulationRate * 100).toFixed(0);
  const severity = data.capitulationRate >= 0.40 ? 'high' : data.capitulationRate >= 0.25 ? 'medium' : 'info';
  return (
    <PatternCard icon={TrendingDown} title="Capitulation Pattern" severity={severity}>
      <p className="mb-2">
        <span className="font-mono text-foreground">{ratePct}%</span> of your last {data.sampleSize} sells came after a ≥8% drop in the prior 7 trading days ({data.capitulationCount} of {data.sampleSize}). Selling into weakness locks in losses that often recover.
      </p>
      {data.examples.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground mb-1.5">Sharpest drops before your sell:</p>
          <ul className="space-y-1 text-[11px]">
            {data.examples.map((ex, i) => (
              <li key={`${ex.ticker}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-secondary/30 px-2 py-1">
                <span className="font-mono">{ex.ticker}</span>
                <span className="text-muted-foreground">{ex.date}</span>
                <span className="font-mono text-red-400">{(ex.drawdownPct * 100).toFixed(1)}% prior 7d</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </PatternCard>
  );
}

function PostTradeTimingCard({ data, priceLoadState }) {
  if (!data || !data.available) {
    return (
      <PatternCard icon={Activity} title="30-Day Post-Trade Timing" severity="info">
        <PriceCacheLoadingNote priceLoadState={priceLoadState} />
      </PatternCard>
    );
  }
  if (data.sampleSize < 5) {
    return (
      <PatternCard icon={Activity} title="30-Day Post-Trade Timing" severity="info">
        <p className="text-muted-foreground italic">
          Need at least 5 analyzable trades with 30 days of follow-through data.
        </p>
      </PatternCard>
    );
  }
  const compositePct = data.compositeTimingPct;
  const severity = compositePct < -0.05 ? 'high' : compositePct < -0.02 ? 'medium' : 'info';
  const verdict =
    compositePct === null ? 'Inconclusive.'
    : compositePct >= 0.02 ? 'Your timing is adding value: on average your buys appreciate and your sells avoid further gains.'
    : compositePct >= -0.02 ? 'Your timing is roughly neutral over 30-day windows — typical for self-directed traders.'
    : 'Your timing is working against you: buys tend to decline and sells tend to be followed by further gains.';
  return (
    <PatternCard icon={Activity} title="30-Day Post-Trade Timing" severity={severity}>
      <p className="mb-2">{verdict}</p>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {data.avgBuyMovePct !== null && (
          <div className="rounded-md bg-secondary/30 px-2 py-1.5">
            <p className="text-muted-foreground">Avg 30d after buy</p>
            <p className={cn('font-mono font-semibold', data.avgBuyMovePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {data.avgBuyMovePct >= 0 ? '+' : ''}{(data.avgBuyMovePct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{data.buyAnalyzed} buys</p>
          </div>
        )}
        {data.avgSellMovePct !== null && (
          <div className="rounded-md bg-secondary/30 px-2 py-1.5">
            <p className="text-muted-foreground">Avg 30d after sell</p>
            <p className={cn('font-mono font-semibold', data.avgSellMovePct <= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {data.avgSellMovePct >= 0 ? '+' : ''}{(data.avgSellMovePct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{data.sellAnalyzed} sells (positive = "missed gain")</p>
          </div>
        )}
      </div>
    </PatternCard>
  );
}

export default function BehavioralInsights() {
  const { privacyMode } = usePrivacy();
  const { transactions, realizedPositions, holdings, portfolioSnapshots, isEmptyPortfolio } = usePortfolioData();

  // Historical price bars for the v2 detectors (chase, capitulation,
  // post-trade timing). We fire-and-forget on mount and re-render once
  // they're ready; the v1 detectors don't depend on prices so the page
  // is fully usable before the fetch completes.
  const [priceCache, setPriceCache] = useState(null);
  const [priceLoadState, setPriceLoadState] = useState('idle');
  useEffect(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return;
    let cancelled = false;
    setPriceLoadState('loading');
    loadHistoricalPricesForTransactions(transactions)
      .then(cache => { if (!cancelled) { setPriceCache(cache); setPriceLoadState('loaded'); } })
      .catch(() => { if (!cancelled) setPriceLoadState('error'); });
    return () => { cancelled = true; };
  }, [transactions]);

  const profile = useMemo(
    () => buildBehavioralProfile({ transactions, realizedPositions, holdings, portfolioSnapshots, priceCache }),
    [transactions, realizedPositions, holdings, portfolioSnapshots, priceCache],
  );

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Behavioral Insights"
          description="The patterns hidden in your own trading history."
        />
        <EmptyPortfolioState />
      </div>
    );
  }

  const tradesCount = profile.summary.totalTrades;
  if (tradesCount < 5) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Behavioral Insights"
          description="The patterns hidden in your own trading history."
        />
        <div className="rounded-xl border border-border/40 bg-card/50 px-6 py-12 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground">Need at least 5 trades to detect patterns.</p>
          <p className="text-xs text-muted-foreground mt-1">You have {tradesCount} so far. Import your transaction history to unlock this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Behavioral Insights"
        description="The patterns hidden in your own trading history. Pure observation — never prescriptive."
      />

      <ArchetypeBanner archetype={profile.archetype} score={profile.score} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Trades" value={profile.summary.totalTrades} icon={Activity} color="text-foreground" />
        <StatCard
          label="Win Rate"
          value={profile.summary.winRatePct != null ? `${profile.summary.winRatePct.toFixed(0)}%` : '—'}
          sub={`${profile.summary.realizedPositionCount} closed`}
          icon={TrendingUp}
          color={profile.summary.winRatePct >= 50 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <StatCard
          label="Avg Hold"
          value={profile.summary.avgHoldDays != null ? `${profile.summary.avgHoldDays.toFixed(0)}d` : '—'}
          sub="days per realized position"
          icon={Clock}
          color="text-foreground"
        />
        <StatCard
          label="Patterns Flagged"
          value={profile.score.factors.filter(f => !f.good).length}
          sub={`${profile.score.factors.filter(f => f.good).length} good · ${profile.score.factors.filter(f => !f.good).length} watch`}
          icon={AlertTriangle}
          color={profile.score.factors.filter(f => !f.good).length === 0 ? 'text-emerald-400' : 'text-amber-400'}
        />
      </div>

      {/* Score factor breakdown */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Discipline Factors
        </h2>
        <div className="space-y-1.5">
          {profile.score.factors.map(f => <FactorRow key={f.id} factor={f} />)}
        </div>
      </section>

      {/* Per-pattern deep cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2.5">
          <Brain className="h-4 w-4 text-primary" />
          Patterns Detected
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <RevengePatternCard events={profile.patterns.revengeTrades} privacyMode={privacyMode} />
          <HoldingPeriodCard data={profile.patterns.holdingPeriod} />
          <ConcentrationCard items={profile.patterns.concentration} privacyMode={privacyMode} />
          <EmotionalVolatilityCard data={profile.patterns.emotionalVolatility} />
          <LateNightCard data={profile.patterns.lateNight} />
          <ChasePatternCard data={profile.patterns.chase} priceLoadState={priceLoadState} />
          <CapitulationCard data={profile.patterns.capitulation} priceLoadState={priceLoadState} />
          <PostTradeTimingCard data={profile.patterns.postTrade} priceLoadState={priceLoadState} />
        </div>
      </section>

      {/* Footer */}
      <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3 flex items-start gap-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Patterns are based on your imported transaction history. Past patterns don't predict future trades — they're a mirror, not advice. This page is for observation and self-awareness; consult a financial planner before changing strategy based on any of it.
        </p>
      </div>
    </div>
  );
}
