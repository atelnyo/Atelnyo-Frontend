/**
 * src/components/SearchBar.jsx
 *
 * Search bar for the legacy commerce tab. Filters courses
 * locally by title/description on input change.
 */
import React, { useRef, useEffect } from 'react';

function SearchBar({ lang, translations, onSearch }) {
  const inputRef = useRef(null);
  const t = translations?.[lang] || translations?.ht || {};

  const placeholder = t.search_placeholder
    || (lang === 'ht' ? 'Chèche kou yo...' : 'Search courses...');

  // Escape to blur
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && inputRef.current) {
        inputRef.current.blur();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div className="dvr-searchbar">
      <div className="dvr-searchbar__input-wrapper">
        <i className="fas fa-search dvr-searchbar__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="dvr-searchbar__input"
          placeholder={placeholder}
          onChange={(e) => onSearch && onSearch(e.target.value)}
          aria-label={placeholder}
        />
      </div>
    </div>
  );
}

export default SearchBar;
