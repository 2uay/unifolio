import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WatchlistDropdown({ watchlists, activeId, onSelect, onNew, onSelectStarred, showStarredOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = showStarredOnly ? { name: 'Starred Stocks', icon: '⭐' } : (watchlists.find(w => w.id === activeId) || watchlists[0]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-secondary text-sm hover:bg-secondary/80 transition-colors"
      >
        <span className="text-base leading-none">{active?.icon || '⭐'}</span>
        <span className="text-xs font-medium text-foreground">
          Watchlist: <span className="text-primary">{active?.name}</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-1">
            {/* Starred Stocks option */}
            <button
              onClick={() => { onSelectStarred?.(); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                showStarredOnly ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'
              )}
            >
              <Star className="w-4 h-4 flex-shrink-0 fill-current" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">Starred Stocks</p>
              </div>
              {showStarredOnly && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>

            {watchlists.length > 0 && <div className="border-t border-border/50 my-1"></div>}

            {watchlists.map(wl => (
              <button
                key={wl.id}
                onClick={() => { onSelect(wl.id); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                  activeId === wl.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'
                )}
              >
                <span className="text-base leading-none flex-shrink-0">{wl.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{wl.name}</p>
                  {wl.description && <p className="text-[10px] text-muted-foreground truncate">{wl.description}</p>}
                </div>
                {activeId === wl.id && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={() => { onNew(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Watchlist
            </button>
          </div>
        </div>
      )}
    </div>
  );
}