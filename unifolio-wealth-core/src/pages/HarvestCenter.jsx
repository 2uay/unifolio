import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors, AlertTriangle, Calendar, Download, Info,
  TrendingDown, CheckCircle2, Clock, Sparkles, ExternalLink,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { buildHarvestPlan, buildHarvestPlanMarkdown } from '@/lib/taxOptimizer';

const PM = '••••••';

const URGENCY_STYLES = {
  planning:  { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   text: 'text-blue-400',   label: 'Planning Window' },
  soon:      { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Window Open' },
  urgent:    { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  text: 'text-amber-400',  label: 'Closing Soon' },
  'last-call': { bg: 'bg-red-500/10',   border: 'border-red-500/30',    text: 'text-red-400',    label: 'Last Call' },
  expired:   { bg: 'bg-secondary',      border: 'border-border',        text: 'text-muted-foreground', label: 'Window Closed' },
};

function UrgencyBanner({ progress }) {
  const style = URGENCY_STYLES[progress.urgencyTier] || URGENCY_STYLES.planning;
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', style.bg, style.border)}>
      <Calendar className={cn('h-4 w-4 mt-0.5 flex-shrink-0', style.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-semibold uppercase tracking-wider', style.text)}>{style.label}</span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className="text-xs text-foreground">
            <span className="font-mono font-bold">{progress.daysUntilSellBy}</span> day{progress.daysUntilSellBy === 1 ? '' : 's'} until {progress.taxYear} sell-by date ({progress.sellByDate})
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Trades placed by {progress.sellByDate} will settle in {progress.taxYear} (T+1 settlement). After that, harvests count toward the {progress.taxYear + 1} tax year.
        </p>
      </div>
    </div>
  );
}

function HeadlineCard({ plan, privacyMode }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="h-4 w-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">Projected Tax Savings</span>
          </div>
          <p className="text-4xl sm:text-5xl font-bold font-mono text-primary">
            {privacyMode ? PM : '+' + formatCurrency(plan.totalProjectedSavings)}
          </p>
          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
            <div>
              <span className="font-mono text-foreground">{privacyMode ? PM : formatCurrency(plan.immediateTaxSavings)}</span> immediate
              {plan.carryforwardValueDiscounted > 0 && (
                <> · <span className="font-mono text-foreground">{privacyMode ? PM : formatCurrency(plan.carryforwardValueDiscounted)}</span> carryforward (present value)</>
              )}
            </div>
            <div>
              {plan.opportunities.length - plan.blockedBySuperficialCount} actionable / {plan.opportunities.length} total
              {plan.blockedBySuperficialCount > 0 && (
                <> · {plan.blockedBySuperficialCount} blocked by superficial-loss rule</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function YtdGainsRow({ plan, privacyMode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">YTD Realized Gains</p>
        <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
          {privacyMode ? PM : formatCurrency(plan.ytdRealizedGains)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Non-registered only</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">YTD Realized Losses</p>
        <p className="text-lg font-bold font-mono text-red-400 mt-1">
          {privacyMode ? PM : formatCurrency(plan.ytdRealizedLosses)}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Harvestable Losses</p>
        <p className="text-lg font-bold font-mono text-amber-400 mt-1">
          {privacyMode ? PM : formatCurrency(plan.totalHarvestableLoss)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Currently unrealized</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net If Harvested</p>
        <p className={cn('text-lg font-bold font-mono mt-1', plan.ytdNetRealized + plan.totalHarvestableLoss * -1 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {privacyMode ? PM : formatCurrency(plan.ytdNetRealized - plan.totalHarvestableLoss)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">YTD gains minus harvest</p>
      </div>
    </div>
  );
}

function SafetyDot({ rating }) {
  const cls = rating === 'safe' ? 'bg-emerald-400' : rating === 'caution' ? 'bg-amber-400' : 'bg-red-400';
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1.5', cls)} />;
}

function OpportunityCard({ opp, privacyMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-all',
      opp.wouldTriggerSuperficial ? 'border-red-500/30' : 'border-border',
      open && 'ring-1 ring-primary/30',
    )}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-secondary/20 transition-colors"
      >
        <TrendingDown className={cn('h-4 w-4 mt-0.5 flex-shrink-0', opp.wouldTriggerSuperficial ? 'text-red-400' : 'text-amber-400')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-semibold text-sm text-foreground">{opp.ticker}</span>
            {opp.wouldTriggerSuperficial ? (
              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Superficial Loss — Blocked
              </span>
            ) : opp.severity === 'high' ? (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">High Impact</span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">{opp.fromAccount}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{opp.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {opp.wouldTriggerSuperficial ? 'Blocked' : 'Tax Savings'}
          </p>
          <p className={cn('text-sm font-mono font-bold', opp.wouldTriggerSuperficial ? 'text-muted-foreground line-through' : 'text-emerald-400')}>
            {privacyMode ? PM : '+' + formatCurrency(opp.projectedTaxSavings || opp.grossTaxSavings)}
          </p>
          <p className="text-[10px] text-muted-foreground">Loss: {privacyMode ? PM : formatCurrency(opp.grossLoss)}</p>
        </div>
      </button>
      {open && (
        <div className="border-t border-border/30 px-4 py-3.5 space-y-3 bg-secondary/10">
          {opp.wouldTriggerSuperficial ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5">
              <p className="text-xs font-medium text-red-400">Superficial-loss rule triggered</p>
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                You bought <span className="font-mono">{opp.ticker}</span> on {opp.lastBuyDate} in {opp.lastBuyAccount}.
                Selling now would deny the loss — the CRA adds the disallowed loss to the ACB of the remaining shares instead.
              </p>
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                <strong>Workaround:</strong> wait until {opp.lastBuyDate ? new Date(new Date(opp.lastBuyDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '30+ days after the recent buy'} before selling.
                Or sell ALL shares in EVERY account and stay out for 30 days.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loss</p>
                  <p className="text-sm font-mono font-semibold text-red-400">{privacyMode ? PM : '-' + formatCurrency(opp.grossLoss)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Offsets YTD Gains</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{privacyMode ? PM : formatCurrency(opp.offsetUsed)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Carryforward</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{privacyMode ? PM : formatCurrency(opp.carryforwardAmount || 0)}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Replacement Candidates</p>
                {opp.replacements.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    No ETF replacement found for this security. After selling, wait 30 days before rebuying, or buy a different security in the same asset class.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {opp.replacements.map(r => (
                      <div key={r.ticker} className={cn(
                        'flex items-start gap-2 rounded-lg border px-3 py-2',
                        r.safetyRating === 'safe' ? 'border-emerald-500/30 bg-emerald-500/5' :
                          r.safetyRating === 'caution' ? 'border-amber-500/30 bg-amber-500/5' :
                            'border-red-500/30 bg-red-500/5',
                      )}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <SafetyDot rating={r.safetyRating} />
                            <span className="font-mono font-semibold text-xs text-foreground">{r.ticker}</span>
                            <span className="text-[11px] text-muted-foreground">{r.name}</span>
                            {r.overlapPct != null && (
                              <span className="text-[10px] font-mono text-muted-foreground">{Math.round(r.overlapPct * 100)}% overlap</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{r.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {opp.daysHeld != null && (
                <p className="text-[10px] text-muted-foreground">Held for {opp.daysHeld} days · Market value {privacyMode ? PM : formatCurrency(opp.marketValue)}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function downloadHarvestPlan(plan, profile, fullName) {
  const md = buildHarvestPlanMarkdown(plan, { fullName, province: profile.province });
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unifolio-harvest-plan-${plan.taxYear}-${plan.asOfDate}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadOptProfile(userId) {
  if (!userId) return {};
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('marginal_tax_rate, province')
      .eq('user_id', userId)
      .single();
    return data || {};
  } catch {
    return {};
  }
}

export default function HarvestCenter() {
  const { privacyMode } = usePrivacy();
  const { user, fullName } = useAuth();
  const { accounts, transactions, holdings, realizedPositions, isEmptyPortfolio } = usePortfolioData();
  const [profile, setProfile] = useState({});

  useEffect(() => {
    let cancelled = false;
    loadOptProfile(user?.id).then(p => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const plan = useMemo(
    () => buildHarvestPlan({ holdings, accounts, transactions, realizedPositions, profile }),
    [holdings, accounts, transactions, realizedPositions, profile],
  );

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Loss Harvest Center"
          description="Year-end tax-loss harvesting plan with superficial-loss detection and safe replacement suggestions."
        />
        <EmptyPortfolioState />
      </div>
    );
  }

  const hasOpportunities = plan.opportunities.length > 0;
  const hasMarginalSet = typeof (/** @type {{ marginal_tax_rate?: number }} */ (profile).marginal_tax_rate) === 'number';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loss Harvest Center"
        description="Year-end tax-loss harvesting plan. Detects superficial-loss conflicts across every account and suggests safe replacements using ETF underlying-overlap data."
      />

      <UrgencyBanner progress={plan} />

      {!hasMarginalSet && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Info className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-400">Set your marginal tax rate for accurate savings estimates.</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Using a 30% default. Set your actual bracket in Profile under Tax Settings.
            </p>
          </div>
          <Link to="/profile">
            <Button variant="outline" size="sm" className="h-7 text-[11px]">Set Rate</Button>
          </Link>
        </div>
      )}

      <HeadlineCard plan={plan} privacyMode={privacyMode} />

      <YtdGainsRow plan={plan} privacyMode={privacyMode} />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => downloadHarvestPlan(plan, profile, fullName)}
          disabled={!hasOpportunities}
          className="h-8 text-xs gap-1.5"
        >
          <Download className="h-3.5 w-3.5" /> Download Harvest Plan ({plan.taxYear}.md)
        </Button>
        <Link to="/optimize">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Tax Optimizer
          </Button>
        </Link>
        <Link to="/tax">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground">
            Tax Report <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Opportunities */}
      <section>
        <div className="flex items-center gap-2.5 mb-3">
          <Scissors className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Harvest Opportunities</h2>
          <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {plan.opportunities.length}
          </span>
        </div>
        {!hasOpportunities ? (
          <div className="rounded-xl border border-border/40 bg-card/50 px-4 py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500/60 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No harvestable losses in your taxable accounts.</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">We only surface positions in non-registered accounts — losses in TFSA/RRSP/FHSA are not tax-deductible.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plan.opportunities.map(opp => (
              <OpportunityCard key={opp.id} opp={opp} privacyMode={privacyMode} />
            ))}
          </div>
        )}
      </section>

      {/* Footer disclosure */}
      <div className="space-y-2">
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3 flex items-start gap-2.5">
          <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Carryforward value is shown at <span className="text-foreground">60% of nominal</span> to reflect that future use depends on having future capital gains. Adjust your own expectation accordingly.
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground/80">The superficial-loss rule also applies to your spouse's accounts.</strong> Unifolio cannot see those — verify with your spouse before placing trades. For informational purposes only; not tax advice.
          </p>
        </div>
      </div>
    </div>
  );
}
