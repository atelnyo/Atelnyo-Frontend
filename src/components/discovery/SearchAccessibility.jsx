/**
 * src/components/discovery/SearchAccessibility.jsx
 *
 * Accessibility helpers for search:
 *   - Live region announcements for screen readers
 *   - Keyboard shortcut for search focus
 *   - Accessible zero-result state
 *   - Result count announcements
 *
 * Phase 13 + Phase 10 integration.
 */
import React, { useEffect, useRef, useCallback } from 'react';

/**
 * LiveRegion — announces dynamic content changes to screen readers.
 * Uses aria-live="polite" so it doesn't interrupt the user.
 */
export function SearchLiveRegion({ message }) {
  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  );
}

/**
 * SearchResultAnnouncer — announces search results to screen readers.
 * Example: "12 courses found for 'python'."
 */
export function SearchResultAnnouncer({ query, total, lang = 'en', loading }) {
  const isHt = lang === 'ht';

  let message = '';
  if (loading) {
    message = isHt ? 'Ap chèche...' : 'Searching...';
  } else if (query && total !== undefined) {
    const itemWord = isHt ? 'kou' : total === 1 ? 'result' : 'results';
    if (total === 0) {
      message = isHt
        ? `Pa gen rezilta pou "${query}".`
        : `No results found for "${query}".`;
    } else {
      message = isHt
        ? `${total} ${itemWord} jwenn pou "${query}".`
        : `${total} ${itemWord} found for "${query}".`;
    }
  }

  return <SearchLiveRegion message={message} />;
}

/**
 * AccessibleZeroResults — zero-result state with helpful suggestions.
 * Includes aria-live announcements and accessible suggestion buttons.
 */
export function AccessibleZeroResults({ query, suggestions = [], onSelectSuggestion, lang = 'en' }) {
  const isHt = lang === 'ht';

  return (
    <div className="disc-zero-results" role="region" aria-label={isHt ? 'Pa gen rezilta' : 'No results'}>
      <div className="disc-zero-icon">
        <i className="fas fa-search" aria-hidden="true" />
      </div>
      <h3 className="disc-zero-title">
        {isHt
          ? `Pa gen rezilta pou "${query}"`
          : `No results found for "${query}"`}
      </h3>
      <p className="disc-zero-hint">
        {isHt
          ? 'Eseye yon lòt tèm, verifye pou egriy, oswa eksplore kategori yo.'
          : 'Try a different term, check spelling, or browse categories.'}
      </p>

      {suggestions.length > 0 && (
        <div className="disc-zero-suggestions" role="group" aria-label={isHt ? 'Sijesyon' : 'Suggestions'}>
          <p className="disc-zero-suggestion-label">
            {isHt ? 'Eseye:' : 'Try:'}
          </p>
          <div className="disc-zero-suggestion-list">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                className="disc-zero-suggestion-btn"
                onClick={() => onSelectSuggestion && onSelectSuggestion(s)}
                aria-label={`${isHt ? 'Eseye' : 'Try'}: ${s}`}
              >
                <i className="fas fa-search" aria-hidden="true" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * useSearchKeyboardShortcut — binds Ctrl+K or Cmd+K to focus the search input.
 */
export function useSearchKeyboardShortcut(inputRef) {
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef?.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inputRef]);
}

/**
 * useSearchDebounce — debounces search input with configurable delay.
 */
export function useSearchDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default {
  SearchLiveRegion,
  SearchResultAnnouncer,
  AccessibleZeroResults,
  useSearchKeyboardShortcut,
  useSearchDebounce,
};
