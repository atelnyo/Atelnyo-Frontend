import axios from 'axios';
import { androidBridge } from './androidBridge';

// `VITE_API_BASE_URL` remains the normal deployment override. The public
// production URL is also embedded as a safe fallback so a static host
// cannot accidentally ship with a relative `/api/` URL when its build
// environment is missing. Local Vite dev keeps using the `/api/` proxy.
// Exported so components that fetch outside the axios client (geo-hint,
// admin security panels, diagnostics, local-engine) build URLs from the
// SAME base. Hardcoding '/api/...' in raw fetch() calls breaks local dev
// against the deployed API (the relative path hits the vite proxy to a
// backend that isn't running → 500) and double-maintains the base URL.
const PUBLIC_API_URL = 'https://api.atelnyo.site/api/';
export const API_URL = (() => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    // Guard: production builds MUST point at the real API domain.
    // If the Render dashboard env var was accidentally set to the
    // legacy onrender.com URL, the Explore catalogs show CORS errors
    // because the old service doesn't send Access-Control-Allow-Origin
    // for the production frontend. Fall back to the hardcoded URL.
    if (import.meta.env.PROD && configured.includes('onrender.com')) {
      console.warn('[Atelnyo] VITE_API_BASE_URL points to a Render staging URL — using production fallback.');
      return PUBLIC_API_URL;
    }
    return configured;
  }
  return import.meta.env.PROD ? PUBLIC_API_URL : '/api/';
})();

/**
 * JWT-aware axios client.
 *
 * Token model
 * -----------
 * We store two tokens in localStorage:
 *   * `access_token`  — short-lived (15 min), sent on every API request
 *   * `refresh_token` — long-lived (7 days), used to mint a fresh access
 *
 * The interceptor below sends `Authorization: Bearer <access>` on every
 * request. If the server replies 401, we transparently POST to
 * `/api/refresh/` (using the current refresh), update both tokens, and replay
 * the failed request exactly once. This keeps the user logged in for the
 * full 7-day refresh window without interrupting their work.
 *
 * On `access_token` refresh failure we drop BOTH tokens and emit a
 * `atelnyo:auth:logout` event so other components (e.g. Header avatar) can
 * react without polling localStorage.
 *
 * JWT wirings & rotation rationale
 * --------------------------------
 * Why we DON'T read the token from a React context: axios interceptors run
 * OUTSIDE React's render lifecycle. A context-based scheme would force
 * re-registering the interceptor on every user state change — and many
 * in-flight requests would race the re-registration, shipping stale auth
 * headers. localStorage is sync, fast, persistent across reloads, and only
 * updated exactly when login/logout happen — the perfect simple contract
 * for outbound HTTP auth.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 45000;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Frontend safety net: a request may hang if the backend is asleep,
  // the upstream network is slow, or the service is temporarily stuck.
  // 20s is a practical ceiling: long enough to handle normal app traffic,
  // short enough to prevent a browser spinner from waiting for a Render
  // cold-start or a dead connection. Per-request overrides still work
  // for heavier operations (e.g. ``api.patch(url, data, { timeout: 60_000 })``).
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
});

// ═══════════════════════════════════════════════════════════════════
// IN-FLIGHT REQUEST DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════
// When multiple components mount simultaneously and each needs the
// same GET data (e.g. GET /api/me from Header + Sidebar + Profile),
// they share ONE in-flight request instead of firing N identical ones.
//
// Usage:  import { dedupedGet } from './api';
//         const res = await dedupedGet('me/');
//
// The dedup key is ``method + url + sorted-params``.  Only GET
// requests are deduped — mutations (POST/PATCH/DELETE) are never
// shared because they have side effects.
//
// After the response resolves, the entry is removed so the NEXT
// request starts fresh (no stale-cache surprise).  Components that
// need "refetch" semantics call dedupedGet again and get a fresh
// network round-trip.
import { diag } from './requestDiagnostics';
import { parseApiError, createCorrelationId as createCorrId } from '../utils/errors';
import { observability, EventType, createCorrelationId } from '../utils/observability';

const _inflightMap = new Map();

function _dedupKey(method, url, params) {
  const sorted = params ? JSON.stringify(Object.keys(params).sort().reduce((o, k) => { o[k] = params[k]; return o; }, {})) : '';
  return `${method}:${url}:${sorted}`;
}

/**
 * Deduplicated GET — shares one in-flight request across callers.
 *
 * @param {string} url     — endpoint path (relative to baseURL)
 * @param {object} [params] — query params
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function dedupedGet(url, params) {
  const key = _dedupKey('GET', url, params);
  if (_inflightMap.has(key)) {
    diag.dedupHit(key);
    return _inflightMap.get(key);
  }
  diag.dedupMiss(key);
  const promise = api.get(url, { params })
    .finally(() => { _inflightMap.delete(key); });
  _inflightMap.set(key, promise);
  return promise;
}

/**
 * Abortable GET — returns { promise, abort } so the caller can
 * cancel on unmount or route change.  The AbortController is
 * wired into axios via the ``signal`` config option.
 *
 * @param {string} url      — endpoint path
 * @param {object} [params] — query params
 * @param {AbortSignal} [signal] — optional external signal (e.g. from useFetch)
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function abortableGet(url, params, signal) {
  return api.get(url, { params, signal });
}

// ═══════════════════════════════════════════════════════════════════
// APPLICATION DATA CACHE (stale-while-revalidate)
// ═══════════════════════════════════════════════════════════════════
import { cache } from './cache';

// Multi-level cache for stable/semi-static data that doesn't change
// often: categories, config, creator profile, permissions, etc.
//
// Usage:
//   import { cachedGet } from './api';
//   const res = await cachedGet('categories/', { scope: 'course' }, { ttl: 60_000 });
//
// TTL (time-to-live) determines how long a cached response is fresh.
// After TTL expires, the NEXT caller gets the stale response immediately
// (fast) while a background revalidation fires.  Subsequent callers get
// the fresh data once the revalidation completes.
//
// Cache levels:
//   L1 (In-Memory) — fastest, per-session
//   L2 (localStorage) — persists across reloads
//   L3 (IndexedDB) — for large data sets
//
// Cache is per-user: on logout/login the cache is cleared so one user's
// data never leaks to another.
const _revalidating = new Map(); // key → true (prevents duplicate revalidations)

/**
 * Cached GET — returns stale data instantly, revalidates in background.
 *
 * @param {string} url
 * @param {object} [params]
 * @param {object} [opts]
 * @param {number} [opts.ttl=60000] — cache lifetime in ms
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function cachedGet(url, params, { ttl = 60_000 } = {}) {
  const key = _dedupKey('GET', url, params);

  // Try multi-level cache (L1 → L2 → L3)
  const cached = await cache.get(key);
  if (cached) {
    diag.cacheHit(url);
    return cached;
  }

  // Stale-while-revalidate: if a revalidation is in progress, try to
  // return stale data from L2/L3 (not null — callers expect an axios response).
  if (_revalidating.has(key)) {
    // Try to fetch stale data from persistent levels (skip L1 since it was
    // already checked above and missed).
    const stale = await cache.get(key);
    if (stale) return stale;
  }

  // Cold miss — fetch and cache
  diag.cacheMiss(url);
  _revalidating.set(key, true);

  try {
    const res = await api.get(url, { params });
    // Store in all cache levels (L1 + L2, L3 for large data)
    await cache.set(key, res, { ttl, l3: false });
    return res;
  } catch (err) {
    // On 404 the resource was deleted/suspended — don't cache
    if (err?.response?.status === 404) {
      // Purge any stale entry so callers don't keep getting stale 404 data
      await cache.delete(key).catch(() => {});
    }
    throw err;
  } finally {
    _revalidating.delete(key);
  }
}

/**
 * Invalidate cache entries matching a URL prefix.
 * Call after mutations (POST/PATCH/DELETE) to ensure
 * the next GET fetches fresh data.
 */
export async function invalidateCache(urlPrefix) {
  await cache.invalidate(urlPrefix);
}

/**
 * Clear entire cache — call on logout to prevent
 * cross-user data leakage.
 */
export async function clearCache() {
  await cache.clear();
}

/**
 * Clear only L1 (in-memory) cache — called on logout.
 */
export function clearSessionCache() {
  cache.clearSession();
}

/**
 * Get cache statistics for debugging.
 */
export async function getCacheStats() {
  return cache.stats();
}

// ═══════════════════════════════════════════════════════════════════
// RETRY POLICY (transient failure recovery)
// ═══════════════════════════════════════════════════════════════════
// Retries transient failures (network errors, 5xx, 429) with
// exponential backoff.  Auth failures (401/403), validation (400/422),
// and not-found (404) are NEVER retried.
const RETRY_MAX = 2;
const RETRY_BASE_MS = 500;

function _isRetryable(err) {
  if (!err) return false;
  // Network error (no response)
  if (!err.response) return true;
  // axios timeout — Render free plan can take 30-90s on cold start,
  // so a 20s-30s client timeout isn't a hard failure; retry it.
  if (err.code === 'ECONNABORTED') return true;
  const status = err.response.status;
  return status >= 500 || status === 429;
}

function _retryDelay(attempt) {
  return RETRY_BASE_MS * Math.pow(2, attempt);
}

/**
 * Retry-aware GET — retries transient failures up to RETRY_MAX times.
 * Use for non-critical data fetches where resilience matters.
 */
