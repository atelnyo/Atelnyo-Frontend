import { describe, it, expect } from 'vitest';
import { getProfileCompleteness } from './profileCompleteness';

describe('getProfileCompleteness', () => {
  it('maps backend missing keys to labels and editor tabs', () => {
    const result = getProfileCompleteness({
      profile_completeness: 62,
      completeness_missing: ['avatar', 'seo_title', 'has_courses'],
    });

    expect(result.score).toBe(62);
    expect(result.missing).toEqual([
      { key: 'avatar', label: 'Profile Photo', label_ht: 'Foto Pwofil', tab: 'appearance' },
      { key: 'seo_title', label: 'SEO Title', label_ht: 'Tit SEO', tab: 'seo' },
      { key: 'has_courses', label: 'Published Course', label_ht: 'Kou Pibliye', tab: null },
    ]);
  });

  it('clamps the score and tolerates unknown or duplicate keys', () => {
    const result = getProfileCompleteness({
      profile_completeness: 140,
      completeness_missing: ['custom_field', 'custom_field'],
    });

    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toMatchObject({
      key: 'custom_field',
      label: 'Custom Field',
      tab: null,
    });
  });

  it('does not fabricate a score when the backend omitted it', () => {
    expect(getProfileCompleteness({ completeness_missing: ['bio'] })).toBeNull();
    expect(getProfileCompleteness(null)).toBeNull();
  });
});
