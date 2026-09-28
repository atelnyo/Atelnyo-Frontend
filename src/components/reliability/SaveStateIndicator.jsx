/**
 * SaveStateIndicator — Phase 12 Reliability UX
 *
 * Shows meaningful save state to the user:
 * - "Saving..." (syncing to server)
 * - "Saved" (synced to server)
 * - "Saved on this device" (local only, not synced)
 * - "Save failed" (with retry option)
 * - "Syncing..." (processing offline queue)
 *
 * Never claims "Saved" when only local persistence occurred.
 */
import React from 'react';

const STATES = {
  idle: { icon: '', text: { en: '', ht: '' }, color: 'transparent' },
  saving: { icon: '&#8987;', text: { en: 'Saving...', ht: 'Ap sove...' }, color: '#6b7280' },
  saved: { icon: '&#10003;', text: { en: 'Saved', ht: 'Sove' }, color: '#10b981' },
  local_only: { icon: '&#128190;', text: { en: 'Saved on this device', ht: 'Sove sou aparèy sa a' }, color: '#f59e0b' },
  failed: { icon: '&#10007;', text: { en: 'Save failed', ht: 'Sove echwe' }, color: '#ef4444' },
  syncing: { icon: '&#8635;', text: { en: 'Syncing...', ht: 'Ap senkronize...' }, color: '#3b82f6' },
  conflict: { icon: '&#9888;', text: { en: 'Conflict detected', ht: 'Konfli detekte' }, color: '#f97316' },
};

const STYLES = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'inherit',
    transition: 'color 0.2s ease, background-color 0.2s ease',
    whiteSpace: 'nowrap',
  },
  icon: {
    fontSize: '14px',
    lineHeight: 1,
  },
  retryBtn: {
    background: 'none',
    border: '1px solid currentColor',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    color: 'inherit',
    fontFamily: 'inherit',
  },
};

/**
 * SaveStateIndicator
 *
 * @param {object} props
 * @param {'idle'|'saving'|'saved'|'local_only'|'failed'|'syncing'|'conflict'} props.state
 * @param {string} [props.lang='en'] - Language
 * @param {Function} [props.onRetry] - Retry callback (shown when state=failed)
 * @param {number} [props.pendingCount] - Number of pending offline operations
 * @param {string} [props.className] - Additional CSS class
 */
export default function SaveStateIndicator({
  state = 'idle',
  lang = 'en',
  onRetry = null,
  pendingCount = 0,
  className = '',
}) {
  const config = STATES[state] || STATES.idle;

  if (state === 'idle') return null;

  const text = config.text[lang] || config.text.en;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={className}
      style={{
        ...STYLES.container,
        color: config.color,
        backgroundColor: state === 'failed' ? '#fef2f2' : 'transparent',
      }}
    >
      <span
        style={STYLES.icon}
        dangerouslySetInnerHTML={{ __html: config.icon }}
        aria-hidden="true"
      />
      <span>{text}</span>
      {pendingCount > 0 && state !== 'saving' && state !== 'syncing' && (
        <span style={{ fontSize: '11px', opacity: 0.7 }}>
          ({pendingCount} {lang === 'ht' ? 'k ap tann' : 'pending'})
        </span>
      )}
      {state === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          style={STYLES.retryBtn}
          aria-label={lang === 'ht' ? 'Eseye ankò' : 'Retry save'}
        >
          {lang === 'ht' ? 'Eseye ankò' : 'Retry'}
        </button>
      )}
    </div>
  );
}
