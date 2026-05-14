import React, { useState, useMemo, useEffect, useRef, Component } from 'react';

class RowErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(error, errorInfo) {
    // Surface the real cause to the browser console so we can debug
    // expanded-row failures without re-deploying instrumented builds.
    console.error('[HoldingDetailRow] crash:', error, errorInfo?.componentStack);
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <tr><td colSpan={100} className="p-3 text-xs text-muted-foreground bg-secondary/10 border-b border-border">
          <span className="text-destructive font-medium">Unable to load detail:</span>{' '}
          <span className="font-mono text-foreground/80">{msg}</span>{' '}
          <span className="text-muted-foreground/70">(open the browser console for the full stack trace)</span>
        </td></tr>
      );
    }
    return this.props.children;
  }
}
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, ArrowUpDown, Info, Columns3, X, Download, ExternalLink } from 'lucide-react';
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
import { getSavedColumnOrder, saveColumnOrder, saveColumnOrderToSupabase, loadColumnOrderFromSupabase, COLUMN_DEFINITIONS } from '@/lib/columnConfig';
import { supabase } from '@/lib/supabaseClient';
import { stackHoldings, stackCDRGroups } from '@/lib/stackingEngine';
import PortfolioBreakdown from '@/components/holdings/PortfolioBreakdown';
import HeatmapModeSelector from '@/components/holdings/HeatmapModeSelector';
import InstitutionLogo from '@/components/shared/InstitutionLogo';
import { HEATMAP_MODES } from '@/lib/heatmapModes.js';
import { calculateHeatmapStyle, enrichHoldingsForHeatmap } from '@/lib/heatmapColorEngine.js';
import ColumnCustomizeModal from '@/components/holdings/ColumnCustomizeModal';
import { useLiveData } from '@/lib/LiveDataContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { useFloatingHoldings } from '@/lib/FloatingHoldingsContext';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import SimulatedLiveLabel from '@/components/shared/SimulatedLiveLabel';
import TickerWithStar from '@/components/shared/TickerWithStar';
import { cn } from '@/lib/utils';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import DraggableTableHeader from '@/components/shared/DraggableTableHeader';

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

