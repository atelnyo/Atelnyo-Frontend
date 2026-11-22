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
import ContentLifecycleControls from '../../shared/ContentLifecycleControls';
import CourseAnalyticsModal from './CourseAnalyticsModal';
import CurriculumAnalyticsModal from './CurriculumAnalyticsModal';
import CourseExportImportModal from './CourseExportImportModal';
import styles from './sections.module.css';
import { inlineText } from '../../../utils/inlineI18n';

// Course has six lifecycle states. Labelling everything that is not
// "draft" as "Published" made review/building/archived courses look
// live even though Explore never showed them.
const COURSE_STATUS_LABELS = {
  draft: { en: 'Draft', ht: 'Bouyon', icon: 'fa-clock' },
  building: { en: 'Building', ht: 'Ap bati', icon: 'fa-hammer' },
  review: { en: 'In review', ht: 'Nan revizyon', icon: 'fa-magnifying-glass' },
  published: { en: 'Published', ht: 'Pibliye', icon: 'fa-check-circle' },
  updating: { en: 'Updating', ht: 'Ap mete ajou', icon: 'fa-rotate' },
  archived: { en: 'Archived', ht: 'Achive', icon: 'fa-box-archive' },
};

function courseStatus(status, lang) {
  return COURSE_STATUS_LABELS[status] || COURSE_STATUS_LABELS.draft;
}

