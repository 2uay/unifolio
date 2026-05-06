import React from 'react';
import { Star } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { cn } from '@/lib/utils';

export default function StarIcon({ 
  isStarred, 
  onClick, 
  className = 'w-4 h-4',
  interactive = true,
  showEmptyOnHover = false 
}) {
  const { theme } = useTheme();
  const { palette } = useSecondaryColors();

  // Determine star color based on theme
  let starColor = 'text-foreground/60';
  if (isStarred) {
    if (theme === 'bloomberg-black') {
      starColor = 'text-amber-500';
    } else if (palette?.accent) {
      starColor = 'text-foreground';
    } else {
      starColor = 'text-primary';
    }
  }

  if (!interactive) {
    return isStarred ? (
      <Star className={cn(className, starColor, 'fill-current')} />
    ) : showEmptyOnHover ? (
      <Star className={cn(className, 'text-foreground/20')} />
    ) : null;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'inline-flex items-center justify-center transition-all',
        'hover:opacity-80 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
      )}
      title={isStarred ? 'Unstar' : 'Star'}
    >
      <Star 
        className={cn(
          className,
          starColor,
          isStarred && 'fill-current',
          'transition-all'
        )}
      />
    </button>
  );
}