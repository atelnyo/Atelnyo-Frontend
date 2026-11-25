/**
 * src/components/studio/shared/StudioSkeleton.jsx
 *
 * Layout-matched loading placeholders for the Creator Studio.
 *
 * One 48px bar is cheap to write but it costs the user a layout jump:
 * the page reflows the moment real rows arrive. Each variant copies the
 * geometry of the surface that is still loading instead:
 *
 *   list   (default) — stacked bars: stat blocks, detail panels, forms
 *   rows             — thumb + title/meta + actions: the `.listItem`
 *                      lists (courses, music, talent, portfolio, events,
 *                      jobs, contracts, proposals, wallet, communities)
 *   cards            — cover + title + meta: card grids
 *   stats            — icon + label + value: the StatCard KPI grid
 *   table            — header + N rows × `columns` cells: data tables
 *
 * Accessibility: the wrapper announces exactly one busy status, and the
 * visual placeholders are `aria-hidden`, so a screen reader hears
 * "Loading…" once instead of a wall of empty spans. Animation is turned
 * off under `prefers-reduced-motion` in the stylesheet.
 *
 * @param {number} rows    — placeholders to render (default: 4)
 * @param {string} variant — 'list' | 'rows' | 'cards' | 'table'
 * @param {number} columns — cells per row, table variant only (max 8)
 * @param {string} label   — announced status text (default: Loading…)
 */
import React from 'react';
import styles from './shared.module.css';

const VARIANTS = ['list', 'rows', 'cards', 'stats', 'table'];

const shape = (extra) => `${styles.skeletonBlock}${extra ? ` ${extra}` : ''}`;

export default function StudioSkeleton({
  rows = 4,
  variant = 'list',
  columns = 4,
  label = 'Loading…',
}) {
  const kind = VARIANTS.includes(variant) ? variant : 'list';
  const count = Math.max(1, Number(rows) || 1);
  const cols = Math.min(8, Math.max(1, Number(columns) || 1));
  const placeholders = Array.from({ length: count });

  return (
    <div
      className={kind === 'table' ? styles.skeletonTableWrap : styles.skeletonList}
      role="status"
      aria-busy="true"
    >
      <span className={styles.srOnly}>{label}</span>

      {kind === 'list' && placeholders.map((_, i) => (
        <div key={i} className={styles.skeletonRow} aria-hidden="true" />
      ))}

      {kind === 'rows' && placeholders.map((_, i) => (
        <div key={i} className={styles.skeletonRowItem} aria-hidden="true">
          <span className={shape(styles.skeletonRowThumb)} />
          <span className={styles.skeletonRowBody}>
            <span className={shape(styles.skeletonRowTitle)} />
            <span className={shape(styles.skeletonRowMeta)} />
          </span>
          <span className={styles.skeletonRowActions}>
            <span className={shape(styles.skeletonRowAction)} />
            <span className={shape(styles.skeletonRowAction)} />
          </span>
        </div>
      ))}

      {kind === 'cards' && (
        <span className={styles.skeletonCards}>
          {placeholders.map((_, i) => (
            <span key={i} className={styles.skeletonCard} aria-hidden="true">
              <span className={shape(styles.skeletonCardCover)} />
              <span className={shape(styles.skeletonCardTitle)} />
              <span className={shape(styles.skeletonCardLine)} />
              <span className={shape(styles.skeletonCardShort)} />
            </span>
          ))}
        </span>
      )}

      {kind === 'stats' && (
        <span className={styles.skeletonStats}>
          {placeholders.map((_, i) => (
            <span key={i} className={styles.skeletonStatCard} aria-hidden="true">
              <span className={shape(styles.skeletonStatIcon)} />
              <span className={styles.skeletonStatBody}>
                <span className={shape(styles.skeletonStatLabel)} />
                <span className={shape(styles.skeletonStatValue)} />
              </span>
            </span>
          ))}
        </span>
      )}

      {kind === 'table' && (
        <table className={styles.skeletonTable}>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, c) => (
                <th key={c}>
                  <span className={shape(styles.skeletonCellBar)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {placeholders.map((_, r) => (
              <tr key={r} aria-hidden="true">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <span className={shape(styles.skeletonCellBar)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
