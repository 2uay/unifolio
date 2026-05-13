import { supabase } from '@/lib/supabaseClient';
import { clearLocalDeleteTombstones } from '@/lib/dataDeletion';
import { displayTicker, securityKey } from '@/lib/securityIdentity';

const IMPORT_HISTORY_KEY = 'unifolio_import_history';
export const IMPORT_PORTFOLIO_KEY = 'unifolio_latest_imported_portfolio';

const BROKER_METADATA = {
  ibkr: {
    institutionKey: 'interactive-brokers',
    name: 'Interactive Brokers',
    country: 'US',
    logo: 'interactive-brokers',
    color: '#e53935',
    notes: 'CSV/Flex import',
  },
  ibkr_flex: {
    institutionKey: 'interactive-brokers',
    name: 'Interactive Brokers',
    country: 'US',
    logo: 'interactive-brokers',
    color: '#e53935',
    notes: 'CSV/Flex import',
  },
  ibkr_activity_flex: {
    institutionKey: 'interactive-brokers',
    name: 'Interactive Brokers',
    country: 'US',
    logo: 'interactive-brokers',
    color: '#e53935',
    notes: 'CSV/Flex import',
  },
  wealthsimple: {
    institutionKey: 'wealthsimple',
    name: 'Wealthsimple',
    country: 'CA',
    logo: 'wealthsimple',
    color: '#00a36c',
    notes: 'CSV activity/holdings import',
  },
  wealthsimple_activity: {
    institutionKey: 'wealthsimple',
    name: 'Wealthsimple',
    country: 'CA',
    logo: 'wealthsimple',
    color: '#00a36c',
    notes: 'CSV activity import',
  },
};

function safeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function stableId(...parts) {
  return parts.map(safeId).join(':');
}

function tradeDupeKey(t) {
  const ticker = ((t.display_ticker || t.ticker) ?? '').toUpperCase();
  const qty    = Number(t.quantity ?? 0).toFixed(6);
  const price  = Number(t.price    ?? 0).toFixed(6);
  return `${t.account_id}|${t.date}|${ticker}|${qty}|${price}|${t.transaction_type}`;
}

function brokerMetadata(broker) {
  return BROKER_METADATA[broker] || {
    institutionKey: broker || 'imported-broker',
    name: broker || 'Imported Broker',
    country: 'US',
    logo: 'generic',
    color: '#7c3aed',
    notes: 'CSV import',
  };
}

function chunk(rows, size = 400) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
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

async function upsertChunks(table, rows, options = { onConflict: 'id' }) {
  if (!rows.length) return;
  for (const group of chunk(rows)) {
    const { error } = await withTimeout(
      supabase.from(table).upsert(group, options),
      8000,
      `${table} save`,
    );
    if (error) throw error;
  }
}

