import React from 'react';

/**
 * Custom Recharts Bar shape that renders a proper OHLC candlestick.
 *
 * Requires the parent to:
 *   1. Set the YAxis domain explicitly to [priceMin, priceMax] so we can
 *      reconstruct the scale from the `background` prop.
 *   2. Pass priceMin and priceMax via the shape closure:
 *        shape={(p) => <CandlestickBar {...p} priceMin={min} priceMax={max} />}
 *
 * Recharts passes `background = { x, y, width, height }` (the chart plot area)
 * and `x, y, width, height` for the individual bar slot.
 */
export default function CandlestickBar({ x, y, width, background, payload, priceMin, priceMax }) {
  if (!payload || !background || width <= 0) return null;

  const { open, high, low, close } = payload;
  if (!close || !open) return null;

  const priceRange = priceMax - priceMin;
  if (priceRange <= 0) return null;

  // Scale: price value → SVG pixel y-coordinate (top of chart = high prices)
  const toPixel = (price) =>
    background.y + background.height * (1 - (price - priceMin) / priceRange);

  const yHigh  = toPixel(high  ?? Math.max(open, close));
  const yLow   = toPixel(low   ?? Math.min(open, close));
  const yOpen  = toPixel(open);
  const yClose = toPixel(close);

  const isUp      = close >= open;
  const color     = isUp ? '#34d399' : '#f87171';
  const bodyTop    = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
  const centerX    = x + width / 2;
  const bodyX      = x + 1;
  const bodyWidth  = Math.max(2, width - 2);

  return (
    <g>
      {/* High–Low wick */}
      <line x1={centerX} y1={yHigh} x2={centerX} y2={yLow} stroke={color} strokeWidth={1} opacity={0.7} />
      {/* Open–Close body */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        fillOpacity={isUp ? 0.2 : 0.85}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
}
