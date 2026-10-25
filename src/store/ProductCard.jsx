import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addToCart, loadCart, saveCart } from './cart';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';

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
  const user = useAuthStore((s) => s.user);
  const [favoriteId, setFavoriteId] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const images = [p.image_url, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [spun, setSpun] = useState(false);
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Track whether the card is actually on screen, so rotation only runs when a visitor can see it.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Auto-rotate the gallery twice like an ad strip, then stop on the first image.
  useEffect(() => {
    if (!visible || hovered || spun || images.length < 2) return undefined;
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
  }, [visible, hovered, spun, images.length]);

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

  useEffect(() => {
    if (!user || !p.id) return undefined;
    let cancelled = false;
    storeService
      .listFavorites({ product: p.id })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : data?.results || [];
        setFavoriteId(rows[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, p.id]);

  const onToggleFavorite = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate(`/store/login?next=${encodeURIComponent(href)}`);
      return;
    }
    setFavBusy(true);
    try {
      if (favoriteId) {
        await storeService.removeFavorite(favoriteId);
        setFavoriteId(null);
      } else {
        const { data } = await storeService.addFavorite(p.id);
        setFavoriteId(data?.id ?? null);
      }
    } catch {
      // Leave the saved state unchanged; the user can retry.
    } finally {
      setFavBusy(false);
    }
  };

  const onBuyNow = (e) => {
    e.preventDefault();
    addOne();
    navigate('/store/cart');
  };

  return (
    <li className="store-card" ref={cardRef}>
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
          <button
            type="button"
            className={`store-card__fav${favoriteId ? ' is-saved' : ''}`}
            aria-pressed={Boolean(favoriteId)}
            aria-label={favoriteId ? 'Remove from favorites' : 'Save to favorites'}
            title={favoriteId ? 'Remove from favorites' : 'Save to favorites'}
            onClick={onToggleFavorite}
            disabled={favBusy}
          >
            {favoriteId ? '♥' : '♡'}
          </button>
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
