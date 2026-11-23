import { describe, it, expect, vi, beforeEach } from 'vitest';

const getProduct = vi.fn();

vi.mock('./storeService', () => ({
  storeService: {
    getProduct: (...args) => getProduct(...args),
  },
}));

import {
  clearProductCache, prefetchProduct, readCachedProduct, rememberProduct,
} from './productCache';

const product = { id: 7, slug: 'poster', title: 'Poster', variants: [] };

describe('productCache', () => {
  beforeEach(() => {
    clearProductCache();
    getProduct.mockReset().mockResolvedValue({ data: product });
  });

  it('deduplicates concurrent prefetches and caches by id and slug', async () => {
    const first = prefetchProduct('poster');
    const second = prefetchProduct('poster');

    expect(getProduct).toHaveBeenCalledTimes(1);
    await Promise.all([first, second]);

    expect(readCachedProduct('poster')).toEqual(product);
    expect(readCachedProduct('7')).toEqual(product);
  });

  it('does not refetch a product that is already cached', async () => {
    rememberProduct(product);
    await prefetchProduct('7');
    expect(getProduct).not.toHaveBeenCalled();
  });
});
