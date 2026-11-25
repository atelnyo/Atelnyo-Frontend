import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({
  studioService: { overview: vi.fn() },
}));

import { studioService } from '../../services/api';
import {
  refreshOverview, resetOverviewCache, subscribeOverview,
} from './studioOverview';

const PAYLOAD = {
  content: { courses: { total: 2, published: 1, draft: 1 } },
  commerce: { orders: { total: 3, pending: 2 } },
};

describe('studioOverview store', () => {
  beforeEach(() => {
    resetOverviewCache();
    vi.clearAllMocks();
  });

  it('collapses concurrent refreshes into one request', async () => {
    let resolve;
    studioService.overview.mockReturnValue(new Promise((r) => { resolve = r; }));

    const a = refreshOverview();
    const b = refreshOverview();
    expect(studioService.overview).toHaveBeenCalledTimes(1);

    resolve({ data: PAYLOAD });
    await Promise.all([a, b]);
  });

  it('notifies every subscriber with the snapshot', async () => {
    studioService.overview.mockResolvedValue({ data: PAYLOAD });
    const first = vi.fn();
    const second = vi.fn();
    subscribeOverview(first);
    subscribeOverview(second);

    await refreshOverview();

    expect(first).toHaveBeenCalledWith(PAYLOAD, null);
    expect(second).toHaveBeenCalledWith(PAYLOAD, null);
  });

  it('keeps the last good snapshot when a refresh fails', async () => {
    studioService.overview.mockResolvedValueOnce({ data: PAYLOAD });
    await refreshOverview();

    const failure = new Error('network down');
    studioService.overview.mockRejectedValueOnce(failure);
    const listener = vi.fn();
    subscribeOverview(listener);

    await refreshOverview();

    // The listener is told about the failure, but the data it receives is
    // still the real workspace, never null/zeros.
    expect(listener).toHaveBeenCalledWith(PAYLOAD, failure);
  });

  it('releases the in-flight promise so the next refresh hits the API', async () => {
    studioService.overview.mockResolvedValue({ data: PAYLOAD });

    await refreshOverview();
    await refreshOverview();

    expect(studioService.overview).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', async () => {
    studioService.overview.mockResolvedValue({ data: PAYLOAD });
    const listener = vi.fn();
    const unsubscribe = subscribeOverview(listener);
    unsubscribe();

    await refreshOverview();

    expect(listener).not.toHaveBeenCalled();
  });
});
