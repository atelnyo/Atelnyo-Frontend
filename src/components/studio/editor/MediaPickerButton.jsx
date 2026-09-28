/**
 * src/components/studio/editor/MediaPickerButton.jsx
 *
 * Compact button that opens the MediaPicker modal.
 * Used inside content block editors (image, video, audio, file)
 * to let creators pick media from their library instead of pasting URLs.
 *
 * Features:
 *   - Opens MediaPicker in a modal overlay
 *   - Passes selected media back via onSelect callback
 *   - Filters by media type (image, video, audio, file)
 *   - Compact design that fits inline with input fields
 */
import React, { useState, useCallback } from 'react';
import MediaPicker from '../../media/MediaPicker';
import styles from './editor.module.css';

const TYPE_ICONS = {
  image: 'fa-image',
  video: 'fa-video',
  audio: 'fa-headphones',
  file: 'fa-paperclip',
  all: 'fa-photo-video',
};

export default function MediaPickerButton({
  onSelect,
  mediaType = 'all',
  lang = 'ht',
  label,
}) {
  const [open, setOpen] = useState(false);
  const isHt = lang === 'ht';

  const handleSelect = useCallback((media) => {
    setOpen(false);
    onSelect?.(media);
  }, [onSelect]);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const icon = TYPE_ICONS[mediaType] || TYPE_ICONS.all;
  const btnLabel = label || (isHt ? 'Bibliyotèk' : 'Library');

  return (
    <>
      <button
        type="button"
        className={styles.mediaPickerBtn}
        onClick={() => setOpen(true)}
        title={isHt ? 'Chwazi medya nan bibliyotèk la' : 'Pick from media library'}
      >
        <i className={`fas ${icon}`} aria-hidden="true" />
        <span>{btnLabel}</span>
      </button>

      {open && (
        <div className={styles.mediaPickerModal}>
          <div className={styles.mediaPickerOverlay} onClick={handleCancel} />
          <div className={styles.mediaPickerContent}>
            <MediaPicker
              onSelect={handleSelect}
              onCancel={handleCancel}
              mediaType={mediaType}
              lang={lang}
            />
          </div>
        </div>
      )}
    </>
  );
}
