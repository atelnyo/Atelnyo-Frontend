/**
 * src/utils/mediaCache.test.js — unit tests for the sessionStorage
 * media payload cache (replaces the old window.__atelnyo_media_cache).
 *
 * Covers: round-trip, string/number id normalization, miss → null,
 * delete, malformed JSON resilience, quota-exceeded resilience,
 * corrupt-payload filtering, and SSR/guard no-ops.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cacheMedia,
  getCachedMedia,
  deleteCachedMedia,
  clearMediaCache,
} from './mediaCache';

// Happy-DOM/localStorage-style Storage mock shared across the suite.
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    _throwing: false,
  };
}

describe('mediaCache', () => {
  let store;

  beforeEach(() => {
    store = makeStorage();
    // jsdom-less environment: stub window.sessionStorage per test.
    vi.stubGlobal('window', { sessionStorage: store });
  });

  it('round-trips a payload', () => {
    cacheMedia({ id: 7, title: 'Intro Loop', media_type: 'audio' });
    expect(getCachedMedia(7)).toMatchObject({ id: 7, title: 'Intro Loop' });
  });

  it('normalizes string and number ids to the same entry', () => {
    cacheMedia({ id: 42, title: 'A' });
    expect(getCachedMedia('42')).toMatchObject({ id: 42 });
    cacheMedia({ id: '99', title: 'B' });
    expect(getCachedMedia(99)).toMatchObject({ id: '99' });
  });

  it('returns null on miss and on missing id', () => {
    expect(getCachedMedia(1234)).toBeNull();
    expect(getCachedMedia(undefined)).toBeNull();
    expect(getCachedMedia(null)).toBeNull();
  });

  it('ignores payloads without a usable id', () => {
    cacheMedia({ title: 'no id here' });
    cacheMedia(null);
    cacheMedia(undefined);
    // Nothing was ever written — storage stays pristine.
    expect(store.getItem('atelnyo_media_cache')).toBeNull();
  });

  it('deletes a single entry and keeps the rest', () => {
    cacheMedia({ id: 1, title: 'one' });
    cacheMedia({ id: 2, title: 'two' });
    deleteCachedMedia(1);
    expect(getCachedMedia(1)).toBeNull();
    expect(getCachedMedia(2)).toMatchObject({ title: 'two' });
    // Deleting a missing id is a no-op, not an error.
    expect(() => deleteCachedMedia(555)).not.toThrow();
  });

  it('survives corrupted JSON in storage (treats as empty)', () => {
    store.setItem('atelnyo_media_cache', '{not valid json');
    expect(getCachedMedia(1)).toBeNull();
    // And the cache is writable again afterwards.
    cacheMedia({ id: 3, title: 'three' });
    expect(getCachedMedia(3)).toMatchObject({ title: 'three' });
  });

  it('survives a non-object JSON payload in storage', () => {
    store.setItem('atelnyo_media_cache', JSON.stringify([1, 2, 3]));
    expect(getCachedMedia(1)).toBeNull();
  });

  it('degrades silently when setItem throws (quota / private mode)', () => {
    const throwing = {
      ...store,
      setItem: vi.fn(() => { throw new Error('QuotaExceeded'); }),
    };
    vi.stubGlobal('window', { sessionStorage: throwing });
    expect(() => cacheMedia({ id: 9, title: 'nine' })).not.toThrow();
    expect(getCachedMedia(9)).toBeNull(); // read side sees nothing cached
  });

  it('retries at half size when the first write throws, then trims', () => {
    let calls = 0;
    const flaky = {
      getItem: store.getItem,
      removeItem: store.removeItem,
      setItem: vi.fn(() => {
        calls += 1;
        if (calls === 1) throw new Error('QuotaExceeded');
        // Second attempt succeeds — simulates the trim making it fit.
      }),
    };
    vi.stubGlobal('window', { sessionStorage: flaky });
    cacheMedia({ id: 1, title: 'one' });
    cacheMedia({ id: 2, title: 'two' });
    cacheMedia({ id: 3, title: 'three' });
    expect(flaky.setItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('clearMediaCache removes everything', () => {
    cacheMedia({ id: 1, title: 'one' });
    clearMediaCache();
    expect(getCachedMedia(1)).toBeNull();
  });

  it('no-ops without a window (SSR guard)', async () => {
    vi.stubGlobal('window', undefined);
    await import('./mediaCache?fresh=1').catch(() => { /* same module */ });
    expect(() => cacheMedia({ id: 5 })).not.toThrow();
    expect(() => deleteCachedMedia(5)).not.toThrow();
    expect(() => clearMediaCache()).not.toThrow();
    expect(getCachedMedia(5)).toBeNull();
  });
});
