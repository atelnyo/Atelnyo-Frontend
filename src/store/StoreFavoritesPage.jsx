import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';

export default function StoreFavoritesPage() {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState({ status: 'loading', items: [] });

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    storeService
      .listFavorites()
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : data?.results || [];
        setState({ status: rows.length ? 'ready' : 'empty', items: rows });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <section className="store-state">
        <h1 className="store-title">Favorites</h1>
        <p><Link to="/store/login?next=/store/favorites">Sign in</Link> to see your saved products.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="store-favorites-title">
      <h1 id="store-favorites-title" className="store-title">Favorites</h1>
      {state.status === 'loading' && <p className="store-state" role="status">Loading favorites…</p>}
      {state.status === 'error' && (
        <p className="store-state store-state--error" role="alert">Favorites could not be loaded.</p>
      )}
      {state.status === 'empty' && <p className="store-state">You have no saved products yet.</p>}
      {state.status === 'ready' && (
        <ul className="store-favorites">
          {state.items.map((f) => (
            <li key={f.id}>
              <Link to={`/store/products/${encodeURIComponent(f.product_slug || f.product)}`}>
                {f.product_title || f.product_slug || `Product #${f.product}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
