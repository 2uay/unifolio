import React from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';

const METAL_COLORS = {
  'Gold': 'text-amber-500',
  'Silver': 'text-slate-400',
  'Platinum': 'text-slate-300',
  'Palladium': 'text-slate-500',
  'Other': 'text-slate-600',
};

const METAL_ICONS = {
  'Gold': '🥇',
  'Silver': '🥈',
  'Platinum': '🏅',
  'Palladium': '💠',
  'Other': '⚗️',
};

export default function MetalBreakdownCard({ metal }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();

  const PM = '••••••';
  const convertedValue = convert(metal.chosen_value || 0, metal.currency || 'USD');
  const convertedMelt = metal.appraised_mid_value ? convert(metal.appraised_mid_value, metal.currency) : null;

  const metalType = metal.asset_details?.metalType || 'Other';
  const weight = metal.asset_details?.weight;
  const weightUnit = String(metal.asset_details?.weightUnit || 'g');
  const purity = Number(metal.asset_details?.purity || 0);
  const form = metal.asset_details?.form;
  const storage = metal.asset_details?.storageNickname;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl">{METAL_ICONS[metalType]}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{metal.asset_name}</h3>
          <p className={cn('text-xs font-semibold', METAL_COLORS[metalType])}>
            {metalType}
          </p>
        </div>
      </div>

      {/* Key Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-2 rounded bg-secondary/40">
          <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Weight</p>
          <p className="font-mono font-semibold">{weight ?? '—'} {weightUnit === 'troy_ounce' ? 'oz t' : weightUnit.charAt(0)}</p>
        </div>
        <div className="p-2 rounded bg-secondary/40">
          <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Purity</p>
          <p className="font-mono font-semibold">{(purity * 100).toFixed(1)}%</p>
        </div>
        {form && (
          <div className="p-2 rounded bg-secondary/40">
            <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Form</p>
            <p className="font-semibold">{form}</p>
          </div>
        )}
        {storage && (
          <div className="p-2 rounded bg-secondary/40">
            <p className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Storage</p>
            <p className="font-semibold truncate" title={storage}>{storage}</p>
          </div>
        )}
      </div>

      {/* Valuation */}
      <div className="space-y-1.5 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Melt Value</span>
          <span className="font-bold font-mono">{privacyMode ? PM : formatCurrency(convertedMelt || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your Value</span>
          <span className="text-lg font-bold font-mono text-primary">
            {privacyMode ? PM : formatCurrency(convertedValue)}
          </span>
        </div>
        {metal.discrepancy_percent && Math.abs(metal.discrepancy_percent) >= 5 && (
          <div className="text-[10px] text-amber-600/80">
            {metal.discrepancy_percent > 0 ? '+' : ''}{metal.discrepancy_percent.toFixed(1)}% vs melt value
          </div>
        )}
      </div>
    </div>
  );
}
