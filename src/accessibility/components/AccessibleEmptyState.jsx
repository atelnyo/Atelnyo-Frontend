/**
 * src/accessibility/components/AccessibleEmptyState.jsx
 *
 * Accessible empty state component.
 *
 * Features:
 *   - Explains what is empty
 *   - Explains why it matters
 *   - Provides actionable next step
 *   - Uses proper heading hierarchy
 *   - Includes aria-label on the section
 *
 * Usage:
 *   <AccessibleEmptyState
 *     icon="fa-folder-open"
 *     title="No lessons yet"
 *     description="Add your first lesson to begin building this module."
 *     actionLabel="Add lesson"
 *     onAction={handleAddLesson}
 *     lang="en"
 *   />
 */
import React from 'react';

export default function AccessibleEmptyState({
  icon = 'fa-inbox',
  title,
  description,
  actionLabel,
  onAction,
  lang = 'en',
  className = '',
}) {
  return (
    <div
      className={`a11y-empty-state ${className}`}
      role="status"
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '60px 24px',
        textAlign: 'center',
        color: 'var(--text-secondary, #64748b)',
      }}
    >
      {icon && (
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--color-primary-light, rgba(216,27,96,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          color: 'var(--color-primary, #d81b60)',
          marginBottom: '8px',
        }}>
          <i className={`fas ${icon}`} aria-hidden="true" />
        </div>
      )}
      <h3 style={{
        margin: 0,
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--text-primary, #1e293b)',
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          margin: 0,
          fontSize: '0.9rem',
          lineHeight: 1.5,
          maxWidth: '400px',
        }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: '10px 24px',
            borderRadius: 'var(--radius-full, 999px)',
            border: 'none',
            background: 'var(--color-primary, #d81b60)',
            color: 'var(--text-on-primary, #fff)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '44px',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