export async function retryGet(url, params, { retries = RETRY_MAX } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await api.get(url, { params });
    } catch (err) {
      lastErr = err;
      if (!_isRetryable(err) || i === retries) throw err;
      const delay = _retryDelay(i);
      diag.retryAttempt(url, i + 1, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Tracks whether a refresh call is already in flight, so a burst of 401s
// only triggers one network round-trip instead of N concurrent refreshes.
let inflightRefresh = null;

// Defaults to 'session_expired' so callers never have to think — the
// only place that explicitly sets 'user' is Settings.jsx when the user
// hits the Logout button themselves (which goes through ``handleLogout``,
// NOT ``broadcastLogout``). Everything else that fires this event is doing
// so in response to a server-side token invalidation (refresh+401 cycle in
// the interceptor below, or a session revoke from another tab). The
// reason travels to the App.jsx listener via CustomEvent.detail so the
// user sees a "Session expired. Please log in again." toast instead of the
// silent drop.
//
// Dedupes fan-out when several in-flight requests 401 at the same moment:
// the interceptor coalesces the refresh POST (``inflightRefresh``), but
// EVERY failing request still calls ``broadcastLogout`` independently in
// its own catch, so a burst of 401s would stack N identical logout events.
// One session death should fan out exactly ONE event → one toast + one
// modal, no matter how many parallel requests died with it.
let lastBroadcastAt = 0;
export function broadcastLogout(reason = 'session_expired') {
  const now = Date.now();
  if (now - lastBroadcastAt < 1000) { return; }
  lastBroadcastAt = now;
  try { window.dispatchEvent(new CustomEvent('atelnyo:auth:logout', { detail: { reason } })); } catch (_) {}
}

// localStorage keys — kept in one place so admin / logout / migration
// paths don't disagree on spelling.
const LS_KEYS = Object.freeze({
  access: 'access_token',
  refresh: 'refresh_token',
  user: 'user',
  legacyToken: 'token',
});

/**
 * Read the bearer token to send on the next request. Django-issued JWT
 * (TiDB-native auth — no external provider tokens exist anymore).
 */
function pickAuthHeader() {
  return localStorage.getItem(LS_KEYS.access);
}

api.interceptors.request.use((config) => {
  const token = pickAuthHeader();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    config.headers['X-Authorization'] = `Bearer ${token}`;
  }
  // Record request start time for diagnostics
  config.metadata = { startTime: Date.now() };
  // Phase 12: Add correlation ID for request tracing
  const correlationId = createCorrelationId();
  config.metadata.correlationId = correlationId;
  config.headers['X-Request-ID'] = correlationId;
  // Log request start
  observability.logRequest(config.url || '', config.method || 'GET', correlationId);
  return config;
});

api.interceptors.response.use(
  (response) => {
    // X-Maintenance header (set by MaintenanceModeMiddleware on
    // every read pass-through) signals a read_only maintenance
    // window. We dispatch a window event so the existing
    // MaintenanceBanner (and any other listener) can light up
    // immediately. Listeners de-dupe by window-id so a burst of
    // GETs doesn't fire N toasts.
    const maintenance = response.headers?.['x-maintenance'];
    if (maintenance) {
      try {
        window.dispatchEvent(new CustomEvent('atelnyo:server:maintenance', {
          detail: {
            scope: response.headers?.['x-maintenance-scope'] || 'read_only',
            source: 'response_header',
          },
        }));
      } catch (_) { /* ignore */ }
    }
    // Auto-invalidate cache on mutations (POST/PATCH/DELETE/PUT)
    // so the next GET fetches fresh data.
    const method = (response.config?.method || '').toLowerCase();
    if (method !== 'get' && method !== 'head') {
      const url = response.config?.url || '';
      // Invalidate all cache entries whose key contains the base URL path
      // (e.g. a PATCH to 'courses/3/' invalidates all 'courses/' entries)
      const basePath = url.split('?')[0].replace(/\d+\//g, '').replace(/\/[^/]*\//g, '/').replace(/\/[^/]+\/$/, '/');
      if (basePath) invalidateCache(basePath).catch(() => {});
    }
    // Request timing diagnostics
    const duration = Date.now() - (response.config?.metadata?.startTime || Date.now());
    diag.requestComplete(response.config?.url || '', duration, response.status);
    // Phase 12: Log request completion with correlation ID
    observability.logRequestComplete(
      response.config?.url || '',
      duration,
      response.status,
      response.config?.metadata?.correlationId,
    );
    return response;
  },
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const refresh = localStorage.getItem('refresh_token');
    const isTimeoutError = error.code === 'ECONNABORTED' || /timeout|timed out/i.test(error.message || '');
    const correlationId = original?.metadata?.correlationId;

    // Phase 12: Log request failure with correlation ID
    const duration = Date.now() - (original?.metadata?.startTime || Date.now());
    observability.logRequestComplete(
      original?.url || '',
      duration,
      status || 0,
      correlationId,
    );

    // Phase 12: Parse into structured error for downstream handling
    const structuredError = parseApiError(error);
    error.code = structuredError.code;
    error.category = structuredError.category;
    error.retryable = structuredError.retryable;

    if (isTimeoutError) {
      error.userMessage = 'The server is taking too long to respond. Please try again in a moment.';
      try {
        window.dispatchEvent(new CustomEvent('atelnyo:request:timeout', {
          detail: {
            url: original?.url || 'unknown',
            method: original?.method || 'unknown',
          },
        }));
      } catch (_) { /* ignore */ }
    }

    // 503 with maintenance_mode error body — surface a maintenance
    // event so the banner can show even when the FE missed the
    // read pass (e.g. the user just opened a write tab).
    if (error.response?.status === 503 && error.response?.data?.error === 'maintenance_mode') {
      try {
        window.dispatchEvent(new CustomEvent('atelnyo:server:maintenance', {
          detail: {
            scope: error.response.data.scope || 'read_only',
            source: '503_response',
          },
        }));
      } catch (_) { /* ignore */ }
    }

    // Skip refresh for login/refresh/logout endpoints to avoid infinite loops.
    const skipRefresh =
      original?.url?.includes('/login/') ||
      original?.url?.includes('/logout/') ||
      original?.url?.includes('/refresh/') ||
      original?.url?.includes('/password/');

    if (status === 401 && refresh && !skipRefresh && !original._retry) {
      original._retry = true;
      try {
        inflightRefresh = inflightRefresh || axios.post(`${API_URL}refresh/`, { refresh });
        const { data } = await inflightRefresh;
        inflightRefresh = null;
        // Unwrap ApiResponseRenderer envelope ({success, data: {access, refresh}})
        const payload = data?.data ?? data;
        if (payload?.access) {
          localStorage.setItem('access_token', payload.access);
          if (payload?.refresh) localStorage.setItem('refresh_token', payload.refresh);
        }
        // Replay the original request with the new access token.
        original.headers = original.headers || {};
        original.headers['Authorization'] = `Bearer ${payload?.access}`;
        original.headers['X-Authorization'] = `Bearer ${payload?.access}`;
        return api(original);
      } catch (refreshErr) {
        inflightRefresh = null;
        // Refresh failed → session is dead. Wipe local copies and notify.
        clearTokenPair();
        broadcastLogout();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  },
);

export const courseService = {
  getAll: (params) => api.get('courses/', { params }),
  getById: (id) => api.get(`courses/${id}/`),
  update: (id, data) => api.patch(`courses/${id}/`, data),
  delete: (id) => api.delete(`courses/${id}/`),
  // POST /api/courses/<id>/publish/ — draft → published (Creator Studio
  // §51 server-side gate: title, 20+ char description, cover, external
  // URL for external courses). Owner/staff only; 400 with {errors} when
  // the gate fails.
  publish: (id) => api.post(`courses/${id}/publish/`),
  // Atelnyo Language Academy — official-program scope: fetch the full
  // curriculum of a program (all levels) with one ``program_id`` filter.
  getByProgram: (programId) =>
    api.get('courses/', { params: { program_id: programId } }),
  getByProgramLevel: (programId, level) =>
    api.get('courses/', { params: { program_id: programId, level } }),
  // Content Intelligence — SEO metadata from CI engine.
  // Returns AI-optimized title, description, structured data.
  getSEO: (id) => api.get(`intelligence/course/${id}/seo/`),
  // Content Intelligence — get full CI record for a course.
  getCI: (id) => api.get(`intelligence/course/${id}/`),
  // Content Intelligence — trigger processing for a course.
  processCI: (id) => api.post(`intelligence/process/${id}/`),
  // Content Intelligence — creator's own courses intelligence status.
  getMyCoursesCI: () => api.get('intelligence/my-courses/'),
  // Content Intelligence — admin stats.
  getCIStats: () => api.get('intelligence/stats/'),
  // Content Intelligence — batch process (admin).
  batchProcessCI: (opts) => api.post('intelligence/batch/', opts),
  // Learning Space — contact the instructor from inside the course.
  // Creates a REAL 1:1 conversation (same messaging architecture as
  // everywhere else) + a bell alert for the instructor.
  messageInstructor: (id, body) =>
    api.post(`courses/${id}/message_instructor/`, { body }),
  // Verified-completion certificate (backend-issued only). 404 until
  // real progress reaches 100% — nothing is faked.
  certificate: (id) => api.get(`courses/${id}/certificate/`),
  // REAL per-course analytics (creator only): enrollments, avg
  // progress, completions, active learners, quiz attempts — computed
  // from Enrollment / UserProgress / QuizAttempt rows server-side.
  getAnalytics: (id) => api.get(`courses/${id}/analytics/`),
  getLearningInsights: (id) => api.get(`courses/${id}/learning-insights/`),
  getTrendData: (id, days = 30) => api.get(`courses/${id}/analytics/trends/`, { params: { days } }),
  getCreatorOverview: (days = 30) => api.get('creator/analytics/overview/', { params: { days } }),
  getCurriculumAnalytics: (id) => api.get(`courses/${id}/curriculum_analytics/`),
  exportCourse: (id) => api.get(`courses/${id}/export/`),
  importCourse: (data) => api.post('courses/import/', { data }),
  getVersions: (id) => api.get(`courses/${id}/versions/`),
  rollback: (id, version) => api.post(`courses/${id}/rollback/`, { version }),
  // Course Collaboration — Phase 19
  getCollaborators: (id) => api.get(`courses/${id}/collaborators/`),
  inviteCollaborator: (id, data) => api.post(`courses/${id}/collaborators/invite/`, data),
  updateCollaborator: (id, collabId, data) => api.patch(`courses/${id}/collaborators/${collabId}/`, data),
  removeCollaborator: (id, collabId) => api.delete(`courses/${id}/collaborators/${collabId}/`),
  // REAL creator view of enrolled learners across the creator's
  // courses (owner-only; the backend never leaks other creators' data).
  getStudents: () => api.get('courses/students/'),
  // Course Quality — returns a validation report with score, errors,
  // warnings, and recommendations. Used by the CourseEditor quality panel.
  quality: (id) => api.get(`courses/${id}/quality/`),
  // Course Status Transition — moves the course through the lifecycle:
  // draft → building → review → published → updating → archived
  transition: (id, status) => api.post(`courses/${id}/transition/`, { status }),
};

// ─── Creator Studio — Chapter / Lesson / ContentBlock (Phase 2) ────
// Flat backend routes with query-param scoping:
//   GET /api/chapters/?course=<id>
//   GET /api/lessons/?chapter=<id>
//   GET /api/content-blocks/?lesson=<id>
export const chapterService = {
  list: (courseId) => api.get('chapters/', { params: { course: courseId } }),
  get: (id) => api.get(`chapters/${id}/`),
  create: (data) => api.post('chapters/', data),
  update: (id, data) => api.patch(`chapters/${id}/`, data),
  delete: (id) => api.delete(`chapters/${id}/`),
  reorder: (courseId, items) => api.post(`courses/${courseId}/chapters/reorder/`, { items }),
};

export const lessonService = {
  list: (chapterId) => api.get('lessons/', { params: { chapter: chapterId } }),
  get: (id) => api.get(`lessons/${id}/`),
  create: (data) => api.post('lessons/', data),
  update: (id, data) => api.patch(`lessons/${id}/`, data),
  delete: (id) => api.delete(`lessons/${id}/`),
  reorder: (chapterId, items) => api.post(`chapters/${chapterId}/lessons/reorder/`, { items }),
};

export const contentBlockService = {
  list: (lessonId) => api.get('content-blocks/', { params: { lesson: lessonId } }),
  get: (id) => api.get(`content-blocks/${id}/`),
  create: (data) => api.post('content-blocks/', data),
  update: (id, data) => api.patch(`content-blocks/${id}/`, data),
  delete: (id) => api.delete(`content-blocks/${id}/`),
  duplicate: (lessonId, blockId) => api.post(`lessons/${lessonId}/blocks/${blockId}/duplicate/`),
  reorder: (lessonId, items) => api.post(`lessons/${lessonId}/blocks/reorder/`, { items }),
};

export const musicService = {
  list: (params) => api.get('explore/music/', { params }),
  get: (id) => api.get(`explore/music/${id}/`),
  update: (id, data) => api.patch(`explore/music/${id}/`, data),
  delete: (id) => api.delete(`explore/music/${id}/`),
  getSEO: (id) => api.get(`intelligence/music/${id}/seo/`),
};

// ─── Atelnyo Language Academy — official programs (Phase Language) ──
// Public list only exposes PUBLISHED programs (the backend enforces
// the draft gate); staff sees drafts too and can generate the
// curriculum, publish, unpublish, and list every program course.
export const languageProgramService = {
  // GET /api/language-programs/ — public: published only; staff: all.
  list: (params) => api.get('language-programs/', { params }),
  // GET /api/language-programs/<program_key>/ — public retrieve.
  get: (key) => api.get(`language-programs/${encodeURIComponent(key)}/`),
  // POST /api/language-programs/<key>/generate/ — staff, idempotent.
  // Body {levels: [...], update: bool}. Creates DRAFT courses + quizzes.
  generate: (key, { levels, update = false } = {}) =>
    api.post(`language-programs/${encodeURIComponent(key)}/generate/`, {
      ...(levels ? { levels } : {}),
      ...(update ? { update: true } : {}),
    }),
  // POST /api/language-programs/<key>/publish/ — staff.
  publish: (key) => api.post(`language-programs/${encodeURIComponent(key)}/publish/`),
  // POST /api/language-programs/<key>/unpublish/ — staff.
  unpublish: (key) => api.post(`language-programs/${encodeURIComponent(key)}/unpublish/`),
  // GET /api/language-programs/<key>/courses/ — every program course
  // (drafts included for staff; published only for everyone else).
  courses: (key) => api.get(`language-programs/${encodeURIComponent(key)}/courses/`),
};

/**
 * Auth surface — JWT only.
 *
 *   login:                 POST /api/login/                       → {access, refresh, user}
 *   signup:                POST /api/signup/                      → {access, refresh, user}
 *   logout:                POST /api/logout/                      → blacklists the supplied refresh
 *   refresh:               POST /api/refresh/                     → rotates refresh + new access
 *   forgotPassword:        POST /api/password/forgot/             → dev-mode reset token
 *   resetPasswordConfirm:  POST /api/password/reset/confirm/      → consumes token, sets pw
 *   (auth endpoints accept an optional ``recaptcha_token`` for T008)
 *   changePassword:        POST /api/password/change/             → {current_password, new_password}
 *   sendEmailVerification: POST /api/email/verify/send/           → dev-mode verify JWT
 *   confirmEmailVerification: POST /api/email/verify/confirm/     → {token}
 *   deleteAccount:         DELETE /api/account/delete/             → {confirmation: "DELETE"}
 *   getMe:                 GET  /api/me/                          → current user ({id, username, email, date_joined})
 *
 * Helper: `applyTokenPair({access, refresh, user})` writes both tokens and
 * the user blob to localStorage in one go so callers can stay declarative.
 */
export function applyTokenPair({ access, refresh, user }) {
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
  if (user) localStorage.setItem('user', JSON.stringify(user));

  if (androidBridge.isAndroid()) {
    androidBridge.setAuthTokens(
      access || localStorage.getItem('access_token') || '',
      refresh || localStorage.getItem('refresh_token') || '',
      user ? JSON.stringify(user) : localStorage.getItem('user') || '{}',
      '',
      ''
    );
  }
}

/**
 * Internal: which localStorage keys are auth-related. Exported for tests.
 */
export const AUTH_LOCALSTORAGE_KEYS = LS_KEYS;

export function clearTokenPair() {
  // Drop EVERYTHING auth-related.
  //
  // Note: this helper intentionally does NOT broadcast the
  // ``atelnyo:auth:logout`` event. ``broadcastLogout()`` triggers
  // App.jsx's ``onForcedLogout`` listener which calls
  // ``handleLogout`` → which itself calls ``clearTokenPair``. Calling
  // ``broadcastLogout()`` from inside this helper would create an
  // infinite loop (clear → broadcast → listener → clear → …). Each
  // caller that wants to notify the rest of the app should call
  // ``broadcastLogout(reason)`` AFTER invoking this helper — the
  // interceptor and the explicit user-Logout button do exactly that.
  Object.values(LS_KEYS).forEach((k) => {
    try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
  });

  // Clear the application data cache to prevent cross-user data leakage.
  clearCache().catch(() => {});

  if (androidBridge.isAndroid()) {
    androidBridge.setAuthTokens('', '', '{}', '', '');
  }
}

export const authService = {
  login: (credentials) => api.post('login/', credentials),
  signup: (userData) => api.post('signup/', userData),
  logout: (refresh) => api.post('logout/', { refresh }),
  refresh: (refresh) => api.post('refresh/', { refresh }),
  getMe: () => api.get('me/'),
  // T008 — optional reCAPTCHA token rides along when CAPTCHA is enabled.
  forgotPassword: (email, recaptcha_token) => api.post('password/forgot/', {
    email,
    ...(recaptcha_token ? { recaptcha_token } : {}),
  }),
  // Note: dev-mode endpoint returns the token in the response. In prod we'd
  // email a link and never see the token client-side.
  resetPasswordConfirm: (token, new_password, recaptcha_token) =>
    api.post('password/reset/confirm/', {
      token, new_password,
      ...(recaptcha_token ? { recaptcha_token } : {}),
    }),
  // Requires the user to be authenticated. Re-verifies the current
  // password on the server so a stolen JWT can't silently rotate it.
  changePassword: ({ current_password, new_password }) =>
    api.post('password/change/', { current_password, new_password }),
  // Dev-mode: returns dev_verify_token + dev_verify_url so the FE can
  // drive an end-to-end UI without SMTP. The FE presents a "paste the
  // token here" input so the dev can simulate clicking an emailed link.
  sendEmailVerification: () => api.post('email/verify/send/', {}),

  confirmEmailVerification: (token) =>
    api.post('email/verify/confirm/', { token }),
  deleteAccount: (password) => api.delete('account/delete/', { data: { confirmation: 'DELETE', password } }),
  cancelAccountDeletionPublic: (email, password) => api.post('account/cancel-delete-public/', { email, password }),

  /* ══════════════════════════════════════════════════════════════
     F-013 / T053 — TOTP two-factor authentication
     Endpoints:
       setup         POST /api/2fa/setup/         → {secret, otpauth_url}
       enable        POST /api/2fa/enable/        → {enabled, message}
       disable       POST /api/2fa/disable/       → {enabled, message}
       verify-login  POST /api/2fa/verify-login/  → {access, refresh, user}
     ══════════════════════════════════════════════════════════════ */
  twoFactorSetup: () => api.post('2fa/setup/'),
  twoFactorEnable: (code) => api.post('2fa/enable/', { code }),
  twoFactorDisable: (code) => api.post('2fa/disable/', { code }),
  twoFactorVerifyLogin: (challenge, code) =>
    api.post('2fa/verify-login/', { challenge, code }),
  // Google OAuth identity endpoint (auth-provider portability). The FE
  // sends the Google ID token; the backend verifies it and resolves it to
  // an Atelnyo account via AuthIdentity(provider='google', sub) — never
  // creating duplicates, never treating Google as the account owner.
  googleLogin: (idToken) => api.post('social/google/', { id_token: idToken }),
};

export const progressService = {
  getAll: () => api.get('progress/'),
  update: (id, data) => api.patch(`progress/${id}/`, data),
  create: (data) => api.post('progress/', data),
  // Real learner-progress engine — last meaningful position + block
  // completions, persisted server-side (cross-device resume).
  recordPosition: (id, { module_index, block_index = -1, block_id = '' }) =>
    api.post(`progress/${id}/record_position/`, { module_index, block_index, block_id }),
  completeBlock: (id, { module_index, block_id, block_type = '' }) =>
    api.post(`progress/${id}/complete_block/`, { module_index, block_id, block_type }),
};

// ─── Learner Dashboard (spec §46) — aggregate my learning state ──────
// Every piece comes from EXISTING backend endpoints — the dashboard
// endpoint joins real Enrollment + UserProgress rows server-side;
// saved + recommended rails reuse the existing endpoints. No new
// system, just one coherent learner area.
export const learnerService = {
  // GET /api/learning/dashboard/ → {continue_learning, my_courses, completed}
  dashboard: () => api.get('learning/dashboard/'),
  // Saved courses (real SavedItem rows).
  savedCourses: () => api.get('explore/saved/items/', { params: { item_type: 'course' } }),
  // Recommended courses for this learner (existing scoring pipeline).
  recommendedCourses: (limit = 4) =>
    api.get('explore/recommended/courses/', { params: { limit } }),
};

// ─── Learning mastery (2027 §32–§36) — skills, reviews, practice ──
// Evidence-based skill states + spaced review + personalized practice.
// The FE never writes mastery state directly; every endpoint is scoped
// to the authenticated learner server-side.
export const masteryService = {
  // GET /api/learning/mastery/ → [{course, skills, due_reviews}]
  overview: () => api.get('learning/mastery/'),
  // GET /api/learning/mastery/reviews/ → due ReviewItems (oldest first).
  dueReviews: () => api.get('learning/mastery/reviews/'),
  // POST /api/learning/mastery/<id>/complete/  {success?: bool}
  completeReview: (id, success = true) =>
    api.post(`learning/mastery/${id}/complete/`, { success }),
  // GET /api/learning/mastery/practice/?limit=N → weakest-skill feed,
  // each item a real course block to practice.
  practice: (limit = 6) =>
    api.get('learning/mastery/practice/', { params: { limit } }),
  // GET /api/learning/recommendations/?course_id=N → {reason} or null.
  recommendationReason: (courseId) =>
    api.get('learning/recommendations/', { params: { course_id: courseId } }),
};

// ─── Learner goals (2027 §4, §47, §65) — explicit, changeable ─────
export const goalService = {
  getAll: () => api.get('learning/goals/'),
  create: (data) => api.post('learning/goals/', data),
  update: (id, data) => api.patch(`learning/goals/${id}/`, data),
  remove: (id) => api.delete(`learning/goals/${id}/`),
};

// ─── Course support surfaces (spec §22–§24) — Stage 3 ───────────────
// Announcements (owner/staff publish, enrolled learners read), resources
// (owner/staff add, enrolled learners read), and the learner's PRIVATE
// notes (read/write — the backend scopes every note to the authenticated
// user, so one learner's notes are never visible to anyone else).
export const courseSupportService = {
  // GET /api/course-announcements/?course_id=N — enrolled/owner read.
  announcements: (courseId) =>
    api.get('course-announcements/', { params: { course_id: courseId } }),
  // GET /api/course-resources/?course_id=N — enrolled/owner read.
  resources: (courseId) =>
    api.get('course-resources/', { params: { course_id: courseId } }),
  // GET /api/course-notes/?course_id=N — MY notes only (server-scoped).
  notes: (courseId) =>
    api.get('course-notes/', { params: { course_id: courseId } }),
  // POST /api/course-notes/ — upsert per (user, course, module, block).
  saveNote: (data) => api.post('course-notes/', data),
  // PATCH /api/course-notes/<id>/ — own note only.
  updateNote: (id, data) => api.patch(`course-notes/${id}/`, data),
  // DELETE /api/course-notes/<id>/ — own note only.
  deleteNote: (id) => api.delete(`course-notes/${id}/`),
};

// ─── Course FAQ (spec §1–§27) — creator CRUD + public endpoint ──────
// FAQ is part of the course's learner-support experience.  Creators
// create, organize, and control FAQ visibility from the Course Editor.
export const courseFaqService = {
  // Creator CRUD
  list: (courseId, params) => api.get('course-faqs/', {
    params: { ...(courseId ? { course_id: courseId } : {}), ...(params || {}) },
  }),
  create: (data) => api.post('course-faqs/', data),
  update: (id, data) => api.patch(`course-faqs/${id}/`, data),
  remove: (id) => api.delete(`course-faqs/${id}/`),
  duplicate: (id) => api.post(`course-faqs/${id}/duplicate/`),
  reorder: (order) => api.post('course-faqs/reorder/', { order }),
  // Public endpoint (unauthenticated) — only public & published FAQ.
  public: (courseId) => api.get('course-faqs/public/', { params: { course_id: courseId } }),
  // Categories
  categories: (courseId) => api.get('course-faq-categories/', {
    params: courseId ? { course_id: courseId } : {},
  }),
  createCategory: (data) => api.post('course-faq-categories/', data),
  updateCategory: (id, data) => api.patch(`course-faq-categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`course-faq-categories/${id}/`),
};

// ─── Course commerce — promo codes + course checkout (real backend) ─
// Promo validation is 100% server-side. Checkout reuses the existing
// order/payment architecture; free courses and 100% promos grant access
// immediately without any payment.
export const promoCodeService = {
  list: (courseId) => api.get('marketplace/promo-codes/', { params: courseId ? { course_id: courseId } : undefined }),
  create: (data) => api.post('marketplace/promo-codes/', data),
  update: (id, data) => api.patch(`marketplace/promo-codes/${id}/`, data),
  remove: (id) => api.delete(`marketplace/promo-codes/${id}/`),
  validate: (code, courseId) => api.post('marketplace/promo-codes/validate/', { code, course_id: courseId }),
};

export const courseCheckoutService = {
  checkout: (courseId, promoCode = '') =>
    api.post(`courses/${courseId}/checkout/`, { promo_code: promoCode }),
  // BACKEND-authoritative access check — the server decides who may
  // take the course (CourseEntitlement / legacy Enrollment). The FE
  // never decides access.
  access: (courseId) => api.get(`courses/${courseId}/access/`),
};

export const enrollmentService = {
  getAll: () => api.get('enrollments/'),
  create: (courseId) => api.post('enrollments/', { course: courseId }),
};

export const favoriteService = {
  getAll: () => api.get('favorites/'),
  create: (courseId) => api.post('favorites/', { course: courseId }),
  remove: (courseId) => api.delete(`favorites/0/?course_id=${courseId}`),
};

export const sessionService = {
  get: () => api.get('session/me/'),
  update: (data) => api.patch('session/me/', data),
};

// AI proxy: backend holds the Gemini API key, frontend just forwards prompts.
// See backend/api/views/ai.py for the server-side endpoint.
// ─── Learning — quizzes + speech submissions (real backend) ─────────
export const quizService = {
  list: (courseId) => api.get('quizzes/', { params: { course_id: courseId } }),
  create: (data) => api.post('quizzes/', data),
  update: (id, data) => api.patch(`quizzes/${id}/`, data),
  remove: (id) => api.delete(`quizzes/${id}/`),
};

export const quizQuestionService = {
  create: (data) => api.post('quiz-questions/', data),
  update: (id, data) => api.patch(`quiz-questions/${id}/`, data),
  remove: (id) => api.delete(`quiz-questions/${id}/`),
};

export const quizAttemptService = {
  submit: (quizId, answers, time_taken_seconds = 0) => api.post('quiz-attempts/', { quiz_id: quizId, answers, time_taken_seconds }),
  list: (quizId) => api.get('quiz-attempts/', { params: quizId ? { quiz_id: quizId } : undefined }),
};

export const speechSubmissionService = {
  create: (data) => api.post('speech-submissions/', data),
  // Creator review list — newest first; ``params`` may carry { limit }.
  list: (courseId, params) => api.get('speech-submissions/', {
    params: { ...(courseId ? { course_id: courseId } : {}), ...(params || {}) },
  }),
  // Creator aggregate of the word-level analyses (pass rates + the
  // words learners struggle with most).
  report: (courseId) => api.get('speech-submissions/report/', {
    params: { course_id: courseId },
  }),
};

// ─── Assignment / project submissions (real backend) ─────────────────
// Learners POST their answer text; creators GET the course's
// submissions (optionally filtered by block_id) and PATCH score /
// feedback / status to grade them. Learners may edit their own
// pending submission's content.
export const blockSubmissionService = {
  create: (data) => api.post('block-submissions/', data),
  list: (courseId, params) => api.get('block-submissions/', {
    params: { ...(courseId ? { course_id: courseId } : {}), ...(params || {}) },
  }),
  update: (id, data) => api.patch(`block-submissions/${id}/`, data),
};

// ─── Duolingo-style learner gamification (XP / level / daily streak /
// hearts / daily goal). Every completion endpoint (progress
// complete_block, quiz attempt, review complete) echoes a
// ``gamification`` payload with the SAME shape as GET /api/learning/stats/
// so the FE can celebrate inline without a second round-trip.
export const gamificationService = {
  // GET /api/learning/stats/ → {xp, level, daily_streak, hearts, daily_xp, …}
  stats: () => api.get('learning/stats/'),
  // PATCH /api/learning/stats/goal/ {daily_goal}
  updateGoal: (daily_goal) => api.patch('learning/stats/goal/', { daily_goal }),
  // POST /api/learning/stats/refill-hearts/
  refillHearts: () => api.post('learning/stats/refill-hearts/', {}),
};

// ─── Reference audio upload (language-practice blocks) ───────────────
// POST /api/media/upload-audio/ — accepts a base64 data URL (or a
// multipart file). Returns { url, uploaded, fallback }. When storage is
// unavailable the backend echoes the data URL back (fallback=true) so
// the creator's recording is never silently dropped.
export const mediaUploadService = {
  uploadAudio: (dataUrlOrBlob) => {
    if (dataUrlOrBlob instanceof Blob) {
      const formData = new FormData();
      formData.append('file', dataUrlOrBlob, 'reference.webm');
      return api.post('media/upload-audio/', formData, {
        // FormData sets its own multipart boundary — never force JSON.
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
    }
    return api.post('media/upload-audio/', { audio: dataUrlOrBlob }, { timeout: 60000 });
  },
};

// ─── Creator media library (Audio Library) ──────────────────────────
// GET /api/media/assets/?kind=audio&search=... — the creator's own
// cataloged uploads. Every reference audio recorded/uploaded through
// upload-audio is cataloged server-side as a MediaAsset row, so the
// library lists real re-usable audio — never fake entries.
export const mediaLibraryService = {
  listAudio: (search = '') =>
    api.get('media/assets/', {
      params: { kind: 'audio', ...(search.trim() ? { search } : {}) },
    }),
};

export const aiService = {
  generate: ({ prompt, system_instruction, model } = {}) =>
    api.post('ai/generate/', { prompt, system_instruction, model }),
  // Real Gemini-backed translation (AIServiceViewSet.translate).
  // target_lang accepts names or codes (en, fr, es, ht/kreyòl...).
  translate: (text, targetLang = 'English') =>
    api.post('ai/translate/', { text, target_lang: targetLang }),
  // Course AI assists — Creator Studio Phase 18
  generateLessonOutline: (topic, context = '') =>
    api.post('ai/generate_lesson_outline/', { topic, context }),
  generateQuizQuestions: (content, count = 5, questionTypes = 'multiple_choice,true_false,fill_blank') =>
    api.post('ai/generate_quiz_questions/', { content, count, question_types: questionTypes }),
  generateFaq: (content, count = 5) =>
    api.post('ai/generate_faq/', { content, count }),
  improveText: (text, goal = 'clearer') =>
    api.post('ai/improve_text/', { text, goal }),
  translateContent: (text, targetLang = 'English') =>
    api.post('ai/translate_content/', { text, target_lang: targetLang }),
  suggestTags: (title, description = '') =>
    api.post('ai/suggest_tags/', { title, description }),
};

// ─── AI Chat via Cloudflare Worker (OpenAI GPT-4o) ───────────────
// The Worker proxies to OpenAI — the API key stays server-side.
// Falls back to the Django backend if the Worker is unavailable.
const AI_WORKER_URL = import.meta.env.VITE_AI_WORKER_URL || 'https://atelnyo.atelnyo.workers.dev';

export const aiWorkerService = {
  /**
   * Chat with AI via Cloudflare Worker (OpenAI).
   * @param {object} opts
   * @param {string} opts.prompt - User message
   * @param {string} [opts.system_instruction] - System prompt
   * @param {string} [opts.model] - Model name (gpt-4o, gpt-4o-mini)
   * @param {string} [opts.lang] - Response language hint
   * @param {AbortSignal} [opts.signal] - Abort signal so the UI can STOP an in-flight reply
   * @returns {Promise<{text: string, model: string, duration_ms: number}>}
   */
  chat: ({ prompt, system_instruction, model, lang, signal } = {}) =>
    fetch(`${AI_WORKER_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, system_instruction, model, lang }),
      signal,
    }).then(async (resp) => {
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `AI Worker error ${resp.status}`);
      }
      return resp.json();
    }),
};

