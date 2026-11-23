import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { storeService } from './storeService';
import { readCachedProduct, rememberProduct } from './productCache';
import { useAuthStore } from './useAuthStore';
import { addToCart, loadCart, saveCart } from './cart';
import SEOHead from '../components/shared/SEOHead';
import ProductCard from './ProductCard';
import { recordRecentlyViewed } from './recentlyViewed';

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
  const location = useLocation();
  // The listing card already holds the full product and passes it through
  // router state; the cache covers back/forward and repeat visits. Either
  // way the first paint is immediate instead of waiting ~1.4s for the API.
  const routeProduct = location.state?.storeProduct;
  const seededProduct = (
    routeProduct
    && (String(routeProduct.slug) === String(slug) || String(routeProduct.id) === String(slug))
  ) ? routeProduct : readCachedProduct(slug);
  const [state, setState] = useState(() => (
    seededProduct
      ? { status: 'ready', product: seededProduct }
      : { status: 'loading', product: null }
  ));
  // Last product id actually painted — lets a silent revalidation refresh
  // the data without resetting the shopper's selected variant/quantity.
  const shownIdRef = useRef(seededProduct?.id ?? null);
  const [activeImg, setActiveImg] = useState(0);
  // Seed the first variant too: when the page paints from router state or
  // cache, the effect skips the reset path (same product id), so a null
  // initial value would add the base product instead of the first option.
  const [variantId, setVariantId] = useState(
    () => seededProduct?.variants?.[0]?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState({ kind: '', text: '' });
  // { productId, id } of the saved favorite for the product on screen.
  const [favorite, setFavorite] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const [related, setRelated] = useState({ status: 'idle', items: [] });
  const [relatedRetry, setRelatedRetry] = useState(0);
  const [productRetry, setProductRetry] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [review, setReview] = useState({ rating: 0, title: '', body: '' });
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState({ kind: '', text: '' });
  // Orders of the signed-in buyer that contain this product — the backend
  // requires every review to reference one of them (ReviewSerializer).
  const [eligibleOrders, setEligibleOrders] = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    const routeData = location.state?.storeProduct;
    const seeded = (
      routeData
      && (String(routeData.slug) === String(slug) || String(routeData.id) === String(slug))
    ) ? routeData : readCachedProduct(slug);

    if (seeded) {
      if (shownIdRef.current !== seeded.id) {
        setActiveImg(0);
        setVariantId(seeded?.variants?.[0]?.id ?? null);
        setQuantity(1);
        shownIdRef.current = seeded.id;
      }
      setState({ status: 'ready', product: seeded });
    } else {
      shownIdRef.current = null;
      setState({ status: 'loading', product: null });
    }

    // Always revalidate in the background: a stale price/stock must correct
    // itself, but the shopper sees the cached product immediately.
    storeService
      .getProduct(slug)
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        rememberProduct(data);
        if (shownIdRef.current !== data?.id) {
          setActiveImg(0);
          setVariantId(data?.variants?.[0]?.id ?? null);
          setQuantity(1);
          shownIdRef.current = data?.id ?? null;
        }
        setState({ status: 'ready', product: data });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        // A failed refresh never replaces a product we can already show.
        if (seeded) return;
        const notFound = err?.response?.status === 404;
        setState({ status: notFound ? 'notfound' : 'error', product: null });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, productRetry, location.state]);

  // Local-only browsing history; never sent to the server.
  useEffect(() => {
    if (state.status === 'ready' && state.product) {
      recordRecentlyViewed(state.product);
    }
  }, [state]);

  const loadedId = state.product?.id;
  // Review eligibility needs the buyer's orders, but loading them on page
  // open competed with the product image and the related rail. Load them
  // only when the review form is touched (or a review is submitted).
  const eligiblePromiseRef = useRef(null);
  useEffect(() => {
    setEligibleOrders(null);
    eligiblePromiseRef.current = null;
  }, [user, loadedId]);

  const ensureEligibleOrders = () => {
    if (!user || !loadedId) return Promise.resolve([]);
    if (Array.isArray(eligibleOrders)) return Promise.resolve(eligibleOrders);
    if (eligiblePromiseRef.current) return eligiblePromiseRef.current;
    eligiblePromiseRef.current = storeService
      .listOrders()
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : data?.results || [];
        const matching = rows.filter((o) =>
          Array.isArray(o?.items) && o.items.some((it) => Number(it?.product) === Number(loadedId)),
        );
        // Newest purchase first so the review attaches to the latest order.
        matching.sort((a, b) => Number(b?.id) - Number(a?.id));
        setEligibleOrders(matching);
        return matching;
      })
      .catch(() => {
        setEligibleOrders([]);
        return [];
      })
      .finally(() => {
        eligiblePromiseRef.current = null;
      });
    return eligiblePromiseRef.current;
  };
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

  // "You may also like" — non-blocking: a failure never hides the
  // product itself, it only replaces the rail with a retry.
  useEffect(() => {
    if (!loadedId) {
      return undefined;
    }
    let cancelled = false;
    setRelated({ status: 'loading', items: [] });
    storeService
      .listRelated(loadedId)
      .then(({ data }) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : data?.results || [];
        setRelated({ status: items.length ? 'ready' : 'empty', items });
      })
      .catch(() => {
        if (!cancelled) setRelated({ status: 'error', items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [loadedId, relatedRetry]);

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
    return (
      <section className="store-state store-state--error">
        <p role="alert">This product could not be loaded.</p>
        <button
          type="button"
          className="store-btn store-btn--ghost"
          onClick={() => {
            setState({ status: 'loading', product: null });
            setProductRetry((n) => n + 1);
          }}
        >
          Try again
        </button>
      </section>
    );
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
    // The backend rejects reviews without a purchase backing them — pick
    // the buyer's latest order containing this product.
    const orders = await ensureEligibleOrders();
    const orderId = Array.isArray(orders) && orders.length > 0 ? orders[0].id : null;
    if (!orderId) {
      setReviewNotice({
        kind: 'error',
        text: 'You can only review products you have purchased. Buy it first, then come back to leave a review.',
      });
      setReviewBusy(false);
      return;
    }
    try {
      await storeService.createReview({
        product: p.id,
        ...(orderId ? { order: orderId } : {}),
        rating: review.rating,
        title: review.title.trim(),
        body: review.body.trim(),
      });
      setReview({ rating: 0, title: '', body: '' });
      setReviewNotice({ kind: 'ok', text: 'Thanks for your review.' });
    } catch (err) {
      const data = err?.response?.data;
      const first = (v) => (Array.isArray(v) ? v[0] : v);
      const detail = typeof data === 'object' && data !== null
        ? first(data.detail) || first(data.order) || first(data.product) || first(data.rating) || first(data.non_field_errors)
        : data;
      setReviewNotice({
        kind: 'error',
        text: detail || 'Could not submit your review. Try again.',
      });
    } finally {
      setReviewBusy(false);
    }
  };

  const productDesc = description.length > 155 ? description.slice(0, 152) + '...' : description;
  return (
    <article className="store-product">
      <SEOHead
        title={`${p.title} | Atelnyo Store`}
        description={productDesc || `Buy ${p.title} on Atelnyo Store. Digital products from creators.`}
        image={p.image_url || undefined}
        url={`/store/products/${encodeURIComponent(p.slug || p.id)}`}
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
            <form
              onSubmit={onSubmitReview}
              onFocus={() => { ensureEligibleOrders(); }}
            >
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
              {Array.isArray(eligibleOrders) && eligibleOrders.length === 0 && (
                <p className="store-product__notice" role="note">
                  Only buyers can review — purchase this product first, then your review form will work.
                </p>
              )}
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

      {related.status !== 'idle' && related.status !== 'empty' && (
        <section className="store-product__related" aria-labelledby="store-related-title">
          <div className="store-related__head">
            <h2 id="store-related-title">You may also like</h2>
            <Link to="/store" className="store-related__all">See all in Store</Link>
          </div>
          {related.status === 'loading' && (
            <ul className="store-skeleton-grid" aria-label="Loading recommendations" role="status">
              {Array.from({ length: 4 }).map((_, idx) => (
                <li key={idx} className="store-skeleton-card" aria-hidden="true">
                  <div className="store-skeleton-card__media" />
                  <div className="store-skeleton-card__body">
                    <div className="store-skeleton-card__line store-skeleton-card__line--title" />
                    <div className="store-skeleton-card__line store-skeleton-card__line--price" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {related.status === 'error' && (
            <p className="store-state" role="alert">
              Recommendations could not be loaded.{' '}
              <button
                type="button"
                className="store-btn store-btn--ghost"
                onClick={() => setRelatedRetry((n) => n + 1)}
              >
                Try again
              </button>
            </p>
          )}
          {related.status === 'ready' && (
            <ul className="store-grid">
              {related.items.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
