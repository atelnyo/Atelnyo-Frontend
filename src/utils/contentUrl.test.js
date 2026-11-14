import { describe, expect, it } from 'vitest';
import { buildContentUrl } from './contentUrl';

describe('buildContentUrl', () => {
  it('uses the indexable canonical route for communities', () => {
    expect(buildContentUrl('community', { slug: 'konpa-lovers', username: 'founder' }))
      .toBe('/community/konpa-lovers');
  });

  it('keeps content-key routes for other public content', () => {
    expect(buildContentUrl('event', { slug: 'konpa-night', user_key: 'founder' }))
      .toBe('/konpa-night/by/founder/event');
  });
});
