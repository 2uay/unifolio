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
import { fetchValidatedPrices, fetchHistoricalPricesForTickers, fetchManyProfiles } from '@/lib/stockApi';
import { getLocallyDeletedAccountIds, isLocalDeleteAllPending } from '@/lib/dataDeletion';
import { displayTicker, securityKey } from '@/lib/securityIdentity';
import { buildHoldingsFromTransactions } from '@/lib/transactionEngine';

const PortfolioDataContext = createContext(null);

const ENGINE_FLAG_KEY = 'unifolio_use_transaction_engine';
function transactionEngineEnabled() {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(ENGINE_FLAG_KEY) : null;
    return v === null ? true : v === 'true';
  } catch { return true; }
}

// Merge transaction-engine recomputed values onto existing holdings rows.
// We trust the engine for cost_basis, avg_price, quantity, realized P/L,
// dividends — but keep broker metadata (sector, country, logos, IDs) and let
// downstream enrichment fill in the live current_price.
function mergeEngineRecomputation(holdings, transactions) {
  if (!transactionEngineEnabled()) return holdings;
  if (!Array.isArray(transactions) || transactions.length === 0) return holdings;
  const engineRows = buildHoldingsFromTransactions({ transactions, baseCurrency: 'USD' });
  if (engineRows.length === 0) return holdings;
  // Index by (account_id, ticker_upper) — fall back to ticker-only when account
  // is missing on either side (rare).
  const byKey = new Map();
  engineRows.forEach((row) => {
    const tk = String(row.ticker || row.display_ticker || '').toUpperCase();
    if (!tk) return;
    byKey.set(`${row.account_id || ''}::${tk}`, row);
    byKey.set(`::${tk}`, row); // ticker-only fallback
  });
  return holdings.map((h) => {
    const tk = String(h.ticker || h.display_ticker || '').toUpperCase();
    const acct = h.account_id || h.accountId || '';
    const eng = byKey.get(`${acct}::${tk}`) || byKey.get(`::${tk}`);
    if (!eng) return h;

    // The broker statement is the source of truth for current quantity & cost
    // basis (its POST section is reconciled with the actual position). The
    // engine is the source of truth for *flow* (realized gains, dividends, lot
    // history). When the engine's reconstructed quantity disagrees with the
    // broker (most commonly because TRFR transfer-in rows are missing from the
    // statement window), we keep broker fields and just attach the engine lots
    // so the UI can show what we DO know plus surface the reconciliation gap.
    const brokerQty = safeNumber(h.quantity ?? h.position);
    const engineQty = safeNumber(eng.quantity);
    const reconciles = brokerQty > 0 && Math.abs(engineQty - brokerQty) < 0.0001;

    if (!reconciles && brokerQty > 0) {
      return {
        ...h,
        // Keep broker quantity + cost basis verbatim.
        realized_gain_loss_amount: eng.realized_gain_loss_amount,
        realizedAmt: eng.realized_gain_loss_amount,
        dividends_received: eng.dividends_native,
        dividends_native: eng.dividends_native,
        dividends_base: eng.dividends_base,
        total_fees: eng.fees,
        _engine_lots: eng.lots,
        _engine_computed: true,
        _engine_quantity: engineQty,
        _engine_quantity_gap: brokerQty - engineQty,
      };
    }

    return {
      ...h,
      quantity: eng.quantity,
      cost_basis: eng.cost_basis,
      costBasis: eng.cost_basis,
      average_price: eng.avg_price,
      avg_price: eng.avg_price,
      avgPrice: eng.avg_price,
      avg_price_clean: eng.avg_price_clean,
      realized_gain_loss_amount: eng.realized_gain_loss_amount,
      realizedAmt: eng.realized_gain_loss_amount,
      dividends_received: eng.dividends_native,
      dividends_native: eng.dividends_native,
      dividends_base: eng.dividends_base,
      total_fees: eng.fees,
      _engine_lots: eng.lots,
      _engine_computed: true,
    };
  });
}

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
    ticker: displayTicker(holding) || holding.ticker,
    security_key: securityKey(holding),
    securityKey: securityKey(holding),
    display_ticker: displayTicker(holding) || holding.ticker,
    quote_symbol: holding.quote_symbol ?? holding.quoteSymbol ?? holding.ticker,
    listing_exchange: holding.listing_exchange ?? holding.listingExchange ?? holding.exchange ?? '',
    listing_currency: holding.listing_currency ?? holding.listingCurrency ?? holding.currency ?? account?.base_currency ?? 'USD',
    security_identity: holding.security_identity ?? holding.securityIdentity ?? '',
    identity_confidence: holding.identity_confidence ?? holding.identityConfidence ?? '',
    underlying_ticker: holding.underlying_ticker ?? holding.underlyingTicker ?? holding.ticker,
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
    industry: holding.industry ?? 'Unknown',
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
    security_key: securityKey(row),
    securityKey: securityKey(row),
    display_ticker: displayTicker(row) || row.ticker,
    quote_symbol: row.quote_symbol ?? row.quoteSymbol ?? row.ticker,
    listing_exchange: row.listing_exchange ?? row.listingExchange ?? '',
    listing_currency: row.listing_currency ?? row.listingCurrency ?? row.currency ?? 'USD',
    security_identity: row.security_identity ?? row.securityIdentity ?? '',
    identity_confidence: row.identity_confidence ?? row.identityConfidence ?? '',
    underlying_ticker: row.underlying_ticker ?? row.underlyingTicker ?? row.ticker,
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
    ticker: displayTicker(row) || row.ticker,
    security_key: securityKey(row),
    securityKey: securityKey(row),
    display_ticker: displayTicker(row) || row.ticker,
    quote_symbol: row.quote_symbol ?? row.quoteSymbol ?? row.ticker,
    listing_exchange: row.listing_exchange ?? row.listingExchange ?? row.exchange ?? '',
    listing_currency: row.listing_currency ?? row.listingCurrency ?? row.currency ?? 'USD',
    security_identity: row.security_identity ?? row.securityIdentity ?? '',
    identity_confidence: row.identity_confidence ?? row.identityConfidence ?? '',
    underlying_ticker: row.underlying_ticker ?? row.underlyingTicker ?? row.ticker,
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
      .map(t => t.quote_symbol || t.ticker),
    ...holdings.filter(h => h.ticker && safeNumber(h.quantity) > 0).map(h => h.quote_symbol || h.ticker),
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
    const priceKey = h.quote_symbol || h.ticker;
    if (priceKey && safeNumber(h.current_price) > 0) {
      lastKnownPrice[priceKey] = safeNumber(h.current_price);
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
      const ticker = t.quote_symbol || t.ticker;
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
    .map(h => h.quote_symbol || h.ticker)
    .filter(Boolean))];

  if (activeTickers.length === 0) return holdings;

  // Profile lookups use the underlying US ticker (LLY, not LLY.NE) so a CDR
  // and the underlying share resolve to the same Finnhub profile. Cached 30
  // days, so this is essentially free after the first import.
  const profileTickers = [...new Set(holdings
    .filter(h => safeNumber(h.quantity) > 0)
    .map(h => h.underlying_ticker || h.ticker)
    .filter(Boolean))];

  let quotes = {};
  let profiles = {};
  try {
    [quotes, profiles] = await Promise.all([
      withTimeout(fetchValidatedPrices(activeTickers, holdings), 9000, 'Quote enrichment'),
      withTimeout(fetchManyProfiles(profileTickers), 9000, 'Profile enrichment').catch(err => {
        console.warn('[PortfolioData] Profile enrichment unavailable:', err?.message || err);
        return {};
      }),
    ]);
  } catch (error) {
    console.warn('[PortfolioData] Quote enrichment unavailable:', error?.message || error);
  }

  // Helper: only apply profile fields when the broker didn't supply real data.
  // IBKR provides sector/country in the SECU section; we shouldn't overwrite it.
  const isMissing = (v) => !v || v === 'Unknown' || v === '';

  return holdings.map(holding => {
    const quoteKey = holding.quote_symbol || holding.ticker;
    const quote = quotes[quoteKey];
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

    const profile = profiles[String(holding.underlying_ticker || holding.ticker || '').toUpperCase()];
    const enrichedSector = isMissing(holding.sector) && profile?.finnhubIndustry ? profile.finnhubIndustry : holding.sector;
    const enrichedIndustry = isMissing(holding.industry) && profile?.finnhubIndustry ? profile.finnhubIndustry : holding.industry;
    const enrichedCountry = isMissing(holding.country) && profile?.country ? profile.country : holding.country;
    const enrichedLogo = holding.logo || profile?.logo || null;
    const enrichedMarketCap = holding.market_cap ?? profile?.marketCapitalization ?? null;
    const enrichedExchange = holding.exchange || profile?.exchange || holding.listing_exchange || '';

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
      sector: enrichedSector,
      industry: enrichedIndustry,
      country: enrichedCountry,
      exchange: enrichedExchange,
      logo: enrichedLogo,
      market_cap: enrichedMarketCap,
    };
  });
}

