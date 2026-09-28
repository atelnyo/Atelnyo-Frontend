/**
 * src/pwa/installation/InstallationManager.js
 *
 * PWA INSTALLATION MANAGER — single source of truth for the Atelnyo
 * install lifecycle. It is the STATE MACHINE of the PWA subsystem; the
 * pure detection, the prompt interaction, and the browser fallback are
 * owned by sibling modules and COMPOSED here (no duplicated logic):
 *
 *   src/pwa/installation/
 *   ├── installationTypes.js        → state model + capabilities +
 *   │                                 platforms + policy knobs (pure)
 *   ├── installationDetector.js     → platform / browser / display-mode
 *   │                                 / manifest / capability answers
 *   │                                 (pure, environment-safe)
 *   ├── installPromptHandler.js     → beforeinstallprompt/appinstalled
 *   │                                 browser-interaction adapter
 *   ├── browserFallback.js          → per-browser install instructions
 *   └── InstallationManager.js      → THIS MODULE — the state machine
 *                                     + public abstraction + singleton
 *
 *   Startup Detection        →  Atelnyo starts → initialize() re-runs
 *                               the WHOLE pipeline (display mode,
 *                               install capability, available prompt,
 *                               current state) so the machine is always
 *                               up to date — idempotent, call any time.
 *   Installation Detection   →  installed (standalone launch) vs not
 *   Install Capability       →  prompt available (Chrome/Edge/Opera/Samsung)
 *                               | browser instructions (iOS / Android menu)
 *                               | no installation support
 *   Install Prompt           →  capture beforeinstallprompt (via the
 *                               prompt handler), store availability,
 *                               show intentionally, handle the user's
 *                               choice
 *   Browser Fallback         →  platform-specific "Add to Home Screen"
 *                               / "Install app" step-by-step guidance
 *                               (browserFallback module)
 *   Installation State       →  unknown | installed | installable |
 *                               prompt_available | requested |
 *                               instructions | unsupported
 *   Confirmation             →  "installed" is confirmed by fusing THREE
 *                               signals — the ``appinstalled`` event,
 *                               LIVE standalone detection (display-mode
 *                               media-query ``change``), and STARTUP
 *                               detection (marker persisted only when a
 *                               startup detected a standalone window) —
 *                               never by any single one.
 *   Integration              →  App Controller (src/pwa/app/AppController.js),
 *                               PWA manifest (public/manifest.json),
 *                               Service worker (public/sw.js),
 *                               UI (InstallPrompt banner + the
 *                               Settings InstallAppPanel).
 *
 * ── PWA SYSTEM — four subsystems, never conflated ──────────────────
 * The PWA is NOT one blob. Each subsystem owns one concern:
 *
 *   1. MANIFEST (public/manifest.json)      → app IDENTITY: name,
 *      short_name, start_url, scope, display, icons, theme_color.
 *      Consumed here via hasManifest()/manifestIdentity().
 *   2. SERVICE WORKER (public/sw.js)        → OFFLINE FOUNDATION:
 *      caching, app shell, resilient startup, background sync. It is
 *      a DEPENDENCY of installability (Chrome requires a fetch-handling
 *      SW before it ever fires beforeinstallprompt) but it is NOT the
 *      Installation Manager and never manages install state.
 *   3. INSTALLATION MANAGER (this module)   → INSTALL LIFECYCLE:
 *      installation state machine, install capability, install prompt,
 *      browser fallback. It NEVER registers the SW, never touches
 *      caches, and never reads SW lifecycle events.
 *   4. APP CONTROLLER (src/pwa/app/AppController.js) → INTEGRATION:
 *      answers "Ki jan app la ap kouri kounye a?" — composes this
 *      manager + SW update events for the UI, without re-implementing
 *      any subsystem logic.
 *
 * ⚠️ InstallationManager ≠ ServiceWorker. If a feature needs offline
 *    caching or SW control, it belongs in sw.js / the App Controller —
 *    NOT here. If a feature needs install state or prompts, it belongs
 *    here — NOT in sw.js.
 *
 * Consumers subscribe via `subscribe(cb)` and always read the snapshot
 * from `getState()` — no component owns install state of its own.
 *
 * ── PUBLIC API — the whole app talks to the manager through these ──
 *   initialize()        — re-evaluate the full pipeline (idempotent)
 *   getState()          — immutable-ish snapshot for the UI
 *   isInstalled()       — C: running as an installed app / on device
 *   isInstallable()     — A: the browser RECOGNIZES the app as installable
 *   isPromptAvailable() — B: a USABLE native prompt is held right now
 *   getInstallMethod()  — 'prompt' | 'instructions' | 'none'
 *   promptInstall()     — show the native install dialog (when B)
 *   getBrowserFallback()— per-browser step-by-step instructions
 *   getDisplayMode()    — the ACTIVE display-mode bucket
 *   subscribe()         — reactive updates (returns unsubscribe)
 *   destroy()           — full teardown (tests / HMR); init() re-wires
 *   (Secondary: readyToShowPrompt()/claimPrompt() drive the auto
 *    banner, manifestIdentity(), routeToInstructions(),
 *    noteDismissed(), reset(). Deprecated aliases: install(),
 *    getInstallationInstructions().)
 *
 * ⚠️ THREE DISTINCT CONCEPTS — never conflate them:
 *   A. INSTALLABILITY (state ``installable``)  — the browser RECOGNIZES
 *      Atelnyo as an installable app (manifest linked + capable engine).
 *      This is a property of the app+browser, independent of any dialog.
 *   B. INSTALL PROMPT (state ``prompt_available``) — the browser handed us
 *      a beforeinstallprompt event; we CAN ask the user to install.
 *      Nothing has been shown yet.
 *   C. APP INSTALLED (state ``installed``) — Atelnyo is running as an
 *      installed app (standalone display-mode) or is already on the
 *      device (marker). It is NOT just a browser tab anymore.
 *   D. PROMPT OUTCOME — separate from C: the user ACCEPTING the dialog
 *      is a UX state (``accepted``), NOT proof that installation
 *      finished. Even the browser's ``appinstalled`` event only
 *      confirms the install REQUEST completed. ``installed`` is set —
 *      and the marker persisted — exclusively when Atelnyo later
 *      DETECTS itself running in an installed-app window (standalone
 *      display-mode). This accept → browser installs → detect-standalone
 *      flow prevents any state falsification.
 *
 * ``getState()`` exposes ``installable`` / ``promptAvailable`` /
 * ``installed`` as three independent booleans so the UI can render each
 * facet without guessing. ``standalone`` is exposed separately (a C
 * session can also be visited from a plain tab).
 *
 * MANIFEST IDENTITY — the Web App Manifest is part of the install
 * ecosystem; this manager works hand-in-hand with it. ``manifest.id``
 * is the STABLE app identity the browser uses (not the URL):
 * ``getState().manifestId`` exposes the resolved identity (per spec,
 * ``id`` resolves against ``start_url``; when ``id`` is absent the
 * resolved ``start_url`` IS the identity — see the detector). A URL
 * change — ``/`` → ``/app``, query-string moves — can never be misread
 * as a different app or a re-install, because the persisted install
 * marker and the ``installed`` signals describe THIS identity.
 *
 * Persisted keys (shared with the legacy InstallPrompt) — NOTE: prompt
 * AVAILABILITY is never persisted. A held prompt (``deferredPrompt``)
 * is ephemeral: the browser may withhold the event, revoke it, or have
 * it rendered moot by an install. Only the durable facts below survive
 * reloads; ``hasInstallPrompt()`` is always computed live from the
 * held event + current install state.
 *   atelnyo_pwa_installed    → "1" once the app is on the home screen.
 *   atelnyo_pwa_dismissed_at → epoch ms of the last banner dismissal
 *                               (7-day quiet window).
 */
