/**
 * Offline Action Queue for Atelnyo (Phase 12).
 *
 * Stores mutations that occurred while offline for later synchronization.
 * Each queued operation includes:
 * - operation ID (for dedup)
 * - type (e.g., 'save_project', 'complete_block')
 * - resource ID
 * - payload reference
 * - timestamps
 * - retry count
 * - status
 *
 * Usage:
 *   import { offlineQueue } from '../utils/offlineQueue';
 *   await offlineQueue.enqueue({ type: 'save_project', resourceId: 123, payload: {...} });
 *   const pending = await offlineQueue.getPending();
 */

const QUEUE_KEY = 'atelnyo_offline_queue';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 5;

// ─── Operation Status ───────────────────────────────────────────────

export const OperationStatus = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CONFLICT: 'conflict',
};

// ─── Operation Types ────────────────────────────────────────────────

export const OperationType = {
  SAVE_PROJECT: 'save_project',
  SAVE_PROJECT_FIELD: 'save_project_field',
  COMPLETE_SECTION: 'complete_section',
  COMPLETE_BLOCK: 'complete_block',
  RECORD_POSITION: 'record_position',
  SAVE_NOTE: 'save_note',
  CREATE_ENROLLMENT: 'create_enrollment',
  SUBMIT_PROJECT: 'submit_project',
  CUSTOM: 'custom',
};

// ─── Dependency Order ───────────────────────────────────────────────

// Operations that must be processed in order (dependencies)
const DEPENDENCY_ORDER = [
  OperationType.CREATE_ENROLLMENT,
  OperationType.SAVE_PROJECT,
  OperationType.SAVE_PROJECT_FIELD,
  OperationType.RECORD_POSITION,
  OperationType.COMPLETE_BLOCK,
  OperationType.COMPLETE_SECTION,
  OperationType.SUBMIT_PROJECT,
  OperationType.SAVE_NOTE,
  OperationType.CUSTOM,
];

// ─── Queue Class ────────────────────────────────────────────────────

class OfflineActionQueue {
  constructor() {
    this._listeners = new Set();
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Enqueue an operation for later sync.
   * @param {object} operation
   * @param {string} operation.type - OperationType
   * @param {string|number} operation.resourceId
   * @param {object} operation.payload - Operation data
   * @param {string} [operation.idempotencyKey] - For dedup
   * @returns {Promise<string>} Operation ID
   */
  async enqueue(operation) {
    const queue = await this._read();
    const id = operation.idempotencyKey
      || `${operation.type}:${operation.resourceId}:${Date.now()}`;

    // Deduplication: skip if same idempotency key exists and is not completed/failed
    const existing = queue.find(op => op.idempotencyKey === id && op.status !== OperationStatus.FAILED);
    if (existing) {
      return existing.id;
    }

    const entry = {
      id,
      idempotencyKey: id,
      type: operation.type,
      resourceId: operation.resourceId,
      payload: operation.payload,
      status: OperationStatus.PENDING,
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      error: null,
    };

    queue.push(entry);

    // Enforce max queue size (remove oldest completed)
    if (queue.length > MAX_QUEUE_SIZE) {
      const completedIdx = queue.findIndex(op => op.status === OperationStatus.COMPLETED);
      if (completedIdx >= 0) {
        queue.splice(completedIdx, 1);
      }
    }

    await this._write(queue);
    this._notify();
    return id;
  }

  /**
   * Get all pending operations (sorted by dependency order).
   */
  async getPending() {
    const queue = await this._read();
    return queue
      .filter(op => op.status === OperationStatus.PENDING)
      .sort((a, b) => {
        const orderA = DEPENDENCY_ORDER.indexOf(a.type);
        const orderB = DEPENDENCY_ORDER.indexOf(b.type);
        return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB)
          || a.createdAt - b.createdAt;
      });
  }

  /**
   * Get operation by ID.
   */
  async getById(id) {
    const queue = await this._read();
    return queue.find(op => op.id === id) || null;
  }

  /**
   * Mark an operation as syncing.
   */
  async markSyncing(id) {
    await this._updateStatus(id, OperationStatus.SYNCING);
  }

  /**
   * Mark an operation as completed.
   */
  async markCompleted(id) {
    await this._updateStatus(id, OperationStatus.COMPLETED, { completedAt: Date.now() });
  }

  /**
   * Mark an operation as failed.
   */
  async markFailed(id, error) {
    const queue = await this._read();
    const op = queue.find(o => o.id === id);
    if (!op) return;

    op.retryCount++;
    op.error = error?.message || String(error);
    op.updatedAt = Date.now();

    if (op.retryCount >= MAX_RETRY_COUNT) {
      op.status = OperationStatus.FAILED;
    } else {
      op.status = OperationStatus.PENDING;
    }

    await this._write(queue);
    this._notify();
  }

  /**
   * Mark an operation as conflict.
   */
  async markConflict(id, serverVersion) {
    const queue = await this._read();
    const op = queue.find(o => o.id === id);
    if (!op) return;

    op.status = OperationStatus.CONFLICT;
    op.serverVersion = serverVersion;
    op.updatedAt = Date.now();

    await this._write(queue);
    this._notify();
  }

  /**
   * Get count of pending operations.
   */
  async getPendingCount() {
    const queue = await this._read();
    return queue.filter(op => op.status === OperationStatus.PENDING).length;
  }

  /**
   * Check if queue has pending operations.
   */
  async hasPending() {
    const count = await this.getPendingCount();
    return count > 0;
  }

  /**
   * Clean up completed operations older than a threshold.
   */
  async cleanup(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
    const queue = await this._read();
    const cutoff = Date.now() - maxAgeMs;
    const filtered = queue.filter(op => {
      if (op.status === OperationStatus.COMPLETED && op.completedAt < cutoff) {
        return false; // Remove old completed
      }
      return true;
    });

    if (filtered.length < queue.length) {
      await this._write(filtered);
      this._notify();
    }
  }

  /**
   * Clear all completed/failed operations.
   */
  async clearCompleted() {
    const queue = await this._read();
    const active = queue.filter(op =>
      op.status === OperationStatus.PENDING
      || op.status === OperationStatus.SYNCING
    );
    await this._write(active);
    this._notify();
  }

  /**
   * Subscribe to queue changes.
   */
  onChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Get queue statistics.
   */
  async getStats() {
    const queue = await this._read();
    return {
      total: queue.length,
      pending: queue.filter(op => op.status === OperationStatus.PENDING).length,
      syncing: queue.filter(op => op.status === OperationStatus.SYNCING).length,
      completed: queue.filter(op => op.status === OperationStatus.COMPLETED).length,
      failed: queue.filter(op => op.status === OperationStatus.FAILED).length,
      conflict: queue.filter(op => op.status === OperationStatus.CONFLICT).length,
    };
  }

  // ── Private Methods ─────────────────────────────────────────────

  async _read() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async _write(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Storage full or unavailable
    }
  }

  async _updateStatus(id, status, extra = {}) {
    const queue = await this._read();
    const op = queue.find(o => o.id === id);
    if (!op) return;

    op.status = status;
    op.updatedAt = Date.now();
    Object.assign(op, extra);

    await this._write(queue);
    this._notify();
  }

  _notify() {
    this._listeners.forEach(cb => {
      try { cb(); } catch (_) {}
    });
  }
}

// Singleton
export const offlineQueue = new OfflineActionQueue();
