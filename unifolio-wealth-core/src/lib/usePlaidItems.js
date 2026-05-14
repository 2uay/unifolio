// Lightweight hook that returns the current user's plaid_items rows
// (status, error_code, institution metadata). Used to surface ITEM_LOGIN_REQUIRED
// and PENDING_EXPIRATION error states in the Accounts UI.
//
// RLS allows the authenticated user to read their own plaid_items rows.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export function usePlaidItems() {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plaid_items')
        .select('id, item_id, institution_id, institution_name, status, error_code, last_synced_at')
        .eq('user_id', user.id);
      if (error) {
        console.warn('[usePlaidItems] fetch failed:', error.message);
        setItems([]);
      } else {
        setItems(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-fetch when the portfolio data refreshes (e.g. after a sync or reconnect).
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('unifolio:portfolio-imported', handler);
    return () => window.removeEventListener('unifolio:portfolio-imported', handler);
  }, [refresh]);

  // Convenience lookups. `byInstitutionId` is keyed on Plaid's raw
  // institution_id (e.g. "ins_127989"). `byInternalInstitutionId` is keyed on
  // the wrapped id Unifolio uses in its institutions table (`plaid_<uid>_<plaidInstId>`),
  // matching how Accounts.jsx groups accounts.
  const byInstitutionId = items.reduce((acc, item) => {
    if (item.institution_id) acc[item.institution_id] = item;
    return acc;
  }, {});
  const byInternalInstitutionId = items.reduce((acc, item) => {
    if (item.institution_id && user?.id) {
      acc[`plaid_${user.id}_${item.institution_id}`] = item;
    }
    if (item.item_id && user?.id) {
      // Fallback: some institutions wrap on item_id when Plaid omits institution_id.
      acc[`plaid_${user.id}_${item.item_id}`] = item;
    }
    return acc;
  }, {});
  const hasAnyError = items.some(item => item.status && item.status !== 'active');

  return { items, byInstitutionId, byInternalInstitutionId, hasAnyError, loading, refresh };
}
