/**
 * src/components/studio/editor/ContentValidationEngine.jsx
 *
 * Content validation engine UI for Creator Studio.
 * Validates chapters → lessons → blocks and shows a quality report
 * with errors, warnings, and recommendations.
 *
 * Features:
 *   - Real-time validation of all content blocks
 *   - Quality scoring per lesson and per course
 *   - Clickable issue list that jumps to the problematic block/chapter
 *   - Validation summary with publish-readiness indicator
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { chapterService, lessonService, contentBlockService } from '../../../services/api';
import {
  validateCourseContent,
  validateLessonBlocks,
  scoreLessonContent,
} from '../../learning/blocks/blockSchema';
import { validateLessonAccessibility, validateCourseAccessibility } from '../../../accessibility/utils/validation';
import styles from './editor.module.css';

/* ─── Score ring ──────────────────────────────────────────────────── */
function ScoreRing({ score, size = 52 }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.2)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.9rem', color,
      }}>
        {score}
      </div>
    </div>
  );
}

/* ─── Issue item ──────────────────────────────────────────────────── */
function IssueItem({ issue, type, onClick }) {
  const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '💡';
  const severityLabel = type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info';
  return (
    <button
      type="button"
      className={styles.validationIssue}
      onClick={() => onClick?.(issue)}
      title={issue.target ? 'Click to navigate to this issue' : undefined}
      aria-label={`${severityLabel}: ${issue.message}${issue.target ? ' — click to navigate' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '8px 12px',
        border: 'none',
        background: 'transparent',
        width: '100%',
        textAlign: 'left',
        cursor: issue.target ? 'pointer' : 'default',
        borderRadius: '6px',
        fontSize: '0.82rem',
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        minHeight: '44px',
        transition: 'background 0.15s',
      }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{issue.message}</span>
      {issue.target && (
        <i className="fas fa-arrow-right" aria-hidden="true"
          style={{ fontSize: '0.7rem', color: 'var(--color-primary)', opacity: 0.6, flexShrink: 0, marginTop: '3px' }} />
      )}
    </button>
  );
}

/* ─── Main ContentValidationEngine ────────────────────────────────── */
export default function ContentValidationEngine({
  courseId,
  chapters: propChapters,
  lang = 'ht',
  onNavigate,
  showToast,
}) {
  const isHt = lang === 'ht';

  const [loading, setLoading] = useState(false);
  const [courseResult, setCourseResult] = useState(null);
  const [lessonScores, setLessonScores] = useState({});
  const [showDetails, setShowDetails] = useState(false);

  /* ─── Load and validate ──────────────────────────────────────────── */
  const validate = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);

    try {
      // Fetch chapters with nested lessons
      const chRes = await chapterService.list(courseId);
      const chapters = Array.isArray(chRes.data) ? chRes.data : (chRes.data?.results || []);

      // Fetch lessons for each chapter
      const enrichedChapters = await Promise.all(chapters.map(async (ch) => {
        const lr = await lessonService.list(ch.id);
        const lessons = Array.isArray(lr.data) ? lr.data : (lr.data?.results || []);

        // Fetch blocks for each lesson
        const enrichedLessons = await Promise.all(lessons.map(async (lesson) => {
          const br = await contentBlockService.list(lesson.id);
          const blocks = Array.isArray(br.data) ? br.data : (br.data?.results || []);
          return { ...lesson, blocks };
        }));

        return { ...ch, lessons: enrichedLessons };
      }));

      // Validate all content
      const result = validateCourseContent(enrichedChapters);
      setCourseResult(result);

      // Score each lesson
      const scores = {};
      enrichedChapters.forEach((ch) => {
        (ch.lessons || []).forEach((lesson) => {
          const lessonResult = scoreLessonContent(lesson.blocks || []);
          const a11yResult = validateLessonAccessibility(lesson.blocks || []);
          scores[lesson.id] = {
            title: lesson.title,
            chapterTitle: ch.title,
            ...lessonResult,
            a11yErrors: a11yResult.errorCount,
            a11yWarnings: a11yResult.warningCount,
            a11yInfos: a11yResult.infoCount,
          };
        });
      });
      setLessonScores(scores);

      // Accessibility validation summary
      const a11yResult = validateCourseAccessibility(enrichedChapters);
      setCourseResult((prev) => ({
        ...prev,
        a11yErrors: a11yResult.totalErrors,
        a11yWarnings: a11yResult.totalWarnings,
        a11yInfos: a11yResult.totalInfos,
        a11yValid: a11yResult.valid,
      }));
    } catch (err) {
      showToast?.(err?.message || (isHt ? 'Pa t kapab valide.' : 'Could not validate.'), 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [courseId, isHt, showToast]);

  useEffect(() => { validate(); }, [validate]);

  /* ─── Summary stats ──────────────────────────────────────────────── */
  const stats = useMemo(() => {
    if (!courseResult) return null;
    const avgScore = Object.values(lessonScores).reduce((sum, s) => sum + (Number(s.score) || 0), 0) / Math.max(1, Object.keys(lessonScores).length);
    return {
      publishable: courseResult.valid && courseResult.a11yValid !== false,
      errorCount: courseResult.errors.length + (courseResult.a11yErrors || 0),
      warningCount: courseResult.warnings.length + (courseResult.a11yWarnings || 0),
      recCount: courseResult.recommendations.length + (courseResult.a11yInfos || 0),
      lessonCount: Object.keys(lessonScores).length,
      avgScore,
      a11yValid: courseResult.a11yValid !== false,
      a11yErrors: courseResult.a11yErrors || 0,
      a11yWarnings: courseResult.a11yWarnings || 0,
      readinessLevel: courseResult.valid && courseResult.a11yValid !== false ? 'ready' : (courseResult.errors.length > 0 || (courseResult.a11yErrors || 0) > 0 ? 'blocked' : 'needs_attention'),
    };
  }, [courseResult, lessonScores]);

  /* ─── Render ─────────────────────────────────────────────────────── */
  return (
    <div className={styles.validationEngine}>
      {/* Header */}
      <div className={styles.validationHeader}>
        <div className={styles.validationHeaderLeft}>
          <i className="fas fa-shield-halved" aria-hidden="true" />
          <span className={styles.validationHeaderText}>
            {isHt ? 'Validasyon Kontni' : 'Content Validation'}
          </span>
        </div>
        <button
          type="button"
          className={styles.validationRefreshBtn}
          onClick={validate}
          disabled={loading}
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-refresh'}`} />
          {isHt ? 'Rechaje' : 'Refresh'}
        </button>
      </div>

      {loading && !stats ? (
        <div className={styles.validationLoading}>
          <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap valide...' : 'Validating...'}
        </div>
      ) : stats ? (
        <>
          {/* Score summary */}
          <div className={styles.validationSummary}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', background: stats.readinessLevel === 'ready' ? '#10b981' : stats.readinessLevel === 'needs_attention' ? '#f59e0b' : '#ef4444' }}>
              {stats.readinessLevel === 'ready' ? '✓' : stats.readinessLevel === 'needs_attention' ? '!' : 'X'}
            </div>
            <div className={styles.validationSummaryInfo}>
              <div className={styles.validationSummaryStatus}>
                {stats.publishable ? (
                  <span className={styles.validationStatusGood}>
                    <i className="fas fa-check-circle" /> {isHt ? 'Pibliyab' : 'Publishable'}
                  </span>
                ) : (
                  <span className={styles.validationStatusBad}>
                    <i className="fas fa-exclamation-circle" /> {isHt ? 'Pa pibliyab' : 'Not publishable'}
                  </span>
                )}
              </div>
              <div className={styles.validationSummaryCounts}>
                <span className={styles.validationCountError}>{stats.errorCount} {isHt ? 'erè' : 'errors'}</span>
                <span className={styles.validationCountWarning}>{stats.warningCount} {isHt ? 'avètisman' : 'warnings'}</span>
                <span className={styles.validationCountInfo}>{stats.recCount} {isHt ? 'konsèy' : 'tips'}</span>
              </div>
              <div className={styles.validationSummaryLessons}>
                {stats.lessonCount} {isHt ? 'leson' : 'lessons'} · {isHt ? 'eta' : 'status'}: {stats.readinessLevel === 'ready' ? (isHt ? 'pare' : 'ready') : stats.readinessLevel === 'needs_attention' ? (isHt ? 'atansyon' : 'attention') : (isHt ? 'bloke' : 'blocked')}
              </div>
            </div>
          </div>

          {/* Issues list */}
          {(stats.errorCount > 0 || stats.warningCount > 0) && (
            <div className={styles.validationIssues}>
              <button
                type="button"
                className={styles.validationToggle}
                onClick={() => setShowDetails(!showDetails)}
              >
                <i className={`fas ${showDetails ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
                {isHt ? 'Detay problem yo' : 'Issue details'}
              </button>
              {showDetails && (
                <div className={styles.validationIssueList}>
                  {courseResult.errors.map((err, i) => (
                    <IssueItem
                      key={`e${i}`}
                      issue={{ message: err }}
                      type="error"
                      onClick={() => onNavigate?.(err)}
                    />
                  ))}
                  {courseResult.warnings.map((warn, i) => (
                    <IssueItem
                      key={`w${i}`}
                      issue={{ message: warn }}
                      type="warning"
                      onClick={() => onNavigate?.(warn)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {courseResult.recommendations.length > 0 && (
            <div className={styles.validationRecs}>
              {courseResult.recommendations.map((rec, i) => (
                <div key={i} className={styles.validationRecItem}>
                  💡 {rec}
                </div>
              ))}
            </div>
          )}

          {/* Accessibility summary */}
          {stats && (
            <div className={styles.validationRecs} style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: stats.a11yValid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                <span style={{ fontSize: '0.9rem' }}>{stats.a11yValid ? '♿' : '♿'}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {isHt ? 'Aksesibilite' : 'Accessibility'}:
                </span>
                <span style={{ fontSize: '0.82rem' }}>
                  {stats.a11yValid
                    ? (isHt ? 'Pare ✅' : 'Ready ✅')
                    : (isHt
                        ? `${stats.a11yErrors} erè, ${stats.a11yWarnings} avètisman`
                        : `${stats.a11yErrors} errors, ${stats.a11yWarnings} warnings`)}
                </span>
              </div>
            </div>
          )}

          {/* Lesson scores */}
          {Object.keys(lessonScores).length > 0 && (
            <div className={styles.validationLessonScores}>
              <h4 className={styles.validationLessonScoresTitle}>
                {isHt ? 'Sko pa Leson' : 'Scores by Lesson'}
              </h4>
              {Object.entries(lessonScores).map(([id, data]) => (
                <div key={id} className={styles.validationLessonRow}>
                  <span className={styles.validationLessonTitle}>
                    {data.chapterTitle && <span className={styles.validationLessonChapter}>{data.chapterTitle} → </span>}
                    {data.title || id}
                  </span>
                  <ScoreRing score={data.score} size={32} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className={styles.validationEmpty}>
          {isHt ? 'Rechaje pou tcheke kontni an.' : 'Refresh to check content.'}
        </p>
      )}
    </div>
  );
}
