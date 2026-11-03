/**
 * useLatestFeedRefresh.test.js — Phase 4 regression guard for hybrid refresh
 * over GET /api/feed/latest/.
 *
 * Pins: manual refresh replaces the first page; refresh failure keeps
 * visible items; arrival checks never touch the list; apply prepends the
 * already-fetched pill items; dismiss suppresses re-surfacing; filter
 * switch clears the pill; no new content means no pill.
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

describe('useLatestFeed hybrid refresh', () => {
  beforeEach(() => {
    feedServiceMock.latest.mockReset();
  });

  it('manual refresh replaces the first page with the fresh eligible page', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockResolvedValueOnce(page([7, 8], 'cursor-7'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      result.current.refresh();
    });
    expect(result.current.status).toBe('refreshing');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(feedServiceMock.latest).toHaveBeenLastCalledWith(12, null, null);
    expect(result.current.items.map((i) => i.object_id)).toEqual([7, 8]);
  });

  it('refresh failure keeps visible items and offers retry', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(page([7, 8], 'cursor-7'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items.map((i) => i.object_id)).toEqual([7, 8]);
  });

  it('arrival check counts unseen items without touching the list', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockResolvedValueOnce(page([9, 2, 1], 'cursor-9'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.checkForNew();
    });
    expect(result.current.newCount).toBe(1);
    // List untouched — reading position never jumps.
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
    expect(result.current.status).toBe('ready');
  });

  it('applying the pill prepends fetched items; loadMore continues cleanly', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockResolvedValueOnce(page([9, 1], 'cursor-9'))
      .mockResolvedValueOnce(page([3], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.checkForNew();
    });
    act(() => {
      result.current.applyNew();
    });
    expect(result.current.items.map((i) => i.object_id)).toEqual([9, 1, 2]);
    expect(result.current.newCount).toBe(0);
    act(() => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.status).toBe('end'));
    expect(result.current.items.map((i) => i.object_id)).toEqual([9, 1, 2, 3]);
  });

  it('dismissing the pill suppresses those ids until a manual refresh', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1], 'cursor-1'))
      .mockResolvedValueOnce(page([9, 1], 'cursor-9'))
      .mockResolvedValueOnce(page([9, 1], 'cursor-9'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.checkForNew();
    });
    expect(result.current.newCount).toBe(1);
    act(() => {
      result.current.dismissNew();
    });
    expect(result.current.newCount).toBe(0);
    expect(result.current.items.map((i) => i.object_id)).toEqual([1]);
    await act(async () => {
      await result.current.checkForNew();
    });
    expect(result.current.newCount).toBe(0);
  });

  it('no new content means no pill and an untouched list', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], null))
      .mockResolvedValueOnce(page([1, 2], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('end'));
    await act(async () => {
      await result.current.checkForNew();
    });
    expect(result.current.newCount).toBe(0);
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
  });

  it('concurrent arrival checks collapse into one request', async () => {
    let releaseCheck;
    const gate = new Promise((resolve) => {
      releaseCheck = resolve;
    });
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1], 'cursor-1'))
      .mockReturnValueOnce(gate);
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let first;
    let second;
    act(() => {
      first = result.current.checkForNew();
      second = result.current.checkForNew();
    });
    // Second call collapses into the in-flight check: still one request.
    expect(feedServiceMock.latest).toHaveBeenCalledTimes(2); // initial + one check
    await act(async () => {
      releaseCheck(page([9, 1], 'cursor-9'));
      await first;
      await second;
    });
    expect(result.current.newCount).toBe(1);
    expect(feedServiceMock.latest).toHaveBeenCalledTimes(2);
  });

  it('switching category clears the pill and resets from page one', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1], 'cursor-1'))
      .mockResolvedValueOnce(page([9, 1], 'cursor-9'))
      .mockResolvedValueOnce(page([5], null));
    const mod = await freshHook();
    const { result, rerender } = renderHook(({ contentType }) => mod.default({ contentType }), {
      initialProps: { contentType: null },
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.checkForNew();
    });
    expect(result.current.newCount).toBe(1);
    rerender({ contentType: 'course' });
    await waitFor(() => expect(result.current.status).toBe('end'));
    expect(result.current.newCount).toBe(0);
    expect(result.current.items.map((i) => i.object_id)).toEqual([5]);
  });
});