function isExternalCashContribution(t, knownAccountIds) {
  const type = String(t.transaction_type ?? t.type ?? '').toLowerCase().replace(/\s+/g, '_');
  const hasTicker = Boolean(t.ticker);
  const source = t.source_account_id || t.transfer_context?.sourceAccount || '';
  const destination = t.destination_account_id || t.transfer_context?.destinationAccount || '';
  const internalTransfer = knownAccountIds.has(source) && knownAccountIds.has(destination);
  if (hasTicker || internalTransfer) return null;
  if (type === 'deposit' || type === 'transfer_in') return 'deposit';
  if (type === 'withdrawal' || type === 'transfer_out') return 'withdrawal';
  return null;
}

function calculateContributionTotals(transactions = [], accounts = []) {
  const knownAccountIds = new Set(accounts.flatMap(a => [a.id, a.account_name]).filter(Boolean));
  return transactions.reduce((totals, t) => {
    const kind = isExternalCashContribution(t, knownAccountIds);
    if (!kind) return totals;
    const amount = Math.abs(safeNumber(t.total_amount ?? t.total ?? t.netAmount ?? t.grossAmount));
    if (kind === 'deposit') totals.totalDeposited += amount;
    if (kind === 'withdrawal') totals.totalWithdrawn += amount;
    totals.byCurrency[t.currency || 'USD'] = totals.byCurrency[t.currency || 'USD'] || { deposited: 0, withdrawn: 0 };
    totals.byCurrency[t.currency || 'USD'][kind === 'deposit' ? 'deposited' : 'withdrawn'] += amount;
    totals.netContributions = totals.totalDeposited - totals.totalWithdrawn;
    return totals;
  }, { totalDeposited: 0, totalWithdrawn: 0, netContributions: 0, byCurrency: {} });
}

