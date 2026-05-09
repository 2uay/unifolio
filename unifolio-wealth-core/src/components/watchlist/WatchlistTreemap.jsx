import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { useTheme } from '@/lib/ThemeContext';

// Parse human-readable market cap string to a numeric value
function parseMarketCap(str) {
  if (!str) return 1;
  const s = String(str).replace(/[$,\s]/g, '');
  const num = parseFloat(s);
  if (isNaN(num)) return 1;
  if (s.endsWith('T')) return num * 1000;
  if (s.endsWith('B')) return num;
  if (s.endsWith('M')) return num / 1000;
  return num;
}

// Map changePct to a background color
function changePctToColor(pct) {
  const p = parseFloat(pct) || 0;
  if (p >= 3)   return 'hsl(var(--gain) / 0.56)';
  if (p >= 1)   return 'hsl(var(--gain) / 0.42)';
  if (p >= 0)   return 'hsl(var(--gain) / 0.26)';
  if (p > -1)   return 'hsl(var(--loss) / 0.26)';
  if (p > -3)   return 'hsl(var(--loss) / 0.42)';
  return         'hsl(var(--loss) / 0.56)';
}

// Squarified treemap algorithm
function squarify(items, rect) {
  if (!items.length) return [];
  const total = items.reduce((s, it) => s + it._value, 0);
  const area = rect.w * rect.h;
  const results = [];

  function layoutRow(row, x, y, w, h) {
    const rowTotal = row.reduce((s, it) => s + it._value, 0);
    const ratio = area > 0 ? (rowTotal / total) : 0;
    let pos = rect.w > rect.h ? { x, y, w: w * ratio / rect.w * rect.w, h } : { x, y, w, h: h * ratio / rect.h * rect.h };
    // simpler: use the shorter edge
    const isHoriz = rect.w >= rect.h;
    let cursor = isHoriz ? x : y;
    row.forEach(it => {
      const frac = rowTotal > 0 ? it._value / rowTotal : 0;
      if (isHoriz) {
        const cellH = h * (rowTotal / total);
        const cellW = w * frac * (total / rowTotal);
        results.push({ ...it, x, y: cursor, w: cellW, h: cellH });
        // actually let's redo this properly below
      }
    });
  }

  // Proper squarified implementation
  function squarifyRect(nodes, r) {
    if (!nodes.length) return;
    const totalVal = nodes.reduce((s, n) => s + n._value, 0);
    const rectArea = r.w * r.h;
    if (totalVal <= 0 || rectArea <= 0) return;

    // Try rows; pick whichever orientation maximizes aspect ratio
    function worstAspect(row, shortSide, total, rectArea) {
      const s = shortSide;
      const rowSum = row.reduce((a, n) => a + n._value, 0);
      const scale = rectArea / total;
      return row.reduce((worst, n) => {
        const A = (n._value / rowSum) * s * s * (rowSum / total) * (total / rectArea);
        const B = (rowSum / total * rectArea) / ((n._value / rowSum) * s);
        const aspect = Math.max(A / B, B / A);
        return Math.max(worst, isFinite(aspect) ? aspect : Infinity);
      }, 0);
    }

    // Simple slice-and-dice for reliability
    const isWide = r.w >= r.h;
    let remaining = [...nodes];
    let rx = r.x, ry = r.y, rw = r.w, rh = r.h;

    while (remaining.length > 0) {
      const remTotal = remaining.reduce((s, n) => s + n._value, 0);
      if (remTotal <= 0) break;

      // Take items for this row using squarified approach
      const shortSide = isWide ? rh : rw;
      let row = [remaining[0]];
      let i = 1;
      while (i < remaining.length) {
        const candidate = [...row, remaining[i]];
        const wa = worstAspect(candidate, shortSide, remTotal, rw * rh);
        const wb = worstAspect(row, shortSide, remTotal, rw * rh);
        if (wa > wb && row.length > 0) break;
        row = candidate;
        i++;
      }
      remaining = remaining.slice(row.length);

      const rowSum = row.reduce((s, n) => s + n._value, 0);
      const rowFrac = remTotal > 0 ? rowSum / remTotal : 0;

      if (isWide) {
        const rowW = rw * rowFrac;
        let cy = ry;
        row.forEach(n => {
          const cellH = rowSum > 0 ? rh * (n._value / rowSum) : 0;
          results.push({ ...n, x: rx, y: cy, w: rowW, h: cellH });
          cy += cellH;
        });
        rx += rowW;
        rw -= rowW;
      } else {
        const rowH = rh * rowFrac;
        let cx = rx;
        row.forEach(n => {
          const cellW = rowSum > 0 ? rw * (n._value / rowSum) : 0;
          results.push({ ...n, x: cx, y: ry, w: cellW, h: rowH });
          cx += cellW;
        });
        ry += rowH;
        rh -= rowH;
      }
    }
  }

  squarifyRect(items, rect);
  return results;
}

