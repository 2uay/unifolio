import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Activity, Minimize2,
  BarChart2, ChevronRight, ChevronLeft, Bell, StickyNote,
  Newspaper, Sparkles, LayoutList, Bookmark, Save
} from 'lucide-react';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { CustomStockTooltip } from '@/lib/chartTooltip';
import IndicatorPanel from '@/components/charts/IndicatorPanel.jsx';
import ComparePanel from '@/components/charts/ComparePanel.jsx';
import DrawingToolbar from '@/components/charts/DrawingToolbar.jsx';
import {
  generateOHLC, applyIndicators, toHeikinAshi,
  CHART_TYPES, TIME_RANGES, RANGE_DAYS, INTERVALS, ALL_INDICATORS,
  COMPARE_OPTIONS, EVENT_TYPES, DEFAULT_LAYOUT, saveChartLayout, loadChartLayout
} from '@/lib/chartEngine';
import { fetchStockCandles } from '@/lib/stockApi';

// Generate a synthetic comparison line (% from start)
function genCompareLine(seedVal, points, key) {
  const rng = (s) => { let x = s; return () => { x = (x * 1664525 + 1013904223) & 0x7fffffff; return x / 0x7fffffff; }; };
  const r = rng(seedVal);
  let val = 100;
  return Array.from({ length: points }, () => {
    val = val * (1 + (r() - 0.48) * 0.02);
    return { [key]: +val.toFixed(2) };
  });
}

