/**
 * src/components/profile/ProfileCoursesTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * Renders the creator's course catalog as csp-card-grid of csp-catalog-cards.
 * Enriched: bilingual empty state, star rating, description snippet.
 */

import React from 'react';
import { SkeletonSection } from './ProfileSkeleton';
import { fmtCount, isNewItem } from './profileUtils';
import ProfileCatalogCard from './ProfileCatalogCard';

// 5-star rating row — now owned by ProfileCatalogCard; re-exported here
// so ProfileProductsTab's existing import keeps working.
export { RatingStars } from './ProfileCatalogCard';

export default function CoursesTab({ courses, loading, onItemClick, lang }) {
  if (loading) return <SkeletonSection />;
  if (!courses?.length) {
    return (
      <div className="csp-empty">
        <i className="fas fa-graduation-cap" aria-hidden="true" />
        <p>
          {lang === 'ht'
            ? 'Kreyatè sa a poko pibliye kou pou kounye a.'
            : 'No courses yet.'}
        </p>
      </div>
    );
  }
  return (
    <div className="csp-card-grid" style={{ marginTop: 4 }}>
      {courses.map((course) => (
        <ProfileCatalogCard
          key={course.id}
          title={course.title}
          image={course.image_url}
          description={course.description}
          icon="fa-graduation-cap"
          typeLabel={lang === 'ht' ? 'Kou' : 'Course'}
          price={`$${course.price || 0}`}
          freeLabel={lang === 'ht' ? 'Gratis' : 'Free'}
          rating={course.rating}
          isFeatured={!!course.is_featured}
          isNew={isNewItem(course.created_at)}
          isPopular={course.student_count >= 25}
          badgeLabels={{
            featured: lang === 'ht' ? 'Rekòmande' : 'Featured',
            new: lang === 'ht' ? 'Nouvo' : 'New',
            popular: lang === 'ht' ? 'Popilè' : 'Popular',
          }}
          extra={course.student_count > 0 ? <span>· {fmtCount(course.student_count)} {lang === 'ht' ? 'elèv' : 'students'}</span> : null}
          onOpen={() => onItemClick?.('course', course.id, course)}
        />
      ))}
    </div>
  );
}

