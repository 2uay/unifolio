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

const AUTO_SPEED = 0.5;
const FRICTION = 0.93;

function MiniSparkline({ values, isUp }) {
  const W = 44, H = 16;
  const pts = (values && values.length >= 2)
    ? values
    : (isUp ? [0, 0.4, 0.2, 0.6, 0.5, 0.8, 1] : [1, 0.6, 0.8, 0.4, 0.5, 0.2, 0]);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const coords = pts.map((v, i) =>
    `${(i / (pts.length - 1)) * W},${H - ((v - min) / range) * (H - 2) - 1}`
  ).join(' ');
  return (
    <svg width={W} height={H} className="flex-shrink-0 opacity-80">
      <polyline
        points={coords}
        fill="none"
        stroke={isUp ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExploreCarouselCard({ stock, onAdd, onDismiss, watchlists, currentWatchlistId, livePrice, liveChange, sparkline, isStarred, accentColor, theme }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { openWindow } = useResearchWindows();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  const displayPrice = livePrice !== undefined ? livePrice : stock.price;
  const displayChange = liveChange !== undefined ? liveChange : stock.changePct;
  const isUp = displayChange >= 0;
  const convertedPrice = convert(displayPrice, 'USD');

  useEffect(() => {
    if (livePrice !== undefined && livePrice !== stock.price) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(timer);
    }
  }, [livePrice]);

  const handleCardClick = (e) => {
    if (e.target.closest('button')) return;
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

  const bgColor = isUp ? 'rgba(34, 197, 94, 0.07)' : 'rgba(239, 68, 68, 0.07)';
  const accentColorValue = isUp ? '#22c55e' : '#ef4444';
  const borderColor = isUp ? 'rgba(34, 197, 94, 0.22)' : 'rgba(239, 68, 68, 0.22)';

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'relative group flex-shrink-0 w-40 rounded-md border transition-all duration-150 cursor-pointer hover:brightness-110',
        flash && 'animate-pulse'
      )}
      style={{ backgroundColor: bgColor, borderColor }}
    >
      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(stock.ticker); }}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 p-0.5 rounded text-muted-foreground/60 hover:text-foreground"
      >
        <X className="w-2.5 h-2.5" />
      </button>

      <div className="pt-1 px-2 pb-2 flex flex-col gap-0.5">
        {/* Row 1: Ticker + Sparkline */}
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono font-bold text-xs tracking-wide text-foreground truncate">
            {stock.ticker}
            {isStarred && (
              <span className="ml-0.5 text-[9px]" style={{ color: accentColor }}>★</span>
            )}
          </span>
          <MiniSparkline values={sparkline} isUp={isUp} />
        </div>

        {/* Row 2: Price + Change% | Add button */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="font-mono text-xs font-semibold tabular-nums leading-none">
              {privacyMode ? '••••' : `$${convertedPrice.toFixed(2)}`}
            </span>
            <span
              className="text-[10px] font-mono tabular-nums leading-none flex-shrink-0"
              style={{ color: accentColorValue }}
            >
              {privacyMode ? '••' : `${isUp ? '+' : ''}${displayChange.toFixed(2)}%`}
            </span>
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="w-5 h-5 flex items-center justify-center rounded transition-all duration-150"
              style={{ backgroundColor: accentColorValue + '20' }}
              title="Add to watchlist"
            >
              <Plus className="w-3 h-3" style={{ color: accentColorValue }} />
            </button>

            {menuOpen && (
              <div className="absolute bottom-full right-0 mb-1.5 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[140px]">
                {watchlists.map(wl => (
                  <button
                    key={wl.id}
                    onClick={(e) => { e.stopPropagation(); onAdd(stock, wl.id); setMenuOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary transition-colors',
                      wl.id === currentWatchlistId ? 'text-primary font-medium' : 'text-foreground'
                    )}
                  >
                    <span>{wl.icon}</span>
                    <span className="truncate">{wl.name}</span>
                    {wl.id === currentWatchlistId && (
                      <span className="ml-auto text-[9px] text-muted-foreground shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Company name */}
        <div className="text-[9px] text-muted-foreground truncate leading-none">
          {stock.name}
        </div>
      </div>
    </div>
  );
}

export default function ExploreCarousel({ watchlistTickers, watchlists, currentWatchlistId, onAddToWatchlist }) {
  const [seed, setSeed] = useState(0);
  const [dismissed, setDismissed] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { liveHoldings, registerTicker, liveDataEnabled } = useLiveData();
  const { theme } = useTheme();
  const { palette } = useSecondaryColors();
  const { isStar, toggleStar } = useStarredStocks();

  const stripRef = useRef(null);
  const offsetRef = useRef(0);
  const velRef = useRef(AUTO_SPEED);
  const isDraggingRef = useRef(false);
  const lastDragXRef = useRef(0);
  const halfWidthRef = useRef(0);
  const rafRef = useRef(null);

  const allStocks = getExploreStocks(watchlistTickers, seed);
  const displayStocks = useMemo(() => allStocks.filter(s => !dismissed.includes(s.ticker)), [allStocks, dismissed]);

  useEffect(() => {
    displayStocks.forEach(stock => { registerTicker(stock.ticker, 'stock'); });
  }, [displayStocks, registerTicker]);

  const accentColor = theme === 'bloomberg' ? '#FCD34D' : (palette?.accent || '#3B82F6');
  const carouselItems = displayStocks.length > 0 ? [...displayStocks, ...displayStocks] : [];

  useEffect(() => {
    if (!stripRef.current) return;
    halfWidthRef.current = stripRef.current.scrollWidth / 2;
  }, [carouselItems]);

  useEffect(() => {
    const tick = () => {
      if (!isDraggingRef.current) {
        if (Math.abs(velRef.current) > AUTO_SPEED * 1.5) {
          velRef.current *= FRICTION;
        } else {
          velRef.current = AUTO_SPEED;
        }
      }
      offsetRef.current += velRef.current;
      const half = halfWidthRef.current;
      if (half > 0) {
        offsetRef.current = ((offsetRef.current % half) + half) % half;
      }
      if (stripRef.current) {
        stripRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const getClientX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);

  const handleDragStart = (e) => {
    isDraggingRef.current = true;
    lastDragXRef.current = getClientX(e);
    velRef.current = 0;
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current) return;
    const x = getClientX(e);
    const dx = x - lastDragXRef.current;
    offsetRef.current -= dx;
    velRef.current = -dx;
    lastDragXRef.current = x;
    const half = halfWidthRef.current;
    if (half > 0) {
      offsetRef.current = ((offsetRef.current % half) + half) % half;
    }
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleRefresh = () => {
    setSpinning(true);
    setDismissed([]);
    setSeed(s => s + 1);
    setTimeout(() => setSpinning(false), 500);
  };

  const handleDismiss = (ticker) => {
    setDismissed(prev => [...prev, ticker]);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-foreground">Explore</span>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh recommendations"
        >
          <RefreshCw className={cn('w-3 h-3', spinning && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {displayStocks.length > 0 ? (
        <div
          className="relative bg-card/50 border border-border/60 rounded-xl p-1.5 overflow-hidden select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card/90 to-transparent z-10 pointer-events-none rounded-l-xl" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card/90 to-transparent z-10 pointer-events-none rounded-r-xl" />

          {/* Scrolling strip */}
          <div ref={stripRef} className="flex gap-1.5">
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
                  sparkline={liveData?.sparkline}
                  isStarred={isStar(stock.ticker)}
                  onStarClick={() => toggleStar(stock.ticker)}
                  accentColor={accentColor}
                  theme={theme}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card/50 rounded-xl border border-border p-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">All suggestions dismissed</p>
          <button onClick={handleRefresh} className="text-xs text-primary hover:underline transition-colors">
            Refresh recommendations
          </button>
        </div>
      )}
    </div>
  );
}