function applyTransferContextToHoldings(holdings = [], transactions = [], accounts = []) {
  const accountLookup = new Map(accounts.flatMap(a => [[a.id, a], [a.account_name, a]].filter(([key]) => key)));
  const activeTransfers = transactions
    .filter(t => ['position_transfer', 'transfer_in', 'transfer_out'].includes(t.type))
    .filter(t => t.ticker && safeNumber(t.quantity) > 0)
    .filter(t => t.destination_account_id || t.transfer_context?.destinationAccount);

  if (!activeTransfers.length) return holdings;

  return holdings.map(holding => {
    const match = activeTransfers.find(t => {
      const sameSecurity = securityKey(t) === securityKey(holding);
      const sameSource = !t.source_account_id || t.source_account_id === holding.account_id || t.transfer_context?.sourceAccount === holding.account_id;
      return sameSecurity && sameSource && Math.abs(safeNumber(t.quantity) - safeNumber(holding.quantity)) <= Math.max(0.01, safeNumber(holding.quantity) * 0.01);
    });
    if (!match) return holding;
    const destinationRaw = match.destination_account_id || match.transfer_context?.destinationAccount;
    const destination = accountLookup.get(destinationRaw);
    if (!destination?.id || destination.id === holding.account_id) return holding;
    return {
      ...holding,
      account_id: destination.id,
      accountId: destination.id,
      accountType: destination.account_type || holding.accountType,
      transfer_context: match.transfer_context,
      purchase_history: (holding.purchase_history || []).map(lot => ({
        ...lot,
        transferDate: match.date,
        sourceAccount: match.source_account_id || match.transfer_context?.sourceAccount || holding.account_id,
        destinationAccount: destination.id,
      })),
      purchaseHistory: (holding.purchase_history || []).map(lot => ({
        ...lot,
        transferDate: match.date,
        sourceAccount: match.source_account_id || match.transfer_context?.sourceAccount || holding.account_id,
        destinationAccount: destination.id,
      })),
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
    const locallyDeleted = new Set(getLocallyDeletedAccountIds());
    const keepAccount = row => !locallyDeleted.has(row.account_id ?? row.accountId ?? row.id);
    const accounts = (Array.isArray(stored.accounts) ? stored.accounts : []).filter(keepAccount);
    const holdingsRaw = (Array.isArray(stored.holdings) ? stored.holdings : []).filter(keepAccount);
    if (accounts.length === 0 && holdingsRaw.length === 0) return null;

    const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
    const transactions = (stored.transactions || []).filter(keepAccount).map(normalizeTransaction);
    const transferAdjusted = applyTransferContextToHoldings(holdingsRaw.map(h => withAliases(h, accountMap)), transactions, accounts);
    const holdings = mergeEngineRecomputation(transferAdjusted, transactions);
    const realizedPositions = (stored.realizedPositions || []).filter(keepAccount).map(normalizeRealized);
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
  const engineMerged = mergeEngineRecomputation(bundle.holdings || [], bundle.transactions || []);
  const holdings = await enrichHoldingsWithMarketData(engineMerged);
  return {
    ...bundle,
    holdings,
    portfolioSnapshots: await buildHistoricalSnapshots(holdings, bundle.accounts || [], bundle.transactions || []),
  };
}

export function PortfolioDataProvider({ children }) {
  const { isAuthenticated, isDemoMode, isLoadingAuth, user } = useAuth();
  const [bundle, setBundle] = useState(emptyBundle);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);

  const refreshPortfolioData = useCallback(async () => {
    // Don't flicker sample data while auth is still resolving — caused the
    // dashboard to render with 4 sample dots until a tab switch forced a
    // remount once real data arrived.
    if (isLoadingAuth) return;

    if (!isAuthenticated || isDemoMode || !user?.id) {
      setBundle(sampleBundle());
      return;
    }

    if (isLocalDeleteAllPending(user.id)) {
      setBundle(emptyBundle());
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

      const locallyDeleted = new Set(getLocallyDeletedAccountIds());
      const keepAccount = row => !locallyDeleted.has(row.account_id ?? row.accountId ?? row.id);
      const accounts = (Array.isArray(accountsRes.data) ? accountsRes.data : []).filter(keepAccount);
      const holdingsRaw = (Array.isArray(holdingsRes.data) ? holdingsRes.data : []).filter(keepAccount);
      if (accounts.length === 0 && holdingsRaw.length === 0) {
        setBundle(localImportedBundle ? await enrichImportedBundle(localImportedBundle) : emptyBundle());
        return;
      }

      const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
      const transactions = (transactionsRes.data || []).filter(keepAccount).map(normalizeTransaction);
      const transferAdjusted = applyTransferContextToHoldings(holdingsRaw.map(h => withAliases(h, accountMap)), transactions, accounts);
      const engineMerged = mergeEngineRecomputation(transferAdjusted, transactions);
      const holdings = await enrichHoldingsWithMarketData(engineMerged);
      const realizedPositions = realizedRes.error ? [] : (realizedRes.data || []).filter(keepAccount).map(normalizeRealized);
      const accountTypes = [...new Set(accounts.map(a => a.account_type).filter(Boolean))];

      // Drop institutions that no longer have any (non-tombstoned) accounts.
      // Keeps the Accounts/Institutions pages clean immediately after a delete,
      // even if the server-side institution row is still being pruned.
      const referencedInstitutionIds = new Set(
        accounts.map(a => a.institution_id ?? a.institutionId).filter(Boolean),
      );
      const filteredInstitutions = (institutionsRes.data || []).filter(
        inst => referencedInstitutionIds.has(inst.id),
      );

      setBundle({
        source: 'supabase',
        isSample: false,
        isImported: true,
        hasImportedPortfolio: true,
        isEmptyPortfolio: false,
        accounts,
        holdings,
        institutions: filteredInstitutions,
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
  }, [isAuthenticated, isDemoMode, isLoadingAuth, user?.id]);

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
    const calcContributionTotals = () => calculateContributionTotals(bundle.transactions, bundle.accounts);
    return { getAccount, getInstitution, getInstitutionForAccount, calcAccountValue, calcPortfolioTotals, calcContributionTotals };
  }, [bundle]);

  const updateTransferTransaction = useCallback(async (transactionId, updates) => {
    if (!transactionId) throw new Error('Missing transaction id.');
    const now = new Date().toISOString();
    const patch = {
      source_account_id: updates.source_account_id ?? updates.sourceAccount ?? '',
      destination_account_id: updates.destination_account_id ?? updates.destinationAccount ?? '',
      transfer_context: updates.transfer_context ?? updates.transferContext ?? {},
      notes: updates.notes ?? '',
      transfer_edited_at: now,
    };

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem(IMPORT_PORTFOLIO_KEY) || 'null');
        if (stored?.transactions) {
          stored.transactions = stored.transactions.map(row => row.id === transactionId ? { ...row, ...patch } : row);
          localStorage.setItem(IMPORT_PORTFOLIO_KEY, JSON.stringify(stored));
        }
      } catch {
        // Supabase remains authoritative when local fallback cannot be updated.
      }
    }

    if (user?.id) {
      const { error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('user_id', user.id)
        .eq('id', transactionId);
      if (error) throw error;
    }

    await refreshPortfolioData();
  }, [refreshPortfolioData, user?.id]);

  const createTransaction = useCallback(async (txData) => {
    const newTx = {
      ...txData,
      id: txData.id || `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
      user_id: user?.id || null,
    };

    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem(IMPORT_PORTFOLIO_KEY) || 'null');
        if (stored?.transactions) {
          stored.transactions = [...stored.transactions, newTx];
          localStorage.setItem(IMPORT_PORTFOLIO_KEY, JSON.stringify(stored));
        }
      } catch {
        // non-fatal
      }
    }

    if (user?.id) {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) throw error;
    }

    await refreshPortfolioData();
  }, [refreshPortfolioData, user?.id]);

  const value = useMemo(() => ({
    ...bundle,
    ...helpers,
    isLoadingPortfolio,
    refreshPortfolioData,
    updateTransferTransaction,
    createTransaction,
  }), [bundle, helpers, isLoadingPortfolio, refreshPortfolioData, updateTransferTransaction, createTransaction]);

  return <PortfolioDataContext.Provider value={value}>{children}</PortfolioDataContext.Provider>;
}

export function usePortfolioData() {
  const context = useContext(PortfolioDataContext);
  if (!context) throw new Error('usePortfolioData must be used within PortfolioDataProvider');
  return {
    getInstitution: () => null,
    getInstitutionForAccount: () => null,
    getAccount: () => null,
    calcAccountValue: () => 0,
    calcPortfolioTotals: () => ({}),
    calcContributionTotals: () => ({ totalDeposited: 0, totalWithdrawn: 0, netContributions: 0, byCurrency: {} }),
    ...context,
  };
}
