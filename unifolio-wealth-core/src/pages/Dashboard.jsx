import React, { useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import SimulatedDataLabel from '@/components/shared/SimulatedDataLabel';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CustomPieTooltip } from '@/lib/chartTooltip';
import DashboardPortfolioChart from '@/components/dashboard/DashboardPortfolioChart';
import SlidingStockUpdater from '@/components/dashboard/SlidingStockUpdater';
import { holdings, accounts, getInstitutionForAccount, getAccount } from '@/lib/mockData';
import { formatCurrency, PnlValue, StatCard, MiniSparkline } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { safeNumber, safeDivide } from '@/lib/safeNum';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useTheme } from '@/lib/ThemeContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { useLiveHoldings } from '@/hooks/useLiveHoldings';
import { useLiveData } from '@/lib/LiveDataContext';
import SimulatedLiveLabel from '@/components/shared/SimulatedLiveLabel';

export default function Dashboard() {
  const { privacyMode } = usePrivacy();
  const { chartColors } = useTheme();
  const { convert, displayCurrency } = useCurrency();
  const { registerTicker, liveHoldings } = useLiveData();
  const PM = '••••••';

  const allAccountIds = useMemo(() => accounts.filter((a) => a.included_in_portfolio !== false && !a.excluded).map((a) => a.id), []);
  const baseActiveHoldings = useMemo(() => holdings.filter((h) => h.quantity > 0 && allAccountIds.includes(h.account_id ?? h.accountId)), [allAccountIds]);

  // Register all tickers
  useEffect(() => {
    baseActiveHoldings.forEach((h) => {
      registerTicker(h.ticker, h.asset_class ?? h.assetClass ?? 'stock');
    });
  }, [registerTicker, baseActiveHoldings]);

  // Enhanced live holdings with recalculated values
  const activeHoldings = useMemo(() => {
    return baseActiveHoldings.map((holding) => {
      const ticker = holding.ticker;
      const livePrice = liveHoldings[ticker]?.price;

      if (!livePrice) return holding;

      const quantity = safeNumber(holding.quantity ?? holding.position ?? 0);
      const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? livePrice);
      const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? quantity * avgPrice);
      const oldPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);

      const newMarketValue = quantity * livePrice;
      const newUnrealizedGainLoss = newMarketValue - costBasis;
      const newUnrealizedGainLossPercent = safeDivide(newUnrealizedGainLoss, costBasis) * 100;
      const priceChange = livePrice - oldPrice;
      const newDailyPnl = priceChange * quantity;
      const newDailyPnlPercent = safeDivide(newDailyPnl, costBasis) * 100;

      return {
        ...holding,
        current_price: livePrice,
        lastPrice: livePrice,
        market_value: newMarketValue,
        marketValue: newMarketValue,
        unrealized_gain_loss_amount: newUnrealizedGainLoss,
        unrealizedAmt: newUnrealizedGainLoss,
        unrealized_gain_loss_percent: newUnrealizedGainLossPercent,
        unrealizedPct: newUnrealizedGainLossPercent,
        daily_pnl_amount: newDailyPnl,
        dailyPnl: newDailyPnl,
        daily_pnl_percent: newDailyPnlPercent,
        dailyPct: newDailyPnlPercent,
        sparkline: liveHoldings[ticker]?.sparkline || holding.sparkline
      };
    });
  }, [baseActiveHoldings, liveHoldings]);

  // Convert all monetary totals to display currency
  const totals = useMemo(() => {
    let totalValue = 0,totalDailyPnl = 0,totalUnrealizedGain = 0,cashTotal = 0;
    activeHoldings.forEach((h) => {
      const cur = h.currency || 'USD';
      totalValue += convert(safeNumber(h.market_value), cur);
      totalDailyPnl += convert(safeNumber(h.daily_pnl_amount), cur);
      totalUnrealizedGain += convert(safeNumber(h.unrealized_gain_loss_amount), cur);
    });
    accounts.filter((a) => allAccountIds.includes(a.id)).forEach((a) => {
      cashTotal += convert(safeNumber(a.cash_balance), a.base_currency || 'CAD');
    });
    totalValue += cashTotal;
    return { totalValue, totalDailyPnl, totalUnrealizedGain, cashTotal };
  }, [activeHoldings, allAccountIds, convert, displayCurrency]);

  const topMovers = useMemo(() => [...activeHoldings].
  sort((a, b) => Math.abs(convert(safeNumber(b.daily_pnl_amount), b.currency || 'USD')) - Math.abs(convert(safeNumber(a.daily_pnl_amount), a.currency || 'USD'))).
  slice(0, 6), [activeHoldings, convert, displayCurrency]);

  // Build allocation data converted to display currency
  const accountAllocData = useMemo(() => {
    const map = {};
    activeHoldings.forEach((h) => {
      const acc = getAccount(h.account_id ?? h.accountId);
      const key = acc?.account_type ?? acc?.type ?? 'Unknown';
      map[key] = (map[key] || 0) + convert(safeNumber(h.market_value), h.currency || 'USD');
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [activeHoldings, convert, displayCurrency]);

  const sectorAllocData = useMemo(() => {
    const map = {};
    activeHoldings.forEach((h) => {
      const key = h.sector || 'Unknown';
      map[key] = (map[key] || 0) + convert(safeNumber(h.market_value), h.currency || 'USD');
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [activeHoldings, convert, displayCurrency]);

  return (
    <>
      {/* Asymmetric black background — outside space-y to avoid pushing PageHeader down */}
      <div className="fixed inset-0 -z-10 bg-black overflow-hidden pointer-events-none">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Large asymmetric circles - upper left and lower right */}
          <circle cx="15%" cy="20%" r="320" fill="none" stroke="white" strokeWidth="1.5" opacity="0.12" />
          <circle cx="18%" cy="18%" r="250" fill="none" stroke="white" strokeWidth="1" opacity="0.08" />
          
          <circle cx="85%" cy="70%" r="400" fill="none" stroke="white" strokeWidth="1.5" opacity="0.1" />
          <circle cx="88%" cy="75%" r="300" fill="none" stroke="white" strokeWidth="1" opacity="0.07" />
          
          {/* Accent circles asymmetric */}
          <circle cx="92%" cy="15%" r="150" fill="none" stroke="white" strokeWidth="1" opacity="0.06" />
          <circle cx="8%" cy="85%" r="180" fill="none" stroke="white" strokeWidth="1" opacity="0.06" />
          
          {/* Diagonal flowing lines */}
          <line x1="0%" y1="30%" x2="100%" y2="50%" stroke="white" strokeWidth="0.8" opacity="0.04" />
          <line x1="0%" y1="60%" x2="100%" y2="40%" stroke="white" strokeWidth="0.8" opacity="0.04" />
          
          {/* Vertical accent lines */}
          <line x1="20%" y1="0%" x2="20%" y2="100%" stroke="white" strokeWidth="0.6" opacity="0.03" />
          <line x1="75%" y1="0%" x2="75%" y2="100%" stroke="white" strokeWidth="0.6" opacity="0.03" />
          
          {/* Subtle grid in background */}
          <defs>
            <pattern id="bgGrid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="0.3" opacity="0.02" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGrid)" />
        </svg>
      </div>
      <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Portfolio overview and key metrics"
        actions={
        <div className="flex items-center gap-2">
            <SimulatedDataLabel />
          </div>
        } />
      

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <StatCard
          title={`Total Portfolio (${displayCurrency})`}
          value={formatCurrency(totals.totalValue)}
          icon={DollarSign}
          trend={safeDivide(totals.totalDailyPnl, totals.totalValue) * 100}
          trendLabel="today" />
        
        <StatCard
          title="Daily P&L"
          value={<PnlValue value={totals.totalDailyPnl} className="text-xl md:text-2xl font-bold" />}
          icon={safeNumber(totals.totalDailyPnl) >= 0 ? TrendingUp : TrendingDown}
          trend={safeDivide(totals.totalDailyPnl, totals.totalValue) * 100}
          trendLabel="vs yesterday" />
        
        <StatCard
          title="Unrealized Gain"
          value={<PnlValue value={totals.totalUnrealizedGain} className="text-xl md:text-2xl font-bold" />}
          icon={safeNumber(totals.totalUnrealizedGain) >= 0 ? ArrowUpRight : ArrowDownRight}
          trend={safeDivide(totals.totalUnrealizedGain, totals.totalValue) * 100}
          trendLabel="of portfolio" />
        
        <StatCard
          title="Cash Balance"
          value={formatCurrency(totals.cashTotal)}
          icon={Wallet}
          subtitle={`${(safeDivide(totals.cashTotal, totals.totalValue) * 100).toFixed(1)}% of portfolio`} />
        
      </div>

      {/* Moving Stock Ticker - Between metric cards and portfolio chart */}
      

      

      {/* Portfolio Chart */}
      <DashboardPortfolioChart />

      <div className="grid lg:grid-cols-2 gap-2 sm:gap-4">
        {/* Account Allocation */}
        <div className="bg-card rounded-lg border border-border/30 p-3 sm:p-4 md:p-5">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Account Allocation</h2>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={accountAllocData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {accountAllocData.map((_, i) =>
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    )}
                  </Pie>
                  <Tooltip content={(props) => <CustomPieTooltip {...props} privacyMode={privacyMode} total={accountAllocData.reduce((s, d) => s + d.value, 0)} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              {accountAllocData.map((item, i) =>
              <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chartColors[i % chartColors.length] }} />
                    <span className="truncate text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums">{privacyMode ? PM : formatCurrency(item.value, true)}</span>
                    </div>
              )}
                    </div>
                    </div>
                    </div>

                    {/* Sector Allocation */}
        <div className="bg-card rounded-lg border border-border/30 p-3 sm:p-4 md:p-5">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Sector Allocation</h2>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectorAllocData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {sectorAllocData.map((_, i) =>
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    )}
                  </Pie>
                  <Tooltip content={(props) => <CustomPieTooltip {...props} privacyMode={privacyMode} total={sectorAllocData.reduce((s, d) => s + d.value, 0)} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              {sectorAllocData.map((item, i) =>
              <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chartColors[i % chartColors.length] }} />
                    <span className="truncate text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums">{privacyMode ? PM : formatCurrency(item.value, true)}</span>
                  </div>
              )}
                  </div>
                  </div>
                  </div>
                  </div>

      {/* Top Movers */}
      <div className="bg-card rounded-lg border border-border/30 p-3 sm:p-4 md:p-5">
        <h2 className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2 sm:mb-4">Top Movers Today</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {topMovers.map((h) => {
            const inst = getInstitutionForAccount(h.account_id ?? h.accountId);
            const acc = getAccount(h.account_id ?? h.accountId);
            const changePct = h.dailyPct ?? 0;
            const convertedDailyPnl = convert(safeNumber(h.daily_pnl_amount ?? h.dailyPnl), h.currency || 'USD');
            return (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <MiniSparkline data={h.sparkline} width={48} height={20} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{h.ticker}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{acc?.account_type ?? acc?.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{inst?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <PnlValue value={convertedDailyPnl} className="text-sm font-semibold" />
                  <PnlValue value={changePct} isCurrency={false} className="text-xs block" />
                </div>
              </div>);

          })}
        </div>
      </div>
      </div>
    </>);

}