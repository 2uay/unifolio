import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { portfolioSnapshots } from '@/lib/mockData';
import { safeNumber, safeArray, safeDivide } from '@/lib/safeNum';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, AlertTriangle, Calendar } from 'lucide-react';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useTheme } from '@/lib/ThemeContext';
import { CustomLineTooltip } from '@/lib/chartTooltip';

function genBenchmark(base, seed, trend, points) {
  const data = [];
  let val = base;
  let r = seed;
  for (let i = 0; i < points; i++) {
    r = (r * 1664525 + 1013904223) & 0xffffffff;
    const rand = (r / 0xffffffff) - 0.45 + trend * 0.08;
    val += rand * base * 0.012;
    val = Math.max(val, base * 0.6);
    data.push(Math.round(val * 100) / 100);
  }
  return data;
}

const BENCHMARKS = [
  { id: 'sp500',    label: 'S&P 500',       color: '#f59e0b', base: 5200,  seed: 111 },
  { id: 'nasdaq',   label: 'NASDAQ-100',    color: '#a78bfa', base: 18000, seed: 222 },
  { id: 'dow',      label: 'Dow Jones',     color: '#60a5fa', base: 38000, seed: 333 },
  { id: 'russell',  label: 'Russell 2000',  color: '#34d399', base: 2000,  seed: 444 },
  { id: 'btc',      label: 'Bitcoin',       color: '#f97316', base: 65000, seed: 555 },
  { id: 'gold',     label: 'Gold',          color: '#fbbf24', base: 2300,  seed: 666 },
  { id: 'usmarket', label: 'US Total Mkt',  color: '#22d3ee', base: 220,   seed: 777 },
  { id: 'camarket', label: 'CA Total Mkt',  color: '#fb7185', base: 180,   seed: 888 },
];

const PERIODS = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL', 'Custom'];

// Return filtered snapshot array for a given period + custom date range
function filterSnapshots(allSnaps, period, customFrom, customTo) {
  if (!allSnaps.length) return allSnaps;
  if (period === 'ALL') return allSnaps;
  if (period === 'Custom') {
    return allSnaps.filter(s =>
      (!customFrom || s.date >= customFrom) && (!customTo || s.date <= customTo)
    );
  }
  if (period === 'YTD') {
    const ytd = `${new Date().getFullYear()}-01-01`;
    const filtered = allSnaps.filter(s => s.date >= ytd);
    return filtered.length ? filtered : allSnaps.slice(-30);
  }
  const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[period] || 365;
  return allSnaps.slice(-days);
}

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