// Single treemap cell
function TreemapCell({ node, onOpen, chartColors }) {
  const area = node.w * node.h;
  const isLarge = area > 14000;
  const isMedium = area > 3500;
  const bgColor = changePctToColor(node.changePct);
  const pct = parseFloat(node.changePct) || 0;
  const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  const pctColor = pct >= 0 ? 'hsl(var(--gain))' : 'hsl(var(--loss))';

  const firstLetter = (node.ticker || node.name || '?')[0].toUpperCase();
  const letterColor = chartColors[(node.ticker?.charCodeAt(0) || 0) % chartColors.length];

  return (
    <div
      className="absolute overflow-hidden cursor-pointer transition-all duration-100 select-none group"
      style={{
        left: node.x + 1,
        top: node.y + 1,
        width: Math.max(0, node.w - 2),
        height: Math.max(0, node.h - 2),
        backgroundColor: bgColor,
        borderRadius: 3,
      }}
      onClick={() => onOpen(node)}
      title={`${node.ticker} — ${node.name}\n${pctStr}`}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      />

      {isLarge ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
            style={{ backgroundColor: letterColor }}
          >
            {firstLetter}
          </div>
          <span className="font-bold text-white text-base leading-none tracking-tight">{node.ticker}</span>
          <span className="font-semibold text-sm" style={{ color: pctColor }}>{pctStr}</span>
          {node.name && node.w > 100 && (
            <span className="text-[9px] text-white/50 truncate w-full text-center">{node.name}</span>
          )}
        </div>
      ) : isMedium ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1">
          <span className="font-bold text-white text-xs leading-none">{node.ticker}</span>
          <span className="text-[10px] font-semibold" style={{ color: pctColor }}>{pctStr}</span>
        </div>
      ) : node.w > 32 && node.h > 20 ? (
        <div className="absolute inset-0 flex items-center justify-center p-0.5">
          <span className="font-bold text-white text-[9px] leading-none truncate">{node.ticker}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function WatchlistTreemap({ items, height = 520 }) {
  const { openWindow } = useResearchWindows();
  const { chartColors } = useTheme();
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: height });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setDims({ w: Math.round(e.contentRect.width), h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [height]);

  // Group items by sector
  const grouped = {};
  items.forEach(item => {
    const sector = item.sector || 'Other';
    if (!grouped[sector]) grouped[sector] = [];
    grouped[sector].push(item);
  });

  // Build sector-level treemap (sectors sized by total market cap)
  const sectorNodes = Object.entries(grouped).map(([sector, sectorItems]) => ({
    sector,
    items: sectorItems,
    _value: sectorItems.reduce((s, it) => s + parseMarketCap(it.marketCap), 0),
  }));

  const sectorLayout = squarify(sectorNodes, { x: 0, y: 0, w: dims.w, h: dims.h });

  // For each sector block, layout individual stocks
  const allCells = [];
  sectorLayout.forEach(sectorRect => {
    const HEADER_H = sectorRect.h > 40 ? 18 : 0;
    const itemNodes = sectorRect.items.map(it => ({
      ...it,
      _value: parseMarketCap(it.marketCap),
    }));
    const stockLayout = squarify(itemNodes, {
      x: sectorRect.x,
      y: sectorRect.y + HEADER_H,
      w: sectorRect.w,
      h: sectorRect.h - HEADER_H,
    });
    stockLayout.forEach(node => allCells.push({ node, sector: sectorRect.sector, headerH: HEADER_H, sectorRect }));
  });

  const handleOpen = useCallback((node) => {
    openWindow(node);
  }, [openWindow]);

  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No securities to display.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-card rounded-xl border border-border overflow-hidden"
      style={{ height: dims.h }}
    >
      {/* Sector header labels */}
      {sectorLayout.map(sr => sr.h > 40 && (
        <div
          key={sr.sector}
          className="absolute z-10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/60 pointer-events-none"
          style={{ left: sr.x + 1, top: sr.y + 1, width: sr.w - 2, height: 18, overflow: 'hidden' }}
        >
          {sr.sector}
        </div>
      ))}

      {/* Stock cells */}
      {allCells.map(({ node }) => (
        <TreemapCell key={node.id || node.ticker} node={node} onOpen={handleOpen} chartColors={chartColors} />
      ))}
    </div>
  );
}
