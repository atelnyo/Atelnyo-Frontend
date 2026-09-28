/**
 * TimelineBlock — Visual timeline for step-by-step plans.
 * Shows tasks with completion state and progress.
 */
import React, { useState, useEffect } from 'react';

export default function TimelineBlock({ block, lang = 'ht', onComplete }) {
  const isHt = lang === 'ht';
  const items = block?.items || block?.tasks || [];
  const [completed, setCompleted] = useState({});

  useEffect(() => {
    try {
      const key = `timeline_draft_${block?.id}`;
      const saved = localStorage.getItem(key);
      if (saved) setCompleted(JSON.parse(saved));
    } catch (e) {}
  }, [block?.id]);

  const toggle = (index) => {
    const next = { ...completed, [index]: !completed[index] };
    setCompleted(next);
    try {
      localStorage.setItem(`timeline_draft_${block?.id}`, JSON.stringify(next));
    } catch (e) {}

    const doneCount = Object.values(next).filter(Boolean).length;
    if (doneCount === items.length && onComplete) {
      onComplete({ completed: next });
    }
  };

  const doneCount = Object.values(completed).filter(Boolean).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="timeline-block" style={{
      background: '#fce4ec',
      border: '2px solid #e91e63',
      borderRadius: '12px',
      padding: '24px',
      margin: '16px 0',
    }}>
      <h3 style={{ margin: '0 0 12px', color: '#880e4f' }}>
        📅 {block?.title || (isHt ? 'Tanbwa' : 'Timeline')}
      </h3>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1, height: '12px', background: '#f8bbd0', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#e91e63', borderRadius: '6px', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#880e4f' }}>{doneCount}/{items.length}</span>
      </div>
      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((item, i) => {
          const done = !!completed[i];
          const text = typeof item === 'string' ? item : item.task || item.text || '';
          const day = item.day || (i + 1);
          return (
            <div key={i} onClick={() => toggle(i)} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
              background: done ? '#e8f5e9' : '#fff',
              border: `1px solid ${done ? '#4caf50' : '#f8bbd0'}`,
              transition: 'all 0.2s',
            }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700', flexShrink: 0,
                background: done ? '#4caf50' : '#fce4ec',
                color: done ? '#fff' : '#880e4f',
              }}>
                {done ? '✓' : day}
              </span>
              <span style={{
                fontSize: '14px', textDecoration: done ? 'line-through' : 'none',
                color: done ? '#888' : '#333',
              }}>
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
