/**
 * src/components/studio/MediaLibrary.jsx
 *
 * Media Library — Shows all user's connected media URLs inside Creator Studio.
 *
 * Features:
 *   - List of all media assets with thumbnails, type, provider, health status
 *   - Filter by type (image/video/audio/document) and health status
 *   - Per-item: Edit URL, Disable, Replace URL, Archive, Delete Reference
 *   - Health status indicators (healthy, warning, broken, blocked, expired)
 *   - Usage tracking: shows where each media is used (Courses, Products, etc.)
 *   - Smart Replace: replace broken URL and auto-update everywhere
 *   - Search by URL or filename
 *
 * Route: Creator Studio → Media → Library tab
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { mediaProviderService } from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function fmtFileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── Health Status Config ─────────────────────────────────────────────────

const HEALTH_META = {
  healthy:  { icon: 'fa-check-circle', color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.1))', labelEn: 'Healthy', labelHt: 'An sante' },
  checking: { icon: 'fa-spinner fa-spin', color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.1))', labelEn: 'Checking', labelHt: 'Ap tcheke' },
  warning:  { icon: 'fa-exclamation-triangle', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.1))', labelEn: 'Warning', labelHt: 'Avètisman' },
  broken:   { icon: 'fa-times-circle', color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.1))', labelEn: 'Broken', labelHt: 'Kase' },
  blocked:  { icon: 'fa-ban', color: 'var(--state-error-dark, #dc2626)', bg: 'rgba(220,38,38,0.1)', labelEn: 'Blocked', labelHt: 'Bloke' },
  expired:  { icon: 'fa-hourglass-end', color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.1))', labelEn: 'Expired', labelHt: 'Ekspire' },
  private:  { icon: 'fa-lock', color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.1))', labelEn: 'Private', labelHt: 'Prive' },
  unknown:  { icon: 'fa-question-circle', color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.1))', labelEn: 'Unknown', labelHt: 'Enkoni' },
};

const MEDIA_TYPE_ICONS = {
  image: 'fa-image',
  video: 'fa-video',
  audio: 'fa-music',
  document: 'fa-file-alt',
};

// ─── Skeleton ───────────────────────────────────────────────────────────────

function MediaLibrarySkeleton({ rows = 4 }) {
  return (
    <div className="mlib-skeleton" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mlib-skel-row" aria-hidden="true">
          <div className="mlib-skel-thumb" />
          <div className="mlib-skel-body">
            <div className="mlib-skel-line" style={{ width: '50%' }} />
            <div className="mlib-skel-line" style={{ width: '30%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Media Item Row ─────────────────────────────────────────────────────────

function MediaItemRow({ asset, lang, onReplace, onDisable, onArchive, onDelete, onRename }) {
  const isHt = lang === 'ht';
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(asset.title || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const health = HEALTH_META[asset.health_status] || HEALTH_META.unknown;
  const mediaType = asset.media_type || asset.mime_type?.split('/')[0] || 'document';
  const typeIcon = MEDIA_TYPE_ICONS[mediaType] || 'fa-file';
  const providerName = asset.provider_name || asset.detected_provider || '—';
  const displayTitle = asset.title || '';
  const displayUrl = asset.url ? (asset.url.length > 50 ? asset.url.slice(0, 50) + '…' : asset.url) : '—';
  const usageList = Array.isArray(asset.usages) ? asset.usages : [];

  const handleStartEdit = () => {
    setEditTitle(asset.title || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveTitle = async () => {
    const trimmed = editTitle.trim().slice(0, 256);
    if (!trimmed || trimmed === (asset.title || '')) { setEditing(false); return; }
    setSaving(true);
    try {
      await mediaProviderService.renameMedia(asset.id, trimmed);
      onRename?.(asset.id, trimmed);
      setEditing(false);
    } catch {
      // keep editing on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="mlib-item" data-health={asset.health_status || 'unknown'}>
      {/* Thumbnail */}
      <div className="mlib-item-thumb">
        {asset.thumbnail_url ? (
          <img
            src={asset.thumbnail_url}
            alt={asset.url || 'Media'}
            className="mlib-thumb-img"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="mlib-thumb-placeholder">
            <i className={`fas ${typeIcon}`} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mlib-item-body">
        {/* Title — inline editable */}
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveTitle}
              placeholder={isHt ? 'Non imaj...' : 'Image name...'}
              maxLength={256}
              style={{
                flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1.5px solid var(--studio-pink, #d81b60)',
                fontSize: '0.85rem', outline: 'none', background: 'var(--bg-input)',
              }}
            />
            {saving && <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.75rem', color: 'var(--studio-pink)' }} />}
          </div>
        ) : (
          <div
            className="mlib-item-title-row"
            onClick={handleStartEdit}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}
            title={isHt ? 'Klike pou renome' : 'Click to rename'}
          >
            {displayTitle ? (
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{displayTitle}</span>
            ) : (
              <span style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
                <i className="fas fa-pencil-alt" style={{ marginRight: '4px', fontSize: '0.65rem' }} />
                {isHt ? 'Klike pou bay yon non...' : 'Click to name this media...'}
              </span>
            )}
          </div>
        )}
        <div className="mlib-item-url" title={asset.url}>
          <a href={asset.url} target="_blank" rel="noopener noreferrer" className="mlib-url-link">
            {displayUrl}
          </a>
        </div>
        <div className="mlib-item-meta">
          <span className="mlib-provider-badge">{providerName}</span>
          <span className="mlib-type-badge">
            <i className={`fas ${typeIcon}`} aria-hidden="true" /> {asset.media_type || mediaType}
          </span>
          <span className="mlib-size">{fmtFileSize(asset.file_size || asset.content_length)}</span>
          {(asset.width && asset.height) && (
            <span className="mlib-dims" title={`${asset.width} × ${asset.height} pixels`}>
              {asset.width}×{asset.height}
            </span>
          )}
          <span className="mlib-date">{fmtDate(asset.created_at || asset.validated_at)}</span>
        </div>
        {/* Usage info */}
        {usageList.length > 0 && (
          <div className="mlib-usage">
            <i className="fas fa-link" aria-hidden="true" />
            <span className="mlib-usage-text">
              {isHt ? 'Itilize nan' : 'Used in'}: {usageList.map((u) => u.module).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Health status */}
      <div className="mlib-health" title={health.labelEn}>
        <span className="mlib-health-dot" style={{ background: health.color }} />
        <span className="mlib-health-label" style={{ color: health.color }}>
          {isHt ? health.labelHt : health.labelEn}
        </span>
      </div>

      {/* Actions */}
      <div className="mlib-actions">
        <button
          type="button"
          className="mlib-action-btn mlib-action-replace"
          onClick={() => onReplace(asset)}
          title={isHt ? 'Ranplase URL' : 'Replace URL'}
          aria-label={isHt ? 'Ranplase URL' : 'Replace URL'}
        >
          <i className="fas fa-exchange-alt" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mlib-action-btn mlib-action-disable"
          onClick={() => onDisable(asset)}
          title={isHt ? 'Dezaktive' : 'Disable'}
          aria-label={isHt ? 'Dezaktive' : 'Disable'}
        >
          <i className={`fas ${asset.is_active ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mlib-action-btn mlib-action-archive"
          onClick={() => onArchive(asset)}
          title={isHt ? 'Achive' : 'Archive'}
          aria-label={isHt ? 'Achive' : 'Archive'}
        >
          <i className="fas fa-archive" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mlib-action-btn mlib-action-delete"
          onClick={() => onDelete(asset)}
          title={isHt ? 'Efase referans' : 'Delete Reference'}
          aria-label={isHt ? 'Efase referans' : 'Delete Reference'}
        >
          <i className="fas fa-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ─── Confirmation Dialog ─────────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, lang, variant }) {
  const isHt = lang === 'ht';
  if (!open) return null;
  return (
    <div className="mlib-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="mlib-modal-card mlib-confirm-card" role="dialog" aria-label={title}>
        <div className="mlib-modal-header">
          <h3 className="mlib-modal-title">
            <i className={`fas ${variant === 'danger' ? 'fa-exclamation-triangle' : 'fa-question-circle'}`} aria-hidden="true" style={{ color: variant === 'danger' ? 'var(--state-error, #ef4444)' : 'var(--studio-pink)' }} />
            {title}
          </h3>
        </div>
        <div className="mlib-modal-body">
          <p className="mlib-modal-desc">{message}</p>
        </div>
        <div className="mlib-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel || (isHt ? 'Anile' : 'Cancel')}
          </button>
          <button
            type="button"
            className={`mlib-btn-${variant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel || (isHt ? 'Konfime' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Replace URL Modal ──────────────────────────────────────────────────────

function ReplaceUrlModal({ asset, onClose, onSave, lang }) {
  const isHt = lang === 'ht';
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const handleValidate = async () => {
    if (!newUrl.trim()) {
      setError(isHt ? 'Antre yon URL' : 'Enter a URL');
      return;
    }
    setLoading(true);
    setError('');
    setValidationResult(null);
    try {
      const res = await mediaProviderService.validateUrl(newUrl.trim());
      if (res.data?.is_valid) {
        setValidationResult(res.data);
      } else {
        setError(res.data?.error_message || (isHt ? 'URL pa valid' : 'Invalid URL'));
      }
    } catch (err) {
      setError(err.response?.data?.error || (isHt ? 'Erè validasyon' : 'Validation error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validationResult?.is_valid) return;
    setLoading(true);
    try {
      await mediaProviderService.smartReplace(asset.id, newUrl.trim());
      onSave(newUrl.trim());
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (isHt ? 'Erè nan sove' : 'Save error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mlib-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mlib-modal-card" role="dialog" aria-label={isHt ? 'Ranplase URL' : 'Replace URL'}>
        <div className="mlib-modal-header">
          <h3 className="mlib-modal-title">
            <i className="fas fa-exchange-alt" aria-hidden="true" />
            {isHt ? 'Ranplase URL' : 'Smart Replace'}
          </h3>
          <button type="button" className="mlib-modal-close" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="mlib-modal-body">
          <p className="mlib-modal-desc">
            {isHt
              ? 'Antre yon nouvo URL pou ranplase ansyen an. Tout referans yo pral mete ajou otomatikman.'
              : 'Enter a new URL to replace the old one. All references will be updated automatically.'}
          </p>
          <div className="mlib-modal-url-display">
            <span className="mlib-modal-url-label">{isHt ? 'Ansyen URL' : 'Old URL'}</span>
            <code className="mlib-modal-url-old">{asset?.url || '—'}</code>
          </div>
          <div className="mlib-modal-field">
            <label className="mlib-modal-field-label" htmlFor="mlib-new-url">
              {isHt ? 'Nouvo URL' : 'New URL'}
            </label>
            <input
              id="mlib-new-url"
              type="url"
              className="field-input"
              placeholder="https://..."
              value={newUrl}
              onChange={(e) => { setNewUrl(e.target.value); setError(''); setValidationResult(null); }}
            />
          </div>
          {validationResult?.is_valid && (
            <div className="mlib-modal-success">
              <i className="fas fa-check-circle" aria-hidden="true" />
              {isHt ? 'URL la valid!' : 'URL is valid!'}
            </div>
          )}
          {error && (
            <div className="mlib-modal-error">
              <i className="fas fa-exclamation-circle" aria-hidden="true" />
              {error}
            </div>
          )}
        </div>
        <div className="mlib-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {isHt ? 'Anile' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleValidate}
            disabled={loading || !newUrl.trim()}
          >
            {loading && !validationResult
              ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap valide...' : 'Validating...'}</>
              : <><i className="fas fa-search" /> {isHt ? 'Valide' : 'Validate'}</>
            }
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={loading || !validationResult?.is_valid}
          >
            {loading && validationResult
              ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap sove...' : 'Saving...'}</>
              : <><i className="fas fa-save" /> {isHt ? 'Ranplase' : 'Replace & Update'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyLibrary({ lang, onAddMedia }) {
  const isHt = lang === 'ht';
  return (
    <div className="mlib-empty">
      <i className="fas fa-photo-video" aria-hidden="true" />
      <h3>{isHt ? 'Pa gen medya' : 'No media assets'}</h3>
      <p>{isHt ? 'Konekte yon provider epi ajoute URL medya ou yo.' : 'Connect a provider and add your media URLs.'}</p>
      <button type="button" className="btn-primary" onClick={onAddMedia}>
        <i className="fas fa-plus" aria-hidden="true" />
        {isHt ? 'Ajoute Medya' : 'Add Media'}
      </button>
    </div>
  );
}

// ─── Main MediaLibrary Component ────────────────────────────────────────────

export default function MediaLibrary({ lang = 'ht', showToast, user }) {
  const isHt = lang === 'ht';

  // State
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterHealth, setFilterHealth] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceAsset, setReplaceAsset] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // asset to delete

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mediaProviderService.userMedia();
      const data = res.data?.results || res.data || [];
      setAssets(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast?.(isHt ? 'Pa kapab chaje medya yo' : 'Failed to load media', 'exclamation-triangle');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [showToast, isHt]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // Filter assets
  const filtered = assets.filter((a) => {
    if (filterType !== 'all') {
      const mt = a.media_type || a.mime_type?.split('/')[0] || '';
      if (mt !== filterType) return false;
    }
    if (filterHealth !== 'all' && a.health_status !== filterHealth) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const url = (a.url || '').toLowerCase();
      const title = (a.title || '').toLowerCase();
      const name = (a.provider_name || a.detected_provider || '').toLowerCase();
      if (!url.includes(q) && !title.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  const handleRename = useCallback((id, title) => {
    setAssets((prev) =>
      prev.map((a) => a.id === id ? { ...a, title } : a)
    );
  }, []);

  // Actions
  const handleReplace = useCallback((asset) => {
    setReplaceAsset(asset);
  }, []);

  const handleReplaceSave = useCallback((newUrl) => {
    setAssets((prev) =>
      prev.map((a) => a.id === replaceAsset?.id ? { ...a, url: newUrl, health_status: 'checking' } : a)
    );
    showToast?.(isHt ? 'URL ranplase ak siksè!' : 'URL replaced successfully!', 'check-circle');
  }, [replaceAsset, showToast, isHt]);

  const handleDisable = useCallback(async (asset) => {
    try {
      await mediaProviderService.toggleMedia(asset.id);
      setAssets((prev) =>
        prev.map((a) => a.id === asset.id ? { ...a, is_active: !a.is_active } : a)
      );
      showToast?.(isHt ? 'Medya dekonekte' : 'Media toggled', 'check');
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    }
  }, [showToast, isHt]);

  const handleArchive = useCallback(async (asset) => {
    try {
      await mediaProviderService.archiveMedia(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      showToast?.(isHt ? 'Medya achive' : 'Media archived', 'archive');
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    }
  }, [showToast, isHt]);

  const handleDelete = useCallback(async (asset) => {
    setConfirmDelete(asset);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await mediaProviderService.deleteMedia(confirmDelete.id);
      setAssets((prev) => prev.filter((a) => a.id !== confirmDelete.id));
      showToast?.(isHt ? 'Referans efase' : 'Reference deleted', 'trash');
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    } finally {
      setConfirmDelete(null);
    }
  }, [confirmDelete, showToast, isHt]);

  // Stats
  const totalCount = assets.length;
  const brokenCount = assets.filter((a) => a.health_status === 'broken' || a.health_status === 'blocked').length;
  const activeCount = assets.filter((a) => a.is_active !== false).length;

  return (
    <div className="mlib-shell">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mlib-header">
        <h2 className="studio-section-title">
          <i className="fas fa-photo-video" aria-hidden="true" />
          {isHt ? 'Bibliyotèk Medya' : 'Media Library'}
        </h2>
        <div className="mlib-header-right">
          <button type="button" className="btn-secondary" onClick={() => setFilterType('all')}>
            <i className="fas fa-sync" />
          </button>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <div className="mlib-stats-bar">
        <div className="mlib-stat">
          <i className="fas fa-database" aria-hidden="true" />
          <span><strong>{totalCount}</strong> {isHt ? 'total' : 'total'}</span>
        </div>
        <div className="mlib-stat">
          <i className="fas fa-check-circle" style={{ color: '#10b981' }} aria-hidden="true" />
          <span><strong>{activeCount}</strong> {isHt ? 'aktif' : 'active'}</span>
        </div>
        {brokenCount > 0 && (
          <div className="mlib-stat mlib-stat-warn">
            <i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }} aria-hidden="true" />
            <span><strong>{brokenCount}</strong> {isHt ? 'kase' : 'broken'}</span>
          </div>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="mlib-filters">
        <div className="mlib-search">
          <i className="fas fa-search" aria-hidden="true" />
          <input
            type="text"
            className="mlib-search-input"
            placeholder={isHt ? 'Chèche pa URL oswa provider...' : 'Search by URL or provider...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mlib-filter-group">
          <select
            className="mlib-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">{isHt ? 'Tout kalite' : 'All Types'}</option>
            <option value="image">{isHt ? 'Imaj' : 'Images'}</option>
            <option value="video">{isHt ? 'Videyo' : 'Videos'}</option>
            <option value="audio">{isHt ? 'Odyo' : 'Audio'}</option>
            <option value="document">{isHt ? 'Dokiman' : 'Documents'}</option>
          </select>
          <select
            className="mlib-filter-select"
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
          >
            <option value="all">{isHt ? 'Tout sante' : 'All Health'}</option>
            <option value="healthy">{isHt ? 'An sante' : 'Healthy'}</option>
            <option value="warning">{isHt ? 'Avètisman' : 'Warning'}</option>
            <option value="broken">{isHt ? 'Kase' : 'Broken'}</option>
            <option value="blocked">{isHt ? 'Bloke' : 'Blocked'}</option>
            <option value="expired">{isHt ? 'Ekspire' : 'Expired'}</option>
          </select>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <MediaLibrarySkeleton rows={5} />
      ) : assets.length === 0 ? (
        <EmptyLibrary lang={lang} />
      ) : filtered.length === 0 ? (
        <div className="mlib-empty mlib-empty-search">
          <i className="fas fa-search-minus" aria-hidden="true" />
          <p>{isHt ? 'Pa gen medya ki matche rechèch ou' : 'No media matches your search'}</p>
        </div>
      ) : (
        <div className="mlib-list" role="list" aria-label={isHt ? 'Lis medya' : 'Media list'}>
          {filtered.map((asset) => (
            <MediaItemRow
              key={asset.id}
              asset={asset}
              lang={lang}
              onReplace={handleReplace}
              onDisable={handleDisable}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
          <div className="mlib-footer">
            <span className="mlib-footer-text">
              {isHt ? 'Montre' : 'Showing'} {filtered.length} {isHt ? 'sou' : 'of'} {assets.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Replace Modal ────────────────────────────────────────── */}
      {replaceAsset && (
        <ReplaceUrlModal
          asset={replaceAsset}
          onClose={() => setReplaceAsset(null)}
          onSave={handleReplaceSave}
          lang={lang}
        />
      )}

      {/* ── Confirm Delete Modal ──────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={isHt ? 'Efase Referans' : 'Delete Reference'}
        message={isHt
          ? 'Efase referans medya sa a? (pa efase fichye orijinal la)'
          : 'Delete this media reference? (This does NOT delete the original file from your provider.)'
        }
        confirmLabel={isHt ? 'Efase' : 'Delete'}
        cancelLabel={isHt ? 'Anile' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
        lang={lang}
      />
    </div>
  );
}
