import React, { useMemo } from 'react';
import { holdings, accounts, portfolioSnapshots, getInstitutionForAccount } from '@/lib/mockData';
import { formatCurrency, PnlValue, StatCard } from '@/components/shared/ValueDisplay';
import { safeNumber, safeDivide, safeArray } from '@/lib/safeNum';
import PageHeader from '@/components/shared/PageHeader';
import PortfolioChart from '@/components/performance/PortfolioChart';
import MonthlyReturnsTable from '@/components/performance/MonthlyReturnsTable';
import { TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';

export default function Performance() {
  const { convert, displayCurrency } = useCurrency();
  const { privacyMode } = usePrivacy();
  const PM = '••••••';

  const snapshots = safeArray(portfolioSnapshots);
  const startValue = safeNumber(snapshots[0]?.value, 0);
  const endValue = safeNumber(snapshots[snapshots.length - 1]?.value, 0);
  const totalReturn = safeDivide(endValue - startValue, startValue) * 100;

  // Portfolio totals converted to display currency
  const totals = useMemo(() => {
    const activeHoldings = holdings.filter(h => h.quantity > 0);
    let totalRealizedGain = 0, totalUnrealizedGain = 0;
    activeHoldings.forEach(h => {
      const cur = h.currency || 'USD';
      totalRealizedGain += convert(safeNumber(h.realized_gain_loss_amount), cur);
      totalUnrealizedGain += convert(safeNumber(h.unrealized_gain_loss_amount), cur);
    });
    return { totalRealizedGain, totalUnrealizedGain };
  }, [convert, displayCurrency]);

  const accountPerf = useMemo(() => accounts.map(acc => {
    const nativeCurrency = acc.base_currency || 'CAD';
    const accHoldings = holdings.filter(h => (h.account_id ?? h.accountId) === acc.id && h.quantity > 0);
    const nativeValue = accHoldings.reduce((sum, h) => sum + safeNumber(h.market_value), 0) + safeNumber(acc.cash_balance);
    const unrealized  = accHoldings.reduce((sum, h) => sum + convert(safeNumber(h.unrealized_gain_loss_amount), h.currency || 'USD'), 0);
    const costBasis   = accHoldings.reduce((sum, h) => sum + safeNumber(h.cost_basis), 0);
    const inst = getInstitutionForAccount(acc.id);
    return {
      type: acc.account_type ?? acc.type,
      instName: inst?.name || '',
      value: convert(nativeValue, nativeCurrency),
      unrealized,
      returnPct: safeDivide(unrealized, convert(costBasis, 'USD')) * 100,
    };
  }).filter(a => a.value > 0).sort((a, b) => b.value - a.value), [convert, displayCurrency]);

  return (
    <div className="space-y-6">
      <PageHeader title="Performance" description="Track your portfolio returns over time" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Return" value={<PnlValue value={totalReturn} isCurrency={false} className="text-xl md:text-2xl font-bold" />} icon={TrendingUp} sensitive={false} />
        <StatCard title={`Realized Gains (${displayCurrency})`} value={<PnlValue value={totals.totalRealizedGain} className="text-xl md:text-2xl font-bold" />} icon={BarChart3} />
        <StatCard title={`Unrealized Gains (${displayCurrency})`} value={<PnlValue value={totals.totalUnrealizedGain} className="text-xl md:text-2xl font-bold" />} icon={TrendingUp} />
        <StatCard title="Period Start" value={privacyMode ? PM : formatCurrency(startValue)} icon={Calendar} subtitle={privacyMode ? undefined : `→ ${formatCurrency(endValue)}`} sensitive={false} />
      </div>

      {/* Advanced Portfolio Chart */}
      <PortfolioChart />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Monthly Returns Table */}
        <MonthlyReturnsTable />

        {/* Performance by Account */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Performance by Account</h2>
          </div>
          <div className="divide-y divide-border/50">
            {accountPerf.map((acc, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-foreground">{acc.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{acc.instName}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">{privacyMode ? PM : formatCurrency(acc.value)}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <PnlValue value={acc.unrealized} className="text-sm" />
                  <PnlValue value={acc.returnPct} isCurrency={false} className="text-xs block mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}