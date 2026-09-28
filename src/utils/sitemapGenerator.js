/**
 * src/utils/sitemapGenerator.js
 *
 * Generates a sitemap.xml dynamically from the API.
 * Called once on the Explore page mount and cached in localStorage.
 *
 * The sitemap lists:
 * - Static pages (/, /explore, /academy, etc.)
 * - Creator profiles (/c/username)
 * - Courses (/course/:slug)
 * - Music (/music/:slug)
 * - Talents (/talent/:slug)
 * - Jobs (/job/:id)
 * - Communities (/community/:slug)
 * - Products (/product/:slug)
 * - Spotlight (/spotlight/:id)
 * - Events (/event/:id)
 */
import api from '../services/api';

const BASE_URL = 'https://atelnyo.site';
const CACHE_KEY = 'atelnyo_sitemap_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function wrapUrl(path) {
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function formatDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
}

export async function generateSitemap() {
  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    if (cached.xml && Date.now() - (cached.timestamp || 0) < CACHE_TTL) {
      return cached.xml;
    }
  } catch {}

  const urls = [];

  // Static pages
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/explore', priority: '0.9', changefreq: 'daily' },
    { path: '/help', priority: '0.7', changefreq: 'weekly' },
    { path: '/academy', priority: '0.8', changefreq: 'weekly' },
    { path: '/legal/content-policy', priority: '0.3', changefreq: 'monthly' },
    { path: '/legal/privacy', priority: '0.3', changefreq: 'monthly' },
    { path: '/legal/terms', priority: '0.3', changefreq: 'monthly' },
  ];

  for (const page of staticPages) {
    urls.push({
      loc: wrapUrl(page.path),
      lastmod: formatDate(),
      changefreq: page.changefreq,
      priority: page.priority,
    });
  }

  // Fetch dynamic content in parallel
  const fetches = [
    { service: () => api.get('courses/', { params: { status: 'published', limit: 500 } }),
      type: 'course', priority: '0.8', changefreq: 'weekly' },
    { service: () => api.get('explore/music/', { params: { limit: 500 } }),
      type: 'music', priority: '0.7', changefreq: 'weekly' },
    { service: () => api.get('explore/talents/', { params: { limit: 500 } }),
      type: 'talent', priority: '0.7', changefreq: 'weekly' },
    { service: () => api.get('jobs/', { params: { status: 'published', limit: 500 } }),
      type: 'job', priority: '0.6', changefreq: 'weekly' },
    { service: () => api.get('communities/', { params: { limit: 500 } }),
      type: 'community', priority: '0.6', changefreq: 'weekly' },
    { service: () => api.get('spotlight/', { params: { limit: 500 } }),
      type: 'spotlight', priority: '0.7', changefreq: 'weekly' },
  ];

  const results = await Promise.allSettled(fetches.map((f) => f.service()));

  for (let i = 0; i < fetches.length; i++) {
    const { type, priority, changefreq } = fetches[i];
    const result = results[i];
    if (result.status !== 'fulfilled') continue;

    const data = result.value?.data;
    const items = Array.isArray(data?.results) ? data.results
      : Array.isArray(data) ? data : [];

    for (const item of items) {
      const slug = item.slug || item.id;
      const userKey = item.user_key || item.created_by_username || item.linked_username || 'Atelnyo';
      const path = `/${slug}/by/${userKey}/${type}`;

      urls.push({
        loc: wrapUrl(path),
        lastmod: formatDate(item.updated_at || item.created_at),
        changefreq,
        priority,
        image: item.image_url || undefined,
      });
    }
  }

  // Build XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.image ? `
    <image:image>
      <image:loc>${escapeXml(u.image)}</image:loc>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>`;

  // Cache
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      xml,
      timestamp: Date.now(),
    }));
  } catch {}

  return xml;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function clearSitemapCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
