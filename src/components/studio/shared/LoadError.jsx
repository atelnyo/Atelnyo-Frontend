/**
 * src/components/studio/shared/LoadError.jsx
 *
 * The honest failure state for a Studio fetch.
 *
 * ``useFetch`` distinguishes "loaded nothing" from "could not load", but
 * a section that ignores ``error`` renders EmptyState ("No projects yet")
 * for a failed request: it blames the creator's catalogue for a network
 * or server failure and offers no way out. This card puts the truth and
 * the retry in one place:
 *
 *   • ``role="alert"`` so an assistive tech announces it immediately
 *   • the HTTP status and backend detail when they exist — a failure is
 *     never swallowed into a generic sentence
 *   • one Retry button wired to ``useFetch``'s ``refetch()``
 *
 * Copy defaults to English; pass ``title`` / ``hint`` for a specific
 * surface, and ``lang="ht"`` for the Creole retry label.
 *
 * @param {string}   title      — what failed (default: this section)
 * @param {string}   hint       — one line telling the creator what to do
 * @param {Error}    error      — the error from useFetch
 * @param {Function} onRetry    — refetch(); the button is hidden without it
 * @param {string}   retryLabel — overrides "Try again"
 * @param {string}   lang       — 'ht' switches the default labels
 */
import React from 'react';
import styles from './shared.module.css';

function describe(error) {
  const response = error?.response;
  const body = response?.data;
  const detail = typeof body === 'string'
    ? body
    : (body?.detail || body?.error || '');
  const message = error?.message && error.message !== 'Network Error'
    ? error.message
    : '';
  return {
    status: response?.status,
    detail: String(detail || message || '').trim(),
  };
}

export default function LoadError({
  title,
  hint,
  error,
  onRetry,
  retryLabel,
  lang = 'en',
}) {
  const isHt = lang === 'ht';
  const { status, detail } = describe(error);
  const headline = title || (isHt ? 'Pa t kapab chaje seksyon sa a' : 'Could not load this section');
  const subline = hint || (isHt
    ? 'Verifye koneksyon w epi eseye ankò. Anyen ou te ekri pa pèdi.'
    : 'Check your connection and try again. Nothing you saved was lost.');
  const retry = retryLabel || (isHt ? 'Eseye ankò' : 'Try again');

  return (
    <div className={styles.loadError} role="alert">
      <span className={styles.loadErrorIcon} aria-hidden="true">
        <i className="fas fa-triangle-exclamation" />
      </span>
      <h3 className={styles.loadErrorTitle}>{headline}</h3>
      <p className={styles.loadErrorHint}>{subline}</p>
      {(status || detail) && (
        <p className={styles.loadErrorDetail}>
          {status && <span className={styles.loadErrorStatus}>HTTP {status}</span>}
          {detail && <span>{detail}</span>}
        </p>
      )}
      {onRetry && (
        <button type="button" className={styles.loadErrorRetry} onClick={onRetry}>
          <i className="fas fa-rotate" aria-hidden="true" /> {retry}
        </button>
      )}
    </div>
  );
}
