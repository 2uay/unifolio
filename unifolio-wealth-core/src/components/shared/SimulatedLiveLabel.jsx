import React from 'react';
import { Zap } from 'lucide-react';
import { useLiveData } from '@/lib/LiveDataContext';

export default function SimulatedLiveLabel() {
  const { liveDataEnabled } = useLiveData();

  if (!liveDataEnabled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/40 text-xs text-muted-foreground border border-border/50">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
        <span>Simulated data paused</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 text-xs text-primary/70 border border-primary/20">
      <Zap className="w-3 h-3 animate-pulse" />
      <span>Simulated live data</span>
    </div>
  );
}