import {
  STORAGE,
  DISMISS_DAYS,
  PROMPT_POLICY,
  STORE_URLS,
  INSTALL_STATES,
  INSTALL_REASONS,
  CAPABILITIES,
  INSTALLABILITY,
  PROMPT_AVAILABILITY,
  PLATFORMS,
  DISPLAY_MODES,
  BROWSERS,
} from './installationTypes.js';
import {
  detectPlatform,
  detectBrowser,
  detectDisplayMode,
  isAppWindow,
  hasManifest,
  manifestIdentity,
  readStored,
  writeStored,
  detectCapability,
} from './installationDetector.js';
import { getInstallationInstructions } from './browserFallback.js';
import { InstallPromptHandler } from './installPromptHandler.js';

/* ------------------------------------------------------------------ *
 * Installation Manager (singleton)
 * ------------------------------------------------------------------ */

class InstallationManager {
  constructor() {
    this._inited = false;
    this.state = INSTALL_STATES.UNKNOWN;
    this.reason = null;
    this.capability = CAPABILITIES.NONE;
    this.platform = PLATFORMS.DESKTOP;
    this.browser = BROWSERS.UNKNOWN;
    this.displayMode = DISPLAY_MODES.UNKNOWN;
    this.standalone = false;
    this.isAppWindow = false;
    this._listeners = new Set();

    // ── Install Prompt adapter — owns the native beforeinstallprompt /
    //    appinstalled interaction (installPromptHandler.js); the machine
    //    here decides what each fact means for the state. ────────────
    this._promptHandler = new InstallPromptHandler({
      // B — the browser now lets us ASK the user to install.
      onCaptured: () => this._set(INSTALL_STATES.PROMPT_AVAILABLE, INSTALL_REASONS.EVENT_CAPTURED),
      // The browser finished the install REQUEST — the manager decides
      // how to re-resolve (UX confirmation only, never falsifies the
      // installed marker by itself).
      onAppInstalled: () => this._onAppInstalled(),
    });

    // ── Prompt-timing state ("good moment" heuristics) ────────────
    // ``promptReady`` flips true once the page has settled AND the
    // user engaged for the first time — only then may the UI offer
    // installation (see PROMPT_POLICY). ``_impression`` enforces the
    // one-offer-per-session cap.
    this.promptReady = false;
    this._engaged = false;
    this._impression = false;
    this._loadStart = 0;
    // UX outcome of the last native dialog: 'accepted' | 'dismissed'
    // | null. Session-scoped UX state — never persisted, never treated
    // as proof of installation (see _acceptPrompt / _recomputeState).
    this.lastOutcome = null;
    // True once the browser's ``appinstalled`` event fired — the install
    // REQUEST completed. Still NOT the definitive installed state: that
    // is only reached via standalone DETECTION (see _recomputeState).
    this.installConfirmed = false;
    // Resolved Web App Manifest identity (``manifest.id`` → stable app
    // id the BROWSER uses to identify Atelnyo). ``null`` until the
    // manifest has been fetched once (async, at init). The identity is
    // INDEPENDENT of the current URL — see manifestIdentity().
    this.manifestId = null;
    // Manifest-identity fetch cache (href → resolved?) so repeated
    // initialize() calls don't re-fetch an unchanged manifest.
    this._lastManifestHref = null;
    this._manifestResolved = false;
    // Last-seen persisted marker value — lets _reDetect() notice a
    // marker change (e.g. a deferred storage event from a background
    // tab) even when the display mode itself never changed.
    this._lastStartup = false;

    this._onStorage = (e) => {
      // Cross-tab install-marker changes: another tab DETECTED itself
      // running standalone and persisted the marker (or reset it).
      // Re-resolve from current facts so this tab's state never goes
      // stale, and drop any held prompt — an app installed elsewhere
      // makes any deferred prompt moot (the browser never re-fires
      // beforeinstallprompt once the app is on the device).
      if (e.key === STORAGE.installed) {
        this._promptHandler.clear();
        this._recomputeState();
      }
    };

    this._onReactive = () => {
      // Re-activation (focus / pageshow / visibilitychange): re-run
      // detection and recompute ONLY if the display mode actually
      // changed — the installed answer is always re-derived from the
      // three signals, never trusted from a single stale one.
      this._reDetect();
    };
  }

