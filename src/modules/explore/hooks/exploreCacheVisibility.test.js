import { describe, it, expect, beforeEach } from 'vitest';

import { clearExploreCache, readExploreCache, writeExploreCache } from './useExploreCache';
import { applyPublicVisibility } from '../utils/publicVisibility';

const draftProduct = {
  id: 1, slug: 'bwouyon', title: 'Bwouyon', is_active: false, price: '10.00',
};
const liveProduct = {
  id: 2, slug: 'affiche', title: 'Affiche', is_active: true, price: '25.00',
};
const draftCourse = { id: 11, title: 'Kou Bwouyon', status: 'draft' };
const publishedCourse = { id: 10, title: 'Kou Pibliye', status: 'published' };

// Mirrors the restore step in Explore.jsx: read the snapshot, strip rows
// that are no longer public BEFORE any of it reaches component state.
const restore = (userId) => applyPublicVisibility(readExploreCache(userId).data);

describe('Explore cache restore visibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('drops a draft product from a cached snapshot on restore', () => {
    writeExploreCache({
      _courses: [publishedCourse, draftCourse],
      _marketplace: [liveProduct, draftProduct],
      _recommendedProducts: [draftProduct],
    }, null);

    const restored = restore(null);

    expect(restored._marketplace).toEqual([liveProduct]);
    expect(restored._recommendedProducts).toEqual([]);
    // The draft course is stripped by the same restore pass.
    expect(restored._courses).toEqual([publishedCourse]);
  });

  it('keeps a restored snapshot clean when it is written back', () => {
    writeExploreCache({
      _marketplace: [liveProduct, draftProduct],
      _recommendedProducts: [draftProduct],
    }, 42);

    // Explore writes back the (already filtered) state, so a rewrite can
    // never re-stamp the draft with a new TTL.
    writeExploreCache(restore(42), 42);

    const again = readExploreCache(42);
    expect(again.data._marketplace).toEqual([liveProduct]);
    expect(again.data._recommendedProducts).toEqual([]);
    expect(localStorage.getItem('atelnyo_explore_cache_u42')).not.toContain('"is_active":false');
  });

  it('leaves legacy rows without visibility fields visible', () => {
    writeExploreCache({
      _marketplace: [{ id: 3, title: 'Ansyen Atik' }],
      _courses: [{ id: 12, title: 'Ansyen Kou' }],
    }, null);

    const restored = restore(null);

    expect(restored._marketplace).toHaveLength(1);
    expect(restored._courses).toHaveLength(1);
  });

  it('clearExploreCache drops the snapshot entirely', () => {
    writeExploreCache({ _marketplace: [liveProduct] }, 7);
    clearExploreCache(7);
    expect(readExploreCache(7).data).toBeNull();
  });
});
