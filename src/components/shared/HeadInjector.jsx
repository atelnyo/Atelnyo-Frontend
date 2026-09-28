/**
 * src/components/shared/HeadInjector.jsx
 *
 * Injects admin-configured head codes into <head> on every page load.
 *
 * The admin can paste Facebook/Google verification codes, analytics,
 * Meta Pixel, and raw HTML/script snippets in the API-keys panel
 * (/sheet/admin/config → "SEO / Verification / Tracking"). Those values
 * are stored in PlatformConfig and exposed via GET /api/config/public/.
 * This component reads them at runtime and writes the tags into
 * document.head — no redeploy needed when an admin edits a code.
 *
 * Fields injected:
 *   facebook_domain_verification → <meta name="facebook-domain-verification">
 *   google_site_verification     → <meta name="google-site-verification">
 *   google_analytics_id          → Google Analytics 4 (gtag) snippet
 *   facebook_pixel_id            → Meta Pixel snippet
 *   custom_head_html             → raw HTML (meta/link/style appended;
 *                                  <script> tags are re-created so they run)
 *
 * The component renders nothing — it only touches document.head, once,
 * guarded by a document-level flag so it survives remounts.
 */
import { useEffect } from 'react';
import api from '../../services/api';

const INJECTED_FLAG = 'data-atelnyo-head-codes';

function ensureMeta(name, content) {
  if (!content) return;
  if (document.head.querySelector(`meta[name="${name}"]`)) return;
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.appendChild(meta);
}

function appendScript(src, inline, extra = {}) {
  const s = document.createElement('script');
  if (src) s.src = src;
  if (inline) s.text = inline;
  Object.entries(extra || {}).forEach(([k, v]) => {
    if (v != null && v !== false) s.setAttribute(k, String(v));
  });
  document.head.appendChild(s);
}

function injectAnalytics(id) {
  if (!id || document.querySelector(`script[data-gtag-id="${id}"]`)) return;
  appendScript(
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
    null,
    { async: true, 'data-gtag-id': id },
  );
  appendScript(null, `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}');
  `, { 'data-gtag-id': id });
}

function injectPixel(id) {
  if (!id || document.querySelector(`script[data-pixel-id="${id}"]`)) return;
  appendScript(null, `
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${id}');
    fbq('track', 'PageView');
  `, { 'data-pixel-id': id });
  // noscript fallback image (standard Meta Pixel snippet)
  const noscript = document.createElement('noscript');
  const img = document.createElement('img');
  img.height = 1;
  img.width = 1;
  img.style.display = 'none';
  img.src = `https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.head.appendChild(noscript);
}

/**
 * Inject raw HTML into <head>. meta/link/style/base elements are appended
 * directly; <script> elements are re-created so their code actually runs
 * (innerHTML-injected scripts do not execute in browsers).
 */
function injectRawHtml(html) {
  if (!html || typeof document === 'undefined') return;
  const container = document.createElement('div');
  container.innerHTML = html;
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'script') {
      const src = node.getAttribute('src');
      const inline = node.textContent || '';
      if (src) appendScript(src, null, { async: true });
      else if (inline.trim()) appendScript(null, inline);
    } else {
      document.head.appendChild(node);
    }
  });
}

export default function HeadInjector() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Run once per page load, even if the component remounts.
    if (document.documentElement.hasAttribute(INJECTED_FLAG)) return;
    let cancelled = false;

    api.get('config/public/')
      .then((resp) => {
        if (cancelled) return;
        const d = resp?.data || {};
        ensureMeta('facebook-domain-verification', d.facebook_domain_verification);
        ensureMeta('google-site-verification', d.google_site_verification);
        injectAnalytics(d.google_analytics_id);
        injectPixel(d.facebook_pixel_id);
        injectRawHtml(d.custom_head_html);
        document.documentElement.setAttribute(INJECTED_FLAG, '1');
      })
      .catch(() => {
        // Never block the app on a config fetch failure — head codes are
        // best-effort. Mark as injected so we don't retry on every mount.
        document.documentElement.setAttribute(INJECTED_FLAG, '1');
      });

    return () => { cancelled = true; };
  }, []);

  return null;
}
