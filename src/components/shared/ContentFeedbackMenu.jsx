/**
 * ContentFeedbackMenu — compact per-card controls (Phase 13 UI).
 *
 * Every action is viewer-scoped and idempotent; the backend keeps the
 * state. It is rendered inside cards, so every handler stops event
 * propagation (clicking the menu must never open the card).
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
  },
  en: {
    menu: 'More options',
    notInterested: 'Not interested',
    showLess: 'Show less like this',
    mute: 'Mute creator',
    block: 'Block creator',
    report: 'Report',
  },
};

export default function ContentFeedbackMenu({
  contentType,
  contentId,
  lang = 'ht',
  onDone,
}) {
  const copy = COPY[lang] || COPY.ht;
  const [open, setOpen] = useState(false);

  if (!contentType || !contentId) {
    return null;
  }

  const act = async (fn) => {
    try {
      await fn();
      onDone?.();
    } catch {
      // Guests get 401; the card keeps its local behaviour.
    } finally {
      setOpen(false);
    }
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
        onClick={() => setOpen((value) => !value)}
        style={{ background: 'none', border: 0, cursor: 'pointer', padding: 4, lineHeight: 1 }}
      >
        <i className="fas fa-ellipsis" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, bottom: '100%', zIndex: 20,
            minWidth: 180, padding: 6, borderRadius: 10,
            background: 'var(--surface-elevated, #1f2937)', color: 'inherit',
            border: '1px solid var(--border-color, rgba(148,163,184,.25))',
            boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          }}
        >
          <button type="button" role="menuitem" className="content-feedback-item"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => act(() => contentFeedbackService.notInterested(contentType, contentId))}>
            {copy.notInterested}
          </button>
          <button type="button" role="menuitem" className="content-feedback-item"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => act(() => contentFeedbackService.hide(contentType, contentId, 'show_less'))}>
            {copy.showLess}
          </button>
          <button type="button" role="menuitem" className="content-feedback-item"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => act(() => contentFeedbackService.muteCreator(contentType, contentId))}>
            {copy.mute}
          </button>
          <button type="button" role="menuitem" className="content-feedback-item"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => act(() => contentFeedbackService.blockCreator(contentType, contentId))}>
            {copy.block}
          </button>
          <button type="button" role="menuitem" className="content-feedback-item"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 0, cursor: 'pointer' }}
            onClick={() => act(() => contentFeedbackService.report(contentType, contentId, 'other'))}>
            {copy.report}
          </button>
        </div>
      )}
    </div>
  );
}
