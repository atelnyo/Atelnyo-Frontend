import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * BusinessSpotlightCard — a Business profile approved for Spotlight.
 *
 * Rendered in the same Explore rail as Creator Spotlight cards, so it
 * follows the same interaction contract:
 *   • ONE real link covers the whole card (``business-spotlight-open``)
 *     and opens the public business profile ``/b/<slug>``;
 *   • the website link and the "read more" button re-capture pointer
 *     events above that overlay, so they never trigger the card link;
 *   • every label is localized in ht/en/fr/es instead of the previous
 *     hardcoded Haitian/English mix.
 *
 * Data comes from ``businessSpotlightService.list()`` — see
 * ``Explore.jsx`` (``_type: 'business'`` rows).
 */
const COPY = {
  ht: {
    verified: 'Biznis verifye',
    services: 'Sèvis',
    more: 'ankò',
    views: 'vizit',
    website: 'Sitwèb',
    readMore: 'Li plis',
    showLess: 'Montre mwens',
    viewBusiness: 'Wè pwofil biznis la',
    portfolio: 'pwojè',
    testimonials: 'temwayaj',
    openProfile: 'Ouvri pwofil',
    reviews: 'avi',
  },
  en: {
    verified: 'Verified business',
    services: 'Services',
    more: 'more',
    views: 'views',
    website: 'Website',
    readMore: 'Read more',
    showLess: 'Show less',
    viewBusiness: 'View business profile',
    portfolio: 'projects',
    testimonials: 'testimonials',
    openProfile: 'Open profile',
    reviews: 'reviews',
  },
  fr: {
    verified: 'Entreprise vérifiée',
    services: 'Services',
    more: 'de plus',
    views: 'vues',
    website: 'Site web',
    readMore: 'Lire la suite',
    showLess: 'Réduire',
    viewBusiness: 'Voir le profil du business',
    portfolio: 'projets',
    testimonials: 'témoignages',
    openProfile: 'Ouvrir le profil',
    reviews: 'avis',
  },
  es: {
    verified: 'Empresa verificada',
    services: 'Servicios',
    more: 'más',
    views: 'visitas',
    website: 'Sitio web',
    readMore: 'Leer más',
    showLess: 'Mostrar menos',
    viewBusiness: 'Ver perfil del negocio',
    portfolio: 'proyectos',
    testimonials: 'testimonios',
    openProfile: 'Abrir perfil',
    reviews: 'reseñas',
  },
};

export default function BusinessSpotlightCard({ business, t = {}, lang = 'en' }) {
  const [expanded, setExpanded] = useState(false);

  if (!business) return null;

  const copy = COPY[lang] || COPY.en;

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

  const services = Array.isArray(services_offered) ? services_offered : [];
  const portfolio = Array.isArray(portfolio_items) ? portfolio_items : [];
  const testimonials = Array.isArray(client_testimonials) ? client_testimonials : [];
  const achievementsList = Array.isArray(achievements) ? achievements : [];
  const profileSlug = business_slug || id;
  const description = business_description || '';
  const isLongDescription = description.length > 150;
  const visibleDescription = expanded || !isLongDescription
    ? description
    : `${description.slice(0, 150)}...`;
  const rating = Number(profile?.rating) || 0;
  const reviewCount = Number(profile?.review_count) || 0;
  const views = Number(view_count) || 0;

  return (
    <div
      className="business-spotlight-card business-spotlight-card--overlay"
      data-testid="business-spotlight-card"
      data-business-id={id}
    >
      <Link
        to={`/b/${profileSlug}`}
        className="business-spotlight-open"
        aria-label={`${copy.openProfile}: ${business_name || ''}`}
      />

      {/* Header */}
      <div className="business-spotlight-header">
        <div className="business-spotlight-logo">
          {profile?.logo ? (
            <img src={profile.logo} alt={business_name} loading="lazy" />
          ) : (
            <div className="business-spotlight-placeholder" aria-hidden="true">
              {business_name?.charAt(0) || 'B'}
            </div>
          )}
        </div>

        <div className="business-spotlight-info">
          <h3 className="business-spotlight-name">
            {business_name}
            <span
              className="business-spotlight-verified"
              title={copy.verified}
              aria-label={copy.verified}
            >
              ✓
            </span>
          </h3>

          {business_category && (
            <span className="business-spotlight-category">{business_category}</span>
          )}

          {profile?.tagline && (
            <p className="business-spotlight-tagline">{profile.tagline}</p>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="business-spotlight-description">
          {visibleDescription}
          {isLongDescription && (
            <button
              type="button"
              className="business-spotlight-expand"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? copy.showLess : copy.readMore}
            </button>
          )}
        </p>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="business-spotlight-services">
          <span className="business-spotlight-services-label">{copy.services}:</span>
          {services.slice(0, 4).map((service, idx) => (
            <span key={idx} className="business-spotlight-service-tag">
              {typeof service === 'string' ? service : service?.name}
            </span>
          ))}
          {services.length > 4 && (
            <span className="business-spotlight-service-more">
              +{services.length - 4} {copy.more}
            </span>
          )}
        </div>
      )}

      {/* Achievements */}
      {achievementsList.length > 0 && (
        <div className="business-spotlight-achievements">
          {achievementsList.slice(0, 3).map((ach) => (
            <span
              key={ach.id}
              className="business-spotlight-achievement"
              style={{ borderColor: ach.color || '#fbbf24' }}
              title={ach.description}
            >
              <i className={`fas ${ach.icon || 'fa-trophy'}`} aria-hidden="true" />
              {ach.title}
            </span>
          ))}
        </div>
      )}

      {/* Portfolio / testimonial proof */}
      {(portfolio.length > 0 || testimonials.length > 0) && (
        <div className="business-spotlight-proof">
          {portfolio.length > 0 && (
            <span>
              <i className="fas fa-images" aria-hidden="true" /> {portfolio.length}{' '}
              {copy.portfolio}
            </span>
          )}
          {testimonials.length > 0 && (
            <span>
              <i className="fas fa-quote-left" aria-hidden="true" /> {testimonials.length}{' '}
              {copy.testimonials}
            </span>
          )}
        </div>
      )}

      {/* Trust & stats */}
      <div className="business-spotlight-stats">
        {rating > 0 && (
          <span
            className="business-spotlight-rating"
            aria-label={`${rating.toFixed(1)} / 5${reviewCount > 0 ? ` · ${reviewCount} ${copy.reviews}` : ''}`}
          >
            <i className="fas fa-star" aria-hidden="true" /> {rating.toFixed(1)}
            {reviewCount > 0 && (
              <span className="business-spotlight-review-count">({reviewCount})</span>
            )}
          </span>
        )}

        <span className="business-spotlight-views" aria-label={`${views} ${copy.views}`}>
          <i className="fas fa-eye" aria-hidden="true" /> {views} {copy.views}
        </span>

        {website_url && (
          <a
            href={website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="business-spotlight-website"
            aria-label={`${copy.website}: ${business_name || ''}`}
          >
            <i className="fas fa-globe" aria-hidden="true" /> {copy.website}
          </a>
        )}
      </div>

      {/* The overlay link owns navigation; this is the visual CTA. */}
      <div className="business-spotlight-footer">
        <span className="business-spotlight-view-btn" aria-hidden="true">
          {copy.viewBusiness}
        </span>
      </div>
    </div>
  );
}
