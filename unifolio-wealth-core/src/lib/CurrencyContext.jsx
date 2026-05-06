import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { convertCurrency, hasRate, FX_IS_SAMPLE } from '@/lib/exchangeRates';
import { base44 } from '@/api/base44Client';

export const ALL_CURRENCIES = [
  { code: 'CAD', name: 'Canadian Dollar',  supported: true },
  { code: 'USD', name: 'US Dollar',        supported: true },
  { code: 'EUR', name: 'Euro',             supported: false },
  { code: 'GBP', name: 'British Pound',    supported: false },
  { code: 'JPY', name: 'Japanese Yen',     supported: false },
  { code: 'AUD', name: 'Australian Dollar',supported: false },
];

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [displayCurrency, _setDisplayCurrency] = useState('CAD');
  const [enabledCurrencies, _setEnabledCurrencies] = useState(['CAD', 'USD']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCurrencyFromProfile = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        
        if (isAuth) {
          const response = await base44.functions.invoke('getUserProfile', {});
          const profile = response.data.profile;
          _setDisplayCurrency(profile?.default_currency || 'CAD');
        } else {
          _setDisplayCurrency('CAD');
        }
      } catch (err) {
        console.error('Failed to load currency from profile:', err);
        _setDisplayCurrency('CAD');
      } finally {
        setIsLoading(false);
      }
    };

    loadCurrencyFromProfile();
  }, []);

  const setDisplayCurrency = useCallback(async (code) => {
    _setDisplayCurrency(code);
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.functions.invoke('updateUserPreference', {
          preferenceKey: 'default_currency',
          preferenceValue: code
        });
      }
    } catch (err) {
      console.error('Failed to save currency:', err);
    }
  }, []);

  const setEnabledCurrencies = useCallback(async (codes) => {
    _setEnabledCurrencies(codes);
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.functions.invoke('updateUserPreference', {
          preferenceKey: 'enabled_currencies',
          preferenceValue: codes
        });
      }
    } catch (err) {
      console.error('Failed to save enabled currencies:', err);
    }
  }, []);

  const convert = useCallback((amount, fromCurrency) => {
    if (!fromCurrency || fromCurrency === displayCurrency) return amount;
    if (!hasRate(fromCurrency) || !hasRate(displayCurrency)) return amount; // fallback to native
    if (amount == null || amount === '' || isNaN(amount)) return 0;
    return convertCurrency(amount, fromCurrency, displayCurrency);
  }, [displayCurrency]);

  return (
    <CurrencyContext.Provider value={{
      displayCurrency,
      setDisplayCurrency,
      enabledCurrencies,
      setEnabledCurrencies,
      convert,
      isSample: FX_IS_SAMPLE,
      allCurrencies: ALL_CURRENCIES,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}