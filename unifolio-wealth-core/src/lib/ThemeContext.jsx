// @ts-nocheck
import { createContext, useContext, useEffect, useState } from 'react';
import { applyTheme, getChartColors, generateMonochromeTheme, themes } from './themes';
import { supabase } from '@/lib/supabaseClient';

const ThemeContext = createContext(null);

const DEFAULT_THEME = 'royalpurple';
const LEGACY_DEFAULT_THEME = 'redblackwhiteaccent';
const LS_KEY = 'unifolio_default_theme';
const LS_MONO_KEY = 'unifolio_mono_color';

function persistDefaultTheme() {
  localStorage.setItem(LS_KEY, DEFAULT_THEME);
  localStorage.removeItem(LS_MONO_KEY);
}

async function saveToSupabase(userId, themeId, monoColor) {
  if (!userId) return;
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    theme_id: themeId,
    updated_at: new Date().toISOString(),
    ...(monoColor ? { custom_monochrome_color: monoColor } : {}),
  });
}

export function ThemeProvider({ children }) {
  const [selectedTheme, setSelectedTheme] = useState(DEFAULT_THEME);
  const [chartColors, setChartColors] = useState(getChartColors(DEFAULT_THEME));
  const [isLoading, setIsLoading] = useState(true);
  const [customMonochromeColor, setCustomMonochromeColor] = useState('#3b82f6');

  const applyCustomMonochrome = (hexColor) => {
    const monoTheme = generateMonochromeTheme(hexColor);
    const root = document.documentElement;
    Object.entries(monoTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const applyById = (themeId, monoColor) => {
    if (themeId === 'custom-monochrome' && monoColor) {
      applyCustomMonochrome(monoColor);
      setSelectedTheme('custom-monochrome');
      setChartColors(generateMonochromeTheme(monoColor).chartColors);
      setCustomMonochromeColor(monoColor);
    } else if (themeId && themeId !== 'custom-monochrome') {
      setSelectedTheme(themeId);
      setChartColors(getChartColors(themeId));
      applyTheme(themeId);
    }
  };

  useEffect(() => {
    // Step 1: apply the public/default theme immediately.
    // Signed-in users get their saved theme after auth resolves; logged-out/demo
    // visitors should always see the royal purple Unifolio default.
    const storedTheme = localStorage.getItem(LS_KEY);
    if (storedTheme === LEGACY_DEFAULT_THEME) {
      persistDefaultTheme();
    }
    applyById(DEFAULT_THEME);

    // Step 2: subscribe to auth state — load Supabase preference on sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const { data } = await supabase
            .from('user_profiles')
            .select('theme_id, custom_monochrome_color')
            .eq('user_id', session.user.id)
            .single();

          if (data?.theme_id) {
            const monoColor = data.custom_monochrome_color || null;
            applyById(data.theme_id, monoColor);
            // Sync back to localStorage so next load is instant
            localStorage.setItem(LS_KEY, data.theme_id);
            if (monoColor) localStorage.setItem(LS_MONO_KEY, monoColor);
          }
        } catch { /* silent — keep current theme */ }
      } else {
        // Guest: pick a random theme once per browser session (sessionStorage clears on new tab)
        const SESSION_KEY = 'unifolio_guest_theme';
        const sessionTheme = sessionStorage.getItem(SESSION_KEY);
        if (sessionTheme && themes[sessionTheme]) {
          applyById(sessionTheme);
        } else {
          const ids = Object.keys(themes).filter(id => id !== 'custom-monochrome');
          const pick = ids[Math.floor(Math.random() * ids.length)];
          applyById(pick);
          sessionStorage.setItem(SESSION_KEY, pick);
          localStorage.setItem(LS_KEY, pick);
        }
      }
      setIsLoading(false);
    });

    // Also do a one-shot getUser in case onAuthStateChange doesn't fire
    // (e.g. session already exists from a previous tab)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) setIsLoading(false);
      // If user exists, onAuthStateChange will have fired or will fire with INITIAL_SESSION
    });

    return () => subscription.unsubscribe();
  }, []);

  // changeTheme: apply immediately + persist to localStorage + save to Supabase
  const changeTheme = async (themeId, customColor = null) => {
    const color = themeId === 'custom-monochrome' ? (customColor || customMonochromeColor) : null;

    applyById(themeId, color);
    localStorage.setItem(LS_KEY, themeId);
    sessionStorage.setItem('unifolio_guest_theme', themeId);
    if (color != null) localStorage.setItem(LS_MONO_KEY, color);
    else localStorage.removeItem(LS_MONO_KEY);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await saveToSupabase(user.id, themeId, color);
    } catch { /* silent */ }
  };

  const resetToDefaultTheme = () => {
    persistDefaultTheme();
    applyById(DEFAULT_THEME);
  };

  return (
    <ThemeContext.Provider value={{
      selectedTheme,
      changeTheme,
      resetToDefaultTheme,
      defaultTheme: DEFAULT_THEME,
      chartColors,
      isLoading,
      customMonochromeColor,
      setCustomMonochromeColor: (color) => changeTheme('custom-monochrome', color),
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
