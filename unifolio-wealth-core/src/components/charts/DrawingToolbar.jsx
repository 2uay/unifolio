import React from 'react';
import { Crosshair, Pencil, Minus, TrendingUp, Square, Circle, Triangle, Type, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TOOLS = [
  { id: 'cursor', icon: Crosshair, label: 'Cursor', shortcut: 'C' },
  { id: 'line', icon: Pencil, label: 'Freehand Line', shortcut: 'L' },
  { id: 'hline', icon: Minus, label: 'Horizontal Line', shortcut: 'H' },
  { id: 'trend', icon: TrendingUp, label: 'Trend Line', shortcut: 'T' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'O' },
  { id: 'triangle', icon: Triangle, label: 'Triangle', shortcut: 'S' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'X' },
];

export default function DrawingToolbar({ activeTool, onSelect, onClear }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-1">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelect(tool.id)}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-lg transition-colors border',
                    isActive
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {tool.label} <span className="text-[10px] text-muted-foreground/60">({tool.shortcut})</span>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="border-t border-border/30 my-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClear}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Clear all drawings"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">Clear drawings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}