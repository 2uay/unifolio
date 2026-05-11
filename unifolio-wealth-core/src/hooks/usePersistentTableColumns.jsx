import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getSavedTableColumnOrder,
  loadTableLayoutsFromSupabase,
  saveTableColumnOrderLocal,
  saveTableColumnOrderToSupabase,
} from '@/lib/tableLayouts';

export default function usePersistentTableColumns(tableId, defaultOrder = []) {
  const { user } = useAuth();
  const [columnOrder, setColumnOrder] = useState(() => getSavedTableColumnOrder(tableId, defaultOrder));

  useEffect(() => {
    setColumnOrder(getSavedTableColumnOrder(tableId, defaultOrder));
  }, [tableId, defaultOrder]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id || !tableId) return;
      const prefs = await loadTableLayoutsFromSupabase(user.id);
      const remoteOrder = prefs?.[tableId]?.columnOrder;
      if (!cancelled && Array.isArray(remoteOrder) && remoteOrder.length > 0) {
        saveTableColumnOrderLocal(tableId, remoteOrder);
        setColumnOrder(remoteOrder);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, tableId]);

  const persistColumnOrder = useCallback((nextOrder) => {
    setColumnOrder(nextOrder);
    saveTableColumnOrderLocal(tableId, nextOrder);
    saveTableColumnOrderToSupabase(tableId, nextOrder);
  }, [tableId]);

  return [columnOrder, persistColumnOrder, setColumnOrder];
}
