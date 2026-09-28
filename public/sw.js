// sw.js — Atelnyo PWA service worker
//
// ⚠️ SUBSYSTEM BOUNDARY — this file is the OFFLINE FOUNDATION of the
// PWA, NOT the Installation Manager:
//
//   PWA System
//   ├── Manifest              → app identity (public/manifest.json)
//   ├── Service Worker        → THIS FILE: offline, caching, app shell
//   ├── Installation Manager  → install state/capability/prompt/fallback
//   │                            (src/pwa/installation/InstallationManager.js)
//   └── App Controller        → integration (App.jsx + UI)
//
// The ``install`` / ``activate`` events BELOW are the SERVICE WORKER
// LIFECYCLE (precache + cache cleanup) — they are NOT the PWA install
// flow. PWA install state (beforeinstallprompt, standalone detection,
// installed marker) lives exclusively in the Installation Manager;
// this file must never read or write it. SW registration itself is
// handled independently in index.html (with a dev-mode guard).
//
// Caching strategies:
//   • App shell (HTML, JS chunks, CSS) — Cache-first
//   • CDN fonts/icons — Stale-while-revalidate
//   • Content images — Network-first with cache fallback
//   • API responses — Pass through
//
// Background Sync: handles 'offline-queue' sync events. When the browser
// regains connectivity while the app is CLOSED, it fires the sync event;
// this SW tells all open clients to drain the queue, or if none are open,
// it fetches the queued URLs directly.

// Cache names use the ``atelnyo-`` prefix (Atelnyo brand migration). The
// activate handler below also purges legacy ``devrose-*`` caches so the
// controlled migration happens once, in place, without breaking offline.
const CACHE_VERSION = 'v8';
const APP_SHELL = `atelnyo-app-${CACHE_VERSION}`;
const STATIC_ASSETS = `atelnyo-static-${CACHE_VERSION}`;
const COURSE_IMAGES = `atelnyo-images-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/', '/index.html', '/offline.html'];

const CDN_ORIGINS = ['cdnjs.cloudflare.com','unsplash.com','via.placeholder.com','ui-avatars.com'];
const API_PATHS = ['/api/', '/ws/', '/dapi/'];
const STATIC_EXTS = ['.js','.css','.woff','.woff2','.ttf','.svg','.ico','.png','.jpg','.jpeg','.webp','.gif'];

// ─── Install ─────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch((err) => console.warn('[sw] precache partial:', err.message)))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => (k.startsWith('atelnyo-') || k.startsWith('devrose-'))
                          && k !== APP_SHELL && k !== STATIC_ASSETS && k !== COURSE_IMAGES)
            .map((k) => { console.log('[sw] deleting old cache:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // API / WebSocket — pass through
  if (API_PATHS.some((p) => url.pathname.startsWith(p))) return;

  // CDN fonts/icons — stale-while-revalidate
  if (CDN_ORIGINS.includes(url.origin)) {
    event.respondWith(
      caches.open(STATIC_ASSETS).then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetched;
        })
      )
    );
    return;
  }

  // Static assets (JS/CSS/images) — cache-first
  if (STATIC_EXTS.some((ext) => url.pathname.endsWith(ext))) {
    event.respondWith(
      caches.open(STATIC_ASSETS).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // App shell (HTML navigation) — cache-first, network fallback
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.open(APP_SHELL).then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached || caches.match('/offline.html'));
          return cached || fetched;
        })
      )
    );
    return;
  }

  // Images — cache-first for S3/Filebase media (bandwidth savings)
  // Pre-signed URLs have query params, so match by pathname only
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(url.pathname) || 
      url.hostname.includes('s3.filebase.io') ||
      url.hostname.includes('s3.us-')) {
    event.respondWith(
      caches.open(COURSE_IMAGES).then((cache) => {
        // For S3 URLs, strip query params for cache key
        const cacheKey = url.hostname.includes('s3.') 
          ? new Request(url.origin + url.pathname, { method: 'GET' })
          : request;
        
        return cache.match(cacheKey).then((cached) => {
          if (cached) return cached;  // Cache hit — no bandwidth used!
          return fetch(request).then((response) => {
            if (response.ok) {
              // Cache for 30 days (max-age from ResponseCacheControl)
              cache.put(cacheKey, response.clone());
            }
            return response;
          }).catch(() => cache.match(cacheKey));
        });
      })
    );
    return;
  }
});

// ─── Background Sync ─────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        if (clients.length) {
          clients.forEach((c) => c.postMessage({ type: 'DRAIN_OFFLINE_QUEUE' }));
        }
      })
    );
  }
});

// ─── Version query ───────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION' && event.ports?.[0]) {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
