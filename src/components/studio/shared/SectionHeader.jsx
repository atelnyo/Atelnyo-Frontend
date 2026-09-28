/**
 * src/components/studio/shared/SectionHeader.jsx
 *
 * Section header for Creator Studio section pages — icon + title +
 * optional HelpTip ("?" chip that expands a bilingual explanation) +
 * optional FieldTip (always-visible how-to line) + an action button
 * (usually "New …").
 *
 * Composes the shared HelpTip/FieldTip primitives (from the modals
 * shared system) so the section PAGES teach creators what each
 * workspace is for — not just the creation modals.
 */
import React from 'react';
import { HelpTip, FieldTip } from '../modals/shared';
import styles from './shared.module.css';

export default function SectionHeader({
  icon,
  title,
  help,
  tip,
  lang = 'ht',
  action,
}) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionHeading}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>
            {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
            {title}
          </h2>
          {help && <HelpTip help={help} lang={lang} />}
        </div>
        {tip && <FieldTip>{tip}</FieldTip>}
      </div>
      {action && <div className={styles.sectionActions}>{action}</div>}
    </div>
  );
}
