/**
 * Cloudflare Worker — Atelnyo SEO Prerenderer + AI Chat
 *
 * TWO responsibilities:
 *   1. SEO: intercepts crawler/bot requests for prerendered HTML
 *   2. AI Chat: uses Cloudflare Workers AI (FREE — no API key needed!)
 *
 * Setup:
 *   1. Go to Cloudflare Dashboard → Workers & Pages → atelnyo → Settings → Bindings
 *   2. Add "Workers AI" binding:
 *      - Variable name: AI
 *      - Pick any model (e.g. @cf/meta/llama-3.1-8b-instruct)
 *   3. Deploy: wrangler deploy
 *
 * No API keys needed — Workers AI is free on Cloudflare!
 */

const SSR_API = 'https://api.atelnyo.site';

// ─── SECURITY HEADERS ─────────────────────────────────────────────
// Applied to every response from this Worker. These protect users
// against XSS, clickjacking, MIME sniffing, and other common attacks.
//
// CSP is deliberately permissive for the SPA (inline scripts, eval for
// dev tools, external CDN fonts/analytics). A stricter CSP can be
// adopted after auditing all third-party scripts.
const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Prevent clickjacking (allow same-origin embedding for PWA)
  'X-Frame-Options': 'SAMEORIGIN',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions policy — disable features Atelnyo doesn't use
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=()',
  // HSTS — force HTTPS for 1 year, include subdomains
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  // XSS protection (legacy but still useful for older browsers)
  'X-XSS-Protection': '1; mode=block',
  // Content Security Policy
  //
  // PayPal hosts are listed as ``*.paypal.com`` / ``*.paypalobjects.com``
  // rather than the individual www./sandbox. hosts: PayPal's documented CSP
  // requires those wildcards for script-src, script-src-elem, connect-src,
  // frame-src, img-src and style-src, and the SDK really does use them — the
  // loader pulls FraudNet from ``https://c.paypal.com/da/r/fb.js`` and talks
  // to www.paypal.com over XHR while an order is being approved. A missing
  // entry here (or in the index.html meta tag, which is enforced in ADDITION
  // to this header) breaks the PayPal buttons with nothing but a browser
  // console violation — no server-side error at all.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://cdnjs.cloudflare.com https://www.google-analytics.com https://*.paypal.com https://*.paypalobjects.com https://static.cloudflareinsights.com",
    "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://cdnjs.cloudflare.com https://www.google-analytics.com https://*.paypal.com https://*.paypalobjects.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://*.paypal.com https://*.paypalobjects.com",
    "font-src 'self' https://cdnjs.cloudflare.com data:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' blob: https: http:",
    "connect-src 'self' https://api.atelnyo.site https://atelnyo.atelnyo.workers.dev https://www.google-analytics.com https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://api.atelnyo.site ws://127.0.0.1:8000 https://*.sentry.io https://*.paypal.com https://*.paypalobjects.com https://static.cloudflareinsights.com",
    "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://js.stripe.com https://*.paypal.com https://*.paypalobjects.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; '),
};

/** Merge security headers into an existing Headers object. */
function _withSecurityHeaders(headers) {
  const h = new Headers(headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    h.set(k, v);
  }
  return h;
}

