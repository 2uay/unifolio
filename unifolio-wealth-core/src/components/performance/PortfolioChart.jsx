import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { portfolioSnapshots, accounts, institutions, calcAccountValue } from '@/lib/mockData';
import { safeNumber, safeArray, safeDivide } from '@/lib/safeNum';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
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

const PERIOD_MAP = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
const COMMON_BENCHMARKS = ['sp500', 'nasdaq', 'dow'];

// Reusable hook to close dropdown on outside click
function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

// ---------- AccountsDropdown ----------
function AccountsDropdown({ selectedAccounts, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const connectedInsts = institutions.filter(i => (i.connection_status ?? i.status) === 'connected');

  // Summary label
  let label;
  if (selectedAccounts.includes('__all__')) {
    label = 'All';
  } else if (selectedAccounts.length === 1) {
    // Try to find a nice name
    const val = selectedAccounts[0];
    if (val.startsWith('inst_')) {
      const inst = institutions.find(i => 'inst_' + i.id === val);
      label = inst ? inst.name.split(' ')[0] : '1 selected';
    } else {
      const acc = accounts.find(a => a.id === val);
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
  const individualAccounts = accounts.filter(acc => {
    const inst = institutions.find(i => i.id === (acc.institution_id ?? acc.institutionId));
    return inst && (inst.connection_status ?? inst.status) === 'connected';
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
              const inst = institutions.find(i => i.id === (acc.institution_id ?? acc.institutionId));
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
                    {(acc.account_type ?? acc.type)} <span className="opacity-50">· {inst?.name.split(' ')[0]}</span>
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
function BenchmarksDropdown({ activeBenchmarks, onToggle }) {
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
                    ? { backgroundColor: b.color, borderColor: b.color }
                    : { borderColor: 'hsl(225 15% 20%)' }
                  }
                >
                  {activeBenchmarks.includes(b.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span style={{ color: activeBenchmarks.includes(b.id) ? b.color : undefined }}
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
  const [period, setPeriod] = useState('1Y');
  const [viewMode, setViewMode] = useState('dollar');
  const [activeBenchmarks, setActiveBenchmarks] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState(['__all__']);

  const days = PERIOD_MAP[period] || 365;
  const baseSnapshots = safeArray(portfolioSnapshots).slice(-days);

  const accountSnapshotMap = useMemo(() => {
    const map = {};
    accounts.forEach(acc => {
      const base = calcAccountValue(acc.id);
      map[acc.id] = baseSnapshots.map((snap, i) => {
        const drift = base * (1 + (i / baseSnapshots.length) * 0.15 * Math.sin(i * 0.3 + acc.id.charCodeAt(0)));
        return Math.round(Math.abs(drift) * 100) / 100;
      });
    });
    return map;
  }, [days]);

  const activeAccountIds = useMemo(() => {
    if (selectedAccounts.includes('__all__')) return accounts.map(a => a.id);
    return accounts.filter(acc => {
      if (selectedAccounts.includes(acc.id)) return true;
      if (selectedAccounts.includes('inst_' + (acc.institution_id ?? acc.institutionId))) return true;
      if (selectedAccounts.includes('type_' + (acc.account_type ?? acc.type))) return true;
      return false;
    }).map(a => a.id);
  }, [selectedAccounts]);

  const chartData = useMemo(() => {
    const benchmarkSeries = {};
    BENCHMARKS.forEach(b => {
      if (activeBenchmarks.includes(b.id)) benchmarkSeries[b.id] = genBenchmark(b.base, b.seed, 0.3, days);
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
  }, [baseSnapshots, activeBenchmarks, activeAccountIds, selectedAccounts, days]);

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

  const lineKeys = ['portfolio', ...activeBenchmarks];
  const lineColors = { portfolio: 'hsl(var(--primary))', ...Object.fromEntries(BENCHMARKS.map(b => [b.id, b.color])) };
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
        <AccountsDropdown selectedAccounts={selectedAccounts} onToggle={toggleAccount} />
        <BenchmarksDropdown activeBenchmarks={activeBenchmarks} onToggle={toggleBenchmark} />
      </div>

      {/* Chart */}
      <div style={{ height: 'clamp(220px, 60vh, 520px)' }} className="w-full">
        {activeAccountIds.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No accounts selected</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} interval={xInterval}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} width={64} tickFormatter={tickFormatter} />
              <Tooltip content={<CustomLineTooltip privacyMode={privacyMode} formatter={tooltipFormatter} />} />
              {lineKeys.map(key => (
                <Line key={key} type="monotone" dataKey={key} stroke={lineColors[key] || '#6b7280'}
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
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: b.color }} />
              <span className="text-muted-foreground">{b.label}</span>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}