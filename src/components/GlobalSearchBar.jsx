/**
 * src/components/GlobalSearchBar.jsx
 *
 * Global Search Bar — the single, unified search interface for atelnyo.
 *
 * Features:
 *   - Autocomplete suggestions as user types (debounced 200ms)
 *   - Recent searches (from localStorage for anon, API for auth users)
 *   - Trending queries (from backend analytics)
 *   - Module type filter chips
 *   - Keyboard navigation (Arrow keys, Enter, Escape)
 *   - Ctrl+K global shortcut
 *   - Dark mode support via CSS variables
 *   - Responsive (full-width overlay on mobile)
 *   - Accessible (ARIA roles, live regions)
 *
 * Usage:
 *   <GlobalSearchBar
 *     isOpen={searchOpen}
 *     onClose={() => setSearchOpen(false)}
 *     onSearchResults={handleSearchResults}
 *     lang="en"
 *   />
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../services/api';

// Debounce helper
function useDebounce(value, delay = 200) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Module type configurations
const MODULE_TYPES = [
  { key: 'courses', label: 'Courses', icon: 'fa-graduation-cap', color: 'var(--pr-color-blue-500, #3498db)' },
  { key: 'creators', label: 'Creators', icon: 'fa-user-tie', color: 'var(--pr-color-purple-500, #9b59b6)' },
  { key: 'music', label: 'Music', icon: 'fa-music', color: 'var(--pr-color-pink-500, #e91e63)' },
  { key: 'talents', label: 'Talents', icon: 'fa-star', color: 'var(--pr-color-amber-500, #f39c12)' },
  { key: 'communities', label: 'Communities', icon: 'fa-users', color: 'var(--pr-color-emerald-500, #27ae60)' },
  { key: 'jobs', label: 'Jobs', icon: 'fa-briefcase', color: 'var(--pr-color-gray-800, #2c3e50)' },
  { key: 'portfolio', label: 'Portfolio', icon: 'fa-palette', color: 'var(--pr-color-orange-500, #e67e22)' },
  { key: 'products', label: 'Products', icon: 'fa-shopping-bag', color: 'var(--pr-color-teal-500, #1abc9c)' },
  { key: 'events', label: 'Events', icon: 'fa-calendar-alt', color: 'var(--state-error, #e74c3c)' },
];

// LocalStorage keys for anonymous search history
const LS_RECENT_SEARCHES = 'atelnyo_recent_searches';
const MAX_RECENT = 10;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(LS_RECENT_SEARCHES) || '[]');
  } catch { return []; }
}

function saveRecentSearch(query) {
  if (!query || query.length < 2) return;
  const recent = getRecentSearches().filter(r => r.query !== query);
  recent.unshift({ query, timestamp: Date.now() });
  if (recent.length > MAX_RECENT) recent.pop();
  localStorage.setItem(LS_RECENT_SEARCHES, JSON.stringify(recent));
}

function removeRecentSearch(query) {
  const recent = getRecentSearches().filter(r => r.query !== query);
  localStorage.setItem(LS_RECENT_SEARCHES, JSON.stringify(recent));
}

function clearRecentSearches() {
  localStorage.removeItem(LS_RECENT_SEARCHES);
}


const GlobalSearchBar = ({
  isOpen,
  onClose,
  onSearchResults,
  onNavigate,  // prop-injected to avoid useNavigate() crash in Cloud Shell
  lang = 'en',
  initialQuery = '',
}) => {
  const inputRef = useRef(null);
  const overlayRef = useRef(null);
  const listRef = useRef(null);

  // State
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [trending, setTrending] = useState([]);
  const [activeTypes, setActiveTypes] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(true);

  const debouncedQuery = useDebounce(query, 200);

  // Translations
  const t = {
    search_placeholder: lang === 'ht' ? 'Chèche kou, kreyatè, mizik...' : 'Search courses, creators, music...',
    recent: lang === 'ht' ? 'Rechèch Resan' : 'Recent Searches',
    trending: lang === 'ht' ? 'Tandans' : 'Trending',
    suggestions: lang === 'ht' ? 'Sijesyon' : 'Suggestions',
    clear_all: lang === 'ht' ? 'Efase Tout' : 'Clear All',
    no_results: lang === 'ht' ? 'Pa gen rezilta' : 'No results found',
    try_different: lang === 'ht' ? 'Eseye yon lòt tèm' : 'Try a different search term',
    view_all: lang === 'ht' ? 'Wè Tout' : 'View All',
    search: lang === 'ht' ? 'Chèche' : 'Search',
    close: lang === 'ht' ? 'Fèmen' : 'Close',
    filters: lang === 'ht' ? 'Filtè' : 'Filters',
    all: lang === 'ht' ? 'Tout' : 'All',
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, [isOpen]);

  // Load trending queries
  useEffect(() => {
    if (isOpen) {
      api.get('search/trending/', { params: { days: 7, limit: 8 } })
        .then(res => setTrending(res.data?.trending || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Fetch autocomplete suggestions — with AbortController to cancel
  // obsolete requests when the query changes rapidly.
  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const params = { q: debouncedQuery };
    if (activeTypes.length > 0) params.types = activeTypes.join(',');

    api.get('search/autocomplete/', { params, signal: controller.signal })
      .then(res => {
        setSuggestions(res.data?.suggestions || []);
        setShowDropdown(true);
      })
      .catch(err => {
        if (err?.name !== 'AbortError' && err?.code !== 'ERR_CANCELED')
          setSuggestions([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery, activeTypes]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIdx(-1);
  }, [suggestions]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    const items = showDropdown ? suggestions : [];
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && items[selectedIdx]) {
        handleSuggestionClick(items[selectedIdx]);
      } else if (query.length >= 2) {
        executeSearch(query);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [selectedIdx, suggestions, query, showDropdown, onClose]);

  // Execute full search
  const executeSearch = useCallback((searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) return;
    saveRecentSearch(searchQuery);
    setRecentSearches(getRecentSearches());

    const params = { q: searchQuery };
    if (activeTypes.length > 0) params.types = activeTypes.join(',');

    api.get('search/', { params })
      .then(res => {
        if (onSearchResults) onSearchResults(res.data);
        setShowDropdown(false);
      })
      .catch(() => {});
  }, [activeTypes, onSearchResults]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion) => {
    if (suggestion.url) {
      saveRecentSearch(suggestion.text);
      onClose();
      if (onNavigate) onNavigate(suggestion.url);
    } else {
      setQuery(suggestion.text);
      executeSearch(suggestion.text);
    }
  }, [onNavigate, onClose, executeSearch]);

  // Handle recent search click
  const handleRecentClick = useCallback((recentQuery) => {
    setQuery(recentQuery);
    executeSearch(recentQuery);
  }, [executeSearch]);

  // Handle trending click
  const handleTrendingClick = useCallback((trendingQuery) => {
    setQuery(trendingQuery);
    executeSearch(trendingQuery);
  }, [executeSearch]);

  // Toggle module type filter
  const toggleType = useCallback((typeKey) => {
    setActiveTypes(prev =>
      prev.includes(typeKey)
        ? prev.filter(t => t !== typeKey)
        : [...prev, typeKey]
    );
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Ctrl+K global shortcut
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        // Parent handles opening via onOpenSearch
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-suggestion-item]');
      if (items[selectedIdx]) {
        items[selectedIdx].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIdx]);

  // Group suggestions by type — MUST be before early return (React hook order!)
  const groupedSuggestions = useMemo(() => {
    const groups = {};
    suggestions.forEach(s => {
      if (!groups[s.type]) groups[s.type] = [];
      groups[s.type].push(s);
    });
    return groups;
  }, [suggestions]);

  if (!isOpen) return null;

  const totalSuggestions = suggestions.length;
  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showTrending = query.length === 0 && trending.length > 0;
  const showSuggestions = query.length >= 1 && suggestions.length > 0;
  const showEmpty = query.length >= 2 && !loading && suggestions.length === 0;

  return (
    <div className="gsb-overlay" role="dialog" aria-label={t.search}>
      <div className="gsb-container" ref={overlayRef}>
        {/* Search Input */}
        <div className="gsb-input-wrapper">
          <i className="fas fa-search gsb-input-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="gsb-input"
            placeholder={t.search_placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowDropdown(true)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            role="combobox"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-controls="gsb-suggestions-list"
            aria-activedescendant={selectedIdx >= 0 ? `gsb-suggestion-${selectedIdx}` : undefined}
          />
          {query && (
            <button
              className="gsb-clear-btn"
              onClick={() => { setQuery(''); setSuggestions([]); }}
              aria-label="Clear search"
              type="button"
            >
              <i className="fas fa-times" />
            </button>
          )}
          <button className="gsb-close-btn" onClick={onClose} type="button" aria-label={t.close}>
            <kbd>ESC</kbd>
          </button>
        </div>

        {/* Module Type Filter Chips */}
        <div className="gsb-type-chips" role="toolbar" aria-label={t.filters}>
          <button
            className={`gsb-type-chip ${activeTypes.length === 0 ? 'gsb-type-chip--active' : ''}`}
            onClick={() => setActiveTypes([])}
            type="button"
          >
            {t.all}
          </button>
          {MODULE_TYPES.map(mt => (
            <button
              key={mt.key}
              className={`gsb-type-chip ${activeTypes.includes(mt.key) ? 'gsb-type-chip--active' : ''}`}
              onClick={() => toggleType(mt.key)}
              type="button"
              style={activeTypes.includes(mt.key) ? { borderColor: mt.color, color: mt.color } : undefined}
            >
              <i className={`fas ${mt.icon}`} aria-hidden="true" />
              <span>{mt.label}</span>
            </button>
          ))}
        </div>

        {/* Dropdown Content */}
        {showDropdown && (
          <div className="gsb-dropdown" id="gsb-suggestions-list" role="listbox" ref={listRef}>
            {/* Recent Searches */}
            {showRecent && (
              <div className="gsb-section">
                <div className="gsb-section-header">
                  <i className="fas fa-clock" aria-hidden="true" />
                  <span>{t.recent}</span>
                  <button
                    className="gsb-section-action"
                    onClick={() => { clearRecentSearches(); setRecentSearches([]); }}
                    type="button"
                  >
                    {t.clear_all}
                  </button>
                </div>
                {recentSearches.map((recent, idx) => (
                  <button
                    key={recent.query}
                    className="gsb-suggestion-item"
                    onClick={() => handleRecentClick(recent.query)}
                    type="button"
                    role="option"
                    data-suggestion-item
                  >
                    <i className="fas fa-history gsb-suggestion-icon" aria-hidden="true" />
                    <span className="gsb-suggestion-text">{recent.query}</span>
                    <button
                      className="gsb-suggestion-remove"
                      onClick={(e) => { e.stopPropagation(); removeRecentSearch(recent.query); setRecentSearches(getRecentSearches()); }}
                      type="button"
                      aria-label="Remove"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            {/* Trending */}
            {showTrending && (
              <div className="gsb-section">
                <div className="gsb-section-header">
                  <i className="fas fa-fire" aria-hidden="true" />
                  <span>{t.trending}</span>
                </div>
                {trending.map((item, idx) => (
                  <button
                    key={item.query}
                    className="gsb-suggestion-item"
                    onClick={() => handleTrendingClick(item.query)}
                    type="button"
                    role="option"
                    data-suggestion-item
                  >
                    <span className="gsb-trending-rank">#{idx + 1}</span>
                    <span className="gsb-suggestion-text">{item.query}</span>
                    <span className="gsb-trending-count">{item.search_count} searches</span>
                  </button>
                ))}
              </div>
            )}

            {/* Autocomplete Suggestions */}
            {showSuggestions && (
              <div className="gsb-section">
                <div className="gsb-section-header">
                  <i className="fas fa-lightbulb" aria-hidden="true" />
                  <span>{t.suggestions}</span>
                  <span className="gsb-result-count">{totalSuggestions}</span>
                </div>
                {suggestions.map((suggestion, idx) => {
                  const moduleType = MODULE_TYPES.find(m => m.key === suggestion.type);
                  return (
                    <button
                      key={`${suggestion.type}-${suggestion.id}-${idx}`}
                      id={`gsb-suggestion-${idx}`}
                      className={`gsb-suggestion-item ${selectedIdx === idx ? 'gsb-suggestion-item--selected' : ''}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      type="button"
                      role="option"
                      aria-selected={selectedIdx === idx}
                      data-suggestion-item
                    >
                      <span
                        className="gsb-suggestion-type-badge"
                        style={{ backgroundColor: moduleType?.color || 'var(--text-secondary, #999)' }}
                      >
                        <i className={`fas ${moduleType?.icon || 'fa-search'}`} aria-hidden="true" />
                      </span>
                      <span className="gsb-suggestion-text">{suggestion.text}</span>
                      <span className="gsb-suggestion-type-label">{suggestion.type_label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="gsb-loading">
                <div className="gsb-loading-spinner" />
                <span>Searching...</span>
              </div>
            )}

            {/* Empty State */}
            {showEmpty && (
              <div className="gsb-empty">
                <i className="fas fa-search gsb-empty-icon" aria-hidden="true" />
                <p className="gsb-empty-title">{t.no_results}</p>
                <p className="gsb-empty-hint">{t.try_different}</p>
              </div>
            )}

            {/* Footer Hint */}
            {query.length >= 2 && !loading && (
              <div className="gsb-footer">
                <span>
                  Press <kbd>Enter</kbd> to search for "{query}"
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearchBar;
