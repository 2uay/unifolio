/**
 * Secondary Color Palettes for Heatmaps
 * 
 * Provides curated professional palettes for different financial visualization moods.
 */

export const PALETTES = {
  bloomberg_heat: {
    id: 'bloomberg_heat',
    name: 'Bloomberg Heat',
    description: 'Financial terminal aesthetic with warm reds and cool blues',
    gain: '#34d399',
    loss: '#f87171',
    volatility: '#f97316',
    neutral: '#64748b',
    colors: {
      low: '#34d399',
      mid: '#eab308',
      high: '#f87171',
    },
  },
  classic_pnl: {
    id: 'classic_pnl',
    name: 'Classic P&L',
    description: 'Traditional green gains and red losses',
    gain: '#22c55e',
    loss: '#ef4444',
    volatility: '#f59e0b',
    neutral: '#6b7280',
    colors: {
      low: '#22c55e',
      mid: '#fbbf24',
      high: '#ef4444',
    },
  },
  terminal_green: {
    id: 'terminal_green',
    name: 'Terminal Green',
    description: 'Retro trading terminal with monochromatic greens',
    gain: '#86efac',
    loss: '#fca5a5',
    volatility: '#fcd34d',
    neutral: '#9ca3af',
    colors: {
      low: '#86efac',
      mid: '#10b981',
      high: '#059669',
    },
  },
  risk_radar: {
    id: 'risk_radar',
    name: 'Risk Radar',
    description: 'Risk-focused with orange volatility warnings',
    gain: '#06b6d4',
    loss: '#dc2626',
    volatility: '#ea580c',
    neutral: '#71717a',
    colors: {
      low: '#06b6d4',
      mid: '#fb923c',
      high: '#dc2626',
    },
  },
  ocean_analytics: {
    id: 'ocean_analytics',
    name: 'Ocean Analytics',
    description: 'Cool oceanic tones for calm analysis',
    gain: '#06b6d4',
    loss: '#6366f1',
    volatility: '#8b5cf6',
    neutral: '#64748b',
    colors: {
      low: '#06b6d4',
      mid: '#3b82f6',
      high: '#6366f1',
    },
  },
  royal_markets: {
    id: 'royal_markets',
    name: 'Royal Markets',
    description: 'Premium purple and gold palette',
    gain: '#a78bfa',
    loss: '#f472b6',
    volatility: '#fbbf24',
    neutral: '#9ca3af',
    colors: {
      low: '#a78bfa',
      mid: '#d946ef',
      high: '#f472b6',
    },
  },
  monochrome_pro: {
    id: 'monochrome_pro',
    name: 'Monochrome Pro',
    description: 'Grayscale palette for professional reports',
    gain: '#e5e7eb',
    loss: '#1f2937',
    volatility: '#6b7280',
    neutral: '#9ca3af',
    colors: {
      low: '#e5e7eb',
      mid: '#9ca3af',
      high: '#1f2937',
    },
  },
  neon_market: {
    id: 'neon_market',
    name: 'Neon Market',
    description: 'High-contrast neon vibes for active trading',
    gain: '#00ff88',
    loss: '#ff0055',
    volatility: '#ffff00',
    neutral: '#00ffff',
    colors: {
      low: '#00ff88',
      mid: '#ffff00',
      high: '#ff0055',
    },
  },
};

/**
 * Get a palette by ID
 */
export function getPalette(paletteId) {
  return PALETTES[paletteId] || PALETTES.bloomberg_heat;
}

/**
 * Get list of all palettes for selection UI
 */
export function getPalettesList() {
  return Object.values(PALETTES);
}

/**
 * Get a color from palette based on intensity and key
 * intensity: 0-1 (0 = low intensity, 1 = high intensity)
 * key: 'gain', 'loss', 'volatility', or specific 'low'/'mid'/'high'
 */
export function getColorFromPalette(paletteId, key, intensity = 0.5) {
  const palette = getPalette(paletteId);
  if (!palette) return null;

  // Direct key match (gain, loss, volatility, neutral)
  if (palette[key]) {
    return palette[key];
  }

  // Intensity-based selection from colors object
  if (key === 'intensity') {
    if (intensity < 0.33) {
      return palette.colors?.low || palette.gain;
    } else if (intensity < 0.66) {
      return palette.colors?.mid || palette.neutral;
    } else {
      return palette.colors?.high || palette.loss;
    }
  }

  return null;
}