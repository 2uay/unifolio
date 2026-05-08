import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  accounts as sampleAccounts,
  holdings as sampleHoldings,
  institutions as sampleInstitutions,
  transactions as sampleTransactions,
  portfolioSnapshots as samplePortfolioSnapshots,
  accountTypes as sampleAccountTypes,
  calcPortfolioTotals as sampleCalcPortfolioTotals,
  calcAccountValue as sampleCalcAccountValue,
} from '@/lib/mockData';
import { rawRealizedPositions as sampleRealizedPositions } from '@/lib/realizedPositions';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { safeNumber, safeDivide } from '@/lib/safeNum';
import { IMPORT_PORTFOLIO_KEY } from '@/lib/importPersistence';
import { fetchValidatedPrices, fetchHistoricalPricesForTickers } from '@/lib/stockApi';

const PortfolioDataContext = createContext(null);

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function withAliases(holding, accountMap = {}) {
  const qty = safeNumber(holding.quantity ?? holding.position);
  const avg = safeNumber(holding.average_price ?? holding.avgPrice);
  const price = safeNumber(holding.current_price ?? holding.lastPrice ?? holding.price ?? avg);
  const marketValue = safeNumber(holding.market_value ?? holding.marketValue ?? qty * price);
  const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? qty * avg);
  const unrealized = safeNumber(holding.unrealized_gain_loss_amount ?? holding.unrealizedAmt ?? marketValue - costBasis);
  const account = accountMap[holding.account_id ?? holding.accountId];
  return {
    ...holding,
    id: holding.id,
    account_id: holding.account_id ?? holding.accountId,
    accountId: holding.account_id ?? holding.accountId,
    ticker: holding.ticker,
    name: holding.asset_name ?? holding.name ?? holding.ticker,
    quantity: qty,
    position: qty,
    average_price: avg,
    avgPrice: avg,
    current_price: price,
    lastPrice: price,
    market_value: marketValue,
    marketValue,
    cost_basis: costBasis,
    costBasis,
    unrealized_gain_loss_amount: unrealized,
    unrealizedAmt: unrealized,
    unrealized_gain_loss_percent: safeNumber(holding.unrealized_gain_loss_percent ?? safeDivide(unrealized, costBasis) * 100),
    unrealizedPct: safeNumber(holding.unrealized_gain_loss_percent ?? safeDivide(unrealized, costBasis) * 100),
    realized_gain_loss_amount: safeNumber(holding.realized_gain_loss_amount ?? holding.realizedGain),
    realizedGain: safeNumber(holding.realized_gain_loss_amount ?? holding.realizedGain),
    daily_pnl_amount: safeNumber(holding.daily_pnl_amount ?? holding.dailyPnl),
    dailyPnl: safeNumber(holding.daily_pnl_amount ?? holding.dailyPnl),
    daily_pnl_percent: safeNumber(holding.daily_pnl_percent ?? holding.dailyPct),
    dailyPct: safeNumber(holding.daily_pnl_percent ?? holding.dailyPct),
    currency: holding.currency ?? account?.base_currency ?? 'USD',
    asset_class: holding.asset_class ?? holding.assetClass ?? 'Stock',
    assetClass: holding.asset_class ?? holding.assetClass ?? 'Stock',
    sector: holding.sector ?? 'Unknown',
    country: holding.country ?? 'Unknown',
    exchange: holding.exchange ?? holding.listingExchange ?? '',
    purchase_history: Array.isArray(holding.purchase_history) ? holding.purchase_history : [],
    purchaseHistory: Array.isArray(holding.purchase_history) ? holding.purchase_history : [],
    sparkline: holding.sparkline ?? [],
  };
}

function normalizeTransaction(row) {
  const type = row.transaction_type ?? row.type ?? 'Other';
  return {
    ...row,
    account_id: row.account_id ?? row.accountId,
    accountId: row.account_id ?? row.accountId,
    transaction_type: type,
    type: String(type).toLowerCase().replace(/\s+/g, '_'),
    qty: safeNumber(row.quantity),
    quantity: safeNumber(row.quantity),
    price: safeNumber(row.price),
    total: safeNumber(row.total_amount ?? row.total),
    total_amount: safeNumber(row.total_amount ?? row.total),
    fees: safeNumber(row.fees),
    currency: row.currency ?? 'USD',
    transfer_direction: row.transfer_direction ?? row.transferDirection ?? '',
    source_account_id: row.source_account_id ?? row.sourceAccount ?? '',
    destination_account_id: row.destination_account_id ?? row.destinationAccount ?? '',
    transfer_context: row.transfer_context ?? row.transferContext ?? {},
    transferContext: row.transfer_context ?? row.transferContext ?? {},
  };
}

