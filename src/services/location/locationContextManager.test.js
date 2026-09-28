/**
 * Unit tests for LocationCache + LocationContextManager (Module 2).
 *
 * Covers:
 *   * LocationCache — fresh vs stale, persistence, clear
 *   * resolveLocationContext — collects signals, fuses, caches
 *   * user_profile (chosen country) is the strongest signal
 *   * locale/network never influence the country
 *   * graceful degradation when GeoIP fails
 *   * fresh cache → no re-fetch (no unnecessary network calls)
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { createLocationCache, DEFAULT_FRESH_MS, DEFAULT_STALE_MS } from './locationCache';

// Mock the GeoIP network call + the timezone so the manager tests are
// deterministic (the live test-runner timezone is unknown) and never
// hit the network.
vi.mock('./geoIpService', () => ({
  fetchGeoIpSignal: vi.fn(),
}));
vi.mock('./timezoneService', () => ({
  getTimezoneSignal: vi.fn(),
}));

describe('LocationCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty and returns null', () => {
    const cache = createLocationCache();
    expect(cache.get()).toBeNull();
    expect(cache.isFresh()).toBe(false);
    expect(cache.isStale()).toBe(false);
  });

  it('stores and reloads from localStorage', () => {
    const cache = createLocationCache();
    const value = { country: 'HT', confidence: 0.9, sources: [], timestamp: Date.now() };
    cache.set(value);
    expect(cache.get()).toMatchObject({ country: 'HT' });
    // A second instance reads the persisted value.
    const cache2 = createLocationCache();
    expect(cache2.get()).toMatchObject({ country: 'HT' });
  });

  it('a fresh entry is fresh and not stale', () => {
    const cache = createLocationCache();
    cache.set({ country: 'HT', timestamp: Date.now() });
    expect(cache.isFresh()).toBe(true);
    expect(cache.isStale()).toBe(false);
  });

  it('an old entry is stale (needs background refresh)', () => {
    const cache = createLocationCache();
    cache.set({ country: 'HT', timestamp: Date.now() - DEFAULT_STALE_MS - 1000 });
    expect(cache.isFresh()).toBe(false);
    expect(cache.isStale()).toBe(true);
  });

  it('clear() removes both memory and persistence', () => {
    const cache = createLocationCache();
    cache.set({ country: 'HT', timestamp: Date.now() });
    cache.clear();
    expect(cache.get()).toBeNull();
    expect(localStorage.getItem('atelnyo_location_context')).toBeNull();
  });

  it('ignores corrupted localStorage payloads', () => {
    localStorage.setItem('atelnyo_location_context', '{not json');
    const cache = createLocationCache();
    expect(cache.get()).toBeNull();
  });
});

describe('resolveLocationContext', () => {
  let manager;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    manager = await import('./locationContextManager');
    const { fetchGeoIpSignal } = await import('./geoIpService');
    const { getTimezoneSignal } = await import('./timezoneService');
    fetchGeoIpSignal.mockResolvedValue({
      source: 'geoip', value: 'HT', confidence: 0.8,
      availability: 'available', suggested_lang: 'ht',
      diaspora_hint: false, flags: {}, timestamp: Date.now(),
    });
    getTimezoneSignal.mockReturnValue({
      source: 'timezone', value: 'HT', confidence: 0.7,
      availability: 'available', matched: true, timestamp: Date.now(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fuses GeoIP + timezone into a country with confidence', async () => {
    const res = await manager.resolveLocationContext({});
    expect(res.country).toBe('HT');
    expect(res.confidence).toBeGreaterThan(0);
    expect(res.sources.some((s) => s.source === 'geoip')).toBe(true);
    expect(res.fromCache).toBe(false);
  });

  it('the account-chosen country (user_profile) is the strongest signal', async () => {
    // GeoIP says DO, but the user explicitly chose HT.
    const { fetchGeoIpSignal } = await import('./geoIpService');
    fetchGeoIpSignal.mockResolvedValue({
      source: 'geoip', value: 'DO', confidence: 0.8,
      availability: 'available', suggested_lang: 'es',
      diaspora_hint: false, flags: {}, timestamp: Date.now(),
    });
    const res = await manager.resolveLocationContext({ userCountry: 'HT', userRegion: 'Port-au-Prince' });
    expect(res.country).toBe('HT');
    // user_profile (0.98) dominates the fused result even though the
    // timezone (0.7) and penalized GeoIP (0.8 → conflict) are weaker.
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('a granted geolocation signal participates in fusion', async () => {
    const res = await manager.resolveLocationContext({
      geolocation: { source: 'geolocation', value: 'HT', confidence: 0.95, accuracy: 50 },
    });
    expect(res.sources.some((s) => s.source === 'geolocation')).toBe(true);
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  it('never lets locale/network votes influence the country', async () => {
    // GeoIP says HT; the browser language (fr-FR) has no country vote.
    const res = await manager.resolveLocationContext({});
    expect(res.country).toBe('HT');
    // locale/network never appear as country votes.
    expect(res.sources.some((s) => s.source === 'locale')).toBe(false);
    expect(res.sources.some((s) => s.source === 'network')).toBe(false);
  });

  it('degrades gracefully when GeoIP fails (network down)', async () => {
    const { fetchGeoIpSignal } = await import('./geoIpService');
    fetchGeoIpSignal.mockResolvedValue({
      source: 'geoip', value: null, confidence: 0,
      availability: 'unavailable', suggested_lang: null,
      diaspora_hint: false, flags: {}, timestamp: Date.now(),
    });
    // GeoIP unavailable but timezone says HT → HT still resolves.
    const res = await manager.resolveLocationContext({});
    expect(res).toBeTruthy();
    expect(res.country).toBe('HT');
    expect(res.fromCache).toBe(false);
  });

  it('a fresh cache avoids the network call entirely', async () => {
    await manager.resolveLocationContext({});
    const { fetchGeoIpSignal } = await import('./geoIpService');
    fetchGeoIpSignal.mockClear();
    // Second resolve within freshness window → cache hit, no fetch.
    const res = await manager.resolveLocationContext({});
    expect(res.fromCache).toBe(true);
    expect(fetchGeoIpSignal).not.toHaveBeenCalled();
  });

  it('force bypasses the cache', async () => {
    await manager.resolveLocationContext({});
    const { fetchGeoIpSignal } = await import('./geoIpService');
    fetchGeoIpSignal.mockClear();
    const res = await manager.resolveLocationContext({ force: true });
    expect(res.fromCache).toBe(false);
    expect(fetchGeoIpSignal).toHaveBeenCalledTimes(1);
  });
});
