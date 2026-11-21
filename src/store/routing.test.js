import { describe, it, expect } from 'vitest';
import { storeProductPath } from './routing';

describe('storeProductPath', () => {
  it('prefers the slug and encodes it', () => {
    expect(storeProductPath({ id: 7, slug: 'poster kit' }))
      .toBe('/store/products/poster%20kit');
  });

  it('falls back to the numeric id when no slug exists', () => {
    expect(storeProductPath({ id: 42 })).toBe('/store/products/42');
  });

  it('returns null for a product with no usable reference', () => {
    expect(storeProductPath(null)).toBeNull();
    expect(storeProductPath({})).toBeNull();
    expect(storeProductPath({ slug: '' })).toBeNull();
  });
});
