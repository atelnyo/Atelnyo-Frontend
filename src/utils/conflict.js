/**
 * Conflict Detection Utilities for Atelnyo (Phase 12).
 *
 * Provides:
 * - Version-aware conflict detection
 * - Local vs server state comparison
 * - Conflict resolution strategies
 * - Data integrity verification
 *
 * Usage:
 *   import { detectConflict, resolveConflict, ConflictStrategy } from '../utils/conflict';
 */

// ─── Conflict Types ─────────────────────────────────────────────────

export const ConflictType = {
  VERSION_MISMATCH: 'version_mismatch',
  TIMESTAMP_CONFLICT: 'timestamp_conflict',
  CONCURRENT_EDIT: 'concurrent_edit',
  STATE_CONFLICT: 'state_conflict',
  NONE: 'none',
};

// ─── Resolution Strategies ──────────────────────────────────────────

export const ConflictStrategy = {
  KEEP_SERVER: 'keep_server',
  KEEP_LOCAL: 'keep_local',
  MERGE: 'merge',
  ASK_USER: 'ask_user',
  PREVENT: 'prevent', // Don't allow the operation
};

// ─── Resource-Specific Strategies ───────────────────────────────────

const RESOURCE_STRATEGIES = {
  project_data: ConflictStrategy.KEEP_LOCAL, // Student owns their data
  project_field: ConflictStrategy.KEEP_LOCAL,
  course_content: ConflictStrategy.KEEP_SERVER, // Server is authoritative
  lesson_progress: ConflictStrategy.MERGE, // Merge completion events
  enrollment: ConflictStrategy.KEEP_SERVER,
  draft: ConflictStrategy.KEEP_LOCAL,
  note: ConflictStrategy.KEEP_LOCAL,
  default: ConflictStrategy.ASK_USER,
};

// ─── Conflict Detection ─────────────────────────────────────────────

/**
 * Detect if there's a conflict between local and server state.
 *
 * @param {object} localState - Local version of the resource
 * @param {object} serverState - Server version of the resource
 * @param {object} [opts]
 * @param {string} [opts.resourceType] - Resource type for strategy lookup
 * @returns {object} Conflict detection result
 */
export function detectConflict(localState, serverState, opts = {}) {
  const result = {
    hasConflict: false,
    conflictType: ConflictType.NONE,
    localRevision: localState?.revision || localState?.version || 0,
    serverRevision: serverState?.revision || serverState?.version || 0,
    localUpdatedAt: localState?.updatedAt || localState?.updated_at || 0,
    serverUpdatedAt: serverState?.updatedAt || serverState?.updated_at || 0,
    suggestedStrategy: null,
  };

  // No server state — no conflict
  if (!serverState) return result;

  // No local state — use server
  if (!localState) {
    result.hasConflict = false;
    result.suggestedStrategy = ConflictStrategy.KEEP_SERVER;
    return result;
  }

  // Check revision/version mismatch
  if (result.localRevision && result.serverRevision) {
    if (result.localRevision !== result.serverRevision) {
      result.hasConflict = true;
      result.conflictType = ConflictType.VERSION_MISMATCH;
    }
  }

  // Check timestamp conflict (server is newer)
  if (!result.hasConflict && result.serverUpdatedAt > result.localUpdatedAt) {
    // Server was updated after local — potential conflict if local also has changes
    if (localState._hasLocalChanges) {
      result.hasConflict = true;
      result.conflictType = ConflictType.TIMESTAMP_CONFLICT;
    }
  }

  // Determine suggested strategy
  if (result.hasConflict) {
    const resourceType = opts.resourceType || 'default';
    result.suggestedStrategy = RESOURCE_STRATEGIES[resourceType]
      || RESOURCE_STRATEGIES.default;
  }

  return result;
}

/**
 * Check if two data objects have meaningful differences.
 *
 * @param {object} a - First data object
 * @param {object} b - Second data object
 * @param {string[]} [ignoreKeys] - Keys to ignore
 * @returns {boolean} True if objects are different
 */
