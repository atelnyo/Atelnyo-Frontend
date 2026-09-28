import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

// Sentry error monitoring (T005) — DYNAMIC import so the ~40KB SDK only
// lands in the bundle when VITE_SENTRY_DSN is set (dev/CI builds stay
// lean). Without a DSN this block is a no-op — no telemetry, no chunk.
// init() must run before App renders, which is why the promise is
// awaited before ReactDOM.createRoot below.
const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN || '';
const sentryReady = SENTRY_DSN
  ? import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env?.MODE || 'production',
        release: import.meta.env?.VITE_APP_VERSION || undefined,
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
      });
    }).catch(() => { /* monitoring must never block boot */ })
  : Promise.resolve();
import App from './App.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import './styles/index.css'
import './styles/accessibility.css'
import './styles/creator-analytics.css'
import './styles/atelier.css'
import './styles/studio.css'
import './styles/creator-economy.css'
import './styles/premium-preview.css'
import './styles/media-gateway.css'
import './styles/media-enterprise.css'
import './styles/wallet.css'
import './styles/pwa-upgrade.css'
import './styles/deie.css'
import './styles/chunk-error.css'
import './styles/spotlight.css'
import './styles/accessibility.css'
// Phase 49 §11.2 — react-helmet-async needs <HelmetProvider>
// wrapping the app to manage document head meta tags.
import { ThemeProvider } from './context/ThemeContext.jsx'

import { androidBridge } from './services/androidBridge'

// Sync credentials from native Android app if running inside WebView
androidBridge.syncFromNative();

// Phase 57 — PWA: wire up updateEngine at boot so the SW update
// detection is ready before the app paints its first frame.
// The after-paint check in InstallPrompt.jsx fires independently.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  import('./services/updateEngine').then(m => m.init()).catch(() => {})
}

sentryReady.finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HelmetProvider>
        <ThemeProvider>
          <BrowserRouter>
            <App />
            {/* Phase 57 — PWA install prompt banner, rendered outside
                the <App> tree so it can remain mounted across route
                transitions without re-initializing its state. Renders
                nothing unless the beforeinstallprompt event has fired. */}
            <InstallPrompt />
          </BrowserRouter>
        </ThemeProvider>
      </HelmetProvider>
    </React.StrictMode>
  );
})
