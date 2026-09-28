/**
 * MyMediaDashboard — Default landing for the Creator Studio Media tab.
 *
 * Spec (Phase CREATOR EXPERIENCE §1 — My Media Home):
 *   "Premye paj Media Hub la dwe tankou Dashboard pèsonèl.
 *    Li montre. Welcome Creator, Media Overview, Continue Working,
 *    Recent Activity, Recently Published, Recently Edited, Draft
 *    Media, Broken Media, Favorite Collections, Quick Upload,
 *    Quick Search, Pinned Media, Learning Center, Provider Status,
 *    Storage Tips, Workflow Progress."
 *
 * Composition (top → bottom):
 *   1. Welcome banner                          ("Welcome back, <name>")
 *   2. MediaPinnedBar                          (horizontal scroll, hidden if empty)
 *   3. QuickUploadRow                          (Quick Upload + Quick Search)
 *   4. DashboardCards: 7-cell grid
 *      (Total, Images, Videos, Audio, Documents, Drafts, Broken)
 *   5. WorkflowProgressCard                    (linear bar)
 *   6. MediaContinueEditingPanel               (Continue Working row)
 *   7. MediaRecentActivityPanel                (timeline)
 *   8. MediaProjectsPanel                      (Project Mode group)
 *   9. FavoriteCollectionsStrip                (horizontal)
 *   10.LearningCenterStrip                     (link → MediaHelp)
 *
 * Backend endpoints (now shipped):
 *   GET /api/media/drafts/count/       → { count: N }
 *   GET /api/media/broken/count/       → { count: N }
 *   GET /api/media/in-progress/        → Array of in-progress media
 *   GET /api/media/activity/           → Activity timeline
 *   GET /api/media/pinned/             → Array of pinned media
 *   POST /api/media/pinned/            → Pin/unpin { media_id, action }
 *
 *   All BackendPendingChips removed from cards backed by shipped endpoints.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { mediaDashboardService } from '../../services/api';
import DashboardCard from './DashboardCard';
import MediaPinnedBar from '../media/MediaPinnedBar';
import QuickUploadRow from './QuickUploadRow';
import FavoriteCollectionsStrip from '../media/FavoriteCollectionsStrip';
import MediaRecentActivityPanel from '../media/MediaRecentActivityPanel';
import MediaContinueEditingPanel from '../media/MediaContinueEditingPanel';
import MediaProjectsPanel from '../media/MediaProjectsPanel';
import MediaDependencyList from '../media/MediaDependencyList';
import MediaDeleteConfirmModal from '../media/MediaDeleteConfirmModal';
import { makeT } from '../../utils/langBackendStub';
import { getUserIdentity } from '../../utils/userIdentity';
import { cacheMedia } from '../../utils/mediaCache';

export default function MyMediaDashboard({
  lang = 'ht',
  user = null,
  mediaList = [],
  collections = [],
  showToast,
  setActiveSection,
}) {
  const t = makeT(lang);
  const navigate = useSafeNavigate();
  const identity = getUserIdentity(user);

  // ─── Fetch real counts from backend ──────────────────────────────
  const [draftsCount, setDraftsCount] = useState(null);
  const [brokenCount, setBrokenCount] = useState(null);
  const [pinnedData, setPinnedData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      mediaDashboardService.draftsCount(),
      mediaDashboardService.brokenCount(),
      mediaDashboardService.pinned(),
    ]).then(([dRes, bRes, pRes]) => {
      if (cancelled) {return;}
      if (dRes.status === 'fulfilled') {setDraftsCount(dRes.value.data?.count ?? 0);}
      if (bRes.status === 'fulfilled') {setBrokenCount(bRes.value.data?.count ?? 0);}
      if (pRes.status === 'fulfilled') {setPinnedData(pRes.value.data);}
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ─── Derived stats (from mediaList fallback + real counts) ───────
  const stats = useMemo(() => {
    const byType = { image: 0, video: 0, audio: 0, document: 0, other: 0 };
    const dr = draftsCount ?? 0;
    const br = brokenCount ?? 0;
    let healthy = 0;
    let total = 0;
    for (const m of (mediaList || [])) {
      total += 1;
      const mt = (m.media_type || m.kind || m.type || '').toLowerCase();
      if (mt in byType) {byType[mt] += 1;} else {byType.other += 1;}
      const health = (m.health || m.health_status || '').toString().toLowerCase();
      if (health === 'healthy' || m.health_score >= 80) {healthy += 1;}
    }
    // Use real backend counts when available; otherwise fall back to derived
    return {
      total,
      byType,
      drafts: draftsCount != null ? draftsCount : dr,
      broken: brokenCount != null ? brokenCount : br,
      healthy,
    };
  }, [mediaList, draftsCount, brokenCount]);

  // ─── Workflow progress ──────────────────────────────────────────
  const workflowPercent = useMemo(() => {
    if (stats.total === 0) {return 0;}
    return Math.round((stats.healthy / stats.total) * 100);
  }, [stats.total, stats.healthy]);

  // ─── Search filter ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Dependency + delete modal state ─────────────────────────────
  const [targetForDelete, setTargetForDelete] = useState(null);

  const handleNavigateMedia = useCallback((m) => {
    cacheMedia(m); // survives F5 in-tab (window cache did not)
    navigate(`/sheet/media/${m.id}`, { state: { media: m } });
  }, [navigate]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const summaryCards = [
    { key: 'total', icon: 'fa-photo-video', title: t('totalMedia'), value: stats.total, tone: 'accent', action: true },
    { key: 'images', icon: 'fa-file-image', title: t('images'), value: stats.byType.image },
    { key: 'videos', icon: 'fa-film', title: t('videos'), value: stats.byType.video },
    { key: 'audio', icon: 'fa-music', title: t('audio'), value: stats.byType.audio },
    { key: 'documents', icon: 'fa-file-lines', title: t('documents'), value: stats.byType.document },
    { key: 'drafts', icon: 'fa-pen', title: t('drafts'), value: stats.drafts, tone: 'warning', action: true },
    { key: 'broken', icon: 'fa-link-slash', title: t('broken'), value: stats.broken, tone: 'danger', action: true },
  ];

  return (
    <div className="my-media-dashboard">
      <section className="my-media-hero" aria-live="polite">
        <div className="my-media-hero-copy">
          <span className="my-media-hero-kicker">{lang === 'en' ? 'Media workspace' : 'Espas travay medya'}</span>
          <h1>
            {t('welcomeCreator')}{identity.displayLabel ? ', ' + identity.displayLabel : ''} 👋
          </h1>
          <p>
            {lang === 'en'
              ? 'Everything pinned, in progress, or recently changed lives here.'
              : 'Tout medya ou make, nan pwogrè, oswa ki chanje resamman, viv la a.'}
          </p>
        </div>
        <div className="my-media-hero-metrics">
          <div className="my-media-hero-metric">
            <span>{t('totalMedia')}</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="my-media-hero-metric">
            <span>{t('workflowProgress')}</span>
            <strong>{workflowPercent}%</strong>
          </div>
        </div>
      </section>

      <section className="my-media-panel my-media-panel--pinned">
        <div className="my-media-panel-header">
          <h2>{lang === 'en' ? 'Pinned media' : 'Medya make'}</h2>
          <button
            type="button"
            className="my-media-panel-action"
            onClick={() => setActiveSection && setActiveSection('media')}
          >
            <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
            <span>{lang === 'en' ? 'Open library' : 'Louvri bibliyotèk'}</span>
          </button>
        </div>
        <MediaPinnedBar
          lang={lang}
          mediaList={pinnedData || []}
          showToast={showToast}
          onOpenAll={() => setActiveSection && setActiveSection('media')}
        />
      </section>

      <section className="my-media-panel my-media-panel--actions">
        <QuickUploadRow
          lang={lang}
          showToast={showToast}
          onSearch={setSearchQuery}
          onSearchClear={clearSearch}
        />
      </section>

      <section className="my-media-panel my-media-panel--summary" aria-label={t('mediaOverview')}>
        <div className="my-media-panel-header">
          <h2>{t('mediaOverview')}</h2>
          <p>{lang === 'en' ? 'Current media health and inventory.' : 'Eta aktyèl medya ak envantè.'}</p>
          <button
            type="button"
            className="my-media-panel-action"
            onClick={clearSearch}
            disabled={!searchQuery}
          >
            <i className="fas fa-broom" aria-hidden="true" />
            <span>{lang === 'en' ? 'Reset filter' : 'Retire filtè'}</span>
          </button>
        </div>
        <div className="dashboard-cards-grid">
          {summaryCards.map((card) => (
            <DashboardCard
              key={card.key}
              icon={card.icon}
              title={card.title}
              value={card.value}
              tone={card.tone}
              onClick={card.action ? () => setActiveSection && setActiveSection('media') : undefined}
            />
          ))}
        </div>
        <div className="my-media-workflow-shell">
          <section className="workflow-progress-card" aria-label={t('workflowProgress')}>
            <header className="workflow-progress-card-header">
              <i className="fas fa-chart-line" aria-hidden="true" />
              <h3>{t('workflowProgress')}</h3>
              <span className="workflow-progress-card-pct">{workflowPercent}%</span>
            </header>
            <div className="workflow-progress-bar" role="progressbar" aria-valuenow={workflowPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="workflow-progress-bar-fill" style={{ width: workflowPercent + '%' }} />
            </div>
            <div className="workflow-progress-card-stats">
              <span>{stats.healthy} {lang === 'en' ? 'healthy' : 'an sante'}</span>
              <span>{stats.broken} {lang === 'en' ? 'broken' : 'kase'}</span>
              <span>{stats.drafts} {lang === 'en' ? 'drafts' : 'bwouyon'}</span>
            </div>
          </section>
        </div>
      </section>

      <section className="my-media-panel my-media-panel--activity">
        <div className="my-media-panel-header">
          <h2>{lang === 'en' ? 'Activity and work' : 'Aktivite ak travay'}</h2>
          <button
            type="button"
            className="my-media-panel-action"
            onClick={() => setActiveSection && setActiveSection('media')}
          >
            <i className="fas fa-layer-group" aria-hidden="true" />
            <span>{lang === 'en' ? 'Open media' : 'Louvri medya'}</span>
          </button>
        </div>
        <MediaContinueEditingPanel
          lang={lang}
          mediaList={mediaList}
          searchFilter={searchQuery}
          showToast={showToast}
          onNavigate={handleNavigateMedia}
          onOpenDrafts={() => setActiveSection && setActiveSection('media')}
        />
        <MediaRecentActivityPanel
          lang={lang}
          mediaList={mediaList}
          onOpenMedia={() => setActiveSection && setActiveSection('media')}
        />
        <MediaProjectsPanel
          lang={lang}
          mediaList={mediaList}
          showToast={showToast}
          onNavigate={handleNavigateMedia}
          onOpenMedia={() => setActiveSection && setActiveSection('media')}
        />
      </section>

      <section className="my-media-panel my-media-panel--collections">
        <div className="my-media-panel-header">
          <h2>{lang === 'en' ? 'Collections' : 'Koleksyon'}</h2>
          <button
            type="button"
            className="my-media-panel-action"
            onClick={() => setActiveSection && setActiveSection('media')}
          >
            <i className="fas fa-folder-tree" aria-hidden="true" />
            <span>{lang === 'en' ? 'Go to media' : 'Ale nan medya'}</span>
          </button>
        </div>
        <FavoriteCollectionsStrip
          lang={lang}
          collections={collections}
          onSelect={(c) => {
            if (setActiveSection) {setActiveSection('media');}
            if (showToast) {showToast(
              lang === 'en'
                ? `Filter by ${c.name || c.title}.`
                : `Filtè pa ${c.name || c.title}.`,
              'folder-tree',
            );}
          }}
        />
      </section>

      <section className="learning-center-strip" aria-label={t('learningCenter')}>
        <i className="fas fa-graduation-cap" aria-hidden="true" />
        <span>{t('learningCenter')}</span>
        <a
          href="/sheet/studio"
          onClick={(e) => {
            e.preventDefault();
            navigate('/sheet/studio');
          }}
        >
          {lang === 'en' ? 'Open' : 'Ouvri'} →
        </a>
      </section>

      {/* 10b. Dependency + delete hooks — invisible until used */}
      {targetForDelete && (
        <div className="my-media-dependency-explainer" aria-live="polite">
          <MediaDependencyList
            lang={lang}
            media={targetForDelete}
            inline
          />
          <p className="my-media-dependency-explainer-actions">
            <button
              type="button"
              className="btn-action btn-action-danger"
              onClick={() => {
                if (!targetForDelete) {return;}
                setTargetForDelete(targetForDelete);
                const evt = new CustomEvent('atelnyo:media-delete:open', {
                  detail: { mediaId: targetForDelete.id },
                });
                window.dispatchEvent(evt);
              }}
            >
              <i className="fas fa-trash" aria-hidden="true" />
              <span>{t('confirmYes')}</span>
            </button>
            <button
              type="button"
              className="btn-action"
              onClick={() => setTargetForDelete(null)}
            >
              {t('confirmNo')}
            </button>
          </p>
        </div>
      )}

      {/* Delete confirm modal mount */}
      <MediaDeleteConfirmModal
        lang={lang}
        mediaList={mediaList}
        showToast={showToast}
        onDeleted={() => {
          setTargetForDelete(null);
          if (showToast) {showToast(
            lang === 'en' ? 'Media deleted.' : 'Medya efase.',
            'trash',
          );}
        }}
      />
    </div>
  );
}
