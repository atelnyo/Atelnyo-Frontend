import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { storeService } from './storeService';
import SEOHead from '../components/shared/SEOHead';

const money = (value, currency = 'USD') => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
};

export default function StoreListPage() {
  const { categorySlug = '' } = useParams();
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();

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
  const requestKey = `${q}|${catStatus}|${catId ?? ''}`;
  const [products, setProducts] = useState({ key: '', status: 'loading', items: [] });

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
    storeService
      .listProducts(Object.keys(query).length ? query : undefined)
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        const items = Array.isArray(data) ? data : data?.results || [];
        setProducts({ key: requestKey, status: items.length ? 'ready' : 'empty', items });
      })
      .catch(() => {
        if (!cancelled) {
          setProducts({ key: requestKey, status: 'error', items: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [q, catStatus, catId, requestKey]);

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

  const current = products.key === requestKey ? products : { status: 'loading', items: [] };

  return (
    <section className="store-listing" aria-labelledby="store-listing-title">
      <SEOHead
        title={heading}
        description="Shop digital and creator products on the Atelnyo Store."
        url={categorySlug ? `/store/categories/${categorySlug}` : q ? '/store/search' : '/store'}
        noindex={Boolean(q)}
      />
      <h1 id="store-listing-title" className="store-title">
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

      {current.status === 'loading' && <p className="store-state" role="status">Loading products…</p>}
      {current.status === 'error' && (
        <p className="store-state store-state--error" role="alert">
          Products could not be loaded. Please try again later.
        </p>
      )}
      {current.status === 'empty' && <p className="store-state">No products found.</p>}

      {current.status === 'ready' && (
        <ul className="store-grid">
          {current.items.map((p) => (
            <li key={p.id} className="store-card">
              <Link to={`/store/products/${encodeURIComponent(p.slug || p.id)}`} className="store-card__link">
                {p.image_url ? (
                  <img className="store-card__img" src={p.image_url} alt={p.title || ''} loading="lazy" />
                ) : (
                  <div className="store-card__img store-card__img--empty" aria-hidden="true" />
                )}
                <h2 className="store-card__title">{p.title}</h2>
              </Link>
              <p className="store-card__price">{money(p.price, p.currency || 'USD')}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
