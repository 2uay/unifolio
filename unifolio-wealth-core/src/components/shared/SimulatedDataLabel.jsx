import React from 'react';
import { Database, Zap } from 'lucide-react';
import { useLiveData } from '@/lib/LiveDataContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

export default function SimulatedDataLabel() {
  const { liveDataEnabled, apiPricesLoaded } = useLiveData();
  const { isSample, hasImportedPortfolio } = usePortfolioData();

  if (!isSample) {
    if (!hasImportedPortfolio) return null;
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/40 text-xs text-muted-foreground border border-border/50">
        <Database className={apiPricesLoaded ? 'w-3 h-3 text-emerald-400' : 'w-3 h-3 text-amber-400'} />
        <span>{apiPricesLoaded ? 'Live market data' : 'Broker values'}</span>
      </div>
    );
  }

  if (!liveDataEnabled) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 text-xs text-primary/70 border border-primary/20">
      <Zap className="w-3 h-3 animate-pulse" />
      <span className="animate-pulse">Simulated holdings data</span>
    </div>
  );
}
