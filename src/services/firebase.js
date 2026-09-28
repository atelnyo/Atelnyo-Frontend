// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🚨 VIOLATION: AI/CLI THAT TOUCHES THIS FILE VIOLATES SECURITY POLICY  ║
// ║  ANY UNAUTHORIZED CHANGE IS A BREACH. SEE .ai-rules.md FOR DETAILS.     ║
// ║  THIS WARNING IS INTENTIONAL — DO NOT REMOVE OR MODIFY.                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * src/services/firebase.js — Firebase Cloud Messaging for web push.
 *
 * Lazy-init singleton — Firebase is only initialized
 * when the user is authenticated and push notifications are available.
 * NEVER throws on import; consumers must tolerate null returns.
 *
 * Lifecycle:
 *   1. initFirebase()          — initialize app (lazy, safe to call repeatedly)
 *   2. requestPushPermission() — browser native Notification.requestPermission()
 *   3. getFCMToken()           — getToken() with VAPID key, registers with SW
 *   4. registerTokenWithBE()   — POST /api/push/register/
 *   5. unregisterToken()       — POST /api/push/unregister/ + deleteToken()
 *
 * The VAPID key (web push certificate) is hardcoded here — it's a public
 * key that the browser uses to verify push messages came from our server.
 * It is NOT a secret.
 *
 * Service Worker communication:
 *   After init, we postMessage the Firebase config to the SW so
 *   firebase-messaging-sw.js can show background notifications even
 *   when the page is closed.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
} from 'firebase/messaging';
import api from './api';

// ─── Firebase config (from Vite env vars → DB fallback) ─────────
// Build-time: Vite replaces import.meta.env.VITE_FIREBASE_* with the
// values from .env. These are PUBLIC — Firebase intentionally exposes
// them in client code.
// Runtime fallback: if env vars are empty, fetch from the PlatformConfig
// DB via /api/config/public/ so admins can manage Firebase config from
// the admin panel without a redeploy.
const _envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};
const _envVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

// Mutable config — populated lazily from env vars or DB fallback.
let FIREBASE_CONFIG = { ..._envConfig };
let VAPID_KEY = _envVapidKey;
let _dbConfigLoaded = false;

/**
 * Load Firebase config from PlatformConfig DB if env vars are empty.
 * Called once on first initFirebase(). Returns a promise that resolves
 * when config is ready (or immediately if env vars were sufficient).
 */
async function _loadFirebaseConfigFromDB() {
  if (_dbConfigLoaded) return;
  // If env vars already have the required fields, skip the DB fetch.
  if (_envConfig.apiKey && _envConfig.projectId && _envConfig.messagingSenderId && _envConfig.appId) {
    _dbConfigLoaded = true;
    return;
  }
  try {
    const { data } = await api.get('config/public/');
    if (data?.firebase_api_key) {
      FIREBASE_CONFIG = {
        apiKey: data.firebase_api_key || FIREBASE_CONFIG.apiKey,
        authDomain: data.firebase_auth_domain || FIREBASE_CONFIG.authDomain,
        databaseURL: data.firebase_database_url || FIREBASE_CONFIG.databaseURL,
        projectId: data.firebase_project_id || FIREBASE_CONFIG.projectId,
        storageBucket: data.firebase_storage_bucket || FIREBASE_CONFIG.storageBucket,
        messagingSenderId: data.firebase_messaging_sender_id || FIREBASE_CONFIG.messagingSenderId,
        appId: data.firebase_app_id || FIREBASE_CONFIG.appId,
        measurementId: data.firebase_measurement_id || FIREBASE_CONFIG.measurementId,
      };
      VAPID_KEY = data.firebase_vapid_key || VAPID_KEY;
    }
  } catch (_) { /* DB unavailable — use whatever we have */ }
  _dbConfigLoaded = true;
}

/** Check if Firebase config is available. Safe to call from render. */
export function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.messagingSenderId &&
    FIREBASE_CONFIG.appId
  );
}

// ─── Lazy singleton state ─────────────────────────────────────────
let _app = null;
let _messaging = null;
let _currentToken = null;
let _initialized = false;

/** Check if the browser supports FCM push. Safe to call from render. */
export function isPushSupported() {
  if (typeof window === 'undefined') {return false;}
  if (!('Notification' in window)) {return false;}
  if (!('serviceWorker' in navigator)) {return false;}
  return true;
}

/**
 * Initialize the Firebase app (if not already). Returns the app instance
 * or null if initialization fails. This is the FIRST step — call it
 * before any other Firebase function.
 */
export async function initFirebase() {
  if (_initialized) {return _app;}
  _initialized = true;

  if (!isPushSupported()) {
    console.warn('[firebase] Push not supported in this browser');
    return null;
  }

  // Load config from DB if env vars are empty (one-time fetch).
  await _loadFirebaseConfigFromDB();

  if (!isFirebaseConfigured()) {
    console.warn('[firebase] Firebase config not available — push disabled');
    return null;
  }

  try {
    // If already initialized by another module, reuse
    if (getApps().length > 0) {
      _app = getApps()[0];
    } else {
      _app = initializeApp(FIREBASE_CONFIG);
    }
    console.warn('[firebase] App initialized');
    return _app;
  } catch (err) {
    console.warn('[firebase] initFirebase failed:', err);
    return null;
  }
}

/**
 * Get (or create) the Messaging instance. Returns null if unsupported.
 * Must call initFirebase() first.
 */
