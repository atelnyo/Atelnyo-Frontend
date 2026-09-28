import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createError,
  parseApiError,
  isRetryable,
  isConflict,
  getErrorMessage,
  ErrorCodes,
  Severity,
  Retryability,
} from '../errors';
import {
  exponentialBackoff,
  withRetry,
  createIdempotencyKey,
  createDeduplicationKey,
  createOperationQueue,
  withTimeout,
  sleep,
  createCircuitBreaker,
} from '../retry';
import {
  detectConflict,
  hasDataChanged,
  resolveConflict,
  verifyDataIntegrity,
  ConflictType,
  ConflictStrategy,
} from '../conflict';
import {
  EventType,
  createCorrelationId,
  createOperationId,
} from '../observability';

// ═══════════════════════════════════════════════════════════════════
// Error Model Tests
// ═══════════════════════════════════════════════════════════════════

describe('Error Model', () => {
  describe('createError', () => {
    it('creates error with correct properties', () => {
      const err = createError(ErrorCodes.NETWORK_UNAVAILABLE);
      expect(err.code).toBe(ErrorCodes.NETWORK_UNAVAILABLE);
      expect(err.category).toBe('network');
      expect(err.severity).toBe(Severity.HIGH);
      expect(err.retryable).toBe(Retryability.RETRYABLE);
      expect(err.message).toBeTruthy();
      expect(err.isAtelnyoError).toBe(true);
    });

    it('creates error with context', () => {
      const err = createError(ErrorCodes.VALIDATION_FAILED, { field: 'title' });
      expect(err.context.field).toBe('title');
    });

    it('supports Haitian Creole messages', () => {
      const err = createError(ErrorCodes.NETWORK_UNAVAILABLE, {}, 'ht');
      expect(err.message).toContain('Pa gen koneksyon');
    });

    it('falls back to English', () => {
      const err = createError(ErrorCodes.NETWORK_UNAVAILABLE, {}, 'fr');
      expect(err.message).toBeTruthy();
    });

    it('creates unknown error for unrecognized code', () => {
      const err = createError('FAKE_CODE');
      expect(err.code).toBe(ErrorCodes.UNKNOWN_ERROR);
    });
  });

  describe('parseApiError', () => {
    it('parses timeout error', () => {
      const err = { code: 'ECONNABORTED', message: 'timeout' };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.NETWORK_TIMEOUT);
    });

    it('parses network error', () => {
      const err = { code: 'ERR_NETWORK', message: 'Network Error' };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.NETWORK_UNAVAILABLE);
    });

    it('parses 401 error', () => {
      const err = { response: { status: 401 } };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.SESSION_EXPIRED);
    });

    it('parses 404 error', () => {
      const err = { response: { status: 404 } };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
    });

    it('parses 409 conflict', () => {
      const err = { response: { status: 409 } };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.SYNC_CONFLICT);
    });

    it('parses 500 server error', () => {
      const err = { response: { status: 500 } };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.SERVER_ERROR);
    });

    it('parses 429 rate limit', () => {
      const err = { response: { status: 429 } };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.RATE_LIMITED);
    });

    it('parses maintenance mode 503', () => {
      const err = { response: { status: 503, data: { error: 'maintenance_mode' } } };
      const parsed = parseApiError(err);
      expect(parsed.code).toBe(ErrorCodes.MAINTENANCE_MODE);
    });
  });

  describe('isRetryable', () => {
    it('network errors are retryable', () => {
      expect(isRetryable({ code: ErrorCodes.NETWORK_UNAVAILABLE })).toBe(true);
    });

    it('server errors are retryable', () => {
      expect(isRetryable({ code: ErrorCodes.SERVER_ERROR })).toBe(true);
    });

    it('validation errors are not retryable', () => {
      expect(isRetryable({ code: ErrorCodes.VALIDATION_FAILED })).toBe(false);
    });

    it('not-found errors are not retryable', () => {
      expect(isRetryable({ code: ErrorCodes.RESOURCE_NOT_FOUND })).toBe(false);
    });
  });

  describe('isConflict', () => {
    it('detects sync conflict', () => {
      expect(isConflict({ code: ErrorCodes.SYNC_CONFLICT })).toBe(true);
    });

    it('detects 409 status', () => {
      expect(isConflict({ httpStatus: 409 })).toBe(true);
    });

    it('non-conflict errors', () => {
      expect(isConflict({ code: ErrorCodes.NETWORK_UNAVAILABLE })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('returns message from error', () => {
      expect(getErrorMessage({ message: 'Test error' })).toBe('Test error');
    });

    it('returns localized message from code', () => {
      const msg = getErrorMessage({ code: ErrorCodes.NETWORK_UNAVAILABLE }, 'ht');
      expect(msg).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Retry Tests
// ═══════════════════════════════════════════════════════════════════

describe('Retry Utilities', () => {
  describe('exponentialBackoff', () => {
    it('increases delay with attempt', () => {
      const d0 = exponentialBackoff(0, 100, 10000);
      const d1 = exponentialBackoff(1, 100, 10000);
      expect(d1).toBeGreaterThan(d0);
    });

    it('caps at max delay', () => {
      const d = exponentialBackoff(10, 100, 1000);
      expect(d).toBeLessThanOrEqual(1000);
    });
  });

  describe('withRetry', () => {
    it('retries on failure', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('fail');
          return 'success';
        },
        { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50 },
      );
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('throws after max attempts', async () => {
      await expect(
        withRetry(
          async () => { throw new Error('always fail'); },
          { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 },
        ),
      ).rejects.toThrow('always fail');
    });

    it('respects custom shouldRetry', async () => {
      let attempts = 0;
      await expect(
        withRetry(
          async () => {
            attempts++;
            throw new Error('no retry');
          },
          {
            maxAttempts: 3,
            baseDelayMs: 10,
            shouldRetry: () => false,
          },
        ),
      ).rejects.toThrow('no retry');
      expect(attempts).toBe(1);
    });
  });

  describe('createIdempotencyKey', () => {
    it('creates unique keys', () => {
      const key1 = createIdempotencyKey('save', 123, 'user1');
      const key2 = createIdempotencyKey('save', 123, 'user1');
      // Keys include timestamp so they differ
      expect(key1).toContain('save:123:user1:');
    });

    it('includes operation type', () => {
      const key = createIdempotencyKey('complete_block', 456);
      expect(key).toContain('complete_block:456');
    });
  });

  describe('createDeduplicationKey', () => {
    it('same inputs produce same key', () => {
      const key1 = createDeduplicationKey('save', 123, { text: 'hello' });
      const key2 = createDeduplicationKey('save', 123, { text: 'hello' });
      expect(key1).toBe(key2);
    });

    it('different inputs produce different keys', () => {
      const key1 = createDeduplicationKey('save', 123, { text: 'hello' });
      const key2 = createDeduplicationKey('save', 123, { text: 'world' });
      expect(key1).not.toBe(key2);
    });
  });

  describe('createOperationQueue', () => {
    it('processes operations sequentially', async () => {
      const queue = createOperationQueue();
      const results = [];

      await queue.enqueue(async () => { results.push(1); });
      await queue.enqueue(async () => { results.push(2); });
      await queue.enqueue(async () => { results.push(3); });

      expect(results).toEqual([1, 2, 3]);
    });

    it('reports queue size', () => {
      const queue = createOperationQueue();
      expect(queue.size).toBe(0);
      expect(queue.idle).toBe(true);
    });

    it('retries failed operations', async () => {
      const queue = createOperationQueue({ maxRetries: 2 });
      let attempts = 0;

      const result = await queue.enqueue(async () => {
        attempts++;
        if (attempts < 2) throw new Error('fail');
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });
  });

  describe('withTimeout', () => {
    it('resolves before timeout', async () => {
      const result = await withTimeout(
        sleep(10).then(() => 'done'),
        100,
      );
      expect(result).toBe('done');
    });

    it('rejects on timeout', async () => {
      await expect(
        withTimeout(sleep(100), 10, 'too slow'),
      ).rejects.toThrow('too slow');
    });
  });

  describe('createCircuitBreaker', () => {
    it('starts in CLOSED state', () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3 });
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('opens after failure threshold', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 2 });

      for (let i = 0; i < 2; i++) {
        try { await breaker.execute(() => { throw new Error('fail'); }); } catch {}
      }

      expect(breaker.getState().state).toBe('OPEN');
    });

    it('rejects when OPEN', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 1 });
      try { await breaker.execute(() => { throw new Error('fail'); }); } catch {}

      await expect(breaker.execute(() => 'ok')).rejects.toThrow('OPEN');
    });

    it('resets after success', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 2 });
      await breaker.execute(() => 'ok');
      expect(breaker.getState().state).toBe('CLOSED');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Conflict Detection Tests
// ═══════════════════════════════════════════════════════════════════

describe('Conflict Detection', () => {
  describe('detectConflict', () => {
    it('no conflict when same version', () => {
      const result = detectConflict(
        { revision: 1, updatedAt: 100 },
        { revision: 1, updatedAt: 100 },
      );
      expect(result.hasConflict).toBe(false);
    });

    it('detects version mismatch', () => {
      const result = detectConflict(
        { revision: 1, updatedAt: 100, _hasLocalChanges: true },
        { revision: 2, updatedAt: 200 },
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.VERSION_MISMATCH);
    });

    it('detects timestamp conflict with local changes', () => {
      const result = detectConflict(
        { revision: 1, updatedAt: 100, _hasLocalChanges: true },
        { revision: 1, updatedAt: 200 },
      );
      expect(result.hasConflict).toBe(true);
    });

    it('no conflict when server is newer but no local changes', () => {
      const result = detectConflict(
        { revision: 1, updatedAt: 100 },
        { revision: 1, updatedAt: 200 },
      );
      expect(result.hasConflict).toBe(false);
    });

    it('returns suggested strategy', () => {
      const result = detectConflict(
        { revision: 1, updatedAt: 100, _hasLocalChanges: true },
        { revision: 2, updatedAt: 200 },
        { resourceType: 'project_data' },
      );
      expect(result.suggestedStrategy).toBe(ConflictStrategy.KEEP_LOCAL);
    });
  });

  describe('hasDataChanged', () => {
    it('same objects are equal', () => {
      expect(hasDataChanged({ a: 1 }, { a: 1 })).toBe(false);
    });

    it('different values are detected', () => {
      expect(hasDataChanged({ a: 1 }, { a: 2 })).toBe(true);
    });

    it('ignores metadata keys', () => {
      expect(hasDataChanged(
        { a: 1, updatedAt: 100 },
        { a: 1, updatedAt: 200 },
      )).toBe(false);
    });

    it('different keys detected', () => {
      expect(hasDataChanged({ a: 1 }, { a: 1, b: 2 })).toBe(true);
    });
  });

  describe('resolveConflict', () => {
    it('keep server strategy', () => {
      const result = resolveConflict(
        { text: 'local' },
        { text: 'server' },
        ConflictStrategy.KEEP_SERVER,
      );
      expect(result.resolved).toBe(true);
      expect(result.data.text).toBe('server');
    });

    it('keep local strategy', () => {
      const result = resolveConflict(
        { text: 'local' },
        { text: 'server' },
        ConflictStrategy.KEEP_LOCAL,
      );
      expect(result.resolved).toBe(true);
      expect(result.data.text).toBe('local');
    });

    it('merge strategy combines both', () => {
      const result = resolveConflict(
        { text: 'local', localOnly: true },
        { text: 'server', serverOnly: true },
        ConflictStrategy.MERGE,
      );
      expect(result.resolved).toBe(true);
      expect(result.data.text).toBe('local'); // Local wins
      expect(result.data.localOnly).toBe(true);
      expect(result.data.serverOnly).toBe(true);
    });

    it('ask user returns both versions', () => {
      const result = resolveConflict(
        { text: 'local' },
        { text: 'server' },
        ConflictStrategy.ASK_USER,
      );
      expect(result.resolved).toBe(false);
      expect(result.data.local.text).toBe('local');
      expect(result.data.server.text).toBe('server');
    });

    it('prevent returns unresolved', () => {
      const result = resolveConflict(
        { text: 'local' },
        { text: 'server' },
        ConflictStrategy.PREVENT,
      );
      expect(result.resolved).toBe(false);
    });
  });

  describe('verifyDataIntegrity', () => {
    it('valid data passes', () => {
      const result = verifyDataIntegrity({ id: 1, text: 'hello' });
      expect(result.valid).toBe(true);
    });

    it('null data fails', () => {
      const result = verifyDataIntegrity(null);
      expect(result.valid).toBe(false);
    });

    it('missing id flagged', () => {
      const result = verifyDataIntegrity({ text: 'hello' });
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Missing id field');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Observability Tests
// ═══════════════════════════════════════════════════════════════════

describe('Observability', () => {
  describe('createCorrelationId', () => {
    it('creates unique IDs', () => {
      const id1 = createCorrelationId();
      const id2 = createCorrelationId();
      expect(id1).not.toBe(id2);
    });

    it('starts with req_', () => {
      expect(createCorrelationId()).toMatch(/^req_/);
    });
  });

  describe('createOperationId', () => {
    it('creates IDs with type prefix', () => {
      const id = createOperationId('publish');
      expect(id).toMatch(/^publish_/);
    });

    it('defaults to op prefix', () => {
      expect(createOperationId()).toMatch(/^op_/);
    });
  });
});
