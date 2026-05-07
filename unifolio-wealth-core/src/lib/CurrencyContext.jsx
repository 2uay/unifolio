import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { convertCurrency, hasRate, FX_IS_SAMPLE } from '@/lib/exchangeRates';
import { supabase } from '@/lib/supabaseClient';

export const ALL_CURRENCIES = [
  { code: 'CAD', name: 'Canadian Dollar',   supported: true },
  { code: 'USD', name: 'US Dollar',         supported: true },
  { code: 'EUR', name: 'Euro',              supported: false },
  { code: 'GBP', name: 'British Pound',     supported: false },
  { code: 'JPY', name: 'Japanese Yen',      supported: false },
  { code: 'AUD', name: 'Australian Dollar', supported: false },
];

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [displayCurrency, _setDisplayCurrency] = useState('CAD');
  const [enabledCurrencies, _setEnabledCurrencies] = useState(['CAD', 'USD']);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('user_profiles').select('default_currency').eq('user_id', user.id).single();
        if (data?.default_currency) _setDisplayCurrency(data.default_currency);
      } catch { /* stay default */ }
    };
    load();
  }, []);

  const setDisplayCurrency = useCallback(async (code) => {
    _setDisplayCurrency(code);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({ user_id: user.id, default_currency: code, updated_at: new Date().toISOString() });
      }
    } catch { /* silent */ }
  }, []);

  const setEnabledCurrencies = useCallback(async (codes) => {
    _setEnabledCurrencies(codes);
  }, []);

  const convert = useCallback((amount, fromCurrency) => {
    if (!fromCurrency || fromCurrency === displayCurrency) return amount;
    if (!hasRate(fromCurrency) || !hasRate(displayCurrency)) return amount;
    if (amount == null || amount === '' || isNaN(amount)) return 0;
    return convertCurrency(amount, fromCurrency, displayCurrency);
  }, [displayCurrency]);

  return (
    <CurrencyContext.Provider value={{
      displayCurrency, setDisplayCurrency,
      enabledCurrencies, setEnabledCurrencies,
      convert, isSample: FX_IS_SAMPLE, allCurrencies: ALL_CURRENCIES,
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
