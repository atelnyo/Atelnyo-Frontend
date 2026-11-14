import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '../services/api';
import { clearSitemapCache, generateSitemap } from './sitemapGenerator';

describe('generateSitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSitemapCache();
    api.get.mockImplementation((path) => Promise.resolve({
      data: path === 'communities/'
        ? { results: [{ slug: 'konpa-lovers', user_key: 'founder' }] }
        : { results: [] },
    }));
  });

  it('lists communities at their canonical indexable URLs', async () => {
    const sitemap = await generateSitemap();

    expect(sitemap).toContain('<loc>https://atelnyo.site/community/konpa-lovers</loc>');
    expect(sitemap).not.toContain('/konpa-lovers/by/founder/community');
  });
});
