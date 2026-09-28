/**
 * ReliabilityErrorFallback — Phase 12 Reliability UX
 *
 * A reusable error fallback UI for React error boundaries.
 * Provides clear recovery actions:
 * - Retry the failed operation
 * - Reload the section
 * - Return to course/home
 *
 * Accessible: keyboard navigable, screen reader support.
 * Localized: Haitian Creole + English.
 */
import React from 'react';

const STYLES = {
  container: {
    padding: '32px 24px',
    textAlign: 'center',
    fontFamily: 'inherit',
    maxWidth: '480px',
    margin: '0 auto',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.6,
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.6,
    marginBottom: '24px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  primaryBtn: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
  secondaryBtn: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
  },
  tertiaryBtn: {
    backgroundColor: 'transparent',
    color: '#6b7280',
    textDecoration: 'underline',
  },
  details: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'left',
    maxWidth: '100%',
    overflow: 'auto',
  },
};

const MESSAGES = {
  title: {
    en: 'Something went wrong',
    ht: 'Gen yon erè ki rive',
  },
  description: {
    en: 'An error occurred while loading this section. Your data is safe.',
    ht: 'Yon erè rive pandan ke seksyon sa a tap chaje. Ou an sekirite.',
  },
  retry: {
    en: 'Try again',
    ht: 'Eseye ankò',
  },
  reload: {
    en: 'Reload',
    ht: 'Rechaje',
  },
  goHome: {
    en: 'Go home',
    ht: 'Al lakay',
  },
  details: {
    en: 'Technical details',
    ht: 'Detay teknik',
  },
};

/**
 * ReliabilityErrorFallback
 *
 * @param {object} props
 * @param {Error} [props.error] - The error that occurred
 * @param {React.ErrorInfo} [props.errorInfo] - Component stack info
 * @param {string} [props.lang='en']
 * @param {Function} [props.onRetry] - Retry callback
 * @param {Function} [props.onReload] - Reload callback
 * @param {Function} [props.onGoHome] - Navigate home callback
 * @param {boolean} [props.showDetails=false] - Show technical details
 */
export default function ReliabilityErrorFallback({
  error,
  errorInfo,
  lang = 'en',
  onRetry = null,
  onReload = null,
  onGoHome = null,
  showDetails = false,
}) {
  const t = (key) => MESSAGES[key]?.[lang] || MESSAGES[key]?.en || '';

  return (
    <div style={STYLES.container} role="alert">
      <div style={STYLES.icon} aria-hidden="true">
        &#x26A0;
      </div>

      <h2 style={STYLES.title}>{t('title')}</h2>

      <p style={STYLES.description}>{t('description')}</p>

      <div style={STYLES.actions}>
        {onRetry && (
          <button
            style={{ ...STYLES.button, ...STYLES.primaryBtn }}
            onClick={onRetry}
            autoFocus
          >
            {t('retry')}
          </button>
        )}
        {onReload && (
          <button
            style={{ ...STYLES.button, ...STYLES.secondaryBtn }}
            onClick={onReload}
          >
            {t('reload')}
          </button>
        )}
        {onGoHome && (
          <button
            style={{ ...STYLES.button, ...STYLES.tertiaryBtn }}
            onClick={onGoHome}
          >
            {t('goHome')}
          </button>
        )}
      </div>

      {showDetails && error && (
        <details style={STYLES.details}>
          <summary>{t('details')}</summary>
          <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {error.message}
            {errorInfo?.componentStack && `\n\n${errorInfo.componentStack}`}
          </pre>
        </details>
      )}
    </div>
  );
}
