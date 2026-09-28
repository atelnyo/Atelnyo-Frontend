/**
 * src/modules/explore/components/Badge.jsx
 *
 * Badge component for the Atelnyo Badge System.
 *
 * Renders a badge with icon + optional label, using CSS custom properties
 * for theming. Supports dark mode, keyboard navigation, and screen readers.
 *
 * Usage:
 *   <Badge type="verified" size="sm" />
 *   <Badge type="premium" size="md" showLabel />
 *
 * Props:
 *   type      — Badge type ID (required): verified | premium | top_instructor | ...
 *   size      — 'xs' | 'sm' | 'md' | 'lg' (default: 'sm')
 *   showLabel — Whether to show the text label alongside the icon (default: false)
 *   t         — Translations object (optional, for localized labels)
 *   className — Additional CSS class names
 */
import React from 'react';
import { getBadgeDef } from '../constants/badges';

const SIZE_CONFIG = {
  xs: { iconSize: '0.6rem', gap: '2px', padding: '1px 4px', fontSize: '0.55rem', showLabelAlways: false },
  sm: { iconSize: '0.65rem', gap: '3px', padding: '2px 7px', fontSize: '0.62rem', showLabelAlways: false },
  md: { iconSize: '0.75rem', gap: '4px', padding: '3px 10px', fontSize: '0.7rem', showLabelAlways: true },
  lg: { iconSize: '0.85rem', gap: '5px', padding: '4px 12px', fontSize: '0.78rem', showLabelAlways: true },
};

export default function Badge({ type, size = 'sm', showLabel, t, className = '' }) {
  const def = getBadgeDef(type);
  if (!def) return null;

  const config = SIZE_CONFIG[size] || SIZE_CONFIG.sm;
  const shouldShowLabel = showLabel || config.showLabelAlways;

  return (
    <span
      className={`badge badge--${size} ${className}`.trim()}
      data-badge-type={type}
      data-badge-size={size}
      role="status"
      aria-label={t?.[`badge_${type}`] || def.tooltip}
      title={def.tooltip}
    >
      <i
        className={`fas ${def.icon}`}
        aria-hidden="true"
        style={{ fontSize: config.iconSize }}
      />
      {shouldShowLabel && (
        <span className="badge-label">
          {t?.[`badge_${type}`] || def.label}
        </span>
      )}
    </span>
  );
}
