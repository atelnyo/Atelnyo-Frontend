/**
 * useLatestFeed.test.js — Phase 3 regression guard for progressive loading
 * over GET /api/feed/latest/ (cursor pagination).
 *
 * Pins: initial batch, append-without-replace, cross-page dedupe,
 * end-of-feed stop, failure without auto-retry loop, retry of the same
 * page, outdated-response drop on filter change, and invalid-cursor
 * error surfacing.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const feedServiceMock = {
  latest: vi.fn(),
};

vi.mock('../../../services/api', () => ({
  feedService: feedServiceMock,
}));

async function freshHook() {
  vi.resetModules();
  return import('./useLatestFeed');
}

const page = (ids, nextCursor) => ({
  data: {
    results: ids.map((id) => ({
      content_type: 'post',
      object_id: id,
      published_at: '2026-01-01T00:00:00Z',
      distribution: 'normal',
      preview: { id, type: 'post', title: `Post ${id}` },
    })),
    next_cursor: nextCursor,
    has_more: Boolean(nextCursor),
  },
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useLatestFeed', () => {
  beforeEach(() => {
    feedServiceMock.latest.mockReset();
  });

  it('loads the first batch on mount with limit, no cursor', async () => {
    feedServiceMock.latest.mockResolvedValueOnce(page([1, 2], 'cursor-1'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({ limit: 12 }));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(feedServiceMock.latest).toHaveBeenCalledWith(12, null, null);
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page without replacing and dedupes repeats', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockResolvedValueOnce(page([2, 3], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.status).toBe('end'));
    expect(feedServiceMock.latest).toHaveBeenLastCalledWith(12, 'cursor-1', null);
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2, 3]);
  });

  it('stops at the end: loadMore fires no further request', async () => {
    feedServiceMock.latest.mockResolvedValueOnce(page([1], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('end'));
    expect(result.current.isEnd).toBe(true);
    act(() => {
      result.current.loadMore();
    });
    expect(feedServiceMock.latest).toHaveBeenCalledTimes(1);
  });

  it('reports an empty feed distinctly from an error', async () => {
    feedServiceMock.latest.mockResolvedValueOnce(page([], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('keeps visible items on page failure and never retries in a loop', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockRejectedValueOnce(new Error('Network Error'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    // Items stay on screen with a retry affordance; no auto-retry.
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
    expect(feedServiceMock.latest).toHaveBeenCalledTimes(2);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(feedServiceMock.latest).toHaveBeenCalledTimes(2);
  });

  it('retry re-requests the same failed page', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1], 'cursor-1'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page([2], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('end'));
    expect(feedServiceMock.latest).toHaveBeenCalledTimes(3);
    expect(feedServiceMock.latest).toHaveBeenNthCalledWith(3, 12, 'cursor-1', null);
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
  });

  it('drops an outdated response after the filter changes', async () => {
    const slow = deferred();
    const fast = deferred();
    feedServiceMock.latest
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise);
    const mod = await freshHook();
    const { result, rerender } = renderHook(({ contentType }) => mod.default({ contentType }), {
      initialProps: { contentType: null },
    });
    fast.resolve(page([9], null));
    rerender({ contentType: 'course' });
    await waitFor(() => expect(feedServiceMock.latest).toHaveBeenCalledTimes(2));
    // The first (slow, stale-filter) response lands last — must be ignored.
    slow.resolve(page([1], null));
    await act(async () => {
      await slow.promise.catch(() => {});
      await fast.promise.catch(() => {});
    });
    expect(result.current.items.map((i) => i.object_id)).toEqual([9]);
    expect(feedServiceMock.latest).toHaveBeenNthCalledWith(2, 12, null, 'course');
  });

  it('surfaces an invalid-cursor 400 as a retryable error', async () => {
    const err = { response: { data: { detail: 'Invalid cursor.' } } };
    feedServiceMock.latest.mockRejectedValueOnce(err);
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Invalid cursor.');
    expect(result.current.items).toEqual([]);
  });

  it('sentinelRef is a safe no-op without IntersectionObserver', async () => {
    feedServiceMock.latest.mockResolvedValueOnce(page([1], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('end'));
    expect(() => result.current.sentinelRef(null)).not.toThrow();
  });
});
