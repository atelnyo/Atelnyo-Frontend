/**
 * MediaValidationPanel — Validation tab content (Slice 0 retro + Phase-2).
 *
 * Surfaces Status summary, all metadata fields, and a collapsible
 * History feed of validation attempts.
 *
 * Uses shared fmtFileSize / fmtDuration from src/utils/formatMedia.
 * The MetaItem helper is now INTERNAL (was a leaked export; no
 * external consumer needed it).
 */
import React from 'react';
import MediaStatus from '../MediaStatus';
import { fmtFileSize, fmtDuration } from '../../../utils/formatMedia';

function MetaItem({ label, value }) {
  return (
    <div className="inspector-meta-item">
      <span className="inspector-meta-label">{label}</span>
      <span className="inspector-meta-value">{value ?? '—'}</span>
    </div>
  );
}

export default function MediaValidationPanel({ media, lang = 'ht' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const status = item.health_status || item.status || 'unknown';
  const validationHistory = Array.isArray(item.validation_history) ? item.validation_history : [];

  return (
    <div className="media-panel media-panel-validation">
      <MediaStatus
        status={status}
        lastChecked={item.last_checked}
        responseTimeMs={item.response_time_ms}
        lang={lang}
      />
      <div className="inspector-meta-grid">
        {item.mime_type && <MetaItem label="MIME" value={item.mime_type} />}
        {item.status_code != null && <MetaItem label={isHt ? 'Kòd' : 'Status Code'} value={String(item.status_code)} />}
        {item.file_size != null && <MetaItem label={isHt ? 'Gwosè' : 'Size'} value={fmtFileSize(item.file_size)} />}
        {item.duration != null && <MetaItem label={isHt ? 'Dire' : 'Duration'} value={fmtDuration(item.duration)} />}
        {item.width && item.height && <MetaItem label={isHt ? 'Dimansyon' : 'Dimensions'} value={`${item.width}×${item.height}`} />}
        {item.aspect_ratio && <MetaItem label={isHt ? 'Rapò Aspè' : 'Aspect Ratio'} value={item.aspect_ratio} />}
        {item.extension && <MetaItem label={isHt ? 'Ekstansyon' : 'Extension'} value={item.extension} />}
      </div>

      {validationHistory.length > 0 && (
        <details className="inspector-details">
          <summary className="inspector-details-summary">
            {isHt ? 'Istwa validasyon' : 'Validation History'} ({validationHistory.length})
          </summary>
          <div className="inspector-history-list">
            {validationHistory.map((h, i) => (
              <div key={i} className="inspector-history-item">
                <span className="inspector-history-status">{h.status || h.action || '—'}</span>
                <span className="inspector-history-date">
                  {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
