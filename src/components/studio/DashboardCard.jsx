/**
 * DashboardCard — Single grid card for the My Media Dashboard.
 *
 * Renders:
 *   - Icon (FontAwesome)
 *   - Title (i18n via props or via langBackendStub.t)
 *   - Value (number / string / node)
 *   - Subtitle (optional, supporting copy)
 *   - BackendPendingChip if the data field is not yet BE-backed
 *
 * Used by:
 *   - MyMediaDashboard (7 cards in the Overview row).
 *   - WorkflowProgressCard (the compact linear progress variant).
 *   - FavoriteCollectionsStrip (each collection card uses this atom).
 */
import React from 'react';
import BackendPendingChip from '../media/BackendPendingChip';

export default function DashboardCard({
  icon = 'fa-circle',
  title,
  value,
  subtitle = null,
  backendPending = false,
  endpoint = null,
  lang = 'ht',
  onClick = null,
  size = 'md', // 'sm' | 'md' | 'lg'
  tone = 'neutral', // 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}) {
  const handleClick = onClick ? onClick : undefined;
  const role = onClick ? 'button' : undefined;
  const tabIndex = onClick ? 0 : undefined;
  const interactiveProps = onClick
    ? {
        onClick: handleClick,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
        role,
        tabIndex,
      }
    : {};

  return (
    <div
      className={`dashboard-card dashboard-card-${size} dashboard-card-${tone}`}
      {...interactiveProps}
    >
      <div className="dashboard-card-icon" aria-hidden="true">
        <i className={`fas ${icon}`} />
      </div>
      <div className="dashboard-card-body">
        <div className="dashboard-card-title-row">
          <span className="dashboard-card-title">{title}</span>
          {backendPending && (
            <BackendPendingChip lang={lang} endpoint={endpoint} inline />
          )}
        </div>
        <div className="dashboard-card-value">
          {value !== null && value !== undefined ? value : '—'}
        </div>
        {subtitle && (
          <div className="dashboard-card-subtitle">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
