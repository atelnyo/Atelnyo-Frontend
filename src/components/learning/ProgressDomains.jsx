/**
 * ProgressDomains — §2 Progress Domains
 *
 * Separate progress into distinct domains:
 *   - Learning Progress: how much required learning content completed
 *   - Assessment Progress: assessment completion and results
 *   - Activity Progress: interactive exercises and practical work
 *   - Optional Progress: optional content completed
 *
 * §2 — "Do not force all of these into one percentage."
 * §11 — "The primary progress shown to students should usually represent:
 *         Required Course Completion Progress."
 */
import React from 'react';

/**
 * @param {Object} props
 * @param {Array} props.blocks - all blocks in the module/course
 * @param {Set|Array} props.completedBlocks - completed block IDs
 * @param {Object} [props.assessmentResults] - { id: { passed, score } }
 * @param {string} [props.lang='ht']
 * @param {boolean} [props.compact=false]
 */
export default function ProgressDomains({
  blocks = [],
  completedBlocks,
  assessmentResults = {},
  lang = 'ht',
  compact = false,
}) {
  const isHt = lang === 'ht';
  const completedSet = completedBlocks instanceof Set
    ? completedBlocks
    : Array.isArray(completedBlocks)
      ? new Set(completedBlocks)
      : new Set();

  // Classify blocks by domain
  const domains = React.useMemo(() => {
    const learning = []; // text, image, video, callout, embed, timeline
    const assessment = []; // quiz, multiple_choice, multiple_answer, true_false, assignment
    const activity = []; // exercise, reflection, scenario, calculator, code_exercise, matching, fill_blank, checklist
    const optional = []; // blocks with required === false

    const ASSESSMENT_TYPES = new Set(['quiz', 'multiple_choice', 'multiple_answer', 'true_false', 'assignment', 'project']);
    const ACTIVITY_TYPES = new Set(['exercise', 'reflection', 'scenario', 'calculator', 'code_exercise', 'matching', 'fill_blank', 'checklist', 'vocabulary', 'repeat', 'pronunciation', 'speaking', 'listening', 'conversation', 'audio_record']);

    blocks.forEach((block) => {
      if (block.required === false) {
        optional.push(block);
      } else if (ASSESSMENT_TYPES.has(block.type)) {
        assessment.push(block);
      } else if (ACTIVITY_TYPES.has(block.type)) {
        activity.push(block);
      } else {
        learning.push(block);
      }
    });

    return { learning, assessment, activity, optional };
  }, [blocks]);

  // Calculate domain progress
  const calcDomainProgress = (domainBlocks) => {
    if (domainBlocks.length === 0) return null;
    const done = domainBlocks.filter((b) => completedSet.has(b.id)).length;
    return { done, total: domainBlocks.length, pct: Math.round((done / domainBlocks.length) * 100) };
  };

  const learningProgress = calcDomainProgress(domains.learning);
  const assessmentProgress = calcDomainProgress(domains.assessment);
  const activityProgress = calcDomainProgress(domains.activity);
  const optionalProgress = calcDomainProgress(domains.optional);

  const domainConfig = [
    { key: 'learning', label: isHt ? 'Kontni' : 'Content', progress: learningProgress, icon: 'fa-book-open', color: '#3b82f6' },
    { key: 'assessment', label: isHt ? 'Evalyasyon' : 'Assessment', progress: assessmentProgress, icon: 'fa-clipboard-check', color: '#8b5cf6' },
    { key: 'activity', label: isHt ? 'Aktivite' : 'Activity', progress: activityProgress, icon: 'fa-dumbbell', color: '#10b981' },
    { key: 'optional', label: isHt ? 'Opsyonèl' : 'Optional', progress: optionalProgress, icon: 'fa-star', color: '#f59e0b' },
  ].filter((d) => d.progress !== null);

  if (domainConfig.length === 0) return null;

  return (
    <div className="ls-progress-domains" role="list" aria-label={isHt ? 'Pwogrè pa domèn' : 'Progress by domain'}>
      {domainConfig.map(({ key, label, progress, icon, color }) => (
        <div key={key} className="ls-progress-domain" role="listitem">
          <div className="ls-progress-domain-header">
            <i className={`fas ${icon}`} style={{ color, fontSize: '0.78rem' }} aria-hidden="true" />
            <span className="ls-progress-domain-label">{label}</span>
            <span className="ls-progress-domain-count">{progress.done}/{progress.total}</span>
          </div>
          <div className="ls-progress-domain-bar" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="ls-progress-domain-fill" style={{ width: `${progress.pct}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
