import React, { useMemo } from 'react';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import MetalBreakdownCard from '@/components/accounts/MetalBreakdownCard';

export default function MetalsBreakdownSection({ customAssets }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();

  const metalAssets = useMemo(() => {
    return customAssets.filter(a => a.asset_type === 'Precious Metals');
  }, [customAssets]);

  const metalsByType = useMemo(() => {
    const grouped = {};
    metalAssets.forEach(metal => {
      const type = metal.asset_details?.metalType || 'Other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(metal);
    });
    return grouped;
  }, [metalAssets]);

  const totalMetalValue = useMemo(() => {
    return metalAssets.reduce((sum, metal) => {
      const converted = convert(metal.chosen_value || 0, metal.currency || 'USD');
      return sum + converted;
    }, 0);
  }, [metalAssets, convert]);

  const totalMeltValue = useMemo(() => {
    return metalAssets.reduce((sum, metal) => {
      if (metal.appraised_mid_value) {
        const converted = convert(metal.appraised_mid_value, metal.currency || 'USD');
        return sum + converted;
      }
      return sum;
    }, 0);
  }, [metalAssets, convert]);

  if (metalAssets.length === 0) {
    return null;
  }

  const PM = '••••••';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Metals</p>
          <p className="text-2xl font-bold font-mono mt-2">
            {privacyMode ? PM : formatCurrency(totalMetalValue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{metalAssets.length} asset{metalAssets.length > 1 ? 's' : ''}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Melt Value</p>
          <p className="text-2xl font-bold font-mono mt-2">
            {privacyMode ? PM : formatCurrency(totalMeltValue)}
          </p>
          {totalMeltValue > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Spot value: {privacyMode ? PM : `${((totalMetalValue / totalMeltValue - 1) * 100).toFixed(1)}%`}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Metal Type</p>
          <div className="mt-2 space-y-1">
            {Object.entries(metalsByType).map(([type, metals]) => (
              <div key={type} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{type}</span>
                <span className="font-mono font-semibold">
                  {privacyMode ? PM : `${metals.length}x`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metal cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {metalAssets.map(metal => (
          <MetalBreakdownCard key={metal.id} metal={metal} />
        ))}
      </div>
    </div>
  );
}