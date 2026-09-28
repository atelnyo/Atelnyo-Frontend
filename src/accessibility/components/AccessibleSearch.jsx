/**
 * src/accessibility/components/AccessibleSearch.jsx
 *
 * Accessible search component.
 *
 * Features:
 *   - Clear label for the search input
 *   - Live result count (aria-live)
 *   - Loading state announced to screen readers
 *   - No-results state
 *   - Error state
 *   - Keyboard accessible
 *   - Clear button with accessible label
 *
 * Usage:
 *   <AccessibleSearch
 *     value={query}
 *     onChange={setQuery}
 *     placeholder="Search courses..."
 *     resultCount={results.length}
 *     isLoading={searching}
 *     lang="en"
 *   />
 */
import React, { useRef, useId } from 'react';

export default function AccessibleSearch({
  value,
  onChange,
  placeholder,
  resultCount,
  isLoading = false,
  error = null,
  lang = 'en',
  className = '',
  onClear,
  autoFocus = false,
  inputProps = {},
}) {
  const inputId = useId?.() || `a11y-search-${Math.random().toString(36).slice(2, 8)}`;
  const statusId = `${inputId}-status`;
  const inputRef = useRef(null);

  const isHt = lang === 'ht';

  return (
    <div className={`a11y-search ${className}`} style={{ position: 'relative' }}>
      {/* Label (visually hidden but accessible) */}
      <label htmlFor={inputId} className="sr-only">
        {placeholder || (isHt ? 'Chèche' : 'Search')}
      </label>

      <div style={{ position: 'relative' }}>
        {/* Search icon */}
        <i
          className="fas fa-search"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary, #999)',
            fontSize: '0.85rem',
            pointerEvents: 'none',
          }}
        />

        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="searchbox"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-describedby={statusId}
          aria-busy={isLoading}
          style={{
            width: '100%',
            padding: '12px 40px 12px 40px',
            border: 'var(--input-border, 2px solid var(--color-primary-light, #fce4ec))',
            borderRadius: 'var(--input-radius, 999px)',
            background: 'var(--input-bg, var(--surface-input, #fce4ec))',
            color: 'var(--input-text, var(--text-primary, #1a1a2e))',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'var(--input-transition)',
            minHeight: '44px',
            boxSizing: 'border-box',
          }}
          {...inputProps}
        />

        {/* Clear button */}
        {value && onClear && (
          <button
            type="button"
            onClick={() => { onClear(); inputRef.current?.focus(); }}
            aria-label={isHt ? 'Efase chèch' : 'Clear search'}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #666)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '50%',
              minHeight: '32px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
            }}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Live status region */}
      <div
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading
          ? (isHt ? 'Ap chèche...' : 'Searching...')
          : error
            ? (isHt ? `Erè: ${error}` : `Error: ${error}`)
            : resultCount != null
              ? (isHt
                  ? (resultCount === 0 ? 'Pa gen rezilta' : `${resultCount} rezilta`)
                  : (resultCount === 0 ? 'No results found' : `${resultCount} result${resultCount !== 1 ? 's' : ''}`))
              : ''}
      </div>

      {/* Visible result count (optional) */}
      {resultCount != null && !isLoading && (
        <div
          aria-hidden="true"
          style={{
            padding: '6px 4px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary, #666)',
            fontWeight: 500,
          }}
        >
          {isHt
            ? (resultCount === 0 ? 'Pa gen rezilta' : `${resultCount} rezilta`)
            : (resultCount === 0 ? 'No results' : `${resultCount} result${resultCount !== 1 ? 's' : ''}`)}
        </div>
      )}
    </div>
  );
}
