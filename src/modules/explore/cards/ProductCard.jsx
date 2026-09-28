/**
 * src/modules/explore/cards/ProductCard.jsx
 *
 * Marketplace Product card — extracted from Explore.jsx
 */
import React, { useState, useId } from 'react';
import SaveCountChip from './SaveCountChip';
import TrendingVelocity from './TrendingVelocity';

/** Inline SVG fallback — bèl ilistrasyon lè pa gen imaj oswa imaj kase */
function ProductFallback({ title }) {
  // Unique gradient ID per card instance — duplicate SVG <linearGradient>
  // IDs across many cards make browsers resolve url(#id) to the FIRST
  // definition in the DOM, which can render the wrong gradient when
  // cards differ (or throw hydration warnings in SSR).
  const gradId = useId().replace(/:/g, '');
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d81b60" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill={`url(#${gradId})`} />
        <g transform="translate(300,150)" opacity="0.2">
          <rect x="-45" y="-45" width="90" height="90" rx="12" fill="#0ea5e9" />
          <rect x="-30" y="-25" width="60" height="8" rx="4" fill="#0ea5e9" />
          <rect x="-40" y="-8" width="80" height="8" rx="4" fill="#0ea5e9" opacity="0.6" />
          <path d="M-12-12L12-12L0-22Z" fill="#d81b60" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#0ea5e9" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600">
          {title || 'Product'}
        </text>
      </svg>
    </div>
  );
}

/** Map currency codes to display symbols. Fallback = raw code. */
const CURRENCY_SYMBOLS = {
  USD: '$',
  HTG: 'G',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  MXN: 'MX$',
};

function currencySymbol(code) {
  const c = String(code || 'USD').toUpperCase();
  return CURRENCY_SYMBOLS[c] || `${c} `;
}

/** Compact rating row — stars + avg + review count (when rated) */
function ProductRating({ product, t }) {
  const avg = product.avg_rating;
  if (avg == null || Number(avg) <= 0) return null;
  const stars = Math.round(Number(avg));
  return (
    <span className="explore-product-rating" title={`${Number(avg).toFixed(1)} / 5`}>
      <span className="explore-product-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={`${n <= stars ? 'fas' : 'far'} fa-star`}
            style={{ opacity: n <= stars ? 1 : 0.35 }} />
        ))}
      </span>
      <span className="explore-product-rating-value">{Number(avg).toFixed(1)}</span>
      {product.review_count > 0 && (
        <span className="explore-product-rating-count">
          ({product.review_count} {t.explore_marketplace_reviews_short || 'rev'})
        </span>
      )}
    </span>
  );
}

