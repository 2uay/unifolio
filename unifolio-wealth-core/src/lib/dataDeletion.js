import { supabase } from '@/lib/supabaseClient';

const IMPORT_PORTFOLIO_KEY = 'unifolio_latest_imported_portfolio';
const IMPORT_HISTORY_KEY = 'unifolio_import_history';
const PENDING_ACCOUNT_DELETE_KEY = 'unifolio_pending_deleted_accounts';
const PENDING_ALL_DELETE_KEY = 'unifolio_pending_delete_all_user';

const DELETE_TIMEOUT_MS = 12000;

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function rpcMissingMessage(name) {
  return `Database delete function "${name}" is not installed yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then try again.`;
}

function normalizeRpcError(name, error) {
  const message = error?.message || String(error || '');
  if (/not found|could not find|schema cache|function/i.test(message)) {
    return new Error(rpcMissingMessage(name));
  }
  return new Error(message || `${name} failed.`);
}

async function runDeleteRpc(name, args = {}) {
  const result = await withTimeout(supabase.rpc(name, args), DELETE_TIMEOUT_MS, name);
  if (result?.error) throw normalizeRpcError(name, result.error);
  return result?.data || {};
}

async function runClientDelete(label, query) {
  const result = await withTimeout(query, DELETE_TIMEOUT_MS, label);
  if (result?.error) throw result.error;
  return result;
}

async function cleanupAccountClientSide(accountId, userId) {
  const scoped = (table) => {
    let query = supabase.from(table).delete().eq('account_id', accountId);
    if (userId) query = query.eq('user_id', userId);
    return query;
  };

  // Capture the institution_id before deleting the account row, so we can
  // prune the institution if it ends up orphaned.
  let institutionId = null;
  try {
    const lookup = await withTimeout(
      supabase.from('accounts').select('institution_id').eq('id', accountId).maybeSingle(),
      DELETE_TIMEOUT_MS,
      'Lookup account institution',
    );
    institutionId = lookup?.data?.institution_id || null;
  } catch (err) {
    console.warn('[DataDeletion] institution lookup failed:', err?.message || err);
  }

  await Promise.allSettled([
    runClientDelete('Delete account holdings', scoped('holdings')),
    runClientDelete('Delete account realized positions', scoped('realized_positions')),
    runClientDelete('Delete account transactions', scoped('transactions')),
    runClientDelete(
      'Delete account import batches',
      userId
        ? supabase.from('import_batches').delete().eq('account_id', accountId).eq('user_id', userId)
        : supabase.from('import_batches').delete().eq('account_id', accountId),
    ),
  ]);
  await runClientDelete(
    'Delete account',
    userId
      ? supabase.from('accounts').delete().eq('id', accountId).eq('user_id', userId)
      : supabase.from('accounts').delete().eq('id', accountId),
  );

  // Orphaned-institution cascade: drop the institution if nothing else
  // references it (no remaining accounts, no Plaid items).
  if (institutionId) {
    try {
      const [acctsLeft, plaidLeft] = await Promise.all([
        withTimeout(
          supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId),
          DELETE_TIMEOUT_MS,
          'Count remaining accounts',
        ),
        withTimeout(
          supabase.from('plaid_items').select('id', { count: 'exact', head: true }).eq('institution_id', institutionId),
          DELETE_TIMEOUT_MS,
          'Count remaining plaid items',
        ).catch(() => ({ count: 0 })),
      ]);
      const remaining = (acctsLeft?.count || 0) + (plaidLeft?.count || 0);
      if (remaining === 0) {
        await runClientDelete(
          'Delete orphaned institution',
          userId
            ? supabase.from('institutions').delete().eq('id', institutionId).eq('user_id', userId)
            : supabase.from('institutions').delete().eq('id', institutionId),
        );
      }
    } catch (err) {
      console.warn('[DataDeletion] orphaned-institution cleanup skipped:', err?.message || err);
    }
  }
}

