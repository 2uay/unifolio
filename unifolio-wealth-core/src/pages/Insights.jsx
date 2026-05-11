import React, { useMemo, useState } from 'react';
import { AlertTriangle, Info, CheckCircle, AlertCircle, TrendingUp, TrendingDown, Percent, DollarSign, ChevronDown, ChevronUp, Shield, Layers } from 'lucide-react';
import { calcTrueExposure, getHeldETFs } from '@/lib/etfOverlapEngine';
import { calcHealthScore } from '@/lib/healthScore';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { safeNumber, safeDivide, safeFixed } from '@/lib/safeNum';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import DraggableTableHeader from '@/components/shared/DraggableTableHeader';
import usePersistentTableColumns from '@/hooks/usePersistentTableColumns';

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

function HealthScoreCard({ holdings, accounts, totalValue, cashTotal, portfolioSnapshots }) {
  const [expanded, setExpanded] = useState(false);
  const health = useMemo(() => calcHealthScore({ holdings, accounts, totalValue, cashTotal, portfolioSnapshots }), [holdings, accounts, totalValue, cashTotal]);

  const scoreColor = health.score >= 75 ? 'text-emerald-400' : health.score >= 50 ? 'text-amber-400' : 'text-red-400';
  const trackColor = health.score >= 75 ? 'bg-emerald-500' : health.score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Shield className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-3xl font-bold font-mono', scoreColor)}>{health.score}</span>
            <span className="text-muted-foreground text-sm">/ 100</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold ml-1', health.score >= 75 ? 'bg-emerald-500/10 text-emerald-400' : health.score >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400')}>
              {health.grade}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{health.summary}</p>
        </div>
        {/* Progress bar */}
        <div className="hidden sm:block w-32 flex-shrink-0">
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', trackColor)} style={{ width: `${health.score}%` }} />
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {health.factors.map(f => (
              <div key={f.id} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                <div className="flex-shrink-0 mt-0.5">
                  {f.good
                    ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                    : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{f.label}</span>
                    <span className={cn('text-xs font-mono font-bold flex-shrink-0', f.good ? 'text-emerald-400' : 'text-amber-400')}>{f.score}/{f.max}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{f.note}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', f.good ? 'bg-emerald-500' : f.score > f.max * 0.4 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${(f.score / f.max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Insights() {
  const ETF_OVERLAP_COLUMNS = useMemo(() => ([
    { id: 'asset', label: 'Asset', align: 'left' },
    { id: 'direct', label: 'Direct', align: 'right' },
    { id: 'viaEtfs', label: 'Via ETFs', align: 'right' },
    { id: 'totalExposure', label: 'Total Exposure', align: 'right' },
    { id: 'sources', label: 'Sources', align: 'left' },
  ]), []);
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const { accounts, holdings, portfolioSnapshots, isEmptyPortfolio } = usePortfolioData();
  const [etfOverlapColumnOrder, , setEtfOverlapColumnOrder] = usePersistentTableColumns('insights_etf_overlap', ETF_OVERLAP_COLUMNS);
  const PM = '••••••';
  const allAccountIds = useMemo(() => accounts.filter(a => a.included_in_portfolio !== false && !a.excluded).map(a => a.id), [accounts]);
  const activeHoldings = useMemo(() => holdings.filter(h => h.quantity > 0 && allAccountIds.includes(h.account_id ?? h.accountId)), [holdings, allAccountIds]);

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
  const insights = useMemo(() => {
    const result = [];
    const top = sorted[0];
    if (top && safeDivide(convert(safeNumber(top.market_value), top.currency || 'USD'), totalValue) > 0.25) {
      result.push({
        type: 'warning',
        severity: 'medium',
        title: `High concentration in ${top.ticker}`,
        description: `${top.ticker} is your largest holding. Review whether this position is still aligned with your target allocation.`,
      });
    }
    if (cashPct < 5) {
      result.push({
        type: 'info',
        severity: 'low',
        title: 'Low cash allocation',
        description: `Cash is ${cashPct.toFixed(1)}% of your imported portfolio. Make sure this matches your liquidity needs.`,
      });
    }
    return result;
  }, [sorted, totalValue, cashPct, convert]);

  const overlapData = useMemo(() => calcTrueExposure(activeHoldings, totalValue, convert), [activeHoldings, totalValue, convert, displayCurrency]);
  const heldETFs = useMemo(() => getHeldETFs(activeHoldings), [activeHoldings]);

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-6">
        <PageHeader title="Insights" description="Portfolio concentration, risk, and allocation diagnostics" />
        <EmptyPortfolioState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description="AI-powered portfolio analysis and recommendations" />

      {/* Portfolio Health Score */}
      <HealthScoreCard holdings={activeHoldings} accounts={accounts} totalValue={totalValue} cashTotal={cashTotal} portfolioSnapshots={portfolioSnapshots} />

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

      {/* ETF Overlap Detection */}
      {overlapData.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/30">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">ETF Overlap — True Exposure</p>
              <p className="text-[11px] text-muted-foreground">
                Stocks held both directly and through {heldETFs.map(e => e.ticker).join(', ')}. Direct % + ETF % = your total real exposure.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <DraggableTableHeader
                columns={ETF_OVERLAP_COLUMNS.map((column) => ({
                  ...column,
                  headerClassName: cn(
                    'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.id === 'sources' && 'hidden sm:table-cell',
                  ),
                }))}
                orderedColumnIds={etfOverlapColumnOrder}
                onOrderChange={setEtfOverlapColumnOrder}
                rowClassName="border-b border-border/20 bg-secondary/20"
                renderCell={(column) => (
                  <div className={cn('flex items-center', column.align === 'right' ? 'justify-end' : 'justify-start')}>
                    <span>{column.label}</span>
                  </div>
                )}
              />
              <tbody>
                {overlapData.slice(0, 12).map(row => (
                  <tr key={row.ticker} className={cn('border-b border-border/10', row.isHighConcentration && 'bg-amber-500/5')}>
                    {etfOverlapColumnOrder.map((columnId) => {
                      if (columnId === 'asset') {
                        return (
                          <td key={`${row.ticker}-${columnId}`} className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-foreground">{row.ticker}</span>
                              {row.isHighConcentration && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                            </div>
                          </td>
                        );
                      }
                      if (columnId === 'direct') {
                        return (
                          <td key={`${row.ticker}-${columnId}`} className="px-4 py-2 text-right font-mono text-muted-foreground">
                            {row.directPct > 0 ? `${row.directPct.toFixed(1)}%` : <span className="opacity-30">—</span>}
                          </td>
                        );
                      }
                      if (columnId === 'viaEtfs') {
                        return (
                          <td key={`${row.ticker}-${columnId}`} className="px-4 py-2 text-right font-mono text-blue-400">
                            {row.etfPct > 0 ? `${row.etfPct.toFixed(1)}%` : <span className="opacity-30">—</span>}
                          </td>
                        );
                      }
                      if (columnId === 'totalExposure') {
                        return (
                          <td key={`${row.ticker}-${columnId}`} className="px-4 py-2 text-right">
                            <span className={cn('font-mono font-bold', row.isHighConcentration ? 'text-amber-400' : 'text-foreground')}>
                              {row.totalPct.toFixed(1)}%
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={`${row.ticker}-${columnId}`} className="px-4 py-2 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {row.sources.map(s => (
                              <span key={s} className="rounded bg-secondary border border-border/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overlapData.some(r => r.isHighConcentration) && (
            <div className="px-5 py-3 border-t border-border/20 bg-amber-500/5">
              <p className="text-[11px] text-amber-400">
                <strong>High concentration detected.</strong> Assets marked with ⚠ exceed 8% total portfolio exposure after ETF overlap.
              </p>
            </div>
          )}
        </div>
      )}

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