export default function ProductCard({ product, t, onOpen, onOpenCheckout, showToast, saveCount = null, lang = 'ht' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasImage = Boolean(product.image_url);

  const price = product.price != null ? Number(product.price) : 0;
  const isFree = price <= 0;
  const symbol = currencySymbol(product.currency);
  const stock = product.stock;
  const isLowStock = stock != null && stock <= 5;
  const kindKey = String(product.kind || 'digital').toLowerCase();
  const typeMeta = {
    digital: { label: t.explore_marketplace_digital || 'Digital', icon: 'fa-file-arrow-down' },
    physical: { label: t.explore_marketplace_physical || 'Physical', icon: 'fa-box-open' },
    service: { label: t.explore_marketplace_service || 'Service', icon: 'fa-hand-sparkles' },
    subscription: { label: t.explore_marketplace_subscription || 'Subscription', icon: 'fa-repeat' },
  }[kindKey] || { label: t.explore_marketplace_product || 'Product', icon: 'fa-shopping-bag' };
  const typeLabel = typeMeta.label;
  const stockLabel = stock == null
    ? (t.explore_marketplace_unlimited || 'Unlimited')
    : `${stock} ${t.explore_marketplace_stock || 'in stock'}`;
  const shortDescription = (product.description || '').trim();

  function handleBuy() {
    if (!onOpenCheckout) {
      return;
    }
    onOpenCheckout('order', price, { product_id: product.id, title: product.title });
  }

  function handleOpen() {
    onOpen?.(product);
  }

  return (
    <div
      className="explore-card explore-card-product"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
    >
      <div className="explore-card-image-wrap">
        {hasImage && !imgFailed ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <ProductFallback title={product.title} />
        )}
        {product.is_featured && (
          <div className="explore-card-badge explore-card-badge-star" aria-label={t.explore_chip_featured || 'Featured'}>
            <i className="fas fa-star" aria-hidden="true" />
          </div>
        )}
        {/* Trending Velocity — shows how fast this product is rising */}
        {Number(product?._score?.trending) > 10 && (
          <TrendingVelocity
            score={product._score.trending}
            lang={lang || 'ht'}
            size="sm"
          />
        )}
        {/* Popilarite — popularity score from the recommendation engine */}
        {Number(product?._score?.popularity) > 0 && (
          <div
            className="explore-card-badge explore-card-popularity"
            title={`${t.feed_popularity || 'Popularity'}: ${Math.round(Number(product._score.popularity))}`}
          >
            <i className="fas fa-fire" aria-hidden="true" />
            <span>{Math.round(Number(product._score.popularity))}</span>
          </div>
        )}
      </div>
      <div className="explore-card-body">
        <div className="explore-card-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div className="explore-card-title" style={{ flex: 1 }}>
            <i className="fas fa-shopping-bag" aria-hidden="true" style={{ marginRight: 6, opacity: 0.6 }} />
            {product.title}
          </div>
          <span className="explore-card-tag" style={{ whiteSpace: 'nowrap' }}>
            <i className={`fas ${typeMeta.icon}`} aria-hidden="true" style={{ marginRight: 4 }} />
            {typeLabel}
          </span>
        </div>
        {shortDescription && (
          <div className="explore-card-subtitle">
            {shortDescription.length > 110 ? `${shortDescription.slice(0, 110).trim()}…` : shortDescription}
          </div>
        )}
        <ProductRating product={product} t={t} />
        <div className="explore-card-meta">
          <div className="explore-card-meta-left">
            {product.category && <span className="explore-card-tag">{product.category}</span>}
            {!product.is_active && (
              <span className="explore-card-tag" style={{ opacity: 0.7 }}>
                <i className="fas fa-eye-slash" aria-hidden="true" style={{ marginRight: 4 }} />
                {t.explore_marketplace_draft || 'Draft'}
              </span>
            )}
            <span className={`explore-card-tag explore-card-tag-skill${isLowStock ? ' explore-card-tag-low' : ''}`}>
              {stockLabel}
            </span>
            {product.sales_count > 0 && (
              <span className="explore-product-sales">
                <i className="fas fa-cart-arrow-down" aria-hidden="true" /> {product.sales_count}
              </span>
            )}
            <SaveCountChip count={saveCount} t={t} />
          </div>
          <div className="explore-card-meta-right">
            <span className="explore-card-price">
              {isFree ? (
                <span className="explore-card-price-value explore-card-price-free">
                  {t.explore_marketplace_free || 'Free'}
                </span>
              ) : (
                <span className="explore-card-price-value">
                  {symbol}{price.toFixed(2)}
                </span>
              )}
            </span>
            <button
              type="button"
              className="explore-product-buy-btn"
              onClick={(e) => { e.stopPropagation(); handleBuy(); }}
              aria-label={t.explore_marketplace_buy || 'Buy'}
            >
              <i className="fas fa-cart-shopping" aria-hidden="true" />
            </button>
          </div>
        </div>
        {(product.creator_name || product.seller_username) && (
          <div className="explore-card-creator">
            <i className="fas fa-user" aria-hidden="true" />
            <span>{product.creator_name || product.seller_username}</span>
          </div>
        )}
      </div>
    </div>
  );
}
