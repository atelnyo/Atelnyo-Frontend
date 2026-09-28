/**
 * MediaRecentActivityPanel — Timeline panel of recent activity events.
 *
 * Spec (Phase CREATOR EXPERIENCE §3 — Recent Activity):
 *   "Montre. Media Created, Media Updated, Media Validated,
 *    Media Published, Media Archived, Media Replaced, Media Deleted,
 *    Broken Link, Recovered Link. Tout klase pa dat."
 *
 * Sprint stance:
 *   Until /api/media/activity/ ships, the panel derives a
 *   deterministic recent-activity timeline from the existing media
 *   list (using m.created_at + m.updated_at + the audit log if present
 *   via m.audit_log). The BackendPendingChip surfaces the gap.
 *
 * Behavior:
 *   - Default sort: newest first.
 *   - Cap at 12 visible rows; "View all" button expands.
 *   - Each row: icon + relative time + media card mini + event type.
 *   - Click on row navigates to the Media Entity Page.
 */
import React, { useMemo, useState, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { MediaTypeIcon } from './MediaIconography';
import { makeT } from '../../utils/langBackendStub';
import { cacheMedia } from '../../utils/mediaCache';

const EVENT_DEFS = [
  { id: 'created',   tKey: 'eventCreated',   icon: 'fa-plus-circle' },
  { id: 'updated',   tKey: 'eventUpdated',   icon: 'fa-pen' },
  { id: 'validated', tKey: 'eventValidated', icon: 'fa-shield-halved' },
  { id: 'published', tKey: 'eventPublished', icon: 'fa-globe' },
  { id: 'archived',  tKey: 'eventArchived',  icon: 'fa-box-archive' },
  { id: 'replaced',  tKey: 'eventReplaced',  icon: 'fa-arrow-right-arrow-left' },
  { id: 'deleted',   tKey: 'eventDeleted',   icon: 'fa-trash' },
  { id: 'broken',    tKey: 'eventBroken',    icon: 'fa-link-slash' },
  { id: 'recovered', tKey: 'eventRecovered', icon: 'fa-heart-pulse' },
];

function fmtRelative(dateLike, lang) {
  if (!dateLike) {return '—';}
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) {return '—';}
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) {return lang === 'en' ? 'just now' : 'kòryèzman';}
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === 'en' ? `${m}m ago` : `${m} min`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return lang === 'en' ? `${h}h ago` : `${h} h`;
  }
  if (diff < 86400 * 7) {
    const d = Math.floor(diff / 86400);
    return lang === 'en' ? `${d}d ago` : `${d} j`;
  }
  try {
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-HT', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function inferEventsForMedia(m) {
  if (!m) {return [];}
  const out = [];

  if (m.created_at) {
    out.push({ event: 'created', at: m.created_at });
  }
  if (m.updated_at && m.updated_at !== m.created_at) {
    out.push({ event: 'updated', at: m.updated_at });
  }
  if (m.last_validation || m.validated_at) {
    out.push({ event: 'validated', at: m.last_validation || m.validated_at });
  }
  if (m.published_at) {
    out.push({ event: 'published', at: m.published_at });
  }
  if (m.archived_at) {
    out.push({ event: 'archived', at: m.archived_at });
  }
  if (m.url_replaced_at || m.replaced_at) {
    out.push({ event: 'replaced', at: m.url_replaced_at || m.replaced_at });
  }
  if (m.deleted_at) {
    out.push({ event: 'deleted', at: m.deleted_at });
  }
  const health = (m.health || '').toString().toLowerCase();
  if (health === 'broken') {
    out.push({ event: 'broken', at: m.health_changed_at || m.updated_at || m.created_at });
  } else if (health === 'healthy' && m.was_broken === true) {
    out.push({ event: 'recovered', at: m.health_changed_at || m.updated_at || m.created_at });
  }
  if (Array.isArray(m.audit_log)) {
    for (const row of m.audit_log) {
      if (!row || !row.event || !row.at) {continue;}
      if (out.find((e) => e.event === row.event && e.at === row.at)) {continue;}
      out.push({ event: row.event, at: row.at });
    }
  }
  return out;
}

export default function MediaRecentActivityPanel({
  lang = 'ht',
  mediaList = [],
  searchFilter = '',
  onOpenMedia,
}) {
  const t = makeT(lang);
  const navigate = useSafeNavigate();
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const acc = [];
    for (const m of mediaList) {
      const events = inferEventsForMedia(m);
      for (const ev of events) {
        acc.push({ media: m, event: ev.event, at: ev.at });
      }
    }
    acc.sort((a, b) => {
      const da = new Date(a.at || 0).getTime();
      const db = new Date(b.at || 0).getTime();
      return db - da;
    });
    if (searchFilter) {
      const q = String(searchFilter).toLowerCase();
      return acc.filter((r) => {
        const tt = (r.media.title || r.media.original_filename || '').toLowerCase();
        return tt.includes(q);
      });
    }
    return acc;
  }, [mediaList, searchFilter]);

  const visible = expanded ? rows : rows.slice(0, 12);

  const handleClick = useCallback((m) => {
    cacheMedia(m); // survives F5 in-tab (window cache did not)
    navigate(`/sheet/media/${m.id}`, { state: { media: m } });
  }, [navigate]);

  return (
    <section className="recent-activity-panel" aria-label={t('recentActivity')}>
      <header className="recent-activity-panel-header">
        <i className="fas fa-stream" aria-hidden="true" />
        <h3>{t('recentActivity')}</h3>
        <button
          type="button"
          className="recent-activity-panel-action"
          onClick={() => onOpenMedia?.()}
        >
          <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
          <span>{lang === 'en' ? 'Open media' : 'Louvri medya'}</span>
        </button>
      </header>
      {visible.length === 0 ? (
        <div className="recent-activity-empty">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{t('noActivity')}</span>
        </div>
      ) : (
        <ol className="recent-activity-list" role="list">
          {visible.map((row) => {
            const def = EVENT_DEFS.find((d) => d.id === row.event) || EVENT_DEFS[1];
            return (
              <li key={`${row.media.id}_${row.event}`} className="recent-activity-row">
                <button
                  type="button"
                  className="recent-activity-row-btn"
                  onClick={() => handleClick(row.media)}
                >
                  <span className="recent-activity-row-icon" aria-hidden="true">
                    <i className={`fas ${def.icon}`} />
                  </span>
                  <span className="recent-activity-row-body">
                    <span className="recent-activity-row-label">
                      {t(def.tKey)} · <strong>{row.media.title || row.media.original_filename || 'Media'}</strong>
                    </span>
                    <span className="recent-activity-row-time">
                      {fmtRelative(row.at, lang)}
                    </span>
                  </span>
                  <span className="recent-activity-row-kind" aria-hidden="true">
                    <MediaTypeIcon
                      kind={row.media.media_type || row.media.kind || row.media.type || 'file'}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > 12 && (
        <button
          type="button"
          className="recent-activity-toggle"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded
            ? (lang === 'en' ? 'Show less' : 'Montre mwens')
            : (lang === 'en' ? `View all (${rows.length})` : `Wè tout (${rows.length})`)}
        </button>
      )}
      <div className="recent-activity-panel-footer">
        <button
          type="button"
          className="recent-activity-panel-action recent-activity-panel-action-secondary"
          onClick={() => setExpanded(true)}
          disabled={expanded || rows.length <= 12}
        >
          <i className="fas fa-list" aria-hidden="true" />
          <span>{lang === 'en' ? 'Show all activity' : 'Montre tout aktivite'}</span>
        </button>
      </div>
    </section>
  );
}
