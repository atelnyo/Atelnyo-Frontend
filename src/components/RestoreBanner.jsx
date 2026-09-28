/**
 * src/components/RestoreBanner.jsx
 *
 * CONTINUITY UI — the banner that announces “we put you back” after a
 * relaunch. The Continuity Manager decides WHAT is meaningful to
 * restore (see continuityTypes.js — CONTINUITY_STATE_VERSION) and the
 * Storage Manager persists it; this banner is the USER-FACING surface:
 *
 *   relaunch (memory-kill / reload / browser restart / SW update)
 *     → getRestorePoint() → summarizeRecovery() (pure)
 *     → if there is something MEANINGFUL to announce (a route, a
 *       workspace section, a selected entity, a draft index)
 *       → show “↩️ Nou restore sesyon ou — <what>”
 *       → actions: “Kontinye” (dismiss — the state is already
 *         applied by App.jsx applyRestorePoint) / “Anile” (dismiss +
 *         remember not to re-show this session).
 *
 * NOT saved here: nothing. The banner reads the restore point through
 * the manager's façade; it never imports appStateStore and never
 * writes continuity state itself (except the one-session dismissal
 * marker, which is transient UI preference, not continuity state).
 *
 * Rules:
 *   • Shows ONLY on a RETURN relaunch (isRelaunch()), never on the
 *     first visit (nothing to restore by definition).
 *   • Shows ONLY when there is something to announce (summarizeRecovery
 *     returns non-null) — an empty restore point is silently ignored.
 *   • Once dismissed (either action), it does not come back this
 *     session (in-memory flag) — no nagging.
 */
import React, { useEffect, useState } from 'react';
import continuityManager from '../pwa/continuity/ContinuityManager';
import { summarizeRecovery } from '../pwa/continuity/continuityTypes';

/* ── Localized copy (ht / en / fr / es) ─────────────────────────── */
function _t(map, lang) {
  return map[lang] || map.en;
}

const T = {
  title: {
    ht: '↩️ Nou restore sesyon ou',
    en: '↩️ We restored your session',
    fr: '↩️ Nous avons restauré votre session',
    es: '↩️ Restauramos tu sesión',
  },
  workspace: {
    ht: 'Ou te nan Studio → {section}.',
    en: 'You were in Studio → {section}.',
    fr: 'Vous étiez dans Studio → {section}.',
    es: 'Estabas en Studio → {section}.',
  },
  entity: {
    ht: 'Ou t ap travay sou yon {type}.',
    en: 'You were working on a {type}.',
    fr: 'Vous travailliez sur un {type}.',
    es: 'Estabas trabajando en un {type}.',
  },
  route: {
    ht: 'Ou te sou paj la: {route}.',
    en: 'You were on the page: {route}.',
    fr: 'Vous étiez sur la page : {route}.',
    es: 'Estabas en la página: {route}.',
  },
  draft: {
    ht: 'Yon brouyon poko soumèt — li sove.',
    en: 'An unsaved draft is saved.',
    fr: 'Un brouillon non soumis est enregistré.',
    es: 'Un borrador sin enviar está guardado.',
  },
  continueBtn: {
    ht: 'Kontinye',
    en: 'Continue',
    fr: 'Continuer',
    es: 'Continuar',
  },
  dismissBtn: {
    ht: 'Fèmen',
    en: 'Dismiss',
    fr: 'Fermer',
    es: 'Cerrar',
  },
};

/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere; props-only component (same as FileRow) */
export default function RestoreBanner({ lang = 'ht' }) {
  const [summary, setSummary] = useState(null);
  // One-session dismissal — the banner never re-appears after either
  // action until the next relaunch (module state survives HMR, fine).
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') { return undefined; }
    // Only a RETURN relaunch can have a restore point worth announcing.
    if (!continuityManager.isRelaunch()) { return undefined; }
    let alive = true;
    continuityManager.getRestorePoint()
      .then((point) => {
        if (!alive) { return; }
        const s = summarizeRecovery(point);
        if (s) { setSummary(s); }
      })
      .catch(() => { /* a restore miss is a nicety missed, never a gate */ });
    return () => { alive = false; };
  }, []);

  if (!summary || dismissed) { return null; }

  const what = summary.workspace
    ? _t(T.workspace, lang).replace('{section}', summary.workspace.section)
    : summary.entity
      ? _t(T.entity, lang).replace('{type}', summary.entity.type || 'item')
      : summary.route
        ? _t(T.route, lang).replace('{route}', summary.route)
        : _t(T.draft, lang);

  const dismiss = () => setDismissed(true);

  return (
    <div className="restore-banner" role="status" aria-live="polite">
      <div className="restore-banner-icon" aria-hidden="true">
        <i className="fas fa-rotate-left" />
      </div>
      <div className="restore-banner-body">
        <div className="restore-banner-title">{_t(T.title, lang)}</div>
        <div className="restore-banner-text">{what}</div>
      </div>
      <div className="restore-banner-actions">
        <button
          type="button"
          className="restore-banner-btn restore-banner-btn--primary"
          onClick={dismiss}
        >
          {_t(T.continueBtn, lang)}
        </button>
        <button
          type="button"
          className="restore-banner-btn restore-banner-btn--ghost"
          onClick={dismiss}
        >
          {_t(T.dismissBtn, lang)}
        </button>
      </div>
    </div>
  );
}
/* eslint-enable react/prop-types */
