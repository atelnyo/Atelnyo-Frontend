/**
 * completionRules.js — §6-§8 Completion Rule Engine
 *
 * A flexible system to evaluate whether a lesson/module is complete.
 *
 * §6 — "Create or integrate a flexible Completion Rule system."
 * §7 — Different lessons have different requirements.
 * §8 — "Completion must represent actual defined requirements."
 *
 * Rule types:
 *   - all_required_blocks: all blocks marked as 'required' must be completed
 *   - specific_blocks: specific block IDs must be completed
 *   - assessment_passed: a specific assessment must be passed (score >= threshold)
 *   - min_score: total score across assessments must meet threshold
 *   - submission_saved: a required submission must be saved
 *   - manual: creator marks complete manually
 *
 * Usage:
 *   const result = evaluateCompletion({
 *     rules: lesson.completionRules,
 *     completedBlocks: new Set(['b1', 'b2']),
 *     blockRequirements: { b1: 'required', b2: 'required', b3: 'optional' },
 *     assessmentResults: { quiz1: { passed: true, score: 0.8 } },
 *   });
 *   // result: { complete: true, remaining: [], explanation: [...] }
 */

// ─── Rule Types ──────────────────────────────────────────────────

export const RULE_TYPE = {
  ALL_REQUIRED_BLOCKS: 'all_required_blocks',
  SPECIFIC_BLOCKS: 'specific_blocks',
  ASSESSMENT_PASSED: 'assessment_passed',
  MIN_SCORE: 'min_score',
  SUBMISSION_SAVED: 'submission_saved',
  MANUAL: 'manual',
};

// ─── Default Rules ───────────────────────────────────────────────

/**
 * Default completion rule: all required blocks must be completed.
 * This is the most common rule and matches the existing behavior.
 */
export const DEFAULT_RULE = {
  type: RULE_TYPE.ALL_REQUIRED_BLOCKS,
};

/**
 * Get the completion rules for a lesson.
 * Falls back to default rule if none specified.
 *
 * @param {Object} lesson - lesson/module object
 * @returns {Array<Object>} completion rules
 */
export function getCompletionRules(lesson) {
  if (!lesson) return [DEFAULT_RULE];

  // §6 — Support explicit completionRules array
  if (Array.isArray(lesson.completionRules) && lesson.completionRules.length > 0) {
    return lesson.completionRules;
  }

  // §6 — Support single completionRule
  if (lesson.completionRule) {
    return [lesson.completionRule];
  }

  // §6 — Infer from block requirements
  const blocks = lesson.blocks || [];
  const hasAssessment = blocks.some((b) =>
    ['quiz', 'multiple_choice', 'multiple_answer', 'true_false'].includes(b.type)
  );
  const hasRequired = blocks.some((b) => b.required !== false);

  if (hasAssessment) {
    return [
      { type: RULE_TYPE.ALL_REQUIRED_BLOCKS },
      { type: RULE_TYPE.ASSESSMENT_PASSED, assessmentType: 'quiz', threshold: 0.6 },
    ];
  }

  if (hasRequired) {
    return [{ type: RULE_TYPE.ALL_REQUIRED_BLOCKS }];
  }

  // No required blocks — just need to view/interact
  return [{ type: RULE_TYPE.ALL_REQUIRED_BLOCKS }];
}

// ─── Evaluation Engine ───────────────────────────────────────────

/**
 * Evaluate whether a lesson/module is complete based on its rules.
 *
 * @param {Object} params
 * @param {Array<Object>} params.rules - completion rules
 * @param {Set<string>} params.completedBlocks - set of completed block IDs
 * @param {Object} params.blockRequirements - { blockId: 'required' | 'optional' | 'informational' }
 * @param {Array<Object>} params.blocks - the block definitions
 * @param {Object} params.assessmentResults - { assessmentId: { passed, score, attempts } }
 * @param {Object} [params.submissionState] - { blockId: { saved: boolean } }
 *
 * @returns {{ complete: boolean, remaining: Array, explanation: Array, progress: number }}
 */
export function evaluateCompletion({
  rules = [DEFAULT_RULE],
  completedBlocks = new Set(),
  blockRequirements = {},
  blocks = [],
  assessmentResults = {},
  submissionState = {},
}) {
  const results = rules.map((rule) =>
    evaluateRule({
      rule,
      completedBlocks,
      blockRequirements,
      blocks,
      assessmentResults,
      submissionState,
    })
  );

  // §8 — ALL rules must pass for completion
  const allPassed = results.every((r) => r.passed);
  const remaining = results.filter((r) => !r.passed).flatMap((r) => r.remaining);
  const explanation = results.flatMap((r) => r.explanation);

  // Calculate progress (0-1)
  const requiredBlocks = blocks.filter((b) => {
    const req = blockRequirements[b.id];
    return req === 'required' || req === undefined; // default to required
  });
  const completedRequired = requiredBlocks.filter((b) => completedBlocks.has(b.id));
  const progress = requiredBlocks.length > 0
    ? completedRequired.length / requiredBlocks.length
    : 1;

  return {
    complete: allPassed,
    remaining,
    explanation,
    progress: Math.min(1, progress),
    ruleResults: results,
  };
}

