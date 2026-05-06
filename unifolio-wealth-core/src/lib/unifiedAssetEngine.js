/**
 * Unified Asset Engine
 * 
 * Combines brokerage holdings, prediction market positions, custom assets,
 * payment balances, loans, and credit cards into one cohesive portfolio system.
 * 
 * Treats all asset types uniformly for calculations, while respecting their
 * unique properties (e.g., prediction markets have probabilities, custom assets
 * have appraisal methods, etc.).
 */

import { safeNumber, safeDivide } from '@/lib/safeNum';

/**
 * Asset Type Classification
 */
export const ASSET_TYPES = {
  // Investment Assets
  STOCK: 'stock',
  ETF: 'etf',
  BOND: 'bond',
  CRYPTO: 'crypto',
  COMMODITY: 'commodity',
  
  // Alternative Assets
  PREDICTION_MARKET: 'prediction_market',
  PRECIOUS_METAL: 'precious_metal',
  CUSTOM_ASSET: 'custom_asset',
  REAL_ESTATE: 'real_estate',
  VEHICLE: 'vehicle',
  COLLECTIBLE: 'collectible',
  PRIVATE_INVESTMENT: 'private_investment',
  
  // Cash & Balances
  CASH: 'cash',
  PAYMENT_BALANCE: 'payment_balance',
  
  // Liabilities
  LOAN: 'loan',
  CREDIT_CARD: 'credit_card',
  MORTGAGE: 'mortgage',
};

/**
 * Normalize any asset (holding, prediction market position, custom asset) into
 * a unified format for portfolio calculations.
 */
export function normalizeAsset(asset, assetType, accountInfo = {}) {
  if (!asset) return null;

  const basePrice = safeNumber(asset.current_price ?? asset.lastPrice ?? asset.probability ?? asset.chosen_value ?? 0);
  const quantity = safeNumber(asset.quantity ?? asset.position ?? 1);
  const avgPrice = safeNumber(asset.average_price ?? asset.avgPrice ?? basePrice);
  
  return {
    id: asset.id,
    assetType,
    assetClass: asset.asset_class ?? asset.assetClass ?? 'Other',
    ticker: asset.ticker || asset.market_id || asset.id,
    name: asset.name || asset.asset_name || asset.market_title || 'Asset',
    quantity,
    currentPrice: basePrice,
    averagePrice: avgPrice,
    costBasis: safeNumber(asset.cost_basis ?? asset.costBasis ?? (quantity * avgPrice)),
    marketValue: safeNumber(asset.market_value ?? asset.marketValue ?? asset.chosen_value ?? (quantity * basePrice)),
    unrealizedGainLoss: safeNumber(asset.unrealized_gain_loss_amount ?? asset.unrealizedAmt ?? 0),
    unrealizedGainLossPercent: safeNumber(asset.unrealized_gain_loss_percent ?? asset.unrealizedPct ?? 0),
    realizedGainLoss: safeNumber(asset.realized_gain_loss_amount ?? asset.realizedGain ?? 0),
    dailyPnlAmount: safeNumber(asset.daily_pnl_amount ?? asset.dailyPnl ?? 0),
    dailyPnlPercent: safeNumber(asset.daily_pnl_percent ?? asset.dailyPct ?? 0),
    
    // Metadata
    currency: asset.currency || 'USD',
    accountId: asset.account_id ?? asset.accountId,
    accountName: accountInfo.name || asset.account_name || 'Account',
    accountType: (accountInfo.type || asset.account_type) ?? 'Other',
    institution: accountInfo.institution || asset.institution || null,
    
    // Status
    status: asset.status || 'Open',
    isActive: (asset.status === 'Open' || asset.status === undefined) && (safeNumber(asset.quantity ?? asset.position) > 0),
    isClosed: asset.status === 'Closed' || asset.status === 'Settled' || asset.status === 'Expired',
    
    // Original object for fallback
    _original: asset,
  };
}

/**
 * Aggregate prediction market positions into a virtual "account" entry
 * for portfolio calculations.
 */
