/**
 * Shared chart tooltip utilities — used across all charts for consistent,
 * theme-aware, readable hover styles. Never uses black text on dark backgrounds.
 */
import React from 'react';
import { formatCurrency } from '@/components/shared/ValueDisplay';

// The base contentStyle passed to Recharts <Tooltip contentStyle={...} />
export const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: '11px',
  color: 'hsl(var(--foreground))',
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
};

// itemStyle passed to <Tooltip itemStyle={...} />
export const TOOLTIP_ITEM_STYLE = {
  color: 'hsl(var(--foreground))',
  fontSize: '11px',
};

// labelStyle passed to <Tooltip labelStyle={...} />
export const TOOLTIP_LABEL_STYLE = {
  color: 'hsl(var(--muted-foreground))',
  fontSize: '10px',
  marginBottom: '4px',
};

/**
 * CustomLineTooltip — for line/area charts (portfolio, performance).
 * Shows date label + one row per series with colored dot.
 */
export function CustomLineTooltip({ active, payload, label, privacyMode, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const dateLabel = labelFormatter
    ? labelFormatter(label)
    : (label ? new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ ...TOOLTIP_LABEL_STYLE, borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px', marginBottom: '6px' }}>
        {dateLabel}
      </p>
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const displayVal = privacyMode ? '••••••' : (formatter ? formatter(entry.value, entry.name)[0] : entry.value);
          const displayName = formatter ? formatter(entry.value, entry.name)[1] : entry.name;
          return (
            <div key={i} className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color || entry.stroke }} />
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}>{displayName}</span>
              </div>
              <span style={{ color: 'hsl(var(--foreground))', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
                {displayVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * CustomPieTooltip — for pie/donut charts.
 * Shows name, value (or masked), and percentage.
 */
export function CustomPieTooltip({ active, payload, privacyMode, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';

  return (
    <div style={TOOLTIP_STYLE}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.payload?.fill || item.color }} />
        <span style={{ color: 'hsl(var(--foreground))', fontSize: '11px', fontWeight: 600 }}>{item.name}</span>
      </div>
      <p style={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace', fontSize: '12px', fontWeight: 700 }}>
        {privacyMode ? '••••••' : formatCurrency(item.value)}
      </p>
      <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', marginTop: '2px' }}>
        {privacyMode ? '••••' : pct + '%'} of total
      </p>
    </div>
  );
}

/**
 * CustomStockTooltip — for OHLC/stock charts.
 */
export function CustomStockTooltip({ active, payload, label, privacyMode }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const mask = '••••';

  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ ...TOOLTIP_LABEL_STYLE, borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px', marginBottom: '6px' }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: '11px' }}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>O</span>
        <span style={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace' }}>{privacyMode ? mask : ('$' + d.open?.toFixed(2))}</span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>H</span>
        <span style={{ color: '#34d399', fontFamily: 'monospace' }}>{privacyMode ? mask : ('$' + d.high?.toFixed(2))}</span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>L</span>
        <span style={{ color: '#f87171', fontFamily: 'monospace' }}>{privacyMode ? mask : ('$' + d.low?.toFixed(2))}</span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>C</span>
        <span style={{ color: 'hsl(var(--foreground))', fontFamily: 'monospace', fontWeight: 700 }}>{privacyMode ? mask : ('$' + d.close?.toFixed(2))}</span>
      </div>
      {d.volume && (
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', borderTop: '1px solid hsl(var(--border))', paddingTop: '4px', marginTop: '6px' }}>
          Vol: {(d.volume / 1e6).toFixed(2)}M
        </p>
      )}
    </div>
  );
}