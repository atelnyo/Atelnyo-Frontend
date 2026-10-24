/**
 * src/services/routeWarmup.js
 *
 * Route chunk warmup — kills the "click → seconds of nothing" gap on
 * FIRST navigation to a lazy-loaded sheet.
 *
 * Why: every sheet route in App.jsx is React.lazy. On the very first
 * click of e.g. the Studio, the browser must download the route chunk
 * (CreatorStudio ≈ 195 kB gzip) BEFORE anything renders. On a mobile
 * connection that is seconds of dead air — the user pressed and the UI
 * "did not respond". Warmup fetches those chunks during idle time so
 * the first click renders instantly.
 *
 * Safety rules (never waste the user's data):
 *   - Skip when saveData is on, or the connection is 2g/slow-2g.
 *   - Only start after the initial page is interactive (load event +
 *     idle callback with a timeout so it cannot stall forever).
 *   - Chunks are fetched one at a time, high-probability first, so an
 *     early warmup never competes with a real navigation for bandwidth
 *     longer than one chunk.
 *   - Module-level dedup: warmup runs at most once per session.
 */

// Warm list, most-likely-first. Bottom-nav destinations and the common
// sheets users reach from cards/buttons. Paths mirror the React.lazy
// factories in App.jsx — same modules → Vite/Rollup reuses the SAME
// chunks (no duplicate downloads, no extra bundle bytes).
const WARM_ROUTES = [
  { name: 'explore', load: () => import('../components/Explore') },
  { name: 'mwen', load: () => import('../components/Mwen') },
  { name: 'settings', load: () => import('../components/Settings') },
  { name: 'studio', load: () => import('../components/studio/CreatorStudio') },
  { name: 'messages', load: () => import('../components/studio/sections/MessagesSection') },
  { name: 'wallet', load: () => import('../pages/wallet/WalletPage') },
  { name: 'notifications', load: () => import('../components/NotificationsPage') },
  { name: 'help', load: () => import('../components/HelpPage') },
];

function connectionAllowsWarmup() {
  try {
    const conn = navigator.connection;
    if (!conn) {return true;} // Unknown → assume it's fine (desktop mostly).
    if (conn.saveData) {return false;}
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {return false;}
    return true;
  } catch {
    return false;
  }
}

const scheduleIdle = (fn, timeoutMs) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: timeoutMs });
  } else {
    setTimeout(fn, 300);
  }
};

let started = false;

/**
 * Start warming route chunks. Call once from App on mount. Idempotent,
 * silent, and never throws — warmup is strictly best-effort.
 */
export function warmRouteChunks() {
  if (started) {return;}
  started = true;
  if (typeof window === 'undefined' || !connectionAllowsWarmup()) {return;}

  const run = () => {
    // Warm sequentially: chunk N+1 only starts after chunk N resolves,
    // so warmup never hogs bandwidth while the user is mid-navigation.
    const next = (i) => {
      if (i >= WARM_ROUTES.length) {return;}
      scheduleIdle(() => {
        if (document.hidden) {
          // Tab hidden → stop burning bandwidth; retry when visible.
          const onVisible = () => {
            if (!document.hidden) {
              document.removeEventListener('visibilitychange', onVisible);
              next(i);
            }
          };
          document.addEventListener('visibilitychange', onVisible);
          return;
        }
        WARM_ROUTES[i].load().then(() => next(i + 1)).catch(() => {});
      }, 4000);
    };
    next(0);
  };

  // Start only once the initial page is fully loaded — never delay TTI.
  if (document.readyState === 'complete') {
    scheduleIdle(run, 6000);
  } else {
    window.addEventListener('load', () => scheduleIdle(run, 6000), { once: true });
  }
}
