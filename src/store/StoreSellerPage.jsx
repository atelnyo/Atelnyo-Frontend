/**
 * StoreSellerPage — one seller's storefront inside the Store client.
 *
 * The catalog API already filters by seller (`?seller=<username>`), and the
 * creator public-profile API supplies the shop identity (display name,
 * avatar, bio) for sellers that have one. A seller without a profile (e.g.
 * a staff-run shop) still gets a working storefront: the page falls back to
 * the bare @username instead of hiding their live products.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { storeService } from './storeService';
import SEOHead from '../components/shared/SEOHead';
import ProductCard from './ProductCard';

export default function StoreSellerPage() {
  const { username = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const parsedPage = Number.parseInt(params.get('page') || '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState({
    status: 'loading', items: [], count: null, hasNext: false,
  });
  const [retryTick, setRetryTick] = useState(0);

  // Shop identity is best-effort: a 404 (no public profile yet) must never
  // stop the products from rendering.
  useEffect(() => {
    let cancelled = false;
    if (!username) {
      return undefined;
    }
    storeService
      .getSellerProfile(username)
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    let cancelled = false;
    if (!username) {
      return undefined;
    }
    storeService
      .listSellerProducts(username, page > 1 ? { page } : undefined)
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        const items = Array.isArray(data) ? data : data?.results || [];
        setProducts({
          status: items.length ? 'ready' : 'empty',
          items,
          count: typeof data?.count === 'number' ? data.count : null,
          hasNext: Boolean(data?.next),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setProducts({ status: 'error', items: [], count: null, hasNext: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [username, page, retryTick]);

  const displayName = profile?.display_name || profile?.artist_name || `@${username}`;
  const avatar = profile?.avatar_url || '';
  const bio = (profile?.bio || '').trim();
  const initial = (displayName || username || '?').replace(/^@/, '').charAt(0).toUpperCase();
  const count = products.count;

  const goToPage = (next) => {
    const search = new URLSearchParams(params);
    if (next <= 1) {
      search.delete('page');
    } else {
      search.set('page', String(next));
    }
    setParams(search);
  };

  return (
    <section className="store-seller">
      <SEOHead
        title={`${displayName} | Atelnyo Store`}
        description={
          bio || `Shop live products from ${displayName} on Atelnyo Store.`
        }
        image={avatar || undefined}
        url={`/store/sellers/${encodeURIComponent(username)}`}
      />

      <nav className="store-seller__crumbs" aria-label="Breadcrumb">
        <Link to="/store">Store</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">@{username}</span>
      </nav>

      <header className="store-seller__hero">
        {avatar ? (
          <img
            className="store-seller__avatar"
            src={avatar}
            alt=""
            width="72"
            height="72"
            loading="lazy"
          />
        ) : (
          <span className="store-seller__initial" aria-hidden="true">{initial}</span>
        )}
        <div className="store-seller__identity">
          <h1 className="store-seller__name">{displayName}</h1>
          <p className="store-seller__handle">@{username}</p>
          {bio && <p className="store-seller__bio">{bio}</p>}
          {count != null && (
            <p className="store-seller__meta">
              {count} {count === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>
      </header>

      {products.status === 'loading' && products.items.length === 0 && (
        <ul className="store-skeleton-grid" aria-label="Loading products" role="status">
          {[0, 1, 2, 3].map((idx) => (
            <li key={idx} className="store-skeleton-card" aria-hidden="true">
              <div className="store-skeleton-card__media" />
              <div className="store-skeleton-card__body">
                <div className="store-skeleton-card__line" />
                <div className="store-skeleton-card__line store-skeleton-card__line--short" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {products.status === 'error' && (
        <div className="store-state store-state--error" role="alert">
          <p>Could not load this seller&apos;s products.</p>
          <button
            type="button"
            className="store-btn store-btn--ghost"
            onClick={() => setRetryTick((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {products.status === 'empty' && (
        <div className="store-state" role="status">
          <p>This seller has no live products right now.</p>
          <div className="store-state__actions">
            <Link className="store-btn store-btn--ghost" to="/store">Browse the Store</Link>
          </div>
        </div>
      )}

      {products.status === 'ready' && (
        <ul className="store-grid">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}

      {products.status === 'ready' && (page > 1 || products.hasNext) && (
        <nav className="store-pager" aria-label="Pagination">
          <button
            type="button"
            className="store-btn store-btn--ghost"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            className="store-btn store-btn--ghost"
            disabled={!products.hasNext}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
