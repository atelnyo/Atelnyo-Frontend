/**
 * src/services/location/timezoneService.js
 *
 * TimezoneService — supporting country signal via the browser timezone.
 *
 * Signal 3 of the Atelyona Location Intelligence spec. The browser
 * timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) is a
 * WEAK/supporting signal on purpose:
 *   * many countries share one timezone (e.g. America/New_York covers
 *     the whole US East Coast),
 *   * a traveler's device keeps their home timezone,
 *   * VPNs do not change the timezone.
 *
 * It must NEVER be the sole evidence for a country. The SignalFusionEngine
 * consumes the returned candidate with its low weight.
 *
 * Privacy: no network call, no storage — pure browser introspection.
 */

/**
 * Detect the browser IANA timezone (e.g. "America/Port-au-Prince").
 *
 * @returns {string|null} IANA timezone id, or null when the API is
 *   unavailable (old browsers, some webviews, SSR).
 */
export function getBrowserTimezone() {
  try {
    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return null;
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    return resolved?.timeZone || null;
  } catch (_) {
    // Defensive: a broken Intl implementation must never throw upward.
    return null;
  }
}

/**
 * IANA timezone → ISO-3166 alpha-2 country candidates.
 *
 * Deliberately NOT a complete mapping — only the timezones that are
 * (a) common for the platform's audience and (b) UNIQUE enough to be
 * useful. Multi-country timezones (America/New_York) map to the most
 * likely country but stay low-confidence; the engine handles that.
 *
 * Note the non-obvious one: America/Port-au-Prince is Haiti's own
 * timezone (EST, no DST) — a very strong hint for HT visitors even
 * when their browser language is fr-FR.
 */
/**
 * Timezones shared by multiple countries (or where the single mapped
 * country is only the most likely, not certain). These get a LOWER
 * confidence — the engine must not over-trust a shared zone.
 */
export const SHARED_TIMEZONES = new Set([
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Montreal', 'America/Vancouver',
  'Europe/London', 'Europe/Paris', 'Europe/Brussels', 'Europe/Zurich',
  'Europe/Madrid', 'Africa/Lagos', 'Africa/Nairobi',
]);

export const TIMEZONE_TO_COUNTRY = {
  // Haiti + immediate neighbors (the platform's core audience).
  'America/Port-au-Prince': ['HT'],
  'America/Santo_Domingo': ['DO'],
  'America/Havana': ['CU'],
  // North America — multi-country, low confidence per country.
  'America/New_York': ['US'],
  'America/Toronto': ['CA'],
  'America/Montreal': ['CA'],
  'America/Vancouver': ['CA'],
  'America/Chicago': ['US'],
  'America/Denver': ['US'],
  'America/Los_Angeles': ['US'],
  'America/Mexico_City': ['MX'],
  // Caribbean — mostly unique.
  'America/Nassau': ['BS'],
  'America/Jamaica': ['JM'],
  'America/Puerto_Rico': ['PR'],
  'America/Port_of_Spain': ['TT'],
  'America/Barbados': ['BB'],
  // Europe.
  'Europe/Paris': ['FR'],
  'Europe/Brussels': ['BE'],
  'Europe/Zurich': ['CH'],
  'Europe/London': ['GB'],
  'Europe/Madrid': ['ES'],
  // West Africa (francophone belt).
  'Africa/Dakar': ['SN'],
  'Africa/Abidjan': ['CI'],
  'Africa/Kinshasa': ['CD'],
  'Africa/Douala': ['CM'],
  'Africa/Lagos': ['NG'],
  'Africa/Nairobi': ['KE'],
  'Africa/Casablanca': ['MA'],
};

/**
 * Map a browser timezone to a candidate country.
 *
 * @param {string|null} timezone IANA id from getBrowserTimezone().
 * @returns {{ country: string|null, confidence: number, matched: boolean }}
 *   matched=false when the timezone is unknown (no evidence at all —
 *   the engine must NOT treat "no match" as "the user is elsewhere").
 */
export function detectCountryFromTimezone(timezone) {
  if (!timezone) {
    return { country: null, confidence: 0, matched: false };
  }
  const candidates = TIMEZONE_TO_COUNTRY[timezone];
  if (!candidates || candidates.length === 0) {
    return { country: null, confidence: 0, matched: false };
  }
  // Single-country timezones are stronger than shared ones.
  const confidence = SHARED_TIMEZONES.has(timezone) ? 0.4 : 0.7;
  return { country: candidates[0], confidence, matched: true };
}

/**
 * Build the full signal object consumed by the fusion engine.
 *
 * @param {string|null} [timezone] Pass a known timezone to override
 *   detection (tests). Defaults to the live browser value.
 * @returns {{ source: string, value: string|null, availability: string,
 *             confidence: number, timestamp: number, matched: boolean }}
 */
export function getTimezoneSignal(timezone) {
  // undefined → read the live browser timezone; an explicit null/''
  // means "no timezone available" (tests, SSR, degraded browsers).
  const tz = timezone === undefined ? getBrowserTimezone() : timezone;
  const { country, confidence, matched } = detectCountryFromTimezone(tz);
  return {
    source: 'timezone',
    value: country,          // ISO country candidate, NOT the raw tz
    raw: tz,                 // e.g. 'America/Port-au-Prince'
    availability: tz ? 'available' : 'unavailable',
    confidence,
    matched,
    timestamp: Date.now(),
  };
}
