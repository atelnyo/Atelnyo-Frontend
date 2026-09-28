/**
 * src/pwa/installation/installationDetector.js
 *
 * INSTALLATION DETECTOR — the pure detection layer of the PWA
 * Installation subsystem. Every function here answers ONE factual
 * question about the environment (platform, browser, display mode,
 * manifest presence, capability). There is NO state, NO persistence,
 * NO prompts — the Installation Manager (InstallationManager.js)
 * composes these answers into the installation state machine.
 *
 * Layered standalone detection: the detection layer has a PRIMARY
 * signal (the standards-based ``(display-mode: standalone)`` media
 * query) and FALLBACK signals (platform-specific mechanisms such as
 * iOS Safari's ``navigator.standalone``). Consumers never touch these
 * — they call the public abstraction ``installationManager.isInstalled()``
 * / ``isStandalone()`` and let the manager decide which API answers.
 *
 * All functions are environment-safe (guard on typeof window /
 * navigator / document) so they can run during SSR / pre-hydration.
 */
import {
  PLATFORMS,
  BROWSERS,
  DISPLAY_MODES,
  CAPABILITIES,
} from './installationTypes.js';

/* ------------------------------------------------------------------ *
 * Platform / browser detection
 * ------------------------------------------------------------------ */

export function detectPlatform() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return PLATFORMS.DESKTOP;
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  // iPadOS Safari reports a macOS user agent; the touch-point probe is the
  // reliable discriminator (navigator.platform is deprecated and can lie
  // under spoofing, so we only use it as a secondary signal).
  const ipadOs = navigator.maxTouchPoints > 1
    && (ua.includes('macintosh') || /mac os x/.test(ua))
    && /safari/.test(ua)
    && !/chrome|crios|fxios|edg/i.test(ua);
  if (/(iphone|ipad|ipod)/.test(ua) || ipadOs) return PLATFORMS.IOS;
  if (/android/.test(ua)) return PLATFORMS.ANDROID;
  return PLATFORMS.DESKTOP;
}

/**
 * Which browser is running? Uses userAgentData (brand list) when
 * available, else classic UA sniffing. Returns a BROWSERS bucket.
 */
export function detectBrowser() {
  if (typeof navigator === 'undefined') return BROWSERS.UNKNOWN;
  const ua = (navigator.userAgent || '').toLowerCase();
  try {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    const isChromium = brands.some((b) => /chromium/i.test(b.brand));
    if (/edg\//.test(ua)) return BROWSERS.EDGE;
    if (/opr\/|opera/.test(ua)) return BROWSERS.OPERA;
    if (/samsungbrowser/.test(ua)) return BROWSERS.SAMSUNG;
    if (/firefox|fxios/.test(ua)) return BROWSERS.FIREFOX;
    if (/crios/.test(ua)) return BROWSERS.CHROME;
    if (/chrome/.test(ua) || isChromium) return BROWSERS.CHROME;
    if (/safari/.test(ua)) return BROWSERS.SAFARI;
  } catch (_) {
    /* fall through to UA-only pass below */
  }
  // UA-only pass (no userAgentData).
  if (/edg\//.test(ua)) return BROWSERS.EDGE;
  if (/firefox|fxios/.test(ua)) return BROWSERS.FIREFOX;
  if (/crios|chrome/.test(ua)) return BROWSERS.CHROME;
  if (/safari/.test(ua)) return BROWSERS.SAFARI;
  if (/opr\/|opera/.test(ua)) return BROWSERS.OPERA;
  if (/samsungbrowser/.test(ua)) return BROWSERS.SAMSUNG;
  return BROWSERS.OTHER;
}

/* ------------------------------------------------------------------ *
 * Layered standalone detection
 * ------------------------------------------------------------------ */

/** Primary — the standards-based media query. */
function _matchMediaStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch (_) {
    return false;
  }
}

/**
 * Fallback — platform-specific mechanisms. Extend here as new
 * ecosystems ship their own "running as an installed app" flags.
 *   • iOS Safari A2HS → navigator.standalone === true
 *   • (future: Android intent extras, macOS Dock flag, …)
 */
function _platformStandalone() {
  try {
    if (navigator.standalone === true) return true; // iOS Safari A2HS
  } catch (_) {
    return false;
  }
  return false;
}

/** The layered answer: primary signal first, then platform fallbacks. */
function _isRunningStandalone() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (_matchMediaStandalone()) return true;
  return _platformStandalone();
}

/**
 * Detect the ACTIVE display mode by probing every media query.
 *
 * ``standalone`` is the primary indicator for an installed PWA, but a
 * good Installation Manager verifies the other app modes too — a
 * window can legitimately run as minimal-ui, fullscreen, or
 * window-controls-overlay (Windows PWA) and is STILL an installed app.
 * ``browser`` means a plain tab.
 */
export function detectDisplayMode() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return DISPLAY_MODES.UNKNOWN;
  }
  // Primary + fallback standalone detection FIRST (the most important
  // installed-app indicator), then the remaining app modes.
  if (_isRunningStandalone()) return DISPLAY_MODES.STANDALONE;
  const mq = (mode) => {
    try {
      return window.matchMedia(`(display-mode: ${mode})`).matches;
    } catch (_) {
      return false;
    }
  };
  if (mq(DISPLAY_MODES.MINIMAL_UI)) return DISPLAY_MODES.MINIMAL_UI;
  if (mq(DISPLAY_MODES.FULLSCREEN)) return DISPLAY_MODES.FULLSCREEN;
  if (mq(DISPLAY_MODES.WINDOW_CONTROLS_OVERLAY)) {
    return DISPLAY_MODES.WINDOW_CONTROLS_OVERLAY;
  }
  if (mq(DISPLAY_MODES.BROWSER)) return DISPLAY_MODES.BROWSER;
  return DISPLAY_MODES.BROWSER;
}

