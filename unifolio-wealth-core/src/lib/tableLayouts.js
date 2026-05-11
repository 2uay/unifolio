import { supabase } from '@/lib/supabaseClient';

const TABLE_LAYOUT_STORAGE_KEY = 'unifolio_table_layouts_v1';

function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function getLocalTableLayouts() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(TABLE_LAYOUT_STORAGE_KEY), {});
}

export function getSavedTableColumnOrder(tableId, defaultOrder = []) {
  if (!tableId) return defaultOrder;
  const saved = getLocalTableLayouts()?.[tableId]?.columnOrder;
  return Array.isArray(saved) && saved.length > 0 ? saved : defaultOrder;
}

export function saveTableColumnOrderLocal(tableId, columnOrder) {
  if (typeof window === 'undefined' || !tableId || !Array.isArray(columnOrder)) return {};
  const next = {
    ...getLocalTableLayouts(),
    [tableId]: {
      columnOrder,
      updatedAt: new Date().toISOString(),
    },
  };
  window.localStorage.setItem(TABLE_LAYOUT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function loadTableLayoutsFromSupabase(userId) {
  if (!userId) return {};
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('table_layout_preferences')
      .eq('user_id', userId)
      .single();

    const prefs = data?.table_layout_preferences;
    if (prefs && typeof prefs === 'object') return prefs;
    if (typeof prefs === 'string') return safeParse(prefs, {});
  } catch {
    // Silent fallback to local storage.
  }
  return {};
}

export async function saveTableColumnOrderToSupabase(tableId, columnOrder) {
  if (!tableId || !Array.isArray(columnOrder)) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    const nextPrefs = saveTableColumnOrderLocal(tableId, columnOrder);
    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      table_layout_preferences: nextPrefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch {
    // Local storage remains the fallback source of truth.
  }
}
