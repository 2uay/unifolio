import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, ChevronDown, ChevronUp, ArrowUpDown, Info, Columns3, Maximize2, Minimize2, PanelTopOpen, X, Download } from 'lucide-react';
import { exportFilteredHoldingsCSV } from '@/lib/exportEngine';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ThemedSwitch from '@/components/ui/switch-themed';
import { Button } from '@/components/ui/button';
import { formatCurrency, PnlValue, MiniSparkline } from '@/components/shared/ValueDisplay';
import { safeNumber, safeDivide } from '@/lib/safeNum';
import PageHeader from '@/components/shared/PageHeader';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useTheme } from '@/lib/ThemeContext';
import HoldingDetailRow from '@/components/holdings/HoldingDetailRow';
import DateRangeFilter from '@/components/holdings/DateRangeFilter';
import { filterRealizedByDateRange } from '@/lib/realizedPositions';
import { getSavedColumnOrder, saveColumnOrder, loadColumnOrderFromSupabase, COLUMN_DEFINITIONS } from '@/lib/columnConfig';
import { supabase } from '@/lib/supabaseClient';
import { stackHoldings } from '@/lib/stackingEngine';
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
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';

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

function formatMMDDYYYY(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function buildRealizedTickerGroups(rows) {
  const groups = {};
  rows.forEach(row => {
    const ticker = row.ticker?.toUpperCase();
    if (!ticker) return;
    if (!groups[ticker]) {
      groups[ticker] = {
        ...row,
        id: `realized-stack-${ticker}`,
        ticker,
        name: row.name || row.asset_name || ticker,
        quantity: 0,
        total_cost_basis: 0,
        total_sale_value: 0,
        realized_gain_loss_amount: 0,
        _realizedInstances: [],
        _isRealizedStack: true,
      };
    }
    const group = groups[ticker];
    group._realizedInstances.push(row);
    group.quantity += safeNumber(row.quantity);
    group.total_cost_basis += safeNumber(row.total_cost_basis);
    group.total_sale_value += safeNumber(row.total_sale_value);
    group.realized_gain_loss_amount += safeNumber(row.realized_gain_loss_amount);
    group.realizedGain = group.realized_gain_loss_amount;
    group.currency = group.currency || row.currency || 'USD';
    group.asset_class = group.asset_class || row.asset_class || row.assetClass || 'Stock';
    group.sector = group.sector || row.sector || 'Unknown';
  });

  return Object.values(groups).map(group => {
    const dates = group._realizedInstances
      .map(row => row.close_date)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b));
    const latest = dates[dates.length - 1] || null;
    const earliest = dates[0] || null;
    return {
      ...group,
      close_date: latest,
      open_date: earliest,
      realized_gain_loss_percent: safeDivide(group.realized_gain_loss_amount, group.total_cost_basis) * 100,
      _dateLabel: dates.length > 1 ? `${formatMMDDYYYY(earliest)} - ${formatMMDDYYYY(latest)}` : formatMMDDYYYY(latest),
      _instanceCount: group._realizedInstances.length,
      _realizedInstances: group._realizedInstances.sort((a, b) => new Date(b.close_date) - new Date(a.close_date)),
    };
  }).sort((a, b) => new Date(b.close_date) - new Date(a.close_date));
}

