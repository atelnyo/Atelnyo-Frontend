/**
 * Legacy product URLs → the single Store product detail.
 *
 * Handles all historical shapes:
 *   /marketplace/:id
 *   /:key/product                 (legacy `id@user`)
 *   /:slug/by/:user/product       (canonical pre-Store content URL)
 */
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { storeProductPath } from './routing';

function decode(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

export default function LegacyProductRedirect() {
  const { id, key, slug } = useParams();
  const raw = slug || id || key || '';
  // Legacy keys are `slug@username`; the Store only needs the slug/id.
  const ref = decode(raw).split('@')[0];
  const to = storeProductPath({ id: ref }) || '/store';
  return <Navigate to={to} replace />;
}
