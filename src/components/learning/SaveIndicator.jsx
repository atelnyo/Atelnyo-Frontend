/**
 * SaveIndicator — §12, §13 Save Status UI
 *
 * §12 — "The system must accurately reflect persistence state."
 *        "Do not show 'Saved' if data exists only in React memory."
 * §13 — "Save indicators should be calm. Do not interrupt the student
 *         constantly. Use subtle persistent indicators where appropriate.
 *         Important failures deserve stronger visibility."
 *
 * Renders a small, calm save status indicator. Not a toast, not a popup.
 * Persistent, minimal, informative.
 */
import React from 'react';

/**
 * SaveIndicator
 *
 * @param {Object} props
 * @param {string} props.saveState — 'idle' | 'saving' | 'saved' | 'failed' | 'local_only' | 'changed'
 * @param {string} [props.lang='ht'] — language
 * @param {string} [props.className] — additional CSS class
 */
export default function SaveIndicator({ saveState, lang = 'ht', className = '' }) {
  // §13 — Don't show anything for idle state (calm, no noise)
  if (!saveState || saveState === 'idle') return null;

  const config = {
    changed: {
      icon: 'fa-circle',
      color: 'var(--text-secondary, #6b7280)',
      text: lang === 'ht' ? 'Pa encore sove' : 'Unsaved',
      pulse: false,
    },
    saving: {
      icon: 'fa-spinner fa-spin',
      color: 'var(--pr-color-blue-500, #3b82f6)',
      text: lang === 'ht' ? 'Ap sove...' : 'Saving...',
      pulse: false,
    },
    saved: {
      icon: 'fa-check-circle',
      color: 'var(--pr-color-green-500, #22c55e)',
      text: lang === 'ht' ? 'Sove' : 'Saved',
      pulse: false,
    },
    local_only: {
      icon: 'fa-device-mobile',
      color: 'var(--pr-color-amber-500, #f59e0b)',
      text: lang === 'ht' ? 'Sove sou aparèy sa a' : 'Saved on this device',
      pulse: false,
    },
    failed: {
      icon: 'fa-exclamation-triangle',
      color: 'var(--pr-color-red-500, #ef4444)',
      text: lang === 'ht' ? 'Pa kapab sove' : 'Could not save',
      pulse: true,
    },
  };

  const c = config[saveState];
  if (!c) return null;

  return (
    <span
      className={`ls-save-indicator ${c.pulse ? 'ls-save-indicator--error' : ''} ${className}`}
      role="status"
      aria-live={saveState === 'failed' ? 'assertive' : 'polite'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: '0.75rem',
        color: c.color,
        opacity: 0.85,
        transition: 'opacity 0.3s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <i className={`fas ${c.icon}`} aria-hidden="true" style={{ fontSize: '0.65rem' }} />
      <span>{c.text}</span>
    </span>
  );
}
