/**
 * MediaStatus — Detailed status compozan pou montre estati medya a.
 *
 * Diferan de MediaBadge: sa a montre plis detay tankou 
 * dènye tcheke, tan repons, klasmant sante.
 */
import React from 'react';

const STATUS_DETAILS = {
  healthy:  { icon: 'fa-check-circle', color: '#10b981', labelEn: 'Healthy', labelHt: 'An sante', descEn: 'Media is accessible and responding normally.', descHt: 'Medya a aksesib epi li reponn nòmalman.' },
  checking: { icon: 'fa-spinner fa-spin', color: '#38bdf8', labelEn: 'Checking', labelHt: 'Ap tcheke', descEn: 'Validation in progress...', descHt: 'Validasyon an ap fèt...' },
  warning:  { icon: 'fa-exclamation-triangle', color: '#f59e0b', labelEn: 'Warning', labelHt: 'Avètisman', descEn: 'Media is accessible but has issues (slow response, expired cert).', descHt: 'Medya a aksesib men gen pwoblèm (repons lan, resèt ekspire).' },
  broken:   { icon: 'fa-times-circle', color: '#ef4444', labelEn: 'Broken', labelHt: 'Kase', descEn: 'The URL is not accessible. The file may have been moved or deleted.', descHt: 'URL la pa aksesib. Fichye a ka te deplase oswa efase.' },
  blocked:  { icon: 'fa-ban', color: '#dc2626', labelEn: 'Blocked', labelHt: 'Bloke', descEn: 'Access denied. The provider is blocking requests.', descHt: 'Aksè refize. Provider la ap bloke demann yo.' },
  expired:  { icon: 'fa-hourglass-end', color: '#8b5cf6', labelEn: 'Expired', labelHt: 'Ekspire', descEn: 'The URL has expired. Upload the file again for a new link.', descHt: 'URL la ekspire. Mete fichye a ankò pou yon nouvo lyen.' },
  private:  { icon: 'fa-lock', color: '#64748b', labelEn: 'Private', labelHt: 'Prive', descEn: 'Media exists but is private. Change visibility to public.', descHt: 'Medya a egziste men li prive. Chanje vizibilite an piblik.' },
  unknown:  { icon: 'fa-question-circle', color: '#94a3b8', labelEn: 'Unknown', labelHt: 'Enkoni', descEn: 'Status has not been determined yet.', descHt: 'Estati a poko detèmine.' },
};

export default function MediaStatus({ status, lastChecked, responseTimeMs, lang = 'ht', size = 'md', className = '' }) {
  const meta = STATUS_DETAILS[status] || STATUS_DETAILS.unknown;
  const isHt = lang === 'ht';

  return (
    <div className={`media-status media-status--${size} ${className}`}>
      <div className="media-status-dot" style={{ background: meta.color }} />
      <div className="media-status-body">
        <span className="media-status-label" style={{ color: meta.color }}>
          <i className={`fas ${meta.icon}`} style={{ marginRight: 4 }} />
          {isHt ? meta.labelHt : meta.labelEn}
        </span>
        <span className="media-status-desc">
          {isHt ? meta.descHt : meta.descEn}
        </span>
        {(lastChecked || responseTimeMs != null) && (
          <div className="media-status-meta">
            {lastChecked && (
              <span className="media-status-meta-item">
                <i className="fas fa-clock" />
                {isHt ? 'Dènye tcheke' : 'Last checked'}: {new Date(lastChecked).toLocaleString()}
              </span>
            )}
            {responseTimeMs != null && (
              <span className="media-status-meta-item">
                <i className="fas fa-tachometer-alt" />
                {responseTimeMs}ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
