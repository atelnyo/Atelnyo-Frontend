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
 */
import { useState } from 'react';
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
};

const REASON_VALUES = [
  'spam', 'harassment', 'fake_profile', 'violence',
  'scam', 'illegal', 'copyright', 'other',
];

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
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasActions = Array.isArray(actions) && actions.length > 0;

  if (!contentType || !contentId) {
    return null;
  }
  if (!hasActions && !showReport && !showFeedback) {
    return null;
  }

  const close = () => {
    setOpen(false);
    setReporting(false);
    setBusy(false);
    setError('');
  };

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
    background: 'none',
    border: 0,
    cursor: 'pointer',
    color: 'inherit',
  };

  return (
    <div
      className="content-feedback"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        aria-label={copy.menu}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`content-feedback-menu-${contentId}`}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
          }
        }}
        style={{ background: 'none', border: 0, cursor: 'pointer', padding: 4, lineHeight: 1 }}
      >
        <i className="fas fa-ellipsis" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, bottom: '100%', zIndex: 20,
            minWidth: reporting ? 220 : 180, padding: 6, borderRadius: 10,
            background: 'var(--surface-elevated, #1f2937)', color: 'inherit',
            border: '1px solid var(--border-color, rgba(148,163,184,.25))',
            boxShadow: '0 8px 24px rgba(0,0,0,.25)',
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
                  style={{ ...itemStyle, color: action.danger ? '#f87171' : 'inherit' }}
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
      )}
    </div>
  );
}
