/**
 * MediaSecurityPanel — Per-media Security (Phase-2 Security section).
 *
 * EXPECTED BACKEND ENDPOINT (BACKEND PENDING):
 *   GET /api/media/:id/security/
 *
 * Response shape (planned):
 *   {
 *     risk_level, blocked_domains: [string], unsafe_redirect,
 *     malware_result, privacy,
 *   }
 *
 * Contrast-safe restricted rendering:
 *   • When a row is admin-only AND the viewer is not admin, the value
 *     column renders an aria-live="polite" placeholder ("🔒 Restricted
 *     to admin") instead of the actual value. The row chrome stays at
 *     full opacity so layout is consistent, and the value text itself
 *     is NEVER dimmed via opacity (which would fail WCAG AA contrast).
 *   • A small visual lock chip appears next to the dt label.
 *
 * Removed in this round: any `opacity: <1>` styling on restricted
 * rows. Replaced by placeholder text + dashed border + inline icon.
 */
import React from 'react';

const FIELDS = [
  { key: 'visibility',       labelEn: 'Visibility',     labelHt: 'Vizibilite',          icon: 'fa-eye',                  backendPending: false, derive: (m) => m?.visibility || 'public' },
  { key: 'permission',       labelEn: 'Permission',     labelHt: 'Pèmisyon',            icon: 'fa-key',                  backendPending: true, restricted: true },
  { key: 'validation',       labelEn: 'Validation',     labelHt: 'Validasyon',          icon: 'fa-stethoscope',          backendPending: false, derive: (m) => m?.is_valid ? 'passed' : 'pending' },
  { key: 'risk_level',       labelEn: 'Risk Level',     labelHt: 'Nivo Risk',           icon: 'fa-exclamation-triangle', backendPending: true, restricted: true },
  { key: 'blocked_domains',  labelEn: 'Blocked Domains', labelHt: 'Domain Bloke',        icon: 'fa-ban',                  backendPending: true, restricted: true, list: true },
  { key: 'unsafe_redirect',  labelEn: 'Unsafe Redirect',labelHt: 'Redireksyon Pa Sekirize', icon: 'fa-arrows-alt-h',   backendPending: true, restricted: true },
  { key: 'expired',          labelEn: 'Expired',        labelHt: 'Ekspire',             icon: 'fa-hourglass-end',        backendPending: false, derive: (m) => m?.health_status === 'expired' ? 'Yes' : 'No' },
  { key: 'malware_result',   labelEn: 'Malware Result', labelHt: 'Rezilta Malveyan',    icon: 'fa-bug',                  backendPending: true, restricted: true },
  { key: 'privacy',          labelEn: 'Privacy',        labelHt: 'Konfidansyalite',     icon: 'fa-lock',                 backendPending: true, restricted: true },
  { key: 'security_score',   labelEn: 'Security Score', labelHt: 'Nòt Sekirite',        icon: 'fa-shield-alt',           backendPending: false, derive: (m) => m?.security_score != null ? `${m.security_score}%` : null },
];

export default function MediaSecurityPanel({ media, security = null, lang = 'ht', isAdmin = false, className = '' }) {
  const item = media || {};
  const isHt = lang === 'ht';

  // Constants for restricted-row label / placeholder text.
  const LOCK_LABEL_EN = 'Restricted to admin';
  const LOCK_LABEL_HT = 'Rezève pou admin';
  const LOCK_ICON = '\u{1F512}'; // 🔒

  return (
    <div className={`media-panel media-panel-security ${className}`}>
      <div className="media-panel-security-header">
        <i className="fas fa-shield-alt" aria-hidden="true" />
        <strong>{isHt ? 'Sekirite' : 'Security'}</strong>
        {!isAdmin && (
          <span className="media-panel-security-adminonly">
            {isHt ? 'Avanse: admin sèlman' : 'Advanced: admin only'}
          </span>
        )}
      </div>
      <p className="media-panel-intro">
        {isHt
          ? 'Tout siy sekirite pou medya sa a. Jaden ki pa disponib tann yon endpoint backend.'
          : 'All security signals for this media. Fields without a backend endpoint render as pending.'}
      </p>
      <dl className="media-panel-security-grid">
        {FIELDS.map((f) => {
          let display;
          let isRestricted = false;
          if (f.restricted && !isAdmin) {
            // Render contrast-safe placeholder instead of the value.
            display = (
              <span className="media-panel-security-locked-placeholder" aria-live="polite">
                <span aria-hidden="true">{LOCK_ICON}</span>{' '}
                {isHt ? LOCK_LABEL_HT : LOCK_LABEL_EN}
              </span>
            );
            isRestricted = true;
          } else if (f.backendPending) {
            display = (
              <span className="media-panel-pending" title={isHt ? 'Tann yon endpoint backend' : 'Awaiting backend endpoint'}>
                <i className="fas fa-hourglass-half" />
                {isHt ? 'Ap tann backend' : 'Backend pending'}
              </span>
            );
          } else if (f.list) {
            display = <span className="media-panel-pending">—</span>;
          } else {
            const v = f.derive ? f.derive(item) : (security?.[f.key]);
            display = v != null && v !== '' ? <span>{String(v)}</span> : <span className="media-panel-pending">—</span>;
          }
          return (
            <div
              key={f.key}
              className={`media-panel-security-row ${isRestricted ? 'media-panel-security-row-restricted' : ''}`}
              data-restricted={isRestricted ? 'true' : undefined}
            >
              <dt>
                <i className={`fas ${f.icon}`} aria-hidden="true" />
                {isHt ? f.labelHt : f.labelEn}
                {isRestricted && (
                  <span
                    className="media-panel-security-lock-inline"
                    aria-label={isHt ? 'Rezève pou admin' : LOCK_LABEL_EN}
                    title={isHt ? 'Rezève pou admin' : LOCK_LABEL_EN}
                  >
                    <i className="fas fa-lock" aria-hidden="true" />
                  </span>
                )}
              </dt>
              <dd>{display}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
