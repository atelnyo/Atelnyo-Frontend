/**
 * MediaStatusBadge — Render-only badge component for media statuses.
 *
 * Lives in its own file (separate from MediaStatusEngine.jsx) so the
 * engine is data-only and the badge's "render" responsibility is
 * isolated. This avoids the prior default-export naming collision
 * where `import MediaStatusEngine from './MediaStatusEngine'` could
 * have returned the badge instead of the engine data.
 *
 * Reads from MediaStatusEngine.STATUS_META → single source of truth.
 */
import React from 'react';
import { getStatusMeta, isValidStatus } from './MediaStatusEngine';

export default function MediaStatusBadge({
  status,
  size = 'sm',
  lang = 'ht',
  className = '',
  showTooltip = true,
}) {
  if (!isValidStatus(status)) {
    return (
      <span
        className={`media-status-engine-badge media-status-engine-badge--unknown ${className}`}
        role="status"
        title={lang === 'ht' ? 'Estati enkoni' : 'Unknown status'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: size === 'sm' ? '2px 8px' : '4px 10px',
          borderRadius: '999px',
          fontSize: size === 'sm' ? '0.65rem' : '0.75rem',
          fontWeight: 600,
          background: 'rgba(148,163,184,0.15)',
          color: '#64748b',
        }}
      >
        <i className="fas fa-question-circle" aria-hidden="true" style={{ fontSize: size === 'sm' ? '0.55rem' : '0.65rem' }} />
        {lang === 'ht' ? 'Enkoni' : 'Unknown'}
      </span>
    );
  }

  const m = getStatusMeta(status);
  const isHt = lang === 'ht';
  const label = isHt ? m.labelHt : m.labelEn;
  const tooltip = showTooltip ? (isHt ? m.tooltipHt : m.tooltipEn) : undefined;

  return (
    <span
      className={`media-status-engine-badge media-status-engine-badge--${size} ${className}`}
      role="status"
      title={tooltip}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: '999px',
        fontSize: size === 'sm' ? '0.65rem' : '0.75rem',
        fontWeight: 600,
        background: m.bg,
        color: m.color,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <i className={`fas ${m.icon}`} aria-hidden="true" style={{ fontSize: size === 'sm' ? '0.55rem' : '0.65rem' }} />
      {label}
    </span>
  );
}
