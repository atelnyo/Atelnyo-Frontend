/**
 * src/components/learning/blocks/FillBlankBlock.jsx
 *
 * Fill-in-the-blank interactive block for language and general courses.
 * The learner sees a sentence with a blank and types the missing word(s).
 *
 * Block data shape:
 *   { id, type: 'fill_blank', title, sentence, answer, hint, translation, referenceAudio }
 *
 * ``sentence`` uses ___ (3 underscores) to mark the blank position.
 * If no blank marker is provided, the answer is appended at the end.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

export default function FillBlankBlock({
  block,
  lang = 'ht',
  index = 0,
  courseId,
  moduleIndex,
  onComplete,
  reportComplete,
  onViewed,
}) {
  const isHt = lang === 'ht';
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef(null);

  const sentence = block.sentence || '';
  const answer = (block.answer || '').trim();
  const hint = block.hint || '';
  const translation = block.translation || '';
  const hasAudio = Boolean(block.referenceAudio);

  // Notify parent that this block was viewed
  useEffect(() => {
    onViewed?.(block.id);
  }, [block.id, onViewed]);

  // Parse sentence with blank marker
  const parts = sentence.split('___');
  const hasBlankMarker = parts.length > 1;

  const handleSubmit = useCallback(() => {
    const normalized = userAnswer.trim().toLowerCase();
    const expected = answer.toLowerCase();
    const isCorrect = normalized === expected;
    setCorrect(isCorrect);
    setSubmitted(true);
    if (isCorrect) {
      reportComplete?.();
    }
  }, [userAnswer, answer, block.id, onComplete]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !submitted) {
      handleSubmit();
    }
  }, [submitted, handleSubmit]);

  const handleRetry = useCallback(() => {
    setUserAnswer('');
    setSubmitted(false);
    setCorrect(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="ls-block ls-block--fill-blank" data-block-type="fill_blank">
      {/* Header */}
      <div className="ls-block-header">
        <span className="ls-block-badge">📝 {isHt ? 'Ranpli nan vid' : 'Fill in the Blank'}</span>
        <h3 className="ls-block-title">{block.title || (isHt ? 'Ranpli espas la' : 'Fill the blank')}</h3>
      </div>

      {/* Sentence with blank */}
      <div className="ls-block-sentence" style={{
        fontSize: '1.2rem', lineHeight: 1.6, padding: '16px 20px',
        background: 'var(--bg-surface, #f8fafc)', borderRadius: 12,
        border: '1px solid var(--border-subtle, #e2e8f0)',
        marginBottom: 16,
      }}>
        {hasBlankMarker ? (
          parts.map((part, i) => (
            <React.Fragment key={i}>
              <span>{part}</span>
              {i < parts.length - 1 && (
                <span style={{
                  display: 'inline-block',
                  minWidth: 100,
                  borderBottom: '2px solid var(--color-primary, #2563eb)',
                  margin: '0 4px',
                  textAlign: 'center',
                  color: submitted ? (correct ? '#10b981' : '#ef4444') : 'var(--color-primary)',
                  fontWeight: 600,
                }}>
                  {submitted ? (correct ? answer : userAnswer || '___') : '___'}
                </span>
              )}
            </React.Fragment>
          ))
        ) : (
          <span>{sentence || (isHt ? 'Egzanp: The cat ___ on the mat.' : 'Example: The cat ___ on the mat.')}</span>
        )}
      </div>

      {/* Translation */}
      {translation && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, fontStyle: 'italic' }}>
          {translation}
        </p>
      )}

      {/* Hint */}
      {hint && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          💡 {hint}
        </p>
      )}

      {/* Audio */}
      {hasAudio && (
        <div style={{ marginBottom: 12 }}>
          <audio controls src={block.referenceAudio} style={{ width: '100%', maxWidth: 400 }} />
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitted && correct}
          placeholder={isHt ? 'Ekri repons ou...' : 'Type your answer...'}
          style={{
            flex: 1, minWidth: 200, padding: '10px 14px',
            borderRadius: 8, border: '1px solid var(--border-subtle, #e2e8f0)',
            background: 'var(--bg-input, #fff)', color: 'var(--text-primary)',
            fontSize: '1rem',
            borderColor: submitted ? (correct ? '#10b981' : '#ef4444') : undefined,
          }}
          aria-label={isHt ? 'Repons' : 'Answer'}
        />
        {!submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: 'var(--color-primary, #2563eb)', color: '#fff',
              fontWeight: 600, cursor: userAnswer.trim() ? 'pointer' : 'not-allowed',
              opacity: userAnswer.trim() ? 1 : 0.5,
            }}
          >
            {isHt ? 'Verifye' : 'Check'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRetry}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-primary)',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            {isHt ? 'Eseye ankò' : 'Try again'}
          </button>
        )}
      </div>

      {/* Result */}
      {submitted && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: correct ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: correct ? '#10b981' : '#ef4444',
          fontSize: '0.9rem', fontWeight: 600,
        }}>
          {correct
            ? (isHt ? '✅ Brav! Repons lan kòrèk.' : '✅ Correct! Well done.')
            : (isHt ? `❌ Repons lan se: ${answer}` : `❌ The answer is: ${answer}`)}
        </div>
      )}
    </div>
  );
}
