/**
 * src/components/profile/profileUtils.js
 *
 * Tier-1 leaf — extracted from CreatorPublicProfile.jsx (stage A-1 refactor).
 *
 * Helper functions for the Creator Public Profile:
 *   - fmtCount(n)        — short number formatter (K / M suffixes)
 *   - fmtDate(iso, lang) — locale-aware date string
 *   - useCountUp(target, duration=800) — count-up animation hook
 *
 * STAGE A-1: zero behavior change. Extracted verbatim from monolith.
 * Imports React hooks (useState, useRef, useEffect); React import here
 * is intentional so consumers can just import the helpers directly.
 */

import React, { useEffect, useRef, useState } from 'react';

export function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

export function fmtDate(iso, lang) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(
      lang === 'ht' ? 'fr-HT' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch { return ''; }
}

/**
 * isNewItem — true when an ISO timestamp falls within ``days`` (default 14)
 * of now. Used to stamp a "New" badge on freshly created catalog cards.
 * Invalid/missing timestamps return false.
 */
export function isNewItem(iso, days = 14) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

/**
 * useCountUp — animate from 0 → target over duration (ms) with ease-out-quad.
 *
 * Returns the current animated number. Used by AnimatedStat for stats counters.
 *
 * @param {number|null|undefined} target — final value
 * @param {number} [duration=800] — animation duration in ms
 * @returns {number} current animated value
 */
export function useCountUp(target, duration = 800) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    // Intentional synchronous reset so a zero target snaps to 0 on the
    // first paint — same pattern as App.jsx / ActivityTimeline.jsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target == null || Number(target) <= 0) { setCurrent(0); return; }
    const numTarget = Number(target);
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      // Round to 2 decimals so money stats (e.g. $47.50) land exactly
      // while integer stats stay whole numbers.
      setCurrent(Math.round(eased * numTarget * 100) / 100);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return current;
}
