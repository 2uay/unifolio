import React, { useState, useMemo } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_INDICATORS } from '@/lib/chartEngine';
import { useTheme } from '@/lib/ThemeContext';

const CATEGORIES = {
  trend: { label: 'Trend', icon: '📈' },
  momentum: { label: 'Momentum', icon: '⚡' },
  volatility: { label: 'Volatility', icon: '📊' },
  volume: { label: 'Volume', icon: '📦' },
  oscillator: { label: 'Oscillator', icon: '〰️' },
};

export default function IndicatorPanel({ activeIndicators, onToggle, onClearAll, onClose }) {
  const { chartColors } = useTheme();
  const [search, setSearch] = useState('');
  const getIndicatorColor = (id) => chartColors[ALL_INDICATORS.findIndex(i => i.id === id) % chartColors.length] || 'hsl(var(--primary))';

  const grouped = useMemo(() => {
    const g = {};
    ALL_INDICATORS.forEach(ind => {
      const cat = ind.category || 'trend';
      if (!g[cat]) g[cat] = [];
      g[cat].push(ind);
    });
    return g;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const g = {};
    Object.entries(grouped).forEach(([cat, inds]) => {
      const f = inds.filter(i => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
      if (f.length > 0) g[cat] = f;
    });
    return g;
  }, [search, grouped]);

  const selectedInds = ALL_INDICATORS.filter(i => activeIndicators.includes(i.id));

  return (
    <div className="w-72 max-h-96 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicators</span>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/50 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedInds.length > 0 && !search && (
          <>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/20 border-b border-border/30">
              Active ({selectedInds.length})
            </div>
            <div className="px-3 py-2 space-y-1">
              {selectedInds.map(ind => {
                const color = getIndicatorColor(ind.id);
                return (
                  <button
                    key={ind.id}
                    onClick={() => onToggle(ind.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-foreground truncate">{ind.label}</span>
                    </div>
                    <X className="w-3 h-3 text-muted-foreground flex-shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
            {Object.keys(filtered).length > 0 && <div className="border-t border-border/30" />}
          </>
        )}

        {/* Categories */}
        {Object.entries(filtered).map(([cat, inds]) => (
          <div key={cat}>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 bg-secondary/20">
              <span>{CATEGORIES[cat]?.icon}</span>
              {CATEGORIES[cat]?.label}
            </div>
            <div className="px-3 py-1.5 space-y-0.5">
              {inds.map(ind => {
                const isActive = activeIndicators.includes(ind.id);
                const color = getIndicatorColor(ind.id);
                return (
                  <button
                    key={ind.id}
                    onClick={() => onToggle(ind.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors text-left',
                      isActive ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.5 }} />
                      <span className="truncate">{ind.label}</span>
                    </div>
                    {isActive && <span className="text-primary text-[9px] font-semibold ml-1 flex-shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(filtered).length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">
            No indicators found
          </div>
        )}
      </div>

      {/* Footer */}
      {activeIndicators.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex gap-2 flex-shrink-0">
          <button
            onClick={onClearAll}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
