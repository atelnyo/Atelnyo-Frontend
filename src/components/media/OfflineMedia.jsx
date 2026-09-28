/**
 * OfflineMedia — Eksperyans offline pou medya yo.
 *
 * Montre:
 *   - Cached Preview (si disponib)
 *   - Retry button
 *   - Reconnect button
 *   - Offline Badge
 *   - Waiting Connection message
 */
import React, { useState, useEffect } from 'react';

export default function OfflineMedia({
  cachedUrl,
  mediaType = 'image',
  title,
  onRetry,
  lang = 'ht',
  className = '',
}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retrying, setRetrying] = useState(false);
  const isHt = lang === 'ht';

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    if (onRetry) onRetry();
    setTimeout(() => setRetrying(false), 2000);
  };

  if (isOnline && !retrying) return null;

  return (
    <div className={`offline-media ${className}`} role="status">
      {/* Offline Badge */}
      <div className="offline-media-badge">
        <i className="fas fa-wifi-slash" />
        {isHt ? 'Offline' : 'Offline'}
      </div>

      <div className="offline-media-body">
        {/* Cached Preview */}
        {cachedUrl && (
          <div className="offline-media-preview">
            {mediaType === 'image' ? (
              <img src={cachedUrl} alt={title || 'Cached preview'} className="offline-media-img" />
            ) : (
              <div className="offline-media-placeholder">
                <i className={`fas ${mediaType === 'video' ? 'fa-video' : mediaType === 'audio' ? 'fa-music' : 'fa-file'}`} />
                <span>{title || (isHt ? 'Preview nan cach' : 'Cached preview')}</span>
              </div>
            )}
          </div>
        )}

        {/* Message */}
        <p className="offline-media-message">
          {retrying
            ? (isHt ? 'Ap eseye rekonekte...' : 'Trying to reconnect...')
            : (isHt ? 'Pa gen koneksyon entènèt. Medya a pa ka chaje.' : 'No internet connection. Media cannot be loaded.')}
        </p>

        {/* Actions */}
        <div className="offline-media-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleRetry}
            disabled={retrying}
          >
            <i className={`fas ${retrying ? 'fa-spinner fa-spin' : 'fa-redo'}`} />
            {retrying
              ? (isHt ? 'Ap rekonekte...' : 'Reconnecting...')
              : (isHt ? 'Eseye ankò' : 'Retry')}
          </button>
        </div>
      </div>
    </div>
  );
}
