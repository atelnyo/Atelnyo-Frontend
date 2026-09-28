/**
 * src/pwa/installation/installPromptHandler.js
 *
 * INSTALL PROMPT HANDLER — the browser-interaction ADAPTER of the PWA
 * Installation subsystem. It owns everything that touches the native
 * ``beforeinstallprompt`` / ``appinstalled`` events and the deferred
 * prompt object:
 *
 *   Browser
 *      │  beforeinstallprompt
 *      ▼
 *   InstallPromptHandler
 *      │  capture event (preventDefault → no auto mini-infobar)
 *      │  store deferred prompt (ephemeral — never persisted)
 *      ▼
 *   Installation Manager  ← decides WHEN to show + what state results
 *
 * The handler knows NOTHING about the state machine — it reports
 * facts through the callbacks injected by the manager:
 *   • onCaptured()    — the browser handed us a deferred prompt.
 *   • onAppInstalled()— the browser finished the install REQUEST
 *                       (UX confirmation only, see the manager).
 *
 * Prompt AVAILABILITY is never persisted. A held prompt (deferred
 * event) is ephemeral: the browser may withhold the event, revoke it,
 * or have it rendered moot by an install. ``hasUsable()`` is therefore
 * ALWAYS computed live from the held event + the manager's installed
 * answer — never derived from a ``localStorage.installPrompt``-style
 * flag.
 */
export class InstallPromptHandler {
  /**
   * @param {object} hooks
   * @param {() => void} hooks.onCaptured      — a beforeinstallprompt
   *   event was captured and stored.
   * @param {() => void} hooks.onAppInstalled  — the browser's
   *   ``appinstalled`` event fired (install REQUEST completed).
   */
  constructor({ onCaptured, onAppInstalled }) {
    this._deferred = null;
    this._onCaptured = onCaptured;
    this._onAppInstalled = onAppInstalled;
    this._bound = false;
  }

  /** Bind the native event listeners once. Idempotent. */
  bind() {
    if (this._bound || typeof window === 'undefined') return this;
    this._bound = true;
    window.addEventListener('beforeinstallprompt', this._onBeforeInstallPrompt);
    window.addEventListener('appinstalled', this._onAppInstalledEvent);
    return this;
  }

  _onBeforeInstallPrompt = (e) => {
    // Suppress the browser's automatic mini-infobar; Atelnyo shows its
    // own UI and decides WHEN to ask (see the manager's PROMPT_POLICY).
    e.preventDefault();
    this._deferred = e;
    this._onCaptured();
  };

  _onAppInstalledEvent = () => {
    // The deferred prompt is single-use: once the browser finished an
    // install request it never re-fires beforeinstallprompt for this
    // page load. Drop the event, then report to the manager.
    this._deferred = null;
    this._onAppInstalled();
  };

  /** Is a deferred prompt currently held? (raw fact, not usability.) */
  held() {
    return this._deferred !== null;
  }

  /** Raw held prompt event (the deferred beforeinstallprompt object). */
  heldEvent() {
    return this._deferred;
  }

  /**
   * Is the held prompt USABLE right now? The browser can withhold,
   * revoke, or moot the event at any time — only a held event that
   * still exposes a callable ``prompt()`` counts.
   */
  hasUsable() {
    return this._deferred !== null && typeof this._deferred.prompt === 'function';
  }

  /** Drop the held prompt. No callback — the manager decides what to do. */
  clear() {
    this._deferred = null;
  }

  /**
   * FULL TEARDOWN (tests / HMR): drop the held event and remove the
   * native listeners. Idempotent; after destroy() the handler can be
   * re-bound (bind()) for a fresh lifecycle.
   */
  destroy() {
    if (typeof window === 'undefined') return this;
    this._deferred = null;
    if (!this._bound) return this;
    this._bound = false;
    window.removeEventListener('beforeinstallprompt', this._onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', this._onAppInstalledEvent);
    return this;
  }

  /**
   * Invoke the native install dialog and await the user's choice.
   * The deferred event is single-use — cleared once the dialog
   * concludes (accept, dismiss, or error).
   *
   * @param {object} [event] — an explicit deferred prompt event. When
   *   omitted, the currently held event is used. The manager snapshots
   *   the event BEFORE its synchronous state notification so a
   *   listener reacting to that notification can never invalidate the
   *   dialog that is about to be shown.
   * @returns {'accepted' | 'dismissed' | 'error'}
   */
  async show(event = this._deferred) {
    const d = event;
    if (!d || typeof d.prompt !== 'function') return 'error';
    try {
      await d.prompt();
      const { outcome } = await d.userChoice;
      this._deferred = null;
      return outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch (_) {
      // Some browsers reject prompt() when the page lost focus.
      this._deferred = null;
      return 'error';
    }
  }
}
