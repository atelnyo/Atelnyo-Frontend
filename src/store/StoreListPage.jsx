import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { storeService } from './storeService';
import SEOHead from '../components/shared/SEOHead';
import ProductCard from './ProductCard';
import { clearRecentlyViewed, loadRecentlyViewed } from './recentlyViewed';
import { prefetchProductRoute } from './prefetchProductRoute';

const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '-created_at', label: 'Newest' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
];

const KIND_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'digital', label: 'Digital' },
  { value: 'physical', label: 'Physical' },
  { value: 'service', label: 'Services' },
  { value: 'subscription', label: 'Subscriptions' },
];

export default function StoreListPage() {
  const { categorySlug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const ordering = SORT_OPTIONS.some((o) => o.value === params.get('ordering')) ? params.get('ordering') : '';
  const kindParam = params.get('kind') || '';
  const kind = KIND_OPTIONS.some((o) => o.value === kindParam) ? kindParam : '';
  const parsedPage = Number.parseInt(params.get('page') || '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [recent, setRecent] = useState(() => loadRecentlyViewed());
  // Warm the product page chunk while the listing is on screen. Desktop
  // hover already does this, but a touch tap has no hover phase; without
  // the warm-up the click would still wait for the lazy chunk download.
  useEffect(() => {
    prefetchProductRoute();
  }, []);
  useEffect(() => {
    const refresh = () => setRecent(loadRecentlyViewed());
    window.addEventListener('storage', refresh);
    window.addEventListener('store-recently-viewed-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('store-recently-viewed-changed', refresh);
    };
  }, []);

  // One category fetch powers both the nav and the category-page lookup.
  // null means "still loading"; [] means the request finished empty/failed.
  const [categories, setCategories] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    storeService.listCategories(controller.signal)
      .then(({ data }) => {
        if (!cancelled) {
          setCategories(Array.isArray(data) ? data : data?.results || []);
        }
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const categoryList = categories || [];
  const categoryHit = categorySlug
    ? categoryList.find((c) => c.slug === categorySlug)
    : null;
  const catStatus = !categorySlug
    ? 'none'
    : categories === null
      ? 'loading'
      : categoryHit ? 'found' : 'missing';
  const catId = categoryHit ? categoryHit.id : null;
  const categoryName = categoryHit?.name
    || (categorySlug ? categorySlug.replace(/-/g, ' ') : '');

  // Products are keyed by their inputs so a stale result is never shown.
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = `${q}|${catStatus}|${catId ?? ''}|${kind}|${ordering}|${page}|${retryTick}`;
  const [products, setProducts] = useState({ key: '', status: 'loading', items: [], count: null, hasNext: false });

  useEffect(() => {
    if (catStatus === 'loading' || catStatus === 'missing') {
      return undefined;
    }
    let cancelled = false;
    const query = {};
    if (q) {
      query.q = q;
    }
    if (catStatus === 'found') {
      query.category_id = catId;
    }
    if (kind) {
      query.kind = kind;
    }
    if (ordering) {
      query.ordering = ordering;
    }
    if (page > 1) {
      query.page = page;
    }
    storeService
      .listProducts(Object.keys(query).length ? query : undefined)
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        const items = Array.isArray(data) ? data : data?.results || [];
        setProducts({
          key: requestKey,
          status: items.length ? 'ready' : 'empty',
          items,
          count: typeof data?.count === 'number' ? data.count : null,
          hasNext: Boolean(data?.next),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setProducts({ key: requestKey, status: 'error', items: [], count: null, hasNext: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [q, catStatus, catId, kind, ordering, page, retryTick, requestKey]);

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value == null) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setParams(next);
  };

  if (catStatus === 'missing') {
    return (
      <section className="store-state">
        <SEOHead title="Category not found" description="This category does not exist." noindex />
        <h1 className="store-title">Category not found</h1>
        <p><Link to="/store">Back to the Store</Link></p>
      </section>
    );
  }

  const categoryHeading = categorySlug && catStatus === 'found'
    ? categoryName
    : '';
  const heading = q
    ? (categoryHeading ? `Results for "${q}" in ${categoryHeading}` : `Results for "${q}"`)
    : categoryHeading || 'Atelnyo Store - Shop Digital Products & Creator Goods';

  const current = products.key === requestKey ? products : { status: 'loading', items: [], count: null, hasNext: false };

  const seoTitle = categorySlug && catStatus === 'found'
    ? `${categoryName.replace(/\b\w/g, l => l.toUpperCase())} | Atelnyo Store`
    : q
    ? `Search: ${q} | Atelnyo Store`
    : 'Atelnyo Store - Buy Digital Products, Courses & Creator Goods Online';

  const seoDesc = categorySlug && catStatus === 'found'
    ? `Shop ${categoryName} products from creators on Atelnyo Store. Buy digital downloads, courses, and more.`
    : q
    ? `Search results for "${q}" on Atelnyo Store. Discover digital products and creator goods.`
    : 'Shop the Atelnyo Store for digital products, online courses, music, and creator goods. Secure checkout with instant access to digital downloads.';

  return (
    <section className="store-listing" aria-labelledby="store-listing-title">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        url={categorySlug ? `/store/categories/${categorySlug}` : q ? '/store/search' : '/store'}
        image="https://atelnyo.site/icon-store.png"
        noindex={Boolean(q) || Boolean(kind)}
      />
      <h1 id="store-listing-title" className={categorySlug || q ? 'store-title' : 'store-listing__title'}>
        {heading}
      </h1>

      {categoryList.length > 0 && (
        <nav className="store-categories" aria-label="Categories">
          <Link to="/store" className={!categorySlug ? 'is-active' : ''} aria-current={!categorySlug ? 'page' : undefined}>
            All
          </Link>
          {categoryList.map((c) => (
            <Link
              key={c.id}
              to={`/store/categories/${encodeURIComponent(c.slug)}`}
              className={c.slug === categorySlug ? 'is-active' : ''}
              aria-current={c.slug === categorySlug ? 'page' : undefined}
            >
              {c.name || c.slug}
            </Link>
          ))}
        </nav>
      )}

      <div className="store-toolbar">
        <form
          className="store-toolbar__search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get('q');
            updateParams({ q: String(value || '').trim(), page: '' });
          }}
        >
          <label className="store-sr-only" htmlFor="store-search">Search products</label>
          <input
            key={q}
            id="store-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search products"
            autoComplete="off"
          />
          <button type="submit" className="store-btn">Search</button>
          {q && (
            <button
              type="button"
              className="store-btn store-btn--ghost"
              onClick={() => updateParams({ q: '', page: '' })}
            >
              Clear
            </button>
          )}
        </form>
        {current.count != null && (
          <p className="store-toolbar__count" aria-live="polite">{current.count} products</p>
        )}
        <label className="store-toolbar__kind">
          <span>Type</span>
          <select value={kind} onChange={(e) => updateParams({ kind: e.target.value, page: '' })}>
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="store-toolbar__sort">
          <span>Sort by</span>
          <select value={ordering} onChange={(e) => updateParams({ ordering: e.target.value, page: '' })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {!categorySlug && !q && page === 1 && recent.length > 0 && (
        <section className="store-recent" aria-labelledby="store-recent-title">
          <div className="store-recent__head">
            <h2 id="store-recent-title">Recently viewed</h2>
            <button
              type="button"
              className="store-recent__clear"
              onClick={() => { clearRecentlyViewed(); setRecent([]); }}
            >
              Clear
            </button>
          </div>
          <ul className="store-recent__rail">
            {recent.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
        </section>
      )}

      {current.status === 'loading' && (
        <ul className="store-skeleton-grid" aria-label="Loading products" role="status">
          {Array.from({ length: 8 }).map((_, idx) => (
            <li key={idx} className="store-skeleton-card" aria-hidden="true">
              <div className="store-skeleton-card__media" />
              <div className="store-skeleton-card__body">
                <div className="store-skeleton-card__line store-skeleton-card__line--category" />
                <div className="store-skeleton-card__line store-skeleton-card__line--title" />
                <div className="store-skeleton-card__line store-skeleton-card__line--price" />
              </div>
            </li>
          ))}
        </ul>
      )}
      {current.status === 'error' && (
        <div className="store-state store-state--error">
          <p role="alert">Products could not be loaded. Please try again later.</p>
          <button type="button" className="store-btn store-btn--ghost" onClick={() => setRetryTick((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {current.status === 'empty' && (
        <div className="store-state" role="status">
          <p>No products found.</p>
          {(q || kind || categorySlug) && (
            <div className="store-state__actions">
              {q && (
                <button type="button" className="store-btn store-btn--ghost" onClick={() => updateParams({ q: '', page: '' })}>
                  Clear search
                </button>
              )}
              {kind && (
                <button type="button" className="store-btn store-btn--ghost" onClick={() => updateParams({ kind: '', page: '' })}>
                  Clear type filter
                </button>
              )}
              {!q && categorySlug && <Link to="/store" className="store-btn store-btn--ghost">Browse all products</Link>}
            </div>
          )}
        </div>
      )}

      {current.status === 'ready' && (
        <ul className="store-grid">
          {current.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}

      {current.status === 'ready' && (page > 1 || current.hasNext) && (
        <nav className="store-pager" aria-label="Pagination">
          <button type="button" className="store-btn store-btn--ghost" disabled={page <= 1} onClick={() => updateParams({ page: page - 1 === 1 ? '' : page - 1 })}>
            Previous
          </button>
          <span>Page {page}</span>
          <button type="button" className="store-btn store-btn--ghost" disabled={!current.hasNext} onClick={() => updateParams({ page: page + 1 })}>
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
