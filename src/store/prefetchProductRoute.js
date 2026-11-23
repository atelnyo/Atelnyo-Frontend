/**
 * Warm the lazy Store product page chunk before the click.
 *
 * The page is a React.lazy route, so without this the first click pays for
 * BOTH the JS chunk download and the product API call. ProductCard calls
 * this on hover/focus/touch intent; the dynamic import keeps StoreProductPage
 * out of every Store listing chunk.
 */
let chunkPromise = null;

function isSlowConnection() {
  const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
  return Boolean(
    conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'),
  );
}

export function prefetchProductRoute() {
  if (isSlowConnection()) return Promise.resolve(null);
  if (!chunkPromise) {
    chunkPromise = import('./StoreProductPage').catch(() => {
      // A failed warm-up must never break the listing; the real click will
      // retry the import through the route loader.
      chunkPromise = null;
      return null;
    });
  }
  return chunkPromise;
}
