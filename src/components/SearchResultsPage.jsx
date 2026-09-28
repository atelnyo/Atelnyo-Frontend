/**
 * src/components/SearchResultsPage.jsx
 *
 * Full-page search results with filters, sort, pagination, and
 * faceted results grouped by module type.
 *
 * Features:
 *   - Faceted results grouped by module type with counts
 *   - Sort dropdown (relevance, newest, popular, rating, price)
 *   - Pagination with page numbers
 *   - Click tracking for analytics
 *   - Empty state with suggestions
 *   - Loading skeletons
 *   - Dark mode support
 *   - Responsive layout
 *
 * Usage:
 *   <SearchResultsPage
 *     query="react"
 *     results={searchResults}
 *     loading={false}
 *     lang="en"
 *   />
 */
import React, { useState, useMemo, useCallback } from 'react';
import useSafeNavigate from '../hooks/useSafeNavigate';
import api from '../services/api';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance', icon: 'fa-sort-amount-down' },
  { value: 'newest', label: 'Newest', icon: 'fa-clock' },
  { value: 'popular', label: 'Most Popular', icon: 'fa-fire' },
  { value: 'rating', label: 'Highest Rated', icon: 'fa-star' },
  { value: 'price_low', label: 'Price: Low to High', icon: 'fa-arrow-up' },
  { value: 'price_high', label: 'Price: High to Low', icon: 'fa-arrow-down' },
  { value: 'alphabetical', label: 'A-Z', icon: 'fa-font' },
];

const MODULE_ICONS = {
  course: { icon: 'fa-graduation-cap', color: 'var(--pr-color-blue-500, #3498db)', bg: 'rgba(52,152,219,0.13)', label: 'Course' },
  creator: { icon: 'fa-user-tie', color: 'var(--pr-color-purple-500, #9b59b6)', bg: 'rgba(155,89,182,0.13)', label: 'Creator' },
  music: { icon: 'fa-music', color: 'var(--pr-color-pink-500, #e91e63)', bg: 'rgba(233,30,99,0.13)', label: 'Music' },
  talent: { icon: 'fa-star', color: 'var(--pr-color-amber-500, #f39c12)', bg: 'rgba(243,156,18,0.13)', label: 'Talent' },
  community: { icon: 'fa-users', color: 'var(--pr-color-emerald-500, #27ae60)', bg: 'rgba(39,174,96,0.13)', label: 'Community' },
  job: { icon: 'fa-briefcase', color: 'var(--pr-color-gray-800, #2c3e50)', bg: 'rgba(44,62,80,0.13)', label: 'Job' },
  portfolio: { icon: 'fa-palette', color: 'var(--pr-color-orange-500, #e67e22)', bg: 'rgba(230,126,34,0.13)', label: 'Portfolio' },
  product: { icon: 'fa-shopping-bag', color: 'var(--pr-color-teal-500, #1abc9c)', bg: 'rgba(26,188,156,0.13)', label: 'Product' },
  event: { icon: 'fa-calendar-alt', color: 'var(--state-error, #e74c3c)', bg: 'var(--severity-high-bg, rgba(231,76,60,0.13))', label: 'Event' },
  user: { icon: 'fa-user', color: 'var(--text-secondary, #95a5a6)', bg: 'var(--state-neutral-bg, rgba(149,165,166,0.13))', label: 'Person' },
};

