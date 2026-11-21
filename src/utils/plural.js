/**
 * src/utils/plural.js — count-aware labels without a new i18n dependency.
 *
 * The project's interface languages are ht / en / fr (Spanish resolves
 * to English in utils/i18n.js). Each caller supplies the singular and
 * plural word — the helper only decides which one to use, so French
 * "+1 autre règle" never becomes "+1 autres règles".
 */

const FALLBACK = 'en';

function languageOf(lang) {
  const code = String(lang || '').trim().toLowerCase().split('-')[0];
  return ['ht', 'fr', 'es'].includes(code) ? code : FALLBACK;
}

/**
 * @param {string} lang
 * @param {number} count
 * @param {{ht?: {one: string, many: string}, en: {one: string, many: string}, fr?: {one: string, many: string}}} forms
 * @returns {string} the correct word form
 */
export function pluralize(lang, count, forms) {
  const language = languageOf(lang);
  const set = forms?.[language] || forms?.[FALLBACK];
  if (!set) return '';
  return Number(count) === 1 ? set.one : set.many;
}

/** "1 règle" / "3 règles" — count plus the correct unit. */
export function countWithUnit(lang, count, forms) {
  const safe = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${safe} ${pluralize(lang, safe, forms)}`;
}
