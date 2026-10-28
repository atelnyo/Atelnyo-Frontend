import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { cartCount, loadCart } from './cart';
import { useAuthStore } from './useAuthStore';
import './store.css';

export default function StoreLayout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [count, setCount] = useState(() => cartCount(loadCart()));
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);
  const user = useAuthStore((s) => s.user);

  // Close the mobile menu on a click outside it or on Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
      <Helmet>
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="shortcut icon" type="image/png" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </Helmet>
      <header className="store-header">
        <Link to="/store" className="store-header__brand" aria-label="Atelnyo Store - Home">
          <span style={{ fontWeight: 800, letterSpacing: '0.02em' }}>ATELNYO</span>
          <span style={{ marginLeft: '6px', fontWeight: 600, opacity: 0.9 }}>STORE</span>
        </Link>
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
        <nav className="store-header__nav" aria-label="Store" ref={navRef}>
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
            <li><Link to="/store/favorites" onClick={() => setMenuOpen(false)}>Favorites</Link></li>
            <li>
              <Link to={user ? '/account' : '/store/login'} onClick={() => setMenuOpen(false)}>
                {user ? 'Account' : 'Sign in'}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="store-header__actions">
          <Link
            to={user ? '/account' : '/store/login'}
            className="store-header__account"
            aria-label={user ? 'Account' : 'Sign in'}
            title={user ? 'Account' : 'Sign in'}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          </Link>
          <Link to="/store/cart" className="store-header__cart" aria-label={`Cart, ${count} items`}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
            <span className="store-badge">{count}</span>
          </Link>
        </div>
      </header>
      <main className="store-main">
        <Outlet />
      </main>
      <footer className="store-footer">
        <nav aria-label="Store footer">
          <Link to="/store">All products</Link>
          <Link to="/store/cart">Cart</Link>
          <Link to="/store/favorites">Favorites</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/legal/terms-of-service">Terms</Link>
          <Link to="/legal/privacy-policy">Privacy</Link>
          <Link to={user ? '/account' : '/store/login'}>{user ? 'Account' : 'Sign in'}</Link>
        </nav>
        <p>© {new Date().getFullYear()} Atelnyo Store</p>
      </footer>
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
