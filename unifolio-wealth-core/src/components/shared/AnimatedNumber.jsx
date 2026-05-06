import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Smoothly animates number changes
 * Used for prices, portfolio values, P&L, etc.
 */
export default function AnimatedNumber({
  value,
  duration = 300,
  className = '',
  decimals = 2,
  format = 'number', // 'number', 'currency', 'percent'
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const animationRef = useRef(null);
  const startValueRef = useRef(value);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const start = startValueRef.current;
    const end = value;

    if (Math.abs(end - start) < 0.01) {
      setDisplayValue(end);
      return;
    }

    startValueRef.current = start;
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const current = start + (end - start) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  let formatted = '';
  
  if (format === 'currency') {
    formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(displayValue);
  } else if (format === 'percent') {
    formatted = displayValue.toFixed(decimals) + '%';
  } else {
    formatted = displayValue.toFixed(decimals);
  }

  return <span className={cn('font-mono tabular-nums', className)}>{formatted}</span>;
}