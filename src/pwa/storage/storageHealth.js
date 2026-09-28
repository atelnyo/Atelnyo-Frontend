/**
 * src/pwa/storage/storageHealth.js
 *
 * STORAGE HEALTH — the health layer of the PWA Storage subsystem.
 * Answers “Kijan sante depo a ye?” (how healthy is storage?) from the
 * raw facts: backend availability, quota pressure, persistence state,
 * and the recent error history. Pure — no state, no persistence; the
 * Storage Manager owns the snapshot and calls this to derive it.
 *
 * Health levels (see HEALTH_LEVELS in storageTypes.js):
 *   • ok       — a backend is available and quota pressure is low.
 *   • warning  — usage crossed STORAGE_POLICY.warnSpaceRatio.
 *   • low      — usage crossed STORAGE_POLICY.lowSpaceRatio — large
 *                writes should be discouraged; surface a low-space
 *                surface so the user frees space before it's too late.
 *   • blocked  — no backend is usable — persistence is unavailable.
 *   • unknown  — not enough information yet (pre-init / no estimate).
 */
import { HEALTH_LEVELS, ROOT_STATUSES, STORAGE_POLICY, spaceLevelFor } from './storageTypes.js';

/** Ring buffer of recent storage errors (diagnostics only). */
const MAX_ERRORS = 5;
export const errorLog = [];

/** Record a storage error for diagnostics. Keeps the last 5. */
export function recordError(message) {
  if (!message) return;
  errorLog.push({ message: String(message), at: Date.now() });
  if (errorLog.length > MAX_ERRORS) errorLog.shift();
}

/** Clear the error ring buffer. */
export function clearErrors() {
  errorLog.length = 0;
}

/**
 * Is this error a QUOTA failure (the "storage almost full" case)?
 * Covers the standard 'QuotaExceededError' (Chromium/Safari),
 * Firefox's legacy 'NS_ERROR_DOM_QUOTA_REACHED', and the DOMException
 * code 22 (QUOTA_EXCEEDED_ERR).
 *
 * Writers use this to route failures to
 * storageManager.handleQuotaFailure() — so "storage almost full"
 * becomes a VISIBLE warning (health degrades, estimate refreshes,
 * subscribers notified), NEVER a silent failure.
 */
export function isQuotaError(err) {
  if (!err) return false;
  const name = err.name || '';
  return name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || err.code === 22; // DOMException.QUOTA_EXCEEDED_ERR
}

/**
 * Derive the storage health level from the raw facts:
 *
 *   { backend, quota, usage }
 *
 *   backend — the primary KV backend (STORAGE_BACKENDS bucket or NONE).
 *   quota   — bytes available (0 = unknown).
 *   usage   — bytes used.
 */
export function computeHealth({ backend, quota, usage }) {
  // No usable backend → everything else is moot.
  if (!backend || backend === 'none') return HEALTH_LEVELS.BLOCKED;
  // No quota info → can't judge pressure; honest UNKNOWN beats a guess.
  if (!quota || !(quota > 0)) return HEALTH_LEVELS.UNKNOWN;
  const ratio = usage / quota;
  if (ratio >= Number(STORAGE_POLICY.lowSpaceRatio)) return HEALTH_LEVELS.LOW;
  if (ratio >= Number(STORAGE_POLICY.warnSpaceRatio)) return HEALTH_LEVELS.WARNING;
  return HEALTH_LEVELS.OK;
}

/**
 * STORAGE HEALTH SNAPSHOT — the AGGREGATE the Settings/Storage UI
 * renders DIRECTLY (one object, a REAL status). Combines the private
 * storage CORE (availability + quota + health + last error) with the
 * OPTIONAL user-selected root (connected + status):
 *
 *   {
 *     level: 'ok' | 'degraded' | 'warning' | 'low' | 'blocked' | 'unknown',
 *     privateStorage: { available, backend, health },
 *     userStorage:    { connected, status, permission, accessible },
 *     quota:          { usage, quota, usageRatio, lowSpace },
 *     lastError,
 *   }
 *
 * LEVEL derivation — CORE-FIRST: user storage is an OPT-IN capability
 * (the app works 100% without a folder), so a missing/optional user
 * folder NEVER blocks or degrades the overall level:
 *   blocked   → no private backend (app storage unusable).
 *   low       → private quota past the LOW threshold.
 *   warning   → private quota past the WARN threshold.
 *   degraded  → private core fine BUT the user folder is
 *               connected-and-broken (status 'inaccessible' — granted
 *               but gone — or 'needs-approval' — stale grant). The UI
 *               surfaces the real problem at a glance.
 *   ok        → private healthy; user folder may be disconnected /
 *               healthy (optional states — disconnected / none /
 *               revoked / unsupported — are NOT degradation).
 *   unknown   → not enough information yet.
 */
export function computeHealthSnapshot({
  available,
  backend,
  quota,
  usage,
  usageRatio,
  health,
  lastError,
  userConnected,
  userStatus,
  userPermission,
  userAccessible,
  userError,
}) {
  let level;
  if (!available) {
    level = HEALTH_LEVELS.BLOCKED;
  } else if (health === HEALTH_LEVELS.LOW) {
    level = HEALTH_LEVELS.LOW;
  } else if (health === HEALTH_LEVELS.WARNING) {
    level = HEALTH_LEVELS.WARNING;
  } else if (health === HEALTH_LEVELS.OK) {
    level = (userStatus === ROOT_STATUSES.INACCESSIBLE
      || userStatus === ROOT_STATUSES.NEEDS_APPROVAL)
      ? HEALTH_LEVELS.DEGRADED
      : HEALTH_LEVELS.OK;
  } else {
    level = HEALTH_LEVELS.UNKNOWN;
  }

  return {
    level,
    privateStorage: {
      available: available === true,
      backend,
      health,
    },
    userStorage: {
      connected: userConnected === true,
      // `status` = ROOT_STATUSES (permission × accessibility) — the
      // aggregate's view. NOT the 9-state USER_STORAGE_STATUSES
      // machine (that lives on getState().userStorage.status — see
      // §4p; the two field names must never be confused). `rootStatus`
      // is an alias so a consumer reaching for the combined fact can
      // name it explicitly.
      status: userStatus,
      rootStatus: userStatus,
      permission: userPermission,
      accessible: userAccessible,
      // User-side errors (e.g. 'permission-revoked', 'restore failed') —
      // separate from the private-core lastError, so "last storage
      // error" reflects the REAL status of BOTH sides.
      error: userError || null,
    },
    quota: {
      usage,
      quota,
      usageRatio,
      // Low-space warning — the UI shows a low-space surface when true.
      lowSpace: health === HEALTH_LEVELS.LOW,
      // The SPACE vocabulary ('healthy' | 'warning' | 'critical' |
      // 'unknown' | null for blocked/degraded) — ratio-derived from the
      // browser-reported quota, NEVER an absolute GB number.
      spaceLevel: spaceLevelFor(health),
    },
    lastError: lastError || null,
  };
}
