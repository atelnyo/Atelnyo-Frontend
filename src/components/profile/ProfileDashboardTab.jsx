/**
 * src/components/profile/ProfileDashboardTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * DashboardTab + DASHBOARD_SECTION_RENDERERS map. Each renderer returns
 * null when its data is empty, so the section auto-hides.
 *
 * DASHBOARD_SECTION_RENDERERS keys (used by DASHBOARD_INTERNAL_ORDER):
 *   - activities
 *   - courses
 *   - products
 *   - portfolio
 *   - music
 *   - talents
 *   - achievements
 *   - reviews
 *   - communities
 *   - events
 *   - affiliateOffers
 *   - campaigns
 *
 * NOTE: Uses its own DASHBOARD_INTERNAL_ORDER (not tab-level section_order
 * which has "dashboard", "picks", "about" — those don't match).
 *
 * STAGE A-2: zero behavior change. Verbatim copy from monolith.
 */

import React from 'react';
import { fmtCount, fmtDate, isNewItem } from './profileUtils';
import ProfileCatalogCard from './ProfileCatalogCard';

/* ─── Dashboard section renderers map ──────────────────────────────
 * Each key matches a section id from DASHBOARD_INTERNAL_ORDER.
 * Returns a JSX block or null when the section has no data.
 * The ctx object includes { lang, profile, t, onItemClick, ...data } so
 * each renderer reads translations and click handlers from one envelope.
 */
/* ─── "View all" affordance for section headers with a dedicated tab ───
 * Switches the profile tab (e.g. courses grid → Courses tab) via the
 * onViewAll callback threaded from CreatorPublicProfile.handleTabChange.
 */
const ViewAll = ({ onClick, lang }) => (
  <button type="button" className="csp-view-all" onClick={onClick}>
    {lang === 'ht' ? 'Wè tout' : 'View all'}
    <i className="fas fa-arrow-right" aria-hidden="true" />
  </button>
);