export function hasDataChanged(a, b, ignoreKeys = ['updatedAt', 'updated_at', 'revision', 'version']) {
  if (a === b) return false;
  if (!a || !b) return true;

  const keysA = new Set(Object.keys(a).filter(k => !ignoreKeys.includes(k)));
  const keysB = new Set(Object.keys(b).filter(k => !ignoreKeys.includes(k)));

  // Different number of keys
  if (keysA.size !== keysB.size) return true;

  // Check each key
  for (const key of keysA) {
    if (!keysB.has(key)) return true;

    const valA = a[key];
    const valB = b[key];

    // Handle nested objects
    if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null) {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) return true;
    } else if (valA !== valB) {
      return true;
    }
  }

  return false;
}

// ─── Conflict Resolution ────────────────────────────────────────────

/**
 * Resolve a conflict between local and server state.
 *
 * @param {object} localState
 * @param {object} serverState
 * @param {string} strategy - ConflictStrategy
 * @param {object} [opts]
 * @returns {object} Resolution result
 */
export function resolveConflict(localState, serverState, strategy, opts = {}) {
  const result = {
    resolved: false,
    strategy,
    data: null,
    mergedAt: Date.now(),
  };

  switch (strategy) {
    case ConflictStrategy.KEEP_SERVER:
      result.resolved = true;
      result.data = { ...serverState, _resolvedBy: 'server' };
      break;

    case ConflictStrategy.KEEP_LOCAL:
      result.resolved = true;
      result.data = { ...localState, _resolvedBy: 'local' };
      break;

    case ConflictStrategy.MERGE:
      result.resolved = true;
      result.data = mergeStates(localState, serverState, opts);
      result.data._resolvedBy = 'merge';
      break;

    case ConflictStrategy.PREVENT:
      result.resolved = false;
      result.data = null;
      break;

    case ConflictStrategy.ASK_USER:
    default:
      result.resolved = false;
      result.data = { local: localState, server: serverState };
      break;
  }

  return result;
}

/**
 * Merge two states (simple merge strategy).
 * Local takes precedence for fields that exist in both.
 * Server takes precedence for fields only in server.
 */
function mergeStates(local, server, opts = {}) {
  const merged = { ...server };

  // Preserve local changes for fields that exist in both
  for (const key of Object.keys(local)) {
    if (key.startsWith('_')) continue; // Skip metadata
    if (local[key] !== undefined && local[key] !== null) {
      merged[key] = local[key];
    }
  }

  // Use the newer timestamp
  merged.updatedAt = Math.max(
    local.updatedAt || 0,
    server.updatedAt || 0,
  );
  merged.revision = Math.max(
    local.revision || 0,
    server.revision || 0,
  ) + 1;

  return merged;
}

// ─── Data Integrity ─────────────────────────────────────────────────

/**
 * Verify data integrity of a local record.
 *
 * @param {object} record - The record to verify
 * @returns {object} Integrity check result
 */
export function verifyDataIntegrity(record) {
  const result = {
    valid: true,
    issues: [],
  };

  if (!record) {
    result.valid = false;
    result.issues.push('Record is null or undefined');
    return result;
  }

  // Check for required fields
  if (record.id === undefined) {
    result.issues.push('Missing id field');
  }

  // Check for corrupted data
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('_')) continue; // Skip metadata

    // Check for undefined (JSON serialization issue)
    if (value === undefined) {
      result.issues.push(`Field "${key}" is undefined`);
    }

    // Check for circular references (shouldn't happen but safety check)
    if (typeof value === 'object' && value !== null) {
      try {
        JSON.stringify(value);
      } catch {
        result.issues.push(`Field "${key}" contains circular reference`);
      }
    }
  }

  if (result.issues.length > 0) {
    result.valid = false;
  }

  return result;
}

/**
 * Create a snapshot of local state for recovery.
 *
 * @param {string} resourceType
 * @param {string|number} resourceId
 * @param {object} data
 * @returns {object} Snapshot
 */
export function createSnapshot(resourceType, resourceId, data) {
  return {
    resourceType,
    resourceId,
    data: JSON.parse(JSON.stringify(data)), // Deep clone
    revision: data?.revision || 0,
    timestamp: Date.now(),
    deviceId: getDeviceId(),
  };
}

/**
 * Get a stable device identifier.
 */
function getDeviceId() {
  let deviceId = localStorage.getItem('atelnyo_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem('atelnyo_device_id', deviceId);
    } catch { /* ignore */ }
  }
  return deviceId;
}
