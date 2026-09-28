/**
 * src/components/learning/VocabularyBlock.jsx
 *
 * Vocabulary — word + meaning + pronunciation + example; the learner
 * types the target word. Exact normalized match (exactMatch); a correct
 * answer completes the block.
 *
 * Now also shows translation and example when available, creating a
 * richer learning experience.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { exactMatch } from '../../modules/learning/speech';
import styles from './learning.module.css';

export default function VocabularyBlock({ block, lang = 'ht', reportComplete }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const targetText = block.targetText || '';
  const translation = block.translation || '';
  const example = block.example || '';
  const referenceAudio = block.referenceAudio || '';
  const hint = block.hint || '';

  const handleTypedCheck = useCallback(() => {
    const { matched } = exactMatch(targetText, typed);
    setTypedResult({ matched });
    if (matched) reportComplete();
  }, [targetText, typed, reportComplete]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleTypedCheck();
  }, [handleTypedCheck]);

  // Auto-complete when showing answer (no typing required)
  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
    reportComplete();
  }, [reportComplete]);

  return (
    <div className={styles.practiceTypedRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
      {/* Word display */}
      <div style={{
        textAlign: 'center', padding: '16px 20px',
        background: 'var(--bg-surface, #f8fafc)',
        borderRadius: 12,
        border: '1px solid var(--border-subtle, #e2e8f0)',
      }}>
        <div style={{
          fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          {targetText}
        </div>
        {translation && (
          <div style={{
            fontSize: '0.95rem', color: 'var(--text-secondary)',
            fontStyle: 'italic',
          }}>
            {translation}
          </div>
        )}
      </div>

      {/* Example */}
      {example && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(37,99,235,0.05)',
          border: '1px solid rgba(37,99,235,0.1)',
          fontSize: '0.9rem', color: 'var(--text-secondary)',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {isHt ? 'Egzanp:' : 'Example:'}
          </span>{' '}
          {example}
        </div>
      )}

      {/* Audio */}
      {referenceAudio && (
        <div style={{ textAlign: 'center' }}>
          <audio controls src={referenceAudio} style={{ maxWidth: 300, width: '100%' }} />
        </div>
      )}

      {/* Hint */}
      {hint && (
        <div style={{
          fontSize: '0.8rem', color: 'var(--text-secondary)',
          textAlign: 'center',
        }}>
          💡 {hint}
        </div>
      )}

      {/* Typing exercise */}
      {!showAnswer && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className={styles.practiceInput}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Type the word…', 'Tape mo a…')}
            style={{ flex: 1 }}
          />
          <button type="button" className={styles.practiceBtn} onClick={handleTypedCheck}>
            {t('Check', 'Tcheke')}
          </button>
          <button
            type="button"
            className={styles.practiceBtn}
            onClick={handleShowAnswer}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            {t('Show answer', 'Moun repons')}
          </button>
        </div>
      )}

      {/* Result */}
      {typedResult && (
        typedResult.matched
          ? <div className={styles.practiceMatched}><i className="fas fa-circle-check" aria-hidden="true" /> {t('Correct!', 'Kòrèk!')}</div>
          : <div className={styles.practiceRetryHint}><i className="fas fa-rotate-left" aria-hidden="true" /> {t('Not quite — try again.', 'Pa egzak — eseye ankò.')}</div>
      )}

      {showAnswer && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(16,185,129,0.1)', color: '#10b981',
          fontSize: '0.9rem', fontWeight: 600, textAlign: 'center',
        }}>
          ✅ {targetText} — {translation}
        </div>
      )}
    </div>
  );
}
