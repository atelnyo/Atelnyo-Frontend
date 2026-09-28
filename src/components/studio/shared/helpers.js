/**
 * src/components/studio/shared/helpers.js
 *
 * Shared utility functions used across all Creator Studio components.
 * Extracted from the monolithic CreatorStudio.jsx during the Etap 1 refactor.
 *
 * These were previously duplicated across multiple files:
 *   - CreatorStudio.jsx (original)
 *   - MediaLibrary.jsx (fmtDate, classNames)
 *   - MediaProviderSection.jsx (fmtDate, classNames)
 *   - DailyCreatorCenter.jsx (classNames, fmtCurrency)
 *   - MediaHub.jsx (fmtCount)
 *   - CreatorGoals.jsx (classNames)
 *   - CreatorProgression.jsx (classNames)
 *   - CreatorProfileHealth.jsx (classNames)
 *
 * Now all components import from this single source of truth.
 */

/**
 * Format a number as a human-readable currency string.
 *
 * Examples:
 *   fmtCurrency(1500000) → "$1.5M"
 *   fmtCurrency(1500)    → "$1.5K"
 *   fmtCurrency(42.50)   → "$42.50"
 *   fmtCurrency(null)    → "$0.00"
 */
export function fmtCurrency(n) {
  if (n == null || !Number.isFinite(Number(n))) {
    return '$0.00';
  }
  const v = Number(n);
  if (v >= 1_000_000) {
    return `$${(v / 1_000_000).toFixed(1)}M`;
  }
  if (v >= 1_000) {
    return `$${(v / 1_000).toFixed(1)}K`;
  }
  return `$${v.toFixed(2)}`;
}

/**
 * Format a count number with locale-aware grouping.
 *
 * Examples:
 *   fmtCount(1234) → "1,234"
 *   fmtCount(null)  → "0"
 */
export function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) {
    return '0';
  }
  return Number(n).toLocaleString();
}

/**
 * Format an ISO date string to a short locale date.
 *
 * Examples:
 *   fmtDate('2026-07-19T10:30:00Z') → "7/19/2026"
 *   fmtDate(null)                   → "—"
 */
export function fmtDate(iso) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

/**
 * Safely join CSS class names, filtering out falsy values.
 *
 * Usage:
 *   classNames('base', isActive && 'active') → "base active"
 *   classNames('base', false && 'hidden')    → "base"
 */
export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}