// ─── Explore catalog — music + talent (Phase 19) ────────────────────
export const exploreService = {
  music: (params) => api.get('explore/music/', { params }),
  talents: (params) => api.get('explore/talents/', { params }),
};

// ─── Explore saved — music + talent bookmarks (Phase 19) ────────────────
export const savedMusicService = {
  list: () => api.get('explore/saved/music/'),
  create: (musicId) => api.post('explore/saved/music/', { music: musicId }),
  remove: (musicId) => api.delete(`explore/saved/music/0/?music_id=${musicId}`),
  isSaved: (musicId) =>
    api.get(`explore/saved/music/?music_id=${musicId}&limit=1`)
      .then((r) => (r?.data?.results || r?.data || []).length > 0)
      .catch(() => false),
};

export const savedTalentsService = {
  list: () => api.get('explore/saved/talents/'),
  create: (talentId) => api.post('explore/saved/talents/', { talent: talentId }),
  remove: (talentId) => api.delete(`explore/saved/talents/0/?talent_id=${talentId}`),
  isSaved: (talentId) =>
    api.get(`explore/saved/talents/?talent_id=${talentId}&limit=1`)
      .then((r) => (r?.data?.results || r?.data || []).length > 0)
      .catch(() => false),
};

// ─── Explore saved — generic bookmarks (product/job/spotlight/event/portfolio/course) ─
// ONE backend table + endpoint (SavedItem, /api/explore/saved/items/)
// backs the save hearts on the detail pages that don't have a
// dedicated SavedMusic / SavedTalent row. Same wire contract as the
// two dedicated services above.
export const savedItemService = {
  list: (type) => api.get('explore/saved/items/', { params: type ? { item_type: type } : {} }),
  create: (type, id) => api.post('explore/saved/items/', { item_type: type, item_id: id }),
  remove: (type, id) => api.delete(`explore/saved/items/0/?item_type=${type}&item_id=${id}`),
  isSaved: (type, id) =>
    api.get(`explore/saved/items/?item_type=${type}&item_id=${id}&limit=1`)
      .then((r) => (r?.data?.results || r?.data || []).length > 0)
      .catch(() => false),
  // Total saves across ALL users for an item — the badge on the
  // detail-page heart button. Public endpoint; 0 on any error so
  // the badge simply hides.
  count: (type, id) =>
    api.get('explore/saved/items/count/', { params: { item_type: type, item_id: id } })
      .then((r) => {
        const body = r?.data || {};
        const n = Number(body?.count ?? body?.data?.count ?? 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
      })
      .catch(() => 0),
  // Batch popularity counts for a whole Explore section — ONE request
  // per content type instead of N. Returns ``{id: count}`` (string
  // keys, JSON-object contract) zero-filled for every requested id;
  // {} on any error so cards simply render without a badge.
  counts: (type, ids) =>
    api.get('explore/saved/items/counts/', { params: { item_type: type, ids: (ids || []).join(',') } })
      .then((r) => {
        const body = r?.data || {};
        const map = body?.counts ?? body?.data?.counts ?? {};
        return map && typeof map === 'object' ? map : {};
      })
      .catch(() => ({})),
};



// ─── Recent views (Phase 19) ────────────────────────────────────────────
// ─── Studio Talent Management ──────────────────────────────────────
export const talentService = {
  list: (params) => api.get('explore/talents/', { params }),
  get: (id) => api.get(`explore/talents/${id}/`),
  create: (data) => api.post('explore/talents/', data),
  update: (id, data) => api.patch(`explore/talents/${id}/`, data),
  delete: (id) => api.delete(`explore/talents/${id}/`),
  getSEO: (id) => api.get(`intelligence/talent/${id}/seo/`),
};

export const recentService = {
  list: () => api.get('explore/recent/'),
  track: (itemType, itemId) =>
    api.post('explore/recent/', { item_type: itemType, item_id: itemId }).catch(() => {}),
};

// ─── Recommendations (Phase 22 + 37) ────────────────────────────────────
export const recommendedService = {
  music: (limit = 6) => api.get('explore/recommended/music/', { params: { limit } }),
  talents: (limit = 4) => api.get('explore/recommended/talents/', { params: { limit } }),
  courses: (limit = 4) => api.get('explore/recommended/courses/', { params: { limit } }),
  events: (limit = 6) => api.get('explore/recommended/events/', { params: { limit } }),
  communities: (limit = 4) => api.get('explore/recommended/communities/', { params: { limit } }),
  jobs: (limit = 4) => api.get('explore/recommended/jobs/', { params: { limit } }),
  products: (limit = 4) => api.get('explore/recommended/products/', { params: { limit } }),
  // Roadmap Faz 3 — merged rail: 1 request instead of 7 parallel calls.
  // Returns { results: [{ item_type, ...item, _score }], count } sorted
  // by composite_score DESC. ``quota`` is an optional per-type weight
  // override (e.g. 'music:0.2,talent:0.15') the FE can use to rebalance.
  all: (limit = 30, quota) =>
    api.get('explore/recommended/all/', {
      params: { limit, ...(quota ? { quota } : {}) },
    }),
};

// ─── Anonymous session key (anonymous-recommendation engine) ────────────
// The backend mints an ``anon_key`` on the first anonymous interaction
// POST and returns it; we persist it here (the "we remember you via
// cookie" contract) and echo it on every subsequent guest request so the
// anonymous engine can personalize the feed from THAT session's
// interests — no account required.
const ANON_KEY_LS = 'atelnyo_anon_key';

export function getAnonKey() {
  try { return localStorage.getItem(ANON_KEY_LS) || ''; } catch (_) { return ''; }
}

function setAnonKey(key) {
  if (!key) return;
  try { localStorage.setItem(ANON_KEY_LS, key); } catch (_) {}
}

// ─── Interaction logging (Phase 22) ─────────────────────────────────────
export const interactionService = {
  // Fire-and-forget batch logging. Anonymous visitors attach their
  // persisted ``anon_key`` to every entry so the backend reuses the SAME
  // session across batches (a fresh mint per batch would scatter the
  // session's history across keys), then persist any freshly-minted key
  // the backend returns so the next batch / feed request carries it.
  log: (entries) => {
    const isGuest = !pickAuthHeader();
    const anonKey = isGuest ? getAnonKey() : '';
    const items = Array.isArray(entries) ? entries : [entries];
    const payload = isGuest && anonKey
      ? items.map((e) => ({ ...e, anon_key: anonKey }))
      : items;
    return api.post('analytics/interaction/', payload)
      .then((res) => {
        if (isGuest && res?.data?.anon_key) setAnonKey(res.data.anon_key);
        return res;
      })
      .catch(() => {});
  },
};

// ─── Communities (Phase 24) ─────────────────────────────────────────────
export const communitiesService = {
  list: (params) => api.get('communities/', { params }),
  get: (slug) => api.get(`communities/${encodeURIComponent(slug)}/`),
  // Founding a community — creator-with-content gated server-side
  // (403 {code:'no_creator_content'} when ineligible). Probe with
  // canCreate() first so the modal only opens for eligible users.
  create: (data) => api.post('communities/', data),
  canCreate: () => api.get('communities/can_create/'),
  join: (slug) => api.post(`communities/${encodeURIComponent(slug)}/join/`),
  leave: (slug) => api.post(`communities/${encodeURIComponent(slug)}/leave/`),
  members: (slug) => api.get(`communities/${encodeURIComponent(slug)}/members/`),
  // Join-request moderation (approval-mode communities, founder/mod only):
  // list pending requests, then approve or reject per user_id.
  joinRequests: (slug) => api.get(`communities/${encodeURIComponent(slug)}/join_requests/`),
  approveJoinRequest: (slug, userId) => api.post(`communities/${encodeURIComponent(slug)}/join_requests/${userId}/approve/`),
  rejectJoinRequest: (slug, userId) => api.post(`communities/${encodeURIComponent(slug)}/join_requests/${userId}/reject/`),
  // Role + discipline management (hierarchy-gated server-side: an actor
  // may only act strictly below their own role; owner-only promote/demote).
  // ``membershipId`` is the CommunityMembership row id (members list rows).
  promote: (slug, membershipId, role) => api.post(`communities/${encodeURIComponent(slug)}/promote/`, { user_id: membershipId, role }),
  demote: (slug, membershipId) => api.post(`communities/${encodeURIComponent(slug)}/demote/`, { user_id: membershipId }),
  mute: (slug, membershipId, durationHours = 24) => api.post(`communities/${encodeURIComponent(slug)}/mute/`, { user_id: membershipId, duration_hours: durationHours }),
  unmute: (slug, membershipId) => api.post(`communities/${encodeURIComponent(slug)}/unmute/`, { user_id: membershipId }),
  banMember: (slug, membershipId, reason = '') => api.post(`communities/${encodeURIComponent(slug)}/ban/`, { user_id: membershipId, reason }),
  unbanMember: (slug, membershipId) => api.post(`communities/${encodeURIComponent(slug)}/unban/`, { user_id: membershipId }),
  bannedMembers: (slug) => api.get(`communities/${encodeURIComponent(slug)}/banned_members/`),
  announcements: (slug) => api.get(`communities/${encodeURIComponent(slug)}/announcements/`),
  files: (slug) => api.get(`communities/${encodeURIComponent(slug)}/files/`),
  linkedCourses: (slug) => api.get(`communities/${encodeURIComponent(slug)}/courses/`),
  getSEO: (id) => api.get(`intelligence/community/${id}/seo/`),
};

// ─── Community events (Phase 24 / 34) ────────────────────────────────────
export const communityEventsService = {
  list: (params) => api.get('community-events/', { params }),
  get: (id) => api.get(`community-events/${id}/`),
  create: (data) => api.post('community-events/', data),
  update: (id, data) => api.patch(`community-events/${id}/`, data),
  delete: (id) => api.delete(`community-events/${id}/`),
};

// ─── Jobs (Phase 25) ────────────────────────────────────────────────────
export const jobService = {
  list: (params) => api.get('jobs/', { params }),
  get: (id) => api.get(`jobs/${id}/`),
  mine: () => api.get('jobs/mine/'),
  create: (data) => api.post('jobs/', data),
  update: (id, data) => api.patch(`jobs/${id}/`, data),
  delete: (id) => api.delete(`jobs/${id}/`),
  publish: (id) => api.post(`jobs/${id}/publish/`),
  cancel: (id) => api.post(`jobs/${id}/cancel/`),
  propose: (jobId, data) => api.post('job-proposals/', { job: jobId, ...data }),
  getSEO: (id) => api.get(`intelligence/job/${id}/seo/`),
};

// ─── Job proposals — client accepts/rejects bids on their jobs ───────────
export const proposalService = {
  list: (params) => api.get('job-proposals/', { params }),
  // ``data`` may carry an optional client_note — the backend persists it on
  // the accepted proposal so the freelancer sees the client's message.
  accept: (id, data) => api.post(`job-proposals/${id}/accept/`, data || {}),
  reject: (id, note) => api.post(`job-proposals/${id}/reject/`, { client_note: note || '' }),
  withdraw: (id) => api.post(`job-proposals/${id}/withdraw/`),
};

// ─── Contracts — created when a proposal is accepted. Read-only list for
// both parties + lifecycle actions (complete / dispute / cancel). The
// backend isolates the queryset to contracts the user is a party to
// (client OR freelancer) and gates each action by role + status.
export const contractService = {
  // GET /api/job-contracts/ — contracts where I'm client or freelancer.
  list: (params) => api.get('job-contracts/', { params }),
  // POST /api/job-contracts/<id>/complete/ — both parties; requires all
  // milestones approved/paid. Marks job completed too.
  complete: (id) => api.post(`job-contracts/${id}/complete/`),
  // POST /api/job-contracts/<id>/dispute/ — either party; active only.
  dispute: (id) => api.post(`job-contracts/${id}/dispute/`),
  // POST /api/job-contracts/<id>/cancel/ — client only; active/disputed.
  cancel: (id) => api.post(`job-contracts/${id}/cancel/`),
};

// ─── Portfolio (Phase 26) ────────────────────────────────────────────────
export const portfolioService = {
  list: (params) => api.get('portfolio/projects/', { params }),
  get: (id) => api.get(`portfolio/projects/${id}/`),
  update: (id, data) => api.patch(`portfolio/projects/${id}/`, data),
  delete: (id) => api.delete(`portfolio/projects/${id}/`),
  view: (id) => api.post(`portfolio/projects/${id}/view/`).catch(() => {}),
  getSEO: (id) => api.get(`intelligence/portfolio/${id}/seo/`),
};

// ─── Marketplace (Phase 32) ──────────────────────────────────────────────
export const marketplaceService = {
  list: (params) => api.get('marketplace/products/', { params }),
  retrieve: (id) => api.get(`marketplace/products/${id}/`),
  update: (id, data) => api.patch(`marketplace/products/${id}/`, data),
  delete: (id) => api.delete(`marketplace/products/${id}/`),
  // Product variants (color/size/...) — seller-managed, real backend.
  variants: (productId) => api.get('marketplace/product-variants/', { params: { product_id: productId } }),
  createVariant: (data) => api.post('marketplace/product-variants/', data),
  updateVariant: (id, data) => api.patch(`marketplace/product-variants/${id}/`, data),
  deleteVariant: (id) => api.delete(`marketplace/product-variants/${id}/`),
  // Create an order. ``hold_payment=true`` keeps it PENDING so the
  // checkout flow can settle it via PayPal/Stripe (instead of the
  // legacy auto-paid internal flow).
  createOrder: (items, holdPayment = true) =>
    api.post('marketplace/orders/', {
      items,
      ...(holdPayment ? { hold_payment: true } : {}),
    }),
  myOrders: () => api.get('marketplace/orders/'),
  getSEO: (id) => api.get(`intelligence/product/${id}/seo/`),
  getCI: (id) => api.get(`intelligence/product/${id}/`),
};

// ─── Checkout + Payments (Phase 32 + PayPal PRIMARY) ─────────────────────
// Provider-agnostic checkout surface. ``provider`` defaults to 'paypal'
// (PRIMARY) on the backend; pass 'stripe' explicitly for the SECONDARY
// provider. All authoritative payment logic lives server-side — the
// frontend only ever exchanges safe references (PayPal order ids,
// Stripe client secrets).
export const checkoutService = {
  // Create a payment for a marketplace order.
  // Returns { transaction_id, provider, paypal_order_id | client_secret }
  createOrder: (orderId, provider = 'paypal', affiliateAttributionToken) =>
    api.post('checkout/order/', {
      order_id: orderId,
      provider,
      ...(affiliateAttributionToken ? { affiliate_attribution_token: affiliateAttributionToken } : {}),
    }),

  // Premium subscription (PayPal Subscriptions / Stripe one-time).
  // PayPal returns { subscription_id, approve_url, status }.
  premium: (plan, provider = 'paypal') =>
    api.post('checkout/premium/', { plan, provider }),

  // Toggle auto-renewal: turn on/off automatic renewal.
  // POST /api/premium/auto-renew/ { auto_renew: bool }
  toggleAutoRenew: (autoRenew) =>
    api.post('premium/auto-renew/', { auto_renew: autoRenew }),

  // Fund a contract milestone (escrow). PayPal returns paypal_order_id
  // with intent=AUTHORIZE; funds release on milestone approval.
  escrow: (milestoneId, provider = 'paypal') =>
    api.post('checkout/escrow/', { milestone_id: milestoneId, provider }),

  // Pay for a paid community event ticket. Creates a RESERVED ticket +
  // pending Transaction + PayPal order (or Stripe PaymentIntent).
  // PayPal returns { ticket_id, transaction_id, paypal_order_id } — the
  // capture endpoint / webhook confirms the ticket on payment success.
  eventTicket: (eventId, provider = 'paypal') =>
    api.post('checkout/event/', { event_id: eventId, provider }),

  // Capture an approved PayPal order (webhook-first confirmation).
  capturePaypal: (transactionId, paypalOrderId) =>
    api.post('checkout/paypal/capture/', {
      transaction_id: transactionId,
      paypal_order_id: paypalOrderId,
    }),

  // Refund a PayPal transaction (full or partial). Buyer or staff only.
  refundPaypal: (transactionId, amount) =>
    api.post('checkout/paypal/refund/', {
      transaction_id: transactionId,
      ...(amount ? { amount } : {}),
    }),
};

// PayPal configuration — exposes ONLY the publishable client id + mode.
// The client secret never leaves the backend.
export const paymentConfigService = {
  // Backend derives eligibility + safe config from its own env.
  // { provider: 'paypal', client_id, mode, configured }
  config: () => api.get('checkout/paypal/config/').catch(() => null),
};

// ─── Wallet (Phase 28 + PayPal top-up) ─────────────────────────────────
// Full wallet surface for Creator Studio + the wallet hub: balance,
// ledger, payout accounts (bank/PayPal/mobile/crypto), payout requests,
// tips, and identity verification status.
export const walletService = {
  // GET /api/wallet/me/ — balance + lifetime totals (auto-creates wallet).
  // NB: the endpoint is /wallet/me/ (WalletViewSet.me), not /wallet/.
  me: () => api.get('wallet/me/'),
  // GET /api/wallet/transactions/?limit=&type= — immutable ledger.
  transactions: (params) => api.get('wallet/transactions/', { params }),
  // Payout accounts — where funds can be withdrawn to.
  payoutAccounts: () => api.get('wallet/payout-accounts/'),
  createPayoutAccount: (data) => api.post('wallet/payout-accounts/', data),
  updatePayoutAccount: (id, data) => api.patch(`wallet/payout-accounts/${id}/`, data),
  deletePayoutAccount: (id) => api.delete(`wallet/payout-accounts/${id}/`),
  setDefaultPayoutAccount: (id) =>
    api.patch(`wallet/payout-accounts/${id}/`, { is_default: true }),
  // PayPal OAuth Connect — link a PayPal account for payouts.
  paypalConnect: (redirectUri) => api.get('wallet/payout-accounts/paypal/connect/', {
    params: redirectUri ? { redirect_uri: redirectUri } : {},
  }),
  // Payout requests (withdrawals).
  payouts: (params) => api.get('wallet/payouts/', { params }),
  requestPayout: (data) => api.post('wallet/payouts/', data),
  // Tips.
  tipsSent: (params) => api.get('tips/sent/', { params }),
  tipsReceived: (params) => api.get('tips/received/', { params }),
  sendTip: (data) => api.post('tips/send/', data),
  // Public top-tippers leaderboard for ONE creator (profile page card).
  creatorTipLeaderboard: (userId) => api.get(`tips/leaderboard/user/${encodeURIComponent(userId)}/`),
  // Phase 60 — Direct PayPal tips (no wallet balance needed): create the
  // server-side order, then capture it after the payer approves.
  tipPaypalOrder: (data) => api.post('tips/paypal/order/', data),
  tipPaypalCapture: (data) => api.post('tips/paypal/capture/', data),
  // Identity verification (payout gate).
  identityStatus: () => api.get('identity/verification/'),
  submitIdentity: (data) => api.post('identity/verification/', data),
};

// ─── Wallet top-up — deposit funds into the wallet balance via PayPal ──
// The backend owns the amount + capture; the frontend only exchanges safe
// PayPal order ids (same contract as checkoutService).
export const walletTopupService = {
  // POST /api/checkout/wallet/deposit/  → { paypal_order_id, amount, status }
  deposit: (amount, provider = 'paypal') =>
    api.post('checkout/wallet/deposit/', { amount, provider }),
  // POST /api/checkout/wallet/capture/  → { status, capture_id, balance }
  capture: (paypalOrderId) =>
    api.post('checkout/wallet/capture/', { paypal_order_id: paypalOrderId }),
  // GET /api/checkout/paypal/config/ → { configured, client_id, topup_min, topup_max }
  config: () => api.get('checkout/paypal/config/'),
};

// ─── Platform config (admin key-value store) ────────────────────────────
// Staff-only CRUD for runtime platform settings (wallet top-up limits,
// upload caps, toggles). Backed by the PlatformConfig model.
export const adminPlatformConfigService = {
  // GET /api/admin/platform-config/ — list all config rows
  list: (params) => api.get('admin/platform-config/', { params }),
  // PATCH /api/admin/platform-config/<id>/ — update a typed value
  update: (id, data) => api.patch(`admin/platform-config/${id}/`, data),
  // POST /api/admin/platform-config/ — create a new key (typed)
  create: (data) => api.post('admin/platform-config/', data),
  // DELETE /api/admin/platform-config/<id>/ — remove a key
  remove: (id) => api.delete(`admin/platform-config/${id}/`),
  // POST /api/admin/platform-config/<id>/test/ — validate the stored key
  test: (id) => api.post(`admin/platform-config/${id}/test/`),
};

// ─── Events (Phase 34) ──────────────────────────────────────────────────
export const eventsService = {
  upcoming: (params) => api.get('community-events/upcoming/', { params }),
  ticket: (eventId, quantity = 1) =>
    api.post('event-tickets/', { event: eventId, quantity }),
};

// ─── Activity feed (Phase 30 + Phase 58 read tracking) ────────────────────
export const activityFeedService = {
  list: (userId, cursor) =>
    api.get('activity/feed/', { params: { ...(cursor ? { cursor } : {}), ...(userId ? { user_id: userId } : {}) } }),
  unreadCount: () => api.get('activity/feed/unread_count/'),
  markRead: (eventId) =>
    api.post('activity/feed/mark_read/', { id: eventId }),
  markAllRead: () =>
    api.post('activity/feed/mark_all_read/'),
  // Phase 59 — creator decides on a profile invitation (hire / collab /
  // book). Accepting auto-opens the DM thread with the requester.
  respond: (eventId, decision) =>
    api.post('activity/feed/respond/', { id: eventId, decision }),
};

// ─── Normalized categories (migration 0096) ──────────────────────────────
export const categoryService = {
  // list(scope) → [{id, scope, name, slug, icon}] for one content scope
  // ('course' | 'product' | 'music' | 'portfolio' | 'community' | 'spotlight').
  list: (scope) => api.get('categories/', { params: { scope } }),
};

// ─── Home Feed (Phase 2 / Explore V2) ────────────────────────────────────
export const feedService = {
  // ``engine`` switches the backend between the classic HomeFeedBuilder
  // ('home', default) and the personalized DEIEFeedService ('deie').
  // Anonymous visitors also echo their persisted ``anon_key`` so the
  // anonymous engine personalizes the guest feed (geo + lang + session
  // interests); without a key the backend serves the shared cold-start.
  home: (limit = 6, engine = 'home') => {
    const params = { limit, engine };
    if (!pickAuthHeader()) {
      const anonKey = getAnonKey();
      if (anonKey) params.anon_key = anonKey;
    }
    return api.get('feed/home/', { params });
  },
};

// ─── Creator analytics (Phase 38) ────────────────────────────────────────
export const analyticsService = {
  summary: () => api.get('analytics/summary/'),
  revenueTrend: (days = 30) => api.get('analytics/trend/revenue/', { params: { days } }),
  engagementTrend: (days = 30) => api.get('analytics/trend/engagement/', { params: { days } }),
  // 30-day public-profile view evolution (owner-scoped). Backed by the
  // per-day ProfileViewDay counter that track_view maintains.
  viewTrend: (days = 30) => api.get('analytics/trend/views/', { params: { days } }),
  topProducts: () => api.get('analytics/top_products/'),
  audience: () => api.get('analytics/audience/'),
};

// ─── Referral & Affiliate (Phase 39) ────────────────────────────────────
export const referralService = {
  code: () => api.get('referral/code/'),
  stats: () => api.get('referral/stats/'),
  referrals: (limit = 10) => api.get('referral/referrals/', { params: { limit } }),
  commissions: (limit = 10) => api.get('referral/commissions/', { params: { limit } }),
};

// ─── Cross-module search (Phase 29) ────────────────────────────────────
export const searchService = {
  // Faz 1 (unified search routing) — the Explore search bar now calls
  // /api/search/ with an optional ``types`` CSV so it can scope the
  // query to the active chip (e.g. types=music when the Music chip is
  // selected) instead of firing 8 parallel per-module fetches.
  search: (q, types) =>
    api.get('search/', {
      params: { q, ...(types ? { types } : {}) },
    }),
  // Trending hashtags — GET /api/search/trending/hashtags/?hours=&limit=
  // Ranked by the Trending Score (velocity + acceleration + engagement +
  // unique creators + geo spread). Public, no auth required.
  trendingHashtags: (opts = {}) =>
    api.get('search/trending/hashtags/', {
      params: { hours: opts.hours || 24, limit: opts.limit || 10 },
    }),
};

// ─── Achievements (Phase 42) ────────────────────────────────────────────
export const achievementService = {
  summary: () => api.get('achievements/summary/'),
  // GET /api/achievements/user/<user_id>/ — PUBLIC endpoint returning
  // another user's earned badges ({total_earned, achievements, earned_keys}).
  // Used by the creator public profile so visitors see the OWNER's
  // achievements (not the viewer's).
  forUser: (userId) => api.get(`achievements/user/${encodeURIComponent(userId)}/`),
};

// ─── Creator Spotlight (Phase 47) ─────────────────────────────────────
// Backs the hidden 5-tap option in Settings (apply) and the Spotlight
// chip in Explore (list). All endpoints are JWT-aware; the public
// list is also callable anonymously so the chip can render on first
// paint, before the user's session has been hydrated.
export const spotlightService = {
  // Phase 47 — public + apply + my applications
  list: () => api.get('spotlight/'),
  apply: (payload) => api.post('spotlight/', payload),
  mine: () => api.get('spotlight/mine/'),
  getSEO: (id) => api.get(`intelligence/spotlight/${id}/seo/`),
  // Phase 48 — message thread. GET returns the full thread;
  // POST creates a new line. The sender_role is server-derived
  // from request.user (admin if is_staff, else applicant) —
  // the FE never sends it.
  messages: (id) => api.get(`spotlight/${id}/messages/`),
  postMessage: (id, body) => api.post(`spotlight/${id}/messages/`, { body }),
  // Phase 48 — KYC side-table. GET returns the KYC (404 if not
  // on file yet); PUT replaces it. The accepted_terms field
  // must be true on the create path (server enforces).
  kyc: (id) => api.get(`spotlight/${id}/kyc/`),
  putKyc: (id, payload) => api.put(`spotlight/${id}/kyc/`, payload),
  // Phase 48 — admin actions.
  requestInfo: (id, body) => api.post(`spotlight/${id}/request-info/`, { body }),
  // Phase 48 — owner re-apply after rejection. Hits the
  // ``/reapply/`` action which flips status back to pending
  // and clears the rejection note (history stays in the thread).
  reapply: (id) => api.post(`spotlight/${id}/reapply/`),
  // Phase 58 — related spotlights (same category, excluding current).
  related: (id) => api.get(`spotlight/${id}/related/`),
  // ─── Admin Spotlight (Phase 47/48) — full admin control ─────
  // The `/admin-all/` endpoint returns ALL applications with full
  // detail (KYC + messages included). Admin can filter by status,
  // category, and search by username/title/description.
  adminAll: (params) => api.get('spotlight/admin-all/', { params }),
  // Admin approve/reject/request-info — mirrors the individual
  // endpoints above but these exist for convenience in the admin UI.
  adminApprove: (id) => api.post(`spotlight/${id}/approve/`),
  adminReject: (id, note) => api.post(`spotlight/${id}/reject/`, { review_note: note }),
  adminRequestInfo: (id, body) => api.post(`spotlight/${id}/request-info/`, { body }),

  // Phase 49 §11.2 — Public retrieve by id (deep-link). Hits
  // ``GET /api/spotlight/<pk>/`` and returns the slim
  // ``SpotlightPublicSerializer`` payload — the same shape as the
  // Explore card. The BE's ``retrieve`` action in
  // ``api/views/spotlight.py`` enforces the slim serializer for
  // approved rows when the requester is NOT the owner or staff,
  // which is the case for any anonymous deep-link visitor. The
  // detail page renders this payload full-page. PII is never in
  // this payload — the slim serializer has no KYC + no messages.
  //
  // ``id`` must be a positive integer from the BE router. The
  // page component rejects non-numeric ids BEFORE calling here
  // (see SpotlightDetail.jsx) so we don't waste a round-trip on a
  // 404-via-parser-error path.
  retrieve: (id) => api.get(`spotlight/${id}/`),
  // Phase Business Spotlight — Upload cover image for Spotlight card.
  // Premium users can upload directly; non-premium paste URLs.
  uploadCoverImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('spotlight/upload-cover/', formData, {
      timeout: 60000,
      transformRequest: [(data, headers) => {
        delete headers['Content-Type'];
        return data;
      }],
    });
  },
};

