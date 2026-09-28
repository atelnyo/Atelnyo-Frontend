/**
 * QuestionBase — §14-§19 Shared Question Block Foundation
 *
 * All question types extend this common model:
 *   - Question text
 *   - Description (optional)
 *   - Required flag
 *   - Feedback configuration
 *   - Attempts configuration
 *   - Completion rule
 *   - Correct answer(s)
 *   - Scoring configuration
 *
 * §18 — Feedback should be educational, not merely "Correct/Wrong".
 * §19 — Separate: Answered, Completed, Correct, Passed.
 *
 * Usage:
 *   <QuestionBase
 *     question="What is 2+2?"
 *     description="Choose the correct answer."
 *     options={[{ text: '3', id: 'a' }, { text: '4', id: 'b' }]}
 *     correctIds={['b']}
 *     multiple={false}
 *     feedback={{ correct: 'Well done!', incorrect: 'Think again.' }}
 *     onComplete={(result) => ...}
 *   />
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { saveDraft, restoreDraft } from '../../../services/learningDraftManager';

/**
 * QuestionBase — renders a question with options, feedback, and completion.
 *
 * @param {Object} props
 * @param {string} props.question — the question text
 * @param {string} [props.description] — additional context
 * @param {Array<{ id: string, text: string }>} props.options — answer options
 * @param {string[]} props.correctIds — IDs of correct answers
 * @param {boolean} [props.multiple=false] — true for multiple-answer questions
 * @param {Object} [props.feedback] — { correct, incorrect, explanation }
 * @param {boolean} [props.required=true] — whether answering is required
 * @param {number} [props.maxAttempts=0] — 0 = unlimited
 * @param {string} [props.completionRule='answered'] — 'answered' | 'correct' | 'passed'
 * @param {number} [props.passThreshold=1] — for 'passed' rule: min correct count
 * @param {Function} props.onComplete — (result: { answered, correct, passed, attempts, answer }) => void
 * @param {string} [props.lang='ht'] — language
 */
