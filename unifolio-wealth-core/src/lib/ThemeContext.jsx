// @ts-nocheck
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { applyTheme, applyThemePaletteVariables, getChartColors, generateMonochromeTheme, themes } from './themes';
import { supabase } from '@/lib/supabaseClient';

const ThemeContext = createContext(null);

const DEFAULT_THEME = 'malachite';
const LEGACY_DEFAULT_THEME = 'redblackwhiteaccent';
const PREVIOUS_DEFAULT_THEME = 'royalpurple';
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
  const committedThemeRef = useRef(DEFAULT_THEME);
  const committedMonoColorRef = useRef('#3b82f6');
  const livingRafRef = useRef(null);

  const applyCustomMonochrome = (hexColor) => {
    const monoTheme = generateMonochromeTheme(hexColor);
    const root = document.documentElement;
    Object.entries(monoTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    applyThemePaletteVariables(monoTheme, 'custom-monochrome');
    root.style.setProperty('--logo-hue-base', '0deg');
  };

  const applyById = (themeId, monoColor, { commit = true } = {}) => {
    if (themeId === 'custom-monochrome' && monoColor) {
      applyCustomMonochrome(monoColor);
      setChartColors(generateMonochromeTheme(monoColor).chartColors);
      if (commit) {
        setSelectedTheme('custom-monochrome');
        setCustomMonochromeColor(monoColor);
        committedThemeRef.current = 'custom-monochrome';
        committedMonoColorRef.current = monoColor;
      }
    } else if (themeId && themeId !== 'custom-monochrome') {
      setChartColors(getChartColors(themeId));
      applyTheme(themeId);
      if (commit) {
        setSelectedTheme(themeId);
        committedThemeRef.current = themeId;
      }
    }
  };

  useEffect(() => {
    // Step 1: apply the public/default theme immediately.
    // Signed-in users get their saved theme after auth resolves; logged-out/demo
    // visitors should always see the royal purple Unifolio default.
    const storedTheme = localStorage.getItem(LS_KEY);
    if (storedTheme === LEGACY_DEFAULT_THEME || storedTheme === PREVIOUS_DEFAULT_THEME) {
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
        // Guests/demo users always start on the public Unifolio default.
        const SESSION_KEY = 'unifolio_guest_theme';
        applyById(DEFAULT_THEME);
        sessionStorage.setItem(SESSION_KEY, DEFAULT_THEME);
        localStorage.setItem(LS_KEY, DEFAULT_THEME);
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

  // Living theme animation: shift hues over time
  useEffect(() => {
    if (livingRafRef.current) {
      cancelAnimationFrame(livingRafRef.current);
      livingRafRef.current = null;
    }
    const theme = themes[selectedTheme];
    if (!theme?.isLiving || !theme?.living) return;

    const { primaryBaseHue, shiftSpeed, saturation, lightness, chartHueOffsets, chartSat, chartLight } = theme.living;
    const root = document.documentElement;
    let startTime = null;

    const tick = (now) => {
      if (!startTime) startTime = now;
      const elapsed = (now - startTime) / 1000;
      const hue = (primaryBaseHue + elapsed * shiftSpeed) % 360;
      root.style.setProperty('--primary', `${hue.toFixed(1)} ${saturation}% ${lightness}%`);
      root.style.setProperty('--ring', `${((hue + 20) % 360).toFixed(1)} ${saturation}% ${lightness}%`);
      if (chartHueOffsets) {
        chartHueOffsets.forEach((offset, i) => {
          const ch = (hue + offset) % 360;
          root.style.setProperty(`--chart-${i + 1}`, `${ch.toFixed(1)} ${chartSat}% ${chartLight}%`);
        });
      }
      livingRafRef.current = requestAnimationFrame(tick);
    };
    livingRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (livingRafRef.current) cancelAnimationFrame(livingRafRef.current);
      livingRafRef.current = null;
    };
  }, [selectedTheme]);

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

  const previewTheme = (themeId, customColor = null) => {
    const color = themeId === 'custom-monochrome' ? (customColor || customMonochromeColor) : null;
    applyById(themeId, color, { commit: false });
  };

  const clearThemePreview = () => {
    const committedTheme = committedThemeRef.current || selectedTheme || DEFAULT_THEME;
    const committedMonoColor = committedMonoColorRef.current || customMonochromeColor;
    applyById(committedTheme, committedMonoColor, { commit: false });
  };

  return (
    <ThemeContext.Provider value={{
      selectedTheme,
      changeTheme,
      previewTheme,
      clearThemePreview,
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
