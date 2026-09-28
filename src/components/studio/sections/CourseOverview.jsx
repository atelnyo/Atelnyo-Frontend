/**
 * src/components/studio/sections/CourseOverview.jsx
 *
 * Course overview widget for the creator dashboard — shows:
 *   - Course count by status (draft, published, archived)
 *   - Top performing courses (by enrollment)
 *   - Recent enrollments
 *
 * Uses REAL backend data only.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { courseService } from '../../../services/api';
import styles from './sections.module.css';

export default function CourseOverview({ lang = 'ht', onNavigate }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await courseService.getAll({ mine: true });
      const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setCourses(list);
    } catch {
      // Best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className={styles.courseOverview}>
        <div className={styles.courseOverviewLoading}>
          <i className="fas fa-spinner fa-spin" /> {t('Loading...', 'Ap chaje...')}
        </div>
      </div>
    );
  }

  if (courses.length === 0) return null;

  // Count by status
  const statusCounts = courses.reduce((acc, c) => {
    const s = c.status || 'draft';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // Top courses by enrollment (students_count or enrollment_count)
  const topCourses = [...courses]
    .sort((a, b) => (b.students_count || b.enrollment_count || 0) - (a.students_count || a.enrollment_count || 0))
    .slice(0, 5);

  const statusColors = {
    draft: '#6b7280',
    building: '#3b82f6',
    review: '#f59e0b',
    published: '#10b981',
    updating: '#6366f1',
    archived: '#ef4444',
  };

  return (
    <div className={styles.courseOverview}>
      <div className={styles.courseOverviewHeader}>
        <h3 className={styles.courseOverviewTitle}>
          <i className="fas fa-graduation-cap" aria-hidden="true" />
          {t('My Courses', 'Kou M yo')}
          <span className={styles.courseOverviewCount}>{courses.length}</span>
        </h3>
        {onNavigate && (
          <button
            type="button"
            className={styles.courseOverviewLink}
            onClick={() => onNavigate('courses')}
          >
            {t('View all', 'Gade tout')} <i className="fas fa-arrow-right" />
          </button>
        )}
      </div>

      {/* Status pills */}
      <div className={styles.courseStatusPills}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span
            key={status}
            className={styles.courseStatusPill}
            style={{ borderColor: statusColors[status] || '#6b7280', color: statusColors[status] || '#6b7280' }}
          >
            <span className={styles.courseStatusDot} style={{ background: statusColors[status] || '#6b7280' }} />
            {status === 'draft' ? t('Bouyon', 'Draft') :
             status === 'published' ? t('Pibliye', 'Published') :
             status === 'building' ? t('Ap bati', 'Building') :
             status === 'review' ? t('Revizyon', 'Review') :
             status === 'archived' ? t('Achive', 'Archived') :
             status}
            <span className={styles.courseStatusCount}>{count}</span>
          </span>
        ))}
      </div>

      {/* Top courses */}
      {topCourses.length > 0 && (
        <div className={styles.courseTopList}>
          <h4 className={styles.courseTopTitle}>
            <i className="fas fa-trophy" aria-hidden="true" />
            {t('Top Courses', 'Pi Bòn Kou')}
          </h4>
          {topCourses.map((c, i) => {
            const students = c.students_count || c.enrollment_count || 0;
            const progress = c.quality_score || 0;
            return (
              <div key={c.id} className={styles.courseTopRow}>
                <span className={styles.courseTopRank}>{i + 1}</span>
                <div className={styles.courseTopInfo}>
                  <span className={styles.courseTopName}>{c.title || t('San tit', 'Untitled')}</span>
                  <span className={styles.courseTopMeta}>
                    {students} {t('elèv', 'students')}
                    {c.price > 0 && ` · $${c.price}`}
                    {c.category && ` · ${c.category}`}
                  </span>
                </div>
                <div className={styles.courseTopProgress}>
                  <span
                    className={styles.courseTopProgressBar}
                    style={{
                      width: `${Math.min(100, progress)}%`,
                      background: progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#6b7280',
                    }}
                  />
                  <span className={styles.courseTopProgressLabel}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
