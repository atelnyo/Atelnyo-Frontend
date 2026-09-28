/**
 * src/components/profile/ProfileCatalogCard.jsx
 *
 * Shared catalog card for the Creator Public Profile (courses, products,
 * portfolio, jobs). Richer than the old card:
 *   - type chip overlaid on the image ("Kou" / "Pwodwi" / …)
 *   - 2-line clamped title
 *   - 2-line description snippet
 *   - meta row (price/budget + star rating + extra info)
 *   - icon fallback when the image is missing or fails (ProfileCardImage)
 *
 * Props:
 *   title       — card title
 *   image       — image URL (empty → icon fallback)
 *   description — optional 2-line snippet
 *   icon        — FontAwesome icon for the fallback tile
 *   typeLabel   — chip text, e.g. "Kou" / "Course" (empty → no chip)
 *   price       — optional price / budget string
 *   freeLabel   — text for the zero-price pill ("Gratis" / "Free")
 *   rating      — optional 0-5 rating (stars render when > 0)
 *   isFeatured  — true → amber "Featured" badge on the image
 *   isNew       — true → emerald "New" badge on the image
 *   isPopular   — true → pink "Popular" badge on the image
 *   badgeLabels — { featured, new, popular } localized badge texts
 *   extra       — optional extra meta node (students/sold/views/remote…)
 *   onOpen      — click handler (navigates to the detail page)
 */
import React from 'react';
import ProfileCardImage from './ProfileCardImage';

export function RatingStars({ rating }) {
  const rounded = Math.round(Number(rating) || 0);
  return (
    <div className="csp-catalog-card-rating" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <i key={star} className={`${star <= rounded ? 'fas' : 'far'} fa-star`}
          style={{ opacity: star <= rounded ? 1 : 0.3 }} aria-hidden="true" />
      ))}
      <span className="csp-catalog-card-rating-value">{Number(rating).toFixed(1)}</span>
    </div>
  );
}

export default function ProfileCatalogCard({
  title = '',
  image = '',
  description = '',
  icon = 'fa-image',
  typeLabel = '',
  price = null,
  freeLabel = '',
  rating = 0,
  isFeatured = false,
  isNew = false,
  isPopular = false,
  badgeLabels = {},
  extra = null,
  onOpen,
}) {
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    }
  };
  // ``price`` arrives formatted ("$50", "$500-$800 USD"); pull the first
  // numeric value out so a zero-price item can render the Free badge
  // instead of a misleading "$0" pill.
  const priceValue = Number(String(price || '').replace(/[^0-9.]/g, ''));
  // Status badges overlaid top-left under the type chip. Featured wins
  // over New wins over Popular so only ONE badge shows at a time (a
  // featured course is already its own signal).
  const statusBadge = isFeatured
    ? { cls: 'csp-catalog-card-badge csp-catalog-card-badge--featured', label: badgeLabels.featured || 'Featured' }
    : isNew
      ? { cls: 'csp-catalog-card-badge csp-catalog-card-badge--new', label: badgeLabels.new || 'New' }
      : isPopular
        ? { cls: 'csp-catalog-card-badge csp-catalog-card-badge--popular', label: badgeLabels.popular || 'Popular' }
        : null;
  return (
    <div className="csp-catalog-card" role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}>
      <div className="csp-catalog-card-media">
        <ProfileCardImage src={image} alt={title} icon={icon} />
        {typeLabel && <span className="csp-catalog-card-type">{typeLabel}</span>}
        {statusBadge && <span className={statusBadge.cls}>{statusBadge.label}</span>}
      </div>
      <div className="csp-catalog-card-body">
        <div className="csp-catalog-card-title">{title}</div>
        {description && <div className="csp-catalog-card-desc">{description}</div>}
        <div className="csp-catalog-card-meta">
          {priceValue > 0
            ? <span className="csp-catalog-card-price">{price}</span>
            : freeLabel && <span className="csp-catalog-card-free">{freeLabel}</span>}
          {Number(rating) > 0 && <RatingStars rating={rating} />}
          {extra}
        </div>
      </div>
    </div>
  );
}
