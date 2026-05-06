import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPrivacyFromProfile = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        
        if (isAuth) {
          const response = await base44.functions.invoke('getUserProfile', {});
          const profile = response.data.profile;
          setPrivacyMode(profile?.privacy_mode_preference || false);
        } else {
          setPrivacyMode(false);
        }
      } catch (err) {
        console.error('Failed to load privacy mode:', err);
        setPrivacyMode(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadPrivacyFromProfile();
  }, []);

  const togglePrivacy = async () => {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);

    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.functions.invoke('updateUserPreference', {
          preferenceKey: 'privacy_mode_preference',
          preferenceValue: newValue
        });
      }
    } catch (err) {
      console.error('Failed to save privacy mode:', err);
    }
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