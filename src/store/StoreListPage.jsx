import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { storeService } from './storeService';
import SEOHead from '../components/shared/SEOHead';
import ProductCard from './ProductCard';

const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '-created_at', label: 'Newest' },
  { value: 'price', label: 'Price: low to high' },
  { value: '-price', label: 'Price: high to low' },
];

export default function StoreListPage() {
  const { categorySlug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const ordering = SORT_OPTIONS.some((o) => o.value === params.get('ordering')) ? params.get('ordering') : '';
  const parsedPage = Number.parseInt(params.get('page') || '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [categories, setCategories] = useState([]);
  useEffect(() => {
    let cancelled = false;
    storeService.listCategories()
      .then(({ data }) => {
        if (!cancelled) {
          setCategories(Array.isArray(data) ? data : data?.results || []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Category page: resolve the slug to a real category id. Results are keyed
  // by slug so a stale result for a previous slug is ignored (treated as loading).
  const [category, setCategory] = useState({ slug: '', status: 'none', id: null });

  useEffect(() => {
    if (!categorySlug) {
      return undefined;
    }
    let cancelled = false;
    storeService.listCategories()
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        const list = Array.isArray(data) ? data : data?.results || [];
        const hit = list.find((c) => c.slug === categorySlug);
        setCategory({ slug: categorySlug, status: hit ? 'found' : 'missing', id: hit ? hit.id : null });
      })
      .catch(() => {
        if (!cancelled) {
          setCategory({ slug: categorySlug, status: 'missing', id: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  const catStatus = !categorySlug
    ? 'none'
    : category.slug === categorySlug
      ? category.status
      : 'loading';
  const catId = catStatus === 'found' ? category.id : null;

  // Products are keyed by their inputs so a stale result is never shown.
  const requestKey = `${q}|${catStatus}|${catId ?? ''}|${ordering}|${page}`;
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
  }, [q, catStatus, catId, ordering, page, requestKey]);

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

  const heading = categorySlug && catStatus === 'found'
    ? categorySlug.replace(/-/g, ' ')
    : q ? `Results for "${q}"` : 'Atelnyo Store';

  const current = products.key === requestKey ? products : { status: 'loading', items: [], count: null, hasNext: false };

  return (
    <section className="store-listing" aria-labelledby="store-listing-title">
      <SEOHead
        title={heading}
        description="Shop digital and creator products on the Atelnyo Store."
        url={categorySlug ? `/store/categories/${categorySlug}` : q ? '/store/search' : '/store'}
        noindex={Boolean(q)}
      />
      <h1 id="store-listing-title" className={categorySlug || q ? 'store-title' : 'store-listing__title'}>
        {heading}
      </h1>

      {categories.length > 0 && (
        <nav className="store-categories" aria-label="Categories">
          <Link to="/store" className={!categorySlug ? 'is-active' : ''} aria-current={!categorySlug ? 'page' : undefined}>
            All
          </Link>
          {categories.map((c) => (
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
        {current.count != null && (
          <p className="store-toolbar__count" aria-live="polite">{current.count} products</p>
        )}
        <label className="store-toolbar__sort">
          <span>Sort by</span>
          <select value={ordering} onChange={(e) => updateParams({ ordering: e.target.value, page: '' })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

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
        <p className="store-state store-state--error" role="alert">
          Products could not be loaded. Please try again later.
        </p>
      )}
      {current.status === 'empty' && <p className="store-state">No products found.</p>}

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
