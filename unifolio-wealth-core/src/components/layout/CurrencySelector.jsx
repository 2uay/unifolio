import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/lib/CurrencyContext';
import { hasRate } from '@/lib/exchangeRates';
import { cn } from '@/lib/utils';

export default function CurrencySelector({ collapsed = false, openUpward = false }) {
  const { displayCurrency, setDisplayCurrency, enabledCurrencies, allCurrencies } = useCurrency();
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
        <span>{displayCurrency}</span>
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
        </div>
      )}
    </div>
  );
}