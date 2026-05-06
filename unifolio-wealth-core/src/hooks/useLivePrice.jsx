import { useMemo, useEffect } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';

/**
 * Hook to get live-updated price for a single ticker
 */
export function useLivePrice(ticker, basePrice, assetClass = 'Stock') {
  const { getLivePrice, registerTicker } = useLiveData();

  useEffect(() => {
    if (!ticker) return;
    // Register with a minimal holding object
    registerTicker(ticker, { lastPrice: basePrice }, assetClass);
  }, [ticker, basePrice, assetClass, registerTicker]);

  const livePrice = useMemo(() => {
    return getLivePrice(ticker, basePrice, assetClass);
  }, [ticker, basePrice, assetClass, getLivePrice]);

  return livePrice;
}