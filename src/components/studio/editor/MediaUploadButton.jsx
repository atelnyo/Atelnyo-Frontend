/**
 * src/components/studio/editor/MediaUploadButton.jsx
 *
 * Reusable media upload component for all editors.
 *
 * Premium users: See upload button → picks file → uploads to Filebase → URL saved
 * Free users: See URL input only (external links)
 *
 * Props:
 *   value      — current URL string
 *   onChange   — callback(newUrl)
 *   kind       — 'image' | 'video' | 'audio' (default: 'image')
 *   label      — field label
 *   placeholder — placeholder text
 *   isPremium  — whether user has premium access
 *   accept     — file input accept attribute (default: based on kind)
 *   required   — whether field is required
 *   error      — error message to display
 */
import React, { useRef, useState, useCallback, useMemo } from 'react';
import api from '../../../services/api';

// ─── Inline Audio / Video Preview ───────────────────────────────────
function AudioPreviewInline({ url }) {
  const [error, setError] = useState(false);
  if (!url) return null;
  if (error) {
    return (
      <div className="mu-preview-audio-fallback">
        <i className="fas fa-volume-xmark" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="mu-preview-audio-wrap">
      <audio
        controls
        preload="none"
        src={url}
        className="mu-preview-audio"
        onError={() => setError(true)}
      />
    </div>
  );
}

function VideoPreviewInline({ url }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Detect YouTube/Vimeo
  const isYouTube = /(?:youtube\.com|youtu\.be)/.test(url);
  const isVimeo = /vimeo\.com/.test(url);
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);

  if (isYouTube && ytMatch) {
    return (
      <div className="mu-preview-video-wrap">
        <img
          src={`https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`}
          alt=""
          className="mu-preview-img"
          loading="lazy"
        />
        <div className="mu-preview-play-icon"><i className="fab fa-youtube" /></div>
      </div>
    );
  }

  if (isVimeo) {
    return (
      <div className="mu-preview-video-wrap">
        <div className="mu-preview-video-placeholder">
          <i className="fab fa-vimeo-v" />
        </div>
        <div className="mu-preview-play-icon"><i className="fas fa-play" /></div>
      </div>
    );
  }

  return (
    <div className="mu-preview-video-wrap">
      <video
        src={url}
        className="mu-preview-video"
        controls={false}
        muted
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {!loaded && !error && <div className="mu-preview-loading"><i className="fas fa-spinner fa-spin" /></div>}
      {error && <div className="mu-preview-video-placeholder"><i className="fas fa-video-slash" /></div>}
    </div>
  );
}

const KIND_ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
  audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
  document: 'application/pdf,.doc,.docx,.xls,.xlsx',
};

const KIND_ICONS = {
  image: 'fa-image',
  video: 'fa-video',
  audio: 'fa-music',
  document: 'fa-file-alt',
};

const KIND_LABELS = {
  image: { ht: 'Imaj', en: 'Image' },
  video: { ht: 'Videyo', en: 'Video' },
  audio: { ht: 'Odyo', en: 'Audio' },
  document: { ht: 'Dokiman', en: 'Document' },
};

export default function MediaUploadButton({
  value = '',
  onChange,
  kind = 'image',
  label = '',
  placeholder = 'https://...',
  isPremium = false,
  accept,
  required = false,
  error = '',
  lang = 'ht',
}) {
  const isHt = lang === 'ht';
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const acceptTypes = accept || KIND_ACCEPT[kind] || KIND_ACCEPT.image;
  const icon = KIND_ICONS[kind] || 'fa-file';
  const labelText = label || KIND_LABELS[kind]?.[lang] || KIND_LABELS[kind]?.en || 'Media';

  // Upload file to backend
  const handleUpload = useCallback(async (file) => {
    if (!file || !onChange) return;

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(isHt ? 'Fichye a twò gwo (maks 50MB)' : 'File too large (max 50MB)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const mime = file.type || 'application/octet-stream';

          // Upload via API
          const res = await api.post('media/upload/', {
            file: base64Data,
            kind: kind,
            filename: file.name,
          }, {
            onUploadProgress: (e) => {
              if (e.total) {
                setUploadProgress(Math.round((e.loaded / e.total) * 100));
              }
            },
          });

          const url = res.data?.url;
          if (url) {
            onChange(url);
          } else {
            throw new Error('No URL returned');
          }
        } catch (err) {
          console.error('Upload failed:', err);
          alert(isHt ? 'Erè pandan upload' : 'Upload failed');
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setUploading(false);
    }
  }, [onChange, kind, isHt]);

  // File input change
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [handleUpload]);

  // Drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // Extract filename from URL for display
  const getFileName = (url) => {
    if (!url) return '';
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1].split('?')[0];
      return last || url;
    } catch {
      return url;
    }
  };

  const displayValue = value || '';
  const fileName = getFileName(displayValue);

  return (
    <div className={`mu-field ${dragOver ? 'mu-dragover' : ''}`}>
      <label className="mu-label">
        <i className={`fas ${icon}`} aria-hidden="true" />
        {' '}{labelText}
        {required && <span className="mu-required">*</span>}
      </label>

      {/* URL Input (always shown) */}
      <div className="mu-input-row">
        <input
          type="url"
          className={`mu-input ${error ? 'mu-input-error' : ''}`}
          value={displayValue}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={uploading}
        />

        {/* Upload button (premium only) */}
        {isPremium && (
          <button
            type="button"
            className="mu-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title={isHt ? 'Upload fichye' : 'Upload file'}
          >
            {uploading ? (
              <i className="fas fa-spinner fa-spin" />
            ) : (
              <i className="fas fa-cloud-arrow-up" />
            )}
            <span>{isHt ? 'Upload' : 'Upload'}</span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      {isPremium && (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      )}

      {/* Upload progress */}
      {uploading && uploadProgress > 0 && (
        <div className="mu-progress">
          <div className="mu-progress-bar" style={{ width: `${uploadProgress}%` }} />
          <span className="mu-progress-text">{uploadProgress}%</span>
        </div>
      )}

      {/* File preview (if URL exists) */}
      {displayValue && !uploading && (
        <div className="mu-preview">
          {kind === 'image' && (
            <img
              src={displayValue}
              alt=""
              className="mu-preview-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          {kind === 'video' && (
            <VideoPreviewInline url={displayValue} />
          )}
          {kind === 'audio' && (
            <AudioPreviewInline url={displayValue} />
          )}
          {fileName && (
            <span className="mu-preview-name" title={displayValue}>
              {fileName.length > 40 ? fileName.slice(0, 40) + '…' : fileName}
            </span>
          )}
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="mu-drag-overlay">
          <i className="fas fa-cloud-arrow-up" />
          <span>{isHt ? 'Depoze fichye a isit la' : 'Drop file here'}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mu-error">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      {/* Premium hint */}
      {!isPremium && (
        <div className="mu-hint">
          <i className="fas fa-star" />{' '}
          {isHt
            ? 'Premium ka upload fichye dirèkteman'
            : 'Premium users can upload files directly'}
        </div>
      )}

      {/* Drop zone (premium only) */}
      {isPremium && (
        <div
          className="mu-dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="fas fa-cloud-arrow-up" />
          <span>
            {isHt
              ? 'Depoze fichye a isit la oswa klike pou chwazi'
              : 'Drop file here or click to choose'}
          </span>
        </div>
      )}
    </div>
  );
}