function _getMessaging() {
  if (_messaging) {return _messaging;}
  if (!_app) {return null;}

  isSupported().then((ok) => {
    if (!ok) {
      console.warn('[firebase] Messaging not supported in this browser');
    }
  }).catch(() => {});

  try {
    _messaging = getMessaging(_app);
    return _messaging;
  } catch (err) {
    console.warn('[firebase] getMessaging failed:', err);
    return null;
  }
}

/**
 * Send Firebase config to the service worker so it can initialize
 * its own Firebase instance for background push handling.
 */
function _sendConfigToSW() {
  if (!('serviceWorker' in navigator)) {return;}
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: FIREBASE_CONFIG,
      });
    }
  }).catch(() => {});
}

/**
 * Request browser notification permission. Returns the permission
 * string: 'granted', 'denied', or 'default'.
 */
export async function requestPushPermission() {
  if (!isPushSupported()) {return 'denied';}

  try {
    const permission = await Notification.requestPermission();
    console.warn('[firebase] Notification permission:', permission);
    return permission;
  } catch (err) {
    console.warn('[firebase] requestPermission failed:', err);
    return 'denied';
  }
}

/**
 * Get the FCM registration token for this device.
 * Requires: initFirebase() + notification permission 'granted'.
 *
 * Returns the token string, or null if it can't be obtained.
 * Stores the token in _currentToken for later unregistration.
 */
export async function getFCMToken() {
  if (!isPushSupported()) {return null;}

  const permission = Notification.permission;
  if (permission !== 'granted') {
    console.warn('[firebase] Notification permission not granted, skipping token');
    return null;
  }

  const messaging = _getMessaging();
  if (!messaging) {return null;}

  try {
    const swRegistration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      _currentToken = token;
      console.warn('[firebase] FCM token obtained:', token.slice(0, 16) + '…');
    }

    return token;
  } catch (err) {
    console.warn('[firebase] getToken failed:', err);
    return null;
  }
}

/**
 * Register the current FCM token with the backend.
 * Sends: POST /api/push/register/ { token, platform: 'web' }
 *
 * Returns true on success, false on failure.
 */
export async function registerTokenWithBE() {
  if (!_currentToken) {return false;}

  try {
    await api.post('push/register/', {
      token: _currentToken,
      platform: 'web',
    });
    console.warn('[firebase] Token registered with backend');
    return true;
  } catch (err) {
    console.warn('[firebase] Token registration failed:', err?.response?.status, err?.message);
    return false;
  }
}

/**
 * Unregister the current FCM token from both Firebase and backend.
 * Call this on logout or when the user disables push notifications.
 */
export async function unregisterToken() {
  // 1. Backend: deactivate token
  if (_currentToken) {
    try {
      await api.post('push/unregister/', { token: _currentToken });
      console.warn('[firebase] Token unregistered from backend');
    } catch (err) {
      console.warn('[firebase] Token unregistration failed:', err?.message);
    }
  }

  // 2. Firebase: delete token
  const messaging = _getMessaging();
  if (messaging) {
    try {
      await deleteToken(messaging);
      console.warn('[firebase] Token deleted from Firebase');
    } catch (err) {
      console.warn('[firebase] deleteToken failed:', err?.message);
    }
  }

  _currentToken = null;
}

/**
 * Current FCM token (if already obtained).
 */
export function getCurrentToken() {
  return _currentToken;
}

/**
 * Listen for foreground (in-app) push messages.
 * Calls `callback({ title, body, data })` when a push arrives while
 * the app is open in the foreground.
 *
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback) {
  const messaging = _getMessaging();
  if (!messaging) {return () => {};}

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      const { notification, data } = payload;
      callback({
        title: notification?.title || 'Atelnyo',
        body: notification?.body || '',
        data: data || {},
        payload,
      });
    });
    return unsubscribe;
  } catch (err) {
    console.warn('[firebase] onMessage hook failed:', err);
    return () => {};
  }
}

/**
 * One-shot convenience: full push registration flow.
 *
 *   initFirebase() → sendConfigToSW → requestPermission →
 *   getFCMToken → registerTokenWithBE → onForegroundMessage
 *
 * Returns the token string on success, null on failure.
 * Best effort — a failure at any step returns null without throwing.
 */
export async function registerPushNotifications(onForegroundMsg) {
  const app = await initFirebase();
  if (!app) {return null;}

  // Send config to SW as early as possible (for background push)
  _sendConfigToSW();

  const permission = await requestPushPermission();
  if (permission !== 'granted') {return null;}

  const token = await getFCMToken();
  if (!token) {return null;}

  await registerTokenWithBE();

  // Hook foreground listener if callback provided
  if (typeof onForegroundMsg === 'function') {
    onForegroundMessage(onForegroundMsg);
  }

  return token;
}

/**
 * Send a backend test push to the current user.
 * Calls POST /api/push/send-test/ — the backend sends a real FCM push
 * to all active web tokens. Returns { sent: N } on success, null on failure.
 */
export async function sendTestPush() {
  try {
    const { data } = await api.post('push/send-test/');
    console.warn('[firebase] Test push result:', data.message);
    return data;
  } catch (err) {
    console.warn('[firebase] Test push failed:', err?.message);
    return null;
  }
}

export default {
  initFirebase,
  requestPushPermission,
  getFCMToken,
  registerTokenWithBE,
  unregisterToken,
  getCurrentToken,
  onForegroundMessage,
  registerPushNotifications,
  isPushSupported,
  isFirebaseConfigured,
  sendTestPush,
};
