/**
 * src/components/studio/shared/EmptyState.jsx
 *
 * Reusable empty state — shown when a list has no items.
 * Displays an icon, title, optional hint text, and optional CTA button.
 *
 * Extracted from CreatorStudio.jsx during Etap 1 refactor.
 */
import React from 'react';
import styles from './shared.module.css';

export default function EmptyState({ icon, title, hint, ctaLabel, onCta, action }) {
  return (
    <div className={styles.emptyState} role="status">
      <i className={`fas ${icon} ${styles.emptyIcon}`} aria-hidden="true" />
      <h3 className={styles.emptyTitle}>{title}</h3>
      {hint && <p className={styles.emptyHint}>{hint}</p>}
      {action || (ctaLabel && onCta && (
        <button type="button" className={styles.emptyCta} onClick={onCta}>
          {ctaLabel}
        </button>
      ))}
    </div>
  );
}
