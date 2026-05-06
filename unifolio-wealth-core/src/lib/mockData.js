// ============================================================
// UNIFOLIO — mockData.js
// This file is now a compatibility shim.
// All data and calculations live in portfolioEngine.js
// Import directly from portfolioEngine for new code.
// ============================================================

export {
  // Data
  accounts,
  assets,
  institutions,
  transactions,
  benchmarks,
  watchlist,
  accountTypes,
  holdings,
  portfolioSnapshots,
  rawHoldings,
  predictionMarketAccounts,
  predictionMarketPositions,
  DATA_IS_SAMPLE,
  SAMPLE_DATA_LABEL,

  // Lookup helpers
  getAccount,
  getInstitution,
  getInstitutionForAccount,
  getIncludedAccountIds,
  getHoldingsForAccounts,
  sumMarketValue,
  sumCash,

  // Calculation functions
  calcAccountValue,
  calcPortfolioTotals,
  calcAccountSummary,
  calcHoldingsWithAllocations,
  calcPortfolioBreakdown,
  calcPerformanceData,
  calcMonthlyReturns,
  buildAllocation,
  getInsights,
  getPortfolioTotals,
  insights,
} from './portfolioEngine.js';

// ─── ADDITIONAL LEGACY ALIASES ─────────────────────────────────
// Some old pages used these exact names
import {
  accounts as _accounts,
  institutions as _institutions,
  getInstitution as _getInstitution,
} from './portfolioEngine.js';

/** @deprecated Use accounts[].account_type instead */
export const accountTypes2 = ['TFSA', 'RRSP', 'FHSA', 'Cash', 'Margin', 'Corporate', 'Crypto', 'Savings', 'Other'];