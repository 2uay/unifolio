/**
 * Debt and Balance Management
 * Utilities for tracking credit cards, loans, and payment balances
 */

export const DEBT_TYPES = [
  'Credit card',
  'Mortgage',
  'Auto loan',
  'Student loan',
  'Personal loan',
  'Line of credit',
  'Payment app balance',
  'Other liability',
  'Other cash balance',
];

export const LOAN_TYPES = [
  'Mortgage',
  'Auto loan',
  'Student loan',
  'Personal loan',
  'Line of credit',
  'Business loan',
  'Other',
];

export const PAYMENT_PROVIDERS = [
  'PayPal',
  'Venmo',
  'Cash App',
  'Wise',
  'Revolut',
  'Other',
];

export const CONNECTION_STATUSES = [
  'Connected',
  'Not connected',
  'Syncing',
  'Sync failed',
  'API not supported yet',
  'Manual',
];

export const BALANCE_TYPES = [
  'Positive balance',
  'Amount owed',
  'Pending balance',
];

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(currentBalance, creditLimit) {
  if (!creditLimit || creditLimit <= 0) return null;
  return Math.round((currentBalance / creditLimit) * 100);
}

/**
 * Calculate remaining months on loan
 */
export function calculateRemainingMonths(maturityDate) {
  if (!maturityDate) return null;
  const now = new Date();
  const maturity = new Date(maturityDate);
  const months = (maturity.getFullYear() - now.getFullYear()) * 12 + (maturity.getMonth() - now.getMonth());
  return Math.max(0, months);
}

/**
 * Categorize debts for summary
 */
export function categorizeDeb(debtList) {
  return {
    creditCards: debtList.filter(d => d.type === 'CreditCard'),
    mortgages: debtList.filter(d => d.type === 'Loan' && d.loan_type === 'Mortgage'),
    loans: debtList.filter(d => d.type === 'Loan' && d.loan_type !== 'Mortgage'),
    paymentBalances: debtList.filter(d => d.type === 'PaymentBalance'),
  };
}

/**
 * Calculate total debts (liabilities)
 */
export function calculateTotalDebts(debtList, convertFn) {
  return debtList.reduce((sum, debt) => {
    if (!debt.include_in_net_value) return sum;
    const amount = debt.current_balance || debt.outstanding_balance || debt.balance || 0;
    const currency = debt.currency || 'USD';
    const converted = convertFn(Math.max(0, amount), currency);
    
    // Only count liabilities (positive balances for credit cards/loans)
    if (debt.type === 'PaymentBalance' && debt.balance_type === 'Positive balance') {
      return sum; // Don't count as debt
    }
    return sum + converted;
  }, 0);
}

/**
 * Calculate total positive payment balances (assets)
 */
export function calculatePositiveBalances(paymentBalances, convertFn) {
  return paymentBalances
    .filter(b => b.balance_type === 'Positive balance' && b.include_in_net_value && b.balance > 0)
    .reduce((sum, b) => {
      const converted = convertFn(b.balance, b.currency || 'USD');
      return sum + converted;
    }, 0);
}

/**
 * Calculate debt-to-asset ratio
 */
export function calculateDebtToAssetRatio(totalDebts, totalAssets) {
  if (totalAssets <= 0) return 0;
  return (totalDebts / totalAssets) * 100;
}

/**
 * Find highest interest debt
 */
export function findHighestInterestDebt(debtList) {
  const debtsWithRate = debtList.filter(d => d.interest_rate && d.interest_rate > 0);
  if (debtsWithRate.length === 0) return null;
  return debtsWithRate.reduce((max, d) => d.interest_rate > max.interest_rate ? d : max);
}

/**
 * Find upcoming payments (due within 7 days)
 */
export function findUpcomingPayments(debtList) {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return debtList.filter(d => {
    const dueDate = d.payment_due_date || d.next_payment_date;
    if (!dueDate) return false;
    const due = new Date(dueDate);
    return due >= now && due <= sevenDaysLater;
  });
}