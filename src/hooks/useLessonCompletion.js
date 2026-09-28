/**
 * useLessonCompletion — §6-§8 Lesson Completion Evaluation
 *
 * Integrates the Completion Rule Engine with the existing progress system.
 * Evaluates whether a lesson/module is complete based on configured rules.
 *
 * §6 — Flexible completion rules per lesson.
 * §7 — Different lessons have different requirements.
 * §8 — Completion represents actual defined requirements.
 *
 * Usage:
 *   const { isComplete, progress, remaining, explanation } = useLessonCompletion({
 *     blocks: module.blocks,
 *     completedBlocks: completedBlocksMap[moduleIndex],
 *     rules: module.completionRules,
 *   });
 */
import { useMemo } from 'react';
import {
  evaluateCompletion,
  getCompletionRules,
  getLessonState,
} from '../components/learning/completionRules';

/**
 * useLessonCompletion
 *
 * @param {Object} params
 * @param {Array} params.blocks - block definitions for the lesson/module
 * @param {Set<string>|Array<string>} params.completedBlocks - completed block IDs
 * @param {Array<Object>} [params.rules] - completion rules (optional, auto-inferred)
 * @param {Object} [params.assessmentResults] - { assessmentId: { passed, score } }
 * @param {Object} [params.submissionState] - { blockId: { saved: boolean } }
 * @param {boolean} [params.locked=false] - whether the lesson is locked
 *
 * @returns {{ isComplete, progress, remaining, explanation, state, rules }}
 */
export default function useLessonCompletion({
  blocks = [],
  completedBlocks,
  rules,
  assessmentResults = {},
  submissionState = {},
  locked = false,
}) {
  // Convert completedBlocks to Set if it's an array
  const completedSet = useMemo(() => {
    if (completedBlocks instanceof Set) return completedBlocks;
    if (Array.isArray(completedBlocks)) return new Set(completedBlocks);
    return new Set();
  }, [completedBlocks]);

  // Build block requirements map
  const blockRequirements = useMemo(() => {
    const reqs = {};
    blocks.forEach((b) => {
      reqs[b.id] = b.required === false ? 'optional' : 'required';
    });
    return reqs;
  }, [blocks]);

  // Get completion rules (auto-infer if not provided)
  const completionRules = useMemo(() => {
    if (rules && rules.length > 0) return rules;
    return getCompletionRules({ blocks });
  }, [rules, blocks]);

  // Evaluate completion
  const result = useMemo(() => {
    // §8 — Don't evaluate if locked
    if (locked) {
      return {
        complete: false,
        progress: 0,
        remaining: blocks.filter((b) => b.required !== false).map((b) => b.id),
        explanation: ['This lesson is locked.'],
        state: 'locked',
        rules: completionRules,
      };
    }

    const evalResult = evaluateCompletion({
      rules: completionRules,
      completedBlocks: completedSet,
      blockRequirements,
      blocks,
      assessmentResults,
      submissionState,
    });

    // Determine if any interaction has happened
    const started = completedSet.size > 0 || Object.keys(assessmentResults).length > 0;

    const state = getLessonState({
      complete: evalResult.complete,
      started,
      locked,
    });

    return {
      ...evalResult,
      state,
      rules: completionRules,
    };
  }, [completedSet, blockRequirements, blocks, completionRules, assessmentResults, submissionState, locked]);

  return result;
}
