import React from 'react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/lib/ThemeContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { cn } from '@/lib/utils';

export default function ThemedSwitch({ id, checked, onCheckedChange, className, ...props }) {
  const { theme, selectedTheme } = useTheme();
  const { palette } = useSecondaryColors();

  // Determine ON state background and knob color based on theme
  let onBgClass = 'data-[state=checked]:bg-primary';
  let onBorderClass = 'data-[state=checked]:border-primary';
  let knobColorClass = 'data-[state=checked]:bg-foreground';

  // OFF state is always muted
  const offBgClass = 'data-[state=unchecked]:bg-slate-700';
  const offBorderClass = 'data-[state=unchecked]:border-slate-600';

  // Theme-specific ON state styling
  if (selectedTheme === 'bloombergblack') {
    onBgClass = 'data-[state=checked]:bg-amber-500';
    onBorderClass = 'data-[state=checked]:border-amber-400';
    knobColorClass = 'data-[state=checked]:bg-black';
  } else if (selectedTheme?.startsWith('red') || selectedTheme === 'redblackwhiteaccent') {
    onBgClass = 'data-[state=checked]:bg-red-600';
    onBorderClass = 'data-[state=checked]:border-red-500';
    knobColorClass = 'data-[state=checked]:bg-white';
  } else if (selectedTheme?.startsWith('mono')) {
    // Monochrome themes use primary
    onBgClass = 'data-[state=checked]:bg-primary';
    knobColorClass = 'data-[state=checked]:bg-background';
  } else if (selectedTheme?.includes('white') || selectedTheme?.includes('light')) {
    // Light themes
    onBgClass = 'data-[state=checked]:bg-primary';
    knobColorClass = 'data-[state=checked]:bg-white';
  }

  // Override with secondary palette if available
  if (palette?.accent) {
    onBgClass = `data-[state=checked]:bg-[${palette.accent}]`;
  }

  return (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'transition-colors duration-200',
        offBgClass,
        offBorderClass,
        onBgClass,
        onBorderClass,
        className
      )}
      {...props}
    />
  );
}