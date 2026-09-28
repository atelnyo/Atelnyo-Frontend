/**
 * src/components/studio/sections/CurriculumAnalyticsModal.jsx
 *
 * Creator-only course intelligence for the new Chapter → Lesson curriculum:
 *   • /api/courses/<id>/curriculum_analytics/ — chapter/lesson-level completion,
 *     drop-off points, quiz scores, popular lessons
 *
 * All data computed from real backend rows (UserProgress, QuizAttempt).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { courseService } from '../../../services/api';
import styles from './sections.module.css';

export default function CurriculumAnalyticsModal({ course, lang = 'ht', onClose }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCh, setExpandedCh] = useState(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await courseService.getCurriculumAnalytics(course.id);
      setAnalytics(res?.data || null);
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not load analytics.', 'Pa t kapab chaje analitik yo.'));
    } finally {
      setLoading(false);
    }
  }, [course.id, lang]);

  useEffect(() => { load(); }, [load]);

  if (loading && !analytics) return (
    <div className={styles.analyticsBackdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.analyticsModal}>
        <p className={styles.analyticsLoading}><i className="fas fa-spinner fa-spin" /> {t('Loading…', 'Ap chaje…')}</p>
      </div>
    </div>
  );

  return (
    <div
      className={styles.analyticsBackdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Curriculum analytics', 'Analitik kurikilom')}
    >
      <div className={styles.analyticsModal} style={{ maxWidth: 720 }}>

        {/* Header */}
        <header className={styles.analyticsHeader}>
          <span className={styles.analyticsIcon}><i className="fas fa-sitemap" /></span>
          <div>
            <h2>{t('Curriculum Analytics', 'Analitik Kurikilom')}</h2>
            <p className={styles.analyticsCourse}>{course.title}</p>
          </div>
          <button type="button" className={styles.analyticsClose} onClick={onClose} aria-label={t('Close', 'Fèmen')}>
            <i className="fas fa-times" />
          </button>
        </header>

        {error && <p className={styles.analyticsError} role="alert"><i className="fas fa-circle-exclamation" /> {error}</p>}

        {analytics && (
          <>
            {/* ─── Overall Stats ────────────────────────────────── */}
            <div className={styles.analyticsStats}>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatIcon}><i className="fas fa-user-graduate" /></span>
                <span className={styles.analyticsStatValue}>{analytics.overall?.total_enrolled ?? 0}</span>
                <span className={styles.analyticsStatLabel}>{t('Enrolled', 'Enskri')}</span>
              </div>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatIcon}><i className="fas fa-percent" /></span>
                <span className={styles.analyticsStatValue}>{analytics.overall?.avg_progress ?? 0}%</span>
                <span className={styles.analyticsStatLabel}>{t('Avg progress', 'Pwogrè mwayen')}</span>
              </div>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatIcon}><i className="fas fa-flag-checkered" /></span>
                <span className={styles.analyticsStatValue}>{analytics.overall?.completions ?? 0}</span>
                <span className={styles.analyticsStatLabel}>{t('Completed', 'Fini')}</span>
              </div>
              <div className={styles.analyticsStat}>
                <span className={styles.analyticsStatIcon}><i className="fas fa-graduation-cap" /></span>
                <span className={styles.analyticsStatValue}>{analytics.overall?.completion_rate ?? 0}%</span>
                <span className={styles.analyticsStatLabel}>{t('Completion rate', 'Pousantaj konplisyon')}</span>
              </div>
            </div>

            {/* ─── Quiz Summary ─────────────────────────────────── */}
            {analytics.quiz_summary?.total_attempts > 0 && (
              <div className={styles.analyticsStats} style={{ marginTop: 'var(--sp-3xl, 12px)' }}>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsStatIcon}><i className="fas fa-clipboard-question" /></span>
                  <span className={styles.analyticsStatValue}>{analytics.quiz_summary.total_attempts}</span>
                  <span className={styles.analyticsStatLabel}>{t('Quiz attempts', 'Tantativ kiz')}</span>
                </div>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsStatIcon}><i className="fas fa-star" /></span>
                  <span className={styles.analyticsStatValue}>{analytics.quiz_summary.avg_score ?? '—'}%</span>
                  <span className={styles.analyticsStatLabel}>{t('Avg score', 'Nòt mwayen')}</span>
                </div>
                <div className={styles.analyticsStat}>
                  <span className={styles.analyticsStatIcon}><i className="fas fa-check-circle" /></span>
                  <span className={styles.analyticsStatValue}>{analytics.quiz_summary.pass_rate ?? '—'}%</span>
                  <span className={styles.analyticsStatLabel}>{t('Pass rate', 'Pousantaj pas')}</span>
                </div>
              </div>
            )}

            {/* ─── Drop-off Points ──────────────────────────────── */}
            {analytics.drop_off_lessons?.length > 0 && (
              <section className={styles.analyticsStudents} style={{ marginTop: 'var(--sp-3xl, 12px)' }}>
                <h3>
                  <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b' }} />{' '}
                  {t('Drop-off points', 'Pwen kote elèv yo kite kou a')}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
                  {t(
                    'Lessons where students stop progressing (completion rate drops below 50%).',
                    'Leson kote elèv yo kanpe sou pwogrè (pousantaj konplisyon desann anba 50%).'
                  )}
                </p>
                <div className={styles.analyticsStudentList}>
                  {analytics.drop_off_lessons.map((d, i) => (
                    <div key={d.lesson_id || i} className={styles.analyticsStudentRow}>
                      <span className={styles.analyticsStudentAvatar} style={{ background: '#f59e0b', fontSize: '0.7rem' }}>
                        <i className="fas fa-arrow-down" />
                      </span>
                      <span className={styles.analyticsStudentName}>
                        {d.title}
                        <span className={styles.analyticsStudentMeta}>
                          {d.from_rate}% → {d.to_rate}%
                        </span>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                        -{Math.round(d.from_rate - d.to_rate)}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Popular Lessons ──────────────────────────────── */}
            {analytics.popular_lessons?.length > 0 && (
              <section className={styles.analyticsStudents} style={{ marginTop: 'var(--sp-3xl, 12px)' }}>
                <h3>
                  <i className="fas fa-fire" style={{ color: '#ef4444' }} />{' '}
                  {t('Popular lessons', 'Leson popilè yo')}
                </h3>
                <div className={styles.analyticsStudentList}>
                  {analytics.popular_lessons.map((p, i) => (
                    <div key={p.lesson_id || i} className={styles.analyticsStudentRow}>
                      <span className={styles.analyticsStudentAvatar} style={{ background: '#ef4444', fontSize: '0.72rem', fontWeight: 700 }}>
                        {i + 1}
                      </span>
                      <span className={styles.analyticsStudentName}>
                        {p.title}
                        <span className={styles.analyticsStudentMeta}>
                          {p.completions} {t('completions', 'konplisyon')}
                        </span>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {p.completion_rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Chapter / Lesson Breakdown ───────────────────── */}
            <section className={styles.analyticsStudents} style={{ marginTop: 'var(--sp-3xl, 12px)' }}>
              <h3>
                <i className="fas fa-sitemap" />{' '}
                {t('Chapter breakdown', 'Detay chapit yo')}
              </h3>
              {analytics.chapters?.length === 0 && (
                <p className={styles.analyticsEmpty}>
                  {t('No chapters yet.', 'Pa gen chapit ankò.')}
                </p>
              )}
              <div className={styles.analyticsStudentList}>
                {(analytics.chapters || []).map((ch) => {
                  const isExpanded = expandedCh === ch.id;
                  const chLessons = ch.lessons || [];
                  const totalBlocks = chLessons.reduce((s, l) => s + (l.block_count || 0), 0);
                  const totalCompletions = chLessons.reduce((s, l) => s + (l.completions || 0), 0);
                  const avgRate = chLessons.length > 0
                    ? Math.round(chLessons.reduce((s, l) => s + (l.completion_rate || 0), 0) / chLessons.length)
                    : 0;
                  return (
                    <div key={ch.id}>
                      <div
                        className={styles.analyticsStudentRow}
                        style={{ cursor: 'pointer', padding: '10px 12px' }}
                        onClick={() => setExpandedCh(isExpanded ? null : ch.id)}
                      >
                        <span className={styles.analyticsStudentAvatar} style={{ fontSize: '0.7rem' }}>
                          <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
                        </span>
                        <span className={styles.analyticsStudentName}>
                          {ch.title}
                          <span className={styles.analyticsStudentMeta}>
                            {ch.lesson_count} {t('lessons', 'leson')} · {totalBlocks} {t('blocks', 'blòk')}
                          </span>
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: avgRate >= 70 ? '#10b981' : avgRate >= 40 ? '#f59e0b' : '#ef4444',
                        }}>
                          {avgRate}% {t('avg', 'mwayen')}
                        </span>
                      </div>
                      {isExpanded && chLessons.map((ls) => (
                        <div key={ls.id} className={styles.analyticsStudentRow} style={{ paddingLeft: 40 }}>
                          <span className={styles.analyticsStudentName}>
                            {ls.title}
                            <span className={styles.analyticsStudentMeta}>
                              {ls.block_count} {t('blocks', 'blòk')} · {ls.completions} {t('done', 'fè')}
                              {ls.quiz_avg_score != null && ` · ${t('quiz', 'kiz')}: ${ls.quiz_avg_score}%`}
                            </span>
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: ls.completion_rate >= 70 ? '#10b981' : ls.completion_rate >= 40 ? '#f59e0b' : '#ef4444',
                          }}>
                            {ls.completion_rate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
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
