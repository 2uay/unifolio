import React, { useState, useMemo, useEffect } from 'react';
import { Filter, ChevronDown, ChevronUp, ArrowUpDown, Info, Columns3 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ThemedSwitch from '@/components/ui/switch-themed';
import { Button } from '@/components/ui/button';
import { holdings, accounts, getAccount, getInstitutionForAccount, accountTypes, institutions, calcPortfolioTotals, calcAccountValue } from '@/lib/mockData';
import { formatCurrency, PnlValue, MiniSparkline } from '@/components/shared/ValueDisplay';
import { safeNumber, safeDivide } from '@/lib/safeNum';
import PageHeader from '@/components/shared/PageHeader';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useTheme } from '@/lib/ThemeContext';
import HoldingDetailRow from '@/components/holdings/HoldingDetailRow';
import DateRangeFilter from '@/components/holdings/DateRangeFilter';
import { rawRealizedPositions, filterRealizedByDateRange } from '@/lib/realizedPositions';
import { getSavedColumnOrder, COLUMN_DEFINITIONS } from '@/lib/columnConfig';
import PortfolioBreakdown from '@/components/holdings/PortfolioBreakdown';
import HeatmapModeSelector from '@/components/holdings/HeatmapModeSelector';
import { HEATMAP_MODES } from '@/lib/heatmapModes.js';
import { calculateHeatmapStyle, enrichHoldingsForHeatmap } from '@/lib/heatmapColorEngine.js';
import ColumnCustomizeModal from '@/components/holdings/ColumnCustomizeModal';
import { useLiveHoldings } from '@/hooks/useLiveHoldings';
import { useLiveData } from '@/lib/LiveDataContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import SimulatedLiveLabel from '@/components/shared/SimulatedLiveLabel';
import TickerWithStar from '@/components/shared/TickerWithStar';
import { cn } from '@/lib/utils';

// Filter current holdings based on a date snapshot.
// If a date is provided, we show only holdings whose purchase_history has at least
// one buy on or before that date (simulating what you held at that point).
// Returns only ACTIVE holdings (quantity > 0) filtered by date snapshot.
// A holding is "active" if current quantity > 0.
// In historical mode, we additionally check that a purchase existed on or before the date.
function filterHoldingsByDate(allHoldings, dateFilter) {
  // Always start by excluding zero-quantity holdings — they are never "active"
  const activeHoldings = allHoldings.filter(h => h.quantity > 0);

  if (!dateFilter?.start || dateFilter.preset === 'current') return activeHoldings;

  const asOf = new Date(dateFilter.end || dateFilter.start);
  return activeHoldings.filter(h => {
    if (!h.purchase_history?.length) return false;
    return h.purchase_history.some(p => new Date(p.date) <= asOf);
  });
}

