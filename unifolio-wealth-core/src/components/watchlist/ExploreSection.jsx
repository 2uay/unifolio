import React, { useState } from 'react';
import { RefreshCw, Plus, X } from 'lucide-react';
import { getExploreStocks } from '@/lib/watchlistData';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { cn } from '@/lib/utils';

function TickerIcon({ ticker }) {
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];
  const idx = (ticker.charCodeAt(0) + (ticker.charCodeAt(1) || 0)) % colors.length;
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
      style={{ backgroundColor: colors[idx] + 'cc' }}
    >
      {ticker.slice(0, 2)}
    </div>
  );
}

function ExploreCard({ stock, onAdd, onDismiss, watchlists, currentWatchlistId }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { openWindow } = useResearchWindows();
  const [menuOpen, setMenuOpen] = useState(false);

  const convertedPrice = convert(stock.price, 'USD');
  const isUp = stock.changePct >= 0;

  const handleCardClick = () => {
    openWindow({
      ticker: stock.ticker,
      name: stock.name,
      lastPrice: stock.price,
      changePct: stock.changePct,
      change: 0,
      currency: 'USD',
      sector: stock.industry || stock.sector || null,
      assetClass: stock.assetClass || 'Equity',
    });
  };

  return (
    <div
      onClick={handleCardClick}
      className="relative group bg-card hover:bg-secondary/60 border border-border hover:border-primary/30 hover:shadow-md rounded-xl p-3.5 transition-all duration-150 flex flex-col gap-3 cursor-pointer"
    >
      {/* Dismiss — visible on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(stock.ticker); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/60 hover:text-foreground"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Row 1: icon + ticker + change % */}
      <div className="flex items-center gap-2 pr-4">
        <TickerIcon ticker={stock.ticker} />
        <span className="font-mono font-bold text-xs text-foreground tracking-wide">{stock.ticker}</span>
        <span className={cn(
          'ml-auto text-[11px] font-mono font-semibold tabular-nums',
          isUp ? 'text-emerald-400' : 'text-red-400'
        )}>
          {privacyMode ? '••••' : `${isUp ? '+' : ''}${stock.changePct.toFixed(2)}%`}
        </span>
      </div>

      {/* Row 2: company name */}
      <p className="text-[11px] text-muted-foreground truncate leading-none -mt-1">{stock.name}</p>

      {/* Row 3: price + add button */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {privacyMode ? '••••••' : `$${convertedPrice.toFixed(2)}`}
        </span>

        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/10 hover:bg-primary/25 text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute bottom-full right-0 mb-1.5 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[130px]">
              {watchlists.map(wl => (
                <button
                  key={wl.id}
                  onClick={e => { e.stopPropagation(); onAdd(stock, wl.id); setMenuOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary transition-colors',
                    wl.id === currentWatchlistId ? 'text-primary font-medium' : 'text-foreground'
                  )}
                >
                  <span>{wl.icon}</span>
                  <span className="truncate">{wl.name}</span>
                  {wl.id === currentWatchlistId && <span className="ml-auto text-[9px] text-muted-foreground shrink-0">current</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExploreSection({ watchlistTickers, watchlists, currentWatchlistId, onAddToWatchlist }) {
  const [seed, setSeed] = useState(0);
  const [dismissed, setDismissed] = useState([]);
  const [spinning, setSpinning] = useState(false);

  const allStocks = getExploreStocks(watchlistTickers, seed);
  const displayStocks = allStocks.filter(s => !dismissed.includes(s.ticker)).slice(0, 8);

  const handleRefresh = () => {
    setSpinning(true);
    setDismissed([]);
    setSeed(s => s + 1);
    setTimeout(() => setSpinning(false), 500);
  };

  return (
    <div className="bg-card/50 rounded-xl border border-border p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Explore</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Stocks you might like</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', spinning && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {displayStocks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {displayStocks.map(stock => (
            <ExploreCard
              key={stock.ticker + seed}
              stock={stock}
              onAdd={onAddToWatchlist}
              onDismiss={(ticker) => setDismissed(prev => [...prev, ticker])}
              watchlists={watchlists}
              currentWatchlistId={currentWatchlistId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground">All suggestions dismissed.</p>
          <button onClick={handleRefresh} className="mt-2 text-xs text-primary hover:underline">Refresh</button>
        </div>
      )}
    </div>
  );
}