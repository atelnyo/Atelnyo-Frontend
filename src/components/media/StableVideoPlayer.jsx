/**
 * src/components/media/StableVideoPlayer.jsx
 *
 * Stable video player that handles:
 *   - YouTube/Vimeo embeds (iframe)
 *   - Direct video URLs (MP4, WebM, OGG)
 *   - HLS streams (.m3u8)
 *   - Filebase/S3 pre-signed URLs
 *   - Error handling with retry
 *   - Loading states
 *   - Responsive design
 *   - Autoplay/pause controls
 *
 * Props:
 *   url         — video URL (any format)
 *   poster      — thumbnail/poster image URL
 *   title       — video title (for accessibility)
 *   width       — player width (default: 100%)
 *   height      — player height (default: auto, aspect ratio preserved)
 *   autoPlay    — autoplay on load (default: false)
 *   muted       — muted by default (default: false)
 *   controls    — show controls (default: true)
 *   preload     — preload strategy (default: 'metadata')
 *   onError     — callback when video fails to load
 *   onLoad      — callback when video loads successfully
 *   className   — additional CSS class
 *   lang        — language code (default: 'ht')
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// ─── Video Source Detection ─────────────────────────────────────────

function detectVideoSource(url) {
  if (!url) return { type: 'none', url: '' };

  const lower = url.toLowerCase();

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return { type: 'youtube', id: ytMatch[1], url: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0` };
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    return { type: 'vimeo', id: vimeoMatch[1], url: `https://player.vimeo.com/video/${vimeoMatch[1]}?badge=0&autopause=0&player_id=0` };
  }

  // HLS (.m3u8)
  if (lower.endsWith('.m3u8') || lower.includes('.m3u8?')) {
    return { type: 'hls', url };
  }

  // DASH (.mpd)
  if (lower.endsWith('.mpd') || lower.includes('.mpd?')) {
    return { type: 'dash', url };
  }

  // Direct video file
  if (/\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url)) {
    return { type: 'native', url };
  }

  // Filebase/S3 URL (assume direct video)
  if (url.includes('s3.filebase.io') || url.includes('s3.us-') || url.includes('b2.cloudfile')) {
    return { type: 'native', url };
  }

  // Default: try as direct video
  return { type: 'native', url };
}

// ─── YouTube Player ─────────────────────────────────────────────────

function YouTubePlayer({ url, title, width, height, autoPlay, onError, onLoad }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="svp-wrapper" style={{ width, paddingBottom: '56.25%', position: 'relative' }}>
      {!loaded && !error && (
        <div className="svp-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>Loading YouTube...</span>
        </div>
      )}
      {error && (
        <div className="svp-error" onClick={() => { setError(false); setLoaded(false); }}>
          <i className="fab fa-youtube" style={{ color: '#ff0000', fontSize: '2rem' }} />
          <span>YouTube video not available</span>
          <button type="button" className="svp-retry">Tap to retry</button>
        </div>
      )}
      <iframe
        src={url}
        title={title || 'YouTube video'}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: '12px' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => { setLoaded(true); onLoad?.(); }}
        onError={() => { setError(true); onError?.(); }}
      />
    </div>
  );
}

// ─── Vimeo Player ───────────────────────────────────────────────────

function VimeoPlayer({ url, title, width, height, autoPlay, onError, onLoad }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="svp-wrapper" style={{ width, paddingBottom: '56.25%', position: 'relative' }}>
      {!loaded && !error && (
        <div className="svp-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>Loading Vimeo...</span>
        </div>
      )}
      {error && (
        <div className="svp-error" onClick={() => { setError(false); setLoaded(false); }}>
          <i className="fab fa-vimeo-v" style={{ color: '#1ab7ea', fontSize: '2rem' }} />
          <span>Vimeo video not available</span>
          <button type="button" className="svp-retry">Tap to retry</button>
        </div>
      )}
      <iframe
        src={url}
        title={title || 'Vimeo video'}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: '12px' }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        onLoad={() => { setLoaded(true); onLoad?.(); }}
        onError={() => { setError(true); onError?.(); }}
      />
    </div>
  );
}

// ─── Native HTML5 Video ─────────────────────────────────────────────

function NativeVideoPlayer({ url, poster, title, width, height, autoPlay, muted, controls, preload, onError, onLoad }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setLoading(false);
    if (retryCount < maxRetries) {
      // Auto-retry on error
      setTimeout(() => {
        setRetryCount((c) => c + 1);
        if (videoRef.current) {
          videoRef.current.load();
        }
      }, 1000 * (retryCount + 1));
    } else {
      setError(true);
      onError?.();
    }
  }, [retryCount, onError]);

  // Reset retry count when URL changes
  useEffect(() => {
    setRetryCount(0);
    setError(false);
    setLoading(true);
  }, [url]);

  return (
    <div className="svp-wrapper" style={{ width }}>
      {loading && !error && (
        <div className="svp-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>Loading video...</span>
        </div>
      )}
      {error && (
        <div className="svp-error" onClick={() => { setError(false); setRetryCount(0); setLoading(true); }}>
          <i className="fas fa-video-slash" style={{ fontSize: '2rem' }} />
          <span>Video not available</span>
          <button type="button" className="svp-retry">Tap to retry</button>
        </div>
      )}
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        title={title}
        autoPlay={autoPlay}
        muted={muted}
        controls={controls}
        preload={preload}
        onLoadedData={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          borderRadius: '12px',
          display: error ? 'none' : 'block',
          backgroundColor: '#000',
        }}
        playsInline
      />
    </div>
  );
}

// ─── Main StableVideoPlayer Component ───────────────────────────────

export default function StableVideoPlayer({
  url = '',
  poster = '',
  title = '',
  width = '100%',
  height = 'auto',
  autoPlay = false,
  muted = false,
  controls = true,
  preload = 'metadata',
  onError,
  onLoad,
  className = '',
  lang = 'ht',
}) {
  const source = useMemo(() => detectVideoSource(url), [url]);

  if (!url || source.type === 'none') {
    return (
      <div className={`svp-empty ${className}`} style={{ width }}>
        <div className="svp-placeholder">
          <i className="fas fa-video" />
          <span>{lang === 'ht' ? 'Pa gen videyo' : 'No video'}</span>
        </div>
      </div>
    );
  }

  const commonProps = { title, width, height, autoPlay, muted, controls, onError, onLoad };

  switch (source.type) {
    case 'youtube':
      return (
        <div className={`svp-container ${className}`}>
          <YouTubePlayer {...commonProps} url={source.url} />
        </div>
      );

    case 'vimeo':
      return (
        <div className={`svp-container ${className}`}>
          <VimeoPlayer {...commonProps} url={source.url} />
        </div>
      );

    case 'hls':
    case 'dash':
    case 'native':
    default:
      return (
        <div className={`svp-container ${className}`}>
          <NativeVideoPlayer {...commonProps} url={source.url} poster={poster} preload={preload} />
        </div>
      );
  }
}

// ─── Video Preview (compact, for cards) ─────────────────────────────

export function VideoPreview({ url, poster, title, className = '' }) {
  const source = useMemo(() => detectVideoSource(url), [url]);

  if (!url) return null;

  // YouTube thumbnail
  if (source.type === 'youtube') {
    return (
      <div className={`svp-preview ${className}`}>
        <img
          src={`https://img.youtube.com/vi/${source.id}/hqdefault.jpg`}
          alt={title}
          className="svp-preview-img"
          loading="lazy"
        />
        <div className="svp-preview-play">
          <i className="fas fa-play" />
        </div>
      </div>
    );
  }

  // Vimeo thumbnail (use poster or placeholder)
  if (source.type === 'vimeo') {
    return (
      <div className={`svp-preview ${className}`}>
        {poster ? (
          <img src={poster} alt={title} className="svp-preview-img" loading="lazy" />
        ) : (
          <div className="svp-preview-placeholder">
            <i className="fab fa-vimeo-v" />
          </div>
        )}
        <div className="svp-preview-play">
          <i className="fas fa-play" />
        </div>
      </div>
    );
  }

  // Native video
  return (
    <div className={`svp-preview ${className}`}>
      {poster ? (
        <img src={poster} alt={title} className="svp-preview-img" loading="lazy" />
      ) : (
        <div className="svp-preview-placeholder">
          <i className="fas fa-video" />
        </div>
      )}
      <div className="svp-preview-play">
        <i className="fas fa-play" />
      </div>
    </div>
  );
}
