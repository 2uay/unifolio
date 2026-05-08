import React, { useState } from 'react';
import { Link2, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { formatCurrency } from '@/components/shared/ValueDisplay';

const PLATFORM_LOGOS = {
  Polymarket: '📊',
  Kalshi: '🎯',
};

const STATUS_STYLES = {
  'Connected': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '✓ Connected' },
  'Not connected': { bg: 'bg-gray-500/10', text: 'text-gray-400', label: '✗ Not Connected' },
  'Syncing': { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '↻ Syncing...' },
  'Sync failed': { bg: 'bg-red-500/10', text: 'text-red-400', label: '✗ Sync Failed' },
  'API not supported yet': { bg: 'bg-amber-500/10', text: 'text-amber-400', label: '⏳ Coming Soon' },
  'Manual': { bg: 'bg-purple-500/10', text: 'text-purple-400', label: '↗ Manual' },
};

export default function PredictionMarketPlatformCard({ platform, connectedData }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const PM = '••••••';

  // If no connected data, show connection card
  if (!connectedData) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{PLATFORM_LOGOS[platform]}</span>
          <div>
            <h3 className="font-semibold">{platform}</h3>
            <p className="text-xs text-muted-foreground">Not connected</p>
          </div>
        </div>

        <div className="space-y-2 py-2 border-y border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className="text-amber-400">API not supported yet</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Accounts</span>
            <span className="font-semibold">0</span>
          </div>
        </div>

        <Button
          disabled
          className="w-full opacity-50 cursor-not-allowed gap-1.5"
          size="sm"
        >
          <Link2 className="w-3.5 h-3.5" /> Connect {platform}
        </Button>
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Live API integration coming soon
        </p>
      </div>
    );
  }

  // Connected platform card
  const status = connectedData.connection_status || 'Not connected';
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES['Not connected'];
  const lastSync = connectedData.last_sync_time ? new Date(connectedData.last_sync_time) : null;
  const daysSinceSync = lastSync ? Math.floor((Date.now() - lastSync) / (1000 * 60 * 60 * 24)) : null;

  // Calculate totals from accounts
  const totalBalance = 0; // Would sum from accounts
  const totalPositionValue = 0;
  const unrealizedPnL = 0;
  const realizedPnL = 0;

  return (
    <div className={cn('bg-card rounded-xl border', 'border-border/50', 'p-5 space-y-4')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{PLATFORM_LOGOS[platform]}</span>
          <div>
            <h3 className="font-semibold">{platform}</h3>
            <p className={cn('text-xs', statusStyle.text)}>{statusStyle.label}</p>
          </div>
        </div>
        {status === 'Connected' && (
          <div className={cn('w-2.5 h-2.5 rounded-full', 'bg-emerald-500 animate-pulse')} />
        )}
      </div>

      <div className="space-y-2 py-2 border-y border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-semibold font-mono">{privacyMode ? PM : formatCurrency(totalBalance)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Open Positions</span>
          <span className="font-semibold">0</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Unrealized P&L</span>
          <span className={cn('font-semibold', unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {privacyMode ? PM : formatCurrency(unrealizedPnL, true)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Realized P&L</span>
          <span className={cn('font-semibold', realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {privacyMode ? PM : formatCurrency(realizedPnL, true)}
          </span>
        </div>
      </div>

      {lastSync && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 px-2 py-1.5 rounded bg-secondary/30">
          <Clock className="w-3 h-3" />
          Last synced: {daysSinceSync === 0 ? 'Today' : `${daysSinceSync} days ago`}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled
        className="w-full opacity-50 cursor-not-allowed gap-1.5 text-xs"
      >
        <Zap className="w-3 h-3" /> Sync Now
      </Button>
    </div>
  );
}
