/**
 * Global Simulation Engine
 * 
 * Powers realistic, continuous market movement across the entire platform.
 * One shared engine prevents duplicate timers and ensures coherent updates.
 */

import { safeNumber } from '@/lib/safeNum';

// Market hours check
export function isMarketOpen() {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = estTime.getDay();
  const hours = estTime.getHours();
  const minutes = estTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Monday-Friday, 9:30 AM - 4:00 PM EST
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = timeInMinutes >= 570 && timeInMinutes < 960; // 9:30 - 16:00
  
  return isWeekday && isMarketHours;
}

// Market momentum states per asset
const assetMomentum = new Map();

function getOrInitMomentum(ticker) {
  if (!assetMomentum.has(ticker)) {
    assetMomentum.set(ticker, {
      trend: Math.random() - 0.5, // -0.5 to 0.5
      volatility: 0.5 + Math.random() * 0.5, // 0.5 to 1.0
      trendAge: 0,
      trendLifespan: 20 + Math.floor(Math.random() * 40), // 20-60 updates
    });
  }
  return assetMomentum.get(ticker);
}

function updateMomentum(ticker, assetType) {
  const m = getOrInitMomentum(ticker);
  
  m.trendAge++;
  
  // Switch trend occasionally
  if (m.trendAge > m.trendLifespan) {
    m.trend = (Math.random() - 0.5) * 0.3;
    m.trendAge = 0;
    m.trendLifespan = 20 + Math.floor(Math.random() * 40);
  }
  
  // Mean reversion
  if (Math.abs(m.trend) > 0.4) {
    m.trend *= 0.95;
  }
  
  // Asset type volatility modifiers
  const volatilityMods = {
    stock: 1.0,
    etf: 0.5,
    crypto: 2.0,
    precious_metal: 0.3,
    prediction_market: 0.6,
  };
  
  m.volatility = (volatilityMods[assetType] || 0.7) * (0.7 + Math.random() * 0.6);
}

/**
 * Calculate realistic price movement for an asset
 */
export function simulatePriceMovement(currentPrice, ticker, assetType = 'stock') {
  if (!currentPrice || currentPrice <= 0) return currentPrice;
  
  const m = getOrInitMomentum(ticker);
  updateMomentum(ticker, assetType);
  
  // Random tick + momentum + volatility
  const randomTick = (Math.random() - 0.5) * 0.02; // ±1%
  const momentumTick = m.trend * 0.005; // Trend contribution
  const volatilityTick = (Math.random() - 0.5) * m.volatility * 0.003;
  
  const totalChange = randomTick + momentumTick + volatilityTick;
  const newPrice = currentPrice * (1 + totalChange);
  
  // Prevent negative prices
  return Math.max(newPrice, 0.01);
}

/**
 * Calculate probability movement for prediction markets
 * Keeps values between 0 and 1
 */
export function simulateProbabilityMovement(currentProb, ticker) {
  if (currentProb == null || currentProb < 0 || currentProb > 1) return currentProb;
  
  const m = getOrInitMomentum(ticker);
  updateMomentum(ticker, 'prediction_market');
  
  const randomMove = (Math.random() - 0.5) * 0.03;
  const trendMove = m.trend * 0.01;
  
  let newProb = currentProb + randomMove + trendMove;
  
  // Clamp to [0, 1]
  newProb = Math.max(0, Math.min(1, newProb));
  
  return newProb;
}

/**
 * Calculate portfolio-level movements
 * Applies slight correlated noise with individual stock movements
 */
export function calculatePortfolioMovement(holdings, convertFn) {
  if (!Array.isArray(holdings) || holdings.length === 0) return 0;
  
  const activeHoldings = holdings.filter(h => h.quantity > 0);
  const marketMovements = activeHoldings.map(h => {
    const oldPrice = safeNumber(h.lastPrice ?? h.current_price ?? 0);
    const newPrice = simulatePriceMovement(oldPrice, h.ticker, h.assetClass || 'stock');
    const priceDelta = newPrice - oldPrice;
    const marketValue = convertFn(h.market_value ?? h.marketValue ?? 0, h.currency || 'USD');
    return (priceDelta / Math.max(oldPrice, 0.01)) * marketValue;
  });
  
  return marketMovements.reduce((a, b) => a + b, 0);
}

/**
 * Generate realistic daily P&L change
 */
export function calculateDailyPnlMovement(holdings, convertFn) {
  if (!Array.isArray(holdings) || holdings.length === 0) return 0;
  
  return holdings
    .filter(h => h.quantity > 0)
    .reduce((sum, h) => {
      const oldDaily = safeNumber(h.daily_pnl_amount ?? h.dailyPnl ?? 0);
      const newDaily = oldDaily * (0.95 + Math.random() * 0.1) + (Math.random() - 0.5) * 50;
      const converted = convertFn(newDaily - oldDaily, h.currency || 'USD');
      return sum + converted;
    }, 0);
}

/**
 * Clear momentum for a specific asset (e.g., after manual update)
 */
export function resetAssetMomentum(ticker) {
  assetMomentum.delete(ticker);
}

/**
 * Clear all momentum
 */
export function resetAllMomentum() {
  assetMomentum.clear();
}

/**
 * Get momentum state (for debugging)
 */
export function getMomentumState(ticker) {
  return assetMomentum.get(ticker) || null;
}