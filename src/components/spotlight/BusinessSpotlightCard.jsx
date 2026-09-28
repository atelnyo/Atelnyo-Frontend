import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * BusinessSpotlightCard — Displays a Business in Spotlight.
 *
 * Shows:
 *   - Business logo and name
 *   - Verification badge (verified business)
 *   - Spotlight badge (approved for Spotlight)
 *   - Services offered
 *   - Trust score and reviews
 *   - Link to business profile
 */
export default function BusinessSpotlightCard({ business, t = {}, lang = 'ht' }) {
  const [expanded, setExpanded] = useState(false);

  if (!business) return null;

  // Resolve translation helper — matches Explore.jsx's pattern where `t`
  // is the translations object keyed by lang.
  const tr = (key, fallback) => {
    if (typeof t === 'function') return t(key) || fallback;
    return t[key] || fallback;
  };

  const {
    id,
    business_name,
    business_description,
    business_category,
    business_slug,
    website_url,
    services_offered = [],
    portfolio_items = [],
    client_testimonials = [],
    view_count = 0,
    profile = {},
    achievements = [],
  } = business;

  return (
    <div className="business-spotlight-card">
      {/* Header */}
      <div className="business-spotlight-header">
        <div className="business-spotlight-logo">
          {profile?.logo ? (
            <img src={profile.logo} alt={business_name} />
          ) : (
            <div className="business-spotlight-placeholder">
              {business_name?.charAt(0) || 'B'}
            </div>
          )}
        </div>

        <div className="business-spotlight-info">
          <h3 className="business-spotlight-name">
            <Link to={`/b/${business_slug || id}`}>
              {business_name}
            </Link>
            <span className="business-spotlight-verified" title={lang === 'ht' ? 'Biznis Verifye' : 'Verified Business'}>
              ✓
            </span>
          </h3>

          {business_category && (
            <span className="business-spotlight-category">
              {business_category}
            </span>
          )}

          {profile?.tagline && (
            <p className="business-spotlight-tagline">{profile.tagline}</p>
          )}
        </div>
      </div>

      {/* Description */}
      {business_description && (
        <p className="business-spotlight-description">
          {expanded
            ? business_description
            : `${business_description.slice(0, 150)}${business_description.length > 150 ? '...' : ''}`}
          {business_description.length > 150 && (
            <button
              className="business-spotlight-expand"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? tr('Show less', 'Mwens') : tr('Read more', 'Plis')}
            </button>
          )}
        </p>
      )}

      {/* Services */}
      {services_offered.length > 0 && (
        <div className="business-spotlight-services">
          <span className="business-spotlight-services-label">{tr('Services', 'Sèvis')}:</span>
          {services_offered.slice(0, 4).map((service, idx) => (
            <span key={idx} className="business-spotlight-service-tag">
              {typeof service === 'string' ? service : service?.name}
            </span>
          ))}
          {services_offered.length > 4 && (
            <span className="business-spotlight-service-more">
              +{services_offered.length - 4} {tr('more', 'ankò')}
            </span>
          )}
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="business-spotlight-achievements">
          {achievements.slice(0, 3).map((ach) => (
            <span
              key={ach.id}
              className="business-spotlight-achievement"
              style={{ borderColor: ach.color || '#fbbf24' }}
              title={ach.description}
            >
              <i className={`fas ${ach.icon || 'fa-trophy'}`} />
              {ach.title}
            </span>
          ))}
        </div>
      )}

      {/* Trust & Stats */}
      <div className="business-spotlight-stats">
        {profile?.rating > 0 && (
          <span className="business-spotlight-rating">
            ⭐ {Number(profile.rating).toFixed(1)}
            {profile.review_count > 0 && (
              <span className="business-spotlight-review-count">
                ({profile.review_count})
              </span>
            )}
          </span>
        )}

        <span className="business-spotlight-views">
          👁 {view_count} {lang === 'ht' ? 'vizit' : 'views'}
        </span>

        {website_url && (
          <a
            href={website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="business-spotlight-website"
          >
            🌐 {lang === 'ht' ? 'Sitwèb' : 'Website'}
          </a>
        )}
      </div>

      {/* Footer */}
      <div className="business-spotlight-footer">
        <Link
          to={`/b/${business_slug || id}`}
          className="business-spotlight-view-btn"
        >
          {lang === 'ht' ? 'Vye Biznis la' : 'View Business Profile'}
        </Link>
      </div>
    </div>
  );
}
