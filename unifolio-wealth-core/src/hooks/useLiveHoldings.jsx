import { useMemo, useEffect } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';

/**
 * Hook to get live-updated holdings data
 * Registers tickers and applies live price updates to all dependent values
 */
export function useLiveHoldings(holdings) {
  const { getLiveHolding, registerTicker } = useLiveData();

  // Register all holdings and their tickers
  useEffect(() => {
    if (!holdings || holdings.length === 0) return;
    
    holdings.forEach(h => {
      if (h.ticker) {
        const assetClass = h.asset_class ?? h.assetClass ?? 'Stock';
        registerTicker(h.ticker, h, assetClass);
      }
    });
  }, [holdings, registerTicker]);

  // Apply live prices and recalculate all dependent values
  const liveUpdatedHoldings = useMemo(() => {
    if (!holdings) return [];
    return holdings.map(h => getLiveHolding(h));
  }, [holdings, getLiveHolding]);

  return liveUpdatedHoldings;
}