export default function CoursesSection({ lang, t, showToast, setShowCourseModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [analyticsCourse, setAnalyticsCourse] = useState(null);
  const [curriculumAnalyticsCourse, setCurriculumAnalyticsCourse] = useState(null);
  const [exportImportCourse, setExportImportCourse] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { data: courses, loading, error, refetch, removeLocal } = useFetch(
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
      showToast?.(lang === 'ht' ? '✅ Kou efase!' : inlineText(lang, '✅ Course deleted!'), 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : inlineText(lang, 'Could not delete.')), 'circle-exclamation');
    }
  };

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase kou' : inlineText(lang, 'Delete course'),
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: () => {
        // Optimistic + non-blocking: the row vanishes instantly AND the
        // dialog closes right away — the DELETE finishes in the
        // background. (Backend cold starts can stall a request 30s+;
        // never trap the user behind a spinner.) A failed delete
        // refetches from the server, which restores the row.
        removeLocal((row) => row.id === item.id);
        setConfirmBusy(false);
        setConfirm(null);
        (async () => {
          try {
            await courseService.delete(item.id);
            showToast?.(lang === 'ht' ? '✅ Kou efase!' : inlineText(lang, '✅ Course deleted!'), 'check-circle');
          } catch (err) {
            showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : inlineText(lang, 'Could not delete.')), 'circle-exclamation');
          }
          refetch();
        })();
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
        showToast?.(lang === 'ht' ? '🚀 Kou pibliye! Vizitè yo ka wè l kounye a.' : inlineText(lang, '🚀 Course published! Visitors can see it now.'), 'check-circle');
        refetch();
      }
    } catch (err) {
      const gate = err?.response?.data?.errors;
      if (gate) {
        const map = {
          title: lang === 'ht' ? 'Ajoute yon tit' : inlineText(lang, 'Add a title'),
          description: lang === 'ht' ? 'Deskripsyon an dwe gen 20+ karaktè' : inlineText(lang, 'Description must be 20+ characters'),
          image_url: lang === 'ht' ? 'Ajoute yon imaj kouvèti' : inlineText(lang, 'Add a cover image'),
          external_url: lang === 'ht' ? 'Ajoute URL kou ekstèn lan' : inlineText(lang, 'Add the external course URL'),
        };
        const missing = Object.keys(gate).map((k) => map[k] || gate[k]).join(' · ');
        showToast?.(
          lang === 'ht' ? `Kou a pa pibliye — ${missing}.` : `Course not published — ${missing}.`,
          'circle-exclamation',
        );
      } else {
        showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab pibliye.' : inlineText(lang, 'Could not publish.')), 'circle-exclamation');
      }
    } finally {
      setPublishingId(null);
    }
  };

  const [publishingId, setPublishingId] = useState(null);

  if (loading && courses.length === 0) return <StudioSkeleton rows={3} />;

  const isEmpty = courses.length === 0;
  const loadError = error && courses.length === 0;

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
          : inlineText(lang, 'Courses appear in Explore and on your public profile.')}
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
      {loadError ? (
        <div className={styles.printifyCard} role="alert">
          <p className={styles.printifyError}>
            <i className="fas fa-triangle-exclamation" aria-hidden="true" />{' '}
            {lang === 'ht' ? 'Pa t kapab chaje kou ou yo.' : inlineText(lang, 'Could not load your courses.')}
          </p>
          <p className={styles.printifyText}>
            {error?.response?.data?.detail || error?.message || ''}
          </p>
          <div className={styles.printifyRow}>
            <button type="button" className={styles.secondaryBtn} onClick={refetch}>
              <i className="fas fa-rotate" aria-hidden="true" />{' '}
              {lang === 'ht' ? 'Eseye ankò' : inlineText(lang, 'Retry')}
            </button>
          </div>
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon="fa-graduation-cap"
          title={t.studio_no_courses || 'No courses yet'}
          hint={lang === 'ht'
            ? 'Kou ou kreye yo parèt isit la, bouyon yo gen ladan yo. Explore sèlman montre kou pibliye.'
            : inlineText(lang, 'Courses you create appear here, including drafts. Explore only shows published courses.')}
          ctaLabel={t.studio_create_first || 'Create First Course'}
          onCta={() => setShowCourseModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {courses.map((course) => (
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
                      {lang === 'ht' ? 'Ekstèn' : inlineText(lang, 'External')}
                    </span>
                  )}
                </div>
                <div className={styles.listMeta}>
                  <span className={`${styles.badge} ${course.status === 'published' ? styles.badgePublished : styles.badgeDraft}`}>
                    <i className={`fas ${courseStatus(course.status, lang).icon}`} aria-hidden="true" />{' '}
                    {courseStatus(course.status, lang)[lang === 'ht' ? 'ht' : inlineText(lang, 'en')]}
                  </span>
                  <span>${course.price || 0}</span>
                  {course.enrollment_count > 0 && (
                    <span>
                      · <i className="fas fa-user-graduate" aria-hidden="true" /> {fmtCount(course.enrollment_count)} {lang === 'ht' ? 'elèv' : inlineText(lang, 'students')}
                    </span>
                  )}
                </div>
                {/* Lifecycle controls — publish / unpublish / archive /
                    visibility from the creator's own studio (not only the
                    admin moderation panel). The publication state is
                    seeded from the course's real status. */}
                <ContentLifecycleControls
                  contentType="course"
                  objectId={course.id}
                  initialState={{
                    publication_state: course.status === 'published' ? 'published' : 'draft',
                  }}
                  lang={lang}
                  onChanged={() => refetch?.()}
                />
              </div>
              <div className={styles.itemActions}>
                {/* Owners can read their own drafts through the same
                    course detail route Explore uses; the backend allows
                    the creator (and staff) to fetch an unpublished row. */}
                <a
                  className={styles.statsBtn}
                  href={`/sheet/course/${course.id}`}
                  title={lang === 'ht' ? 'Aperçu kou a' : inlineText(lang, 'Preview course')}
                  aria-label={lang === 'ht' ? 'Aperçu kou a' : inlineText(lang, 'Preview course')}
                  style={{ textDecoration: 'none' }}
                >
                  <i className="fas fa-eye" aria-hidden="true" />
                </a>
                <button type="button" className={styles.statsBtn} onClick={() => setAnalyticsCourse(course)}
                  title={lang === 'ht' ? 'Analitik ak elèv' : inlineText(lang, 'Analytics & students')}>
                  <i className="fas fa-chart-line" aria-hidden="true" />
                </button>
                <button type="button" className={styles.statsBtn} onClick={() => setCurriculumAnalyticsCourse(course)}
                  title={lang === 'ht' ? 'Analitik kurikilom' : inlineText(lang, 'Curriculum analytics')}>
                  <i className="fas fa-sitemap" aria-hidden="true" />
                </button>
                <button type="button" className={styles.statsBtn} onClick={() => setExportImportCourse(course)}
                  title={lang === 'ht' ? 'Ekspòt/Enpòt' : inlineText(lang, 'Export/Import')}>
                  <i className="fas fa-exchange-alt" aria-hidden="true" />
                </button>
                {course.status === 'draft' && (
                  <button
                    type="button"
                    className={styles.publishBtn}
                    onClick={() => handlePublish(course)}
                    disabled={publishingId === course.id}
                    title={lang === 'ht' ? 'Pibliye kou a' : inlineText(lang, 'Publish course')}
                  >
                    <i className="fas fa-rocket" aria-hidden="true" />
                  </button>
                )}
                <button type="button" className={styles.editBtn} onClick={() => onEdit?.(course)}
                  title={lang === 'ht' ? 'Modifye' : inlineText(lang, 'Edit')}>
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(course)}
                  title={lang === 'ht' ? 'Efase' : inlineText(lang, 'Delete')}>
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
          loading={confirmBusy}
          onConfirm={confirm.onConfirm}
          onCancel={() => { if (!confirmBusy) setConfirm(null); }}
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
