import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMPARE_OPTIONS } from '@/lib/chartEngine';
import { useTheme } from '@/lib/ThemeContext';

export default function ComparePanel({ compareLines, onToggle, onClose }) {
  const { chartColors } = useTheme();
  return (
    <div className="w-64 max-h-80 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compare Assets</span>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {COMPARE_OPTIONS.map(opt => {
          const isActive = compareLines.includes(opt.id);
          const color = chartColors[(COMPARE_OPTIONS.findIndex(o => o.id === opt.id) + 2) % chartColors.length] || opt.color;
          return (
            <button
              key={opt.id}
              onClick={() => onToggle(opt.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 text-xs border-b border-border/30 transition-colors text-left hover:bg-secondary/40',
                isActive && 'bg-secondary/60'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <div>
                  <div className="font-medium text-foreground">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground/70">{opt.description}</div>
                </div>
              </div>
              {isActive && <span className="text-primary font-semibold text-[9px]">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="px-3 py-2 border-t border-border/30 bg-secondary/20">
        <p className="text-[10px] text-muted-foreground/60">
          Compare this stock against other assets on a <strong>% normalized scale</strong>.
        </p>
      </div>
    </div>
  );
}
