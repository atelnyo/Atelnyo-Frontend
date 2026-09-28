/**
 * src/components/profile/ProfileReviewsTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * Renders the creator's reviews with star ratings.
 * Enriched: bilingual empty state + review date.
 */

import React from 'react';
import { SkeletonSection } from './ProfileSkeleton';
import { fmtDate } from './profileUtils';

export default function ReviewsTab({ reviews, loading, lang }) {
  if (loading) return <SkeletonSection />;
  if (!reviews?.length) {
    return (
      <div className="csp-empty">
        <i className="fas fa-star" aria-hidden="true" />
        <p>
          {lang === 'ht'
            ? 'Kreyatè sa a poko resevwa revizyon pou kounye a.'
            : 'No reviews yet.'}
        </p>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 4 }}>
      {reviews.map((review) => (
        <div key={review.id} className="csp-review">
          <div className="csp-review-header">
            <span className="csp-review-author">{review.reviewer_username}</span>
            <div className="csp-review-stars" aria-label={`${review.rating} out of 5`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <i key={star} className="fas fa-star"
                  style={{ opacity: star <= review.rating ? 1 : 0.2 }} />
              ))}
            </div>
          </div>
          <div className="csp-review-subrow">
            {review.product_title && (
              <span className="csp-review-product">
                <i className="fas fa-box" aria-hidden="true" /> {review.product_title}
              </span>
            )}
            {review.created_at && (
              <span className="csp-review-date">{fmtDate(review.created_at, lang)}</span>
            )}
          </div>
          {review.comment && <p className="csp-review-text">{review.comment}</p>}
        </div>
      ))}
    </div>
  );
}
