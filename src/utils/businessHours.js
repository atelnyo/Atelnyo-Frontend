/**
 * src/utils/businessHours.js — shared operating-hours helpers.
 *
 * BusinessProfile.hours is a {day: "display string"} dict keyed by
 * mon..sun (free-form values like "09:00–17:00" or "Closed"). The day
 * → localized label mapping is shared by the workspace settings editor
 * and the public page so the two can never drift.
 */

export const BUSINESS_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Localized weekday label for a mon..sun key ("Monday", "Lendi"...). */
export function businessDayLabel(key, lang = 'en') {
  const locale = lang === 'ht' ? 'fr-HT' : (lang === 'fr' ? 'fr-FR' : (lang === 'es' ? 'es-ES' : 'en-US'));
  const index = BUSINESS_DAYS.indexOf(key);
  if (index < 0) return key;
  // 2024-01-01 was a Monday → index 0 = mon.
  return new Date(`2024-01-0${index + 1}T00:00:00`)
    .toLocaleDateString(locale, { weekday: 'long' });
}

/** True when an hours value reads as "closed" in any supported language. */
export function isClosedHours(value = '') {
  return /closed|ferm|fèm|cerrad/i.test(String(value));
}
