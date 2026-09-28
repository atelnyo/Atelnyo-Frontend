/**
 * Unit tests for src/hooks/useLearnerStats.js (Duolingo-style
 * gamification state). The gamification service is mocked; the tests
 * pin the fetch-on-mount contract and the applyGamification merge.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const statsFixture = {
  xp: 120, level: 2, daily_streak: 3, hearts: 5, hearts_max: 5,
  daily_xp: 40, daily_goal: 20, level_progress_pct: 20,
};

const serviceMock = {
  stats: vi.fn().mockResolvedValue({ data: statsFixture }),
  updateGoal: vi.fn(),
  refillHearts: vi.fn(),
};

vi.mock('../services/api', () => ({
  gamificationService: serviceMock,
}));

// Fresh import per test so module state doesn't leak.
async function freshHook() {
  vi.resetModules();
  return import('./useLearnerStats');
}

describe('useLearnerStats', () => {
  beforeEach(() => {
    serviceMock.stats.mockClear();
    serviceMock.stats.mockResolvedValue({ data: statsFixture });
  });

  it('fetches stats once on mount when a user is present', async () => {
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({ user: { id: 1 } }));
    expect(serviceMock.stats).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.stats).toEqual(statsFixture));
  });

  it('does not fetch without a user', async () => {
    const mod = await freshHook();
    renderHook(() => mod.default({ user: null }));
    expect(serviceMock.stats).not.toHaveBeenCalled();
  });

  it('applyGamification merges a completion payload into local stats', async () => {
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({ user: { id: 1 } }));
    await waitFor(() => expect(result.current.stats).toBeTruthy());
    act(() => {
      result.current.applyGamification({ xp: 130, xp_awarded: 10, hearts: 4 });
    });
    expect(result.current.stats.xp).toBe(130);
    expect(result.current.stats.hearts).toBe(4);
    // Merge keeps fields the payload didn't touch.
    expect(result.current.stats.daily_streak).toBe(3);
  });

  it('applyGamification ignores null payloads', async () => {
    const mod = await freshHook();
    const { result } = renderHook(() => mod.default({ user: { id: 1 } }));
    await waitFor(() => expect(result.current.stats).toBeTruthy());
    act(() => { result.current.applyGamification(null); });
    expect(result.current.stats.xp).toBe(120);
  });
});
