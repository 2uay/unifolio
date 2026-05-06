import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

const StarredStocksContext = createContext();

export function StarredStocksProvider({ children }) {
  const [starredStocks, setStarredStocks] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('unifolio_starred_stocks');
      if (saved) {
        setStarredStocks(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load starred stocks:', err);
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage whenever starred stocks change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('unifolio_starred_stocks', JSON.stringify(starredStocks));
    }
  }, [starredStocks, isLoading]);

  const toggleStar = useCallback((ticker) => {
    setStarredStocks(prev => {
      const updated = { ...prev };
      if (updated[ticker]) {
        delete updated[ticker];
      } else {
        updated[ticker] = {
          ticker,
          starredAt: new Date().toISOString(),
        };
      }
      return updated;
    });
  }, []);

  const isStar = useCallback((ticker) => {
    return !!starredStocks[ticker];
  }, [starredStocks]);

  const getStarredTickers = useCallback(() => {
    return Object.keys(starredStocks);
  }, [starredStocks]);

  const value = {
    starredStocks,
    toggleStar,
    isStar,
    getStarredTickers,
    isLoading,
  };

  return (
    <StarredStocksContext.Provider value={value}>
      {children}
    </StarredStocksContext.Provider>
  );
}

export function useStarredStocks() {
  const context = useContext(StarredStocksContext);
  if (!context) {
    throw new Error('useStarredStocks must be used within StarredStocksProvider');
  }
  return context;
}