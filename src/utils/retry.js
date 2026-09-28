/**
 * Retry and backoff utilities for Atelnyo (Phase 12).
 *
 * Provides:
 * - Exponential backoff with jitter
 * - Retry budgets (max attempts, max time)
 * - Operation-specific retry strategies
 * - Idempotency key generation
 *
 * Usage:
 *   import { withRetry, createIdempotencyKey } from '../utils/retry';
 *   const result = await withRetry(() => api.post('/courses/'), { maxAttempts: 3 });
 */

// ─── Exponential Backoff ────────────────────────────────────────────

/**
 * Calculate delay for exponential backoff with jitter.
 *
 * @param {number} attempt - Current attempt (0-indexed)
 * @param {number} baseMs - Base delay in ms
 * @param {number} maxMs - Maximum delay cap
 * @returns {number} Delay in ms
 */
export function exponentialBackoff(attempt, baseMs = 500, maxMs = 30000) {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs * 0.5; // 50% jitter
  return Math.min(exponential + jitter, maxMs);
}

/**
 * Calculate delay for linear backoff.
 */
export function linearBackoff(attempt, baseMs = 1000, maxMs = 15000) {
  const linear = baseMs * (attempt + 1);
  return Math.min(linear, maxMs);
}

// ─── Retry with Budget ──────────────────────────────────────────────

/**
 * Execute an operation with retry logic and budget constraints.
 *
 * @param {Function} fn - Async function to execute
 * @param {object} [opts]
 * @param {number} [opts.maxAttempts=3] - Maximum attempts
 * @param {number} [opts.maxTimeMs=60000] - Maximum total time
 * @param {number} [opts.baseDelayMs=500] - Base delay for backoff
 * @param {number} [opts.maxDelayMs=30000] - Maximum single delay
 * @param {Function} [opts.shouldRetry] - Custom retry predicate (error, attempt) => bool
 * @param {Function} [opts.onRetry] - Callback on each retry (error, attempt, delay)
 * @param {string} [opts.operationName] - Name for logging
 * @returns {Promise} Result of fn
 */
