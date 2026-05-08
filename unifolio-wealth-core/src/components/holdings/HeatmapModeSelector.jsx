import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { HEATMAP_MODE_CONFIG, HEATMAP_CATEGORIES } from '@/lib/heatmapModes.js';
import { cn } from '@/lib/utils';

export default function HeatmapModeSelector({ activeMode, onModeChange, onModePreview, onPreviewEnd }) {
  const config = HEATMAP_MODE_CONFIG[activeMode];
  const modeIds = Object.values(HEATMAP_CATEGORIES).flatMap(category => category.modes);
  const activeIndex = Math.max(0, modeIds.indexOf(activeMode));

  const cycleMode = (direction) => {
    if (!modeIds.length) return;
    const nextIndex = (activeIndex + direction + modeIds.length) % modeIds.length;
    onModeChange(modeIds[nextIndex]);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      cycleMode(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      cycleMode(1);
    }
  };

  return (
    <div className="flex items-center gap-1" onKeyDown={handleKeyDown}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        onClick={() => cycleMode(-1)}
        aria-label="Previous heatmap mode"
        title="Previous heatmap mode"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </Button>

      <DropdownMenu onOpenChange={(open) => { if (!open) onPreviewEnd?.(); }}>
        <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 min-w-[132px] justify-between gap-2 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50')}
          title={`Heatmap: ${config?.label}`}
        >
          <span className="truncate">{config?.label || 'Heatmap Mode'}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
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
                    onMouseEnter={() => onModePreview?.(modeId)}
                    onMouseLeave={() => onPreviewEnd?.()}
                    onFocus={() => onModePreview?.(modeId)}
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

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        onClick={() => cycleMode(1)}
        aria-label="Next heatmap mode"
        title="Next heatmap mode"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
