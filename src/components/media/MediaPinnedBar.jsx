/**
 * MediaPinnedBar — Horizontal scrollable strip of pinned media.
 *
 * Spec (Phase CREATOR EXPERIENCE §2 — Pinned Media):
 *   "Creator dwe kapab epingle medya li itilize souvan.
 *    Egzanp. Logo, Course Banner, Profile Picture, Brand Intro Video…"
 *
 * Storage:
 *   Now backed by GET/POST /api/media/pinned/ on the backend.
 *   Falls back to localStorage `atelnyo_pinned_media_ids_v1` when
 *   the API call fails (offline resilience).
 *
 * Behavior:
 *   - Hidden when the pinned list is empty.
 *   - Compact thumbnail + title + unpin button per item.
 *   - Click on thumbnail navigates to the Media Entity Page.
 *   - Pin/unpin calls the backend API; localStorage is sync'd as fallback.
 */
import React, { useEffect, useState, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { mediaDashboardService } from '../../services/api';
import { makeT } from '../../utils/langBackendStub';
import { cacheMedia } from '../../utils/mediaCache';
import { MediaTypeIcon } from './MediaIconography';

const KEY = 'atelnyo_pinned_media_ids_v1';
const EVENT = 'atelnyo:media-pinned:changed';

function readPinnedIds() {
  if (typeof window === 'undefined') {return [];}
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {return [];}
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writePinnedIds(ids) {
  if (typeof window === 'undefined') {return;}
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore quota errors
  }
}

export default function MediaPinnedBar({
  lang = 'ht',
  mediaList = [], // full media array (now from backend pinned endpoint)
  showToast,
  onOpenAll,
}) {
  const t = makeT(lang);
  const navigate = useSafeNavigate();
  const [pinnedIds, setPinnedIds] = useState(() => readPinnedIds());
  const [apiPinned, setApiPinned] = useState(null);

  // Listen for localStorage changes (cross-tab sync)
  useEffect(() => {
    const onChange = () => setPinnedIds(readPinnedIds());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  // If mediaList contains is_pinned items, use them as the source of truth
  useEffect(() => {
    const pinned = (mediaList || []).filter((m) => m.is_pinned === true);
    Promise.resolve().then(() => {
      if (pinned.length > 0) {
        setApiPinned(pinned);
      }
    });
  }, [mediaList]);

  const handleUnpin = useCallback(async (id) => {
    // Backend API call
    try {
      await mediaDashboardService.togglePin(id, 'unpin');
    } catch {
      // Fall through to localStorage fallback
    }
    // localStorage fallback (offline resilience)
    writePinnedIds(pinnedIds.filter((p) => p !== id));
    // Remove from apiPinned
    if (apiPinned) {
      setApiPinned((prev) => (prev || []).filter((m) => String(m.id) !== String(id)));
    }
    if (showToast) {showToast(t('unpinMedia'), 'thumbtack');}
  }, [pinnedIds, apiPinned, showToast, t]);

  const handlePin = useCallback(async (id) => {
    // Backend API call
    try {
      await mediaDashboardService.togglePin(id, 'pin');
    } catch {
      // Fall through to localStorage fallback
    }
    if (!pinnedIds.includes(id)) {
      writePinnedIds([...pinnedIds, id]);
      if (showToast) {showToast(t('pinMedia'), 'thumbtack');}
    }
  }, [pinnedIds, showToast, t]);

  // Expose toggle so other surfaces (e.g. MediaCard context menu) can pin/unpin.
  useEffect(() => {
    if (typeof window === 'undefined') {return;}
    window.__atelnyo_media_pinned_toggle = (id) => {
      if (pinnedIds.includes(id)) {
        handleUnpin(id);
      } else {
        handlePin(id);
      }
    };
    return () => {
      if (window.__atelnyo_media_pinned_toggle) {delete window.__atelnyo_media_pinned_toggle;}
    };
  }, [pinnedIds, handlePin, handleUnpin]);

  // Determine display: prefer API data, fall back to localStorage-derived
  let displayMedia;
  if (apiPinned && apiPinned.length > 0) {
    displayMedia = apiPinned;
  } else if (pinnedIds.length > 0) {
    displayMedia = pinnedIds
      .map((id) => (mediaList || []).find((m) => String(m.id) === String(id)))
      .filter(Boolean);
  } else {
    displayMedia = [];
  }

  if (displayMedia.length === 0) {return null;}

  return (
    <section className="media-pinned-bar" aria-label={t('pinnedMedia')}>
      <header className="media-pinned-bar-header">
        <i className="fas fa-thumbtack" aria-hidden="true" />
        <h3>{t('pinnedMedia')}</h3>
        <span className="media-pinned-bar-count">
          {t('pinnedOf', { n: displayMedia.length })}
        </span>
        <button
          type="button"
          className="media-pinned-bar-action"
          onClick={() => onOpenAll?.()}
        >
          <i className="fas fa-layer-group" aria-hidden="true" />
          <span>{lang === 'en' ? 'Open all' : 'Louvri tout'}</span>
        </button>
      </header>
      <div className="media-pinned-bar-scroll" role="list">
        {displayMedia.map((m) => (
          <div key={m.id} className="media-pinned-bar-item" role="listitem">
            <button
              type="button"
              className="media-pinned-bar-thumb"
              aria-label={(m.title || m.original_filename || 'Media') + ' — ' + t('pinnedMedia')}
              onClick={() => {
                cacheMedia(m); // survives F5 in-tab (window cache did not)
                navigate(`/sheet/media/${m.id}`, { state: { media: m } });
              }}
            >
              <MediaTypeIcon
                kind={m.media_type || m.kind || m.type || 'file'}
                sizeClass="fa-lg"
              />
            </button>
            <div className="media-pinned-bar-info">
              <span className="media-pinned-bar-title" title={m.title || m.original_filename}>
                {m.title || m.original_filename || t('untitled') || 'Media'}
              </span>
              {m.provider && (
                <span className="media-pinned-bar-provider">{m.provider}</span>
              )}
            </div>
            <button
              type="button"
              className="media-pinned-bar-unpin"
              onClick={() => handleUnpin(m.id)}
              aria-label={t('unpinMedia')}
              title={t('unpinMedia')}
            >
              <i className="fas fa-xmark" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="media-pinned-bar-footer">
        <button
          type="button"
          className="media-pinned-bar-action media-pinned-bar-action-secondary"
          onClick={() => onOpenAll?.()}
        >
          <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
          <span>{lang === 'en' ? 'Go to media' : 'Ale nan medya'}</span>
        </button>
      </div>
    </section>
  );
}
