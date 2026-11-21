/**
 * Canonical path for a product inside the isolated Store namespace.
 * Feed items and Explore cards may arrive with a slug or only an id;
 * the Store route accepts either (StoreProductPage resolves via the API).
 */
export function storeProductPath(product) {
  const ref = product?.slug || product?.id;
  if (ref === null || ref === undefined || ref === '') return null;
  return `/store/products/${encodeURIComponent(String(ref))}`;
}