  /** Bind window listeners once. Idempotent. Returns `this`. */
  init() {
    if (this._inited || typeof window === 'undefined') return this;
    this._inited = true;

    // Dev/debug affordance: inspect the three facts (A/B/C) from the
    // console, e.g. ``window.__installationManager.getState()``.
    try {
      window.__installationManager = this;
    } catch (_) { /* ignore */ }

    // ── Startup detection: re-evaluate the WHOLE pipeline ──────────
    //    detect display mode → detect install capability → detect
    //    available prompt → calculate current state. initialize() is
    //    idempotent and can be called again any time to refresh.
    this.initialize();

    // ── Prompt timing: Atelnyo decides WHEN to offer install ───────
    // The captured event alone never flashes the banner immediately.
    // We wait for the page to settle (min load time) AND the user's
    // first engagement (scroll / tap / key) before ``promptReady``
    // flips — then the UI may claim the single session impression.
    this._loadStart = Date.now();
    this._armReadiness();

    // ── Install Prompt wiring (installPromptHandler.js) ────────────
    // Binds beforeinstallprompt + appinstalled and reports through
    // the callbacks wired in the constructor.
    this._promptHandler.bind();
    // Cross-tab marker sync: a deferred ``storage`` event from a
    // background tab that installed the app updates THIS tab too.
    window.addEventListener('storage', this._onStorage);

    // ── LIVE standalone detection (signal 2 of 3) ──────────────────
    // The display-mode media query fires a ``change`` when this window
    // transitions into/out of an installed-app window — e.g. a browser
    // that relaunches the page as an app. Fused with the appinstalled
    // event (1) and startup detection (3), no single signal is trusted.
    try {
      this._mql = window.matchMedia('(display-mode: standalone)');
      // Bound reference kept so destroy() can detach the live listener.
      this._onModeChange = () => this._reDetect();
      if (typeof this._mql.addEventListener === 'function') {
        this._mql.addEventListener('change', this._onModeChange);
      } else if (typeof this._mql.addListener === 'function') {
        this._mql.addListener(this._onModeChange);
      }
    } catch (_) { /* legacy — detection still runs at init/reset */ }
    // Re-activation checks: re-verify when the app comes back to the
    // foreground (the install may have finished while it was hidden).
    window.addEventListener('focus', this._onReactive);
    window.addEventListener('pageshow', this._onReactive);
    window.addEventListener('visibilitychange', this._onReactive);
    return this;
  }

  /**
   * PUBLIC — re-evaluate the full installation pipeline from scratch.
   *
   * Startup detection: every time Atelnyo starts (or when the app
   * wants a fresh read — re-activation, HMR, deep-link), re-run
   *
   *   detect display mode → detect install capability
   *   → detect available prompt → calculate current state
   *
   * Idempotent and safe to call any time. ``init()`` binds the window
   * listeners ONCE and then delegates here; callers may also invoke
   * ``initialize()`` directly to refresh the machine without touching
   * the wiring. A captured beforeinstallprompt event is preserved
   * (recompute resolves from static facts, so we restore PROMPT_AVAILABLE
   * afterwards) unless the app turned out to be installed meanwhile.
   */
  initialize() {
    if (typeof window === 'undefined') return this;
    const wasAccepted = this.state === INSTALL_STATES.ACCEPTED;
    const heldPrompt = this._promptHandler.held();
    this.platform = detectPlatform();
    this.browser = detectBrowser();
    this.capability = detectCapability(this.platform, this.browser);
    this.displayMode = detectDisplayMode();
    // ``standalone`` is the PRIMARY indicator (display-mode: standalone);
    // ``isAppWindow`` also covers minimal-ui / fullscreen /
    // window-controls-overlay windows.
    this.standalone = this.displayMode === DISPLAY_MODES.STANDALONE;
    this.isAppWindow = isAppWindow(this.displayMode);
    this._recomputeState();
    // ── Manifest identity (async, fire-and-forget): the Web App
    //    Manifest ``id`` is the STABLE app identity the browser uses —
    //    independent of the current URL. Re-fetched on every
    //    re-evaluation so a URL/base change (or a manifest update)
    //    re-resolves it; when the fetch lands, the identity is stored
    //    in ``manifestId`` and the snapshot refreshes
    //    (getState().manifestId).
    this._resolveManifestIdentity();
    // Preserve session UX states that recompute (static facts only)
    // cannot produce — unless the facts genuinely changed to INSTALLED:
    if (this.state === INSTALL_STATES.INSTALLED) {
      // The app got installed meanwhile — any held prompt is moot.
      if (heldPrompt) this._promptHandler.clear();
    } else if (heldPrompt) {
      // A captured beforeinstallprompt event (B) must never be lost by
      // a re-evaluation.
      this._set(INSTALL_STATES.PROMPT_AVAILABLE, INSTALL_REASONS.EVENT_CAPTURED);
    } else if (wasAccepted) {
      // The user accepted and the browser is still installing — keep
      // the ACCEPTED UX state until detection confirms (or facts flip
      // to INSTALLED, handled above).
      this._set(INSTALL_STATES.ACCEPTED);
    }
    return this;
  }

  /**
   * Arm the "good moment" heuristics — min time-on-page + first
   * engagement. Both are one-shot: once the page settles and the user
   * interacts at least once, ``promptReady`` stays true for the rest of
   * this page load.
   */
  _armReadiness() {
    // Bound reference kept so destroy() can detach the engagement
    // listeners and the readiness timer (full teardown contract).
    this._onFirstEngage = () => {
      if (this._engaged) return;
      this._engaged = true;
      this._maybeReady();
    };
    try {
      window.addEventListener('scroll', this._onFirstEngage, { once: true, passive: true });
      window.addEventListener('pointerdown', this._onFirstEngage, { once: true });
      window.addEventListener('keydown', this._onFirstEngage, { once: true });
    } catch (_) { /* legacy browsers ignore the options bag — fine */ }
    this._readinessTimer = setTimeout(() => this._maybeReady(), PROMPT_POLICY.minLoadMs);
  }

