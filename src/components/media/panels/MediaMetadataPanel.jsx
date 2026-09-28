/**
 * MediaMetadataPanel — Full Object metadata tab content (Slice 0 retro).
 *
 * Maps the 30+ spec fields from Phase 2 (Unique ID, Owner, Creator,
 * Organization, Module, Collection, Provider, Original URL, Normalized
 * URL, Thumbnail, Preview, Media Type, Mime Type, Extension,
 * Dimensions, Duration, Language, Accessibility, Visibility,
 * Permissions, Status, Health, Usage Count, Reference Count,
 * Created/Updated/Published/Archived/Deleted, Last Validation,
 * Last Viewed, Last Used, Analytics, Audit History) with honest
 * labels. Fields not yet supported by the backend show "—" rather
 * than fake values.
 */
import React from 'react';

const FIELDS = [
  { key: 'id', labelEn: 'Unique ID', labelHt: 'ID Inik', mono: true },
  { key: 'owner_username', labelEn: 'Owner', labelHt: 'Pwopriyetè' },
  { key: 'creator_username', labelEn: 'Creator', labelHt: 'Kreyatè' },
  { key: 'organization', labelEn: 'Organization', labelHt: 'Òganizasyon', future: true },
  { key: 'module', labelEn: 'Module', labelHt: 'Modil' },
  { key: 'collection', labelEn: 'Collection', labelHt: 'Koleksyon' },
  { key: 'provider', labelEn: 'Provider', labelHt: 'Provider' },
  { key: 'original_url', labelEn: 'Original URL', labelHt: 'URL Orijinal', mono: true, derive: (m) => m.original_url || m.media_url || m.public_url },
  { key: 'normalized_url', labelEn: 'Normalized URL', labelHt: 'URL Normalize', mono: true, derive: (m) => m.normalized_url || m.media_url || m.public_url },
  { key: 'thumbnail_url', labelEn: 'Thumbnail', labelHt: 'Miniatir', mono: true, image: true },
  { key: 'preview_url', labelEn: 'Preview', labelHt: 'Aperçu', mono: true, image: true },
  { key: 'media_type', labelEn: 'Media Type', labelHt: 'Kalite Medya' },
  { key: 'mime_type', labelEn: 'MIME Type', labelHt: 'MIME Type', mono: true },
  { key: 'extension', labelEn: 'Extension', labelHt: 'Ekstansyon', mono: true },
  { key: 'dimensions', labelEn: 'Dimensions', labelHt: 'Dimansyon', derive: (m) => m.width && m.height ? `${m.width}×${m.height}` : null },
  { key: 'duration', labelEn: 'Duration', labelHt: 'Dire' },
  { key: 'language', labelEn: 'Language', labelHt: 'Lang' },
  { key: 'accessibility', labelEn: 'Accessibility', labelHt: 'Aksesibilite' },
  { key: 'visibility', labelEn: 'Visibility', labelHt: 'Vizibilite' },
  { key: 'permissions', labelEn: 'Permissions', labelHt: 'Pèmisyon' },
  { key: 'status', labelEn: 'Status', labelHt: 'Estati' },
  { key: 'health_score', labelEn: 'Health', labelHt: 'Sante', derive: (m) => m.health_score != null ? `${m.health_score}%` : null },
  { key: 'usage_count', labelEn: 'Usage Count', labelHt: 'Kantite Itilizasyon' },
  { key: 'reference_count', labelEn: 'Reference Count', labelHt: 'Kantite Referans' },
  { key: 'created_at', labelEn: 'Created At', labelHt: 'Dat Kreye', datetime: true },
  { key: 'updated_at', labelEn: 'Updated At', labelHt: 'Dat Mete ajou', datetime: true },
  { key: 'published_at', labelEn: 'Published At', labelHt: 'Pibliye', datetime: true },
  { key: 'archived_at', labelEn: 'Archived At', labelHt: 'Achivaj', datetime: true },
  { key: 'deleted_at', labelEn: 'Deleted At', labelHt: 'Siprime', datetime: true },
  { key: 'last_validation', labelEn: 'Last Validation', labelHt: 'Dènye Validasyon', datetime: true, derive: (m) => m.last_checked || m.last_validation },
  { key: 'last_viewed', labelEn: 'Last Viewed', labelHt: 'Dènye Konsilte', datetime: true },
  { key: 'last_used', labelEn: 'Last Used', labelHt: 'Dènye Itilize', datetime: true },
  { key: 'analytics', labelEn: 'Analytics', labelHt: 'Analitik', derive: (m) => m.analytics || (m.view_count != null ? `${m.view_count} views` : null) },
  { key: 'audit_history', labelEn: 'Audit History', labelHt: 'Istwa Odit', derive: (m) => Array.isArray(m.audit_log) ? `${m.audit_log.length} events` : null },
];

export default function MediaMetadataPanel({ media, lang = 'ht', className = '' }) {
  const item = media || {};
  const isHt = lang === 'ht';

  const isFuture = (f) => Boolean(f.future);

  return (
    <div className={`media-panel media-panel-metadata ${className}`}>
      <p className="media-panel-intro">
        {isHt
          ? 'Tout metadata ki egziste sou medya sa a. Jaden ki pa egziste ankò montre sa yo pa disponib.'
          : 'All existing metadata for this media. Fields not yet supported show as unavailable.'}
      </p>
      <dl className="media-panel-meta-grid">
        {FIELDS.map((f) => {
          const value = f.derive ? f.derive(item) : item[f.key];
          const display = value != null && value !== '' ? String(value) : '—';
          return (
            <div
              key={f.key}
              className={`media-panel-meta-row ${display === '—' ? 'media-panel-meta-empty' : ''} ${isFuture(f) ? 'media-panel-meta-future' : ''}`}
            >
              <dt title={isHt ? f.labelHt : f.labelEn}>
                {isHt ? f.labelHt : f.labelEn}
                {isFuture(f) && <span className="media-panel-meta-future-tag">future</span>}
              </dt>
              <dd>
                {f.image && display !== '—' ? (
                  <img src={display} alt="" loading="lazy" className="media-panel-meta-thumb" />
                ) : f.datetime && display !== '—' ? (
                  <time dateTime={String(value)}>{new Date(String(value)).toLocaleString()}</time>
                ) : (
                  <span className={f.mono ? 'media-panel-meta-mono' : undefined}>{display}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
