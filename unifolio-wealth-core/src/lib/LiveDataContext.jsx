import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { simulatePriceMovement, simulateProbabilityMovement, isMarketOpen } from '@/lib/globalSimulationEngine';
import { safeNumber } from '@/lib/safeNum';
import { supabase } from '@/lib/supabaseClient';
import { fetchQuotes, getCacheAge } from '@/lib/stockApi';
import { rawHoldings, watchlist, assets } from '@/lib/sampleData';

const LiveDataContext = createContext(null);

export function LiveDataProvider({ children }) {
  const [liveDataEnabled, setLiveDataEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [liveHoldings, setLiveHoldings] = useState({}); // ticker -> { price, sparkline, lastUpdate }
  const [livePredictionMarkets, setLivePredictionMarkets] = useState({}); // market_id -> { probability, price }
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  
  const timerRef = useRef(null);
  const tickersRef = useRef(new Map()); // ticker -> { assetClass, basePrice }
  const marketsRef = useRef(new Map()); // market_id -> { assetType, baseProb }
  const marketOpenRef = useRef(isMarketOpen());
  const realPricesRef = useRef({}); // ticker -> { current_price, previous_close, ... }
  const [apiPricesLoaded, setApiPricesLoaded] = useState(false);
  const [apiLastFetched, setApiLastFetched] = useState(getCacheAge());

  // Register a stock/ETF/crypto holding
  const registerTicker = useCallback((ticker, assetClass = 'stock') => {
    if (!ticker) return;
    if (!tickersRef.current.has(ticker)) {
      tickersRef.current.set(ticker, { assetClass });
    }
  }, []);

  // Register a prediction market
  const registerPredictionMarket = useCallback((marketId, assetType = 'prediction_market') => {
    if (!marketId) return;
    if (!marketsRef.current.has(marketId)) {
      marketsRef.current.set(marketId, { assetType });
    }
  }, []);

  // Get live price for a ticker (with fallback)
  const getLivePrice = useCallback((ticker, fallbackPrice = 0) => {
    if (!liveDataEnabled) return fallbackPrice;
    return liveHoldings[ticker]?.price ?? fallbackPrice;
  }, [liveDataEnabled, liveHoldings]);

  // Get live probability for a prediction market
  const getLiveProbability = useCallback((marketId, fallbackProb = 0.5) => {
    if (!liveDataEnabled) return fallbackProb;
    return livePredictionMarkets[marketId]?.probability ?? fallbackProb;
  }, [liveDataEnabled, livePredictionMarkets]);

  // Update all holdings and markets
  const updateAllLiveData = useCallback(() => {
    // Check market open status
    const marketNowOpen = isMarketOpen();
    marketOpenRef.current = marketNowOpen;

    setLiveHoldings(prev => {
      const next = { ...prev };

      tickersRef.current.forEach((config, ticker) => {
        const current = prev[ticker];
        const currentPrice = current?.price
          || realPricesRef.current[ticker]?.current_price
          || assets[ticker]?.current_price
          || 100;
        const assetClass = config.assetClass || 'stock';

        // Skip stocks during market closed, but continue crypto
        if (!marketNowOpen && ['stock', 'etf'].includes(assetClass)) {
          // Move much more slowly
          const slowPrice = currentPrice * (1 + (Math.random() - 0.5) * 0.0005);
          next[ticker] = {
            price: Math.max(slowPrice, 0.01),
            sparkline: (current?.sparkline || []).slice(-99),
            lastUpdate: Date.now(),
          };
          return;
        }

        // Generate new price using global engine
        const newPrice = simulatePriceMovement(currentPrice, ticker, assetClass);

        // Update sparkline (keep last 100 points)
        const sparkline = current?.sparkline || [];
        const newSparkline = [...sparkline.slice(-99), newPrice];

        next[ticker] = {
          price: newPrice,
          sparkline: newSparkline,
          lastUpdate: Date.now(),
        };
      });

      return next;
    });

    // Update prediction markets
    setLivePredictionMarkets(prev => {
      const next = { ...prev };

      marketsRef.current.forEach((config, marketId) => {
        const current = prev[marketId];
        const currentProb = current?.probability || 0.5;

        // Use global engine for probability movement
        const newProb = simulateProbabilityMovement(currentProb, marketId);

        next[marketId] = {
          probability: newProb,
          price: newProb, // Can represent as price [0, 1]
          lastUpdate: Date.now(),
        };
      });

      return next;
    });

    setLastUpdateTime(Date.now());
  }, []);

  // Load live data preference from profile
  useEffect(() => {
    const loadLiveDataFromProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('user_profiles').select('simulated_live_data_enabled').eq('user_id', user.id).single();
          setLiveDataEnabled(data?.simulated_live_data_enabled !== false);
        }
      } catch { /* stay enabled */ }
      setIsLoading(false);
    };
    loadLiveDataFromProfile();
  }, []);

  // Fetch real prices from Finnhub on mount, seed liveHoldings immediately
  useEffect(() => {
    const allTickers = [
      ...rawHoldings.map(h => h.ticker),
      ...watchlist.map(w => w.ticker),
    ];
    const unique = [...new Set(allTickers.filter(Boolean))];

    fetchQuotes(unique).then(prices => {
      if (Object.keys(prices).length === 0) return;
      realPricesRef.current = prices;

      // Seed liveHoldings with real prices so pages show real values immediately
      setLiveHoldings(prev => {
        const next = { ...prev };
        Object.entries(prices).forEach(([ticker, data]) => {
          if (!next[ticker]) {
            next[ticker] = {
              price: data.current_price,
              sparkline: [],
              lastUpdate: Date.now(),
            };
          }
        });
        return next;
      });

      setApiPricesLoaded(true);
      setApiLastFetched(Date.now());
    }).catch(err => {
      console.warn('[LiveDataContext] Stock API fetch failed:', err.message);
    });
  }, []);

  // Handle setLiveDataEnabled with profile update
  const setLiveDataEnabledWithSync = useCallback(async (enabled) => {
    setLiveDataEnabled(enabled);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles').upsert({ user_id: user.id, simulated_live_data_enabled: enabled, updated_at: new Date().toISOString() });
      }
    } catch { /* silent */ }
  }, []);

   // Main update loop
  useEffect(() => {
    if (!liveDataEnabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Only run if we have tickers or markets registered
    const hasAssets = tickersRef.current.size > 0 || marketsRef.current.size > 0;
    if (!hasAssets) {
      return;
    }

    const scheduleNextUpdate = () => {
      // Only update if assets are still registered
      if (tickersRef.current.size > 0 || marketsRef.current.size > 0) {
        updateAllLiveData();
      }
      // Vary update interval for organic feel: 500-1500ms
      const interval = 500 + Math.random() * 1000;
      timerRef.current = setTimeout(scheduleNextUpdate, interval);
    };

    scheduleNextUpdate();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [liveDataEnabled, updateAllLiveData]);

  const value = {
    liveDataEnabled,
    setLiveDataEnabled: setLiveDataEnabledWithSync,
    getLivePrice,
    getLiveProbability,
    registerTicker,
    registerPredictionMarket,
    liveHoldings,
    livePredictionMarkets,
    lastUpdateTime,
    isMarketOpen: marketOpenRef.current,
    apiPricesLoaded,
    apiLastFetched,
    realPrices: realPricesRef.current,
  };

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) throw new Error('useLiveData must be used inside LiveDataProvider');
  return ctx;
}