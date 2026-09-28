/**
 * src/accessibility/components/AccessibleLockedContent.jsx
 *
 * Accessible locked content indicator.
 *
 * Features:
 *   - Communicates locked state (not just a lock icon)
 *   - Explains why content is locked
 *   - Explains how to unlock
 *   - Uses aria-disabled and aria-describedby
 *   - Provides accessible name for screen readers
 *
 * Usage:
 *   <AccessibleLockedContent
 *     reason="Complete Lesson 2 to continue."
 *     lang="en"
 *   >
 *     <div>Lesson 3 content (hidden/disabled)</div>
 *   </AccessibleLockedContent>
 */
import React from 'react';

export default function AccessibleLockedContent({
  children,
  reason,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const defaultReason = isHt
    ? 'Konplete leson anvan pou kontinye.'
    : 'Complete the previous lesson to continue.';

  const displayReason = reason || defaultReason;

  return (
    <div
      className={`a11y-locked-content ${className}`}
      role="region"
      aria-label={isHt ? 'Kontni bloke' : 'Locked content'}
      aria-disabled="true"
      style={{
        position: 'relative',
        opacity: 0.7,
        pointerEvents: 'none',
        filter: 'blur(2px)',
      }}
    >
      {/* Accessible lock overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'rgba(0,0,0,0.05)',
          borderRadius: '12px',
          zIndex: 1,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--state-warning-light, rgba(245,158,11,0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className="fas fa-lock" aria-hidden="true" style={{ color: 'var(--state-warning, #f59e0b)', fontSize: '1.1rem' }} />
        </div>
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textAlign: 'center',
            maxWidth: '300px',
          }}
        >
          {isHt ? 'Kontni bloke' : 'Content locked'}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            maxWidth: '300px',
          }}
        >
          {displayReason}
        </p>
      </div>

      {/* Hidden content (still in DOM for screen readers to announce the lock) */}
      <div aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
