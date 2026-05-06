import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPalette } from '@/lib/secondaryColorPalettes';
import { base44 } from '@/api/base44Client';

const SecondaryColorsContext = createContext(null);

export function SecondaryColorsProvider({ children }) {
  const [paletteId, setPaletteId] = useState('bloomberg_heat');
  const [isLoading, setIsLoading] = useState(true);

  const palette = getPalette(paletteId);

  // Load from UserProfile on mount
  useEffect(() => {
    const loadPaletteFromProfile = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        
        if (isAuth) {
          const response = await base44.functions.invoke('getUserProfile', {});
          const profile = response.data.profile;
          setPaletteId(profile?.secondary_color_palette_id || 'bloomberg_heat');
        } else {
          setPaletteId('bloomberg_heat');
        }
      } catch (err) {
        console.error('Failed to load palette from profile:', err);
        setPaletteId('bloomberg_heat');
      } finally {
        setIsLoading(false);
      }
    };

    loadPaletteFromProfile();
  }, []);

  // Save to UserProfile when palette changes
  useEffect(() => {
    const savePaletteToProfile = async () => {
      if (isLoading) return;
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          await base44.functions.invoke('updateUserPreference', {
            preferenceKey: 'secondary_color_palette_id',
            preferenceValue: paletteId
          });
        }
      } catch (err) {
        console.error('Failed to save palette to profile:', err);
      }
    };

    savePaletteToProfile();
  }, [paletteId, isLoading]);

  const value = {
    paletteId,
    setPaletteId,
    palette,
  };

  return (
    <SecondaryColorsContext.Provider value={value}>
      {children}
    </SecondaryColorsContext.Provider>
  );
}

export function useSecondaryColors() {
  const ctx = useContext(SecondaryColorsContext);
  if (!ctx) {
    throw new Error('useSecondaryColors must be used inside SecondaryColorsProvider');
  }
  return ctx;
}