/**
 * Observability Foundation for Atelnyo (Phase 12).
 *
 * Provides:
 * - Structured event logging
 * - Correlation IDs for request tracing
 * - Error event tracking
 * - Privacy-safe diagnostics
 * - Reliability metrics
 *
 * Usage:
 *   import { observability, createCorrelationId } from '../utils/observability';
 *   observability.log('sync_complete', { resourceId: 123, duration: 450 });
 */

// ─── Event Types ────────────────────────────────────────────────────

export const EventType = {
  // API
  REQUEST_START: 'request_start',
  REQUEST_COMPLETE: 'request_complete',
  REQUEST_FAILED: 'request_failed',
  REQUEST_TIMEOUT: 'request_timeout',

  // Auth
  AUTH_REFRESH: 'auth_refresh',
  AUTH_LOGOUT: 'auth_logout',
  AUTH_EXPIRED: 'auth_expired',

  // Sync
  SYNC_START: 'sync_start',
  SYNC_COMPLETE: 'sync_complete',
  SYNC_FAILED: 'sync_failed',
  SYNC_CONFLICT: 'sync_conflict',
  SYNC_QUEUED: 'sync_queued',

  // Offline
  OFFLINE_DETECTED: 'offline_detected',
  OFFLINE_RECONNECTED: 'offline_reconnected',
  OFFLINE_QUEUE_OP: 'offline_queue_op',

  // Save
  SAVE_LOCAL: 'save_local',
  SAVE_SERVER: 'save_server',
  SAVE_FAILED: 'save_failed',

  // Error
  ERROR_BOUNDARY: 'error_boundary',
  CLIENT_ERROR: 'client_error',
  CHUNK_LOAD_ERROR: 'chunk_load_error',

  // Performance
  SLOW_REQUEST: 'slow_request',
  CACHE_HIT: 'cache_hit',
  CACHE_MISS: 'cache_miss',

  // Media
  MEDIA_LOAD: 'media_load',
  MEDIA_FAILED: 'media_failed',
  MEDIA_TIMEOUT: 'media_timeout',

  // Upload
  UPLOAD_START: 'upload_start',
  UPLOAD_COMPLETE: 'upload_complete',
  UPLOAD_FAILED: 'upload_failed',

  // Navigation
  NAVIGATION: 'navigation',
  ROUTE_RECOVERY: 'route_recovery',

  // Conflict
  CONFLICT_DETECTED: 'conflict_detected',
  CONFLICT_RESOLVED: 'conflict_resolved',
};

// ─── Severity Levels ────────────────────────────────────────────────

export const EventSeverity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

// ─── Observability Class ────────────────────────────────────────────