// Group realized rows by ticker. When `convert` + `displayCurrency` are passed
// (the normal Holdings-table path), every aggregated money value lands in the
// active display currency so that the table always reflects the currency
// selector. Per-instance native values are preserved on `_realizedInstances`
// for the expanded-row drill-down (the renderer converts those individually).
function buildRealizedTickerGroups(rows, { convert, displayCurrency } = {}) {
  const groups = {};
  const conv = typeof convert === 'function' ? convert : (v) => v;
  const groupCurrency = displayCurrency || null; // null => sums stay in native currency (legacy callers)

  rows.forEach(row => {
    const ticker = (row.security_key || row.securityKey || row.ticker)?.toUpperCase();
    if (!ticker) return;
    const rowCurrency = row.currency || 'USD';
    if (!groups[ticker]) {
      groups[ticker] = {
        ...row,
        id: `realized-stack-${ticker}`,
        ticker: row.ticker?.toUpperCase() || ticker,
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
    if (groupCurrency) {
      // Convert each instance into display currency before summing so the
      // stack total is coherent across multi-currency realized lots.
      group.total_cost_basis += conv(safeNumber(row.total_cost_basis), rowCurrency);
      group.total_sale_value += conv(safeNumber(row.total_sale_value), rowCurrency);
      group.realized_gain_loss_amount += conv(safeNumber(row.realized_gain_loss_amount), rowCurrency);
    } else {
      group.total_cost_basis += safeNumber(row.total_cost_basis);
      group.total_sale_value += safeNumber(row.total_sale_value);
      group.realized_gain_loss_amount += safeNumber(row.realized_gain_loss_amount);
    }
    group.realizedGain = group.realized_gain_loss_amount;
    // When sums are converted, the group's nominal currency is the display
    // currency (the renderer must NOT convert again). Otherwise track the
    // first row's native currency for legacy single-currency display.
    group.currency = groupCurrency || group.currency || rowCurrency;
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
    // Weighted average buy price in the same currency as the group totals.
    // When `convert` was supplied this is the display currency; otherwise it
    // matches the group's native currency. Falls back to the first instance's
    // raw value when quantity is zero (degenerate case — avoids NaN).
    const weightedAvgBuy = group.quantity > 0
      ? safeDivide(group.total_cost_basis, group.quantity)
      : safeNumber(group.average_buy_price);
    return {
      ...group,
      close_date: latest,
      open_date: earliest,
      average_buy_price: weightedAvgBuy,
      realized_gain_loss_percent: safeDivide(group.realized_gain_loss_amount, group.total_cost_basis) * 100,
      _dateLabel: dates.length > 1 ? `${formatMMDDYYYY(earliest)} - ${formatMMDDYYYY(latest)}` : formatMMDDYYYY(latest),
      _instanceCount: group._realizedInstances.length,
      _realizedInstances: group._realizedInstances.sort((a, b) => new Date(b.close_date) - new Date(a.close_date)),
      _isInDisplayCurrency: Boolean(groupCurrency),
    };
  }).sort((a, b) => new Date(b.close_date) - new Date(a.close_date));
}

export default function Holdings() {
  const [accountFilter, setAccountFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [assetClassFilter, setAssetClassFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [previewFilters, setPreviewFilters] = useState({});
  const [sortField, setSortField] = useState('marketValue');
  const [sortDir, setSortDir] = useState('desc');
  // Multi-row expansion: any number of holdings can be expanded simultaneously.
  // Tracked as Sets so toggling a row leaves other open rows untouched.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [expandedChildIds, setExpandedChildIds] = useState(() => new Set());
  const toggleExpandedId = (id) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleExpandedChildId = (id) => setExpandedChildIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [showRealized, setShowRealized] = useState(false);
  const [closedOpen, setClosedOpen] = useState(true);
  const [expandedRealizedKeys, setExpandedRealizedKeys] = useState(() => new Set());
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
  const [stackCDRs, setStackCDRs] = useState(() => {
    return localStorage.getItem('unifolio_stack_cdrs') === 'true';
  });
  const { isOpen: extractedOpen, setIsOpen: setExtractedOpen,
          pos: extractedPos, setPos: setExtractedPos,
          size: extractedSize, setSize: setExtractedSize } = useFloatingHoldings();
  const dragStateRef = useRef(null);
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
    calcContributionTotals,
  } = usePortfolioData();
  const PM = '••••••'; // privacy mask shorthand
  const totals = calcPortfolioTotals();
  const contributionTotals = calcContributionTotals();
  const convertedDeposited = useMemo(() => Object.entries(contributionTotals.byCurrency || {}).reduce((sum, [currency, value]) => (
    sum + convert(safeNumber(value.deposited), currency)
  ), 0), [contributionTotals, convert, displayCurrency]);
  const convertedNetContributions = useMemo(() => Object.entries(contributionTotals.byCurrency || {}).reduce((sum, [currency, value]) => (
    sum + convert(safeNumber(value.deposited) - safeNumber(value.withdrawn), currency)
  ), 0), [contributionTotals, convert, displayCurrency]);

  const isRealizedExpanded = (key) => expandedRealizedKeys.has(key);
  const toggleRealizedExpanded = (key) => {
    setExpandedRealizedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!showRealized) setExpandedRealizedKeys(new Set());
  }, [showRealized]);

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
      registerTicker(h.quote_symbol || h.ticker, h.asset_class ?? h.assetClass ?? 'stock');
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
    saveColumnOrder(newColumns);
    saveColumnOrderToSupabase(newColumns);
  };

  const handleStackToggle = (val) => {
    setStackAssets(val);
    localStorage.setItem('unifolio_stack_assets', String(val));
    if (!val) {
      setStackCDRs(false);
      localStorage.setItem('unifolio_stack_cdrs', 'false');
    }
  };

  const handleCDRToggle = (val) => {
    setStackCDRs(val);
    localStorage.setItem('unifolio_stack_cdrs', String(val));
  };

  const effectiveAccountFilter = previewFilters.account ?? accountFilter;
  const effectiveInstitutionFilter = previewFilters.institution ?? institutionFilter;
  const effectiveAssetClassFilter = previewFilters.assetClass ?? assetClassFilter;
  const effectiveCurrencyFilter = previewFilters.currency ?? currencyFilter;

  const previewFilter = (key, value) => setPreviewFilters(prev => ({ ...prev, [key]: value }));
  const clearPreviewFilter = (key) => setPreviewFilters(prev => {
    if (!(key in prev)) return prev;
    const next = { ...prev };
    delete next[key];
    return next;
  });

  const handleDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX - extractedPos.x;
    const startY = e.clientY - extractedPos.y;
    const onMove = (ev) => setExtractedPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = extractedSize.w;
    const startH = extractedSize.h;
    const onMove = (ev) => setExtractedSize({ w: Math.max(520, startW + ev.clientX - startX), h: Math.max(320, startH + ev.clientY - startY) });
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
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
      const ticker = holding.quote_symbol || holding.ticker;
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
        if (effectiveAccountFilter !== 'all' && (acc?.account_type ?? acc?.type) !== effectiveAccountFilter) return false;
        if (effectiveInstitutionFilter !== 'all' && (acc?.institution_id ?? acc?.institutionId) !== effectiveInstitutionFilter) return false;
        if (effectiveAssetClassFilter !== 'all' && (r.asset_class ?? r.assetClass) !== effectiveAssetClassFilter) return false;
        if (effectiveCurrencyFilter !== 'all' && r.currency !== effectiveCurrencyFilter) return false;
        return true;
      });
  }, [showRealized, dateFilter, realizedPositions, effectiveAccountFilter, effectiveInstitutionFilter, effectiveAssetClassFilter, effectiveCurrencyFilter, getAccount]);

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
      if (effectiveAccountFilter !== 'all' && accType !== effectiveAccountFilter) return false;
      if (effectiveInstitutionFilter !== 'all' && instId !== effectiveInstitutionFilter) return false;
      if (effectiveAssetClassFilter !== 'all' && ac !== effectiveAssetClassFilter) return false;
      if (effectiveCurrencyFilter !== 'all' && h.currency !== effectiveCurrencyFilter) return false;
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
  }, [enrichedForHeatmap, effectiveAccountFilter, effectiveInstitutionFilter, effectiveAssetClassFilter, effectiveCurrencyFilter, sortField, sortDir]);

  // Stack same-ticker holdings across accounts when toggle is on
  const displayHoldings = useMemo(() => {
    if (!stackAssets) return filteredCurrent;
    let stacked = stackHoldings(filteredCurrent, { getAccount, getInstitutionForAccount });
    if (stackCDRs) {
      stacked = stackCDRGroups(stacked, { convert, displayCurrency, getAccount, getInstitutionForAccount });
    }
    return stacked;
  }, [filteredCurrent, stackAssets, stackCDRs, convert, displayCurrency, getAccount, getInstitutionForAccount]);

  const compressTable = visibleColumns.length >= 9;

  // Group realized positions: matched under active holdings, and unmatched at bottom
  const { realizedByActive, realizedUnmatched } = useMemo(() => {
   if (!showRealized || filteredRealized.length === 0) return { realizedByActive: {}, realizedUnmatched: [] };

   const byActive = {};
   const unmatched = [];

   filteredRealized.forEach(r => {
     const rTicker = (r.security_key || r.securityKey || r.ticker)?.toUpperCase();
     const rAccount = r.account_id ?? r.accountId;
     const rUnderlying = (r.underlying_ticker || '').toUpperCase();

     // A realized position should only nest under an active holding that shares
     // the same account — prevents IBKR closed LLY from nesting under a
     // Wealthsimple active LLY that happens to share the same ticker string.
     let matchingActive = displayHoldings.find(h => {
       if ((h.security_key || h.securityKey || h.ticker)?.toUpperCase() !== rTicker) return false;
       if (h._isStacked && h._stackedChildren) {
         return h._stackedChildren.some(c =>
           (c.account_id ?? c.accountId) === rAccount
           && ((c.security_key || c.securityKey || c.ticker)?.toUpperCase() === rTicker)
         );
       }
       return (h.account_id ?? h.accountId) === rAccount;
     });

     // Cross-listing fallback: when "Stack CDRs" is on, a closed US listing
     // (e.g. realized LLY @NYSE:USD) should nest under the open CDR group
     // (e.g. active LLY + LLY CDR row) that shares the same underlying — even
     // if they're in different accounts, because the CDR group itself spans
     // accounts. Without this, the closed LLY ends up alone at the bottom in
     // "unmatched", which doesn't reflect the user's mental model.
     if (!matchingActive && stackCDRs && rUnderlying) {
       matchingActive = displayHoldings.find(h => {
         if (h._isCDRGroup && Array.isArray(h._stackedChildren)) {
           return h._stackedChildren.some(c => (c.underlying_ticker || '').toUpperCase() === rUnderlying);
         }
         return (h.underlying_ticker || '').toUpperCase() === rUnderlying;
       });
     }

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
  }, [showRealized, filteredRealized, displayHoldings, stackCDRs]);

  const realizedUnmatchedGroups = useMemo(
    () => buildRealizedTickerGroups(realizedUnmatched, { convert, displayCurrency }),
    [realizedUnmatched, convert, displayCurrency],
  );

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

  const heatmapTotals = useMemo(() => {
    const holdingRows = displayHoldings || [];
    const realizedRows = showRealized ? filteredRealized : [];
    const activeRealizedRows = showRealized ? [] : holdingRows;

    const base = {
      marketValue: 0,
      marketValueSecondary: 0,
      costBasis: 0,
      costBasisSecondary: 0,
      dailyPnl: 0,
      dailyPnlSecondary: 0,
      unrealized: 0,
      unrealizedSecondary: 0,
      realized: 0,
      realizedSecondary: 0,
      realizedCostBasis: 0,
      priorMarketValue: 0,
      quantity: 0,
      positionCount: holdingRows.length,
      realizedCount: realizedRows.length,
    };

    holdingRows.forEach(h => {
      const currency = h.currency || displayCurrency || 'USD';
      const marketValue = safeNumber(h.market_value ?? h.marketValue);
      const costBasis = safeNumber(h.cost_basis ?? h.costBasis);
      const dailyPnl = safeNumber(h.daily_pnl_amount ?? h.dailyPnl);
      const unrealized = safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt);
      const quantity = safeNumber(h.quantity ?? h.position);

      base.marketValue += convert(marketValue, currency);
      base.costBasis += convert(costBasis, currency);
      base.dailyPnl += convert(dailyPnl, currency);
      base.unrealized += convert(unrealized, currency);
      base.priorMarketValue += convert(marketValue - dailyPnl, currency);
      base.quantity += quantity;

      if (bothMode) {
        base.marketValueSecondary += convertSecondary(marketValue, currency);
        base.costBasisSecondary += convertSecondary(costBasis, currency);
        base.dailyPnlSecondary += convertSecondary(dailyPnl, currency);
        base.unrealizedSecondary += convertSecondary(unrealized, currency);
      }
    });

    activeRealizedRows.forEach(h => {
      const currency = h.currency || displayCurrency || 'USD';
      const realized = safeNumber(h.realized_gain_loss_amount ?? h.realizedGain);
      const costBasis = safeNumber(h.cost_basis ?? h.costBasis);
      if (realized !== 0) base.realizedCount += 1;
      base.realized += convert(realized, currency);
      base.realizedCostBasis += convert(costBasis, currency);
      if (bothMode) base.realizedSecondary += convertSecondary(realized, currency);
    });

    realizedRows.forEach(r => {
      const currency = r.currency || displayCurrency || 'USD';
      const realized = safeNumber(r.realized_gain_loss_amount ?? r.realizedGain);
      const costBasis = safeNumber(r.total_cost_basis ?? r.cost_basis ?? r.costBasis);
      base.realized += convert(realized, currency);
      base.realizedCostBasis += convert(costBasis, currency);
      if (bothMode) base.realizedSecondary += convertSecondary(realized, currency);
    });

    return {
      ...base,
      dailyPnlPct: safeDivide(base.dailyPnl, base.priorMarketValue) * 100,
      unrealizedPct: safeDivide(base.unrealized, base.costBasis) * 100,
      realizedPct: safeDivide(base.realized, base.realizedCostBasis) * 100,
      portfolioPct: safeDivide(base.marketValue, convertedPortfolioTotal) * 100,
    };
  }, [displayHoldings, showRealized, filteredRealized, convert, convertSecondary, displayCurrency, bothMode, convertedPortfolioTotal]);

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

  const TotalsPnl = ({ value, isCurrency = true }) => (
    <span className="flex justify-end">
      <PnlValue value={value} isCurrency={isCurrency} className="text-[11px] sm:text-sm" />
    </span>
  );

  const TotalsMoney = ({ value, secondary, pnl = false, className = '' }) => {
    if (privacyMode) {
      return (
        <span className={cn('flex justify-end font-mono tabular-nums tracking-widest text-muted-foreground/50', className)}>
          {PM}
        </span>
      );
    }
    if (pnl) {
      return (
        <span className="flex flex-col items-end leading-tight">
          <PnlValue value={value} className={cn('text-[11px] sm:text-sm', className)} />
          {bothMode && (
            <span className="flex items-center gap-1">
              <PnlValue value={secondary} className="text-[9px] opacity-60" />
              <span className="text-[9px] text-muted-foreground/40">{secondaryCurrency}</span>
            </span>
          )}
        </span>
      );
    }
    return (
      <span className="flex flex-col items-end leading-tight">
        <span className={cn('font-mono tabular-nums text-foreground', className)}>{formatCurrency(value)}</span>
        {bothMode && (
          <span className="font-mono tabular-nums text-[9px] text-muted-foreground/60">
            {formatCurrency(secondary)} <span className="opacity-60">{secondaryCurrency}</span>
          </span>
        )}
      </span>
    );
  };

  const renderTotalsCell = (colId) => {
    switch (colId) {
      case 'ticker':
        return <span className="font-semibold text-primary">Totals</span>;
      case 'company':
        return (
          <span className="text-muted-foreground whitespace-nowrap">
            {heatmapTotals.positionCount} pos
            {heatmapTotals.realizedCount > 0 ? ` ${heatmapTotals.realizedCount} rlzd` : ''}
          </span>
        );
      case 'quantity':
        return <span className="font-mono tabular-nums text-foreground">{heatmapTotals.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>;
      case 'marketValue':
      case 'nativeMarketValue':
        return <TotalsMoney value={heatmapTotals.marketValue} secondary={heatmapTotals.marketValueSecondary} />;
      case 'costBasis':
        return <TotalsMoney value={heatmapTotals.costBasis} secondary={heatmapTotals.costBasisSecondary} />;
      case 'dailyPnl':
        return <TotalsMoney value={heatmapTotals.dailyPnl} secondary={heatmapTotals.dailyPnlSecondary} pnl />;
      case 'dailyPnlPct':
        return <TotalsPnl value={heatmapTotals.dailyPnlPct} isCurrency={false} />;
      case 'unrealizedGain':
        return <TotalsMoney value={heatmapTotals.unrealized} secondary={heatmapTotals.unrealizedSecondary} pnl />;
      case 'unrealizedGainPct':
        return <TotalsPnl value={heatmapTotals.unrealizedPct} isCurrency={false} />;
      case 'realizedGain':
        return <TotalsMoney value={heatmapTotals.realized} secondary={heatmapTotals.realizedSecondary} pnl />;
      case 'realizedGainContrib':
        return <TotalsPnl value={heatmapTotals.realizedCount > 0 ? 100 : 0} isCurrency={false} />;
      case 'pctPortfolio':
        return <span className="font-mono tabular-nums text-foreground">{privacyMode ? '••••' : `${heatmapTotals.portfolioPct.toFixed(2)}%`}</span>;
      case 'price':
      case 'avgPrice':
      case 'pctAccount':
      case 'pctAssetClass':
      case 'trend':
      case 'account':
      case 'institution':
      case 'accountType':
      case 'currency':
      case 'assetClass':
      case 'sector':
      case 'country':
      case 'exchange':
      default:
        return <span aria-hidden="true" />;
    }
  };

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
        if (h._isCDRGroup) {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono font-semibold text-xs text-primary leading-tight">{h._isCDRGroupName}</span>
              <span className="text-[9px] text-muted-foreground/50 leading-tight font-mono">{h._stackedChildren?.map(c => c.ticker).join(' + ')}</span>
            </div>
          );
        }
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
        if (!lp || lp <= 0) return <span className="text-right font-mono tabular-nums text-muted-foreground/40">—</span>;
        const pPrimary = convert(safeNumber(lp), nativeCurrency);
        if (bothMode) {
          const pSecondary = convertSecondary(safeNumber(lp), nativeCurrency);
          return <span title={getValuationTitle(h)}><TwoLineValue primary={pPrimary.toFixed(2)} secondary={pSecondary.toFixed(2)} secCurrency={secondaryCurrency} /></span>;
        }
        return <span className="text-right font-mono tabular-nums" title={getValuationTitle(h)}>{pPrimary.toFixed(2)}</span>;
      }
      case 'quantity':
        return <span className="text-right font-mono tabular-nums">{h.position ?? '—'}</span>;
      case 'pctPortfolio':
        return <span className="text-right font-mono tabular-nums text-muted-foreground">{privacyMode ? '••••' : pctOfNav.toFixed(2) + '%'}</span>;
      case 'pctAccount':
        return <span className="text-right font-mono tabular-nums text-blue-400">{privacyMode ? '••••' : (h.position > 0 ? pctOfAcct.toFixed(2) + '%' : '—')}</span>;
      case 'avgPrice': {
        const rawAvg = safeNumber(h.average_price ?? h.avgPrice);
        if (privacyMode) return <span className="text-right font-mono tabular-nums">{PM}</span>;
        if (!rawAvg || rawAvg <= 0) return <span className="text-right font-mono tabular-nums text-muted-foreground/40">—</span>;
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
        return h._isStacked
          ? <span className="text-xs text-muted-foreground whitespace-nowrap">{h._institutionLabel}</span>
          : <InstitutionLogo institution={inst} name={inst?.name} size="xs" />;
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

  const holdingsTableSection = (
    <div className="space-y-4">
      {/* Filters Row */}
       <div className="flex flex-wrap gap-1 sm:gap-2 items-center">
         {/* Date filter */}
         <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

        <Select value={accountFilter} onValueChange={(value) => { setAccountFilter(value); clearPreviewFilter('account'); }}>
          <SelectTrigger className="w-24 sm:w-32 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent onPointerLeave={() => clearPreviewFilter('account')}>
            <SelectItem value="all" onPointerEnter={() => previewFilter('account', 'all')} onFocus={() => previewFilter('account', 'all')}>All Accounts</SelectItem>
            {accountTypes.map(t => (
              <SelectItem key={t} value={t} onPointerEnter={() => previewFilter('account', t)} onFocus={() => previewFilter('account', t)}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={institutionFilter} onValueChange={(value) => { setInstitutionFilter(value); clearPreviewFilter('institution'); }}>
          <SelectTrigger className="w-28 sm:w-40 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent onPointerLeave={() => clearPreviewFilter('institution')}>
            <SelectItem value="all" onPointerEnter={() => previewFilter('institution', 'all')} onFocus={() => previewFilter('institution', 'all')}>All Institutions</SelectItem>
            {institutions.filter(i => (i.connection_status ?? i.status) === 'connected').map(i => (
              <SelectItem key={i.id} value={i.id} onPointerEnter={() => previewFilter('institution', i.id)} onFocus={() => previewFilter('institution', i.id)}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assetClassFilter} onValueChange={(value) => { setAssetClassFilter(value); clearPreviewFilter('assetClass'); }}>
          <SelectTrigger className="w-24 sm:w-32 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent onPointerLeave={() => clearPreviewFilter('assetClass')}>
            <SelectItem value="all" onPointerEnter={() => previewFilter('assetClass', 'all')} onFocus={() => previewFilter('assetClass', 'all')}>All Classes</SelectItem>
            <SelectItem value="Equity" onPointerEnter={() => previewFilter('assetClass', 'Equity')} onFocus={() => previewFilter('assetClass', 'Equity')}>Equity</SelectItem>
            <SelectItem value="ETF" onPointerEnter={() => previewFilter('assetClass', 'ETF')} onFocus={() => previewFilter('assetClass', 'ETF')}>ETF</SelectItem>
            <SelectItem value="Stock" onPointerEnter={() => previewFilter('assetClass', 'Stock')} onFocus={() => previewFilter('assetClass', 'Stock')}>Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={(value) => { setCurrencyFilter(value); clearPreviewFilter('currency'); }}>
          <SelectTrigger className="w-20 sm:w-28 h-7 sm:h-8 text-[10px] sm:text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent onPointerLeave={() => clearPreviewFilter('currency')}>
            <SelectItem value="all" onPointerEnter={() => previewFilter('currency', 'all')} onFocus={() => previewFilter('currency', 'all')}>All Currencies</SelectItem>
            <SelectItem value="USD" onPointerEnter={() => previewFilter('currency', 'USD')} onFocus={() => previewFilter('currency', 'USD')}>USD</SelectItem>
            <SelectItem value="CAD" onPointerEnter={() => previewFilter('currency', 'CAD')} onFocus={() => previewFilter('currency', 'CAD')}>CAD</SelectItem>
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
        <div className="flex items-center gap-2">
          <ThemedSwitch
            id="show-lots"
            checked={expandedIds.size > 0}
            onCheckedChange={(open) => {
              if (open) {
                setExpandedIds(new Set(displayHoldings.map(h => h.id).filter(Boolean)));
              } else {
                setExpandedIds(new Set());
                setExpandedChildIds(new Set());
              }
            }}
            className="scale-90"
          />
          <label htmlFor="show-lots" className="text-xs text-muted-foreground cursor-pointer select-none">
            Show Lots
          </label>
        </div>
        {stackAssets && (
          <div className="flex items-center gap-2">
            <ThemedSwitch
              id="stack-cdrs"
              checked={stackCDRs}
              onCheckedChange={handleCDRToggle}
              className="scale-90"
            />
            <label htmlFor="stack-cdrs" className="text-xs text-muted-foreground cursor-pointer select-none">
              Stack ETF CDRs
            </label>
            <span
              title="Groups ETFs that track the same index across markets (e.g. VOO USD + VFV.TO CAD → S&P 500). Values converted to your display currency."
              className="text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors"
            >
              <Info className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>

      {/* Position count */}
      <div className="flex items-center justify-between">
        {stackAssets && (
          <span className="text-[10px] text-amber-400/80 italic">
            {stackCDRs ? 'Stacked by ticker · CDR groups merged' : 'Stacked by ticker'}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] sm:text-xs text-muted-foreground">
            {displayHoldings.length} active{showRealized && (Object.keys(realizedByActive).length > 0 || realizedUnmatched.length > 0) ? ` · ${(Object.values(realizedByActive).flat() || []).length + realizedUnmatched.length} realized` : ''}
          </span>
          <button
            type="button"
            title={extractedOpen ? 'Close floating table' : 'Pop out holdings table'}
            onClick={() => setExtractedOpen(v => !v)}
            className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {extractedOpen ? <X className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
          </button>
        </div>
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
              <DraggableTableHeader
                columns={COLUMN_DEFINITIONS.map(col => ({
                  ...col,
                  headerClassName: `${compressTable ? 'px-1.5 py-1' : 'px-2 sm:px-3 py-1.5 sm:py-2.5'} text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${['price', 'quantity', 'pctPortfolio', 'pctAccount', 'avgPrice', 'realizedGain', 'realizedGainContrib', 'unrealizedGainPct', 'unrealizedGain', 'dailyPnl', 'dailyPnlPct', 'marketValue', 'nativeMarketValue', 'costBasis'].includes(col.id) ? 'text-right' : 'text-left'}`
                }))}
                orderedColumnIds={visibleColumns}
                onOrderChange={handleColumnsChange}
                rowClassName="border-b border-border bg-secondary/30"
                renderCell={(column) => {
                  const colId = column.id;
                  const isSortable = colId !== 'trend';
                  const headerClass = ['price', 'quantity', 'pctPortfolio', 'pctAccount', 'avgPrice', 'realizedGain', 'realizedGainContrib', 'unrealizedGainPct', 'unrealizedGain', 'dailyPnl', 'dailyPnlPct', 'marketValue', 'nativeMarketValue', 'costBasis'].includes(colId) ? 'justify-end' : 'justify-start';
                  const colLabel = compressTable ? (column.shortLabel ?? column.label) : column.label;
                  return (
                    <div className={cn('flex items-center gap-1.5', headerClass)}>
                      {isSortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleSort(colId)}
                        >
                          <span>{colLabel}</span>
                          {sortField === colId ? (
                            sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </button>
                      ) : (
                        <span>{colLabel}</span>
                      )}
                    </div>
                  );
                }}
              />
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
                  const isExpanded = expandedIds.has(h.id);

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
                      onClick={() => toggleExpandedId(h.id)}
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
                      const childAccType = child._isStacked
                        ? (child._accountLabel ?? '—')
                        : (childAcc?.account_type ?? childAcc?.type ?? '—');
                      const childInstName = child._isStacked
                        ? (child._institutionLabel ?? '—')
                        : (childInst?.name ?? '—');
                      const childCurrency = child.currency || 'USD';
                      const childMarketValue = convert(safeNumber(child.market_value ?? child.marketValue), childCurrency);
                      const childUnrealized = convert(safeNumber(child.unrealized_gain_loss_amount ?? child.unrealizedAmt), childCurrency);
                      const childDailyPnl = convert(safeNumber(child.daily_pnl_amount ?? child.dailyPnl), childCurrency);
                      const childQty = safeNumber(child.quantity ?? child.position);
                      const childAvgPrice = convert(safeNumber(child.average_price ?? child.avgPrice), childCurrency);
                      const childPctOfStack = stackedMarketValue > 0
                        ? safeDivide(safeNumber(child.market_value ?? child.marketValue), stackedMarketValue) * 100
                        : 0;
                      const isLastChild = childIdx === h._stackedChildren.length - 1;

                      const isChildExpanded = expandedChildIds.has(child.id);
                      rows.push(
                        <tr
                          key={`stack-child-${child.id}`}
                          className={cn(
                            'cursor-pointer transition-colors border-l-2 border-l-amber-400/25',
                            isChildExpanded ? 'bg-secondary/20' : 'bg-secondary/10 hover:bg-secondary/20',
                            isLastChild && !isChildExpanded ? 'border-b-2 border-b-border/30' : 'border-b border-border/20'
                          )}
                          onClick={() => toggleExpandedChildId(child.id)}
                        >
                          <td colSpan={visibleColumns.length} className="px-3 py-2">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 text-xs text-muted-foreground items-center">
                              <span className="text-muted-foreground/50 mr-1">↳</span>
                              {h._isCDRGroup && <span className="font-mono font-semibold text-primary text-xs">{child.ticker}</span>}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border/40 text-foreground/70 font-medium">{childAccType}</span>
                              <span className="font-medium text-foreground/80">{childInstName}</span>
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
                        rows.push(<RowErrorBoundary key={`child-detail-${child.id}`}><HoldingDetailRow holding={child} allHoldings={liveUpdatedBaseHoldings} portfolioTotal={convertedPortfolioTotal} /></RowErrorBoundary>);
                      }
                    });
                  } else if (isExpanded) {
                    rows.push(<RowErrorBoundary key={`detail-${h.id}`}><HoldingDetailRow holding={h} allHoldings={liveUpdatedBaseHoldings} portfolioTotal={convertedPortfolioTotal} /></RowErrorBoundary>);
                  }

                  // Add nested realized rows for this active holding
                  const nestedRealized = realizedByActive[h.id] || [];
                  const nestedRealizedGroups = buildRealizedTickerGroups(nestedRealized, { convert, displayCurrency });
                  nestedRealizedGroups.forEach(r => {
                    const rAcc = getAccount(r.account_id);
                    const rInst = getInstitutionForAccount(r.account_id);
                    const rNativeCurrency = r.currency || 'USD';
                    const rAccType = rAcc?.account_type ?? rAcc?.type;
                    const nestedRealizedKey = `active:${h.id}:${r.ticker}`;
                    const isNestedRealizedExpanded = isRealizedExpanded(nestedRealizedKey);

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
                        onClick={() => toggleRealizedExpanded(nestedRealizedKey)}
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
                        const instCcy = instance.currency || 'USD';
                        rows.push(
                          <tr key={`${r.id}-${instance.id}`} className="border-b border-border/20 bg-secondary/10">
                            <td colSpan={visibleColumns.length} className="px-5 py-2">
                              <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-[11px] text-muted-foreground">
                                <span><span className="text-muted-foreground/60">Closed</span> <span className="font-mono text-foreground/80">{formatMMDDYYYY(instance.close_date)}</span></span>
                                <span><span className="text-muted-foreground/60">Opened</span> <span className="font-mono">{formatMMDDYYYY(instance.open_date)}</span></span>
                                <span><span className="text-muted-foreground/60">Qty</span> <span className="font-mono">{safeNumber(instance.quantity).toFixed(4)}</span></span>
                                <span><span className="text-muted-foreground/60">Buy</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(safeNumber(instance.average_buy_price), instCcy))}</span></span>
                                <span><span className="text-muted-foreground/60">Sell</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(safeNumber(instance.average_sell_price), instCcy))}</span></span>
                                <span><span className="text-muted-foreground/60">Cost</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(safeNumber(instance.total_cost_basis), instCcy))}</span></span>
                                <span><span className="text-muted-foreground/60">P&L</span> <PnlValue value={convert(safeNumber(instance.realized_gain_loss_amount), instCcy)} className="text-[11px]" /></span>
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
                      const closedRealizedKey = `closed:${r.id}`;
                      const isTickerExpanded = isRealizedExpanded(closedRealizedKey);

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
                          onClick={() => toggleRealizedExpanded(closedRealizedKey)}
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
                          const instCcy = instance.currency || 'USD';
                          rows.push(
                            <tr key={`${r.id}-${instance.id}`} className="border-b border-border/20 bg-secondary/10">
                              <td colSpan={visibleColumns.length} className="px-5 py-2">
                                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-[11px] text-muted-foreground">
                                  <span><span className="text-muted-foreground/60">Closed</span> <span className="font-mono text-foreground/80">{formatMMDDYYYY(instance.close_date)}</span></span>
                                  <span><span className="text-muted-foreground/60">Opened</span> <span className="font-mono">{formatMMDDYYYY(instance.open_date)}</span></span>
                                  <span><span className="text-muted-foreground/60">Qty</span> <span className="font-mono">{safeNumber(instance.quantity).toFixed(4)}</span></span>
                                  <span><span className="text-muted-foreground/60">Buy</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(safeNumber(instance.average_buy_price), instCcy))}</span></span>
                                  <span><span className="text-muted-foreground/60">Sell</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(safeNumber(instance.average_sell_price), instCcy))}</span></span>
                                  <span><span className="text-muted-foreground/60">Cost</span> <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(safeNumber(instance.total_cost_basis), instCcy))}</span></span>
                                  <span><span className="text-muted-foreground/60">P&L</span> <PnlValue value={convert(safeNumber(instance.realized_gain_loss_amount), instCcy)} className="text-[11px]" /></span>
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
              {(displayHoldings.length > 0 || filteredRealized.length > 0) && (
                <tfoot className="sticky bottom-0 z-20">
                  <tr className="border-t border-primary/25 shadow-[0_-8px_18px_hsl(var(--background)/0.45)]">
                    {visibleColumns.map(colId => {
                      const isNumeric = ['price', 'quantity', 'pctPortfolio', 'pctAccount', 'pctAssetClass', 'avgPrice', 'realizedGain', 'realizedGainContrib', 'unrealizedGainPct', 'unrealizedGain', 'dailyPnl', 'dailyPnlPct', 'marketValue', 'nativeMarketValue', 'costBasis'].includes(colId);
                      return (
                        <td
                          key={`totals-${colId}`}
                          className={cn(
                            compressTable ? 'px-1.5 py-1.5' : 'px-2 sm:px-3 py-2',
                            'sticky bottom-0 bg-card/95 backdrop-blur-md text-[11px] sm:text-sm font-medium',
                            isNumeric ? 'text-right' : 'text-left'
                          )}
                        >
                          {renderTotalsCell(colId)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
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
          </div>
        )}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Deposited</p>
          <p className="mt-1 font-mono text-sm font-semibold">{privacyMode ? PM : formatCurrency(convertedDeposited)}</p>
        </div>
        <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Net Contributions</p>
          <p className="mt-1 font-mono text-sm font-semibold">{privacyMode ? PM : formatCurrency(convertedNetContributions)}</p>
        </div>
      </div>

      {!extractedOpen ? holdingsTableSection : (
        <div className="rounded-xl border border-primary/20 bg-card/50 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Holdings table is floating</p>
          <p className="mt-1 text-xs text-muted-foreground">Drag the floating window to reposition, or click × to close it.</p>
        </div>
      )}

      <PortfolioBreakdown />
    </div>
  );

  return (
    <>
      {holdingsWorkspace}
      {extractedOpen && createPortal(
        <div
          style={{ position: 'fixed', left: extractedPos.x, top: extractedPos.y, width: extractedSize.w, height: extractedSize.h, zIndex: 9999 }}
          className="flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        >
          <div
            className="flex items-center gap-2 border-b border-border/60 bg-card px-3 py-2 cursor-grab select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={handleDragStart}
          >
            <p className="text-sm font-semibold text-foreground flex-1">Holdings</p>
            <span className="text-[10px] text-muted-foreground mr-2">{displayHoldings.length} active</span>
            <button
              type="button"
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExtractedOpen(false)}
              aria-label="Close floating holdings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {holdingsTableSection}
          </div>
          {/* Edge drag strips — left, right, bottom */}
          <div className="absolute left-0 top-10 bottom-5 w-2 cursor-grab z-10" style={{ touchAction: 'none' }} onPointerDown={handleDragStart} />
          <div className="absolute right-0 top-10 bottom-5 w-2 cursor-grab z-10" style={{ touchAction: 'none' }} onPointerDown={handleDragStart} />
          <div className="absolute bottom-0 left-0 right-5 h-2 cursor-grab z-10" style={{ touchAction: 'none' }} onPointerDown={handleDragStart} />
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
            style={{ touchAction: 'none' }}
            onPointerDown={handleResizeStart}
          />
        </div>,
        document.body
      )}
    </>
  );
}
