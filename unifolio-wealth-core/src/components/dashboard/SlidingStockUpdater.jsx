import React, { useMemo } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';
import { usePrivacy } from '@/lib/PrivacyContext';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import { useTheme } from '@/lib/ThemeContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { safeNumber } from '@/lib/safeNum';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

export default function SlidingStockUpdater({ activeHoldings = [] }) {
  const { liveHoldings, liveDataEnabled } = useLiveData();
  const { privacyMode } = usePrivacy();
  const { isStar } = useStarredStocks();
  const { theme } = useTheme();
  const { palette } = useSecondaryColors();
  const { holdings } = usePortfolioData();

  // Compile ticker items from active holdings only
  const baseTickerItems = useMemo(() => {
    const items = [];
    const seen = new Set();

    // Use passed-in active holdings (prioritize dashboard holdings)
    const holdingsToUse = activeHoldings.length > 0 ? activeHoldings : holdings.filter(h => safeNumber(h.quantity) > 0);

    holdingsToUse.slice(0, 15).forEach((h) => {
      if (!seen.has(h.ticker)) {
        seen.add(h.ticker);
        const liveData = liveHoldings[h.ticker];
        items.push({
          ticker: h.ticker,
          price: liveData?.price || safeNumber(h.current_price ?? h.lastPrice ?? 0),
          change: liveData?.dailyChangePercent || safeNumber(h.daily_pnl_percent ?? h.dailyPct ?? 0),
          isStarred: isStar(h.ticker)
        });
      }
    });

    return items.length > 0 ? items : [];
  }, [liveHoldings, activeHoldings, isStar]);

  // Duplicate just enough for seamless looping (3 times is safe)
  const tickerItems = useMemo(() => {
    if (baseTickerItems.length === 0) return [];
    return [...baseTickerItems, ...baseTickerItems, ...baseTickerItems];
  }, [baseTickerItems]);

  // Theme-aware colors
  const themeColors = {
    accent: theme === 'bloombergblack' ? '#FCD34D' : palette?.accent || '#3B82F6',
    gain: '#22c55e',
    loss: '#ef4444',
    neutral: '#9ca3af',
    separator: theme === 'bloombergblack' ? '#FCD34D40' : (palette?.accent ? palette.accent + '40' : '#3B82F640')
  };

  const getChangeColor = (change) => {
    if (change > 0) return themeColors.gain;
    if (change < 0) return themeColors.loss;
    return themeColors.neutral;
  };

  if (!liveDataEnabled || tickerItems.length === 0) {
    return null;
  }

  // CSS animation duration for smooth scrolling
  const animationDuration = `${tickerItems.length * 5}s`;

  const styles = `
    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-33.333%); }
    }
    .ticker-tape {
      animation: ticker-scroll ${animationDuration} linear infinite;
    }
  `;

  return (
    <div className="w-full">
      <style>{styles}</style>
      {/* Slim NASDAQ-style ticker */}
      <div
        className="relative bg-card/40 border-y border-border/40 overflow-hidden group w-full"
        style={{
          height: '32px',
          background: `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%)`,
          minHeight: '32px',
          maxHeight: '32px',
        }}>
        
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ backgroundColor: themeColors.accent, opacity: 0.5 }} />
        

        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card/80 to-transparent z-10 pointer-events-none" />

        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-card/80 to-transparent z-10 pointer-events-none" />

        {/* Moving text ticker */}
        <div
          className="ticker-tape flex items-center h-full gap-4 overflow-hidden opacity-80"
          style={{
            whiteSpace: 'nowrap',
            willChange: 'transform'
          }}>
          
          {tickerItems.map((item, idx) => (
            <div
              key={`${item.ticker}-${idx}`}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-0 select-none"
              style={{ minWidth: 'fit-content' }}>
              
              {/* Ticker + star */}
              <span className="font-mono font-bold text-[10px] sm:text-sm tracking-wider text-foreground pointer-events-none">
                {item.ticker}
                {item.isStarred && <span className="ml-0.5 text-amber-400">★</span>}
              </span>

              {/* Price + Change */}
              <span className="font-mono text-[8px] sm:text-xs text-muted-foreground pointer-events-none">
                {privacyMode ? '•••' : `$${item.price.toFixed(2)}`}
              </span>
              <span
                className="font-mono text-[8px] sm:text-xs font-semibold pointer-events-none"
                style={{ color: getChangeColor(item.change) }}>
                {privacyMode ? '•••' : `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`}
              </span>

              {/* Separator */}
              {idx < tickerItems.length - 1 && (
                <span
                  className="text-[8px] pointer-events-none"
                  style={{ color: themeColors.separator }}>
                  •
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ backgroundColor: themeColors.accent, opacity: 0.5 }} />
      </div>
    </div>
  );
}
