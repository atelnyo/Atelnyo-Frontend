/**
 * src/components/InstallPrompt.jsx
 *
 * PWA install prompt — surfaces the native "Add to Home Screen" / "Install"
 * dialog when the browser fires the ``beforeinstallprompt`` event.
 *
 * All install state lives in ``installationManager`` (the single source
 * of truth — see src/pwa/installation/InstallationManager.js). This component is
 * a thin subscriber that renders:
 *   1. The install banner when the machine is in ``prompt_available``
 *      (and the user hasn't dismissed it within the quiet window).
 *   2. The "new version available" banner when the service worker has a
 *      waiting update (``atelnyo:sw:update`` event).
 *
 * UX contract:
 *   • Never shows the INSTALL banner unless beforeinstallprompt fired
 *     (browser signals install eligibility) AND the app is not already
 *     installed (standalone launch).
 *   • Atelnyo decides WHEN to ask — the banner waits for the captured
 *     prompt AND the "good moment" (min time-on-page + first user
 *     engagement, see PROMPT_POLICY in installationManager).
 *   • Once dismissed, stays hidden for 7 days (localStorage); at most
 *     one impression per session.
 *   • Auto-hides after a successful install (appinstalled event).
 *   • iOS Safari gets no native prompt — the Settings → Install panel
 *     shows the step-by-step "Add to Home Screen" instructions instead.
 */
import React, { useState, useEffect, useRef } from 'react';
import installationManager from '../pwa/installation/InstallationManager';
// State model constants live in the types module (pure vocabulary).
import { INSTALL_STATES } from '../pwa/installation/installationTypes';
// App Controller — the single source for “how is the app running right
// now?” (updateAvailable / version). It owns the SW update listener;
// this UI consumes the derived facts and never touches SW plumbing.
import appController from '../pwa/app/AppController';

// The native "Install Atelnyo on your device" banner is HIDDEN by
// default (brand decision — the app is promoted through social channels,
// not an install prompt). Set VITE_INSTALL_PROMPT_ENABLED=1 at build
// time to bring the install banner back. The "new version available"
// refresh banner is independent and always stays on.
const INSTALL_PROMPT_ENABLED =
  import.meta.env?.VITE_INSTALL_PROMPT_ENABLED === '1' ||
  import.meta.env?.VITE_INSTALL_PROMPT_ENABLED === 'true';