function normalizeRealized(row) {
  const qty = safeNumber(row.quantity ?? row.quantity_closed);
  const cost = safeNumber(row.total_cost_basis ?? row.cost_basis);
  const proceeds = safeNumber(row.total_sale_value ?? row.proceeds);
  const gl = safeNumber(row.realized_gain_loss_amount ?? proceeds - cost);
  return {
    ...row,
    account_id: row.account_id ?? row.accountId,
    accountId: row.account_id ?? row.accountId,
    ticker: row.ticker,
    name: row.asset_name ?? row.name ?? row.ticker,
    asset_class: row.asset_class ?? row.assetClass ?? 'Stock',
    assetClass: row.asset_class ?? row.assetClass ?? 'Stock',
    sector: row.sector ?? 'Unknown',
    currency: row.currency ?? 'USD',
    quantity: qty,
    total_cost_basis: cost,
    total_sale_value: proceeds,
    realized_gain_loss_amount: gl,
    realizedGain: gl,
    realized_gain_loss_percent: safeNumber(row.realized_gain_loss_percent ?? safeDivide(gl, cost) * 100),
    position_status: row.position_status ?? 'Realized',
  };
}

function buildSnapshotsFallback(holdings, accounts) {
  const currentValue = holdings.reduce((sum, h) => sum + safeNumber(h.market_value), 0)
    + accounts.reduce((sum, a) => sum + safeNumber(a.cash_balance), 0);
  return [{
    date: new Date().toISOString().slice(0, 10),
    value: Math.round(currentValue * 100) / 100,
    daily_return_amount: 0,
    daily_return_percent: 0,
    cumulative_return_percent: 0,
    deposits: 0,
    withdrawals: 0,
    net_contributions: 0,
    valuation_method: 'current_import_value',
  }];
}

