/**
 * Live Data Simulation Engine
 * Generates realistic market price movements and recalculates dependent values
 */

// Seeded random for consistency within session
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Volatility profiles by asset class
const VOLATILITY_MAP = {
  'Stock': 0.015,           // 1.5% typical daily move
  'ETF': 0.008,             // 0.8% for ETFs (lower vol)
  'Bond': 0.003,            // 0.3% for bonds (very low)
  'Equity': 0.012,
  'Index': 0.010,
  'Crypto': 0.04,           // 4% for crypto (high vol)
  'Commodity': 0.025,       // 2.5% for commodities
};

// Ticker-specific volatility adjustments (mega-cap, growth, etc.)
const TICKER_VOLATILITY_BOOST = {
  'TSLA': 1.5,
  'NVDA': 1.3,
  'GME': 2.0,
  'AMD': 1.2,
  'MSTR': 1.8,
  'COIN': 1.6,
  'QQQ': 1.2,
  'SPY': 0.8,
  'GLD': 0.6,
  'BND': 0.4,
};

/**
 * Generate realistic price movement with momentum and mean reversion
 */
export function generatePriceMovement(currentPrice, volatility = 0.015) {
  const now = Date.now();
  const secondsSinceEpoch = Math.floor(now / 1000);
  
  // Multi-layer noise for organic movement
  const seed1 = secondsSinceEpoch * 73856093 ^ (currentPrice * 1000);
  const seed2 = secondsSinceEpoch * 19349663 ^ (currentPrice * 500);
  const seed3 = secondsSinceEpoch * 83492791 ^ (currentPrice * 250);
  
  // Combine multiple noise frequencies for natural feel
  const noise1 = (seededRandom(seed1) - 0.5) * 2;     // -1 to 1
  const noise2 = (seededRandom(seed2) - 0.5) * 2 * 0.5; // -0.5 to 0.5, lower amplitude
  const noise3 = (seededRandom(seed3) - 0.5) * 2 * 0.3; // -0.3 to 0.3, even lower
  
  // Mean reversion: slight bias toward baseline
  const baselineBias = seededRandom(seed1 + 1) > 0.5 ? 0.2 : -0.2;
  
  const combinedNoise = (noise1 * 0.6 + noise2 * 0.25 + noise3 * 0.15) * volatility;
  const movement = combinedNoise + (baselineBias * volatility * 0.1);
  
  const newPrice = currentPrice * (1 + movement);
  return Math.max(0.01, parseFloat(newPrice.toFixed(2)));
}

/**
 * Get volatility for a ticker based on asset class and specific ticker
 */
export function getVolatility(assetClass = 'Stock', ticker = '') {
  const baseVolatility = VOLATILITY_MAP[assetClass] || VOLATILITY_MAP['Stock'];
  const boost = ticker && TICKER_VOLATILITY_BOOST[ticker] ? TICKER_VOLATILITY_BOOST[ticker] : 1;
  return baseVolatility * boost;
}

/**
 * Get update interval based on market hours (faster during market hours)
 */
export function getUpdateInterval() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const dayOfWeek = now.getDay();
  
  // Weekends: slower updates
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 5000 + Math.random() * 3000; // 5-8 seconds
  }
  
  // Market hours (9:30 AM - 4:00 PM ET): faster updates
  if (hours >= 9 && hours < 16 && !(hours === 9 && minutes < 30)) {
    return 800 + Math.random() * 1200; // 0.8-2 seconds
  }
  
  // Pre-market (4:00 AM - 9:30 AM): medium speed
  if (hours >= 4 && hours < 9) {
    return 2000 + Math.random() * 2000; // 2-4 seconds
  }
  
  // After-hours: slower
  return 3000 + Math.random() * 2000; // 3-5 seconds
}

/**
 * Recalculate all dependent values when price changes
 * Returns object with updated market_value, unrealized_gain_loss, etc.
 */
export function recalculateDependentValues(holding, newPrice) {
  if (!holding) return {};
  
  const currentPrice = newPrice;
  const previousPrice = holding.current_price ?? holding.lastPrice ?? currentPrice;
  const quantity = holding.quantity ?? holding.position ?? 0;
  const avgPrice = holding.average_price ?? holding.avgPrice ?? currentPrice;
  
  // Market value (quantity × current price)
  const marketValue = quantity * currentPrice;
  
  // Cost basis
  const costBasis = quantity * avgPrice;
  
  // Unrealized gain/loss (absolute)
  const unrealizedGainLoss = marketValue - costBasis;
  
  // Unrealized gain/loss (percentage)
  const unrealizedGainLossPercent = costBasis > 0 ? (unrealizedGainLoss / costBasis) * 100 : 0;
  
  // Daily P&L (absolute) - change since previous price
  const dailyPnlAmount = quantity * (currentPrice - previousPrice);
  
  // Daily P&L (percentage)
  const dailyPnlPercent = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
  
  return {
    current_price: currentPrice,
    lastPrice: currentPrice,
    market_value: parseFloat(marketValue.toFixed(2)),
    marketValue: parseFloat(marketValue.toFixed(2)),
    cost_basis: parseFloat(costBasis.toFixed(2)),
    costBasis: parseFloat(costBasis.toFixed(2)),
    unrealized_gain_loss_amount: parseFloat(unrealizedGainLoss.toFixed(2)),
    unrealizedAmt: parseFloat(unrealizedGainLoss.toFixed(2)),
    unrealized_gain_loss_percent: parseFloat(unrealizedGainLossPercent.toFixed(2)),
    unrealizedPct: parseFloat(unrealizedGainLossPercent.toFixed(2)),
    daily_pnl_amount: parseFloat(dailyPnlAmount.toFixed(2)),
    dailyPnl: parseFloat(dailyPnlAmount.toFixed(2)),
    daily_pnl_percent: parseFloat(dailyPnlPercent.toFixed(2)),
    dailyPct: parseFloat(dailyPnlPercent.toFixed(2)),
  };
}

/**
 * Update sparkline with new price while maintaining history
 */
export function updateSparkline(sparkline = [], newPrice, maxLength = 30) {
  const updated = [...(sparkline || []), newPrice];
  // Keep only the most recent maxLength values
  return updated.slice(Math.max(0, updated.length - maxLength));
}