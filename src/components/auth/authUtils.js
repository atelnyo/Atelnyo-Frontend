/**
 * authUtils.js — Pure utility functions for the Auth component.
 *
 * No React hooks, no side effects — just helpers that can be tested
 * independently and imported by any auth-related module.
 */

// ─── Google Identity Services (GSI) ──────────────────────────────────
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

/**
 * Resolve the Google OAuth client ID. Build-time VITE_* wins;
 * otherwise fall back to the runtime value persisted by the admin
 * API-keys panel in localStorage.
 */
export function getGoogleClientId() {
  if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
  try {
    return (localStorage.getItem('atelnyo_google_client_id') || '').trim();
  } catch { return ''; }
}

// One-Tap / auto-select dismissal cooldown (24h).
const GSI_SKIP_KEY = 'atelnyo_gsi_skip_until';
const GSI_SKIP_MS = 24 * 60 * 60 * 1000;

export function gsiPromptSkipped() {
  try {
    const until = Number(localStorage.getItem(GSI_SKIP_KEY) || 0);
    return Date.now() < until;
  } catch { return false; }
}

export function rememberGsiSkipped() {
  try {
    localStorage.setItem(GSI_SKIP_KEY, String(Date.now() + GSI_SKIP_MS));
  } catch { /* ignore */ }
}

// ─── Google Resume (interrupted sign-in) ──────────────────────────────
const PENDING_GOOGLE_KEY = 'atelnyo_pending_google';

export function readPendingGoogle() {
  try {
    const raw = localStorage.getItem(PENDING_GOOGLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email || !parsed.at) return null;
    if (Date.now() - Number(parsed.at) > 48 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

export function writePendingGoogle(profile) {
  try {
    localStorage.setItem(PENDING_GOOGLE_KEY, JSON.stringify({
      ...profile,
      at: Date.now(),
    }));
  } catch { /* ignore */ }
}

export function clearPendingGoogle() {
  try { localStorage.removeItem(PENDING_GOOGLE_KEY); } catch { /* ignore */ }
}

// ─── Theme detection (for GSI button) ────────────────────────────────
export function isDarkTheme() {
  try {
    if (document.body?.classList.contains('dark-mode')) return true;
  } catch (_) { /* ignore */ }
  try {
    return localStorage.getItem('atelnyo_theme_mode') === 'dark';
  } catch (_) { return false; }
}

// ─── reCAPTCHA failure tracking ──────────────────────────────────────
const RECAPTCHA_FAILS_KEY = 'atelnyo_recaptcha_fails';
export const RECAPTCHA_FAIL_THRESHOLD = 3;

export function readFailedAttempts() {
  try { return Math.max(0, Number(localStorage.getItem(RECAPTCHA_FAILS_KEY) || 0)); }
  catch { return 0; }
}

export function writeFailedAttempts(n) {
  try { localStorage.setItem(RECAPTCHA_FAILS_KEY, String(n)); } catch { /* ignore */ }
}

export function clearFailedAttempts() {
  try { localStorage.removeItem(RECAPTCHA_FAILS_KEY); } catch { /* ignore */ }
}

// ─── Referral params (from URL query) ────────────────────────────────
export function readReferralParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      ref: (params.get('ref') || '').trim().slice(0, 12),
      refSource: (params.get('ref_source') || '').trim().slice(0, 64),
    };
  } catch { return { ref: '', refSource: '' }; }
}

// ─── OTP code extraction (paste from email/SMS) ──────────────────────
// Matches a standalone 6-digit code, optionally split as "482 913" or
// "482-913" (the reset email renders the code with big letter-spacing,
// which some clients copy out with a separator). Lookarounds (?<!\d) /
// (?!\d) anchor the run so longer digit sequences never match:
//   "123456"    → 123456   (bare code)
//   "1234567"   → ""       (7 digits is not an OTP)
//   "2026-09-26" → ""      (dates don't false-positive)
//   "20260926"  → ""       (8-digit ids don't false-positive)
// The 3+3 split keeps the regex readable and mirrors how the code is
// displayed in the email. First match wins when several codes appear.
const OTP_CODE_RE = /(?<!\d)(\d{3})[ \u00a0\u202f-]?(\d{3})(?!\d)/;

