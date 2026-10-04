/**
 * src/components/profile/ProfileSectionContracts.jsx
 *
 * Tier-1 leaf — extracted from CreatorPublicProfile.jsx (stage A-1 refactor).
 *
 * Right-sidebar / dashboard section CONTRACT cards. Each hides when empty.
 * All auto-render nothing if their data is missing (null return).
 *
 * Sections included:
 *   - AboutCard          — bio + skills
 *   - LanguageCard       — language list (Native level)
 *   - QuickLinksCard     — website + social links
 *   - FeaturedProductCard— first product in 'products' (now a hero card)
 *   - ActivityCard       — last 5 timeline events
 *   - CampaignsCard      — last 3 campaigns
 *   - AffiliateCard      — last 3 affiliate offers
 *
 * STAGE A-1: zero behavior change. Exact verbatim copy.
 */

import React from 'react';
import ProfileM3Section from './ProfileM3Section';
import { fmtDate } from './profileUtils';

/* About section — bio + skills */
export function AboutCard({ profile }) {
  if (!profile?.bio && !profile?.skills?.length) return null;
  return (
    <ProfileM3Section icon="fa-user" title="About" configId="about">
      {profile.bio && <p className="csp-about-bio">{profile.bio}</p>}
      {profile.skills?.length > 0 && (
        <div className="csp-skills-row">
          {profile.skills.map((skill, i) => (
            <span key={i} className="csp-skill-chip">{skill}</span>
          ))}
        </div>
      )}
    </ProfileM3Section>
  );
}

/* Languages section */
export function LanguageCard({ languages }) {
  if (!languages?.length) return null;
  return (
    <ProfileM3Section icon="fa-language" title="Languages" configId="languages">
      <div className="csp-lang-row">
        {languages.map((code, i) => (
          <div key={i} className="csp-lang-item">
            <span className="csp-lang-name">{code.toUpperCase()}</span>
            <span className="csp-lang-level">Native</span>
          </div>
        ))}
      </div>
    </ProfileM3Section>
  );
}

/* Quick Links section */
export function QuickLinksCard({ socialLinks, websiteUrl }) {
  const links = [];
  if (websiteUrl) links.push({ icon: 'fa-globe', label: 'Website', url: websiteUrl });
  if (socialLinks) {
    // Handle both formats: {platform: url} (dict) or [{platform, url}] (array)
    let entries = [];
    if (Array.isArray(socialLinks)) {
      entries = socialLinks
        .filter((l) => l && typeof l === 'object' && l.url)
        .map((l) => [l.platform || 'link', l.url]);
    } else if (typeof socialLinks === 'object') {
      entries = Object.entries(socialLinks).filter(([, v]) => v);
    }
    entries.forEach(([platform, url]) => {
      const href = typeof url === 'string' && url.startsWith('http') ? url : `https://${url || ''}`;
      links.push({ icon: `fa-${platform}`, label: platform, url: href });
    });
  }
  // Default social icons mapping (tiktok: C.6 — set by the OAuth connect
  // flow's A.7 social_links sync, rendered here for the first time).
  const iconMap = { youtube: 'fa-youtube', github: 'fa-github', linkedin: 'fa-linkedin', twitter: 'fa-twitter', instagram: 'fa-instagram', facebook: 'fa-facebook', discord: 'fa-discord', telegram: 'fa-telegram', tiktok: 'fa-tiktok' };
  if (links.length === 0) return null;
  return (
    <ProfileM3Section icon="fa-link" title="Quick Links" configId="quicklinks">
      <div className="csp-quicklinks">
        {links.map((link, i) => (
          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="csp-quicklink">
            <i className={`fab ${iconMap[link.label.toLowerCase()] || link.icon}`} aria-hidden="true" />
            <span className="csp-quicklink-label">{link.label}</span>
            <i className="fas fa-chevron-right csp-quicklink-arrow" aria-hidden="true" />
          </a>
        ))}
      </div>
    </ProfileM3Section>
  );
}

