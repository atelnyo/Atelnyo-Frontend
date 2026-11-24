/**
 * src/components/studio/sections/CoursesSection.jsx
 *
 * Courses section — lists creator's courses with thumbnail, title, price,
 * student count, and status badge. Empty state with CTA to create first course.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useEffect, useState } from 'react';
import { courseService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { CourseSectionSkeleton, EmptyState, SectionHeader, fmtCount } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import ContentLifecycleControls from '../../shared/ContentLifecycleControls';
import CourseAnalyticsModal from './CourseAnalyticsModal';
import CurriculumAnalyticsModal from './CurriculumAnalyticsModal';
import CourseExportImportModal from './CourseExportImportModal';
import CourseTemplateModal from './CourseTemplateModal';
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

// Filters fold the six lifecycle states into the four buckets a creator
// actually thinks in. "updating" is still publicly visible, and
// "building" is still unfinished work — grouping them any other way
// would misreport how many courses are live.
const COURSE_FILTERS = [
  { key: 'all', en: 'All', ht: 'Tout' },
  { key: 'published', en: 'Published', ht: 'Pibliye' },
  { key: 'draft', en: 'Drafts', ht: 'Bouyon' },
  { key: 'review', en: 'In review', ht: 'Nan revizyon' },
  { key: 'archived', en: 'Archived', ht: 'Achive' },
];

const COURSE_FILTER_STATUSES = {
  published: ['published', 'updating'],
  draft: ['draft', 'building'],
  review: ['review'],
  archived: ['archived'],
};

const COURSE_SORTS = [
  { key: 'updated', en: 'Recently updated', ht: 'Dènye chanjman' },
  { key: 'newest', en: 'Newest first', ht: 'Pi nouvo' },
  { key: 'title', en: 'Title A–Z', ht: 'Tit A–Z' },
  { key: 'price', en: 'Price: high to low', ht: 'Pri: wo a ba' },
];

const COURSE_PREFS_KEY = 'atelnyo.studio.courses.prefs';

// The server answers a failed publish with machine keys. Turning them into
// one readable sentence keeps the bulk toast actionable instead of dumping
// JSON at the creator.
function describePublishGate(errors, lang) {
  if (!errors) return '';
  const map = {
    title: lang === 'ht' ? 'Ajoute yon tit' : inlineText(lang, 'Add a title'),
    description: lang === 'ht' ? 'Deskripsyon an dwe gen 20+ karaktè' : inlineText(lang, 'Description must be 20+ characters'),
    image_url: lang === 'ht' ? 'Ajoute yon imaj kouvèti' : inlineText(lang, 'Add a cover image'),
    external_url: lang === 'ht' ? 'Ajoute URL kou ekstèn lan' : inlineText(lang, 'Add the external course URL'),
  };
  return Object.keys(errors).map((key) => map[key] || String(errors[key])).join(' · ');
}

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Only the VIEW is remembered here (status tab + sort), never the search
// text: coming back to an invisible search term would hide courses for
// no visible reason, while a remembered status tab is expected.
function readCoursePrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(COURSE_PREFS_KEY) || '{}');
    return {
      status: COURSE_FILTERS.some((f) => f.key === raw.status) ? raw.status : 'all',
      sort: COURSE_SORTS.some((s) => s.key === raw.sort) ? raw.sort : 'updated',
    };
  } catch {
    return { status: 'all', sort: 'updated' };
  }
}

export default function CoursesSection({ lang, t, showToast, setShowCourseModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [analyticsCourse, setAnalyticsCourse] = useState(null);
  const [curriculumAnalyticsCourse, setCurriculumAnalyticsCourse] = useState(null);
  const [exportImportCourse, setExportImportCourse] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [{ status: initialStatus, sort: initialSort }] = useState(readCoursePrefs);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sortKey, setSortKey] = useState(initialSort);
  const [templateCourse, setTemplateCourse] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { data: courses, loading, error, refetch, removeLocal } = useFetch(
    () => courseService.getAll({ mine: true }),
    // The courses API is paginated ({ results: [...] } — CatalogPagination,
    // page_size 100). Unwrap the envelope the same way every other studio
    // section does; a raw array (some callers) also works.
    { defaultValue: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  useEffect(() => {
    try {
      localStorage.setItem(COURSE_PREFS_KEY, JSON.stringify({ status: statusFilter, sort: sortKey }));
    } catch {
      // Storage disabled (private mode / quota) — filtering still works,
      // the preference just does not survive a reload.
    }
  }, [statusFilter, sortKey]);

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
        const missing = describePublishGate(gate, lang);
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

  // Course-shaped rows (thumb + title + meta + actions) so the real list
  // lands without a layout jump.
  if (loading && courses.length === 0) return <CourseSectionSkeleton rows={3} />;

  const isEmpty = courses.length === 0;
  const loadError = error && courses.length === 0;

  // Client-side filtering: the list endpoint already returns every course
  // the creator owns (page_size 100), so searching is instant and never
  // fires a request per keystroke.
  const needle = query.trim().toLowerCase();
  const visibleCourses = courses.filter((course) => {
    const statuses = COURSE_FILTER_STATUSES[statusFilter];
    if (statuses && !statuses.includes(course.status || 'draft')) return false;
    if (!needle) return true;
    return `${course.title || ''} ${course.description || ''}`.toLowerCase().includes(needle);
  });
  const filtersActive = statusFilter !== 'all' || needle.length > 0;
  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  // Default order mirrors what a creator needs: what they touched last.
  // Every comparator ends in a stable, readable order so equal keys never
  // shuffle between renders.
  const sortedCourses = [...visibleCourses].sort((a, b) => {
    if (sortKey === 'title') {
      return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
    }
    if (sortKey === 'price') {
      return (Number(b.price) || 0) - (Number(a.price) || 0);
    }
    const field = sortKey === 'newest' ? 'created_at' : 'updated_at';
    return timestamp(b[field] || b.created_at) - timestamp(a[field] || a.created_at);
  });

  const countForFilter = (key) => (
    key === 'all'
      ? courses.length
      : courses.filter((course) => (COURSE_FILTER_STATUSES[key] || []).includes(course.status || 'draft')).length
  );

  // Selection is by id and survives filtering (so a search never silently
  // drops a ticked row), while "select all" only touches what is on screen.
  const selectedCourses = courses.filter((course) => selectedIds.has(course.id));
  // Archived courses cannot be published straight from the list: the
  // lifecycle requires archived → draft first, and bypassing that would
  // resurrect a course the creator deliberately put away.
  const selectedPublishable = selectedCourses.filter(
    (course) => !['published', 'archived'].includes(course.status || 'draft'),
  );
  const selectedArchivable = selectedCourses.filter((course) => course.status !== 'archived');
  const allVisibleSelected = sortedCourses.length > 0
    && sortedCourses.every((course) => selectedIds.has(course.id));
  const someVisibleSelected = sortedCourses.some((course) => selectedIds.has(course.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) sortedCourses.forEach((course) => next.delete(course.id));
      else sortedCourses.forEach((course) => next.add(course.id));
      return next;
    });
  };

  const handleBulkPublish = async () => {
    const targets = selectedPublishable;
    if (targets.length === 0 || bulkBusy) return;
    setBulkBusy(true);

    const failedIds = new Set();
    let gateHint = '';
    // Small batches: 100 drafts must not fire 100 publish requests at once,
    // and each publish still runs the server gate independently.
    for (let i = 0; i < targets.length; i += 5) {
      const batch = targets.slice(i, i + 5);
      const settled = await Promise.allSettled(batch.map((course) => courseService.publish(course.id)));
      settled.forEach((result, index) => {
        if (result.status === 'rejected') {
          failedIds.add(batch[index].id);
          if (!gateHint) gateHint = describePublishGate(result.reason?.response?.data?.errors, lang);
        }
      });
    }

    const published = targets.length - failedIds.size;
    const failed = failedIds.size;
    if (failed === 0) {
      showToast?.(
        lang === 'ht'
          ? `✅ ${published} kou pibliye.`
          : `✅ ${published} ${published === 1 ? 'course' : 'courses'} published.`,
        'check-circle',
      );
    } else if (published === 0) {
      showToast?.(
        lang === 'ht'
          ? `Pa t kapab pibliye ${failed} kou${gateHint ? ` — ${gateHint}` : ''}.`
          : `Could not publish ${failed} ${failed === 1 ? 'course' : 'courses'}${gateHint ? ` — ${gateHint}` : ''}.`,
        'circle-exclamation',
      );
    } else {
      showToast?.(
        lang === 'ht'
          ? `${published} pibliye, ${failed} poko pare${gateHint ? ` — ${gateHint}` : ''}.`
          : `${published} published, ${failed} not ready${gateHint ? ` — ${gateHint}` : ''}.`,
        'circle-exclamation',
      );
    }

    // Keep the failures ticked so a retry is one click.
    setSelectedIds(failedIds);
    setBulkBusy(false);
    refetch();
  };

  const handleBulkArchiveClick = () => {
    const targets = selectedArchivable;
    if (targets.length === 0 || bulkBusy) return;
    const count = targets.length;
    setConfirm({
      title: lang === 'ht' ? `Achive ${count} kou` : `Archive ${count} ${count === 1 ? 'course' : 'courses'}`,
      message: lang === 'ht'
        ? `${count} kou ap soti nan Explore epi sou pwofil piblik ou. Ou ka retounen yo nan bouyon pita.`
        : `${count} ${count === 1 ? 'course leaves' : 'courses leave'} Explore and your public profile. You can restore them to draft later.`,
      confirmText: lang === 'ht' ? `Achive ${count}` : `Archive ${count}`,
      onConfirm: () => {
        if (bulkBusy) return;
        setBulkBusy(true);
        (async () => {
          const failedIds = new Set();
          for (let i = 0; i < targets.length; i += 5) {
            const batch = targets.slice(i, i + 5);
            const settled = await Promise.allSettled(
              batch.map((course) => courseService.transition(course.id, 'archived')),
            );
            settled.forEach((result, index) => {
              if (result.status === 'rejected') failedIds.add(batch[index].id);
            });
          }

          const archived = count - failedIds.size;
          if (failedIds.size === 0) {
            showToast?.(
              lang === 'ht' ? `✅ ${archived} kou achive.` : `✅ ${archived} ${archived === 1 ? 'course' : 'courses'} archived.`,
              'check-circle',
            );
          } else {
            showToast?.(
              lang === 'ht'
                ? `${archived} achive, ${failedIds.size} echwe.`
                : `${archived} archived, ${failedIds.size} failed.`,
              'circle-exclamation',
            );
          }
          setSelectedIds(failedIds);
          setBulkBusy(false);
          setConfirm(null);
          refetch();
        })();
      },
    });
  };

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
        <>
          <div className={styles.productToolbar}>
            <input
              type="checkbox"
              className={styles.courseSelectAll}
              checked={allVisibleSelected}
              ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
              onChange={toggleSelectAll}
              disabled={bulkBusy}
              aria-label={allVisibleSelected ? 'Deselect all shown' : 'Select all shown'}
            />
            <div className={styles.productSearch}>
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'ht' ? 'Chèche yon kou…' : inlineText(lang, 'Search your courses…')}
                aria-label={lang === 'ht' ? 'Chèche nan kou ou yo' : inlineText(lang, 'Search your courses')}
              />
            </div>
            <div
              className={styles.productFilters}
              role="group"
              aria-label={lang === 'ht' ? 'Filtre pa estati' : inlineText(lang, 'Filter by status')}
            >
              {COURSE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`${styles.productFilter}${statusFilter === filter.key ? ` ${styles.productFilterActive}` : ''}`}
                  aria-pressed={statusFilter === filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                >
                  {lang === 'ht' ? filter.ht : filter.en}
                  {countForFilter(filter.key) > 0 && (
                    <span className={styles.filterChipCount} aria-hidden="true">
                      {countForFilter(filter.key)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <select
              className={styles.courseSort}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              aria-label={lang === 'ht' ? 'Klase kou yo' : inlineText(lang, 'Sort courses')}
            >
              {COURSE_SORTS.map((sort) => (
                <option key={sort.key} value={sort.key}>
                  {lang === 'ht' ? sort.ht : sort.en}
                </option>
              ))}
            </select>
            <span className={styles.productCount} aria-live="polite">
              {sortedCourses.length} / {courses.length}
            </span>
          </div>

          {selectedCourses.length > 0 && (
            <div className={styles.bulkBar} role="region" aria-label={lang === 'ht' ? 'Aksyon an blòk' : inlineText(lang, 'Bulk actions')}>
              <span className={styles.bulkCount} aria-live="polite">
                {lang === 'ht' ? `${selectedCourses.length} chwazi` : `${selectedCourses.length} selected`}
              </span>
              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={`${styles.bulkBtn} ${styles.bulkBtnPrimary}`}
                  onClick={handleBulkPublish}
                  disabled={bulkBusy || selectedPublishable.length === 0}
                >
                  {bulkBusy
                    ? (lang === 'ht' ? 'Ap trete…' : inlineText(lang, 'Working…'))
                    : (lang === 'ht' ? 'Pibliye chwazi yo' : inlineText(lang, 'Publish selected'))}
                </button>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={handleBulkArchiveClick}
                  disabled={bulkBusy || selectedArchivable.length === 0}
                >
                  {lang === 'ht' ? 'Achive chwazi yo' : inlineText(lang, 'Archive selected')}
                </button>
                <button
                  type="button"
                  className={styles.bulkClear}
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkBusy}
                >
                  {lang === 'ht' ? 'Retire seleksyon' : inlineText(lang, 'Clear selection')}
                </button>
              </div>
            </div>
          )}

          {visibleCourses.length === 0 ? (
            <div className={styles.filterEmpty}>
              <i className="fas fa-filter-circle-xmark" aria-hidden="true" />
              <p>
                {lang === 'ht'
                  ? 'Pa gen kou ki matche rechèch oswa filtè sa yo.'
                  : inlineText(lang, 'No courses match this search or filter.')}
              </p>
              {filtersActive && (
                <button type="button" className={styles.clearFilters} onClick={clearFilters}>
                  {lang === 'ht' ? 'Efase filtè yo' : inlineText(lang, 'Clear filters')}
                </button>
              )}
            </div>
          ) : (
            <div className={styles.list}>
              {sortedCourses.map((course) => (
                <div key={course.id} className={styles.listItem}>
                  <input
                    type="checkbox"
                    className={styles.courseSelectAll}
                    checked={selectedIds.has(course.id)}
                    onChange={() => toggleSelect(course.id)}
                    disabled={bulkBusy}
                    aria-label={`${selectedIds.has(course.id) ? 'Deselect' : 'Select'} ${course.title}`}
                  />
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
                    {/* An empty course (no syllabus yet) is the only case
                        where a starter outline can be filled in: the
                        backend rejects the apply endpoint otherwise. */}
                    {!course.syllabus?.length && (
                      <button
                        type="button"
                        className={styles.statsBtn}
                        onClick={() => setTemplateCourse(course)}
                        title={lang === 'ht' ? 'Ajoute yon plan kòmansman' : inlineText(lang, 'Add a starter outline')}
                        aria-label={lang === 'ht' ? 'Ajoute yon plan kòmansman' : inlineText(lang, 'Add a starter outline')}
                      >
                        <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
                      </button>
                    )}
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
        </>
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
      {templateCourse && (
        <CourseTemplateModal
          course={templateCourse}
          lang={lang}
          showToast={showToast}
          onClose={() => setTemplateCourse(null)}
          onApplied={refetch}
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
