/**
 * Store product cache + intent prefetch.
 *
 * Opening a product used to start every network request only after the
 * click: the lazy route chunk, then GET /marketplace/products/<slug>/
 * (~1.4s against production in our measurement), then the gallery image.
 *
 * Two cheap improvements live here:
 *   • rememberProduct() keeps recently fetched/listed products in memory
 *     for a few minutes, so back/forward and repeat visits render at once;
 *   • prefetchProduct() warms the SAME request when a card is hovered,
 *     focused or touched, before the shopper commits to the click.
 *
 * Only public catalog data is cached — never order or account data.
 */
import { storeService } from './storeService';

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

function canPrefetch() {
  const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (!conn) return true;
  return !(conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
}

/** Cached product for a slug or id, or null when missing/expired. */
export function readCachedProduct(ref) {
  if (ref === null || ref === undefined || ref === '') return null;
  const key = String(ref);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

/** Store a product under BOTH its id and slug. Returns the product. */
export function rememberProduct(product) {
  if (!product || product.id === null || product.id === undefined) return product;
  const entry = { data: product, at: Date.now() };
  cache.set(String(product.id), entry);
  if (product.slug) cache.set(String(product.slug), entry);
  return product;
}

/**
 * Warm the product request for a future navigation. Deduped, silent on
 * failure, and skipped on data-saver / 2G connections.
 */
export function prefetchProduct(ref) {
  if (ref === null || ref === undefined || ref === '' || !canPrefetch()) {
    return Promise.resolve(null);
  }
  const key = String(ref);
  const cached = readCachedProduct(key);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(key)) return inflight.get(key);

  const request = storeService.getProduct(key)
    .then(({ data }) => rememberProduct(data))
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** Test/account-switch helper — public catalog data only. */
export function clearProductCache() {
  cache.clear();
  inflight.clear();
}
