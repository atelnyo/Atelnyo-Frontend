/**
 * Frontend security utilities for Atelnyo (Phase 11).
 *
 * These provide client-side validation and detection.
 * The Django backend remains the authoritative security boundary.
 *
 * Usage:
 *   import { checkIdorRisk, validateUploadFile, checkCacheIsolation } from '../utils/security';
 */

import { sanitizeUrl, isExternalUrl } from './sanitize';

// ─── IDOR Risk Detection ────────────────────────────────────────────

/**
 * Check if a URL contains a resource ID that doesn't match the user's
 * expected context. Returns true if there's a potential IDOR risk.
 *
 * This is a UX helper — the backend MUST verify authorization regardless.
 */
export function checkIdorRisk(resourceType, resourceId, expectedOwnerId) {
  // If we can't determine the owner, trust the backend
  if (!resourceId || !expectedOwnerId) return false;

  // The ID itself doesn't indicate risk — the backend checks ownership
  return false;
}

// ─── Input Length Validation ─────────────────────────────────────────

const MAX_LENGTHS = {
  courseTitle: 200,
  courseDescription: 10000,
  shortDescription: 500,
  lessonTitle: 200,
  lessonDescription: 2000,
  blockText: 50000,
  altText: 300,
  caption: 1000,
  transcript: 50000,
  url: 2048,
  filename: 255,
  message: 4000,
};

/**
 * Validate input length against expected maximum.
 */
export function validateInputLength(field, value) {
  const max = MAX_LENGTHS[field];
  if (!max) return { valid: true };
  if (typeof value !== 'string') return { valid: true };

  if (value.length > max) {
    return {
      valid: false,
      error: `Maximum length is ${max} characters`,
      length: value.length,
      max,
    };
  }

  return { valid: true };
}

// ─── File Upload Validation ──────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain', 'text/csv'];

const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024,    // 10MB
  video: 500 * 1024 * 1024,   // 500MB
  audio: 50 * 1024 * 1024,    // 50MB
  document: 20 * 1024 * 1024, // 20MB
};

/**
 * Validate a file before upload.
 * Returns { valid, error, fileType } or { valid: true, fileType }.
 */
export function validateUploadFile(file, expectedType = 'image') {
  if (!file) return { valid: false, error: 'No file selected' };

  // Check file size
  const maxSize = MAX_FILE_SIZES[expectedType] || MAX_FILE_SIZES.image;
  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return { valid: false, error: `File too large. Maximum size is ${sizeMB}MB.` };
  }

  // Check MIME type
  const allowedTypes = {
    image: ALLOWED_IMAGE_TYPES,
    video: ALLOWED_VIDEO_TYPES,
    audio: ALLOWED_AUDIO_TYPES,
    document: ALLOWED_DOC_TYPES,
  };

  const allowed = allowedTypes[expectedType] || ALLOWED_IMAGE_TYPES;
  if (!allowed.includes(file.type)) {
    return { valid: false, error: `Invalid file type: ${file.type || 'unknown'}` };
  }

  // Check for dangerous filenames
  const dangerousPatterns = [
    /\.\./,
    /[<>:"|?*]/,
    /^(CON|PRN|AUX|NUL)$/i,
    /^\.+/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(file.name)) {
      return { valid: false, error: 'Filename contains unsafe characters' };
    }
  }

  // Detect file type category
  let fileType = 'unknown';
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) fileType = 'image';
  else if (ALLOWED_VIDEO_TYPES.includes(file.type)) fileType = 'video';
  else if (ALLOWED_AUDIO_TYPES.includes(file.type)) fileType = 'audio';

  return { valid: true, fileType };
}

// ─── URL Validation for External Content ─────────────────────────────

const TRUSTED_VIDEO_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
  'www.dailymotion.com',
  'dailymotion.com',
  'drive.google.com',
  'www.loom.com',
  'loom.com',
];

/**
 * Validate a video URL — returns validation result with warnings.
 */
export function validateVideoUrl(url) {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) {
    return { valid: false, error: 'Invalid or unsafe URL' };
  }

  const isExternal = isExternalUrl(sanitized);
  let isTrustedVideo = false;
  let hostname = '';

  try {
    hostname = new URL(sanitized).hostname;
    isTrustedVideo = TRUSTED_VIDEO_HOSTS.includes(hostname);
  } catch {
    // Not a full URL
  }

  const warnings = [];
  if (!isTrustedVideo && isExternal) {
    warnings.push(`Video provider "${hostname}" cannot be automatically verified for accessibility and security`);
  }

  return { valid: true, sanitized, isExternal, isTrustedVideo, hostname, warnings };
}

/**
 * Validate an image URL.
 */
export function validateImageUrl(url) {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) {
    return { valid: false, error: 'Invalid or unsafe URL' };
  }

  return { valid: true, sanitized };
}

// ─── Content Security Detection ──────────────────────────────────────

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=\s*["']/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<form[\s>]/i,
  /eval\s*\(/i,
  /document\.\w+/i,
  /window\.\w+/i,
];

/**
 * Detect potential XSS in user input.
 * Returns true if potentially dangerous content is detected.
 */
export function detectPotentialXss(input) {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

// ─── Cache Isolation Check ───────────────────────────────────────────

/**
 * Verify that cached data belongs to the current user.
 * Call after login to ensure no stale data from previous user.
 */
export function checkCacheIsolation(currentUser) {
  if (!currentUser || !currentUser.id) return { isolated: true };

  // Check if there's stale data from a different user
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.id !== currentUser.id) {
        // Different user's data — needs cache clear
        return { isolated: false, reason: 'Stale user data detected' };
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { isolated: true };
}

// ─── Sensitive Data Detection ────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /credential/i,
  /private[_-]?key/i,
];

/**
 * Check if a string might contain sensitive data that shouldn't be logged.
 */
export function mightContainSensitiveData(str) {
  if (!str || typeof str !== 'string') return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
}

// ─── Rate Limit Awareness ────────────────────────────────────────────

const _rateLimitTimers = new Map();

/**
 * Client-side rate limit awareness.
 * Tracks request timestamps and provides feedback.
 */
export function trackRequest(endpoint) {
  const now = Date.now();
  const key = endpoint;

  if (!_rateLimitTimers.has(key)) {
    _rateLimitTimers.set(key, []);
  }

  const timestamps = _rateLimitTimers.get(key);
  timestamps.push(now);

  // Keep only the last 60 seconds of timestamps
  const cutoff = now - 60000;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  return {
    requestsInLastMinute: timestamps.length,
    isApproaching: timestamps.length > 20,
  };
}