  /** Set ``promptReady`` when both readiness conditions are met. */
  _maybeReady() {
    if (this.promptReady || !this._inited) return;
    const waited = (Date.now() - this._loadStart) >= (Number(PROMPT_POLICY.minLoadMs) || 0);
    if (waited && (!PROMPT_POLICY.requireEngagement || this._engaged)) {
      this.promptReady = true;
      this._notify();
    }
  }

  /**
   * PUBLIC — dynamic "do we currently hold a usable install prompt?"
   *
   * The browser can withhold the event, revoke the deferred prompt, or
   * the app may already be installed (which makes any held prompt
   * stale). Computed LIVE from the held event + current install state —
   * never trusted across sessions and never derived from a persisted
   * ``localStorage.installPrompt``-style flag. Call it whenever you
   * need the current answer.
   */
  hasInstallPrompt() {
    return this._promptHandler.hasUsable()
      && !this.isInstalled();
  }

  /**
   * Single source of truth for resolving the machine state from the
   * CURRENT facts (window display-mode, persisted install marker,
   * capability, manifest). Used by init(), reset(), _onAppInstalled()
   * and _onStorage() so no two resolution paths can drift apart.
   *
   * DETECTION is the only path that persists the installed marker:
   * running in an installed-app window (standalone display-mode) is the
   * browser's own state mechanism confirming the install. Dialog
   * acceptance (``_acceptPrompt``) and the ``appinstalled`` event
   * (``_onAppInstalled``) never write the marker.
   */
  _recomputeState() {
    if (this.isAppWindow) {
      // Standalone detection = definitive proof → persist the fact so
      // future tab sessions also know the app is on the device.
      writeStored(STORAGE.installed, '1');
      this._lastStartup = true;
      this._set(INSTALL_STATES.INSTALLED, INSTALL_REASONS.STANDALONE);
      return;
    }
    // Keep the last-seen startup signal in sync so _reDetect() can
    // notice a marker change (e.g. a deferred storage event from a
    // background tab) even without a display-mode change.
    this._lastStartup = readStored(STORAGE.installed) === '1';
    if (this._lastStartup) {
      this._set(INSTALL_STATES.INSTALLED, INSTALL_REASONS.DEVICE_INSTALLED);
      return;
    }
    if (this.capability === CAPABILITIES.PROMPT && hasManifest()) {
      this._set(INSTALL_STATES.INSTALLABLE, null);
      return;
    }
    if (this.capability === CAPABILITIES.PROMPT) {
      this._set(INSTALL_STATES.UNSUPPORTED, INSTALL_REASONS.NO_MANIFEST);
      return;
    }
    if (this.capability === CAPABILITIES.INSTRUCTIONS) {
      // Browser Fallback — this browser has its OWN install mechanism
      // (menu / address-bar / Share sheet) even though we have no
      // programmatic prompt. Only route to instructions when a real
      // fallback path exists; otherwise fall through to UNSUPPORTED.
      if (this.fallbackInstructions() !== null) {
        this._set(INSTALL_STATES.INSTRUCTIONS, null);
        return;
      }
    }
    this._set(INSTALL_STATES.UNSUPPORTED, null);
  }

  /**
   * PUBLIC — "Is now a good moment to show the install prompt?"
   *
   * The full offer predicate: we hold a USABLE prompt right now AND
   * the page reached the good-moment (min load time + first
   * engagement) AND no impression was claimed this session AND the
   * 7-day quiet window is not active. Atelnyo calls this wherever it
   * needs the timing decision — the heuristics live here, not in the UI.
   */
  readyToShowPrompt() {
    return this.hasInstallPrompt()
      && this.promptReady === true
      && (!PROMPT_POLICY.oncePerSession || !this._impression)
      && !this.isRecentlyDismissed();
  }

  /**
   * PUBLIC — Atelnyo decided the moment is right: claim the single
   * per-session impression. Returns true when the claim succeeded;
   * subsequent calls (and later notifications) will not re-offer
   * until the next page load.
   */
  claimPrompt() {
    if (!this.readyToShowPrompt()) return false;
    this._impression = true;
    this._notify();
    return true;
  }

  /**
   * The THREE confirmation signals for "installed" — fused, never
   * trusted one alone:
   *   • appinstalled — the browser event: the install REQUEST completed
   *                    (UX signal only; absent on some browsers).
   *   • standalone   — LIVE detection: THIS session is an installed-app
   *                    window (display-mode standalone / minimal-ui /
   *                    fullscreen / window-controls-overlay).
   *   • startup      — persisted: a previous startup DETECTED the app
   *                    running standalone and wrote the marker.
   */
  _signals() {
    return {
      appinstalled: this.installConfirmed === true,
      standalone: this.isAppWindow === true,
      startup: readStored(STORAGE.installed) === '1',
    };
  }

  /**
   * The two SEPARATE install capabilities — never conflated:
   *   • installability     — is Atelnyo recognized as installable by
   *                          this browser (manifest valid + SOME
   *                          mechanism)? YES even when no prompt event
   *                          ever fires — the user can still install
   *                          via the browser's own UI.
   *   • promptAvailability — has the beforeinstallprompt event been
   *                          captured, so Atelnyo can invoke the
   *                          native dialog itself?
   */
  _capabilities() {
    let installability = INSTALLABILITY.UNKNOWN;
    if (this.state !== INSTALL_STATES.UNKNOWN) {
      installability = (this.reason !== INSTALL_REASONS.NO_MANIFEST
          && this.capability !== CAPABILITIES.NONE)
        ? INSTALLABILITY.YES
        : INSTALLABILITY.NO;
    }
    return {
      installability,
      promptAvailability: this.hasInstallPrompt()
        ? PROMPT_AVAILABILITY.YES
        : PROMPT_AVAILABILITY.NO,
    };
  }

