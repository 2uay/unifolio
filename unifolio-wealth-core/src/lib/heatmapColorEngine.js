import { HEATMAP_MODES, HEATMAP_MODE_CONFIG } from './heatmapModes.js';
import { safeNumber } from './safeNum.js';

// Calculate heatmap style for a holding based on mode
export function calculateHeatmapStyle(holding, mode, context = {}) {
  if (!mode || mode === HEATMAP_MODES.OFF) {
    return { bgStyle: {}, label: '' };
  }

  const {
    portfolioTotal = 0,
    accountTotal = 0,
    visibleHoldings = [],
    theme = 'default',
    accentColor = '#3B82F6',
    allRealizedHoldings = [],
  } = context;

  const value = extractHeatmapValue(holding, mode, allRealizedHoldings);
  if (value === null) {
    return { bgStyle: {}, label: '' };
  }

  // Calculate relative intensity based on visible holdings
  const intensity = calculateIntensity(value, mode, visibleHoldings, context, allRealizedHoldings);
  const colorScheme = HEATMAP_MODE_CONFIG[mode]?.colorScheme || 'neutral';

  return generateColorStyle(intensity, colorScheme, value, mode, theme, accentColor);
}

// Extract the numeric value for a holding based on heatmap mode
function extractHeatmapValue(holding, mode, allRealizedHoldings = []) {
  const safeNum = (v, def = 0) => safeNumber(v, def);

  switch (mode) {
    case HEATMAP_MODES.PORTFOLIO_WEIGHT:
      return safeNum(holding._portfolioWeight ?? 0);
    case HEATMAP_MODES.ACCOUNT_WEIGHT:
      return safeNum(holding._accountWeight ?? 0);
    case HEATMAP_MODES.DAILY_PNL_AMOUNT:
      return safeNum(holding.daily_pnl_amount ?? holding.dailyPnl ?? 0);
    case HEATMAP_MODES.DAILY_PNL_PERCENT:
      return safeNum(holding.daily_pnl_percent ?? holding.dailyPct ?? 0);
    case HEATMAP_MODES.UNREALIZED_GAIN_AMOUNT:
      return safeNum(holding.unrealized_gain_loss_amount ?? holding.unrealizedAmt ?? 0);
    case HEATMAP_MODES.UNREALIZED_GAIN_PERCENT:
      return safeNum(holding.unrealized_gain_loss_percent ?? holding.unrealizedPct ?? 0);
    case HEATMAP_MODES.REALIZED_GAIN_AMOUNT:
      return safeNum(holding.realized_gain_loss_amount ?? holding.realizedGain ?? 0);
    case HEATMAP_MODES.REALIZED_GAIN_PERCENT:
      return safeNum(holding.realized_gain_loss_percent ?? holding.realizedPct ?? 0);
    case HEATMAP_MODES.REALIZED_GAIN_CONTRIBUTION:
      return safeNum(holding._realizedGainContribution ?? 0);
    case HEATMAP_MODES.TOTAL_RETURN:
      const unrealized = safeNum(holding.unrealized_gain_loss_amount ?? holding.unrealizedAmt ?? 0);
      const realized = safeNum(holding.realized_gain_loss_amount ?? holding.realizedGain ?? 0);
      return unrealized + realized;
    case HEATMAP_MODES.PRICE_MOVEMENT:
      // Price movement: difference between current and opening price (from sparkline)
      const current = safeNum(holding.current_price ?? holding.lastPrice ?? 0);
      const sparkline = Array.isArray(holding.sparkline) && holding.sparkline.length > 0 ? holding.sparkline[0] : current;
      return current - sparkline;
    case HEATMAP_MODES.VOLATILITY:
      return safeNum(holding.volatility ?? holding._volatility ?? 15);
    case HEATMAP_MODES.CUSTOM_RISK:
      // Placeholder: combine portfolio weight, volatility, and unrealized loss
      const weight = safeNum(holding._portfolioWeight ?? 0);
      const vol = safeNum(holding.volatility ?? 15);
      const loss = Math.max(0, -safeNum(holding.unrealized_gain_loss_amount ?? 0));
      return (weight * 100) + (vol * 0.5) + Math.min(loss / 10000, 5);
    default:
      return null;
  }
}

