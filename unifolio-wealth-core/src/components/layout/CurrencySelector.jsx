import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/lib/CurrencyContext';
import { hasRate } from '@/lib/exchangeRates';
import { cn } from '@/lib/utils';

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function CurrencySelector({ collapsed = false, openUpward = false }) {
  const { displayCurrency, setDisplayCurrency, enabledCurrencies, allCurrencies, bothMode, setBothMode, fxRates } = useCurrency();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const visibleCurrencies = allCurrencies.filter(c => enabledCurrencies.includes(c.code));

  const handleSelect = (code) => {
    if (!hasRate(code)) return; // block unsupported
    setDisplayCurrency(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title={collapsed ? `Currency: ${displayCurrency}` : undefined}
        className={cn(
          'flex items-center gap-1 rounded-lg border border-border bg-secondary text-xs font-mono font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/80',
          collapsed ? 'p-2 justify-center w-full' : 'px-2.5 py-1.5'
        )}
      >
        <span>{bothMode ? `${displayCurrency}+${displayCurrency === 'CAD' ? 'USD' : 'CAD'}` : displayCurrency}</span>
        {!collapsed && <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', open && 'rotate-180')} />}
      </button>

      {open && (
        <div className={cn(
          'absolute z-[9999] bg-card border border-border rounded-xl shadow-2xl overflow-hidden w-52',
          collapsed ? 'left-full ml-2 bottom-0' : openUpward ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0'
        )}>
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Display Currency</p>
          </div>
          <div className="px-3 py-2 border-b border-border/50">
            <button
              onClick={() => setBothMode(b => !b)}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors',
                bothMode ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              <span>Show Both Currencies</span>
              <span className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded',
                bothMode ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
              )}>
                {bothMode ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
          <div className="py-1">
            {visibleCurrencies.map(c => {
              const available = hasRate(c.code);
              const isActive = displayCurrency === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => handleSelect(c.code)}
                  disabled={!available}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    available ? 'hover:bg-secondary cursor-pointer' : 'opacity-40 cursor-not-allowed',
                    isActive && 'bg-primary/10'
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-mono font-bold flex-shrink-0',
                    isActive ? 'bg-primary text-white' : 'bg-secondary text-foreground'
                  )}>
                    {c.code.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold', isActive ? 'text-primary' : 'text-foreground')}>{c.code}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.name}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {isActive
                      ? <Check className="w-3.5 h-3.5 text-primary" />
                      : !available
                        ? <span className="text-[8px] text-muted-foreground/50 uppercase tracking-wide">Soon</span>
                        : null
                    }
                  </div>
                </button>
              );
            })}
          </div>
          {!hasRate(displayCurrency) && (
            <div className="px-3 py-2 border-t border-border/50 flex items-center gap-1.5 bg-amber-500/5">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <p className="text-[10px] text-amber-400">No rate available for {displayCurrency}</p>
            </div>
          )}

          {/* FX rates footer */}
          <div className="px-3 py-2.5 border-t border-border/50 bg-secondary/20 space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                fxRates?.isLive ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              )} />
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">
                {fxRates?.isLive ? 'Live FX' : 'Sample Rate'}
              </p>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">1 USD =</span>
              <span className="text-[10px] font-mono font-semibold">{fxRates?.usdToCad?.toFixed(4)} CAD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">1 CAD =</span>
              <span className="text-[10px] font-mono font-semibold">{fxRates?.cadToUsd?.toFixed(4)} USD</span>
            </div>
            {fxRates?.lastUpdated && (
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">Updated {formatRelativeTime(fxRates.lastUpdated)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}