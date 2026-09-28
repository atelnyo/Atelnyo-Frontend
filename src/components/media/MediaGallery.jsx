/**
 * MediaGallery — Beautiful, complete media gallery with interactive lightbox.
 *
 * Features:
 *   🖼️  Grid view via MediaGrid
 *   🔍  Lightbox with zoom (click + wheel), pan (drag), pinch-to-zoom
 *   🎞️  Thumbnail strip for quick navigation
 *   📋  Detail panel (metadata, dimensions, provider info)
 *   ⌨️  Keyboard: Escape=close, arrows=prev/next, F=fullscreen, I=info
 *   📱  Touch/mobile friendly
 *   📥  Download, Copy URL, Fullscreen buttons
 *   🏷️  Info bar with position counter, title, provider
 *
 * All click actions are fully functional — no dead buttons.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import MediaGrid from './MediaGrid';
import '../../styles/media-gallery.css';

/** Extract a usable image URL from any item shape (media_url, public_url, url, thumbnail_url). */
function resolveUrl(item) {
  return item?.media_url || item?.public_url || item?.url || '';
}

function resolveThumb(item) {
  return item?.thumbnail_url || item?.preview_url || item?.thumbnail || resolveUrl(item);
}

function resolveType(item) {
  return item?.media_type || item?.kind || item?.type || 'image';
}

