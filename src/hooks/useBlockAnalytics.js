/**
 * useBlockAnalytics — §45 Block Analytics Foundation
 *
 * Do not build invasive analytics. However, maintain architecture
 * that could later support aggregated learning insights.
 *
 * Possible future metrics:
 *   - Block completion rate
 *   - Activity difficulty
 *   - Common incorrect answers
 *   - Drop-off points
 *
 * §45 — "Do not collect unnecessary private content.
 * Student answers and private workspace data require stronger privacy consideration."
 *
 * This hook tracks:
 *   - Block view (rendered)
 *   - Block start (first interaction)
 *   - Block complete (finished)
 *   - Block time (duration)
 *   - Attempt count
 *
 * All data is stored locally and batch-sent to the server.
 * No student answer content is sent — only metadata.
 */
import { useCallback, useEffect, useRef } from 'react';

/**
 * useBlockAnalytics
 *
 * @param {Object} opts
 * @param {string} opts.blockId — block identifier
 * @param {string} opts.blockType — block type key
 * @param {string} opts.courseId — course identifier
 * @param {number} opts.moduleIndex — module index
 * @param {Function} [opts.onEvent] — optional callback for analytics events
 *
 * @returns {{ trackView, trackStart, trackComplete, trackAttempt }}
 */
export default function useBlockAnalytics({
  blockId,
  blockType,
  courseId,
  moduleIndex,
  onEvent,
}) {
  const startTimeRef = useRef(null);
  const hasTrackedView = useRef(false);
  const hasTrackedStart = useRef(false);

  // §45 — Track block view (rendered)
  const trackView = useCallback(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    startTimeRef.current = Date.now();

    const event = {
      type: 'block_view',
      blockId,
      blockType,
      courseId,
      moduleIndex,
      timestamp: Date.now(),
    };

    onEvent?.(event);
    // Store locally for batch sending
    try {
      const key = 'atelnyo_analytics';
      const raw = localStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(event);
      // Keep only last 100 events
      if (queue.length > 100) queue.splice(0, queue.length - 100);
      localStorage.setItem(key, JSON.stringify(queue));
    } catch { /* storage unavailable */ }
  }, [blockId, blockType, courseId, moduleIndex, onEvent]);

  // §45 — Track block start (first interaction)
  const trackStart = useCallback(() => {
    if (hasTrackedStart.current) return;
    hasTrackedStart.current = true;

    const event = {
      type: 'block_start',
      blockId,
      blockType,
      courseId,
      moduleIndex,
      timestamp: Date.now(),
    };

    onEvent?.(event);
    try {
      const key = 'atelnyo_analytics';
      const raw = localStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(event);
      if (queue.length > 100) queue.splice(0, queue.length - 100);
      localStorage.setItem(key, JSON.stringify(queue));
    } catch { /* storage unavailable */ }
  }, [blockId, blockType, courseId, moduleIndex, onEvent]);

  // §45 — Track block complete (finished)
  const trackComplete = useCallback((result = {}) => {
    const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;

    const event = {
      type: 'block_complete',
      blockId,
      blockType,
      courseId,
      moduleIndex,
      timestamp: Date.now(),
      duration, // seconds
      score: result.score,
      correct: result.correct,
      attempts: result.attempts,
    };

    onEvent?.(event);
    try {
      const key = 'atelnyo_analytics';
      const raw = localStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(event);
      if (queue.length > 100) queue.splice(0, queue.length - 100);
      localStorage.setItem(key, JSON.stringify(queue));
    } catch { /* storage unavailable */ }
  }, [blockId, blockType, courseId, moduleIndex, onEvent]);

  // §45 — Track attempt (for question blocks)
  const trackAttempt = useCallback((result = {}) => {
    const event = {
      type: 'block_attempt',
      blockId,
      blockType,
      courseId,
      moduleIndex,
      timestamp: Date.now(),
      correct: result.correct,
      attemptNumber: result.attempts,
    };

    onEvent?.(event);
    try {
      const key = 'atelnyo_analytics';
      const raw = localStorage.getItem(key);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(event);
      if (queue.length > 100) queue.splice(0, queue.length - 100);
      localStorage.setItem(key, JSON.stringify(queue));
    } catch { /* storage unavailable */ }
  }, [blockId, blockType, courseId, moduleIndex, onEvent]);

  // Auto-track view on mount
  useEffect(() => {
    trackView();
  }, [trackView]);

  return {
    trackView,
    trackStart,
    trackComplete,
    trackAttempt,
  };
}
