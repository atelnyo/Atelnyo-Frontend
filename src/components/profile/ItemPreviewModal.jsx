/**
 * src/components/profile/ItemPreviewModal.jsx (v2 — rich detail)
 *
 * Full-screen modal overlay that shows item details inside the
 * Creator Public Profile without navigating away. Supports:
 *   - course  → fetches /courses/<id>/
 *   - product → fetches /marketplace/products/<id>/
 *   - portfolio → fetches /portfolio/projects/<id>/
 *   - event   → fetches /community-events/<id>/
 *   - talent  → shows state data (no fetch needed)
 *   - music   → shows state data (no fetch needed)
 *
 * Shows richer details: price, stats, tags, category, creator info,
 * and a "View full details" button to navigate to the dedicated page.
 *
 * Props:
 *   type   — 'course' | 'product' | 'portfolio' | 'event' | 'talent' | 'music'
 *   id     — numeric ID
 *   data   — optional pre-fetched row data (used by talent / music)
 *   lang   — 'ht' | 'en'
 *   onClose — callback to close the modal
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { buildContentUrl } from '../../utils/contentUrl';
import { isNewItem } from './profileUtils';
import { inlineText } from '../../utils/inlineI18n';

const TYPE_CONFIG = {
  course:    { endpoint: (id) => `/courses/${id}/`, route: (id, data) => (data ? buildContentUrl('course', data) : null),
               titleKey: 'title', imgKey: 'image_url', descKey: 'description',
               priceKey: 'price', stats: ['student_count', 'module_count'],
               tags: ['difficulty', 'category'], icon: 'fa-graduation-cap' },
  product:   { endpoint: (id) => `/marketplace/products/${id}/`, route: (id, data) => (data ? buildContentUrl('product', data) : null),
               titleKey: 'title', imgKey: 'image_url', descKey: 'description',
               priceKey: 'price', stats: ['sales_count'],
               tags: ['category'], icon: 'fa-cube' },
  portfolio: { endpoint: (id) => `/portfolio/projects/${id}/`, route: (id, data) => (data ? buildContentUrl('portfolio', data) : null),
               titleKey: 'title', imgKey: 'image_url', descKey: 'description',
               priceKey: null, stats: ['views', 'category'],
               tags: ['category'], icon: 'fa-briefcase' },
  job:       { endpoint: (id) => `/jobs/${id}/`, route: (id, data) => (data ? buildContentUrl('job', data) : null),
               titleKey: 'title', imgKey: 'cover_url', descKey: 'description',
               priceKey: null, stats: ['budget_type', 'proposal_count', 'location'],
               tags: ['skills_required'], icon: 'fa-briefcase' },
  event:     { endpoint: (id) => `/community-events/${id}/`, route: (id, data) => (data ? buildContentUrl('event', data) : null),
               titleKey: 'title', imgKey: 'image_url', descKey: 'description',
               priceKey: null, stats: ['date', 'location'],
               tags: [], icon: 'fa-calendar' },
  community: { endpoint: null,
               // Route requires a slug — null (no "View full details" button)
               // when the row has none, so we never navigate to /community/.
               route: (id, data) => (data?.slug ? `/community/${data.slug}` : null),
               titleKey: 'name', imgKey: 'avatar_url', descKey: 'description',
               priceKey: null, stats: ['member_count', 'category'],
               tags: [], icon: 'fa-users' },
  talent:    { endpoint: null, route: null,
               titleKey: 'name', imgKey: 'avatar_url', descKey: 'bio',
               priceKey: null, stats: ['role', 'location'],
               tags: ['skills'], icon: 'fa-star' },
  music:     { endpoint: null, route: null,
               titleKey: 'title', imgKey: 'cover_url', descKey: 'description',
               priceKey: null, stats: ['artist', 'genre'],
               tags: ['genre'], icon: 'fa-music' },
};

/* Localized type labels for the modal badge (replaces the raw lowercase
   type string like "course" with a proper label: "Kou" / "Course"). */
const TYPE_LABELS = {
  course: (lang) => (lang === 'ht' ? 'Kou' : inlineText(lang, 'Course')),
  product: (lang) => (lang === 'ht' ? 'Pwodwi' : inlineText(lang, 'Product')),
  portfolio: (lang) => (lang === 'ht' ? 'Pòtfolyo' : inlineText(lang, 'Portfolio')),
  event: (lang) => (lang === 'ht' ? 'Evènman' : inlineText(lang, 'Event')),
  community: (lang) => (lang === 'ht' ? 'Kominote' : inlineText(lang, 'Community')),
  talent: (lang) => (lang === 'ht' ? 'Talan' : inlineText(lang, 'Talent')),
  music: (lang) => (lang === 'ht' ? 'Mizik' : inlineText(lang, 'Music')),
  job: (lang) => (lang === 'ht' ? 'Travay' : inlineText(lang, 'Job')),
};