export default function Holdings() {
  const [accountFilter, setAccountFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [assetClassFilter, setAssetClassFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [sortField, setSortField] = useState('marketValue');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedChildId, setExpandedChildId] = useState(null);
  const [showRealized, setShowRealized] = useState(false);
  const [closedOpen, setClosedOpen] = useState(true);
  const [expandedRealizedTicker, setExpandedRealizedTicker] = useState(null);
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
  const [previewMode, setPreviewMode] = useState(null);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [stackAssets, setStackAssets] = useState(() => {
    return localStorage.getItem('unifolio_stack_assets') === 'true';
  });
  const [extractedOpen, setExtractedOpen] = useState(false);
  const [extractedFullscreen, setExtractedFullscreen] = useState(false);
  const extractedPanelRef = useRef(null);
  const rouletteRan = useRef(false);

  const { convert, displayCurrency, bothMode, secondaryCurrency, convertSecondary } = useCurrency();
  const { privacyMode } = usePrivacy();
  const { theme } = useTheme();
  const { palette } = useSecondaryColors();
  const { registerTicker, liveHoldings } = useLiveData();
  const { isStar, toggleStar } = useStarredStocks();
  const {
    holdings,
    accounts,
    institutions,
    accountTypes,
    realizedPositions,
    isEmptyPortfolio,
    getAccount,
    getInstitutionForAccount,
    calcPortfolioTotals,
    calcAccountValue,
  } = usePortfolioData();
  const PM = '••••••'; // privacy mask shorthand
  const totals = calcPortfolioTotals();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setExtractedFullscreen(document.fullscreenElement === extractedPanelRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Heatmap roulette: cycle through all modes on first mount, land on Portfolio Weight
  useEffect(() => {
    if (rouletteRan.current) return;
    rouletteRan.current = true;
    const modes = Object.values(HEATMAP_MODES);
    const totalSteps = modes.length * 2;
    const MAX_MS = 115;
    let step = 0;
    let timer;
    const spin = () => {
      step++;
      setHeatmapMode(modes[step % modes.length]);
      const t = step / totalSteps;
      const delay = 38 + t * t * 300;
      // Once we've shown every mode at least once and it's getting slow, snap to target
      if (step >= modes.length && delay >= MAX_MS) {
        setHeatmapMode(HEATMAP_MODES.PORTFOLIO_WEIGHT);
        return;
      }
      timer = setTimeout(spin, Math.min(delay, MAX_MS));
    };
    timer = setTimeout(spin, 280);
    return () => clearTimeout(timer);
  }, []);

  // Register tickers for live updates
  useEffect(() => {
    holdings.filter(h => h.quantity > 0).forEach(h => {
      registerTicker(h.ticker, h.asset_class ?? h.assetClass ?? 'stock');
    });
  }, [registerTicker]);

  // Load column order from Supabase when auth state is available
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;
      const cols = await loadColumnOrderFromSupabase(session.user.id);
      if (cols) {
        setVisibleColumns(cols);
        saveColumnOrder(cols);
      }
    });
    return () => subscription.unsubscribe();
  }, []);



  const handleHeatmapToggle = (enabled) => {
    setHeatmapEnabled(enabled);
    localStorage.setItem('holdings_heatmap_enabled', String(enabled));
  };

  const handleHeatmapModeChange = (newMode) => {
    setHeatmapMode(newMode);
    setPreviewMode(null);
    localStorage.setItem('holdings_heatmap_mode', newMode);
  };

  const handleColumnsChange = (newColumns) => {
    setVisibleColumns(newColumns);
  };

  const handleStackToggle = (val) => {
    setStackAssets(val);
    localStorage.setItem('unifolio_stack_assets', String(val));
  };

  const toggleExtractedFullscreen = async () => {
    const panel = extractedPanelRef.current;
    if (!panel) return;
    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      } else if (panel.requestFullscreen) {
        await panel.requestFullscreen();
      } else {
        setExtractedFullscreen(value => !value);
      }
    } catch {
      setExtractedFullscreen(value => !value);
    }
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
      const liveData = liveHoldings[ticker];
      const livePrice = liveData?.price;
      
      if (!livePrice) return holding;

      const quantity = safeNumber(holding.quantity ?? holding.position ?? 0);
      const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? livePrice);
      const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? (quantity * avgPrice));
      const oldPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);

      // Recalculate dependent values
      const newMarketValue = quantity * livePrice;
      const newUnrealizedGainLoss = newMarketValue - costBasis;
      const newUnrealizedGainLossPercent = safeDivide(newUnrealizedGainLoss, costBasis) * 100;
      const previousClose = safeNumber(liveData?.previousClose ?? liveData?.previous_close, oldPrice);
      const priceChange = livePrice - previousClose;
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
        sparkline: liveData?.sparkline || holding.sparkline,
        price_source: liveData?.priceSource ?? holding.price_source,
        valuation_status: liveData?.valuationStatus ?? holding.valuation_status,
      };
    });
  }, [baseHoldings, liveHoldings]);

  // ── Realized positions ────────────────────────────────────────
  // Filtered by date range AND the same 4 dropdowns as active holdings.
  const filteredRealized = useMemo(() => {
    if (!showRealized) return [];
    return filterRealizedByDateRange(realizedPositions, dateFilter.start, dateFilter.end)
      .filter(r => {
        const acc = getAccount(r.account_id);
        if (accountFilter !== 'all' && (acc?.account_type ?? acc?.type) !== accountFilter) return false;
        if (institutionFilter !== 'all' && (acc?.institution_id ?? acc?.institutionId) !== institutionFilter) return false;
        if (assetClassFilter !== 'all' && (r.asset_class ?? r.assetClass) !== assetClassFilter) return false;
        if (currencyFilter !== 'all' && r.currency !== currencyFilter) return false;
        return true;
      });
  }, [showRealized, dateFilter, realizedPositions, accountFilter, institutionFilter, assetClassFilter, currencyFilter, getAccount]);

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
    return enrichHoldingsForHeatmap(liveUpdatedBaseHoldings, null, {
      portfolioTotal: convertedPortfolioTotal,
      accountTotals,
      totalAbsoluteRealizedPnl,
    });
  }, [liveUpdatedBaseHoldings, convertedPortfolioTotal, accountTotals, totalAbsoluteRealizedPnl]);

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
        case 'ticker': aVal = a.ticker ?? ''; bVal = b.ticker ?? ''; break;
        case 'company': aVal = a.name ?? ''; bVal = b.name ?? ''; break;
        case 'price': case 'lastPrice': aVal = safeNumber(a.lastPrice); bVal = safeNumber(b.lastPrice); break;
        case 'quantity': case 'position': aVal = safeNumber(a.position); bVal = safeNumber(b.position); break;
        case 'marketValue': aVal = safeNumber(a.lastPrice) * safeNumber(a.position); bVal = safeNumber(b.lastPrice) * safeNumber(b.position); break;
        case 'nativeMarketValue': aVal = safeNumber(a.market_value ?? a.marketValue); bVal = safeNumber(b.market_value ?? b.marketValue); break;
        case 'avgPrice': aVal = safeNumber(a.average_price ?? a.avgPrice); bVal = safeNumber(b.average_price ?? b.avgPrice); break;
        case 'costBasis': aVal = safeNumber(a.average_price ?? a.avgPrice) * safeNumber(a.position); bVal = safeNumber(b.average_price ?? b.avgPrice) * safeNumber(b.position); break;
        case 'dailyPnl': aVal = safeNumber(a.dailyPnl); bVal = safeNumber(b.dailyPnl); break;
        case 'dailyPnlPct': aVal = safeNumber(a.daily_pnl_percent ?? a.dailyPct); bVal = safeNumber(b.daily_pnl_percent ?? b.dailyPct); break;
        case 'unrealizedGain': case 'unrealized': aVal = safeNumber(a.unrealized_gain_loss_amount ?? a.unrealizedAmt); bVal = safeNumber(b.unrealized_gain_loss_amount ?? b.unrealizedAmt); break;
        case 'unrealizedGainPct': aVal = safeNumber(a.unrealized_gain_loss_percent ?? a.unrealizedPct); bVal = safeNumber(b.unrealized_gain_loss_percent ?? b.unrealizedPct); break;
        case 'realizedGain': aVal = safeNumber(a.realized_gain_loss_amount); bVal = safeNumber(b.realized_gain_loss_amount); break;
        case 'realizedGainContrib': aVal = safeNumber(a._realizedGainContribution); bVal = safeNumber(b._realizedGainContribution); break;
        case 'pctPortfolio': aVal = safeNumber(a._portfolioWeight); bVal = safeNumber(b._portfolioWeight); break;
        case 'pctAccount': aVal = safeNumber(a._accountWeight); bVal = safeNumber(b._accountWeight); break;
        case 'currency': aVal = a.currency ?? ''; bVal = b.currency ?? ''; break;
        case 'assetClass': aVal = (a.asset_class ?? a.assetClass ?? ''); bVal = (b.asset_class ?? b.assetClass ?? ''); break;
        case 'sector': aVal = a.sector ?? ''; bVal = b.sector ?? ''; break;
        case 'country': aVal = a.country ?? ''; bVal = b.country ?? ''; break;
        case 'exchange': aVal = a.exchange ?? ''; bVal = b.exchange ?? ''; break;
        case 'institution': {
          const iA = getInstitutionForAccount(a.account_id ?? a.accountId);
          const iB = getInstitutionForAccount(b.account_id ?? b.accountId);
          aVal = iA?.name ?? ''; bVal = iB?.name ?? ''; break;
        }
        case 'account': case 'accountType': {
          const aAcc = getAccount(a.account_id ?? a.accountId);
          const bAcc = getAccount(b.account_id ?? b.accountId);
          aVal = aAcc?.account_type ?? ''; bVal = bAcc?.account_type ?? ''; break;
        }
        default: aVal = a.ticker ?? ''; bVal = b.ticker ?? '';
      }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? (aVal ?? 0) - (bVal ?? 0) : (bVal ?? 0) - (aVal ?? 0);
    });
  }, [enrichedForHeatmap, accountFilter, institutionFilter, assetClassFilter, currencyFilter, sortField, sortDir]);

  // Stack same-ticker holdings across accounts when toggle is on
  const displayHoldings = useMemo(() => {
    if (!stackAssets) return filteredCurrent;
    return stackHoldings(filteredCurrent, { getAccount, getInstitutionForAccount });
  }, [filteredCurrent, stackAssets]);

  const compressTable = visibleColumns.length >= 9;

  // Group realized positions: matched under active holdings, and unmatched at bottom
  const { realizedByActive, realizedUnmatched } = useMemo(() => {
   if (!showRealized || filteredRealized.length === 0) return { realizedByActive: {}, realizedUnmatched: [] };

   const byActive = {};
   const unmatched = [];

   filteredRealized.forEach(r => {
     const rTicker = r.ticker?.toUpperCase();
     const rAccount = r.account_id ?? r.accountId;

     // A realized position should only nest under an active holding that shares
     // the same account — prevents IBKR closed LLY from nesting under a
     // Wealthsimple active LLY that happens to share the same ticker string.
     const matchingActive = displayHoldings.find(h => {
       if (h.ticker?.toUpperCase() !== rTicker) return false;
       if (h._isStacked && h._stackedChildren) {
         return h._stackedChildren.some(c =>
           (c.account_id ?? c.accountId) === rAccount
         );
       }
       return (h.account_id ?? h.accountId) === rAccount;
     });

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
  }, [showRealized, filteredRealized, displayHoldings]);

  const realizedUnmatchedGroups = useMemo(() => buildRealizedTickerGroups(realizedUnmatched), [realizedUnmatched]);

  // Realized rows enriched with _realizedGainContribution for heatmap normalization.
  // Used as visibleHoldings when computing realized-row heatmap styles so intensity is
  // normalized against the realized set, not the active holdings set.
  const enrichedRealized = useMemo(() => {
    if (!filteredRealized.length) return filteredRealized;
    return filteredRealized.map(r => ({
      ...r,
      _realizedGainContribution: totalAbsoluteRealizedPnl > 0
        ? (safeNumber(r.realized_gain_loss_amount) / totalAbsoluteRealizedPnl) * 100
        : 0,
    }));
  }, [filteredRealized, totalAbsoluteRealizedPnl]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const TwoLineValue = ({ primary, secondary, secCurrency }) => (
    <span className="flex flex-col items-end leading-tight">
      <span className="font-mono tabular-nums">{primary}</span>
      <span className="font-mono tabular-nums text-[9px] text-muted-foreground/60">{secondary} <span className="opacity-60">{secCurrency}</span></span>
    </span>
  );

  const getValuationTitle = (holding) => {
    const source = holding.price_source || 'unknown';
    const status = holding.valuation_status || 'unknown';
    const labels = {
      yahoo: 'Yahoo chart close',
      finnhub: 'Finnhub quote',
      broker: 'Broker import mark',
      unavailable: 'Price unavailable',
    };
    const statusLabels = {
      live: 'validated live quote',
      market_closed_close: 'latest trusted close',
      quote_mismatch: 'quote mismatch, using chart close',
      quote_stale: 'stale quote, using broker mark',
      broker_fallback: 'API unavailable, using broker mark',
      unavailable: 'no usable price found',
    };
    return `${labels[source] || source} · ${statusLabels[status] || status}`;
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
      case 'price': {
        const pPrimary = convert(safeNumber(lp), nativeCurrency);
        if (bothMode) {
          const pSecondary = convertSecondary(safeNumber(lp), nativeCurrency);
          return <span title={getValuationTitle(h)}><TwoLineValue primary={pPrimary.toFixed(2)} secondary={pSecondary.toFixed(2)} secCurrency={secondaryCurrency} /></span>;
        }
        return <span className="text-right font-mono tabular-nums" title={getValuationTitle(h)}>{pPrimary.toFixed(2)}</span>;
      }
      case 'quantity':
        return <span className="text-right font-mono tabular-nums">{h.position}</span>;
      case 'pctPortfolio':
        return <span className="text-right font-mono tabular-nums text-muted-foreground">{privacyMode ? '••••' : pctOfNav.toFixed(2) + '%'}</span>;
      case 'pctAccount':
        return <span className="text-right font-mono tabular-nums text-blue-400">{privacyMode ? '••••' : (h.position > 0 ? pctOfAcct.toFixed(2) + '%' : '—')}</span>;
      case 'avgPrice': {
        const rawAvg = safeNumber(h.average_price ?? h.avgPrice);
        if (privacyMode) return <span className="text-right font-mono tabular-nums">{PM}</span>;
        if (rawAvg <= 0) return <span className="text-right font-mono tabular-nums">—</span>;
        const aPrimary = convert(rawAvg, nativeCurrency);
        if (bothMode) {
          const aSecondary = convertSecondary(rawAvg, nativeCurrency);
          return <TwoLineValue primary={aPrimary.toFixed(2)} secondary={aSecondary.toFixed(2)} secCurrency={secondaryCurrency} />;
        }
        return <span className="text-right font-mono tabular-nums">{aPrimary.toFixed(2)}</span>;
      }
      case 'realizedGain': {
        const rVal = convert(safeNumber(h.realized_gain_loss_amount ?? h.realizedGain), nativeCurrency);
        if (bothMode) {
          const rSec = convertSecondary(safeNumber(h.realized_gain_loss_amount ?? h.realizedGain), nativeCurrency);
          return <span className="flex flex-col items-end leading-tight"><PnlValue value={rVal} className="text-xs" /><PnlValue value={rSec} className="text-[9px] opacity-60" /></span>;
        }
        return <PnlValue value={rVal} className="text-xs" />;
      }
      case 'realizedGainContrib':
        return <PnlValue value={h._realizedGainContribution ?? 0} isCurrency={false} className="text-xs" />;
      case 'unrealizedGainPct':
        return <PnlValue value={unrealizedPct} isCurrency={false} className="text-xs" />;
      case 'unrealizedGain': {
        const uVal = convert(unrealizedAmt, nativeCurrency);
        if (bothMode) {
          const uSec = convertSecondary(unrealizedAmt, nativeCurrency);
          return <span className="flex flex-col items-end leading-tight"><PnlValue value={uVal} className="text-xs" /><PnlValue value={uSec} className="text-[9px] opacity-60" /></span>;
        }
        return <PnlValue value={uVal} className="text-xs" />;
      }
      case 'dailyPnl': {
        const dVal = convert(safeNumber(h.daily_pnl_amount ?? h.dailyPnl), nativeCurrency);
        if (bothMode) {
          const dSec = convertSecondary(safeNumber(h.daily_pnl_amount ?? h.dailyPnl), nativeCurrency);
          return <span className="flex flex-col items-end leading-tight"><PnlValue value={dVal} className="text-xs" /><PnlValue value={dSec} className="text-[9px] opacity-60" /></span>;
        }
        return <PnlValue value={dVal} className="text-xs" />;
      }
      case 'dailyPnlPct':
        return <PnlValue value={dailyPct} isCurrency={false} className="text-xs" />;
      case 'account':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border/40 text-foreground/70 font-medium whitespace-nowrap">{h._isStacked ? h._accountLabel : acctType}</span>;
      case 'institution':
        return <span className="text-xs text-muted-foreground whitespace-nowrap">{h._isStacked ? h._institutionLabel : inst?.name}</span>;
      case 'accountType':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border/40 text-foreground/70 font-medium whitespace-nowrap">{h._isStacked ? h._accountLabel : acctType}</span>;
      case 'marketValue': {
        if (privacyMode) return <span className="text-right font-mono tabular-nums">{PM}</span>;
        if (bothMode) {
          const mSec = convertSecondary(safeNumber(h.market_value ?? h.marketValue), nativeCurrency);
          return <TwoLineValue primary={formatCurrency(convertedMarketValue)} secondary={formatCurrency(mSec)} secCurrency={secondaryCurrency} />;
        }
        return <span className="text-right font-mono tabular-nums">{formatCurrency(convertedMarketValue)}</span>;
      }
      case 'nativeMarketValue':
        return <span className="text-right font-mono tabular-nums">{privacyMode ? PM : formatCurrency(safeNumber(h.market_value ?? h.marketValue))}</span>;
      case 'costBasis': {
        const rawCost = safeNumber(h.cost_basis ?? h.costBasis);
        if (privacyMode) return <span className="text-right font-mono tabular-nums">{PM}</span>;
        const cPrimary = convert(rawCost, nativeCurrency);
        if (bothMode) {
          const cSec = convertSecondary(rawCost, nativeCurrency);
          return <TwoLineValue primary={formatCurrency(cPrimary)} secondary={formatCurrency(cSec)} secCurrency={secondaryCurrency} />;
        }
        return <span className="text-right font-mono tabular-nums">{formatCurrency(cPrimary)}</span>;
      }
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
      className={cn(compressTable ? 'px-1.5 py-1' : 'px-3 py-2.5', 'text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap', className)}
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
    if (displayHoldings.length === 0) return 50;
    let max = 0;
    displayHoldings.forEach(h => {
      const marketValue = safeNumber(h.market_value ?? h.marketValue);
      const convertedValue = convert(marketValue, h.currency || 'USD');
      const pct = safeDivide(convertedValue, convertedPortfolioTotal) * 100;
      if (pct > max) max = pct;
    });
    return Math.max(max, 5); // Minimum 5% for scaling
  }, [displayHoldings, convertedPortfolioTotal, convert]);

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader title="Holdings" description="All positions across accounts and institutions" />
        <EmptyPortfolioState />
      </div>
    );
  }

  const holdingsWorkspace = (
    <div className="space-y-4">
      <PageHeader 
        title="Holdings" 
        description="All positions across accounts and institutions"
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SimulatedLiveLabel />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[10px]"
              onClick={() => exportFilteredHoldingsCSV(displayHoldings)}
              title="Export current view as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[10px]"
              onClick={() => setExtractedOpen(true)}
              disabled={extractedOpen}
            >
              <PanelTopOpen className="h-3.5 w-3.5" />
              {extractedOpen ? 'Extracted' : 'Extract'}
            </Button>
          </div>
        )}
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

      {/* Realized + Stack toggles */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
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
        <div className="flex items-center gap-2">
          <ThemedSwitch
            id="stack-assets"
            checked={stackAssets}
            onCheckedChange={handleStackToggle}
            className="scale-90"
          />
          <label htmlFor="stack-assets" className="text-xs text-muted-foreground cursor-pointer select-none">
            Stack Assets
          </label>
        </div>
      </div>

      {/* Position count */}
      <div className="flex items-center justify-between">
        {stackAssets && (
          <span className="text-[10px] text-amber-400/80 italic">Stacked by ticker</span>
        )}
        <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">
          {displayHoldings.length} active{showRealized && (Object.keys(realizedByActive).length > 0 || realizedUnmatched.length > 0) ? ` · ${(Object.values(realizedByActive).flat() || []).length + realizedUnmatched.length} realized` : ''}
        </span>
      </div>

      {displayHoldings.length === 0 && filteredRealized.length === 0 ? (
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
                    const isSortable = colId !== 'trend';
                    const headerClass = ['price', 'quantity', 'pctPortfolio', 'pctAccount', 'avgPrice', 'realizedGain', 'realizedGainContrib', 'unrealizedGainPct', 'unrealizedGain', 'dailyPnl', 'dailyPnlPct', 'marketValue', 'nativeMarketValue', 'costBasis'].includes(colId) ? 'text-right' : 'text-left';
                    const colLabel = compressTable ? (col.shortLabel ?? col.label) : col.label;
                    return isSortable ? (
                      <SortHeader key={colId} field={colId} className={headerClass}>{colLabel}</SortHeader>
                    ) : (
                      <th key={colId} className={`${compressTable ? 'px-1.5 py-1' : 'px-2 sm:px-3 py-1.5 sm:py-2.5'} text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${headerClass}`}>
                        {colLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Active holdings + nested realized positions */}
                {displayHoldings.flatMap(h => {
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
                  const heatmapStyle = heatmapEnabled ? calculateHeatmapStyle(h, previewMode ?? heatmapMode, {
                    portfolioTotal: convertedPortfolioTotal,
                    accountTotal: safeNumber(accountTotals[h.account_id ?? h.accountId]),
                    visibleHoldings: displayHoldings,
                    theme: theme || 'default',
                    accentColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                    allRealizedHoldings: [...displayHoldings, ...filteredRealized],
                  }) : { bgStyle: {}, label: '' };

                  const rows = [
                    <tr
                      key={h.id}
                      style={heatmapEnabled ? heatmapStyle.bgStyle : {}}
                      className={cn(
                        'row-hover border-b border-border/50',
                        isExpanded && 'bg-secondary/20',
                        h._isStacked && 'border-l-2 border-l-amber-400/50',
                      )}
                      title={heatmapStyle.label}
                      onClick={() => { setExpandedChildId(null); setExpandedId(isExpanded ? null : h.id); }}
                    >
                      {visibleColumns.map(colId => (
                        <td key={`${h.id}-${colId}`} className={compressTable ? 'px-1.5 py-1' : 'px-2 sm:px-3 py-1.5 sm:py-2'}>
                          {renderColumnValue(h, colId, acc, inst, nativeCurrency, convertedMarketValue, convertedAcctTotal, unrealizedAmt, unrealizedPct, dailyPct, sparkArr, lp, changePct, changeAmt)}
                        </td>
                      ))}
                    </tr>
                  ];
                  if (isExpanded && h._isStacked) {
                    // Stacked row expansion: show account-level breakdown
                    const stackedMarketValue = safeNumber(h.market_value ?? h.marketValue);
                    h._stackedChildren.forEach((child, childIdx) => {
                      const childAcc = getAccount(child.account_id ?? child.accountId);
                      const childInst = getInstitutionForAccount(child.account_id ?? child.accountId);
                      const childAccType = childAcc?.account_type ?? childAcc?.type ?? '—';
                      const childCurrency = child.currency || 'USD';
                      const childMarketValue = convert(safeNumber(child.market_value ?? child.marketValue), childCurrency);
                      const childUnrealized = safeNumber(child.unrealized_gain_loss_amount ?? child.unrealizedAmt);
                      const childDailyPnl = safeNumber(child.daily_pnl_amount ?? child.dailyPnl);
                      const childQty = safeNumber(child.quantity ?? child.position);
                      const childAvgPrice = safeNumber(child.average_price ?? child.avgPrice);
                      const childPctOfStack = stackedMarketValue > 0
                        ? safeDivide(safeNumber(child.market_value ?? child.marketValue), stackedMarketValue) * 100
                        : 0;
                      const isLastChild = childIdx === h._stackedChildren.length - 1;

                      const isChildExpanded = expandedChildId === child.id;
                      rows.push(
                        <tr
                          key={`stack-child-${child.id}`}
                          className={cn(
                            'cursor-pointer transition-colors border-l-2 border-l-amber-400/25',
                            isChildExpanded ? 'bg-secondary/20' : 'bg-secondary/10 hover:bg-secondary/20',
                            isLastChild && !isChildExpanded ? 'border-b-2 border-b-border/30' : 'border-b border-border/20'
                          )}
                          onClick={() => setExpandedChildId(isChildExpanded ? null : child.id)}
                        >
                          <td colSpan={visibleColumns.length} className="px-3 py-2">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 text-xs text-muted-foreground items-center">
                              <span className="text-muted-foreground/50 mr-1">↳</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border/40 text-foreground/70 font-medium">{childAccType}</span>
                              <span className="font-medium text-foreground/80">{childInst?.name ?? '—'}</span>
                              <span className="font-mono tabular-nums">{childQty} shares</span>
                              <span className="text-muted-foreground/60">avg {privacyMode ? PM : `$${childAvgPrice.toFixed(2)}`}</span>
                              <span className="font-mono tabular-nums">{privacyMode ? PM : formatCurrency(childMarketValue)}</span>
                              <PnlValue value={childDailyPnl} className="text-xs" />
                              <PnlValue value={childUnrealized} className="text-xs" />
                              <span className="text-muted-foreground/60 font-mono">{childPctOfStack.toFixed(1)}% of position</span>
                              <span className="ml-auto text-muted-foreground/40 text-[10px]">{isChildExpanded ? '▲ chart' : '▼ chart'}</span>
                            </div>
                          </td>
                        </tr>
                      );
                      if (isChildExpanded) {
                        rows.push(<HoldingDetailRow key={`child-detail-${child.id}`} holding={child} />);
                      }
                    });
                  } else if (isExpanded) {
                    rows.push(<HoldingDetailRow key={`detail-${h.id}`} holding={h} />);
                  }

                  // Add nested realized rows for this active holding
                  const nestedRealized = realizedByActive[h.id] || [];
                  const nestedRealizedGroups = buildRealizedTickerGroups(nestedRealized);
                  nestedRealizedGroups.forEach(r => {
                    const rAcc = getAccount(r.account_id);
                    const rInst = getInstitutionForAccount(r.account_id);
                    const rNativeCurrency = r.currency || 'USD';
                    const rAccType = rAcc?.account_type ?? rAcc?.type;
                    const isNestedRealizedExpanded = expandedRealizedTicker === `${h.id}:${r.ticker}`;

                    // Apply heatmap with the 'realized' alternate colorway, normalized against realized peers
                    const realizHeatmapStyle = heatmapEnabled
                      ? calculateHeatmapStyle(r, previewMode ?? heatmapMode, {
                          portfolioTotal: convertedPortfolioTotal,
                          accountTotal: safeNumber(accountTotals[r.account_id]),
                          visibleHoldings: enrichedRealized,
                          theme: theme || 'default',
                          accentColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                          allRealizedHoldings: filteredRealized,
                        }, 'realized')
                      : { bgStyle: {}, label: '' };

                    rows.push(
                      <tr
                        key={r.id}
                        style={realizHeatmapStyle.bgStyle}
                        className="border-b border-border/30 opacity-75 hover:opacity-95 transition-opacity bg-secondary/5 cursor-pointer"
                        onClick={() => setExpandedRealizedTicker(isNestedRealizedExpanded ? null : `${h.id}:${r.ticker}`)}
                        title={`${r._instanceCount} realized instance${r._instanceCount === 1 ? '' : 's'} · ${r._dateLabel}`}
                      >
                        {visibleColumns.map(colId => (
                          <td key={`${r.id}-${colId}`} className="px-2 sm:px-3 py-1.5 sm:py-2 pl-6 sm:pl-8 text-muted-foreground text-xs">
                            {colId === 'ticker' ? (
                              <div className="flex items-center gap-1.5">
                                <ChevronDown className={cn('w-3 h-3 transition-transform', !isNestedRealizedExpanded && '-rotate-90')} />
                                <span className="font-mono font-bold">{r.ticker}</span>
                                <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">x{r._instanceCount}</span>
                              </div>
                            ) : colId === 'company' ? (
                              <div className="truncate max-w-[220px]">
                                <span>{r.name}</span>
                                <span className="ml-2 font-mono text-[10px] text-muted-foreground/70">{r._dateLabel}</span>
                              </div>
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
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border/40 text-foreground/70 font-medium">{rAccType}</span>
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

                    if (isNestedRealizedExpanded) {
                      r._realizedInstances.forEach(instance => {
                        rows.push(
                          <tr key={`${r.id}-${instance.id}`} className="border-b border-border/20 bg-secondary/10">
                            <td colSpan={visibleColumns.length} className="px-5 py-2">
                              <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-[11px] text-muted-foreground">
                                <span><span className="text-muted-foreground/60">Closed</span> <span className="font-mono text-foreground/80">{formatMMDDYYYY(instance.close_date)}</span></span>
                                <span><span className="text-muted-foreground/60">Opened</span> <span className="font-mono">{formatMMDDYYYY(instance.open_date)}</span></span>
                                <span><span className="text-muted-foreground/60">Qty</span> <span className="font-mono">{safeNumber(instance.quantity).toFixed(4)}</span></span>
                                <span><span className="text-muted-foreground/60">Buy</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(safeNumber(instance.average_buy_price))}</span></span>
                                <span><span className="text-muted-foreground/60">Sell</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(safeNumber(instance.average_sell_price))}</span></span>
                                <span><span className="text-muted-foreground/60">Cost</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(safeNumber(instance.total_cost_basis))}</span></span>
                                <span><span className="text-muted-foreground/60">P&L</span> <PnlValue value={instance.realized_gain_loss_amount} className="text-[11px]" /></span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    }
                  });

                  return rows;
                })}

                {/* Unmatched realized positions at bottom */}
                {showRealized && realizedUnmatchedGroups.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-2 border-t border-border/50 bg-secondary/10">
                        <button
                          onClick={() => setClosedOpen(o => !o)}
                          className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', !closedOpen && '-rotate-90')} />
                          Closed Positions
                          <span className="text-[10px] font-normal normal-case text-muted-foreground/60">
                            ({realizedUnmatchedGroups.length} tickers · {realizedUnmatched.length} sales)
                          </span>
                        </button>
                      </td>
                    </tr>
                    {closedOpen && realizedUnmatchedGroups.flatMap(r => {
                      const acc = getAccount(r.account_id);
                      const inst = getInstitutionForAccount(r.account_id);
                      const nativeCurrency = r.currency || 'USD';
                      const acctType = acc?.account_type ?? acc?.type;
                      const isTickerExpanded = expandedRealizedTicker === r.ticker;

                      // Apply heatmap with the 'realized' alternate colorway, normalized against realized peers
                      const realizHeatmapStyle = heatmapEnabled
                        ? calculateHeatmapStyle(r, previewMode ?? heatmapMode, {
                            portfolioTotal: convertedPortfolioTotal,
                            accountTotal: safeNumber(accountTotals[r.account_id]),
                            visibleHoldings: enrichedRealized,
                            theme: theme || 'default',
                            accentColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                            allRealizedHoldings: filteredRealized,
                          }, 'realized')
                        : { bgStyle: {}, label: '' };

                      const rows = [
                        <tr
                          key={r.id}
                          style={realizHeatmapStyle.bgStyle}
                          className="border-b border-border/30 opacity-80 hover:opacity-100 transition-opacity bg-secondary/5 cursor-pointer"
                          onClick={() => setExpandedRealizedTicker(isTickerExpanded ? null : r.ticker)}
                          title={`${r._instanceCount} realized instance${r._instanceCount === 1 ? '' : 's'} · ${r._dateLabel}`}
                        >
                          {visibleColumns.map(colId => (
                            <td key={`${r.id}-${colId}`} className="px-2 sm:px-3 py-1.5 sm:py-2 text-muted-foreground text-xs">
                              {colId === 'ticker' ? (
                                <div className="flex items-center gap-1.5">
                                  <ChevronDown className={cn('w-3 h-3 transition-transform', !isTickerExpanded && '-rotate-90')} />
                                  <span className="font-mono font-bold">{r.ticker}</span>
                                  <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">x{r._instanceCount}</span>
                                </div>
                              ) : colId === 'company' ? (
                                <div className="truncate max-w-[220px]">
                                  <span>{r.name}</span>
                                  <span className="ml-2 font-mono text-[10px] text-muted-foreground/70">{r._dateLabel}</span>
                                </div>
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
                      ];

                      if (isTickerExpanded) {
                        r._realizedInstances.forEach(instance => {
                          rows.push(
                            <tr key={`${r.id}-${instance.id}`} className="border-b border-border/20 bg-secondary/10">
                              <td colSpan={visibleColumns.length} className="px-5 py-2">
                                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-[11px] text-muted-foreground">
                                  <span><span className="text-muted-foreground/60">Closed</span> <span className="font-mono text-foreground/80">{formatMMDDYYYY(instance.close_date)}</span></span>
                                  <span><span className="text-muted-foreground/60">Opened</span> <span className="font-mono">{formatMMDDYYYY(instance.open_date)}</span></span>
                                  <span><span className="text-muted-foreground/60">Qty</span> <span className="font-mono">{safeNumber(instance.quantity).toFixed(4)}</span></span>
                                  <span><span className="text-muted-foreground/60">Buy</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(safeNumber(instance.average_buy_price))}</span></span>
                                  <span><span className="text-muted-foreground/60">Sell</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(safeNumber(instance.average_sell_price))}</span></span>
                                  <span><span className="text-muted-foreground/60">Cost</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(safeNumber(instance.total_cost_basis))}</span></span>
                                  <span><span className="text-muted-foreground/60">P&L</span> <PnlValue value={instance.realized_gain_loss_amount} className="text-[11px]" /></span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      }

                      return rows;
                    })}
                  </>
                )}

                {showRealized && displayHoldings.length > 0 && realizedByActive && Object.keys(realizedByActive).length === 0 && realizedUnmatched.length === 0 && (
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
        <div className="flex items-center gap-1 sm:gap-2 rounded-lg border border-border/50 bg-card/70 px-2 py-1.5">
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

        {heatmapEnabled && (
          <HeatmapModeSelector
            activeMode={heatmapMode}
            onModeChange={handleHeatmapModeChange}
            onModePreview={(mode) => setPreviewMode(mode)}
            onPreviewEnd={() => setPreviewMode(null)}
          />
        )}

        <div title="Customize Columns">
          <button
            onClick={() => setShowColumnModal(true)}
            className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Customize columns"
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

  return (
    <>
      {!extractedOpen ? (
        holdingsWorkspace
      ) : (
        <div className="rounded-xl border border-primary/20 bg-card/70 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Holdings view extracted</p>
          <p className="mt-1 text-xs text-muted-foreground">Use the floating panel to work with filters, heatmap modes, sorting, and fullscreen.</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setExtractedOpen(false)}>
            Return to embedded view
          </Button>
        </div>
      )}

      {extractedOpen && (
        <div
          ref={extractedPanelRef}
          className={cn(
            'fixed inset-3 z-[60] flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl',
            extractedFullscreen && 'inset-0 rounded-none'
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Extracted Holdings</p>
              <p className="text-[10px] text-muted-foreground">Shared state with the main holdings view</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={toggleExtractedFullscreen}
              >
                {extractedFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {extractedFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExtractedOpen(false)}
                aria-label="Close extracted holdings view"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {holdingsWorkspace}
          </div>
        </div>
      )}
    </>
  );
}
