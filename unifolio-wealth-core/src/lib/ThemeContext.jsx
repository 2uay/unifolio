import React, { createContext, useContext, useEffect, useState } from 'react';
import { applyTheme, getChartColors, generateMonochromeTheme, themes } from './themes';
import { base44 } from '@/api/base44Client';

const ThemeContext = createContext();

const DEFAULT_THEME = 'redblackwhiteaccent';

export function ThemeProvider({ children }) {
  const [selectedTheme, setSelectedTheme] = useState(DEFAULT_THEME);
  const [chartColors, setChartColors] = useState(getChartColors(DEFAULT_THEME));
  const [isLoading, setIsLoading] = useState(true);
  const [customMonochromeColor, setCustomMonochromeColor] = useState('#3b82f6');

  useEffect(() => {
    const loadThemeFromProfile = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        
        if (isAuth) {
          // Load from UserProfile
          const response = await base44.functions.invoke('getUserProfile', {});
          const profile = response.data.profile;
          
          if (profile && profile.theme_id) {
            const themeId = profile.theme_id;
            if (themeId === 'custom-monochrome' && profile.custom_monochrome_color) {
              applyCustomMonochrome(profile.custom_monochrome_color);
              setSelectedTheme('custom-monochrome');
              setChartColors(generateMonochromeTheme(profile.custom_monochrome_color).chartColors);
              setCustomMonochromeColor(profile.custom_monochrome_color);
            } else {
              setSelectedTheme(themeId);
              setChartColors(getChartColors(themeId));
              applyTheme(themeId);
            }
          } else {
            // Default theme
            setSelectedTheme(DEFAULT_THEME);
            setChartColors(getChartColors(DEFAULT_THEME));
            applyTheme(DEFAULT_THEME);
          }
        } else {
          // Logged out - use default
          setSelectedTheme(DEFAULT_THEME);
          setChartColors(getChartColors(DEFAULT_THEME));
          applyTheme(DEFAULT_THEME);
        }
      } catch (err) {
        console.error('Failed to load theme from profile:', err);
        setSelectedTheme(DEFAULT_THEME);
        setChartColors(getChartColors(DEFAULT_THEME));
        applyTheme(DEFAULT_THEME);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeFromProfile();
  }, []);

  const applyCustomMonochrome = (hexColor) => {
    const monoTheme = generateMonochromeTheme(hexColor);
    const root = document.documentElement;
    Object.entries(monoTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const changeTheme = async (themeId, customColor = null) => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      
      if (themeId === 'custom-monochrome') {
        const color = customColor || customMonochromeColor;
        setCustomMonochromeColor(color);
        applyCustomMonochrome(color);
        setSelectedTheme('custom-monochrome');
        setChartColors(generateMonochromeTheme(color).chartColors);

        if (isAuth) {
          await base44.functions.invoke('updateUserPreference', {
            preferenceKey: 'theme_id',
            preferenceValue: 'custom-monochrome'
          });
          await base44.functions.invoke('updateUserPreference', {
            preferenceKey: 'custom_monochrome_color',
            preferenceValue: color
          });
        }
      } else {
        setSelectedTheme(themeId);
        setChartColors(getChartColors(themeId));
        applyTheme(themeId);

        if (isAuth) {
          await base44.functions.invoke('updateUserPreference', {
            preferenceKey: 'theme_id',
            preferenceValue: themeId
          });
        }
      }
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  };

  return (
    <ThemeContext.Provider value={{ selectedTheme, changeTheme, chartColors, isLoading, customMonochromeColor, setCustomMonochromeColor: (color) => changeTheme('custom-monochrome', color) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}