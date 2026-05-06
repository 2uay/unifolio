import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCurrency } from '@/lib/CurrencyContext';
import { FX_IS_SAMPLE } from '@/lib/exchangeRates';

export default function CurrencyBadge() {
  const { displayCurrency } = useCurrency();
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold font-mono">
        {displayCurrency}
      </span>
      {FX_IS_SAMPLE && (
        <span className="flex items-center gap-1 text-[10px] text-amber-400/80">
          <AlertTriangle className="w-2.5 h-2.5" />
          FX Sample
        </span>
      )}
    </div>
  );
}