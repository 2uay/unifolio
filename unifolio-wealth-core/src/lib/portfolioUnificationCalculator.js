/**
 * Portfolio Unification Calculator
 * 
 * Central calculation layer that aggregates all asset types into a unified
 * portfolio view, respecting account inclusion toggles, currency conversion,
 * and privacy mode.
 */

import { safeNumber, safeDivide } from '@/lib/safeNum';
import {
  calculateUnifiedPortfolioMetrics,
  aggregatePredictionMarketAccount,
  aggregateCustomAssets,
  aggregatePaymentBalances,
  aggregateDebts,
} from '@/lib/unifiedAssetEngine';

/**
 * Calculate unified portfolio with all filtering and conversions applied
 */
export function calculateUnifiedPortfolio(
  holdings = [],
  accounts = [],
  pmAccounts = [],
  pmPositions = [],
  customAssets = [],
  creditCards = [],
  loans = [],
  paymentBalances = [],
  convertFn = v => v,
  options = {}
) {
  const opts = {
    includePredictionMarkets: true,
    includeCustomAssets: true,
    includePaymentBalances: true,
    excludedAccountIds: [],
    ...options,
  };

  // Filter holdings by included accounts
  const includedHoldings = holdings.filter(h => {
    const accId = h.account_id ?? h.accountId;
    const account = accounts.find(a => a.id === accId);
    if (!account) return true; // Include if account not found
    return account.included_in_portfolio !== false && !opts.excludedAccountIds.includes(accId);
  });

  // Filter PM accounts by inclusion toggle
  const includedPMAccounts = pmAccounts.filter(pma => {
    if (!opts.includePredictionMarkets) return false;
    return pma.included_in_net_value !== false;
  });

  // Filter PM positions by account inclusion
  const includedPMPositions = pmPositions.filter(p => {
    const account = pmAccounts.find(pma => pma.id === p.account_id);
    if (!account || !opts.includePredictionMarkets) return false;
    return account.included_in_net_value !== false;
  });

  // Calculate metrics
  const metrics = calculateUnifiedPortfolioMetrics(
    includedHoldings,
    includedPMAccounts,
    includedPMPositions,
    opts.includeCustomAssets ? customAssets : [],
    opts.includePaymentBalances ? paymentBalances : [],
    loans.filter(l => l.include_in_net_value !== false),
    creditCards.filter(c => c.include_in_net_value !== false),
    convertFn,
    { includePredictionMarkets: opts.includePredictionMarkets }
  );

  return metrics;
}

/**
 * Get allocation data across all asset types for visualization
 */
