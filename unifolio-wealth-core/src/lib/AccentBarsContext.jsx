import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AccentBarsContext = createContext();

export function AccentBarsProvider({ children }) {
  const [accentBarsEnabled, setAccentBarsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAccentBarsFromProfile = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        
        if (isAuth) {
          const response = await base44.functions.invoke('getUserProfile', {});
          const profile = response.data.profile;
          setAccentBarsEnabled(profile?.accent_bars_enabled !== false);
        } else {
          setAccentBarsEnabled(true);
        }
      } catch (err) {
        console.error('Failed to load accent bars preference:', err);
        setAccentBarsEnabled(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccentBarsFromProfile();
  }, []);

  const toggleAccentBars = async () => {
    const newValue = !accentBarsEnabled;
    setAccentBarsEnabled(newValue);

    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.functions.invoke('updateUserPreference', {
          preferenceKey: 'accent_bars_enabled',
          preferenceValue: newValue
        });
      }
    } catch (err) {
      console.error('Failed to save accent bars preference:', err);
    }
  };

  return (
    <AccentBarsContext.Provider value={{ accentBarsEnabled, setAccentBarsEnabled, toggleAccentBars }}>
      {children}
    </AccentBarsContext.Provider>
  );
}

export function useAccentBars() {
  const context = useContext(AccentBarsContext);
  if (!context) {
    throw new Error('useAccentBars must be used within AccentBarsProvider');
  }
  return context;
}