function fmtCount(n) {
  if (n == null) return '';
  const num = Number(n);
  if (Number.isNaN(num)) return '';
  if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(num);
}

function fmtPrice(price) {
  if (price == null || price === 0) return null;
  return `$${Number(price).toFixed(2)}`;
}

function formatDate(iso, lang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(
      lang === 'ht' ? 'fr-HT' : lang === 'fr' ? 'fr-FR' : inlineText(lang, 'en-US'),
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch (_) { return ''; }
}

export default function ItemPreviewModal({ type, id, data, lang = 'en', onClose }) {
  const navigate = useNavigate();
  const [item, setItem] = useState(data || null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.course;

  useEffect(() => {
    if (data || !cfg.endpoint || !id) return;
    api.get(cfg.endpoint(id))
      .then((res) => { setItem(res.data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [type, id, data]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!cfg) return null;

  const title = item?.[cfg.titleKey] || `${cfg.titleKey} #${id}`;
  const imgUrl = !imgFailed ? item?.[cfg.imgKey] : null;
  const description = item?.[cfg.descKey];
  const price = cfg.priceKey ? fmtPrice(item?.[cfg.priceKey]) : null;
  // Jobs have no price — show the budget range instead ($500-$800 USD).
  const jobBudget = type === 'job' && item?.budget_min != null && item?.budget_max != null
    ? `$${Number(item.budget_min)}-${Number(item.budget_max)}${item.currency && item.currency !== 'USD' ? ` ${item.currency}` : ''}`
    : null;
  const displayPrice = price || jobBudget;
  const isHt = lang === 'ht';
  // Prefer the freshly-fetched payload (slug + user_key) for the canonical
  // deep-link; fall back to the card row when only state data exists.
  const route = cfg.route?.(id, item || data);

  // Status badge — same rules as the catalog cards: Featured wins over
  // New wins over Popular. ``item`` carries is_featured / created_at /
  // counts from the detail payloads (courses + products expose them).
  const badgeInfo = item ? (() => {
    if (item.is_featured) {
      return { cls: 'csp-modal-badge csp-modal-badge--featured', label: isHt ? 'Rekòmande' : inlineText(lang, 'Featured') };
    }
    if (isNewItem(item.created_at)) {
      return { cls: 'csp-modal-badge csp-modal-badge--new', label: isHt ? 'Nouvo' : inlineText(lang, 'New') };
    }
    const count = Number(item.student_count ?? item.sales_count ?? 0);
    if (count >= 25) {
      return { cls: 'csp-modal-badge csp-modal-badge--popular', label: isHt ? 'Popilè' : inlineText(lang, 'Popular') };
    }
    return null;
  })() : null;

  // Build stat items
  const statItems = (cfg.stats || []).map((key) => {
    const val = item?.[key];
    if (val == null) return null;
    const labels = {
      student_count: isHt ? 'Elèv' : inlineText(lang, 'Students'),
      member_count: isHt ? 'Manm' : inlineText(lang, 'Members'),
      module_count: isHt ? 'Modil' : inlineText(lang, 'Modules'),
      sales_count: isHt ? 'Vann' : inlineText(lang, 'Sold'),
      views: isHt ? 'Vizit' : inlineText(lang, 'Views'),
      role: isHt ? 'Wòl' : inlineText(lang, 'Role'),
      location: isHt ? 'Kote' : inlineText(lang, 'Location'),
      budget_type: isHt ? 'Kalite bidjè' : inlineText(lang, 'Budget type'),
      proposal_count: isHt ? 'Pwopozisyon' : inlineText(lang, 'Proposals'),
      artist: 'Artist',
      genre: isHt ? 'Jan' : inlineText(lang, 'Genre'),
      category: isHt ? 'Kategori' : inlineText(lang, 'Category'),
      date: isHt ? 'Dat' : inlineText(lang, 'Date'),
    };
    const icons = {
      student_count: 'fa-graduation-cap',
      member_count: 'fa-users',
      sales_count: 'fa-shopping-cart',
      module_count: 'fa-list',
      views: 'fa-eye',
      role: 'fa-briefcase',
      location: 'fa-map-marker-alt',
      budget_type: 'fa-money-check-alt',
      proposal_count: 'fa-file-signature',
      artist: 'fa-user',
      genre: 'fa-tag',
      category: 'fa-folder',
      date: 'fa-calendar',
    };
    return {
      label: labels[key] || key,
      value: key === 'date' ? formatDate(val, lang)
           : key === 'category' ? val
           : key === 'role' ? val
           : key === 'location' ? val
           : key === 'budget_type' ? val
           : key === 'artist' ? val
           : key === 'genre' ? val
           : fmtCount(val),
      icon: icons[key] || 'fa-info-circle',
    };
  }).filter(Boolean);

  // Build tag items (skills for talent)
  const tags = cfg.tags?.flatMap((key) => {
    const val = item?.[key];
    if (!val) return [];
    if (Array.isArray(val)) return val.slice(0, 5);
    if (typeof val === 'string') return [val];
    return [];
  }) || [];

  return (
    <div className="csp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true"
      aria-label={isHt ? 'Detay' : inlineText(lang, 'Item details')}>
      <div className="csp-modal-content csp-modal-content--wide" onClick={(e) => e.stopPropagation()}>

        {/* Close button */}
        <button type="button" className="csp-modal-close" onClick={onClose}
          aria-label={isHt ? 'Fèmen' : inlineText(lang, 'Close')}>
          <i className="fas fa-times" />
        </button>

        {loading && (
          <div className="csp-modal-loading">
            <i className="fas fa-spinner fa-pulse fa-3x" style={{ color: 'var(--pink-primary)' }} />
          </div>
        )}

        {error && (
          <div className="csp-modal-error">
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
            <p>{isHt ? 'Pa ka chaje detay sa a.' : inlineText(lang, 'Unable to load details.')}</p>
          </div>
        )}

        {item && !loading && (
          <>
            {/* Hero Image */}
            {imgUrl ? (
              <div className="csp-modal-hero">
                <img src={imgUrl} alt={title} className="csp-modal-hero-img"
                  onError={() => setImgFailed(true)} />
                <div className="csp-modal-hero-overlay" />
                {badgeInfo && <span className={badgeInfo.cls}>{badgeInfo.label}</span>}
                {displayPrice && (
                  <div className="csp-modal-hero-price">{displayPrice}</div>
                )}
              </div>
            ) : (
              <div className="csp-modal-hero-fallback">
                <i className={`fas ${cfg.icon || 'fa-image'}`} aria-hidden="true" />
                {badgeInfo && <span className={badgeInfo.cls}>{badgeInfo.label}</span>}
                {displayPrice && (
                  <div className="csp-modal-hero-price" style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    {displayPrice}
                  </div>
                )}
              </div>
            )}

            <div className="csp-modal-body">
              {/* Title + Type */}
              <div className="csp-modal-type-badge">
                <i className={`fas ${cfg.icon}`} aria-hidden="true" />
                {TYPE_LABELS[type]?.(lang) || type}
              </div>
              <h2 className="csp-modal-title">{title}</h2>

              {/* Price / budget inline (if no image) */}
              {!imgUrl && displayPrice && (
                <div className="csp-modal-price-inline">{displayPrice}</div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="csp-modal-tags">
                  {tags.map((tag) => (
                    <span key={tag} className="csp-modal-tag">{tag}</span>
                  ))}
                </div>
              )}

              {/* Stats Grid */}
              {statItems.length > 0 && (
                <div className="csp-modal-stats">
                  {statItems.map((stat) => (
                    <div key={stat.label} className="csp-modal-stat">
                      <i className={`fas ${stat.icon}`} aria-hidden="true" />
                      <div className="csp-modal-stat-info">
                        <span className="csp-modal-stat-value">{stat.value}</span>
                        <span className="csp-modal-stat-label">{stat.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Description */}
              {description && (
                <div className="csp-modal-desc-wrap">
                  <h3 className="csp-modal-section-title">
                    {isHt ? 'Deskripsyon' : inlineText(lang, 'Description')}
                  </h3>
                  <p className="csp-modal-desc">{description}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="csp-modal-actions">
                {route && (
                  <button
                    type="button"
                    className="csp-modal-btn csp-modal-btn--primary"
                    onClick={() => { onClose(); navigate(route); }}
                  >
                    <i className="fas fa-external-link-alt" aria-hidden="true" />
                    {isHt ? 'Wè plis detay' : inlineText(lang, 'View full details')}
                  </button>
                )}
                <button
                  type="button"
                  className="csp-modal-btn csp-modal-btn--secondary"
                  onClick={onClose}
                >
                  {isHt ? 'Fèmen' : inlineText(lang, 'Close')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
