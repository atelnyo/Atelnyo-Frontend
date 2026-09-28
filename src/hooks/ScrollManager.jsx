/**
 * src/hooks/ScrollManager.jsx
 *
 * The ONE owner of route-level scroll behavior.
 *
 * Problem it fixes (catalog scroll bleed):
 *   • Clicking a card in the scrolled-down catalog navigated to the
 *     detail page, which opened MID-PAGE — the browser carried the
 *     catalog's scrollY into the detail route.
 *   • While reading a detail page, the old per-tab scroll-saver wrote
 *     that page's scrollY into the catalog tab's slot, so returning to
 *     the catalog restored a foreign position ("scrolling down one
 *     surface affects another").
 *
 * Rules (architectural contract):
 *   • SCROLL SURFACES (long list views that must save/restore their
 *     position): the catalog — "/" and "/sheet/explore". Extend this
 *     constant to add more (e.g. a long list dashboard).
 *   • Every OTHER route (detail pages, sheets, forms) ALWAYS starts at
 *     the TOP — a leftover catalog scroll must never open a detail
 *     mid-page.
 *   • Returning to a scroll surface restores its saved position.
 *
 * Positions persist through the existing ContinuityManager (keyed by
 * PATHNAME now, not by tab) so they survive PWA relaunches too.
 *
 * Mounted once inside <BrowserRouter> (App.jsx). Returns null.
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import continuityManager from '../pwa/continuity/ContinuityManager';

// Routes that preserve their scroll position. Everything else starts at top.
const SCROLL_SURFACES = ['/', '/sheet/explore'];

function isScrollSurface(pathname) {
  return SCROLL_SURFACES.includes(pathname);
}

export default function ScrollManager() {
  const { pathname } = useLocation();
  const prevPathRef = useRef(pathname);

  // useLayoutEffect: run BEFORE paint so the detail page never flashes
  // at the old scroll offset.
  useLayoutEffect(() => {
    const prev = prevPathRef.current;
    if (prev === pathname) return; // first mount — App owns boot restore

    // 1) Save the outgoing surface's position BEFORE leaving it.
    if (isScrollSurface(prev) && typeof window !== 'undefined') {
      continuityManager.saveScrollPosition(prev, window.scrollY);
    }

    if (typeof window === 'undefined') return;

    // 2) Position the incoming route.
    if (isScrollSurface(pathname)) {
      // Restore the catalog's saved position (async — IndexedDB).
      continuityManager.restoreScrollPosition(pathname).then((y) => {
        window.scrollTo(0, Number(y) || 0);
      });
    } else {
      // Detail / sheet / form — always start at the top.
      window.scrollTo(0, 0);
    }

    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
