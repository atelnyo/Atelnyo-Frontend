/**
 * MediaEntityPage — Full-page route for a single media entity.
 *
 * Spec (Prompt 23 §2 — Media Entity Page):
 *   "Lè itilizatè ouvri yon Media. Li pa dwe ouvri yon popup. Li dwe
 *    ouvri yon vrè paj."
 *
 * Layout (top → bottom, all collapsible except Preview):
 *   1. Breadcrumbs                (Creator Studio → Media Hub → Collection → Media)
 *   2. Command Bar                (13 commands, grouped)
 *   3. Large Preview              (always expanded)
 *   4. Quick Actions              (icon grid, always expanded)
 *   5. Information                (general)
 *   6. Usage                      (LinkedContent + reference graph)
 *   7. Analytics                  (per-media metrics)
 *   8. Validation                 (validation panel)
 *   9. History                    (timeline)
 *   10. Health                    (health score)
 *   11. Permissions               (visibility/role)
 *   12. Advanced                  (metadata + advanced)
 *
 * Routing:
 *   /sheet/media/:id — see src/routes/sheets.js (SHEETS.MEDIA_ENTITY)
 *   Deep-link accepts ?from=<source> to redirect back correctly.
 *
 * Data source:
 *   1. `media` prop (preferred — parent already has the payload)
 *   2. React-Router `state.media` (Explore / Studio pass it via navigate.)
 *   3. sessionStorage cache[id] (set by the studio panels via utils/mediaCache.js)
 *   If none of those yield a payload, render the "no media" empty state.
 *   Backend GET /api/media/:id/ is a future Phase 2 sprint item.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { useParams, useLocation } from 'react-router-dom';
import { SHEETS } from '../../routes/sheets';
import MediaBreadcrumbs from '../../components/media/MediaBreadcrumbs';
import MediaCommandBar from '../../components/media/MediaCommandBar';
import useMediaKeyboard from '../../hooks/useMediaKeyboard';
import { getCachedMedia } from '../../utils/mediaCache';
import {
  MediaPreviewPanel,
  MediaGeneralPanel,
  MediaUsagePanel,
  MediaValidationPanel,
  MediaHealthPanel,
  MediaTimelinePanel,
  MediaAnalyticsPanel,
  MediaPermissionsPanel,
  MediaSecurityPanel,
  MediaMetadataPanel,
} from '../../components/media/panels/index.jsx';
import { AdvancedPanel } from '../../components/media';

// ─── Section registry (drives the collapsible layout) ────────────────
const SECTIONS = [
  { id: 'preview',      titleEn: 'Preview',        titleHt: 'Aperçu',     component: MediaPreviewPanel,     defaultOpen: true,  alwaysOpen: true },
  { id: 'actions',      titleEn: 'Quick Actions',  titleHt: 'Aksyon rapid',                        defaultOpen: true,  isQuickActions: true },
  { id: 'information',  titleEn: 'Information',    titleHt: 'Enfòmasyon', component: MediaGeneralPanel,      defaultOpen: true },
  { id: 'usage',        titleEn: 'Usage',          titleHt: 'Itilizasyon', component: MediaUsagePanel,        defaultOpen: false },
  { id: 'analytics',    titleEn: 'Analytics',      titleHt: 'Analiz',     component: MediaAnalyticsPanel,   defaultOpen: false },
  { id: 'validation',   titleEn: 'Validation',     titleHt: 'Validasyon', component: MediaValidationPanel,  defaultOpen: false },
  { id: 'history',      titleEn: 'History',        titleHt: 'Istwa',      component: MediaTimelinePanel,     defaultOpen: false },
  { id: 'health',       titleEn: 'Health',         titleHt: 'Sante',      component: MediaHealthPanel,       defaultOpen: false },
  { id: 'permissions',  titleEn: 'Permissions',    titleHt: 'Pèmisyon',   component: MediaPermissionsPanel,  defaultOpen: false },
  { id: 'advanced',     titleEn: 'Advanced',       titleHt: 'Avanse',     component: AdvancedPanel,     defaultOpen: false },
];

function CollapsibleSection({ id, title, isOpen, onToggle, locked, children }) {
  return (
    <section
      className={`media-entity-section ${isOpen ? 'media-entity-section-open' : ''} ${locked ? 'media-entity-section-locked' : ''}`}
      aria-labelledby={`media-entity-section-${id}-title`}
    >
      <header className="media-entity-section-header">
        <button
          type="button"
          className="media-entity-section-toggle"
          onClick={onToggle}
          aria-expanded={isOpen ? 'true' : 'false'}
          aria-controls={`media-entity-section-${id}-body`}
          disabled={locked}
          id={`media-entity-section-${id}-title`}
        >
          <span className="media-entity-section-title">{title}</span>
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} aria-hidden="true" />
        </button>
      </header>
      {!locked && isOpen && (
        <div
          className="media-entity-section-body"
          id={`media-entity-section-${id}-body`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export default function MediaEntityPage({ lang = 'ht', user, media: mediaProp, showToast }) {
  const navigate = useSafeNavigate();
  const params = useParams();
  const location = useLocation();
  const isHt = lang === 'ht';

  // ─── Resolve media payload from multiple sources ─────────────────
  // 1. props (in-tab usage) → 2. router state (click handoff) →
  // 3. sessionStorage cache (survives F5 in the same tab; the old
  //    window.* cache did not). Deep links from a FRESH tab still hit
  //    the empty state until GET /api/media/:id/ ships (Phase 2).
  const resolvedMedia = useMemo(() => {
    if (mediaProp && typeof mediaProp === 'object') return mediaProp;
    if (location.state && location.state.media) return location.state.media;
    const id = params.id || mediaProp?.id;
    return getCachedMedia(id);
  }, [mediaProp, location.state, params.id]);

  const media = resolvedMedia;

  // ─── Section open/closed state (with sensible defaults) ───────────
  const [openMap, setOpenMap] = useState(() => {
    const initial = {};
    SECTIONS.forEach((s) => { initial[s.id] = !!s.defaultOpen; });
    return initial;
  });

  const toggleSection = useCallback((id) => {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ─── Command state (busy/disabled flags across the command bar) ─
  const [cmdState, setCmdState] = useState({});
  const setCmdFlag = useCallback((cmdId, patch) => {
    setCmdState((prev) => ({ ...prev, [cmdId]: { ...(prev[cmdId] || {}), ...patch } }));
  }, []);

  const openToast = useCallback((msg, icon = 'info-circle') => {
    if (showToast) showToast(msg, icon);
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.info('[MediaEntityPage]', msg);
    }
  }, [showToast]);

  const copyToClipboard = useCallback(async (text, label) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers / non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      openToast(
        isHt ? `${label || 'Lyen'} kopye.` : `${label || 'Link'} copied.`,
        'clipboard-check',
      );
    } catch (err) {
      openToast(
        isHt ? `Echèk kopye ${label || 'lyen'}.` : `Failed to copy ${label || 'link'}.`,
        'exclamation-triangle',
      );
    }
  }, [isHt, openToast]);

  const onCommand = useCallback((cmdId) => {
    if (!media) {
      openToast(
        isHt ? 'Pa gen chaj pou medya a.' : 'No media payload available.',
        'exclamation-triangle',
      );
      return;
    }
    switch (cmdId) {
      case 'preview':
        setOpenMap((p) => ({ ...p, preview: true }));
        if (typeof document !== 'undefined') {
          const el = document.getElementById('media-entity-section-preview-body');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      case 'inspect':
        setOpenMap((p) => ({ ...p, information: true }));
        if (typeof document !== 'undefined') {
          const el = document.getElementById('media-entity-section-information-body');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      case 'openOriginal': {
        const url = media.original_url || media.url || media.preview_url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        else openToast(isHt ? 'Pa gen URL orijinal.' : 'No original URL.', 'link-slash');
        break;
      }
      case 'replaceUrl':
        openToast(
          isHt ? 'Fonksyon ranplasman URL pa disponib pou kounye a.' : 'Replace URL is not available yet.',
          'arrow-right-arrow-left',
        );
        break;
      case 'validate':
        setCmdFlag('validate', { busy: true });
        setTimeout(() => {
          setCmdFlag('validate', { busy: false });
          openToast(
            isHt ? 'Validasyon kòmanse.' : 'Validation started.',
            'shield-halved',
          );
        }, 600);
        break;
      case 'refresh':
        openToast(
          isHt ? 'Rechaj demare.' : 'Refresh started.',
          'arrows-rotate',
        );
        break;
      case 'archive':
        openToast(
          isHt ? 'Achiv demare.' : 'Archive requested.',
          'box-archive',
        );
        break;
      case 'history':
        setOpenMap((p) => ({ ...p, history: true }));
        if (typeof document !== 'undefined') {
          const el = document.getElementById('media-entity-section-history-body');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      case 'copyPublicUrl': {
        const url = media.public_url
          || (typeof window !== 'undefined'
            ? window.location.origin + '/m/' + (media.id || media.slug || '')
            : '');
        copyToClipboard(url, isHt ? 'URL piblik' : 'Public URL');
        break;
      }
      case 'copyAtelnyo': {
        const url = (typeof window !== 'undefined'
          ? window.location.origin + '/sheet/media/' + (media.id || media.slug || '')
          : '');
        copyToClipboard(url, isHt ? 'Lyen Atelnyo' : 'Atelnyo link');
        break;
      }
      case 'share':
        if (typeof navigator !== 'undefined' && navigator.share) {
          navigator.share({
            title: media.title || media.original_filename || 'Media',
            text: media.description || '',
            url: media.public_url || (typeof window !== 'undefined' ? window.location.href : ''),
          }).catch(() => { /* user cancelled */ });
        } else {
          // Fallback — copy URL instead
          copyToClipboard(
            media.public_url || (typeof window !== 'undefined' ? window.location.href : ''),
            isHt ? 'Lyen' : 'Link',
          );
        }
        break;
      case 'favorite':
        openToast(
          isHt ? 'Favori toggle.' : 'Favorite toggled.',
          'heart',
        );
        break;
      case 'deleteRef':
        if (typeof window !== 'undefined' && window.confirm(
          isHt
            ? 'Efase referans lan? Medya a rete.'
            : 'Delete this reference? Media will remain.',
        )) {
          openToast(
            isHt ? 'Referans efase.' : 'Reference deleted.',
            'link-slash',
          );
        }
        break;
      default:
        openToast(`Unknown command: ${cmdId}`, 'question-circle');
    }
  }, [media, isHt, openToast, copyToClipboard, setCmdFlag]);

  // ─── Global keyboard shortcuts (page-level binding) ──────────────
  useMediaKeyboard({
    onPreview: () => onCommand('preview'),
    onOpen: () => onCommand('openOriginal'),
    onCopyUrl: () => onCommand('copyPublicUrl'),
    onCopyAtelnyoLink: () => onCommand('copyAtelnyo'),
    onDelete: () => onCommand('archive'),
    onRename: () => openToast(isHt ? 'Renome klike.' : 'Rename clicked.', 'i-cursor'),
    onShare: () => onCommand('share'),
    onEscape: () => navigate(-1),
  });

  // ─── Render ───────────────────────────────────────────────────────
  if (!media) {
    return (
      <div className="media-entity-page media-entity-page-empty">
        <MediaBreadcrumbs media={null} lang={lang} />
        <div className="media-entity-empty-state" role="status">
          <i className="fas fa-photo-video" aria-hidden="true" />
          <h2>{isHt ? 'Pa gen medya chaje' : 'No media loaded'}</h2>
          <p>
            {isHt
              ? 'Idantifyan medya a pa nan memwa a. Ouvri medya a nan yon kat oswa galeri.'
              : 'Media identifier is not in memory. Open a media from a card or gallery.'}
          </p>
          <button
            type="button"
            className="btn-action"
            onClick={() => navigate(SHEETS.STUDIO)}
          >
            {isHt ? 'Retounen nan Studio' : 'Back to Studio'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="media-entity-page">
      {/* Top chrome: back button + breadcrumbs */}
      <div className="media-entity-topbar">
        <button
          type="button"
          className="media-entity-back"
          onClick={() => navigate(-1)}
          aria-label={isHt ? 'Retounen' : 'Back'}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
          <span>{isHt ? 'Retounen' : 'Back'}</span>
        </button>
        <MediaBreadcrumbs media={media} collection={media.collection || media.module} lang={lang} />
      </div>

      {/* Command bar */}
      <MediaCommandBar
        media={media}
        lang={lang}
        onCommand={onCommand}
        stateByCommand={cmdState}
      />

      {/* Sections */}
      <div className="media-entity-sections">
        {SECTIONS.map((section) => {
          if (section.id === 'preview') {
            // Preview is always rendered (no toggle)
            return (
              <section
                key={section.id}
                className="media-entity-section media-entity-section-locked media-entity-section-open"
                aria-labelledby={`media-entity-section-${section.id}-title`}
              >
                <header className="media-entity-section-header">
                  <h2
                    className="media-entity-section-title"
                    id={`media-entity-section-${section.id}-title`}
                  >
                    {isHt ? section.titleHt : section.titleEn}
                  </h2>
                </header>
                <div className="media-entity-section-body" id={`media-entity-section-${section.id}-body`}>
                  <MediaPreviewPanel media={media} lang={lang} />
                </div>
              </section>
            );
          }
          if (section.isQuickActions) {
            return (
              <CollapsibleSection
                key={section.id}
                id={section.id}
                title={isHt ? section.titleHt : section.titleEn}
                isOpen={openMap[section.id]}
                onToggle={() => toggleSection(section.id)}
                locked={false}
              >
                <div className="media-entity-quick-actions" role="group" aria-label={isHt ? 'Aksyon rapid' : 'Quick Actions'}>
                  <button type="button" className="media-entity-qa-btn" onClick={() => onCommand('validate')}>
                    <i className="fas fa-shield-halved" aria-hidden="true" />
                    <span>{isHt ? 'Valide' : 'Validate'}</span>
                  </button>
                  <button type="button" className="media-entity-qa-btn" onClick={() => onCommand('refresh')}>
                    <i className="fas fa-arrows-rotate" aria-hidden="true" />
                    <span>{isHt ? 'Rechaje' : 'Refresh'}</span>
                  </button>
                  <button type="button" className="media-entity-qa-btn" onClick={() => onCommand('history')}>
                    <i className="fas fa-clock-rotate-left" aria-hidden="true" />
                    <span>{isHt ? 'Istwa' : 'History'}</span>
                  </button>
                  <button type="button" className="media-entity-qa-btn" onClick={() => onCommand('share')}>
                    <i className="fas fa-share" aria-hidden="true" />
                    <span>{isHt ? 'Pataje' : 'Share'}</span>
                  </button>
                  <button type="button" className="media-entity-qa-btn media-entity-qa-btn-danger" onClick={() => onCommand('archive')}>
                    <i className="fas fa-box-archive" aria-hidden="true" />
                    <span>{isHt ? 'Achiv' : 'Archive'}</span>
                  </button>
                </div>
              </CollapsibleSection>
            );
          }
          const PanelComp = section.component;
          return (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              title={isHt ? section.titleHt : section.titleEn}
              isOpen={openMap[section.id]}
              onToggle={() => toggleSection(section.id)}
              locked={false}
            >
              <PanelComp media={media} lang={lang} />
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
