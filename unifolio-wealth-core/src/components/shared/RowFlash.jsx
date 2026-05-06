import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Subtle flash effect when a row's value changes
 * Green for gains, red for losses
 */
export function useRowFlash(value) {
  const [flashColor, setFlashColor] = useState(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (value === null || value === undefined) return;
    if (previousValueRef.current === null || previousValueRef.current === undefined) {
      previousValueRef.current = value;
      return;
    }

    const prev = previousValueRef.current;
    
    if (Math.abs(value - prev) > 0.001) {
      const isPositive = value > prev;
      setFlashColor(isPositive ? 'green' : 'red');

      const timer = setTimeout(() => {
        setFlashColor(null);
      }, 800);

      previousValueRef.current = value;
      return () => clearTimeout(timer);
    }

    previousValueRef.current = value;
  }, [value]);

  const flashClass = flashColor
    ? flashColor === 'green'
      ? 'animate-pulse bg-emerald-500/10'
      : 'animate-pulse bg-red-500/10'
    : '';

  return { flashClass, flashColor };
}

/**
 * Row wrapper with optional flash effect
 */
export default function RowFlash({ value, children, className = '' }) {
  const { flashClass } = useRowFlash(value);

  return (
    <div className={cn('transition-colors duration-300', flashClass, className)}>
      {children}
    </div>
  );
}