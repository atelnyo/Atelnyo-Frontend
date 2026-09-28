/**
 * src/components/studio/editor/ContentStructureView.jsx
 *
 * Content Structure View — shows the heading hierarchy of a course.
 *
 * Part of Phase 10 — Accessibility Preview in Creator Studio.
 * Helps creators understand the document structure without requiring
 * knowledge of HTML.
 *
 * Shows:
 *   - Course title (H1)
 *   - Modules (H2)
 *   - Lessons (H3)
 *   - Sections (H4)
 *   - Accessibility status per heading level
 *
 * Usage:
 *   <ContentStructureView
 *     chapters={chapters}
 *     lang="en"
 *   />
 */
import React, { useMemo } from 'react';
import { t2 } from '../../../utils/i18n';

export default function ContentStructureView({
  chapters = [],
  lang = 'ht',
  courseTitle = '',
  className = '',
}) {
  const isHt = lang === 'ht';

  const structure = useMemo(() => {
    const items = [];

    // H1 — Course title
    if (courseTitle) {
      items.push({ level: 1, label: courseTitle, type: 'course' });
    }

    // H2 → H3 → H4 — Chapter → Lesson → Block headings
    chapters.forEach((chapter, ci) => {
      items.push({
        level: 2,
        label: chapter.title || `${isHt ? 'Modil' : 'Chapter'} ${ci + 1}`,
        type: 'chapter',
      });

      (chapter.lessons || []).forEach((lesson, li) => {
        items.push({
          level: 3,
          label: lesson.title || `${isHt ? 'Leson' : 'Lesson'} ${li + 1}`,
          type: 'lesson',
        });

        // Check for heading blocks within the lesson
        (lesson.blocks || []).forEach((block) => {
          if (block.type === 'text' && block.headingLevel) {
            const level = Math.min(Number(block.headingLevel) + 2, 6); // Offset from course structure
            items.push({
              level,
              label: (block.content || '').replace(/<[^>]*>/g, '').slice(0, 60) || `${isHt ? 'Tit' : 'Heading'}`,
              type: 'block',
            });
          }
        });
      });
    });

    return items;
  }, [chapters, courseTitle, isHt]);

  // Check for hierarchy issues
  const issues = useMemo(() => {
    const result = [];
    let lastLevel = 0;

    structure.forEach((item, i) => {
      if (item.level > lastLevel + 1 && lastLevel > 0) {
        result.push({
          index: i,
          message: isHt
            ? `Tèt H${item.level} sove H${lastLevel} — konsidere itilize H${lastLevel + 1}`
            : `Heading H${item.level} skips H${lastLevel} — consider using H${lastLevel + 1}`,
        });
      }
      lastLevel = item.level;
    });

    return result;
  }, [structure, isHt]);

  return (
    <div className={`a11y-structure-view ${className}`} role="region" aria-label={isHt ? 'Istati Kontni' : 'Content Structure'}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color-subtle, rgba(0,0,0,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <i className="fas fa-heading" aria-hidden="true" style={{ color: 'var(--color-primary, #d81b60)' }} />
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
          {isHt ? 'Istati Tèt' : 'Heading Structure'}
        </span>
        {issues.length > 0 && (
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '999px',
            background: 'rgba(245,158,11,0.1)',
            color: 'var(--state-warning, #d97706)',
          }}>
            {issues.length} {isHt ? 'pwoblèm' : 'issues'}
          </span>
        )}
      </div>

      <div style={{ padding: '8px 0', maxHeight: '400px', overflow: 'auto' }}>
        {structure.length === 0 ? (
          <p style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isHt ? 'Pa gen kontni ankò.' : 'No content yet.'}
          </p>
        ) : (
          structure.map((item, i) => {
            const indent = (item.level - 1) * 16;
            const hasIssue = issues.some((iss) => iss.index === i);
            const levelColors = {
              1: 'var(--color-primary, #d81b60)',
              2: 'var(--state-info, #0ea5e9)',
              3: 'var(--state-success, #10b981)',
              4: 'var(--state-warning, #f59e0b)',
              5: 'var(--pr-color-violet-500, #8b5cf6)',
              6: 'var(--pr-color-gray-500, #999)',
            };

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 16px',
                  paddingLeft: `${16 + indent}px`,
                  fontSize: item.level <= 2 ? '0.85rem' : '0.8rem',
                  fontWeight: item.level <= 2 ? 700 : 500,
                  color: hasIssue ? 'var(--state-warning, #d97706)' : 'var(--text-primary)',
                  background: hasIssue ? 'rgba(245,158,11,0.04)' : 'transparent',
                }}
              >
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: `${levelColors[item.level] || '#999'}15`,
                  color: levelColors[item.level] || '#999',
                  minWidth: '22px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  H{item.level}
                </span>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </span>
                {hasIssue && (
                  <i className="fas fa-exclamation-triangle" aria-hidden="true"
                    style={{ fontSize: '0.7rem', color: 'var(--state-warning)', flexShrink: 0 }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