const DASHBOARD_SECTION_RENDERERS = {
  activities: ({ activities, lang, t }) =>
    activities?.length > 0 ? (
      <div className="csp-card-m3" key="activities">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-bolt" /></span>
          <span className="csp-card-m3-title">{t.profile_latest_activity || 'Latest Activity'}</span>
        </div>
        <div className="csp-timeline">
          {activities.slice(0, 5).map((ev, i) => (
            <div key={ev.id || i} className="csp-timeline-item">
              <span className="csp-timeline-dot" aria-hidden="true" />
              <span className="csp-timeline-text">{ev.text || ev.description || ev.type}</span>
              {ev.created_at && <span className="csp-timeline-time">{fmtDate(ev.created_at, lang)}</span>}
            </div>
          ))}
        </div>
      </div>
    ) : null,

  courses: ({ courses, lang, onItemClick, onViewAll, t }) =>
    courses?.length > 0 ? (
      <div className="csp-card-m3" key="courses">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-graduation-cap" /></span>
          <span className="csp-card-m3-title">{t.profile_courses || 'Courses'}</span>
          {onViewAll && <ViewAll onClick={() => onViewAll('courses')} lang={lang} />}
        </div>
        <div className="csp-card-grid">
          {courses.slice(0, 6).map((course) => (
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
              onOpen={() => onItemClick('course', course.id, course)}
            />
          ))}
        </div>
      </div>
    ) : null,

  products: ({ products, lang, onItemClick, onViewAll, t }) =>
    products?.length > 0 ? (
      <div className="csp-card-m3" key="products">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-cube" /></span>
          <span className="csp-card-m3-title">{t.profile_products || 'Products'}</span>
          {onViewAll && <ViewAll onClick={() => onViewAll('products')} lang={lang} />}
        </div>
        <div className="csp-card-grid">
          {products.slice(0, 6).map((product) => (
            <ProfileCatalogCard
              key={product.id}
              title={product.title}
              image={product.image_url}
              description={product.description}
              icon="fa-cube"
              typeLabel={lang === 'ht' ? 'Pwodwi' : 'Product'}
              price={`$${product.price || 0}`}
              freeLabel={lang === 'ht' ? 'Gratis' : 'Free'}
              rating={product.rating}
              isFeatured={!!product.is_featured}
              isNew={isNewItem(product.created_at)}
              isPopular={product.sales_count >= 25}
              badgeLabels={{
                featured: lang === 'ht' ? 'Rekòmande' : 'Featured',
                new: lang === 'ht' ? 'Nouvo' : 'New',
                popular: lang === 'ht' ? 'Popilè' : 'Popular',
              }}
              extra={product.sales_count > 0 ? <span>· {fmtCount(product.sales_count)} {lang === 'ht' ? 'vann' : 'sold'}</span> : null}
              onOpen={() => onItemClick('product', product.id, product)}
            />
          ))}
        </div>
      </div>
    ) : null,

  jobs: ({ jobs, lang, onItemClick, t }) =>
    jobs?.length > 0 ? (
      <div className="csp-card-m3" key="jobs">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-briefcase" /></span>
          <span className="csp-card-m3-title">{t.profile_jobs || (lang === 'ht' ? 'Travay' : 'Jobs')}</span>
        </div>
        <div className="csp-card-grid">
          {jobs.slice(0, 6).map((job) => {
            const budget = job.budget_min != null && job.budget_max != null
              ? `$${Number(job.budget_min)}-${Number(job.budget_max)}${job.currency && job.currency !== 'USD' ? ` ${job.currency}` : ''}`
              : null;
            return (
              <ProfileCatalogCard
                key={job.id}
                title={job.title}
                image={job.cover_url}
                description={job.description}
                icon="fa-briefcase"
                typeLabel={lang === 'ht' ? 'Travay' : 'Job'}
                price={budget}
                extra={<>{job.is_remote && <span>· {t.explore_remote || 'Remote'}</span>}{job.location && <span>· {job.location}</span>}</>}
                onOpen={() => onItemClick('job', job.id, job)}
              />
            );
          })}
        </div>
      </div>
    ) : null,

  portfolio: ({ portfolio, lang, onItemClick, onViewAll, t }) =>
    portfolio?.length > 0 ? (
      <div className="csp-card-m3" key="portfolio">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-briefcase" /></span>
          <span className="csp-card-m3-title">{t.profile_portfolio || 'Portfolio'}</span>
          {onViewAll && <ViewAll onClick={() => onViewAll('portfolio')} lang={lang} />}
        </div>
        <div className="csp-card-grid">
          {portfolio.slice(0, 6).map((project) => (
            <ProfileCatalogCard
              key={project.id}
              title={project.title}
              image={project.image_url}
              description={project.description}
              icon="fa-briefcase"
              typeLabel={lang === 'ht' ? 'Pòtfolyo' : 'Portfolio'}
              rating={project.rating}
              extra={<>{project.category && <span className="csp-catalog-card-chip">{project.category}</span>}{project.views > 0 && <span>· {fmtCount(project.views)} {lang === 'ht' ? 'vizit' : 'views'}</span>}</>}
              onOpen={() => onItemClick('portfolio', project.id, project)}
            />
          ))}
        </div>
      </div>
    ) : null,

  music: ({ picks, lang, onItemClick }) =>
    picks?.music?.length > 0 ? (
      <div className="csp-card-m3" key="music">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-music" /></span>
          <span className="csp-catalog-card-title">Music</span>
        </div>
        <div className="csp-picks-grid">
          {picks.music.slice(0, 6).map((row) => {
            const m = row.music || {};
            return (
              <div key={row.id} className="csp-picks-card" role="button" tabIndex={0}
                onClick={() => onItemClick('music', row.id, m)}
                onKeyDown={(e) => e.key === 'Enter' && onItemClick('music', row.id, m)}>
                <div className="csp-picks-card-cover">
                  {m.cover_url ? (
                    <img src={m.cover_url} alt={m.title || ''} loading="lazy" />
                  ) : (
                    <span className="csp-picks-card-cover-fallback"><i className="fas fa-music" /></span>
                  )}
                </div>
                <div className="csp-picks-card-body">
                  <div className="csp-picks-card-title">{m.title}</div>
                  {m.artist && <div className="csp-picks-card-sub">{m.artist}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null,

  talents: ({ picks, lang, onItemClick, t }) =>
    picks?.talents?.length > 0 ? (
      <div className="csp-card-m3" key="talents">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-star" /></span>
          <span className="csp-card-m3-title">{t.profile_talents || 'Talents'}</span>
        </div>
        <div className="csp-picks-grid">
          {picks.talents.slice(0, 6).map((row) => {
            const t = row.talent || {};
            return (
              <div key={row.id} className="csp-picks-card" role="button" tabIndex={0}
                onClick={() => onItemClick('talent', row.id, t)}
                onKeyDown={(e) => e.key === 'Enter' && onItemClick('talent', row.id, t)}>
                <div className="csp-picks-card-cover">
                  {t.avatar_url ? (
                    <img src={t.avatar_url} alt={t.name || ''} loading="lazy" />
                  ) : (
                    <span className="csp-picks-card-cover-fallback">
                      {(t.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="csp-picks-card-body">
                  <div className="csp-picks-card-title">{t.name}</div>
                  {t.role && <div className="csp-picks-card-sub">{t.role}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null,

  achievements: ({ achievements, lang }) =>
    achievements?.length > 0 ? (
      <div className="csp-card-m3" key="achievements">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-trophy" /></span>
          <span className="csp-card-m3-title">Achievements</span>
        </div>
        <div className="csp-achievement-row">
          {achievements.slice(0, 12).map((ach, i) => (
            <span key={ach.id || i} className="csp-achievement-badge">
              <i className={`fas ${ach.icon || 'fa-medal'}`} aria-hidden="true" />
              {ach.title || ach.achievement?.name || ach.name || ach.badge_name || `Achievement ${i + 1}`}
            </span>
          ))}
        </div>
      </div>
    ) : null,

  reviews: ({ reviews, lang, onViewAll, t }) =>
    reviews?.length > 0 ? (
      <div className="csp-card-m3" key="reviews">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-star" /></span>
          <span className="csp-card-m3-title">{t.profile_reviews || 'Reviews'}</span>
          {onViewAll && <ViewAll onClick={() => onViewAll('reviews')} lang={lang} />}
        </div>
        {reviews.slice(0, 4).map((review) => (
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
            {review.product_title && (
              <div className="csp-review-product">
                <i className="fas fa-box" aria-hidden="true" /> {review.product_title}
              </div>
            )}
            {review.comment && <p className="csp-review-text">{review.comment}</p>}
          </div>
        ))}
      </div>
    ) : null,

  tippers: ({ tipLeaders, lang, t }) =>
    tipLeaders?.length > 0 ? (
      <div className="csp-card-m3" key="tippers">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-hand-holding-heart" /></span>
          <span className="csp-card-m3-title">{t.profile_top_tippers || 'Top Tippers'}</span>
        </div>
        <div className="csp-tippers-list">
          {tipLeaders.slice(0, 5).map((row, i) => (
            <div key={row.user_id || i} className="csp-tipper-row">
              <span className={`csp-tipper-rank${i < 3 ? ' csp-tipper-rank--medal' : ''}`} aria-hidden="true">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </span>
              <span className="csp-tipper-name">@{row.username}</span>
              <span className="csp-tipper-total">${row.total}</span>
              <span className="csp-tipper-count">
                {fmtCount(row.tip_count)} {lang === 'ht' ? 'tip' : 'tips'}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null,

  communities: ({ communities, lang, onItemClick, t }) =>
    communities?.length > 0 ? (
      <div className="csp-card-m3" key="communities">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-users" /></span>
          <span className="csp-card-m3-title">{t.profile_communities || 'Communities'}</span>
        </div>
        <div className="csp-card-grid">
          {communities.slice(0, 6).map((comm) => (
            <div key={comm.id} className="csp-catalog-card" role="button" tabIndex={0}
              onClick={() => onItemClick('community', comm.id, comm)}
              onKeyDown={(e) => e.key === 'Enter' && onItemClick('community', comm.id, comm)}>
              <div className="csp-catalog-card-body">
                <div className="csp-catalog-card-title">{comm.name}</div>
                {comm.member_count > 0 && (
                  <div className="csp-catalog-card-meta">{fmtCount(comm.member_count)} members</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null,

  events: ({ events, lang, onItemClick, t }) =>
    events?.length > 0 ? (
      <div className="csp-card-m3" key="events">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-calendar-alt" /></span>
          <span className="csp-card-m3-title">{t.profile_events || 'Events'}</span>
        </div>
        <div className="csp-timeline">
          {events.slice(0, 5).map((ev) => (
            <div key={ev.id} className="csp-timeline-item" role="button" tabIndex={0}
              onClick={() => onItemClick('event', ev.id, ev)}
              onKeyDown={(e) => e.key === 'Enter' && onItemClick('event', ev.id, ev)}>
              <span className="csp-timeline-dot" aria-hidden="true" />
              <span className="csp-timeline-text">{ev.title}</span>
              {ev.date && <span className="csp-timeline-time">{fmtDate(ev.date, lang)}</span>}
            </div>
          ))}
        </div>
      </div>
    ) : null,

  affiliateOffers: ({ affiliateOffers, lang, t }) =>
    affiliateOffers?.length > 0 ? (
      <div className="csp-card-m3" key="affiliateOffers">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-hand-holding-usd" /></span>
          <span className="csp-card-m3-title">{t.profile_affiliate_offers || 'Affiliate Offers'}</span>
        </div>
        {affiliateOffers.slice(0, 4).map((offer) => (
          <div key={offer.id} className="csp-compact-card" style={{ marginBottom: 6 }}>
            <span className="csp-compact-card-icon"><i className="fas fa-hand-holding-usd" /></span>
            <div className="csp-compact-card-body">
              <div className="csp-compact-card-title">{offer.title}</div>
              <div className="csp-compact-card-meta">${offer.commission || 0} commission</div>
            </div>
          </div>
        ))}
      </div>
    ) : null,

  campaigns: ({ campaigns, lang, t }) =>
    campaigns?.length > 0 ? (
      <div className="csp-card-m3" key="campaigns">
        <div className="csp-card-m3-header">
          <span className="csp-card-m3-icon"><i className="fas fa-bullhorn" /></span>
          <span className="csp-card-m3-title">{t.profile_campaigns || 'Campaigns'}</span>
        </div>
        {campaigns.slice(0, 4).map((camp) => (
          <div key={camp.id} className="csp-compact-card" style={{ marginBottom: 6 }}>
            <span className="csp-compact-card-icon"><i className="fas fa-bullhorn" /></span>
            <div className="csp-compact-card-body">
              <div className="csp-compact-card-title">{camp.title}</div>
              <div className="csp-compact-card-meta">
                {camp.status}
                {camp.commission_pct != null && ` · ${camp.commission_pct}% commission`}
                {camp.total_sales != null && ` · ${fmtCount(camp.total_sales)} sales`}
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : null,
};

/**
 * DashboardTab — render dashboard sections in the configured order.
 *
 * Accepts a ``sectionOrder`` array (from section_config.section_order)
 * and iterates it, calling the matching renderer from
 * DASHBOARD_SECTION_RENDERERS. Unknown section IDs are silently skipped.
 * Sections whose data is empty (null returned by renderer) are also skipped.
 */
export default function DashboardTab({
  profile, lang, t,
  activities, courses, products, portfolio, jobs,
  picks, achievements, reviews,
  communities, events, affiliateOffers, campaigns,
  tipLeaders,
  onItemClick, onViewAll,
}) {
  const ctx = {
    activities, courses, products, portfolio, jobs,
    picks, achievements, reviews,
    communities, events, affiliateOffers, campaigns,
    tipLeaders,
    lang, profile, t, onItemClick, onViewAll,
  };

  return (
    <div className="csp-dashboard">
      {DASHBOARD_INTERNAL_ORDER.map((sectionId) => {
        const renderer = DASHBOARD_SECTION_RENDERERS[sectionId];
        if (!renderer) return null;
        return renderer(ctx);
      })}
    </div>
  );
}

// Dashboard-internal section order (renderer keys, not tab-level IDs).
// Tab-level section_order has 'dashboard','picks','about' which don't
// match DASHBOARD_SECTION_RENDERERS keys ('talents','music','activities'…).
const DASHBOARD_INTERNAL_ORDER = [
  'tippers', 'activities', 'courses', 'products', 'portfolio', 'jobs',
  'music', 'talents', 'achievements', 'reviews',
  'communities', 'events', 'affiliateOffers', 'campaigns',
];

// Re-export the renderer map for editor preview wiring (Stage C/D).
// Note: not consumed outside the dashboard tab today.
export { DASHBOARD_SECTION_RENDERERS };