export default function MediaGallery({
  items = [],
  loading = false,
  error = null,
  columns = 4,
  onClick,
  onEdit,
  onDelete,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [showDetail, setShowDetail] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const imageRef = useRef(null);

  // ─── Navigation ──────────────────────────────────────────────────
  const openLightbox = useCallback((item) => {
    const idx = items.findIndex(
      (i) => (i.id || i.media_id) === (item.id || item.media_id),
    );
    setSelectedIndex(idx >= 0 ? idx : 0);
    setZoomed(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setShowDetail(false);
  }, [items]);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
    setZoomed(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setShowDetail(false);
    setFullscreen(false);
  }, []);

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => (prev !== null ? (prev + 1) % items.length : null));
    setZoomed(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, [items.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) =>
      prev !== null ? (prev - 1 + items.length) % items.length : null,
    );
    setZoomed(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, [items.length]);

  // ─── Zoom ────────────────────────────────────────────────────────
  const toggleZoom = useCallback(() => {
    if (zoomed) {
      setZoomed(false);
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoomed(true);
      setZoomLevel(2.5);
      setPan({ x: 0, y: 0 });
    }
  }, [zoomed]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!zoomed && e.deltaY < 0) {
      setZoomed(true);
      setZoomLevel(2);
      setPan({ x: 0, y: 0 });
    } else if (zoomed) {
      const newLevel = Math.max(1, Math.min(5, zoomLevel - e.deltaY * 0.005));
      if (newLevel <= 1) {
        setZoomed(false);
        setZoomLevel(1);
        setPan({ x: 0, y: 0 });
      } else {
        setZoomLevel(newLevel);
      }
    }
  }, [zoomed, zoomLevel]);

  // ─── Pan / Drag ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (!zoomed) return;
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [zoomed, pan]);

  const handleMouseMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const maxX = 200 * zoomLevel;
    const maxY = 200 * zoomLevel;
    const newX = Math.max(-maxX, Math.min(maxX, e.clientX - dragStartRef.current.x));
    const newY = Math.max(-maxY, Math.min(maxY, e.clientY - dragStartRef.current.y));
    setPan({ x: newX, y: newY });
  }, [zoomLevel]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // ─── Copy URL ────────────────────────────────────────────────────
  const handleCopyUrl = useCallback(() => {
    if (selectedIndex === null) return;
    const url = resolveUrl(items[selectedIndex]);
    if (!url) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }, [selectedIndex, items]);

  // ─── Keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { closeLightbox(); return; }
      if (e.key === 'ArrowRight') { goNext(); return; }
      if (e.key === 'ArrowLeft') { goPrev(); return; }
      if (e.key === 'f' || e.key === 'F') {
        setFullscreen((f) => !f);
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        setShowDetail((d) => !d);
        return;
      }
      if (e.key === '+' || e.key === '=') {
        const newLevel = Math.min(5, zoomLevel + 0.5);
        setZoomLevel(newLevel);
        if (newLevel > 1) setZoomed(true);
      }
      if (e.key === '-') {
        const newLevel = Math.max(1, zoomLevel - 0.5);
        setZoomLevel(newLevel);
        if (newLevel <= 1) { setZoomed(false); setPan({ x: 0, y: 0 }); }
      }
      if (e.key === '0') { setZoomed(false); setZoomLevel(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, closeLightbox, goNext, goPrev, zoomLevel]);

  // ─── Global mouse up for drag ───────────────────────────────────
  useEffect(() => {
    const mousemove = handleMouseMove;
    const mouseup = handleMouseUp;
    window.addEventListener('mousemove', mousemove);
    window.addEventListener('mouseup', mouseup);
    return () => {
      window.removeEventListener('mousemove', mousemove);
      window.removeEventListener('mouseup', mouseup);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Touch / Pinch ──────────────────────────────────────────────
  const lastTouchDist = useRef(0);
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / (lastTouchDist.current || dist);
      const newLevel = Math.max(1, Math.min(5, zoomLevel * scale));
      setZoomLevel(newLevel);
      if (newLevel > 1) setZoomed(true);
      else { setZoomed(false); setPan({ x: 0, y: 0 }); }
      lastTouchDist.current = dist;
    }
  }, [zoomLevel]);

  const selected = selectedIndex !== null ? items[selectedIndex] : null;
  const selUrl = selected ? resolveUrl(selected) : '';
  const selThumb = selected ? resolveThumb(selected) : '';
  const selType = selected ? resolveType(selected) : '';
  const selProvider = selected?.provider_name || selected?.provider || '';
  const selTitle = selected?.title || selected?.name || '';
  const selWidth = selected?.width;
  const selHeight = selected?.height;
  const selMime = selected?.mime_type || '';
  const selSize = selected?.size_bytes || selected?.file_size || selected?.content_length;
  const selStatus = selected?.health_status || selected?.status || 'unknown';

  return (
    <div className={`media-gallery ${className}`}>
      {/* ─── Grid ──────────────────────────────────────────── */}
      <MediaGrid
        items={items}
        loading={loading}
        error={error}
        columns={columns}
        onClick={(item) => {
          openLightbox(item);
          if (onClick) onClick(item);
        }}
        onEdit={onEdit}
        onDelete={onDelete}
        lang={lang}
      />

      {/* ─── Lightbox ─────────────────────────────────────── */}
      {selectedIndex !== null && selected && (
        <div
          className={`media-gallery-lightbox${fullscreen ? ' fullscreen' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
          role="dialog"
          aria-label={isHt ? 'Aperçu gwo' : 'Large preview'}
          aria-modal="true"
        >
          {/* Close */}
          <button type="button" className="media-gallery-close" onClick={closeLightbox}
            aria-label={isHt ? 'Fèmen' : 'Close'}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>

          {/* Toolbar */}
          <div className="media-gallery-toolbar">
            <button type="button" className="media-gallery-toolbar-btn"
              onClick={() => setShowDetail((d) => !d)}
              title={isHt ? 'Detay' : 'Details'}>
              <i className="fas fa-info-circle" />
            </button>
            <button type="button" className="media-gallery-toolbar-btn"
              onClick={toggleZoom}
              title={zoomed ? (isHt ? 'Retresi' : 'Zoom out') : (isHt ? 'Agrandi' : 'Zoom in')}>
              <i className={`fas fa-${zoomed ? 'search-minus' : 'search-plus'}`} />
            </button>
            <button type="button" className="media-gallery-toolbar-btn"
              onClick={() => setFullscreen((f) => !f)}
              title={isHt ? 'Plen ekran' : 'Fullscreen'}>
              <i className={`fas fa-${fullscreen ? 'compress' : 'expand'}`} />
            </button>
            <button type="button" className="media-gallery-toolbar-btn"
              onClick={handleCopyUrl}
              title={isHt ? 'Kopi URL' : 'Copy URL'}>
              <i className={`fas fa-${copied ? 'check' : 'link'}`} />
            </button>
            {selUrl && (
              <a href={selUrl} target="_blank" rel="noopener noreferrer"
                className="media-gallery-toolbar-btn" style={{ textDecoration: 'none' }}
                title={isHt ? 'Telechaje' : 'Download'}>
                <i className="fas fa-download" />
              </a>
            )}
          </div>

          {/* Prev/Next */}
          {items.length > 1 && (
            <>
              <button type="button" className="media-gallery-nav media-gallery-nav-prev"
                onClick={goPrev} aria-label={isHt ? 'Anvan' : 'Previous'}>
                <i className="fas fa-chevron-left" aria-hidden="true" />
              </button>
              <button type="button" className="media-gallery-nav media-gallery-nav-next"
                onClick={goNext} aria-label={isHt ? 'Apre' : 'Next'}>
                <i className="fas fa-chevron-right" aria-hidden="true" />
              </button>
            </>
          )}

          {/* Content */}
          <div className="media-gallery-content" onWheel={handleWheel}>
            {selType === 'image' || selType === '' ? (
              <div
                className={`media-gallery-image-wrap${zoomed ? ' zoomed' : ''}`}
                onClick={toggleZoom}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                ref={imageRef}
                style={zoomed ? {
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                } : {}}
              >
                <img
                  src={selUrl || selThumb}
                  alt={selTitle || 'Media'}
                  draggable={false}
                />
              </div>
            ) : selType === 'video' ? (
              <div className="media-gallery-video-wrapper">
                <iframe
                  src={selected.preview_url || selUrl}
                  title={selTitle || 'Video'}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="media-gallery-file">
                <i className={`fas fa-${selType === 'audio' ? 'music' : 'file'}`} aria-hidden="true" />
                <p>{selTitle || selUrl || ''}</p>
                {selUrl && (
                  <a href={selUrl} target="_blank" rel="noopener noreferrer"
                    className="media-gallery-download">
                    <i className="fas fa-download" aria-hidden="true" />
                    {isHt ? 'Telechaje / Louvri' : 'Download / Open'}
                  </a>
                )}
              </div>
            )}

            {/* Zoom indicator */}
            {selType === 'image' && (
              <div className="media-gallery-zoom-indicator">
                <i className={`fas fa-${zoomed ? 'search-minus' : 'search-plus'}`} />
                {zoomed ? `${Math.round(zoomLevel * 100)}%` : (isHt ? 'Klike pou zoum' : 'Click to zoom')}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {items.length > 1 && (
            <div className="media-gallery-strip">
              {items.map((item, idx) => {
                const thumb = resolveThumb(item);
                const type = resolveType(item);
                return (
                  <div
                    key={item.id || item.media_id || idx}
                    className={`media-gallery-strip-thumb${idx === selectedIndex ? ' active' : ''}`}
                    onClick={() => { setSelectedIndex(idx); setZoomed(false); setZoomLevel(1); setPan({ x: 0, y: 0 }); }}
                  >
                    {thumb && type === 'image' ? (
                      <img src={thumb} alt="" />
                    ) : (
                      <span className="strip-icon">
                        <i className={`fas fa-${type === 'video' ? 'video' : type === 'audio' ? 'music' : 'file'}`} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Detail Panel */}
          {showDetail && selected && (
            <div className="media-gallery-detail-overlay">
              <button type="button" className="media-gallery-close"
                style={{ position: 'sticky', top: 0, float: 'right', width: 30, height: 30, fontSize: '0.8rem' }}
                onClick={() => setShowDetail(false)}>
                <i className="fas fa-times" />
              </button>
              <h4>{isHt ? 'Detay Medya' : 'Media Details'}</h4>

              {selTitle && (
                <div className="media-gallery-detail-item">
                  <span className="label">{isHt ? 'Tit' : 'Title'}</span>
                  <span className="value">{selTitle}</span>
                </div>
              )}
              {selMime && (
                <div className="media-gallery-detail-item">
                  <span className="label">MIME</span>
                  <span className="value">{selMime}</span>
                </div>
              )}
              {selWidth && selHeight && (
                <div className="media-gallery-detail-item">
                  <span className="label">{isHt ? 'Dimansyon' : 'Dimensions'}</span>
                  <span className="value">{selWidth} × {selHeight} px</span>
                </div>
              )}
              {selSize != null && (
                <div className="media-gallery-detail-item">
                  <span className="label">{isHt ? 'Gwose' : 'Size'}</span>
                  <span className="value">
                    {Number(selSize) >= 1_000_000 ? `${(Number(selSize) / 1_000_000).toFixed(1)} MB`
                      : Number(selSize) >= 1_000 ? `${(Number(selSize) / 1_000).toFixed(1)} KB`
                      : `${selSize} B`}
                  </span>
                </div>
              )}
              {selProvider && (
                <div className="media-gallery-detail-item">
                  <span className="label">{isHt ? 'Provider' : 'Provider'}</span>
                  <span className="value">{selProvider}</span>
                </div>
              )}
              <div className="media-gallery-detail-item">
                <span className="label">{isHt ? 'Estati' : 'Status'}</span>
                <span className="value" style={{
                  color: selStatus === 'healthy' ? '#10b981' :
                         selStatus === 'broken' ? '#ef4444' :
                         selStatus === 'warning' ? '#f59e0b' : '#94a3b8',
                }}>
                  <i className={`fas fa-${selStatus === 'healthy' ? 'check-circle' : selStatus === 'broken' ? 'times-circle' : selStatus === 'warning' ? 'exclamation-triangle' : 'question-circle'}`} style={{ marginRight: 4 }} />
                  {selStatus}
                </span>
              </div>

              {selUrl && (
                <div className="media-gallery-detail-item">
                  <span className="label">URL</span>
                  <span className="value" style={{ fontSize: '0.68rem', fontFamily: 'monospace', opacity: 0.7 }}>{selUrl.length > 80 ? selUrl.slice(0, 80) + '…' : selUrl}</span>
                </div>
              )}
            </div>
          )}

          {/* Info bar */}
          <div className="media-gallery-info">
            <span className="media-gallery-info-counter">
              {selectedIndex + 1} / {items.length}
            </span>
            {selTitle && (
              <span className="media-gallery-info-title">{selTitle}</span>
            )}
            {selProvider && (
              <span className="media-gallery-info-provider">
                <i className="fas fa-cloud" aria-hidden="true" />
                {selProvider}
              </span>
            )}
            {zoomed && (
              <span className="media-gallery-info-provider">
                {Math.round(zoomLevel * 100)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
