/**
 * ContentFeedbackMenu — compact per-card controls (Phase 13 UI).
 *
 * Every action is viewer-scoped and idempotent; the backend keeps the
 * state. It is rendered inside cards, so every handler stops event
 * propagation (clicking the menu must never open the card).
 *
 * Reporting now asks for a reason first and uses the platform-wide
 * ``/api/content/reports/`` endpoint. Reasons mirror the backend's
 * ``Report.REASON_CHOICES`` — sending anything else is a 400.
 *
 * The panel is portalled to ``document.body`` and positioned ``fixed``
 * from the trigger's rect. Feed cards live inside horizontal rails
 * (``.explore-hscroll``) that scroll on both axes, so an absolutely
 * positioned panel would be clipped by the rail's overflow/mask. A
 * portal also lets the panel flip above the trigger when there is no
 * room below. It closes on Escape, outside pointer-down, scroll and
 * resize, and falls back to the card surface tokens so light and dark
 * mode both keep readable text.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { contentFeedbackService } from '../../services/api';

const COPY = {
  ht: {
    menu: 'Plis opsyon',
    notInterested: 'Pa enterese',
    showLess: 'Montre mwens sa',
    mute: 'Silansye kreyatè a',
    block: 'Bloke kreyatè a',
    report: 'Siyale',
    reportTitle: 'Siyale kontni sa a',
    reportHint: 'Rapò a prive. Moderasyon ap revize l.',
    back: 'Retounen',
    sending: 'Ap voye…',
    failed: 'Pa t kapab voye rapò a.',
    reasons: {
      spam: 'Spam',
      harassment: 'Arasman',
      fake_profile: 'Fo pwofil',
      violence: 'Vyolans',
      scam: 'Magouy',
      illegal: 'Kontni ilegal',
      copyright: 'Dwadotè',
      other: 'Lòt',
    },
  },
  en: {
    menu: 'More options',
    notInterested: 'Not interested',
    showLess: 'Show less like this',
    mute: 'Mute creator',
    block: 'Block creator',
    report: 'Report',
    reportTitle: 'Report this content',
    reportHint: 'Reports are private. Moderators review them.',
    back: 'Back',
    sending: 'Sending…',
    failed: 'Could not send the report.',
    reasons: {
      spam: 'Spam',
      harassment: 'Harassment',
      fake_profile: 'Fake profile',
      violence: 'Violence',
      scam: 'Scam',
      illegal: 'Illegal content',
      copyright: 'Copyright',
      other: 'Other',
    },
  },
  fr: {
    menu: 'Plus d’options',
    notInterested: 'Pas intéressé',
    showLess: 'Moins de contenu similaire',
    mute: 'Masquer le créateur',
    block: 'Bloquer le créateur',
    report: 'Signaler',
    reportTitle: 'Signaler ce contenu',
    reportHint: 'Les signalements sont privés. Les modérateurs les examinent.',
    back: 'Retour',
    sending: 'Envoi…',
    failed: 'Impossible d’envoyer le signalement.',
    reasons: {
      spam: 'Spam',
      harassment: 'Harcèlement',
      fake_profile: 'Faux profil',
      violence: 'Violence',
      scam: 'Arnaque',
      illegal: 'Contenu illégal',
      copyright: 'Droits d’auteur',
      other: 'Autre',
    },
  },
  es: {
    menu: 'Más opciones',
    notInterested: 'No me interesa',
    showLess: 'Mostrar menos contenido así',
    mute: 'Silenciar al creador',
    block: 'Bloquear al creador',
    report: 'Denunciar',
    reportTitle: 'Denunciar este contenido',
    reportHint: 'Las denuncias son privadas. Los moderadores las revisan.',
    back: 'Volver',
    sending: 'Enviando…',
    failed: 'No se pudo enviar la denuncia.',
    reasons: {
      spam: 'Spam',
      harassment: 'Acoso',
      fake_profile: 'Perfil falso',
      violence: 'Violencia',
      scam: 'Estafa',
      illegal: 'Contenido ilegal',
      copyright: 'Derechos de autor',
      other: 'Otro',
    },
  },
};

const REASON_VALUES = [
  'spam', 'harassment', 'fake_profile', 'violence',
  'scam', 'illegal', 'copyright', 'other',
];

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 180;
const MENU_REPORT_WIDTH = 220;
const MENU_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

/** Fixed-position box for the panel, flipped above the trigger when the
 *  space below is too small. All values are viewport coordinates. */
function panelPosition(rect) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const width = Math.min(
    MENU_REPORT_WIDTH,
    Math.max(MENU_MIN_WIDTH, vw - VIEWPORT_MARGIN * 2),
  );
  const spaceBelow = vh - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
  const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
  const available = Math.max(120, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.right - width),
    Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN),
  );
  return {
    left,
    width,
    maxHeight: available,
    ...(openUp
      ? { bottom: Math.max(VIEWPORT_MARGIN, vh - rect.top + MENU_GAP) }
      : { top: rect.bottom + MENU_GAP }),
  };
}

