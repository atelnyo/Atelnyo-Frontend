import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { cartCount, loadCart } from './cart';
import { useAuthStore } from './useAuthStore';
import './store.css';

export default function StoreLayout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [count, setCount] = useState(() => cartCount(loadCart()));
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const refresh = () => setCount(cartCount(loadCart()));
    window.addEventListener('storage', refresh);
    window.addEventListener('store-cart-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('store-cart-changed', refresh);
    };
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/store/search?q=${encodeURIComponent(q)}` : '/store/search');
  };

  return (
    <div className="store-root">
      <header className="store-header">
        <Link to="/store" className="store-header__brand">Atelnyo Store</Link>
        <form className="store-header__search" role="search" onSubmit={onSearch}>
          <label className="store-sr-only" htmlFor="store-search-input">Search products</label>
          <span className="store-header__search-icon" aria-hidden="true">⌕</span>
          <input
            id="store-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
          />
        </form>
        <nav className="store-header__nav" aria-label="Store">
          <button
            type="button"
            className="store-btn store-btn--ghost store-header__toggle"
            aria-expanded={menuOpen}
            aria-controls="store-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
          <ul id="store-menu" className={`store-header__menu${menuOpen ? ' is-open' : ''}`}>
            <li><Link to="/store" onClick={() => setMenuOpen(false)}>All products</Link></li>
            <li>
              <Link to={user ? '/account' : '/login'} onClick={() => setMenuOpen(false)}>
                {user ? 'Account' : 'Sign in'}
              </Link>
            </li>
          </ul>
        </nav>
        <Link
          to={user ? '/account' : '/login'}
          className="store-header__account"
          aria-label={user ? 'Account' : 'Sign in'}
          title={user ? 'Account' : 'Sign in'}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
        </Link>
        <Link to="/store/cart" className="store-header__cart" aria-label={`Cart, ${count} items`}>
          Cart <span className="store-badge">{count}</span>
        </Link>
      </header>
      <main className="store-main">
        <Outlet />
      </main>
    </div>
  );
}

export function StoreNotFound() {
  return (
    <section className="store-state">
      <h1 className="store-title">Page not found</h1>
      <p><Link to="/store">Back to the Store</Link></p>
    </section>
  );
}
