import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, RefreshCw, TrendingUp, AlertCircle, Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MetalBreakdownCard from '@/components/accounts/MetalBreakdownCard';

const ASSET_ICONS = {
  'Real Estate': '🏠',
  'Vehicle': '🚗',
  'Precious Metals': '⚜️',
  'Watch': '⌚',
  'Jewelry': '💎',
  'Collectible': '🎨',
  'Art': '🖼️',
  'Private Business': '🏢',
  'Private Investment': '📈',
  'Cash': '💵',
  'Crypto Wallet': '₿',
  'Other': '📦',
};

export default function CustomAssetCard({ asset, onEdit, onDelete }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isMetal = asset.asset_type === 'Precious Metals';

  const PM = '••••••';
  const convertedValue = convert(asset.chosen_value || 0, asset.currency || 'USD');
  const convertedLow = asset.appraised_low_value ? convert(asset.appraised_low_value, asset.currency) : null;
  const convertedHigh = asset.appraised_high_value ? convert(asset.appraised_high_value, asset.currency) : null;
  const convertedMid = asset.appraised_mid_value ? convert(asset.appraised_mid_value, asset.currency) : null;

  const hasAppraisal = asset.appraised_mid_value && asset.appraisal_status === 'Available';
  const isAutoAppraised = asset.appraisal_method === 'Manual with Comparison' && asset.chosen_value_source?.startsWith('Auto');
  const lastAppraisedDate = asset.appraisal_last_checked ? new Date(asset.appraisal_last_checked) : null;
  const daysSinceAppraisal = lastAppraisedDate ? Math.floor((Date.now() - lastAppraisedDate) / (1000 * 60 * 60 * 24)) : null;

  // Special render for precious metals
  if (isMetal) {
    return <MetalBreakdownCard metal={asset} />;
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{ASSET_ICONS[asset.asset_type] || '📦'}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{asset.asset_name}</h3>
              <p className="text-xs text-muted-foreground">{asset.asset_type}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onEdit(asset)} className="gap-2">
              <Edit className="w-3.5 h-3.5" /> Edit Asset
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Appraisal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2 text-red-400 focus:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Value Section */}
      <div className="px-5 py-4 border-b border-border/50 space-y-2">
        <div className="flex items-end justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Chosen Value</span>
          {isAutoAppraised && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Auto-Appraised
            </span>
          )}
        </div>
        <p className="text-2xl font-bold font-mono">
          {privacyMode ? PM : formatCurrency(convertedValue)}
        </p>
        {asset.chosen_value_source && (
          <p className="text-[10px] text-muted-foreground">Source: {asset.chosen_value_source}</p>
        )}
      </div>

      {/* Appraisal Range */}
      {hasAppraisal && (
        <div className="px-5 py-3 border-b border-border/50 bg-secondary/20">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Appraisal Range</p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <p className="text-muted-foreground text-[9px] mb-0.5">Low</p>
              <p className="font-mono font-semibold">${convertedLow?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-center border-l border-r border-border/30">
              <p className="text-muted-foreground text-[9px] mb-0.5">Fair</p>
              <p className="font-mono font-semibold text-primary">${convertedMid?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[9px] mb-0.5">High</p>
              <p className="font-mono font-semibold">${convertedHigh?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      )}

      {/* Confidence & Metadata */}
      {hasAppraisal && (
        <div className="px-5 py-3 border-b border-border/50 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-semibold">
              {asset.appraisal_confidence || 0}%
            </span>
          </div>
          {daysSinceAppraisal !== null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Last Appraised</span>
              <span className="font-mono text-foreground">
                {daysSinceAppraisal === 0 ? 'Today' : `${daysSinceAppraisal} days ago`}
              </span>
            </div>
          )}
          {asset.appraisal_provider && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-mono text-foreground text-right max-w-[50%] truncate">{asset.appraisal_provider}</span>
            </div>
          )}
        </div>
      )}

      {/* Discrepancy Warning */}
      {asset.discrepancy_warning && (
        <div className="mx-3 my-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] font-medium">{asset.discrepancy_warning}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-[10px] text-muted-foreground">
            {asset.include_in_net_value ? '✓ Included in Net Value' : '✗ Excluded from Net Value'}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(asset)}
          className="h-7 px-2.5 text-xs"
        >
          <Edit className="w-3 h-3 mr-1" /> Edit
        </Button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
          <div className="bg-card p-4 rounded-lg border border-border text-center space-y-3">
            <p className="text-sm font-semibold">Delete this asset?</p>
            <p className="text-xs text-muted-foreground">This cannot be undone.</p>
            <div className="flex gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 bg-red-600 hover:bg-red-700"
                onClick={() => {
                  onDelete(asset.id);
                  setShowDeleteConfirm(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}