async function cleanupAllClientSide(userId) {
  if (!userId) return;
  const byUser = (table) => supabase.from(table).delete().eq('user_id', userId);
  await Promise.allSettled([
    runClientDelete('Delete holdings', byUser('holdings')),
    runClientDelete('Delete realized positions', byUser('realized_positions')),
    runClientDelete('Delete transactions', byUser('transactions')),
    runClientDelete('Delete import batches', byUser('import_batches')),
    runClientDelete('Delete watchlist', byUser('watchlist')),
  ]);
  await Promise.allSettled([
    runClientDelete('Delete accounts', byUser('accounts')),
    runClientDelete('Delete institutions', byUser('institutions')),
    runClientDelete('Delete profile preferences', supabase.from('user_profiles').delete().eq('user_id', userId)),
  ]);
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function getLocallyDeletedAccountIds() {
  return readJson(PENDING_ACCOUNT_DELETE_KEY, []);
}

export function isLocalDeleteAllPending(userId) {
  try {
    const value = localStorage.getItem(PENDING_ALL_DELETE_KEY);
    return Boolean(value && (!userId || value === userId));
  } catch {
    return false;
  }
}

export function clearLocalDeleteTombstones() {
  try {
    localStorage.removeItem(PENDING_ACCOUNT_DELETE_KEY);
    localStorage.removeItem(PENDING_ALL_DELETE_KEY);
  } catch { /* ignore */ }
}

function markAccountDeletedLocally(accountId) {
  const ids = new Set(getLocallyDeletedAccountIds());
  ids.add(accountId);
  writeJson(PENDING_ACCOUNT_DELETE_KEY, [...ids]);
}

function markAllDeletedLocally(userId) {
  try { localStorage.setItem(PENDING_ALL_DELETE_KEY, userId || 'local'); } catch { /* ignore */ }
}

function readLocalPortfolio() {
  try {
    return JSON.parse(localStorage.getItem(IMPORT_PORTFOLIO_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeLocalPortfolio(bundle) {
  try {
    if (!bundle) localStorage.removeItem(IMPORT_PORTFOLIO_KEY);
    else localStorage.setItem(IMPORT_PORTFOLIO_KEY, JSON.stringify(bundle));
  } catch {
    // Local fallback cleanup is best-effort.
  }
}

export function removeLocalAccountData(accountId) {
  const bundle = readLocalPortfolio();
  if (!bundle) return;
  const keepAccount = row => (row.account_id ?? row.accountId ?? row.id) !== accountId;
  const removed = (bundle.accounts || []).find(row => row.id === accountId);
  bundle.accounts = (bundle.accounts || []).filter(row => row.id !== accountId);
  bundle.holdings = (bundle.holdings || []).filter(keepAccount);
  bundle.realizedPositions = (bundle.realizedPositions || []).filter(keepAccount);
  bundle.transactions = (bundle.transactions || []).filter(keepAccount);

  // Drop the institution if nothing references it locally any more.
  const orphanedInstitutionId = removed?.institution_id ?? removed?.institutionId;
  if (orphanedInstitutionId) {
    const stillReferenced = (bundle.accounts || []).some(
      a => (a.institution_id ?? a.institutionId) === orphanedInstitutionId,
    );
    if (!stillReferenced) {
      bundle.institutions = (bundle.institutions || []).filter(i => i.id !== orphanedInstitutionId);
    }
  }

  writeLocalPortfolio(bundle);
}

export function clearLocalPortfolioData() {
  [
    IMPORT_PORTFOLIO_KEY,
    IMPORT_HISTORY_KEY,
    'unifolio_latest_imported_portfolio',
    'unifolio_import_history',
    'unifolio_benchmark_series_v2',
    'unifolio_chart_candles_v3',
    'unifolio_stock_quotes_v4',
    'unifolio_fx_rates_v1',
    'unifolio_starred_stocks',
    'unifolio_watchlist_view',
  ].forEach(key => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
}

export async function deleteImportedAccountData(accountId, userId) {
  if (!accountId) throw new Error('Missing account id.');
  markAccountDeletedLocally(accountId);
  removeLocalAccountData(accountId);
  window.dispatchEvent(new CustomEvent('unifolio:portfolio-imported', { detail: { deletedAccountId: accountId } }));

  void (async () => {
    try {
      await runDeleteRpc('delete_unifolio_account', { p_account_id: accountId });
    } catch (rpcError) {
      console.warn('[DataDeletion] Account RPC delete unavailable; trying client cleanup:', rpcError?.message || rpcError);
      try {
        await cleanupAccountClientSide(accountId, userId);
      } catch (clientError) {
        console.warn('[DataDeletion] Background account cleanup still pending:', clientError?.message || clientError);
      }
    }
  })();
}

// Server endpoint that revokes Plaid Items and deletes the auth.users row.
// The browser cannot do either directly (both require service-role / admin
// privileges), so we hand off to a Vercel serverless function with the
// user's session JWT for authorization.
async function callDeleteAccountEndpoint() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[DataDeletion] No session token available for full account delete');
      return null;
    }
    const res = await withTimeout(fetch('/api/account/delete-all', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }), DELETE_TIMEOUT_MS, 'Account delete endpoint');
    if (!res?.ok && res?.status !== 207) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    return res.json().catch(() => ({}));
  } catch (err) {
    console.warn('[DataDeletion] Account delete endpoint failed:', err?.message || err);
    return null;
  }
}

export async function deleteAllUserPortfolioData(userId) {
  if (!userId) {
    markAllDeletedLocally(userId);
    clearLocalPortfolioData();
    window.dispatchEvent(new CustomEvent('unifolio:portfolio-imported', { detail: { deletedAll: true } }));
    return;
  }

  markAllDeletedLocally(userId);
  clearLocalPortfolioData();
  window.dispatchEvent(new CustomEvent('unifolio:portfolio-imported', { detail: { deletedAll: true } }));

  void (async () => {
    // Step 1: clear app data tables via the Postgres RPC (or client fallback).
    try {
      await runDeleteRpc('delete_unifolio_user_data');
    } catch (rpcError) {
      console.warn('[DataDeletion] Full RPC delete unavailable; trying client cleanup:', rpcError?.message || rpcError);
      try {
        await cleanupAllClientSide(userId);
      } catch (clientError) {
        console.warn('[DataDeletion] Background full cleanup still pending:', clientError?.message || clientError);
      }
    }

    // Step 2: revoke Plaid Items + delete auth.users row via the server
    // endpoint (requires service-role + Plaid client secret — both server-only).
    // After this completes, the user account is fully gone — they cannot
    // sign back in, and their Plaid access tokens are invalidated at the
    // bank end as well.
    await callDeleteAccountEndpoint();

    // Force any remaining session to terminate immediately so the UI
    // reflects the deletion and the user lands on the public Welcome page.
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  })();
}