/**
 * Evaluate a single completion rule.
 */
function evaluateRule({ rule, completedBlocks, blockRequirements, blocks, assessmentResults, submissionState }) {
  switch (rule.type) {
    case RULE_TYPE.ALL_REQUIRED_BLOCKS:
      return evaluateAllRequiredBlocks({ completedBlocks, blockRequirements, blocks });

    case RULE_TYPE.SPECIFIC_BLOCKS:
      return evaluateSpecificBlocks({ rule, completedBlocks });

    case RULE_TYPE.ASSESSMENT_PASSED:
      return evaluateAssessmentPassed({ rule, assessmentResults });

    case RULE_TYPE.MIN_SCORE:
      return evaluateMinScore({ rule, assessmentResults });

    case RULE_TYPE.SUBMISSION_SAVED:
      return evaluateSubmissionSaved({ rule, submissionState });

    case RULE_TYPE.MANUAL:
      return { passed: false, remaining: ['manual_completion'], explanation: ['Waiting for manual completion.'] };

    default:
      return { passed: true, remaining: [], explanation: [] };
  }
}

function evaluateAllRequiredBlocks({ completedBlocks, blockRequirements, blocks }) {
  const requiredBlocks = blocks.filter((b) => {
    const req = blockRequirements[b.id];
    return req === 'required' || (req === undefined && b.required !== false);
  });

  const remaining = requiredBlocks
    .filter((b) => !completedBlocks.has(b.id))
    .map((b) => b.id);

  const explanation = [];
  if (remaining.length === 0) {
    explanation.push('All required activities completed.');
  } else {
    explanation.push(`${remaining.length} required ${remaining.length === 1 ? 'activity' : 'activities'} remaining.`);
  }

  return {
    passed: remaining.length === 0,
    remaining,
    explanation,
  };
}

function evaluateSpecificBlocks({ rule, completedBlocks }) {
  const requiredIds = rule.blockIds || [];
  const remaining = requiredIds.filter((id) => !completedBlocks.has(id));

  return {
    passed: remaining.length === 0,
    remaining,
    explanation: remaining.length === 0
      ? ['All specified activities completed.']
      : [`${remaining.length} specified ${remaining.length === 1 ? 'activity' : 'activities'} remaining.`],
  };
}

function evaluateAssessmentPassed({ rule, assessmentResults }) {
  const assessmentId = rule.assessmentId || 'quiz';
  const threshold = rule.threshold || 0.6;
  const result = assessmentResults[assessmentId];

  if (!result) {
    return {
      passed: false,
      remaining: [assessmentId],
      explanation: ['Assessment not yet attempted.'],
    };
  }

  const passed = result.passed || (result.score != null && result.score >= threshold);

  return {
    passed,
    remaining: passed ? [] : [assessmentId],
    explanation: passed
      ? [`Assessment passed (score: ${Math.round((result.score || 0) * 100)}%).`]
      : [`Assessment score ${Math.round((result.score || 0) * 100)}% — minimum ${Math.round(threshold * 100)}% required.`],
  };
}

function evaluateMinScore({ rule, assessmentResults }) {
  const threshold = rule.threshold || 0.6;
  const assessmentIds = rule.assessmentIds || Object.keys(assessmentResults);

  let totalScore = 0;
  let count = 0;

  for (const id of assessmentIds) {
    const result = assessmentResults[id];
    if (result && result.score != null) {
      totalScore += result.score;
      count++;
    }
  }

  const avgScore = count > 0 ? totalScore / count : 0;
  const passed = avgScore >= threshold;

  return {
    passed,
    remaining: passed ? [] : ['min_score'],
    explanation: passed
      ? [`Average score ${Math.round(avgScore * 100)}% meets minimum ${Math.round(threshold * 100)}%.`]
      : [`Average score ${Math.round(avgScore * 100)}% — minimum ${Math.round(threshold * 100)}% required.`],
  };
}

function evaluateSubmissionSaved({ rule, submissionState }) {
  const blockId = rule.blockId;
  const state = submissionState[blockId];
  const saved = state?.saved || false;

  return {
    passed: saved,
    remaining: saved ? [] : [blockId],
    explanation: saved
      ? ['Required submission saved.']
      : ['Required submission not yet saved.'],
  };
}

// ─── Lesson Completion State ──────────────────────────────────────

/**
 * Determine the lesson completion state.
 *
 * @param {Object} params
 * @param {boolean} params.complete - from evaluateCompletion
 * @param {boolean} params.started - any block completed or viewed
 * @param {boolean} params.locked - lesson is locked
 *
 * @returns {'not_started' | 'in_progress' | 'completed' | 'locked'}
 */
export function getLessonState({ complete, started, locked }) {
  if (locked) return 'locked';
  if (complete) return 'completed';
  if (started) return 'in_progress';
  return 'not_started';
}