function BenchmarksDropdown({ activeBenchmarks, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const label = activeBenchmarks.length === 0
    ? 'None'
    : activeBenchmarks.length === 1
    ? BENCHMARKS.find(b => b.id === activeBenchmarks[0])?.label || '1 selected'
    : `${activeBenchmarks.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
          open || activeBenchmarks.length > 0
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
            : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80'
        )}
      >
        <span className="font-medium">Benchmarks</span>
        <span className="text-[10px] opacity-70">· {label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-50 w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <button
              onClick={() => BENCHMARKS.forEach(b => { if (!activeBenchmarks.includes(b.id)) onToggle(b.id); })}
              className="text-[10px] text-primary hover:underline"
            >Select All</button>
            <button
              onClick={() => activeBenchmarks.forEach(id => onToggle(id))}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >Clear</button>
          </div>
          <div className="py-1">
            {BENCHMARKS.map(b => (
              <button
                key={b.id}
                onClick={() => onToggle(b.id)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
              >
                <span className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                  style={activeBenchmarks.includes(b.id)
                    ? { backgroundColor: b.color, borderColor: b.color }
                    : { borderColor: 'hsl(225 15% 20%)' }
                  }
                >
                  {activeBenchmarks.includes(b.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span
                  style={{ color: activeBenchmarks.includes(b.id) ? b.color : undefined }}
                  className={activeBenchmarks.includes(b.id) ? '' : 'text-muted-foreground'}
                >
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal styled date input for dark theme
function DateInput({ label, value, onChange, min, max }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary/60 [color-scheme:dark] cursor-pointer"
      />
    </label>
  );
}

export default function DashboardPortfolioChart() {
  const { displayCurrency, isSample, convert } = useCurrency();
  const { privacyMode } = usePrivacy();
  const { chartColors } = useTheme();
  const [period, setPeriod] = useState('1Y');
  const [viewMode, setViewMode] = useState('dollar');
  const [activeBenchmarks, setActiveBenchmarks] = useState([]);

  const allSnapshots = useMemo(() => safeArray(portfolioSnapshots), []);
  const dataMin = allSnapshots[0]?.date || '';
  const dataMax = allSnapshots[allSnapshots.length - 1]?.date || '';

  // Custom date range state
  const [customFrom, setCustomFrom] = useState(dataMin);
  const [customTo, setCustomTo] = useState(dataMax);

  const baseSnapshots = useMemo(
    () => filterSnapshots(allSnapshots, period, customFrom, customTo),
    [allSnapshots, period, customFrom, customTo]
  );

  const chartData = useMemo(() => {
    const n = baseSnapshots.length;
    const benchmarkSeries = {};
    BENCHMARKS.forEach(b => {
      if (activeBenchmarks.includes(b.id)) benchmarkSeries[b.id] = genBenchmark(b.base, b.seed, 0.3, n);
    });
    return baseSnapshots.map((snap, i) => {
      const portfolioVal = viewMode === 'dollar' ? convert(snap.value, 'CAD') : snap.value;
      const row = { date: snap.date, portfolio: portfolioVal };
      Object.entries(benchmarkSeries).forEach(([id, arr]) => { row[id] = arr[i]; });
      return row;
    });
  }, [baseSnapshots, activeBenchmarks, convert, displayCurrency, viewMode]);

  const displayData = useMemo(() => {
    if (viewMode === 'dollar') return chartData;
    const startRow = chartData[0] || {};
    return chartData.map(row => {
      const out = { date: row.date };
      Object.keys(row).forEach(k => {
        if (k === 'date') return;
        const base = safeNumber(startRow[k], 1) || 1;
        out[k] = parseFloat((safeDivide(safeNumber(row[k]) - base, base) * 100).toFixed(3));
      });
      return out;
    });
  }, [chartData, viewMode]);

  const toggleBenchmark = (id) => {
    setActiveBenchmarks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const tickFormatter = privacyMode ? () => '••••' : (viewMode === 'pct' ? v => v.toFixed(1) + '%' : v => '$' + (v / 1000).toFixed(0) + 'K');
  const tooltipFormatter = (val, name) => {
    const label = name === 'portfolio' ? 'Portfolio' : (BENCHMARKS.find(b => b.id === name)?.label || name);
    if (privacyMode) return ['••••••', label];
    return viewMode === 'pct' ? [val.toFixed(2) + '%', label] : [formatCurrency(val), label];
  };

  const lineKeys = ['portfolio', ...activeBenchmarks];
  const portfolioColor = chartColors[0] || '#3b82f6';
  const lineColors = { portfolio: portfolioColor, ...Object.fromEntries(BENCHMARKS.map(b => [b.id, b.color])) };
  const xInterval = Math.max(0, Math.floor(displayData.length / 6));

  return (
    <div className="bg-card rounded-xl border border-border p-4 md:p-6 space-y-3">
      {/* Title row */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Portfolio Value</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{displayCurrency}</span>
          {viewMode === 'dollar' && isSample && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Sample FX rate</span>
            </span>
          )}
        </div>

        {/* View mode + benchmarks */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            <button
              onClick={() => setViewMode('dollar')}
              className={cn('px-3 py-1.5 transition-colors', viewMode === 'dollar' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground')}
            >$ Value</button>
            <button
              onClick={() => setViewMode('pct')}
              className={cn('px-3 py-1.5 transition-colors', viewMode === 'pct' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground')}
            >% Return</button>
          </div>
          <BenchmarksDropdown activeBenchmarks={activeBenchmarks} onToggle={toggleBenchmark} />
        </div>
      </div>

      {/* Date / Period controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period quick-select pills */}
        <div className="flex items-center bg-secondary rounded-lg p-0.5 gap-0.5 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                // When switching to Custom, seed with current visible range
                if (p === 'Custom' && baseSnapshots.length) {
                  setCustomFrom(baseSnapshots[0].date);
                  setCustomTo(baseSnapshots[baseSnapshots.length - 1].date);
                }
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
                period === p
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'Custom' && <Calendar className="w-2.5 h-2.5" />}
              {p}
            </button>
          ))}
        </div>

        {/* Custom date inputs — shown only when Custom is selected */}
        {period === 'Custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <DateInput
              label="From"
              value={customFrom}
              min={dataMin}
              max={customTo || dataMax}
              onChange={setCustomFrom}
            />
            <span className="text-muted-foreground/40 text-xs">→</span>
            <DateInput
              label="To"
              value={customTo}
              min={customFrom || dataMin}
              max={dataMax}
              onChange={setCustomTo}
            />
            {/* Range summary */}
            {baseSnapshots.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60">
                {baseSnapshots.length} day{baseSnapshots.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: 'clamp(180px, 50vh, 380px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              interval={xInterval}
              tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              width={64}
              tickFormatter={tickFormatter}
            />
            <Tooltip
              content={<CustomLineTooltip privacyMode={privacyMode} formatter={tooltipFormatter} />}
            />
            {lineKeys.map(key => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={lineColors[key] || '#6b7280'}
                strokeWidth={key === 'portfolio' ? 2 : 1.5}
                dot={false}
                strokeDasharray={key === 'portfolio' ? undefined : '4 2'}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: portfolioColor }} />
          <span className="text-muted-foreground">Portfolio</span>
        </div>
        {activeBenchmarks.map(id => {
          const b = BENCHMARKS.find(x => x.id === id);
          return b ? (
            <div key={id} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: b.color }} />
              <span className="text-muted-foreground">{b.label}</span>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}
