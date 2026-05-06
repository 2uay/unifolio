// Enhanced heatmap engine with absolute + relative concentration
// Calculates intensity based on both actual % and relative to max holding in view

/**
 * Calculate heatmap color based on concentration
 * @param {number} pctOfPortfolio - Holding's % of selected portfolio
 * @param {number} maxPctInView - Largest % holding in current view
 * @param {boolean} isRealized - If true, use muted colors (closed position)
 * @returns {object} - { bgStyle, intensity, label }
 */
export function getHeatmapColor(pctOfPortfolio, maxPctInView = 50, isRealized = false) {
  // Realized positions: keep muted regardless of size
  if (isRealized) {
    return {
      bgStyle: { backgroundColor: 'transparent' },
      bgClass: 'bg-transparent hover:bg-secondary/20',
      intensity: 0,
      label: 'Closed position',
    };
  }

  // Normalize to 0-1 range for color intensity
  // Use relative weight: how much of the max this holding is
  const relativeWeight = maxPctInView > 0 ? pctOfPortfolio / maxPctInView : 0;
  
  // Boost small portfolios: if max is under 20%, stretch the scale
  const boostFactor = maxPctInView < 20 ? 1.3 : 1;
  const boostedRelative = Math.min(relativeWeight * boostFactor, 1);
  
  // Absolute concentration risk: holdings above certain thresholds
  // Get absolute intensity (separate from relative)
  let absoluteIntensity = 0;
  if (pctOfPortfolio >= 40) absoluteIntensity = 0.9; // 40%+ is very concentrated
  else if (pctOfPortfolio >= 30) absoluteIntensity = 0.75;
  else if (pctOfPortfolio >= 20) absoluteIntensity = 0.6;
  else if (pctOfPortfolio >= 15) absoluteIntensity = 0.45;
  else absoluteIntensity = 0;
  
  // Blend: use whichever is stronger (absolute risk or relative prominence)
  // This way, a 49% holding is very dark, but a 15% in a 15% max portfolio is still visible
  const intensity = Math.max(boostedRelative, absoluteIntensity);
  
  // Color scale: from subtle to intense red/amber-red
  // Use HSL for smooth transitions: hsl(0, sat%, light%)
  // Red = 0°, Amber-red = 15°
  let hue = 0; // Start at red
  let saturation = Math.min(60 + intensity * 30, 85); // 60-85% saturation
  let lightness;
  
  if (intensity < 0.2) {
    // Subtle red tint
    lightness = 90;
  } else if (intensity < 0.4) {
    // Light red/pink tint
    lightness = 85;
  } else if (intensity < 0.6) {
    // Noticeable red tint
    lightness = 75;
  } else if (intensity < 0.8) {
    // Strong red tint
    lightness = 60;
    hue = 8; // Shift slightly to amber-red
  } else {
    // Dark red / amber-red (highest concentration)
    lightness = 45;
    hue = 12;
    saturation = 85;
  }
  
  // Also use opacity for more prominence
  const opacity = Math.max(0.15, intensity * 0.6); // 0.15 - 0.6 opacity
  
  const bgColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
  
  return {
    bgStyle: { backgroundColor: bgColor },
    bgClass: `hover:brightness-110 transition-all`,
    intensity,
    label: formatHeatmapLabel(pctOfPortfolio, intensity),
  };
}

/**
 * Format heatmap tooltip label
 */
export function formatHeatmapLabel(pctOfPortfolio, intensity = 0) {
  if (pctOfPortfolio < 0.01) return 'Minimal concentration';
  if (intensity < 0.3) return `${pctOfPortfolio.toFixed(2)}% — Low concentration`;
  if (intensity < 0.6) return `${pctOfPortfolio.toFixed(2)}% — Moderate concentration`;
  if (intensity < 0.8) return `${pctOfPortfolio.toFixed(2)}% — High concentration`;
  return `${pctOfPortfolio.toFixed(2)}% — Very high concentration`;
}

/**
 * Get heatmap color for cell (slightly stronger than row)
 */
export function getHeatmapCellColor(pctOfPortfolio, maxPctInView = 50, isRealized = false) {
  if (isRealized) {
    return 'transparent';
  }
  
  const relativeWeight = maxPctInView > 0 ? pctOfPortfolio / maxPctInView : 0;
  const boostFactor = maxPctInView < 20 ? 1.3 : 1;
  const boostedRelative = Math.min(relativeWeight * boostFactor, 1);
  
  let absoluteIntensity = 0;
  if (pctOfPortfolio >= 40) absoluteIntensity = 0.9;
  else if (pctOfPortfolio >= 30) absoluteIntensity = 0.75;
  else if (pctOfPortfolio >= 20) absoluteIntensity = 0.6;
  else if (pctOfPortfolio >= 15) absoluteIntensity = 0.45;
  else absoluteIntensity = 0;
  
  const intensity = Math.max(boostedRelative, absoluteIntensity);
  
  let hue = 0;
  let saturation = Math.min(70 + intensity * 25, 90);
  let lightness;
  
  if (intensity < 0.2) {
    lightness = 88;
  } else if (intensity < 0.4) {
    lightness = 80;
  } else if (intensity < 0.6) {
    lightness = 70;
  } else if (intensity < 0.8) {
    lightness = 55;
    hue = 8;
  } else {
    lightness = 40;
    hue = 12;
    saturation = 88;
  }
  
  // Slightly higher opacity for cells
  const opacity = Math.max(0.25, intensity * 0.7);
  
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
}