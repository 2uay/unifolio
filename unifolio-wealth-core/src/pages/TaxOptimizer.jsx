import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ArrowRight, AlertTriangle, TrendingDown, Wallet, MapPin,
  Info, Settings as SettingsIcon, CheckCircle2,
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
import { buildTaxOptimization } from '@/lib/taxOptimizer';

const PM = '••••••';

function HeadlineCard({ totalSavings, opportunityCount, marginalTaxRate, privacyMode }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">Projected Annual Tax Savings</span>
          </div>
          <p className="text-4xl sm:text-5xl font-bold font-mono text-primary">
            {privacyMode ? PM : (totalSavings > 0 ? '+' : '') + formatCurrency(totalSavings)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            From {opportunityCount} actionable {opportunityCount === 1 ? 'opportunity' : 'opportunities'} below.
            Based on a {(marginalTaxRate * 100).toFixed(0)}% marginal tax rate.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Link to="/profile">
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5">
              <SettingsIcon className="h-3 w-3" /> Tax Settings
            </Button>
          </Link>
          <Link to="/tax">
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground">
              View Tax Report <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  if (severity === 'high') {
    return <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">High Impact</span>;
  }
  if (severity === 'medium') {
    return <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Medium Impact</span>;
  }
  return <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Low Impact</span>;
}

function OpportunityCard({ opp, privacyMode, icon: Icon, accentColor }) {
  const [open, setOpen] = useState(false);
  const savings = opp.estimatedAnnualSavings;
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden transition-all', open && 'ring-1 ring-primary/30')}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-secondary/20 transition-colors"
      >
        <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', accentColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-semibold text-sm text-foreground">{opp.ticker}</span>
            <SeverityBadge severity={opp.severity} />
            {opp.wouldTriggerSuperficial && (
              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Superficial Loss Risk
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{opp.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Savings</p>
          <p className="text-sm font-mono font-bold text-emerald-400">
            {privacyMode ? PM : '+' + formatCurrency(savings)}
            <span className="text-[10px] text-muted-foreground ml-1">/yr</span>
          </p>
        </div>
      </button>
      {open && (
        <div className="border-t border-border/30 px-4 py-3.5 space-y-3 bg-secondary/10">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Why</p>
            <p className="text-xs text-foreground leading-relaxed">{opp.rationale}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Action</p>
            <p className="text-xs text-foreground leading-relaxed">{opp.action}</p>
          </div>
          {opp.caveat && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              <Info className="h-3 w-3 mt-0.5 text-amber-400 flex-shrink-0" />
              <p className="text-[11px] text-amber-400/90 leading-relaxed">{opp.caveat}</p>
            </div>
          )}
          {opp.replacementCandidates && opp.replacementCandidates.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Suggested Replacements</p>
              <div className="flex gap-2 flex-wrap">
                {opp.replacementCandidates.map(t => (
                  <span key={t} className="rounded-md bg-primary/10 border border-primary/30 px-2 py-1 font-mono text-[11px] text-primary">{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[10px] text-muted-foreground">
            <span>From: <span className="text-foreground">{opp.fromAccount}</span></span>
            {opp.toAccountType && <span>To: <span className="text-foreground">{opp.toAccountType}</span></span>}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count, accentColor }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <Icon className={cn('h-4 w-4', accentColor)} />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{count}</span>
    </div>
  );
}

function EmptySection({ message }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 px-4 py-6 text-center">
      <CheckCircle2 className="h-5 w-5 text-emerald-500/60 mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function ContributionSequenceCard({ sequence }) {
  if (sequence.length === 0) {
    return <EmptySection message="No registered accounts found. Add a TFSA, RRSP, or FHSA in Accounts to get contribution guidance." />;
  }
  return (
    <div className="space-y-3">
      {sequence.map((step, i) => (
        <div key={step.account} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/15 border border-primary/30 w-6 h-6 flex items-center justify-center text-[11px] font-bold text-primary">
                {i + 1}
              </div>
              <span className="font-semibold text-sm text-foreground">{step.account}</span>
              {step.annualCap && (
                <span className="text-[10px] text-muted-foreground">Annual cap: ${step.annualCap.toLocaleString()}</span>
              )}
            </div>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed ml-9">{step.rationale}</p>
        </div>
      ))}
    </div>
  );
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

export default function TaxOptimizer() {
  const { privacyMode } = usePrivacy();
  const { user } = useAuth();
  const { accounts, transactions, holdings, isEmptyPortfolio } = usePortfolioData();
  const [profile, setProfile] = useState({});

  useEffect(() => {
    let cancelled = false;
    loadOptProfile(user?.id).then(p => { if (!cancelled) setProfile(p); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const optimization = useMemo(
    () => buildTaxOptimization({ holdings, accounts, transactions, profile }),
    [holdings, accounts, transactions, profile],
  );

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Tax Optimizer"
          description="Personalized recommendations to lower your annual tax bill."
        />
        <EmptyPortfolioState />
      </div>
    );
  }

  const hasMarginalSet = typeof (/** @type {{ marginal_tax_rate?: number }} */ (profile).marginal_tax_rate) === 'number';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tax Optimizer"
        description="Personalized recommendations to lower your annual tax bill. Canadian rules — asset location, loss harvesting, and contribution sequencing."
      />

      {!hasMarginalSet && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Info className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-400">Set your marginal tax rate for accurate savings estimates.</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              We're using a 30% default. Update it in your Profile under Tax Settings to get recommendations calibrated to your actual bracket.
            </p>
          </div>
          <Link to="/profile">
            <Button variant="outline" size="sm" className="h-7 text-[11px]">Set Rate</Button>
          </Link>
        </div>
      )}

      <HeadlineCard
        totalSavings={optimization.totalProjectedSavings}
        opportunityCount={optimization.opportunityCount}
        marginalTaxRate={optimization.marginalTaxRate}
        privacyMode={privacyMode}
      />

      {/* Asset Location */}
      <section>
        <SectionHeader
          icon={MapPin}
          title="Asset Location Opportunities"
          count={optimization.assetLocation.length}
          accentColor="text-blue-400"
        />
        {optimization.assetLocation.length === 0 ? (
          <EmptySection message="No asset location moves found. Your portfolio is well-placed across registered and non-registered accounts." />
        ) : (
          <div className="space-y-2">
            {optimization.assetLocation.map(opp => (
              <OpportunityCard key={opp.id} opp={opp} privacyMode={privacyMode} icon={MapPin} accentColor="text-blue-400" />
            ))}
          </div>
        )}
      </section>

      {/* Loss Harvesting */}
      <section>
        <SectionHeader
          icon={TrendingDown}
          title="Loss Harvesting Opportunities"
          count={optimization.lossHarvest.length}
          accentColor="text-amber-400"
        />
        {optimization.lossHarvest.length === 0 ? (
          <EmptySection message="No harvestable losses in your taxable accounts right now. We only surface losses outside registered accounts (registered losses are not tax-deductible)." />
        ) : (
          <div className="space-y-2">
            {optimization.lossHarvest.map(opp => (
              <OpportunityCard key={opp.id} opp={opp} privacyMode={privacyMode} icon={TrendingDown} accentColor="text-amber-400" />
            ))}
          </div>
        )}
      </section>

      {/* Contribution Sequence */}
      <section>
        <SectionHeader
          icon={Wallet}
          title="Contribution Sequence"
          count={optimization.contributionSequence.length}
          accentColor="text-emerald-400"
        />
        <ContributionSequenceCard sequence={optimization.contributionSequence} />
      </section>

      <div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground/80">For informational purposes only.</strong> These recommendations are based on Canadian tax rules and your portfolio data. They are not tax advice. Consult a tax professional before acting, especially for in-kind transfers between registered accounts (which use contribution room) or transactions that may trigger superficial loss rules.
        </p>
      </div>
    </div>
  );
}
