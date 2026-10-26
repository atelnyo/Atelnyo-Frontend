// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../../worker/worker.js';

// Minimal stand-in for Cloudflare's HTMLRewriter (not available in Node).
// Supports only the selectors used by _rewriteBotShell: `title` and
// `meta[attr="value"]` (comma-separated). Good enough to check which
// tags the Worker decides to rewrite and with what values.
class FakeHTMLRewriter {
  constructor() { this.rules = []; }
  on(selector, handler) {
    this.rules.push({ selectors: selector.split(',').map((s) => s.trim()), handler });
    return this;
  }
  transform(resp) {
    const rules = this.rules;
    const pending = resp.text();
    const out = pending.then((html) => {
      rules.forEach(({ selectors, handler }) => {
        selectors.forEach((sel) => {
          if (sel === 'title') {
            html = html.replace(/<title>([\s\S]*?)<\/title>/, (_, inner) => {
              let content = inner;
              handler.element({ setInnerContent: (v) => { content = v; } });
              return `<title>${content}</title>`;
            });
            return;
          }
          const m = sel.match(/^meta\[(\w+)="([^"]+)"\]$/);
          if (!m) return;
          const [, attr, val] = m;
          html = html.replace(/<meta\s[^>]*>/g, (tag) => {
            if (!new RegExp(`\\b${attr}="${val}"`).test(tag)) return tag;
            let newVal = null;
            handler.element({ setAttribute: (_k, v) => { newVal = v; } });
            return tag.replace(/content="[^"]*"/, `content="${newVal}"`);
          });
        });
      });
      return html;
    });
    return { body: new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(await out));
        controller.close();
      },
    }) };
  }
}

const BOT_UA = 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';

const SHELL = `<!DOCTYPE html><html><head>
<title>Atelnyo — Learn, Create, Share</title>
<meta name="description" content="Brand description">
<meta property="og:title" content="Atelnyo — Learn, Create, Share">
<meta property="og:description" content="Brand description">
<meta property="og:url" content="https://atelnyo.site/">
<meta name="twitter:title" content="Atelnyo — Learn, Create, Share">
<meta name="twitter:description" content="Brand description">
</head><body></body></html>`;

function makeEnv() {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response(SHELL, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })),
    },
  };
}

function req(path, ua) {
  return new Request(`https://atelnyo.site${path}`, { headers: { 'User-Agent': ua } });
}

const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Backend SSR responses (shape matches backend/ssr/views.py::_ssr_html).
const SSR_FIXTURES = {
  '/api/ssr/about/': { title: 'About Atelnyo — Learn, Create, Share', desc: 'About the Atelnyo platform for creators.' },
  '/api/ssr/creator/Atelnyo/': { title: 'Atelnyo Academy — Platfòm Kreyatè Ayisyen | Haitian Creator Platform', desc: 'Atelnyo Academy creator profile.' },
  '/api/ssr/legal/terms-of-service/': { title: 'Terms of Service | Atelnyo', desc: 'Terms of service for using Atelnyo.' },
};

function ssrHtml({ title, desc }) {
  return `<!DOCTYPE html><html><head><title>${title}</title><meta name="description" content="${desc}"></head><body></body></html>`;
}

describe('worker SSR routes for Googlebot', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(async (input) => {
      const url = new URL(String(input));
      const fixture = SSR_FIXTURES[url.pathname];
      if (!fixture) return new Response('not found', { status: 404 });
      return new Response(ssrHtml(fixture), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['/about', 'About Atelnyo — Learn, Create, Share', 'About the Atelnyo platform for creators.'],
    ['/c/Atelnyo', 'Atelnyo Academy — Platfòm Kreyatè Ayisyen | Haitian Creator Platform', 'Atelnyo Academy creator profile.'],
    ['/legal/terms-of-service', 'Terms of Service | Atelnyo', 'Terms of service for using Atelnyo.'],
  ])('serves the backend SSR title and description for %s', async (path, title, desc) => {
    const env = makeEnv();
    const resp = await worker.fetch(req(path, GOOGLEBOT_UA), env, {});
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toContain(`<title>${title}</title>`);
    expect(body).toContain(`<meta name="description" content="${desc}">`);
    // Must not fall back to the generic brand shell.
    expect(body).not.toContain('Brand description');
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });
});

describe('worker bot shell meta for static pages', () => {
  let env;
  beforeEach(() => {
    env = makeEnv();
    vi.stubGlobal('HTMLRewriter', FakeHTMLRewriter);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['/status', 'Platform Status | Atelnyo', 'Check the current status of Atelnyo services, API availability, and system health.'],
    ['/developers', 'Developers | Atelnyo', 'Atelnyo developer documentation, API reference, integration guides, and open-source resources.'],
    ['/themes', 'Themes | Atelnyo', 'Browse available themes on Atelnyo.'],
    ['/store', 'Store | Atelnyo', 'Shop products from creators on the Atelnyo store.'],
    ['/affiliate/discover', 'Discover Affiliate Offers | Atelnyo', 'Find affiliate offers from creators on Atelnyo.'],
  ])('serves route-specific title and description to bots on %s', async (path, title, desc) => {
    const resp = await worker.fetch(req(path, BOT_UA), env, {});
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toContain(`<title>${title}</title>`);
    expect(body).toContain(`<meta property="og:title" content="${title}">`);
    expect(body).toContain(`<meta property="og:description" content="${desc}">`);
    expect(body).toContain(`<meta name="description" content="${desc}">`);
  });

  it('leaves the brand shell untouched for regular browsers', async () => {
    const resp = await worker.fetch(req('/status', BROWSER_UA), env, {});
    const body = await resp.text();
    expect(body).toContain('Brand description');
    expect(body).not.toContain('Platform Status | Atelnyo');
  });
});