// ─── Company Profile (Phase Company) ───────────────────────────
// Dedicated in-app company page. A signed-in user creates ONE
// company profile; it goes public only after admin approval
// (same review workflow as Spotlight). The public page links the
// owner's approved Spotlight, active products, and published
// portfolio (the serializer aggregates them server-side).
export const companyProfileService = {
  // GET /api/companies/ — public approved list (anonymous OK).
  list: (params) => api.get('companies/', { params }),
  // GET /api/companies/<id>/ — public approved retrieve (slim
  // shape with linked content); owner + staff read any status.
  get: (id) => api.get(`companies/${id}/`),
  // POST /api/companies/ — create my profile (status pending).
  create: (payload) => api.post('companies/', payload),
  // GET /api/companies/mine/ — my own profile (any status).
  mine: () => api.get('companies/mine/'),
  // PATCH /api/companies/<id>/ — owner edit. Editing an approved
  // profile drops it back to pending for re-approval.
  update: (id, payload) => api.patch(`companies/${id}/`, payload),
  getSEO: (id) => api.get(`intelligence/company/${id}/seo/`),
  // ─── Admin (staff-only) ────────────────────────────────────
  // GET /api/companies/admin-all/ — full queue + history.
  adminAll: (params) => api.get('companies/admin-all/', { params }),
  // POST /api/companies/<id>/approve/ — approve (goes public).
  approve: (id, note) =>
    api.post(`companies/${id}/approve/`, note ? { review_note: note } : {}),
  // POST /api/companies/<id>/reject/ — reject with a required note.
  reject: (id, note) => api.post(`companies/${id}/reject/`, { review_note: note }),
  // POST /api/companies/<id>/verify/ — toggle verified badge.
  toggleVerified: (id) => api.post(`companies/${id}/verify/`),
};