export default function FullscreenChart({
  ticker, name, lastPrice, seedVal = 42,
  chartData: chartDataProp,
  realCandles: realCandlesProp,
  range, chartType, activeIndicators,
  onRangeChange, onChartTypeChange, onIndicatorsChange, onClose,
}) {
  const { privacyMode } = usePrivacy();
  const saved = useMemo(() => loadChartLayout(), []);

  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [showCompareMenu, setShowCompareMenu] = useState(false);
  const [fsRealCandles, setFsRealCandles] = useState(realCandlesProp ?? null);
  const [rightPanelOpen, setRightPanelOpen] = useState(saved?.rightPanelOpen ?? true);
  const [activeTool, setActiveTool] = useState('cursor');
  const [interval, setIntervalVal] = useState(saved?.interval || DEFAULT_LAYOUT.interval);
  const [compareLines, setCompareLines] = useState(saved?.compareLines || []);
  const [activeEvents, setActiveEvents] = useState(saved?.activeEvents || []);
  const [showEventMenu, setShowEventMenu] = useState(false);
  const indicatorRef = useRef(null);
  const compareRef = useRef(null);
  const eventRef = useRef(null);

  // When range changes inside fullscreen, fetch new real candles
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setFsRealCandles(null);
    fetchStockCandles(ticker, range).then(candles => {
      if (!cancelled) setFsRealCandles(candles && candles.length >= 5 ? candles : null);
    }).catch(() => { if (!cancelled) setFsRealCandles(null); });
    return () => { cancelled = true; };
  }, [ticker, range]);

  const days = RANGE_DAYS[range] || 90;
  const baseData = useMemo(() => {
    if (fsRealCandles && fsRealCandles.length >= 5) return fsRealCandles;
    return generateOHLC(lastPrice || 100, seedVal, Math.min(days, 500));
  }, [fsRealCandles, lastPrice, seedVal, days]);
  const chartData = useMemo(() => {
    let d = applyIndicators(baseData, activeIndicators);
    if (chartType === 'heikin') d = toHeikinAshi(d);
    return d;
  }, [baseData, activeIndicators, chartType]);

  const firstClose = chartData[0]?.close || 1;
  const lastClose = chartData[chartData.length - 1]?.close || 1;
  const pctChange = ((lastClose - firstClose) / firstClose) * 100;
  const absChange = lastClose - firstClose;
  const isUp = pctChange >= 0;
  const strokeColor = isUp ? '#34d399' : '#f87171';
  const gradId = `fs-grad-${ticker?.replace(/[^a-zA-Z0-9]/g, '') || 'stock'}`;
  const xInterval = Math.floor(chartData.length / 8);

  const showRSI = activeIndicators.includes('rsi');
  const showVolume = activeIndicators.includes('volume');
  const showMACD = activeIndicators.includes('macd');
  const showStoch = activeIndicators.includes('stoch');
  const showATR = activeIndicators.includes('atr');
  const showOBV = activeIndicators.includes('obv');

  // Comparison data (% normalized)
  const compareData = useMemo(() => {
    if (compareLines.length === 0) return chartData;
    const baseNorm = chartData.map((d, i) => ({
      ...d,
      _baseNorm: +((d.close / firstClose) * 100).toFixed(2),
    }));
    compareLines.forEach((id, ci) => {
      const opt = COMPARE_OPTIONS.find(o => o.id === id);
      if (!opt) return;
      const cData = genCompareLine(opt.id.charCodeAt(0) * 17 + ci, chartData.length, id);
      cData.forEach((c, i) => { if (baseNorm[i]) baseNorm[i] = { ...baseNorm[i], ...c }; });
    });
    return baseNorm;
  }, [chartData, compareLines, firstClose]);

  const toggleIndicator = (id) => {
    const next = activeIndicators.includes(id)
      ? activeIndicators.filter(x => x !== id)
      : [...activeIndicators, id];
    onIndicatorsChange(next);
    saveChartLayout({ chartType, range, interval, activeIndicators: next, compareLines, activeEvents, rightPanelOpen });
  };

  const toggleCompare = (id) => {
    const next = compareLines.includes(id)
      ? compareLines.filter(x => x !== id)
      : [...compareLines, id];
    setCompareLines(next);
    saveChartLayout({ chartType, range, interval, activeIndicators, compareLines: next, activeEvents, rightPanelOpen });
  };

  const handleSaveLayout = () => {
    saveChartLayout({ chartType, range, interval, activeIndicators, compareLines, activeEvents, rightPanelOpen });
  };

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (indicatorRef.current && !indicatorRef.current.contains(e.target)) setShowIndicatorMenu(false);
      if (compareRef.current && !compareRef.current.contains(e.target)) setShowCompareMenu(false);
      if (eventRef.current && !eventRef.current.contains(e.target)) setShowEventMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return; // Don't trigger if typing in input
      switch (e.key.toLowerCase()) {
        case 'escape':
          onClose();
          break;
        case 'c':
          setActiveTool('cursor');
          break;
        case 'l':
          setActiveTool('line');
          break;
        case 'h':
          setActiveTool('hline');
          break;
        case 't':
          setActiveTool('trend');
          break;
        case '/':
          e.preventDefault();
          setShowIndicatorMenu(p => !p);
          break;
        case 'delete':
        case 'backspace':
          // Delete selected drawing (placeholder)
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const lastPoint = chartData[chartData.length - 1] || {};
  const TooltipComp = (props) => (
    <CustomStockTooltip {...props} privacyMode={privacyMode} firstClose={firstClose} activeIndicators={activeIndicators} allIndicators={ALL_INDICATORS} />
  );

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const content = (
    <div className="fixed inset-0 flex flex-col bg-background" style={{ zIndex: 99999 }}>

      {/* ── Top Toolbar ──────────────────────────────────────────── */}
      <div className={cn('flex items-center gap-1.5 px-2 md:px-3 border-b border-border bg-card flex-shrink-0 overflow-x-auto', isMobile ? 'h-10' : 'h-11')}>

        {/* Ticker */}
        <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0">
          <span className="font-mono font-bold text-xs md:text-sm text-foreground">{ticker}</span>
          <span className="text-[10px] text-muted-foreground hidden lg:block truncate max-w-[100px]">{name}</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-1 md:gap-1.5 border-l border-border pl-1.5 md:pl-2 flex-shrink-0 min-w-0">
          <span className="font-mono font-bold text-xs md:text-sm truncate">{privacyMode ? '••••' : `$${lastClose.toFixed(2)}`}</span>
          <span className={cn('text-[10px] md:text-[11px] font-mono flex items-center gap-0.5 flex-shrink-0', isUp ? 'text-emerald-400' : 'text-red-400')}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="hidden sm:inline">{privacyMode ? '••••' : `${isUp ? '+' : ''}${pctChange.toFixed(2)}%`}</span>
          </span>
        </div>

        <div className="flex-1" />

        {/* Chart types (hidden on mobile) */}
        <div className="hidden md:flex rounded-md border border-border overflow-hidden text-[10px] flex-shrink-0">
          {CHART_TYPES.slice(0, 3).map(ct => (
            <button
              key={ct.id}
              onClick={() => !ct.soon && onChartTypeChange(ct.id)}
              title={ct.label}
              className={cn(
                'px-1.5 py-1 transition-colors whitespace-nowrap',
                ct.soon ? 'text-muted-foreground/30 cursor-default' : '',
                !ct.soon && chartType === ct.id ? 'bg-secondary text-foreground' : '',
                !ct.soon && chartType !== ct.id ? 'text-muted-foreground hover:text-foreground' : ''
              )}
            >{ct.label}</button>
          ))}
        </div>

        {/* Time range */}
        <div className="flex rounded-md border border-border overflow-hidden text-[10px] flex-shrink-0">
          {(isMobile ? ['1D', '1W', '1M', '1Y'] : TIME_RANGES).map(r => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={cn('px-1.5 md:px-2 py-1 transition-colors text-[9px] md:text-[10px]', range === r ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}
            >{r}</button>
          ))}
        </div>

        {/* Indicators */}
        <div className="relative flex-shrink-0" ref={indicatorRef}>
          <button
            onClick={() => { setShowIndicatorMenu(p => !p); setShowCompareMenu(false); setShowEventMenu(false); }}
            className={cn('text-[10px] px-1.5 md:px-2 py-1 md:py-1.5 rounded border border-border flex items-center gap-1.5 transition-colors', showIndicatorMenu ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            title="Indicators (/ to toggle)"
          >
            <Activity className="w-3 h-3" />
            <span className="hidden md:inline">Ind</span>
            {activeIndicators.length > 0 && (
              <span className="bg-primary text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{activeIndicators.length}</span>
            )}
          </button>
          {showIndicatorMenu && (
            <div className="absolute right-0 top-9 z-[100001]">
              <IndicatorPanel
                activeIndicators={activeIndicators}
                onToggle={toggleIndicator}
                onClearAll={() => { onIndicatorsChange([]); }}
                onClose={() => setShowIndicatorMenu(false)}
              />
            </div>
          )}
        </div>

        {/* Compare (hidden on mobile) */}
        <div className="relative flex-shrink-0 hidden sm:block" ref={compareRef}>
          <button
            onClick={() => { setShowCompareMenu(p => !p); setShowIndicatorMenu(false); setShowEventMenu(false); }}
            className={cn('text-[10px] px-1.5 md:px-2 py-1 md:py-1.5 rounded border border-border flex items-center gap-1.5 transition-colors', showCompareMenu || compareLines.length > 0 ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <BarChart2 className="w-3 h-3" />
            <span className="hidden lg:inline">Compare</span>
            {compareLines.length > 0 && (
              <span className="bg-primary text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{compareLines.length}</span>
            )}
          </button>
          {showCompareMenu && (
            <div className="absolute right-0 top-9 z-[100001]">
              <ComparePanel compareLines={compareLines} onToggle={toggleCompare} onClose={() => setShowCompareMenu(false)} />
            </div>
          )}
        </div>

        {/* Events (hidden on mobile) */}
        <div className="relative flex-shrink-0 hidden lg:block" ref={eventRef}>
          <button
            onClick={() => { setShowEventMenu(p => !p); setShowIndicatorMenu(false); setShowCompareMenu(false); }}
            className={cn('text-[10px] px-1.5 md:px-2 py-1 md:py-1.5 rounded border border-border flex items-center gap-1.5 transition-colors', showEventMenu ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <span>Events</span>
          </button>
          {showEventMenu && (
            <div className="absolute right-0 top-9 z-[100001] w-48 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Chart Events</p>
              </div>
              {EVENT_TYPES.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setActiveEvents(prev => prev.includes(ev.id) ? prev.filter(x => x !== ev.id) : [...prev, ev.id])}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-secondary/40 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                  <span className={cn('flex-1 text-left', activeEvents.includes(ev.id) ? 'text-foreground' : 'text-muted-foreground')}>{ev.label}</span>
                  {activeEvents.includes(ev.id) && <span className="text-primary text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save layout (hidden on mobile) */}
        <button
          onClick={handleSaveLayout}
          title="Save Layout"
          className="p-1 md:p-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 hidden md:flex"
        >
          <Save className="w-3 md:w-3.5 h-3 md:h-3.5" />
        </button>

        {/* Right panel toggle (hidden on mobile) */}
        <button
          onClick={() => setRightPanelOpen(p => !p)}
          className="p-1 md:p-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 hidden md:flex"
          title="Toggle Panel"
        >
          <LayoutList className="w-3 md:w-3.5 h-3 md:h-3.5" />
        </button>

        {/* Exit */}
        <button
          onClick={onClose}
          className="flex items-center gap-1 md:gap-1.5 text-xs px-2 md:px-2.5 py-1 md:py-1.5 rounded-md bg-secondary/80 hover:bg-secondary text-foreground border border-border transition-colors flex-shrink-0 ml-auto"
        >
          <Minimize2 className="w-3 md:w-3.5 h-3 md:h-3.5" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left Drawing Toolbar (hidden on mobile) */}
        <div className="hidden md:flex flex-col items-center gap-1 px-1.5 py-2 border-r border-border bg-card/50 flex-shrink-0">
          <DrawingToolbar activeTool={activeTool} onSelect={setActiveTool} onClear={() => {}} />
        </div>

        {/* Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Active indicator pills */}
          {activeIndicators.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-1 flex-shrink-0">
              {activeIndicators.map(id => {
                const ind = ALL_INDICATORS.find(i => i.id === id);
                return ind ? (
                  <button
                    key={id}
                    onClick={() => toggleIndicator(id)}
                    className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: ind.color + '22', color: ind.color, border: `1px solid ${ind.color}44` }}
                  >
                    {ind.label} ×
                  </button>
                ) : null;
              })}
              {compareLines.map(id => {
                const opt = COMPARE_OPTIONS.find(o => o.id === id);
                return opt ? (
                  <button key={id} onClick={() => toggleCompare(id)}
                    className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: opt.color + '22', color: opt.color, border: `1px solid ${opt.color}44` }}
                  >vs {opt.label} ×</button>
                ) : null;
              })}
            </div>
          )}

          {/* Main chart */}
          <div className="flex-1 min-h-0 min-w-0 px-2 pt-2 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={compareLines.length > 0 ? compareData : chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} interval={xInterval} />
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  width={60}
                  tickFormatter={v => {
                    if (privacyMode) return '••••';
                    return compareLines.length > 0 ? v.toFixed(1) + '%' : `$${v.toFixed(0)}`;
                  }}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<TooltipComp />} />

                {/* Price series */}
                {(chartType === 'area' || chartType === 'heikin') && (
                  <Area yAxisId="price" type="monotone" dataKey={compareLines.length > 0 ? '_baseNorm' : 'close'} stroke={strokeColor} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
                )}
                {chartType === 'line' && (
                  <Line yAxisId="price" type="monotone" dataKey={compareLines.length > 0 ? '_baseNorm' : 'close'} stroke={strokeColor} strokeWidth={2} dot={false} />
                )}
                {chartType === 'bar' && (
                  <Bar yAxisId="price" dataKey="close" fill={strokeColor} opacity={0.7} />
                )}
                {chartType === 'candle' && (
                  <Area yAxisId="price" type="monotone" dataKey="close" stroke={strokeColor} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
                )}

                {/* Comparison lines */}
                {compareLines.map(id => {
                  const opt = COMPARE_OPTIONS.find(o => o.id === id);
                  return opt ? (
                    <Line key={id} yAxisId="price" type="monotone" dataKey={id} stroke={opt.color} strokeWidth={1.5} dot={false} />
                  ) : null;
                })}

                {/* Overlay indicators */}
                {activeIndicators.includes('sma20') && <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.2} dot={false} strokeDasharray="4 2" />}
                {activeIndicators.includes('sma50') && <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="#60a5fa" strokeWidth={1.2} dot={false} strokeDasharray="4 2" />}
                {activeIndicators.includes('sma200') && <Line yAxisId="price" type="monotone" dataKey="sma200" stroke="#f472b6" strokeWidth={1.2} dot={false} strokeDasharray="4 2" />}
                {activeIndicators.includes('ema20') && <Line yAxisId="price" type="monotone" dataKey="ema20" stroke="#a78bfa" strokeWidth={1.2} dot={false} />}
                {activeIndicators.includes('ema50') && <Line yAxisId="price" type="monotone" dataKey="ema50" stroke="#818cf8" strokeWidth={1.2} dot={false} />}
                {activeIndicators.includes('wma') && <Line yAxisId="price" type="monotone" dataKey="wma" stroke="#fb923c" strokeWidth={1.2} dot={false} />}
                {activeIndicators.includes('vwap') && <Line yAxisId="price" type="monotone" dataKey="vwap" stroke="#38bdf8" strokeWidth={1.5} dot={false} strokeDasharray="5 2" />}
                {activeIndicators.includes('bb') && <>
                  <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#34d399" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                  <Line yAxisId="price" type="monotone" dataKey="bbMid" stroke="#34d39966" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                  <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#34d399" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                </>}
                {activeIndicators.includes('prevclose') && (
                  <ReferenceLine yAxisId="price" y={firstClose} stroke="#94a3b8" strokeDasharray="4 2" strokeWidth={1} />
                )}
                {activeIndicators.includes('high52') && (
                  <ReferenceLine yAxisId="price" y={Math.max(...chartData.map(d => d.high))} stroke="#34d399" strokeDasharray="3 2" strokeWidth={0.8} />
                )}
                {activeIndicators.includes('low52') && (
                  <ReferenceLine yAxisId="price" y={Math.min(...chartData.map(d => d.low))} stroke="#f87171" strokeDasharray="3 2" strokeWidth={0.8} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Sub Panels */}
          {(showVolume || showRSI || showMACD || showStoch || showATR || showOBV) && (
            <div className="border-t border-border/30 flex-shrink-0">
              {showVolume && (
               <div style={{ height: `clamp(70px, 15vh, 90px)` }}>
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={60} tickFormatter={v => (v / 1e6).toFixed(1) + 'M'} />
                      <Bar dataKey="volume" fill="#6b728033" />
                      <text x={8} y={14} fill="#6b7280" fontSize={9} fontFamily="monospace">VOL</text>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {showRSI && (
               <div style={{ height: `clamp(70px, 15vh, 90px)` }} className="border-t border-border/30">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={60} domain={[0, 100]} ticks={[30, 50, 70]} />
                      <ReferenceLine y={70} stroke="#f87171" strokeDasharray="3 3" strokeWidth={0.8} />
                      <ReferenceLine y={30} stroke="#34d399" strokeDasharray="3 3" strokeWidth={0.8} />
                      <Line type="monotone" dataKey="rsi" stroke="#f97316" strokeWidth={1.5} dot={false} />
                      <text x={8} y={14} fill="#6b7280" fontSize={9} fontFamily="monospace">RSI(14)</text>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {showMACD && (
               <div style={{ height: `clamp(70px, 15vh, 90px)` }} className="border-t border-border/30">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={60} />
                      <ReferenceLine y={0} stroke="#6b7280" strokeWidth={0.5} />
                      <Bar dataKey="macdHist" fill="#22d3ee33" />
                      <Line type="monotone" dataKey="macd" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="macdSignal" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                      <text x={8} y={14} fill="#6b7280" fontSize={9} fontFamily="monospace">MACD</text>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {showStoch && (
               <div style={{ height: `clamp(70px, 15vh, 90px)` }} className="border-t border-border/30">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={60} domain={[0, 100]} ticks={[20, 50, 80]} />
                      <ReferenceLine y={80} stroke="#f87171" strokeDasharray="3 3" strokeWidth={0.8} />
                      <ReferenceLine y={20} stroke="#34d399" strokeDasharray="3 3" strokeWidth={0.8} />
                      <Line type="monotone" dataKey="stochK" stroke="#84cc16" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="stochD" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                      <text x={8} y={14} fill="#6b7280" fontSize={9} fontFamily="monospace">STOCH</text>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {showATR && (
               <div style={{ height: `clamp(70px, 15vh, 90px)` }} className="border-t border-border/30">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={60} />
                      <Line type="monotone" dataKey="atr" stroke="#fb7185" strokeWidth={1.5} dot={false} />
                      <text x={8} y={14} fill="#6b7280" fontSize={9} fontFamily="monospace">ATR(14)</text>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {showOBV && (
               <div style={{ height: `clamp(70px, 15vh, 90px)` }} className="border-t border-border/30">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={60} tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
                      <Line type="monotone" dataKey="obv" stroke="#34d399" strokeWidth={1.5} dot={false} />
                      <text x={8} y={14} fill="#6b7280" fontSize={9} fontFamily="monospace">OBV</text>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Bottom status bar */}
          <div className="flex items-center gap-4 px-4 h-7 border-t border-border/30 text-[10px] text-muted-foreground/60 flex-shrink-0 bg-card/50">
            <span className="font-mono">{range} · {interval}</span>
            <span className="flex items-center gap-1">
              <div className={cn('w-1.5 h-1.5 rounded-full', fsRealCandles ? 'bg-emerald-400/80' : 'bg-amber-400/60')} />
              {fsRealCandles ? 'Live data · Finnhub' : 'Sample data'}
            </span>
            {activeTool !== 'cursor' && (
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{activeTool} tool active</span>
            )}
            <span className="ml-auto font-mono">{new Date().toLocaleTimeString()}</span>
            {privacyMode && <span className="text-amber-400/70">🔒 Privacy</span>}
          </div>
        </div>

        {/* Right Panel (hidden on mobile) */}
        {rightPanelOpen && !isMobile && (
          <div className="w-48 lg:w-56 border-l border-border bg-card flex-shrink-0 flex flex-col overflow-y-auto">
            <div className="p-2.5 border-b border-border flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Panel</span>
              <button onClick={() => setRightPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* OHLCV */}
            <div className="p-2.5 border-b border-border/50 space-y-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Last Bar</p>
              {[
                { label: 'O', value: lastPoint.open, color: 'text-foreground' },
                { label: 'H', value: lastPoint.high, color: 'text-emerald-400' },
                { label: 'L', value: lastPoint.low, color: 'text-red-400' },
                { label: 'C', value: lastPoint.close, color: isUp ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Vol', value: lastPoint.volume ? (lastPoint.volume / 1e6).toFixed(2) + 'M' : '—', color: 'text-foreground', noPrice: true },
              ].map(({ label, value, color, noPrice }) => (
                <div key={label} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn('font-mono', color)}>
                    {privacyMode ? '••••' : (noPrice ? value : value ? `$${value.toFixed(2)}` : '—')}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="p-2.5 border-b border-border/50 space-y-0.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Actions</p>
              {[
                { icon: Bookmark, label: 'Add to Watchlist' },
                { icon: Bell, label: 'Add Alert' },
                { icon: StickyNote, label: 'Add Note' },
                { icon: Sparkles, label: 'AI Report' },
                { icon: Newspaper, label: 'News' },
              ].map(({ icon: Icon, label }) => (
                <button key={label} className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors text-left">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {label}
                </button>
              ))}
            </div>

            {/* Active indicators summary */}
            <div className="p-2.5 space-y-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Active Indicators</p>
              {activeIndicators.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/50">None active</p>
              ) : activeIndicators.map(id => {
                const ind = ALL_INDICATORS.find(i => i.id === id);
                return ind ? (
                  <div key={id} className="flex items-center gap-2 text-[11px]">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ind.color }} />
                    <span className="text-muted-foreground flex-1 truncate">{ind.label}</span>
                    <button onClick={() => toggleIndicator(id)} className="text-muted-foreground/50 hover:text-red-400 transition-colors flex-shrink-0">×</button>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Right panel collapsed tab (hidden on mobile) */}
        {!rightPanelOpen && !isMobile && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="w-4 flex items-center justify-center border-l border-border bg-card/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="Open Panel"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}