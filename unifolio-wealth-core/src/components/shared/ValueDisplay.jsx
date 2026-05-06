import React from 'react';
import { cn } from '@/lib/utils';
import { safeNumber, safeCurrency, safeArray } from '@/lib/safeNum';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';

const CURRENCY_MASK = '••••••';
const PERCENT_MASK = '••••';

export function formatCurrency(value, compact = false) {
  return safeCurrency(value, compact);
}

export function formatPercent(value) {
  const n = safeNumber(value, null);
  if (n === null) return 'N/A';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

// Hook-free helper for use outside components — consumers should use usePrivacy().mask() directly
export function maskIfPrivate(value, privacyMode, maskStr = CURRENCY_MASK) {
  return privacyMode ? maskStr : value;
}

export function PnlValue({ value, className, showSign = true, isCurrency = true }) {
  const { privacyMode } = usePrivacy();
  const n = safeNumber(value, null);

  if (n === null) {
    return <span className={cn('font-mono text-sm tabular-nums text-muted-foreground', className)}>N/A</span>;
  }

  if (privacyMode) {
    return (
      <span className={cn('font-mono text-sm tabular-nums text-muted-foreground/50 tracking-widest', className)}>
        {isCurrency ? CURRENCY_MASK : PERCENT_MASK}
      </span>
    );
  }

  const isPositive = n >= 0;
  const display = isCurrency
    ? (n > 0 ? '+' : '') + safeCurrency(n)
    : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

  return (
    <span className={cn(
      'font-mono text-sm tabular-nums',
      isPositive ? 'text-emerald-400' : 'text-red-400',
      n === 0 && 'text-muted-foreground',
      className
    )}>
      {display}
    </span>
  );
}

export function MiniSparkline({ data, width = 80, height = 24, className }) {
  const arr = safeArray(data).filter(v => safeNumber(v, null) !== null);
  if (arr.length < 2) return null;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const isUp = arr[arr.length - 1] >= arr[0];

  const points = arr.map((v, i) => {
    const x = (i / (arr.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className={cn('inline-block', className)}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#34d399' : '#f87171'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel, sensitive = true }) {
  const { privacyMode } = usePrivacy();
  const displayValue = (sensitive && privacyMode) ? <span className="tracking-widest text-muted-foreground/50">{CURRENCY_MASK}</span> : value;

  return (
    <div className="stat-card-hover bg-card rounded-lg border border-border/40 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[9px] sm:text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">{title}</p>
          <p className="text-base sm:text-lg md:text-xl font-semibold font-mono tabular-nums truncate text-foreground">{displayValue}</p>
          {subtitle && <p className="text-[8px] sm:text-xs text-muted-foreground/60">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-1 rounded flex-shrink-0 opacity-60">
            <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
          </div>
        )}
      </div>
      {trend !== undefined && trend !== null && (
        <div className="mt-1.5 sm:mt-2 flex items-center gap-1">
          <PnlValue value={trend} isCurrency={false} className="text-[8px] sm:text-xs" />
          {trendLabel && <span className="text-[8px] sm:text-xs text-muted-foreground/60">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}