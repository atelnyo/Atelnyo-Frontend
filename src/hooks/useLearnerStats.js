/**
 * src/hooks/useLearnerStats.js — Duolingo-style learner gamification state.
 *
 * Fetches GET /api/learning/stats/ once per authenticated mount and
 * exposes helpers the FE uses to celebrate live:
 *
 *   • applyGamification(g) — merge a ``gamification`` payload echoed by
 *     ANY completion endpoint (progress complete_block, quiz attempt,
 *     review complete) into the local stats so the header chips update
 *     instantly without a refetch.
 *   • refillHearts() / updateGoal(goal) — thin wrappers that apply the
 *     returned stats too.
 *
 * Never throws; a failed stats fetch leaves stats null (chips simply
 * don't render) and the learning flow is unaffected.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { gamificationService } from '../services/api';

export default function useLearnerStats({ user, enabled = true } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const fetchedFor = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(() => {
    if (!user || !enabled) return Promise.resolve(null);
    setLoading(true);
    return gamificationService.stats()
      .then((res) => {
        const data = res?.data || null;
        if (mounted.current) setStats(data);
        return data;
      })
      .catch(() => null)
      .finally(() => { if (mounted.current) setLoading(false); });
  }, [user, enabled]);

  const applyGamification = useCallback((g) => {
    if (!g || typeof g !== 'object' || !mounted.current) return;
    setStats((prev) => ({ ...(prev || {}), ...g }));
  }, []);

  const refillHearts = useCallback(async () => {
    try {
      const res = await gamificationService.refillHearts();
      const data = res?.data || null;
      if (data) applyGamification(data);
      return data;
    } catch (_) {
      return null;
    }
  }, [applyGamification]);

  const updateGoal = useCallback(async (goal) => {
    try {
      const res = await gamificationService.updateGoal(goal);
      const data = res?.data || null;
      if (data) applyGamification(data);
      return data;
    } catch (_) {
      return null;
    }
  }, [applyGamification]);

  useEffect(() => {
    // Fetch once per authenticated mount (and when a user first appears,
    // e.g. after login) — but never refetch just because a caller passes
    // a fresh `user` object with the same id on re-render.
    const key = user?.id ?? null;
    if (key === fetchedFor.current) return;
    fetchedFor.current = key;
    if (key === null) return;
    // refresh() sets loading synchronously — same convention the
    // Learning Space uses for its boot effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh, user?.id]);

  return { stats, loading, refresh, applyGamification, refillHearts, updateGoal };
}
