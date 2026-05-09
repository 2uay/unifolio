import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { safeNumber, safeArray, safeDivide } from '@/lib/safeNum';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { CustomLineTooltip } from '@/lib/chartTooltip';
import { BENCHMARKS, COMMON_BENCHMARKS, fetchBenchmarkSeries, alignBenchmarkSeriesToDates } from '@/lib/benchmarks';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { useTheme } from '@/lib/ThemeContext';

const PERIOD_MAP = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

// Reusable hook to close dropdown on outside click
function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

// ---------- AccountsDropdown ----------
function AccountsDropdown({ selectedAccounts, onToggle, accounts = [], institutions = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const safeAccounts = safeArray(accounts);
  const safeInstitutions = safeArray(institutions);
  const connectedInsts = safeInstitutions.filter(i => (i.connection_status ?? i.status ?? 'connected') === 'connected');

  // Summary label
  let label;
  if (selectedAccounts.includes('__all__')) {
    label = 'All';
  } else if (selectedAccounts.length === 1) {
    // Try to find a nice name
    const val = selectedAccounts[0];
    if (val.startsWith('inst_')) {
      const inst = safeInstitutions.find(i => 'inst_' + i.id === val);
      label = inst ? inst.name.split(' ')[0] : '1 selected';
    } else {
      const acc = safeAccounts.find(a => a.id === val);
      label = acc ? (acc.account_type ?? acc.type) : '1 selected';
    }
  } else {
    label = `${selectedAccounts.length} selected`;
  }

  const isActive = (val) => selectedAccounts.includes(val);

  const groups = [
    { id: '__all__', label: 'All Accounts' },
    ...connectedInsts.map(i => ({ id: 'inst_' + i.id, label: `All ${i.name}` })),
    ...['TFSA','RRSP','FHSA','Margin','Cash','Crypto'].map(t => ({ id: 'type_' + t, label: `All ${t}` })),
  ];

  // Handle type_ prefix in parent toggle too — we pass up, parent handles it
  const individualAccounts = safeAccounts.filter(acc => {
    const inst = safeInstitutions.find(i => i.id === (acc.institution_id ?? acc.institutionId));
    return !inst || (inst.connection_status ?? inst.status ?? 'connected') === 'connected';
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
          open || !selectedAccounts.includes('__all__')
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80'
        )}
      >
        <span className="font-medium">Accounts</span>
        <span className="text-[10px] opacity-70">· {label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <button onClick={() => onToggle('__all__')} className="text-[10px] text-primary hover:underline">Select All</button>
            <button
              onClick={() => { onToggle('__clear__'); }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >Clear</button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {/* Groups */}
            <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground/60">Groups</p>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => onToggle(g.id)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
              >
                <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                  isActive(g.id) ? 'bg-primary border-primary' : 'border-border'
                )}>
                  {isActive(g.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className={isActive(g.id) ? 'text-foreground' : 'text-muted-foreground'}>{g.label}</span>
              </button>
            ))}

            {/* Individual accounts */}
            <p className="px-3 pt-3 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground/60">Individual</p>
            {individualAccounts.map(acc => {
              const inst = safeInstitutions.find(i => i.id === (acc.institution_id ?? acc.institutionId));
              return (
                <button
                  key={acc.id}
                  onClick={() => onToggle(acc.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left"
                >
                  <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                    isActive(acc.id) ? 'bg-primary border-primary' : 'border-border'
                  )}>
                    {isActive(acc.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className={isActive(acc.id) ? 'text-foreground' : 'text-muted-foreground'}>
                    {(acc.account_type ?? acc.type ?? acc.account_name ?? 'Account')} {inst?.name ? <span className="opacity-50">· {inst.name.split(' ')[0]}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- BenchmarksDropdown ----------
function BenchmarksDropdown({ activeBenchmarks, onToggle, benchmarkColors }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  let label;
  if (activeBenchmarks.length === 0) label = 'None';
  else if (activeBenchmarks.length === 1) label = BENCHMARKS.find(b => b.id === activeBenchmarks[0])?.label || '1 selected';
  else label = `${activeBenchmarks.length} selected`;

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
        <div className="absolute top-full left-0 mt-1.5 z-50 w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <button
              onClick={() => COMMON_BENCHMARKS.forEach(id => { if (!activeBenchmarks.includes(id)) onToggle(id); })}
              className="text-[10px] text-primary hover:underline"
            >Common</button>
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
                    ? { backgroundColor: benchmarkColors[b.id], borderColor: benchmarkColors[b.id] }
                    : { borderColor: 'hsl(var(--border))' }
                  }
                >
                  {activeBenchmarks.includes(b.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span style={{ color: activeBenchmarks.includes(b.id) ? benchmarkColors[b.id] : undefined }}
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

// ---------- Main Chart ----------
export default function PortfolioChart() {
  const { displayCurrency, isSample } = useCurrency();
  const { privacyMode } = usePrivacy();
  const { chartColors } = useTheme();
  const { portfolioSnapshots, accounts, institutions, calcAccountValue } = usePortfolioData();
  const safeAccounts = safeArray(accounts);
  const safeInstitutions = safeArray(institutions);
  const validBenchmarkIds = useMemo(() => new Set(BENCHMARKS.map(b => b.id)), []);
  const [period, setPeriod] = useState('1Y');
  const [viewMode, setViewMode] = useState('dollar');
  const [activeBenchmarks, setActiveBenchmarks] = useState(() => ['sp500', 'nasdaq', 'dow', 'btc', 'dxy'].filter(id => BENCHMARKS.some(b => b.id === id)));
  const [selectedAccounts, setSelectedAccounts] = useState(['__all__']);
  const [realBenchmarkSeries, setRealBenchmarkSeries] = useState({});
  const [benchmarkStatus, setBenchmarkStatus] = useState({});
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);

  const days = PERIOD_MAP[period] || 365;
  const baseSnapshots = safeArray(portfolioSnapshots).slice(-days);
  const hasChartData = baseSnapshots.length > 0;

  const accountSnapshotMap = useMemo(() => {
    const map = {};
    safeAccounts.forEach(acc => {
      const base = calcAccountValue(acc.id);
      map[acc.id] = baseSnapshots.map((snap, i) => {
        const divisor = Math.max(baseSnapshots.length, 1);
        const drift = base * (1 + (i / divisor) * 0.15 * Math.sin(i * 0.3 + String(acc.id || '').charCodeAt(0)));
        return Math.round(Math.abs(drift) * 100) / 100;
      });
    });
    return map;
  }, [safeAccounts, baseSnapshots, calcAccountValue]);

  const activeAccountIds = useMemo(() => {
    if (selectedAccounts.includes('__all__')) return safeAccounts.map(a => a.id);
    return safeAccounts.filter(acc => {
      if (selectedAccounts.includes(acc.id)) return true;
      if (selectedAccounts.includes('inst_' + (acc.institution_id ?? acc.institutionId))) return true;
      if (selectedAccounts.includes('type_' + (acc.account_type ?? acc.type))) return true;
      return false;
    }).map(a => a.id);
  }, [safeAccounts, selectedAccounts]);

  useEffect(() => {
    setActiveBenchmarks(prev => prev.filter(id => validBenchmarkIds.has(id)));
  }, [validBenchmarkIds]);

  // Fetch real candle data when benchmarks are enabled
  useEffect(() => {
    const enabledBenchmarks = activeBenchmarks.filter(id => validBenchmarkIds.has(id));
    if (enabledBenchmarks.length === 0 || !hasChartData) {
      setBenchmarkStatus({});
      return;
    }

    let cancelled = false;
    setBenchmarksLoading(true);
    fetchBenchmarkSeries(enabledBenchmarks, days)
      .then(({ series, status }) => {
        if (cancelled) return;
        setRealBenchmarkSeries(prev => ({ ...prev, ...series }));
        setBenchmarkStatus(status);
      })
      .catch(() => {
        if (!cancelled) {
          setBenchmarkStatus(Object.fromEntries(enabledBenchmarks.map(id => [id, 'fallback'])));
        }
      })
      .finally(() => {
        if (!cancelled) setBenchmarksLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeBenchmarks, days, hasChartData, validBenchmarkIds]);

  const chartData = useMemo(() => {
    const dates = baseSnapshots.map(snap => snap.date);
    const benchmarkSeries = {};
    BENCHMARKS.forEach(b => {
      if (!activeBenchmarks.includes(b.id)) return;
      benchmarkSeries[b.id] = alignBenchmarkSeriesToDates(realBenchmarkSeries[b.id], dates, b).map(point => point.close);
    });

    return baseSnapshots.map((snap, i) => {
      const row = { date: snap.date };
      let portfolioVal = 0;
      if (selectedAccounts.includes('__all__')) {
        portfolioVal = snap.value;
      } else {
        activeAccountIds.forEach(id => { portfolioVal += accountSnapshotMap[id]?.[i] || 0; });
      }
      row['portfolio'] = portfolioVal;
      Object.entries(benchmarkSeries).forEach(([id, arr]) => { row[id] = arr[i]; });
      return row;
    });
  }, [baseSnapshots, activeBenchmarks, activeAccountIds, selectedAccounts, accountSnapshotMap, realBenchmarkSeries]);

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
    if (!validBenchmarkIds.has(id)) return;
    setActiveBenchmarks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAccount = (val) => {
    if (val === '__all__') { setSelectedAccounts(['__all__']); return; }
    if (val === '__clear__') { setSelectedAccounts(['__all__']); return; }
    setSelectedAccounts(prev => {
      const next = prev.filter(x => x !== '__all__');
      if (next.includes(val)) {
        const result = next.filter(x => x !== val);
        return result.length === 0 ? ['__all__'] : result;
      }
      return [...next, val];
    });
  };

  const tickFormatter = privacyMode ? () => '••••' : (viewMode === 'pct' ? v => v.toFixed(1) + '%' : v => '$' + (v / 1000).toFixed(0) + 'K');
  const tooltipFormatter = (val, name) => {
    const label = name === 'portfolio' ? 'Portfolio' : (BENCHMARKS.find(b => b.id === name)?.label || name);
    if (privacyMode) return ['••••••', label];
    return viewMode === 'pct' ? [val.toFixed(2) + '%', label] : [formatCurrency(val), label];
  };

  const lineKeys = ['portfolio', ...activeBenchmarks.filter(id => validBenchmarkIds.has(id))];
  const benchmarkColors = Object.fromEntries(BENCHMARKS.map((b, i) => [b.id, chartColors[(i + 1) % chartColors.length] || b.color]));
  const lineColors = { portfolio: chartColors[0] || 'hsl(var(--primary))', ...benchmarkColors };
  const xInterval = Math.floor(displayData.length / 6);

  return (
    <div className="bg-card rounded-xl border border-border p-4 md:p-6 space-y-4">
      {/* Row 1: Title + view/period controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Portfolio Value</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{displayCurrency}</span>
          {viewMode === 'dollar' && isSample && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Uses latest available FX rate</span>
            </span>
          )}
          {activeBenchmarks.length > 0 && (
            <span className={cn(
              'flex items-center gap-1 text-[10px]',
              Object.values(benchmarkStatus).includes('fallback') ? 'text-amber-400/80' : 'text-emerald-400/80'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', benchmarksLoading ? 'bg-amber-400 animate-pulse' : Object.values(benchmarkStatus).includes('fallback') ? 'bg-amber-400' : 'bg-emerald-400')} />
              <span className="hidden sm:inline">
                {benchmarksLoading ? 'Loading benchmarks' : Object.values(benchmarkStatus).includes('fallback') ? 'Benchmark fallback' : 'Live benchmark data'}
              </span>
            </span>
          )}
        </div>
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
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList className="bg-secondary h-8">
              {['1M', '3M', '6M', '1Y'].map(p => (
                <TabsTrigger key={p} value={p} className="text-xs h-6 px-3">{p}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Row 2: Dropdown filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <AccountsDropdown
          selectedAccounts={selectedAccounts}
          onToggle={toggleAccount}
          accounts={safeAccounts}
          institutions={safeInstitutions}
        />
        <BenchmarksDropdown activeBenchmarks={activeBenchmarks} onToggle={toggleBenchmark} benchmarkColors={benchmarkColors} />
      </div>

      {/* Chart */}
      <div style={{ height: 'clamp(220px, 60vh, 520px)' }} className="w-full">
        {!hasChartData ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No performance snapshots yet</div>
        ) : activeAccountIds.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No accounts selected</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={xInterval}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={64} tickFormatter={tickFormatter} />
              <Tooltip content={<CustomLineTooltip privacyMode={privacyMode} formatter={tooltipFormatter} />} />
              {lineKeys.map(key => (
                <Line key={key} type="monotone" dataKey={key} stroke={lineColors[key] || 'hsl(var(--muted-foreground))'}
                  strokeWidth={key === 'portfolio' ? 2 : 1.5} dot={false}
                  strokeDasharray={key === 'portfolio' ? undefined : '4 2'} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded bg-primary" />
          <span className="text-muted-foreground">Portfolio</span>
        </div>
        {activeBenchmarks.map(id => {
          const b = BENCHMARKS.find(x => x.id === id);
          return b ? (
            <div key={id} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: benchmarkColors[id] }} />
              <span className="text-muted-foreground">{b.label}</span>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}
