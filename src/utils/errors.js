/**
 * Centralized error model for Atelnyo (Phase 12).
 *
 * Provides:
 * - Error classification (type, severity, retryability)
 * - Machine-readable error codes
 * - User-facing localized messages (ht/en)
 * - Recovery strategies
 * - Error creation factory
 *
 * Usage:
 *   import { createError, ErrorCodes } from '../utils/errors';
 *   const err = createError(ErrorCodes.NETWORK_UNAVAILABLE);
 *   // if (err.retryable) { retry }
 */

// ─── Error Categories ───────────────────────────────────────────────

export const ErrorCategory = {
  NETWORK: 'network',
  AUTH: 'auth',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  DATABASE: 'database',
  MEDIA: 'media',
  UPLOAD: 'upload',
  SYNC: 'sync',
  OFFLINE: 'offline',
  CLIENT: 'client',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown',
};

// ─── Error Codes ────────────────────────────────────────────────────

export const ErrorCodes = {
  // Network
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_DNS_FAILED: 'NETWORK_DNS_FAILED',

  // Auth
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',

  // Permission
  ACCESS_DENIED: 'ACCESS_DENIED',
  COURSE_ACCESS_DENIED: 'COURSE_ACCESS_DENIED',
  PUBLISH_UNAUTHORIZED: 'PUBLISH_UNAUTHORIZED',

  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_BLOCK: 'INVALID_BLOCK',
  PUBLISH_VALIDATION_FAILED: 'PUBLISH_VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',

  // Not Found
  COURSE_NOT_FOUND: 'COURSE_NOT_FOUND',
  LESSON_NOT_FOUND: 'LESSON_NOT_FOUND',
  BLOCK_NOT_FOUND: 'BLOCK_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // Conflict
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  EDIT_CONFLICT: 'EDIT_CONFLICT',

  // Rate Limit
  RATE_LIMITED: 'RATE_LIMITED',

  // Server
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',

  // Media
  MEDIA_LOAD_FAILED: 'MEDIA_LOAD_FAILED',
  MEDIA_UNSUPPORTED: 'MEDIA_UNSUPPORTED',

  // Upload
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  UPLOAD_TOO_LARGE: 'UPLOAD_TOO_LARGE',
  UPLOAD_CANCELLED: 'UPLOAD_CANCELLED',

  // Sync
  SYNC_FAILED: 'SYNC_FAILED',
  SYNC_TIMEOUT: 'SYNC_TIMEOUT',
  OFFLINE_QUEUE_FULL: 'OFFLINE_QUEUE_FULL',

  // Offline
  OFFLINE: 'OFFLINE',

  // Client
  CHUNK_LOAD_FAILED: 'CHUNK_LOAD_FAILED',
  RENDER_ERROR: 'RENDER_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// ─── Severity Levels ────────────────────────────────────────────────

export const Severity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ─── Retryability ───────────────────────────────────────────────────

export const Retryability = {
  RETRYABLE: 'retryable',
  NOT_RETRYABLE: 'not_retryable',
  CONDITIONALLY_RETRYABLE: 'conditional',
};

// ─── Error Code Definitions ─────────────────────────────────────────

const ERROR_DEFINITIONS = {
  [ErrorCodes.NETWORK_UNAVAILABLE]: {
    category: ErrorCategory.NETWORK,
    severity: Severity.HIGH,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: 'No internet connection. Your changes are saved locally and will sync when you reconnect.',
      ht: 'Pa gen koneksyon entènèt. Chanjman ou yo konsève sou aparèy la e yo ap senkronize lè ou retounen sou entènèt.',
    },
    recovery: 'retry_or_queue_offline',
  },
  [ErrorCodes.NETWORK_TIMEOUT]: {
    category: ErrorCategory.TIMEOUT,
    severity: Severity.MEDIUM,
    retryable: Retryability.RETRYABLE,
    httpStatus: 408,
    messages: {
      en: 'The server is taking too long to respond. Please try again.',
      ht: 'Sèvè a pran twòp tan pou reponn. Eseye ankò.',
    },
    recovery: 'retry',
  },
  [ErrorCodes.SESSION_EXPIRED]: {
    category: ErrorCategory.AUTH,
    severity: Severity.MEDIUM,
    retryable: Retryability.CONDITIONALLY_RETRYABLE,
    httpStatus: 401,
    messages: {
      en: 'Your session has expired. Please log in again.',
      ht: 'Sesyon ou a ekspire. Konplete enfòmasyon koneksyon ou ankò.',
    },
    recovery: 'refresh_token_or_login',
  },
  [ErrorCodes.COURSE_ACCESS_DENIED]: {
    category: ErrorCategory.PERMISSION,
    severity: Severity.MEDIUM,
    retryable: Retryability.NOT_RETRYABLE,
    httpStatus: 403,
    messages: {
      en: "You don't have access to this course.",
      ht: "Ou pa gen akses nan kou sa a.",
    },
    recovery: 'navigate_back',
  },
  [ErrorCodes.SYNC_CONFLICT]: {
    category: ErrorCategory.CONFLICT,
    severity: Severity.MEDIUM,
    retryable: Retryability.CONDITIONALLY_RETRYABLE,
    httpStatus: 409,
    messages: {
      en: 'This content was modified on another device. Your local changes are preserved.',
      ht: 'Kontni sa a modifye sou yon lòt aparèy. Chanjman lokal ou yo konsève.',
    },
    recovery: 'resolve_conflict',
  },
  [ErrorCodes.RATE_LIMITED]: {
    category: ErrorCategory.RATE_LIMIT,
    severity: Severity.LOW,
    retryable: Retryability.CONDITIONALLY_RETRYABLE,
    httpStatus: 429,
    messages: {
      en: "Too many requests. We'll try again in a moment.",
      ht: 'Twòp rekesyon. Nou ap eseye ankò nan yon ti moman.',
    },
    recovery: 'retry_with_backoff',
  },
  [ErrorCodes.SERVER_ERROR]: {
    category: ErrorCategory.SERVER,
    severity: Severity.HIGH,
    retryable: Retryability.RETRYABLE,
    httpStatus: 500,
    messages: {
      en: 'Something went wrong on our end. Your data is safe. Please try again.',
      ht: 'Gen yon erè sou bò nou. Done ou an an sekirite. Eseye ankò.',
    },
    recovery: 'retry',
  },
  [ErrorCodes.UPLOAD_FAILED]: {
    category: ErrorCategory.UPLOAD,
    severity: Severity.MEDIUM,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: 'Upload failed. Your file is preserved locally. You can retry.',
      ht: 'Telechajman echwe. Fichye ou an konsève lokalman. Ou ka eseye ankò.',
    },
    recovery: 'retry',
  },
  [ErrorCodes.SYNC_FAILED]: {
    category: ErrorCategory.SYNC,
    severity: Severity.MEDIUM,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: "Sync failed. Your changes are saved locally and will retry automatically.",
      ht: 'Senkronizasyon echwe. Chanjman ou yo konsève lokalman e yo ap eseye otomatikman.',
    },
    recovery: 'retry_automatically',
  },
  [ErrorCodes.MEDIA_LOAD_FAILED]: {
    category: ErrorCategory.MEDIA,
    severity: Severity.LOW,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: 'This media could not be loaded. You can retry or continue without it.',
      ht: 'Medya sa a pa t ka chaje. Ou ka eseye ankò oswa kontinye san li.',
    },
    recovery: 'retry_or_skip',
  },
  [ErrorCodes.OFFLINE]: {
    category: ErrorCategory.OFFLINE,
    severity: Severity.LOW,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: "You're offline. Changes are saved locally.",
      ht: 'Ou offline. Chanjman yo konsève sou aparèy la.',
    },
    recovery: 'queue_offline',
  },
  [ErrorCodes.CHUNK_LOAD_FAILED]: {
    category: ErrorCategory.CLIENT,
    severity: Severity.MEDIUM,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: 'Failed to load part of the application. Reloading may fix this.',
      ht: 'Echwe pou chaje yon pati nan aplikasyon an. Reyechaj ka rezoud sa.',
    },
    recovery: 'reload',
  },
  [ErrorCodes.VALIDATION_FAILED]: {
    category: ErrorCategory.VALIDATION,
    severity: Severity.LOW,
    retryable: Retryability.NOT_RETRYABLE,
    httpStatus: 400,
    messages: {
      en: 'Please check your input and try again.',
      ht: 'Tcheke enfòmasyon ou an e eseye ankò.',
    },
    recovery: 'fix_input',
  },
  [ErrorCodes.PUBLISH_VALIDATION_FAILED]: {
    category: ErrorCategory.VALIDATION,
    severity: Severity.LOW,
    retryable: Retryability.NOT_RETRYABLE,
    httpStatus: 400,
    messages: {
      en: 'This course is not ready to publish. Please fix the issues below.',
      ht: 'Kou sa a pa pare pou pibliye. Rezoud pwoblèm yo anba a.',
    },
    recovery: 'fix_issues',
  },
  [ErrorCodes.RESOURCE_NOT_FOUND]: {
    category: ErrorCategory.NOT_FOUND,
    severity: Severity.LOW,
    retryable: Retryability.NOT_RETRYABLE,
    httpStatus: 404,
    messages: {
      en: 'The requested resource was not found.',
      ht: 'Rechèch la pa jwenn.',
    },
    recovery: 'navigate_back',
  },
  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    category: ErrorCategory.SERVER,
    severity: Severity.HIGH,
    retryable: Retryability.RETRYABLE,
    httpStatus: 503,
    messages: {
      en: 'The service is temporarily unavailable. Please try again later.',
      ht: 'Sèvis la pa disponib temporalman. Eseye ankò pita.',
    },
    recovery: 'retry_later',
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    category: ErrorCategory.UNKNOWN,
    severity: Severity.MEDIUM,
    retryable: Retryability.RETRYABLE,
    httpStatus: null,
    messages: {
      en: 'An unexpected error occurred. Please try again.',
      ht: 'Yon erè enprevè rive. Eseye ankò.',
    },
    recovery: 'retry',
  },
  [ErrorCodes.STORAGE_ERROR]: {
    category: ErrorCategory.CLIENT,
    severity: Severity.HIGH,
    retryable: Retryability.NOT_RETRYABLE,
    httpStatus: null,
    messages: {
      en: 'Local storage is unavailable. Some features may not work correctly.',
      ht: 'Stokaj lokal la pa disponib. kèk karakteristik ka pa fonksyone kòrèkteman.',
    },
    recovery: 'degrade',
  },
  [ErrorCodes.MAINTENANCE_MODE]: {
    category: ErrorCategory.SERVER,
    severity: Severity.HIGH,
    retryable: Retryability.NOT_RETRYABLE,
    httpStatus: 503,
    messages: {
      en: 'Atelnyo is temporarily under maintenance. Please try again later.',
      ht: 'Atelnyo temporarily under maintenance. Please try again later.',
    },
    recovery: 'wait_and_retry',
  },
};

