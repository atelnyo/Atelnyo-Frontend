/**
 * MediaInspector — Thin composer after Slice 0 retro.
 *
 * Delegates each tab to an atomic panel from ./panels/. Tab order
 * matches Phase-2 spec entity-page section order:
 *   1. Preview
 *   2. Quick Actions (action footer — see below)
 *   3. Information (General)
 *   4. Usage
 *   5. Analytics
 *   6. Validation
 *   7. History (Timeline)
 *   8. Health
 *   9. Permissions
 *  10. Advanced (Metadata)
 *
 * Quick Actions sit at the bottom in the action footer (Replace,
 * Copy, Open, Archive, Delete) — this matches the spec layout.
 *
 * Public API is preserved so MediaHub / CreatorStudio consumers keep
 * working without code changes.
 */
import React, { useState } from 'react';
import MediaBadge from './MediaBadge';
import MediaHelp from './MediaHelp';
import SmartWarning from './SmartWarning';
import MediaPanel from './panels';

export default function MediaInspector({
  media,
  mediaData,
  onClose,
  onReplace,
  onArchive,
  onDelete,
  lang = 'ht',
}) {
  const item = media || mediaData || {};
  const isHt = lang === 'ht';
  const [activeTab, setActiveTab] = useState('preview');
  const [showDelete, setShowDelete] = useState(false);

  if (!item || !item.id) {
    return (
      <div className="inspector-empty" role="status">
        <i className="fas fa-image" aria-hidden="true" />
        <h3>{isHt ? 'Pa gen medya' : 'No media selected'}</h3>
        <p>{isHt ? 'Chwazi yon medya pou wè detay yo' : 'Select a media item to view details'}</p>
      </div>
    );
  }

  const mediaType = item.media_type || item.kind || 'unknown';
  const status = item.health_status || item.status || 'unknown';
  const url = item.media_url || item.public_url || '';
  const provider = item.provider_name || item.provider || '';
  const healthScore = item.health_score ?? item.score ?? null;
  const usages = Array.isArray(item.usages) ? item.usages : [];
  const timeline = Array.isArray(item.timeline) ? item.timeline : [];

  // Spec ordering: Preview (1) → General (3) → Usage (4) → Analytics (5)
  //   → Validation (6) → Timeline (7) → Health (8) → Permissions (9) → Metadata (10).
  const tabs = [
    { id: 'preview',     icon: 'fa-eye',                  labelEn: 'Preview',     labelHt: 'Aperçu' },
    { id: 'general',     icon: 'fa-info-circle',          labelEn: 'Information', labelHt: 'Enfòmasyon' },
    { id: 'usage',       icon: 'fa-link',                   labelEn: 'Usage',       labelHt: 'Itilizasyon',  badge: usages.length },
    { id: 'analytics',   icon: 'fa-chart-line',            labelEn: 'Analytics',   labelHt: 'Analitik' },
    { id: 'validation',  icon: 'fa-stethoscope',            labelEn: 'Validation',  labelHt: 'Validasyon' },
    { id: 'timeline',    icon: 'fa-history',                 labelEn: 'History',     labelHt: 'Istwa',        badge: timeline.length },
    { id: 'health',      icon: 'fa-heartbeat',               labelEn: 'Health',      labelHt: 'Sante' },
    { id: 'permissions', icon: 'fa-user-shield',              labelEn: 'Permissions', labelHt: 'Pèmisyon' },
    { id: 'security',    icon: 'fa-shield-alt',                labelEn: 'Security',    labelHt: 'Sekirite' },
    { id: 'metadata',    icon: 'fa-tags',                       labelEn: 'Advanced',    labelHt: 'Avanse' },
  ];

  return (
    <div className="inspector-shell">
      <div className="inspector-header">
        <div className="inspector-header-left">
          <MediaBadge status={status} lang={lang} />
          {provider && (
            <span className="inspector-breadcrumb">
              <i className="fas fa-cloud" aria-hidden="true" /> {provider}
            </span>
          )}
          <span className="inspector-breadcrumb">
            <i className={`fas ${mediaType === 'image' ? 'fa-image' : mediaType === 'video' ? 'fa-video' : mediaType === 'audio' ? 'fa-music' : 'fa-file'}`} aria-hidden="true" />
            {mediaType}
          </span>
        </div>
        <div className="inspector-header-right">
          <MediaHelp context="detail" lang={lang} />
          {onClose && (
            <button type="button" className="inspector-close" onClick={onClose} aria-label={isHt ? 'Fèmen' : 'Close'}>
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      </div>

      {healthScore != null && (
        <div className="inspector-health-banner" aria-label={isHt ? 'Nòt sante' : 'Health score'}>
          <div className="inspector-health-bar">
            <div className="inspector-health-fill" style={{ width: `${healthScore}%` }} />
          </div>
          <span className="inspector-health-text">
            {isHt ? 'Sante' : 'Health'}: <strong>{healthScore}%</strong>
          </span>
        </div>
      )}

      <nav className="inspector-tabs" role="tablist" aria-label={isHt ? 'Seksyon enspektè' : 'Inspector sections'}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`inspector-tab ${activeTab === tab.id ? 'inspector-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true" />
            {isHt ? tab.labelHt : tab.labelEn}
            {tab.badge > 0 && <span className="inspector-tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="inspector-body" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        <MediaPanel
          kind={activeTab}
          media={item}
          analytics={item.analytics_payload || null}
          security={item.security_payload || null}
          isAdmin={Boolean(item.is_admin_viewer)}
          lang={lang}
        />
      </div>

      <div className="inspector-actions" aria-label={isHt ? 'Aksyon rapid' : 'Quick actions'}>
        {onReplace && (
          <button type="button" className="btn-secondary" onClick={() => onReplace(item)}>
            <i className="fas fa-exchange-alt" /> {isHt ? 'Ranplase URL' : 'Replace URL'}
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => { if (url && typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {}); }}
        >
          <i className="fas fa-copy" /> {isHt ? 'Kopi URL' : 'Copy URL'}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <i className="fas fa-external-link-alt" /> {isHt ? 'Louvri' : 'Open'}
          </a>
        )}
        {onArchive && (
          <button type="button" className="btn-secondary" onClick={() => onArchive(item)}>
            <i className="fas fa-archive" /> {isHt ? 'Achive' : 'Archive'}
          </button>
        )}
        {onDelete && (
          <button type="button" className="inspector-delete-btn" onClick={() => setShowDelete(true)}>
            <i className="fas fa-trash" /> {isHt ? 'Efase' : 'Delete'}
          </button>
        )}
      </div>

      <SmartWarning
        open={showDelete}
        media={item}
        usages={usages}
        onConfirm={() => { setShowDelete(false); onDelete?.(item); }}
        onCancel={() => { setShowDelete(false); }}
        lang={lang}
      />
    </div>
  );
}
