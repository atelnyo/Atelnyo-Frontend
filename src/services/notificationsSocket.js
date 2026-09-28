/**
 * src/services/notificationsSocket.js
 *
 * Real-time notification bell channel.
 *
 * Connects to the backend WebSocket `ws/notifications/?token=<JWT>` and
 * relays two server message shapes to the app:
 *
 *   { type: 'event', event: {...}, unread: N }   — new ActivityFeedEvent
 *   { type: 'unread', unread: N, total: M }       — badge refresh
 *
 * Design notes:
 *   • Singleton: exactly one socket per browser tab. App.jsx calls
 *     `connect()` on login and `disconnect()` on logout.
 *   • Auto-reconnect with capped exponential backoff. When the
 *     handshake is closed with code 4001 the server rejected the token
 *     (expired/dead) — we stop retrying and report disconnected so the
 *     caller falls back to the 30s HTTP poll; the axios interceptor is
 *     already handling the 401/refresh cycle and will reconnect us on
 *     the next `connect()` call.
 *   • The WebSocket is a latency shim on top of the existing
 *     `GET /api/activity/feed/unread_count/` poll — the count it
 *     carries is authoritative, and the poll stays as reconciliation.
 */

const DEFAULT_RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 15000;

let socket = null;
let reconnectTimer = null;
let reconnectDelay = DEFAULT_RECONNECT_MS;
let generation = 0;
let handlers = { onEvent: null, onUnread: null, onStatus: null };
let lastToken = null;

/**
 * Build the ws(s):// notifications URL.
 *
 * Resolution order:
 *   1. `VITE_WS_BASE_URL` — explicit override (production).
 *   2. `VITE_API_BASE_URL` — swap http(s) for ws(s) and drop the
 *      `/api/` suffix, e.g. `https://api.x.com/api/` → `wss://api.x.com/ws/notifications/`.
 *   3. Same-origin `/ws/notifications/` — the Vite dev proxy
 *      (vite.config.js `/ws`) forwards this to Daphne.
 */
function buildWsUrl() {
  const explicit = import.meta.env.VITE_WS_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '') + '/ws/notifications/';
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase) {
    const cleaned = apiBase.replace(/\/+$/, '');
    const rest = cleaned.replace(/^https?:\/\//, '');
    const origin = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : rest;
    const scheme = /^https/.test(cleaned) ? 'wss' : 'ws';
    return `${scheme}://${origin}/ws/notifications/`;
  }
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}/ws/notifications/`;
  }
  return '/ws/notifications/';
}

function readToken() {
  try {
    return localStorage.getItem('access_token');
  } catch (_) {
    return null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    const token = readToken();
    if (token && handlers.onStatus) handlers.onStatus({ connected: false, reconnecting: true });
    open(token);
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
}

function handleOpen() {
  reconnectDelay = DEFAULT_RECONNECT_MS;
  if (handlers.onStatus) handlers.onStatus({ connected: true, reconnecting: false });
}

function handleClose(closeCode) {
  const myGen = generation;
  const token = readToken();
  // Server refused the handshake (bad/expired token) — don't hot-loop.
  // The axios 401 interceptor refreshes the token and the app calls
  // `connect()` again on the next auth flow. Fall back to polling.
  if (closeCode === 4001 || !token) {
    if (handlers.onStatus && myGen === generation) {
      handlers.onStatus({ connected: false, reconnecting: false });
    }
    return;
  }
  if (myGen !== generation) return; // superseded by a newer connect()/disconnect()
  scheduleReconnect();
}

function handleMessage(raw) {
  let data;
  try {
    data = JSON.parse(raw.data);
  } catch (_) {
    return;
  }
  if (data.type === 'event' && handlers.onEvent) {
    handlers.onEvent({ event: data.event, unread: data.unread });
  } else if (data.type === 'unread' && handlers.onUnread) {
    handlers.onUnread({ unread: data.unread, total: data.total });
  }
}

function open(token) {
  const myGen = ++generation;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try { socket.close(); } catch (_) {}
    socket = null;
  }
  lastToken = token;
  if (!token) {
    if (handlers.onStatus) handlers.onStatus({ connected: false, reconnecting: false });
    return;
  }
  try {
    const url = `${buildWsUrl()}?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(url);
  } catch (_) {
    if (myGen === generation) scheduleReconnect();
    return;
  }
  socket.onopen = () => { if (myGen === generation) handleOpen(); };
  socket.onclose = (ev) => { if (myGen === generation) handleClose(ev.code); };
  socket.onerror = () => { /* onclose follows; keep it simple */ };
  socket.onmessage = handleMessage;
}

/**
 * Open the live notification channel. Accepts optional callbacks:
 *   onEvent  ({event, unread}) — new notification + authoritative count
 *   onUnread ({unread, total}) — badge refresh
 *   onStatus ({connected, reconnecting}) — connection lifecycle
 */
export function connectNotificationSocket({ onEvent, onUnread, onStatus } = {}) {
  handlers = { onEvent, onUnread, onStatus };
  open(readToken());
}

/** Close the channel (e.g. logout) and stop reconnecting. */
export function disconnectNotificationSocket() {
  generation += 1;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try { socket.close(); } catch (_) {}
    socket = null;
  }
}

export function isNotificationSocketOpen() {
  return Boolean(socket && socket.readyState === WebSocket.OPEN);
}

export function getNotificationSocketState() {
  return {
    connected: isNotificationSocketOpen(),
    token: lastToken,
  };
}
