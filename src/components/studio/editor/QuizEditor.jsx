/**
 * src/components/studio/editor/QuizEditor.jsx
 *
 * Creator-side quiz manager for one course module — REAL backend
 * (Quiz / QuizQuestion / QuizAttempt models + /api/courses/quizzes/).
 *
 * The creator works with the learning structure, not a form:
 *   • pick a module → add a quiz (title, pass score %)
 *   • add multiple-choice questions (prompt, 2-6 choices, correct one,
 *     explanation)
 *
 * Quizzes only exist once the course is saved (they need a course_id),
 * so this editor renders only when `courseId` is present and warns
 * otherwise. All CRUD goes through quizService / quizQuestionService;
 * nothing is faked.
 */
import React, { useState, useCallback } from 'react';
import { quizService, quizQuestionService } from '../../../services/api';
import styles from './editor.module.css';

export default function QuizEditor({ courseId, moduleIndex, lang = 'ht' }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [quizzes, setQuizzes] = useState(null); // null = not loaded
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);       // new quiz draft {title, pass_score}
  const [editing, setEditing] = useState(null);   // quiz being edited ({quiz, questions})
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!courseId) { setQuizzes([]); return; }
    setLoadError('');
    try {
      const res = await quizService.list(courseId);
      const list = Array.isArray(res?.data?.results) ? res.data.results
        : (Array.isArray(res?.data) ? res.data : []);
      setQuizzes(list.filter((q) => Number(q.module_index) === Number(moduleIndex)));
    } catch (e) {
      setLoadError(e?.response?.data?.detail || t('Could not load quizzes.', 'Pa t kapab chaje kiz yo.'));
    }
  }, [courseId, moduleIndex, lang]);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => { load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveQuiz = async () => {
    if (!draft?.title.trim()) { setErr(t('Quiz title is required.', 'Tit kiz la oblije.')); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      await quizService.create({
        course_id: courseId,
        module_index: Number(moduleIndex),
        title: draft.title.trim(),
        pass_score: Math.min(100, Math.max(0, Number(draft.pass_score) || 70)),
      });
      setDraft(null);
      setMsg(t('Quiz added.', 'Kiz ajoute.'));
      load();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not add the quiz.', 'Pa t kapab ajoute kiz la.'));
    } finally { setBusy(false); }
  };

  const updateQuiz = async () => {
    if (!editing) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await quizService.update(editing.quiz.id, {
        title: editing.quiz.title.trim(),
        pass_score: Math.min(100, Math.max(0, Number(editing.quiz.pass_score) || 70)),
      });
      setMsg(t('Quiz updated.', 'Kiz mete ajou.'));
      load();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not update the quiz.', 'Pa t kapab mete ajou kiz la.'));
    } finally { setBusy(false); }
  };

  const deleteQuiz = async (quiz) => {
    if (!window.confirm(t(`Delete quiz "${quiz.title}"?`, `Efase kiz "${quiz.title}"?`))) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await quizService.remove(quiz.id);
      setEditing((cur) => (cur?.quiz.id === quiz.id ? null : cur));
      setMsg(t('Quiz deleted.', 'Kiz efase.'));
      load();
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not delete the quiz.', 'Pa t kapab efase kiz la.'));
    } finally { setBusy(false); }
  };

  const openEdit = async (quiz) => {
    setErr(''); setMsg('');
    try {
      const res = await quizService.list(courseId);
      const list = Array.isArray(res?.data?.results) ? res.data.results
        : (Array.isArray(res?.data) ? res.data : []);
      const full = list.find((q) => Number(q.id) === Number(quiz.id)) || quiz;
      setEditing({ quiz: { ...full }, questions: Array.isArray(full.questions) ? full.questions.map((q) => ({ ...q, choices: Array.isArray(q.choices) ? [...q.choices] : [] })) : [] });
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not open the quiz.', 'Pa t kapab louvri kiz la.'));
    }
  };

  const setQuizField = (field, value) => setEditing((e) => (e ? { ...e, quiz: { ...e.quiz, [field]: value } } : e));

  const setQuestionField = (idx, field, value) => {
    setEditing((e) => {
      if (!e) return e;
      const questions = e.questions.map((q, i) => (i === idx ? { ...q, [field]: value } : q));
      return { ...e, questions };
    });
  };

  const QUESTION_TYPES = [
    { value: 'multiple_choice', icon: 'fa-list', label: { en: 'Multiple Choice', ht: 'Chwa Miltip' } },
    { value: 'true_false', icon: 'fa-check-circle', label: { en: 'True / False', ht: 'Vre / Fa' } },
    { value: 'fill_blank', icon: 'fa-pen-to-square', label: { en: 'Fill in the Blank', ht: 'Ranj Bwat' } },
    { value: 'matching', icon: 'fa-link', label: { en: 'Matching', ht: 'Asosye' } },
    { value: 'ordering', icon: 'fa-arrow-down-1-9', label: { en: 'Ordering', ht: 'Tròte' } },
  ];

  const addQuestion = (type = 'multiple_choice') => {
    const base = { prompt: '', question_type: type, explanation: '' };
    if (type === 'multiple_choice') {
      base.choices = ['', ''];
      base.correct_index = 0;
    } else if (type === 'true_false') {
      base.choices = ['Vre', 'Fa'];
      base.correct_index = 0;
    } else if (type === 'fill_blank') {
      base.correct_answer = '';
    } else if (type === 'matching') {
      base.matching_pairs = [{ left: '', right: '' }];
      base.choices = ['', ''];
    } else if (type === 'ordering') {
      base.correct_order = ['', ''];
    }
    setEditing((e) => (e ? {
      ...e,
      questions: [...e.questions, base],
    } : e));
  };

  const removeQuestion = (idx) => {
    setEditing((e) => {
      if (!e) return e;
      const q = e.questions[idx];
      if (!q?.id) return { ...e, questions: e.questions.filter((_, i) => i !== idx) };
      return { ...e, questions: e.questions.filter((_, i) => i !== idx) };
    });
  };

  const saveQuestions = async () => {
    if (!editing) return;
    // Validate each question before hitting the API.
    for (const q of editing.questions) {
      if (!q.prompt.trim()) { setErr(t('Every question needs a prompt.', 'Chak kesyon bezwen yon kesyon.')); return; }
      const qType = q.question_type || 'multiple_choice';
      if (qType === 'multiple_choice' || qType === 'true_false') {
        const filled = (q.choices || []).filter((c) => String(c).trim() !== '');
        if (filled.length < 2) { setErr(t('Every question needs at least 2 choices.', 'Chak kesyon bezwen omwen 2 chwa.')); return; }
        if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= (q.choices || []).length) {
          setErr(t('Mark the correct answer.', 'Make bon repons lan.')); return;
        }
      } else if (qType === 'fill_blank') {
        if (!String(q.correct_answer || '').trim()) {
          setErr(t('Fill-blank needs a correct answer.', 'Ranj bwat bezwen yon bon repons.')); return;
        }
      } else if (qType === 'matching') {
        const pairs = (q.matching_pairs || []).filter((p) => (p.left || '').trim() && (p.right || '').trim());
        if (pairs.length < 1) { setErr(t('Matching needs at least 1 pair.', 'Asosye bezwen omwen 1 par.')); return; }
      } else if (qType === 'ordering') {
        const items = (q.correct_order || []).filter((s) => String(s || '').trim());
        if (items.length < 2) { setErr(t('Ordering needs at least 2 items.', 'Tròte bezwen omwen 2 bagay.')); return; }
      }
    }
    setBusy(true); setErr(''); setMsg('');
    try {
      // Delete questions removed from the list (existing ids only).
      const existingIds = new Set(editing.questions.map((q) => q.id).filter(Boolean));
      for (const q of editing.quiz.questions || []) {
        if (q.id && !existingIds.has(q.id)) {
          try { await quizQuestionService.remove(q.id); } catch (_) { /* keep going */ }
        }
      }
      for (let i = 0; i < editing.questions.length; i += 1) {
        const q = editing.questions[i];
        const qType = q.question_type || 'multiple_choice';
        const payload = {
          quiz_id: editing.quiz.id,
          question_type: qType,
          prompt: q.prompt.trim(),
          choices: (q.choices || []).map((c) => String(c).trim()).filter((c) => c !== ''),
          correct_index: q.correct_index,
          correct_answer: q.correct_answer || '',
          matching_pairs: q.matching_pairs || [],
          correct_order: q.correct_order || [],
          explanation: q.explanation?.trim() || '',
          order: i,
        };
        if (q.id) await quizQuestionService.update(q.id, payload);
        else await quizQuestionService.create(payload);
      }
      setMsg(t('Questions saved.', 'Kesyon yo sove.'));
      openEdit({ ...editing.quiz });
    } catch (e) {
      setErr(e?.response?.data?.detail || t('Could not save questions.', 'Pa t kapab sove kesyon yo.'));
    } finally { setBusy(false); }
  };

  if (!courseId) {
    return (
      <div className={styles.quizEditor}>
        <div className={styles.quizEditorNote}>
          <i className="fas fa-circle-info" aria-hidden="true" />
          {t(
            'Save the course first, then add quizzes to this module.',
            'Sove kou a anvan, Lè sa a ajoute kiz nan modil sa a.',
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.quizEditor}>
      <div className={styles.quizEditorHeader}>
        <span className={styles.quizEditorTitle}>
          <i className="fas fa-clipboard-question" aria-hidden="true" />
          {t('Quiz', 'Kiz')}
        </span>
        {!editing && (
          <button type="button" className={styles.quizEditorAdd} onClick={() => setDraft({ title: '', pass_score: 70 })}>
            <i className="fas fa-plus" aria-hidden="true" /> {t('Add quiz', 'Ajoute kiz')}
          </button>
        )}
      </div>

      {msg && <p className={styles.quizEditorMsg} role="status"><i className="fas fa-circle-check" aria-hidden="true" /> {msg}</p>}
      {err && <p className={styles.quizEditorErr} role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {err}</p>}
      {loadError && !quizzes && <p className={styles.quizEditorErr} role="alert">{loadError}</p>}

      {draft && !editing && (
        <div className={styles.quizDraft}>
          <label className={styles.practiceDraftField}>
            <span>{t('Quiz title', 'Tit kiz')}</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t('e.g. Module 1 check', 'e.g. Tès Modil 1')} maxLength={200} />
          </label>
          <label className={styles.practiceDraftField}>
            <span>{t('Pass score (%)', 'Nòt pou pase (%)')}</span>
            <input type="number" min="0" max="100" value={draft.pass_score} onChange={(e) => setDraft({ ...draft, pass_score: e.target.value })} />
          </label>
          <div className={styles.practiceDraftActions}>
            <button type="button" className={styles.practiceDraftCancel} onClick={() => setDraft(null)} disabled={busy}>
              {t('Cancel', 'Anile')}
            </button>
            <button type="button" className={styles.practiceDraftSave} onClick={saveQuiz} disabled={busy}>
              {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />}
              {t('Add quiz', 'Ajoute kiz')}
            </button>
          </div>
        </div>
      )}

      {quizzes === null && !loadError && (
        <p className={styles.quizEditorLoading}><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Loading…', 'Ap chaje…')}</p>
      )}

      {quizzes && quizzes.length === 0 && !draft && !editing && (
        <p className={styles.quizEditorEmpty}>
          {t(
            'No quiz in this module yet. Add one to assess what students learned.',
            'Pa gen kiz nan modil sa a ankò. Ajoute youn pou evalye sa elèv yo aprann.',
          )}
        </p>
      )}

      {!editing && quizzes && quizzes.map((quiz) => (
        <div key={quiz.id} className={styles.quizRow}>
          <span className={styles.quizRowIcon}><i className="fas fa-clipboard-question" aria-hidden="true" /></span>
          <span className={styles.quizRowTitle}>{quiz.title}</span>
          <span className={styles.quizRowMeta}>
            {t('Pass', 'Pase')} {quiz.pass_score}% · {Array.isArray(quiz.questions) ? quiz.questions.length : 0} {t('questions', 'kesyon')}
          </span>
          <span className={styles.quizRowActions}>
            <button type="button" onClick={() => openEdit(quiz)} disabled={busy} aria-label={t('Edit', 'Modifye')} title={t('Edit', 'Modifye')}>
              <i className="fas fa-pen" aria-hidden="true" />
            </button>
            <button type="button" className={styles.quizRowDanger} onClick={() => deleteQuiz(quiz)} disabled={busy} aria-label={t('Delete', 'Efase')} title={t('Delete', 'Efase')}>
              <i className="fas fa-trash" aria-hidden="true" />
            </button>
          </span>
        </div>
      ))}

      {editing && (
        <div className={styles.quizEditPanel} role="dialog" aria-label={t('Edit quiz', 'Modifye kiz')}>
          <div className={styles.quizEditHeader}>
            <strong>{t('Edit quiz', 'Modifye kiz')}</strong>
            <button type="button" className={styles.quizEditClose} onClick={() => setEditing(null)} aria-label={t('Close', 'Fèmen')}>
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>

          <div className={styles.quizEditMeta}>
            <label className={styles.practiceDraftField}>
              <span>{t('Quiz title', 'Tit kiz')}</span>
              <input value={editing.quiz.title || ''} onChange={(e) => setQuizField('title', e.target.value)} maxLength={200} />
            </label>
            <label className={styles.practiceDraftField}>
              <span>{t('Pass score (%)', 'Nòt pou pase (%)')}</span>
              <input type="number" min="0" max="100" value={editing.quiz.pass_score ?? 70} onChange={(e) => setQuizField('pass_score', e.target.value)} />
            </label>
            <div className={styles.quizSettingsRow}>
              <label className={styles.practiceDraftField}>
                <span>{t('Max attempts', 'Efò maksimòm')}</span>
                <input type="number" min="0" value={editing.quiz.max_attempts ?? 0} onChange={(e) => setQuizField('max_attempts', e.target.value)} placeholder={t('0 = unlimited', '0 = san limit')} />
              </label>
              <label className={styles.practiceDraftField}>
                <span>{t('Time limit (min)', 'Tan limit (min)')}</span>
                <input type="number" min="0" value={editing.quiz.time_limit_minutes ?? 0} onChange={(e) => setQuizField('time_limit_minutes', e.target.value)} placeholder={t('0 = no limit', '0 = pa gen limit')} />
              </label>
            </div>
            <div className={styles.quizTogglesRow}>
              <label className={styles.quizToggle}>
                <input type="checkbox" checked={!!editing.quiz.randomize_questions} onChange={(e) => setQuizField('randomize_questions', e.target.checked)} />
                <span>{t('Shuffle questions', 'Melanje kesyon yo')}</span>
              </label>
              <label className={styles.quizToggle}>
                <input type="checkbox" checked={!!editing.quiz.randomize_answers} onChange={(e) => setQuizField('randomize_answers', e.target.checked)} />
                <span>{t('Shuffle answers', 'Melanje repons yo')}</span>
              </label>
              <label className={styles.quizToggle}>
                <input type="checkbox" checked={!!editing.quiz.show_explanations} onChange={(e) => setQuizField('show_explanations', e.target.checked)} />
                <span>{t('Show explanations', 'Montre explikasyon')}</span>
              </label>
            </div>
            <div className={styles.quizEditMetaActions}>
              <button type="button" className={styles.quizMetaSave} onClick={updateQuiz} disabled={busy}>
                {t('Save quiz', 'Sove kiz')}
              </button>
            </div>
          </div>

          <div className={styles.quizQuestionsHeader}>
            <span>{t('Questions', 'Kesyon')}</span>
            <div className={styles.quizAddQuestionGroup}>
              {QUESTION_TYPES.map((qt) => (
                <button key={qt.value} type="button" className={styles.quizAddQuestion} onClick={() => addQuestion(qt.value)} title={qt.label[lang]}>
                  <i className={`fas ${qt.icon}`} aria-hidden="true" /> {qt.label[lang]}
                </button>
              ))}
            </div>
          </div>

          {editing.questions.length === 0 && (
            <p className={styles.quizEditorEmpty}>{t('No questions yet — add the first one.', 'Pa gen kesyon ankò — ajoute premye a.')}</p>
          )}

          {editing.questions.map((q, qi) => {
            const qType = q.question_type || 'multiple_choice';
            const typeMeta = QUESTION_TYPES.find((t) => t.value === qType) || QUESTION_TYPES[0];
            return (
              <div key={q.id || `q-${qi}`} className={styles.quizQuestion}>
                <div className={styles.quizQuestionTop}>
                  <span className={styles.quizQuestionNum}>{qi + 1}</span>
                  <select
                    className={styles.quizTypeSelect}
                    value={qType}
                    onChange={(e) => setQuestionField(qi, 'question_type', e.target.value)}
                  >
                    {QUESTION_TYPES.map((qt) => (
                      <option key={qt.value} value={qt.value}>{qt.label[lang]}</option>
                    ))}
                  </select>
                  <input
                    className={styles.quizQuestionPrompt}
                    value={q.prompt}
                    onChange={(e) => setQuestionField(qi, 'prompt', e.target.value)}
                    placeholder={t('Question…', 'Kesyon…')}
                    maxLength={500}
                  />
                  <button type="button" className={styles.quizQuestionRemove} onClick={() => removeQuestion(qi)} aria-label={t('Remove', 'Retire')} title={t('Remove', 'Retire')}>
                    <i className="fas fa-xmark" aria-hidden="true" />
                  </button>
                </div>

                {/* ─── Multiple Choice ──────────────────────────── */}
                {qType === 'multiple_choice' && (
                  <div className={styles.quizChoices}>
                    {(q.choices || []).map((c, ci) => (
                      <label key={ci} className={`${styles.quizChoice} ${Number(q.correct_index) === ci ? styles.quizChoiceCorrect : ''}`}>
                        <input type="radio" name={`correct-${qi}`} checked={Number(q.correct_index) === ci} onChange={() => setQuestionField(qi, 'correct_index', ci)} />
                        <input className={styles.quizChoiceText} value={c} onChange={(e) => { const ch = [...q.choices]; ch[ci] = e.target.value; setQuestionField(qi, 'choices', ch); }} placeholder={`${t('Choice', 'Chwa')} ${ci + 1}`} maxLength={200} />
                        {Number(q.correct_index) === ci && <span className={styles.quizChoiceBadge}><i className="fas fa-check" /> {t('Correct', 'Kòrèk')}</span>}
                      </label>
                    ))}
                    {(q.choices || []).length < 6 && <button type="button" className={styles.quizAddChoice} onClick={() => setQuestionField(qi, 'choices', [...(q.choices || []), ''])}><i className="fas fa-plus" /> {t('Add choice', 'Ajoute chwa')}</button>}
                    {(q.choices || []).length > 2 && <button type="button" className={styles.quizRemoveChoice} onClick={() => setQuestionField(qi, 'choices', (q.choices || []).slice(0, -1))}>{t('Remove choice', 'Retire chwa')}</button>}
                  </div>
                )}

                {/* ─── True / False ──────────────────────────────── */}
                {qType === 'true_false' && (
                  <div className={styles.quizChoices}>
                    <label className={`${styles.quizChoice} ${Number(q.correct_index) === 0 ? styles.quizChoiceCorrect : ''}`}>
                      <input type="radio" name={`correct-${qi}`} checked={Number(q.correct_index) === 0} onChange={() => setQuestionField(qi, 'correct_index', 0)} />
                      <span className={styles.quizChoiceText}>✅ {t('True', 'Vre')}</span>
                    </label>
                    <label className={`${styles.quizChoice} ${Number(q.correct_index) === 1 ? styles.quizChoiceCorrect : ''}`}>
                      <input type="radio" name={`correct-${qi}`} checked={Number(q.correct_index) === 1} onChange={() => setQuestionField(qi, 'correct_index', 1)} />
                      <span className={styles.quizChoiceText}>❌ {t('False', 'Fa')}</span>
                    </label>
                  </div>
                )}

                {/* ─── Fill in the Blank ──────────────────────────── */}
                {qType === 'fill_blank' && (
                  <div className={styles.quizFillBlank}>
                    <label className={styles.practiceDraftField}>
                      <span>{t('Correct answer (case-insensitive)', 'Bon repons (pa gen diferans lèt majiskil)')}</span>
                      <input
                        className={styles.quizFillInput}
                        value={q.correct_answer || ''}
                        onChange={(e) => setQuestionField(qi, 'correct_answer', e.target.value)}
                        placeholder={t('e.g. Port-au-Prince', 'e.g. Pòtoprens')}
                        maxLength={500}
                      />
                    </label>
                  </div>
                )}

                {/* ─── Matching ──────────────────────────────────── */}
                {qType === 'matching' && (
                  <div className={styles.quizMatching}>
                    <p className={styles.quizMatchingHint}>{t('Match left items to right options', 'Asosye gòch ak dwat')}</p>
                    {(q.matching_pairs || []).map((pair, pi) => (
                      <div key={pi} className={styles.quizMatchingPair}>
                        <input className={styles.quizMatchingLeft} value={pair.left || ''} onChange={(e) => { const pairs = [...(q.matching_pairs || [])]; pairs[pi] = { ...pairs[pi], left: e.target.value }; setQuestionField(qi, 'matching_pairs', pairs); }} placeholder={t('Left', 'Gòch')} maxLength={200} />
                        <span className={styles.quizMatchingArrow}>→</span>
                        <input className={styles.quizMatchingRight} value={pair.right || ''} onChange={(e) => { const pairs = [...(q.matching_pairs || [])]; pairs[pi] = { ...pairs[pi], right: e.target.value }; setQuestionField(qi, 'matching_pairs', pairs); }} placeholder={t('Right', 'Dwat')} maxLength={200} />
                        <button type="button" className={styles.quizMatchingRemove} onClick={() => setQuestionField(qi, 'matching_pairs', (q.matching_pairs || []).filter((_, i) => i !== pi))} title={t('Remove', 'Retire')}><i className="fas fa-xmark" /></button>
                      </div>
                    ))}
                    <button type="button" className={styles.quizAddChoice} onClick={() => setQuestionField(qi, 'matching_pairs', [...(q.matching_pairs || []), { left: '', right: '' }])}><i className="fas fa-plus" /> {t('Add pair', 'Ajoute par')}</button>
                  </div>
                )}

                {/* ─── Ordering ──────────────────────────────────── */}
                {qType === 'ordering' && (
                  <div className={styles.quizOrdering}>
                    <p className={styles.quizOrderingHint}>{t('Enter items in the correct order (top = first)', 'Antre nan lòd kòrèk (anlè = premye)')}</p>
                    {(q.correct_order || []).map((item, ii) => (
                      <div key={ii} className={styles.quizOrderingItem}>
                        <span className={styles.quizOrderingNum}>{ii + 1}.</span>
                        <input className={styles.quizOrderingText} value={item} onChange={(e) => { const order = [...(q.correct_order || [])]; order[ii] = e.target.value; setQuestionField(qi, 'correct_order', order); }} placeholder={`${t('Item', 'Bagay')} ${ii + 1}`} maxLength={200} />
                        <button type="button" className={styles.quizMatchingRemove} onClick={() => setQuestionField(qi, 'correct_order', (q.correct_order || []).filter((_, i) => i !== ii))} title={t('Remove', 'Retire')}><i className="fas fa-xmark" /></button>
                      </div>
                    ))}
                    <button type="button" className={styles.quizAddChoice} onClick={() => setQuestionField(qi, 'correct_order', [...(q.correct_order || []), ''])}><i className="fas fa-plus" /> {t('Add item', 'Ajoute bagay')}</button>
                  </div>
                )}

                <div className={styles.quizQuestionMeta}>
                  <label className={styles.practiceDraftField}>
                    <span>{t('Explanation (optional)', 'Eksplikasyon (opsyonèl)')}</span>
                    <textarea value={q.explanation || ''} onChange={(e) => setQuestionField(qi, 'explanation', e.target.value)} rows={2} maxLength={500} />
                  </label>
                  <label className={styles.practiceDraftField}>
                    <span>{t('Hint (optional)', 'Indis (opsyonèl)')}</span>
                    <input value={q.hint || ''} onChange={(e) => setQuestionField(qi, 'hint', e.target.value)} placeholder={t('Optional hint for learners', 'Indis opsyonèl pou elèv yo')} maxLength={300} />
                  </label>
                  <label className={styles.practiceDraftField}>
                    <span>{t('Points', 'Pwen')}</span>
                    <input type="number" min="1" max="100" value={q.points ?? 1} onChange={(e) => setQuestionField(qi, 'points', e.target.value)} />
                  </label>
                </div>
              </div>
            );
          })}

          <div className={styles.quizEditFooter}>
            <button type="button" className={styles.practiceDraftCancel} onClick={() => setEditing(null)} disabled={busy}>
              {t('Done', 'Fini')}
            </button>
            <button type="button" className={styles.practiceDraftSave} onClick={saveQuestions} disabled={busy}>
              {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />}
              {t('Save questions', 'Sove kesyon')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
