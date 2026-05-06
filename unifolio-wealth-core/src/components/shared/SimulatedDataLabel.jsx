import React from 'react';
import { Zap } from 'lucide-react';
import { useLiveData } from '@/lib/LiveDataContext';

export default function SimulatedDataLabel() {
  const { liveDataEnabled } = useLiveData();

  if (!liveDataEnabled) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 text-xs text-primary/70 border border-primary/20">
      <Zap className="w-3 h-3 animate-pulse" />
      <span>Simulated live data</span>
    </div>
  );
}