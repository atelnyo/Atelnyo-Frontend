/**
 * src/components/media/index.js — Media Component Library exports.
 *
 * Phase-2 restructure split:
 *   MediaStatusEngine.jsx  → palette + helpers (data only, no JSX)
 *   MediaStatusBadge.jsx   → render-only component (Phase-2 default)
 *   MediaBadge.jsx         → backward-compat wrapper (Phase-1 callers)
 */

// ─── Player Primitives ─────────────────────────────────────────────────
export { default as ImageViewer } from './ImageViewer';
export { default as VideoPlayer } from './VideoPlayer';
export { default as AudioPlayer } from './AudioPlayer';
export { default as DocumentViewer } from './DocumentViewer';
export { default as StableVideoPlayer, VideoPreview } from './StableVideoPlayer';

// ─── Component Library (Phase 1) ──────────────────────────────────────
export { default as MediaCard } from './MediaCard';
export { default as MediaGrid } from './MediaGrid';
export { default as MediaCarousel } from './MediaCarousel';
export { default as MediaGallery } from './MediaGallery';
export { default as MediaPicker } from './MediaPicker';
export { default as MediaPreview } from './MediaPreview';
export { default as MediaBadge } from './MediaBadge';
export { default as MediaPlaceholder } from './MediaPlaceholder';
export { default as MediaSkeleton } from './MediaSkeleton';
export { default as MediaError } from './MediaError';
export { default as MediaToolbar } from './MediaToolbar';
export { default as MediaInspector } from './MediaInspector';
export { default as MediaAnalyticsDashboard } from './MediaAnalyticsDashboard';
export { default as AdvancedPanel } from './AdvancedPanel';
export { default as MediaSmartNotifications } from './MediaSmartNotifications';
export { default as ContextMenu } from './ContextMenu';
export { default as ActionDrawer } from './ActionDrawer';

// ─── Phase 1 Experience Layer ─────────────────────────────────────────
export { default as MediaList } from './MediaList';
export { default as MediaBulkToolbar } from './MediaBulkToolbar';
export { default as SmartRecommendations } from './SmartRecommendations';
export { default as MediaStatus } from './MediaStatus';
export { default as MediaTimeline } from './MediaTimeline';
export { default as LinkedContent } from './LinkedContent';
export { default as SmartWarning } from './SmartWarning';
export { default as SmartFilters } from './SmartFilters';
export { default as MediaTags } from './MediaTags';
export { default as MediaDetailPanel } from './MediaDetailPanel';
export { default as MediaHelp } from './MediaHelp';
export { default as OfflineMedia } from './OfflineMedia';
export { default as AISuggestion } from './AISuggestion';
export { default as SmartMediaSuggestions } from './SmartMediaSuggestions';
export { default as UniversalContentBuilder } from './UniversalContentBuilder';
export { default as ContentPreview } from './ContentPreview';
export { default as ContentQualityChecker } from './ContentQualityChecker';
export { default as SmartMigrationWizard } from './SmartMigrationWizard';

// ─── Phase 2 — Status Engine + Iconography ────────────────────────────
// Status palette (data only) reads from a single source of truth.
export {
  STATUS_META,
  ALL_STATUSES,
  getStatusMeta,
  isValidStatus,
} from './MediaStatusEngine';

// Render component (replaces the deprecated default-export pattern).
export { default as MediaStatusBadge } from './MediaStatusBadge';

// Icon vocabulary restricted to the 8 spec icons.
export {
  MEDIA_TYPE_ICON,
  getMediaIcon,
  MediaStatusIcon,
  default as MediaTypeIcon,
} from './MediaIconography';

// ─── Phase 2 — Atomic Media Panels (Slice 0 retro) ────────────────────
export {
  default as MediaPanel,
  MediaGeneralPanel,
  MediaPreviewPanel,
  MediaUsagePanel,
  MediaValidationPanel,
  MediaHealthPanel,
  MediaTimelinePanel,
  MediaMetadataPanel,
  MediaAnalyticsPanel,
  MediaSecurityPanel,
  MediaPermissionsPanel,
} from './panels/index.jsx';

// ─── Shared media formatting utilities ───────────────────────────────
export { fmtFileSize, fmtDuration, fmtCount, fmtDate } from '../../utils/formatMedia';

// ─── Phase 23 — Top-of-page chrome (Slice 2 + 3) ─────────────────────
// MediaBreadcrumbs (entity page trail), MediaCommandBar (13 commands),
// buildMediaContextMenu (12-action right-click menu factory).
export { default as MediaBreadcrumbs } from './MediaBreadcrumbs';
export { default as MediaCommandBar, MEDIA_COMMANDS } from './MediaCommandBar';
export { buildMediaContextMenu } from './MediaContextMenuBuilder';

// ─── Phase CREATOR-EXPERIENCE — Dashboard + Pinned + Activity ──────────
// Slice A: MyMediaDashboard + Pinned bar + Quick Upload + Favorite Collections.
// Slice B: Recent Activity timeline + Continue Editing.
//
// All surfaces read from the parent-passed `mediaList` (existing studio
// fetch) so the slice ships without any backend endpoint addition.
// BackendPendingChip surfaces every field whose endpoint is not yet
// shipped; it disappears the moment the BE endpoint returns canonical data.
export { default as MyMediaDashboard } from '../studio/MyMediaDashboard';
export { default as DashboardCard } from '../studio/DashboardCard';
export { default as BackendPendingChip } from './BackendPendingChip';
export { default as MediaPinnedBar } from './MediaPinnedBar';
export { default as QuickUploadRow } from '../studio/QuickUploadRow';
export { default as FavoriteCollectionsStrip } from './FavoriteCollectionsStrip';
export { default as MediaRecentActivityPanel } from './MediaRecentActivityPanel';
export { default as MediaContinueEditingPanel } from './MediaContinueEditingPanel';

// ─── Phase CREATOR-EXPERIENCE — Project Mode + Dependency graph ─────────
// Slice C: Project Mode (frontend-only localStorage until BE ships).
// Slice D: Dependency list + Delete confirm modal.
export { default as MediaProjectsPanel } from './MediaProjectsPanel';
export { default as MediaProjectFormModal } from './MediaProjectFormModal';
export { default as MediaDependencyList } from './MediaDependencyList';
export { default as MediaDeleteConfirmModal } from './MediaDeleteConfirmModal';

// ─── Creator Studio Hub ────────────────────────────────────────────────
export { default as MediaHub } from '../studio/MediaHub';
export { default as MediaCollections } from '../studio/MediaCollections';
export { default as AdminMediaMonitor } from '../admin/AdminMediaMonitor';

// ─── Phase FUTURE-READY — Universal Media Renderer ─────────────────────
export { default as MediaRenderer, ImagePlaceholder, ErrorState, CircuitOpenState } from './MediaRenderer';
export { default as MediaTrustCenter } from './MediaTrustCenter';
