import React, { createContext, useContext, useState } from 'react';

const LS_KEY = 'unifolio_topbar_logo';

const TopbarLogoContext = createContext();

export function TopbarLogoProvider({ children }) {
  const [logoVisible, setLogoVisible] = useState(() => {
    try { return localStorage.getItem(LS_KEY) !== 'false'; } catch { return true; }
  });

  const toggleLogo = () => {
    const next = !logoVisible;
    setLogoVisible(next);
    try { localStorage.setItem(LS_KEY, String(next)); } catch { /* silent */ }
  };

  return (
    <TopbarLogoContext.Provider value={{ logoVisible, toggleLogo }}>
      {children}
    </TopbarLogoContext.Provider>
  );
}

export function useTopbarLogo() {
  const ctx = useContext(TopbarLogoContext);
  if (!ctx) throw new Error('useTopbarLogo must be used within TopbarLogoProvider');
  return ctx;
}
