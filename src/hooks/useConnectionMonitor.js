/**
 * useConnectionMonitor.js — Real-time network connectivity monitor.
 *
 * Tracks:
 *   • online/offline state
 *   • Connection type (wifi, cellular, ethernet, unknown)
 *   • Effective connection speed (4g, 3g, 2g, slow-2g)
 *   • Downlink speed estimate (Mbps)
 *   • Round-trip time estimate (ms)
 *   • Data-saver mode
 *
 * Fires the offline queue processor when transitioning back online.
 * Components can subscribe to connection changes via the returned
 * ``connection`` object.
 */

import { useState, useEffect, useCallback } from 'react';
import offlineQueue from '../services/offlineQueue';

// ─── Connection info resolver ──────────────────────────────────────
function getConnectionInfo() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    online: nav.onLine,
    type: conn?.type || 'unknown',           // wifi, cellular, ethernet, bluetooth, none
    effectiveType: conn?.effectiveType || 'unknown', // slow-2g, 2g, 3g, 4g
    downlink: conn?.downlink ?? null,        // Mbps estimate
    rtt: conn?.rtt ?? null,                  // ms estimate
    saveData: conn?.saveData || false,       // data-saver enabled
    since: conn ? undefined : null,          // legacy browsers
  };
}

// ─── Singleton for global listeners ─────────────────────────────────
let _globalListeners = [];
let _globalState = getConnectionInfo();
let _listening = false;

function _startGlobalListeners() {
  if (_listening || typeof window === 'undefined') return;
  _listening = true;

  const onChange = () => {
    _globalState = getConnectionInfo();
    _globalListeners.forEach(fn => {
      try { fn(_globalState); } catch (_) {}
    });

    // Auto-drain the offline queue on reconnect
    if (_globalState.online) {
      offlineQueue.process().catch(() => {});
    }
  };

  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  // NetworkInformation API change event
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    conn.addEventListener('change', onChange);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────
export default function useConnectionMonitor() {
  _startGlobalListeners();

  const [connection, setConnection] = useState(_globalState);

  useEffect(() => {
    const handler = (state) => setConnection(state);
    _globalListeners.push(handler);
    return () => {
      _globalListeners = _globalListeners.filter(h => h !== handler);
    };
  }, []);

  /** Manually refresh connection info. */
  const refresh = useCallback(() => {
    const info = getConnectionInfo();
    _globalState = info;
    setConnection(info);
  }, []);

  /** Manually trigger queue drain. */
  const drainQueue = useCallback(() => {
    offlineQueue.process().catch(() => {});
  }, []);

  return {
    ...connection,
    /** True when fully offline. */
    isOffline: !connection.online,
    /** True on slow connections (2g / slow-2g). */
    isSlow: connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g',
    /** True when data-saver is active. */
    isDataSaver: connection.saveData,
    refresh,
    drainQueue,
  };
}
