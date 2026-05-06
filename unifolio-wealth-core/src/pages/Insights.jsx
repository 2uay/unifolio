import React, { useMemo } from 'react';
import { AlertTriangle, Info, CheckCircle, AlertCircle, TrendingUp, TrendingDown, Percent, DollarSign } from 'lucide-react';
import { accounts, holdings, getInsights } from '@/lib/mockData';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { safeNumber, safeDivide, safeFixed } from '@/lib/safeNum';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';

const severityConfig = {
  low: { bg: 'bg-blue-500/10 border-blue-500/20', icon: Info, color: 'text-blue-400' },
  medium: { bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle, color: 'text-amber-400' },
  high: { bg: 'bg-red-500/10 border-red-500/20', icon: AlertCircle, color: 'text-red-400' },
};

const typeIcon = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  alert: AlertCircle,
};

export default function Insights() {
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const PM = '••••••';
  const allAccountIds = useMemo(() => accounts.filter(a => a.included_in_portfolio !== false && !a.excluded).map(a => a.id), []);
  const activeHoldings = useMemo(() => holdings.filter(h => h.quantity > 0 && allAccountIds.includes(h.account_id ?? h.accountId)), [allAccountIds]);

  const { totalValue, cashTotal } = useMemo(() => {
    let tv = 0, ct = 0;
    activeHoldings.forEach(h => { tv += convert(safeNumber(h.market_value), h.currency || 'USD'); });
    accounts.filter(a => allAccountIds.includes(a.id)).forEach(a => { ct += convert(safeNumber(a.cash_balance), a.base_currency || 'CAD'); });
    tv += ct;
    return { totalValue: tv, cashTotal: ct };
  }, [activeHoldings, allAccountIds, convert, displayCurrency]);

  const sorted    = useMemo(() => [...activeHoldings].sort((a, b) => convert(safeNumber(b.market_value), b.currency || 'USD') - convert(safeNumber(a.market_value), a.currency || 'USD')), [activeHoldings, convert, displayCurrency]);
  const bestPerf  = useMemo(() => [...activeHoldings].filter(h => h.unrealizedPct !== null).sort((a, b) => (b.unrealizedPct ?? 0) - (a.unrealizedPct ?? 0)), [activeHoldings]);
  const worstPerf = useMemo(() => [...bestPerf].reverse(), [bestPerf]);

  const cashPct = totalValue > 0 ? (cashTotal / totalValue) * 100 : 0;

  const largestMV = sorted[0] ? convert(safeNumber(sorted[0].market_value), sorted[0].currency || 'USD') : 0;

  const insightCards = [
    {
      title: 'Largest Holding',
      value: sorted[0]?.ticker ?? '—',
      detail: sorted[0] ? (privacyMode ? PM : `${formatCurrency(largestMV)} (${(safeDivide(largestMV, totalValue) * 100).toFixed(1)}% of portfolio)`) : '—',
      icon: DollarSign,
      color: 'text-blue-400',
    },
    {
      title: 'Best Performer',
      value: bestPerf[0]?.ticker ?? '—',
      detail: bestPerf[0]?.unrealizedPct != null ? `+${safeFixed(bestPerf[0].unrealizedPct, 1, '—')}% return` : '—',
      icon: TrendingUp,
      color: 'text-emerald-400',
    },
    {
      title: 'Worst Performer',
      value: worstPerf[0]?.ticker ?? '—',
      detail: worstPerf[0]?.unrealizedPct != null ? `${safeFixed(worstPerf[0].unrealizedPct, 1, '—')}% return` : '—',
      icon: TrendingDown,
      color: 'text-red-400',
    },
    {
      title: 'Cash Allocation',
      value: privacyMode ? '••••' : `${safeFixed(cashPct, 1, '0')}%`,
      detail: privacyMode ? PM : formatCurrency(cashTotal),
      icon: Percent,
      color: 'text-amber-400',
    },
  ];

  // Dynamically generated insights — no hardcoded percentages
  const insights = getInsights(allAccountIds);

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description="AI-powered portfolio analysis and recommendations" />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {insightCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', card.color)} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</span>
              </div>
              <p className="text-xl font-bold font-mono">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.detail}</p>
            </div>
          );
        })}
      </div>

      {/* Insight Cards */}
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const cfg = severityConfig[insight.severity];
          const Icon = typeIcon[insight.type] || Info;
          return (
            <div key={i} className={cn('rounded-xl border p-4 md:p-5', cfg.bg)}>
              <div className="flex items-start gap-3">
                <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', cfg.color)} />
                <div>
                  <h3 className="font-semibold text-sm">{insight.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}