export default function ContentFeedbackMenu({
  contentType,
  contentId,
  lang = 'en',
  onDone,
  actions = [],
  showReport = true,
  showFeedback = true,
}) {
  const copy = COPY[lang] || COPY.en;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const hasActions = Array.isArray(actions) && actions.length > 0;

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    setReporting(false);
    setBusy(false);
    setError('');
  }, []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof trigger.getBoundingClientRect !== 'function') return;
    setPosition(panelPosition(trigger.getBoundingClientRect()));
  }, []);

  const toggle = () => {
    if (open) {
      close();
    } else {
      reposition();
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        triggerRef.current?.focus?.();
      }
    };
    const onPointerDown = (event) => {
      const target = event.target;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onViewportChange = () => reposition();

    // Capture phase: the card wrapper stops keydown propagation, so a
    // bubbling listener never sees Escape while the trigger has focus.
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, close, reposition]);

  if (!contentType || !contentId) {
    return null;
  }
  if (!hasActions && !showReport && !showFeedback) {
    return null;
  }

  const act = async (fn) => {
    try {
      await fn();
      onDone?.();
      close();
    } catch {
      // Guests get 401; the card keeps its local behaviour.
      setBusy(false);
    }
  };

  const sendReport = async (reason) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await contentFeedbackService.report(contentType, contentId, reason);
      onDone?.();
      close();
    } catch {
      setError(copy.failed);
      setBusy(false);
    }
  };

  const itemStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 8px',
    border: 0,
    cursor: 'pointer',
    color: 'var(--text-main, #1f2937)',
  };

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={copy.menu}
      data-testid={`content-feedback-panel-${contentId}`}
      style={{
        position: 'fixed',
        left: position?.left ?? VIEWPORT_MARGIN,
        top: position?.top,
        bottom: position?.bottom,
        zIndex: 4000,
        width: position?.width ?? MENU_MIN_WIDTH,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxHeight: position?.maxHeight ?? MENU_MAX_HEIGHT,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: 6,
        borderRadius: 10,
        background: 'var(--surface-elevated, var(--card-bg, #fff))',
        color: 'var(--text-main, #1f2937)',
        border: '1px solid var(--border-color, rgba(148,163,184,.25))',
        boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        fontSize: '0.78rem',
      }}
    >
      {reporting ? (
        <>
          <div style={{ padding: '2px 8px 6px' }}>
            <strong style={{ display: 'block', fontSize: '0.78rem' }}>
              {copy.reportTitle}
            </strong>
            <span style={{ display: 'block', marginTop: 2, fontSize: '0.68rem', opacity: 0.75, lineHeight: 1.4 }}>
              {copy.reportHint}
            </span>
          </div>
          {REASON_VALUES.map((reason, index) => (
            <button
              key={reason}
              type="button"
              role="menuitem"
              className="content-feedback-item"
              style={itemStyle}
              // First reason receives focus when the report step opens.
              autoFocus={index === 0}
              disabled={busy}
              onClick={() => sendReport(reason)}
            >
              {copy.reasons[reason]}
            </button>
          ))}
          {error && (
            <div role="alert" style={{ padding: '4px 8px', fontSize: '0.68rem', color: '#f87171' }}>
              {error}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            className="content-feedback-item"
            style={{ ...itemStyle, marginTop: 2, borderTop: '1px solid var(--border-color, rgba(148,163,184,.25))' }}
            onClick={() => { setReporting(false); setError(''); }}
          >
            <i className="fas fa-arrow-left" aria-hidden="true" /> {copy.back}
          </button>
        </>
      ) : (
        <>
          {hasActions && actions.map((action) => (
            <button
              key={action.key || action.label}
              type="button"
              role="menuitem"
              className="content-feedback-item"
              style={{ ...itemStyle, color: action.danger ? 'var(--danger-text, #e11d48)' : itemStyle.color }}
              disabled={Boolean(action.disabled)}
              data-testid={action.testId}
              onClick={() => {
                action.onSelect?.();
                close();
              }}
            >
              {action.icon && <i className={`fas ${action.icon}`} aria-hidden="true" style={{ marginRight: 7 }} />}
              {action.label}
            </button>
          ))}
          {hasActions && (showFeedback || showReport) && (
            <div style={{ borderTop: '1px solid var(--border-color, rgba(148,163,184,.25))', margin: '4px 0' }} />
          )}
          {showFeedback && (
            <>
              <button type="button" role="menuitem" className="content-feedback-item"
                style={itemStyle}
                onClick={() => act(() => contentFeedbackService.notInterested(contentType, contentId))}>
                {copy.notInterested}
              </button>
              <button type="button" role="menuitem" className="content-feedback-item"
                style={itemStyle}
                onClick={() => act(() => contentFeedbackService.hide(contentType, contentId, 'show_less'))}>
                {copy.showLess}
              </button>
              <button type="button" role="menuitem" className="content-feedback-item"
                style={itemStyle}
                onClick={() => act(() => contentFeedbackService.muteCreator(contentType, contentId))}>
                {copy.mute}
              </button>
              <button type="button" role="menuitem" className="content-feedback-item"
                style={itemStyle}
                onClick={() => act(() => contentFeedbackService.blockCreator(contentType, contentId))}>
                {copy.block}
              </button>
            </>
          )}
          {showReport && (
            <button type="button" role="menuitem" className="content-feedback-item"
              style={itemStyle}
              onClick={() => setReporting(true)}>
              {copy.report}
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div
      className="content-feedback"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={copy.menu}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`content-feedback-menu-${contentId}`}
        onClick={toggle}
        style={{ background: 'none', border: 0, cursor: 'pointer', padding: 4, lineHeight: 1 }}
      >
        <i className="fas fa-ellipsis" aria-hidden="true" />
      </button>

      {open && typeof document !== 'undefined' && createPortal(menu, document.body)}
    </div>
  );
}
