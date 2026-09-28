/**
 * BackendPendingChip — Reusable "Backend pending" pill.
 *
 * Spec (Phase CREATOR EXPERIENCE — Global Consistency):
 *   - Shows a small chip when a surface reads from an endpoint that
 *     doesn't yet return canonical data.
 *   - Hidden once the BE endpoint ships + the slice is wired to it.
 *
 * Used by:
 *   - MyMediaDashboard (per-card placeholder for fields like drafts_count,
 *     broken_count, workflow_progress).
 *   - MediaRecentActivityPanel (when /api/media/activity/ is not yet delivered).
 *   - MediaContinueEditingPanel (when /api/media/in-progress/ is missing).
 *   - MediaProjectsPanel (when /api/media/projects/ is missing — for now
 *     falls back to localStorage).
 *   - MediaDependencyList (when /api/media/:id/dependencies is missing).
 *   - MediaDeleteConfirmModal (impacted-modules section — same dep).
 *
 * Visual:
 *   - Outline pill: warning amber 1px border + 3px text
 *   - Icon: fa-circle-exclamation (small)
 *   - aria-label: "Backend pending"
 *   - Tooltip with the endpoint hint when hovered
 */
import React from 'react';
import { makeT } from '../../utils/langBackendStub';

export default function BackendPendingChip({
  lang = 'ht',
  endpoint = null,
  inline = false,
}) {
  const t = makeT(lang);
  const hintText = t('pendingHint', { ep: endpoint || '/api/...' });
  const label = t('backendPending');

  return (
    <span
      className={`backend-pending-chip ${inline ? 'backend-pending-chip-inline' : ''}`}
      role="status"
      aria-label={label}
      title={hintText}
      data-endpoint={endpoint || undefined}
    >
      <i className="fas fa-circle-exclamation" aria-hidden="true" />
      <span className="backend-pending-chip-text">{label}</span>
    </span>
  );
}
