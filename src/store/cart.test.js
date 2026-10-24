import { describe, it, expect } from 'vitest';
import {
  addToCart,
  setQuantity,
  removeFromCart,
  cartCount,
  loadCart,
  saveCart,
  CART_STORAGE_KEY,
  MAX_LINE_QUANTITY,
} from './cart';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
};

describe('store cart', () => {
  it('keeps the same product with different variants as separate lines', () => {
    let items = addToCart([], { productId: 1, variantId: 10, quantity: 1 });
    items = addToCart(items, { productId: 1, variantId: 11, quantity: 1 });
    expect(items).toHaveLength(2);
  });

  it('merges repeat adds of the same line and clamps the quantity', () => {
    let items = addToCart([], { productId: 1, quantity: MAX_LINE_QUANTITY });
    items = addToCart(items, { productId: 1, quantity: 5 });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('treats invalid quantities as 1', () => {
    expect(addToCart([], { productId: 1, quantity: 0 })[0].quantity).toBe(1);
    expect(addToCart([], { productId: 1, quantity: 'abc' })[0].quantity).toBe(1);
  });

  it('sets and removes lines by product and variant', () => {
    let items = addToCart([], { productId: 2, variantId: 5, quantity: 1 });
    items = setQuantity(items, { productId: 2, variantId: 5, quantity: 4 });
    expect(cartCount(items)).toBe(4);
    items = removeFromCart(items, { productId: 2, variantId: 5 });
    expect(items).toEqual([]);
  });

  it('stores only ids and quantities, never prices', () => {
    const items = addToCart([], { productId: 3, quantity: 2 });
    expect(Object.keys(items[0]).sort()).toEqual(['productId', 'quantity', 'variantId']);
  });

  it('round-trips through storage and drops malformed entries', () => {
    const storage = memoryStorage();
    saveCart([{ productId: 4, variantId: null, quantity: 2 }], storage);
    expect(loadCart(storage)).toEqual([{ productId: 4, variantId: null, quantity: 2 }]);

    storage.setItem(CART_STORAGE_KEY, '{not json');
    expect(loadCart(storage)).toEqual([]);

    storage.setItem(CART_STORAGE_KEY, JSON.stringify([{ productId: 'x' }, { productId: 7 }]));
    expect(loadCart(storage)).toEqual([{ productId: 7, variantId: null, quantity: 1 }]);
  });
});
