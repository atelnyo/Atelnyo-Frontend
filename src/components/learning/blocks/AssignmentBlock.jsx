/**
 * AssignmentBlock — lets learners submit text for creator review.
 * Used in any course type for open-ended assignments.
 *
 * Block config:
 *   - instructions: string (what the learner should do)
 *   - dueLabel: string (optional, display-only)
 *   - maxScore: number (optional)
 *
 * Submissions are PERSISTED to the backend (POST /api/block-submissions/)
 * so they survive navigation and the creator can review + grade them.
 * When no ``courseId`` is available (editor preview), it degrades to
 * local-only state.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { blockSubmissionService } from '../../../services/api';

export default function AssignmentBlock({ block, lang = 'ht', index, courseId, moduleIndex, onComplete, onViewed }) {
  const isHt = lang === 'ht';
  const viewedRef = useRef(false);
  const [submission, setSubmission] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [feedback, setFeedback] = useState(''); // creator feedback (if graded)
  const [score, setScore] = useState(null); // creator score (if graded)

  const instructions = block.instructions || block.config?.instructions || '';
  const dueLabel = block.dueLabel || block.config?.dueLabel || '';
  const maxScore = block.maxScore || block.config?.maxScore || null;

  const handleView = useCallback(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      onViewed?.(moduleIndex, block.id, 'assignment');
    }
  }, [block.id, moduleIndex, onViewed]);

  // Restore a previously persisted submission for this block.
  useEffect(() => {
    if (!courseId || !block.id) return;
    let active = true;
    blockSubmissionService
      .list(courseId, { block_id: block.id, limit: 1 })
      .then((res) => {
        if (!active) return;
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.results) ? res.data.results : []);
        const existing = rows.find((s) => s.block_id === block.id);
        if (existing) {
          setSubmissionId(existing.id);
          setSubmission(existing.content || '');
          setSubmitted(true);
          setFeedback(existing.feedback || '');
          setScore(existing.score);
        }
      })
      .catch(() => { /* best-effort — fall back to local state */ });
    return () => { active = false; };
  }, [courseId, block.id]);

  const handleSubmit = useCallback(async () => {
    if (!submission.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (courseId && block.id) {
        if (submissionId) {
          // Editing an existing (still pending) submission.
          await blockSubmissionService.update(submissionId, { content: submission.trim() });
        } else {
          const res = await blockSubmissionService.create({
            course_id: courseId,
            module_index: moduleIndex ?? 0,
            block_id: block.id,
            block_type: 'assignment',
            content: submission.trim(),
          });
          setSubmissionId(res?.data?.id ?? null);
        }
      }
      setSubmitted(true);
      onComplete?.(moduleIndex, block.id, 'assignment');
    } catch {
      // Offline / preview — still complete locally so the flow never blocks.
      setSubmitted(true);
      onComplete?.(moduleIndex, block.id, 'assignment');
    } finally {
      setSubmitting(false);
    }
  }, [submission, submitting, submissionId, courseId, block.id, moduleIndex, onComplete]);

  return (
    <div onLoad={handleView}>
      {instructions && (
        <div style={{ marginBottom: 12, fontSize: '0.9rem', lineHeight: 1.6 }}>
          {instructions}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {dueLabel && <span>📅 {dueLabel}</span>}
        {maxScore && <span>📊 /{maxScore}</span>}
      </div>
      {submitted ? (
        <div>
          <div style={{
            padding: 12, borderRadius: 8, background: '#ecfdf5', color: '#065f46',
            fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <i className="fas fa-check-circle" /> {isHt ? 'Tach soumèt!' : 'Assignment submitted!'}
          </div>
          {submission && (
            <div style={{
              padding: 10, borderRadius: 8, background: 'var(--bg-elevated, #f8fafc)',
              border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.85rem',
              whiteSpace: 'pre-wrap', marginBottom: 8,
            }}>
              {submission}
            </div>
          )}
          {score != null && (
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
              📊 {isHt ? 'Nòt' : 'Score'}: {score}{maxScore ? ` / ${maxScore}` : ''}
            </div>
          )}
          {feedback && (
            <div style={{
              padding: 10, borderRadius: 8, background: '#fffbeb', color: '#92400e',
              fontSize: '0.82rem', whiteSpace: 'pre-wrap', marginBottom: 8,
            }}>
              💬 {feedback}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)',
              background: 'transparent', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            {isHt ? 'Edit repons' : 'Edit answer'}
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            placeholder={isHt ? 'Ekri repons ou isitä...' : 'Write your answer here...'}
            rows={4}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)',
              fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!submission.trim() || submitting}
            style={{
              marginTop: 8, padding: '8px 16px', borderRadius: 8, border: 'none',
              background: submission.trim() ? 'var(--color-primary, #d81b60)' : '#ccc',
              color: '#fff', fontWeight: 600, cursor: submission.trim() ? 'pointer' : 'default',
            }}
          >
            {submitting
              ? (isHt ? 'Ap voye...' : 'Submitting…')
              : (isHt ? 'Soumèt' : 'Submit')}
          </button>
        </>
      )}
    </div>
  );
}