async function buildHistoricalSnapshots(holdings, accounts, transactions) {
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...transactions]
    .filter(t => t.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (sorted.length === 0) return buildSnapshotsFallback(holdings, accounts);

  const firstDate = String(sorted[0].date).slice(0, 10);

  // All tickers that appear in trades or current active holdings
  const tradeTickers = [...new Set([
    ...sorted
      .filter(t => t.ticker)
      .map(t => t.ticker),
    ...holdings.filter(h => h.ticker && safeNumber(h.quantity) > 0).map(h => h.ticker),
  ].filter(Boolean))];

  // Fetch historical closing prices per ticker
  let priceHistory = {};
  if (tradeTickers.length > 0) {
    try {
      priceHistory = await fetchHistoricalPricesForTickers(tradeTickers, firstDate);
    } catch (err) {
      console.warn('[PortfolioData] Historical price fetch failed:', err?.message || err);
    }
  }

  // Seed last-known prices from current holdings so gaps near today are filled
  const lastKnownPrice = {};
  holdings.forEach(h => {
    if (h.ticker && safeNumber(h.current_price) > 0) {
      lastKnownPrice[h.ticker] = safeNumber(h.current_price);
    }
  });

  // Walk every calendar day from firstDate → today
  const snapshots = [];
  const holdingsMap = {}; // ticker → shares held
  let cash = 0;
  let txIdx = 0;

  const cursor = new Date(firstDate);
  const end = new Date(today);

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    let dayDeposits = 0;
    let dayWithdrawals = 0;

    // Apply all transactions on or before this date
    while (txIdx < sorted.length && String(sorted[txIdx].date).slice(0, 10) <= date) {
      const t = sorted[txIdx];
      const rawType = String(t.transaction_type ?? t.type ?? '').toLowerCase().trim();
      const ticker = t.ticker;
      const qty = safeNumber(t.quantity ?? t.qty);
      const amount = Math.abs(safeNumber(t.total_amount ?? t.total));

      if (rawType === 'buy') {
        if (ticker) holdingsMap[ticker] = (holdingsMap[ticker] || 0) + qty;
        cash -= amount;
      } else if (rawType === 'sell') {
        if (ticker) holdingsMap[ticker] = Math.max(0, (holdingsMap[ticker] || 0) - qty);
        cash += amount;
      } else if (rawType === 'deposit') {
        cash += amount;
        dayDeposits += amount;
      } else if (rawType === 'withdrawal') {
        cash -= amount;
        dayWithdrawals += amount;
      } else if (rawType === 'dividend' || rawType === 'interest') {
        cash += amount;
      } else if (rawType === 'fee') {
        cash -= amount;
      } else if (rawType === 'transfer in' || rawType === 'transfer_in') {
        if (ticker && qty > 0) {
          holdingsMap[ticker] = (holdingsMap[ticker] || 0) + qty;
        } else {
          cash += amount;
          dayDeposits += amount;
        }
      } else if (rawType === 'transfer out' || rawType === 'transfer_out') {
        if (ticker && qty > 0) {
          holdingsMap[ticker] = Math.max(0, (holdingsMap[ticker] || 0) - qty);
        } else {
          cash -= amount;
          dayWithdrawals += amount;
        }
      }
      // position transfer, currency conversion, stock split, other → no portfolio value impact
      txIdx++;
    }

    // Forward-fill prices from historical data for this date
    tradeTickers.forEach(ticker => {
      const p = priceHistory[ticker]?.[date];
      if (p) lastKnownPrice[ticker] = p;
    });

    // Compute portfolio value: holdings at last known prices + cash
    let holdingsValue = 0;
    Object.entries(holdingsMap).forEach(([ticker, qty]) => {
      if (qty > 0 && lastKnownPrice[ticker]) {
        holdingsValue += qty * lastKnownPrice[ticker];
      }
    });

    const value = Math.round((Math.max(0, cash) + holdingsValue) * 100) / 100;

    snapshots.push({
      date,
      value,
      daily_return_amount: 0,
      daily_return_percent: 0,
      cumulative_return_percent: 0,
      deposits: Math.round(dayDeposits * 100) / 100,
      withdrawals: Math.round(dayWithdrawals * 100) / 100,
      net_contributions: Math.round((dayDeposits - dayWithdrawals) * 100) / 100,
      valuation_method: 'reconstructed',
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  // If reconstruction produced all-zero values (e.g. no price history at all), fall back
  if (!snapshots.some(s => s.value > 0)) return buildSnapshotsFallback(holdings, accounts);

  return snapshots;
}

async function enrichHoldingsWithMarketData(holdings) {
  const activeTickers = [...new Set(holdings
    .filter(h => safeNumber(h.quantity) > 0)
    .map(h => h.ticker)
    .filter(Boolean))];

  if (activeTickers.length === 0) return holdings;

  let quotes = {};
  try {
    quotes = await withTimeout(fetchValidatedPrices(activeTickers, holdings), 9000, 'Quote enrichment');
  } catch (error) {
    console.warn('[PortfolioData] Quote enrichment unavailable:', error?.message || error);
  }

  return holdings.map(holding => {
    const quote = quotes[holding.ticker];
    const qty = safeNumber(holding.quantity);
    const brokerPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? holding.price);
    const validatedPrice = safeNumber(quote?.current_price, null);
    const currentPrice = validatedPrice ?? brokerPrice;
    const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? currentPrice);
    const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? qty * avgPrice);
    const marketValue = safeNumber(qty * currentPrice, safeNumber(holding.market_value ?? holding.marketValue));
    const previousClose = safeNumber(quote?.previous_close, brokerPrice || currentPrice);
    const unrealized = marketValue - costBasis;
    const dailyPnl = quote?.previous_close ? (currentPrice - previousClose) * qty : safeNumber(holding.daily_pnl_amount ?? holding.dailyPnl);
    const priceSource = quote?.price_source || (brokerPrice ? 'broker' : 'unavailable');
    const valuationStatus = quote?.valuation_status || (brokerPrice ? 'broker_fallback' : 'unavailable');

    return {
      ...holding,
      current_price: currentPrice,
      lastPrice: currentPrice,
      market_value: marketValue,
      marketValue,
      cost_basis: costBasis,
      costBasis,
      unrealized_gain_loss_amount: unrealized,
      unrealizedAmt: unrealized,
      unrealized_gain_loss_percent: safeDivide(unrealized, costBasis) * 100,
      unrealizedPct: safeDivide(unrealized, costBasis) * 100,
      daily_pnl_amount: dailyPnl,
      dailyPnl,
      daily_pnl_percent: safeDivide(dailyPnl, costBasis) * 100,
      dailyPct: safeDivide(dailyPnl, costBasis) * 100,
      price_source: priceSource,
      valuation_status: valuationStatus,
      quote_rejected: quote?.rejected_quote || null,
    };
  });
}

