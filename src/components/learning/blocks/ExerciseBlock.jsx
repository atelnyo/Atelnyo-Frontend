/**
 * src/components/learning/blocks/ExerciseBlock.jsx
 *
 * Interactive exercise block for the Business Course.
 * Supports: short text, long text, multiple choice, checklist.
 * Features: autosave, draft state, portfolio integration.
 */
import React, { useState, useEffect, useCallback } from 'react';
import useCompletionContract, { COMPLETION_MODE, BLOCK_REQUIREMENT } from '../../../hooks/useCompletionContract';
import useAutosave from '../../../hooks/useAutosave';
import useBlockSaveContract from '../../../hooks/useBlockSaveContract';

export default function ExerciseBlock({ block, lang = 'ht', courseId, moduleIndex, onComplete, onPortfolioSave, registerBlock }) {
  const isHt = lang === 'ht';
  // §29-§31 — Completion contract: exercise requires submission
  const { markComplete } = useCompletionContract({
    blockId: block?.id,
    blockType: 'exercise',
    completionMode: COMPLETION_MODE.SUBMITTED,
    requirement: BLOCK_REQUIREMENT.REQUIRED,
  });
  const [answer, setAnswer] = useState(block?.answer || '');
  const [checklistState, setChecklistState] = useState(block?.checklistState || {});
  const [selectedOption, setSelectedOption] = useState(block?.selectedOption || null);
  const [saved, setSaved] = useState(false);

  // §9, §28 — Build a composite content object for autosave
  const content = { answer, checklistState, selectedOption };
  const [savedContent, setSavedContent] = useState(content);

  // §9, §28 — Local-first autosave via draftStore primitive
  const { saveState, stateLabel, flushSave, recoverDraft } = useAutosave({
    blockId: block?.id,
    courseId,
    lessonId: String(moduleIndex ?? 0),
    content,
    onSave: async (data) => {
      // Server sync via StudentBlockState upsert (if endpoint available)
      // For now, local-only — draftStore persists the draft
      setSavedContent(data);
      return { ok: true, savedLocal: true };
    },
    debounceMs: 2000,
  });

  // §28 — Recover draft on mount
  useEffect(() => {
    if (!block?.id) return;
    recoverDraft().then((draft) => {
      if (draft) {
        if (draft.answer) setAnswer(draft.answer);
        if (draft.checklistState) setChecklistState(draft.checklistState);
        if (draft.selectedOption != null) setSelectedOption(draft.selectedOption);
      }
    }).catch(() => {});
  }, [block?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // §8, §41 — Register with navigation engine via useBlockSaveContract
  useBlockSaveContract({
    blockId: block?.id,
    registerBlock,
    onSave: flushSave,
    content,
    savedContent,
  });

  const handleSubmit = async () => {
    // §43 — Flush autosave before submission
    await flushSave();
    const data = {
      answer: answer || selectedOption || checklistState,
      answerType: block?.answerType || 'text',
      checklistState,
      selectedOption,
    };
    if (onComplete) onComplete(data);
    if (onPortfolioSave && block?.portfolioSection) {
      onPortfolioSave(block.portfolioSection, data);
    }
    markComplete();
    setSaved(true);
  };

  const handleChecklistToggle = (index) => {
    setChecklistState(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const instructions = block?.instructions || block?.content || '';
  const options = block?.options || [];
  const checklistItems = block?.items || block?.checklistItems || [];

  return (
    <div className="exercise-block" style={{
      background: '#f8f9fa',
      border: '2px solid #4caf50',
      borderRadius: '12px',
      padding: '24px',
      margin: '16px 0',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px', color: '#2e7d32' }}>
          ✏️ {block?.title || (isHt ? 'Egzèsis' : 'Exercise')}
        </h3>
        {instructions && (
          <p style={{ margin: 0, color: '#555', lineHeight: '1.6' }}>
            {instructions}
          </p>
        )}
      </div>

      {/* Answer input based on type */}
      {(!block?.answerType || block.answerType === 'text' || block.answerType === 'long_text') && (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={isHt ? 'Ekri repons ou isit la...' : 'Write your answer here...'}
          rows={block.answerType === 'long_text' ? 8 : 4}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      )}

      {block?.answerType === 'multiple_choice' && options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, i) => (
            <label
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                border: `2px solid ${selectedOption === i ? '#4caf50' : '#e0e0e0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedOption === i ? '#e8f5e9' : '#fff',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="radio"
                name={`exercise-${block?.id}`}
                checked={selectedOption === i}
                onChange={() => setSelectedOption(i)}
                style={{ accentColor: '#4caf50' }}
              />
              <span>{typeof opt === 'string' ? opt : opt.text || opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {block?.answerType === 'checklist' && checklistItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checklistItems.map((item, i) => (
            <label
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                background: checklistState[i] ? '#e8f5e9' : '#fff',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={!!checklistState[i]}
                onChange={() => handleChecklistToggle(i)}
                style={{ accentColor: '#4caf50', width: '18px', height: '18px' }}
              />
              <span>{typeof item === 'string' ? item : item.text || item.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Status and actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
        <div style={{ fontSize: '12px', color: '#888' }}>
          {/* §12 — Human-friendly save status */}
          {stateLabel && <span>💾 {stateLabel}</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSubmit}
            disabled={saved}
            style={{
              padding: '8px 20px',
              background: saved ? '#aaa' : '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: saved ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {saved ? '✅ ' + (isHt ? 'Voye' : 'Submitted') : '📤 ' + (isHt ? 'Voye Repons' : 'Submit Answer')}
          </button>
        </div>
      </div>
    </div>
  );
}