class ObservabilityManager {
  constructor() {
    this._events = [];
    this._metrics = {
      requestCount: 0,
      errorCount: 0,
      syncCount: 0,
      conflictCount: 0,
      offlineCount: 0,
      retryCount: 0,
    };
    this._listeners = new Set();
    this._maxEvents = 500;
    this._sessionId = this._generateSessionId();
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Log a structured event.
   *
   * @param {string} eventType - One of EventType
   * @param {object} [data] - Event data (will be sanitized)
   * @param {string} [severity] - EventSeverity
   * @param {string} [correlationId] - Request/operation correlation ID
   */
  log(eventType, data = {}, severity = EventSeverity.INFO, correlationId = null) {
    const event = {
      type: eventType,
      severity,
      data: this._sanitizeData(data),
      correlationId,
      sessionId: this._sessionId,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location?.pathname : '',
    };

    // Add to buffer
    this._events.push(event);
    if (this._events.length > this._maxEvents) {
      this._events.shift();
    }

    // Update metrics
    this._updateMetrics(event);

    // Notify listeners
    this._listeners.forEach(cb => {
      try { cb(event); } catch (_) {}
    });

    // Console output in dev
    if (import.meta.env.DEV) {
      this._consoleLog(event);
    }

    return event;
  }

  /**
   * Log an error event.
   */
  logError(error, context = {}, correlationId = null) {
    return this.log(EventType.CLIENT_ERROR, {
      message: error?.message || String(error),
      code: error?.code,
      stack: error?.stack?.slice(0, 500),
      ...context,
    }, EventSeverity.ERROR, correlationId);
  }

  /**
   * Log a request event.
   */
  logRequest(url, method = 'GET', correlationId = null) {
    return this.log(EventType.REQUEST_START, {
      url,
      method,
    }, EventSeverity.DEBUG, correlationId);
  }

  /**
   * Log a request completion.
   */
  logRequestComplete(url, durationMs, status, correlationId = null) {
    const severity = status >= 500 ? EventSeverity.ERROR
      : status >= 400 ? EventSeverity.WARNING
      : durationMs > 5000 ? EventSeverity.WARNING
      : EventSeverity.INFO;

    return this.log(EventType.REQUEST_COMPLETE, {
      url,
      duration: durationMs,
      status,
      slow: durationMs > 2000,
    }, severity, correlationId);
  }

  /**
   * Log a sync event.
   */
  logSync(operation, durationMs, result, correlationId = null) {
    const eventType = result === 'success'
      ? EventType.SYNC_COMPLETE
      : result === 'conflict'
        ? EventType.SYNC_CONFLICT
        : EventType.SYNC_FAILED;

    return this.log(eventType, {
      operation,
      duration: durationMs,
      result,
    }, result === 'success' ? EventSeverity.INFO : EventSeverity.WARNING, correlationId);
  }

  /**
   * Get reliability metrics summary.
   */
  getMetrics() {
    return {
      ...this._metrics,
      eventCount: this._events.length,
      sessionId: this._sessionId,
      errorRate: this._metrics.requestCount > 0
        ? (this._metrics.errorCount / this._metrics.requestCount * 100).toFixed(1) + '%'
        : '0%',
    };
  }

  /**
   * Get recent events (for debugging).
   */
  getRecentEvents(count = 50) {
    return this._events.slice(-count);
  }

  /**
   * Get events by type.
   */
  getEventsByType(eventType, count = 50) {
    return this._events
      .filter(e => e.type === eventType)
      .slice(-count);
  }

  /**
   * Subscribe to events.
   */
  onEvent(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Export events (for error reporting).
   * Respects privacy — no PII included.
   */
  exportEvents() {
    return {
      sessionId: this._sessionId,
      metrics: this.getMetrics(),
      events: this._events.map(e => ({
        ...e,
        data: this._sanitizeForExport(e.data),
      })),
    };
  }

  /**
   * Clear all events and reset metrics.
   */
  reset() {
    this._events.length = 0;
    Object.keys(this._metrics).forEach(k => { this._metrics[k] = 0; });
  }

  // ── Private Methods ─────────────────────────────────────────────

  _updateMetrics(event) {
    switch (event.type) {
      case EventType.REQUEST_COMPLETE:
        this._metrics.requestCount++;
        break;
      case EventType.CLIENT_ERROR:
      case EventType.REQUEST_FAILED:
        this._metrics.errorCount++;
        break;
      case EventType.SYNC_COMPLETE:
      case EventType.SYNC_FAILED:
        this._metrics.syncCount++;
        break;
      case EventType.SYNC_CONFLICT:
        this._metrics.conflictCount++;
        break;
      case EventType.OFFLINE_DETECTED:
        this._metrics.offlineCount++;
        break;
      case EventType.REQUEST_FAILED:
        if (event.data?.retryable) this._metrics.retryCount++;
        break;
    }
  }

  _sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  _sanitizeForExport(data) {
    const sanitized = this._sanitizeData(data);
    // Truncate large values
    for (const [key, val] of Object.entries(sanitized)) {
      if (typeof val === 'string' && val.length > 500) {
        sanitized[key] = val.slice(0, 500) + '...';
      }
    }
    return sanitized;
  }

  _generateSessionId() {
    return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _consoleLog(event) {
    const colors = {
      debug: '#6b7280',
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      critical: '#dc2626',
    };

    const color = colors[event.severity] || '#6b7280';
    console.log(
      `%c[${event.type}] %c${event.severity.toUpperCase()}`,
      `color: ${color}; font-weight: bold;`,
      `color: ${color};`,
      event.data,
    );
  }
}

// Singleton
export const observability = new ObservabilityManager();

// ─── Correlation ID Generator ───────────────────────────────────────

/**
 * Generate a correlation ID for request tracing.
 * Format: req_{timestamp}_{random}
 */
export function createCorrelationId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Generate an operation ID for multi-step operations.
 * Format: op_{type}_{timestamp}_{random}
 */
export function createOperationId(type = 'op') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${type}_${timestamp}_${random}`;
}