// ─── Business Spotlight (Phase Business Spotlight) ────────────────────────
// Business profiles can apply for Spotlight to showcase their brand,
// products, and services alongside Creator Spotlights.
export const businessSpotlightService = {
  // GET /api/business-spotlight-public/ — public approved list (anonymous OK).
  list: (params) => api.get('business-spotlight-public/', { params }),
  // GET /api/business-spotlight-public/<id>/ — public approved retrieve.
  get: (id) => api.get(`business-spotlight-public/${id}/`),
  // POST /api/business-spotlight/ — submit Business Spotlight application.
  apply: (payload) => api.post('business-spotlight/', payload),
  // GET /api/business-spotlight/mine/ — my own applications (auth required).
  mine: () => api.get('business-spotlight/mine/'),
  // POST /api/business-spotlight/<id>/approve/ — admin approve.
  approve: (id, note) =>
    api.post(`business-spotlight/${id}/approve/`, note ? { note } : {}),
  // POST /api/business-spotlight/<id>/reject/ — admin reject.
  reject: (id, note) => api.post(`business-spotlight/${id}/reject/`, { note }),
  // POST /api/business-spotlight/<id>/request-info/ — admin request info.
  requestInfo: (id, note) => api.post(`business-spotlight/${id}/request-info/`, { note }),
  // GET /api/business-achievements/ — achievements feed.
  achievements: (businessId) => api.get('business-achievements/', { params: businessId ? { business_id: businessId } : {} }),
};

