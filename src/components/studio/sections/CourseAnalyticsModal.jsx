/**
 * src/components/studio/sections/CourseAnalyticsModal.jsx
 *
 * Creator-only course intelligence — REAL backend data only:
 *   • /api/courses/<id>/analytics/   — enrollments, avg progress %,
 *     completions, active learners, quiz attempts (computed from real
 *     Enrollment / UserProgress / QuizAttempt rows).
 *   • /api/courses/students/         — per-course enrolled learners
 *     with their real progress %.
 *
 * Nothing is invented or inferred. Non-owner access is rejected
 * server-side (403), so this modal only ever shows for courses the
 * creator owns.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { courseService, speechSubmissionService, blockSubmissionService } from '../../../services/api';
import styles from './sections.module.css';

export default function CourseAnalyticsModal({ course, lang = 'ht', onClose }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [analytics, setAnalytics] = useState(null);
  const [students, setStudents] = useState(null);
  const [speech, setSpeech] = useState(null); // real SpeechSubmission rows
  const [speechReport, setSpeechReport] = useState(null); // aggregate analysis
  const [submissions, setSubmissions] = useState(null); // real BlockSubmission rows
  const [grading, setGrading] = useState({}); // id -> {score, feedback, status}
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [anaRes, stuRes, spRes, reportRes, subRes] = await Promise.all([
        courseService.getAnalytics(course.id),
        courseService.getStudents(),
        // Creator review of learner voice submissions — REAL rows from
        // SpeechSubmission (transcript + recognition confidence + word-
        // level analysis), newest first, capped server-side.
        speechSubmissionService.list(course.id, { limit: 100 }),
        // Aggregate of those analyses: pass rates + hardest words.
        speechSubmissionService.report(course.id),
        // Creator review of assignment / project submissions.
        blockSubmissionService.list(course.id, { limit: 100 }),
      ]);
      setAnalytics(anaRes?.data || {});
      setSpeechReport(reportRes?.data || null);
      const list = Array.isArray(stuRes?.data) ? stuRes.data : [];
      const row = list.find((r) => Number(r.course_id) === Number(course.id)) || null;
      setStudents(row ? (Array.isArray(row.students) ? row.students : []) : []);
      const spData = spRes?.data;
      setSpeech(Array.isArray(spData) ? spData : (Array.isArray(spData?.results) ? spData.results : []));
      const subData = subRes?.data;
      setSubmissions(Array.isArray(subData) ? subData : (Array.isArray(subData?.results) ? subData.results : []));
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not load course data.', 'Pa t kapab chaje done kou a.'));
    }
  }, [course.id, lang]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { load(); }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Creator grading — PATCH score / feedback / status ─────────────
  const saveGrade = useCallback(async (sub) => {
    const g = grading[sub.id] || {};
    const payload = {};
    if (g.score !== undefined && g.score !== '' && g.score != null) payload.score = g.score;
    if (g.feedback !== undefined) payload.feedback = g.feedback;
    if (g.status) payload.status = g.status;
    try {
      await blockSubmissionService.update(sub.id, payload);
      setGrading((p) => { const n = { ...p }; delete n[sub.id]; return n; });
      load();
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not save the grade.', 'Pa t kapab sove nòt la.'));
    }
  }, [grading, load, t]);

  const setGradeField = useCallback((id, field, value) => {
    setGrading((p) => ({ ...p, [id]: { ...(p[id] || {}), [field]: value } }));
  }, []);

  const stats = analytics
    ? [
        { icon: 'fa-user-graduate', label: t('Students', 'Elèv'), value: analytics.enrollment_count ?? 0 },
        { icon: 'fa-percent', label: t('Avg progress', 'Pwogrè mwayen'), value: `${analytics.avg_progress ?? 0}%` },
        { icon: 'fa-flag-checkered', label: t('Completed', 'Fini'), value: analytics.completions ?? 0 },
        { icon: 'fa-user-check', label: t('Active learners', 'Elèv aktif'), value: analytics.active_learners ?? 0 },
        { icon: 'fa-clipboard-question', label: t('Quiz attempts', 'Esè kiz'), value: analytics.quiz_attempts ?? 0 },
      ]
    : [];

  return (
    <div
      className={styles.analyticsBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Course analytics', 'Analitik kou')}
    >
      <div className={styles.analyticsModal}>
        <header className={styles.analyticsHeader}>
          <span className={styles.analyticsIcon}><i className="fas fa-chart-line" aria-hidden="true" /></span>
          <div>
            <h2>{t('Course Analytics', 'Analitik Kou')}</h2>
            <p className={styles.analyticsCourse}>{course.title}</p>
          </div>
          <button type="button" className={styles.analyticsClose} onClick={onClose} aria-label={t('Close', 'Fèmen')}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>

        {error && (
          <p className={styles.analyticsError} role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
          </p>
        )}

        {!analytics && !error && (
          <p className={styles.analyticsLoading}>
            <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('Loading…', 'Ap chaje…')}
          </p>
        )}

        {analytics && (
          <>
            <div className={styles.analyticsStats}>
              {stats.map((s) => (
                <div key={s.label} className={styles.analyticsStat}>
                  <span className={styles.analyticsStatIcon}><i className={`fas ${s.icon}`} aria-hidden="true" /></span>
                  <span className={styles.analyticsStatValue}>{s.value}</span>
                  <span className={styles.analyticsStatLabel}>{s.label}</span>
                </div>
              ))}
            </div>

            <section className={styles.analyticsStudents}>
              <h3>
                <i className="fas fa-users" aria-hidden="true" /> {t('Students', 'Elèv')}
                <span className={styles.analyticsCount}>{students?.length ?? 0}</span>
              </h3>
              {students && students.length === 0 ? (
                <p className={styles.analyticsEmpty}>
                  {t(
                    'No enrolled students yet. Share your course so learners can enroll.',
                    'Pa gen elèv enskri ankò. Pataje kou w pou elèv yo ka enskri.',
                  )}
                </p>
              ) : (
                <div className={styles.analyticsStudentList}>
                  {(students || []).map((s, i) => (
                    <div key={`${s.username}-${i}`} className={styles.analyticsStudentRow}>
                      <span className={styles.analyticsStudentAvatar}>
                        {String(s.display_name || s.username || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.analyticsStudentName}>
                        {s.display_name || s.username}
                        <span className={styles.analyticsStudentMeta}>
                          {s.username} · {t('enrolled', 'enskri')} {new Date(s.enrolled_at).toLocaleDateString()}
                        </span>
                      </span>
                      <span className={styles.analyticsProgressWrap}>
                        <span className={styles.analyticsProgressTrack}>
                          <span
                            className={styles.analyticsProgressFill}
                            style={{ width: `${Math.min(100, Math.max(0, s.progress || 0))}%` }}
                          />
                        </span>
                        <span className={styles.analyticsProgressLabel}>{s.progress || 0}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ─── Speech analysis report — aggregate creator insight ── */}
            {speechReport && (
              <section className={styles.analyticsStudents}>
                <h3>
                  <i className="fas fa-chart-column" aria-hidden="true" /> {t('Speech analysis report', 'Rapò analiz pale')}
                </h3>
                <div className={styles.analyticsStats}>
                  <div className={styles.analyticsStat}>
                    <span className={styles.analyticsStatValue}>{Math.round((speechReport.pass_rate || 0) * 100)}%</span>
                    <span className={styles.analyticsStatLabel}>{t('Pass rate', 'Pousantaj pas')}</span>
                  </div>
                  <div className={styles.analyticsStat}>
                    <span className={styles.analyticsStatValue}>{speechReport.with_analysis ?? 0}</span>
                    <span className={styles.analyticsStatLabel}>{t('Analyzed takes', 'Tantativ analize')}</span>
                  </div>
                  <div className={styles.analyticsStat}>
                    <span className={styles.analyticsStatValue}>{speechReport.passed ?? 0}</span>
                    <span className={styles.analyticsStatLabel}>{t('Passed', 'Pase')}</span>
                  </div>
                </div>

                {(speechReport.by_block || []).length > 0 && (
                  <div className={styles.analyticsStudentList}>
                    {(speechReport.by_block || []).map((b, i) => (
                      <div key={b.block_id || i} className={styles.analyticsStudentRow}>
                        <span className={styles.analyticsStudentName}>
                          {b.block_type || t('voice', 'vwa')}
                          <span className={styles.analyticsStudentMeta}>
                            {t('Block', 'Blòk')} {b.block_id} · {b.attempts} {t('takes', 'tantativ')} · {Math.round((b.pass_rate || 0) * 100)}% {t('pass', 'pas')}
                          </span>
                        </span>
                        <span className={styles.analyticsSpeechConfidence}>
                          {Math.round((b.pass_rate || 0) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.analyticsSpeechWords}>
                  {(speechReport.top_difficult_words || []).map((w, i) => (
                    <span
                      key={`dw-${i}`}
                      className={`${styles.analyticsSpeechWord} ${styles.analyticsSpeechWordNear}`}
                      title={(w.said || []).length ? `${w.word} → ${w.said.join(', ')}` : undefined}
                    >
                      <i className="fas fa-circle-half-stroke" aria-hidden="true" /> {w.word} ×{w.count}
                      {(w.said || []).length > 0 && (
                        <span className={styles.analyticsSpeechTranscript}>
                          {t('said', 'te di')}: {w.said.join(', ')}
                        </span>
                      )}
                    </span>
                  ))}
                  {(speechReport.top_missing_words || []).map((w, i) => (
                    <span key={`mw-${i}`} className={`${styles.analyticsSpeechWord} ${styles.analyticsSpeechWordMiss}`}>
                      <i className="fas fa-xmark" aria-hidden="true" /> {w.word} ×{w.count}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Speaking practice — REAL learner submissions ─────── */}
            {speech && (
              <section className={styles.analyticsStudents}>
                <h3>
                  <i className="fas fa-microphone-lines" aria-hidden="true" /> {t('Speaking practice', 'Pratik pale')}
                  <span className={styles.analyticsCount}>{speech.length}</span>
                </h3>
                {speech.length === 0 ? (
                  <p className={styles.analyticsEmpty}>
                    {t(
                      'No voice practice submissions yet. They appear here when learners record a response.',
                      'Pa gen soumès pratik vwa ankò. Yo ap parèt isit la lè elèv yo anrejistre yon repons.',
                    )}
                  </p>
                ) : (
                  <div className={styles.analyticsStudentList}>
                    {speech.slice(0, 30).map((s, i) => (
                      <div key={s.id || i} className={styles.analyticsStudentRow}>
                        <span className={styles.analyticsStudentAvatar}>
                          {String(s.username || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className={styles.analyticsStudentName}>
                          {s.username || s.user}
                          <span className={styles.analyticsStudentMeta}>
                            {s.block_type || t('voice', 'vwa')}
                            {s.module_index != null ? ` · ${t('Modil', 'Module')} ${Number(s.module_index) + 1}` : ''}
                            {' · '}{new Date(s.created_at).toLocaleDateString()}
                          </span>
                          {s.transcript && (
                            <span className={styles.analyticsSpeechTranscript}>“{s.transcript}”</span>
                          )}
                          {s.analysis && typeof s.analysis === 'object' && Number(s.analysis.totalWords) > 0 && (
                            <span className={styles.analyticsSpeechWords}>
                              {(s.analysis.matchedWords || []).map((w, i) => (
                                <span key={`ok-${i}`} className={`${styles.analyticsSpeechWord} ${styles.analyticsSpeechWordOk}`}>
                                  <i className="fas fa-check" aria-hidden="true" /> {w}
                                </span>
                              ))}
                              {(s.analysis.nearMisses || []).map((n, i) => (
                                <span
                                  key={`near-${i}`}
                                  className={`${styles.analyticsSpeechWord} ${styles.analyticsSpeechWordNear}`}
                                  title={n.said ? `${n.target} → “${n.said}”` : t('Almost — pronunciation', 'Preske — pwononsyasyon')}
                                >
                                  <i className="fas fa-circle-half-stroke" aria-hidden="true" /> {n.target}
                                </span>
                              ))}
                              {(s.analysis.missingWords || []).map((w, i) => (
                                <span key={`miss-${i}`} className={`${styles.analyticsSpeechWord} ${styles.analyticsSpeechWordMiss}`}>
                                  <i className="fas fa-xmark" aria-hidden="true" /> {w}
                                </span>
                              ))}
                              {(s.analysis.extraWords || []).map((w, i) => (
                                <span key={`extra-${i}`} className={`${styles.analyticsSpeechWord} ${styles.analyticsSpeechWordExtra}`}>
                                  <i className="fas fa-plus" aria-hidden="true" /> {w}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        {s.confidence != null && (
                          <span className={styles.analyticsSpeechConfidence}>
                            {Math.round(Number(s.confidence) * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ─── Assignment / project submissions — creator review ── */}
            {submissions && (
              <section className={styles.analyticsStudents}>
                <h3>
                  <i className="fas fa-pen-to-square" aria-hidden="true" /> {t('Assignments & projects', 'Tach & Pwojè')}
                  <span className={styles.analyticsCount}>{submissions.length}</span>
                </h3>
                {submissions.length === 0 ? (
                  <p className={styles.analyticsEmpty}>
                    {t(
                      'No assignment or project submissions yet. They appear here when a learner submits.',
                      'Pa gen soumès tach/pwojè ankò. Yo ap parèt isit la lè yon elèv soumèt.',
                    )}
                  </p>
                ) : (
                  <div className={styles.analyticsStudentList}>
                    {submissions.slice(0, 30).map((s, i) => {
                      const g = grading[s.id] || {};
                      const isAssignment = s.block_type !== 'project';
                      const statusLabel = s.status === 'graded'
                        ? t('Graded', 'Note')
                        : s.status === 'reviewed'
                          ? t('Reviewed', 'Revize')
                          : t('Pending', 'An atant');
                      const statusColor = s.status === 'graded' ? '#10b981' : s.status === 'reviewed' ? '#f59e0b' : '#94a3b8';
                      return (
                        <div key={s.id || i} className={styles.analyticsStudentRow}>
                          <span className={styles.analyticsStudentAvatar}>
                            {String(s.username || '?').charAt(0).toUpperCase()}
                          </span>
                          <span className={styles.analyticsStudentName}>
                            {s.username || s.user}
                            <span className={styles.analyticsStudentMeta}>
                              {isAssignment ? t('Assignment', 'Tach') : t('Project', 'Pwojè')}
                              {s.module_index != null ? ` · ${t('Modil', 'Module')} ${Number(s.module_index) + 1}` : ''}
                              {' · '}{new Date(s.created_at).toLocaleDateString()}
                            </span>
                            {s.content && <span className={styles.analyticsSpeechTranscript}>“{s.content}”</span>}
                            {/* Inline grading — score / status / feedback */}
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
                              <input
                                type="number" min="0" max="100" step="0.5"
                                placeholder={t('Score', 'Nòt')}
                                value={g.score ?? (s.score ?? '')}
                                onChange={(e) => setGradeField(s.id, 'score', e.target.value)}
                                style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.8rem', background: 'transparent', color: 'inherit' }}
                              />
                              <select
                                value={g.status ?? s.status}
                                onChange={(e) => setGradeField(s.id, 'status', e.target.value)}
                                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.8rem', background: 'transparent', color: 'inherit' }}
                              >
                                <option value="pending">{t('Pending', 'An atant')}</option>
                                <option value="reviewed">{t('Reviewed', 'Revize')}</option>
                                <option value="graded">{t('Graded', 'Note')}</option>
                              </select>
                              <input
                                type="text"
                                placeholder={t('Feedback…', 'Feedback…')}
                                value={g.feedback ?? (s.feedback || '')}
                                onChange={(e) => setGradeField(s.id, 'feedback', e.target.value)}
                                style={{ flex: 1, minWidth: 140, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.8rem', background: 'transparent', color: 'inherit' }}
                              />
                              <button
                                type="button"
                                onClick={() => saveGrade(s)}
                                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--color-primary, #d81b60)', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                {t('Save', 'Sove')}
                              </button>
                            </span>
                          </span>
                          <span className={styles.analyticsSpeechConfidence} style={{ color: statusColor }}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <footer className={styles.analyticsFooter}>
          <button type="button" className={styles.analyticsDone} onClick={onClose}>
            {t('Done', 'Fini')}
          </button>
        </footer>
      </div>
    </div>
  );
}
