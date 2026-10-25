import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const images = [p.image_url, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [spun, setSpun] = useState(false);

  // Auto-rotate the gallery twice like an ad strip, then stop on the first image.
  useEffect(() => {
    if (hovered || spun || images.length < 2) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    let ticks = 0;
    const max = images.length * 2;
    const timer = setInterval(() => {
      ticks += 1;
      setImgIdx((i) => (i + 1) % images.length);
      if (ticks >= max) {
        clearInterval(timer);
        setSpun(true);
      }
    }, 800);
    return () => clearInterval(timer);
  }, [hovered, spun, images.length]);

  // Hovering across the image moves through the gallery, like a product strip.
  const onMediaMove = (e) => {
    if (images.length < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const pos = Math.floor(((e.clientX - r.left) / r.width) * images.length);
    setImgIdx(Math.min(images.length - 1, Math.max(0, pos)));
  };
  const onMediaEnter = () => setHovered(true);
  const onMediaLeave = () => {
    setHovered(false);
    setImgIdx(0);
  };

  const addOne = () => {
    const items = addToCart(loadCart(), { productId: p.id, quantity: 1 });
    saveCart(items);
    window.dispatchEvent(new Event('store-cart-changed'));
  };

  const onQuickAdd = (e) => {
    e.preventDefault();
    addOne();
  };

  const onBuyNow = (e) => {
    e.preventDefault();
    addOne();
    navigate('/store/cart');
  };

  return (
    <li className="store-card">
      <Link to={href} className="store-card__link">
        <div className="store-card__media" onMouseEnter={onMediaEnter} onMouseMove={onMediaMove} onMouseLeave={onMediaLeave}>
          {images.length > 0 ? (
            images.map((src, i) => (
              <img
                key={src}
                className={`store-card__img${i === imgIdx ? ' is-active' : ''}`}
                src={src}
                alt={i === 0 ? p.title || '' : ''}
                loading="lazy"
              />
            ))
          ) : (
            <div className="store-card__img store-card__img--empty is-active" aria-hidden="true" />
          )}
          {images.length > 1 && (
            <span className="store-card__dots" aria-hidden="true">
              {images.map((src, i) => (
                <span key={src} className={`store-card__dot${i === imgIdx ? ' is-active' : ''}`} />
              ))}
            </span>
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
        <div className="store-card__actions">
          <button
            type="button"
            className="store-card__add"
            onClick={onQuickAdd}
            disabled={outOfStock}
          >
            {outOfStock ? 'Unavailable' : 'Add to cart'}
          </button>
          {!outOfStock && (
            <button type="button" className="store-card__add store-card__add--buy" onClick={onBuyNow}>
              Buy now
            </button>
          )}
        </div>
      )}
    </li>
  );
}
