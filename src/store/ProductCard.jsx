import React from 'react';
import { Link } from 'react-router-dom';
import { addToCart, loadCart, saveCart } from './cart';

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const money = (value, currency = 'USD') => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
};

const isNew = (createdAt) => {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && Date.now() - t <= NEW_WINDOW_MS;
};

const Stars = ({ rating }) => {
  const filled = Math.round(Number(rating) || 0);
  return (
    <span className="store-card__stars" aria-label={`Rated ${filled} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (i <= filled ? '★' : '☆')).join('')}
    </span>
  );
};

// One card for every Store listing. Only renders fields the product actually has.
export default function ProductCard({ product: p }) {
  const href = `/store/products/${encodeURIComponent(p.slug || p.id)}`;
  const currency = p.currency || 'USD';
  const price = Number(p.price);
  const compareAt = Number(p.compare_at_price);
  const hasSale = Number.isFinite(compareAt) && compareAt > price;
  const reviews = Number(p.review_count) || 0;
  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const outOfStock = p.stock === 0;
  const newBadge = isNew(p.created_at);

  const onQuickAdd = (e) => {
    e.preventDefault();
    const items = addToCart(loadCart(), { productId: p.id, quantity: 1 });
    saveCart(items);
    window.dispatchEvent(new Event('store-cart-changed'));
  };

  return (
    <li className="store-card">
      <Link to={href} className="store-card__link">
        <div className="store-card__media">
          {p.image_url ? (
            <img className="store-card__img" src={p.image_url} alt={p.title || ''} loading="lazy" />
          ) : (
            <div className="store-card__img store-card__img--empty" aria-hidden="true" />
          )}
          {newBadge && <span className="store-card__badge">NEW</span>}
          {outOfStock && <span className="store-card__badge store-card__badge--muted">Out of stock</span>}
        </div>
        {p.category && <p className="store-card__category">{p.category}</p>}
        <h2 className="store-card__title">{p.title}</h2>
        <p className="store-card__rating">
          {reviews > 0 ? (
            <>
              <Stars rating={p.avg_rating} /> <span>({reviews} {reviews === 1 ? 'review' : 'reviews'})</span>
            </>
          ) : (
            <span>(0 reviews)</span>
          )}
        </p>
        <p className="store-card__price">
          <span className="store-card__price-now">{money(p.price, currency)}</span>
          {hasSale && <s className="store-card__price-was">{money(p.compare_at_price, currency)}</s>}
        </p>
      </Link>
      {hasVariants ? (
        <Link to={href} className="store-card__add">Choose options</Link>
      ) : (
        <button
          type="button"
          className="store-card__add"
          onClick={onQuickAdd}
          disabled={outOfStock}
        >
          {outOfStock ? 'Unavailable' : 'Add to cart'}
        </button>
      )}
    </li>
  );
}
