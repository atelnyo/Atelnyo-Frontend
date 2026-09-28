/**
 * src/components/learning/blocks/ChecklistBlock.jsx
 *
 * Interactive checklist block — learners check off items as they
 * complete them. Useful for course prerequisites, study plans,
 * project milestones, or self-assessment checklists.
 *
 * Block data shape:
 *   { id, type: 'checklist', title, items: [{ text, required? }], description }
 *
 * Reports completion when all required items are checked.
 */
import React, { useState, useCallback, useEffect } from 'react';

export default function ChecklistBlock({
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
  const items = Array.isArray(block.items) ? block.items : [];
  const [checked, setChecked] = useState({});

  useEffect(() => {
    onViewed?.(block.id);
  }, [block.id, onViewed]);

  const requiredCount = items.filter((it) => it.required !== false).length;
  const checkedCount = Object.keys(checked).filter((k) => checked[k]).length;
  const allRequiredDone = items.every((it, i) => it.required === false || checked[i]);

  // Report completion when all required items are checked
  useEffect(() => {
    if (items.length > 0 && allRequiredDone && checkedCount > 0) {
      reportComplete?.();
    }
  }, [allRequiredDone, checkedCount, items.length, block.id, onComplete]);

  const toggle = useCallback((idx) => {
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  return (
    <div className="ls-block ls-block--checklist" data-block-type="checklist">
      {/* Header */}
      <div className="ls-block-header">
        <span className="ls-block-badge">✅ {isHt ? 'Tcheklis' : 'Checklist'}</span>
        <h3 className="ls-block-title">{block.title || (isHt ? 'Tcheklis' : 'Checklist')}</h3>
      </div>

      {/* Description */}
      {block.description && (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {block.description}
        </p>
      )}

      {/* Progress bar — Phase 10: accessible with text equivalent */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
          <span>{checkedCount} / {items.length} {isHt ? 'fè' : 'done'}</span>
          <span>{requiredCount} {isHt ? 'oblije' : 'required'}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={checkedCount}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-label={isHt
            ? `Pwogrè: ${checkedCount} sou ${items.length} fè`
            : `Progress: ${checkedCount} of ${items.length} done`}
          style={{
            height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.25)', overflow: 'hidden',
          }}
        >
          <div style={{
            width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%`,
            height: '100%', borderRadius: 3,
            background: allRequiredDone ? '#10b981' : 'var(--color-primary, #2563eb)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => {
          const isChecked = Boolean(checked[i]);
          const isRequired = item.required !== false;
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              aria-label={`${item.text || ''}${isRequired ? (isHt ? ' — oblije' : ' — required') : ''}`}
              onClick={() => toggle(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${isChecked ? '#10b981' : 'var(--border-subtle, #e2e8f0)'}`,
                background: isChecked ? 'rgba(16,185,129,0.06)' : 'var(--bg-surface, #fff)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s ease',
                minHeight: '44px',
                fontFamily: 'inherit',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                border: `2px solid ${isChecked ? '#10b981' : 'var(--border-subtle, #cbd5e1)'}`,
                background: isChecked ? '#10b981' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s ease',
              }}>
                {isChecked && <i className="fas fa-check" style={{ color: '#fff', fontSize: '0.7rem' }} />}
              </div>
              {/* Text */}
              <span style={{
                flex: 1, fontSize: '0.95rem',
                textDecoration: isChecked ? 'line-through' : 'none',
                color: isChecked ? 'var(--text-secondary)' : 'var(--text-primary)',
              }}>
                {item.text || ''}
              </span>
              {/* Required badge */}
              {isRequired && (
                <span style={{
                  fontSize: '0.7rem', color: '#ef4444', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                  {isHt ? 'oblije' : 'req'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {items.length === 0 && (
        <p style={{ padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
          {isHt ? 'Pa gen bagay nan tcheklis la.' : 'No items in the checklist.'}
        </p>
      )}

      {/* Completion message */}
      {allRequiredDone && checkedCount > 0 && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 8,
          background: 'rgba(16,185,129,0.1)', color: '#10b981',
          fontSize: '0.9rem', fontWeight: 600, textAlign: 'center',
        }}>
          🎉 {isHt ? 'Ou fini tout bagay yo!' : 'You completed everything!'}
        </div>
      )}
    </div>
  );
}
