/**
 * ProjectBlock — presents a multi-step project with description and
 * deliverables. Used for capstone projects, portfolio pieces, etc.
 *
 * Block config:
 *   - description: string (project overview)
 *   - deliverables: string[] (list of expected outputs)
 *   - resources: { title, url }[] (optional reference links)
 *   - maxScore: number (optional)
 *
 * The learner's "I finished the project" notes are PERSISTED to the
 * backend (POST /api/block-submissions/) so the creator can review
 * them. Without ``courseId`` (editor preview) it degrades to
 * local-only state.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { blockSubmissionService } from '../../../services/api';

export default function ProjectBlock({ block, lang = 'ht', index, courseId, moduleIndex, onComplete, onViewed }) {
  const isHt = lang === 'ht';
  const viewedRef = useRef(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [feedback, setFeedback] = useState(''); // creator feedback (if graded)
  const [score, setScore] = useState(null); // creator score (if graded)

  const description = block.description || block.config?.description || '';
  const deliverables = block.deliverables || block.config?.deliverables || [];
  const resources = block.resources || block.config?.resources || [];
  const maxScore = block.maxScore || block.config?.maxScore || null;

  const handleView = useCallback(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      onViewed?.(moduleIndex, block.id, 'project');
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
          setNotes(existing.content || '');
          setSubmitted(true);
          setFeedback(existing.feedback || '');
          setScore(existing.score);
        }
      })
      .catch(() => { /* best-effort — fall back to local state */ });
    return () => { active = false; };
  }, [courseId, block.id]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (courseId && block.id) {
        if (submissionId) {
          // Editing an existing (still pending) submission.
          await blockSubmissionService.update(submissionId, { content: notes.trim() });
        } else {
          const res = await blockSubmissionService.create({
            course_id: courseId,
            module_index: moduleIndex ?? 0,
            block_id: block.id,
            block_type: 'project',
            content: notes.trim(),
          });
          setSubmissionId(res?.data?.id ?? null);
        }
      }
      setSubmitted(true);
      setShowSubmit(false);
      onComplete?.(moduleIndex, block.id, 'project');
    } catch {
      // Offline / preview — still complete locally so the flow never blocks.
      setSubmitted(true);
      setShowSubmit(false);
      onComplete?.(moduleIndex, block.id, 'project');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submissionId, courseId, block.id, moduleIndex, notes, onComplete]);

  return (
    <div onLoad={handleView}>
      {description && (
        <div style={{ marginBottom: 12, fontSize: '0.9rem', lineHeight: 1.6 }}>
          {description}
        </div>
      )}

      {deliverables.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
            {isHt ? 'Livrab:' : 'Deliverables:'}
          </h4>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem' }}>
            {deliverables.map((d, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {resources.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
            {isHt ? 'Resous:' : 'Resources:'}
          </h4>
          {resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-primary)', marginBottom: 4 }}>
              🔗 {r.title}
            </a>
          ))}
        </div>
      )}

      {maxScore && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          📊 /{maxScore}
        </div>
      )}

      {submitted ? (
        <div>
          <div style={{
            padding: 12, borderRadius: 8, background: '#ecfdf5', color: '#065f46',
            fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <i className="fas fa-check-circle" /> {isHt ? 'Pwojè soumèt!' : 'Project submitted!'}
          </div>
          {notes && (
            <div style={{
              padding: 10, borderRadius: 8, background: 'var(--bg-elevated, #f8fafc)',
              border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.85rem',
              whiteSpace: 'pre-wrap', marginBottom: 8,
            }}>
              {notes}
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
            onClick={() => { setSubmitted(false); setShowSubmit(true); }}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)',
              background: 'transparent', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            {isHt ? 'Edit nòt' : 'Edit notes'}
          </button>
        </div>
      ) : showSubmit ? (
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isHt ? 'Ekri nòt sou pwojè ou an...' : 'Add notes about your project...'}
            rows={3}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)',
              fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleSubmit} disabled={submitting}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #d81b60)', color: '#fff', fontWeight: 600, cursor: submitting ? 'default' : 'pointer' }}>
              {submitting ? (isHt ? 'Ap voye...' : 'Submitting…') : (isHt ? 'Soumèt Pwojè' : 'Submit Project')}
            </button>
            <button type="button" onClick={() => setShowSubmit(false)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', cursor: 'pointer' }}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowSubmit(true)}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #d81b60)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          {isHt ? 'Mwen fini pwojè a' : 'I finished the project'}
        </button>
      )}
    </div>
  );
}
