import { useState, useEffect, useRef } from 'react';
import { useLiveData } from '@/lib/LiveDataContext';

export function useLivePortfolioValue(initialValue, holdings = []) {
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef(null);
  const { liveDataEnabled } = useLiveData();

  useEffect(() => {
    if (!liveDataEnabled || holdings.length === 0) return;

    const startUpdating = () => {
      // Simulate portfolio value change based on holding changes
      // This is driven by individual holding updates
      setValue(current => {
        const change = (Math.random() - 0.5) * 2 * current * 0.002;
        return Math.max(current + change, current * 0.95);
      });

      const interval = 4000 + Math.random() * 4000; // 4-8 seconds
      timerRef.current = setTimeout(startUpdating, interval);
    };

    startUpdating();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [liveDataEnabled, holdings.length]);

  return value;
}