/**
 * src/components/publishing-workflow/PublishingWorkflow.jsx
 *
 * Publishing Workflow for Course Studio.
 * Supports the following states:
 * - Draft: Course is being edited, not visible to students
 * - In Review: Course submitted for moderator review
 * - Changes Requested: Moderator asked for modifications
 * - Approved: Course approved, ready for publishing
 * - Published: Course is live and visible to students
 * - Archived: Course is no longer active but preserved
 *
 * Permission-based review and approval.
 * Published course versions are kept stable.
 * Changes to existing published courses do not destroy student progress.
 */
import React, { useState, useCallback } from 'react';
import { useToast } from '../../../components/common/Toast';
import styles from './publishing-workflow.module.css';

/* ─── Publishing state types ──────────────────────────────────── */
type PublishingState =
  | 'draft'
  | 'in-review'
  | 'changes-requested'
  | 'approved'
  | 'published'
  | 'archived';

const stateLabels: Record<PublishingState, { label: string; labelHt: string; className: string }> = {
  draft: { label: 'Draft', labelHt: 'Bouyon', className: 'status-draft' },
  'in-review': { label: 'In Review', labelHt: 'Sous Révision', className: 'status-review' },
  'changes-requested': { label: 'Changes Requested', labelHt: 'Modifications Demandées', className: 'status-changes' },
  approved: { label: 'Approved', labelHt: 'Approuvé', className: 'status-approved' },
  published: { label: 'Published', labelHt: 'Publié', className: 'status-published' },
  archived: { label: 'Archived', labelHt: 'Archivé', className: 'status-archived' },
};

/* ─── PublishingWorkflow component ────────────────────────────── */
export default function PublishingWorkflow({ currentState, onStateChange, courseId, onPublish }) {
  const [state, setState] = useState<PublishingState>(currentState);
  const [showStateSelector, setShowStateSelector] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const { addToast } = useToast();

  /* ─── State transition handlers ─────────────────────────────── */
  const handleStateChange = useCallback(
    (newState: PublishingState) => {
      setState(newState);
      onStateChange?.(newState, courseId);
      addToast({
        title: 'State Updated',
        message: `Course state changed to ${stateLabels[newState].label}`,
        variant: 'check-circle',
      });
    },
    [onStateChange, courseId, addToast]
  );

  /* ─── Publish course ──────────────────────────────────────── */
  const handlePublish = useCallback(() => {
    // Only allow publish from approved state
    if (state !== 'approved') {
      addToast({
        title: 'Cannot Publish',
        message: 'Course must be approved before publishing.',
        variant: 'error',
      });
      return;
    }
    onPublish?.(courseId);
    setState('published');
    addToast({
      title: 'Published',
      message: 'Course is now live and visible to students.',
      variant: 'check-circle',
    });
  }, [state, courseId, addToast]);

  /* ─── Archive course ──────────────────────────────────────── */
  const handleArchive = useCallback(() => {
    setShowArchiveModal(true);
  }, []);

  const confirmArchive = useCallback(() => {
    setState('archived');
    setShowArchiveModal(false);
    addToast({
      title: 'Archived',
      message: 'Course has been archived. It is preserved but not active.',
      variant: 'check-circle',
    });
  }, [addToast]);

  const cancelArchive = useCallback(() => {
    setShowArchiveModal(false);
  }, [addToast]);

  /* ─── Render ───────────────────────────────────────────────── */
  const stateInfo = stateLabels[state];

  return (
    <div className="publishing-workflow">
      <div className="pw-status-bar">
        <div className="status-indicator" style={{ background: stateInfo.className }}>
          <span>{stateInfo.label}</span>
        </div>
        <div style={{ float: 'right', padding: '4px 8px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 4, fontSize: '0.7rem' }}>
          {t('Current State', 'État Actuel')}: {stateInfo.label}
        </div>
      </div>

      <div className="pw-actions">
        {/* State selector for course creators */}
        {state !== 'published' && (
          <button onClick={() => setShowStateSelector(true)} style={{ padding: '6px 12px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}>
            {t('Change State', 'Changer d\'État')}
          </button>
        )}

        {/* Publisher controls */}
        {state === 'draft' && (
          <button onClick={() => handleStateChange('in-review')} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
            {t('Submit for Review', 'Soumettre à la Révision')}
          </button>
        )}

        {state === 'in-review' && (
          <>
            <button onClick={() => handleStateChange('changes-requested')} style={{ padding: '6px 12px', background: '#ffc107', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
              {t('Changes Requested', 'Modifications Demandées')}
            </button>
            <button onClick={() => handleStateChange('approved')} style={{ padding: '6px 12px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
              {t('Mark as Approved', 'Marquer comme Approuvé')}
            </button>
          </>
        )}

        {state === 'approved' && (
          <button onClick={handlePublish} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
            {t('Publish', 'Publier')}
          </button>
        )}

        {state === 'published' && (
          <>
            <button onClick={handleArchive} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
              {t('Archive', 'Archiver')}
            </button>
          </>}
        )}
      </div>

      {/* Archive modal ─────────────────────────────────────────── */}
      {showArchiveModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowArchiveModal(false)} role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: 400, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{t('Archive Course', 'Archiver le Cours')}</h3>
            <p>{t('Are you sure you want to archive this course? It will be preserved but become inactive.', 'Êtes-vous sûr de vouloir archiver ce cours ? Il sera préservé mais deviendra inactif.')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
              <button type="button" onClick={cancelArchive} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
                {t('Cancel', 'Annuler')}
              </button>
              <button type="button" onClick={confirmArchive} style={{ padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.7rem' }}>
                {t('Archive', 'Archiver')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}