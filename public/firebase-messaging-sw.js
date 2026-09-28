// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  🚨 VIOLATION: AI/CLI THAT TOUCHES THIS FILE VIOLATES SECURITY POLICY  ║
// ║  ANY UNAUTHORIZED CHANGE IS A BREACH. SEE .ai-rules.md FOR DETAILS.     ║
// ║  THIS WARNING IS INTENTIONAL — DO NOT REMOVE OR MODIFY.                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// firebase-messaging-sw.js
// Service worker for Firebase Cloud Messaging web push.
//
// Deployed at the public root (/) so the Firebase SDK can find it.
// Vite copies it from /public/ → /dist/ on build.
//
// This SW handles ONLY push events — navigation caching is handled
// by the Vite-generated SW (if any). We keep the scope minimal so
// the two SWs don't fight over fetch events.

// Give the service worker the Firebase messaging imports.
// Firebase v9+ uses `importScripts` for SW compatibility.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

let messaging = null;

// Default config (overridden by postMessage from main thread).
// These are the production Firebase project values for devroseacademy.
const DEFAULT_CONFIG = {
  apiKey: 'AIzaSyDtFK7ycvUuiO2mLG6eSaS_vEWG2BgdpsU',
  authDomain: 'devroseacademy.firebaseapp.com',
  databaseURL: 'https://devroseacademy-default-rtdb.firebaseio.com',
  projectId: 'devroseacademy',
  storageBucket: 'devroseacademy.firebasestorage.app',
  messagingSenderId: '274338414317',
  appId: '1:274338414317:web:b3ba9bf3af0714c663d6e4',
  measurementId: 'G-JDXJHKW4Z5',
};

// Handle config message from the foreground page.
// Phase 31 — onBackgroundMessage is registered INSIDE this handler
// so it's guaranteed to be wired before any push arrives. The previous
// top-level call raced: if a push arrived between importScripts and
// the foreground page sending FIREBASE_CONFIG, `messaging` was still
// null and the push was silently dropped.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const config = event.data.config || DEFAULT_CONFIG;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      messaging = firebase.messaging();

      // Register the background handler NOW — after messaging is
      // initialized. This guarantees no push arrives during the gap.
      messaging.onBackgroundMessage((payload) => {
        const { notification, data } = payload;
        const title = notification?.title || 'Atelnyo';
        const options = {
          body: notification?.body || '',
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          data: data || {},
          tag: data?.thread_id || data?.event_type || 'atelnyo',
          requireInteraction: false,
        };
        self.registration.showNotification(title, options);
      });

      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
});

// Notification click handler — opens the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Deep-link based on data payload.
  if (data.thread_id) {
    url = `/?thread=${data.thread_id}`;
  } else if (data.job_id) {
    url = `/?tab=work&job=${data.job_id}`;
  } else if (data.course_id) {
    url = `/?tab=learn&course=${data.course_id}`;
  } else if (data.community_id) {
    url = `/?tab=community&community=${data.community_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', data, url });
          return client.focus();
        }
      }
      // Otherwise open a new window.
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});

// Immediately claim clients so the SW controls the page on first load.
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
