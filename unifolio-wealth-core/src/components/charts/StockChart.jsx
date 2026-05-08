import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, Maximize2, ExternalLink } from 'lucide-react';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { CustomStockTooltip } from '@/lib/chartTooltip';
import FullscreenChart from '@/components/charts/FullscreenChart';
import IndicatorPanel from '@/components/charts/IndicatorPanel';
import {
  generateOHLC, applyIndicators, toHeikinAshi,
  CHART_TYPES, TIME_RANGES, RANGE_DAYS, ALL_INDICATORS, DEFAULT_LAYOUT, loadChartLayout, saveChartLayout
} from '@/lib/chartEngine.js';
import { fetchStockCandles } from '@/lib/stockApi';

export default function StockChart({ ticker, name, lastPrice, seedVal = 42, compact = false, onChartClick, clickableChart = true, referenceLines = [], nativeCurrency = 'USD' }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { openWindow } = useResearchWindows();
  const saved = useMemo(() => loadChartLayout(), []);
  const chartContainerRef = useRef(null);

  const [range, setRange] = useState(saved?.range || DEFAULT_LAYOUT.range);
  const [chartType, setChartType] = useState(saved?.chartType || DEFAULT_LAYOUT.chartType);
  const [activeIndicators, setActiveIndicators] = useState(saved?.activeIndicators || DEFAULT_LAYOUT.activeIndicators);
  const [fullscreen, setFullscreen] = useState(false);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [realCandles, setRealCandles] = useState(null);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const indicatorRef = useRef(null);

  // Fetch real OHLCV candles from Finnhub; fall back to synthetic on failure
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setRealCandles(null);
    setCandlesLoading(true);
    fetchStockCandles(ticker, range).then(candles => {
      if (!cancelled) {
        setRealCandles(candles && candles.length >= 5 ? candles : null);
        setCandlesLoading(false);
      }
    }).catch(() => {
      if (!cancelled) { setRealCandles(null); setCandlesLoading(false); }
    });
    return () => { cancelled = true; };
  }, [ticker, range]);

  // Close indicator menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (indicatorRef.current && !indicatorRef.current.contains(e.target)) setShowIndicatorMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const days = RANGE_DAYS[range] || 90;
  const baseData = useMemo(() => {
    if (realCandles && realCandles.length >= 5) return realCandles;
    return generateOHLC(lastPrice || 100, seedVal, Math.min(days, 500));
  }, [realCandles, lastPrice, seedVal, days]);

  const chartData = useMemo(() => {
    let d = applyIndicators(baseData, activeIndicators);
    if (chartType === 'heikin') d = toHeikinAshi(d);
    return d;
  }, [baseData, activeIndicators, chartType]);

  const firstClose = chartData[0]?.close || 1;
  const lastClose = chartData[chartData.length - 1]?.close || 1;
  const pctChange = ((lastClose - firstClose) / firstClose) * 100;
  const isUp = pctChange >= 0;
  const strokeColor = isUp ? '#34d399' : '#f87171';
  const gradId = `grad-${ticker?.replace(/[^a-zA-Z0-9]/g, '') || 'stock'}`;

  const toggleIndicator = (id) => {
    const next = activeIndicators.includes(id)
      ? activeIndicators.filter(x => x !== id)
      : [...activeIndicators, id];
    setActiveIndicators(next);
    saveChartLayout({ chartType, range, activeIndicators: next });
  };

  const handleChartType = (ct) => {
    setChartType(ct);
    saveChartLayout({ chartType: ct, range, activeIndicators });
  };

  const handleRange = (r) => {
    setRange(r);
    saveChartLayout({ chartType, range: r, activeIndicators });
  };

  const handleChartClick = (e) => {
    // Only trigger on direct clicks to the chart container/background
    // Prevent triggers from control clicks
    if (!clickableChart) return;
    if (e.target !== chartContainerRef.current && chartContainerRef.current?.contains(e.target)) {
      // Check if click is on a control element (button, input, etc.)
      let el = e.target;
      while (el && el !== chartContainerRef.current) {
        if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.classList?.contains('recharts-')) {
          return;
        }
        el = el.parentElement;
      }
    }
    
    if (onChartClick) {
      onChartClick();
    } else {
      // Default behavior: open research window
      const stockData = {
        ticker,
        name,
        lastPrice: lastClose,
        changePct: pctChange,
        currency: 'USD',
      };
      openWindow(stockData);
    }
  };

  const showRSI = activeIndicators.includes('rsi');
  const showVolume = activeIndicators.includes('volume');
  const showMACD = activeIndicators.includes('macd');
  const showStoch = activeIndicators.includes('stoch');
  const showATR = activeIndicators.includes('atr');
  const showOBV = activeIndicators.includes('obv');
  const hasSubPanel = showRSI || showVolume || showMACD || showStoch || showATR || showOBV;
  const xInterval = Math.floor(chartData.length / (compact ? 4 : 6));
  const chartHeight = compact ? 160 : (hasSubPanel ? 240 : 300);
  const subHeight = compact ? 60 : 90;

  const TooltipComp = (props) => (
    <CustomStockTooltip
      {...props}
      privacyMode={privacyMode}
      firstClose={firstClose}
      activeIndicators={activeIndicators}
      allIndicators={ALL_INDICATORS}
    />
  );

  // Fullscreen overlay
  if (fullscreen) {
    return (
      <FullscreenChart
        ticker={ticker}
        name={name}
        lastPrice={lastPrice}
        seedVal={seedVal}
        chartData={chartData}
        realCandles={realCandles}
        range={range}
        chartType={chartType}
        activeIndicators={activeIndicators}
        onRangeChange={handleRange}
        onChartTypeChange={handleChartType}
        onIndicatorsChange={setActiveIndicators}
        onClose={() => setFullscreen(false)}
        nativeCurrency={nativeCurrency}
      />
    );
  }

  // Compact chart types (just area/line)
  const effectiveType = compact && !['area', 'line'].includes(chartType) ? 'area' : chartType;

  return (
    <div
      ref={chartContainerRef}
      onClick={handleChartClick}
      className={cn(
        'bg-card rounded-xl border overflow-hidden transition-all',
        clickableChart ? 'border-border hover:border-primary/40 hover:shadow-lg cursor-pointer group' : 'border-border'
      )}
    >
      {/* Toolbar */}
      <div className="px-4 pt-3 pb-1 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-3">
          <div>
            <span className="font-mono font-bold text-sm">{ticker}</span>
            {!compact && <span className="text-xs text-muted-foreground ml-2">{name}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-sm">{privacyMode ? '••••••' : `$${convert(lastClose, nativeCurrency).toFixed(2)}`}</span>
            <span className={cn('text-xs font-mono flex items-center gap-0.5', isUp ? 'text-emerald-400' : 'text-red-400')}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isUp ? '+' : ''}{pctChange.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Chart types (not compact) */}
          {!compact && (
            <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
              {CHART_TYPES.filter(ct => !ct.soon).map(ct => (
                <button
                  key={ct.id}
                  onClick={() => handleChartType(ct.id)}
                  className={cn('px-2 py-1 transition-colors', chartType === ct.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >{ct.label}</button>
              ))}
            </div>
          )}

          {/* Time range */}
          <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
            {(compact ? ['1M', '3M', '1Y'] : TIME_RANGES).map(r => (
              <button
                key={r}
                onClick={() => handleRange(r)}
                className={cn('px-2 py-1 transition-colors', range === r ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}
              >{r}</button>
            ))}
          </div>

          {/* Indicators (not compact) */}
          {!compact && (
            <div className="relative" ref={indicatorRef}>
              <button
                onClick={() => setShowIndicatorMenu(p => !p)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded border border-border flex items-center gap-1 transition-colors',
                  showIndicatorMenu ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Activity className="w-3 h-3" />
                Indicators
                {activeIndicators.length > 0 && (
                  <span className="bg-primary text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px]">{activeIndicators.length}</span>
                )}
              </button>
              {showIndicatorMenu && (
                <div className="absolute right-0 top-8 z-30">
                  <IndicatorPanel
                    activeIndicators={activeIndicators}
                    onToggle={toggleIndicator}
                    onClearAll={() => { setActiveIndicators([]); saveChartLayout({ chartType, range, activeIndicators: [] }); }}
                    onClose={() => setShowIndicatorMenu(false)}
                  />
                </div>
              )}
            </div>
          )}

          <button onClick={() => setFullscreen(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Fullscreen">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active indicator pills */}
      {activeIndicators.length > 0 && !compact && (
        <div className="px-4 pb-1 flex flex-wrap gap-1">
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
        </div>
      )}

      {/* Main chart */}
      <div style={{ height: `clamp(160px, ${compact ? '40vh' : '60vh'}, ${compact ? '180px' : '380px'})` }} className="relative group/chart w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
            <YAxis yAxisId="price" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} width={52} tickFormatter={v => privacyMode ? '••' : ('$' + v.toFixed(0))} domain={['auto', 'auto']} />
            <Tooltip content={<TooltipComp />} />

            {/* Price series */}
            {(effectiveType === 'area' || effectiveType === 'heikin') && (
              <Area yAxisId="price" type="monotone" dataKey="close" stroke={strokeColor} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} />
            )}
            {effectiveType === 'line' && (
              <Line yAxisId="price" type="monotone" dataKey="close" stroke={strokeColor} strokeWidth={1.5} dot={false} />
            )}
            {effectiveType === 'bar' && (
              <Bar yAxisId="price" dataKey="close" fill={strokeColor} opacity={0.7} />
            )}
            {effectiveType === 'candle' && (
              <Area yAxisId="price" type="monotone" dataKey="close" stroke={strokeColor} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} />
            )}

            {/* Overlay indicators */}
            {activeIndicators.includes('sma20') && <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 2" />}
            {activeIndicators.includes('sma50') && <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="#60a5fa" strokeWidth={1} dot={false} strokeDasharray="3 2" />}
            {activeIndicators.includes('sma200') && <Line yAxisId="price" type="monotone" dataKey="sma200" stroke="#f472b6" strokeWidth={1} dot={false} strokeDasharray="3 2" />}
            {activeIndicators.includes('ema20') && <Line yAxisId="price" type="monotone" dataKey="ema20" stroke="#a78bfa" strokeWidth={1} dot={false} />}
            {activeIndicators.includes('ema50') && <Line yAxisId="price" type="monotone" dataKey="ema50" stroke="#818cf8" strokeWidth={1} dot={false} />}
            {activeIndicators.includes('wma') && <Line yAxisId="price" type="monotone" dataKey="wma" stroke="#fb923c" strokeWidth={1} dot={false} />}
            {activeIndicators.includes('vwap') && <Line yAxisId="price" type="monotone" dataKey="vwap" stroke="#38bdf8" strokeWidth={1.2} dot={false} strokeDasharray="5 2" />}
            {activeIndicators.includes('bb') && <>
              <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#34d399" strokeWidth={0.8} dot={false} strokeDasharray="2 2" />
              <Line yAxisId="price" type="monotone" dataKey="bbMid" stroke="#34d39966" strokeWidth={0.8} dot={false} strokeDasharray="2 2" />
              <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#34d399" strokeWidth={0.8} dot={false} strokeDasharray="2 2" />
            </>}
            {activeIndicators.includes('prevclose') && (
              <ReferenceLine yAxisId="price" y={chartData[0]?.close} stroke="#94a3b8" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'Prev', fill: '#94a3b8', fontSize: 9 }} />
            )}
            {activeIndicators.includes('high52') && (
              <ReferenceLine yAxisId="price" y={Math.max(...chartData.map(d => d.high))} stroke="#34d399" strokeDasharray="4 2" strokeWidth={0.8} />
            )}
            {activeIndicators.includes('low52') && (
              <ReferenceLine yAxisId="price" y={Math.min(...chartData.map(d => d.low))} stroke="#f87171" strokeDasharray="4 2" strokeWidth={0.8} />
            )}
            {referenceLines.map((rl, i) => (
              <ReferenceLine
                key={`ext-${i}`}
                yAxisId="price"
                y={rl.price}
                stroke={rl.color || '#a78bfa'}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: rl.label, position: 'right', fill: rl.color || '#a78bfa', fontSize: 9 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        {/* Chart click indicator */}
        {clickableChart && !compact && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover/chart:opacity-100 transition-opacity flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary pointer-events-none">
            <ExternalLink className="w-3 h-3" />
            Open Research
          </div>
        )}
      </div>

      {/* Sub panels */}
      {hasSubPanel && (
        <div className="border-t border-border/30">
          {showVolume && (
            <div style={{ height: `clamp(60px, 20vh, 90px)` }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={52} tickFormatter={v => (v / 1e6).toFixed(1) + 'M'} />
                  <Bar dataKey="volume" fill="#6b728044" />
                  <text x={6} y={12} fill="#6b7280" fontSize={8} fontFamily="monospace">VOL</text>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {showRSI && (
           <div style={{ height: `clamp(60px, 20vh, 90px)` }} className="border-t border-border/30">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                  <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={52} domain={[0, 100]} ticks={[30, 50, 70]} />
                  <ReferenceLine y={70} stroke="#f87171" strokeDasharray="3 3" strokeWidth={0.8} />
                  <ReferenceLine y={30} stroke="#34d399" strokeDasharray="3 3" strokeWidth={0.8} />
                  <Line type="monotone" dataKey="rsi" stroke="#f97316" strokeWidth={1.2} dot={false} />
                  <text x={6} y={12} fill="#6b7280" fontSize={8} fontFamily="monospace">RSI(14)</text>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {showMACD && (
           <div style={{ height: `clamp(60px, 20vh, 90px)` }} className="border-t border-border/30">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 16, left: 0, bottom: 4 }}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6b7280' }} interval={xInterval} />
                  <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={52} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeWidth={0.5} />
                  <Bar dataKey="macdHist" fill="#22d3ee44" />
                  <Line type="monotone" dataKey="macd" stroke="#22d3ee" strokeWidth={1.2} dot={false} />
                  <Line type="monotone" dataKey="macdSignal" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                  <text x={6} y={12} fill="#6b7280" fontSize={8} fontFamily="monospace">MACD</text>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {showStoch && (
           <div style={{ height: `clamp(60px, 20vh, 90px)` }} className="border-t border-border/30">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 16, left: 0, bottom: 4 }}>
                  <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={52} domain={[0, 100]} ticks={[20, 50, 80]} />
                  <ReferenceLine y={80} stroke="#f87171" strokeDasharray="3 3" strokeWidth={0.8} />
                  <ReferenceLine y={20} stroke="#34d399" strokeDasharray="3 3" strokeWidth={0.8} />
                  <Line type="monotone" dataKey="stochK" stroke="#84cc16" strokeWidth={1.2} dot={false} />
                  <Line type="monotone" dataKey="stochD" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="3 2" />
                  <text x={6} y={12} fill="#6b7280" fontSize={8} fontFamily="monospace">STOCH</text>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {showATR && (
           <div style={{ height: `clamp(60px, 20vh, 90px)` }} className="border-t border-border/30">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 16, left: 0, bottom: 4 }}>
                  <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={52} />
                  <Line type="monotone" dataKey="atr" stroke="#fb7185" strokeWidth={1.2} dot={false} />
                  <text x={6} y={12} fill="#6b7280" fontSize={8} fontFamily="monospace">ATR(14)</text>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {showOBV && (
           <div style={{ height: `clamp(60px, 20vh, 90px)` }} className="border-t border-border/30">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 2, right: 16, left: 0, bottom: 4 }}>
                  <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#6b7280' }} width={52} tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
                  <Line type="monotone" dataKey="obv" stroke="#34d399" strokeWidth={1.2} dot={false} />
                  <text x={6} y={12} fill="#6b7280" fontSize={8} fontFamily="monospace">OBV</text>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Data source notice */}
      <div className="px-4 py-1.5 flex items-center gap-1.5">
        <div className={cn(
          'w-1.5 h-1.5 rounded-full',
          realCandles ? 'bg-emerald-400/80' : candlesLoading ? 'bg-amber-400/60 animate-pulse' : 'bg-amber-400/60'
        )} />
        <p className="text-[10px] text-muted-foreground/50">
          {realCandles ? 'Live data · Finnhub' : candlesLoading ? 'Loading…' : 'Sample data'}
        </p>
      </div>
    </div>
  );
}