/**
 * src/components/studio/modals/AvatarEditModal.jsx
 *
 * Modal pou chanje foto profile (avatar) nan Creator Studio.
 * Sèvi ak creatorProfileService.uploadAvatar(file) ki deja egziste.
 *
 * Features:
 *   - Preview ak avatar aktyèl la
 *   - File input (click oswa drag & drop)
 *   - RECADRE (crop) reyèl: kadraj kare 1:1 ak anviwònman an —
 *     glise imaj la pou deplase, slider pou zoom, epi Save voye
 *     vreman KOUTI an (512×512), pa fichye orijinal la.
 *   - Loading state pandan upload
 *   - OnSuccess callback pou refresh profileData
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { creatorProfileService } from '../../../services/api';
import { StudioModal } from './shared';
import styles from './modals.module.css';

// Final square avatar resolution (server receives a real square crop).
const CROP_OUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// Scale so the image always COVERS the crop square (no empty gaps), then
// multiply by the user zoom.
function coverScale(box, imgW, imgH, zoom) {
  return Math.max(box / imgW, box / imgH) * zoom;
}

// Offsets are negative (image top-left sits at -x inside the crop box).
function clampOffset(off, disp, box) {
  const min = box - disp; // disp >= box at zoom>=1, so min <= 0
  return Math.min(0, Math.max(min, off));
}

export default function AvatarEditModal({ onClose, onSuccess, lang, showToast, currentAvatarUrl, userName }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  // ── Crop state ─────────────────────────────────────────────
  const [imgDim, setImgDim] = useState(null);   // natural size {w, h}
  const [cropBox, setCropBox] = useState(null);  // measured viewport px (square)
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const cropViewportRef = useRef(null);
  const cropImgRef = useRef(null); // decoded <img> used as the canvas source

  const isHt = lang === 'ht';

  // Revoke object URL on cleanup pou evite memory leak
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const resetFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImgDim(null);
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    // Validate: image only, max 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      setError(isHt
        ? 'Tanpri chwazi yon imaj (JPEG, PNG, WebP, GIF, AVIF).'
        : 'Please select an image (JPEG, PNG, WebP, GIF, AVIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(isHt
        ? 'Imaj la twò gwo. Maksimòm 5 MB.'
        : 'Image too large. Maximum 5 MB.');
      return;
    }
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setImgDim(null);
  }, [isHt]);

  const handleInputChange = useCallback((e) => {
    handleFileSelect(e.target.files?.[0]);
  }, [handleFileSelect]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer?.files?.[0]);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // ── Crop geometry ──────────────────────────────────────────────
  const hasCropSource = Boolean(selectedFile && imgDim && previewUrl);
  // Measured square viewport (falls back to 260 if the ref is not laid
  // out yet — keeps math stable on the very first paint).
  const measuredBox = cropBox || 260;

  const view = hasCropSource
    ? (() => {
        const s = coverScale(measuredBox, imgDim.w, imgDim.h, zoom);
        return { w: imgDim.w * s, h: imgDim.h * s };
      })()
    : null;

  // Keep a live mirror of the geometry so pointer handlers never read a
  // stale closure.
  const geoRef = useRef({ box: measuredBox, view: view, offset, zoom });
  useEffect(() => {
    geoRef.current = { box: measuredBox, view, offset, zoom };
  }, [measuredBox, view, offset, zoom]);

  // Measure the viewport box once the crop image is displayed.
  useEffect(() => {
    if (!hasCropSource) return undefined;
    const measure = () => {
      const node = cropViewportRef.current;
      if (!node) return;
      const w = node.clientWidth;
      if (w > 0 && w !== cropBox) setCropBox(w);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [hasCropSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-center whenever the image, box, or zoom changes (zoom anchored on
  // the center keeps the focus roughly where the user was looking).
  useEffect(() => {
    if (!view) return;
    setOffset({
      x: (measuredBox - view.w) / 2,
      y: (measuredBox - view.h) / 2,
    });
  }, [view?.w, view?.h, measuredBox]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCropImgLoad = useCallback((e) => {
    const el = e.currentTarget;
    cropImgRef.current = el;
    const w = el.naturalWidth || 1;
    const h = el.naturalHeight || 1;
    setImgDim({ w, h });
  }, []);

  // ── Pan (drag to reframe) ──────────────────────────────────────
  const dragStartRef = useRef(null); // { clientX, clientY, ox, oy }

  const handlePointerDown = useCallback((e) => {
    if (!geoRef.current.view) return;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      ox: geoRef.current.offset.x,
      oy: geoRef.current.offset.y,
    };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
  }, []);

  const handlePointerMove = useCallback((e) => {
    const start = dragStartRef.current;
    if (!start || !geoRef.current.view) return;
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    const { box, view: v } = geoRef.current;
    setOffset({
      x: clampOffset(start.ox + dx, v.w, box),
      y: clampOffset(start.oy + dy, v.h, box),
    });
  }, []);

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
    setDragging(false);
  }, []);

  // ── Zoom ───────────────────────────────────────────────────────
  const handleZoomChange = useCallback((nextZoom) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setZoom(z);
  }, []);
  // Track natural size for focus-anchored zooming (effect below).
  const imgNatRef = useRef({ w: 1, h: 1 });
  useEffect(() => {
    if (imgDim) imgNatRef.current = { w: imgDim.w, h: imgDim.h };
  }, [imgDim]);
  useEffect(() => {
    const g = geoRef.current;
    if (!g.view) return;
    const { w: iw, h: ih } = imgNatRef.current;
    const dispW = iw * coverScale(g.box, iw, ih, zoom);
    const dispH = ih * coverScale(g.box, iw, ih, zoom);
    // Keep the current focus fraction (0..1) of the image under center.
    const fx = Math.max(0, Math.min(1, (g.box / 2 - g.offset.x) / g.view.w));
    const fy = Math.max(0, Math.min(1, (g.box / 2 - g.offset.y) / g.view.h));
    setOffset({
      x: clampOffset(g.box / 2 - fx * dispW, dispW, g.box),
      y: clampOffset(g.box / 2 - fy * dispH, dispH, g.box),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // ── Submit cropped square ──────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      let uploadFile = selectedFile;
      const source = cropImgRef.current;
      const g = geoRef.current;
      // Real crop: draw the reframed square (center of the viewport is
      // the crop box because the <img> is offset inside it) to a fresh
      // canvas and upload THAT — not the raw file.
      if (source && g.view && g.view.w >= g.box && g.view.h >= g.box) {
        const canvas = document.createElement('canvas');
        canvas.width = CROP_OUT;
        canvas.height = CROP_OUT;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const k = CROP_OUT / g.box;
          ctx.drawImage(source, -g.offset.x * k, -g.offset.y * k, g.view.w * k, g.view.h * k);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          if (blob) {
            const base = (selectedFile.name || 'avatar').replace(/\.[^.]+$/, '') || 'avatar';
            uploadFile = new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
          }
        }
      }
      const res = await creatorProfileService.uploadAvatar(uploadFile);
      const newUrl = res?.data?.avatar_url || res?.data?.url || res?.data?.data?.avatar_url;
      showToast?.(
        isHt ? '✅ Foto profile mete ajou!' : '✅ Profile photo updated!',
        'check-circle',
      );
      resetFile();
      onSuccess?.(newUrl);
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.message
        || (isHt ? 'Pa t kapab chaje foto a. Eseye ankò.' : 'Could not upload photo. Try again.');
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [selectedFile, isHt, showToast, resetFile, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    resetFile();
    onClose?.();
  }, [resetFile, onClose]);

  const showCropStage = hasCropSource;
  const displayUrl = selectedFile ? null : currentAvatarUrl; // raw file is shown in the crop stage, not the circle
  const canSave = !!selectedFile && !loading;
  const initialLetter = userName?.charAt(0)?.toUpperCase() || 'C';

  return (
    <StudioModal
      onClose={handleClose}
      icon="fa-camera"
      title={isHt ? 'Foto Profile' : 'Profile Photo'}
      subtitle={isHt
        ? 'Chwazi yon imaj epi kadre l jan ou vle'
        : 'Choose an image and frame it the way you like'}
    >
      <div className={styles.avatarEditContent}>
        {/* Preview circle (only the SAVED avatar; while a file is being
            framed the crop stage below is the live preview) */}
        {!showCropStage && (
          <div className={styles.avatarPreviewWrap}>
            <div className={styles.avatarPreviewCircle}>
              {displayUrl && !error ? (
                <img
                  className={styles.avatarPreviewImg}
                  src={displayUrl}
                  alt="Avatar preview"
                />
              ) : (
                <span className={styles.avatarPreviewInitial}>{initialLetter}</span>
              )}
              {loading && (
                <div className={styles.avatarUploadOverlay}>
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
        )}

        {showCropStage ? (
          <div className={styles.avatarCropStage}>
            <div
              ref={cropViewportRef}
              className={`${styles.avatarCropViewport}${dragging ? ` ${styles.avatarCropDragging}` : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              role="application"
              aria-label={isHt ? 'Zòn kadraj — glise pou deplase imaj la' : 'Crop area — drag to move the image'}
            >
              {view && (
                <img
                  ref={cropImgRef}
                  className={styles.avatarCropImg}
                  src={previewUrl}
                  alt=""
                  draggable={false}
                  onLoad={handleCropImgLoad}
                  style={{
                    width: view.w,
                    height: view.h,
                    left: offset.x,
                    top: offset.y,
                  }}
                />
              )}
              {/* Rule-of-thirds guides */}
              <div className={styles.avatarCropGrid} aria-hidden="true">
                <span className={styles.avatarCropGuideV1} />
                <span className={styles.avatarCropGuideV2} />
                <span className={styles.avatarCropGuideH1} />
                <span className={styles.avatarCropGuideH2} />
              </div>
              {loading && (
                <div className={styles.avatarCropBusy}>
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className={styles.avatarCropHint}>
              <i className="fas fa-arrows-up-down-left-right" aria-hidden="true" />
              {isHt ? 'Glise imaj la pou reframe l' : 'Drag the image to reframe'}
            </div>

            {/* Zoom control */}
            <div className={styles.avatarCropControls}>
              <span className={styles.avatarCropZoomLabel}>{Math.round(zoom * 100)}%</span>
              <input
                className={styles.avatarCropSlider}
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                aria-label={isHt ? 'Zoom' : 'Zoom'}
              />
              <button
                type="button"
                className={styles.avatarCropZoomBtn}
                onClick={() => handleZoomChange(zoom + ZOOM_STEP)}
                aria-label={isHt ? 'Agrandi' : 'Zoom in'}
              >
                <i className="fas fa-plus" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.avatarCropZoomBtn}
                onClick={() => handleZoomChange(zoom - ZOOM_STEP)}
                aria-label={isHt ? 'Retresi' : 'Zoom out'}
              >
                <i className="fas fa-minus" aria-hidden="true" />
              </button>
            </div>
            <p className={styles.avatarCropSizeHint}>
              {isHt ? 'Fini: avatè a pral voye koupe nan 512×512.' : 'Final: avatar is uploaded as a 512×512 square crop.'}
            </p>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              className={`${styles.avatarDropZone} ${dragOver ? styles.avatarDropZoneActive : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              aria-label={isHt ? 'Chwazi yon fichye' : 'Choose a file'}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                onChange={handleInputChange}
                className={styles.avatarFileInput}
                aria-hidden="true"
              />
              <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
              <p className={styles.avatarDropText}>
                {selectedFile
                  ? selectedFile.name
                  : (isHt
                      ? 'Klike oswa glise yon imaj la a'
                      : 'Click or drag an image here')}
              </p>
              <p className={styles.avatarDropHint}>
                {isHt ? 'JPEG, PNG, WebP, GIF, AVIF • Maks 5 MB' : 'JPEG, PNG, WebP, GIF, AVIF • Max 5 MB'}
              </p>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className={styles.avatarError} role="alert">
            <i className="fas fa-exclamation-circle" aria-hidden="true" /> {error}
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            disabled={loading}
          >
            {isHt ? 'Anile' : 'Cancel'}
          </button>
          {selectedFile && (
            <button
              type="button"
              className={styles.studioBtnGhost}
              onClick={resetFile}
              disabled={loading}
            >
              <i className="fas fa-times" /> {isHt ? 'Rekòmanse' : 'Reset'}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Uploading...'}</>
            ) : (
              <><i className="fas fa-save" /> {isHt ? 'Sove' : 'Save'}</>
            )}
          </button>
        </div>
      </div>
    </StudioModal>
  );
}
