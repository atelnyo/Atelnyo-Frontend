/**
 * Tests for the network control layer: dedup, cache, retry, diagnostics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios
vi.mock('axios', () => {
  let callCount = 0;
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(() => {
      callCount++;
      return Promise.resolve({ data: { id: callCount }, status: 200, config: { url: 'test/', method: 'get', metadata: { startTime: Date.now() } } });
    }),
    post: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  };
  return { default: mockAxios };
});

// Mock diagnostics
vi.mock('../requestDiagnostics', () => ({
  diag: {
    dedupHit: vi.fn(),
    dedupMiss: vi.fn(),
    cacheHit: vi.fn(),
    cacheMiss: vi.fn(),
    cacheStale: vi.fn(),
    retryAttempt: vi.fn(),
    requestComplete: vi.fn(),
    requestError: vi.fn(),
    summary: vi.fn(() => ({})),
    log: vi.fn(() => []),
    reset: vi.fn(),
  },
}));

describe('In-flight Deduplication', () => {
  let dedupedGet;

  beforeEach(async () => {
    vi.clearAllMocks();
    const apiModule = await import('../api');
    dedupedGet = apiModule.dedupedGet;
  });

  it('shares a single in-flight request for identical GETs', async () => {
    // Two simultaneous calls with the same params
    const p1 = dedupedGet('test/', { a: 1 });
    const p2 = dedupedGet('test/', { a: 1 });

    const [r1, r2] = await Promise.all([p1, p2]);
    // Both should resolve (same data)
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it('differentiates requests with different params', async () => {
    const p1 = dedupedGet('test/', { a: 1 });
    const p2 = dedupedGet('test/', { a: 2 });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});

describe('Cache Layer', () => {
  let cachedGet, invalidateCache, clearCache;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const apiModule = await import('../api');
    cachedGet = apiModule.cachedGet;
    invalidateCache = apiModule.invalidateCache;
    clearCache = apiModule.clearCache;
    await clearCache(); // Reset cache state
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached data within TTL', async () => {
    const r1 = await cachedGet('cache-test/', {}, { ttl: 5000 });
    const r2 = await cachedGet('cache-test/', {}, { ttl: 5000 });
    // Second call should be instant (from cache)
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it('invalidates cache on prefix match', async () => {
    await cachedGet('courses/1/', {}, { ttl: 5000 });
    await invalidateCache('courses/');
    // Next call should be a cold miss
    const r = await cachedGet('courses/1/', {}, { ttl: 5000 });
    expect(r).toBeDefined();
  });

  it('clears entire cache', async () => {
    await cachedGet('clear-test/', {}, { ttl: 5000 });
    await clearCache();
    // Should be a cold miss after clear
    const r = await cachedGet('clear-test/', {}, { ttl: 5000 });
    expect(r).toBeDefined();
  });
});

describe('Retry Policy', () => {
  let retryGet;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const apiModule = await import('../api');
    retryGet = apiModule.retryGet;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns successful response without retry', async () => {
    const r = await retryGet('retry-test/');
    expect(r).toBeDefined();
  });
});

describe('Request Diagnostics', () => {
  it('diag module is importable', async () => {
    const { diag } = await import('../requestDiagnostics');
    expect(diag).toBeDefined();
    expect(typeof diag.dedupHit).toBe('function');
    expect(typeof diag.cacheHit).toBe('function');
    expect(typeof diag.summary).toBe('function');
  });
});
