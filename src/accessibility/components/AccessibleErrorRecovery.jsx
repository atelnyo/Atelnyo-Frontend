/**
 * src/accessibility/components/AccessibleErrorRecovery.jsx
 *
 * Accessible error recovery component.
 *
 * Features:
 *   - Explains what happened
 *   - Whether work was saved
 *   - What the user can do next
 *   - Retry button with accessible label
 *   - role="alert" for screen reader announcement
 *   - Keyboard accessible actions
 *
 * Usage:
 *   <AccessibleErrorRecovery
 *     title="Could not load the lesson"
 *     description="Your previous saved progress is still available."
 *     actions={[
 *       { label: 'Try again', onClick: handleRetry, variant: 'primary' },
 *       { label: 'Go back', onClick: handleBack },
 *     ]}
 *     lang="en"
 *   />
 */
import React from 'react';

export default function AccessibleErrorRecovery({
  title,
  description,
  actions = [],
  lang = 'ht',
  icon = 'fa-triangle-exclamation',
  className = '',
  saved = false,
}) {
  const isHt = lang === 'ht';

  return (
    <div
      className={`a11y-error-recovery ${className}`}
      role="alert"
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      {/* Error icon */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--state-error-light, rgba(239,68,68,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '4px',
        }}
      >
        <i className={`fas ${icon}`} aria-hidden="true" style={{ color: 'var(--state-error, #ef4444)', fontSize: '1.2rem' }} />
      </div>

      {/* Title */}
      <h3 style={{
        margin: 0,
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--text-primary, #1e293b)',
      }}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p style={{
          margin: 0,
          fontSize: '0.9rem',
          lineHeight: 1.5,
          color: 'var(--text-secondary, #64748b)',
          maxWidth: '400px',
        }}>
          {description}
        </p>
      )}

      {/* Save status */}
      {saved && (
        <p style={{
          margin: 0,
          fontSize: '0.82rem',
          color: 'var(--state-success, #10b981)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <i className="fas fa-check-circle" aria-hidden="true" />
          {isHt ? 'Pwogrè ou anrejistre.' : 'Your progress was saved.'}
        </p>
      )}

      {/* Recovery actions */}
      {actions.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: '8px',
        }}>
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius-full, 999px)',
                border: action.variant === 'primary' ? 'none' : '1px solid var(--border-color, #e2e8f0)',
                background: action.variant === 'primary'
                  ? 'var(--color-primary, #d81b60)'
                  : 'transparent',
                color: action.variant === 'primary'
                  ? 'var(--text-on-primary, #fff)'
                  : 'var(--text-primary, #1e293b)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '44px',
                fontFamily: 'inherit',
                transition: 'opacity 0.15s',
                opacity: action.disabled ? 0.5 : 1,
              }}
            >
              {action.icon && <i className={`fas ${action.icon}`} aria-hidden="true" style={{ marginRight: '6px' }} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