const SearchResultsPage = ({
  query,
  results = [],
  total = 0,
  facets = {},
  loading = false,
  onSortChange,
  onPageChange,
  currentPage = 1,
  totalPages = 1,
  lang = 'en',
}) => {
  const navigate = useSafeNavigate();
  const [sortBy, setSortBy] = useState('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState(null);

  const t = {
    results_for: lang === 'ht' ? 'Rezilta pou' : 'Results for',
    no_results: lang === 'ht' ? 'Pa gen rezilta' : 'No results found',
    try_different: lang === 'ht' ? 'Eseye yon lòt tèm oswa chanje filtè yo' : 'Try a different search term or change filters',
    browse_explore: lang === 'ht' ? 'Eksplore Tout' : 'Browse Explore',
    sort_by: lang === 'ht' ? 'Triye pa' : 'Sort by',
    showing: lang === 'ht' ? 'Ap montre' : 'Showing',
    of: lang === 'ht' ? 'nan' : 'of',
    results: lang === 'ht' ? 'rezilta' : 'results',
    view: lang === 'ht' ? 'Wè' : 'View',
    filters: lang === 'ht' ? 'Filtè' : 'Filters',
    categories: lang === 'ht' ? 'Kategori' : 'Categories',
    all: lang === 'ht' ? 'Tout' : 'All',
    loading: lang === 'ht' ? 'Ap chaje...' : 'Loading...',
    prev: lang === 'ht' ? 'Anvan' : 'Prev',
    next: lang === 'ht' ? 'Apre' : 'Next',
  };

  // Handle sort change
  const handleSortChange = useCallback((value) => {
    setSortBy(value);
    if (onSortChange) onSortChange(value);
  }, [onSortChange]);

  // Handle result click (track analytics)
  const handleResultClick = useCallback((result, position) => {
    // Log click for analytics
    api.post('search/click/', {
      content_type: result.type,
      content_id: result.id,
      content_title: result.title,
      position,
      search_id: null,
    }).catch(() => {});

    // Navigate to result
    if (result.url) {
      navigate(result.url);
    }
  }, [navigate]);

  // Filter results by active type
  const filteredResults = useMemo(() => {
    if (!activeTypeFilter) return results;
    return results.filter(r => r.type === activeTypeFilter);
  }, [results, activeTypeFilter]);

  // Group results by type for faceted view
  const groupedResults = useMemo(() => {
    const groups = {};
    filteredResults.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [filteredResults]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="srp-container">
        <div className="srp-header">
          <div className="srp-skeleton-line" style={{ width: '200px', height: '24px' }} />
          <div className="srp-skeleton-line" style={{ width: '120px', height: '20px' }} />
        </div>
        <div className="srp-results-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="srp-result-card srp-skeleton">
              <div className="srp-skeleton-img" />
              <div className="srp-skeleton-line" style={{ width: '70%' }} />
              <div className="srp-skeleton-line" style={{ width: '50%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && filteredResults.length === 0) {
    return (
      <div className="srp-container">
        <div className="srp-empty">
          <div className="srp-empty-icon">
            <i className="fas fa-search" />
          </div>
          <h3 className="srp-empty-title">{t.no_results}</h3>
          <p className="srp-empty-hint">
            {query ? `${t.results_for} "${query}"` : t.try_different}
          </p>
          <p className="srp-empty-subtitle">{t.try_different}</p>
          <button
            className="srp-empty-btn"
            onClick={() => navigate('/')}
          >
            <i className="fas fa-compass" />
            <span>{t.browse_explore}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="srp-container">
      {/* Header */}
      <div className="srp-header">
        <div className="srp-header-left">
          <h2 className="srp-title">
            {t.results_for} <span className="srp-query">"{query}"</span>
          </h2>
          <span className="srp-count">
            {total} {t.results}
          </span>
        </div>
        <div className="srp-header-right">
          {/* Sort Dropdown */}
          <div className="srp-sort-wrapper">
            <label className="srp-sort-label">
              <i className="fas fa-sort" aria-hidden="true" />
              {t.sort_by}
            </label>
            <select
              className="srp-sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Filter Toggle (mobile) */}
          <button
            className="srp-filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
            type="button"
          >
            <i className="fas fa-filter" />
            <span>{t.filters}</span>
          </button>
        </div>
      </div>

      {/* Facet Chips */}
      <div className="srp-facets">
        <button
          className={`srp-facet-chip ${!activeTypeFilter ? 'srp-facet-chip--active' : ''}`}
          onClick={() => setActiveTypeFilter(null)}
          type="button"
        >
          {t.all} ({total})
        </button>
        {Object.entries(facets).map(([type, count]) => {
          if (count === 0) return null;
          const mod = MODULE_ICONS[type] || { icon: 'fa-search', color: 'var(--text-secondary, #999)', label: type };
          return (
            <button
              key={type}
              className={`srp-facet-chip ${activeTypeFilter === type ? 'srp-facet-chip--active' : ''}`}
              onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
              type="button"
              style={activeTypeFilter === type ? { borderColor: mod.color, color: mod.color } : undefined}
            >
              <i className={`fas ${mod.icon}`} aria-hidden="true" />
              <span>{mod.label}</span>
              <span className="srp-facet-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Results Grid */}
      <div className="srp-results-grid">
        {filteredResults.map((result, idx) => {
          const mod = MODULE_ICONS[result.type] || { icon: 'fa-search', color: '#999', label: result.type };
          return (
            <div
              key={`${result.type}-${result.id}-${idx}`}
              className="srp-result-card"
              onClick={() => handleResultClick(result, idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleResultClick(result, idx); }}
            >
              {/* Thumbnail */}
              <div className="srp-result-thumb">
                {result.image_url ? (
                  <img
                    src={result.image_url}
                    alt={result.title}
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="srp-result-thumb-placeholder" style={{ backgroundColor: mod.bg, color: mod.color }}>
                    <i className={`fas ${mod.icon}`} />
                  </div>
                )}
                {/* Type Badge */}
                <span className="srp-result-type-badge" style={{ backgroundColor: mod.color }}>
                  <i className={`fas ${mod.icon}`} aria-hidden="true" />
                  {mod.label}
                </span>
                {/* Badges */}
                {result.badges && result.badges.length > 0 && (
                  <div className="srp-result-badges">
                    {result.badges.map((badge, i) => (
                      <span key={i} className="srp-result-badge">{badge}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="srp-result-content">
                <h3 className="srp-result-title">{result.title}</h3>
                {result.creator && (
                  <span className="srp-result-creator">
                    <i className="fas fa-user" aria-hidden="true" />
                    {result.creator}
                  </span>
                )}
                {result.subtitle && (
                  <p className="srp-result-subtitle">{result.subtitle}</p>
                )}
                {/* Meta Row */}
                <div className="srp-result-meta">
                  {result.price !== null && result.price !== undefined && (
                    <span className="srp-result-price">
                      {result.price === 0 ? 'Free' : `$${result.price}`}
                    </span>
                  )}
                  {result.rating && (
                    <span className="srp-result-rating">
                      <i className="fas fa-star" aria-hidden="true" />
                      {result.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="srp-result-action">
                <span className="srp-result-view-btn">
                  {t.view} <i className="fas fa-arrow-right" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="srp-pagination">
          <button
            className="srp-page-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            type="button"
          >
            <i className="fas fa-chevron-left" /> {t.prev}
          </button>
          <div className="srp-page-numbers">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <button
                  key={page}
                  className={`srp-page-num ${currentPage === page ? 'srp-page-num--active' : ''}`}
                  onClick={() => onPageChange && onPageChange(page)}
                  type="button"
                >
                  {page}
                </button>
              );
            })}
          </div>
          <button
            className="srp-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            type="button"
          >
            {t.next} <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
