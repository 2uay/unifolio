import React from 'react';
import { Palette, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HEATMAP_MODES, HEATMAP_MODE_CONFIG, HEATMAP_CATEGORIES } from '@/lib/heatmapModes.js';
import { cn } from '@/lib/utils';

export default function HeatmapModeSelector({ activeMode, onModeChange }) {
  const config = HEATMAP_MODE_CONFIG[activeMode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn('h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50')}
          title={`Heatmap: ${config?.label}`}
        >
          <Palette className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
        {Object.entries(HEATMAP_CATEGORIES).map(([catKey, category]) => (
          <div key={catKey}>
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
              {category.label}
            </DropdownMenuLabel>
            {category.modes.map(modeId => {
              const modeConfig = HEATMAP_MODE_CONFIG[modeId];
              const isActive = activeMode === modeId;
              return (
                <DropdownMenuItem
                  key={modeId}
                  onClick={() => onModeChange(modeId)}
                  className={cn(
                    'text-xs cursor-pointer px-2 py-1.5',
                    isActive && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className="flex items-center justify-between w-full">
                    <span>{modeConfig.label}</span>
                    {isActive && <span className="text-primary">✓</span>}
                  </span>
                </DropdownMenuItem>
              );
            })}
            {catKey !== Object.keys(HEATMAP_CATEGORIES)[Object.keys(HEATMAP_CATEGORIES).length - 1] && (
              <DropdownMenuSeparator className="my-1 bg-border" />
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}