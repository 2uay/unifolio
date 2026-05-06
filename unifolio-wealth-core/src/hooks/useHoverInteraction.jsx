import { useCallback } from 'react';

/**
 * Hook for applying theme-aware hover interactions to clickable elements.
 * Handles button, card, row, icon, ticker, and value hover effects.
 * 
 * Usage:
 *   const { button } = useHoverInteraction();
 *   <button className={button()}>Click me</button>
 */
export const useHoverInteraction = () => {
  const button = useCallback((variant = 'default') => {
    const baseClasses = 'btn-hover transition-all duration-150 cursor-pointer';
    
    switch (variant) {
      case 'light':
        return `${baseClasses} btn-hover-light`;
      case 'strong':
        return `${baseClasses} btn-hover-strong`;
      default:
        return baseClasses;
    }
  }, []);

  const card = useCallback(() => 'card-hover', []);
  const row = useCallback(() => 'row-hover', []);
  const icon = useCallback((withBg = false) => 
    withBg ? 'icon-hover icon-hover-bg' : 'icon-hover', []);
  const ticker = useCallback(() => 'ticker-hover', []);
  const value = useCallback(() => 'value-hover', []);
  const statCard = useCallback(() => 'stat-card-hover', []);

  return {
    button,
    card,
    row,
    icon,
    ticker,
    value,
    statCard,
  };
};

/**
 * Utility function to combine hover class with existing className
 */
export const applyHover = (className, hoverClass) => {
  return className ? `${className} ${hoverClass}` : hoverClass;
};