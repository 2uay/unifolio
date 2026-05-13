// @ts-nocheck
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { applyTheme, applyThemePaletteVariables, getChartColors, generateMonochromeTheme, getRandomTheme, themes } from './themes';
import { supabase } from '@/lib/supabaseClient';

const ThemeContext = createContext(null);

const DEFAULT_THEME = 'malachite';
const LEGACY_DEFAULT_THEME = 'redblackwhiteaccent';
const PREVIOUS_DEFAULT_THEME = 'royalpurple';
const LS_KEY = 'unifolio_default_theme';
const LS_MONO_KEY = 'unifolio_mono_color';
const SESSION_RANDOM_KEY = 'unifolio_session_random_theme';
const LAST_RANDOM_KEY = 'unifolio_last_random_theme';

function persistDefaultTheme() {
  localStorage.setItem(LS_KEY, DEFAULT_THEME);
  localStorage.removeItem(LS_MONO_KEY);
}

// Pick a fresh random theme for this session, never re-picking the previous
// one. Stored in sessionStorage so within-session re-renders don't reroll;
// `localStorage[LAST_RANDOM_KEY]` tracks the cross-session previous pick so
// reloads also avoid the same theme twice in a row.
function pickSessionRandomTheme() {
  try {
    const cached = sessionStorage.getItem(SESSION_RANDOM_KEY);
    if (cached && themes[cached]) return cached;
  } catch { /* ignore */ }
  let lastPick = null;
  try { lastPick = localStorage.getItem(LAST_RANDOM_KEY); } catch { /* ignore */ }
  const pick = getRandomTheme({ excludeId: lastPick });
  try {
    sessionStorage.setItem(SESSION_RANDOM_KEY, pick);
    localStorage.setItem(LAST_RANDOM_KEY, pick);
  } catch { /* ignore */ }
  return pick;
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
    // Step 1: apply a random theme immediately for the optimistic first paint.
    // Signed-in users with a saved preference will have it applied below once
    // auth resolves; unauthenticated visitors keep the random pick. The legacy
    // default migration is preserved so old localStorage values get cleaned up.
    const storedTheme = localStorage.getItem(LS_KEY);
    if (storedTheme === LEGACY_DEFAULT_THEME || storedTheme === PREVIOUS_DEFAULT_THEME) {
      persistDefaultTheme();
    }
    applyById(pickSessionRandomTheme());

    // Step 2: subscribe to auth state — load Supabase preference on sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const { data } = await supabase
            .from('user_profiles')
            .select('theme_id, custom_monochrome_color, plan')
            .eq('user_id', session.user.id)
            .single();

          // Plan resolution prefers user_profiles.plan (admin override path)
          // over auth.users.app_metadata.plan, so an admin can grant
          // Lifetime/Pro via a simple SQL update on user_profiles.
          const profilePlan = data?.plan;
          const metaPlan = session.user.app_metadata?.plan;
          const plan = profilePlan && profilePlan !== 'free' ? profilePlan : metaPlan;
          const isLifetime = plan === 'lifetime';
          const isPro = plan === 'pro' || isLifetime;
          const savedTheme = data?.theme_id;
          const monoColor = data?.custom_monochrome_color || null;
          // System-default themes are treated as "no real preference" for ALL
          // users — random session pick wins. This avoids the regression where
          // users who logged in once when malachite was the default get
          // permanently stuck on malachite even after we switched to random.
          const systemDefaults = new Set([DEFAULT_THEME, LEGACY_DEFAULT_THEME, PREVIOUS_DEFAULT_THEME, 'malachite']);
          // Reject a saved Lifetime-only theme if the user isn't on a
          // Lifetime plan any more (downgrade case). Falls through to the
          // random/Pro/default branches below.
          const savedThemeMeta = savedTheme ? themes[savedTheme] : null;
          const lifetimeBlocked = Boolean(savedThemeMeta?.lifetime) && !isLifetime;
          const hasRealUserChoice = Boolean(savedTheme) && !systemDefaults.has(savedTheme) && !lifetimeBlocked;

          if (hasRealUserChoice) {
            // Signed-in user has an explicit theme — honour it (overrides any random)
            applyById(savedTheme, monoColor);
            localStorage.setItem(LS_KEY, savedTheme);
            if (monoColor) localStorage.setItem(LS_MONO_KEY, monoColor);
          } else if (isPro) {
            // Pro user with no real saved theme → upgrade to Pro theme
            applyById('unifoliopro');
            localStorage.setItem(LS_KEY, 'unifoliopro');
          } else {
            // Signed-in non-Pro user with no real saved theme → keep the
            // random session pick (stable per session via sessionStorage)
            applyById(pickSessionRandomTheme());
          }
        } catch { /* silent — keep current theme */ }
      } else {
        // Guests/demo users get a fresh random theme each session.
        applyById(pickSessionRandomTheme());
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

    const { primaryBaseHue, shiftSpeed, saturation, lightness, chartHueOffsets, chartSat, chartLight, ringOffset = 20, accentOffset, oscillateRange } = theme.living;
    const root = document.documentElement;
    const isPro = !!theme.pro;
    let startTime = null;

    const tick = (now) => {
      if (!startTime) startTime = now;
      const elapsed = (now - startTime) / 1000;

      let hue, ringHue, accentHue;
      if (oscillateRange !== undefined) {
        // Bounded oscillation — stays within color family, each channel at a different phase
        hue = ((primaryBaseHue + Math.sin(elapsed * shiftSpeed) * oscillateRange) + 360) % 360;
        ringHue = ((primaryBaseHue + ringOffset + Math.sin(elapsed * shiftSpeed * 1.27 + 0.8) * oscillateRange * 0.8) + 360) % 360;
        if (accentOffset !== undefined) {
          accentHue = ((primaryBaseHue + accentOffset + Math.sin(elapsed * shiftSpeed * 0.93 + 1.6) * oscillateRange * 0.9) + 360) % 360;
        }
      } else {
        hue = (primaryBaseHue + elapsed * shiftSpeed) % 360;
        ringHue = (hue + ringOffset) % 360;
        if (accentOffset !== undefined) accentHue = (hue + accentOffset) % 360;
      }

      root.style.setProperty('--primary', `${hue.toFixed(1)} ${saturation}% ${lightness}%`);
      root.style.setProperty('--ring', `${ringHue.toFixed(1)} ${saturation}% ${lightness}%`);
      if (accentHue !== undefined) {
        root.style.setProperty('--wave-color-2', `${accentHue.toFixed(1)} ${saturation}% ${lightness}%`);
      }

      if (chartHueOffsets) {
        chartHueOffsets.forEach((offset, i) => {
          let ch;
          if (oscillateRange !== undefined) {
            ch = ((primaryBaseHue + offset + Math.sin(elapsed * shiftSpeed * 0.7 + i * 0.5) * oscillateRange * 0.4) + 360) % 360;
          } else {
            ch = (hue + offset) % 360;
          }
          root.style.setProperty(`--chart-${i + 1}`, `${ch.toFixed(1)} ${chartSat}% ${chartLight}%`);
        });
      }

      // Pro themes: all logo dots animate as a single unified color (the primary hue)
      if (isPro) {
        const dotColor = `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
        for (let d = 1; d <= 12; d++) root.style.setProperty(`--logo-dot-${d}`, dotColor);
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

  // Pick a fresh random theme right now and apply it. Clears the per-session
  // cache so the next `pickSessionRandomTheme()` rolls anew.
  const setRandomTheme = ({ excludePro = false } = {}) => {
    let lastPick = null;
    try { lastPick = localStorage.getItem(LAST_RANDOM_KEY); } catch { /* ignore */ }
    const pick = getRandomTheme({ excludeId: lastPick, excludePro });
    try {
      sessionStorage.setItem(SESSION_RANDOM_KEY, pick);
      localStorage.setItem(LAST_RANDOM_KEY, pick);
    } catch { /* ignore */ }
    applyById(pick);
    return pick;
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
      setRandomTheme,
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