// Minimal 404 page served to crawlers when the backend SSR endpoint
// confirms the requested entity does not exist (backend answered 404).
// A plain-404 with a human hint — no SPA shell (that would be a
// soft-404 at HTTP 200), no cache so stale URLs clear quickly.
const _NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, follow">
<title>404 — Page not found | Atelnyo</title>
</head>
<body>
<h1>404 — Page not found</h1>
<p>This content is no longer available on Atelnyo.</p>
<p><a href="/">Back to Atelnyo home</a> · <a href="/explore">Explore content</a></p>
</body>
</html>`;

// ─── SEO PRERENDER ────────────────────────────────────────────────
const BOT_RE = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|pinterest|slackbot|discordbot|applebot|bingbot|yandex|baidu|semrush|ahrefs|Bytespider/i;

const SSR_MAP = [
  { re: /^\/c\/([^/?#]+)\/?$/, api: (m) => `/api/ssr/creator/${m[1]}/` },
  { re: /^\/about\/?$/,       api: () => '/api/ssr/about/' },
  { re: /^\/trust\/?$/,       api: () => '/api/ssr/trust/' },
  { re: /^\/contact\/?$/,     api: () => '/api/ssr/contact/' },
  { re: /^\/accessibility\/?$/, api: () => '/api/ssr/accessibility/' },
  // NOTE: /status + /developers are intentionally NOT prerendered — the
  // backend has no /api/ssr/status/ or /api/ssr/developers/ endpoints
  // (checked 2026-09-16), so entries here made every bot request hit the
  // backend for a guaranteed 404 before falling through. /status is
  // noindex anyway; /developers is served fine as the SPA shell (Google
  // renders JS) — no SSR endpoint was ever created for it.
  { re: /^\/explore\/?$/,     api: () => '/api/ssr/explore/' },
  // Help Center: /help and per-topic deep links (/help/wallet, ...)
  { re: /^\/help\/?$/,            api: () => '/api/ssr/help/' },
  { re: /^\/help\/([^/?#]+)\/?$/, api: (m) => `/api/ssr/help/${m[1]}/` },
  { re: /^\/privacy\/?$/,     api: () => '/api/ssr/privacy/' },
  { re: /^\/terms\/?$/,       api: () => '/api/ssr/terms/' },
  // Legal policy pages: /legal/terms-of-service, /legal/privacy-policy, ...
  { re: /^\/legal\/([^/?#]+)\/?$/, api: (m) => `/api/ssr/legal/${m[1]}/` },
  { re: /^\/courses\/([^/?#]+)\/?$/, api: (m) => `/api/ssr/course/${m[1]}/` },
  // New content-path URLs: /<slug>/by/<user>/course
  { re: /^\/([^/?#]+)\/by\/[^/?#]+\/course\/?$/, api: (m) => `/api/ssr/course/${m[1]}/` },
  // New content-path URLs: /<slug>/by/<user>/product
  { re: /^\/([^/?#]+)\/by\/[^/?#]+\/product\/?$/, api: (m) => `/api/ssr/product/${m[1]}/` },
  // Canonical product URL: /marketplace/<slug>
  { re: /^\/marketplace\/([^/?#]+)\/?$/, api: (m) => `/api/ssr/product/${m[1]}/` },
  // Store product URL: /store/products/<slug>
  { re: /^\/store\/products\/([^/?#]+)\/?$/, api: (m) => `/api/ssr/product/${m[1]}/` },
];

// ─── BOT SHELL META (non-SSR pages) ───────────────────────────────
// Bots that don't run JS read the static index.html head, which carries
// the same brand title/description/og:image on every URL. For public
// pages without an SSR endpoint, rewrite those tags per route.
const PAGE_META = {
  '/faq': { title: 'FAQ', desc: 'Answers to common questions about Atelnyo courses, music, marketplace, and account features.' },
  '/affiliate': { title: 'Affiliate Program', desc: 'Earn by promoting courses, music and products on Atelnyo.' },
  '/verify': { title: 'Verify a Certificate', desc: 'Check the authenticity of an Atelnyo certificate.' },
  '/affiliate/discover': { title: 'Discover Affiliate Offers', desc: 'Find affiliate offers from creators on Atelnyo.' },
  '/status': { title: 'Platform Status', desc: 'Check the current status of Atelnyo services, API availability, and system health.' },
  '/developers': { title: 'Developers', desc: 'Atelnyo developer documentation, API reference, integration guides, and open-source resources.' },
  '/themes': { title: 'Themes', desc: 'Browse available themes on Atelnyo.' },
  '/store': { title: 'Atelnyo Store', desc: 'Shop products from creators on Atelnyo Store.', image: 'https://atelnyo.site/atelnyo-store-og-v2.png', imageWidth: '1200', imageHeight: '630', favicon: '/atelnyo-store-icon-32.png' },
  '/courses': { title: 'Courses', desc: 'Browse all courses on Atelnyo — programming, design, business, language, and more.' },
  '/products': { title: 'Products', desc: 'Discover products on Atelnyo.' },
  '/marketplace': { title: 'Marketplace', desc: 'Discover digital products and goods from creators on Atelnyo.' },
  '/legal': { title: 'Legal', desc: 'Legal information for Atelnyo users.' },
  '/sheet/explore': { title: 'Explore', desc: 'Discover online courses, music, talent, and products from creators on Atelnyo.' },
  '/sheet/explore/music': { title: 'Music', desc: 'Listen to music on Atelnyo — discover talented artists and their tracks.' },
  '/sheet/explore/talent': { title: 'Talent', desc: 'Discover talented creators on Atelnyo — find the right person for your project.' },
  '/sheet/explore/job': { title: 'Jobs', desc: 'Find remote jobs on Atelnyo — connect with opportunities from verified creators.' },
  '/sheet/community': { title: 'Community', desc: 'Join a community on Atelnyo — connect with like-minded creators.' },
  '/academy': { title: 'Language Academy', desc: 'Atelnyo Language Academy — published official language programs (Creole, French, Spanish, English) with structured curricula for every level.' },
  '/sheet/academy': { title: 'Language Academy', desc: 'Atelnyo Language Academy — published official language programs (Creole, French, Spanish, Spanish, English) with structured curricula for every level.' },
};

async function _rewriteBotShell(request, env, path, origin) {
  const key = path.replace(/\/+$/, '') || '/';
  const meta = PAGE_META[key];
  if (!meta || !env.ASSETS) return null;
  const resp = await env.ASSETS.fetch(request);
  if (!resp.ok) return null;
  const title = `${meta.title} | Atelnyo`;
  const url = `${origin}${key}`;
  const rw = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"], meta[name="twitter:description"], meta[property="og:description"]', { element(el) { el.setAttribute('content', meta.desc); } })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', url); } });
  if (meta.image) {
    rw
      .on('meta[property="og:image"], meta[name="twitter:image"]', { element(el) { el.setAttribute('content', meta.image); } })
      .on('meta[property="og:image:width"]', { element(el) { el.setAttribute('content', meta.imageWidth || (key === '/store' ? '1200' : '512')); } })
      .on('meta[property="og:image:height"]', { element(el) { el.setAttribute('content', meta.imageHeight || (key === '/store' ? '630' : '512')); } });
  }
  if (meta.favicon) {
    rw
      .on('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]', { element(el) { el.setAttribute('href', meta.favicon); } });
  }
  return new Response(rw.transform(resp).body, {
    status: 200,
    headers: _withSecurityHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }),
  });
}

// ─── LEGACY @-URL REDIRECTS ───────────────────────────────────────
// The Cloudflare asset handler normalizes the ``@`` character in URL
// paths to %40 with a 307 before the Worker runs (GSC: "Erreur liée à
// des redirections"). Short-circuit those requests with an EXPLICIT
// 301 to the canonical equivalent so the chain is exactly one hop and
// crawlers consolidate the legacy shape for good:
//   /@username              → /c/{username}
//   /{slug}@{user}/{type}   → /{slug}/by/{user}/{type}
const LEGACY_AT_REDIRECTS = [
  // /@username → /c/{username}
  { re: /^\/@([^/?#]+)$/, to: (m) => `/c/${m[1]}` },
  // /{slug}@{user}/{type} → /{slug}/by/{user}/{type}
  { re: /^\/([^/?#@]+)@([^/?#]+)\/([^/?#]+)$/, to: (m) => `/${m[1]}/by/${m[2]}/${m[3]}` },
];

function _handleLegacyAtRedirect(path) {
  for (const { re, to } of LEGACY_AT_REDIRECTS) {
    const m = path.match(re);
    if (m) {
      return new Response(null, {
        status: 301,
        headers: { Location: to(m) },
      });
    }
  }
  return null;
}

// ─── AI CHAT (Cloudflare Workers AI — FREE) ──────────────────────
// Try multiple models — first one that works wins
//
// Model choice for Haitian Creole (catalog refreshed 2026-05-30 —
// llama-3.1-8b and the base llama-3.3-70b were DEPRECATED; only the
// -fast variant of 70B remains):
//
// 1. @cf/qwen/qwen3-30b-a3b-fp8 — 30B MoE with only ~3B active params,
//    so it's fast like a small model but scores far better on
//    low-resource languages than the 3B dense fallback ever did.
//    Also the CHEAPEST of the current generation ($0.05/$0.34 per M
//    tokens) — the free daily allocation stretches furthest.
// 2. @cf/zai-org/glm-4.7-flash — Cloudflare's own recommended
//    replacement: multilingual (100+ langs), tool calling, fast.
//
// Both are "reasoning" models that can emit <think>…</think> blocks —
// _stripThinking() removes them before the reply reaches the UI.
const AI_MODELS = [
  '@cf/qwen/qwen3-30b-a3b-fp8',            // 30B MoE — pi bon kreyòl, pi bon mache
  '@cf/zai-org/glm-4.7-flash',             // multilingual fallback
];
const MAX_PROMPT_LENGTH = 8000;

/**
 * Strip <think>…</think> blocks that reasoning models (Qwen3, GLM)
 * sometimes emit before the visible answer. Keeps the chat UI free of
 * chain-of-thought noise.
 */
function _stripThinking(text) {
  if (!text) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/i, '')  // unclosed <think> (generation cut off)
    .trim();
}

function _corsHeaders(origin) {
  const allowed = ['atelnyo.site', 'atelnyo.atelnyo.workers.dev', 'localhost'];
  const isAllowed = allowed.some(o => origin?.includes(o));
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://atelnyo.site',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    // Security headers for AI endpoint responses
    ...SECURITY_HEADERS,
  };
}

async function _handleAIChat(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: _corsHeaders(request.headers.get('Origin')) });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ..._corsHeaders(request.headers.get('Origin')) },
    });
  }

  // Check if Workers AI binding is available
  if (!env.AI) {
    return new Response(JSON.stringify({
      error: 'AI not configured. Add Workers AI binding in Cloudflare dashboard.',
      text: 'AI a pa configure ankò. Ajoute Workers AI binding nan Cloudflare dashboard.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ..._corsHeaders(request.headers.get('Origin')) },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ..._corsHeaders(request.headers.get('Origin')) },
    });
  }

  const { prompt, system_instruction, lang } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'prompt is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ..._corsHeaders(request.headers.get('Origin')) },
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return new Response(JSON.stringify({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} chars).` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ..._corsHeaders(request.headers.get('Origin')) },
    });
  }

  // Build the system prompt
  const langName = lang === 'ht' ? 'Haitian Creole' : lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
  // Language matching is MESSAGE-driven: small models weigh early
  // instructions most, so the language rule lives at the TOP of the
  // prompt with concrete few-shot examples — the trailing block keeps
  // only reply-quality rules. The main Chatbot.jsx sends its own
  // system_instruction and mirrors this structure.
  const langRules = `LANGUAGE (TOP PRIORITY):
- Reply in the language of the USER'S MESSAGE, whatever the platform UI language is: English message → English reply, Haitian Creole message → Haitian Creole reply, French message → French reply, Spanish message → Spanish reply.
- Examples: "What is Atelnyo?" → reply in English. "Ki sa Atelnyo ye?" → reply in Haitian Creole. "Qu'est-ce qu'Atelnyo ?" → reply in French.
- Use ${langName} ONLY when the message has no detectable language (single word, emoji only).

`;
  const styleBlock = `\n\nREPLY STYLE:
- Keep replies short in any language: 2-4 sentences for simple questions, short simple sentences, one idea per sentence, no walls of text.
- If you reply in Haitian Creole, write CLEAN Creole: never mix French or English words into Creole sentences. Say "pataje" not "publishe", "kontni" not "content", "antre" not "konekte", "gade" not "check", "twò" not "tro".
- Format links as [text](URL) and use **bold** for key info.
`;

  // ─── RETRIEVAL: Search ALL content from the backend ──────────
  // Uses /api/search/ (cross-module) for courses, music, talents,
  // communities, jobs, products, events — not just courses.
  let contentContext = '';
  try {
    // Search ALL content types at once
    const searchResp = await fetch(`${SSR_API}/api/search/?q=${encodeURIComponent(prompt)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const results = searchData.results || [];
      
      if (results.length > 0) {
        // Group results by type
        const grouped = {};
        for (const r of results) {
          const type = r.type || 'other';
          if (!grouped[type]) grouped[type] = [];
          grouped[type].push(r);
        }
        
        contentContext = '\n\nREAL CONTENT FOUND ON ATELNYO (use these to answer the user):\n';
        
        // Format courses
        if (grouped.courses) {
          contentContext += '\n📚 COURSES:\n';
          for (const c of grouped.courses.slice(0, 5)) {
            contentContext += `\n- **${c.title}** — ${c.url || 'https://atelnyo.site/explore'}`;
            if (c.price !== undefined) contentContext += `\n  Price: ${c.price === '0' || c.price === 0 ? 'Free' : '$' + c.price}`;
            if (c.difficulty) contentContext += ` | Difficulty: ${c.difficulty}`;
            if (c.creator_name) contentContext += ` | Creator: ${c.creator_name}`;
          }
        }
        
        // Format music
        if (grouped.music) {
          contentContext += '\n🎵 MUSIC:\n';
          for (const m of grouped.music.slice(0, 3)) {
            contentContext += `\n- **${m.title}** by ${m.artist || m.creator_name || 'Unknown'} — ${m.url || 'https://atelnyo.site/explore'}`;
          }
        }
        
        // Format talents
        if (grouped.talents) {
          contentContext += '\n⭐ TALENTS:\n';
          for (const t of grouped.talents.slice(0, 3)) {
            contentContext += `\n- **${t.title || t.display_name || t.username}** — ${t.url || 'https://atelnyo.site/explore'}`;
            if (t.skill) contentContext += ` | Skill: ${t.skill}`;
          }
        }
        
        // Format communities
        if (grouped.communities) {
          contentContext += '\n👥 COMMUNITIES:\n';
          for (const c of grouped.communities.slice(0, 3)) {
            contentContext += `\n- **${c.title || c.name}** — ${c.url || 'https://atelnyo.site/explore'}`;
          }
        }
        
        // Format jobs
        if (grouped.jobs) {
          contentContext += '\n💼 JOBS:\n';
          for (const j of grouped.jobs.slice(0, 3)) {
            contentContext += `\n- **${j.title}** — ${j.url || 'https://atelnyo.site/explore'}`;
            if (j.salary) contentContext += ` | Salary: ${j.salary}`;
          }
        }
        
        // Format products
        if (grouped.products) {
          contentContext += '\n🛍️ PRODUCTS:\n';
          for (const p of grouped.products.slice(0, 3)) {
            contentContext += `\n- **${p.title}** — ${p.url || 'https://atelnyo.site/explore'}`;
            if (p.price !== undefined) contentContext += ` | Price: $${p.price}`;
          }
        }
        
        // Format events
        if (grouped.events) {
          contentContext += '\n📅 EVENTS:\n';
          for (const e of grouped.events.slice(0, 3)) {
            contentContext += `\n- **${e.title}** — ${e.url || 'https://atelnyo.site/explore'}`;
            if (e.date) contentContext += ` | Date: ${e.date}`;
          }
        }
        
        contentContext += '\nUse the EXACT titles, prices, and URLs shown above. NEVER invent content.';
      }
    }
  } catch (e) {
    console.warn('[ai-chat] Global search failed:', e.message);
  }
  
  // Fallback: If global search returned nothing, try AI-specific course search
  if (!contentContext) {
    try {
      const courseResp = await fetch(`${SSR_API}/api/intelligence/ai/search/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, lang }),
      });
      if (courseResp.ok) {
        const courseData = await courseResp.json();
        if (courseData.courses && courseData.courses.length > 0) {
          contentContext = '\n\nREAL COURSES FOUND ON ATELNYO:\n';
          for (const c of courseData.courses) {
            contentContext += `\n- **${c.title}** (${c.url})`;
            if (c.price !== undefined) contentContext += ` | Price: ${c.price === '0' ? 'Free' : '$' + c.price}`;
            if (c.creator) contentContext += ` | Creator: ${c.creator}`;
          }
        }
      }
    } catch (e) {
      console.warn('[ai-chat] Course search also failed:', e.message);
    }
  }

  const sysPrompt = system_instruction || `You are Atelnyo AI, the official AI assistant for Atelnyo (atelnyo.site) — a Haitian educational platform where creators publish courses, products, music, and more.

${langRules}PLATFORM URLS — When you KNOW a real page, link it. URL formats:
- Courses: https://atelnyo.site/{slug}/by/{creator}/course
- Creator profiles: https://atelnyo.site/c/{creator-slug}
- Music: https://atelnyo.site/explore (music tab)
- Products: https://atelnyo.site/explore (marketplace tab)
- Events: https://atelnyo.site/explore (events tab)
- Jobs: https://atelnyo.site/explore (jobs tab)
- Explore all: https://atelnyo.site/explore

CONTENT TYPES:
📚 Courses — Programming, Design, Music, Languages, Business
🎵 Music — Tracks from independent artists
⭐ Talents — Creator showcases
👥 Communities — Group discussions
💼 Jobs — Remote work opportunities
🛍️ Products — Digital templates, resources
📅 Events — Workshops, meetups

PREMIUM MEMBERSHIP (share when asked):
- Plans: Monthly ($4.99), Quarterly ($11.99), Yearly ($39.99)
- Benefits: 25% off courses, exclusive themes, 2x referral commission
- Link: https://atelnyo.site/explore → Settings → Premium
${contentContext}

CRITICAL RULES:
1. **NEVER INVENT** titles, prices, creator names, or URLs. Use ONLY the real content provided above. If nothing matches, say so and direct to https://atelnyo.site/explore.
2. When linking to pages, ALWAYS use Markdown format: [text](https://atelnyo.site/path)
3. Use **bold** for important information like prices, key benefits, critical warnings.
4. Always use the Explore page (https://atelnyo.site/explore) when the user wants to browse or discover content.
5. Respond in the user's message language (LANGUAGE rules at the top take priority).
6. Be concise, helpful, and honest about what you know vs don't know — 2 to 4 short sentences for simple questions, no walls of text.${styleBlock}`;

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: prompt },
  ];

  // Try models in order — big first, small as fallback
  let lastError = null;
  for (const model of AI_MODELS) {
    try {
      const startTime = Date.now();

      const aiResponse = await env.AI.run(model, {
        messages,
      });

      const duration = Date.now() - startTime;
      // Workers AI returns {response: string} or {result: {response: string}}
      // Reasoning models may prepend <think>…</think> — strip it.
      const text = _stripThinking(aiResponse?.response || aiResponse?.result?.response || '');

      if (text) {
        return new Response(JSON.stringify({
          text,
          model,
          duration_ms: duration,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-AI-Model': model,
            'X-AI-Duration-Ms': String(duration),
            ..._corsHeaders(request.headers.get('Origin')),
          },
        });
      }
    } catch (err) {
      lastError = err;
      console.warn(`[ai-chat] Model ${model} failed:`, err.message);
      continue; // Try next model
    }
  }

  // All models failed
  console.error('[ai-chat] All models failed:', lastError?.message);
  return new Response(JSON.stringify({
    error: 'AI service error.',
    text: lang === 'ht'
      ? 'AI a gen yon erè. Tanpri eseye pliantan.'
      : 'AI service encountered an error. Please try again.',
    details: lastError?.message,
  }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', ..._corsHeaders(request.headers.get('Origin')) },
  });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const hostname = url.hostname;

    // ── API subdomain: proxy everything to backend ────────────────
    // When *.atelnyo.site/* route catches api.atelnyo.site, redirect
    // all requests to the Render backend instead of serving the SPA.
    if (hostname === 'api.atelnyo.site' || hostname === 'api-devrose.onrender.com') {
      const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
      try {
        const backendResp = await fetch(request, {
          redirect: 'follow',
          headers: {
            ...Object.fromEntries(request.headers),
            'Host': 'api-devrose.onrender.com',
          },
        });
        // WebSocket: return raw response (no header wrapping, no body read)
        if (isWebSocket) {
          return backendResp;
        }
        return new Response(backendResp.body, {
          status: backendResp.status,
          headers: _withSecurityHeaders(backendResp.headers),
        });
      } catch (_) {
        return new Response(JSON.stringify({ error: 'Backend unreachable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ..._corsHeaders(hostname) },
        });
      }
    }

    // ── LEGACY @-URL redirects (run first, before asset normalization) ──
    // Must fire BEFORE env.ASSETS sees the request: the asset handler
    // rewrites @ → %40 with a 307 (GSC "Erreur liée à des redirections").
    // An explicit single-hop 301 here consolidates the legacy shapes.
    const atRedirect = _handleLegacyAtRedirect(path);
    if (atRedirect) return atRedirect;

    // Internal build artifact, never a page: answer 404 instead of the SPA shell.
    if (path === '/_worker.js' || path.startsWith('/_worker')) {
      return new Response('Not Found', { status: 404 });
    }

    // ── SPA Fallback (serves index.html for client-side routes) ──
    // Static files (js, css, images) go to assets; everything else
    // returns index.html so React Router handles the route.
    const ext = path.split('.').pop().toLowerCase();
    const STATIC_EXTS = ['js','css','png','jpg','jpeg','gif','webp','svg','ico','woff','woff2','ttf','map','json'];
    const isStaticFile = STATIC_EXTS.includes(ext) && ext !== 'json';

    // Static assets → pass through to Cloudflare asset handler
    if (isStaticFile) {
      return env.ASSETS ? env.ASSETS.fetch(request) : fetch(request);
    }

    // /api/* routes → pass through to the API server (with security headers)
    //
    // IMPORTANT: fetch SSR_API (api.atelnyo.site), NEVER `request` itself.
    // Self-fetching re-enters this Worker for the same URL and Cloudflare
    // aborts the loop — the visitor sees a 522 (Connection timed out) on
    // the custom domain. Proxy to the real API host instead.
    if (path.startsWith('/api/') && !path.startsWith('/api/ai/')) {
      try {
        const apiUrl = new URL(`${SSR_API}${path}${url.search}`);
        const resp = await fetch(apiUrl, {
          method: request.method,
          headers: {
            ...Object.fromEntries(request.headers),
            'Host': apiUrl.hostname,
          },
          body: request.body,
          redirect: 'follow',
        });
        return new Response(resp.body, {
          status: resp.status,
          headers: _withSecurityHeaders(resp.headers),
        });
      } catch (_) {
        return new Response(JSON.stringify({ error: 'Backend unreachable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ..._corsHeaders(hostname) },
        });
      }
    }

    // /sitemap.xml → proxy to API sitemap endpoint
    if (path === '/sitemap.xml') {
      try {
        const resp = await fetch(`${SSR_API}/sitemap.xml`, {
          headers: { 'Accept': 'application/xml' },
        });
        if (resp.ok) {
          return new Response(resp.body, {
            status: 200,
            headers: _withSecurityHeaders({
              'Content-Type': 'application/xml; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            }),
          });
        }
        // Backend returned non-200 — return the backend error, not the SPA
        return new Response('Sitemap unavailable', {
          status: resp.status,
          headers: _withSecurityHeaders({
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
          }),
        });
      } catch (_) {
        // Backend unreachable — return 503, NOT the SPA
        return new Response('Sitemap service unavailable', {
          status: 503,
          headers: _withSecurityHeaders({
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
          }),
        });
      }
    }

    // /robots.txt → proxy to API
    if (path === '/robots.txt') {
      try {
        const resp = await fetch(`${SSR_API}/robots.txt`, {
          headers: { 'Accept': 'text/plain' },
        });
        if (resp.ok) {
          return new Response(resp.body, {
            status: 200,
            headers: _withSecurityHeaders({
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            }),
          });
        }
      } catch (_) { /* fall through */ }
    }

    // AI Chat endpoint
    if (path === '/api/ai/chat' || path === '/api/ai/chat/') {
      return _handleAIChat(request, env);
    }

    // SEO Prerender (GET only, crawlers only)
    if (request.method === 'GET') {
      const ua = request.headers.get('User-Agent') || '';
      if (BOT_RE.test(ua)) {
        for (const { re, api } of SSR_MAP) {
          const m = path.match(re);
          if (m) {
            try {
              const resp = await fetch(`${SSR_API}${api(m)}`, {
                headers: { 'User-Agent': ua, 'Accept': 'text/html' },
              });
              if (resp.ok) {
                return new Response(resp.body, {
                  status: 200,
                  headers: _withSecurityHeaders({
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600',
                  }),
                });
              }
              // Backend says the entity does NOT exist — serve a REAL 404
              // to the crawler instead of falling through to the 200 SPA
              // shell. A 200 for missing content is a soft-404 (GSC:
              // "Introuvable (404)"); a genuine 404 lets Google drop the
              // stale URL promptly. Any non-404 failure (5xx, 429, network)
              // still falls through to the SPA shell — never punish a
              // transient backend hiccup with a hard 404.
              if (resp.status === 404) {
                return new Response(_NOT_FOUND_HTML, {
                  status: 404,
                  headers: _withSecurityHeaders({
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'public, max-age=300',
                  }),
                });
              }
            } catch (_) { /* fall through to SPA */ }
          }
        }
        const shell = await _rewriteBotShell(request, env, path, url.origin);
        if (shell) return shell;
      }
    }

    // ── SPA: serve index.html for all other routes ──────────────
    if (env.ASSETS) {
      // Pass the ORIGINAL request through — with not_found_handling =
      // "single-page-application", the asset handler serves index.html
      // (200) AT the requested URL when no asset matches.
      //
      // DO NOT rewrite the URL to /index.html here: the asset handler's
      // html_handling normalizes /index.html → / with a 307 redirect,
      // which used to collapse EVERY deep link (/about, /explore, …)
      // onto the homepage for both visitors and crawlers.
      const resp = await env.ASSETS.fetch(request);
      return new Response(resp.body, {
        status: resp.status,
        headers: _withSecurityHeaders(resp.headers),
      });
    }
    // No ASSETS binding — the SPA cannot be served. Return a plain 404
    // instead of self-fetching index.html, which re-enters this Worker
    // for the same URL and loops until Cloudflare aborts with a 522.
    return new Response('Not Found', { status: 404 });
  },
};
