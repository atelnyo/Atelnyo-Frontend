/**
 * src/components/studio/shared/SaveStatusIndicator.jsx
 *
 * Visual save status indicator for the Creator Studio.
 * Shows saving/saved/offline/error states with appropriate icons and colors.
 *
 * Features:
 *   - Animated spinner during save
 *   - Green checkmark on success
 *   - Yellow dot for offline
 *   - Red dot for errors
 *   - Tooltip with last saved time
 *   - Click to retry on error
 */
import React from 'react';

const STATUS_CONFIG = {
  idle: {
    icon: null,
    color: 'transparent',
    label: null,
  },
  dirty: {
    icon: 'fa-circle',
    color: '#94a3b8',
    label: null,
  },
  saving: {
    icon: 'fa-spinner fa-spin',
    color: '#3b82f6',
    label: 'Saving...',
  },
  saved: {
    icon: 'fa-check-circle',
    color: '#10b981',
    label: 'Saved',
  },
  offline: {
    icon: 'fa-wifi-slash',
    color: '#f59e0b',
    label: 'Offline',
  },
  error: {
    icon: 'fa-exclamation-circle',
    color: '#ef4444',
    label: 'Error',
  },
};

export default function SaveStatusIndicator({
  status = 'idle',
  lastSaved,
  error,
  onRetry,
  lang = 'ht',
  compact = false,
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const isHt = lang === 'ht';

  if (status === 'idle' || !config.icon) return null;

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return isHt ? 'kounye a' : 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}${isHt ? ' min' : 'm'}`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const tooltip = status === 'error'
    ? (error || (isHt ? 'Erè sove' : 'Save error'))
    : status === 'saved' && lastSaved
      ? `${isHt ? 'Dènye sove' : 'Last saved'}: ${formatTime(lastSaved)}`
      : config.label;

  return (
    <div
      className="save-status-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '2px 6px' : '4px 10px',
        borderRadius: 6,
        background: `${config.color}12`,
        color: config.color,
        fontSize: compact ? '0.68rem' : '0.75rem',
        fontWeight: 600,
        cursor: status === 'error' && onRetry ? 'pointer' : 'default',
        transition: 'all 0.2s',
        lineHeight: 1,
      }}
      title={tooltip}
      onClick={status === 'error' && onRetry ? onRetry : undefined}
      role={status === 'error' && onRetry ? 'button' : undefined}
      aria-label={tooltip}
    >
      <i className={`fas ${config.icon}`} aria-hidden="true" />
      {!compact && config.label && (
        <span>{config.label}</span>
      )}
      {!compact && status === 'saved' && lastSaved && (
        <span style={{ opacity: 0.7, fontWeight: 400 }}>
          {formatTime(lastSaved)}
        </span>
      )}
    </div>
  );
}
