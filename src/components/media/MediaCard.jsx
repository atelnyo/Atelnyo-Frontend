/**
 * MediaCard — Enterprise Media Card (Prompt 23).
 *
 * Shows (per the Atelnyo Media Platform spec):
 *   • Thumbnail (image / video / audio / doc fallback)
 *   • Media Type Badge       ← new
 *   • Visibility Badge       ← new
 *   • Provider Badge         ← promoted from inline label
 *   • Health Badge           ← existing
 *   • Favorite star          ← new (always visible top-right)
 *   • Status (subtle, derived)
 *   • Last Updated timestamp ← new
 *   • Collection label       ← new
 *
 * On hover (or focus-within) reveals a 7-action hover menu:
 *   Preview · Open · Copy Link · Replace · Inspect · Archive · Delete Reference
 *
 * Legacy `onEdit` is preserved as a prop for backward compatibility but
 * routes into the Inspect slot when `onInspect` is absent, so existing
 * call sites in MediaHub / Creator Studio keep firing.
 *
 * No fake content rule: when image / video is broken we show a useful
 * fallback, not invented data.
 */
import React, { useState, useRef } from 'react';
import MediaSkeleton from './MediaSkeleton';
import MediaBadge from './MediaBadge';
import { mediaProviderService } from '../../services/api';

// ─── Visibility meta ────────────────────────────────────────────────
const VISIBILITY_META = {
  public:     { icon: 'fa-globe',     color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))', borderBg: 'var(--severity-low-bg, rgba(16,185,129,0.19))', labelEn: 'Public',     labelHt: 'Piblik' },
  followers:  { icon: 'fa-users',     color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.08))', borderBg: 'var(--state-info-bg, rgba(56,189,248,0.19))', labelEn: 'Followers',  labelHt: 'Abonnen' },
  students:   { icon: 'fa-graduation-cap', color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))', borderBg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.19))', labelEn: 'Students', labelHt: 'Elèv' },
  customers:  { icon: 'fa-shopping-bag', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))', borderBg: 'var(--severity-medium-bg, rgba(245,158,11,0.19))', labelEn: 'Customers', labelHt: 'Kliyan' },
  community:  { icon: 'fa-comments',  color: 'var(--pr-color-pink-500, #ec4899)', bg: 'rgba(236,72,153,0.08)', borderBg: 'rgba(236,72,153,0.19)', labelEn: 'Community',  labelHt: 'Kominote' },
  purchased:  { icon: 'fa-receipt',   color: 'var(--pr-color-teal-500, #14b8a6)', bg: 'rgba(20,184,166,0.08)', borderBg: 'rgba(20,184,166,0.19)', labelEn: 'Purchased',  labelHt: 'Achte' },
  private:    { icon: 'fa-lock',      color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))', borderBg: 'var(--state-neutral-bg, rgba(100,116,139,0.19))', labelEn: 'Private',    labelHt: 'Prive' },
  unlisted:   { icon: 'fa-eye-slash', color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.08))', borderBg: 'var(--state-neutral-bg, rgba(148,163,184,0.19))', labelEn: 'Unlisted',   labelHt: 'Rezève' },
};

const TYPE_META = {
  image:    { icon: 'fa-image',  color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))', borderBg: 'var(--severity-low-bg, rgba(16,185,129,0.19))', labelEn: 'Image',    labelHt: 'Imaj' },
  video:    { icon: 'fa-video',  color: 'var(--pr-color-blue-500, #3b82f6)', bg: 'rgba(59,130,246,0.08)', borderBg: 'rgba(59,130,246,0.19)', labelEn: 'Video',    labelHt: 'Videyo' },
  audio:    { icon: 'fa-music',  color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))', borderBg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.19))', labelEn: 'Audio',    labelHt: 'Odyo' },
  document: { icon: 'fa-file-alt', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))', borderBg: 'var(--severity-medium-bg, rgba(245,158,11,0.19))', labelEn: 'Document', labelHt: 'Dokiman' },
};

