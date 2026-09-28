/**
 * src/components/studio/sections/CoursesSection.jsx
 *
 * Courses section — lists creator's courses with thumbnail, title, price,
 * student count, and status badge. Empty state with CTA to create first course.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useState } from 'react';
import { courseService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader, fmtCount } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import CourseAnalyticsModal from './CourseAnalyticsModal';
import CurriculumAnalyticsModal from './CurriculumAnalyticsModal';
import CourseExportImportModal from './CourseExportImportModal';
import styles from './sections.module.css';

export default function CoursesSection({ lang, t, showToast, setShowCourseModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const [analyticsCourse, setAnalyticsCourse] = useState(null);
  const [curriculumAnalyticsCourse, setCurriculumAnalyticsCourse] = useState(null);
  const [exportImportCourse, setExportImportCourse] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { data: courses, loading, refetch } = useFetch(
    () => courseService.getAll({ mine: true }),
    // The courses API is paginated ({ results: [...] } — CatalogPagination,
    // page_size 100). Unwrap the envelope the same way every other studio
    // section does; a raw array (some callers) also works.
    { defaultValue: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      lang === 'ht' ? `Efase "${item.title}"?` : `Delete "${item.title}"?`,
    );
    if (!confirmed) return;
    try {
      await courseService.delete(item.id);
      showToast?.(lang === 'ht' ? '✅ Kou efase!' : '✅ Course deleted!', 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
    }
  };

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase kou' : 'Delete course',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: async () => {
        try {
          await courseService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Kou efase!' : '✅ Course deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
      },
    });
  };

  // Draft → published. Draft courses are hidden from anonymous visitors
  // and from the public catalog (CourseViewSet filters status='published'),
  // so a course stuck in draft is effectively invisible. Publishing runs
  // the server-side gate (§51) — 400 {errors} lists what's missing.
  const handlePublish = async (item) => {
    if (publishingId === item.id) return;
    setPublishingId(item.id);
    try {
      const res = await courseService.publish(item.id);
      if (res?.data?.status === 'published') {
        showToast?.(lang === 'ht' ? '🚀 Kou pibliye! Vizitè yo ka wè l kounye a.' : '🚀 Course published! Visitors can see it now.', 'check-circle');
        refetch();
      }
    } catch (err) {
      const gate = err?.response?.data?.errors;
      if (gate) {
        const map = {
          title: lang === 'ht' ? 'Ajoute yon tit' : 'Add a title',
          description: lang === 'ht' ? 'Deskripsyon an dwe gen 20+ karaktè' : 'Description must be 20+ characters',
          image_url: lang === 'ht' ? 'Ajoute yon imaj kouvèti' : 'Add a cover image',
          external_url: lang === 'ht' ? 'Ajoute URL kou ekstèn lan' : 'Add the external course URL',
        };
        const missing = Object.keys(gate).map((k) => map[k] || gate[k]).join(' · ');
        showToast?.(
          lang === 'ht' ? `Kou a pa pibliye — ${missing}.` : `Course not published — ${missing}.`,
          'circle-exclamation',
        );
      } else {
        showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab pibliye.' : 'Could not publish.'), 'circle-exclamation');
      }
    } finally {
      setPublishingId(null);
    }
  };

  const [publishingId, setPublishingId] = useState(null);

  if (loading) return <StudioSkeleton rows={3} />;

  const isEmpty = courses.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-graduation-cap"
        title={t.studio_my_courses || 'My Courses'}
        lang={lang}
        help={{
          ht: 'Lis tout kou ou te kreye. Yon kou ka gen yon imaj kouvèti, yon videyo prezantasyon, ak yon pri pou elèv yo — tout sa yo jere nan fòm Kreye Kou a.',
          en: 'All your courses in one place. A course can carry a cover image, a promo video, and a price for students — all managed in the Create Course form.',
        }}
        tip={lang === 'ht'
          ? 'Kou yo parèt nan Explore epi sou pwofil piblik ou.'
          : 'Courses appear in Explore and on your public profile.'}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCourseModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {t.studio_new_course || 'New Course'}
          </button>
        }
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-graduation-cap"
          title={t.studio_no_courses || 'No courses yet'}
          hint={t.studio_no_courses_hint || 'Create your first course to start teaching.'}
          ctaLabel={t.studio_create_first || 'Create First Course'}
          onCta={() => setShowCourseModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {courses.slice(0, 10).map((course) => (
            <div key={course.id} className={styles.listItem}>
              <img
                className={styles.listThumb}
                src={course.image_url || `https://via.placeholder.com/80/0084ff/ffffff?text=${encodeURIComponent(course.title?.[0] || 'C')}`}
                alt={course.title}
                onError={(e) => {
                  e.currentTarget.src = `https://via.placeholder.com/80/0084ff/ffffff?text=${encodeURIComponent(course.title?.[0] || 'C')}`;
                }}
              />
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  {course.title}
                  {course.delivery_type === 'external' && (
                    <span className={`${styles.badge} ${styles.badgeExternal}`} style={{ marginLeft: 8 }}>
                      <i className="fas fa-globe" aria-hidden="true" />
                      {lang === 'ht' ? 'Ekstèn' : 'External'}
                    </span>
                  )}
                </div>
                <div className={styles.listMeta}>
                  <span className={`${styles.badge} ${course.status === 'draft' ? styles.badgeDraft : styles.badgePublished}`}>
                    {course.status === 'draft'
                      ? <><i className="fas fa-clock" aria-hidden="true" /> {lang === 'ht' ? 'Bouyon' : 'Draft'}</>
                      : <><i className="fas fa-check-circle" aria-hidden="true" /> {lang === 'ht' ? 'Pibliye' : 'Published'}</>}
                  </span>
                  <span>${course.price || 0}</span>
                  {course.enrollment_count > 0 && (
                    <span>
                      · <i className="fas fa-user-graduate" aria-hidden="true" /> {fmtCount(course.enrollment_count)} {lang === 'ht' ? 'elèv' : 'students'}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.statsBtn} onClick={() => setAnalyticsCourse(course)}
                  title={lang === 'ht' ? 'Analitik ak elèv' : 'Analytics & students'}>
                  <i className="fas fa-chart-line" aria-hidden="true" />
                </button>
                <button type="button" className={styles.statsBtn} onClick={() => setCurriculumAnalyticsCourse(course)}
                  title={lang === 'ht' ? 'Analitik kurikilom' : 'Curriculum analytics'}>
                  <i className="fas fa-sitemap" aria-hidden="true" />
                </button>
                <button type="button" className={styles.statsBtn} onClick={() => setExportImportCourse(course)}
                  title={lang === 'ht' ? 'Ekspòt/Enpòt' : 'Export/Import'}>
                  <i className="fas fa-exchange-alt" aria-hidden="true" />
                </button>
                {course.status === 'draft' && (
                  <button
                    type="button"
                    className={styles.publishBtn}
                    onClick={() => handlePublish(course)}
                    disabled={publishingId === course.id}
                    title={lang === 'ht' ? 'Pibliye kou a' : 'Publish course'}
                  >
                    <i className="fas fa-rocket" aria-hidden="true" />
                  </button>
                )}
                <button type="button" className={styles.editBtn} onClick={() => onEdit?.(course)}
                  title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(course)}
                  title={lang === 'ht' ? 'Efase' : 'Delete'}>
                  <i className="fas fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          lang={lang}
          variant="danger"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {analyticsCourse && (
        <CourseAnalyticsModal
          course={analyticsCourse}
          lang={lang}
          onClose={() => setAnalyticsCourse(null)}
        />
      )}
      {curriculumAnalyticsCourse && (
        <CurriculumAnalyticsModal
          course={curriculumAnalyticsCourse}
          lang={lang}
          onClose={() => setCurriculumAnalyticsCourse(null)}
        />
      )}
      {(exportImportCourse || showImportModal) && (
        <CourseExportImportModal
          course={exportImportCourse}
          lang={lang}
          onClose={() => { setExportImportCourse(null); setShowImportModal(false); }}
          onImportSuccess={(res) => {
            setExportImportCourse(null);
            setShowImportModal(false);
            if (res?.course_id) onEdit?.({ id: res.course_id });
            refetch();
          }}
        />
      )}
    </div>
  );
}