function sampleBundle() {
  return {
    source: 'sample',
    isSample: true,
    isImported: false,
    hasImportedPortfolio: false,
    isEmptyPortfolio: false,
    accounts: sampleAccounts,
    holdings: sampleHoldings,
    institutions: sampleInstitutions,
    transactions: sampleTransactions.map(normalizeTransaction),
    realizedPositions: sampleRealizedPositions,
    portfolioSnapshots: samplePortfolioSnapshots,
    accountTypes: sampleAccountTypes,
  };
}

function emptyBundle() {
  return {
    source: 'empty',
    isSample: false,
    isImported: false,
    hasImportedPortfolio: false,
    isEmptyPortfolio: true,
    accounts: [],
    holdings: [],
    institutions: [],
    transactions: [],
    realizedPositions: [],
    portfolioSnapshots: [],
    accountTypes: [],
  };
}

function loadLocalImportedBundle() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(IMPORT_PORTFOLIO_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const accounts = Array.isArray(stored.accounts) ? stored.accounts : [];
    const holdingsRaw = Array.isArray(stored.holdings) ? stored.holdings : [];
    if (accounts.length === 0 && holdingsRaw.length === 0) return null;

    const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
    const holdings = holdingsRaw.map(h => withAliases(h, accountMap));
    const transactions = (stored.transactions || []).map(normalizeTransaction);
    const realizedPositions = (stored.realizedPositions || []).map(normalizeRealized);
    const accountTypes = [...new Set(accounts.map(a => a.account_type).filter(Boolean))];

    return {
      source: 'local-import',
      isSample: false,
      isImported: true,
      hasImportedPortfolio: true,
      isEmptyPortfolio: false,
      accounts,
      holdings,
      institutions: Array.isArray(stored.institutions) ? stored.institutions : [],
      transactions,
      realizedPositions,
      portfolioSnapshots: buildSnapshotsFallback(holdings, accounts),
      accountTypes: accountTypes.length ? accountTypes : sampleAccountTypes,
    };
  } catch (error) {
    console.warn('[PortfolioData] Could not load local imported portfolio:', error?.message || error);
    return null;
  }
}

async function enrichImportedBundle(bundle) {
  if (!bundle?.hasImportedPortfolio) return bundle;
  const holdings = await enrichHoldingsWithMarketData(bundle.holdings || []);
  return {
    ...bundle,
    holdings,
    portfolioSnapshots: await buildHistoricalSnapshots(holdings, bundle.accounts || [], bundle.transactions || []),
  };
}

