/**
 * Cache Engine
 * Manages cached account data, retention policies, and cache status logic
 */

// Cache status constants
export const CACHE_STATUSES = {
  LIVE_SYNCED: 'Live synced',
  CACHED: 'Cached',
  DISCONNECTED: 'Disconnected',
  SYNC_FAILED: 'Sync failed',
  DATA_RETAINED: 'Data retained',
  DATA_EXPIRED: 'Data expired',
  MANUAL_ONLY: 'Manual data only',
};

// Retention policy durations (in days)
const RETENTION_POLICIES = {
  FREE_USER: 90,          // 3 months
  PAID_USER: Infinity,    // Indefinite
  TAX_RECORDS: 2555,      // 7 years (minimum for tax purposes)
};

/**
 * Determine cache status for an account
 */
export function getCacheStatus(account, lastSync) {
  if (!account) return CACHE_STATUSES.CACHED;

  // If account has recent sync, it's live
  if (lastSync && Date.now() - new Date(lastSync) < 24 * 60 * 60 * 1000) {
    return CACHE_STATUSES.LIVE_SYNCED;
  }

  // If sync failed recently, show failed status
  if (account.last_sync_error && Date.now() - new Date(account.last_sync_error) < 7 * 24 * 60 * 60 * 1000) {
    return CACHE_STATUSES.SYNC_FAILED;
  }

  // If account was disconnected but data retained
  if (account.disconnected_at && account.data_retained) {
    return CACHE_STATUSES.DATA_RETAINED;
  }

  // If account was disconnected
  if (account.disconnected_at) {
    return CACHE_STATUSES.DISCONNECTED;
  }

  // Default: cached
  return CACHE_STATUSES.CACHED;
}

/**
 * Check if cached data should be shown as "last cached value" instead of live
 */
export function isDataCached(account, lastSync) {
  const status = getCacheStatus(account, lastSync);
  return [CACHE_STATUSES.CACHED, CACHE_STATUSES.DISCONNECTED, CACHE_STATUSES.DATA_RETAINED].includes(status);
}

/**
 * Determine retention policy based on user plan
 */
export function getRetentionPolicy(userPlan = 'free') {
  return userPlan === 'paid' ? RETENTION_POLICIES.PAID_USER : RETENTION_POLICIES.FREE_USER;
}

/**
 * Check if cached data is still valid (not expired)
 */
export function isCacheValid(createdDate, userPlan = 'free') {
  const retentionDays = getRetentionPolicy(userPlan);
  if (retentionDays === Infinity) return true;

  const daysSinceCreation = (Date.now() - new Date(createdDate)) / (1000 * 60 * 60 * 24);
  return daysSinceCreation <= retentionDays;
}

/**
 * Format cache info for display
 */
export function formatCacheInfo(lastSyncTime, disconnectedAt = null) {
  if (!lastSyncTime) return 'Never synced';

  const now = Date.now();
  const syncDate = new Date(lastSyncTime);
  const daysSince = Math.floor((now - syncDate) / (1000 * 60 * 60 * 24));

  if (daysSince === 0) return 'Synced today';
  if (daysSince === 1) return 'Synced yesterday';
  if (daysSince < 7) return `Synced ${daysSince} days ago`;
  if (daysSince < 30) return `Synced ${Math.floor(daysSince / 7)} weeks ago`;
  return `Synced ${Math.floor(daysSince / 30)} months ago`;
}

/**
 * Get retention message for UI
 */
export function getRetentionMessage(userPlan = 'free', isDisconnected = false) {
  if (userPlan === 'paid') {
    return 'Historical data retained with your paid plan.';
  }

  if (isDisconnected) {
    return 'Cached data available. Upgrade to retain full disconnected account history.';
  }

  return 'Data retained for 90 days after account disconnection.';
}

/**
 * Generate cache summary for display
 */
export function generateCacheSummary(accounts, snapshots) {
  const disconnected = accounts.filter(a => a.disconnected_at).length;
  const totalSnapshots = snapshots.length;
  const oldestSnapshot = snapshots.length > 0 ? new Date(Math.min(...snapshots.map(s => new Date(s.created_at)))) : null;

  return {
    disconnectedAccounts: disconnected,
    totalSnapshots,
    oldestSnapshot,
    dateRange: oldestSnapshot ? `${oldestSnapshot.toLocaleDateString()} onwards` : 'No snapshots',
  };
}

export default {
  CACHE_STATUSES,
  RETENTION_POLICIES,
  getCacheStatus,
  isDataCached,
  getRetentionPolicy,
  isCacheValid,
  formatCacheInfo,
  getRetentionMessage,
  generateCacheSummary,
};