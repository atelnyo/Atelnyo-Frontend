/**
 * src/constants/media.js — Shared media constants (Prompt 23).
 *
 * Extracted from MediaList.jsx and SmartRecommendations.jsx so the
 * two files can't drift on bilingual labels. New modules / visibility
 * levels should be added here, not inlined.
 *
 * Convention: every entry has both `en` (English) and `ht` (Haitian
 * Creole) labels so consumers can do `isHt ? v.ht : v.en` without
 * touching the constant shape.
 */

export const MODULE_LABELS = {
  course:         { en: 'Course',         ht: 'Kou' },
  lesson:         { en: 'Lesson',         ht: 'Leçon' },
  product:        { en: 'Product',        ht: 'Pwodwi' },
  portfolio:      { en: 'Portfolio',      ht: 'Pòtfolyo' },
  profile_banner: { en: 'Banner',         ht: 'Banniyè' },
  profile_avatar: { en: 'Avatar',         ht: 'Avata' },
  music:          { en: 'Music',          ht: 'Mizik' },
  cover:          { en: 'Cover',          ht: 'Kouvèti' },
  community:      { en: 'Community',      ht: 'Kominote' },
  spotlight:      { en: 'Spotlight',      ht: 'Spotlight' },
  cms:            { en: 'CMS',            ht: 'CMS' },
  homepage:       { en: 'Homepage',       ht: 'Akèy' },
  other:          { en: 'Other',          ht: 'Lòt' },
};

export const VISIBILITY_LABELS = {
  public:    { en: 'Public',    ht: 'Piblik',    icon: 'fa-globe',          color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  followers: { en: 'Followers', ht: 'Abonnen',   icon: 'fa-users',          color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.08))' },
  students:  { en: 'Students',  ht: 'Elèv',      icon: 'fa-graduation-cap', color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))' },
  customers: { en: 'Customers', ht: 'Kliyan',    icon: 'fa-shopping-bag',   color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  community: { en: 'Community', ht: 'Kominote',  icon: 'fa-comments',       color: 'var(--pr-color-pink-500, #ec4899)', bg: 'rgba(236,72,153,0.08)' },
  purchased: { en: 'Purchased', ht: 'Achte',     icon: 'fa-receipt',        color: 'var(--pr-color-teal-500, #14b8a6)', bg: 'rgba(20,184,166,0.08)' },
  private:   { en: 'Private',   ht: 'Prive',     icon: 'fa-lock',           color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))' },
  unlisted:  { en: 'Unlisted',  ht: 'Rezève',    icon: 'fa-eye-slash',      color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.08))' },
};

/** Default visibility assigned to media with no visibility flag yet. */
export const DEFAULT_VISIBILITY = 'public';

/** Convenience: label lookup that falls back to the raw key. */
export function moduleLabel(module, isHt) {
  const entry = MODULE_LABELS[module];
  if (!entry) return module || '—';
  return isHt ? entry.ht : entry.en;
}

export function visibilityLabel(visibility, isHt) {
  const entry = VISIBILITY_LABELS[visibility || DEFAULT_VISIBILITY];
  if (!entry)  return { en: visibility || 'Unknown', ht: visibility || 'Enkoni', icon: 'fa-eye', color: 'var(--text-secondary, #94a3b8)' };
  return { ...entry, label: isHt ? entry.ht : entry.en, color: entry.color || 'var(--text-secondary, #94a3b8)' };
}