/** True when the given mode is an installed-app window (any app mode). */
export function isAppWindow(mode) {
  return mode === DISPLAY_MODES.STANDALONE
    || mode === DISPLAY_MODES.MINIMAL_UI
    || mode === DISPLAY_MODES.FULLSCREEN
    || mode === DISPLAY_MODES.WINDOW_CONTROLS_OVERLAY;
}

/* ------------------------------------------------------------------ *
 * Manifest
 * ------------------------------------------------------------------ */

/**
 * Concept A gate: is the web app RECOGNIZABLE as installable at all?
 * The manifest link is the browser's entry point for installability
 * (Chrome also requires it before it ever fires beforeinstallprompt).
 */
export function hasManifest() {
  try {
    return typeof document !== 'undefined'
      && document.querySelector('link[rel="manifest"]') !== null;
  } catch (_) {
    return false;
  }
}

/**
 * Resolve a URL-typed manifest member (``start_url`` / ``id`` / scope…)
 * against the document base URL, per the Web App Manifest spec.
 */
function resolveManifestUrl(value) {
  try {
    return new URL(value, document.baseURI).href;
  } catch (_) {
    return null;
  }
}

/**
 * Resolve the MANIFEST IDENTITY — the stable app id the BROWSER uses
 * to identify this application, per the Web App Manifest spec:
 *
 *   • ``id`` present  → resolved against start_url (or the manifest URL
 *                       if start_url is missing). A RELATIVE id like
 *                       ``"/"`` stays THE SAME APP identity across URL
 *                       changes (e.g. ``/`` → ``/app``) — URL is NOT
 *                       the id.
 *   • ``id`` missing  → the resolved ``start_url`` IS the identity
 *                       (spec default), so the app still gets a stable
 *                       identity as long as start_url stays stable.
 *   • ``scope``       → the resolved id must stay WITHIN the app scope
 *                       (same origin + under scope). An out-of-scope
 *                       id is a broken manifest — the browser would
 *                       reject it — never a new identity.
 *
 * All URL-typed members resolve against ``manifestUrl`` (the manifest
 * DOCUMENT's URL — where the browser itself fetched it), NOT the
 * document base URL, per spec.
 *
 * The Installation Manager works hand-in-hand with this identity: the
 * persisted install marker and the signals that derive ``installed``
 * describe THIS identity, so a URL change can never be misread as a
 * different app (or a re-install).
 */
export function manifestIdentity(idRaw, startUrlRaw, scopeRaw, manifestUrl) {
  if (typeof document === 'undefined') return null;
  const base = resolveManifestUrl(manifestUrl || '/');
  if (!base) return null;

  // start_url (spec: resolves against the manifest URL; falls back to
  // the document URL / base when absent).
  const start = startUrlRaw ? new URL(startUrlRaw, base).href : base;
  // scope (spec: resolves against start_url; falls back to start_url).
  const scope = scopeRaw
    ? new URL(scopeRaw, start).href
    : (startUrlRaw ? start : base);

  if (idRaw) {
    const id = new URL(idRaw, start).href;
    // ``id`` must stay within ``scope`` — a URL change that would
    // escape the app is a broken manifest, not a new identity.
    const inScope = id === scope || id.startsWith(scope.endsWith('/') ? scope : scope + '/');
    if (inScope) return id;
    return null; // out-of-scope id → broken manifest, no identity
  }
  if (startUrlRaw) return start;
  return base;
}

/* ------------------------------------------------------------------ *
 * Persisted facts (the durable install marker + dismiss window)
 * ------------------------------------------------------------------ */

export function readStored(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

export function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    /* private mode — ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Capability
 * ------------------------------------------------------------------ */

/**
 * Which install capability does this browser expose?
 *
 *   • PROMPT       — the beforeinstallprompt event is present on window
 *                    (Chrome / Edge / Opera / Samsung Internet): we can
 *                    invoke the native install dialog programmatically.
 *   • INSTRUCTIONS — NO programmatic prompt, BUT the browser still has
 *                    its OWN install mechanism in its UI — this is the
 *                    Browser Fallback path. We explain how to install
 *                    through the browser menu instead of claiming the
 *                    app cannot be installed (which would be FALSE):
 *                      • iOS Safari      → Share → Add to Home Screen
 *                      • macOS Safari    → Share → Add to Dock (Sonoma+)
 *                      • Android browsers → menu → Add to Home screen
 *                      • Opera desktop   → menu → Install page as app
 *   • NONE         — no install path on this browser at all (Firefox
 *                    desktop stable, in-app webviews). Still never a
 *                    flat "cannot be installed": the UI suggests a
 *                    capable browser.
 */
export function detectCapability(platform, browser) {
  if (typeof window === 'undefined') return CAPABILITIES.NONE;
  if ('onbeforeinstallprompt' in window) return CAPABILITIES.PROMPT;
  if (platform === PLATFORMS.IOS) return CAPABILITIES.INSTRUCTIONS;
  if (platform === PLATFORMS.ANDROID) return CAPABILITIES.INSTRUCTIONS;
  // Desktop without the event — still installable via the browser's own
  // menu on Chromium engines and Safari (macOS Sonoma+ Add to Dock).
  // Firefox stable has no PWA install mechanism → genuinely no path.
  if (browser === BROWSERS.FIREFOX) return CAPABILITIES.NONE;
  if (browser === BROWSERS.CHROME
    || browser === BROWSERS.EDGE
    || browser === BROWSERS.SAFARI
    || browser === BROWSERS.OPERA
    || browser === BROWSERS.OTHER) {
    return CAPABILITIES.INSTRUCTIONS;
  }
  return CAPABILITIES.NONE;
}