  /**
   * Re-run display-mode detection and recompute ONLY when a relevant
   * fact changed: the display mode OR the persisted marker (startup
   * signal). Called by the live media-query ``change`` listener and by
   * re-activation events (focus / pageshow / visibilitychange) — this
   * also catches deferred ``storage`` events from background tabs.
   */
  _reDetect() {
    const mode = detectDisplayMode();
    const startup = readStored(STORAGE.installed) === '1';
    if (mode === this.displayMode && startup === this._lastStartup) return;
    this._lastStartup = startup;
    this.displayMode = mode;
    this.standalone = mode === DISPLAY_MODES.STANDALONE;
    this.isAppWindow = isAppWindow(mode);
    this._recomputeState();
  }

  /**
   * PUBLIC ABSTRACTION — is Atelnyo installed and running as an app?
   *
   * The whole Atelnyo app calls this instead of sniffing display-mode
   * APIs. Answer: derived from the fused signals — running as an
   * installed-app window (standalone) OR a previous startup detected it
   * (marker). Nobody here needs to know which signal answered.
   *
   * INTENTIONAL CONSEQUENCE: the marker is written ONLY by standalone
   * detection (see _recomputeState). A dialog acceptance or an
   * ``appinstalled`` event alone NEVER reports installed — so a tab
   * reports not-installed until the app has actually been launched
   * standalone at least once. Do not "fix" this back into falsification.
   */
  isInstalled() {
    const s = this._signals();
    return s.standalone || s.startup;
  }

  /**
   * PUBLIC ABSTRACTION — the STRICT primary indicator
   * (display-mode: standalone). Prefer ``isInstalled()`` unless you
   * specifically need the standalone mode.
   */
  isStandalone() {
    return this.standalone === true;
  }

  /**
   * PUBLIC — concept A: does this browser RECOGNIZE Atelnyo as
   * installable right now? (manifest valid + SOME install mechanism.)
   * Independent of the prompt event — the app can be installable
   * through the browser's OWN UI even when no beforeinstallprompt has
   * been captured yet (e.g. Chrome pre-event: installable YES ·
   * prompt UNKNOWN · still installable).
   */
  isInstallable() {
    return this._capabilities().installability === INSTALLABILITY.YES;
  }

  /**
   * PUBLIC — concept B: do we currently HOLD a USABLE native install
   * prompt? Always a live, dynamic answer (see hasInstallPrompt): the
   * browser can withhold, revoke, or moot the event at any time —
   * never trusted from a persisted flag.
   */
  isPromptAvailable() {
    return this.hasInstallPrompt();
  }

  /**
   * PUBLIC — HOW can the user install Atelnyo on THIS browser?
   *   • 'prompt'       → the native install dialog is available
   *                      (beforeinstallprompt captured and usable)
   *   • 'instructions' → no programmatic prompt, but the browser has
   *                      its OWN install mechanism in its UI — use
   *                      getBrowserFallback() for the exact steps
   *   • 'none'         → no install path at all (Firefox desktop
   *                      stable, in-app webviews)
   * Returns the capability bucket (CAPABILITIES), never a hard-coded
   * message — the UI branches on this stable value.
   */
  getInstallMethod() {
    return this.capability;
  }

