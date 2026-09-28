/**
 * src/components/studio/editor/QuizInlineEditor.jsx
 *
 * Inline quiz editor for BlockEditor — manages quiz configuration
 * (title, pass score) and provides a gateway to the full QuizEditor
 * for question management.
 *
 * Quiz data is stored in the backend API (Quiz/QuizQuestion models),
 * not in the blocks array. This editor provides:
 *   - Title and pass score configuration
 *   - Question count display
 *   - Link to full QuizEditor for question management
 *
 * Data shape (stored in block):
 *   { id, type: 'quiz', title, passScore, quizId? }
 */
import React, { useState, useCallback, useEffect } from 'react';
import { quizService } from '../../../services/api';
import styles from './editor.module.css';

export default function QuizInlineEditor({ block, onChange, lang = 'ht', courseId, moduleIndex }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const [quizzes, setQuizzes] = useState(null); // null = loading
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showFullEditor, setShowFullEditor] = useState(false);

  // Load quizzes for this module
  // NOTE: `lang` (not `t`) in deps — `t` is recreated every render, causing
  // an infinite useEffect loop (black screen). `lang` is a stable string.
  const loadQuizzes = useCallback(async () => {
    if (!courseId) { setQuizzes([]); return; }
    setLoadError('');
    try {
      const res = await quizService.list(courseId);
      const list = Array.isArray(res?.data?.results) ? res.data.results
        : (Array.isArray(res?.data) ? res.data : []);
      setQuizzes(list.filter((q) => Number(q.module_index) === Number(moduleIndex)));
    } catch (e) {
      const isHtLang = lang === 'ht';
      setLoadError(e?.response?.data?.detail || (isHtLang ? 'Pa t kapab chaje kiz yo.' : 'Could not load quizzes.'));
      setQuizzes([]);
    }
  }, [courseId, moduleIndex, lang]);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  // Find the quiz associated with this block (if any)
  const linkedQuiz = block.quizId
    ? (quizzes || []).find((q) => Number(q.id) === Number(block.quizId))
    : (quizzes || [])[0]; // Default to first quiz if no specific ID

  // Create a new quiz
  const handleCreateQuiz = useCallback(async () => {
    if (!courseId) {
      setErr(t('Save the course first.', 'Sove kou a anvan.'));
      return;
    }
    setBusy(true); setErr(''); setMsg('');
    try {
      const res = await quizService.create({
        course_id: courseId,
        module_index: Number(moduleIndex),
        title: block.title || t('Quiz', 'Kiz'),
        pass_score: Number(block.passScore) || 70,
      });
      const newQuiz = res?.data;
      if (newQuiz) {
        onChange({ ...block, quizId: newQuiz.id });
        setMsg(t('Quiz created.', 'Kiz kreye.'));
        loadQuizzes();
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not create quiz.', 'Pa t kapab kreye kiz.'));
    } finally { setBusy(false); }
  }, [courseId, moduleIndex, block, onChange, t, loadQuizzes]);

  // Update quiz configuration
  const handleUpdateQuiz = useCallback(async () => {
    if (!linkedQuiz) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await quizService.update(linkedQuiz.id, {
        title: block.title || linkedQuiz.title,
        pass_score: Number(block.passScore) || linkedQuiz.pass_score || 70,
      });
      setMsg(t('Quiz updated.', 'Kiz mete ajou.'));
      loadQuizzes();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not update quiz.', 'Pa t kapab mete ajou kiz.'));
    } finally { setBusy(false); }
  }, [linkedQuiz, block, t, loadQuizzes]);

  // Delete the linked quiz
  const handleDeleteQuiz = useCallback(async () => {
    if (!linkedQuiz) return;
    if (!window.confirm(t(`Delete quiz "${linkedQuiz.title}"?`, `Efase kiz "${linkedQuiz.title}"?`))) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await quizService.remove(linkedQuiz.id);
      onChange({ ...block, quizId: null });
      setMsg(t('Quiz deleted.', 'Kiz efase.'));
      loadQuizzes();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not delete quiz.', 'Pa t kapab efase kiz.'));
    } finally { setBusy(false); }
  }, [linkedQuiz, block, onChange, t, loadQuizzes]);

  const questionCount = linkedQuiz?.questions?.length || 0;

  // Loading state
  if (quizzes === null) {
    return (
      <div className={styles.quizInlineEditor}>
        <p className={styles.quizInlineLoading}>
          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Loading quizzes…', 'Ap chaje kiz yo…')}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.quizInlineEditor}>
      {/* Header */}
      <div className={styles.quizInlineHeader}>
        <span className={styles.quizInlineTitle}>
          <i className="fas fa-clipboard-question" aria-hidden="true" />
          {t('Quiz Configuration', 'Konfigirasyon Kiz')}
        </span>
        {linkedQuiz && (
          <span className={styles.quizInlineBadge}>
            {questionCount} {isHt ? 'kesyon' : 'questions'}
          </span>
        )}
      </div>

      {/* Messages */}
      {msg && <p className={styles.quizInlineMsg} role="status"><i className="fas fa-circle-check" aria-hidden="true" /> {msg}</p>}
      {err && <p className={styles.quizInlineErr} role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {err}</p>}
      {loadError && <p className={styles.quizInlineErr} role="alert">{loadError}</p>}

      {/* No quiz yet — show create button */}
      {!linkedQuiz && quizzes.length === 0 && (
        <div className={styles.quizInlineEmpty}>
          <p>{t('No quiz in this module yet.', 'Pa gen kiz nan modil sa a ankò.')}</p>
          <button
            type="button"
            className={styles.quizInlineCreateBtn}
            onClick={handleCreateQuiz}
            disabled={busy || !courseId}
          >
            {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-plus" aria-hidden="true" />}
            {t('Create Quiz', 'Kreye Kiz')}
          </button>
          {!courseId && (
            <p className={styles.quizInlineHint}>
              <i className="fas fa-info-circle" aria-hidden="true" />
              {t('Save the course first to enable quizzes.', 'Sove kou a anvan pou aktive kiz yo.')}
            </p>
          )}
        </div>
      )}

      {/* Linked quiz — show config */}
      {linkedQuiz && (
        <div className={styles.quizInlineConfig}>
          <div className={styles.quizInlineField}>
            <label className={styles.quizInlineLabel}>{t('Quiz Title', 'Tit Kiz')}</label>
            <input
              type="text"
              className={styles.quizInlineInput}
              value={block.title || linkedQuiz.title || ''}
              onChange={(e) => onChange({ ...block, title: e.target.value })}
              onBlur={handleUpdateQuiz}
              placeholder={t('Quiz title…', 'Tit kiz…')}
              maxLength={200}
            />
          </div>

          <div className={styles.quizInlineField}>
            <label className={styles.quizInlineLabel}>{t('Pass Score (%)', 'Nòt Pase (%)')}</label>
            <input
              type="number"
              className={styles.quizInlineInput}
              min="0"
              max="100"
              value={block.passScore ?? linkedQuiz.pass_score ?? 70}
              onChange={(e) => onChange({ ...block, passScore: e.target.value })}
              onBlur={handleUpdateQuiz}
            />
          </div>

          <div className={styles.quizInlineActions}>
            <button
              type="button"
              className={styles.quizInlineManageBtn}
              onClick={() => setShowFullEditor(!showFullEditor)}
            >
              <i className="fas fa-list-check" aria-hidden="true" />
              {showFullEditor ? t('Hide Questions', 'Briye Kesyon') : t('Manage Questions', 'Jere Kesyon')}
            </button>
            <button
              type="button"
              className={styles.quizInlineDeleteBtn}
              onClick={handleDeleteQuiz}
              disabled={busy}
            >
              <i className="fas fa-trash" aria-hidden="true" />
              {t('Delete Quiz', 'Efase Kiz')}
            </button>
          </div>

          {/* Inline question management (simplified) */}
          {showFullEditor && (
            <div className={styles.quizInlineQuestions}>
              <QuizQuestionsInline
                quiz={linkedQuiz}
                lang={lang}
                courseId={courseId}
                onRefresh={loadQuizzes}
              />
            </div>
          )}
        </div>
      )}

      {/* Multiple quizzes — show list */}
      {!linkedQuiz && quizzes.length > 0 && (
        <div className={styles.quizInlineList}>
          <p className={styles.quizInlineListHint}>
            {t('This module has quizzes managed separately. Link one to this block:', 'Modil sa a gen kiz ki jere aparte. Asosye youn ak blok sa a:')}
          </p>
          {quizzes.map((quiz) => (
            <button
              key={quiz.id}
              type="button"
              className={styles.quizInlineListItem}
              onClick={() => onChange({ ...block, quizId: quiz.id, title: quiz.title, passScore: quiz.pass_score })}
            >
              <i className="fas fa-clipboard-question" aria-hidden="true" />
              <span>{quiz.title}</span>
              <span className={styles.quizInlineListMeta}>
                {quiz.questions?.length || 0} {isHt ? 'kesyon' : 'questions'} · {quiz.pass_score}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Full inline question editor — supports all question types with
 * inline editing of prompt, choices, correct answers, and explanation.
 * Saves directly to the backend via quizQuestionService.
 */
const QUESTION_TYPES = [
  { value: 'multiple_choice', icon: 'fa-list', label: { en: 'Multiple Choice', ht: 'Chwa Miltip' } },
  { value: 'true_false', icon: 'fa-check-circle', label: { en: 'True / False', ht: 'Vre / Fa' } },
  { value: 'fill_blank', icon: 'fa-pen-to-square', label: { en: 'Fill in the Blank', ht: 'Ranj Bwat' } },
  { value: 'matching', icon: 'fa-link', label: { en: 'Matching', ht: 'Asosye' } },
  { value: 'ordering', icon: 'fa-arrow-down-1-9', label: { en: 'Ordering', ht: 'Tròte' } },
];

function QuizQuestionsInline({ quiz, lang, courseId, onRefresh }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [questions, setQuestions] = useState(() =>
    (quiz?.questions || []).map((q) => ({
      ...q,
      choices: Array.isArray(q.choices) ? [...q.choices] : [],
      matching_pairs: Array.isArray(q.matching_pairs) ? q.matching_pairs.map((p) => ({ ...p })) : [],
      correct_order: Array.isArray(q.correct_order) ? [...q.correct_order] : [],
    }))
  );
  const [expanded, setExpanded] = useState(null); // index of expanded question
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // Sync when quiz prop changes (after refresh)
  useEffect(() => {
    setQuestions(
      (quiz?.questions || []).map((q) => ({
        ...q,
        choices: Array.isArray(q.choices) ? [...q.choices] : [],
        matching_pairs: Array.isArray(q.matching_pairs) ? q.matching_pairs.map((p) => ({ ...p })) : [],
        correct_order: Array.isArray(q.correct_order) ? [...q.correct_order] : [],
      }))
    );
  }, [quiz?.questions]);

  const patchQuestion = useCallback((idx, partial) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...partial } : q)));
  }, []);

  const addQuestion = useCallback(async (type = 'multiple_choice') => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const { quizQuestionService } = await import('../../../services/api');
      const base = { prompt: '', question_type: type, explanation: '' };
      if (type === 'multiple_choice') { base.choices = ['', '']; base.correct_index = 0; }
      else if (type === 'true_false') { base.choices = ['Vre', 'Fa']; base.correct_index = 0; }
      else if (type === 'fill_blank') { base.correct_answer = ''; }
      else if (type === 'matching') { base.matching_pairs = [{ left: '', right: '' }]; }
      else if (type === 'ordering') { base.correct_order = ['', '']; }
      await quizQuestionService.create({
        quiz_id: quiz.id,
        ...base,
        order: questions.length,
      });
      setMsg(t('Question added.', 'Kesyon ajoute.'));
      onRefresh?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not add question.', 'Pa t kapab ajoute kesyon.'));
    } finally { setBusy(false); }
  }, [quiz, questions.length, onRefresh, t]);

  const saveQuestion = useCallback(async (idx) => {
    const q = questions[idx];
    if (!q) return;
    if (!q.prompt?.trim()) {
      setErr(t('Question prompt is required.', 'Kesyon bezwen yon tèks.'));
      return;
    }
    setBusy(true); setErr(''); setMsg('');
    try {
      const { quizQuestionService } = await import('../../../services/api');
      const payload = {
        quiz_id: quiz.id,
        question_type: q.question_type || 'multiple_choice',
        prompt: q.prompt.trim(),
        choices: (q.choices || []).map((c) => String(c).trim()).filter((c) => c !== ''),
        correct_index: q.correct_index,
        correct_answer: q.correct_answer || '',
        matching_pairs: q.matching_pairs || [],
        correct_order: q.correct_order || [],
        explanation: q.explanation?.trim() || '',
        order: idx,
      };
      if (q.id) await quizQuestionService.update(q.id, payload);
      else await quizQuestionService.create(payload);
      setMsg(t('Question saved.', 'Kesyon sove.'));
      onRefresh?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not save question.', 'Pa t kapab sove kesyon.'));
    } finally { setBusy(false); }
  }, [questions, quiz, onRefresh, t]);

  const removeQuestion = useCallback(async (idx) => {
    const q = questions[idx];
    setBusy(true); setErr(''); setMsg('');
    try {
      if (q.id) {
        const { quizQuestionService } = await import('../../../services/api');
        await quizQuestionService.remove(q.id);
      }
      setQuestions((qs) => qs.filter((_, i) => i !== idx));
      setExpanded(null);
      setMsg(t('Question removed.', 'Kesyon retire.'));
      onRefresh?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not remove question.', 'Pa t kapab retire kesyon.'));
    } finally { setBusy(false); }
  }, [questions, onRefresh, t]);

  return (
    <div className={styles.quizInlineQuestionsInner}>
      {/* Header with add buttons */}
      <div className={styles.quizInlineQuestionsHeader}>
        <span>{questions.length} {isHt ? 'kesyon' : 'questions'}</span>
      </div>

      {err && <p className={styles.quizInlineErr} role="alert">{err}</p>}
      {msg && <p className={styles.quizInlineMsg} role="status">{msg}</p>}

      {/* Add question type buttons */}
      <div className={styles.quizInlineAddRow}>
        {QUESTION_TYPES.map((qt) => (
          <button
            key={qt.value}
            type="button"
            className={styles.quizInlineAddType}
            onClick={() => addQuestion(qt.value)}
            disabled={busy}
            title={qt.label[lang]}
          >
            <i className={`fas ${qt.icon}`} aria-hidden="true" /> {qt.label[lang]}
          </button>
        ))}
      </div>

      {questions.length === 0 ? (
        <p className={styles.quizInlineNoQ}>
          {t('No questions yet. Add one above.', 'Pa gen kesyon ankò. Ajoute youn anlè.')}
        </p>
      ) : (
        <div className={styles.quizInlineQList}>
          {questions.map((q, i) => {
            const qType = q.question_type || 'multiple_choice';
            const typeMeta = QUESTION_TYPES.find((qt) => qt.value === qType) || QUESTION_TYPES[0];
            const isExpanded = expanded === i;
            return (
              <div key={q.id || `q-${i}`} className={`${styles.quizInlineQCard} ${isExpanded ? styles.quizInlineQCardExpanded : ''}`}>
                {/* Question header (always visible) */}
                <div className={styles.quizInlineQHeader} onClick={() => setExpanded(isExpanded ? null : i)}>
                  <span className={styles.quizInlineQNum}>{i + 1}</span>
                  <span className={styles.quizInlineQTypeIcon}>
                    <i className={`fas ${typeMeta.icon}`} aria-hidden="true" />
                  </span>
                  <span className={styles.quizInlineQPromptPreview}>
                    {q.prompt || <em>{isHt ? 'Pa gen tèks' : 'No text'}</em>}
                  </span>
                  <i className={`fas fa-chevron-down ${styles.quizInlineQChevron} ${isExpanded ? styles.quizInlineQChevronOpen : ''}`} aria-hidden="true" />
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className={styles.quizInlineQBody}>
                    {/* Type selector + prompt */}
                    <div className={styles.quizInlineQTop}>
                      <select
                        className={styles.quizInlineQTypeSelect}
                        value={qType}
                        onChange={(e) => patchQuestion(i, { question_type: e.target.value })}
                      >
                        {QUESTION_TYPES.map((qt) => (
                          <option key={qt.value} value={qt.value}>{qt.label[lang]}</option>
                        ))}
                      </select>
                      <input
                        className={styles.quizInlineQPromptInput}
                        value={q.prompt || ''}
                        onChange={(e) => patchQuestion(i, { prompt: e.target.value })}
                        placeholder={t('Question…', 'Kesyon…')}
                        maxLength={500}
                      />
                    </div>

                    {/* ─── Multiple Choice ──────────────────────── */}
                    {qType === 'multiple_choice' && (
                      <div className={styles.quizInlineChoices}>
                        {(q.choices || []).map((c, ci) => (
                          <label key={ci} className={`${styles.quizInlineChoice} ${Number(q.correct_index) === ci ? styles.quizInlineChoiceCorrect : ''}`}>
                            <input type="radio" name={`qic-${i}`} checked={Number(q.correct_index) === ci} onChange={() => patchQuestion(i, { correct_index: ci })} />
                            <input
                              className={styles.quizInlineChoiceText}
                              value={c}
                              onChange={(e) => {
                                const ch = [...(q.choices || [])];
                                ch[ci] = e.target.value;
                                patchQuestion(i, { choices: ch });
                              }}
                              placeholder={`${t('Choice', 'Chwa')} ${ci + 1}`}
                              maxLength={200}
                            />
                            {Number(q.correct_index) === ci && (
                              <span className={styles.quizInlineChoiceBadge}><i className="fas fa-check" /> {t('Correct', 'Kòrèk')}</span>
                            )}
                          </label>
                        ))}
                        <div className={styles.quizInlineChoiceActions}>
                          {(q.choices || []).length < 6 && (
                            <button type="button" className={styles.quizInlineAddItem} onClick={() => patchQuestion(i, { choices: [...(q.choices || []), ''] })}>
                              <i className="fas fa-plus" /> {t('Add choice', 'Ajoute chwa')}
                            </button>
                          )}
                          {(q.choices || []).length > 2 && (
                            <button type="button" className={styles.quizInlineRemoveItem} onClick={() => patchQuestion(i, { choices: (q.choices || []).slice(0, -1) })}>
                              {t('Remove last', 'Dènye')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ─── True / False ────────────────────────── */}
                    {qType === 'true_false' && (
                      <div className={styles.quizInlineChoices}>
                        <label className={`${styles.quizInlineChoice} ${Number(q.correct_index) === 0 ? styles.quizInlineChoiceCorrect : ''}`}>
                          <input type="radio" name={`qic-${i}`} checked={Number(q.correct_index) === 0} onChange={() => patchQuestion(i, { correct_index: 0 })} />
                          <span className={styles.quizInlineChoiceText}>✅ {t('True', 'Vre')}</span>
                        </label>
                        <label className={`${styles.quizInlineChoice} ${Number(q.correct_index) === 1 ? styles.quizInlineChoiceCorrect : ''}`}>
                          <input type="radio" name={`qic-${i}`} checked={Number(q.correct_index) === 1} onChange={() => patchQuestion(i, { correct_index: 1 })} />
                          <span className={styles.quizInlineChoiceText}>❌ {t('False', 'Fa')}</span>
                        </label>
                      </div>
                    )}

                    {/* ─── Fill in the Blank ────────────────────── */}
                    {qType === 'fill_blank' && (
                      <div className={styles.quizInlineFB}>
                        <label className={styles.quizInlineFBLabel}>
                          <span>{t('Correct answer', 'Bon repons')}</span>
                          <input
                            className={styles.quizInlineFBInput}
                            value={q.correct_answer || ''}
                            onChange={(e) => patchQuestion(i, { correct_answer: e.target.value })}
                            placeholder={t('e.g. Port-au-Prince', 'e.g. Pòtoprens')}
                            maxLength={500}
                          />
                        </label>
                      </div>
                    )}

                    {/* ─── Matching ────────────────────────────── */}
                    {qType === 'matching' && (
                      <div className={styles.quizInlineMatching}>
                        {(q.matching_pairs || []).map((pair, pi) => (
                          <div key={pi} className={styles.quizInlineMatchRow}>
                            <input
                              className={styles.quizInlineMatchInput}
                              value={pair.left || ''}
                              onChange={(e) => {
                                const pairs = [...(q.matching_pairs || [])];
                                pairs[pi] = { ...pairs[pi], left: e.target.value };
                                patchQuestion(i, { matching_pairs: pairs });
                              }}
                              placeholder={t('Left', 'Gòch')}
                              maxLength={200}
                            />
                            <span className={styles.quizInlineMatchArrow}>→</span>
                            <input
                              className={styles.quizInlineMatchInput}
                              value={pair.right || ''}
                              onChange={(e) => {
                                const pairs = [...(q.matching_pairs || [])];
                                pairs[pi] = { ...pairs[pi], right: e.target.value };
                                patchQuestion(i, { matching_pairs: pairs });
                              }}
                              placeholder={t('Right', 'Dwat')}
                              maxLength={200}
                            />
                            <button type="button" className={styles.quizInlineMatchRemove} onClick={() => patchQuestion(i, { matching_pairs: (q.matching_pairs || []).filter((_, j) => j !== pi) })} title={t('Remove', 'Retire')}>
                              <i className="fas fa-xmark" />
                            </button>
                          </div>
                        ))}
                        <button type="button" className={styles.quizInlineAddItem} onClick={() => patchQuestion(i, { matching_pairs: [...(q.matching_pairs || []), { left: '', right: '' }] })}>
                          <i className="fas fa-plus" /> {t('Add pair', 'Ajoute par')}
                        </button>
                      </div>
                    )}

                    {/* ─── Ordering ────────────────────────────── */}
                    {qType === 'ordering' && (
                      <div className={styles.quizInlineOrdering}>
                        {(q.correct_order || []).map((item, ii) => (
                          <div key={ii} className={styles.quizInlineOrderRow}>
                            <span className={styles.quizInlineOrderNum}>{ii + 1}.</span>
                            <input
                              className={styles.quizInlineOrderInput}
                              value={item}
                              onChange={(e) => {
                                const order = [...(q.correct_order || [])];
                                order[ii] = e.target.value;
                                patchQuestion(i, { correct_order: order });
                              }}
                              placeholder={`${t('Item', 'Bagay')} ${ii + 1}`}
                              maxLength={200}
                            />
                            <button type="button" className={styles.quizInlineMatchRemove} onClick={() => patchQuestion(i, { correct_order: (q.correct_order || []).filter((_, j) => j !== ii) })} title={t('Remove', 'Retire')}>
                              <i className="fas fa-xmark" />
                            </button>
                          </div>
                        ))}
                        <button type="button" className={styles.quizInlineAddItem} onClick={() => patchQuestion(i, { correct_order: [...(q.correct_order || []), ''] })}>
                          <i className="fas fa-plus" /> {t('Add item', 'Ajoute bagay')}
                        </button>
                      </div>
                    )}

                    {/* Explanation */}
                    <label className={styles.quizInlineExplain}>
                      <span>{t('Explanation (optional)', 'Eksplikasyon (opsyonèl)')}</span>
                      <textarea
                        value={q.explanation || ''}
                        onChange={(e) => patchQuestion(i, { explanation: e.target.value })}
                        rows={2}
                        maxLength={500}
                        placeholder={isHt ? 'Eksplike repons lan…' : 'Explain the answer…'}
                      />
                    </label>

                    {/* Save / Delete row */}
                    <div className={styles.quizInlineQActions}>
                      <button
                        type="button"
                        className={styles.quizInlineQSaveBtn}
                        onClick={() => saveQuestion(i)}
                        disabled={busy}
                      >
                        {busy ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
                        {t('Save', 'Sove')}
                      </button>
                      <button
                        type="button"
                        className={styles.quizInlineQDeleteBtn}
                        onClick={() => removeQuestion(i)}
                        disabled={busy}
                      >
                        <i className="fas fa-trash" /> {t('Delete', 'Efase')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