export function getUnifiedAssetAllocation(
  holdings = [],
  pmAccounts = [],
  pmPositions = [],
  customAssets = [],
  convertFn = v => v,
  groupBy = 'assetClass' // 'assetClass', 'accountType', 'platform'
) {
  const allocation = {};
  
  // Aggregate holdings
  holdings.forEach(h => {
    const key = groupBy === 'assetClass' ? (h.asset_class ?? h.assetClass ?? 'Other')
      : groupBy === 'accountType' ? (h.account_type ?? 'Other')
      : (h.ticker || 'Other');
    
    const value = convertFn(safeNumber(h.market_value ?? h.marketValue ?? 0), h.currency || 'USD');
    allocation[key] = (allocation[key] || 0) + value;
  });

  // Aggregate PM accounts
  pmAccounts.forEach(pma => {
    const key = groupBy === 'platform' ? pma.platform : 'Prediction Markets';
    const openPositions = pmPositions.filter(p => (p.status === 'Open' || !p.status) && p.account_id === pma.id);
    const positionValue = openPositions.reduce((sum, p) => {
      return sum + convertFn(safeNumber(p.current_market_value ?? 0), p.currency || 'USD');
    }, 0);
    const cashValue = convertFn(safeNumber(pma.cash_balance ?? 0), pma.currency || 'USD');
    const totalValue = positionValue + cashValue;
    
    allocation[key] = (allocation[key] || 0) + totalValue;
  });

  // Aggregate custom assets (if investment-like)
  const investmentLikeCustomAssets = customAssets.filter(a => {
    const type = a.asset_type;
    return ['Precious Metals', 'Crypto Wallet', 'Private Investment'].includes(type);
  });
  
  investmentLikeCustomAssets.forEach(a => {
    const key = groupBy === 'assetClass' ? a.asset_type : 'Custom Assets';
    const value = convertFn(safeNumber(a.chosen_value ?? 0), a.currency || 'USD');
    allocation[key] = (allocation[key] || 0) + value;
  });

  return Object.entries(allocation)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Get all accounts (brokerage + prediction market) for display
 */
export function getUnifiedAccounts(accounts = [], pmAccounts = [], holdings = [], pmPositions = [], convertFn = v => v) {
  const unified = [];

  // Add traditional accounts with their holdings
  accounts.forEach(acc => {
    const accHoldings = holdings.filter(h => (h.account_id ?? h.accountId) === acc.id && (h.quantity ?? h.position ?? 0) > 0);
    const holdingsValue = accHoldings.reduce((sum, h) => {
      return sum + convertFn(safeNumber(h.market_value ?? h.marketValue ?? 0), h.currency || 'USD');
    }, 0);
    const totalValue = holdingsValue + convertFn(safeNumber(acc.cash_balance ?? acc.cashBalance ?? 0), acc.base_currency || 'CAD');

    unified.push({
      id: acc.id,
      type: 'brokerage',
      accountType: acc.account_type ?? acc.type ?? 'Account',
      name: acc.account_name || 'Account',
      institution: acc.institution_id ? `Institution ${acc.institution_id}` : null,
      totalValue,
      holdingsValue,
      cashValue: convertFn(safeNumber(acc.cash_balance ?? acc.cashBalance ?? 0), acc.base_currency || 'CAD'),
      currency: acc.base_currency || 'CAD',
      status: acc.connection_status || 'Connected',
      includeInPortfolio: acc.included_in_portfolio !== false,
    });
  });

  // Add PM accounts
  pmAccounts.forEach(pma => {
    const openPos = pmPositions.filter(p => (p.status === 'Open' || !p.status) && p.account_id === pma.id);
    const posValue = openPos.reduce((sum, p) => {
      return sum + convertFn(safeNumber(p.current_market_value ?? 0), p.currency || 'USD');
    }, 0);
    const cashValue = convertFn(safeNumber(pma.cash_balance ?? 0), pma.currency || 'USD');

    unified.push({
      id: pma.id,
      type: 'prediction_market',
      accountType: 'Prediction Market',
      name: pma.account_name || pma.platform || 'PM Account',
      platform: pma.platform,
      totalValue: posValue + cashValue,
      positionValue: posValue,
      cashValue,
      currency: pma.currency || 'USD',
      status: pma.connection_status || 'Not connected',
      includeInPortfolio: pma.included_in_net_value !== false,
    });
  });

  return unified;
}

/**
 * Get performance data including prediction markets and custom assets
 */
export function getUnifiedPerformanceData(
  holdings = [],
  pmPositions = [],
  pmAccounts = [],
  convertFn = v => v
) {
  // Realized gains from holdings
  const holdingsRealized = holdings.reduce((sum, h) => {
    return sum + convertFn(safeNumber(h.realized_gain_loss_amount ?? h.realizedGain ?? 0), h.currency || 'USD');
  }, 0);

  // Realized gains from closed PM positions
  const pmRealized = pmPositions
    .filter(p => p.status === 'Closed' || p.status === 'Settled')
    .reduce((sum, p) => {
      return sum + convertFn(safeNumber(p.realized_gain_loss ?? 0), p.currency || 'USD');
    }, 0);

  // Unrealized gains
  const holdingsUnrealized = holdings.reduce((sum, h) => {
    return sum + convertFn(safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt ?? 0), h.currency || 'USD');
  }, 0);

  const pmUnrealized = pmPositions
    .filter(p => p.status === 'Open' || !p.status)
    .reduce((sum, p) => {
      return sum + convertFn(safeNumber(p.unrealized_gain_loss ?? 0), p.currency || 'USD');
    }, 0);

  return {
    realizedGains: holdingsRealized + pmRealized,
    unrealizedGains: holdingsUnrealized + pmUnrealized,
    totalGains: (holdingsRealized + pmRealized) + (holdingsUnrealized + pmUnrealized),
  };
}