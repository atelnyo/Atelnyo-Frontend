/**
 * src/components/studio/shared/DraftRecoveryBanner.jsx
 *
 * Banner shown when a local draft is detected (crash recovery).
 * Allows the user to recover their unsaved work or discard it.
 *
 * Features:
 *   - Shows timestamp of the local draft
 *   - Recover button loads the draft
 *   - Discard button clears the draft
 *   - Auto-dismiss after 30 seconds if not interacted with
 */
import React, { useState, useEffect } from 'react';

export default function DraftRecoveryBanner({
  onRecover,
  onDiscard,
  timestamp,
  lang = 'ht',
}) {
  const isHt = lang === 'ht';
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 30s
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
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
      <i className="fas fa-history" style={{ color: '#3b82f6', fontSize: '1rem' }} aria-hidden="true" />
      <span style={{ flex: 1 }}>
        {isHt ? (
          <>
            Gen yon bouyon ki pa sove ({timestamp ? formatTime(timestamp) : 'kishin'}).
            {' '}
            <strong>Ou vle恢复 li?</strong>
          </>
        ) : (
          <>
            An unsaved draft was found ({timestamp ? formatTime(timestamp) : 'unknown time'}).
            {' '}
            <strong>Would you like to recover it?</strong>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => { onRecover?.(); setVisible(false); }}
        style={{
          padding: '5px 12px',
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
        {isHt ? '恢复' : 'Recover'}
      </button>
      <button
        type="button"
        onClick={() => { onDiscard?.(); setVisible(false); }}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontFamily: 'inherit',
        }}
      >
        {isHt ? 'Efase' : 'Discard'}
      </button>
    </div>
  );
}
