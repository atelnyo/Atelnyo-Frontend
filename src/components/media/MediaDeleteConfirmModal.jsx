/**
 * MediaDeleteConfirmModal — Destructive action confirm modal.
 *
 * Spec (Phase CREATOR EXPERIENCE §6 + Creator Confidence §13):
 *   - "Anvan yon Creator efase yon medya. Sistèm nan dwe montre.
 *     Media sa itilize nan. 2 Courses, 1 Community, 5 Lessons, 3
 *     Products, 1 Homepage Banner. Li dwe konprann konsekans lan."
 *   - "Mwen pa pè pèdi travay mwen" — UI must convey non-destructive
 *     semantics unless the user types "DELETE" to confirm.
 *
 * Behavior:
 *   - Listens for the `atelnyo:media-delete:open` CustomEvent on window
 *     and reads `detail.mediaId` to identify the target media.
 *   - Renders dependency breakdown via MediaDependencyList.
 *   - Two-step type-to-confirm when the dependency count is > 0:
 *       Cancel button + Delete button (disabled until "DELETE" typed).
 *   - One-step confirm when the dependency count is 0:
 *       Cancel + Delete (immediate).
 *   - Pressing Escape closes without action.
 *
 * Persistence:
 *   Until /api/media/:id/ ships DELETE semantics, the modal removes
 *   the media id from the URL cache + dispatches a
 *   `atelnyo:media-deleted` window event with detail { mediaId }
 *   so other surfaces (grid, list, picker) can update.
 *   onDeleted callback also fires so the parent can show a toast.
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import MediaDependencyList from './MediaDependencyList';
import { totalDependencies } from '../../utils/mediaDependencies';
import { makeT } from '../../utils/langBackendStub';
import { getCachedMedia, deleteCachedMedia } from '../../utils/mediaCache';

const EVENT = 'atelnyo:media-delete:open';
const DELETED_EVENT = 'atelnyo:media-deleted';

export default function MediaDeleteConfirmModal({
  lang = 'ht',
  mediaList = [],
  showToast,
  onDeleted,
}) {
  const t = makeT(lang);
  const [target, setTarget] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const inputRef = useRef(null);

  // Resolve media object from id
  const targetMedia = useMemo(() => {
    if (!target) return null;
    const found = mediaList.find((m) => String(m.id) === String(target));
    if (found) return found;
    return getCachedMedia(target);
  }, [target, mediaList]);

  // Count dependencies to gate the type-to-confirm flow.
  const depCount = useMemo(() => {
    if (!targetMedia) return 0;
    return totalDependencies(targetMedia);
  }, [targetMedia]);

  useEffect(() => {
    const handler = (e) => {
      const id = e && e.detail && e.detail.mediaId;
      if (id == null) return;
      setTarget(id);
      setConfirmText('');
      // Focus the input after the modal paints
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 0);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const handleClose = useCallback(() => {
    setTarget(null);
    setConfirmText('');
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!target) return;
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, handleClose]);

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  const handleConfirm = useCallback(() => {
    if (!targetMedia) {
      handleClose();
      return;
    }
    // Best-effort delete from cache + broadcast so the parent surfaces
    // can update. Backend DELETE /api/media/:id/ is not yet shipped —
    // a future PHASE unblocks the persistent delete.
    deleteCachedMedia(targetMedia.id);
    window.dispatchEvent(new CustomEvent(DELETED_EVENT, {
      detail: { mediaId: targetMedia.id },
    }));
    if (onDeleted) onDeleted(targetMedia.id);
    handleClose();
  }, [targetMedia, handleClose, onDeleted]);

  const requiresTypeConfirm = depCount > 0;
  const canConfirm = !requiresTypeConfirm || confirmText.trim().toUpperCase() === 'DELETE';

  if (!target || !targetMedia) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div className="modal-card media-delete-modal">
        <header className="modal-card-header modal-card-header-danger">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <h3 id="delete-modal-title">{t('deleteConfirmTitle')}</h3>
          <button
            type="button"
            className="modal-card-close"
            onClick={handleClose}
            aria-label={lang === 'en' ? 'Close' : 'Fèmen'}
          >
            <i className="fas fa-xmark" />
          </button>
        </header>

        <div className="modal-card-body media-delete-modal-body">
          <p className="media-delete-modal-leading">
            <strong>{targetMedia.title || targetMedia.original_filename || 'Media'}</strong>
          </p>

          <MediaDependencyList lang={lang} media={targetMedia} />

          {requiresTypeConfirm && (
            <div className="media-delete-modal-typed-confirm">
              <label className="form-field">
                <span className="form-field-label">
                  {lang === 'en'
                    ? 'Type DELETE to confirm. This affects real content.'
                    : 'Tape DELETE pou konfime. Sa afekte kontni reyèl.'}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="form-field-input"
                  autoComplete="off"
                />
              </label>
            </div>
          )}
        </div>

        <footer className="modal-card-footer">
          <button type="button" className="btn-action" onClick={handleClose}>
            <i className="fas fa-ban" aria-hidden="true" />
            <span>{t('confirmNo')}</span>
          </button>
          <button
            type="button"
            className="btn-action btn-action-danger"
            disabled={!canConfirm}
            aria-disabled={!canConfirm ? 'true' : 'false'}
            onClick={handleConfirm}
          >
            <i className="fas fa-trash" aria-hidden="true" />
            <span>{t('confirmYes')}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
