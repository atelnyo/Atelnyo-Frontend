/**
 * src/components/learning/blocks/ReflectionBlock.jsx
 *
 * §12 — Reflection Block with configurable modes:
 *   - private: student writes for themselves, no submission
 *   - optional: student may submit, but not required
 *   - saved: answer is saved to workspace/portfolio
 *   - required: answer must be submitted to complete
 *
 * Supports autosave and portfolio integration.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import useAutosave from '../../../hooks/useAutosave';

export default function ReflectionBlock({ block, lang = 'ht', courseId, moduleIndex, onComplete, reportComplete, registerBlock }) {
  const isHt = lang === 'ht';

  // §12 — Reflection mode: private | optional | saved | required
  const mode = block?.mode || block?.config?.mode || 'optional';
  const isRequired = mode === 'required';
  const isPrivate = mode === 'private';
  const showSubmit = mode !== 'private';

  const [response, setResponse] = useState(block?.response || '');
  const [submitted, setSubmitted] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // §26, §28 — Autosave via draftStore (local-first, account-isolated)
  const { saveState, triggerSave, recoverDraft } = useAutosave({
    blockId: block?.id,
    courseId,
    lessonId: String(moduleIndex ?? 0),
    content: { response },
    onSave: async (content) => {
      // Save to localStorage (server save handled by parent)
      try {
        const key = `reflection_draft_${block?.id}`;
        localStorage.setItem(key, JSON.stringify({
          response: content.response,
          timestamp: Date.now(),
        }));
        setLastSaved(new Date());
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    debounceMs: 2000,
  });

  // §28 — Recover draft on mount
  useEffect(() => {
    const draft = recoverDraft();
    if (draft?.response) setResponse(draft.response);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(() => {
    if (!showSubmit || submitted || !response.trim()) return;
    setSubmitted(true);
    onComplete?.({ response, mode });
    if (reportComplete) reportComplete();
  }, [showSubmit, submitted, response, mode, onComplete, reportComplete]);

  // §22 — Register with navigation engine
  useEffect(() => {
    if (!registerBlock || !block?.id) return;
    return registerBlock(block.id, {
      hasPendingChanges: () => response !== (block?.response || ''),
      save: async () => { triggerSave(); return { ok: true }; },
      validateForNavigation: () => {
        if (isRequired && !submitted && !response.trim()) {
          return { ok: false, reason: isHt ? 'Eskri repons ou anvan ou kontinye.' : 'Write your answer before continuing.' };
        }
        return { ok: true };
      },
    });
  }, [block?.id, block?.response, response, submitted, isRequired, isHt, registerBlock, triggerSave]);

  const prompt = block?.prompt || block?.content || '';

  // Status message
  const statusMsg = saveState === 'saving'
    ? (isHt ? 'Ap sove...' : 'Saving...')
    : saveState === 'saved'
      ? (isHt ? '✅ Sove' : '✅ Saved')
      : saveState === 'local_only'
        ? (isHt ? '💾 Sove sou aparèy la' : '💾 Saved on device')
        : saveState === 'failed'
          ? (isHt ? '❌ Pa t kapab sove' : '❌ Could not save')
          : lastSaved
            ? `${isHt ? 'Dènye sove:' : 'Last saved:'} ${lastSaved.toLocaleTimeString()}`
            : '';

  return (
    <div className="ls-question" style={{ borderLeft: '3px solid #9c27b0' }}>
      {/* Header */}
      <div className="ls-question-header">
        <h3 className="ls-question-text">
          🧠 {block?.title || (isHt ? 'Refleksyon' : 'Reflection')}
        </h3>
        {mode === 'private' && (
          <p className="ls-question-description" style={{ fontStyle: 'italic' }}>
            {isHt ? 'Sa a se pou ou menm. Pa gen okenn ki pral wè repons ou.' : 'This is for you alone. No one will see your answer.'}
          </p>
        )}
        {isRequired && !submitted && (
          <p className="ls-question-description" style={{ color: 'var(--color-primary, #3b82f6)' }}>
            {isHt ? '⚠️ Reponn kesyon sa a pou kontinye.' : '⚠️ Answer this question to continue.'}
          </p>
        )}
      </div>

      {/* Prompt */}
      {prompt && (
        <blockquote style={{
          margin: '0 0 16px',
          padding: '12px 16px',
          borderLeft: '3px solid #ce93d8',
          background: 'rgba(156, 39, 176, 0.04)',
          borderRadius: '0 8px 8px 0',
          fontStyle: 'italic',
          color: '#4a148c',
          lineHeight: 1.6,
          fontSize: '0.92em',
        }}>
          &ldquo;{prompt}&rdquo;
        </blockquote>
      )}

      {/* Response input */}
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder={isHt ? 'Ekri sa ou panse isit la...' : 'Write your thoughts here...'}
        rows={6}
        disabled={submitted}
        aria-label={isHt ? 'Repons ou' : 'Your response'}
        style={{
          width: '100%',
          padding: '12px',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box',
          background: submitted ? 'var(--surface-card-alt, #f8fafc)' : 'var(--surface-card, #fff)',
          lineHeight: 1.6,
        }}
      />

      {/* Status and actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #6b7280)' }}>
          {statusMsg}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {showSubmit && !submitted && (
            <button
              type="button"
              className="ls-btn ls-btn--primary"
              onClick={handleSubmit}
              disabled={!response.trim()}
            >
              {isHt ? 'Soumèt Refleksyon' : 'Submit Reflection'}
            </button>
          )}
          {submitted && (
            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.88rem' }}>
              ✅ {isHt ? 'Soumèt' : 'Submitted'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
