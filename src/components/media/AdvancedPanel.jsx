/**
 * AdvancedPanel — Technical details for power users.
 *
 * Shows: Original URL, Normalized URL, Provider, Content Type,
 * MIME Type, Headers, Dimensions, Duration, Aspect Ratio,
 * Latency, Validation History, Response Time, Redirect Chain,
 * Last Validation, Health Report.
 *
 * NOT visible to beginners — hidden behind an "Advanced" toggle.
 */
import React, { useState } from 'react';

function fmtFileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtDuration(seconds) {
  if (seconds == null || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="advanced-row">
      <span className="advanced-label">{label}</span>
      <span className={`advanced-value ${mono ? 'advanced-value-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function SectionBlock({ title, icon, children }) {
  return (
    <div className="advanced-section">
      <h4 className="advanced-section-title">
        <i className={`fas ${icon}`} /> {title}
      </h4>
      <div className="advanced-section-body">
        {children}
      </div>
    </div>
  );
}

export default function AdvancedPanel({ media, mediaData, lang = 'ht', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const item = media || mediaData || {};
  const isHt = lang === 'ht';

  if (!item || !item.id) {
    return (
      <div className="advanced-panel-empty">
        <p>{isHt ? 'Chwazi yon medya pou wè detay avanse' : 'Select a media item to view advanced details'}</p>
      </div>
    );
  }

  const url = item.media_url || item.public_url || '';
  const provider = item.provider_name || item.provider || '';
  const mediaType = item.media_type || item.kind || '';
  const mimeType = item.mime_type || '';
  const width = item.width;
  const height = item.height;
  const duration = item.duration;
  const responseTimeMs = item.response_time_ms;
  const statusCode = item.status_code;
  const fileSize = item.file_size || item.size_bytes || item.content_length;
  const validationHistory = Array.isArray(item.validation_history) ? item.validation_history : [];
  const headers = item.headers || {};
  const redirectChain = Array.isArray(item.redirect_chain) ? item.redirect_chain : [];
  const healthScore = item.health_score ?? item.score ?? null;
  const aspectRatio = width && height ? `${(width / height).toFixed(2)}:1` : null;
  const lastValidated = item.last_checked || item.checked_at || item.validated_at;

  return (
    <div className={`advanced-panel ${className}`}>
      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <i className={`fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
        <i className="fas fa-microchip" />
        {isHt ? 'Detay Avanse' : 'Advanced Details'}
        <span className="advanced-toggle-badge">
          {isHt ? 'Pou itilizatè avanse' : 'For advanced users'}
        </span>
      </button>

      {isOpen && (
        <div className="advanced-content">
          {/* URL Info */}
          <SectionBlock title={isHt ? 'URL & Reso' : 'URL & Network'} icon="fa-link">
            <DetailRow label={isHt ? 'URL Orijinal' : 'Original URL'} value={url} mono />
            <DetailRow label={isHt ? 'URL Normalize' : 'Normalized URL'} value={url} mono />
            <DetailRow label={isHt ? 'Provider' : 'Provider'} value={provider} />
            <DetailRow label={isHt ? 'Kòd Estati' : 'Status Code'} value={statusCode} mono />
            {responseTimeMs != null && (
              <DetailRow label={isHt ? 'Tan Repons' : 'Response Time'} value={`${responseTimeMs}ms`} mono />
            )}
            {fileSize != null && (
              <DetailRow label={isHt ? 'Gwosè Fichye' : 'File Size'} value={fmtFileSize(fileSize)} />
            )}
          </SectionBlock>

          {/* Content Info */}
          <SectionBlock title={isHt ? 'Kontni & Metadone' : 'Content & Metadata'} icon="fa-file-alt">
            <DetailRow label={isHt ? 'Kalite Medya' : 'Media Type'} value={mediaType} />
            <DetailRow label="Content Type" value={contentTypeLabel(mimeType)} />
            <DetailRow label="MIME Type" value={mimeType} mono />
            {width && height && (
              <DetailRow label={isHt ? 'Dimansyon' : 'Dimensions'} value={`${width} × ${height}px`} />
            )}
            {aspectRatio && (
              <DetailRow label={isHt ? 'Rapò Aspè' : 'Aspect Ratio'} value={aspectRatio} />
            )}
            {duration != null && duration > 0 && (
              <DetailRow label={isHt ? 'Dire' : 'Duration'} value={fmtDuration(duration)} />
            )}
          </SectionBlock>

          {/* Performance */}
          <SectionBlock title={isHt ? 'Pèfòmans' : 'Performance'} icon="fa-tachometer-alt">
            {healthScore != null && (
              <div className="advanced-health-bar">
                <span className="advanced-health-label">
                  {isHt ? 'Sante' : 'Health'}:
                </span>
                <div className="advanced-health-track">
                  <div
                    className="advanced-health-fill"
                    style={{
                      width: `${healthScore}%`,
                      background: healthScore >= 80 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <span className="advanced-health-value">{healthScore}%</span>
              </div>
            )}
            <DetailRow label={isHt ? 'Latansi' : 'Latency'} value={responseTimeMs != null ? `${responseTimeMs}ms` : '—'} />
            {lastValidated && (
              <DetailRow label={isHt ? 'Dènye Validasyon' : 'Last Validation'} value={new Date(lastValidated).toLocaleString()} />
            )}
          </SectionBlock>

          {/* Headers */}
          {Object.keys(headers).length > 0 && (
            <SectionBlock title={isHt ? 'Headers' : 'Headers'} icon="fa-code">
              {Object.entries(headers).slice(0, 10).map(([key, val]) => (
                <DetailRow key={key} label={key} value={String(val).slice(0, 100)} mono />
              ))}
            </SectionBlock>
          )}

          {/* Redirect Chain */}
          {redirectChain.length > 0 && (
            <SectionBlock title={isHt ? 'Chain Redireksyon' : 'Redirect Chain'} icon="fa-arrows-alt-h">
              {redirectChain.map((url, i) => (
                <DetailRow key={i} label={`${i + 1}`} value={url} mono />
              ))}
            </SectionBlock>
          )}

          {/* Validation History */}
          {validationHistory.length > 0 && (
            <SectionBlock title={isHt ? 'Istwa Validasyon' : 'Validation History'} icon="fa-history">
              {validationHistory.slice(0, 10).map((h, i) => (
                <DetailRow
                  key={i}
                  label={h.timestamp ? new Date(h.timestamp).toLocaleString() : `#${i + 1}`}
                  value={`${h.status || h.action || '—'} (${h.status_code || '?'})`}
                  mono
                />
              ))}
            </SectionBlock>
          )}

          {/* Raw Report */}
          <SectionBlock title={isHt ? 'Rapò Sante' : 'Health Report'} icon="fa-heartbeat">
            <pre className="advanced-raw">{JSON.stringify({
              url, mediaType, mimeType, statusCode,
              responseTimeMs, healthScore, fileSize,
              width, height, duration, aspectRatio,
            }, null, 2)}</pre>
          </SectionBlock>
        </div>
      )}
    </div>
  );
}

function contentTypeLabel(mime) {
  if (!mime) return '—';
  const map = {
    'image/jpeg': 'JPEG Image', 'image/png': 'PNG Image',
    'image/gif': 'GIF Image', 'image/webp': 'WebP Image',
    'video/mp4': 'MP4 Video', 'video/webm': 'WebM Video',
    'audio/mpeg': 'MP3 Audio', 'audio/wav': 'WAV Audio',
    'application/pdf': 'PDF Document', 'text/plain': 'Plain Text',
  };
  return map[mime] || mime;
}
