/**
 * useLatestFeedPosition.test.js — Phase 5 guard: stable keys (never the
 * render index) and chainable actions for scroll work.
 *
 * Pins: `latestKey` stability + identity semantics, `applyNew` returns
 * the applied count, `firstKey` tracks the list head, and
 * refresh/loadMore return promises (manual refresh scrolls to top on
 * success; pill apply uses the feedScroll anchor instead).
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
  const mod = await import('./useLatestFeed');
  return mod;
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

describe('latestKey', () => {
  it('is stable for the same item and never the render index', async () => {
    const mod = await freshHook();
    const item = { content_type: 'post', object_id: 7 };
    expect(mod.latestKey(item)).toBe(mod.latestKey({ ...item }));
    expect(mod.latestKey(item)).toBe('post:7');
  });

  it('distinguishes records with identical display titles', async () => {
    const mod = await freshHook();
    const a = { content_type: 'post', object_id: 1, preview: { title: 'Bonjou' } };
    const b = { content_type: 'post', object_id: 2, preview: { title: 'Bonjou' } };
    expect(mod.latestKey(a)).not.toBe(mod.latestKey(b));
  });

  it('returns null when no stable identity exists', async () => {
    const mod = await freshHook();
    expect(mod.latestKey({})).toBeNull();
    expect(mod.latestKey({ content_type: 'post', object_id: null })).toBeNull();
    expect(mod.latestKey(null)).toBeNull();
  });
});

describe('position-chainable actions', () => {
  beforeEach(() => {
    feedServiceMock.latest.mockReset();
  });

  it('applyNew returns the prepended count and firstKey tracks the head', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1, 2], 'cursor-1'))
      .mockResolvedValueOnce(page([9, 1], 'cursor-9'));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.firstKey).toBe('post:1');
    let applied = 0;
    await act(async () => {
      await result.current.checkForNew();
    });
    act(() => {
      applied = result.current.applyNew();
    });
    expect(applied).toBe(1);
    expect(result.current.firstKey).toBe('post:9');
  });

  it('refresh and loadMore return promises for scroll chaining', async () => {
    feedServiceMock.latest
      .mockResolvedValueOnce(page([1], 'cursor-1'))
      .mockResolvedValueOnce(page([2], 'cursor-2'))
      .mockResolvedValueOnce(page([7], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let chained = false;
    await act(async () => {
      await result.current.loadMore().then(() => {
        chained = true;
      });
    });
    expect(chained).toBe(true);
    expect(result.current.items.map((i) => i.object_id)).toEqual([1, 2]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.items.map((i) => i.object_id)).toEqual([7]);
  });

  it('firstKey is null on an empty list', async () => {
    feedServiceMock.latest.mockResolvedValueOnce(page([], null));
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({}));
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.firstKey).toBeNull();
  });
});