async function trySaveImportBatch(batch) {
  try {
    const { error } = await withTimeout(
      supabase.from('import_batches').upsert(batch, { onConflict: 'id' }),
      8000,
      'import batch save',
    );
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function transactionTypeForDb(type) {
  if (type === 'Currency Conversion') return 'Currency Conversion';
  if (type === 'Position Transfer') return 'Position Transfer';
  if (type === 'Transfer In') return 'Transfer In';
  if (type === 'Transfer Out') return 'Transfer Out';
  if (type === 'Stock Split') return 'Other';
  if (type === 'Interest') return 'Interest';
  if (type === 'Fee') return 'Fee';
  if (type === 'Dividend') return 'Dividend';
  if (type === 'Deposit') return 'Deposit';
  if (type === 'Withdrawal') return 'Withdrawal';
  if (type === 'Buy') return 'Buy';
  if (type === 'Sell') return 'Sell';
  return 'Other';
}

function buildSummary(parsed) {
  const bundle = parsed.importBundle || {};
  const positions = bundle.positions || (parsed.isHoldings ? parsed.valid : []);
  const realizedPositions = bundle.realizedPositions || [];
  const transactions = bundle.transactions || (!parsed.isHoldings ? parsed.valid : []);
  const uniqueTickers = new Set(positions.map(row => securityKey(row) || row.ticker).filter(Boolean));
  const uniqueAccounts = new Set(positions.map(row => row.account).filter(Boolean));
  return {
    positions: positions.length,
    realizedPositions: realizedPositions.length,
    transactions: transactions.length,
    tickers: uniqueTickers.size,
    accounts: uniqueAccounts.size,
    sections: bundle.sectionSummary || [],
  };
}

function saveLocalHistory(entry) {
  try {
    const history = JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY) || '[]');
    history.unshift(entry);
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {
    // local history is convenience-only; backend persistence is authoritative.
  }
}

function mergeById(existing = [], incoming = []) {
  const map = new Map();
  existing.filter(Boolean).forEach(row => map.set(row.id, row));
  incoming.filter(Boolean).forEach(row => map.set(row.id, row));
  return [...map.values()];
}

function saveLocalImportedPortfolio(payload) {
  try {
    const existing = JSON.parse(localStorage.getItem(IMPORT_PORTFOLIO_KEY) || 'null');
    const replaceAccountIds = new Set(payload.replaceAccountIds || []);
    const existingInstitutions = Array.isArray(existing?.institutions) ? existing.institutions : [];
    const existingAccounts = Array.isArray(existing?.accounts) ? existing.accounts : [];
    const existingHoldings = Array.isArray(existing?.holdings) ? existing.holdings : [];
    const existingRealized = Array.isArray(existing?.realizedPositions) ? existing.realizedPositions : [];
    const existingTransactions = Array.isArray(existing?.transactions) ? existing.transactions : [];
    const keepForAccount = row => !replaceAccountIds.has(row.account_id ?? row.accountId);

    localStorage.setItem(IMPORT_PORTFOLIO_KEY, JSON.stringify({
      version: 2,
      savedAt: payload.now,
      batchId: payload.batchId,
      broker: payload.broker,
      summary: payload.summary,
      institutions: mergeById(existingInstitutions, payload.institutionRows || [payload.institutionRow].filter(Boolean)),
      accounts: mergeById(existingAccounts.filter(keepForAccount), payload.accountRows || [payload.accountRow].filter(Boolean)),
      holdings: mergeById(existingHoldings.filter(keepForAccount), payload.holdingsRows),
      realizedPositions: mergeById(existingRealized.filter(keepForAccount), payload.realizedRows),
      transactions: mergeById(existingTransactions.filter(keepForAccount), payload.transactionRows),
    }));
    return true;
  } catch (error) {
    console.warn('[Import] Could not save local imported portfolio fallback:', error?.message || error);
    return false;
  }
}

async function deleteImportedRowsForAccounts(userId, accountIds) {
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (!userId || ids.length === 0) return;
  const results = await withTimeout(
    Promise.all([
      supabase.from('holdings').delete().eq('user_id', userId).in('account_id', ids),
      supabase.from('realized_positions').delete().eq('user_id', userId).in('account_id', ids),
      supabase.from('transactions').delete().eq('user_id', userId).in('account_id', ids),
    ]),
    9000,
    'replace existing account rows',
  );
  const failed = results.find(result => result.error);
  if (failed) throw failed.error;
}

export async function saveParsedImport(parsed) {
  clearLocalDeleteTombstones();
  const bundle = parsed.importBundle || {};
  const account = bundle.account || {};
  const bundleAccounts = Array.isArray(bundle.accounts) ? bundle.accounts : [];
  const positions = bundle.positions || (parsed.isHoldings ? parsed.valid : []);
  const realizedPositions = bundle.realizedPositions || [];
  const transactions = bundle.transactions || (!parsed.isHoldings ? parsed.valid : []);
  const now = new Date().toISOString();
  const importRunId = String(Date.now());
  const broker = parsed.broker || 'unknown';
  const meta = brokerMetadata(broker);
  const importedAccountId = account.clientAccountId || positions[0]?.account || transactions[0]?.account || 'imported-account';
  let user = null;
  let authWarning = null;

  try {
    const { data, error } = await withTimeout(supabase.auth.getUser(), 4000, 'Auth lookup');
    if (error) throw error;
    user = data?.user || null;
  } catch (error) {
    authWarning = error?.message || 'Could not verify signed-in session.';
  }

  const userId = user?.id || 'local-import';
  const institutionId = stableId(userId, meta.institutionKey);
  const rawAccountIds = [...new Set([
    ...bundleAccounts.map(a => a.clientAccountId || a.account_id || a.accountId || a.id),
    importedAccountId,
    ...positions.map(row => row.account || row.account_id || row.accountId),
    ...transactions.map(row => row.account || row.account_id || row.accountId),
    ...realizedPositions.map(row => row.account || row.account_id || row.accountId),
  ].filter(Boolean))];
  const resolutions = Array.isArray(bundle.accountResolutions) ? bundle.accountResolutions : [];
  const resolutionForRaw = (rawId) => resolutions.find(r => r.rawAccountId === rawId) || null;
  const accountIdForRaw = (rawId) => {
    const raw = rawId || importedAccountId;
    const resolution = resolutionForRaw(raw);
    if (resolution?.action === 'replace' && resolution.targetAccountId) return resolution.targetAccountId;
    if (resolution?.action === 'add_separate') return stableId(userId, broker, raw, resolution.importSuffix || importRunId);
    return stableId(userId, broker, raw);
  };
  const accountId = accountIdForRaw(importedAccountId);
  const replaceAccountIds = resolutions
    .filter(r => r.action === 'replace')
    .map(r => r.targetAccountId || accountIdForRaw(r.rawAccountId));
  const batchId = stableId(userId, broker, importedAccountId, parsed.filename || 'import', importRunId);
  const summary = buildSummary(parsed);

  const institutionRow = {
    id: institutionId,
    user_id: userId,
    name: meta.name,
    type: 'Brokerage',
    country: account.country || meta.country,
    logo: meta.logo,
    color: meta.color,
    connection_status: 'connected',
    last_sync_time: now,
    api_supported: false,
    notes: meta.notes,
  };

  const accountRows = rawAccountIds.map(rawId => {
    const accountMeta = bundleAccounts.find(a => (a.clientAccountId || a.account_id || a.accountId || a.id) === rawId) || {};
    const matchingPosition = positions.find(row => (row.account || row.account_id || row.accountId) === rawId) || {};
    const matchingTransaction = transactions.find(row => (row.account || row.account_id || row.accountId) === rawId) || {};
    return {
      id: accountIdForRaw(rawId),
      user_id: userId,
      institution_id: institutionId,
      account_name: rawId,
      account_type: accountMeta.accountType || matchingPosition.accountType || matchingTransaction.accountType || account.accountType || 'Brokerage',
      base_currency: accountMeta.currency || matchingPosition.currency || matchingTransaction.currency || account.currency || 'USD',
      cash_balance: 0,
      included_in_portfolio: true,
      last_updated: now,
    };
  });
  const accountRow = accountRows.find(row => row.id === accountId) || accountRows[0];

  const batch = {
    id: batchId,
    user_id: userId,
    broker,
    institution_id: institutionId,
    account_id: accountId,
    file_name: parsed.filename || 'import.csv',
    file_size: parsed.fileSize || null,
    status: 'synced',
    summary,
    report_metadata: bundle.report || {},
    normalized_payload: {
      account,
      accounts: bundleAccounts,
      positions,
      realizedPositions,
      transactions,
      fxBalances: bundle.fxBalances || [],
      // IBKR can include tens of thousands of FX rate rows. Keep the useful tail
      // for audit/debugging without turning each import batch into raw-file storage.
      conversionRates: (bundle.conversionRates || []).slice(-250),
      conversionRateCount: (bundle.conversionRates || []).length,
      securities: bundle.securities || [],
      accountResolutions: resolutions,
      securityChoices: bundle.securityChoices || {},
      securityAmbiguities: bundle.securityAmbiguities || [],
      sourceFiles: bundle.sourceFiles || parsed.sourceFiles || [],
      reconciliationWarnings: bundle.reconciliationWarnings || parsed.reconciliationWarnings || [],
    },
    imported_at: now,
    created_at: now,
  };

  const holdingsRows = positions
    .filter(row => row.ticker && Number(row.quantity || 0) !== 0)
    .map(row => {
      const rowAccountId = accountIdForRaw(row.account || row.account_id || row.accountId || importedAccountId);
      return {
      id: stableId(userId, rowAccountId, securityKey(row) || row.ticker),
      user_id: userId,
      account_id: rowAccountId,
      ticker: displayTicker(row) || row.ticker,
      asset_name: row.name || row.asset_name || row.ticker,
      asset_class: row.asset_class || row.assetClass || 'Stock',
      sub_category: row.subCategory || null,
      quantity: Number(row.quantity || 0),
      average_price: Number(row.avgPrice || row.price || 0),
      current_price: Number(row.price || row.current_price || row.lastPrice || 0),
      market_value: Number(row.marketValue || row.market_value || 0),
      cost_basis: Number(row.costBasis || row.cost_basis || 0),
      unrealized_gain_loss_amount: Number(row.unrealized_gain_loss_amount || row.unrealizedGL || 0),
      unrealized_gain_loss_percent: Number(row.unrealized_gain_loss_percent || row.unrealizedPct || 0),
      daily_pnl_amount: Number(row.daily_pnl_amount || row.dailyPnl || 0),
      daily_pnl_percent: Number(row.daily_pnl_percent || row.dailyPct || 0),
      realized_gain_loss_amount: Number(row.realizedGL || 0),
      currency: row.currency || account.currency || 'USD',
      exchange: row.exchange || row.listingExchange || null,
      country: row.country || null,
      sector: row.sector || 'Unknown',
      industry: row.industry || null,
      logo: row.logo || null,
      market_cap: row.market_cap ?? null,
      conid: row.conid || null,
      report_date: row.reportDate || null,
      import_batch_id: batchId,
      purchase_history: row.purchase_history || [],
      security_key: securityKey(row) || null,
      display_ticker: displayTicker(row) || row.ticker,
      quote_symbol: row.quote_symbol || displayTicker(row) || row.ticker,
      listing_exchange: row.listing_exchange || row.exchange || row.listingExchange || null,
      listing_currency: row.listing_currency || row.currency || account.currency || 'USD',
      security_identity: row.security_identity || null,
      identity_confidence: row.identity_confidence || null,
      underlying_ticker: row.underlying_ticker || row.raw_ticker || row.ticker,
      updated_at: now,
    };
    });

  const realizedRows = realizedPositions
    .filter(row => row.ticker && row.close_date)
    .map((row, index) => {
      const rowAccountId = accountIdForRaw(row.account || row.account_id || row.accountId || importedAccountId);
      return {
      id: stableId(userId, rowAccountId, 'realized', row.tradeId || row.id || securityKey(row) || row.ticker, row.close_date, index),
      user_id: userId,
      account_id: rowAccountId,
      ticker: displayTicker(row) || row.ticker,
      asset_name: row.name || row.asset_name || row.ticker,
      asset_class: row.asset_class || row.assetClass || 'Stock',
      sector: row.sector || 'Unknown',
      country: row.country || null,
      exchange: row.exchange || null,
      currency: row.currency || account.currency || 'USD',
      quantity: Number(row.quantity || 0),
      average_buy_price: Number(row.average_buy_price || 0),
      average_sell_price: Number(row.average_sell_price || 0),
      total_cost_basis: Number(row.total_cost_basis || 0),
      total_sale_value: Number(row.total_sale_value || 0),
      realized_gain_loss_amount: Number(row.realized_gain_loss_amount || 0),
      realized_gain_loss_percent: Number(row.realized_gain_loss_percent || 0),
      open_date: row.open_date || null,
      close_date: row.close_date || null,
      holding_period_days: row.holding_period_days || null,
      position_status: 'Realized',
      source_section: row.sourceSection || 'TRNT',
      import_batch_id: batchId,
      broker_transaction_id: row.tradeId || '',
      security_key: securityKey(row) || null,
      display_ticker: displayTicker(row) || row.ticker,
      quote_symbol: row.quote_symbol || displayTicker(row) || row.ticker,
      listing_exchange: row.listing_exchange || row.exchange || null,
      listing_currency: row.listing_currency || row.currency || account.currency || 'USD',
      security_identity: row.security_identity || null,
      identity_confidence: row.identity_confidence || null,
      underlying_ticker: row.underlying_ticker || row.raw_ticker || row.ticker,
      updated_at: now,
    };
    });

  const transactionRows = transactions
    .filter(row => row.date)
    .map((row, index) => {
      const rowAccountId = accountIdForRaw(row.account || row.account_id || row.accountId || importedAccountId);
      return {
      id: stableId(userId, rowAccountId, row.id || row.tradeId || row.sourceSection || 'txn', row.date, index),
      user_id: userId,
      account_id: rowAccountId,
      date: row.date,
      transaction_type: transactionTypeForDb(row.type),
      ticker: displayTicker(row) || row.ticker || null,
      quantity: Number(row.quantity || 0),
      price: Number(row.price || 0),
      total_amount: Number(row.netAmount || row.grossAmount || 0),
      fees: Number(row.fees || 0),
      currency: row.currency || account.currency || 'USD',
      settlement_date: row.settlementDate || null,
      asset_name: row.name || null,
      asset_class: row.assetClass || row.asset_class || null,
      source_section: row.sourceSection || null,
      import_batch_id: batchId,
      broker_transaction_id: row.tradeId || row.id || '',
      transfer_direction: row.transferDirection || '',
      source_account_id: row.sourceAccount || '',
      destination_account_id: row.destinationAccount || '',
      transfer_context: row.transferContext || {},
      security_key: securityKey(row) || null,
      display_ticker: displayTicker(row) || row.ticker || null,
      quote_symbol: row.quote_symbol || displayTicker(row) || row.ticker || null,
      listing_exchange: row.listing_exchange || row.exchange || null,
      listing_currency: row.listing_currency || row.currency || account.currency || 'USD',
      security_identity: row.security_identity || null,
      identity_confidence: row.identity_confidence || null,
      underlying_ticker: row.underlying_ticker || row.raw_ticker || row.ticker || null,
      notes: [
        row.name,
        row.notes,
        row.transferDirection ? `transfer:${row.transferDirection}` : '',
        row.sourceAccount ? `from:${row.sourceAccount}` : '',
        row.destinationAccount ? `to:${row.destinationAccount}` : '',
        row.sourceSection ? `source:${row.sourceSection}` : '',
        row.type && transactionTypeForDb(row.type) !== row.type ? `original:${row.type}` : '',
      ].filter(Boolean).join(' · '),
    };
    });

  // Within-batch dedup: skip rows that are semantically identical within this file
  const _batchKeys = new Map();
  const transactionRowsDeduped = transactionRows.filter(t => {
    const k = tradeDupeKey(t);
    if (_batchKeys.has(k)) return false;
    _batchKeys.set(k, true);
    return true;
  });
  let duplicatesSkipped = transactionRows.length - transactionRowsDeduped.length;
  let dedupedTxns = transactionRowsDeduped;

  const localSaved = saveLocalImportedPortfolio({
    now,
    batchId,
    broker,
    summary,
    institutionRow,
    accountRow,
    institutionRows: [institutionRow],
    accountRows,
    holdingsRows,
    realizedRows,
    transactionRows: transactionRowsDeduped,
    replaceAccountIds,
  });

  let batchResult = { ok: false, error: null };
  let syncWarning = authWarning;

  if (user) {
    try {
      const institutionResult = await withTimeout(
        supabase.from('institutions').upsert(institutionRow, { onConflict: 'id' }),
        8000,
        'institution save',
      );
      if (institutionResult.error) throw institutionResult.error;

      const accountResult = await withTimeout(
        supabase.from('accounts').upsert(accountRows, { onConflict: 'id' }),
        8000,
        'account save',
      );
      if (accountResult.error) throw accountResult.error;

      batchResult = await trySaveImportBatch(batch);

      await deleteImportedRowsForAccounts(user.id, replaceAccountIds);

      // Cross-batch dedup: skip trades already saved in Supabase
      if (transactionRowsDeduped.length) {
        try {
          const acctIds = [...new Set(transactionRowsDeduped.map(r => r.account_id).filter(Boolean))];
          const sortedDates = transactionRowsDeduped.map(r => r.date).filter(Boolean).sort();
          const { data: existing } = await withTimeout(
            supabase
              .from('transactions')
              .select('account_id, date, display_ticker, ticker, quantity, price, transaction_type')
              .eq('user_id', userId)
              .in('account_id', acctIds)
              .gte('date', sortedDates[0])
              .lte('date', sortedDates[sortedDates.length - 1]),
            8000,
            'dedup query',
          );
          if (existing?.length) {
            const existingKeys = new Set(existing.map(tradeDupeKey));
            const before = dedupedTxns.length;
            dedupedTxns = dedupedTxns.filter(t => !existingKeys.has(tradeDupeKey(t)));
            duplicatesSkipped += before - dedupedTxns.length;
          }
        } catch {
          // If dedup query fails, proceed without cross-batch dedup
        }
      }

      await upsertChunks('holdings', holdingsRows);
      await upsertChunks('realized_positions', realizedRows);
      await upsertChunks('transactions', dedupedTxns);
      try {
        await withTimeout(
          supabase.from('user_profiles').upsert({
            user_id: user.id,
            active_import_batch_id: batchId,
            updated_at: now,
          }),
          5000,
          'profile import marker save',
        );
      } catch {
        // Older schema deployments may not have active_import_batch_id yet.
      }
      syncWarning = null;
    } catch (error) {
      syncWarning = error?.message || 'Supabase sync failed; saved locally in this browser.';
      console.warn('[Import] Supabase sync failed; local imported portfolio is active:', syncWarning);
    }
  } else if (!syncWarning) {
    syncWarning = 'Signed-in session was not available; saved locally in this browser.';
  }

  if (!localSaved && syncWarning) {
    throw new Error(syncWarning);
  }

  const syncedToSupabase = !syncWarning;

  const historyEntry = {
    id: batchId,
    filename: parsed.filename,
    broker,
    brokerName: meta.name,
    rowCount: positions.length,
    transactionCount: transactions.length,
    realizedCount: realizedRows.length,
    errorCount: parsed.errors?.length || 0,
    isHoldings: true,
    importedAt: now,
    synced: syncedToSupabase,
    backend: syncedToSupabase ? 'supabase' : 'local',
    batchSaved: batchResult.ok,
    data: positions,
  };
  saveLocalHistory(historyEntry);

  const warningParts = [
    syncWarning,
    batchResult.ok || !syncedToSupabase ? null : 'Import rows synced, but import_batches table is not installed yet.',
  ].filter(Boolean);

  const result = {
    batchId,
    accountId,
    institutionId,
    summary,
    holdingsSaved: holdingsRows.length,
    realizedSaved: realizedRows.length,
    transactionsSaved: dedupedTxns.length,
    duplicatesSkipped,
    batchSaved: batchResult.ok,
    synced: syncedToSupabase,
    backend: syncedToSupabase ? 'supabase' : 'local',
    batchWarning: warningParts.length ? warningParts.join(' ') : null,
  };

  window.dispatchEvent(new CustomEvent('unifolio:portfolio-imported', { detail: result }));
  return result;
}
