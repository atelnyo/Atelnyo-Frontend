/**
 * Unit tests for src/services/api.js — cachedGet, invalidateCache, clearCache.
 *
 * Tests the stale-while-revalidate cache: fresh hits, cold miss,
 * invalidateCache prefix matching, and clearCache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] || null),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

if (typeof window !== 'undefined') {
  window.dispatchEvent = vi.fn();
  window.addEventListener = vi.fn();
  window.removeEventListener = vi.fn();
}

vi.mock('axios', () => {
  const mockGet = vi.fn();
  const instance = {
    get: mockGet,
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  instance.create = vi.fn(() => instance);
  return { default: instance, create: vi.fn(() => instance) };
});

describe('cachedGet', () => {
  let cachedGet, invalidateCache, clearCache, api;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./api');
    api = mod.default;
    cachedGet = mod.cachedGet;
    invalidateCache = mod.invalidateCache;
    clearCache = mod.clearCache;
    await clearCache();
    api.get.mockReset();
  });

  it('returns fresh data on cold miss', async () => {
    const mockData = { data: { results: [{ id: 1 }] } };
    api.get.mockResolvedValue(mockData);

    const result = await cachedGet('courses/', { page: 1 });
    expect(result).toEqual(mockData);
  });

  it('returns cached data on fresh hit (within TTL)', async () => {
    const mockData = { data: { count: 5 } };
    api.get.mockResolvedValue(mockData);

    // First call — populates cache
    await cachedGet('courses/', null, { ttl: 60_000 });
    api.get.mockReset();

    // Second call — should be a cache hit (no API call)
    const result = await cachedGet('courses/', null, { ttl: 60_000 });
    expect(result).toEqual(mockData);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('returns stale data after TTL expires (within dedup window)', async () => {
    const freshData = { data: { count: 10 } };
    api.get.mockResolvedValue(freshData);

    // First call — populates cache with TTL=1ms
    await cachedGet('courses/', null, { ttl: 1 });
    await new Promise((r) => setTimeout(r, 10));

    // Second call — should return stale data (within dedup window)
    const result = await cachedGet('courses/', null, { ttl: 60_000 });
    expect(result).toEqual(freshData);
  });

  it('re-throws errors on cold miss failure', async () => {
    const error = new Error('Network error');
    api.get.mockRejectedValue(error);

    await expect(cachedGet('courses/')).rejects.toThrow('Network error');
  });

  it('handles concurrent cold misses for same key', async () => {
    const mockData = { data: { count: 1 } };
    api.get.mockResolvedValue(mockData);

    const [result1, result2] = await Promise.all([
      cachedGet('courses/'),
      cachedGet('courses/'),
    ]);

    expect(result1).toEqual(mockData);
    expect(result2).toEqual(mockData);
  });

  it('uses different cache keys for different URLs', async () => {
    const data1 = { data: { a: 1 } };
    const data2 = { data: { b: 2 } };
    api.get.mockResolvedValueOnce(data1).mockResolvedValueOnce(data2);

    const result1 = await cachedGet('courses/');
    const result2 = await cachedGet('profiles/');

    expect(result1).toEqual(data1);
    expect(result2).toEqual(data2);
  });
});

describe('invalidateCache', () => {
  let cachedGet, invalidateCache, clearCache, api;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./api');
    api = mod.default;
    cachedGet = mod.cachedGet;
    invalidateCache = mod.invalidateCache;
    clearCache = mod.clearCache;
    await clearCache();
    api.get.mockReset();
  });

  it('removes entries matching URL prefix', async () => {
    api.get.mockResolvedValue({ data: { a: 1 } });
    await cachedGet('courses/');
    await cachedGet('courses/123/');
    await cachedGet('profiles/atelnyo/');

    await invalidateCache('courses/');

    // courses/ should be a cold miss now
    api.get.mockResolvedValue({ data: { b: 2 } });
    await cachedGet('courses/');
    expect(api.get).toHaveBeenCalled();

    api.get.mockReset();
    // profiles/ should still be cached
    const result = await cachedGet('profiles/atelnyo/');
    expect(result.data).toEqual({ a: 1 });
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('clearCache', () => {
  let cachedGet, clearCache, api;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./api');
    api = mod.default;
    cachedGet = mod.cachedGet;
    clearCache = mod.clearCache;
    await clearCache();
    api.get.mockReset();
  });

  it('clears all cached entries', async () => {
    api.get.mockResolvedValue({ data: { a: 1 } });
    await cachedGet('courses/');
    await cachedGet('profiles/');

    await clearCache();

    // Both should be cold misses now
    api.get.mockResolvedValue({ data: { b: 2 } });
    await cachedGet('courses/');
    expect(api.get).toHaveBeenCalled();
  });
});
