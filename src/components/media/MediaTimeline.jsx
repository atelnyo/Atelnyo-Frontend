/**
 * MediaTimeline — Istwa medya a nan yon lis kwonolojik.
 *
 * Montre: Created, Validated, Published, Updated,
 * Visibility Changed, Broken, Recovered, Archived, Deleted
 */
import React from 'react';

const TIMELINE_ICONS = {
  created: 'fa-plus-circle',
  validated: 'fa-check-circle',
  published: 'fa-globe',
  updated: 'fa-pen',
  visibility_changed: 'fa-eye',
  broken: 'fa-times-circle',
  recovered: 'fa-heartbeat',
  archived: 'fa-archive',
  deleted: 'fa-trash',
  health_checked: 'fa-stethoscope',
  smart_replaced: 'fa-exchange-alt',
};

const TIMELINE_LABELS = {
  created: { en: 'Created', ht: 'Kreye' },
  validated: { en: 'Validated', ht: 'Valide' },
  published: { en: 'Published', ht: 'Pibliye' },
  updated: { en: 'Updated', ht: 'Mete ajou' },
  visibility_changed: { en: 'Visibility changed', ht: 'Vizibilite chanje' },
  broken: { en: 'Marked as broken', ht: 'Make kòm kase' },
  recovered: { en: 'Recovered', ht: 'Refè' },
  archived: { en: 'Archived', ht: 'Achive' },
  deleted: { en: 'Deleted', ht: 'Efase' },
  health_checked: { en: 'Health check', ht: 'Tcheke sante' },
  smart_replaced: { en: 'URL replaced', ht: 'URL ranplase' },
};

const TIMELINE_COLORS = {
  created: 'var(--state-info, #38bdf8)',
  validated: 'var(--state-success, #10b981)',
  published: 'var(--state-success, #10b981)',
  updated: 'var(--state-warning, #f59e0b)',
  visibility_changed: 'var(--pr-color-violet-500, #8b5cf6)',
  broken: 'var(--state-error, #ef4444)',
  recovered: 'var(--state-success, #10b981)',
  archived: 'var(--text-secondary, #64748b)',
  deleted: 'var(--state-error, #ef4444)',
  health_checked: 'var(--state-info, #38bdf8)',
  smart_replaced: 'var(--pr-color-violet-500, #8b5cf6)',
};

export default function MediaTimeline({ events = [], lang = 'ht', className = '' }) {
  const isHt = lang === 'ht';

  if (!events || events.length === 0) {
    return (
      <div className="media-timeline-empty">
        <i className="fas fa-history" />
        <p>{isHt ? 'Pa gen istwa pou medya sa a.' : 'No history for this media.'}</p>
      </div>
    );
  }

  return (
    <div className={`media-timeline ${className}`}>
      {events.sort((a, b) => new Date(b.at || b.timestamp) - new Date(a.at || a.timestamp)).map((event, i) => {
        const action = event.action || event.type || '';
        const icon = TIMELINE_ICONS[action] || 'fa-circle';
        const label = TIMELINE_LABELS[action] || { en: action, ht: action };
        const color = TIMELINE_COLORS[action] || 'var(--text-secondary, #94a3b8)';
        const date = event.at || event.timestamp || '';
        const by = event.by || event.user || '';

        return (
          <div key={i} className="media-timeline-item">
            <div className="media-timeline-dot" style={{ background: color }}>
              <i className={`fas ${icon}`} />
            </div>
            <div className="media-timeline-content">
              <span className="media-timeline-action" style={{ color }}>
                {isHt ? label.ht : label.en}
              </span>
              {by && (
                <span className="media-timeline-by">
                  {isHt ? 'pa' : 'by'} {by}
                </span>
              )}
              {date && (
                <span className="media-timeline-date">
                  {new Date(date).toLocaleString()}
                </span>
              )}
              {event.note && (
                <p className="media-timeline-note">{event.note}</p>
              )}
              {event.detail && (
                <p className="media-timeline-note">{event.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