/* Featured product section */
export function FeaturedProductCard({ products, onOpenCheckout, profile }) {
  const list = Array.isArray(products) ? products : [];
  // Honor the creator's pinned product (featured_product_id, set in
  // Creator Studio) before falling back to the first product.
  const pinnedId = profile?.featured_product_id;
  const product = (pinnedId != null && list.find((p) => Number(p.id) === Number(pinnedId)))
    || list[0];
  if (!product) return null;
  const hasDiscount = product.original_price && product.original_price > product.price;
  // Phase PayPal — Buy Now routes through the unified CheckoutModal
  // (PayPal PRIMARY).
  const handleBuy = () => {
    const price = Number(product.price) || 0;
    if (price > 0) {
      onOpenCheckout?.('order', price, { product_id: product.id, title: product.title });
    }
  };
  return (
    <ProfileM3Section icon="fa-cube" title="Featured Product" configId="featuredProduct">
      <div className="csp-featured-product">
        {product.image_url ? (
          <img className="csp-featured-product-img" src={product.image_url} alt={product.title} loading="lazy" />
        ) : (
          <div className="csp-featured-product-img-fallback">
            <i className="fas fa-cube" />
          </div>
        )}
        {hasDiscount && (
          <span className="csp-featured-product-discount">
            -{Math.round((1 - product.price / product.original_price) * 100)}%
          </span>
        )}
        <div className="csp-featured-product-body">
          <div className="csp-featured-product-title">{product.title}</div>
          {product.rating > 0 && (
            <div className="csp-featured-product-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <i key={star} className={`${star <= Math.round(product.rating) ? 'fas' : 'far'} fa-star`}
                  style={{ opacity: star <= Math.round(product.rating) ? 1 : 0.25 }} />
              ))}
              <span>({product.review_count || 0})</span>
            </div>
          )}
          <div className="csp-featured-product-footer">
            <span className="csp-featured-product-price">${product.price || 0}</span>
            <button type="button" className="csp-featured-product-buy" onClick={handleBuy}>Buy Now</button>
          </div>
        </div>
      </div>
    </ProfileM3Section>
  );
}

/* Activity timeline */
export function ActivityCard({ activities, lang }) {
  const list = Array.isArray(activities) ? activities : [];
  if (list.length === 0) return null;
  return (
    <ProfileM3Section icon="fa-bolt" title={lang === 'ht' ? 'Aktivite' : 'Activity'} configId="activity">
      <div className="csp-timeline">
        {list.slice(0, 5).map((ev, i) => (
          <div key={ev.id || i} className="csp-timeline-item">
            <span className="csp-timeline-dot" aria-hidden="true" />
            <span className="csp-timeline-text">{ev.text || ev.description || ev.type || 'Activity'}</span>
            {ev.created_at && <span className="csp-timeline-time">{fmtDate(ev.created_at, lang)}</span>}
          </div>
        ))}
      </div>
    </ProfileM3Section>
  );
}

/* Campaigns compact card */
export function CampaignsCard({ campaigns, lang }) {
  const list = Array.isArray(campaigns) ? campaigns : [];
  if (list.length === 0) return null;
  return (
    <ProfileM3Section icon="fa-bullhorn" title={lang === 'ht' ? 'Kanpay' : 'Campaigns'} configId="campaigns">
      {list.slice(0, 3).map((camp) => (
        <div key={camp.id} className="csp-compact-card">
          <span className="csp-compact-card-icon"><i className="fas fa-bullhorn" /></span>            <div className="csp-compact-card-body">
              <div className="csp-compact-card-title">{camp.title}</div>
              <div className="csp-compact-card-meta">
                {camp.status}
                {camp.commission_pct != null && ` · ${camp.commission_pct}% commission`}
                {camp.total_sales != null && ` · ${Number(camp.total_sales).toLocaleString()} sales`}
              </div>
            </div>
        </div>
      ))}
    </ProfileM3Section>
  );
}

/* Affiliate compact card */
export function AffiliateCard({ offers, lang }) {
  const list = Array.isArray(offers) ? offers : [];
  if (list.length === 0) return null;
  return (
    <ProfileM3Section icon="fa-hand-holding-usd" title={lang === 'ht' ? 'Afilye' : 'Affiliate'} configId="affiliate">
      {list.slice(0, 3).map((offer) => (
        <div key={offer.id} className="csp-compact-card">
          <span className="csp-compact-card-icon"><i className="fas fa-hand-holding-usd" /></span>
          <div className="csp-compact-card-body">
            <div className="csp-compact-card-title">{offer.title}</div>
            <div className="csp-compact-card-meta">${offer.commission || 0} commission</div>
          </div>
        </div>
      ))}
    </ProfileM3Section>
  );
}