export function aggregatePredictionMarketAccount(pmAccount, positions = [], convertFn = v => v) {
  const openPositions = positions.filter(p => p.status === 'Open' || !p.status);
  
  const openValue = openPositions.reduce((sum, p) => {
    const value = safeNumber(p.current_market_value ?? p.marketValue ?? 0);
    return sum + convertFn(value, p.currency || 'USD');
  }, 0);
  
  const unrealizedGainLoss = openPositions.reduce((sum, p) => {
    const ugl = safeNumber(p.unrealized_gain_loss ?? 0);
    return sum + convertFn(ugl, p.currency || 'USD');
  }, 0);
  
  const cashBalance = convertFn(safeNumber(pmAccount.cash_balance ?? pmAccount.cashBalance ?? 0), pmAccount.currency || 'USD');
  const totalValue = cashBalance + openValue;
  
  return {
    id: pmAccount.id,
    accountType: 'Prediction Market',
    accountName: pmAccount.account_name || pmAccount.platform || 'Prediction Market Account',
    platform: pmAccount.platform,
    cashBalance,
    openPositionValue: openValue,
    totalValue,
    unrealizedGainLoss,
    currency: pmAccount.currency || 'USD',
    status: pmAccount.connection_status || 'Not connected',
    lastSynced: pmAccount.last_synced,
    includeInNetValue: pmAccount.included_in_net_value !== false,
    includeInPortfolio: pmAccount.included_in_net_value !== false,
  };
}

/**
 * Aggregate custom assets into their contribution to net value
 */
export function aggregateCustomAssets(customAssets = [], convertFn = v => v) {
  const included = customAssets.filter(a => a.include_in_net_value !== false);
  
  const gross = included.reduce((sum, a) => {
    return sum + convertFn(safeNumber(a.chosen_value ?? a.user_entered_value ?? 0), a.currency || 'USD');
  }, 0);
  
  const liabilities = included.reduce((sum, a) => {
    return sum + convertFn(safeNumber(a.liability_amount ?? 0), a.currency || 'USD');
  }, 0);
  
  const net = gross - liabilities;
  
  return {
    totalAssets: gross,
    totalLiabilities: liabilities,
    netValue: net,
    count: included.length,
  };
}

/**
 * Aggregate payment balances
 */
export function aggregatePaymentBalances(balances = [], convertFn = v => v) {
  let totalPositive = 0;
  let totalNegative = 0;
  
  balances.forEach(b => {
    const amount = convertFn(safeNumber(b.balance ?? 0), b.currency || 'USD');
    if (amount > 0) {
      totalPositive += amount;
    } else {
      totalNegative += Math.abs(amount);
    }
  });
  
  return {
    totalAssets: totalPositive,
    totalLiabilities: totalNegative,
  };
}

/**
 * Aggregate loans and credit cards (liabilities)
 */
export function aggregateDebts(loans = [], creditCards = [], convertFn = v => v) {
  const loanTotal = loans
    .filter(l => l.include_in_net_value !== false)
    .reduce((sum, l) => sum + convertFn(safeNumber(l.outstanding_balance ?? 0), l.currency || 'USD'), 0);
  
  const creditCardTotal = creditCards
    .filter(c => c.include_in_net_value !== false)
    .reduce((sum, c) => sum + convertFn(safeNumber(c.current_balance ?? 0), c.currency || 'USD'), 0);
  
  return {
    totalDebts: loanTotal + creditCardTotal,
    loans: loanTotal,
    creditCards: creditCardTotal,
  };
}

/**
 * Calculate unified portfolio metrics across all asset types
 */
