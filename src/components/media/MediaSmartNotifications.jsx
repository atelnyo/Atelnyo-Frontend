/**
 * MediaSmartNotifications — Clickable notification center for media events.
 *
 * Notifications: Media Ready, Validation Success/Failed, Broken Link,
 * Provider Offline, Replacement Needed, Visibility Changed,
 * Published, Referenced, Unused, Archive Suggested.
 *
 * All notifications are clickable and navigate to the relevant media page.
 */
import React, { useState, useCallback } from 'react';

const NOTIFICATION_ICONS = {
  media_ready: 'fa-check-circle',
  validation_success: 'fa-check',
  validation_failed: 'fa-times-circle',
  media_broken: 'fa-exclamation-triangle',
  media_recovered: 'fa-heartbeat',
  provider_offline: 'fa-cloud-off',
  replacement_needed: 'fa-exchange-alt',
  visibility_changed: 'fa-eye',
  published: 'fa-globe',
  referenced: 'fa-link',
  unused: 'fa-inbox',
  archive_suggested: 'fa-archive',
  media_grace_period: 'fa-hourglass-half',
  media_smart_replace: 'fa-sync',
  reference_status_active: 'fa-thumbs-up',
  reference_status_broken: 'fa-exclamation-circle',
  reference_status_archived: 'fa-archive',
  default: 'fa-bell',
};

const NOTIFICATION_COLORS = {
  media_ready: { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  validation_success: { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  validation_failed: { color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.08))' },
  media_broken: { color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.08))' },
  media_recovered: { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  provider_offline: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  replacement_needed: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  visibility_changed: { color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.08))' },
  published: { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  referenced: { color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))' },
  unused: { color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))' },
  archive_suggested: { color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))' },
  media_grace_period: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  media_smart_replace: { color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))' },
  reference_status_active: { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  reference_status_broken: { color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.08))' },
  reference_status_archived: { color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))' },
  default: { color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.08))' },
};

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export default function MediaSmartNotifications({
  notifications = [],
  onNotificationClick,
  onDismiss,
  onDismissAll,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = useCallback((notif) => {
    if (onNotificationClick) onNotificationClick(notif);
    if (onDismiss) onDismiss(notif.id || notif._id);
  }, [onNotificationClick, onDismiss]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={`smart-notif-container ${className}`}>
      {/* Bell Button */}
      <button
        type="button"
        className="smart-notif-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isHt ? 'Notifikasyon' : 'Notifications'}
        aria-expanded={isOpen}
      >
        <i className="fas fa-bell" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="smart-notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="smart-notif-dropdown">
          {/* Header */}
          <div className="smart-notif-header">
            <h3 className="smart-notif-title">
              <i className="fas fa-bell" aria-hidden="true" />
              {isHt ? 'Notifikasyon' : 'Notifications'}
            </h3>
            <div className="smart-notif-header-actions">
              <span className="smart-notif-count">
                {unreadCount} {isHt ? 'nouvo' : 'new'}
              </span>
              {onDismissAll && notifications.length > 0 && (
                <button type="button" className="smart-notif-dismiss-all" onClick={onDismissAll}>
                  <i className="fas fa-check-double" />
                  {isHt ? 'Make tout li' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="smart-notif-list">
            {notifications.length === 0 ? (
              <div className="smart-notif-empty">
                <i className="fas fa-bell-slash" />
                <p>{isHt ? 'Pa gen notifikasyon' : 'No notifications'}</p>
              </div>
            ) : (
              notifications.map((notif, i) => {
                const type = notif.event_type || notif.type || 'default';
                const icon = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
                const nc = NOTIFICATION_COLORS[type] || NOTIFICATION_COLORS.default;
                const isRead = notif.read || false;
                const title = notif.title || notif.metadata?.message || '';
                const meta = notif.metadata || {};
                const url = meta.url || '';
                const timestamp = notif.created_at || notif.timestamp || '';

                return (
                  <button
                    key={notif.id || notif._id || i}
                    type="button"
                    className={`smart-notif-item ${!isRead ? 'smart-notif-unread' : ''}`}
                    onClick={() => handleNotificationClick(notif)}
                    style={{ '--notif-color': nc.color }}
                  >
                    <div className="smart-notif-icon" style={{ background: nc.bg, color: nc.color }}>
                      <i className={`fas ${icon}`} />
                    </div>
                    <div className="smart-notif-body">
                      <div className="smart-notif-msg">
                        {title.slice(0, 120)}
                      </div>
                      <div className="smart-notif-meta">
                        <span className="smart-notif-type">{type.replace(/_/g, ' ')}</span>
                        {timestamp && (
                          <span className="smart-notif-time">{fmtTime(timestamp)}</span>
                        )}
                      </div>
                      {url && (
                        <div className="smart-notif-url">
                          <code>{url.slice(0, 60)}...</code>
                        </div>
                      )}
                    </div>
                    {onDismiss && (
                      <button
                        type="button"
                        className="smart-notif-dismiss"
                        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id || notif._id); }}
                        title={isHt ? 'Fèmen' : 'Dismiss'}
                      >
                        <i className="fas fa-times" />
                      </button>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="smart-notif-footer">
              <span className="smart-notif-footer-text">
                {notifications.length} {isHt ? 'total' : 'total'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
