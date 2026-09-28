/**
 * src/pwa/installation/installationTypes.js
 *
 * PURE TYPES & CONSTANTS of the PWA Installation subsystem — the state
 * model, capabilities, platforms, browsers, and policy knobs. No logic
 * lives here; the Installation Manager (InstallationManager.js), the
 * detector, the prompt handler, and the browser fallback all import
 * from this module so the whole subsystem speaks ONE vocabulary.
 *
 * Key architectural points:
 *   • INSTALL_STATES is a proper STATE MODEL — never a single
 *     ``installed`` boolean. Every non-INSTALLED state is implicitly
 *     NOT_INSTALLED; UNKNOWN is pre-init / insufficient info.
 *   • INSTALLABILITY and PROMPT_AVAILABILITY are TWO SEPARATE
 *     capabilities — "the browser recognizes the app as installable"
 *     is NOT the same as "we hold a beforeinstallprompt event we can
 *     show". Example: Chrome before the event fires → installable YES,
 *     prompt NO, still installable via the browser's own UI.
 *   • ACCEPTED (a UX outcome) is NOT proof of installation — even the
 *     browser's ``appinstalled`` event only confirms the install
 *     REQUEST completed. ``installed`` is reached exclusively when
 *     Atelnyo later DETECTS itself running in an installed-app window
 *     (see the state machine in InstallationManager.js).
 */
export const STORAGE = {
  installed: 'atelnyo_pwa_installed',
  dismissedAt: 'atelnyo_pwa_dismissed_at',
};

/** How many days the auto banner stays hidden after a dismissal. */
export const DISMISS_DAYS = 7;

/**
 * Prompt-timing policy — WHEN may Atelnyo offer installation?
 * Capturing beforeinstallprompt only means the browser LETS us ask;
 * the decision to actually ask lives in the manager (readyToShowPrompt):
 *   • minLoadMs         — minimum time-on-page before any offer (let
 *                         the user settle into the app first).
 *   • requireEngagement — wait for the user's first meaningful action
 *                         (scroll / tap / key) before offering; an
 *                         install ask on a dead standstill is ignored.
 *   • oncePerSession    — at most ONE impression per page load, on top
 *                         of the 7-day quiet window on dismissal.
 */
export const PROMPT_POLICY = {
  minLoadMs: 4000,
  requireEngagement: true,
  oncePerSession: true,
};

/**
 * Publishable store links. Empty by default — the project's Android
 * companion lives in ./android but has no public store URL yet. When a
 * Play Store / App Store listing goes live, drop the URLs here and the
 * UI surfaces "store availability" buttons automatically.
 */
export const STORE_URLS = {
  googlePlay: '',
  appleAppStore: '',
};

/**
 * Lifecycle states of the installation machine — a proper state model,
 * never a single ``installed`` boolean. Every non-INSTALLED state is
 * implicitly NOT_INSTALLED (the user's model); UNKNOWN is pre-init /
 * insufficient info.
 */
export const INSTALL_STATES = {
  /** Not enough info yet (SSR / pre-init). */
  UNKNOWN: 'unknown',
  /** C — running as an installed app (standalone) or on the device. */
  INSTALLED: 'installed',
  /** A — installable: browser recognizes the manifest; no event yet. */
  INSTALLABLE: 'installable',
  /** B — prompt captured: the native dialog is ready to show. */
  PROMPT_AVAILABLE: 'prompt_available',
  /** prompt() was invoked; waiting for the user's choice. */
  REQUESTED: 'requested',
  /**
   * UX outcome — the user ACCEPTED the native dialog. This is a UX
   * state, NOT proof of installation: even the browser's
   * ``appinstalled`` event only confirms the install REQUEST
   * completed. The definitive ``installed`` state is reached
   * exclusively when Atelnyo later DETECTS itself running in an
   * installed-app window (standalone display-mode) — never falsified
   * from dialog or event alone.
   */
  ACCEPTED: 'accepted',
  /** No native prompt on this browser — show step-by-step instructions. */
  INSTRUCTIONS: 'instructions',
  /** No installation path at all (very old / unsupported browser). */
  UNSUPPORTED: 'unsupported',
};

/** Why the machine is where it is (diagnostics, never relied on for logic). */
export const INSTALL_REASONS = {
  STANDALONE: 'standalone',
  DEVICE_INSTALLED: 'device_installed',
  NO_MANIFEST: 'no_manifest',
  EVENT_CAPTURED: 'event_captured',
  PROMPT_DECLINED: 'prompt_declined',
};

/** Capability buckets (what the browser CAN do, independent of state). */
export const CAPABILITIES = {
  PROMPT: 'prompt',
  INSTRUCTIONS: 'instructions',
  NONE: 'none',
};

/**
 * Installability capability — is Atelnyo RECOGNIZED as installable by
 * this browser (manifest valid + SOME install mechanism exists)?
 *
 * This is INDEPENDENT of prompt availability: on most browsers the app
 * is installable through the browser's OWN UI (address-bar icon, ⋮
 * menu, iOS Share → Add to Home Screen) even when no
 * beforeinstallprompt event was ever captured — e.g. Chrome before the
 * event fires: PWA valid YES · prompt event NO · still installable.
 */
export const INSTALLABILITY = {
  YES: 'yes',
  NO: 'no',
  UNKNOWN: 'unknown',
};

/**
 * Prompt-availability capability — has the beforeinstallprompt event
 * been captured, so Atelnyo can invoke the native install dialog
 * ITSELF? A SEPARATE capability from installability (see above).
 */
export const PROMPT_AVAILABILITY = {
  YES: 'yes',
  NO: 'no',
};

/** Platform buckets used to pick the right fallback instructions. */
export const PLATFORMS = {
  IOS: 'ios',
  ANDROID: 'android',
  DESKTOP: 'desktop',
};

/**
 * Display modes we can detect. We check ALL of them (not just
 * standalone) so a window running with minimal-ui, fullscreen or
 * window-controls-overlay is still recognized as an installed app.
 */
export const DISPLAY_MODES = {
  BROWSER: 'browser',
  STANDALONE: 'standalone',
  MINIMAL_UI: 'minimal-ui',
  FULLSCREEN: 'fullscreen',
  WINDOW_CONTROLS_OVERLAY: 'window-controls-overlay',
  UNKNOWN: 'unknown',
};

/** Browser buckets (Chrome / Firefox / Edge / …) for detection output. */
export const BROWSERS = {
  CHROME: 'chrome',
  EDGE: 'edge',
  FIREFOX: 'firefox',
  SAFARI: 'safari',
  OPERA: 'opera',
  SAMSUNG: 'samsung',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};
