/**
 * affiliateAttribution.js — carries the affiliate attribution JWT across
 * SPA navigation.
 *
 * The /go/<code> redirect lands the visitor on /sheet/marketplace/<id> or
 * /creator/<username> with the token in the URL fragment
 * (#aff_token=<JWT>). React Router replaces the whole URL on navigation,
 * so a token that lives ONLY in the hash is dropped the moment the visitor
 * moves to any other page — and CheckoutModal reads it at payment time,
 * which can be several clicks later.
 *
 * We therefore capture the token EAGERLY (App.jsx calls captureAffiliateToken
 * on every route change) into sessionStorage, which:
 *   - survives navigation within the tab (the gap we are closing), and
 *   - is cleared when the tab closes — matching the JWT's short 15-minute
 *     lifetime (no stale token lingering in localStorage for days).
 *
 * The backend re-validates the JWT (signature + exp) at payment time, so
 * this storage is pure transport: an expired/tampered token is simply
 * rejected and no AffiliateConversion is created.
 */
const STORAGE_KEY = 'aff_attribution_token';

function readHashToken() {
  if (typeof window === 'undefined') {
    return null;
  }
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]aff_token=([^&]+)/);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function stripHashToken() {
  if (typeof window === 'undefined') {
    return;
  }
  const hash = window.location.hash || '';
  if (!hash.includes('aff_token')) {
    return;
  }
  const newHash = hash
    .replace(/[?&]aff_token=[^&]+/, '')
    .replace(/[?&]#/, '#')
    .replace(/#$/, '');
  if (window.history.replaceState) {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + newHash,
    );
  }
}

/**
 * Persist the #aff_token=<JWT> fragment into sessionStorage and strip it
 * from the URL (so it never lingers in history). Idempotent — safe to call
 * on every route change. Returns the captured token or null.
 */
export function captureAffiliateToken() {
  const token = readHashToken();
  if (token) {
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      /* storage may be unavailable (private mode) — the hash fallback in
         getAffiliateAttributionToken still covers the landing page itself */
    }
    stripHashToken();
  }
  return token;
}

/**
 * The token to attach to checkout, or null. sessionStorage first (survives
 * navigation); the URL hash as a fallback — a visitor who lands on a
 * product page and buys without navigating first may still carry the token
 * in the fragment, which is captured here for the next read.
 */
export function getAffiliateAttributionToken() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    /* fall through to the hash */
  }
  return captureAffiliateToken();
}

/** Forget the token once the purchase it was meant for has completed. */
export function clearAffiliateAttributionToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
