/**
 * useAnchorScroll — watches `window.location.hash` and smooth-scrolls
 * to the first element whose `id` matches.  Works for both initial-load
 * hashes and in-app hash changes (chip clicks, footer links, etc.).
 *
 * Usage:
 *   useAnchorScroll();                         // call once in App or Explore
 *   <section id="explore-courses">…</section>  // target
 *   <a href="#explore-courses">Kou</a>         // trigger
 */
import { useEffect, useRef } from 'react';

const HEADER_OFFSET = 80; // px below sticky header

export default function useAnchorScroll() {
  const timeoutRef = useRef(null);
  const observerRef = useRef(null);

  const scrollToHash = () => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const id = hash.slice(1); // strip leading '#'
    const el = document.getElementById(id);
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  // Retry scrolling when a new element appears (lazy-loaded sections)
  const startRetrying = (id) => {
    stopRetrying();
    let attempts = 0;
    const maxAttempts = 20; // 20 × 250ms = 5s max
    const check = () => {
      const el = document.getElementById(id);
      if (el) {
        scrollToHash();
        return;
      }
      attempts++;
      if (attempts < maxAttempts) {
        timeoutRef.current = setTimeout(check, 250);
      }
    };
    timeoutRef.current = setTimeout(check, 250);
  };

  const stopRetrying = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.length >= 2) {
      const id = hash.slice(1);
      // Immediate attempt
      scrollToHash();
      // If element not found yet (lazy-loaded), retry with polling + observer
      if (!document.getElementById(id)) {
        startRetrying(id);
        // Also watch for the element to appear via MutationObserver
        observerRef.current = new MutationObserver(() => {
          if (document.getElementById(id)) {
            scrollToHash();
            observerRef.current?.disconnect();
          }
        });
        observerRef.current.observe(document.body, { childList: true, subtree: true });
      }
    }

    const handler = () => {
      const h = window.location.hash;
      if (h && h.length >= 2) {
        const id = h.slice(1);
        scrollToHash();
        if (!document.getElementById(id)) {
          startRetrying(id);
        }
      }
    };
    window.addEventListener('hashchange', handler);
    return () => {
      stopRetrying();
      observerRef.current?.disconnect();
      window.removeEventListener('hashchange', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