export default function InstallPrompt({ lang }) {
  // Resolve lang from prop first, then localStorage, default to 'ht'
  const resolvedLang = lang || (typeof window !== 'undefined' && localStorage.getItem('atelnyo_lang')) || 'ht';
  const [snap, setSnap] = useState(() => installationManager.getState());
  // Local banner visibility. Atelnyo decides WHEN to offer install —
  // the offer predicate is read here (pure — no side effect, so React
  // StrictMode's double-render cannot spend the session impression
  // twice); the impression itself is claimed in the effect below.
  const [showBanner, setShowBanner] = useState(() => installationManager.readyToShowPrompt());
  // Update-availability comes from the App Controller (which listens
  // to the SW update engine once) — no duplicate SW listener here.
  const [runtime, setRuntime] = useState(() => appController.getRuntime());
  const [updateDismissed, setUpdateDismissed] = useState(false);
  // Local flag so a dismissal hides the banner immediately for the rest
  // of this session (the manager's quiet-window covers future reloads).
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  // Snapshot the quiet-window state once at mount instead of reading
  // localStorage during every render.
  const [recentlyDismissed] = useState(() => installationManager.isRecentlyDismissed());

  // ─── Subscribe to the installation machine ───────────────────────
  // The impression is claimed ONLY from this subscription callback —
  // never from the render-phase initializer (StrictMode double-renders
  // and would spend the single impression twice) and never synchronously
  // in the effect body (react-hooks set-state-in-effect rule). The
  // machine notifies when the good-moment conditions flip on — e.g.
  // beforeinstallprompt arrived after the page settled, or the user's
  // first scroll completed the readiness check — and Atelnyo then
  // claims the single session impression and shows the ask.
  useEffect(() => installationManager.subscribe((s) => {
    setSnap(s);
    // Only claim the single session impression when the install banner
    // is actually enabled — otherwise the prompt machine stays untouched.
    if (INSTALL_PROMPT_ENABLED && installationManager.claimPrompt()) {
      setShowBanner(true);
    }
  }), []);

  // ─── SW update facts via the App Controller ─────────────────────
  // The App Controller listens to the SW update engine ONCE and exposes
  // updateAvailable/version — this component just subscribes (same
  // reactive contract as the Installation Manager). Dismissing an
  // update only hides THAT version: when a NEWER SW version arrives
  // (version changes), the local dismiss flag clears so the refresh
  // banner can show again — same version stays dismissed.
  const lastVersionRef = useRef(runtime.version);
  useEffect(() => appController.subscribe((rt) => {
    setRuntime(rt);
    if (rt.updateAvailable && rt.version !== lastVersionRef.current) {
      lastVersionRef.current = rt.version;
      setUpdateDismissed(false);
    }
  }), []);

  // ─── Install button handler ──────────────────────────────────────
  const handleInstall = async () => {
    await installationManager.promptInstall();
  };

  // ─── Dismiss handler ─────────────────────────────────────────────
  const handleDismiss = () => {
    setDismissedThisSession(true);
    installationManager.noteDismissed();
  };

  // ─── Update handler: skip waiting + reload ───────────────────────
  // Delegated to the App Controller (it owns the waiting worker) so
  // this UI never touches SW plumbing directly.
  const handleUpdate = () => {
    appController.refresh();
  };

  const isHt = resolvedLang === 'ht';

  // ─── Update-available banner (takes priority over install prompt) ───
  const updateAvailable = runtime.updateAvailable && !updateDismissed;
  if (updateAvailable) {
    const uaText = {
      heading: isHt ? 'Nouvo vèsyon disponib' : 'New version available',
      body: isHt
        ? 'Yon nouvo vèsyon Atelnyo pare. Rafrechi paj la pou w itilize li.'
        : 'A new version of Atelnyo is ready. Refresh to use it.',
      button: isHt ? 'Rafrechi' : 'Refresh',
      dismiss: isHt ? 'Pita' : 'Later',
    };
    return (
      <div className="pwa-install-banner pwa-install-banner--update" role="dialog" aria-label={uaText.heading}>
        <div className="pwa-install-banner__content">
          <div className="pwa-install-banner__icon" aria-hidden="true">
            <i className="fas fa-sync-alt" style={{fontSize:'1.5rem',color:'var(--pink-primary)'}} />
          </div>
          <div className="pwa-install-banner__text">
            <strong>{uaText.heading}</strong>
            <p>{uaText.body}</p>
          </div>
        </div>
        <div className="pwa-install-banner__actions">
          <button
            type="button"
            className="pwa-install-banner__btn pwa-install-banner__btn--primary"
            onClick={handleUpdate}
          >
            <i className="fas fa-sync-alt" aria-hidden="true" /> {uaText.button}
          </button>
          <button
            type="button"
            className="pwa-install-banner__btn pwa-install-banner__btn--secondary"
            onClick={() => setUpdateDismissed(true)}
          >
            {uaText.dismiss}
          </button>
        </div>
      </div>
    );
  }

  // ─── Install banner: only after Atelnyo decided the moment is good
  //      (showBanner claimed), while the browser prompt is captured,
  //      the app isn't installed, and the user hasn't dismissed it. ──
  const showInstallBanner =
    INSTALL_PROMPT_ENABLED &&
    showBanner &&
    snap.state === INSTALL_STATES.PROMPT_AVAILABLE &&
    !snap.installed &&
    !dismissedThisSession &&
    !recentlyDismissed;

  if (!showInstallBanner) return null;

  const t = {
    heading: isHt ? 'Enstale Atelnyo sou aparèy ou' : 'Install Atelnyo on your device',
    body: isHt
      ? 'Jwenn aksè rapid a kou ou yo, menm lè w pa konekte a entènèt.'
      : 'Get quick access to your courses, even when offline.',
    install: isHt ? 'Enstale' : 'Install',
    dismiss: isHt ? 'Pa kounye a' : 'Not now',
  };

  return (
    <div className="pwa-install-banner" role="dialog" aria-label={t.heading}>
      <div className="pwa-install-banner__content">
        <div className="pwa-install-banner__icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 192 192">
            <rect width="192" height="192" rx="40" fill="#14143a"/>
            <g transform="translate(96,88)">
              <ellipse cx="0" cy="-20" rx="13" ry="26" fill="#b71c5e" transform="rotate(0)"/>
              <ellipse cx="0" cy="-20" rx="13" ry="26" fill="#b71c5e" transform="rotate(60)"/>
              <ellipse cx="0" cy="-20" rx="13" ry="26" fill="#b71c5e" transform="rotate(120)"/>
              <ellipse cx="0" cy="-20" rx="13" ry="26" fill="#b71c5e" transform="rotate(180)"/>
              <ellipse cx="0" cy="-20" rx="13" ry="26" fill="#b71c5e" transform="rotate(240)"/>
              <ellipse cx="0" cy="-20" rx="13" ry="26" fill="#b71c5e" transform="rotate(300)"/>
            </g>
            <g transform="translate(96,88)">
              <ellipse cx="0" cy="-12" rx="9" ry="19" fill="#e91e63" transform="rotate(30)"/>
              <ellipse cx="0" cy="-12" rx="9" ry="19" fill="#e91e63" transform="rotate(90)"/>
              <ellipse cx="0" cy="-12" rx="9" ry="19" fill="#e91e63" transform="rotate(150)"/>
              <ellipse cx="0" cy="-12" rx="9" ry="19" fill="#e91e63" transform="rotate(210)"/>
              <ellipse cx="0" cy="-12" rx="9" ry="19" fill="#e91e63" transform="rotate(270)"/>
              <ellipse cx="0" cy="-12" rx="9" ry="19" fill="#e91e63" transform="rotate(330)"/>
            </g>
            <circle cx="96" cy="88" r="10.5" fill="#ff8f00"/>
            <circle cx="93" cy="85" r="3" fill="#ffffff" opacity="0.6"/>
          </svg>
        </div>
        <div className="pwa-install-banner__text">
          <strong>{t.heading}</strong>
          <p>{t.body}</p>
        </div>
      </div>
      <div className="pwa-install-banner__actions">
        <button
          type="button"
          className="pwa-install-banner__btn pwa-install-banner__btn--primary"
          onClick={handleInstall}
          disabled={snap.state === INSTALL_STATES.REQUESTED}
        >
          <i className="fas fa-download" aria-hidden="true" /> {t.install}
        </button>
        <button
          type="button"
          className="pwa-install-banner__btn pwa-install-banner__btn--secondary"
          onClick={handleDismiss}
        >
          {t.dismiss}
        </button>
      </div>
    </div>
  );
}
