/**
 * Store cart — client-side state holding only { productId, variantId, quantity }.
 * Prices, stock and totals are NEVER stored here; the backend recalculates
 * them at order time, so client-side tampering cannot change what is charged.
 */

export const CART_STORAGE_KEY = 'atelnyo_store_cart_v1';
export const MAX_LINE_QUANTITY = 99;

const clampQty = (qty) => {
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LINE_QUANTITY);
};

const sameLine = (a, b) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);

export function addToCart(items, { productId, variantId = null, quantity = 1 }) {
  const qty = clampQty(quantity);
  const next = { productId, variantId: variantId ?? null, quantity: qty };
  const idx = items.findIndex((it) => sameLine(it, next));
  if (idx === -1) return [...items, next];
  return items.map((it, i) =>
    i === idx ? { ...it, quantity: clampQty(it.quantity + qty) } : it,
  );
}

export function setQuantity(items, { productId, variantId = null, quantity }) {
  const target = { productId, variantId: variantId ?? null };
  return items.map((it) =>
    sameLine(it, target) ? { ...it, quantity: clampQty(quantity) } : it,
  );
}

export function removeFromCart(items, { productId, variantId = null }) {
  const target = { productId, variantId: variantId ?? null };
  return items.filter((it) => !sameLine(it, target));
}

export function cartCount(items) {
  return items.reduce((sum, it) => sum + clampQty(it.quantity), 0);
}

/** Restores the cart from storage; drops anything malformed. */
export function loadCart(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && Number.isFinite(Number(it.productId)))
      .map((it) => ({
        productId: Number(it.productId),
        variantId: it.variantId == null ? null : Number(it.variantId),
        quantity: clampQty(it.quantity),
      }));
  } catch {
    return [];
  }
}

export function saveCart(items, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode) — cart stays in memory only */
  }
}
