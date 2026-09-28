/**
 * FavoriteCollectionsStrip — Horizontal strip of favorite collections.
 *
 * Spec (Phase CREATOR EXPERIENCE §1 — My Media Home):
 *   "Favorite Collections" is one of the dashboard cards.
 *
 * Storage:
 *   Until /api/media/collections/favorite/ ships, we read from
 *   `atelnyo_favorite_collections_v1` (a localStorage array of
 *   collection ids). The shape mirrors the BE projection so the
 *   slice is a no-op swap when the endpoint lands.
 *
 * Behavior:
 *   - Hidden when the user has no collections + no favorite ids.
 *   - Each card shows collection name + count + click → filter the
 *     media list scoped to that collection.
 */
import React, { useEffect, useState, useCallback } from 'react';
import BackendPendingChip from './BackendPendingChip';
import { makeT } from '../../utils/langBackendStub';

const KEY = 'atelnyo_favorite_collections_v1';
const EVENT = 'atelnyo:favorite-collections:changed';

function readFavorites() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function FavoriteCollectionsStrip({
  lang = 'ht',
  collections = [],
  onSelect,
}) {
  const t = makeT(lang);
  const [ids, setIds] = useState(() => readFavorites());

  useEffect(() => {
    const onChange = () => setIds(readFavorites());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const handleSelect = useCallback((c) => {
    if (onSelect) onSelect(c);
  }, [onSelect]);

  if (!Array.isArray(collections) || collections.length === 0) return null;
  const favs = collections.filter((c) => ids.includes(String(c.id)));
  if (favs.length === 0) return null;

  return (
    <section className="fav-collections-strip" aria-label={t('favoriteCollections')}>
      <header className="fav-collections-strip-header">
        <i className="fas fa-folder-tree" aria-hidden="true" />
        <h3>{t('favoriteCollections')}</h3>
        <BackendPendingChip lang={lang} endpoint="/api/media/collections/favorite/" inline />
      </header>
      <div className="fav-collections-strip-list" role="list">
        {favs.map((c) => (
          <button
            key={c.id}
            type="button"
            className="fav-collections-strip-card"
            role="listitem"
            onClick={() => handleSelect(c)}
          >
            <div className="fav-collections-strip-card-icon" aria-hidden="true">
              <i className="fas fa-folder" />
            </div>
            <div className="fav-collections-strip-card-body">
              <span className="fav-collections-strip-card-name">{c.name || c.title}</span>
              {(c.count != null || c.media_count != null) && (
                <span className="fav-collections-strip-card-count">
                  {c.count ?? c.media_count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
