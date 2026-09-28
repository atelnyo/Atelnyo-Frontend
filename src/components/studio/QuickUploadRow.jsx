/**
 * QuickUploadRow — Compact URL-paste + search row above the dashboard.
 *
 * Spec (Phase CREATOR EXPERIENCE §1 — My Media Home):
 *   "Quick Upload, Quick Search" are spec-mandated dashboard surfaces.
 *
 * Behavior:
 *   - Quick Upload is a paste-a-URL input + button. Backend endpoint
 *     (/api/media/from-url/) is not yet shipped; the row fires a
 *     toast informing the user the BE endpoint is pending.
 *   - Quick Search is a Title/Type/Provider search that filters the
 *     currently rendered media list client-side.
 */
import React, { useState, useCallback } from 'react';
import BackendPendingChip from '../media/BackendPendingChip';
import { makeT } from '../../utils/langBackendStub';

export default function QuickUploadRow({
  lang = 'ht',
  onSearch,
  onSearchClear,
  onUpload, // optional — calls (url) => Promise; if absent, uses placeholder toast
  showToast,
}) {
  const t = makeT(lang);
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');

  const handleUpload = useCallback(async () => {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      if (showToast) showToast(
        lang === 'en' ? 'Enter a URL first.' : 'Antre yon URL dabò.', 'exclamation-triangle',
      );
      return;
    }
    if (onUpload) {
      try {
        await onUpload(trimmed);
        setUrl('');
      } catch (err) {
        console.warn('[QuickUploadRow] onUpload failed.', err);
      }
    } else {
      if (showToast) showToast(
        (lang === 'en'
          ? 'Backend pending: /api/media/from-url/ not yet shipped.'
          : 'Ap tann backend: /api/media/from-url/ poko livre.'),
        'cloud-arrow-up',
      );
    }
  }, [url, onUpload, showToast, lang]);

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);
    if (onSearch) onSearch(value);
  }, [onSearch, setQuery]);

  return (
    <div className="quick-action-row" role="search">
      <div className="quick-action-block quick-action-upload">
        <label className="quick-action-label" htmlFor="quick-upload-input">
          {t('quickUpload')}
          <BackendPendingChip lang={lang} endpoint="/api/media/from-url/" inline />
        </label>
        <div className="quick-action-field">
          <input
            id="quick-upload-input"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('quickUploadHint')}
            className="quick-action-input"
            onKeyDown={(e) => { if (e.key === 'Enter') handleUpload(); }}
          />
          <button
            type="button"
            className="quick-action-btn quick-action-btn-primary"
            onClick={handleUpload}
          >
            <i className="fas fa-cloud-arrow-up" aria-hidden="true" />
            <span>{lang === 'en' ? 'Add' : 'Ajoute'}</span>
          </button>
        </div>
      </div>

      <div className="quick-action-block quick-action-search">
        <label className="quick-action-label" htmlFor="quick-search-input">
          {t('quickSearch')}
        </label>
        <div className="quick-action-field">
          <input
            id="quick-search-input"
            type="search"
            value={query}
            onChange={handleSearchChange}
            placeholder={t('quickSearchHint')}
            className="quick-action-input"
            aria-label={t('quickSearch')}
          />
          <span className="quick-action-icon" aria-hidden="true">
            <i className="fas fa-magnifying-glass" />
          </span>
          {query && (
            <button
              type="button"
              className="quick-action-btn quick-action-btn-secondary"
              onClick={() => {
                setQuery('');
                if (onSearch) onSearch('');
                if (onSearchClear) onSearchClear();
              }}
            >
              <i className="fas fa-xmark" aria-hidden="true" />
              <span>{lang === 'en' ? 'Clear' : 'Wipe'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
