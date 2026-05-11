import { supabase } from '@/lib/supabaseClient';

const STORAGE_KEY = 'unifolio_portfolio_breakdown_preferences_v1';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function getPortfolioBreakdownPreferences(defaultPrefs) {
  if (typeof window === 'undefined') return defaultPrefs;
  return {
    ...defaultPrefs,
    ...safeParse(window.localStorage.getItem(STORAGE_KEY), defaultPrefs),
  };
}

export function savePortfolioBreakdownPreferencesLocal(prefs) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function savePortfolioBreakdownPreferences(prefs) {
  savePortfolioBreakdownPreferencesLocal(prefs);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      portfolio_breakdown_preferences: prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch {
    // Local storage remains the fallback.
  }
}

export async function loadPortfolioBreakdownPreferences(userId) {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('portfolio_breakdown_preferences')
      .eq('user_id', userId)
      .single();
    return data?.portfolio_breakdown_preferences || null;
  } catch {
    return null;
  }
}
