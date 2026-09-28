/**
 * MediaPicker — Picker pou chwazi medya nan bibliyotèk la.
 *
 * Itil nan:
 *   - Chwazi yon imaj pwofil
 *   - Chwazi yon videyo pou yon kou
 *   - Chwazi yon fichye pou yon pwojè
 *
 * Karakteristik:
 *   - Grid seleksyon medya
 *   - Preview lè chwazi
 *   - Bouton "Choose" / "Cancel"
 */
import React, { useState, useEffect, useCallback } from 'react';
import MediaGrid from './MediaGrid';
import ImageViewer from './ImageViewer';
import { mediaProviderService } from '../../services/api';

export default function MediaPicker({
  onSelect,
  onCancel,
  mediaType = 'all',
  multiSelect = false,
  lang = 'ht',
  className = '',
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);

  const isHt = lang === 'ht';

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = mediaType !== 'all' ? { media_type: mediaType } : {};
        const res = await mediaProviderService.userMedia(params);
        setItems(res.data?.results || res.data || []);
      } catch (err) {
        setError(err.response?.data?.error || (isHt ? 'Pa kapab chaje medya yo' : 'Failed to load media'));
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [mediaType, isHt]);

  const handleSelect = useCallback((item) => {
    if (multiSelect) {
      setSelected((prev) => {
        const id = item.id || item.media_id;
        const exists = prev.some((p) => (p.id || p.media_id) === id);
        if (exists) return prev.filter((p) => (p.id || p.media_id) !== id);
        return [...prev, item];
      });
    } else {
      setSelected([item]);
      setPreviewItem(item);
    }
  }, [multiSelect]);

  const handleConfirm = useCallback(() => {
    if (onSelect) {
      onSelect(multiSelect ? selected : selected[0]);
    }
  }, [onSelect, multiSelect, selected]);

  return (
    <div className={`media-picker ${className}`} role="dialog" aria-label={isHt ? 'Chwazi medya' : 'Media picker'} aria-modal="true">
      {/* Header */}
      <div className="media-picker-header">
        <h3 className="media-picker-title">
          <i className="fas fa-photo-video" aria-hidden="true" />
          {isHt ? 'Chwazi Medya' : 'Media Picker'}
        </h3>
        <button
          type="button"
          className="media-picker-close"
          onClick={onCancel}
          aria-label={isHt ? 'Fèmen' : 'Close'}
        >
          <i className="fas fa-times" />
        </button>
      </div>

      {/* Preview */}
      {previewItem && (
        <div className="media-picker-preview">
          {previewItem.media_type === 'image' || previewItem.kind === 'image' ? (
            <ImageViewer
              mediaData={previewItem}
              className="media-picker-preview-img"
            />
          ) : (
            <div className="media-picker-preview-placeholder">
              <i className={`fas ${previewItem.media_type === 'video' ? 'fa-video' : previewItem.media_type === 'audio' ? 'fa-music' : 'fa-file'}`} />
              <p>{previewItem.url || ''}</p>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="media-picker-grid">
        <MediaGrid
          items={items}
          loading={loading}
          error={error}
          size="small"
          showActions={false}
          onClick={handleSelect}
          lang={lang}
        />
      </div>

      {/* Selection indicator */}
      {selected.length > 0 && (
        <div className="media-picker-selected">
          <span>
            <i className="fas fa-check-circle" aria-hidden="true" />
            {selected.length} {isHt ? 'chwazi' : 'selected'}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="media-picker-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {isHt ? 'Anile' : 'Cancel'}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleConfirm}
          disabled={selected.length === 0}
        >
          <i className="fas fa-check" aria-hidden="true" />
          {isHt ? 'Chwazi' : 'Choose'}
        </button>
      </div>
    </div>
  );
}
