/**
 * ProgressExplanation — §38-§39 Progress Explanation UX
 *
 * Helps the student understand what remains to complete a lesson/module.
 *
 * §38 — "Critical completion state should be explainable."
 * §39 — "Where appropriate, help the student understand what remains."
 *
 * Example:
 *   To complete this module:
 *   ✓ Lesson 1
 *   ✓ Lesson 2
 *   ○ Complete Customer Exercise
 *
 * §39 — "Do not expose unnecessary internal technical data.
 * Translate completion requirements into useful actions."
 */
import React from 'react';

/**
 * ProgressExplanation
 *
 * @param {Object} props
 * @param {Array} props.blocks - block definitions
 * @param {Set|Array} props.completedBlocks - completed block IDs
 * @param {Object} [props.blockRequirements] - { blockId: 'required' | 'optional' | 'informational' }
 * @param {string} [props.lang='ht'] - language
 * @param {boolean} [props.compact=false] - show minimal version
 */
export default function ProgressExplanation({
  blocks = [],
  completedBlocks,
  blockRequirements = {},
  lang = 'ht',
  compact = false,
}) {
  const isHt = lang === 'ht';

  // Convert to Set
  const completedSet = completedBlocks instanceof Set
    ? completedBlocks
    : Array.isArray(completedBlocks)
      ? new Set(completedBlocks)
      : new Set();

  // Filter to required blocks only (skip informational)
  const requiredBlocks = blocks.filter((b) => {
    const req = blockRequirements[b.id] ?? (b.required === false ? 'optional' : 'required');
    return req === 'required';
  });

  if (requiredBlocks.length === 0) return null;

  const completedCount = requiredBlocks.filter((b) => completedSet.has(b.id)).length;
  const totalCount = requiredBlocks.length;
  const allDone = completedCount >= totalCount;

  if (compact) {
    return (
      <span className="ls-progress-explanation-compact" aria-label={
        isHt ? `${completedCount} sou ${totalCount} aktivite konplete` : `${completedCount} of ${totalCount} activities completed`
      }>
        {completedCount}/{totalCount}
      </span>
    );
  }

  return (
    <div className="ls-progress-explanation" role="list" aria-label={
      isHt ? 'Sa ki rete pou konplete' : 'What remains to complete'
    }>
      <h4 className="ls-progress-explanation-title">
        {allDone
          ? (isHt ? '✅ Tout aktivite yo konplete!' : '✅ All activities completed!')
          : (isHt ? `Pou konplete modil sa a:` : `To complete this module:`)}
      </h4>
      <ul className="ls-progress-explanation-list">
        {requiredBlocks.map((block) => {
          const isDone = completedSet.has(block.id);
          const label = block.title || block.type || block.id;
          return (
            <li
              key={block.id}
              className={`ls-progress-explanation-item ${isDone ? 'is-done' : ''}`}
              role="listitem"
            >
              <span className="ls-progress-explanation-check" aria-hidden="true">
                {isDone ? '✓' : '○'}
              </span>
              <span className="ls-progress-explanation-label">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
