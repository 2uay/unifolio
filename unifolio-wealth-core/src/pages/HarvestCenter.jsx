import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors, AlertTriangle, Calendar, Download, Info,
  TrendingDown, CheckCircle2, Clock, Sparkles, ExternalLink,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import PlainEnglish from '@/components/shared/PlainEnglish';
import PageBenefitsDialog from '@/components/shared/PageBenefitsDialog';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { buildHarvestPlan, buildHarvestPlanMarkdown } from '@/lib/taxOptimizer';
import { useQuery } from '@tanstack/react-query';
import { getHouseholdRecentTransactions, getCurrentHousehold } from '@/lib/householdClient';

const PM = '••••••';

const HARVEST_CENTER_BENEFITS = {
  title: 'Loss Harvest Center — what it does for you',
  benefits: [
    'Real cash on your tax return — selling a losing stock turns a paper loss into a deduction that cancels out gains you owe tax on.',
    'Replacement tickers per position, so you can stay invested in the same theme without triggering the superficial-loss rule.',
    'Cross-spouse superficial-loss detection (when your spouse is linked) — if they bought the same stock recently, we mark it as Blocked so you don\'t accidentally waste the deduction.',
    'A countdown to the year-end sell-by date so you know how many days you have left to act.',
  ],
  howToUse: [
    'Check the urgency banner at the top — that\'s your deadline.',
    'Review each opportunity card. Green is safe to harvest, amber needs caution, "Blocked by Spouse Buy" needs to be skipped.',
    'Execute the sell at your broker before the sell-by date.',
    'If you still want exposure, buy the suggested replacement ticker (or wait 30 days and rebuy the original).',
    'Click "Download Harvest Plan" for a markdown summary you can paste into your records or your accountant\'s email.',
  ],
  whatItsFor: 'Turning unrealized losses into a tax deduction this year, with guardrails so the CRA doesn\'t reject the deduction or quietly add it to your ACB.',
  whoItsFor: 'Anyone with non-registered (taxable) accounts holding positions at a loss, especially in November–December when the tax year is closing. If everything you hold is in a TFSA or RRSP, you can skip — losses in registered accounts don\'t produce a deduction.',
};

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
        <PlainEnglish>
          Sell after this date and the loss goes on next year&rsquo;s taxes instead of this year&rsquo;s — which usually means waiting 12 months to get the cash back.
        </PlainEnglish>
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
          <PlainEnglish>
            Cash you keep on your tax bill if you actually execute every harvest below. &ldquo;Immediate&rdquo; cancels gains you already owe tax on this year; &ldquo;carryforward&rdquo; banks the rest against gains in any future year.
          </PlainEnglish>
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
        <PlainEnglish>The profit you&rsquo;ve already locked in this year. This is what you owe tax on.</PlainEnglish>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">YTD Realized Losses</p>
        <p className="text-lg font-bold font-mono text-red-400 mt-1">
          {privacyMode ? PM : formatCurrency(plan.ytdRealizedLosses)}
        </p>
        <PlainEnglish>Losses you&rsquo;ve already taken this year. They already cancel out some of the gains above.</PlainEnglish>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Harvestable Losses</p>
        <p className="text-lg font-bold font-mono text-amber-400 mt-1">
          {privacyMode ? PM : formatCurrency(plan.totalHarvestableLoss)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Currently unrealized</p>
        <PlainEnglish>What you could lock in by selling losers you still own. Each dollar here is a dollar of taxable gain you can cancel.</PlainEnglish>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net If Harvested</p>
        <p className={cn('text-lg font-bold font-mono mt-1', plan.ytdNetRealized + plan.totalHarvestableLoss * -1 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {privacyMode ? PM : formatCurrency(plan.ytdNetRealized - plan.totalHarvestableLoss)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">YTD gains minus harvest</p>
        <PlainEnglish>What you&rsquo;d actually be taxed on if you harvested everything below. Closer to zero (or negative) = lower tax bill.</PlainEnglish>
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
                <AlertTriangle className="h-2.5 w-2.5" />
                {opp.blockedBySpouse ? 'Blocked by Spouse Buy' : 'Superficial Loss — Blocked'}
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
              <p className="text-xs font-medium text-red-400">
                {opp.blockedBySpouse ? 'Spousal superficial-loss rule triggered' : 'Superficial-loss rule triggered'}
              </p>
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                {opp.blockedBySpouse ? (
                  <>
                    Your spouse bought <span className="font-mono">{opp.ticker}</span> on {opp.lastBuyDate}.
                    CRA treats spouses as "affiliated persons" under ITA section 251.1 — selling your shares at a loss now would deny the loss.
                  </>
                ) : (
                  <>
                    You bought <span className="font-mono">{opp.ticker}</span> on {opp.lastBuyDate} in {opp.lastBuyAccount}.
                    Selling now would deny the loss — the CRA adds the disallowed loss to the ACB of the remaining shares instead.
                  </>
                )}
              </p>
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                <strong>Workaround:</strong> wait until {opp.lastBuyDate ? new Date(new Date(opp.lastBuyDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '30+ days after the recent buy'} before selling.
                {opp.blockedBySpouse
                  ? ' Or coordinate so neither spouse holds the security for 30 days.'
                  : ' Or sell ALL shares in EVERY account and stay out for 30 days.'}
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

  // Cross-spouse superficial-loss detection: when the user has linked their
  // spouse via /profile, pull the spouse's recent (≤35 day) transactions
  // via the SECURITY DEFINER RPC and pass them into the harvest engine.
  // Returns rows for BOTH spouses; we filter to spouse-only before passing
  // to buildHarvestPlan so we don't double-count the user's own buys.
  const { data: household } = useQuery({
    queryKey: ['household', user?.id],
    queryFn: getCurrentHousehold,
    enabled: !!user?.id,
  });
  const { data: householdTxnsRaw } = useQuery({
    queryKey: ['householdRecentTxns', user?.id, household?.householdId],
    queryFn: () => getHouseholdRecentTransactions(35),
    enabled: !!user?.id && !!household?.householdId,
  });
  const spouseTransactions = useMemo(() => {
    if (!Array.isArray(householdTxnsRaw) || !user?.id) return null;
    return householdTxnsRaw
      .filter(t => t.owner_user_id !== user.id)
      .map(t => ({
        ticker: t.ticker,
        transaction_type: t.transaction_type,
        date: t.trade_date,
        quantity: t.quantity,
      }));
  }, [householdTxnsRaw, user?.id]);

  const plan = useMemo(
    () => buildHarvestPlan({ holdings, accounts, transactions, realizedPositions, profile, spouseTransactions }),
    [holdings, accounts, transactions, realizedPositions, profile, spouseTransactions],
  );

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Loss Harvest Center"
          description="Year-end tax-loss harvesting plan with superficial-loss detection and safe replacement suggestions."
          actions={<PageBenefitsDialog {...HARVEST_CENTER_BENEFITS} />}
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
        actions={<PageBenefitsDialog {...HARVEST_CENTER_BENEFITS} />}
      />

      <PlainEnglish>
        Selling losers on purpose to lower this year&rsquo;s tax bill — with guardrails so the CRA actually lets you keep the deduction.
      </PlainEnglish>

      <UrgencyBanner progress={plan} />

      {!hasMarginalSet && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Info className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-400">Set your marginal tax rate for accurate savings estimates.</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Using a 30% default. Set your actual bracket in Profile under Tax Settings.
            </p>
            <PlainEnglish>
              Without your real tax bracket, the savings numbers below are a rough guess instead of an accurate dollar figure.
            </PlainEnglish>
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
        <div className="mb-3">
          <div className="flex items-center gap-2.5">
            <Scissors className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Harvest Opportunities</h2>
            <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {plan.opportunities.length}
            </span>
          </div>
          <div className="ml-6 mt-0.5">
            <PlainEnglish>
              Each card is a stock you currently own at a loss, and a one-click plan: sell this for the deduction, optionally rebuy this replacement to stay invested.
            </PlainEnglish>
          </div>
        </div>
        {!hasOpportunities ? (
          <div className="rounded-xl border border-border/40 bg-card/50 px-4 py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500/60 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No harvestable losses in your taxable accounts.</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">We only surface positions in non-registered accounts — losses in TFSA/RRSP/FHSA are not tax-deductible.</p>
            <div className="max-w-md mx-auto">
              <PlainEnglish>
                Good news — nothing to harvest right now. Either everything you own is in the green, or the losers you have are inside a TFSA/RRSP where losses don&rsquo;t help your tax bill.
              </PlainEnglish>
            </div>
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
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Carryforward value is shown at <span className="text-foreground">60% of nominal</span> to reflect that future use depends on having future capital gains. Adjust your own expectation accordingly.
            </p>
            <PlainEnglish>
              A loss only saves you tax in a year you have gains. We discount the future use because most years aren&rsquo;t big-gain years — a dollar of loss now isn&rsquo;t worth a full dollar of deduction later.
            </PlainEnglish>
          </div>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {plan.spouseLinkActive ? (
                <>
                  <strong className="text-foreground/80">Spousal accounts ARE checked</strong> via the household link in your profile. Cross-spouse superficial-loss blocks are marked "Blocked by Spouse Buy" above. For informational purposes only; not tax advice.
                </>
              ) : (
                <>
                  <strong className="text-foreground/80">The superficial-loss rule also applies to your spouse's accounts.</strong> <Link to="/profile" className="text-primary hover:underline">Link your spouse</Link> to enable cross-spouse detection. For informational purposes only; not tax advice.
                </>
              )}
            </p>
            <PlainEnglish>
              The CRA treats you and your spouse as one for this rule. If your spouse rebuys what you sold, your loss gets denied too — link them so we can catch that for you.
            </PlainEnglish>
          </div>
        </div>
      </div>
    </div>
  );
}