export async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 3,
    maxTimeMs = 60000,
    baseDelayMs = 500,
    maxDelayMs = 30000,
    shouldRetry = defaultShouldRetry,
    onRetry = null,
    operationName = 'operation',
  } = opts;

  const startTime = Date.now();
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      // Check if we should retry
      const canRetry = attempt < maxAttempts - 1
        && shouldRetry(err, attempt)
        && (Date.now() - startTime) < maxTimeMs;

      if (!canRetry) break;

      // Calculate delay
      const delay = exponentialBackoff(attempt, baseDelayMs, maxDelayMs);

      // Notify caller
      if (onRetry) {
        onRetry(err, attempt + 1, delay);
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Default retry predicate — retries on network errors, timeouts, and 5xx.
 */
function defaultShouldRetry(err) {
  // Network error (no response)
  if (!err?.response) return true;

  const status = err.response.status;
  // Retry on server errors and rate limits
  return status >= 500 || status === 429 || status === 408;
}

// ─── Debounced Retry ────────────────────────────────────────────────

/**
 * Create a debounced retry function.
 * Useful for operations that may fire rapidly (e.g., autosave).
 *
 * @param {Function} fn - Async function to execute
 * @param {number} [delayMs=1000] - Debounce delay
 * @returns {Function} Debounced function with cancel
 */
export function createDebouncedRetry(fn, delayMs = 1000) {
  let timer = null;
  let inFlight = null;

  const debounced = (...args) => {
    if (timer) clearTimeout(timer);

    return new Promise((resolve, reject) => {
      timer = setTimeout(async () => {
        try {
          // If there's an in-flight request, wait for it
          if (inFlight) {
            await inFlight.catch(() => {});
          }
          inFlight = fn(...args);
          resolve(await inFlight);
        } catch (err) {
          reject(err);
        } finally {
          inFlight = null;
        }
      }, delayMs);
    });
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    inFlight = null;
  };

  return debounced;
}

// ─── Idempotency ────────────────────────────────────────────────────

/**
 * Generate an idempotency key for a mutation operation.
 *
 * Format: `{operationType}:{resourceId}:{userId}:{timestamp}`
 *
 * @param {string} operationType - e.g., 'complete_block', 'save_project'
 * @param {string|number} resourceId - ID of the resource
 * @param {string|number} [userId] - Current user ID
 * @returns {string} Idempotency key
 */
export function createIdempotencyKey(operationType, resourceId, userId = 'anon') {
  const timestamp = Date.now();
  return `${operationType}:${resourceId}:${userId}:${timestamp}`;
}

/**
 * Generate a deduplication key for an operation.
 * Same inputs = same key (used for dedup, not idempotency).
 *
 * @param {string} operationType
 * @param {string|number} resourceId
 * @param {object} [payload] - Operation payload (for content-based dedup)
 * @returns {string} Deduplication key
 */
export function createDeduplicationKey(operationType, resourceId, payload = null) {
  const payloadHash = payload ? simpleHash(JSON.stringify(payload)) : '';
  return `${operationType}:${resourceId}:${payloadHash}`;
}

/**
 * Simple string hash for deduplication keys.
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ─── Operation Queue ────────────────────────────────────────────────

/**
 * Sequential operation queue.
 * Processes operations in order, with retry on failure.
 *
 * Usage:
 *   const queue = createOperationQueue();
 *   queue.enqueue(() => saveProject(data));
 *   queue.enqueue(() => completeSection(id));
 */
export function createOperationQueue(opts = {}) {
  const {
    concurrency = 1,
    maxRetries = 2,
    onOperationComplete = null,
    onOperationFailed = null,
  } = opts;

  const pending = [];
  let running = 0;
  let destroyed = false;

  async function processNext() {
    if (destroyed || running >= concurrency || pending.length === 0) return;

    const { operation, resolve, reject, retries } = pending.shift();
    running++;

    try {
      const result = await operation();
      resolve(result);
      if (onOperationComplete) onOperationComplete(result);
    } catch (err) {
      if (retries < maxRetries) {
        // Re-enqueue with incremented retry count
        pending.unshift({ operation, resolve, reject, retries: retries + 1 });
      } else {
        reject(err);
        if (onOperationFailed) onOperationFailed(err);
      }
    } finally {
      running--;
      processNext();
    }
  }

  return {
    /**
     * Enqueue an operation.
     * @param {Function} operation - Async function
     * @returns {Promise} Resolves when operation completes
     */
    enqueue(operation) {
      return new Promise((resolve, reject) => {
        if (destroyed) {
          reject(new Error('Queue has been destroyed'));
          return;
        }
        pending.push({ operation, resolve, reject, retries: 0 });
        processNext();
      });
    },

    /** Number of pending operations */
    get size() {
      return pending.length;
    },

    /** Whether the queue is idle */
    get idle() {
      return running === 0 && pending.length === 0;
    },

    /** Destroy the queue (reject all pending) */
    destroy() {
      destroyed = true;
      pending.forEach(({ reject }) => {
        reject(new Error('Queue destroyed'));
      });
      pending.length = 0;
    },
  };
}

// ─── Timeout Wrapper ────────────────────────────────────────────────

/**
 * Add a timeout to any promise.
 *
 * @param {Promise} promise - The promise to timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} [message='Operation timed out'] - Error message
 * @returns {Promise}
 */
export function withTimeout(promise, ms, message = 'Operation timed out') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── Sleep Utility ──────────────────────────────────────────────────

/**
 * Sleep for a specified duration.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Circuit Breaker Foundation ─────────────────────────────────────

/**
 * Simple circuit breaker for external services.
 *
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
 *
 * Usage:
 *   const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30000 });
 *   const result = await breaker.execute(() => externalApiCall());
 */
export function createCircuitBreaker(opts = {}) {
  const {
    failureThreshold = 5,
    resetTimeoutMs = 30000,
    name = 'default',
  } = opts;

  let state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
  let failureCount = 0;
  let lastFailureTime = 0;

  return {
    async execute(fn) {
      // If OPEN, check if reset timeout has passed
      if (state === 'OPEN') {
        if (Date.now() - lastFailureTime >= resetTimeoutMs) {
          state = 'HALF_OPEN';
        } else {
          throw new Error(`Circuit breaker "${name}" is OPEN — service unavailable`);
        }
      }

      try {
        const result = await fn();
        // Success — reset if in HALF_OPEN or increment closed
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failureCount = 0;
        }
        return result;
      } catch (err) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= failureThreshold) {
          state = 'OPEN';
        }

        throw err;
      }
    },

    getState() {
      return { state, failureCount, lastFailureTime };
    },

    reset() {
      state = 'CLOSED';
      failureCount = 0;
      lastFailureTime = 0;
    },
  };
}
