/**
 * src/components/studio/StudioSectionNotFound.jsx
 *
 * Shown when a `/studio/<section>` URL names a section the Studio does not
 * have (renamed, removed, or a typo). The alternative — silently opening the
 * dashboard — makes a broken link look like it worked, so the address stays
 * visible and the way back is one click.
 */
import React from 'react';
import EmptyState from './shared/EmptyState';
import styles from './StudioSectionNotFound.module.css';

export default function StudioSectionNotFound({ section, lang = 'en', onBack }) {
  const isHt = lang === 'ht';
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>
          <i className="fas fa-circle-question" aria-hidden="true" />{' '}
          {isHt ? 'Seksyon pa jwenn' : 'Section not found'}
        </p>
        <code className={styles.path}>/studio/{section}</code>
        <EmptyState
          icon="fa-compass"
          title={isHt ? 'Seksyon sa a pa egziste' : 'This Studio section does not exist'}
          hint={isHt
            ? 'Lyen an ka fin vye. Tounen nan tablodbò a pou w kontinye travay la.'
            : 'The link may be out of date. Head back to the dashboard to keep working.'}
          ctaLabel={isHt ? 'Tounen nan tablodbò a' : 'Back to dashboard'}
          onCta={onBack}
        />
      </div>
    </div>
  );
}
