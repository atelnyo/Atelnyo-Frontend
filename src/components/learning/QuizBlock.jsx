/**
 * src/components/learning/QuizBlock.jsx
 *
 * Learner-side quiz renderer — REAL backend (Quiz / QuizQuestion /
 * QuizAttempt). Renders the quizzes attached to one course module,
 * lets the learner answer, submits through quizAttemptService.submit
 * and shows the REAL score + pass/fail computed server-side.
 *
 * • Answers are kept locally until submit (no fake intermediate
 *   scoring, no per-click "correct/wrong" leaks before submission).
 * • After the first attempt, the learner can retake the quiz (the
 *   backend stores every attempt; the newest is shown here).
 * • If the quiz has no questions yet, we say so honestly instead of
 *   pretending there is something to take.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { quizService, quizAttemptService } from '../../services/api';
import { playChime } from '../../utils/celebrate';
import { saveDraft, restoreDraft, removeDraft } from '../../services/learningDraftManager';
import styles from './learning.module.css';

// ─── Quiz answer persistence via draftStore (§9, §28) ───────────
// Migrated from raw localStorage to draftStore primitive for proper
// account isolation and quota handling.
function saveQuizAnswers(courseId, moduleIndex, answers) {
  if (!courseId && courseId !== 0) return Promise.resolve();
  const blockId = `quiz_${moduleIndex}`;
  return saveDraft({
    courseId: String(courseId),
    lessonId: String(moduleIndex),
    blockId,
    data: { answers },
  }).catch(() => {});
}

function loadQuizAnswers(courseId, moduleIndex) {
  if (!courseId && courseId !== 0) return Promise.resolve(null);
  const blockId = `quiz_${moduleIndex}`;
  return restoreDraft({
    courseId: String(courseId),
    lessonId: String(moduleIndex),
    blockId,
  }).then((result) => {
    if (result.ok && result.draft) {
      // §16 — Expire after 2 hours
      if (Date.now() - (result.draft.updatedAt || 0) > 7200000) {
        removeDraft({ courseId: String(courseId), lessonId: String(moduleIndex), blockId }).catch(() => {});
        return null;
      }
      return result.draft.data?.answers || null;
    }
    return null;
  }).catch(() => null);
}

function clearQuizAnswers(courseId, moduleIndex) {
  if (!courseId && courseId !== 0) return Promise.resolve();
  const blockId = `quiz_${moduleIndex}`;
  return removeDraft({
    courseId: String(courseId),
    lessonId: String(moduleIndex),
    blockId,
  }).catch(() => {});
}

export default function QuizBlock({
  courseId, moduleIndex, lang = 'ht', onComplete, cachedQuizzes, onQuizzesLoaded,
  gamification = null, onGamification = null,
}) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [quizzes, setQuizzes] = useState(null); // null = loading
  const [loadErr, setLoadErr] = useState('');
  // §28 — Initialize answers from draftStore (async, survives page reload)
  const [answers, setAnswers] = useState({});
  useEffect(() => {
    loadQuizAnswers(courseId, moduleIndex).then((saved) => {
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        setAnswers(saved);
      }
    }).catch(() => {});
  }, [courseId, moduleIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, setResult] = useState({});     // quizId -> {score, passed}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!courseId) { setQuizzes([]); return; }
    setLoadErr('');
    try {
      const res = await quizService.list(courseId);
      const list = Array.isArray(res?.data?.results) ? res.data.results
        : (Array.isArray(res?.data) ? res.data : []);
      setQuizzes(list.filter((q) => Number(q.module_index) === Number(moduleIndex)));
      // Offline staging hook: the parent (Learning Space) caches the
      // course-wide quiz list so quizzes render offline too.
      onQuizzesLoaded?.(list);
    } catch (e) {
      // Offline fallback: render the staged quiz list (if any) instead
      // of an error — the quiz was staged while the learner was online.
      const fb = Array.isArray(cachedQuizzes) ? cachedQuizzes : [];
      const fbList = fb.filter((q) => Number(q.module_index) === Number(moduleIndex));
      if (fbList.length > 0) {
        setQuizzes(fbList);
        // Parent (ModuleSession) needs the resolved list to settle its
        // step count — report the fallback list too.
        onQuizzesLoaded?.(fb);
        return;
      }
      setLoadErr(e?.response?.data?.detail || t('Could not load quizzes.', 'Pa t kapab chaje kiz yo.'));
      setQuizzes([]);
      // Settle the parent's quiz step with "no quizzes" so the session
      // isn't stuck waiting for a list that will never arrive.
      onQuizzesLoaded?.([]);
    }
  }, [courseId, moduleIndex, lang, cachedQuizzes, onQuizzesLoaded]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [showHint, setShowHint] = useState({}); // {quizId: {questionIdx: true}}
  const [startTime, setStartTime] = useState({}); // {quizId: timestamp}

  // §28 — Persist answers to draftStore so they survive page reload
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveQuizAnswers(courseId, moduleIndex, answers);
    }
  }, [courseId, moduleIndex, answers]);

  const pick = (quizId, questionIdx, choiceIdx) => {
    setAnswers((prev) => {
      const arr = [...(prev[quizId] || [])];
      arr[questionIdx] = choiceIdx;
      return { ...prev, [quizId]: arr };
    });
  };

  const setAnswer = (quizId, questionIdx, value) => {
    setAnswers((prev) => {
      const arr = [...(prev[quizId] || [])];
      arr[questionIdx] = value;
      return { ...prev, [quizId]: arr };
    });
  };

  const toggleHint = (quizId, qi) => {
    setShowHint((prev) => ({
      ...prev,
      [quizId]: { ...(prev[quizId] || {}), [qi]: !(prev[quizId] || {})[qi] },
    }));
  };

  const submit = async (quiz) => {
    const qCount = (quiz.questions || []).length;
    const ans = answers[quiz.id] || [];
    if (ans.length < qCount || ans.some((a) => a == null)) {
      setErr(t('Answer every question before submitting.', 'Reponn tout kesyon anvan w soumèt.'));
      return;
    }
    setBusy(true); setErr('');
    try {
      const timeTaken = startTime[quiz.id] ? Math.floor((Date.now() - startTime[quiz.id]) / 1000) : 0;
      const res = await quizAttemptService.submit(quiz.id, ans, timeTaken);
      const data = res?.data || {};
      setResult((prev) => ({
        ...prev,
        [quiz.id]: {
          score: data.score,
          passed: data.passed,
          total_points: data.total_points,
          earned_points: data.earned_points,
          question_results: data.question_results || [],
          time_taken_seconds: data.time_taken_seconds || timeTaken,
        },
      }));
      if (data.gamification) onGamification?.(data.gamification);
      playChime(data.passed ? 'correct' : 'wrong');
      if (data.passed) {
        // Clear persisted answers for this quiz — no longer needed
        clearQuizAnswers(courseId, moduleIndex);
        onComplete?.(moduleIndex, `quiz:${quiz.id}`, 'quiz');
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || '';
      if (detail === 'no_hearts_left') {
        if (e?.response?.data?.gamification) onGamification?.(e.response.data.gamification);
        setErr(t(
          'No hearts left — refill your hearts (top bar) or wait for them to regen.',
          'Pa gen kè ankò — ranpli kè yo (anlè a) oswa tann yo regenere.',
        ));
        return;
      }
      setErr(detail || t('Could not submit the quiz.', 'Pa t kapab soumèt kiz la.'));
    } finally { setBusy(false); }
  };

  // Start timer when quiz is first viewed
  const startQuizTimer = (quizId) => {
    if (!startTime[quizId]) {
      setStartTime((prev) => ({ ...prev, [quizId]: Date.now() }));
    }
  };

  const answeredCount = (quiz) => (answers[quiz.id] || []).filter((a) => a != null).length;

  if (loadErr) {
    return (
      <div className={styles.quizBlock}>
        <div className={styles.quizBlockEmpty}>{loadErr}</div>
      </div>
    );
  }
  if (quizzes === null) {
    return (
      <div className={styles.quizBlock}>
        <div className={styles.quizBlockEmpty}>
          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Loading quizzes…', 'Ap chaje kiz yo…')}
        </div>
      </div>
    );
  }
  if (quizzes.length === 0) return null;

  return (
    <div className={styles.quizBlock}>
      {quizzes.map((quiz) => {
        const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
        const res = result[quiz.id];
        const done = answeredCount(quiz);
        return (
          <div key={quiz.id} className={styles.quizCard} data-testid="quiz-card">
            <header className={styles.quizCardHeader}>
              <span className={styles.quizCardIcon}><i className="fas fa-clipboard-question" aria-hidden="true" /></span>
              <div>
                <h4 className={styles.quizCardTitle}>{quiz.title}</h4>
                <p className={styles.quizCardMeta}>
                  {questions.length} {t('questions', 'kesyon')} · {t('Pass', 'Pase')} {quiz.pass_score}%
                </p>
              </div>
              {res && (
                <span className={`${styles.quizResultBadge} ${res.passed ? styles.quizResultPass : styles.quizResultFail}`}>
                  {res.passed ? t('Passed', 'Pase') : t('Not passed', 'Pa pase')} · {res.score}%
                </span>
              )}
            </header>

            {questions.length === 0 ? (
              <p className={styles.quizBlockEmpty}>
                {t('This quiz has no questions yet.', 'Kiz sa a pa gen kesyon ankò.')}
              </p>
            ) : (
              <div className={styles.quizQuestions}>
                {questions.map((q, qi) => {
                  const qResult = res?.question_results?.[qi];
                  const qType = q.question_type || 'multiple_choice';
                  const showResult = res && qResult;
                  return (
                    <div key={q.id || qi} className={`${styles.quizQuestionCard} ${showResult ? (qResult.correct ? styles.quizQuestionCorrect : styles.quizQuestionWrong) : ''}`}>
                      <p className={styles.quizQuestionText} id={`quiz-q-${quiz.id}-${qi}`}>
                        <span className={styles.quizQuestionNum} aria-hidden="true">{qi + 1}.</span> {q.prompt}
                        {q.points > 1 && <span className={styles.quizQuestionPoints}> ({q.points} pts)</span>}
                        {showResult && (
                          <span className={`${styles.quizQuestionResult} ${qResult.correct ? styles.quizResultCorrect : styles.quizResultWrong}`}>
                            {qResult.correct ? '✅' : '❌'}
                          </span>
                        )}
                      </p>

                      {/* Multiple Choice & True/False */}
                      {(qType === 'multiple_choice' || qType === 'true_false') && (
                        <fieldset
                          className={styles.quizOptionList}
                          aria-labelledby={`quiz-q-${quiz.id}-${qi}`}
                          role="radiogroup"
                        >
                          {(Array.isArray(q.choices) ? q.choices : []).map((c, ci) => {
                            const selected = (answers[quiz.id] || [])[qi] === ci;
                            const isCorrectChoice = showResult && qResult.correct;
                            const isCorrectAnswer = showResult && !qResult.correct && ci === q.correct_index;
                            return (
                              <button
                                key={ci}
                                type="button"
                                className={`${styles.quizOption} ${selected ? styles.quizOptionSelected : ''} ${isCorrectAnswer ? styles.quizOptionCorrectAnswer : ''} ${selected && showResult && !qResult.correct ? styles.quizOptionWrongSelected : ''}`}
                                onClick={() => !showResult && pick(quiz.id, qi, ci)}
                                aria-pressed={selected}
                                disabled={!!showResult}
                              >
                                <span className={styles.quizOptionKey}>{String.fromCharCode(65 + ci)}</span>
                                {c}
                                {isCorrectAnswer && <span className={styles.quizOptionCorrectBadge}>✓</span>}
                              </button>
                            );
                          }                          )}
                        </fieldset>
                      )}

                      {/* Fill in the Blank */}
                      {qType === 'fill_blank' && (
                        <div className={styles.quizFillBlank}>
                          <label className="sr-only" htmlFor={`quiz-fill-${quiz.id}-${qi}`}>
                            {q.prompt || t('Your answer', 'Repons ou')}
                          </label>
                          <input
                            id={`quiz-fill-${quiz.id}-${qi}`}
                            className={styles.quizFillInput}
                            value={(answers[quiz.id] || [])[qi] || ''}
                            onChange={(e) => setAnswer(quiz.id, qi, e.target.value)}
                            placeholder={t('Type your answer...', 'Tape repons ou...')}
                            disabled={!!showResult}
                            aria-labelledby={`quiz-q-${quiz.id}-${qi}`}
                          />
                          {showResult && !qResult.correct && (
                            <p className={styles.quizCorrectAnswer}>{t('Correct answer:', 'Bon repons:')} {q.correct_answer}</p>
                          )}
                        </div>
                      )}

                      {/* Matching */}
                      {qType === 'matching' && (
                        <div className={styles.quizMatching}>
                          {(Array.isArray(q.matching_pairs) ? q.matching_pairs : []).map((pair, pi) => (
                            <div key={pi} className={styles.quizMatchingRow}>
                              <span className={styles.quizMatchingLeft}>{pair.left}</span>
                              <span className={styles.quizMatchingArrow}>→</span>
                              <select
                                className={styles.quizMatchingSelect}
                                value={(answers[quiz.id] || [])[qi]?.[pi] || ''}
                                onChange={(e) => {
                                  const prev = (answers[quiz.id] || [])[qi] || [];
                                  const next = [...prev];
                                  next[pi] = e.target.value;
                                  setAnswer(quiz.id, qi, next);
                                }}
                                disabled={!!showResult}
                              >
                                <option value="">{t('Select...', 'Chwazi...')}</option>
                                {(Array.isArray(q.choices) ? q.choices : []).map((c, ci) => (
                                  <option key={ci} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ordering — learner reorders by clicking up/down arrows */}
                      {qType === 'ordering' && (() => {
                        const currentOrder = (answers[quiz.id] || [])[qi];
                        const items = Array.isArray(currentOrder)
                          ? currentOrder
                          : (Array.isArray(q.choices) ? [...q.choices] : []);
                        // Initialize answer on first render if not set
                        if (!currentOrder && Array.isArray(q.choices) && q.choices.length > 0) {
                          // Defer to avoid setState during render
                          setTimeout(() => setAnswer(quiz.id, qi, [...q.choices]), 0);
                        }
                        const moveItem = (fromIdx, toIdx) => {
                          if (toIdx < 0 || toIdx >= items.length) return;
                          const next = [...items];
                          const [moved] = next.splice(fromIdx, 1);
                          next.splice(toIdx, 0, moved);
                          setAnswer(quiz.id, qi, next);
                        };
                        return (
                          <div className={styles.quizOrdering}>
                            <p className={styles.quizOrderingHint} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                              {t('Put items in the correct order:', 'Mete bagay yo nan lòd kòrèk:')}
                            </p>
                            {items.map((item, ci) => (
                              <div key={ci} className={styles.quizOrderingItem} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className={styles.quizOrderingNum} style={{ minWidth: 22, textAlign: 'right' }}>{ci + 1}.</span>
                                <span style={{ flex: 1 }}>{item}</span>
                                {!showResult && (
                                  <span style={{ display: 'inline-flex', gap: 2 }}>
                                    <button type="button" onClick={() => moveItem(ci, ci - 1)} disabled={ci === 0}
                                      style={{ padding: '2px 6px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 4, background: 'transparent', cursor: ci === 0 ? 'not-allowed' : 'pointer', opacity: ci === 0 ? 0.3 : 1, fontSize: '0.7rem' }}
                                      aria-label={t('Move up', 'Monte')}>
                                      <i className="fas fa-arrow-up" />
                                    </button>
                                    <button type="button" onClick={() => moveItem(ci, ci + 1)} disabled={ci === items.length - 1}
                                      style={{ padding: '2px 6px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 4, background: 'transparent', cursor: ci === items.length - 1 ? 'not-allowed' : 'pointer', opacity: ci === items.length - 1 ? 0.3 : 1, fontSize: '0.7rem' }}
                                      aria-label={t('Move down', 'Desann')}>
                                      <i className="fas fa-arrow-down" />
                                    </button>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Hint */}
                      {q.hint && !showResult && (
                        <div className={styles.quizHint}>
                          <button type="button" className={styles.quizHintBtn} onClick={() => toggleHint(quiz.id, qi)}>
                            <i className="fas fa-lightbulb" /> {t('Show hint', 'Montre indis')}
                          </button>
                          {(showHint[quiz.id] || {})[qi] && (
                            <p className={styles.quizHintText}>💡 {q.hint}</p>
                          )}
                        </div>
                      )}

                      {/* Explanation after submit */}
                      {showResult && q.explanation && (
                        <div className={`${styles.quizExplanation} ${qResult.correct ? styles.quizExplanationCorrect : styles.quizExplanationWrong}`}>
                          <i className="fas fa-circle-info" /> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className={styles.quizSubmitRow}>
                  {err && <span className={styles.practiceError} role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {err}</span>}
                  {!res && (
                    <button
                      type="button"
                      className={styles.quizSubmitBtn}
                      onClick={() => submit(quiz)}
                      disabled={busy || done < questions.length}
                    >
                      {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-paper-plane" aria-hidden="true" />}
                      {t('Submit answers', 'Soumèt repons')} ({done}/{questions.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {res && (
              <footer className={styles.quizResultNote}>
                <i className={`fas ${res.passed ? 'fa-circle-check' : 'fa-circle-info'}`} aria-hidden="true" />
                {res.passed
                  ? t('Great — you passed this quiz. You can retake it to practice more.', 'Fò — ou pase kiz la. Ou ka fè l ankò pou pratike plis.')
                  : t('You did not pass this time. Review the module and try again — practice is part of learning.', 'Ou pa t pase fwa sa a. Revize modil la epi eseye ankò — pratik se yon pati nan aprann.')}
              </footer>
            )}
          </div>
        );
      })}
    </div>
  );
}
