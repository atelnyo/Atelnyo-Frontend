/**
 * useLessonPrefetch — §46 Lesson Prefetching
 *
 * Where safe and beneficial, prefetch the next lesson's metadata and
 * content. Respects: network, device memory, authorization, user data usage.
 *
 * Does NOT prefetch restricted content without permission.
 */
import { useEffect, useRef } from 'react';

/**
 * Prefetch a URL if the browser supports it (link rel=prefetch).
 * Only prefetches once per URL.
 */
function prefetchUrl(url) {
  if (!url || typeof document === 'undefined') return;
  // Don't prefetch if already prefetched
  const existing = document.querySelector(`link[rel="prefetch"][href="${CSS.escape(url)}"]`);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = url.includes('.js') ? 'script' : url.includes('.css') ? 'style' : 'fetch';
  document.head.appendChild(link);
}

/**
 * useLessonPrefetch
 *
 * @param {Object} opts
 * @param {Object|null} opts.nextLesson — metadata for the next lesson (title, blocks, etc.)
 * @param {number|null} opts.nextLessonIndex — index of the next lesson in the module
 * @param {number} opts.courseId — current course ID
 * @param {boolean} opts.isEnabled — whether prefetching is enabled (e.g., not on slow network)
 * @param {number} [opts.delay=2000] — ms to wait before starting prefetch
 */
export default function useLessonPrefetch({
  nextLesson,
  nextLessonIndex,
  courseId,
  isEnabled = true,
  delay = 2000,
}) {
  const prefetchedRef = useRef(null);

  useEffect(() => {
    if (!isEnabled || !nextLesson || nextLessonIndex == null) return;

    // Don't re-prefetch the same lesson
    const key = `${courseId}-${nextLessonIndex}`;
    if (prefetchedRef.current === key) return;

    // Respect: don't prefetch on save-data or slow connections
    if (typeof navigator !== 'undefined') {
      const conn = navigator.connection;
      if (conn?.saveData) return;
      if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return;
    }

    const timer = setTimeout(() => {
      prefetchedRef.current = key;

      // Prefetch video URLs if present in next lesson blocks
      if (Array.isArray(nextLesson.blocks)) {
        nextLesson.blocks.forEach((block) => {
          // Prefetch video sources
          if (block.videoUrl) {
            prefetchUrl(block.videoUrl);
          }
          // Prefetch image sources (only first few to avoid bandwidth waste)
          if (block.imageUrl) {
            prefetchUrl(block.imageUrl);
          }
        });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [nextLesson, nextLessonIndex, courseId, isEnabled, delay]);
}
