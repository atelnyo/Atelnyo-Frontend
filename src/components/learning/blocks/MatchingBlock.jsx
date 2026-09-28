/**
 * src/components/learning/blocks/MatchingBlock.jsx
 *
 * Matching pairs interactive block. The learner matches items from
 * column A to column B by clicking/tapping pairs.
 *
 * Block data shape:
 *   { id, type: 'matching', title, pairs: [{ left, right }], shuffled?: boolean }
 *
 * On completion, reports score as (correct / total) * 100.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchingBlock({
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
  const pairs = Array.isArray(block.pairs) ? block.pairs : [];
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matched, setMatched] = useState({}); // { leftIndex: rightIndex }
  const [wrongPair, setWrongPair] = useState(null);
  const [completed, setCompleted] = useState(false);

  // Notify parent
  useEffect(() => {
    onViewed?.(block.id);
  }, [block.id, onViewed]);

  // Shuffle right side for display
  const rightOrder = useMemo(() => {
    return shuffleArray(pairs.map((_, i) => i));
  }, [pairs.length]);

  // Check if all matched
  useEffect(() => {
    if (pairs.length > 0 && Object.keys(matched).length === pairs.length && !completed) {
      setCompleted(true);
      // Since we store matched as { leftIdx: rightIdx }, correctness is leftIdx === rightIdx
      const correct = Object.entries(matched).filter(([l, r]) => Number(l) === r).length;
      const score = Math.round((correct / pairs.length) * 100);
      reportComplete?.();
    }
  }, [matched, pairs.length, completed, block.id, onComplete]);

  const handleLeftClick = useCallback((idx) => {
    if (matched[idx] !== undefined) return;
    setSelectedLeft(idx);
  }, [matched]);

  const handleRightClick = useCallback((rightOriginalIdx) => {
    if (selectedLeft === null) return;
    // Already matched this right item?
    if (Object.values(matched).includes(rightOriginalIdx)) return;

    if (selectedLeft === rightOriginalIdx) {
      // Correct match
      setMatched((prev) => ({ ...prev, [selectedLeft]: rightOriginalIdx }));
      setSelectedLeft(null);
      setWrongPair(null);
    } else {
      // Wrong match — flash red briefly
      setWrongPair({ left: selectedLeft, right: rightOriginalIdx });
      setSelectedLeft(null);
      setTimeout(() => setWrongPair(null), 800);
    }
  }, [selectedLeft, matched]);

  const isMatched = (leftIdx) => matched[leftIdx] !== undefined;
  const isRightUsed = (rightOriginalIdx) => Object.values(matched).includes(rightOriginalIdx);

  return (
    <div className="ls-block ls-block--matching" data-block-type="matching">
      {/* Header */}
      <div className="ls-block-header">
        <span className="ls-block-badge">🔗 {isHt ? 'Asosye' : 'Matching'}</span>
        <h3 className="ls-block-title">{block.title || (isHt ? 'Asosye bagay yo' : 'Match the pairs')}</h3>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {Object.keys(matched).length} / {pairs.length} {isHt ? 'pare' : 'matched'}
      </div>

      {/* Matching grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px 16px',
        alignItems: 'start',
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            {isHt ? 'Gòch' : 'Left'}
          </div>
          {pairs.map((pair, i) => {
            const matchedRight = matched[i];
            const isSelected = selectedLeft === i;
            const isWrongLeft = wrongPair?.left === i;
            return (
              <button
                key={`left-${i}`}
                type="button"
                onClick={() => handleLeftClick(i)}
                disabled={isMatched(i)}
                style={{
                  padding: '10px 14px', borderRadius: 8, textAlign: 'left',
                  border: `2px solid ${
                    isWrongLeft ? '#ef4444' :
                    isSelected ? 'var(--color-primary, #2563eb)' :
                    isMatched(i) ? '#10b981' :
                    'var(--border-subtle, #e2e8f0)'
                  }`,
                  background: isMatched(i) ? 'rgba(16,185,129,0.08)' :
                    isSelected ? 'rgba(37,99,235,0.08)' :
                    isWrongLeft ? 'rgba(239,68,68,0.08)' :
                    'var(--bg-surface, #fff)',
                  cursor: isMatched(i) ? 'default' : 'pointer',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {pair.left}
                {isMatched(i) && <span style={{ marginLeft: 8, color: '#10b981' }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* Arrow column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', paddingTop: 28 }}>
          {pairs.map((_, i) => (
            <div key={`arrow-${i}`} style={{
              height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isMatched(i) ? '#10b981' : 'var(--text-secondary)',
              opacity: isMatched(i) ? 1 : 0.3,
            }}>
              <i className="fas fa-arrow-right" />
            </div>
          ))}
        </div>

        {/* Right column (shuffled) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            {isHt ? 'Dwat' : 'Right'}
          </div>
          {rightOrder.map((originalIdx) => {
            const pair = pairs[originalIdx];
            const used = isRightUsed(originalIdx);
            const isWrongRight = wrongPair?.right === originalIdx;
            return (
              <button
                key={`right-${originalIdx}`}
                type="button"
                onClick={() => handleRightClick(originalIdx)}
                disabled={used}
                style={{
                  padding: '10px 14px', borderRadius: 8, textAlign: 'left',
                  border: `2px solid ${
                    isWrongRight ? '#ef4444' :
                    used ? '#10b981' :
                    'var(--border-subtle, #e2e8f0)'
                  }`,
                  background: used ? 'rgba(16,185,129,0.08)' :
                    isWrongRight ? 'rgba(239,68,68,0.08)' :
                    'var(--bg-surface, #fff)',
                  cursor: used ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {pair.right}
                {used && <span style={{ marginLeft: 8, color: '#10b981' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wrong match feedback */}
      {wrongPair && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          fontSize: '0.85rem', fontWeight: 600,
        }}>
          {isHt ? '❌ Pa bon — eseye ankò!' : '❌ Not a match — try again!'}
        </div>
      )}

      {/* Completion */}
      {completed && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(16,185,129,0.1)', color: '#10b981',
          fontSize: '0.95rem', fontWeight: 600, textAlign: 'center',
        }}>
          🎉 {isHt ? 'Brav! Ou fini tout asosyasyon yo!' : 'Well done! You matched all pairs!'}
        </div>
      )}
    </div>
  );
}
