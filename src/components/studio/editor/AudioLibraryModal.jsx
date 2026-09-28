/**
 * src/components/studio/editor/AudioLibraryModal.jsx
 *
 * Creator media library — REAL cataloged audio only.
 *
 * Lists the creator's own MediaAsset rows of kind=audio
 * (GET /api/media/assets/?kind=audio&search=...). Every reference
 * audio recorded or uploaded through upload-audio is cataloged
 * server-side, so this library lists genuinely re-usable audio —
 * never fake entries. Search + inline preview are client-friendly
 * conveniences on top of the real backend list.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { mediaLibraryService } from '../../../services/api';
import AudioPlayer from '../../learning/AudioPlayer';
import styles from './editor.module.css';

export default function AudioLibraryModal({ lang = 'ht', onSelect, onClose }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [items, setItems] = useState(null); // null = loading
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const searchTimer = useRef(null);

  const load = useCallback((term) => {
    setError('');
    mediaLibraryService.listAudio(term)
      .then((res) => {
        let data = res?.data;
        if (Array.isArray(data?.results)) data = data.results;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        setItems([]);
        setError(e?.response?.data?.detail
          || t('Could not load your audio library.', 'Pa t kapab chaje bibliyotèk odyo w.'));
      });
  }, [lang]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { load(''); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onSearchChange = (value) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(value), 350);
  };

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  return (
    <div
      className={styles.libraryBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Audio library', 'Bibliyotèk odyo')}
    >
      <div className={styles.libraryModal}>
        <header className={styles.libraryHeader}>
          <span className={styles.libraryIcon}><i className="fas fa-music" aria-hidden="true" /></span>
          <div>
            <h2>{t('Audio Library', 'Bibliyotèk Odyo')}</h2>
            <p className={styles.librarySub}>
              {t(
                'Your recorded and uploaded audio — reuse it in any exercise.',
                'Odyo w anrejistre ak telechaje — reutilize l nan nenpòt egzèsis.',
              )}
            </p>
          </div>
          <button type="button" className={styles.libraryClose} onClick={onClose} aria-label={t('Close', 'Fèmen')}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>

        <div className={styles.librarySearchWrap}>
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            className={styles.librarySearch}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('Search your audio…', 'Chèche odyo w…')}
            aria-label={t('Search your audio', 'Chèche odyo w')}
          />
        </div>

        {error && (
          <p className={styles.libraryError} role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
          </p>
        )}

        {items === null && !error ? (
          <p className={styles.libraryLoading}>
            <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Loading…', 'Ap chaje…')}
          </p>
        ) : items.length === 0 ? (
          <div className={styles.libraryEmpty}>
            <i className="fas fa-circle-info" aria-hidden="true" />
            <p>
              {search.trim()
                ? t('No audio matches your search.', 'Pa gen odyo ki matche rechèch ou.')
                : t(
                  'Your audio library is empty. Record or upload audio in the exercise editor and it will appear here.',
                  'Bibliyotèk odyo w vid. Anrejistre oswa telechaje odyo nan editè egzèsis la epi l ap parèt isit la.',
                )}
            </p>
          </div>
        ) : (
          <ul className={styles.libraryList}>
            {items.map((item) => (
              <li key={item.id} className={styles.libraryRow}>
                <span className={styles.libraryRowIcon}>
                  <i className="fas fa-headphones" aria-hidden="true" />
                </span>
                <div className={styles.libraryRowInfo}>
                  <span className={styles.libraryRowTitle}>{item.title || t('Untitled audio', 'Odyo san tit')}</span>
                  <span className={styles.libraryRowMeta}>
                    {item.duration ? `${Math.round(item.duration)}s · ` : ''}
                    {item.mime_type || 'audio'}
                    {item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString()}` : ''}
                  </span>
                  {item.media_url && (
                    <span className={styles.libraryRowPlayer} onClick={(e) => e.stopPropagation()}>
                      <AudioPlayer src={item.media_url} compact />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.librarySelect}
                  onClick={() => onSelect?.(item)}
                >
                  <i className="fas fa-plus" aria-hidden="true" /> {t('Use', 'Sèvi')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className={styles.libraryFooter}>
          <button type="button" className={styles.libraryCancel} onClick={onClose}>
            {t('Cancel', 'Anile')}
          </button>
        </footer>
      </div>
    </div>
  );
}
