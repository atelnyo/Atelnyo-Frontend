/**
 * MediaDetailPanel — Panno detay konplè pou yon medya.
 *
 * Montre:
 *   - Preview (Image, Video, Audio, Document)
 *   - Metadata (dimansyon, gwosè, dire, MIME)
 *   - Usage / Linked Content
 *   - Timeline / History
 *   - Visibility settings
 *   - Statistics
 *   - Validation info
 *   - Health status
 *   - Provider info
 *   - Collections
 *   - Actions: Replace URL, Copy URL, Open Source, Archive, Delete
 */
import React, { useState } from 'react';
import ImageViewer from './ImageViewer';
import MediaBadge from './MediaBadge';
import MediaStatus from './MediaStatus';
import MediaTimeline from './MediaTimeline';
import LinkedContent from './LinkedContent';
import SmartWarning from './SmartWarning';
import AISuggestion from './AISuggestion';
import MediaHelp from './MediaHelp';

function fmtFileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtDuration(seconds) {
  if (seconds == null || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaDetailPanel({
  media,
  mediaData,
  onClose,
  onReplace,
  onArchive,
  onDelete,
  onCopyUrl,
  lang = 'ht',
  className = '',
}) {
  const item = media || mediaData || {};
  const isHt = lang === 'ht';
  const [copied, setCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');

  if (!item || !item.id) return null;

  // ─── Data extraction ────────────────────────────────────────────
  const mediaType = item.media_type || item.kind || '';
  const status = item.health_status || item.status || 'unknown';
  const url = item.media_url || item.public_url || '';
  const provider = item.provider_name || item.provider || '';
  const mimeType = item.mime_type || '';
  const width = item.width;
  const height = item.height;
  const size = item.size_bytes || item.file_size || item.content_length;
  const duration = item.duration;
  const visibility = item.visibility || 'public';
  const usages = Array.isArray(item.usages) ? item.usages : [];
  const timeline = Array.isArray(item.timeline) ? item.timeline : [];
  const lastChecked = item.last_checked || item.checked_at;
  const responseTimeMs = item.response_time_ms;

  const handleCopyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    if (onCopyUrl) onCopyUrl(url);
  };

  const tabs = [
    { id: 'preview', icon: 'fa-eye', labelEn: 'Preview', labelHt: 'Aperçu' },
    { id: 'metadata', icon: 'fa-info-circle', labelEn: 'Metadata', labelHt: 'Metadone' },
    { id: 'usage', icon: 'fa-link', labelEn: 'Usage', labelHt: 'Itilizasyon', badge: usages.length },
    { id: 'timeline', icon: 'fa-history', labelEn: 'History', labelHt: 'Istwa', badge: timeline.length },
  ];

  return (
    <div className="detail-panel-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`detail-panel ${className}`} role="dialog" aria-label={isHt ? 'Detay medya' : 'Media detail'} aria-modal="true">
        {/* ─── Header ──────────────────────────────────────────── */}
        <div className="detail-panel-header">
          <div className="detail-panel-header-left">
            <MediaBadge status={status} lang={lang} />
            {provider && (
              <span className="detail-panel-provider">
                <i className="fas fa-cloud" /> {provider}
              </span>
            )}
            <span className="detail-panel-type">
              <i className={`fas ${mediaType === 'image' ? 'fa-image' : mediaType === 'video' ? 'fa-video' : mediaType === 'audio' ? 'fa-music' : 'fa-file'}`} />
              {mediaType}
            </span>
          </div>
          <div className="detail-panel-header-actions">
            <MediaHelp context="detail" lang={lang} />
            <button type="button" className="detail-panel-close" onClick={onClose}>
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* ─── Tabs ────────────────────────────────────────────── */}
        <nav className="detail-panel-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`detail-panel-tab ${activeTab === tab.id ? 'detail-panel-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fas ${tab.icon}`} />
              {isHt ? tab.labelHt : tab.labelEn}
              {tab.badge > 0 && <span className="detail-panel-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </nav>

        {/* ─── Content ─────────────────────────────────────────── */}
        <div className="detail-panel-body">
          {/* ── Preview Tab ──────────────────────────────────── */}
          {activeTab === 'preview' && (
            <div className="detail-preview-section">
              <div className="detail-preview">
                {mediaType === 'image' ? (
                  <ImageViewer mediaData={item} className="detail-preview-image" />
                ) : mediaType === 'video' ? (
                  <div className="detail-preview-video">
                    <iframe
                      src={item.preview_url || url}
                      title={item.title || 'Video'}
                      className="detail-preview-iframe"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  </div>
                ) : mediaType === 'audio' ? (
                  <div className="detail-preview-audio">
                    <div className="detail-preview-audio-icon">
                      <i className="fas fa-music" />
                    </div>
                    <audio src={url} controls className="detail-preview-audio-player" preload="metadata" />
                  </div>
                ) : (
                  <div className="detail-preview-file">
                    <i className="fas fa-file-alt" />
                    <p>{url ? url.split('/').pop() : 'Media'}</p>
                  </div>
                )}
              </div>

              {/* AI Suggestion if broken */}
              {(status === 'broken' || status === 'blocked') && (
                <AISuggestion
                  statusCode={item.status_code}
                  errorMessage={item.error_message}
                  provider={provider}
                  lang={lang}
                  onRetry={onReplace ? () => onReplace(item) : undefined}
                />
              )}
            </div>
          )}

          {/* ── Metadata Tab ─────────────────────────────────── */}
          {activeTab === 'metadata' && (
            <div className="detail-metadata-section">
              <MediaStatus
                status={status}
                lastChecked={lastChecked}
                responseTimeMs={responseTimeMs}
                lang={lang}
                size="md"
              />
              <div className="detail-meta-grid">
                {mimeType && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">MIME</span>
                    <span className="detail-meta-value">{mimeType}</span>
                  </div>
                )}
                {width && height && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">{isHt ? 'Dimansyon' : 'Dimensions'}</span>
                    <span className="detail-meta-value">{width} × {height}</span>
                  </div>
                )}
                {size != null && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">{isHt ? 'Gwosè' : 'Size'}</span>
                    <span className="detail-meta-value">{fmtFileSize(size)}</span>
                  </div>
                )}
                {duration != null && duration > 0 && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">{isHt ? 'Dire' : 'Duration'}</span>
                    <span className="detail-meta-value">{fmtDuration(duration)}</span>
                  </div>
                )}
                {item.created_at && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">{isHt ? 'Kreye' : 'Created'}</span>
                    <span className="detail-meta-value">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                )}
                {item.updated_at && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">{isHt ? 'Mete ajou' : 'Updated'}</span>
                    <span className="detail-meta-value">{new Date(item.updated_at).toLocaleString()}</span>
                  </div>
                )}
                <div className="detail-meta-item">
                  <span className="detail-meta-label">{isHt ? 'Vizibilite' : 'Visibility'}</span>
                  <span className="detail-meta-value">{visibility}</span>
                </div>
                {provider && (
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">{isHt ? 'Provider' : 'Provider'}</span>
                    <span className="detail-meta-value">{provider}</span>
                  </div>
                )}
              </div>

              {/* URL */}
              {url && (
                <div className="detail-meta-url">
                  <code className="detail-meta-url-text">{url}</code>
                  <button type="button" className="detail-meta-url-copy" onClick={handleCopyUrl}>
                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Usage Tab ───────────────────────────────────── */}
          {activeTab === 'usage' && (
            <div className="detail-usage-section">
              <LinkedContent usages={usages} lang={lang} />
            </div>
          )}

          {/* ── Timeline Tab ─────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div className="detail-timeline-section">
              <MediaTimeline events={timeline} lang={lang} />
            </div>
          )}
        </div>

        {/* ─── Actions ──────────────────────────────────────────── */}
        <div className="detail-panel-actions">
          {onReplace && (
            <button type="button" className="btn-secondary" onClick={() => onReplace(item)}>
              <i className="fas fa-exchange-alt" /> {isHt ? 'Ranplase URL' : 'Replace URL'}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={handleCopyUrl}>
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
            {copied ? (isHt ? 'Kopi!' : 'Copied!') : (isHt ? 'Kopi URL' : 'Copy URL')}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <i className="fas fa-external-link-alt" /> {isHt ? 'Louvri' : 'Open'}
          </a>
          {onArchive && (
            <button type="button" className="btn-secondary" onClick={() => onArchive(item)}>
              <i className="fas fa-archive" /> {isHt ? 'Achive' : 'Archive'}
            </button>
          )}
          {onDelete && (
            <button type="button" className="detail-panel-delete-btn" onClick={() => setShowDelete(true)}>
              <i className="fas fa-trash" /> {isHt ? 'Efase' : 'Delete'}
            </button>
          )}
        </div>

        {/* ─── Smart Warning ──────────────────────────────────── */}
        <SmartWarning
          open={showDelete}
          media={item}
          usages={usages}
          onConfirm={() => { setShowDelete(false); onDelete?.(item); }}
          onCancel={() => setShowDelete(false)}
          lang={lang}
        />
      </div>
    </div>
  );
}
