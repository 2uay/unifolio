import { useMemo } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';
import { safeNumber, safeDivide } from '@/lib/safeNum';

/**
 * Enhanced hook that ensures all dependent values recalculate
 * when live prices change
 */
export function useLiveHoldingsEnhanced(baseHoldings) {
  const { liveHoldings } = useLiveData();

  return useMemo(() => {
    if (!Array.isArray(baseHoldings)) return [];

    return baseHoldings.map(holding => {
      const ticker = holding.ticker;
      const liveData = liveHoldings[ticker];
      
      if (!liveData) {
        return holding;
      }

      const newPrice = liveData.price;
      const oldPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);
      const quantity = safeNumber(holding.quantity ?? holding.position ?? 0);
      const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? newPrice);
      const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? (quantity * avgPrice));

      // Recalculate all dependent values
      const newMarketValue = quantity * newPrice;
      const newUnrealizedGainLoss = newMarketValue - costBasis;
      const newUnrealizedGainLossPercent = safeDivide(newUnrealizedGainLoss, costBasis) * 100;

      // Daily P&L (simplified: use price change * quantity)
      const priceChange = newPrice - oldPrice;
      const newDailyPnl = priceChange * quantity;
      const newDailyPnlPercent = safeDivide(newDailyPnl, costBasis) * 100;

      return {
        ...holding,
        current_price: newPrice,
        lastPrice: newPrice,
        market_value: newMarketValue,
        marketValue: newMarketValue,
        unrealized_gain_loss_amount: newUnrealizedGainLoss,
        unrealizedAmt: newUnrealizedGainLoss,
        unrealized_gain_loss_percent: newUnrealizedGainLossPercent,
        unrealizedPct: newUnrealizedGainLossPercent,
        daily_pnl_amount: newDailyPnl,
        dailyPnl: newDailyPnl,
        daily_pnl_percent: newDailyPnlPercent,
        dailyPct: newDailyPnlPercent,
        sparkline: liveData.sparkline || holding.sparkline,
      };
    });
  }, [baseHoldings, liveHoldings]);
}