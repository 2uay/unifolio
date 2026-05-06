import React, { useState } from 'react';
import { MoreVertical, Eye, Download, Trash2, Link2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CacheStatusBadge from '@/components/cache/CacheStatusBadge';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DisconnectedAccountCard({ account, lastSnapshot }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const PM = '••••••';

  const snapshotValue = lastSnapshot ? convert(lastSnapshot.total_account_value || 0, lastSnapshot.currency) : 0;
  const snapshotDate = lastSnapshot ? new Date(lastSnapshot.created_at) : null;
  const daysSinceSnapshot = snapshotDate ? Math.floor((Date.now() - snapshotDate) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4 relative overflow-hidden">
      {/* Disconnected indicator */}
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-amber-500 to-transparent opacity-30" />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{account.account_name || account.account_type}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
              Disconnected
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{account.institution}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2">
              <Eye className="w-3.5 h-3.5" /> View Cached Data
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Download className="w-3.5 h-3.5" /> Export Cache
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Link2 className="w-3.5 h-3.5" /> Reconnect Account
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-red-400 focus:text-red-400">
              <Trash2 className="w-3.5 h-3.5" /> Delete Cached Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Cache status */}
      <div className="space-y-2 py-3 border-y border-border/50">
        <CacheStatusBadge status="Disconnected" lastSyncTime={lastSnapshot?.created_at} showIcon={true} />
        
        <div className="flex items-start gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400">
            Showing cached data from {daysSinceSnapshot ? `${daysSinceSnapshot} days ago` : 'last sync'}.
            <br />
            <span className="text-amber-300/60">Historical data retained with your account.</span>
          </p>
        </div>
      </div>

      {/* Account value */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cached Account Value</p>
        <p className="text-2xl font-bold font-mono">{privacyMode ? PM : formatCurrency(snapshotValue)}</p>
        {snapshotDate && (
          <p className="text-xs text-muted-foreground">
            as of {snapshotDate.toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs">
          <Eye className="w-3 h-3" /> View History
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs">
          <Link2 className="w-3 h-3" /> Reconnect
        </Button>
      </div>
    </div>
  );
}