import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESETS = [
  { id: 'current', label: 'Current' },
  { id: '1m', label: '1 Month Ago' },
  { id: '3m', label: '3 Months Ago' },
  { id: '6m', label: '6 Months Ago' },
  { id: 'ytd', label: 'Year to Date' },
  { id: '1y', label: '1 Year Ago' },
  { id: 'custom_date', label: 'Custom Date' },
  { id: 'custom_range', label: 'Custom Range' },
];

function getPresetDates(id) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  switch (id) {
    case 'current': return { start: null, end: null, label: 'Current' };
    case '1m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 1);
      const s = d.toISOString().split('T')[0];
      return { start: s, end: s, label: '1 Month Ago' };
    }
    case '3m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      const s = d.toISOString().split('T')[0];
      return { start: s, end: s, label: '3 Months Ago' };
    }
    case '6m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 6);
      const s = d.toISOString().split('T')[0];
      return { start: s, end: s, label: '6 Months Ago' };
    }
    case 'ytd': {
      const s = `${now.getFullYear()}-01-01`;
      return { start: s, end: today, label: 'YTD' };
    }
    case '1y': {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
      const s = d.toISOString().split('T')[0];
      return { start: s, end: s, label: '1 Year Ago' };
    }
    default: return { start: null, end: null, label: 'Current' };
  }
}

export default function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [mode, setMode] = useState(value?.preset || 'current');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPreset = (id) => {
    setMode(id);
    if (id !== 'custom_date' && id !== 'custom_range') {
      const { start, end, label } = getPresetDates(id);
      onChange({ preset: id, start, end, label });
      setOpen(false);
    }
  };

  const applyCustomDate = () => {
    if (!customDate) return;
    onChange({ preset: 'custom_date', start: customDate, end: customDate, label: customDate });
    setOpen(false);
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    onChange({ preset: 'custom_range', start: customStart, end: customEnd, label: `${customStart} – ${customEnd}` });
    setOpen(false);
  };

  const isActive = value?.preset && value.preset !== 'current';

  const displayLabel = value?.label || 'Current';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
          isActive
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80'
        )}
      >
        <CalendarDays className="w-3 h-3" />
        <span className="font-medium">{displayLabel}</span>
        {isActive && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange({ preset: 'current', start: null, end: null, label: 'Current' }); setMode('current'); }}
            className="ml-0.5 hover:text-foreground"
          >
            <X className="w-2.5 h-2.5" />
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-64 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="py-1">
            {PRESETS.filter(p => p.id !== 'custom_date' && p.id !== 'custom_range').map(p => (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                className={cn(
                  'w-full text-left px-4 py-2 text-xs hover:bg-secondary transition-colors',
                  mode === p.id ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                {p.label}
              </button>
            ))}

            <div className="border-t border-border/50 mt-1 pt-1">
              {/* Custom Date */}
              <button
                onClick={() => setMode(mode === 'custom_date' ? 'current' : 'custom_date')}
                className={cn('w-full text-left px-4 py-2 text-xs hover:bg-secondary transition-colors',
                  mode === 'custom_date' ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                Custom Date
              </button>
              {mode === 'custom_date' && (
                <div className="px-4 pb-3 space-y-2">
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground"
                  />
                  <button
                    onClick={applyCustomDate}
                    disabled={!customDate}
                    className="w-full text-xs py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Custom Range */}
              <button
                onClick={() => setMode(mode === 'custom_range' ? 'current' : 'custom_range')}
                className={cn('w-full text-left px-4 py-2 text-xs hover:bg-secondary transition-colors',
                  mode === 'custom_range' ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                Custom Range
              </button>
              {mode === 'custom_range' && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">From</p>
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">To</p>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground"
                    />
                  </div>
                  <button
                    onClick={applyCustomRange}
                    disabled={!customStart || !customEnd}
                    className="w-full text-xs py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors disabled:opacity-40"
                  >
                    Apply Range
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}