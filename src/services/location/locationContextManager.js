/**
 * src/services/location/locationContextManager.js
 *
 * LocationContextManager — the orchestrator of Atelyona Location
 * Intelligence (Signal 18 + the module layout of the spec).
 *
 * Responsibilities:
 *   1. Collect every AVAILABLE country signal:
 *        geoip          — backend /api/geo/hint/ (IP → country)
 *        timezone       — Intl timezone → country (supporting)
 *        user_profile   — the account's chosen country (strongest)
 *      (locale + network are collected by LanguageIntelligence / the
 *      fusion engine and carry no country vote.)
 *   2. Fuse them through SignalFusionEngine → country + confidence.
 *   3. Cache the result (LocationCache) so re-renders are free.
 *   4. Refresh intelligently: fresh → reuse; stale → refresh in the
 *      background; nothing cached → full resolve.
 *   5. PERSIST the fused estimate to the account's location_prefs
 *      (detected_country / detected_region / detected_at) via
 *      PATCH /api/me/ — only when logged in, only own account.
 *
 * NEVER prompts for GPS here. GPS is an explicit user action (the
 * settings "Detect" button) wired by the calling component through
 * the existing useGeolocation hook + PermissionCenter; this manager
 * accepts an optional geolocation signal if the caller already has
 * permission granted (granted state only).
 *
 * Privacy: the cache stores only the derived country code + timestamp,
 * never coordinates, never the raw IP.
 */

import { fuseCountrySignals } from './signalFusionEngine';
import { locationCache } from './locationCache';
import { getTimezoneSignal } from './timezoneService';
import { getLocaleSignal } from './localeService';
import { getNetworkSignal } from './networkSignalService';
import { fetchGeoIpSignal } from './geoIpService';

/**
 * Resolve the country context from every available signal.
 *
 * @param {object} [options]
 * @param {string|null} [options.userCountry]   Account's chosen country
 *   (the strongest signal) — pass '' / null when anonymous.
 * @param {string|null} [options.userRegion]    Account's chosen region.
 * @param {object|null} [options.geolocation]   Optional granted GPS
 *   signal { value, confidence, accuracy } — the caller must only pass
 *   it when the user already granted permission.
 * @param {boolean} [options.force]             Bypass the cache.
 * @returns {Promise<{ country: string|null, confidence: number,
 *   sources: Array, conflict: object, isDefault: boolean,
 *   fromCache: boolean, timestamp: number, detected_region: string|null }>}
 */
export async function resolveLocationContext(options = {}) {
  const {
    userCountry = '',
    userRegion = '',
    geolocation = null,
    force = false,
  } = options;

  // Fresh cache → reuse (never re-run signals on every render).
  if (!force && locationCache.isFresh()) {
    const cached = locationCache.get();
    return { ...cached, fromCache: true, detected_region: userRegion || null };
  }

  // Collect signals in parallel (GeoIP is the only network call).
  const [geoipSignal, timezoneSignal, localeSignal, networkSignal] = await Promise.all([
    fetchGeoIpSignal(),
    Promise.resolve(getTimezoneSignal()),
    Promise.resolve(getLocaleSignal()),
    Promise.resolve(getNetworkSignal()),
  ]);

  const countrySignals = [
    geoipSignal,
    timezoneSignal,
    // locale + network carry no country value — pass them anyway so
    // the fusion engine can see them (and ignores them for country).
    localeSignal,
    networkSignal,
  ];
  if (geolocation) countrySignals.push(geolocation);
  // The user's own choice is the strongest signal (0.98 weight) — but
  // it expresses identity/region preference, NOT necessarily current
  // physical location. The fusion engine handles that distinction.
  if (userCountry) {
    countrySignals.push({ source: 'user_profile', value: userCountry, confidence: 0.98 });
  }

  const fused = fuseCountrySignals(countrySignals);
  const result = {
    ...fused,
    fromCache: false,
    timestamp: Date.now(),
    detected_region: userRegion || null,
  };

  // Cache it — the next N renders reuse this without any work.
  locationCache.set({
    country: result.country,
    confidence: result.confidence,
    sources: result.sources,
    conflict: result.conflict,
    isDefault: result.isDefault,
    timestamp: result.timestamp,
  });

  return result;
}

/**
 * Persist the fused estimate to the account (own /api/me/ only).
 * Fire-and-forget: a failure must never break the caller.
 *
 * @param {object|null} authPatch  PATCH function bound to the api
 *   client (e.g. (data) => api.patch('me/', data)) — null when
 *   anonymous.
 * @param {{ country: string|null, detected_region: string|null,
 *           timestamp: number }} estimate
 */
export function persistDetectedLocation(authPatch, estimate) {
  if (!authPatch || !estimate?.country) return;
  try {
    authPatch({
      location_prefs: {
        detected_country: String(estimate.country).toUpperCase(),
        detected_region: estimate.detected_region || '',
        // detected_at is set server-side by the model on save; send a
        // marker so the row records when the estimate was made.
        detected_at: new Date(estimate.timestamp || Date.now()).toISOString(),
      },
    }).catch(() => {});
  } catch (_) { /* never throw */ }
}