// ─── Error Factory ──────────────────────────────────────────────────

/**
 * Create a structured error from an error code.
 *
 * @param {string} code - One of ErrorCodes
 * @param {object} [context] - Additional context (url, resourceId, etc.)
 * @param {string} [lang='en'] - Language for user message
 * @returns {AtelnyoError}
 */
export function createError(code, context = {}, lang = 'en') {
  const actualCode = ERROR_DEFINITIONS[code] ? code : ErrorCodes.UNKNOWN_ERROR;
  const def = ERROR_DEFINITIONS[actualCode];

  return {
    code: actualCode,
    category: def.category,
    severity: def.severity,
    retryable: def.retryable,
    httpStatus: def.httpStatus,
    message: def.messages[lang] || def.messages.en,
    recovery: def.recovery,
    context,
    timestamp: Date.now(),
    isAtelnyoError: true,
  };
}

/**
 * Parse an Axios/API error into an AtelnyoError.
 *
 * @param {Error|object} err - Axios error or fetch error
 * @param {string} [lang='en']
 * @returns {AtelnyoError}
 */
export function parseApiError(err, lang = 'en') {
  // Already an AtelnyoError
  if (err?.isAtelnyoError) return err;

  const status = err?.response?.status;
  const data = err?.response?.data;
  const isTimeout = err?.code === 'ECONNABORTED' || /timeout|timed out/i.test(err?.message || '');
  const isNetwork = !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error');

  // Timeout
  if (isTimeout) {
    return createError(ErrorCodes.NETWORK_TIMEOUT, { url: err?.config?.url }, lang);
  }

  // Network error (no response)
  if (isNetwork) {
    return createError(ErrorCodes.NETWORK_UNAVAILABLE, { url: err?.config?.url }, lang);
  }

  // HTTP status mapping
  if (status) {
    const statusMap = {
      400: ErrorCodes.VALIDATION_FAILED,
      401: ErrorCodes.SESSION_EXPIRED,
      403: ErrorCodes.ACCESS_DENIED,
      404: ErrorCodes.RESOURCE_NOT_FOUND,
      408: ErrorCodes.NETWORK_TIMEOUT,
      409: ErrorCodes.SYNC_CONFLICT,
      429: ErrorCodes.RATE_LIMITED,
      500: ErrorCodes.SERVER_ERROR,
      502: ErrorCodes.SERVER_ERROR,
      503: data?.error === 'maintenance_mode'
        ? ErrorCodes.MAINTENANCE_MODE
        : ErrorCodes.SERVICE_UNAVAILABLE,
    };

    const code = statusMap[status] || ErrorCodes.SERVER_ERROR;
    return createError(code, {
      url: err?.config?.url,
      status,
      serverMessage: data?.detail || data?.error || data?.message,
    }, lang);
  }

  // Unknown
  return createError(ErrorCodes.UNKNOWN_ERROR, {
    message: err?.message,
    url: err?.config?.url,
  }, lang);
}

/**
 * Check if an error is retryable.
 */
export function isRetryable(error) {
  if (!error) return false;
  const code = error.code || parseApiError(error).code;
  const def = ERROR_DEFINITIONS[code];
  return def?.retryable === Retryability.RETRYABLE;
}

/**
 * Check if an error is a conflict.
 */
export function isConflict(error) {
  const code = error?.code;
  return code === ErrorCodes.SYNC_CONFLICT
    || code === ErrorCodes.VERSION_CONFLICT
    || code === ErrorCodes.EDIT_CONFLICT
    || error?.httpStatus === 409;
}

/**
 * Get user-facing message for an error.
 */
export function getErrorMessage(error, lang = 'en') {
  if (error?.message) return error.message;
  const code = error?.code || ErrorCodes.UNKNOWN_ERROR;
  const def = ERROR_DEFINITIONS[code];
  return def?.messages[lang] || def?.messages.en || 'An unexpected error occurred.';
}

/**
 * Get recovery strategy for an error.
 */
export function getRecoveryStrategy(error) {
  return error?.recovery || 'none';
}

/**
 * Create correlation ID for request tracking.
 */
export function createCorrelationId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}_${random}`;
}