// Calculate normalized intensity (0-1) based on the distribution of values in visible holdings
function calculateIntensity(value, mode, visibleHoldings, context, allRealizedHoldings = []) {
  if (!visibleHoldings || visibleHoldings.length === 0) return 0;

  const values = visibleHoldings
    .map(h => extractHeatmapValue(h, mode, allRealizedHoldings))
    .filter(v => v !== null);
  if (values.length === 0) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Concentration modes: normalize across range (0-100% scale)
  if (mode === HEATMAP_MODES.PORTFOLIO_WEIGHT || mode === HEATMAP_MODES.ACCOUNT_WEIGHT) {
    return range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  }

  // Price movement: normalize across range
  if (mode === HEATMAP_MODES.PRICE_MOVEMENT) {
    return range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  }

  // P&L and return modes: split positive/negative
  if ([
    HEATMAP_MODES.DAILY_PNL_AMOUNT,
    HEATMAP_MODES.DAILY_PNL_PERCENT,
    HEATMAP_MODES.UNREALIZED_GAIN_AMOUNT,
    HEATMAP_MODES.UNREALIZED_GAIN_PERCENT,
    HEATMAP_MODES.REALIZED_GAIN_AMOUNT,
    HEATMAP_MODES.REALIZED_GAIN_PERCENT,
    HEATMAP_MODES.REALIZED_GAIN_CONTRIBUTION,
    HEATMAP_MODES.TOTAL_RETURN,
  ].includes(mode)) {
    if (value >= 0) {
      const posValues = values.filter(v => v >= 0);
      const maxPos = Math.max(...posValues, 0);
      return maxPos > 0 ? Math.min(1, value / maxPos) : 0;
    } else {
      const negValues = values.filter(v => v < 0);
      const minNeg = Math.min(...negValues, 0);
      return minNeg < 0 ? Math.min(1, Math.abs(value) / Math.abs(minNeg)) : 0;
    }
  }

  // Volatility: normalize across range
  if (mode === HEATMAP_MODES.VOLATILITY) {
    return range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  }

  return 0;
}

// Generate HSL color style based on intensity and color scheme
function generateColorStyle(intensity, colorScheme, value, mode, theme, accentColor) {
  if (colorScheme === 'concentration') {
    return concentrationColor(intensity, value, theme, accentColor);
  } else if (colorScheme === 'pnl') {
    return pnlColor(intensity, value, theme, mode);
  } else if (colorScheme === 'volatility') {
    return volatilityColor(intensity, theme);
  }
  return { bgStyle: {}, label: '' };
}

// Concentration heatmap: tinted with the active theme's primary color
function concentrationColor(intensity, value, _theme, accentColor) {
  const opacity = Math.pow(intensity, 0.75) * 0.18;
  // accentColor is an HSL components string from the --primary CSS variable ("217 91% 60%")
  // or a legacy hex fallback — handle both
  const bgColor = accentColor && accentColor.includes('%')
    ? `hsl(${accentColor} / ${opacity})`
    : `rgba(${hexToRgb(accentColor || '#3B82F6')}, ${opacity})`;

  return {
    bgStyle: { backgroundColor: bgColor },
    label: `${(value * 100).toFixed(1)}% concentration`,
  };
}

// P&L/Return heatmap: green/red tints
function pnlColor(intensity, value, theme, mode) {
  const isGain = value >= 0;
  const opacity = Math.pow(Math.abs(intensity), 0.85) * 0.20; // Max 20% opacity
  
  // Use theme-specific colors if available
  let gainColor = 'rgba(34, 197, 94, OPACITY)';    // Default green
  let lossColor = 'rgba(239, 68, 68, OPACITY)';    // Default red
  
  if (theme === 'bloomberg') {
    gainColor = 'rgba(76, 175, 80, OPACITY)';      // Bloomberg green
    lossColor = 'rgba(229, 57, 53, OPACITY)';      // Bloomberg red
  }
  
  const bgColor = (isGain ? gainColor : lossColor).replace('OPACITY', opacity);
  
  let label;
  if (mode === HEATMAP_MODES.REALIZED_GAIN_CONTRIBUTION) {
    label = `${value >= 0 ? '+' : ''}${Math.abs(value).toFixed(1)}%`;
  } else {
    label = `${value >= 0 ? '+' : ''}${Math.abs(value).toFixed(2)}`;
  }

  return {
    bgStyle: { backgroundColor: bgColor },
    label,
  };
}

// Volatility heatmap: orange warning tint
function volatilityColor(intensity, theme) {
  const opacity = Math.pow(intensity, 0.75) * 0.16; // Max 16% opacity
  const bgColor = `rgba(249, 115, 22, ${opacity})`; // Warm orange
  const label = `Vol: ${(intensity * 100).toFixed(0)}%`;

  return {
    bgStyle: { backgroundColor: bgColor },
    label,
  };
}

// Helper: convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '59, 130, 246';
}

// Prepare holdings with heatmap metadata — always computes all enriched fields so
// hover-preview across any mode works without re-enriching.
export function enrichHoldingsForHeatmap(holdings, _mode, context = {}) {
  const { portfolioTotal = 0, accountTotals = {}, totalAbsoluteRealizedPnl = 0 } = context;

  return holdings.map(h => {
    const marketValue = safeNumber(h.market_value ?? h.marketValue ?? 0);
    const accountId = h.account_id ?? h.accountId;
    const accTotal = accountTotals[accountId] || 0;
    const realized = safeNumber(h.realized_gain_loss_amount ?? h.realizedGain ?? 0);

    return {
      ...h,
      _portfolioWeight: portfolioTotal > 0 ? marketValue / portfolioTotal : 0,
      _accountWeight: accTotal > 0 ? marketValue / accTotal : 0,
      _realizedGainContribution: totalAbsoluteRealizedPnl > 0 ? (realized / totalAbsoluteRealizedPnl) * 100 : 0,
    };
  });
}

export function getHeatmapLegendText(mode) {
  return HEATMAP_MODE_CONFIG[mode]?.legendText || '';
}