// ─── Business Profiles (Phase Business) ──────────────────────────────
// A SEPARATE account branch — a business identity owned by the
// account, managed from its own workspace. Distinct from the
// CompanyProfile (admin-approved public page) and from the Creator
// branch. The API is owner-scoped: strangers get 404s.
export const businessProfileService = {
  // GET /api/business/profiles/ — my business profiles (auth).
  list: () => api.get('business/profiles/'),
  // GET /api/business/profiles/<slug>/ — my profile (pk or slug).
  get: (id) => api.get(`business/profiles/${encodeURIComponent(id)}/`),
  // GET /api/business/profiles/mine/ — my single profile (404 if none).
  mine: () => api.get('business/profiles/mine/'),
  // GET /api/business/profiles/eligibility/ — the BACKEND's business
  // truth for the current user ({can_create, workspace_locked}). The
  // hub uses this instead of the client-side is_creator flag, which
  // stays stale after a Creator suspension (CreatorProfile is not
  // deactivated by the existing suspend action).
  eligibility: () => api.get('business/profiles/eligibility/'),
  // POST /api/business/profiles/ — create (starts active, no approval gate).
  create: (payload) => api.post('business/profiles/', payload),
  // PATCH /api/business/profiles/<id>/ — owner edit.
  update: (id, payload) => api.patch(`business/profiles/${id}/`, payload),
  // POST /api/business/profiles/<id>/deactivate/ — owner soft-deactivate.
  deactivate: (id) => api.post(`business/profiles/${id}/deactivate/`),
  // POST /api/business/profiles/<id>/activate/ — owner re-activate.
  activate: (id) => api.post(`business/profiles/${id}/activate/`),
  // ─── Phase 5 — Seller capability (commerce gate) ──────────────────
  // GET  /api/business/profiles/<id>/seller/ — capability + KYC status.
  seller: (id) => api.get(`business/profiles/${id}/seller/`),
  // POST /api/business/profiles/<id>/seller/activate/ — KYC-gated on.
  sellerActivate: (id) => api.post(`business/profiles/${id}/seller/activate/`),
  // POST /api/business/profiles/<id>/seller/deactivate/ — owner soft stop.
  sellerDeactivate: (id) => api.post(`business/profiles/${id}/seller/deactivate/`),
  // ─── Phase 6b — public review wall ───────────────────────────
  // GET /api/business/profiles/<slug>/reviews/ — PUBLIC reviews of an
  // ACTIVE profile (anonymous OK). Same active-only rule as retrieve.
  reviews: (id) => api.get(`business/profiles/${encodeURIComponent(id)}/reviews/`),
  // ─── Phase 7a — public FAQ walls ──────────────────────────────
  // GET /api/business/profiles/<slug>/business-faqs/ — PUBLIC business
  // FAQ wall (ACTIVE rows of an ACTIVE profile, anonymous OK).
  businessFaqs: (id) => api.get(`business/profiles/${encodeURIComponent(id)}/business-faqs/`),
  // GET /api/business/profiles/<slug>/product-faqs/ — PUBLIC product
  // FAQ wall (ACTIVE rows of ACTIVE items, carries item_name).
  productFaqs: (id) => api.get(`business/profiles/${encodeURIComponent(id)}/product-faqs/`),
  // CI SEO — /api/intelligence/business/<id>/seo/
  getSEO: (id) => api.get(`intelligence/business/${id}/seo/`),
};

// ─── Business Orders (Phase 5 — wallet-settled commerce) ───────────
// Customers order catalog items; payment settles through the platform
// Wallet (no external gateway). Owners manage lead status + refunds
// and read the revenue summary.
export const businessOrderService = {
  // POST /api/business/orders/ — customer places an order (item, qty, note).
  create: (payload) => api.post('business/orders/', payload),
  // GET  /api/business/orders/ — OWNER view (optional ?profile=<slug>).
  list: (profileSlug) => api.get('business/orders/', {
    params: profileSlug ? { profile: profileSlug } : undefined,
  }),
  // GET  /api/business/orders/mine/ — CUSTOMER view of their orders.
  mine: (profileSlug) => api.get('business/orders/mine/', {
    params: profileSlug ? { profile: profileSlug } : undefined,
  }),
  // GET  /api/business/orders/<id>/ — owner or the customer.
  get: (id) => api.get(`business/orders/${id}/`),
  // PATCH /api/business/orders/<id>/status/ — owner lead transition.
  status: (id, payload) => api.patch(`business/orders/${id}/status/`, payload),
  // POST /api/business/orders/<id>/cancel/ — customer cancel (new+unpaid).
  cancel: (id) => api.post(`business/orders/${id}/cancel/`),
  // POST /api/business/orders/<id>/pay/ — customer pays from wallet.
  pay: (id) => api.post(`business/orders/${id}/pay/`),
  // POST /api/business/orders/<id>/refund/ — owner refunds a paid order.
  refund: (id) => api.post(`business/orders/${id}/refund/`),
  // GET  /api/business/orders/revenue/ — owner analytics (owner-only).
  revenue: (profileSlug) => api.get('business/orders/revenue/', {
    params: profileSlug ? { profile: profileSlug } : undefined,
  }),
  // GET  /api/business/orders/analytics/ — business dashboard
  // aggregates (customers, revenue by month, top items, funnel).
  analytics: (profileSlug) => api.get('business/orders/analytics/', {
    params: profileSlug ? { profile: profileSlug } : undefined,
  }),
  // POST /api/business/orders/<id>/review/ — the CUSTOMER reviews
  // their FULFILLED order ({rating: 1-5, comment?}). One per order.
  review: (id, payload) => api.post(`business/orders/${id}/review/`, payload),
};

// ─── Business FAQs (Phase 7a) ─────────────────────────────────────
// Business-level FAQs answer questions about the business itself
// (location, hours, payments, returns...). Owner-scoped backend;
// the public wall rides on businessProfileService.businessFaqs().
export const businessFaqService = {
  // GET /api/business/faqs/?profile=<slug> — my business FAQs (owner).
  list: (profileSlug) => api.get('business/faqs/', {
    params: profileSlug ? { profile: profileSlug } : undefined,
  }),
  // POST /api/business/faqs/ — add ({business_profile, question, answer, sort_order?, status?}).
  create: (payload) => api.post('business/faqs/', payload),
  // PATCH /api/business/faqs/<id>/ — owner edit (incl. reorder + status).
  update: (id, payload) => api.patch(`business/faqs/${id}/`, payload),
  // DELETE /api/business/faqs/<id>/ — owner delete.
  remove: (id) => api.delete(`business/faqs/${id}/`),
};

// ─── Business Product FAQs (Phase 7a) ─────────────────────────────
// Product FAQs answer questions about ONE catalog item. Managed from
// the catalog editor; the public wall rides on
// businessProfileService.productFaqs().
export const businessProductFaqService = {
  // GET /api/business/product-faqs/?item=<id> (or ?profile=<slug>) —
  // my product FAQs, ordered by sort_order (owner).
  list: (itemId) => api.get('business/product-faqs/', {
    params: itemId ? { item: itemId } : undefined,
  }),
  // POST /api/business/product-faqs/ — add ({catalog_item, question, answer, sort_order?, status?}).
  create: (payload) => api.post('business/product-faqs/', payload),
  // PATCH /api/business/product-faqs/<id>/ — owner edit.
  update: (id, payload) => api.patch(`business/product-faqs/${id}/`, payload),
  // DELETE /api/business/product-faqs/<id>/ — owner delete.
  remove: (id) => api.delete(`business/product-faqs/${id}/`),
};

// Phase 8 — customer inquiries (messages). ANY authenticated user can
// ask an ACTIVE business a question; the owner replies/closes from the
// workspace Messages tab. The customer reads their own threads from
// the public page contact modal (?mine=1).
export const businessInquiryService = {
  // POST /api/business/inquiries/ — customer asks ({business_profile, catalog_item?, topic, subject, body}).
  create: (payload) => api.post('business/inquiries/', payload),
  // GET  /api/business/inquiries/ — OWNER list (?profile=<slug>&status=).
  list: (params) => api.get('business/inquiries/', { params }),
  // GET  /api/business/inquiries/?mine=1 — CUSTOMER's own threads.
  mine: (params) => api.get('business/inquiries/', { params: { ...(params || {}), mine: 1 } }),
  // GET  /api/business/inquiries/<id>/ — owner or the inquiry's customer.
  get: (id) => api.get(`business/inquiries/${id}/`),
  // POST /api/business/inquiries/<id>/reply/ — owner reply (new → replied).
  reply: (id, reply) => api.post(`business/inquiries/${id}/reply/`, { reply }),
  // POST /api/business/inquiries/<id>/close/ — owner OR the customer.
  close: (id) => api.post(`business/inquiries/${id}/close/`),
};

