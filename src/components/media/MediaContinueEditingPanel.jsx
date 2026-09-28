/**
 * MediaContinueEditingPanel — Lists media considered "in progress"
 * with a Continue button that returns the user to the Media Entity
 * Page (or its edit mode once available).
 *
 * Spec (Phase CREATOR EXPERIENCE §4 — Work in Progress):
 *   "Si yon Creator poko fini yon travay. Media Hub la dwe montre.
 *    Continue Editing. Li retounen egzaktiman kote li te sispann."
 *
 * Sprint stance:
 *   Until /api/media/in-progress/ ships, the panel derives an
 *   in-progress set as:
 *     - media flagged status === 'draft' OR
 *     - media flagged status === 'in_progress' OR
 *     - media with `updated_at` within last 7 days AND not yet
 *       published.
 *   Continue button writes the media id into a `atelnyo_continue_<id>`
 *   localStorage entry + navigates to the entity page so the page
 *   can scroll to the last interacted section (future per-panel
 *   anchored memory).
 *
 * Behavior:
 *   - Hidden when the in-progress set is empty.
 *   - Up to 6 cards in a horizontal row.
 *   - Each card: thumb / title / continue button.
 */
import React, { useMemo, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { MediaTypeIcon } from './MediaIconography';
import { makeT } from '../../utils/langBackendStub';
import { cacheMedia } from '../../utils/mediaCache';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

function isInProgress(m, now) {
  if (!m) {return false;}
  if (m.status === 'draft' || m.status === 'in_progress') {return true;}
  const updated = new Date(m.updated_at || m.created_at || 0).getTime();
  if (!updated) {return false;}
  if (now - updated > SEVEN_DAYS_MS) {return false;}
  if (m.published_at) {return false;}
  return true;
}

const KEY_PREFIX = 'atelnyo_continue_';

function setContinueBookmark(mediaId, fragment = '') {
  if (typeof window === 'undefined') {return;}
  try {
    window.localStorage.setItem(KEY_PREFIX + mediaId, JSON.stringify({
      at: new Date().toISOString(),
      fragment,
    }));
  } catch (err) {
    // ignore quota errors
  }
}

export default function MediaContinueEditingPanel({
  lang = 'ht',
  mediaList = [],
  searchFilter = '',
  showToast,
  onNavigate,
  onOpenDrafts,
}) {
  const t = makeT(lang);
  const navigate = useSafeNavigate();

  const inProgress = useMemo(() => {
    // Recency snapshot for the 7-day window. Re-read per memo run
    // (dep [mediaList, searchFilter]) so the window is fresh whenever
    // the list changes — matches the pattern used across the codebase
    // (ActivityTimeline, SmartMediaSuggestions).
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    let filtered = (mediaList || []).filter((m) => isInProgress(m, now));
    if (searchFilter) {
      const q = String(searchFilter).toLowerCase();
      filtered = filtered.filter((m) => {
        const tt = (m.title || m.original_filename || '').toLowerCase();
        return tt.includes(q);
      });
    }
    filtered.sort((a, b) => {
      const ua = new Date(a.updated_at || a.created_at || 0).getTime();
      const ub = new Date(b.updated_at || b.created_at || 0).getTime();
      return ub - ua;
    });
    return filtered.slice(0, 6);
  }, [mediaList, searchFilter]);

  const handleContinue = useCallback((m) => {
    setContinueBookmark(m.id, '');
    if (onNavigate) {
      onNavigate(m);
      return;
    }
    cacheMedia(m); // survives F5 in-tab (window cache did not)
    if (showToast) {showToast(
      lang === 'en'
        ? 'Continuing…'
        : 'Ap kontinye…',
      'play',
    );}
    navigate(`/sheet/media/${m.id}`, { state: { media: m } });
  }, [navigate, onNavigate, showToast, lang]);

  if (inProgress.length === 0) {return null;}

  return (
    <section className="continue-editing-panel" aria-label={t('continueWorking')}>
      <header className="continue-editing-panel-header">
        <i className="fas fa-forward" aria-hidden="true" />
        <h3>{t('continueEditing')}</h3>
        <button
          type="button"
          className="continue-editing-panel-action"
          onClick={() => onOpenDrafts?.()}
        >
          <i className="fas fa-pen-to-square" aria-hidden="true" />
          <span>{lang === 'en' ? 'Open drafts' : 'Ouvri bouyon'}</span>
        </button>
      </header>
      <div className="continue-editing-grid" role="list">
        {inProgress.map((m) => (
          <div key={m.id} className="continue-editing-card" role="listitem">
            <div className="continue-editing-card-thumb" aria-hidden="true">
              <MediaTypeIcon
                kind={m.media_type || m.kind || m.type || 'file'}
                sizeClass="fa-2x"
              />
            </div>
            <div className="continue-editing-card-body">
              <span className="continue-editing-card-title">
                {m.title || m.original_filename || 'Media'}
              </span>
              <span className="continue-editing-card-meta">
                {m.provider ? `${m.provider} · ` : ''}
                {m.status === 'draft'
                  ? (lang === 'en' ? 'Draft' : 'Bwouyon')
                  : (lang === 'en' ? 'In progress' : 'An travay')}
              </span>
            </div>
            <button
              type="button"
              className="continue-editing-card-btn"
              onClick={() => handleContinue(m)}
            >
              <i className="fas fa-play" aria-hidden="true" />
              <span>{t('continueEditing')}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="continue-editing-panel-footer">
        <button
          type="button"
          className="continue-editing-panel-action continue-editing-panel-action-secondary"
          onClick={() => onOpenDrafts?.()}
        >
          <i className="fas fa-layer-group" aria-hidden="true" />
          <span>{lang === 'en' ? 'Open media tab' : 'Louvri tab medya'}</span>
        </button>
      </div>
    </section>
  );
}
