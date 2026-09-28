/**
 * Atomic Media Panels barrel (Slice 0 retro).
 *
 * Each panel is a self-contained, focused UI surface that maps to a
 * single section of the Phase-2 SPEC MEDEIA Object / Entity Page.
 *
 * Why atomic panels?
 *   - The old MediaInspector.jsx was 298 lines of mixed logic that
 *     couldn't be reused on the new /media/:id entity page or inside
 *     the right-side Drawer. By breaking it into 10 panels, the same
 *     components render across:
 *       • Side panel (compact layout)
 *       • Full entity page (expanded layout)
 *       • Drawer (mobile-friendly)
 *
 * The MediaPanel dispatcher (`<MediaPanel kind="..." media={...} />`)
 * lets callers pick which panel without importing ten components
 * individually.
 */
export { default as MediaGeneralPanel } from './MediaGeneralPanel';
export { default as MediaPreviewPanel } from './MediaPreviewPanel';
export { default as MediaUsagePanel } from './MediaUsagePanel';
export { default as MediaValidationPanel } from './MediaValidationPanel';
export { default as MediaHealthPanel } from './MediaHealthPanel';
export { default as MediaTimelinePanel } from './MediaTimelinePanel';
export { default as MediaMetadataPanel } from './MediaMetadataPanel';
export { default as MediaAnalyticsPanel } from './MediaAnalyticsPanel';
export { default as MediaSecurityPanel } from './MediaSecurityPanel';
export { default as MediaPermissionsPanel } from './MediaPermissionsPanel';

import MediaGeneralPanel from './MediaGeneralPanel';
import MediaPreviewPanel from './MediaPreviewPanel';
import MediaUsagePanel from './MediaUsagePanel';
import MediaValidationPanel from './MediaValidationPanel';
import MediaHealthPanel from './MediaHealthPanel';
import MediaTimelinePanel from './MediaTimelinePanel';
import MediaMetadataPanel from './MediaMetadataPanel';
import MediaAnalyticsPanel from './MediaAnalyticsPanel';
import MediaSecurityPanel from './MediaSecurityPanel';
import MediaPermissionsPanel from './MediaPermissionsPanel';

/**
 * MediaPanel — Dispatcher that selects the right atomic panel
 * by `kind`. Callers don't have to import 10 components.
 *
 *   <MediaPanel kind="metadata" media={m} lang={lang} />
 */
export default function MediaPanel({ kind, media, analytics, security, isAdmin = false, lang = 'ht' }) {
  switch (kind) {
    case 'general':
      return <MediaGeneralPanel media={media} lang={lang} />;
    case 'preview':
      return <MediaPreviewPanel media={media} lang={lang} />;
    case 'usage':
      return <MediaUsagePanel media={media} lang={lang} />;
    case 'validation':
      return <MediaValidationPanel media={media} lang={lang} />;
    case 'health':
      return <MediaHealthPanel media={media} lang={lang} />;
    case 'timeline':
      return <MediaTimelinePanel media={media} lang={lang} />;
    case 'metadata':
      return <MediaMetadataPanel media={media} lang={lang} />;
    case 'analytics':
      return <MediaAnalyticsPanel media={media} analytics={analytics} lang={lang} />;
    case 'security':
      return <MediaSecurityPanel media={media} security={security} isAdmin={isAdmin} lang={lang} />;
    case 'permissions':
      return <MediaPermissionsPanel media={media} lang={lang} />;
    default:
      return null;
  }
}
