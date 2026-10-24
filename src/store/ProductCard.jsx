import React from 'react';
import { Link } from 'react-router-dom';

const money = (value, currency = 'USD') => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
};

// One card for every Store listing. Only renders fields the product actually has.
export default function ProductCard({ product: p }) {
  const href = `/store/products/${encodeURIComponent(p.slug || p.id)}`;
  return (
    <li className="store-card">
      <Link to={href} className="store-card__link">
        {p.image_url ? (
          <img className="store-card__img" src={p.image_url} alt={p.title || ''} loading="lazy" />
        ) : (
          <div className="store-card__img store-card__img--empty" aria-hidden="true" />
        )}
        <h2 className="store-card__title">{p.title}</h2>
      </Link>
      <p className="store-card__price">{money(p.price, p.currency || 'USD')}</p>
    </li>
  );
}