export default function QuestionBase({
  question,
  description,
  options = [],
  correctIds = [],
  multiple = false,
  feedback,
  required = true,
  maxAttempts = 0,
  completionRule = 'answered',
  passThreshold = 1,
  onComplete,
  lang = 'ht',
}) {
  const isHt = lang === 'ht';

  // §20 — Assessment state
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const completedRef = useRef(false);

  // §28 — Auto-save selections to draftStore (debounced)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (submitted || selectedIds.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // Use a composite key based on question text (stable identity)
      const blockId = `q_${btoa(question || '').slice(0, 20)}`;
      saveDraft({
        courseId: 'quiz', // quiz-level draft
        lessonId: 'responses',
        blockId,
        data: { selectedIds, attempts },
      }).catch(() => {});
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [selectedIds, attempts, submitted, question]);

  // §28 — Restore selections from draft on mount
  useEffect(() => {
    const blockId = `q_${btoa(question || '').slice(0, 20)}`;
    restoreDraft({
      courseId: 'quiz',
      lessonId: 'responses',
      blockId,
    }).then((result) => {
      if (result.ok && result.draft?.data?.selectedIds?.length > 0 && !submitted) {
        setSelectedIds(result.draft.data.selectedIds);
      }
    }).catch(() => {});
  }, [question]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate correctness
  const correctSet = new Set(correctIds);
  const selectedSet = new Set(selectedIds);
  const isCorrect = correctIds.length > 0
    && selectedIds.length === correctIds.length
    && selectedIds.every((id) => correctSet.has(id));

  // §19 — Completion vs Correctness
  const isAnswered = selectedIds.length > 0;
  const isCompleted = submitted && (
    completionRule === 'answered'
    || (completionRule === 'correct' && isCorrect)
    || (completionRule === 'passed' && isCorrect)
  );
  const isPassed = completionRule === 'passed'
    ? isCorrect
    : isCorrect; // For non-passed rules, correctness = passed

  const handleSelect = useCallback((id) => {
    if (submitted) return;
    setSelectedIds((prev) => {
      if (multiple) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return [id];
    });
  }, [multiple, submitted]);

  const handleSubmit = useCallback(() => {
    if (submitted || selectedIds.length === 0) return;
    setSubmitted(true);
    setAttempts((a) => a + 1);
    setShowFeedback(true);

    const result = {
      answered: true,
      correct: isCorrect,
      passed: isPassed,
      attempts: attempts + 1,
      answer: selectedIds,
    };

    // §29 — Report completion
    if (isCompleted && !completedRef.current) {
      completedRef.current = true;
      onComplete?.(result);
    }
  }, [submitted, selectedIds, isCorrect, isPassed, attempts, isCompleted, onComplete]);

  const handleRetry = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    setSubmitted(false);
    setSelectedIds([]);
    setShowFeedback(false);
  }, [attempts, maxAttempts]);

  // Determine feedback text
  const feedbackText = isCorrect
    ? (feedback?.correct || (isHt ? 'Repons ou korek!' : 'Your answer is correct!'))
    : (feedback?.incorrect || (isHt ? 'Pa egzakteman. Eseye ankò.' : 'Not quite. Try again.'));

  return (
    <div className="ls-question" role="group" aria-label={isHt ? 'Kesyon' : 'Question'}>
      {/* §14 — Question text */}
      <div className="ls-question-header">
        <h3 className="ls-question-text">{question}</h3>
        {description && (
          <p className="ls-question-description">{description}</p>
        )}
      </div>

      {/* §15-§17 — Answer options */}
      <div className="ls-question-options" role={multiple ? 'group' : 'radiogroup'} aria-label={isHt ? 'Repons' : 'Answers'}>
        {options.map((opt) => {
          const isSelected = selectedIds.includes(opt.id);
          const isCorrectOption = correctSet.has(opt.id);
          const showCorrectHighlight = submitted && isCorrectOption;
          const showWrongHighlight = submitted && isSelected && !isCorrectOption;

          return (
            <button
              key={opt.id}
              type="button"
              className={`ls-question-option ${isSelected ? 'is-selected' : ''} ${showCorrectHighlight ? 'is-correct' : ''} ${showWrongHighlight ? 'is-wrong' : ''} ${submitted ? 'is-submitted' : ''}`}
              onClick={() => handleSelect(opt.id)}
              disabled={submitted}
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              aria-label={opt.text}
            >
              <span className="ls-question-option-indicator">
                {multiple ? (
                  <i className={`fas ${isSelected ? 'fa-check-square' : 'fa-square'}`} aria-hidden="true" />
                ) : (
                  <i className={`fas ${isSelected ? 'fa-dot-circle' : 'fa-circle'}`} aria-hidden="true" />
                )}
              </span>
              <span className="ls-question-option-text">{opt.text}</span>
              {showCorrectHighlight && (
                <i className="fas fa-check ls-question-option-icon" aria-hidden="true" />
              )}
              {showWrongHighlight && (
                <i className="fas fa-times ls-question-option-icon" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* §15 — Submit / Retry */}
      <div className="ls-question-actions">
        {!submitted ? (
          <button
            type="button"
            className="ls-btn ls-btn--primary"
            onClick={handleSubmit}
            disabled={selectedIds.length === 0}
          >
            {isHt ? 'Soumèt' : 'Submit'}
          </button>
        ) : (
          maxAttempts === 0 || attempts < maxAttempts ? (
            <button
              type="button"
              className="ls-btn"
              onClick={handleRetry}
            >
              <i className="fas fa-rotate-right" aria-hidden="true" />
              {isHt ? 'Eseye ankò' : 'Try again'}
            </button>
          ) : null
        )}
      </div>

      {/* §18 — Feedback (educational, not shaming) */}
      {showFeedback && (
        <div className={`ls-question-feedback ${isCorrect ? 'is-correct' : 'is-incorrect'}`} role="status">
          <i className={`fas ${isCorrect ? 'fa-check-circle' : 'fa-info-circle'}`} aria-hidden="true" />
          <span>{feedbackText}</span>
          {feedback?.explanation && (
            <p className="ls-question-feedback-explanation">{feedback.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
