/**
 * src/modules/explore/components/HomeFeed.dedupe.test.js
 *
 * The Explore feed must never render the same catalog row under two
 * section titles — a course shown as "Trending" AND "Recommended" reads
 * as a broken feed. The backend dedupes across rails; this pins the
 * client-side guarantee that covers the 30-minute localStorage snapshot
 * and the DEIE engine payload.
 */
import { describe, it, expect } from 'vitest';
import { dedupeFeedSections } from './HomeFeed';

const section = (type, items) => ({ type, items, count: items.length });

describe('dedupeFeedSections', () => {
  it('keeps the first rail and drops the repeat from the later rail', () => {
    const out = dedupeFeedSections([
      section('recommended', [{ id: 5, item_type: 'course' }]),
      section('trending_course', [{ id: 5, item_type: 'course' }]),
    ]);
    expect(out.map((s) => s.type)).toEqual(['recommended']);
    expect(out[0].items).toHaveLength(1);
  });

  it('drops a rail that the pass empties out', () => {
    const out = dedupeFeedSections([
      section('recommended', [{ id: 5, item_type: 'course' }]),
      section('newest_course', [{ id: 5, item_type: 'course' }]),
      section('newest_music', [{ id: 5, item_type: 'music' }]),
    ]);
    expect(out.map((s) => s.type)).toEqual(['recommended', 'newest_music']);
  });

  it('infers the content type for rails whose items omit item_type', () => {
    const out = dedupeFeedSections([
      section('trending_course', [{ id: 9 }]),
      section('featured_courses', [{ id: 9 }]),
    ]);
    expect(out.map((s) => s.type)).toEqual(['trending_course']);
  });

  it('does not confuse the same id across different content types', () => {
    const out = dedupeFeedSections([
      section('trending_course', [{ id: 7 }]),
      section('trending_music', [{ id: 7 }]),
    ]);
    expect(out).toHaveLength(2);
  });

  it('always keeps items with no usable dedupe key', () => {
    const out = dedupeFeedSections([
      section('spotlight', [{ id: null }, { item_type: 'spotlight' }]),
    ]);
    expect(out[0].items).toHaveLength(2);
  });

  it('preserves the algorithm order of the rails it keeps', () => {
    const out = dedupeFeedSections([
      section('newest_course', [{ id: 1, item_type: 'course' }, { id: 2, item_type: 'course' }]),
      section('trending_course', [{ id: 2, item_type: 'course' }, { id: 3, item_type: 'course' }]),
    ]);
    expect(out.map((s) => s.type)).toEqual(['newest_course', 'trending_course']);
    expect(out[1].items.map((i) => i.id)).toEqual([3]);
    expect(out[1].count).toBe(1);
  });
});
