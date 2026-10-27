import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';
import { addToCart, loadCart, saveCart } from './cart';
import SEOHead from '../components/shared/SEOHead';

const money = (value, currency = 'USD') => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
};

// Plain-text version of a description. Descriptions may be HTML (Printify
// imports), so we never inject them; we just show the text.
const toText = (value) => {
  if (!value) {
    return '';
  }
  if (typeof document === 'undefined') {
    return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const el = document.createElement('div');
  el.innerHTML = String(value);
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
};

const SHORT_DESC_LIMIT = 220;

const Stars = ({ value }) => {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className="store-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rounded ? 'is-on' : ''}>★</span>
      ))}
    </span>
  );
};

export default function StoreProductPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ status: 'loading', product: null });
  const [activeImg, setActiveImg] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState({ kind: '', text: '' });
  // { productId, id } of the saved favorite for the product on screen.
  const [favorite, setFavorite] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [review, setReview] = useState({ rating: 0, title: '', body: '' });
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState({ kind: '', text: '' });
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    storeService
      .getProduct(slug)
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        setActiveImg(0);
        setVariantId(data?.variants?.[0]?.id ?? null);
        setQuantity(1);
        setState({ status: 'ready', product: data });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        const notFound = err?.response?.status === 404;
        setState({ status: notFound ? 'notfound' : 'error', product: null });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadedId = state.product?.id;
  useEffect(() => {
    if (!user || !loadedId) {
      return undefined;
    }
    let cancelled = false;
    storeService
      .listFavorites({ product: loadedId })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : data?.results || [];
        setFavorite(rows[0] ? { productId: loadedId, id: rows[0].id } : null);
      })
      .catch(() => {
        if (!cancelled) setFavorite(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loadedId]);

  if (state.status === 'loading') {
    return (
      <section className="store-product store-product--skeleton" aria-busy="true" aria-live="polite">
        <div className="store-product__media store-skeleton-block store-skeleton-block--media" />
        <div className="store-product__info">
          <div className="store-skeleton-block store-skeleton-block--title" />
          <div className="store-skeleton-block store-skeleton-block--rule" />
          <div className="store-skeleton-block store-skeleton-block--line" />
          <div className="store-skeleton-block store-skeleton-block--line store-skeleton-block--short" />
          <div className="store-skeleton-block store-skeleton-block--price" />
          <div className="store-skeleton-block store-skeleton-block--btn" />
        </div>
      </section>
    );
  }
  if (state.status === 'notfound') {
    return (
      <section className="store-state">
        <h1 className="store-title">Product not found</h1>
        <p><Link to="/store">Back to the Store</Link></p>
      </section>
    );
  }
  if (state.status === 'error') {
    return <p className="store-state store-state--error" role="alert">This product could not be loaded.</p>;
  }

  const p = state.product;
  const currency = p.currency || 'USD';
  const gallery = [p.image_url, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean);
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const variant = variants.find((v) => v.id === variantId) || null;
  // Stock comes from the backend; the client only caps the selector.
  const stock = variant ? variant.stock : p.stock;
  const maxQty = stock == null ? 99 : Math.max(0, Math.min(99, stock));
  const price = variant ? variant.price ?? p.price : p.price;
  const compareAt = Number(p.compare_at_price);
  const showCompare = Number.isFinite(compareAt) && compareAt > Number(price);
  const outOfStock = maxQty === 0;
  const reviewCount = Number(p.review_count) || 0;
  const avgRating = Number(p.avg_rating) || 0;
  const description = toText(p.description);
  const isSaved = !!user && favorite?.productId === p.id;
  const highlights = Array.isArray(p.highlights) ? p.highlights.filter(Boolean) : [];
  const descTooLong = description.length > SHORT_DESC_LIMIT;
  const shortDesc = descTooLong
    ? `${description.slice(0, SHORT_DESC_LIMIT).replace(/\s+\S*$/, '')}…`
    : description;

  const onAdd = () => {
    const items = addToCart(loadCart(), {
      productId: p.id,
      variantId,
      quantity: Math.min(quantity, maxQty || 1),
    });
    saveCart(items);
    window.dispatchEvent(new Event('store-cart-changed'));
    setNotice({ kind: 'ok', text: 'Added to cart.' });
  };

  const onBuyNow = () => {
    onAdd();
    navigate('/store/cart');
  };

  const onToggleFavorite = async () => {
    if (!user) {
      navigate(`/store/login?next=${encodeURIComponent(`/store/products/${p.slug || p.id}`)}`);
      return;
    }
    setFavBusy(true);
    try {
      if (isSaved) {
        await storeService.removeFavorite(favorite.id);
        setFavorite(null);
        setNotice({ kind: 'ok', text: 'Removed from favorites.' });
      } else {
        const { data } = await storeService.addFavorite(p.id);
        setFavorite(data?.id ? { productId: p.id, id: data.id } : null);
        setNotice({ kind: 'ok', text: 'Saved to favorites.' });
      }
    } catch {
      setNotice({ kind: 'error', text: 'Could not update favorites. Try again.' });
    } finally {
      setFavBusy(false);
    }
  };

  const onSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate(`/store/login?next=${encodeURIComponent(`/store/products/${p.slug || p.id}`)}`);
      return;
    }
    if (review.rating < 1) {
      setReviewNotice({ kind: 'error', text: 'Choose a rating from 1 to 5.' });
      return;
    }
    setReviewBusy(true);
    setReviewNotice({ kind: '', text: '' });
    try {
      await storeService.createReview({
        product: p.id,
        rating: review.rating,
        title: review.title.trim(),
        body: review.body.trim(),
      });
      setReview({ rating: 0, title: '', body: '' });
      setReviewNotice({ kind: 'ok', text: 'Thanks for your review.' });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setReviewNotice({
        kind: 'error',
        text: detail || 'Could not submit your review. Try again.',
      });
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <article className="store-product">
      <SEOHead
        title={p.title}
        description={description}
        image={p.image_url || undefined}
        url={`/store/products/${p.slug || p.id}`}
        type="product"
      />

      <div className="store-product__info">
        <h1 className="store-product__title">{p.title}</h1>
        <span className="store-product__rule" aria-hidden="true" />

        <div className="store-product__rating">
          <Stars value={avgRating} />
          <span>{reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</span>
        </div>

        <div className="store-product__pricebox">
          <p className="store-product__price">{money(price, currency)}</p>
          {showCompare && (
            <p className="store-product__compare"><s>{money(compareAt, currency)}</s></p>
          )}
        </div>

        {variants.length > 0 && (
          <label className="store-field">
            <span>Variant</span>
            <select value={variantId ?? ''} onChange={(e) => setVariantId(Number(e.target.value))}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.color, v.size].filter(Boolean).join(' / ') || v.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="store-product__buy">
          <button type="button" className="store-buy" onClick={onAdd} disabled={outOfStock}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
            Add to cart
          </button>
          <button type="button" className="store-buy store-buy--now" onClick={onBuyNow} disabled={outOfStock}>
            Buy now
          </button>
          <button
            type="button"
            className="store-fav"
            aria-pressed={isSaved}
            onClick={onToggleFavorite}
            disabled={favBusy}
          >
            {isSaved ? 'Saved' : 'Save to favorites'}
          </button>
          <div className="store-qty" role="group" aria-label="Quantity">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={outOfStock || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              −
            </button>
            <span aria-live="polite">{outOfStock ? 0 : quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={outOfStock || quantity >= maxQty}
              onClick={() => setQuantity((q) => Math.min(maxQty || 1, q + 1))}
            >
              +
            </button>
          </div>
        </div>
        <p className="store-product__stock">{outOfStock ? 'Out of stock' : 'In stock'}</p>
        {notice.text && (
          <p role="status" className={`store-product__notice${notice.kind === 'ok' ? ' is-ok' : ''}`}>
            {notice.text}
          </p>
        )}

        {highlights.length > 0 && (
          <section className="store-product__highlights" aria-labelledby="store-highlights-title">
            <h2 id="store-highlights-title">Highlights</h2>
            <ul>
              {highlights.map((h, i) => (
                <li key={`${i}-${h}`}>{String(h)}</li>
              ))}
            </ul>
          </section>
        )}

        {description && (
          <div className="store-product__desc">
            <p>{descOpen || !descTooLong ? description : shortDesc}</p>
            {descTooLong && (
              <button
                type="button"
                className="store-product__more"
                aria-expanded={descOpen}
                onClick={() => setDescOpen((o) => !o)}
              >
                {descOpen ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        <section className="store-review" aria-labelledby="store-review-title">
          <h2 id="store-review-title">Write a review</h2>
          {user ? (
            <form onSubmit={onSubmitReview}>
              <fieldset className="store-review__rating">
                <legend>Your rating</legend>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="store-review__star">
                    <input
                      type="radio"
                      name="rating"
                      value={n}
                      checked={review.rating === n}
                      onChange={() => setReview((r) => ({ ...r, rating: n }))}
                    />
                    <span aria-hidden="true">{n <= review.rating ? '★' : '☆'}</span>
                    <span className="store-review__sr">{n} {n === 1 ? 'star' : 'stars'}</span>
                  </label>
                ))}
              </fieldset>
              <label className="store-field">
                <span>Title (optional)</span>
                <input
                  type="text"
                  maxLength={200}
                  value={review.title}
                  onChange={(e) => setReview((r) => ({ ...r, title: e.target.value }))}
                />
              </label>
              <label className="store-field">
                <span>Review (optional)</span>
                <textarea
                  rows={4}
                  value={review.body}
                  onChange={(e) => setReview((r) => ({ ...r, body: e.target.value }))}
                />
              </label>
              <button type="submit" className="store-buy" disabled={reviewBusy}>
                {reviewBusy ? 'Submitting…' : 'Submit review'}
              </button>
              {reviewNotice.text && (
                <p role="status" className={`store-product__notice${reviewNotice.kind === 'ok' ? ' is-ok' : ''}`}>
                  {reviewNotice.text}
                </p>
              )}
            </form>
          ) : (
            <p>
              <Link to={`/store/login?next=${encodeURIComponent(`/store/products/${p.slug || p.id}`)}`}>Sign in</Link> to review this product.
            </p>
          )}
        </section>
      </div>

      <div className="store-product__media">
        {gallery.length > 0 ? (
          <div
            className="store-product__stage"
            tabIndex={0}
            role="region"
            aria-label="Image gallery. Use left and right arrow keys to change image."
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setActiveImg((i) => (i + 1) % gallery.length);
              if (e.key === 'ArrowLeft') setActiveImg((i) => (i - 1 + gallery.length) % gallery.length);
            }}
          >
            <button
              type="button"
              className="store-gallery__arrow store-gallery__arrow--prev"
              aria-label="Previous image"
              disabled={gallery.length < 2}
              onClick={() => setActiveImg((i) => (i - 1 + gallery.length) % gallery.length)}
            >
              ‹
            </button>
            <img className="store-product__main" src={gallery[activeImg]} alt={p.title || ''} />
            <button
              type="button"
              className="store-gallery__arrow store-gallery__arrow--next"
              aria-label="Next image"
              disabled={gallery.length < 2}
              onClick={() => setActiveImg((i) => (i + 1) % gallery.length)}
            >
              ›
            </button>
          </div>
        ) : (
          <div className="store-product__stage">
            <div className="store-product__main store-card__img--empty" aria-hidden="true" />
          </div>
        )}
        {gallery.length > 1 && (
          <div className="store-thumbs-wrap">
            <ul className="store-thumbs" aria-label="Product images">
              {gallery.map((src, i) => (
                <li key={`${i}-${src}`}>
                  <button
                    type="button"
                    className={`store-thumbs__btn${i === activeImg ? ' is-active' : ''}`}
                    aria-label={`Show image ${i + 1}`}
                    aria-pressed={i === activeImg}
                    onClick={() => setActiveImg(i)}
                  >
                    <img src={src} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
