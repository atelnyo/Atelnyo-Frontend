/**
 * MediaStatusEngine — Canonical palette for the 15+ Phase-2 statuses.
 *
 * Pure data and helpers. NO JSX in this file. The render component
 * lives in MediaStatusBadge.jsx which imports from here. Splitting
 * "data" from "render" fixes the previous default-export naming
 * collision where importing `MediaStatusEngine` could have yielded
 * the badge instead of the palette.
 *
 * Why centralised?
 *   - Phase 1 shipped STATUS_META inline in MediaBadge, MediaStatus,
 *     and MediaCard. Status drift was inevitable. Now every consumer
 *     reads from one map.
 *
 * Usage:
 *   import { STATUS_META, getStatusMeta, ALL_STATUSES } from './MediaStatusEngine';
 *   import MediaStatusBadge from './MediaStatusBadge';
 */
export const STATUS_META = {
  draft:      { icon: 'fa-file',                 color: 'var(--state-neutral-text, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.1))', labelEn: 'Draft',      labelHt: 'Brouyon',     descEn: 'This media has not been published yet.', descHt: 'Medya sa a poko pibliye.', tooltipEn: 'Not yet published', tooltipHt: 'Poko pibliye', defaultAction: 'publish' },
  ready:      { icon: 'fa-box-open',             color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.1))', labelEn: 'Ready',      labelHt: 'Pare',        descEn: 'Media is ready to be used.', descHt: 'Medya a pare pou itilize.', tooltipEn: 'Available', tooltipHt: 'Disponib', defaultAction: 'use' },
  validating: { icon: 'fa-spinner',              color: 'var(--state-info, #0ea5e9)', bg: 'var(--state-info-bg, rgba(14,165,233,0.1))', labelEn: 'Validating', labelHt: 'Ap valide',   descEn: 'Validation in progress.', descHt: 'Validasyon an ap fèt.', tooltipEn: 'Checking…', tooltipHt: 'Ap tcheke…', defaultAction: 'wait' },
  healthy:    { icon: 'fa-check-circle',         color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.1))', labelEn: 'Healthy',    labelHt: 'An sante',    descEn: 'Media is accessible and responding normally.', descHt: 'Medya a aksesib epi li reponn nòmalman.', tooltipEn: 'All good', tooltipHt: 'Tout anfòm', defaultAction: 'use' },
  broken:     { icon: 'fa-times-circle',         color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.1))', labelEn: 'Broken',     labelHt: 'Kase',        descEn: 'The URL is not accessible.', descHt: 'URL la pa aksesib.', tooltipEn: 'Replace URL', tooltipHt: 'Ranplase URL', defaultAction: 'replace' },
  disabled:   { icon: 'fa-ban',                  color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.1))', labelEn: 'Disabled',   labelHt: 'Andikape',    descEn: 'Media is disabled by admin.', descHt: 'Medya a andikape pa admin.', tooltipEn: 'Contact admin', tooltipHt: 'Kontakte admin', defaultAction: 'contact' },
  archived:   { icon: 'fa-box',                  color: 'var(--text-secondary, #475569)', bg: 'var(--state-neutral-bg, rgba(71,85,105,0.1))', labelEn: 'Archived',   labelHt: 'Achive',      descEn: 'Media is archived and not active.', descHt: 'Medya a achive, li pa aktif.', tooltipEn: 'Restore', tooltipHt: 'Retabli', defaultAction: 'restore' },
  hidden:     { icon: 'fa-eye-slash',            color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.1))', labelEn: 'Hidden',     labelHt: 'Rezève',      descEn: 'Media is hidden from default listings.', descHt: 'Medya a kache nan lis defo.', tooltipEn: 'Show', tooltipHt: 'Montre', defaultAction: 'show' },
  scheduled:  { icon: 'fa-clock',                color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.1))', labelEn: 'Scheduled',  labelHt: 'Pwograme',    descEn: 'Media will publish at a scheduled time.', descHt: 'Medya a ap pibliye nan yon moman pwograme.', tooltipEn: 'Edit schedule', tooltipHt: 'Modifye orè', defaultAction: 'editSchedule' },
  deleted:    { icon: 'fa-trash',                color: 'var(--pr-color-amber-900, #7c2d12)', bg: 'var(--pr-color-amber-900-bg, rgba(124,45,18,0.1))', labelEn: 'Deleted',    labelHt: 'Siprime',     descEn: 'Media is soft-deleted. Can be restored.', descHt: 'Medya a efase. Ka retounen.', tooltipEn: 'Restore', tooltipHt: 'Retabli', defaultAction: 'restore' },
  processing: { icon: 'fa-cog',                  color: 'var(--state-info, #0891b2)', bg: 'var(--state-info-bg, rgba(8,145,178,0.1))', labelEn: 'Processing', labelHt: 'Ap trete',    descEn: 'Media being processed (transcoding, etc).', descHt: 'Medya a ap trete.', tooltipEn: 'Wait', tooltipHt: 'Tann', defaultAction: 'wait' },
  failed:     { icon: 'fa-exclamation-circle',   color: 'var(--state-error, #dc2626)', bg: 'var(--severity-high-bg, rgba(220,38,38,0.1))', labelEn: 'Failed',     labelHt: 'Echwe',       descEn: 'A previous operation failed.', descHt: 'Yon operasyon anvan yo echwe.', tooltipEn: 'Retry', tooltipHt: 'Eseye ankò', defaultAction: 'retry' },
  success:    { icon: 'fa-check-double',         color: 'var(--state-success, #059669)', bg: 'var(--severity-low-bg, rgba(5,150,105,0.1))', labelEn: 'Success',    labelHt: 'Siksè',       descEn: 'Last operation completed successfully.', descHt: 'Dènye operasyon an te reyisi.', tooltipEn: 'Done', tooltipHt: 'Fini', defaultAction: 'dismiss' },
  warning:    { icon: 'fa-exclamation-triangle', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.1))', labelEn: 'Warning',    labelHt: 'Avètisman',   descEn: 'Media is accessible but has issues.', descHt: 'Medya a aksesib men gen pwoblèm.', tooltipEn: 'Inspect', tooltipHt: 'Enspekte', defaultAction: 'inspect' },
  premium:    { icon: 'fa-crown',                color: 'var(--pr-color-yellow-400, #facc15)', bg: 'var(--pr-color-yellow-400-bg, rgba(250,204,21,0.1))', labelEn: 'Premium',    labelHt: 'Premium',     descEn: 'Marked as premium content.', descHt: 'Make kontni premium.', tooltipEn: 'Premium content', tooltipHt: 'Kontni premium', defaultAction: 'monetize' },
};

export const ALL_STATUSES = Object.keys(STATUS_META);

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.healthy;
}

export function isValidStatus(status) {
  return Boolean(STATUS_META[status]);
}
