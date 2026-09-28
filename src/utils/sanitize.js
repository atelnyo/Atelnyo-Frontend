/**
 * Frontend content sanitization utilities (Phase 11).
 *
 * This is defense-in-depth — the Django backend is the authoritative
 * sanitizer. These helpers prevent obviously malicious content from
 * reaching the API in the first place, and provide safe rendering
 * for content that might contain user input.
 *
 * Usage:
 *   import { sanitizePlainText, sanitizeUrl, sanitizeRichText } from '../utils/sanitize';
 */

/**
 * Sanitize plain text — strips HTML tags, escapes entities.
 * Use for alt text, titles, descriptions, labels.
 */
export function sanitizePlainText(text, maxLength = 10000) {
  if (!text || typeof text !== 'string') return '';

  let clean = text
    // Strip HTML tags entirely
    .replace(/<[^>]+>/g, '')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove null bytes
    .replace(/\x00/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  return clean;
}

/**
 * Sanitize alt text — strict plain text, no quotes.
 * Use specifically for image alt attributes.
 */
export function sanitizeAltText(text, maxLength = 300) {
  if (!text || typeof text !== 'string') return '';

  return sanitizePlainText(text, maxLength)
    .replace(/"/g, '')
    .replace(/'/g, '');
}

const BLOCKED_SCHEMES = ['javascript:', 'data:text/html', 'vbscript:', 'file:'];
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];

/**
 * Validate and sanitize a URL.
 * Returns the sanitized URL or empty string if dangerous.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Block dangerous schemes
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) return '';
  }

  // Block private hosts (for http/https only)
  try {
    const parsed = new URL(trimmed);
    if (BLOCKED_HOSTS.includes(parsed.hostname)) return '';
    if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) return '';
  } catch {
    // Not a valid URL — could be a relative path, which is fine
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
    return '';
  }

  return trimmed;
}

/**
 * Check if a URL is an external link.
 */
export function isExternalUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const atelnyoHosts = ['atelnyo.site', 'api.atelnyo.site'];
    return !atelnyoHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

const RICH_TEXT_DANGEROUS_TAGS = /<\s*\/?\s*(?:script|object|embed|applet|form|input|textarea|select|button|iframe|style|meta|link|base)\b[^>]*>/gi;
const RICH_TEXT_EVENT_HANDLERS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi;
const RICH_TEXT_JS_URLS = /((?:href|src|action|formaction|poster|background)\s*=\s*)(["'])\s*javascript\s*:/gi;

/**
 * Basic rich text sanitizer — strips dangerous tags and event handlers.
 * For more thorough sanitization, the backend uses its own implementation.
 */
export function sanitizeRichText(html, maxLength = 100000) {
  if (!html || typeof html !== 'string') return '';

  let clean = html.slice(0, maxLength);

  // Remove dangerous tags
  clean = clean.replace(RICH_TEXT_DANGEROUS_TAGS, '');

  // Remove event handlers
  clean = clean.replace(RICH_TEXT_EVENT_HANDLERS, '');

  // Neutralize javascript: URLs
  clean = clean.replace(RICH_TEXT_JS_URLS, '$1$2#');

  // Remove any remaining script/vbscript/data schemes
  clean = clean.replace(/javascript\s*:/gi, '');
  clean = clean.replace(/vbscript\s*:/gi, '');

  return clean.trim();
}

/**
 * Sanitize a filename for safe display.
 */
export function sanitizeFilename(filename, maxLength = 255) {
  if (!filename || typeof filename !== 'string') return 'unnamed';

  // Take basename only
  let clean = filename.split('/').pop().split('\\').pop();

  // Remove null bytes and dangerous characters
  clean = clean
    .replace(/\x00/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')  // Remove leading dots
    .replace(/[\s.]+$/, '')  // Remove trailing dots/spaces
    .trim();

  if (clean.length > maxLength) {
    const ext = clean.lastIndexOf('.');
    if (ext > 0 && clean.length - ext < 10) {
      clean = clean.slice(0, maxLength - (clean.length - ext) - 1) + clean.slice(ext);
    } else {
      clean = clean.slice(0, maxLength);
    }
  }

  return clean || 'unnamed';
}

/**
 * Escape HTML entities in a string for safe rendering.
 * Use when rendering user-provided text in dangerouslySetInnerHTML contexts.
 */
export function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip all HTML tags from a string, keeping only text content.
 */
export function stripTags(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]+>/g, '').trim();
}
