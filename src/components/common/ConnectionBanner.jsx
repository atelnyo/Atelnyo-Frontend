/**
 * ConnectionBanner.jsx — Offline/online status banner.
 *
 * Shows a persistent banner at the top of the page when:
 *   • User goes offline
 *   • Connection is slow (2g / slow-2g)
 *   • Data-saver mode is enabled
 *   • Offline queue has pending items
 *
 * Integrates with useConnectionMonitor hook and offlineQueue.
 */

import React, { useEffect, useState } from 'react';
import useConnectionMonitor from '../../hooks/useConnectionMonitor';
import offlineQueue from '../../services/offlineQueue';

export default function ConnectionBanner({ lang = 'ht' }) {
  const conn = useConnectionMonitor();
  const isHt = lang === 'ht';
  const [queueSize, setQueueSize] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [lastOnline, setLastOnline] = useState(Date.now());

  // Track queue size
  useEffect(() => {
    const updateSize = () => {
      setQueueSize(offlineQueue.size);
    };
    const unsub = offlineQueue.on('enqueue', updateSize);
    const unsub2 = offlineQueue.on('drain', updateSize);
    updateSize();
    return () => { unsub(); unsub2(); };
  }, []);

  // Reset dismissal when state changes significantly
  useEffect(() => {
    if (conn.online && queueSize === 0) {
      const timer = setTimeout(() => setDismissed(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [conn.online, queueSize]);

  useEffect(() => {
    if (conn.online) setLastOnline(Date.now());
  }, [conn.online]);

  // Don't show if online, no queue, no issues
  if (conn.online && !conn.isSlow && !conn.isDataSaver && queueSize === 0) return null;
  if (dismissed && conn.online) return null;

  const secondsOffline = conn.online ? 0 : Math.round((Date.now() - lastOnline) / 1000);

  // Determine banner type
  let type = 'info';
  let icon = 'fa-wifi';
  let heading = '';
  let body = '';

  if (!conn.online) {
    type = 'error';
    icon = 'fa-wifi-slash';
    heading = isHt ? 'Ou pa konekte' : 'You are offline';
    body = isHt
      ? `Ou pèdi koneksyon depi ${secondsOffline}s. Chanjman ou fè yo ap sove lokalman epi yo ap voye lè koneksyon an retabli.`
      : `Lost connection ${secondsOffline}s ago. Your changes are saved locally and will sync when you reconnect.`;
    if (queueSize > 0) {
      body += isHt
        ? ` ${queueSize} aksyon annatant.`
        : ` ${queueSize} actions pending.`;
    }
  } else if (conn.isSlow) {
    type = 'warning';
    icon = 'fa-tachometer-alt';
    heading = isHt ? 'Koneksyon dousman' : 'Slow connection';
    body = isHt
      ? 'W ap sou yon rezo 2G/oswa pi dousman. Imaj ak videyo ka pran tan pou chaje.'
      : 'You are on a slow network. Images and videos may take longer to load.';
  } else if (conn.isDataSaver) {
    type = 'info';
    icon = 'fa-mobile-alt';
    heading = isHt ? 'Mode ekonomize done' : 'Data saver mode';
    body = isHt
      ? 'Navigatè ou nan mode ekonomize done. Kontni medya yo ka pa chaje otomatikman.'
      : 'Your browser is in data-saver mode. Media may not load automatically.';
  } else if (queueSize > 0) {
    type = 'info';
    icon = 'fa-cloud-upload-alt';
    heading = isHt ? 'Senkronizasyon annatant' : 'Sync pending';
    body = isHt
      ? `${queueSize} aksyon ap tann koneksyon pou voye.`
      : `${queueSize} actions waiting to sync.`;
  }

  return (
    <div className={`conn-banner conn-banner--${type}`} role="status" aria-live="polite">
      <div className="conn-banner-inner">
        <i className={`fas ${icon} conn-banner-icon`} aria-hidden="true" />
        <div className="conn-banner-text">
          <strong>{heading}</strong>
          <span>{body}</span>
        </div>
        <div className="conn-banner-actions">
          {!conn.online && (
            <button
              type="button"
              className="conn-banner-btn"
              onClick={() => conn.drainQueue()}
            >
              <i className="fas fa-sync-alt" /> {isHt ? 'Eseye' : 'Retry'}
            </button>
          )}
          <button
            type="button"
            className="conn-banner-dismiss"
            onClick={() => setDismissed(true)}
            aria-label={isHt ? 'Fèmen' : 'Dismiss'}
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </div>
    </div>
  );
}
