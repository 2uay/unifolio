import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Plus, X } from 'lucide-react';
import { getExploreStocks } from '@/lib/watchlistData';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { useLiveData } from '@/lib/LiveDataContext';
import { useTheme } from '@/lib/ThemeContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import { cn } from '@/lib/utils';
import TickerWithStar from '@/components/shared/TickerWithStar';

function ExploreCarouselCard({ stock, onAdd, onDismiss, watchlists, currentWatchlistId, livePrice, liveChange, isStarred, onStarClick, accentColor, theme }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { openWindow } = useResearchWindows();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  const displayPrice = livePrice !== undefined ? livePrice : stock.price;
  const displayChange = liveChange !== undefined ? liveChange : stock.changePct;
  const isUp = displayChange >= 0;
  const convertedPrice = convert(displayPrice, 'USD');

  // Flash effect when live price updates
  useEffect(() => {
    if (livePrice !== undefined && livePrice !== stock.price) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(timer);
    }
  }, [livePrice]);

  const handleCardClick = (e) => {
    if (e.target.closest('button')) return; // Don't trigger on button clicks
    openWindow({
      ticker: stock.ticker,
      name: stock.name,
      lastPrice: displayPrice,
      changePct: displayChange,
      change: 0,
      currency: 'USD',
      sector: stock.industry || stock.sector || null,
      assetClass: stock.assetClass || 'Equity',
    });
  };

  const bgColor = isUp ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
  const accentColorValue = isUp ? '#22c55e' : '#ef4444';
  const borderColor = isUp ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'relative group flex-shrink-0 w-52 rounded-lg border transition-all duration-150 cursor-pointer',
        'hover:bg-opacity-80',
        flash && 'animate-pulse'
      )}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(stock.ticker); }}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-black/10"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 h-full">
        {/* Row 1: Ticker + Star + Change % */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono font-bold text-sm tracking-wider text-foreground truncate">
              {stock.ticker}
            </span>
            {isStarred && (
              <span
                className="text-amber-400 text-[11px] flex-shrink-0"
                style={{ color: theme === 'bloomberg' ? '#FCD34D' : accentColor }}
              >
                ★
              </span>
            )}
          </div>
          <span
            className="text-[11px] font-mono font-semibold tabular-nums flex-shrink-0"
            style={{ color: accentColorValue }}
          >
            {privacyMode ? '••••' : `${isUp ? '+' : ''}${displayChange.toFixed(2)}%`}
          </span>
        </div>

        {/* Row 2: Company name */}
        <p className="text-[10px] text-muted-foreground truncate leading-tight">
          {stock.name}
        </p>

        {/* Row 3: Price + Add button */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border/30">
          <span className="font-mono text-base font-bold tabular-nums">
            {privacyMode ? '••••••' : `$${convertedPrice.toFixed(2)}`}
          </span>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(o => !o);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0"
              style={{
                backgroundColor: accentColorValue + '15',
                borderColor: accentColorValue + '40',
              }}
              title="Add to watchlist"
            >
              <Plus className="w-3.5 h-3.5" style={{ color: accentColorValue }} />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full right-0 mb-1.5 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[140px]">
                {watchlists.map(wl => (
                  <button
                    key={wl.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(stock, wl.id);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary transition-colors',
                      wl.id === currentWatchlistId ? 'text-primary font-medium' : 'text-foreground'
                    )}
                  >
                    <span>{wl.icon}</span>
                    <span className="truncate">{wl.name}</span>
                    {wl.id === currentWatchlistId && <span className="ml-auto text-[9px] text-muted-foreground shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExploreCarousel({ watchlistTickers, watchlists, currentWatchlistId, onAddToWatchlist }) {
  const [seed, setSeed] = useState(0);
  const [dismissed, setDismissed] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { liveHoldings, registerTicker, liveDataEnabled } = useLiveData();
  const { theme } = useTheme();
  const { palette } = useSecondaryColors();
  const { isStar, toggleStar } = useStarredStocks();
  const containerRef = useRef(null);

  const allStocks = getExploreStocks(watchlistTickers, seed);
  const displayStocks = useMemo(() => allStocks.filter(s => !dismissed.includes(s.ticker)), [allStocks, dismissed]);

  // Register tickers for live data
  useEffect(() => {
    displayStocks.forEach(stock => {
      registerTicker(stock.ticker, 'stock');
    });
  }, [displayStocks, registerTicker]);

  const accentColor = theme === 'bloomberg' ? '#FCD34D' : (palette?.accent || '#3B82F6');

  const handleRefresh = () => {
    setSpinning(true);
    setDismissed([]);
    setSeed(s => s + 1);
    setTimeout(() => setSpinning(false), 500);
  };

  const handleDismiss = (ticker) => {
    setDismissed(prev => [...prev, ticker]);
  };

  const carouselItems = displayStocks.length > 0 ? [...displayStocks, ...displayStocks] : [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Explore</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Discover stocks to add to your watchlist</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh recommendations"
        >
          <RefreshCw className={cn('w-3 h-3', spinning && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Carousel Container */}
      {displayStocks.length > 0 ? (
        <div className="relative group">
          {/* Top glow accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px] opacity-40 rounded-full"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}60`,
            }}
          />

          {/* Main carousel */}
          <div
            className="relative bg-gradient-to-r from-secondary/40 to-secondary/20 border border-border/60 rounded-xl p-3.5 overflow-hidden"
            style={{
              boxShadow: `inset 0 0 20px rgba(0,0,0,0.15), 0 4px 12px ${accentColor}10`,
            }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-secondary/80 to-transparent z-10 pointer-events-none rounded-l-xl" />

            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-secondary/80 to-transparent z-10 pointer-events-none rounded-r-xl" />

            {/* Scrolling container */}
            <div
              ref={containerRef}
              className="flex gap-3 overflow-hidden"
              style={{
                animation: isPaused || !liveDataEnabled ? 'none' : 'slideExplore 35s linear infinite',
              }}
            >
              {carouselItems.map((stock, idx) => {
                const liveData = liveHoldings[stock.ticker];
                return (
                  <ExploreCarouselCard
                    key={`${stock.ticker}-${idx}`}
                    stock={stock}
                    onAdd={onAddToWatchlist}
                    onDismiss={handleDismiss}
                    watchlists={watchlists}
                    currentWatchlistId={currentWatchlistId}
                    livePrice={liveData?.price}
                    liveChange={liveData?.dailyChangePercent}
                    isStarred={isStar(stock.ticker)}
                    onStarClick={() => toggleStar(stock.ticker)}
                    accentColor={accentColor}
                    theme={theme}
                  />
                );
              })}
            </div>
          </div>

          {/* Bottom glow accent line */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[1px] opacity-40 rounded-full"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}60`,
            }}
          />

          {/* Status indicator */}
          {!liveDataEnabled && (
            <div className="mt-2 text-[11px] text-muted-foreground/60 text-center">
              Enable live data in settings to see real-time prices
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card/50 rounded-xl border border-border p-8 text-center">
          <p className="text-xs text-muted-foreground mb-2">All suggestions dismissed</p>
          <button
            onClick={handleRefresh}
            className="text-xs text-primary hover:underline transition-colors"
          >
            Refresh recommendations
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideExplore {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-50% - 6px));
          }
        }
      `}</style>
    </div>
  );
}