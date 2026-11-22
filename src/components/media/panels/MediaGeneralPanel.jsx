/**
 * MediaGeneralPanel — General info tab content (Slice 0 retro + Phase-2).
 *
 * Spec position: "Information" section. Shows reference count,
 * validation state, last-checked, response time, URL display, owner,
 * created/updated timestamps.
 *
 * Uses shared fmtFileSize from src/utils/formatMedia (was previously
 * inline + accidentally re-exported; that helper export is gone).
 */
import React from 'react';
import { fmtFileSize, fmtCount } from '../../../utils/formatMedia';
import { inlineText } from '../../../utils/inlineI18n';

function StatBox({ icon, label, value, color }) {
  return (
    <div className="inspector-stat-box" style={{ '--stat-color': color || 'var(--studio-pink)' }}>
      <div className="inspector-stat-icon"><i className={`fas ${icon}`} /></div>
      <div className="inspector-stat-body">
        <div className="inspector-stat-value">{value ?? '—'}</div>
        <div className="inspector-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function MediaGeneralPanel({ media, lang = 'en' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const url = item.media_url || item.public_url || '';
  const usages = Array.isArray(item.usages) ? item.usages : [];
  const lastChecked = item.last_checked;

  return (
    <div className="media-panel media-panel-general">
      <div className="inspector-stats-grid">
        <StatBox
          icon="fa-database"
          label={isHt ? 'Referans' : inlineText(lang, 'References')}
          value={fmtCount(usages.length)}
          color="#38bdf8"
        />
        <StatBox
          icon="fa-check-circle"
          label={isHt ? 'Validé' : inlineText(lang, 'Validated')}
          value={item.is_valid ? (isHt ? 'Wi' : inlineText(lang, 'Yes')) : (isHt ? 'Non' : inlineText(lang, 'No'))}
          color="#10b981"
        />
        <StatBox
          icon="fa-clock"
          label={isHt ? 'Dènye tcheke' : inlineText(lang, 'Last Checked')}
          value={lastChecked ? new Date(lastChecked).toLocaleDateString() : '—'}
          color="#f59e0b"
        />
        <StatBox
          icon="fa-tachometer-alt"
          label={isHt ? 'Repons' : inlineText(lang, 'Response')}
          value={item.response_time_ms != null ? `${item.response_time_ms}ms` : '—'}
          color="#8b5cf6"
        />
        <StatBox
          icon="fa-eye"
          label={isHt ? 'Fwa itilize' : inlineText(lang, 'View Count')}
          value={fmtCount(item.view_count)}
          color="#0ea5e9"
        />
        <StatBox
          icon="fa-calendar-plus"
          label={isHt ? 'Kreye' : inlineText(lang, 'Created')}
          value={item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
          color="#ec4899"
        />
        <StatBox
          icon="fa-pen"
          label={isHt ? 'Mete ajou' : inlineText(lang, 'Updated')}
          value={item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
          color="#14b8a6"
        />
        <StatBox
          icon="fa-hard-drive"
          label={isHt ? 'Gwosè' : inlineText(lang, 'File Size')}
          value={fmtFileSize(item.file_size || item.size_bytes || item.content_length)}
          color="#f97316"
        />
      </div>

      {url && (
        <div className="inspector-url-box">
          <code className="inspector-url">{url}</code>
          <button
            type="button"
            className="media-panel-copybtn"
            onClick={() => { if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {}); }}
            title={isHt ? 'Kopi URL' : inlineText(lang, 'Copy URL')}
            aria-label={isHt ? 'Kopi URL' : inlineText(lang, 'Copy URL')}
          >
            <i className="fas fa-copy" />
          </button>
        </div>
      )}
    </div>
  );
}