// ─── Helpers ────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function InlineBadge({ icon, label, color = 'var(--text-secondary, #64748b)', bg }) {
  if (!label) return null;
  const bgColor = bg || 'var(--state-neutral-bg, rgba(100,116,139,0.08))';
  const borderColor = bg || 'var(--state-neutral-bg, rgba(100,116,139,0.19))';
  return (
    <span
      className="media-card-inline-badge"
      style={{
        color,
        background: bgColor,
        borderColor: borderColor,
      }}
      title={label}
    >
      <i className={`fas ${icon}`} aria-hidden="true" />
      <span className="media-card-inline-badge-label">{label}</span>
    </span>
  );
}

export default function MediaCard({
  media,
  mediaId,
  mediaData,
  className = '',
  size = 'medium',
  showBadge = true,
  showActions = true,
  onClick,
  onFavoriteToggle,
  onPreview,
  onOpen,
  onCopy,
  onReplace,
  onArchive,
  onDeleteReference,
  onInspect,
  onEdit,            // legacy; routes into Inspect slot if onInspect absent
  onDelete,          // legacy; routes into Delete Reference slot
  onRename,          // callback for parent state sync after quick rename
  lang = 'ht',
}) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef(null);
  const isHt = lang === 'ht';

  if (!media && !mediaData && !mediaId) {
    return <MediaSkeleton variant="card" />;
  }

  const item = media || mediaData || {};
  const mediaType = item.media_type || item.kind || '';
  const status = item.health_status || item.status || 'unknown';
  const provider = item.provider_name || item.provider || '';
  const title = item.title || item.name || item.url || '';
  const thumbnail = item.thumbnail_url || item.preview_url || '';
  const mediaUrl = item.media_url || item.public_url || item.url || '';
  const duration = item.duration;
  const visibility = item.visibility || 'public';
  const isFavorite = Boolean(item.is_favorite || item.favorite);
  const collection = item.collection || item.collection_name || '';
  const referenceCount = item.reference_count ?? item.usage_count ?? 0;
  const updatedAt = item.updated_at || item.last_modified || item.created_at;

  const visMeta = VISIBILITY_META[visibility] || VISIBILITY_META.public;
  const typeMeta = TYPE_META[mediaType] || { icon: 'fa-file', color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.08))', borderBg: 'var(--state-neutral-bg, rgba(148,163,184,0.19))', labelEn: mediaType || 'Unknown', labelHt: mediaType || 'Enkoni' };

  const formattedDuration = duration
    ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
    : null;

  const handleCopy = (e) => {
    if (e) e.stopPropagation();
    if (!mediaUrl) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(mediaUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => { /* clipboard blocked: silent */ });
    }
    onCopy?.(item);
  };

  // ─── Quick Rename ───────────────────────────────────────────────
  const handleStartEdit = (e) => {
    e.stopPropagation();
    setEditTitle(title || '');
    setEditing(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleSaveRename = async () => {
    const trimmed = editTitle.trim().slice(0, 256);
    if (!trimmed || trimmed === (title || '')) { setEditing(false); return; }
    setSaving(true);
    try {
      const id = item.id || item.media_id;
      if (id) {
        await mediaProviderService.renameMedia(id, trimmed);
        onRename?.(id, trimmed);
      }
      setEditing(false);
    } catch {
      // keep editing on error
    } finally {
      setSaving(false);
    }
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveRename();
    if (e.key === 'Escape') setEditing(false);
    e.stopPropagation();
  };



  const handleFavorite = (e) => {
    e.stopPropagation();
    onFavoriteToggle?.(item, !isFavorite);
  };

  // Legacy onEdit fallback: route the Inspect slot to onEdit when onInspect
  // is absent so existing MediaHub / Creator Studio callers keep firing.
  const inspectHandler = onInspect || onEdit;

  // Hover menu items — exactly 7 per spec, no 8th legacy button.
  const hoverActions = [
    { key: 'preview',  icon: 'fa-eye',              en: 'Preview',         ht: 'Aperçu',         onClick: (e) => { e.stopPropagation(); onPreview?.(item); } },
    { key: 'open',     icon: 'fa-external-link-alt', en: 'Open',           ht: 'Louvri',         onClick: (e) => { e.stopPropagation(); onOpen?.(item, mediaUrl); }, disabled: !mediaUrl },
    { key: 'copy',     icon: copied ? 'fa-check' : 'fa-copy', en: copied ? 'Copied!' : 'Copy Link', ht: copied ? 'Kopye!' : 'Kopi URL', onClick: handleCopy, disabled: !mediaUrl },
    { key: 'replace',  icon: 'fa-exchange-alt',     en: 'Replace',         ht: 'Ranplase',       onClick: (e) => { e.stopPropagation(); onReplace?.(item); } },
    { key: 'inspect',  icon: 'fa-search-plus',      en: 'Inspect',         ht: 'Enspekte',       onClick: (e) => { e.stopPropagation(); inspectHandler?.(item); } },
    { key: 'archive',  icon: 'fa-archive',          en: 'Archive',         ht: 'Achive',         onClick: (e) => { e.stopPropagation(); onArchive?.(item); } },
    { key: 'delete',   icon: 'fa-unlink',           en: 'Delete Reference', ht: 'Efase Referans', onClick: (e) => { e.stopPropagation(); (onDeleteReference || onDelete)?.(item); }, danger: true },
  ];

  return (
    <div
      className={`media-card media-card--${size} ${className}`}
      data-media-type={mediaType || 'unknown'}
      data-status={status}
      data-favorite={isFavorite ? 'true' : 'false'}
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Thumbnail */}
      <div className="media-card-thumb">
        {mediaType === 'image' ? (
          imageError ? (
            <div className="media-card-thumb-fallback">
              <i className="fas fa-image" aria-hidden="true" />
              <span className="media-card-thumb-fallback-text">
                {isHt ? 'Imaj kase' : 'Image broken'}
              </span>
            </div>
          ) : (
            <img
              src={thumbnail || mediaUrl}
              alt={title || 'Media'}
              className="media-card-img"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          )
        ) : mediaType === 'video' ? (
          <div className="media-card-video-overlay">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title || 'Video'}
                className="media-card-img"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="media-card-thumb-fallback">
                <i className="fas fa-video" aria-hidden="true" />
                <span className="media-card-thumb-fallback-text">
                  {isHt ? 'Pa gen thumbnail' : 'No thumbnail'}
                </span>
              </div>
            )}
            <div className="media-card-play-btn">
              <i className="fas fa-play" aria-hidden="true" />
            </div>
            {formattedDuration && (
              <span className="media-card-duration">{formattedDuration}</span>
            )}
          </div>
        ) : mediaType === 'audio' ? (
          <div className="media-card-thumb-fallback media-card-audio-bg">
            <i className="fas fa-music" aria-hidden="true" />
            {formattedDuration && (
              <span className="media-card-duration">{formattedDuration}</span>
            )}
          </div>
        ) : (
          <div className="media-card-thumb-fallback">
            <i className="fas fa-file-alt" aria-hidden="true" />
          </div>
        )}

        <div className="media-card-top-right">
          {showBadge && <MediaBadge status={status} lang={lang} />}
          <button
            type="button"
            className={`media-card-favorite ${isFavorite ? 'media-card-favorite-active' : ''}`}
            onClick={handleFavorite}
            title={isFavorite ? (isHt ? 'Retire nan favori' : 'Remove from favorites') : (isHt ? 'Ajoute nan favori' : 'Add to favorites')}
            aria-label={isFavorite ? (isHt ? 'Retire nan favori' : 'Remove from favorites') : (isHt ? 'Ajoute nan favori' : 'Add to favorites')}
            aria-pressed={isFavorite}
          >
            <i className={`${isFavorite ? 'fas' : 'far'} fa-star`} aria-hidden="true" />
          </button>
        </div>

        {showActions && (
          <div className="media-card-hover-actions" role="toolbar" aria-label={isHt ? 'Aksyon medya' : 'Media actions'}>
            {hoverActions.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`media-card-hover-action ${a.danger ? 'media-card-hover-action-danger' : ''}`}
                onClick={a.onClick}
                disabled={a.disabled}
                title={isHt ? a.ht : a.en}
                aria-label={isHt ? a.ht : a.en}
              >
                <i className={`fas ${a.icon}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="media-card-badges">
        {mediaType && <InlineBadge icon={typeMeta.icon} label={isHt ? typeMeta.labelHt : typeMeta.labelEn} color={typeMeta.color} bg={typeMeta.bg} />}
        {visibility && <InlineBadge icon={visMeta.icon} label={isHt ? visMeta.labelHt : visMeta.labelEn} color={visMeta.color} bg={visMeta.bg} />}
        {provider && <InlineBadge icon="fa-cloud" label={provider} color="var(--pr-color-sky-500, #0ea5e9)" bg="var(--state-info-bg, rgba(14,165,233,0.08))" />}
        {collection && <InlineBadge icon="fa-folder-open" label={collection} color="var(--pr-color-violet-400, #a78bfa)" bg="var(--pr-color-violet-500-bg, rgba(167,139,250,0.08))" />}
      </div>

      <div className="media-card-info">
        {/* Title — inline editable */}
        {editing ? (
          <div className="media-card-title-edit" onClick={(e) => e.stopPropagation()}>
            <input
              ref={editInputRef}
              type="text"
              className="media-card-title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleSaveRename}
              placeholder={isHt ? 'Non medya...' : 'Media name...'}
              maxLength={256}
            />
            {saving && <i className="fas fa-spinner fa-spin media-card-title-spinner" aria-hidden="true" />}
          </div>
        ) : (
          <div
            className="media-card-title"
            title={isHt ? 'Klike pou renome — ' + title : 'Click to rename — ' + title}
            onClick={handleStartEdit}
          >
            {title.length > 60 ? `${title.slice(0, 60)}…` : title || (isHt ? 'San tit' : 'Untitled')}
            <i className="fas fa-pencil-alt media-card-title-pencil" aria-hidden="true" />
          </div>
        )}
        <div className="media-card-meta">
          {updatedAt && (
            <span className="media-card-meta-item" title={isHt ? 'Dènye mizajou' : 'Last updated'}>
              <i className="fas fa-clock" aria-hidden="true" />
              {fmtDate(updatedAt)}
            </span>
          )}
          {Number(referenceCount) > 0 && (
            <span className="media-card-meta-item" title={isHt ? 'Referans' : 'References'}>
              <i className="fas fa-link" aria-hidden="true" />
              {referenceCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Quick Action Toolbar (always visible) ────────────────── */}
      {showActions && (
        <div className="media-card-quick-toolbar" role="toolbar" aria-label={isHt ? 'Aksyon rapid' : 'Quick actions'}>
          <button
            type="button"
            className={`media-card-quick-btn media-card-quick-rename ${editing ? 'media-card-quick-btn-active' : ''}`}
            onClick={handleStartEdit}
            title={isHt ? 'Renome rapid' : 'Quick Rename'}
            aria-label={isHt ? 'Renome rapid' : 'Quick Rename'}
          >
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-pencil-alt'}`} aria-hidden="true" />
            <span className="media-card-quick-label">{isHt ? 'Renome' : 'Rename'}</span>
          </button>
          <button
            type="button"
            className={`media-card-quick-btn media-card-quick-copy ${copied ? 'media-card-quick-btn-copied' : ''}`}
            onClick={handleCopy}
            disabled={!mediaUrl}
            title={isHt ? 'Kopye URL rapid' : 'Quick Copy URL'}
            aria-label={isHt ? 'Kopye URL rapid' : 'Quick Copy URL'}
          >
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
            <span className="media-card-quick-label">
              {copied ? (isHt ? 'Kopye!' : 'Copied!') : (isHt ? 'Kopi URL' : 'Copy URL')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
