import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X, Minus, Maximize2, Minimize2, BarChart2, LayoutDashboard,
  TrendingUp, TrendingDown, Bell, ArrowRightLeft, GripHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import { PnlValue, formatCurrency } from '@/components/shared/ValueDisplay';
import StockChart from '@/components/charts/StockChart';
import StockNotes from '@/components/watchlist/StockNotes';
import StockNews from '@/components/watchlist/StockNews';
import StockAIReport from '@/components/watchlist/StockAIReport';
import StarIcon from '@/components/shared/StarIcon';

function StatBox({ label, value }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-[11px] font-mono mt-0.5">{value}</p>
    </div>
  );
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const COMPACT_THRESHOLD = 360;

export default function FloatingResearchWindow({ win }) {
  const { closeWindow, focusWindow, updateWindow, clearFlash } = useResearchWindows();
  const { convert } = useCurrency();
  const { privacyMode } = usePrivacy();
  const { isStar, toggleStar } = useStarredStocks();
  const PM = '••••••';
  const isStarred = isStar(win.ticker);

  const windowRef = useRef(null);
  const dragState = useRef(null);
  const resizeState = useRef(null);

  const item = win.item;
  const isCompact = win.width < COMPACT_THRESHOLD;
  const isChartOnly = win.viewMode === 'chart';

  // Flash highlight effect
  useEffect(() => {
    if (win.flash) {
      const t = setTimeout(() => clearFlash(win.ticker), 600);
      return () => clearTimeout(t);
    }
  }, [win.flash, win.ticker, clearFlash]);

  // ── Drag ───────────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    focusWindow(win.ticker);
    dragState.current = {
      startX: e.clientX - win.x,
      startY: e.clientY - win.y,
    };
    const onMove = (e) => {
      if (!dragState.current) return;
      const x = Math.max(0, e.clientX - dragState.current.startX);
      const y = Math.max(0, e.clientY - dragState.current.startY);
      updateWindow(win.ticker, { x, y });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [win.x, win.y, win.ticker, focusWindow, updateWindow]);

  // ── Resize ─────────────────────────────────────────────────────
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.ticker);
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: win.width,
      startH: win.height,
    };
    const onMove = (e) => {
      if (!resizeState.current) return;
      const w = Math.max(MIN_WIDTH, resizeState.current.startW + e.clientX - resizeState.current.startX);
      const h = Math.max(MIN_HEIGHT, resizeState.current.startH + e.clientY - resizeState.current.startY);
      updateWindow(win.ticker, { width: w, height: h });
    };
    const onUp = () => {
      resizeState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [win.width, win.height, win.ticker, focusWindow, updateWindow]);

  const convertedPrice = item.lastPrice > 0 ? convert(item.lastPrice, item.currency || 'USD') : 0;
  const convertedChange = convert(item.change || 0, item.currency || 'USD');
  const convertedTarget = item.targetPrice ? convert(item.targetPrice, item.currency || 'USD') : null;
  const convertedHigh52 = item.high52 ? convert(item.high52, item.currency || 'USD') : null;
  const convertedLow52 = item.low52 ? convert(item.low52, item.currency || 'USD') : null;

  if (win.minimized) {
    return (
      <div
        className={cn(
          'fixed z-[200] select-none',
        )}
        style={{ left: win.x, top: win.y }}
        onClick={() => { focusWindow(win.ticker); updateWindow(win.ticker, { minimized: false }); }}
      >
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-xl cursor-pointer hover:border-primary/40 transition-colors">
          <span className="font-mono font-bold text-xs">{win.ticker}</span>
          <PnlValue value={win.item.changePct} isCurrency={false} className="text-[11px]" />
          <button
            onClick={(e) => { e.stopPropagation(); closeWindow(win.ticker); }}
            className="text-muted-foreground hover:text-foreground ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={windowRef}
      className={cn(
        'fixed flex flex-col bg-card border rounded-xl shadow-2xl select-none overflow-hidden transition-[box-shadow]',
        win.flash ? 'border-primary shadow-primary/20 shadow-2xl' : 'border-border',
      )}
      style={{
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      }}
      onMouseDown={() => focusWindow(win.ticker)}
    >
      {/* ── Header / Drag handle ─────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30 cursor-grab active:cursor-grabbing flex-shrink-0"
        onMouseDown={onDragStart}
      >
        <GripHorizontal className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm">{item.ticker}</span>
            <button
              onClick={(e) => { e.stopPropagation(); toggleStar(item.ticker); }}
              className="inline-flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
              title={isStarred ? 'Unstar' : 'Star'}
            >
              <StarIcon isStarred={isStarred} className="w-3.5 h-3.5" interactive={false} />
            </button>
            {!isCompact && <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>}
            <span className="font-mono text-xs text-foreground">{privacyMode ? '••••' : formatCurrency(convertedPrice)}</span>
            <PnlValue value={item.changePct} isCurrency={false} className="text-[11px]" />
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onMouseDown={e => e.stopPropagation()}>
          {/* View mode toggles */}
          {!isCompact && (
            <>
              <button
                title="Chart only"
                onClick={() => updateWindow(win.ticker, { viewMode: win.viewMode === 'chart' ? 'full' : 'chart' })}
                className={cn('p-1 rounded transition-colors', win.viewMode === 'chart' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <BarChart2 className="w-3 h-3" />
              </button>
              <button
                title="Full research"
                onClick={() => updateWindow(win.ticker, { viewMode: 'full' })}
                className={cn('p-1 rounded transition-colors', win.viewMode === 'full' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <LayoutDashboard className="w-3 h-3" />
              </button>
            </>
          )}
          <button
            title="Minimize"
            onClick={() => updateWindow(win.ticker, { minimized: true })}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            title="Close"
            onClick={() => closeWindow(win.ticker)}
            className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Chart — always shown unless compact with no space */}
        <div className={cn(isChartOnly ? 'p-2' : 'p-3 pb-0')}>
          <StockChart
            ticker={item.ticker}
            name={item.name}
            lastPrice={item.lastPrice || 100}
            seedVal={item.ticker.charCodeAt(0) * 31 + (item.ticker.charCodeAt(1) || 0) * 7}
            compact={true}
            containerHeight={Math.max(140, Math.min(300, win.height - 200))}
            nativeCurrency={item.currency || 'USD'}
          />
        </div>

        {/* Chart-only: stop here */}
        {!isChartOnly && (
          <div className="p-3 space-y-3">
            {/* Price + change */}
            {isCompact ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono">{privacyMode ? PM : formatCurrency(convertedPrice)}</span>
                <PnlValue value={convertedChange} className="text-sm" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono">{privacyMode ? PM : formatCurrency(convertedPrice)}</span>
                <PnlValue value={convertedChange} className="text-sm" />
              </div>
            )}

            {/* Stats grid */}
            <div className={cn('grid gap-1.5', isCompact ? 'grid-cols-2' : 'grid-cols-3')}>
              <StatBox label="Mkt Cap" value={item.marketCap || '—'} />
              <StatBox label="Volume" value={item.volume || '—'} />
              <StatBox label="P/E" value={item.pe || '—'} />
              {!isCompact && <>
                <StatBox label="52W Hi" value={privacyMode ? PM : (convertedHigh52 ? formatCurrency(convertedHigh52) : '—')} />
                <StatBox label="52W Lo" value={privacyMode ? PM : (convertedLow52 ? formatCurrency(convertedLow52) : '—')} />
                <StatBox label="Rating" value={item.analystRating || 'N/A'} />
              </>}
            </div>

            {/* Target price */}
            {convertedTarget && !isCompact && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Analyst Target</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {privacyMode ? PM : formatCurrency(convertedTarget)}
                  </span>
                  {item.lastPrice > 0 && !privacyMode && (
                    <span className={cn('text-xs font-mono', convertedTarget > convertedPrice ? 'text-emerald-400' : 'text-red-400')}>
                      {convertedTarget > convertedPrice ? '+' : ''}
                      {(((convertedTarget - convertedPrice) / convertedPrice) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={cn('grid gap-1.5', isCompact ? 'grid-cols-2' : 'grid-cols-4')}>
              <button className="flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                <TrendingUp className="w-3 h-3" /> Buy
              </button>
              <button className="flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                <TrendingDown className="w-3 h-3" /> Sell
              </button>
              <button className="flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-3 h-3" /> Alert
              </button>
              <button className="flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                <ArrowRightLeft className="w-3 h-3" /> Compare
              </button>
            </div>

            {/* Full research extras */}
            {win.viewMode === 'full' && !isCompact && (
              <>
                <div className="border-t border-border/40 pt-3">
                  <StockNotes ticker={item.ticker} />
                </div>
                <div className="border-t border-border/40 pt-3">
                  <StockNews ticker={item.ticker} />
                </div>
                <div className="border-t border-border/40 pt-3 pb-2">
                  <StockAIReport ticker={item.ticker} name={item.name} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Resize handle ────────────────────────────────────── */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-80 transition-opacity"
        onMouseDown={onResizeStart}
        style={{
          background: 'linear-gradient(135deg, transparent 50%, hsl(var(--muted-foreground)) 50%)',
          borderBottomRightRadius: '0.75rem',
        }}
      />
    </div>
  );
}