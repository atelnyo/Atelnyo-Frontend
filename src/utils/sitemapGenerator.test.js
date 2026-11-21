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

  it('adds community covers to image:image and skips deactivated communities', async () => {
    api.get.mockImplementation((path) => Promise.resolve({
      data: path === 'communities/'
        ? {
          results: [
            { slug: 'konpa-lovers', banner_url: 'https://cdn.example.com/banner.jpg', is_active: true },
            { slug: 'avatar-only', avatar_url: 'https://cdn.example.com/avatar.jpg', is_active: true },
            { slug: 'hidden-community', banner_url: 'https://cdn.example.com/hidden.jpg', is_active: false },
          ],
        }
        : { results: [] },
    }));

    const sitemap = await generateSitemap();

    expect(sitemap).toContain('<image:loc>https://cdn.example.com/banner.jpg</image:loc>');
    expect(sitemap).toContain('<image:loc>https://cdn.example.com/avatar.jpg</image:loc>');
    expect(sitemap).not.toContain('/community/hidden-community');
    expect(sitemap).not.toContain('hidden.jpg');
  });
});
