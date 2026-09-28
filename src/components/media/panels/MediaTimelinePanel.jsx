/**
 * MediaTimelinePanel — Timeline tab content (Slice 0 retro).
 *
 * Wraps MediaTimeline and adds an Audit History feed from the
 * backend MediaAuditLog when available. Audit entries are
 * read-only here (admin view lives elsewhere).
 */
import React from 'react';
import MediaTimeline from '../MediaTimeline';

export default function MediaTimelinePanel({ media, lang = 'ht' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const timeline = Array.isArray(item.timeline) ? item.timeline : [];
  const audit = Array.isArray(item.audit_log || item.audit_history) ? (item.audit_log || item.audit_history) : [];

  return (
    <div className="media-panel media-panel-timeline">
      <MediaTimeline events={timeline} lang={lang} />
      {audit.length > 0 && (
        <section className="media-panel-audit" aria-label={isHt ? 'Istwa odit' : 'Audit history'}>
          <h4>
            <i className="fas fa-shield-alt" />
            {isHt ? 'Istwa Odit' : 'Audit History'} <span>({audit.length})</span>
          </h4>
          <ul className="media-panel-audit-list">
            {audit.slice(0, 20).map((entry, i) => (
              <li key={i} className="media-panel-audit-row">
                <span className="media-panel-audit-action">{entry.action || '—'}</span>
                <span className="media-panel-audit-by">{entry.by || entry.actor || ''}</span>
                <span className="media-panel-audit-when">
                  {entry.at ? new Date(entry.at).toLocaleString() : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
