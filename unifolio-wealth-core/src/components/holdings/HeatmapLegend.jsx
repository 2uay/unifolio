import React from 'react';
import { Info } from 'lucide-react';
import { HEATMAP_MODES } from '@/lib/heatmapModes.js';
import { getHeatmapLegendText } from '@/lib/heatmapColorEngine.js';

export default function HeatmapLegend({ mode }) {
  if (!mode || mode === HEATMAP_MODES.OFF) {
    return null;
  }

  const legendText = getHeatmapLegendText(mode);
  
  // Determine color based on mode category
  let bgColor = 'bg-slate-500/5 border-slate-500/20 text-slate-400/80';
  
  if (mode === HEATMAP_MODES.VOLATILITY) {
    bgColor = 'bg-amber-500/5 border-amber-500/20 text-amber-400/80';
  } else if ([
    HEATMAP_MODES.PORTFOLIO_WEIGHT,
    HEATMAP_MODES.ACCOUNT_WEIGHT,
  ].includes(mode)) {
    bgColor = 'bg-amber-500/5 border-amber-500/20 text-amber-400/80';
  } else if ([
    HEATMAP_MODES.DAILY_PNL_AMOUNT,
    HEATMAP_MODES.DAILY_PNL_PERCENT,
    HEATMAP_MODES.UNREALIZED_GAIN_AMOUNT,
    HEATMAP_MODES.UNREALIZED_GAIN_PERCENT,
    HEATMAP_MODES.REALIZED_GAIN_AMOUNT,
    HEATMAP_MODES.REALIZED_GAIN_PERCENT,
    HEATMAP_MODES.TOTAL_RETURN,
  ].includes(mode)) {
    bgColor = 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400/80';
  }

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${bgColor} text-xs`}>
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{legendText}</span>
    </div>
  );
}