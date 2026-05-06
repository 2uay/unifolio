/**
 * Global hover interaction classes
 * Use these classes on clickable elements for consistent, theme-aware hover effects
 */

export const hoverClasses = {
  // Buttons
  button: 'btn-hover',
  buttonLight: 'btn-hover btn-hover-light',
  buttonStrong: 'btn-hover btn-hover-strong',

  // Cards and containers
  card: 'card-hover',
  statCard: 'stat-card-hover',

  // Table rows
  row: 'row-hover',

  // Icons and small elements
  icon: 'icon-hover',
  iconWithBg: 'icon-hover icon-hover-bg',

  // Financial data (tickers, prices, values)
  ticker: 'ticker-hover',
  value: 'value-hover',

  // Dropdowns and menus
  menuItem: 'transition-all duration-150 hover:bg-accent/20',

  // Navigation links
  navLink: 'transition-all duration-150 hover:translate-x-0.5',

  // Explore cards
  exploreCard: 'card-hover',

  // Watchlist rows
  watchlistRow: 'row-hover',

  // Prediction market cards
  pmCard: 'card-hover',

  // Account cards
  accountCard: 'card-hover',

  // Custom asset cards
  assetCard: 'card-hover',
};

/**
 * Helper to combine classes with hover effects
 */
export const withHover = (baseClass, hoverType = 'button') => {
  const hoverClass = hoverClasses[hoverType] || hoverClasses.button;
  return baseClass ? `${baseClass} ${hoverClass}` : hoverClass;
};

/**
 * Reusable class sets for common patterns
 */
export const hoverPatterns = {
  // Primary action button
  primaryButton: 'btn-hover btn-hover-strong',

  // Secondary button
  secondaryButton: 'btn-hover btn-hover-light',

  // Ghost/tertiary button
  ghostButton: 'btn-hover',

  // Icon-only button
  iconButton: 'icon-hover icon-hover-bg',

  // Clickable card
  interactiveCard: 'card-hover',

  // Clickable table row
  interactiveRow: 'row-hover',

  // Clickable metric/number
  interactiveValue: 'value-hover',

  // Stock ticker link
  stockTicker: 'ticker-hover',

  // Dropdown item
  dropdownItem: 'transition-all duration-150 hover:bg-accent/20',

  // Navigation item
  navItem: 'transition-all duration-150 hover:translate-x-0.5',

  // Modal header/close
  modalControl: 'icon-hover',

  // Chart button
  chartButton: 'btn-hover btn-hover-light',

  // Theme option
  themeOption: 'card-hover',

  // Currency option
  currencyOption: 'transition-all duration-150 hover:bg-accent/20',

  // Heatmap mode option
  heatmapModeOption: 'transition-all duration-150 hover:bg-accent/20',
};

/**
 * Dynamic hover class generator based on element type and context
 */
export const getHoverClass = (elementType, variant = 'default') => {
  const mapping = {
    button: {
      default: 'btn-hover',
      primary: 'btn-hover btn-hover-strong',
      secondary: 'btn-hover btn-hover-light',
      ghost: 'btn-hover',
      icon: 'icon-hover icon-hover-bg',
    },
    card: {
      default: 'card-hover',
      stat: 'stat-card-hover',
      interactive: 'card-hover',
    },
    row: {
      default: 'row-hover',
      table: 'row-hover',
      list: 'row-hover',
    },
    link: {
      default: 'transition-all duration-150 hover:text-primary',
      nav: 'transition-all duration-150 hover:translate-x-0.5',
      ticker: 'ticker-hover',
      value: 'value-hover',
    },
    dropdown: {
      default: 'transition-all duration-150 hover:bg-accent/20',
      item: 'transition-all duration-150 hover:bg-accent/20',
    },
  };

  return mapping[elementType]?.[variant] || mapping[elementType]?.default || '';
};