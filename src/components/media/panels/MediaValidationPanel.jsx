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
import { inlineText } from '../../../utils/inlineI18n';

function MetaItem({ label, value }) {
  return (
    <div className="inspector-meta-item">
      <span className="inspector-meta-label">{label}</span>
      <span className="inspector-meta-value">{value ?? '—'}</span>
    </div>
  );
}

export default function MediaValidationPanel({ media, lang = 'en' }) {
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
        {item.status_code != null && <MetaItem label={isHt ? 'Kòd' : inlineText(lang, 'Status Code')} value={String(item.status_code)} />}
        {item.file_size != null && <MetaItem label={isHt ? 'Gwosè' : inlineText(lang, 'Size')} value={fmtFileSize(item.file_size)} />}
        {item.duration != null && <MetaItem label={isHt ? 'Dire' : inlineText(lang, 'Duration')} value={fmtDuration(item.duration)} />}
        {item.width && item.height && <MetaItem label={isHt ? 'Dimansyon' : inlineText(lang, 'Dimensions')} value={`${item.width}×${item.height}`} />}
        {item.aspect_ratio && <MetaItem label={isHt ? 'Rapò Aspè' : inlineText(lang, 'Aspect Ratio')} value={item.aspect_ratio} />}
        {item.extension && <MetaItem label={isHt ? 'Ekstansyon' : inlineText(lang, 'Extension')} value={item.extension} />}
      </div>

      {validationHistory.length > 0 && (
        <details className="inspector-details">
          <summary className="inspector-details-summary">
            {isHt ? 'Istwa validasyon' : inlineText(lang, 'Validation History')} ({validationHistory.length})
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
