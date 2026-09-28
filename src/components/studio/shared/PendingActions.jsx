/**
 * src/components/studio/shared/PendingActions.jsx
 *
 * Pending Actions card — shows what needs the creator's attention, using
 * REAL backend fields only:
 *   • Products: draft = is_active === false (the actual publish flag).
 *   • Courses: there is NO draft state on the Course model (saving IS
 *     publishing), so courses can never be "pending" — nothing is shown
 *     for them rather than a fake count.
 *
 * Returns null when there are no pending items.
 *
 * Extracted from CreatorStudio.jsx during Etap 1 refactor.
 */
import React from 'react';
import styles from './shared.module.css';

export default function PendingActions({ lang, courses, products }) {
  const isHt = lang === 'ht';
  // Only products have a real draft state (is_active). Courses have no
  // draft/publish flag on the backend, so they cannot be pending.
  const draftProducts = Array.isArray(products)
    ? products.filter((p) => p.is_active === false)
    : [];

  if (draftProducts.length === 0) {
    return null;
  }

  return (
    <div className={styles.pendingActions}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-clock" aria-hidden="true" />
        {' '}
        {isHt ? 'Aksyon annatant' : 'Pending Actions'}
      </h3>
      <div className={styles.pendingList}>
        {draftProducts.length > 0 && (
          <div className={styles.pendingItem}>
            <i className="fas fa-cube" aria-hidden="true" />
            <span>
              <strong>{draftProducts.length}</strong>{' '}
              {isHt ? 'pwodwi nan bouyon — pibliye yo lè yo pare' : 'draft products — publish when ready'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
