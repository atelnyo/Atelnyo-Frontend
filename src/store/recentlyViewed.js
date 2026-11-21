/**
 * Recently viewed Store products — local-only browsing history.
 *
 * No server call and no account linkage: the list lives in localStorage
 * and is capped so it cannot grow without bound. Only card-relevant fields
 * are stored, never descriptions or other heavy payloads.
 */
const KEY = 'atelnyo.store.recently-viewed.v1';
export const RECENTLY_VIEWED_LIMIT = 8;

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isEntry(value) {
  return value
    && typeof value === 'object'
    && value.id != null
    && typeof value.title === 'string'
    && value.title.trim() !== '';
}

function snapshot(product) {
  const variants = Array.isArray(product?.variants)
    ? product.variants.map((v) => ({
      id: v?.id,
      price: v?.price,
      stock: v?.stock,
    }))
    : undefined;
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    currency: product.currency,
    compare_at_price: product.compare_at_price,
    image_url: product.image_url,
    gallery: Array.isArray(product.gallery) ? product.gallery.slice(0, 4) : undefined,
    variants,
    stock: product.stock,
    avg_rating: product.avg_rating,
    review_count: product.review_count,
    category: product.category,
    created_at: product.created_at,
  };
}

export function loadRecentlyViewed() {
  const store = storage();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, RECENTLY_VIEWED_LIMIT);
  } catch {
    return [];
  }
}

/** Put a product at the front, de-duplicated by id, and return the new list. */
export function recordRecentlyViewed(product) {
  if (!isEntry(product)) return loadRecentlyViewed();
  const entry = snapshot(product);
  const next = [
    entry,
    ...loadRecentlyViewed().filter((row) => String(row.id) !== String(entry.id)),
  ].slice(0, RECENTLY_VIEWED_LIMIT);

  const store = storage();
  try {
    store?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota full: the rail simply won't persist.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('store-recently-viewed-changed'));
  }
  return next;
}

export function clearRecentlyViewed() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('store-recently-viewed-changed'));
  }
}
