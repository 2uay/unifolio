import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AccentBarsContext = createContext();

export function AccentBarsProvider({ children }) {
  const [accentBarsEnabled, setAccentBarsEnabled] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('user_profiles').select('accent_bars_enabled').eq('user_id', user.id).single();
        setAccentBarsEnabled(data?.accent_bars_enabled !== false);
      } catch { /* stay enabled */ }
    };
    load();
  }, []);

  const toggleAccentBars = async () => {
    const newValue = !accentBarsEnabled;
    setAccentBarsEnabled(newValue);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({ user_id: user.id, accent_bars_enabled: newValue, updated_at: new Date().toISOString() });
      }
    } catch { /* silent */ }
  };

  return (
    <AccentBarsContext.Provider value={{ accentBarsEnabled, setAccentBarsEnabled, toggleAccentBars }}>
      {children}
    </AccentBarsContext.Provider>
  );
}

export function useAccentBars() {
  const context = useContext(AccentBarsContext);
  if (!context) throw new Error('useAccentBars must be used within AccentBarsProvider');
  return context;
}