// ─── Business Catalog (Phase 4) ─────────────────────────────────────
// Items belong to a Business Profile — never to the Creator Profile.
// The owner workspace manages them; the ONLY public read is the
// ``public`` action (ACTIVE items of an ACTIVE profile) used by the
// public business page. Items are never in Explore / Home Feed /
// Search / marketplace endpoints.
export const businessCatalogService = {
  // GET /api/business/catalog/?profile=<slug> — my items (owner).
  list: (profileSlug) => api.get('business/catalog/', {
    params: profileSlug ? { profile: profileSlug } : undefined,
  }),
  // POST /api/business/catalog/ — add an item to one of MY profiles.
  create: (payload) => api.post('business/catalog/', payload),
  // PATCH /api/business/catalog/<id>/ — owner edit (incl. status).
  update: (id, payload) => api.patch(`business/catalog/${id}/`, payload),
  // DELETE /api/business/catalog/<id>/ — owner delete (operational row).
  remove: (id) => api.delete(`business/catalog/${id}/`),
  // GET /api/business/catalog/public/?profile=<slug> — PUBLIC: active
  // items of an ACTIVE profile (anonymous OK). The only public surface.
  public: (profileSlug) => api.get('business/catalog/public/', {
    params: { profile: profileSlug },
  }),
};

// ─── Role Permission Matrix (Phase 49 §11.3) ──────────────────
// Single source of truth for FE role-derived UI gates. Owned by the
// PWA Permission Manager (src/pwa/permissions/PermissionManager.js):
// fetched once on cold load → cached manager-side → re-fetched
// explicitly via refreshPermissionsMatrix() after login / logout so
// the current_role flips before the next render cycle.
//
// The endpoint is AllowAny, so a logged-out visitor can fetch the
// matrix too. ``current_role`` is null for anonymous requests and
// the FE defaults to 'anonymous' on its side. Listing the endpoint
// here mirror the matrix-actions surface so a future refactor can
// iterate `permissionsService.actions`, ``permissionsService.roles``,
// ``permissionsService.canBypassEasterEgg``, etc. without touching
// the cached module-level cache.
export const permissionsService = {
  // GET /api/permissions/   — full role × action matrix (cached).
  list: () => api.get('permissions/'),
  // GET /api/permissions/version/   — cache-bust helper. The FE
  // compares against a baked-in `1.0` and re-fetches the full
  // matrix if the schema version drifts on the BE.
  version: () => api.get('permissions/version/'),
};

// ─── Creator Apply (Phase 50 — Prompt 22) ───────────────────
// Full 9-step wizard + autosave + Status Dashboard.
// Backend viewset at /api/identity/creator-apply/.
// The CreatorApplication model now supports: draft, submitted,
// under_review, need_information, approved, rejected, suspended.
// Fields: full_name, date_of_birth, identity_document_url,
// identity_type, country, city, biography, languages, why_creator,
// experience_years, experience_description, education, categories,
// skills, specialties, portfolio_url, portfolio_files,
// portfolio_description, social_links, website_url, contact_email,
// terms_accepted, code_of_conduct_accepted,
// content_guidelines_accepted, terms_accepted_at.
export const creatorIdentityService = {
  // Returns the user's own applications (newest first).
  // Empty array if they've never applied.
  list: () => api.get('identity/creator-apply/'),
  // Alias for clarity
  mine: () => api.get('identity/creator-apply/'),
  // Get a single application by id
  get: (id) => api.get(`identity/creator-apply/${id}/`),
  // Save draft (autosave) — creates or updates with draft status
  saveDraft: (payload) => api.post('identity/creator-apply/', { ...payload, status: 'draft' }),
  // Update draft (autosave) for existing application
  updateDraft: (id, payload) => api.patch(`identity/creator-apply/${id}/`, { ...payload, status: 'draft' }),
  // Submit a fresh application (status → submitted)
  submit: (payload) => api.post('identity/creator-apply/', { ...payload, status: 'submitted' }),
  // Re-submit after revision (for rejected → submitted)
  resubmit: (id, payload) => api.patch(`identity/creator-apply/${id}/`, { ...payload, status: 'submitted' }),
  // Re-apply after rejection
  reapply: (id, payload) => api.patch(`identity/creator-apply/${id}/`, { ...payload, status: 'submitted' }),
  // Delete a draft
  deleteDraft: (id) => api.delete(`identity/creator-apply/${id}/`),
};

// ─── Creator Apply (Admin) — for the Creator Center
// Admin-specific endpoints for the CreatorApplication viewset.
export const creatorAdminService = {
  // GET /api/identity/creator-apply/admin_all/
  list: (params) => api.get('identity/creator-apply/admin_all/', { params }),
  // PATCH /api/identity/creator-apply/<id>/review/
  review: (id, payload) => api.patch(`identity/creator-apply/${id}/review/`, payload),
  // POST /api/identity/creator-apply/<id>/request-info/
  requestInfo: (id, body) => api.post(`identity/creator-apply/${id}/request-info/`, { body }),
  // POST /api/identity/creator-apply/<id>/suspend/
  suspend: (id, reason) => api.post(`identity/creator-apply/${id}/suspend/`, { reason }),
  // POST /api/identity/creator-apply/<id>/restore/
  restore: (id) => api.post(`identity/creator-apply/${id}/restore/`),
  // GET /api/identity/creator-apply/<id>/reports/
  reports: (id) => api.get(`identity/creator-apply/${id}/reports/`),
  // GET /api/identity/creator-apply/<id>/violations/
  violations: (id) => api.get(`identity/creator-apply/${id}/violations/`),
  // GET /api/identity/creator-apply/<id>/notes/
  internalNotes: (id) => api.get(`identity/creator-apply/${id}/notes/`),
  // POST /api/identity/creator-apply/<id>/notes/
  addInternalNote: (id, note) => api.post(`identity/creator-apply/${id}/notes/`, { note }),
};

// ─── Admin User Management (Phase Premium) ─────────────────────────
// Backs the admin "Premium Users" panel: list users (with premium
// status + expiry), grant premium to a user, revoke premium. All
// endpoints are staff-gated server-side (can_manage_billing).
export const adminUserService = {
  // GET /api/admin/users/?premium=true|false&search=q
  // Returns { id, username, email, is_active, is_staff, date_joined,
  //          last_login, is_banned, is_premium, premium_until,
  //          active_sessions, last_login_attempt }
  list: (params) => api.get('admin/users/', { params }),
  // POST /api/admin/users/<id>/grant_premium/  { plan, days? }
  grantPremium: (id, plan, days) =>
    api.post(`admin/users/${id}/grant_premium/`, {
      plan,
      ...(days ? { days } : {}),
    }),
  // POST /api/admin/users/<id>/revoke_premium/  { reason? }
  revokePremium: (id, reason) =>
    api.post(`admin/users/${id}/revoke_premium/`, { reason: reason || '' }),
  // POST /api/admin/users/<id>/change_plan/  { plan, days? } — upgrade/
  // downgrade: cancels active subs + grants the new plan. Returns
  // { id, user_id, from_plans, to_plan, cancelled, status, expires_at }.
  changePlan: (id, plan, days) =>
    api.post(`admin/users/${id}/change_plan/`, {
      plan,
      ...(days ? { days } : {}),
    }),
  // POST /api/admin/users/<id>/change_password/  { password }
  // Admin-only: directly set a user's password without requiring
  // the current password. Intended for support/reset flows.
  changePassword: (id, password) =>
    api.post(`admin/users/${id}/change_password/`, { password }),
  // GET /api/admin/users/<id>/premium_history/  — grant/revoke timeline
  // (who, when, which plan). Returns [{ id, plan, status, started_at,
  //   expires_at, cancelled_at, granted_by_username, revoked_by_username,
  //   payment_ref, source }] newest first.
  premiumHistory: (id) => api.get(`admin/users/${id}/premium_history/`),
  // GET /api/admin/users/premium_stats/  — aggregate KPIs for the stats
  // bar: total/premium/non-premium counts, potential monthly+yearly
  // revenue, avg approval + pending days, active value, by_plan.
  premiumStats: () => api.get('admin/users/premium_stats/'),
  // GET /api/admin/users/<id>/roles/  — the user's AdminRole assignments
  // + Django flags. Returns { user_id, is_staff, is_superuser, is_active,
  //   roles: [{ id, role, active, granted_by, granted_at, revoked_at }] }.
  roles: (id) => api.get(`admin/users/${id}/roles/`),
  // POST /api/admin/users/<id>/set_role/  { role, active, reason? }
  // Grant (active=true) or revoke (active=false) one AdminRole.
  setRole: (id, role, active, reason) =>
    api.post(`admin/users/${id}/set_role/`, {
      role,
      active: !!active,
      reason: reason || '',
    }),
  // POST /api/admin/users/<id>/deactivate/  { reason? }
  // is_active=False + revoke all sessions (user can no longer log in).
  deactivate: (id, reason) =>
    api.post(`admin/users/${id}/deactivate/`, { reason: reason || '' }),
  // POST /api/admin/users/<id>/activate/  { reason? } — re-activate.
  activate: (id, reason) =>
    api.post(`admin/users/${id}/activate/`, { reason: reason || '' }),
  // GET /api/admin/users/<id>/activity_history/  — unified timeline of
  // the user's sensitive activity (admin actions + logins + sessions),
  // newest first. Returns { events: [{ kind, action, actor, created_at,
  //   metadata }] }.
  activityHistory: (id) => api.get(`admin/users/${id}/activity_history/`),
  // POST /api/admin/users/<id>/suspend/  { days?, reason? }
  // Temporary ban (1-365 days) + force-logout all sessions.
  suspend: (id, days, reason) =>
    api.post(`admin/users/${id}/suspend/`, {
      ...(days ? { days } : {}),
      reason: reason || '',
    }),
  // POST /api/admin/users/<id>/ban/  { reason?, permanent? }
  // Permanent or temporary ban + force-logout all sessions.
  ban: (id, reason, permanent = true) =>
    api.post(`admin/users/${id}/ban/`, {
      reason: reason || '',
      permanent,
    }),
  // POST /api/admin/users/<id>/restore/  { reason? }
  // Lift all active bans for the user.
  restore: (id, reason) =>
    api.post(`admin/users/${id}/restore/`, { reason: reason || '' }),
  // POST /api/admin/users/<id>/force_logout/  { reason?, device_jti? }
  // Revoke active sessions (all or one specific device).
  forceLogout: (id, reason, deviceJti) =>
    api.post(`admin/users/${id}/force_logout/`, {
      reason: reason || 'force_logout',
      ...(deviceJti ? { device_jti: deviceJti } : {}),
    }),
};

// ─── Media Provider Center (Phase 53) ─────────────────────────────────
// ─── Creator Public Profile (Phase 54) ─────────────────────────────
// ─── Creator Goals ──────────────────────────────────────────
export const creatorGoalService = {
  list: () => api.get('creator-goals/'),
  create: (data) => api.post('creator-goals/', data),
  update: (id, data) => api.patch(`creator-goals/${id}/`, data),
  delete: (id) => api.delete(`creator-goals/${id}/`),
  complete: (id) => api.post(`creator-goals/${id}/complete/`),
  archive: (id) => api.post(`creator-goals/${id}/archive/`),
  templates: (lang) => api.get('creator-goals/templates/', { params: { lang } }),
};

// ─── Creator Progression ────────────────────────────────────
export const creatorProgressionService = {
  get: () => api.get('creator-progression/'),
};

// ─── Creator Profile Health & Pinning ───────────────────────
export const creatorProfileHealthService = {
  get: () => api.get('creator-profile-health/'),
  pin: (data) => api.patch('creator-profile-health/pin/', data),
};

