import { describe, it, expect } from 'vitest';
import { SEO_RECOMMENDED, buildSeoPreview, truncateSeoText } from './seoPreview';

describe('buildSeoPreview', () => {
  it('uses explicit metadata and reports real field counts', () => {
    const preview = buildSeoPreview({
      title: 'Gid Mizik Ayiti',
      description: 'Aprann mizik ak kreyatè Ayisyen.',
      artistName: 'Test User',
      username: 'testuser',
    }, 'ht');

    expect(preview.title).toBe('Gid Mizik Ayiti');
    expect(preview.description).toBe('Aprann mizik ak kreyatè Ayisyen.');
    expect(preview.url).toBe('atelnyo.site/c/testuser');
    expect(preview.titleCount).toBe(15);
    expect(preview.titleTooLong).toBe(false);
  });

  it('falls back to the artist identity and bio when SEO is empty', () => {
    const preview = buildSeoPreview({
      artistName: 'Mizik Jak',
      username: 'mizikjak',
      bio: 'Pwodiktè ak mizisyen.',
    }, 'ht');

    expect(preview.title).toBe('Mizik Jak — Atelnyo');
    expect(preview.description).toBe('Pwodiktè ak mizisyen.');
  });

  it('truncates long previews and flags over-limit fields', () => {
    const title = 'T'.repeat(SEO_RECOMMENDED.title + 5);
    const description = 'D'.repeat(SEO_RECOMMENDED.description + 5);
    const preview = buildSeoPreview({ title, description }, 'en');

    expect(preview.title.endsWith('…')).toBe(true);
    expect(preview.description.endsWith('…')).toBe(true);
    expect(preview.title.length).toBe(SEO_RECOMMENDED.title);
    expect(preview.description.length).toBe(SEO_RECOMMENDED.description);
    expect(preview.titleTooLong).toBe(true);
    expect(preview.descriptionTooLong).toBe(true);
  });

  it('collapses whitespace and leaves short text untouched', () => {
    expect(truncateSeoText('  hello   world  ', 60)).toBe('hello world');
    expect(truncateSeoText('short', 60)).toBe('short');
  });
});
