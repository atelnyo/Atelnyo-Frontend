/**
 * Network State Manager for Atelnyo (Phase 12).
 *
 * Tracks:
 * - online / offline / reconnecting / degraded
 * - Actual API connectivity (not just navigator.onLine)
 * - Connection quality hints
 * - State change events
 *
 * Usage:
 *   import { networkState, useNetworkState } from '../utils/networkState';
 *   networkState.onChange((state) => { ... });
 */

// ─── State Constants ────────────────────────────────────────────────

export const NetworkStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  RECONNECTING: 'reconnecting',
  UNKNOWN: 'unknown',
};

// ─── Singleton State Manager ────────────────────────────────────────

class NetworkStateManager {
  constructor() {
    this._status = navigator.onLine ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE;
    this._lastOnlineAt = null;
    this._lastOfflineAt = null;
    this._listeners = new Set();
    this._connectivityChecks = [];
    this._checkInterval = null;

    // Listen to browser events
    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleOnline);
      window.addEventListener('offline', this._handleOffline);
    }

    // Initial timestamp
    if (this._status === NetworkStatus.ONLINE) {
      this._lastOnlineAt = Date.now();
    } else {
      this._lastOfflineAt = Date.now();
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Current network status */
  get status() {
    return this._status;
  }

  /** Whether currently online (browser + API check) */
  get isOnline() {
    return this._status === NetworkStatus.ONLINE;
  }

  /** Whether currently offline */
  get isOffline() {
    return this._status === NetworkStatus.OFFLINE;
  }

  /** Whether currently reconnecting */
  get isReconnecting() {
    return this._status === NetworkStatus.RECONNECTING;
  }

  /** Timestamp of last online state */
  get lastOnlineAt() {
    return this._lastOnlineAt;
  }

  /** Timestamp of last offline state */
  get lastOfflineAt() {
    return this._lastOfflineAt;
  }

  /** Duration offline in ms (0 if online) */
  get offlineDuration() {
    if (this._status !== NetworkStatus.OFFLINE) return 0;
    return Date.now() - (this._lastOfflineAt || Date.now());
  }

  /**
   * Subscribe to network state changes.
   * @param {Function} callback - (status, previousStatus) => void
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Register a connectivity check function.
   * Called periodically to verify actual API connectivity.
   * Should return true if API is reachable.
   * @param {Function} checkFn - async () => boolean
   */
  registerConnectivityCheck(checkFn) {
    this._connectivityChecks.push(checkFn);
  }

  /**
   * Start periodic connectivity checks.
   * @param {number} [intervalMs=30000] - Check interval
   */
  startPeriodicChecks(intervalMs = 30000) {
    this.stopPeriodicChecks();
    this._checkInterval = setInterval(() => this._checkConnectivity(), intervalMs);
  }

  /**
   * Stop periodic connectivity checks.
   */
  stopPeriodicChecks() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }

  /**
   * Force a connectivity check now.
   */
  async checkNow() {
    return this._checkConnectivity();
  }

  /**
   * Clean up (for tests or unmount).
   */
  destroy() {
    this.stopPeriodicChecks();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._handleOnline);
      window.removeEventListener('offline', this._handleOffline);
    }
    this._listeners.clear();
    this._connectivityChecks.length = 0;
  }

  // ── Private Methods ─────────────────────────────────────────────

  _handleOnline() {
    if (this._status === NetworkStatus.ONLINE) return;

    // Browser says online — but verify with actual API check
    this._setStatus(NetworkStatus.RECONNECTING);
    this._checkConnectivity();
  }

  _handleOffline() {
    if (this._status === NetworkStatus.OFFLINE) return;
    this._setStatus(NetworkStatus.OFFLINE);
  }

  _setStatus(newStatus) {
    const prev = this._status;
    if (prev === newStatus) return;

    this._status = newStatus;

    if (newStatus === NetworkStatus.ONLINE) {
      this._lastOnlineAt = Date.now();
    } else if (newStatus === NetworkStatus.OFFLINE) {
      this._lastOfflineAt = Date.now();
    }

    // Notify listeners
    this._listeners.forEach(cb => {
      try {
        cb(newStatus, prev);
      } catch (_) { /* listener errors don't break state */ }
    });
  }

  async _checkConnectivity() {
    // Run all registered checks
    for (const checkFn of this._connectivityChecks) {
      try {
        const reachable = await checkFn();
        if (reachable) {
          if (this._status !== NetworkStatus.ONLINE) {
            this._setStatus(NetworkStatus.ONLINE);
          }
          return true;
        }
      } catch (_) {
        // Check failed
      }
    }

    // If no checks registered, trust browser state
    if (this._connectivityChecks.length === 0) {
      if (navigator.onLine && this._status !== NetworkStatus.ONLINE) {
        this._setStatus(NetworkStatus.ONLINE);
        return true;
      }
    }

    // All checks failed or none registered while offline
    if (navigator.onLine && this._connectivityChecks.length > 0) {
      // Browser says online but API checks failed — stay in reconnecting
      return false;
    }

    return false;
  }
}

// Singleton
export const networkState = new NetworkStateManager();

// ─── React Hook ─────────────────────────────────────────────────────

/**
 * React hook for network state.
 * Returns { status, isOnline, isOffline, isReconnecting }.
 *
 * Usage:
 *   const { isOnline, status } = useNetworkState();
 */
export function useNetworkState() {
  // Dynamic import to avoid issues in non-React contexts
  try {
    const { useState, useEffect } = require('react');

    const [state, setState] = useState({
      status: networkState.status,
      isOnline: networkState.isOnline,
      isOffline: networkState.isOffline,
      isReconnecting: networkState.isReconnecting,
    });

    useEffect(() => {
      const unsubscribe = networkState.onChange((status) => {
        setState({
          status,
          isOnline: status === NetworkStatus.ONLINE,
          isOffline: status === NetworkStatus.OFFLINE,
          isReconnecting: status === NetworkStatus.RECONNECTING,
        });
      });

      return unsubscribe;
    }, []);

    return state;
  } catch {
    // Fallback for non-React environments
    return {
      status: networkState.status,
      isOnline: networkState.isOnline,
      isOffline: networkState.isOffline,
      isReconnecting: networkState.isReconnecting,
    };
  }
}

// ─── API Connectivity Check ─────────────────────────────────────────

/**
 * Default connectivity check using the health endpoint.
 */
export async function apiConnectivityCheck() {
  try {
    const response = await fetch('/api/healthz/', {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Auto-register the API check
networkState.registerConnectivityCheck(apiConnectivityCheck);