/**
 * Pull the first 6-digit OTP code out of free text (a pasted email,
 * SMS forward, etc.). Returns '' when no code is found so callers can
 * fall back to their default paste handling.
 */
export function extractOtpCode(text) {
  if (typeof text !== 'string') return '';
  const match = OTP_CODE_RE.exec(text);
  return match ? match[1] + match[2] : '';
}

// ─── Error message extraction ────────────────────────────────────────
export function extractError(err, lang = 'ht') {
  const msg = err?.response?.data?.error || err?.response?.data?.detail
    || (lang === 'ht' ? 'Gen yon erè ki fèt.' : 'An error occurred.');
  return typeof msg === 'string' ? msg : JSON.stringify(msg);
}

// ─── Email validation ────────────────────────────────────────────────
// Pragmatic RFC-5322-lite: local part + @ + domain with a TLD. Deliberately
// NOT exhaustive — the server is the source of truth; this exists to give
// instant inline feedback before the user hits submit.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

// ─── Password strength scoring ───────────────────────────────────────
// Mirrors Django's AUTH_PASSWORD_VALIDATORS (MinimumLength(8) + Common +
// Numeric) so client feedback matches server behavior. Returns a score
// 0-4 plus the unmet requirement list for the inline checklist UI.
export const MIN_PASSWORD_LENGTH = 8;

const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', 'qwerty123', 'password1',
  'iloveyou', 'admin123', 'welcome1', 'monkey123', 'letmein1',
  'abc12345', '12341234', 'aaaa1111', 'qwerty12', '1q2w3e4r',
]);

export function scorePassword(password) {
  const pw = typeof password === 'string' ? password : '';
  const checks = {
    length: pw.length >= MIN_PASSWORD_LENGTH,
    letter: /[a-zA-Z]/.test(pw),
    number: /\d/.test(pw),
    case: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  let score = 0;
  if (checks.length) score += 1;
  if (checks.letter && checks.number) score += 1;
  if (checks.case) score += 1;
  if (checks.symbol) score += 1;
  if (pw.length >= 12 && score >= 2) score += 1; // long + non-trivial bonus
  const isCommon = COMMON_PASSWORDS.has(pw.toLowerCase())
    || /^(0123|1234|1111|0000|abcd|qwer|asdf)/.test(pw.toLowerCase());
  if (isCommon) score = Math.min(score, 1);
  if (pw.length > 0 && pw.length < MIN_PASSWORD_LENGTH) score = Math.min(score, 1);
  return {
    score: Math.min(score, 4),
    checks,
    isCommon,
    met: checks.length && checks.letter && checks.number && !isCommon,
  };
}

// ─── Pre-submit form validation ──────────────────────────────────────
// Returns { field: message } keyed by form field name; empty object when
// the form is valid. Bilingual (ht/en) to match the Auth component.
export function validateSignupFields({ email, password, confirmPassword }, lang = 'ht') {
  const errors = {};
  const ht = lang === 'ht';
  if (!isValidEmail(email)) {
    errors.email = ht ? 'Antre yon adrès imèl ki valid.' : 'Enter a valid email address.';
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.password = ht
      ? `Modpas dwe gen omwen ${MIN_PASSWORD_LENGTH} karaktè.`
      : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    errors.password = ht
      ? 'Modpas dwe gen omwen yon chif ak yon lèt.'
      : 'Password needs at least one letter and one number.';
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = ht ? 'Modpas yo pa menm.' : 'Passwords do not match.';
  }
  return errors;
}

export function validateLoginFields({ email, password }, lang = 'ht') {
  const errors = {};
  const ht = lang === 'ht';
  if (!email || !email.trim()) {
    errors.email = ht ? 'Antre imèl oswa non itilizatè ou.' : 'Enter your email or username.';
  }
  if (!password) {
    errors.password = ht ? 'Antre modpas ou.' : 'Enter your password.';
  }
  return errors;
}
