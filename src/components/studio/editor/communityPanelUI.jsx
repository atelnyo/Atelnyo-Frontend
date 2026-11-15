/**
 * src/components/studio/editor/communityPanelUI.jsx
 *
 * Small shared kit for the founder-workspace panels. Every management
 * tab (Apèsi / Manm / Evènman / Fichye & Kou / Anons) renders the same
 * header → hint → loading/error/empty → list rhythm; keeping the
 * chrome in one place means the tabs stay visually consistent and each
 * panel file only describes its own data and actions.
 */
import React, { useEffect, useState } from 'react';
import styles from './communityEditor.module.css';

/**
 * True only for the first load of a panel. Refetches keep the previous
 * rows on screen instead of flashing the skeleton back in.
 */
export function useInitialLoading(loading) {
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!loading) setLoadedOnce(true);
  }, [loading]);

  return loading && !loadedOnce;
}

export function PanelHeader({
  icon,
  title,
  count,
  subtitle,
  refreshing = false,
  onRefresh,
  refreshLabel = 'Refresh',
  children,
}) {
  return (
    <header className={styles.panelHeader}>
      <div className={styles.panelHeading}>
        <span className={styles.panelIcon} aria-hidden="true">
          <i className={`fas ${icon}`} />
        </span>
        <div className={styles.panelHeadingText}>
          <h3 className={styles.panelTitle}>
            {title}
            {typeof count === 'number' && (
              <span className={styles.tabCount}>{count}</span>
            )}
            {refreshing && (
              <i className={`fas fa-circle-notch fa-spin ${styles.refreshing}`} aria-hidden="true" />
            )}
          </h3>
          {subtitle && <p className={styles.panelSubtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={styles.panelActions}>
        {onRefresh && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onRefresh}
            disabled={refreshing}
            title={refreshLabel}
            aria-label={refreshLabel}
          >
            <i className="fas fa-rotate" aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </header>
  );
}

export function PanelEmpty({ icon = 'fa-inbox', title, description, action }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <i className={`fas ${icon}`} />
      </span>
      <strong className={styles.emptyTitle}>{title}</strong>
      {description && <span className={styles.emptyText}>{description}</span>}
      {action}
    </div>
  );
}

export function PanelError({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className={styles.errorBar} role="alert">
      <i className="fas fa-triangle-exclamation" aria-hidden="true" />
      <span className={styles.errorText}>{message}</span>
      {onRetry && (
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          <i className="fas fa-rotate" aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

function SkLine({ w = '100%' }) {
  return <span className={styles.skLine} style={{ width: w }} aria-hidden="true" />;
}

function SkRow() {
  return (
    <div className={styles.skRow} aria-hidden="true">
      <span className={styles.skCircle} />
      <div className={styles.skLines}>
        <SkLine w="45%" />
        <SkLine w="70%" />
      </div>
      <span className={styles.skPill} />
    </div>
  );
}

/**
 * Panel-shaped placeholders — the box layout mirrors the real panel so
 * the content does not jump when the data arrives.
 *
 * variants: 'overview' | 'list' | 'form' | 'resources'
 */
export default function PanelSkeleton({ variant = 'list', rows = 3, label = 'Loading' }) {
  return (
    <div className={styles.skeleton} role="status" aria-busy="true" aria-label={label}>
      {variant === 'overview' && (
        <>
          <div className={styles.skFounder} aria-hidden="true">
            <span className={styles.skCircleLg} />
            <div className={styles.skLines}>
              <SkLine w="35%" />
              <SkLine w="55%" />
            </div>
          </div>
          <div className={styles.skTileGrid} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className={styles.skTile} />
            ))}
          </div>
          <div className={styles.skActionRow} aria-hidden="true">
            <span className={styles.skBtn} />
            <span className={styles.skBtn} />
          </div>
        </>
      )}

      {(variant === 'list' || variant === 'form' || variant === 'resources') && (
        <div className={styles.skHeader} aria-hidden="true">
          <span className={styles.skCircle} />
          <div className={styles.skLines}>
            <SkLine w="30%" />
            <SkLine w="50%" />
          </div>
          <span className={styles.skBtn} />
        </div>
      )}

      {variant === 'form' && (
        <>
          <div className={styles.skBlock} aria-hidden="true" />
          <div className={styles.skLines}>
            <SkLine w="80%" />
            <SkLine w="60%" />
          </div>
        </>
      )}

      {variant === 'resources' && (
        <>
          <div className={styles.skBlock} aria-hidden="true" />
          <div className={styles.skSectionLine}>
            <SkLine w="25%" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => <SkRow key={`a${i}`} />)}
          <div className={styles.skSectionLine}>
            <SkLine w="20%" />
          </div>
        </>
      )}

      {variant !== 'overview' && variant !== 'form' && Array.from({ length: rows }).map(
        (_, i) => <SkRow key={i} />,
      )}
    </div>
  );
}

/**
 * Long-form text that stays short in lists until the user asks for more.
 * "Wè plis" opens the full text in a contained overlay so the list does not
 * stretch and push the rest of the panel down.
 */
export function ExpandableText({
  text,
  limit = 220,
  lang = 'en',
  className,
}) {
  const [open, setOpen] = useState(false);
  const value = typeof text === 'string' ? text : '';
  const isHt = lang === 'ht';

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!value) return null;

  const canToggle = value.length > limit;
  const shown = canToggle ? `${value.slice(0, limit).trimEnd()}…` : value;

  return (
    <>
      <div className={className}>
        <span>{shown}</span>
        {canToggle && (
          <>
            {' '}
            <button
              type="button"
              className={styles.linkBtn}
              style={{ marginTop: 4 }}
              onClick={() => setOpen(true)}
            >
              {isHt ? 'Wè plis' : 'Show more'}
            </button>
          </>
        )}
      </div>
      {open && (
        <div
          className={styles.textModalOverlay}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className={styles.textModal}
            role="dialog"
            aria-modal="true"
            aria-label={isHt ? 'Tèks konplè' : 'Full text'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.textModalHead}>
              <strong>{isHt ? 'Tèks konplè' : 'Full text'}</strong>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setOpen(false)}
                aria-label={isHt ? 'Fèmen' : 'Close'}
                title={isHt ? 'Fèmen' : 'Close'}
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.textModalBody}>{value}</div>
          </div>
        </div>
      )}
    </>
  );
}