export function PortfolioDataProvider({ children }) {
  const { isAuthenticated, isDemoMode, user } = useAuth();
  const [bundle, setBundle] = useState(emptyBundle);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);

  const refreshPortfolioData = useCallback(async () => {
    if (!isAuthenticated || isDemoMode || !user?.id) {
      setBundle(sampleBundle());
      return;
    }

    const localImportedBundle = loadLocalImportedBundle();
    setBundle(localImportedBundle || emptyBundle());
    setIsLoadingPortfolio(true);
    try {
      const [institutionsRes, accountsRes, holdingsRes, transactionsRes, realizedRes] = await withTimeout(
        Promise.all([
          supabase.from('institutions').select('*').eq('user_id', user.id),
          supabase.from('accounts').select('*').eq('user_id', user.id),
          supabase.from('holdings').select('*').eq('user_id', user.id),
          supabase.from('transactions').select('*').eq('user_id', user.id),
          supabase.from('realized_positions').select('*').eq('user_id', user.id),
        ]),
        9000,
        'Portfolio data load',
      );

      const hardError = [institutionsRes, accountsRes, holdingsRes, transactionsRes]
        .find(res => res.error);
      if (hardError) throw hardError.error;

      const accounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
      const holdingsRaw = Array.isArray(holdingsRes.data) ? holdingsRes.data : [];
      if (accounts.length === 0 && holdingsRaw.length === 0) {
        setBundle(localImportedBundle ? await enrichImportedBundle(localImportedBundle) : emptyBundle());
        return;
      }

      const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
      const holdings = await enrichHoldingsWithMarketData(holdingsRaw.map(h => withAliases(h, accountMap)));
      const transactions = (transactionsRes.data || []).map(normalizeTransaction);
      const realizedPositions = realizedRes.error ? [] : (realizedRes.data || []).map(normalizeRealized);
      const accountTypes = [...new Set(accounts.map(a => a.account_type).filter(Boolean))];

      setBundle({
        source: 'supabase',
        isSample: false,
        isImported: true,
        hasImportedPortfolio: true,
        isEmptyPortfolio: false,
        accounts,
        holdings,
        institutions: institutionsRes.data || [],
        transactions,
        realizedPositions,
        portfolioSnapshots: await buildHistoricalSnapshots(holdings, accounts, transactions),
        accountTypes: accountTypes.length ? accountTypes : sampleAccountTypes,
      });
    } catch (error) {
      console.warn('[PortfolioData] Falling back after data load issue:', error?.message || error);
      setBundle(localImportedBundle ? await enrichImportedBundle(localImportedBundle) : emptyBundle());
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [isAuthenticated, isDemoMode, user?.id]);

  useEffect(() => {
    refreshPortfolioData();
  }, [refreshPortfolioData]);

  useEffect(() => {
    const handler = () => refreshPortfolioData();
    window.addEventListener('unifolio:portfolio-imported', handler);
    return () => window.removeEventListener('unifolio:portfolio-imported', handler);
  }, [refreshPortfolioData]);

  const helpers = useMemo(() => {
    const getAccount = (accountId) => bundle.accounts.find(a => a.id === accountId) ?? null;
    const getInstitution = (institutionId) => bundle.institutions.find(i => i.id === institutionId) ?? null;
    const getInstitutionForAccount = (accountId) => {
      const acc = getAccount(accountId);
      return acc ? getInstitution(acc.institution_id ?? acc.institutionId) : null;
    };
    const calcAccountValue = (accountId) => {
      const acc = getAccount(accountId);
      if (!acc) return 0;
      const holdingsValue = bundle.holdings
        .filter(h => (h.account_id ?? h.accountId) === accountId && h.quantity > 0)
        .reduce((sum, h) => sum + safeNumber(h.market_value), 0);
      return holdingsValue + safeNumber(acc.cash_balance);
    };
    const calcPortfolioTotals = () => {
      const holdingsValue = bundle.holdings.filter(h => h.quantity > 0).reduce((sum, h) => sum + safeNumber(h.market_value), 0);
      const cashTotal = bundle.accounts.reduce((sum, a) => sum + safeNumber(a.cash_balance), 0);
      const totalValue = holdingsValue + cashTotal;
      const totalCostBasis = bundle.holdings.reduce((sum, h) => sum + safeNumber(h.cost_basis), 0);
      const totalUnrealizedGain = bundle.holdings.reduce((sum, h) => sum + safeNumber(h.unrealized_gain_loss_amount), 0);
      const totalRealizedGain = bundle.holdings.reduce((sum, h) => sum + safeNumber(h.realized_gain_loss_amount), 0);
      return {
        total_value: totalValue,
        totalValue,
        holdings_value: holdingsValue,
        holdingsValue,
        cash_total: cashTotal,
        cashTotal,
        total_cost_basis: totalCostBasis,
        totalCostBasis,
        total_unrealized_gain: totalUnrealizedGain,
        totalUnrealizedGain,
        total_realized_gain: totalRealizedGain,
        totalRealizedGain,
        holding_count: bundle.holdings.filter(h => h.quantity > 0).length,
        holdingCount: bundle.holdings.filter(h => h.quantity > 0).length,
        account_count: bundle.accounts.length,
        accountCount: bundle.accounts.length,
      };
    };
    return { getAccount, getInstitution, getInstitutionForAccount, calcAccountValue, calcPortfolioTotals };
  }, [bundle]);

  const value = useMemo(() => ({
    ...bundle,
    ...helpers,
    isLoadingPortfolio,
    refreshPortfolioData,
  }), [bundle, helpers, isLoadingPortfolio, refreshPortfolioData]);

  return <PortfolioDataContext.Provider value={value}>{children}</PortfolioDataContext.Provider>;
}

export function usePortfolioData() {
  const context = useContext(PortfolioDataContext);
  if (!context) throw new Error('usePortfolioData must be used within PortfolioDataProvider');
  return context;
}