export function calculateUnifiedPortfolioMetrics(
  holdings = [],
  pmAccounts = [],
  pmPositions = [],
  customAssets = [],
  paymentBalances = [],
  loans = [],
  creditCards = [],
  convertFn = v => v,
  options = {}
) {
  const opts = { includeRealized: false, includePredictionMarkets: true, ...options };
  
  // Filter active holdings
  const activeHoldings = holdings.filter(h => 
    (h.quantity ?? h.position ?? 0) > 0 && 
    (!h.status || h.status === 'Open')
  );
  
  // Filter active PM positions
  const activePMPositions = pmPositions.filter(p => 
    p.status === 'Open' || !p.status
  );
  
  // Aggregate investment account holdings
  let investmentHoldings = activeHoldings.reduce((sum, h) => {
    return sum + convertFn(safeNumber(h.market_value ?? h.marketValue ?? 0), h.currency || 'USD');
  }, 0);
  
  // Aggregate investment account cash
  let cashInAccounts = 0;
  // This would come from account data—for now, we can extract from accounts array if needed
  
  // Aggregate prediction market values
  let pmTotalValue = 0;
  if (opts.includePredictionMarkets) {
    pmAccounts.forEach(pma => {
      const agg = aggregatePredictionMarketAccount(pma, activePMPositions, convertFn);
      pmTotalValue += agg.totalValue;
    });
  }
  
  // Aggregate custom assets
  const customAssetAgg = aggregateCustomAssets(customAssets, convertFn);
  
  // Aggregate payment balances
  const paymentAgg = aggregatePaymentBalances(paymentBalances, convertFn);
  
  // Aggregate debts
  const debtAgg = aggregateDebts(loans, creditCards, convertFn);
  
  // Calculate totals
  const portfolioValue = investmentHoldings + pmTotalValue;
  const totalAssets = portfolioValue + customAssetAgg.totalAssets + paymentAgg.totalAssets;
  const totalLiabilities = customAssetAgg.totalLiabilities + debtAgg.totalDebts + paymentAgg.totalLiabilities;
  const netValue = totalAssets - totalLiabilities;
  
  // Aggregate P&L
  const totalUnrealizedGainLoss = activeHoldings.reduce((sum, h) => {
    return sum + convertFn(safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt ?? 0), h.currency || 'USD');
  }, 0) + pmPositions.reduce((sum, p) => {
    if (p.status === 'Open') {
      return sum + convertFn(safeNumber(p.unrealized_gain_loss ?? 0), p.currency || 'USD');
    }
    return sum;
  }, 0);
  
  const totalDailyPnl = activeHoldings.reduce((sum, h) => {
    return sum + convertFn(safeNumber(h.daily_pnl_amount ?? h.dailyPnl ?? 0), h.currency || 'USD');
  }, 0) + (opts.includePredictionMarkets ? pmPositions.reduce((sum, p) => {
    if (p.status === 'Open') {
      return sum + convertFn(safeNumber(p.daily_pnl_change ?? 0), p.currency || 'USD');
    }
    return sum;
  }, 0) : 0);
  
  return {
    portfolioValue,
    investmentHoldings,
    pmAccountValue: pmTotalValue,
    customAssetValue: customAssetAgg.netValue,
    paymentBalanceValue: paymentAgg.totalAssets,
    
    totalAssets,
    totalLiabilities,
    netValue,
    
    totalUnrealizedGainLoss,
    totalDailyPnl,
    totalDailyPnlPercent: portfolioValue > 0 ? (totalDailyPnl / portfolioValue) * 100 : 0,
    
    // Breakdowns
    customAssets: customAssetAgg,
    payments: paymentAgg,
    debts: debtAgg,
  };
}

/**
 * Calculate allocation percentage for an asset
 */
export function calculateAllocationPercent(assetValue, portfolioTotal) {
  return portfolioTotal > 0 ? (assetValue / portfolioTotal) * 100 : 0;
}

/**
 * Check if a prediction market position should be treated as "realized" (closed/settled)
 */
export function isPredictionMarketRealized(position) {
  return position.status === 'Closed' || position.status === 'Settled' || position.status === 'Expired';
}

/**
 * Format asset for display in holdings table
 */
export function formatAssetForHoldings(asset, assetType) {
  const normalized = normalizeAsset(asset, assetType);
  if (!normalized) return null;
  
  return {
    ...normalized,
    // Holdings-specific fields
    displayName: normalized.name,
    displayTicker: normalized.ticker,
    position: normalized.quantity,
    lastPrice: normalized.currentPrice,
    avgPrice: normalized.averagePrice,
    unrealizedPct: normalized.unrealizedGainLossPercent,
    unrealizedAmt: normalized.unrealizedGainLoss,
    marketValue: normalized.marketValue,
    costBasis: normalized.costBasis,
    dailyPct: normalized.dailyPnlPercent,
    dailyPnl: normalized.dailyPnlAmount,
  };
}