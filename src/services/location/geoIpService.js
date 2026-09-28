/**
 * src/services/location/geoIpService.js
 *
 * GeoIPService — server-side IP geolocation (Signal 1).
 *
 * Wraps the existing anonymous backend endpoint GET /api/geo/hint/
 * (api/views/geo.py), which resolves the client IP through the
 * trusted-proxy chain against ipwho.is (primary) with a MaxMind
 * offline fast-path. The backend deliberately does NOT echo the raw
 * IP back — it returns only the derived country code + language hint
 * + IP-reputation flags (geo_flags). This service just turns that
 * into a fusion-ready signal object.
 *
 * Contract:
 *   * NEVER fails — network errors, non-200s and missing fields all
 *     resolve to an "unavailable" signal so the fusion engine falls
 *     back to the next signal instead of crashing.
 *   * The response is cached by the LocationCache; this module makes
 *     at most ONE network call per resolve() call.
 *
 * `flags` carries the provider's VPN/proxy/tor/hosting awareness so
 * ConfidenceEngine.adjustGeoIpConfidence can penalize datacenter IPs
 * (spec §14 — IP reputation).
 */

import { API_URL } from '../api';

/**
 * @returns {Promise<{ source: string, value: string|null,
 *   confidence: number, availability: string,
 *   suggested_lang: string|null, diaspora_hint: boolean,
 *   flags: object, timestamp: number }>}
 */
export async function fetchGeoIpSignal() {
  try {
    const res = await window.fetch(`${API_URL}geo/hint/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        source: 'geoip', value: null, confidence: 0,
        availability: 'unavailable', suggested_lang: null,
        diaspora_hint: false, flags: {}, timestamp: Date.now(),
      };
    }
    const data = await res.json();
    const country = data?.country ? String(data.country).toUpperCase() : null;
    return {
      source: 'geoip',
      value: country,
      // Server lookups are strong (0.8 base); VPN/proxy/hosting flags
      // from the provider adjust it via ConfidenceEngine (spec §14).
      confidence: country ? 0.8 : 0,
      availability: country ? 'available' : 'unavailable',
      suggested_lang: data?.suggested_lang || null,
      diaspora_hint: data?.diaspora_hint === true,
      // IP-reputation flags (vpn_detected / proxy_detected /
      // tor_detected / hosting_detected) — consumed by
      // normalizeCountrySignal → adjustGeoIpConfidence.
      flags: (data?.geo_flags && typeof data.geo_flags === 'object')
        ? data.geo_flags
        : {},
      timestamp: Date.now(),
    };
  } catch (_) {
    return {
      source: 'geoip', value: null, confidence: 0,
      availability: 'unavailable', suggested_lang: null,
      diaspora_hint: false, flags: {}, timestamp: Date.now(),
    };
  }
}
