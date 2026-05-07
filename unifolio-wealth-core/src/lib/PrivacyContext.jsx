import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('user_profiles').select('privacy_mode_preference').eq('user_id', user.id).single();
        setPrivacyMode(data?.privacy_mode_preference || false);
      } catch { /* stay false */ }
    };
    load();
  }, []);

  const togglePrivacy = async () => {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({ user_id: user.id, privacy_mode_preference: newValue, updated_at: new Date().toISOString() });
      }
    } catch { /* silent */ }
  };

  const mask = (value, placeholder = '••••••') => privacyMode ? placeholder : value;

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy, mask }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within a PrivacyProvider');
  return ctx;
}
