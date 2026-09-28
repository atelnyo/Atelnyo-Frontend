/**
 * src/accessibility/hooks/useReducedMotion.js
 *
 * Hook that detects the user's prefers-reduced-motion preference.
 * Returns true when the user has requested reduced motion.
 *
 * Usage:
 *   const prefersReducedMotion = useReducedMotion();
 *   if (prefersReducedMotion) {
 *     // Skip animation, use opacity transition instead
 *   }
 */
import { useState, useEffect } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export default function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!mq) return undefined;

    const handler = (e) => setPrefersReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return prefersReduced;
}
