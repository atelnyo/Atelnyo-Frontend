/**
 * MediaAnalyticsPanel — Per-media Analytics (Phase-2 Analytics section).
 *
 * EXPECTED BACKEND ENDPOINT (BACKEND PENDING):
 *   GET /api/media/:id/analytics/
 *
 * Response shape (planned):
 *   {
 *     view_count, click_count, usage, modules_count,
 *     broken_reports, avg_load_time_ms, last_validation,
 *     top_pages: [{label, count}], most_active_day,
 *     last_published, creator_insights: [str]
 *   }
 *
 * Until that endpoint ships, fields whose payload is missing show a
 * "Backend pending" chip so creators see the data category exists
 * without us inventing fake values.
 *
 * 11 spec metrics:
 *   Views, Clicks, Usage, Modules, Broken Reports,
 *   Avg Loading Time, Last Validation, Top Pages,
 *   Most Active Day, Last Published, Creator Insights
 */
import React from 'react';

const METRICS = [
  { key: 'view_count',      labelEn: 'Views',           labelHt: 'Fwa Konsilte',     icon: 'fa-eye',                backendPending: false, derive: (m, a) => a?.view_count ?? m?.view_count ?? 0 },
  { key: 'click_count',     labelEn: 'Clicks',          labelHt: 'Klike',            icon: 'fa-mouse-pointer',      backendPending: true },
  { key: 'usage',           labelEn: 'Usage',           labelHt: 'Itilizasyon',      icon: 'fa-link',               backendPending: false, derive: (m) => Array.isArray(m?.usages) ? m.usages.length : 0 },
  { key: 'modules',         labelEn: 'Modules',         labelHt: 'Modil',            icon: 'fa-cubes',              backendPending: false, derive: (m) => {
      const u = Array.isArray(m?.usages) ? m.usages : [];
      return new Set(u.map((x) => x.module).filter(Boolean)).size;
    } },
  { key: 'broken_reports',  labelEn: 'Broken Reports',  labelHt: 'Rapò Kase',        icon: 'fa-exclamation-triangle', backendPending: true },
  { key: 'avg_load_time',   labelEn: 'Avg Loading Time', labelHt: 'Tan Chaj Mwayen',  icon: 'fa-tachometer-alt',     backendPending: true, suffix: ' ms' },
  { key: 'last_validation', labelEn: 'Last Validation', labelHt: 'Dènye Validasyon', icon: 'fa-stethoscope',        backendPending: false, datetime: true, derive: (m) => m?.last_checked || m?.last_validation },
  { key: 'top_pages',       labelEn: 'Top Pages',       labelHt: 'Pi Bon Paj',       icon: 'fa-fire',               backendPending: true, list: true },
  { key: 'most_active_day', labelEn: 'Most Active Day', labelHt: 'Pi Aktif Jou',     icon: 'fa-calendar-day',       backendPending: true },
  { key: 'last_published',  labelEn: 'Last Published',  labelHt: 'Dènye Piblikasyon', icon: 'fa-paper-plane',       backendPending: false, datetime: true, derive: (m) => m?.published_at },
  { key: 'creator_insights', labelEn: 'Creator Insights', labelHt: 'Ide Kreyatè',     icon: 'fa-lightbulb',          backendPending: true, list: true },
];

export default function MediaAnalyticsPanel({ media, analytics = null, lang = 'ht', className = '' }) {
  const item = media || {};
  const isHt = lang === 'ht';

  return (
    <div className={`media-panel media-panel-analytics ${className}`}>
      <p className="media-panel-intro">
        {isHt
          ? 'Analitik itilizasyon medya sa a. Jaden ki tann yon endpoint backend montre sa yo ap tann.'
          : 'Usage analytics for this media. Fields waiting on a backend endpoint show as pending.'}
      </p>
      <ul className="media-panel-metrics">
        {METRICS.map((metric) => {
          let display;
          if (metric.backendPending) {
            display = (
              <span className="media-panel-metric-pending" title={isHt ? 'Tann yon endpoint backend' : 'Awaiting backend endpoint'}>
                <i className="fas fa-hourglass-half" />
                {isHt ? 'Ap tann backend' : 'Backend pending'}
              </span>
            );
          } else if (metric.list) {
            const arr = metric.derive ? metric.derive(item, analytics) : (analytics?.[metric.key] || []);
            display = Array.isArray(arr) && arr.length > 0 ? (
              <ul className="media-panel-metric-list">
                {arr.slice(0, 5).map((entry, i) => (
                  <li key={i}>{typeof entry === 'string' ? entry : (entry?.label || entry?.title || String(entry))}</li>
                ))}
              </ul>
            ) : <span className="media-panel-metric-empty">—</span>;
          } else if (metric.datetime) {
            const v = metric.derive ? metric.derive(item, analytics) : null;
            display = v ? (
              <time dateTime={String(v)}>{new Date(String(v)).toLocaleString()}</time>
            ) : <span className="media-panel-metric-empty">—</span>;
          } else {
            const v = metric.derive ? metric.derive(item, analytics) : (analytics?.[metric.key] ?? 0);
            display = <strong>{Number(v).toLocaleString()}{metric.suffix || ''}</strong>;
          }
          return (
            <li key={metric.key} className={`media-panel-metric ${metric.backendPending ? 'media-panel-metric-pending-row' : ''}`}>
              <span className="media-panel-metric-icon"><i className={`fas ${metric.icon}`} /></span>
              <span className="media-panel-metric-label">{isHt ? metric.labelHt : metric.labelEn}</span>
              <span className="media-panel-metric-value">{display}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
