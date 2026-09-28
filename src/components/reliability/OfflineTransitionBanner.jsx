/**
 * OfflineTransitionBanner — Phase 12 Reliability UX
 *
 * Shows a clear but non-blocking status when connection state changes.
 * - Going offline: "You're offline. Changes are saved locally."
 * - Reconnecting: "Reconnecting..."
 * - Back online: "Connected. Syncing..."
 *
 * Integrates with networkState for actual connectivity tracking.
 * Does NOT use navigator.onLine alone — verifies with API health check.
 */
import React, { useState, useEffect, useRef } from 'react';
import { networkState, NetworkStatus } from '../../utils/networkState';
import { offlineQueue } from '../../utils/offlineQueue';

const BANNER_STYLES = {
  base: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: '10px 16px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
  },
  offline: {
    background: '#fef3c7',
    color: '#92400e',
    borderBottom: '2px solid #f59e0b',
  },
  reconnecting: {
    background: '#dbeafe',
    color: '#1e40af',
    borderBottom: '2px solid #3b82f6',
  },
  online: {
    background: '#d1fae5',
    color: '#065f46',
    borderBottom: '2px solid #10b981',
  },
  hidden: {
    transform: 'translateY(-100%)',
    opacity: 0,
    pointerEvents: 'none',
  },
  visible: {
    transform: 'translateY(0)',
    opacity: 1,
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid currentColor',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'atelnyo-spin 0.8s linear infinite',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
};

const MESSAGES = {
  [NetworkStatus.OFFLINE]: {
    en: 'You\u2019re offline. Changes are saved on this device.',
    ht: 'Ou offline. Chanjman yo konsève sou aparèy sa a.',
  },
  [NetworkStatus.RECONNECTING]: {
    en: 'Reconnecting\u2026',
    ht: 'Ap rekonekte\u2026',
  },
  [NetworkStatus.ONLINE]: {
    en: 'Connected. Syncing your changes\u2026',
    ht: 'Konekte. Ap senkronize chanjman ou yo\u2026',
  },
};

export default function OfflineTransitionBanner({ lang = 'en' }) {
  const [status, setStatus] = useState(networkState.status);
  const [pendingCount, setPendingCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = networkState.onChange((newStatus, prevStatus) => {
      setStatus(newStatus);

      // Show banner on transitions
      if (newStatus === NetworkStatus.OFFLINE) {
        setShowBanner(true);
        clearTimeout(hideTimer.current);
      } else if (newStatus === NetworkStatus.RECONNECTING) {
        setShowBanner(true);
        clearTimeout(hideTimer.current);
      } else if (newStatus === NetworkStatus.ONLINE && prevStatus !== NetworkStatus.ONLINE) {
        setShowBanner(true);
        // Hide "Connected" banner after 3 seconds
        hideTimer.current = setTimeout(() => setShowBanner(false), 3000);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(hideTimer.current);
    };
  }, []);

  // Track pending queue operations
  useEffect(() => {
    const updatePending = async () => {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    };

    updatePending();
    const interval = setInterval(updatePending, 5000);
    return () => clearInterval(interval);
  }, [status]);

  if (!showBanner) return null;

  const message = MESSAGES[status]?.[lang] || MESSAGES[status]?.en || '';
  const styleKey = status === NetworkStatus.OFFLINE ? 'offline'
    : status === NetworkStatus.RECONNECTING ? 'reconnecting'
    : 'online';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        ...BANNER_STYLES.base,
        ...BANNER_STYLES[styleKey],
        ...BANNER_STYLES.visible,
      }}
    >
      {status === NetworkStatus.OFFLINE && (
        <span style={BANNER_STYLES.badge} aria-hidden="true">
          &#x26A0;
        </span>
      )}
      {status === NetworkStatus.RECONNECTING && (
        <span style={BANNER_STYLES.spinner} aria-hidden="true" />
      )}
      {status === NetworkStatus.ONLINE && (
        <span style={BANNER_STYLES.badge} aria-hidden="true">
          &#x2713;
        </span>
      )}
      <span>{message}</span>
      {pendingCount > 0 && status !== NetworkStatus.OFFLINE && (
        <span style={{ fontSize: '12px', opacity: 0.8 }}>
          ({pendingCount} {lang === 'ht' ? 'k ap tann' : 'pending'})
        </span>
      )}
    </div>
  );
}
