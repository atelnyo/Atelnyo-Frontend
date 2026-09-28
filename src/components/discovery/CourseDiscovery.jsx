/**
 * src/components/discovery/CourseDiscovery.jsx
 *
 * Course Discovery page — the main "Discover" tab on the Explore page.
 * Shows multiple rails of curated content:
 *   - Continue Learning (authenticated only)
 *   - Recommended for You
 *   - Featured Courses
 *   - New Courses
 *   - Popular Courses
 *   - Browse by Category
 *
 * Integrates with the Phase 13 backend discovery endpoints.
 * Accessible: keyboard navigation, screen-reader announcements, semantic HTML.
 * Responsive: horizontal scroll rails on mobile, grid on desktop.
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import CourseCard from '../../modules/explore/cards/CourseCard';

const DISCOVERY_CACHE_KEY = 'atelnyo_discovery_page';
const DISCOVERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function useDiscoveryData(lang = 'en') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      // Try cache first
      try {
        const cached = localStorage.getItem(DISCOVERY_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < DISCOVERY_CACHE_TTL) {
            setData(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch { /* cache miss */ }

      const res = await api.get('/search/discover/');
      const discoveryData = res.data;
      setData(discoveryData);

      // Cache for offline/reload
      try {
        localStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify({
          data: discoveryData,
          timestamp: Date.now(),
        }));
      } catch { /* storage full */ }
    } catch (err) {
      console.error('Discovery fetch failed:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

function DiscoveryRail({ title, icon, courses = [], onOpen, lang, emptyMessage }) {
  if (!courses || courses.length === 0) {
    return emptyMessage ? (
      <section className="disc-rail disc-rail--empty" aria-label={title}>
        <h3 className="disc-rail-title">
          {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
          {title}
        </h3>
        <p className="disc-rail-empty">{emptyMessage}</p>
      </section>
    ) : null;
  }

  return (
    <section className="disc-rail" aria-label={title}>
      <h3 className="disc-rail-title">
        {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
        {title}
      </h3>
      <div className="disc-rail-scroll" role="list">
        {courses.map((course, idx) => (
          <div key={course.id || idx} className="disc-rail-item" role="listitem">
            <CourseCard course={course} lang={lang} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryGrid({ categories = [], onSelectCategory }) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="disc-categories" aria-label="Browse by category">
      <h3 className="disc-rail-title">
        <i className="fas fa-th-large" aria-hidden="true" />
        {localStorage.getItem('lang') === 'ht' ? 'Eksplore pa Kategori' : 'Browse by Category'}
      </h3>
      <div className="disc-category-grid" role="list">
        {categories.map((cat, idx) => (
          <button
            key={cat.id || idx}
            className="disc-category-card"
            role="listitem"
            onClick={() => onSelectCategory && onSelectCategory(cat)}
            aria-label={`${cat.name} (${cat.course_count} courses)`}
          >
            {cat.icon && <i className={`fas ${cat.icon}`} aria-hidden="true" />}
            <span className="disc-category-name">{cat.name}</span>
            <span className="disc-category-count">{cat.course_count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DiscoverySkeleton() {
  return (
    <div className="disc-loading" aria-busy="true" aria-label="Loading discovery content">
      {[1, 2, 3].map(i => (
        <section key={i} className="disc-rail disc-rail--skeleton">
          <div className="disc-skeleton-title" />
          <div className="disc-skeleton-cards">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="disc-skeleton-card" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DiscoveryError({ error, onRetry, lang }) {
  const isHt = lang === 'ht';
  return (
    <div className="disc-error" role="alert">
      <i className="fas fa-exclamation-triangle" aria-hidden="true" />
      <p>{isHt
        ? 'Pa t ka chaje kontni dekouvèt la. Eseye ankò.'
        : 'Could not load discovery content. Please try again.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="disc-retry-btn">
          {isHt ? 'Eseye ankò' : 'Retry'}
        </button>
      )}
    </div>
  );
}

export default function CourseDiscovery({ lang = 'en', onOpenCourse }) {
  const { data, loading, error, refetch } = useDiscoveryData(lang);
  const isHt = lang === 'ht';

  const handleOpenCourse = useCallback((course) => {
    if (onOpenCourse) {
      onOpenCourse(course);
    } else if (course?.url) {
      window.location.href = course.url;
    }
  }, [onOpenCourse]);

  const handleSelectCategory = useCallback((cat) => {
    // Navigate to explore with category filter
    window.location.href = `/explore?category=${encodeURIComponent(cat.slug || cat.name)}`;
  }, []);

  if (loading) {
    return <DiscoverySkeleton />;
  }

  if (error) {
    return <DiscoveryError error={error} onRetry={refetch} lang={lang} />;
  }

  if (!data) return null;

  // Live region for screen readers
  const totalCourses = (
    (data.continue_learning?.length || 0) +
    (data.recommended?.length || 0) +
    (data.featured?.length || 0) +
    (data.new?.length || 0) +
    (data.popular?.length || 0)
  );

  return (
    <div className="course-discovery" role="main" aria-label={isHt ? 'Dekouvri kou' : 'Discover courses'}>
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {totalCourses > 0
          ? isHt
            ? `${totalCourses} kou disponib pou dekouvri.`
            : `${totalCourses} courses available to discover.`
          : isHt
            ? 'Pa gen kou pou kounye a.'
            : 'No courses available right now.'}
      </div>

      {/* Continue Learning */}
      <DiscoveryRail
        title={isHt ? 'Continue Aprann' : 'Continue Learning'}
        icon="fa-play-circle"
        courses={data.continue_learning}
        onOpen={handleOpenCourse}
        lang={lang}
        emptyMessage={isHt
          ? 'Ou pa gen kou ou ap suiv kounye a.'
          : 'You don\'t have any courses in progress yet.'}
      />

      {/* Recommended */}
      <DiscoveryRail
        title={isHt ? 'Rekòmande pou Ou' : 'Recommended for You'}
        icon="fa-magic"
        courses={data.recommended}
        onOpen={handleOpenCourse}
        lang={lang}
      />

      {/* Featured */}
      <DiscoveryRail
        title={isHt ? 'Kou Piblize' : 'Featured Courses'}
        icon="fa-star"
        courses={data.featured}
        onOpen={handleOpenCourse}
        lang={lang}
      />

      {/* New */}
      <DiscoveryRail
        title={isHt ? 'Kou Nouvo' : 'New Courses'}
        icon="fa-sparkles"
        courses={data.new}
        onOpen={handleOpenCourse}
        lang={lang}
      />

      {/* Popular */}
      <DiscoveryRail
        title={isHt ? 'Kou Popilè' : 'Popular Courses'}
        icon="fa-fire"
        courses={data.popular}
        onOpen={handleOpenCourse}
        lang={lang}
      />

      {/* Categories */}
      <CategoryGrid
        categories={data.categories}
        onSelectCategory={handleSelectCategory}
      />
    </div>
  );
}

export { DiscoveryRail, CategoryGrid, DiscoverySkeleton, DiscoveryError, useDiscoveryData };
