/**
 * src/services/recaptcha.js — reCAPTCHA v3 (invisible) + v2 (checkbox)
 * loader/executor for the auth forms (T008).
 *
 * Site keys are resolved at RUNTIME from the public
 * GET /api/config/public/ endpoint (with a build-time
 * VITE_RECAPTCHA_SITE_KEY / VITE_RECAPTCHA_V2_SITE_KEY fallback),
 * mirroring how ``google_client_id`` activates Google sign-in — an
 * admin can turn CAPTCHA on/off from the API-keys panel without a
 * redeploy.
 *
 * Failure behaviour is deliberately SOFT:
 *   * No site key configured → every helper returns '' / null, and the
 *     backend's env-gated verification is a no-op anyway (the service
 *     only enforces when RECAPTCHA_SECRET_KEY is set), so a missing
 *     Google key never blocks sign-in.
 *   * Google's script fails to load or the token call throws → same ''
 *     fallback; the backend's fail-open path then lets the request
 *     through (IP throttling still bounds abuse).
 */

let _scriptPromise = null;

function _loadScript(siteKey) {
  const key = (siteKey || '').trim();
  if (!key) {return Promise.resolve(null);}
  if (_scriptPromise) {return _scriptPromise;}
  _scriptPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(null);
      return;
    }
    if (window.grecaptcha) {
      resolve(window.grecaptcha);
      return;
    }
    const script = document.createElement('script');
    // The standard v3 pattern: render=<sitekey> registers the v3 client
    // so grecaptcha.execute(key, {action}) works, while explicit
    // grecaptcha.render() calls (v2 checkbox) stay available too.
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.grecaptcha || null);
    script.onerror = () => {
      _scriptPromise = null; // allow a retry on the next call
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return _scriptPromise;
}

function _ready(grecaptcha) {
  if (grecaptcha && typeof grecaptcha.ready === 'function') {
    return new Promise((resolve) => grecaptcha.ready(resolve));
  }
  return Promise.resolve();
}

/**
 * Resolve the v3 site key: build-time env first, then the localStorage
 * cache written by Auth.jsx when the public runtime config was fetched.
 */
export function getRecaptchaV3Key() {
  const buildTime = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
  if (buildTime) {return buildTime;}
  try {
    return (localStorage.getItem('atelnyo_recaptcha_site_key') || '').trim();
  } catch {
    return '';
  }
}

/** Resolve the v2 checkbox site key (build-time → runtime cache). */
export function getRecaptchaV2Key() {
  const buildTime = (import.meta.env.VITE_RECAPTCHA_V2_SITE_KEY || '').trim();
  if (buildTime) {return buildTime;}
  try {
    return (localStorage.getItem('atelnyo_recaptcha_v2_site_key') || '').trim();
  } catch {
    return '';
  }
}

/** Persist the runtime-config keys so other components can reuse them. */
export function cacheRecaptchaKeys({ siteKey = '', v2SiteKey = '' } = {}) {
  try {
    if (siteKey) {localStorage.setItem('atelnyo_recaptcha_site_key', siteKey);}
    if (v2SiteKey) {localStorage.setItem('atelnyo_recaptcha_v2_site_key', v2SiteKey);}
  } catch { /* ignore */ }
}

export function isRecaptchaConfigured(siteKey) {
  return Boolean((siteKey || '').trim());
}

/**
 * v3 invisible token. Resolves to a token string ('' when the service
 * is unavailable / not configured).
 */
export async function executeRecaptcha(siteKey, action = 'submit') {
  const key = (siteKey || '').trim();
  if (!key) {return '';}
  try {
    const grecaptcha = await _loadScript(key);
    if (!grecaptcha || typeof grecaptcha.execute !== 'function') {return '';}
    await _ready(grecaptcha);
    return await grecaptcha.execute(key, { action });
  } catch (_) {
    return '';
  }
}

/**
 * v2 checkbox widget. Renders into ``container`` and resolves with the
 * token once the user ticks the box; resolves null on render failure or
 * widget expiry. Returns null when no v2 key is configured.
 */
export async function renderV2Checkbox(container, v2SiteKey, { theme = 'light' } = {}) {
  const key = (v2SiteKey || '').trim();
  if (!key || !container) {return null;}
  try {
    const grecaptcha = await _loadScript(key);
    if (!grecaptcha || typeof grecaptcha.render !== 'function') {return null;}
    await _ready(grecaptcha);
    return new Promise((resolve) => {
      try {
        grecaptcha.render(container, {
          sitekey: key,
          size: 'normal',
          theme,
          callback: (token) => resolve(token),
          'expired-callback': () => resolve(null),
          'error-callback': () => resolve(null),
        });
      } catch (_) {
        resolve(null);
      }
    });
  } catch (_) {
    return null;
  }
}

/** Clear a previously rendered v2 widget so it can be re-rendered. */
export function resetV2Checkbox(container) {
  if (!container) {return;}
  try {
    container.innerHTML = '';
  } catch { /* ignore */ }
  try {
    if (window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
      window.grecaptcha.reset();
    }
  } catch { /* ignore */ }
}
