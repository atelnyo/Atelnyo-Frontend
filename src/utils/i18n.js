/**
 * src/utils/i18n.js — Lightweight i18n helpers for inline translations.
 *
 * Usage:
 *   import { t2, t } from '../utils/i18n';
 *
 *   // Simple lookup (returns string):
 *   {t2(lang, { ht: 'Kou', fr: 'Cours', es: 'Curso', en: 'Courses' })}
 *
 *   // React component-friendly (accepts 4 positional args):
 *   {t(lang, 'Kou', 'Courses', 'Cours', 'Curso')}
 *
 *   // With template (optional 6th arg):
 *   {t2(lang, { ht: `${count} kou`, fr: `${count} cours`, en: `${count} courses` })}
 *
 * Falls back: lang → 'en' → first available value → ''.
 */

/**
 * Map-based lookup. Pass an object keyed by language code.
 * @param {string} lang - Current language code ('ht', 'en', 'fr', 'es')
 * @param {Object} map  - { ht: '...', en: '...', fr: '...', es: '...' }
 * @returns {string}
 */
export function t2(lang, map) {
  if (!map) return '';
  return map[lang] || map.en || Object.values(map)[0] || '';
}

/**
 * Positional-arg lookup (shorter than building an object for simple cases).
 * @param {string} lang
 * @param {string} ht  - Haitian Creole
 * @param {string} en  - English (fallback)
 * @param {string} [fr] - French
 * @param {string} [es] - Spanish
 * @returns {string}
 */
export function t(lang, ht, en, fr, es) {
  switch (lang) {
    case 'ht': return ht || en || '';
    case 'fr': return fr || en || ht || '';
    case 'es': return es || en || ht || '';
    default:   return en || ht || '';
  }
}

/**
 * Check if a value is a translation map (object with language keys).
 * Useful for passing either a string or a translation map to a component.
 */
export function isTranslationMap(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}
