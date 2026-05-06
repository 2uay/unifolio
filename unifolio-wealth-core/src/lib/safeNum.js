/**
 * Centralized safe numeric utilities.
 * All helpers guard against null, undefined, NaN, and Infinity.
 */

/** Returns a finite number or the fallback (default 0). */
export function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Returns a safe array — never null/undefined. */
export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Safe division — returns fallback (default 0) when denominator is 0.
 * Use `nanFallback` if you want NaN-like "N/A" behaviour instead.
 */
export function safeDivide(numerator, denominator, fallback = 0) {
  const d = safeNumber(denominator);
  if (d === 0) return fallback;
  return safeNumber(numerator) / d;
}

/** Format a number as USD currency, or return "N/A" for invalid values. */
export function safeCurrency(value, compact = false) {
  const n = safeNumber(value, null);
  if (n === null) return 'N/A';
  if (compact && Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (compact && Math.abs(n) >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

/** Format a number as a percentage, or return "N/A" for invalid values. */
export function safePercent(value, decimals = 2) {
  const n = safeNumber(value, null);
  if (n === null) return 'N/A';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(decimals) + '%';
}

/** toFixed with a safety net — returns fallback string for invalid values. */
export function safeFixed(value, decimals = 2, fallback = 'N/A') {
  const n = safeNumber(value, null);
  if (n === null) return fallback;
  return n.toFixed(decimals);
}