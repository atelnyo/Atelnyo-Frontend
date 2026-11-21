/**
 * src/components/studio/shared/DraftRecoveryBanner.jsx
 *
 * Banner shown when a local draft is detected (crash/refresh recovery).
 * Allows the user to recover their unsaved work or discard it.
 *
 * The prompt deliberately stays visible until the user chooses: hiding it
 * after a timer would leave the draft in storage while an autosave guard
 * silently blocks saving, which is worse than a persistent banner.
 */
import React from 'react';

export default function DraftRecoveryBanner({
  onRecover,
  onDiscard,
  timestamp,
  lang = 'en',
}) {
  const isHt = lang === 'ht';

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const displayTime = formatTime(timestamp);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 8,
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.2)',
        fontSize: '0.82rem',
        lineHeight: 1.4,
      }}
      role="alert"
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flex: '1 1 260px' }}>
        <i className="fas fa-history" style={{ color: '#3b82f6', fontSize: '1rem' }} aria-hidden="true" />
        <span>
          {isHt ? (
            <>
              Gen yon bouyon ki pa sove{displayTime ? ` (${displayTime})` : ''}.
              {' '}
              <strong>Ou vle retabli li?</strong>
            </>
          ) : (
            <>
              An unsaved draft was found{displayTime ? ` (${displayTime})` : ''}.
              {' '}
              <strong>Would you like to recover it?</strong>
            </>
          )}
        </span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRecover}
          style={{
            minHeight: 36,
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #3b82f6',
            background: '#3b82f6',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          {isHt ? 'Retabli' : 'Recover'}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          style={{
            minHeight: 36,
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontFamily: 'inherit',
          }}
        >
          {isHt ? 'Efase bouyon' : 'Discard draft'}
        </button>
      </div>
    </div>
  );
}
