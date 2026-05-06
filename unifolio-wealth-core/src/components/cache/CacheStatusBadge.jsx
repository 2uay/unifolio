import React from 'react';
import { Clock, AlertCircle, CheckCircle2, Server, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  'Live synced': { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '✓ Live Synced' },
  'Cached': { icon: Server, color: 'text-blue-400', bg: 'bg-blue-500/10', label: '⟳ Cached' },
  'Disconnected': { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', label: '⊗ Disconnected' },
  'Sync failed': { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: '✗ Sync Failed' },
  'Data retained': { icon: Lock, color: 'text-purple-400', bg: 'bg-purple-500/10', label: '🔒 Data Retained' },
  'Data expired': { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/10', label: '⏱ Data Expired' },
  'Manual data only': { icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10', label: '⚙ Manual Only' },
};

export default function CacheStatusBadge({ status, lastSyncTime, showIcon = true, compact = false }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Cached'];
  const Icon = config.icon;

  const daysSince = lastSyncTime ? Math.floor((Date.now() - new Date(lastSyncTime)) / (1000 * 60 * 60 * 24)) : null;
  const lastSyncLabel = lastSyncTime ? (daysSince === 0 ? 'Today' : `${daysSince}d ago`) : 'Never';

  if (compact) {
    return (
      <span className={cn('text-[10px] px-2 py-1 rounded-full font-semibold', config.bg, config.color)}>
        {config.label}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg', config.bg)}>
      {showIcon && <Icon className={cn('w-3.5 h-3.5', config.color)} />}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold', config.color)}>{config.label}</p>
        {lastSyncTime && (
          <p className={cn('text-[10px]', config.color)}>
            Last synced: {lastSyncLabel}
          </p>
        )}
      </div>
    </div>
  );
}