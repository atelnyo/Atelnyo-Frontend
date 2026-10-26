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
