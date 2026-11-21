// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearRecentlyViewed,
  loadRecentlyViewed,
  recordRecentlyViewed,
  RECENTLY_VIEWED_LIMIT,
} from './recentlyViewed';

beforeEach(() => {
  window.localStorage.clear();
});

describe('recentlyViewed', () => {
  it('puts the newest product first, dedupes by id, and caps the list', () => {
    for (let i = 1; i <= RECENTLY_VIEWED_LIMIT + 2; i += 1) {
      recordRecentlyViewed({ id: i, title: `Product ${i}`, price: i });
    }

    const rows = loadRecentlyViewed();
    expect(rows).toHaveLength(RECENTLY_VIEWED_LIMIT);
    expect(rows[0].id).toBe(RECENTLY_VIEWED_LIMIT + 2);
    expect(rows.some((row) => row.id === 1)).toBe(false);

    recordRecentlyViewed({ id: 5, title: 'Product renamed' });
    const updated = loadRecentlyViewed();
    expect(updated).toHaveLength(RECENTLY_VIEWED_LIMIT);
    expect(updated[0]).toMatchObject({ id: 5, title: 'Product renamed' });
    expect(updated.filter((row) => row.id === 5)).toHaveLength(1);
  });

  it('keeps only card-relevant fields', () => {
    recordRecentlyViewed({
      id: 1,
      title: 'Kit',
      description: 'x'.repeat(5000),
      gallery: ['a', 'b', 'c', 'd', 'e'],
      variants: [{ id: 9, price: '2.00', stock: 3, sku: 'secret' }],
    });

    const [row] = loadRecentlyViewed();
    expect(row.description).toBeUndefined();
    expect(row.gallery).toHaveLength(4);
    expect(row.variants).toEqual([{ id: 9, price: '2.00', stock: 3 }]);
  });

  it('recovers from corrupt storage and ignores invalid entries', () => {
    window.localStorage.setItem('atelnyo.store.recently-viewed.v1', '{not-json');
    expect(loadRecentlyViewed()).toEqual([]);

    window.localStorage.setItem(
      'atelnyo.store.recently-viewed.v1',
      JSON.stringify([{ id: 1 }, { id: 2, title: 'Valid' }, null]),
    );
    expect(loadRecentlyViewed()).toEqual([{ id: 2, title: 'Valid' }]);
  });

  it('clears the history', () => {
    recordRecentlyViewed({ id: 1, title: 'Kit' });
    expect(loadRecentlyViewed()).toHaveLength(1);
    clearRecentlyViewed();
    expect(loadRecentlyViewed()).toEqual([]);
  });
});
