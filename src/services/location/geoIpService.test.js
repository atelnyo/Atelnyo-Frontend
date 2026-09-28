/**
 * src/services/location/geoIpService.test.js
 *
 * Unit tests for the geoip signal wrapper. Verifies:
 *   • provider flags (vpn/proxy/tor/hosting) from /api/geo/hint/
 *     flow into the signal so the confidence engine can penalize
 *     datacenter IPs (spec §14)
 *   • the wrapper NEVER fails (non-200, network error, missing
 *     fields → "unavailable" signal, never a throw)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the API module so importing geoIpService doesn't pull in the
// axios/Supabase/firebase stack.
vi.mock('../api', () => ({ API_URL: 'https://api.test/api/' }));

import { fetchGeoIpSignal } from './geoIpService';

function jsonResponse(payload, ok = true) {
  return { ok, json: async () => payload };
}

describe('fetchGeoIpSignal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes provider flags through to the signal', async () => {
    window.fetch = vi.fn().mockResolvedValue(jsonResponse({
      country: 'US',
      suggested_lang: 'en',
      diaspora_hint: true,
      geo_flags: {
        vpn_detected: true,
        proxy_detected: false,
        tor_detected: false,
        hosting_detected: false,
      },
    }));
    const signal = await fetchGeoIpSignal();
    expect(signal.source).toBe('geoip');
    expect(signal.value).toBe('US');
    expect(signal.availability).toBe('available');
    expect(signal.flags.vpn_detected).toBe(true);
    expect(signal.flags.hosting_detected).toBe(false);
  });

  it('defaults flags to {} when the backend omits them', async () => {
    window.fetch = vi.fn().mockResolvedValue(jsonResponse({
      country: 'HT',
      suggested_lang: 'ht',
    }));
    const signal = await fetchGeoIpSignal();
    expect(signal.value).toBe('HT');
    expect(signal.flags).toEqual({});
  });

  it('uppercases the country code', async () => {
    window.fetch = vi.fn().mockResolvedValue(jsonResponse({ country: 'do' }));
    const signal = await fetchGeoIpSignal();
    expect(signal.value).toBe('DO');
  });

  it('returns an unavailable signal on a non-200', async () => {
    window.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const signal = await fetchGeoIpSignal();
    expect(signal.value).toBeNull();
    expect(signal.availability).toBe('unavailable');
    expect(signal.flags).toEqual({});
  });

  it('never throws on a network error', async () => {
    window.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const signal = await fetchGeoIpSignal();
    expect(signal.value).toBeNull();
    expect(signal.availability).toBe('unavailable');
    expect(signal.flags).toEqual({});
  });

  it('handles a null country (no signal) without throwing', async () => {
    window.fetch = vi.fn().mockResolvedValue(jsonResponse({
      country: null,
      suggested_lang: 'ht',
      is_default: true,
    }));
    const signal = await fetchGeoIpSignal();
    expect(signal.value).toBeNull();
    expect(signal.availability).toBe('unavailable');
  });
});
