/**
 * src/modules/explore/constants/badges.js
 *
 * Badge System — Single source of truth for all badge types.
 *
 * Each badge definition specifies:
 *   id        — unique identifier (maps to data-badge-type CSS attribute)
 *   label     — human-readable label (localized via t() in the component)
 *   icon      — Font Awesome icon class
 *   color     — CSS variable for the badge's accent color
 *   tooltip   — descriptive hover text
 *   priority  — sort order when multiple badges are shown (lower = first)
 *
 * Usage:
 *   import { BADGE_DEFINITIONS } from '../constants/badges';
 *   const def = BADGE_DEFINITIONS['verified'];
 */

export const BADGE_DEFINITIONS = {
  verified: {
    id: 'verified',
    label: 'Verified',
    icon: 'fa-check-circle',
    color: 'var(--color-info)',
    tooltip: 'Verified creator — identity confirmed',
    priority: 1,
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    icon: 'fa-crown',
    color: 'var(--color-gold)',
    tooltip: 'Premium creator — exclusive content',
    priority: 2,
  },
  top_instructor: {
    id: 'top_instructor',
    label: 'Top Instructor',
    icon: 'fa-graduation-cap',
    color: 'var(--color-primary)',
    tooltip: 'Top rated instructor',
    priority: 3,
  },
  top_seller: {
    id: 'top_seller',
    label: 'Top Seller',
    icon: 'fa-trophy',
    color: 'var(--color-amber)',
    tooltip: 'Top selling creator',
    priority: 4,
  },
  featured_creator: {
    id: 'featured_creator',
    label: 'Featured Creator',
    icon: 'fa-star',
    color: 'var(--color-purple)',
    tooltip: 'Featured by Atelnyo',
    priority: 5,
  },
  official: {
    id: 'official',
    label: 'Official',
    icon: 'fa-building-columns',
    color: 'var(--color-info-dark)',
    tooltip: 'Official Atelnyo partner',
    priority: 6,
  },
  partner: {
    id: 'partner',
    label: 'Partner',
    icon: 'fa-handshake',
    color: 'var(--color-success)',
    tooltip: 'Atelnyo partner organization',
    priority: 7,
  },
  academy_team: {
    id: 'academy_team',
    label: 'Team',
    icon: 'fa-users-gear',
    color: 'var(--color-primary-dark)',
    tooltip: 'Atelnyo team member',
    priority: 8,
  },
};

/** Sorted list of badge IDs by priority (useful for rendering). */
export const BADGE_PRIORITY_ORDER = Object.values(BADGE_DEFINITIONS)
  .sort((a, b) => a.priority - b.priority)
  .map((b) => b.id);

/** Get badge definition by type ID. Returns null for unknown types. */
export function getBadgeDef(type) {
  return BADGE_DEFINITIONS[type] || null;
}

/** Check if a badge type is valid. */
export function isValidBadgeType(type) {
  return type in BADGE_DEFINITIONS;
}