export default function Holdings() {
  const [accountFilter, setAccountFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [assetClassFilter, setAssetClassFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [sortField, setSortField] = useState('ticker');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedId, setExpandedId] = useState(null);
  const [showRealized, setShowRealized] = useState(false);
  const [dateFilter, setDateFilter] = useState({ preset: 'current', start: null, end: null, label: 'Current' });
  const [visibleColumns, setVisibleColumns] = useState(getSavedColumnOrder());
  const [heatmapEnabled, setHeatmapEnabled] = useState(() => {
    const saved = localStorage.getItem('holdings_heatmap_enabled');
    return saved !== 'false'; // Default to enabled
  });
  const [heatmapMode, setHeatmapMode] = useState(() => {
    const saved = localStorage.getItem('holdings_heatmap_mode');
    return saved || HEATMAP_MODES.PORTFOLIO_WEIGHT; // Default to Portfolio Weight
  });
  const [showColumnModal, setShowColumnModal] = useState(false);

  const { convert, displayCurrency } = useCurrency();
  const { privacyMode } = usePrivacy();
  const { theme } = useTheme();
  const { palette } = useSecondaryColors();
  const { registerTicker, liveHoldings } = useLiveData();
  const { isStar, toggleStar } = useStarredStocks();
  const PM = '••••••'; // privacy mask shorthand
  const totals = calcPortfolioTotals();

  // Register tickers for live updates
  useEffect(() => {
    holdings.filter(h => h.quantity > 0).forEach(h => {
      registerTicker(h.ticker, h.asset_class ?? h.assetClass ?? 'stock');
    });
  }, [registerTicker]);



  const handleHeatmapToggle = (enabled) => {
    setHeatmapEnabled(enabled);
    localStorage.setItem('holdings_heatmap_enabled', String(enabled));
  };

  const handleHeatmapModeChange = (newMode) => {
    setHeatmapMode(newMode);
    localStorage.setItem('holdings_heatmap_mode', newMode);
  };

  const handleColumnsChange = (newColumns) => {
    setVisibleColumns(newColumns);
  };

  const accountValueMap = useMemo(() => {
    const map = {};
    accounts.forEach(acc => { map[acc.id] = calcAccountValue(acc.id); });
    return map;
  }, []);

  // Total portfolio value in display currency for allocation %
  const convertedPortfolioTotal = useMemo(() => {
    return holdings.filter(h => h.quantity > 0).reduce((sum, h) => {
      return sum + convert(h.market_value ?? 0, h.currency || 'USD');
    }, 0) + accounts.reduce((sum, acc) => sum + convert(acc.cash_balance ?? 0, acc.base_currency || 'CAD'), 0);
  }, [convert, displayCurrency]);

  // Calculate account totals for account weight heatmap
  const accountTotals = useMemo(() => {
    const totals = {};
    holdings.filter(h => h.quantity > 0).forEach(h => {
      const accId = h.account_id ?? h.accountId;
      totals[accId] = (totals[accId] || 0) + convert(h.market_value ?? 0, h.currency || 'USD');
    });
    accounts.forEach(a => {
      const accId = a.id;
      totals[accId] = (totals[accId] || 0) + convert(a.cash_balance ?? 0, a.base_currency || 'CAD');
    });
    return totals;
  }, [convert, displayCurrency]);

  // ── Live-updated holdings ────────────────────────────────────
  const baseHoldings = useMemo(() => filterHoldingsByDate(holdings, dateFilter), [dateFilter]);
  const liveUpdatedBaseHoldings = useMemo(() => {
    return baseHoldings.map(holding => {
      const ticker = holding.ticker;
      const livePrice = liveHoldings[ticker]?.price;
      
      if (!livePrice) return holding;

      const quantity = safeNumber(holding.quantity ?? holding.position ?? 0);
      const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? livePrice);
      const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? (quantity * avgPrice));
      const oldPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);

      // Recalculate dependent values
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
        sparkline: liveHoldings[ticker]?.sparkline || holding.sparkline,
      };
    });
  }, [baseHoldings, liveHoldings]);

  // ── Realized positions ────────────────────────────────────────
  // Only show entries from rawRealizedPositions (fully closed positions, quantity = 0).
  // These are entirely separate from active holdings — never derived from realized_gain_loss_amount.
  const filteredRealized = useMemo(() => {
   if (!showRealized) return [];
   return filterRealizedByDateRange(rawRealizedPositions, dateFilter.start, dateFilter.end);
  }, [showRealized, dateFilter]);

  // Calculate total absolute realized P&L across visible holdings and realized positions
  const totalAbsoluteRealizedPnl = useMemo(() => {
    let total = 0;
    // Active holdings with realized P&L
    liveUpdatedBaseHoldings.forEach(h => {
      const realized = safeNumber(h.realized_gain_loss_amount ?? h.realizedGain ?? 0);
      total += Math.abs(realized);
    });
    // All realized positions
    filteredRealized.forEach(r => {
      const realized = safeNumber(r.realized_gain_loss_amount ?? 0);
      total += Math.abs(realized);
    });
    return total;
  }, [liveUpdatedBaseHoldings, filteredRealized]);

  // Enrich holdings for heatmap calculation
  const enrichedForHeatmap = useMemo(() => {
    // Always enrich even if heatmap is disabled, so mode switching works
    const enriched = enrichHoldingsForHeatmap(liveUpdatedBaseHoldings, heatmapMode, {
      portfolioTotal: convertedPortfolioTotal,
      accountTotals,
      totalAbsoluteRealizedPnl,
    });
    return enriched;
  }, [liveUpdatedBaseHoldings, heatmapMode, convertedPortfolioTotal, accountTotals, totalAbsoluteRealizedPnl]);

  const filteredCurrent = useMemo(() => {
    return enrichedForHeatmap.filter(h => {
      // Defensive guard: only show holdings with quantity > 0 (active positions only)
      if ((h.quantity ?? 0) <= 0) return false;
      const acc = getAccount(h.account_id ?? h.accountId);
      if (!acc) return false;
      const accType = acc.account_type ?? acc.type;
      const instId = acc.institution_id ?? acc.institutionId;
      const ac = h.asset_class ?? h.assetClass;
      if (accountFilter !== 'all' && accType !== accountFilter) return false;
      if (institutionFilter !== 'all' && instId !== institutionFilter) return false;
      if (assetClassFilter !== 'all' && ac !== assetClassFilter) return false;
      if (currencyFilter !== 'all' && h.currency !== currencyFilter) return false;
      return true;
    }).sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'ticker': aVal = a.ticker; bVal = b.ticker; break;
        case 'lastPrice': aVal = a.lastPrice; bVal = b.lastPrice; break;
        case 'position': aVal = a.position; bVal = b.position; break;
        case 'marketValue': aVal = a.lastPrice * a.position; bVal = b.lastPrice * b.position; break;
        case 'unrealized': aVal = (a.lastPrice - a.avgPrice) * a.position; bVal = (b.lastPrice - b.avgPrice) * b.position; break;
        case 'dailyPnl': aVal = a.dailyPnl; bVal = b.dailyPnl; break;
        default: aVal = a.ticker; bVal = b.ticker;
      }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [enrichedForHeatmap, accountFilter, institutionFilter, assetClassFilter, currencyFilter, sortField, sortDir]);

  // Group realized positions: matched under active holdings, and unmatched at bottom
  const { realizedByActive, realizedUnmatched } = useMemo(() => {
   if (!showRealized || filteredRealized.length === 0) return { realizedByActive: {}, realizedUnmatched: [] };

   const byActive = {};
   const unmatched = [];

   filteredRealized.forEach(r => {
     // Find matching active holding by ticker (case-insensitive)
     const matchingActive = filteredCurrent.find(h => h.ticker?.toUpperCase() === r.ticker?.toUpperCase());

     if (matchingActive) {
       if (!byActive[matchingActive.id]) byActive[matchingActive.id] = [];
       byActive[matchingActive.id].push(r);
     } else {
       unmatched.push(r);
     }
   });

   // Sort realized rows within each active by most recent close_date first
   Object.keys(byActive).forEach(activeId => {
     byActive[activeId].sort((a, b) => new Date(b.close_date) - new Date(a.close_date));
   });

   // Sort unmatched by most recent close_date
   unmatched.sort((a, b) => new Date(b.close_date) - new Date(a.close_date));

   return { realizedByActive: byActive, realizedUnmatched: unmatched };
  }, [showRealized, filteredRealized, filteredCurrent]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const renderColumnValue = (h, colId, acc, inst, nativeCurrency, convertedMarketValue, convertedAcctTotal, unrealizedAmt, unrealizedPct, dailyPct, sparkArr, lp, changePct, changeAmt) => {
    const acctType = acc?.account_type ?? acc?.type;
    const pctOfNav = safeDivide(convertedMarketValue, convertedPortfolioTotal) * 100;
    const pctOfAcct = safeDivide(convertedMarketValue, convertedAcctTotal) * 100;

    switch (colId) {
      case 'ticker':
        return (
          <TickerWithStar 
            ticker={h.ticker}
            onStarClick={() => toggleStar(h.ticker)}
            interactive={true}
          />
        );
      case 'trend':
        return <MiniSparkline data={h.sparkline} width={64} height={20} />;
      case 'company':
        return <span className="text-muted-foreground text-xs max-w-[200px] truncate">{h.name}</span>;
      case 'price':
        return <span className="text-right font-mono tabular-nums">{privacyMode ? PM : safeNumber(lp).toFixed(2)}</span>;
      case 'quantity':
        return <span className="text-right font-mono tabular-nums">{h.position}</span>;
      case 'pctPortfolio':
        return <span className="text-right font-mono tabular-nums text-muted-foreground">{privacyMode ? '••••' : pctOfNav.toFixed(2) + '%'}</span>;
      case 'pctAccount':
        return <span className="text-right font-mono tabular-nums text-blue-400">{privacyMode ? '••••' : (h.position > 0 ? pctOfAcct.toFixed(2) + '%' : '—')}</span>;
      case 'avgPrice':
        return <span className="text-right font-mono tabular-nums">{privacyMode ? PM : (safeNumber(h.average_price ?? h.avgPrice) > 0 ? safeNumber(h.average_price ?? h.avgPrice).toFixed(2) : '—')}</span>;
      case 'realizedGain':
        return <PnlValue value={h.realized_gain_loss_amount ?? h.realizedGain} className="text-xs" />;
      case 'unrealizedGainPct':
        return <PnlValue value={unrealizedPct} isCurrency={false} className="text-xs" />;
      case 'unrealizedGain':
        return <PnlValue value={unrealizedAmt} className="text-xs" />;
      case 'dailyPnl':
        return <PnlValue value={h.daily_pnl_amount ?? h.dailyPnl} className="text-xs" />;
      case 'dailyPnlPct':
        return <PnlValue value={dailyPct} isCurrency={false} className="text-xs" />;
      case 'account':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{acctType}</span>;
      case 'institution':
        return <span className="text-xs text-muted-foreground whitespace-nowrap">{inst?.name}</span>;
      case 'accountType':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{acctType}</span>;
      case 'marketValue':
        return <span className="text-right font-mono tabular-nums">{privacyMode ? PM : formatCurrency(convertedMarketValue)}</span>;
      case 'nativeMarketValue':
        return <span className="text-right font-mono tabular-nums">{privacyMode ? PM : formatCurrency(safeNumber(h.market_value ?? h.marketValue))}</span>;
      case 'costBasis':
        return <span className="text-right font-mono tabular-nums">{privacyMode ? PM : formatCurrency(safeNumber(h.cost_basis ?? h.costBasis))}</span>;
      case 'pctAssetClass':
        return <span className="text-right font-mono tabular-nums text-muted-foreground">N/A</span>;
      case 'currency':
        return <span className="text-xs font-mono">{nativeCurrency}</span>;
      case 'assetClass':
        return <span className="text-xs">{h.asset_class ?? h.assetClass}</span>;
      case 'sector':
        return <span className="text-xs">{h.sector}</span>;
      case 'country':
        return <span className="text-xs">{h.country || 'N/A'}</span>;
      case 'exchange':
        return <span className="text-xs">{h.exchange || 'N/A'}</span>;
      default:
        return null;
    }
  };

  const SortHeader = ({ field, children, className }) => (
    <th
      className={cn('px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap', className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );

  const isHistorical = dateFilter?.preset !== 'current';

  // Calculate max holding % for responsive heatmap scaling
  const maxPctInView = useMemo(() => {
    if (filteredCurrent.length === 0) return 50;
    let max = 0;
    filteredCurrent.forEach(h => {
      const marketValue = safeNumber(h.market_value ?? h.marketValue);
      const convertedValue = convert(marketValue, h.currency || 'USD');
      const pct = safeDivide(convertedValue, convertedPortfolioTotal) * 100;
      if (pct > max) max = pct;
    });
    return Math.max(max, 5); // Minimum 5% for scaling
  }, [filteredCurrent, convertedPortfolioTotal, convert]);

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Holdings" 
        description="All positions across accounts and institutions"
        actions={<SimulatedLiveLabel />}
      />

      {/* Filters Row */}
       <div className="flex flex-wrap gap-1 sm:gap-2 items-center">
         <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />

         {/* Date filter */}
         <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-24 sm:w-32 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accountTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
          <SelectTrigger className="w-28 sm:w-40 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Institutions</SelectItem>
            {institutions.filter(i => (i.connection_status ?? i.status) === 'connected').map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
          <SelectTrigger className="w-24 sm:w-32 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            <SelectItem value="Equity">Equity</SelectItem>
            <SelectItem value="ETF">ETF</SelectItem>
            <SelectItem value="Stock">Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="w-20 sm:w-28 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Currencies</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="CAD">CAD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Historical notice */}
      {isHistorical && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary/80">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Showing estimated holdings as of <strong>{dateFilter.label}</strong> based on purchase history. Connect full transaction history for greater accuracy.</span>
        </div>
      )}

      {/* Realized toggle */}
       <div className="flex items-center gap-2">
         <ThemedSwitch
           id="show-realized"
           checked={showRealized}
           onCheckedChange={setShowRealized}
           className="scale-90"
         />
         <label htmlFor="show-realized" className="text-xs text-muted-foreground cursor-pointer select-none">
           Show realized positions
         </label>
       </div>



      {/* Position count */}
      <div className="flex items-center justify-end">
        <span className="text-[10px] sm:text-xs text-muted-foreground">
          {filteredCurrent.length} active{showRealized && (Object.keys(realizedByActive).length > 0 || realizedUnmatched.length > 0) ? ` · ${(Object.values(realizedByActive).flat() || []).length + realizedUnmatched.length} realized` : ''}
        </span>
      </div>

      {filteredCurrent.length === 0 && filteredRealized.length === 0 ? (
        <div className="bg-card rounded-lg border border-border/30 p-12 text-center">
          <p className="text-muted-foreground text-sm">No holdings found for this date range.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Try a different date or connect full transaction history.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {visibleColumns.map(colId => {
                    const col = COLUMN_DEFINITIONS.find(c => c.id === colId);
                    if (!col) return null;
                    const isSortable = ['ticker', 'price', 'quantity', 'marketValue'].includes(colId);
                    const headerClass = ['price', 'quantity', 'pctPortfolio', 'pctAccount', 'avgPrice', 'realizedGain', 'unrealizedGainPct', 'unrealizedGain', 'dailyPnl', 'dailyPnlPct', 'marketValue', 'nativeMarketValue', 'costBasis'].includes(colId) ? 'text-right' : 'text-left';
                    return isSortable ? (
                      <SortHeader key={colId} field={colId} className={headerClass}>{col.label}</SortHeader>
                    ) : (
                      <th key={colId} className={`px-2 sm:px-3 py-1.5 sm:py-2.5 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${headerClass}`}>
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Active holdings + nested realized positions */}
                {filteredCurrent.flatMap(h => {
                  const acc = getAccount(h.account_id ?? h.accountId);
                  const inst = getInstitutionForAccount(h.account_id ?? h.accountId);
                  const nativeCurrency = h.currency || 'USD';
                  const marketValue = safeNumber(h.market_value ?? h.marketValue);
                  const convertedMarketValue = convert(marketValue, nativeCurrency);
                  const acctId = h.account_id ?? h.accountId;
                  const acctTotal = safeNumber(accountValueMap[acctId]);
                  const acctNativeCurrency = acc?.base_currency || 'CAD';
                  const convertedAcctTotal = convert(acctTotal, acctNativeCurrency);
                  const unrealizedAmt = safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt);
                  const unrealizedPct = safeNumber(h.unrealized_gain_loss_percent ?? h.unrealizedPct);
                  const dailyPct = safeNumber(h.daily_pnl_percent ?? h.dailyPct);
                  const sparkArr = Array.isArray(h.sparkline) && h.sparkline.length > 1 ? h.sparkline : null;
                  const lp = h.current_price ?? h.lastPrice;
                  const changePct = sparkArr ? safeDivide(lp - sparkArr[0], sparkArr[0]) * 100 : 0;
                  const changeAmt = sparkArr ? safeNumber(lp) - safeNumber(sparkArr[0]) : 0;
                  const isExpanded = expandedId === h.id;

                  // Calculate heatmap style based on selected mode (only if enabled)
                  const heatmapStyle = heatmapEnabled ? calculateHeatmapStyle(h, heatmapMode, {
                    portfolioTotal: convertedPortfolioTotal,
                    accountTotal: safeNumber(accountTotals[h.account_id ?? h.accountId]),
                    visibleHoldings: filteredCurrent,
                    theme: theme || 'default',
                    accentColor: palette?.accent || '#3B82F6',
                    allRealizedHoldings: [...filteredCurrent, ...filteredRealized],
                  }) : { bgStyle: {}, label: '' };

                  const rows = [
                    <tr
                      key={h.id}
                      style={heatmapEnabled ? heatmapStyle.bgStyle : {}}
                      className={cn(
                        'row-hover border-b border-border/50',
                        isExpanded && 'bg-secondary/20'
                      )}
                      title={heatmapStyle.label}
                      onClick={() => setExpandedId(isExpanded ? null : h.id)}
                    >
                      {visibleColumns.map(colId => (
                        <td key={`${h.id}-${colId}`} className="px-2 sm:px-3 py-1.5 sm:py-2">
                          {renderColumnValue(h, colId, acc, inst, nativeCurrency, convertedMarketValue, convertedAcctTotal, unrealizedAmt, unrealizedPct, dailyPct, sparkArr, lp, changePct, changeAmt)}
                        </td>
                      ))}
                    </tr>
                  ];
                  if (isExpanded) {
                    rows.push(<HoldingDetailRow key={`detail-${h.id}`} holding={h} />);
                  }

                  // Add nested realized rows for this active holding
                  const nestedRealized = realizedByActive[h.id] || [];
                  nestedRealized.forEach(r => {
                    const rAcc = getAccount(r.account_id);
                    const rInst = getInstitutionForAccount(r.account_id);
                    const rNativeCurrency = r.currency || 'USD';
                    const rAccType = rAcc?.account_type ?? rAcc?.type;

                    // For realized-only heatmap modes, calculate style
                    const realizHeatmapStyle = heatmapEnabled && ['Realized Gain/Loss Amount', 'Realized Gain/Loss %', 'Realized Gain Contribution %', 'Total P&L Amount', 'Total P&L %'].includes(heatmapMode) 
                      ? calculateHeatmapStyle(r, heatmapMode, {
                          portfolioTotal: convertedPortfolioTotal,
                          accountTotal: safeNumber(accountTotals[r.account_id]),
                          visibleHoldings: filteredCurrent,
                          theme: theme || 'default',
                          accentColor: palette?.accent || '#3B82F6',
                          allRealizedHoldings: [...filteredCurrent, ...filteredRealized],
                        })
                      : { bgStyle: {}, label: '' };

                    rows.push(
                      <tr
                        key={r.id}
                        style={heatmapStyle.bgStyle}
                        className="border-b border-border/30 opacity-70 hover:opacity-90 transition-opacity bg-secondary/5"
                      >
                        {visibleColumns.map(colId => (
                          <td key={`${r.id}-${colId}`} className="px-2 sm:px-3 py-1.5 sm:py-2 pl-6 sm:pl-8 text-muted-foreground text-xs">
                            {colId === 'ticker' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold">{r.ticker}</span>
                                <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">Realized</span>
                              </div>
                            ) : colId === 'company' ? (
                              <span className="truncate max-w-[200px]">{r.name}</span>
                            ) : colId === 'realizedGain' ? (
                              <PnlValue value={r.realized_gain_loss_amount} className="text-xs" />
                            ) : colId === 'marketValue' || colId === 'nativeMarketValue' ? (
                              <span className="font-mono tabular-nums text-right">{privacyMode ? PM : formatCurrency(r.total_sale_value)}</span>
                            ) : colId === 'costBasis' ? (
                              <span className="font-mono tabular-nums text-right">{privacyMode ? PM : formatCurrency(r.total_cost_basis)}</span>
                            ) : colId === 'avgPrice' ? (
                              <span className="font-mono tabular-nums text-right">{privacyMode ? PM : safeNumber(r.average_buy_price).toFixed(2)}</span>
                            ) : colId === 'quantity' ? (
                              <span className="font-mono tabular-nums text-right">{r.quantity}</span>
                            ) : colId === 'account' || colId === 'accountType' ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">{rAccType}</span>
                            ) : colId === 'institution' ? (
                              <span>{rInst?.name}</span>
                            ) : colId === 'assetClass' ? (
                              <span>{r.asset_class}</span>
                            ) : colId === 'sector' ? (
                              <span>{r.sector}</span>
                            ) : colId === 'currency' ? (
                              <span className="font-mono">{rNativeCurrency}</span>
                            ) : colId === 'unrealizedGainPct' ? (
                              <PnlValue value={r.realized_gain_loss_percent} isCurrency={false} className="text-xs" />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  });

                  return rows;
                })}

                {/* Unmatched realized positions at bottom */}
                {showRealized && realizedUnmatched.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-2 text-left text-xs font-semibold uppercase text-muted-foreground border-t border-border/50 bg-secondary/10">
                        Closed Positions
                      </td>
                    </tr>
                    {realizedUnmatched.map(r => {
                      const acc = getAccount(r.account_id);
                      const inst = getInstitutionForAccount(r.account_id);
                      const nativeCurrency = r.currency || 'USD';
                      const acctType = acc?.account_type ?? acc?.type;

                      // For realized-only heatmap modes, calculate style
                      const realizHeatmapStyle = heatmapEnabled && ['Realized Gain/Loss Amount', 'Realized Gain/Loss %', 'Realized Gain Contribution %', 'Total P&L Amount', 'Total P&L %'].includes(heatmapMode) 
                        ? calculateHeatmapStyle(r, heatmapMode, {
                            portfolioTotal: convertedPortfolioTotal,
                            accountTotal: safeNumber(accountTotals[r.account_id]),
                            visibleHoldings: filteredCurrent,
                            theme: theme || 'default',
                            accentColor: palette?.accent || '#3B82F6',
                            allRealizedHoldings: [...filteredCurrent, ...filteredRealized],
                          })
                        : { bgStyle: {}, label: '' };

                      return (
                        <tr key={r.id} style={realizHeatmapStyle.bgStyle} className="border-b border-border/30 opacity-70 hover:opacity-90 transition-opacity bg-secondary/5">
                          {visibleColumns.map(colId => (
                            <td key={`${r.id}-${colId}`} className="px-2 sm:px-3 py-1.5 sm:py-2 text-muted-foreground text-xs">
                              {colId === 'ticker' ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold">{r.ticker}</span>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">Realized</span>
                                </div>
                              ) : colId === 'company' ? (
                                <span className="truncate max-w-[200px]">{r.name}</span>
                              ) : colId === 'realizedGain' ? (
                                <PnlValue value={r.realized_gain_loss_amount} className="text-xs" />
                              ) : colId === 'marketValue' || colId === 'nativeMarketValue' ? (
                                <span className="font-mono tabular-nums text-right">{privacyMode ? PM : formatCurrency(r.total_sale_value)}</span>
                              ) : colId === 'costBasis' ? (
                                <span className="font-mono tabular-nums text-right">{privacyMode ? PM : formatCurrency(r.total_cost_basis)}</span>
                              ) : colId === 'avgPrice' ? (
                                <span className="font-mono tabular-nums text-right">{privacyMode ? PM : safeNumber(r.average_buy_price).toFixed(2)}</span>
                              ) : colId === 'quantity' ? (
                                <span className="font-mono tabular-nums text-right">{r.quantity}</span>
                              ) : colId === 'account' || colId === 'accountType' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">{acctType}</span>
                              ) : colId === 'institution' ? (
                                <span>{inst?.name}</span>
                              ) : colId === 'assetClass' ? (
                                <span>{r.asset_class}</span>
                              ) : colId === 'sector' ? (
                                <span>{r.sector}</span>
                              ) : colId === 'currency' ? (
                                <span className="font-mono">{nativeCurrency}</span>
                              ) : colId === 'unrealizedGainPct' ? (
                                <PnlValue value={r.realized_gain_loss_percent} isCurrency={false} className="text-xs" />
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </>
                )}

                {showRealized && filteredCurrent.length > 0 && realizedByActive && Object.keys(realizedByActive).length === 0 && realizedUnmatched.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-3 text-center text-xs text-muted-foreground/60 border-t border-border/30 italic">
                      No realized positions for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Heatmap & Column Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Heatmap Toggle */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemedSwitch
            id="heatmap-toggle"
            checked={heatmapEnabled}
            onCheckedChange={handleHeatmapToggle}
            className="scale-75 sm:scale-90"
          />
          <label htmlFor="heatmap-toggle" className="text-[10px] sm:text-xs text-muted-foreground cursor-pointer select-none">
            Heatmap
          </label>
        </div>

        {/* Heatmap Mode Selector */}
        <HeatmapModeSelector activeMode={heatmapMode} onModeChange={handleHeatmapModeChange} />

        {/* Column Customize Button */}
        <div title="Customize Columns">
          <button
            onClick={() => setShowColumnModal(true)}
            className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <Columns3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Portfolio Breakdown */}
      <PortfolioBreakdown />

      {/* Column Customize Modal */}
      {showColumnModal && (
        <ColumnCustomizeModal
          visibleColumns={visibleColumns}
          onClose={() => setShowColumnModal(false)}
          onSave={handleColumnsChange}
        />
      )}
    </div>
  );
}