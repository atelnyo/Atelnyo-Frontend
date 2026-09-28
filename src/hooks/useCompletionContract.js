/**
 * useCompletionContract — §29-§31 Block Completion Contract
 *
 * Blocks that participate in lesson completion should report meaningful state.
 *
 * §29 — Possible states: not_started, in_progress, completed, passed, blocked
 * §30 — A block may be: Informational, Optional, Required
 * §31 — Not every block must affect progress equally
 *
 * The LearningNavigationEngine uses block completion rules.
 * Completion must be based on defined behavior, not assumptions.
 */
import { useCallback, useMemo, useState } from 'react';

/**
 * Completion modes:
 *   - 'none': block does not affect completion (informational)
 *   - 'viewed': block completes when rendered/viewed
 *   - 'answered': block completes when student provides any answer
 *   - 'correct': block completes only when answer is correct
 *   - 'passed': block completes when score meets threshold
 *   - 'submitted': block completes when student submits work
 *   - 'manual': block completes only via explicit server action
 */
export const COMPLETION_MODE = {
  NONE: 'none',
  VIEWED: 'viewed',
  ANSWERED: 'answered',
  CORRECT: 'correct',
  PASSED: 'passed',
  SUBMITTED: 'submitted',
  MANUAL: 'manual',
};

/**
 * Block requirement levels:
 *   - 'required': must be completed for lesson progress
 *   - 'optional': completing counts toward progress, but not required
 *   - 'informational': does not affect progress at all
 */
export const BLOCK_REQUIREMENT = {
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  INFORMATIONAL: 'informational',
};

/**
 * Progress weights:
 *   - required blocks: full weight (1.0)
 *   - optional blocks: partial weight (0.5)
 *   - informational blocks: no weight (0)
 */
const PROGRESS_WEIGHTS = {
  [BLOCK_REQUIREMENT.REQUIRED]: 1.0,
  [BLOCK_REQUIREMENT.OPTIONAL]: 0.5,
  [BLOCK_REQUIREMENT.INFORMATIONAL]: 0,
};

/**
 * useCompletionContract
 *
 * @param {Object} opts
 * @param {string} opts.blockId — block identifier
 * @param {string} opts.requirement — 'required' | 'optional' | 'informational'
 * @param {string} opts.completionMode — 'none' | 'viewed' | 'answered' | 'correct' | 'passed' | 'submitted' | 'manual'
 * @param {number} [opts.passThreshold] — for 'passed' mode: min score (0-1)
 * @param {Function} opts.onComplete — called when block completes: (result) => void
 *
 * @returns {{ completionState, progressWeight, markComplete, markInProgress, isComplete, canProgress }}
 */
export default function useCompletionContract({
  blockId,
  requirement = BLOCK_REQUIREMENT.REQUIRED,
  completionMode = COMPLETION_MODE.NONE,
  passThreshold = 1.0,
  onComplete,
}) {
  // §29 — Block completion state
  const [state, setState] = useState('not_started'); // not_started | in_progress | completed | passed | blocked

  const isComplete = state === 'completed' || state === 'passed';
  const progressWeight = PROGRESS_WEIGHTS[requirement] || 0;

  // §29 — Can the student proceed past this block?
  const canProgress = useMemo(() => {
    if (requirement === BLOCK_REQUIREMENT.INFORMATIONAL) return true;
    if (requirement === BLOCK_REQUIREMENT.OPTIONAL) return true; // optional blocks never block
    // Required blocks: can progress only if completed
    return isComplete;
  }, [requirement, isComplete]);

  const markInProgress = useCallback(() => {
    setState((prev) => (prev === 'not_started' ? 'in_progress' : prev));
  }, []);

  const markComplete = useCallback((result = {}) => {
    const { score, correct, passed } = result;

    let newState = 'completed';

    if (completionMode === COMPLETION_MODE.PASSED) {
      if (score != null && score >= passThreshold) {
        newState = 'passed';
      } else if (correct) {
        newState = 'passed';
      } else {
        newState = 'in_progress'; // not passed yet
      }
    } else if (completionMode === COMPLETION_MODE.CORRECT) {
      newState = correct ? 'completed' : 'in_progress';
    }

    setState((prev) => {
      if (prev === 'completed' || prev === 'passed') return prev; // don't regress
      return newState;
    });

    // §29 — Report to parent
    if (newState === 'completed' || newState === 'passed') {
      onComplete?.({
        blockId,
        state: newState,
        score,
        correct,
        passed: newState === 'passed',
        requirement,
        progressWeight,
      });
    }
  }, [blockId, completionMode, passThreshold, onComplete, requirement, progressWeight]);

  return {
    completionState: state,
    progressWeight,
    markComplete,
    markInProgress,
    isComplete,
    canProgress,
  };
}