// ─── Creator Profile (existing) ─────────────────────────────
export const creatorProfileService = {
  // GET /api/creator-profiles/ — list all visible profiles
  list: (params) => api.get('creator-profiles/', { params }),
  // GET /api/creator-profiles/<slug>/ — profile detail
  get: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/`),
  // POST /api/creator-profiles/<slug>/follow/ — follow/unfollow toggle
  follow: (slug) => api.post(`creator-profiles/${encodeURIComponent(slug)}/follow/`),
  // GET /api/creator-profiles/<slug>/followers/ — list followers
  followers: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/followers/`),
  // GET /api/creator-profiles/<slug>/following/ — list following
  following: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/following/`),
  // GET /api/creator-profiles/<slug>/courses/ — creator's courses
  courses: (slug, params) => api.get(`creator-profiles/${encodeURIComponent(slug)}/courses/`, { params }),
  // GET /api/creator-profiles/<slug>/products/ — creator's products
  products: (slug, params) => api.get(`creator-profiles/${encodeURIComponent(slug)}/products/`, { params }),
  // GET /api/creator-profiles/<slug>/portfolio/ — creator's portfolio
  portfolio: (slug, params) => api.get(`creator-profiles/${encodeURIComponent(slug)}/portfolio/`, { params }),
  // GET /api/creator-profiles/<slug>/reviews/ — creator's reviews
  reviews: (slug, params) => api.get(`creator-profiles/${encodeURIComponent(slug)}/reviews/`, { params }),
  // GET /api/creator-profiles/<slug>/jobs/ — creator's published jobs
  jobs: (slug, params) => api.get(`creator-profiles/${encodeURIComponent(slug)}/jobs/`, { params }),
  picks: (slug, params) => api.get(`creator-profiles/${encodeURIComponent(slug)}/picks/`, { params }),
  setPicksVisibility: (slug, isPublic) =>
    api.patch(`creator-profiles/${encodeURIComponent(slug)}/`, {
      show_picks_publicly: !!isPublic,
    }),
  // ─── Profile Analytics ──────────────────────────────────────────
  trackView: (slug) => api.post(`creator-profiles/${encodeURIComponent(slug)}/track-view/`),
  viewCount: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/view-count/`),
  trackClick: (slug, button) => api.post(`creator-profiles/${encodeURIComponent(slug)}/track-click/`, { button }),
  analytics: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/analytics/`),
  // ─── Business Actions ───────────────────────────────────────────
  sendMessage: (slug, { subject, body }) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/send-message/`, { subject, body }),
  hire: (slug, { project_title, description, budget, timeline }) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/hire/`, { project_title, description, budget, timeline }),
  collaborate: (slug, { idea, description }) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/collaborate/`, { idea, description }),
  tip: (slug, { amount, message }) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/tip/`, { amount, message }),
  bookService: (slug, { service_name, description, preferred_date }) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/book-service/`, { service_name, description, preferred_date }),
  // ─── Affiliate & Campaigns ──────────────────────────────────────
  affiliateStatus: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/affiliate-status/`),
  campaigns: (slug) => api.get(`creator-profiles/${encodeURIComponent(slug)}/campaigns/`),
  // Phase 60 — Paid creator subscriptions: status + wallet subscribe +
  // direct PayPal order/capture (the backend owns the price).
  subscriptionStatus: (slug) =>
    api.get(`creator-profiles/${encodeURIComponent(slug)}/subscription/status/`),
  subscribeWallet: (slug) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/subscribe/`, {}),
  subscriptionPaypalOrder: (slug) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/subscription/order/`, {}),
  subscriptionPaypalCapture: (slug, paypalOrderId) =>
    api.post(`creator-profiles/${encodeURIComponent(slug)}/subscription/capture/`, {
      paypal_order_id: paypalOrderId,
    }),
  // GET /api/creator-profiles/me/ — my public profile
  getMe: () => api.get('creator-profiles/me/'),
  // PATCH /api/creator-profiles/me/ — update own profile
  updateMe: (data) => api.patch('creator-profiles/me/', data),
  // PATCH /api/creator-profiles/me/settings/ — update section config
  updateSectionConfig: (config) => api.patch('creator-profiles/me/settings/', { section_config: config }),
  // POST /api/creator-profiles/me/upload-avatar/ — upload avatar image
  // NOTE: The axios instance defaults to `Content-Type: application/json`.
  // FormData uploads need the browser to auto-set `multipart/form-data`
  // with the correct boundary. We delete the default Content-Type so
  // axios detects FormData and lets the browser set the right headers.
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('creator-profiles/me/upload-avatar/', formData, {
      timeout: 60000,
      transformRequest: [(data, headers) => {
        delete headers['Content-Type'];
        return data;
      }],
    });
  },
  // POST /api/creator-profiles/me/upload-cover/ — upload cover image
  uploadCover: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('creator-profiles/me/upload-cover/', formData, {
      timeout: 60000,
      transformRequest: [(data, headers) => {
        delete headers['Content-Type'];
        return data;
      }],
    });
  },
  // GET /api/creator-profiles/resolve/<id>/ — resolve slug
  resolve: (identifier) => api.get(`creator-profiles/resolve/${encodeURIComponent(identifier)}/`),
  // CI SEO — /api/intelligence/creator/<id>/seo/
  getSEO: (id) => api.get(`intelligence/creator/${id}/seo/`),
};

// ─── Creator Username System (Phase URL Architecture) ────────────
// Backs the /@username routing system for the Creator Website.
export const usernameService = {
  // GET /api/creator-usernames/check/<username>/ — check availability
  check: (username) => api.get(`creator-usernames/check/${encodeURIComponent(username)}/`),
  // POST /api/creator-usernames/suggest/ — get suggestions
  suggest: (name) => api.post('creator-usernames/suggest/', { name }),
  // POST /api/creator-usernames/claim/ — claim/change username
  claim: (username) => api.post('creator-usernames/claim/', { username }),
  // GET /api/creator-usernames/mine/ — my current username + history
  mine: () => api.get('creator-usernames/mine/'),
  // GET /api/creator-usernames/resolve/<username>/ — resolve @username → profile
  resolve: (username) => api.get(`creator-usernames/resolve/${encodeURIComponent(username)}/`),
  // GET /api/creator-usernames/reserved/ — admin: list reserved
  reserved: () => api.get('creator-usernames/reserved/'),
  // POST /api/creator-usernames/reserved/ — admin: add reserved
  addReserved: (phrase, reason) => api.post('creator-usernames/reserved/add/', { phrase, reason }),
  // DELETE /api/creator-usernames/reserved/remove/ — admin: remove reserved
  removeReserved: (phrase) => api.delete('creator-usernames/reserved/remove/', { data: { phrase } }),
};

// ─── Media Enterprise Services (Phase Enterprise Architecture) ─────────
export const mediaEnterpriseService = {
  // Inspector — unified media view
  inspect: (url) => api.post('media/inspect/', { url }),
  // Health Score
  healthScore: (url) => api.post('media/health-score/', { url }),
  healthSummary: () => api.get('media/health-summary/'),
  // Reference Manager
  reference: (url) => api.post('media/reference/', { url }),
  referenceSummary: () => api.get('media/reference/summary/'),
  // Relationship Engine
  usageByUrl: (url) => api.post('media/usage/', { url }),
  usageByOwner: () => api.get('media/usage/owner/'),
  trackUsage: (data) => api.post('media/usage/track/', data),
  // Smart Replace v2 — auto-update across ALL modules
  smartReplaceV2: (oldUrl, newUrl) => api.post('media/smart-replace-v2/', { old_url: oldUrl, new_url: newUrl }),
  replacePreview: (oldUrl) => api.post('media/replace-preview/', { old_url: oldUrl }),
  // Broken Link Recovery
  reportBroken: (url, statusCode, errorMessage) =>
    api.post('media/broken/report/', { url, status_code: statusCode, error_message: errorMessage }),
  retryBroken: (url) => api.post('media/broken/retry/', { url }),
  recoverBroken: (url) => api.post('media/broken/recover/', { url }),
  hideBroken: (url) => api.post('media/broken/hide/', { url }),
  retryAllBroken: () => api.post('media/broken/retry-all/'),
  // Unused References
  unusedReferences: (days = 90) => api.get('media/unused/', { params: { days } }),
};

// ─── Media Dashboard Service (Creator Experience) ──────────────────
// Backs MyMediaDashboard: drafts, broken, in-progress, activity, pinned.
// ─── Admin Media Center Service (Broken Center + Validation Queue) ──
export const adminMediaService = {
  // GET /api/media/admin/broken-stats/
  brokenStats: () => api.get('media/admin/broken-stats/'),
  // GET /api/media/admin/validation-queue/?status=broken
  validationQueue: (status = 'broken') => api.get('media/admin/validation-queue/', { params: { status } }),
  // POST /api/media/admin/retry-validation/<id>/
  retryValidation: (id) => api.post(`media/admin/retry-validation/${id}/`),
  // POST /api/media/admin/skip-validation/<id>/
  skipValidation: (id) => api.post(`media/admin/skip-validation/${id}/`),
  // ── Content Moderation ──────────────────────────────
  // GET /api/media/admin/moderated/?status=sensitive
  moderatedList: (status = '') => api.get('media/admin/moderated/', { params: { status } }),
  // POST /api/media/admin/moderate/<id>/
  moderate: (id, status, reason = '') => api.post(`media/admin/moderate/${id}/`, { status, reason }),
  // ── Media Reports ───────────────────────────────────
  // GET /api/media/admin/reports/?status=pending
  reportsList: (status = 'pending') => api.get('media/admin/reports/', { params: { status } }),
  // POST /api/media/admin/reports/<id>/resolve/
  resolveReport: (id, decision, reason = '') => api.post(`media/admin/reports/${id}/resolve/`, { decision, reason }),
  // POST /api/media/admin/reports/<id>/assign/
  assignReport: (id, moderatorId = null) => api.post(`media/admin/reports/${id}/assign/`, moderatorId ? { moderator_id: moderatorId } : {}),

  // ── Media Incident Center ─────────────────────────────────
  // GET /api/media/admin/incidents/?status=open
  incidentsList: (status = 'open') => api.get('media/admin/incidents/', { params: { status } }),
  // GET /api/media/admin/incidents/<id>/
  incidentDetail: (id) => api.get(`media/admin/incidents/${id}/`),
  // POST /api/media/admin/incidents/create/
  incidentCreate: (data) => api.post('media/admin/incidents/create/', data),
  // PATCH /api/media/admin/incidents/<id>/update/
  incidentUpdate: (id, data) => api.patch(`media/admin/incidents/${id}/update/`, data),
  // POST /api/media/admin/incidents/<id>/resolve/
  incidentResolve: (id, recoveryInfo) => api.post(`media/admin/incidents/${id}/resolve/`, { recovery_info: recoveryInfo }),
  // POST /api/media/admin/incidents/<id>/refresh/
  incidentRefresh: (id) => api.post(`media/admin/incidents/${id}/refresh/`),

  // ── Provider Health Monitor ──────────────────────────────────
  // GET /api/media/admin/provider-health/?window_hours=168
  providerHealthList: (windowHours = 168) => api.get('media/admin/provider-health/', { params: { window_hours: windowHours } }),
  // GET /api/media/admin/provider-health/<key>/
  providerHealthDetail: (key, windowHours = 168) => api.get(`media/admin/provider-health/${encodeURIComponent(key)}/`, { params: { window_hours: windowHours } }),
  // GET /api/media/admin/provider-health/<key>/trends/?days=30
  providerHealthTrends: (key, days = 30) => api.get(`media/admin/provider-health/${encodeURIComponent(key)}/trends/`, { params: { days } }),

  // ── Admin Security Center ────────────────────────────────────
  // GET /api/media/admin/security-center/
  securityCenter: () => api.get('media/admin/security-center/'),
};

// ─── Media Trust Center Service (Security & Trust Phase) ──────────
export const mediaTrustCenterService = {
  // GET /api/media/trust-center/
  summary: () => api.get('media/trust-center/'),
  // GET /api/media/system-health/
  systemHealth: () => api.get('media/system-health/'),
  // POST /api/media/security-score/
  securityScore: (url) => api.post('media/security-score/', { url }),
  // POST /api/media/explain-error/
  explainError: (errorMessage, statusCode, url) => api.post('media/explain-error/', { error_message: errorMessage, status_code: statusCode, url }),
};

export const mediaDashboardService = {
  // GET /api/media/drafts/count/
  draftsCount: () => api.get('media/drafts/count/'),
  // GET /api/media/broken/count/
  brokenCount: () => api.get('media/broken/count/'),
  // GET /api/media/in-progress/
  inProgress: () => api.get('media/in-progress/'),
  // GET /api/media/activity/
  activity: () => api.get('media/activity/'),
  // GET /api/media/pinned/
  pinned: () => api.get('media/pinned/'),
  // POST /api/media/pinned/ — { media_id, action: 'pin' | 'unpin' }
  togglePin: (mediaId, action) => api.post('media/pinned/', { media_id: mediaId, action }),
};

export const mediaProviderService = {
  // GET /api/media/providers/ — list all providers
  list: () => api.get('media/providers/'),
  // GET /api/media/providers/<key>/ — provider detail
  get: (key) => api.get(`media/providers/${encodeURIComponent(key)}/`),
  // GET /api/media/providers/<key>/readme/ — provider setup guide
  readme: (key) => api.get(`media/providers/${encodeURIComponent(key)}/readme/`),
  // POST /api/media/validate-url/ — validate a public media URL
  validateUrl: (url) => api.post('media/validate-url/', { url }),
  // POST /api/media/detect-provider/ — detect provider from URL
  detectProvider: (url) => api.post('media/detect-provider/', { url }),
  // ── Admin endpoints ──────────────────────────────────────────────
  // POST /api/media/providers/<key>/toggle/ — enable/disable provider
  toggle: (key) => api.post(`media/providers/${encodeURIComponent(key)}/toggle/`),
  // POST /api/media/providers/ — create new provider
  create: (data) => api.post('media/providers/', data),
  // PATCH /api/media/providers/<key>/ — update provider
  update: (key, data) => api.patch(`media/providers/${encodeURIComponent(key)}/`, data),
  // DELETE /api/media/providers/<key>/ — remove provider
  remove: (key) => api.delete(`media/providers/${encodeURIComponent(key)}/`),
  // GET /api/media/validation-logs/ — list validation logs
  validationLogs: (params) => api.get('media/validation-logs/', { params }),
  // GET /api/media/validation-logs/stats/ — validation stats
  validationStats: () => api.get('media/validation-logs/stats/'),
  // ── Creator Media Library endpoints ────────────────────────────────────
  // GET /api/media/user-media/ — list user's media assets
  userMedia: (params) => api.get('media/user-media/', { params }),
  // POST /api/media/smart-replace/<id>/ — replace URL + update all references
  smartReplace: (id, newUrl) => api.post(`media/smart-replace/${id}/`, { url: newUrl }),
  // POST /api/media/toggle/<id>/ — enable/disable
  toggleMedia: (id) => api.post(`media/toggle/${id}/`),
  // POST /api/media/archive/<id>/ — archive
  archiveMedia: (id) => api.post(`media/archive/${id}/`),
  // DELETE /api/media/delete/<id>/ — delete reference
  deleteMedia: (id) => api.delete(`media/delete/${id}/`),
  // PATCH /api/media/rename/<id>/ — rename title
  renameMedia: (id, title) => api.patch(`media/rename/${id}/`, { title }),
};

export default api;

