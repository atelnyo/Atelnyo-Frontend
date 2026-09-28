/**
 * src/components/studio/shared/StatCard.jsx
 *
 * Reusable stat card — displays a single KPI metric with icon, value,
 * optional formatter, and optional subtitle.
 *
 * If an onClick handler is provided, the card renders as a <button> with
 * hover elevation; otherwise it renders as a plain <div>.
 *
 * Extracted from CreatorStudio.jsx during Etap 1 refactor.
 */
import React from 'react';
import { classNames, fmtCount } from './helpers';
import styles from './shared.module.css';

export default function StatCard({
  icon,
  label,
  value,
  accent = 'default',
  formatter,
  subtitle,
  onClick,
}) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={classNames(
        styles.statCard,
        onClick && styles.clickable,
      )}
      data-accent={accent}
    >
      <div className={styles.statIcon} aria-hidden="true">
        <i className={`fas ${icon}`} />
      </div>
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>
          {formatter ? formatter(value) : fmtCount(value)}
        </div>
        {subtitle && <div className={styles.statSubtitle}>{subtitle}</div>}
      </div>
    </Tag>
  );
}
