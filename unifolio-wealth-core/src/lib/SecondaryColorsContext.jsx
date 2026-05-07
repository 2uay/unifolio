import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPalette } from '@/lib/secondaryColorPalettes';
import { supabase } from '@/lib/supabaseClient';

const SecondaryColorsContext = createContext(null);

export function SecondaryColorsProvider({ children }) {
  const [paletteId, setPaletteId] = useState('bloomberg_heat');
  const [isLoading, setIsLoading] = useState(true);

  const palette = getPalette(paletteId);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('user_profiles').select('secondary_color_palette_id').eq('user_id', user.id).single();
          setPaletteId(data?.secondary_color_palette_id || 'bloomberg_heat');
        }
      } catch { /* stay default */ }
      setIsLoading(false);
    };
    load();
  }, []);

  const changePalette = async (id) => {
    setPaletteId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({ user_id: user.id, secondary_color_palette_id: id, updated_at: new Date().toISOString() });
      }
    } catch { /* silent */ }
  };

  return (
    <SecondaryColorsContext.Provider value={{ paletteId, setPaletteId: changePalette, palette }}>
      {children}
    </SecondaryColorsContext.Provider>
  );
}

export function useSecondaryColors() {
  const ctx = useContext(SecondaryColorsContext);
  if (!ctx) throw new Error('useSecondaryColors must be used inside SecondaryColorsProvider');
  return ctx;
}