  /**
   * PUBLIC — the ACTIVE display-mode bucket of THIS session:
   * 'standalone' (the primary installed-app indicator) | 'minimal-ui'
   * | 'fullscreen' | 'window-controls-overlay' | 'browser' |
   * 'unknown'. Derived by the detector (primary media query +
   * platform fallbacks) — components never sniff display-mode APIs.
   */
  getDisplayMode() {
    return this.displayMode;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Current immutable-ish snapshot for consumers. */
  getState() {
    const state = this.state;
    return {
      state,
      reason: this.reason || null,
      platform: this.platform,
      capability: this.capability,
      browser: this.browser,
      displayMode: this.displayMode,
      // The resolved Web App Manifest identity (``manifest.id`` — the
      // STABLE app id the browser uses to identify Atelnyo, resolved
      // per spec against start_url). Independent of the current URL: a
      // URL change can never be misread as a different app or a
      // re-install. Null until the manifest fetch resolves at init.
      manifestId: this.manifestId,
      // True when this session is running as an installed app window
      // (primary indicator: display-mode: standalone).
      standalone: this.standalone === true,
      // Any installed-app window mode (standalone / minimal-ui /
      // fullscreen / window-controls-overlay).
      isAppWindow: this.isAppWindow === true,
      // ── The three distinct concepts, as independent booleans ──────
      // A. Browser recognizes Atelnyo as installable.
      installable: state === INSTALL_STATES.INSTALLABLE
        || state === INSTALL_STATES.PROMPT_AVAILABLE,
      // B. A captured prompt lets us ask the user to install.
      promptAvailable: state === INSTALL_STATES.PROMPT_AVAILABLE,
      // C. Already running / already on the device — never prompt.
      installed: state === INSTALL_STATES.INSTALLED,
      // ── Deferred install prompt — ALWAYS a live, dynamic answer ────
      // ``promptHeld`` is the raw fact (did the browser hand us a
      // deferred event?); ``canPrompt`` is the usable answer (held AND
      // still valid AND the app is not already installed). Neither is
      // read from localStorage or assumed to stay true — the browser
      // can withhold, revoke, or moot the event at any time.
      promptHeld: this._promptHandler.held(),
      canPrompt: this.hasInstallPrompt(),
      // ── Prompt timing ("good moment" reached?) ────────────────────
      // Atelnyo decides when to offer installation: a minimum
      // time-on-page + the user's first engagement must both have
      // happened (see PROMPT_POLICY). The banner waits for promptReady.
      promptReady: this.promptReady === true,
      // True once the single per-session impression was claimed
      // (see claimPrompt()).
      promptShown: this._impression === true,
      // UX outcome of the last dialog: 'accepted' | 'dismissed' | null.
      // UX state ONLY — never treated as proof of installation (see
      // _acceptPrompt / _recomputeState: only standalone detection
      // persists the installed marker).
      promptOutcome: this.lastOutcome,
      // True once the browser's appinstalled event fired — the install
      // REQUEST completed. Still NOT the definitive installed state:
      // that requires standalone DETECTION (see _recomputeState).
      installConfirmed: this.installConfirmed === true,
      // ── The three confirmation signals (appinstalled / standalone /
      //    startup) — fused, never trusted one alone (see _signals).
      signals: this._signals(),
      // ── The two SEPARATE install capabilities — installability is
      //    NOT the same as prompt availability (see _capabilities):
      //    e.g. Chrome pre-event → installability 'yes', prompt 'no',
      //    still installable via the browser's own UI.
      capabilities: this._capabilities(),
      // ── Browser Fallback instruction set for THIS browser+platform
      //    ({ platform, browser, method, instructions } — per-browser
      //    wording, never one hard-coded message). null on Firefox
      //    desktop (genuinely pathless) → the UI shows the UNSUPPORTED
      //    surface.
      installation: this.getBrowserFallback(),
      // ── Three-fact verdicts (YES / NO / UNKNOWN) ──────────────────
      // Each concept answers one question; UNKNOWN is a real answer
      // (e.g. the prompt event may still fire — we don't know yet).
      facts: this._verdicts(),
      // Publishable store availability (empty strings when unconfigured).
      stores: {
        googlePlay: STORE_URLS.googlePlay,
        appleAppStore: STORE_URLS.appleAppStore,
      },
    };
  }

  /**
   * YES / NO / UNKNOWN verdicts for the three concepts (A/B/C).
   *   • installable → does the browser recognize the app as installable?
   *   • prompt      → is a native install prompt available to us?
   *                    UNKNOWN = capable engine, event not fired yet.
   *   • standalone  → is this session running as an installed app?
   */
  _verdicts() {
    const state = this.state;
    const canEverPrompt = this.capability === CAPABILITIES.PROMPT
      && this.reason !== INSTALL_REASONS.NO_MANIFEST;

    let installable = 'no';
    if (state === INSTALL_STATES.UNKNOWN) {
      installable = 'unknown';
    } else if (this._capabilities().installability === INSTALLABILITY.YES) {
      // Installability is a capability INDEPENDENT of the prompt event:
      // prompt-capable engine OR manual-install platform (iOS/Android)
      // OR desktop install UI — the app can reach the home screen even
      // if beforeinstallprompt never fires.
      installable = 'yes';
    }

    let prompt = 'unknown';
    if (state === INSTALL_STATES.PROMPT_AVAILABLE) {
      // Dynamic: the held event can be revoked at any moment — only a
      // still-usable prompt counts as 'yes'.
      prompt = this.hasInstallPrompt() ? 'yes' : 'no';
    } else if (state === INSTALL_STATES.REQUESTED) {
      // Dialog is open / awaiting the user's choice.
      prompt = 'yes';
    } else if (state === INSTALL_STATES.ACCEPTED
        || state === INSTALL_STATES.INSTRUCTIONS) {
      // Dialog concluded (accepted or dismissed) — no prompt remains
      // for this page load.
      prompt = 'no';
    } else if (!canEverPrompt) {
      // iOS / Firefox / missing manifest / already declined — the native
      // dialog will never appear on this browser.
      prompt = 'no';
    }
    // else: INSTALLABLE (or INSTALLED) on a prompt-capable engine → the
    // event may still fire later → UNKNOWN. Matches the spec's example
    // (installable YES · prompt UNKNOWN · standalone YES).

    let standalone = 'no';
    if (state === INSTALL_STATES.UNKNOWN) {
      standalone = 'unknown';
    } else if (this.isAppWindow === true) {
      // ANY installed-app display mode counts (standalone is primary,
      // but minimal-ui / fullscreen / window-controls-overlay also mean
      // the app is installed and running as an app window).
      standalone = 'yes';
    }

    return { installable, prompt, standalone };
  }

  /**
   * PUBLIC — show the native install dialog intentionally.
   *
   * Only valid while the beforeinstallprompt event is captured
   * (PROMPT_AVAILABLE). Transitions to REQUESTED while the dialog is
   * open, then to ACCEPTED on accept (a UX state — see _acceptPrompt),
   * or back to INSTRUCTIONS on reject (Chrome only fires the event once
   * per page load, so a rejected prompt cannot be re-shown without a
   * reload).
   *
   * The prompt interaction itself lives in the prompt handler
   * (installPromptHandler.show()); this machine decides the states.
   *
   * @returns {Promise<boolean>} true when the user ACCEPTED the dialog
   *   (a UX outcome — NOT proof of installation, see _acceptPrompt).
   */
  async promptInstall() {
    // Dynamic guard: the held prompt may have been revoked or rendered
    // stale (no usable .prompt, or the app got installed in another
    // tab) since it was captured — never show or use a stale prompt.
    if (!this.hasInstallPrompt()) return false;
    // Snapshot the held event BEFORE the synchronous _set() notification
    // (listeners run during _notify()): a listener reacting to REQUESTED
    // must never be able to invalidate the dialog we are about to show.
    const held = this._promptHandler.heldEvent();
    this._set(INSTALL_STATES.REQUESTED);
    const outcome = await this._promptHandler.show(held);
    if (outcome === 'accepted') {
      // 'accepted' is a UX OUTCOME, not proof of installation. Even
      // the appinstalled event only confirms the request completed;
      // the persistent marker is written ONLY when Atelnyo later
      // detects itself running as an installed app (standalone
      // display-mode, in _recomputeState). Here we record UX state.
      this._acceptPrompt();
      return true;
    }
    if (outcome === 'dismissed') {
      // Dismissed: Chrome only fires beforeinstallprompt once per page
      // load, so the native path is exhausted — route the user to the
      // manual instructions instead of a forever "waiting" state.
      this.lastOutcome = 'dismissed';
      this._set(INSTALL_STATES.INSTRUCTIONS, INSTALL_REASONS.PROMPT_DECLINED);
    } else {
      // prompt() rejected (e.g. page lost focus) — fall back to the
      // instructions surface so the user still has a path.
      this._set(INSTALL_STATES.INSTRUCTIONS, null);
    }
    return false;
  }

  /**
   * @deprecated use promptInstall() — kept as an alias for existing
   * callers while the codebase migrates to the new public API.
   */
  async install() {
    return this.promptInstall();
  }

  /**
   * User accepted the native dialog → transition to the ACCEPTED UX
   * state. Deliberately does NOT write the persistent installed marker
   * nor claim INSTALLED: dialog acceptance is not proof of
   * installation. Even the ``appinstalled`` event only confirms the
   * request completed; only standalone DETECTION (→ _recomputeState)
   * persists the marker.
   */
  _acceptPrompt() {
    this._promptHandler.clear();
    this.lastOutcome = 'accepted';
    // Race guard: if a cross-tab standalone detection already wrote the
    // marker (storage event → INSTALLED) before the userChoice promise
    // resolved, never downgrade the machine back to ACCEPTED.
    if (this.isInstalled()) {
      this._recomputeState();
      return;
    }
    this._set(INSTALL_STATES.ACCEPTED);
  }

  /**
   * The browser finished the install REQUEST (``appinstalled``) —
   * reported by the prompt handler. UX confirmation ONLY: this never
   * falsifies the installed marker by itself; the definitive state is
   * reached through standalone DETECTION. Re-resolve honestly from
   * current facts, then re-verify via detection shortly after (some
   * platforms finish their display-mode transition a beat later).
   */
  _onAppInstalled() {
    this.installConfirmed = true;
    this._promptHandler.clear();
    if (this.state === INSTALL_STATES.ACCEPTED) {
      // Normal flow: accepted → browser finished → stay in the ACCEPTED
      // UX state until standalone detection confirms the install.
      this._notify();
    } else {
      // Install completed outside our accepted flow (e.g. browser UI)
      // — re-resolve honestly from current facts.
      this._recomputeState();
    }
    // Never trust the event ALONE — re-verify via detection shortly
    // after (some platforms finish their display-mode transition a
    // beat later). _reDetect is a no-op unless the mode changed.
    setTimeout(() => this._reDetect(), 600);
  }

  /**
   * PUBLIC — the resolved MANIFEST IDENTITY (``manifest.id``) of
   * Atelnyo — the STABLE app id the BROWSER uses to identify this
   * application, per the Web App Manifest spec.
   *
   * The URL is NOT the identity: ``id`` is resolved against
   * ``start_url`` (spec), so a URL change (e.g. ``/`` → ``/app`` or a
   * query-string move) can NEVER be misread as a different app or a
   * re-install — the browser keeps identifying the same atelnyo. The
   * Installation Manager works hand-in-hand with this identity:
   * ``getState().manifestId`` exposes it to the UI, and the persisted
   * install marker describes THIS identity.
   *
   * Returns ``null`` until the manifest has been fetched once
   * (async, at init). Falls back to the resolved ``start_url`` when
   * the manifest omits ``id`` (spec default) — still a stable
   * identity as long as start_url stays stable.
   */
  manifestIdentity() {
    return this.manifestId;
  }

  /**
   * Fetch the Web App Manifest once and resolve the stable app
   * identity. Same fetch the browser itself performs to identify the
   * app — reading the REAL ``id`` / ``start_url`` from the manifest
   * document (not from the HTML link). Failure is non-fatal: identity
   * stays ``null`` and the machine keeps working (installability
   * already gates on hasManifest()).
   */
  async _resolveManifestIdentity() {
    let link = null;
    try {
      link = document.querySelector('link[rel="manifest"]');
      if (!link || !link.href) return;
    } catch (_) {
      return;
    }
    // Cache by href: re-fetch only when the manifest URL actually
    // changed (a URL/base change re-resolves identity; an identical
    // manifest on repeated initialize() calls is not re-fetched).
    const changed = link.href !== this._lastManifestHref;
    if (!changed && this._manifestResolved) return;
    this._lastManifestHref = link.href;
    // The manifest document changed (new href): the previous identity
    // is no longer authoritative — clear it before fetching so we can
    // never report a STALE identity for a different manifest. If the
    // fetch then fails, identity stays null (honest) until a retry.
    if (changed) this.manifestId = null;
    try {
      const res = await fetch(link.href, { credentials: 'omit' });
      if (!res.ok) return;
      const manifest = await res.json();
      // Per spec: id resolves against start_url and must stay within
      // scope; the manifest document URL is the resolution base (the
      // same URL the browser fetched to identify the app). If id is
      // absent, the resolved start_url IS the identity.
      this.manifestId = manifestIdentity(manifest.id, manifest.start_url, manifest.scope, link.href);
      this._manifestResolved = true;
      this._notify(); // refresh the snapshot with the identity
    } catch (_) {
      /* fetch/parse failed — identity stays null; non-fatal */
    }
  }

  /**
   * PUBLIC — Browser Fallback abstraction: HOW to install Atelnyo
   * through THIS browser's OWN install mechanism.
   *
   * "No programmatic prompt" is NOT "cannot be installed": most
   * browsers expose an install action in their native UI (address-bar
   * icon, ⋮ menu, Share sheet, Apps menu…). The fallback is NEVER a
   * single hard-coded message — this returns a structured description
   * of the exact mechanism for the current browser+platform (owned by
   * the browserFallback module):
   *
   *   {
   *     platform,     // 'ios' | 'android' | 'desktop'
   *     browser,      // BROWSERS bucket ('chrome' | 'edge' | …)
   *     method,       // copy key naming the mechanism (e.g. Share
   *                   // sheet, address-bar icon, ⋯ Apps menu)
   *     instructions, // copy keys for the step-by-step path
   *   }
   *
   * Returns null when this browser genuinely has no install mechanism
   * (Firefox desktop stable, in-app webviews) — the UI then routes to
   * the UNSUPPORTED surface which suggests a capable browser.
   */
  /**
   * PUBLIC — the detailed Browser Fallback for THIS browser+platform
   * ({ platform, browser, method, instructions } — per-browser
   * wording, never one hard-coded message). null when this browser
   * genuinely has no install mechanism (Firefox desktop stable,
   * in-app webviews) — the UI then routes to the UNSUPPORTED surface.
   */
  getBrowserFallback() {
    return getInstallationInstructions(this.browser, this.platform);
  }

  /**
   * @deprecated use getBrowserFallback() — kept as an alias for
   * existing callers while the codebase migrates to the new public API.
   */
  getInstallationInstructions() {
    return this.getBrowserFallback();
  }

  /**
   * Alias for getInstallationInstructions() — non-null exactly when a
   * real fallback path exists for the current browser (used by
   * _recomputeState()/routeToInstructions() as the INSTRUCTIONS guard).
   */
  fallbackInstructions() {
    return this.getBrowserFallback();
  }

  /**
   * Route the UI to the manual-instructions surface even when the
   * browser never fired beforeinstallprompt (engagement criteria not
   * met yet). Gives the Settings panel a non-blocking secondary path
   * out of the "waiting forever" INSTALLABLE state.
   *
   * Same guard as _recomputeState(): only route to INSTRUCTIONS when a
   * REAL fallback path exists for this browser — a pathless browser
   * (Firefox desktop stable) must never be shown install steps that
   * don't exist in its UI; it goes to the honest UNSUPPORTED surface
   * which suggests a capable browser.
   */
  routeToInstructions() {
    if (this.state === INSTALL_STATES.INSTALLED) return;
    this._promptHandler.clear();
    if (this.fallbackInstructions() === null) {
      this._set(INSTALL_STATES.UNSUPPORTED);
      return;
    }
    this._set(INSTALL_STATES.INSTRUCTIONS);
  }

  /** Did the user dismiss the auto banner within the quiet window? */
  isRecentlyDismissed() {
    const ts = readStored(STORAGE.dismissedAt);
    if (!ts) return false;
    const days = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }

  /** Remember that the user dismissed the auto banner. */
  noteDismissed() {
    writeStored(STORAGE.dismissedAt, String(Date.now()));
  }

  /** Clear persisted install/dismiss state (debug + reset affordance). */
  reset() {
    try {
      window.localStorage.removeItem(STORAGE.installed);
      window.localStorage.removeItem(STORAGE.dismissedAt);
    } catch (_) { /* ignore */ }
    if (!this._inited) return;
    this._promptHandler.clear();
    this.lastOutcome = null;
    this.installConfirmed = false;
    this.browser = detectBrowser();
    this.displayMode = detectDisplayMode();
    this.standalone = this.displayMode === DISPLAY_MODES.STANDALONE;
    this.isAppWindow = isAppWindow(this.displayMode);
    this._recomputeState();
  }

  /**
   * PUBLIC — FULL TEARDOWN (tests / HMR): detach every window listener
   * and the live display-mode media query, drop the held prompt, clear
   * the readiness timer + engagement listeners, reset the machine to
   * the honest pre-init state, and release all subscribers. After
   * destroy(), ``init()`` re-wires everything for a fresh lifecycle.
   * Idempotent and safe to call at any time.
   *
   * ⚠️ NOTE: destroy() also releases every subscriber — including the
   * App Controller's reactive wiring (AppController.js). A destroy() →
   * init() cycle WITHOUT a page reload leaves the App Controller's
   * IM-driven runtime pushes silent (getRuntime() on demand still reads
   * fresh state — only the pushed updates stop). In practice destroy()
   * is used by tests and HMR only, where the module graph re-evaluates.
   */
  destroy() {
    if (typeof window === 'undefined') return this;
    // Prompt handler: drop the held event + unbind native listeners.
    this._promptHandler.destroy();
    // Window listeners (bound once in init()).
    window.removeEventListener('storage', this._onStorage);
    window.removeEventListener('focus', this._onReactive);
    window.removeEventListener('pageshow', this._onReactive);
    window.removeEventListener('visibilitychange', this._onReactive);
    // Live display-mode media query (bound in init()).
    if (this._mql && this._onModeChange) {
      try {
        if (typeof this._mql.removeEventListener === 'function') {
          this._mql.removeEventListener('change', this._onModeChange);
        } else if (typeof this._mql.removeListener === 'function') {
          this._mql.removeListener(this._onModeChange);
        }
      } catch (_) { /* legacy — ignore */ }
      this._mql = null;
      this._onModeChange = null;
    }
    // Prompt-timing engagement listeners + readiness timer.
    if (this._onFirstEngage) {
      // removeEventListener never throws for unknown listeners — the
      // capture flag (absent) is what matters for listener matching.
      window.removeEventListener('scroll', this._onFirstEngage, { once: true, passive: true });
      window.removeEventListener('pointerdown', this._onFirstEngage, { once: true });
      window.removeEventListener('keydown', this._onFirstEngage, { once: true });
      this._onFirstEngage = null;
    }
    if (this._readinessTimer) {
      clearTimeout(this._readinessTimer);
      this._readinessTimer = null;
    }
    // Machine back to the honest pre-init state.
    this.state = INSTALL_STATES.UNKNOWN;
    this.reason = null;
    this.capability = CAPABILITIES.NONE;
    this.platform = PLATFORMS.DESKTOP;
    this.browser = BROWSERS.UNKNOWN;
    this.displayMode = DISPLAY_MODES.UNKNOWN;
    this.standalone = false;
    this.isAppWindow = false;
    this.promptReady = false;
    this._engaged = false;
    this._impression = false;
    this.lastOutcome = null;
    this.installConfirmed = false;
    this.manifestId = null;
    this._manifestResolved = false;
    this._lastManifestHref = null;
    this._lastStartup = false;
    this._inited = false;
    this._listeners.clear();
    return this;
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try {
        fn(this.getState());
      } catch (_) { /* a bad listener must not break the machine */ }
    });
  }

  _set(state, reason = null) {
    this.state = state;
    this.reason = reason;
    this._notify();
  }
}

/** Process-wide singleton. init() runs at import on the client. */
export const installationManager = new InstallationManager();
if (typeof window !== 'undefined') {
  installationManager.init();
}

export default installationManager;
