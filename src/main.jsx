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

// ─── Global AppErrorBoundary ────────────────────────────────────────
// Without this, ANY uncaught render error anywhere in <App /> (a
// transient map-undefined, an unrelated boundary re-throwing —
// ChunkLoadErrorBoundary re-throws non-chunk errors by design) makes
// React unmount the whole root → a blank/black screen with no way
// back. This boundary is the LAST resort: it renders a branded
// recovery card (reload button) instead of ever letting the page go
// black. Bilingual via the same localStorage preference the other
// boundaries read.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error?.message || error, info?.componentStack?.slice(0, 500));
  }
  handleReload = () => {
    window.location.reload();
  };
  handleHome = () => {
    window.location.href = '/';
  };
  render() {
    if (this.state.hasError) {
      const isHt = (localStorage.getItem('atelnyo_lang') || 'ht') === 'ht';
      return (
        <div role="alert" style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: 'linear-gradient(160deg, #ffdae9 0%, #fff 100%)',
        }}>
          <div style={{
            maxWidth: 380, width: '100%', textAlign: 'center', borderRadius: 16,
            padding: 28, background: 'var(--bg-card, #fff)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">🛠️</div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--text-main, #1f2937)' }}>
              {isHt ? 'Yon erè inatandi rive' : 'Something unexpected happened'}
            </h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem' }}>
              {isHt
                ? 'App la pa t kapab afiche paj sa a. Rechaje — done ou yo an sekirite.'
                : 'The page could not be displayed. Reload — your data is safe.'}
            </p>
            <button
              type="button"
              className="chunk-error-btn"
              onClick={this.handleReload}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: 'var(--pink-primary, #d81b60)', color: '#fff',
                fontWeight: 650, cursor: 'pointer', touchAction: 'manipulation',
              }}
            >
              <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Rechaje' : 'Reload'}
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              style={{
                display: 'block', margin: '12px auto 0', padding: '8px 16px',
                borderRadius: 10, border: 'none', background: 'transparent',
                color: 'var(--text-secondary, #64748b)', fontWeight: 600, cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {isHt ? 'Retounen sou Explore' : 'Back to Explore'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
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
