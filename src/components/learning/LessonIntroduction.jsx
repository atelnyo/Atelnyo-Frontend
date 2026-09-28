/**
 * LessonIntroduction — §25-§26 Learning Objectives
 *
 * A calm, clear beginning for each lesson. Answers:
 *   What am I learning now?
 *
 * Structure:
 *   - Lesson title (semantic <h2>)
 *   - Short introduction (optional)
 *   - Learning objectives (optional)
 *   - Estimated activity or context (optional)
 *
 * Not every lesson uses every section. The layout supports optional
 * sections naturally.
 */
import React from 'react';

export default function LessonIntroduction({
  title,
  introduction,
  objectives = [],
  estimatedTime,
  lang = 'ht',
  className = '',
  hideTitle = false, // when the session header already shows the title
}) {
  const isHt = lang === 'ht';
  const hasObjectives = Array.isArray(objectives) && objectives.length > 0;

  return (
    <div className={`ls-lesson-intro ${className}`} role="region" aria-label={isHt ? 'Entwodiksyon leson' : 'Lesson introduction'}>
      {/* §25 — Lesson Title */}
      {title && !hideTitle && (
        <h2 className="ls-lesson-intro-title">{title}</h2>
      )}

      {/* Short introduction */}
      {introduction && (
        <p className="ls-lesson-intro-objective">{introduction}</p>
      )}

      {/* §26 — Learning Objectives */}
      {hasObjectives && (
        <div className="ls-lesson-intro-objectives">
          <p className="ls-lesson-intro-objectives-label">
            {isHt
              ? 'Nan fen leson sa a, ou pral kapab:'
              : 'By the end of this lesson, you will be able to:'}
          </p>
          <ul className="ls-lesson-intro-objectives-list">
            {objectives.map((obj, i) => (
              <li key={i} className="ls-lesson-intro-objectives-item">
                <i className="fas fa-check-circle" aria-hidden="true" />
                <span>{typeof obj === 'string' ? obj : obj.text || obj}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Estimated time / meta */}
      {estimatedTime && (
        <div className="ls-lesson-intro-meta">
          <i className="fas fa-clock" aria-hidden="true" />
          <span>
            {isHt
              ? `~${estimatedTime} min li ak pratike`
              : `~${estimatedTime} min reading & practice`}
          </span>
        </div>
      )}
    </div>
  );
}
