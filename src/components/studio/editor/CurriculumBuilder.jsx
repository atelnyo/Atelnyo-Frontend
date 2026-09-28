/**
 * src/components/studio/editor/CurriculumBuilder.jsx
 *
 * Chapter → Lesson tree navigator for the Creator Studio.
 * Manages the structured curriculum (chapters containing lessons)
 * separate from the legacy module/syllabus system.
 *
 * Features:
 *   - Create / rename / delete chapters
 *   - Create / rename / delete lessons within chapters
 *   - Drag-reorder chapters and lessons
 *   - Visual status indicators (draft, has blocks, etc.)
 *   - Click a lesson to edit its content blocks
 *   - Integration with the backend Chapter/Lesson/ContentBlock API
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { chapterService, lessonService, contentBlockService } from '../../../services/api';
import styles from './editor.module.css';

/* ─── Icons ───────────────────────────────────────────────────────── */
const Icon = ({ name, className }) => (
  <i className={`fas fa-${name} ${className || ''}`} aria-hidden="true" />
);

/* ─── Inline editable title ───────────────────────────────────────── */
function InlineTitle({ value, onChange, placeholder, className, onConfirm }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
      onConfirm?.(trimmed);
    } else {
      setDraft(value);
    }
  }, [draft, value, onChange, onConfirm]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }, [commit, value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={className || styles.inlineEdit}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        maxLength={200}
      />
    );
  }

  return (
    <span
      className={`${className || ''} ${styles.inlineTitle}`}
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  );
}

/* ─── Lesson row ──────────────────────────────────────────────────── */
function LessonRow({ lesson, index, isActive, onSelect, onUpdate, onDelete, onMoveUp, onMoveDown, isHt, dragHandlers }) {
  const [expanded, setExpanded] = useState(false);

  const blockCount = lesson.block_count || (lesson.blocks || []).length;
  const hasBlocks = blockCount > 0;

  return (
    <div
      className={`${styles.lessonRow} ${isActive ? styles.lessonRowActive : ''}`}
      draggable
      onDragStart={(e) => { dragHandlers.onDragStart(e, index); }}
      onDragOver={(e) => { e.preventDefault(); dragHandlers.onDragOver(e, index); }}
      onDragLeave={() => dragHandlers.onDragLeave(index)}
      onDrop={(e) => { e.preventDefault(); dragHandlers.onDrop(e, index); }}
      onDragEnd={() => dragHandlers.onDragEnd()}
    >
      <button
        type="button"
        className={`${styles.lessonBtn} ${isActive ? styles.lessonBtnActive : ''}`}
        onClick={() => onSelect(lesson)}
      >
        <span className={styles.lessonGrip} title="Drag to reorder">
          <Icon name="grip-vertical" />
        </span>
        <span className={`${styles.lessonDot} ${hasBlocks ? styles.lessonDotFilled : ''}`} />
        <span className={styles.lessonInfo}>
          <InlineTitle
            value={lesson.title}
            onChange={(val) => onUpdate(lesson.id, { title: val })}
            placeholder={isHt ? `Leson ${index + 1}` : `Lesson ${index + 1}`}
            className={styles.lessonTitle}
          />
          <span className={styles.lessonMeta}>
            {blockCount > 0
              ? `${blockCount} ${isHt ? 'blòk' : 'blocks'}`
              : (isHt ? 'Pa gen kontni' : 'No content')}
            {lesson.estimated_duration && ` · ${lesson.estimated_duration}`}
          </span>
        </span>
      </button>

      <div className={styles.lessonControls}>
        <button
          type="button"
          className={styles.lessonCtrl}
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          title={isHt ? 'Monte' : 'Move up'}
        >
          <Icon name="chevron-up" />
        </button>
        <button
          type="button"
          className={styles.lessonCtrl}
          onClick={() => onMoveDown(index)}
          title={isHt ? 'Desann' : 'Move down'}
        >
          <Icon name="chevron-down" />
        </button>
        <button
          type="button"
          className={`${styles.lessonCtrl} ${styles.lessonCtrlDanger}`}
          onClick={() => onDelete(lesson.id)}
          title={isHt ? 'Efase' : 'Delete'}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

/* ─── Chapter card ────────────────────────────────────────────────── */
function ChapterCard({
  chapter, index, isActive, lessons, selectedLessonId,
  onSelectChapter, onSelectLesson, onCreateLesson, onUpdateLesson,
  onDeleteLesson, onReorderLessons, onUpdateChapter, onDeleteChapter,
  onMoveChapterUp, onMoveChapterDown, isHt, lang,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  const handleCreateLesson = useCallback(async () => {
    if (!newLessonTitle.trim()) return;
    setCreating(true);
    try {
      const res = await lessonService.create({
        chapter: chapter.id,
        title: newLessonTitle.trim(),
        lesson_type: 'lesson',
      });
      onUpdateLesson(null, res.data, true); // append
      setNewLessonTitle('');
    } catch {
      // toast handled by parent
    } finally {
      setCreating(false);
    }
  }, [newLessonTitle, chapter.id, onUpdateLesson]);

  /* Drag-reorder lessons within this chapter */
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const lessonDragHandlers = {
    onDragStart: (e, i) => { dragRef.current = i; e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (e, i) => { e.dataTransfer.dropEffect = 'move'; setDragOver(i); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e, i) => {
      e.preventDefault();
      const src = dragRef.current;
      dragRef.current = null;
      setDragOver(null);
      if (src != null && src !== i) onReorderLessons(chapter.id, lessons, src, i);
    },
    onDragEnd: () => { dragRef.current = null; setDragOver(null); },
  };

  return (
    <div className={`${styles.chapterCard} ${isActive ? styles.chapterCardActive : ''}`}>
      {/* Chapter header */}
      <div className={styles.chapterHeader}>
        <button
          type="button"
          className={styles.chapterCollapse}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? (isHt ? 'Deplwaye' : 'Expand') : (isHt ? 'Pliye' : 'Collapse')}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
        </button>

        <button
          type="button"
          className={`${styles.chapterTitleBtn} ${isActive ? styles.chapterTitleBtnActive : ''}`}
          onClick={() => onSelectChapter(chapter)}
        >
          <span className={styles.chapterIndex}>{String(index + 1).padStart(2, '0')}</span>
          <InlineTitle
            value={chapter.title}
            onChange={(val) => onUpdateChapter(chapter.id, { title: val })}
            placeholder={isHt ? `Chapit ${index + 1}` : `Chapter ${index + 1}`}
            className={styles.chapterTitleText}
          />
        </button>

        <span className={styles.chapterLessonCount}>
          {lessons.length} {isHt ? 'leson' : 'lessons'}
        </span>

        <div className={styles.chapterControls}>
          <button type="button" className={styles.chapterCtrl} onClick={() => onMoveChapterUp(index)} disabled={index === 0} title={isHt ? 'Monte' : 'Up'}>
            <Icon name="chevron-up" />
          </button>
          <button type="button" className={styles.chapterCtrl} onClick={() => onMoveChapterDown(index)} title={isHt ? 'Desann' : 'Down'}>
            <Icon name="chevron-down" />
          </button>
          <button type="button" className={`${styles.chapterCtrl} ${styles.chapterCtrlDanger}`} onClick={() => onDeleteChapter(chapter.id)} title={isHt ? 'Efase' : 'Delete'}>
            <Icon name="trash" />
          </button>
        </div>
      </div>

      {/* Lessons list */}
      {!collapsed && (
        <div className={styles.chapterLessons}>
          {lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={i}
              isActive={selectedLessonId === lesson.id}
              onSelect={onSelectLesson}
              onUpdate={(id, data) => onUpdateLesson(id, data)}
              onDelete={(id) => onDeleteLesson(id)}
              onMoveUp={(i) => {
                if (i > 0) onReorderLessons(chapter.id, lessons, i, i - 1);
              }}
              onMoveDown={(i) => {
                if (i < lessons.length - 1) onReorderLessons(chapter.id, lessons, i, i + 1);
              }}
              isHt={isHt}
              dragHandlers={{
                ...lessonDragHandlers,
                onDragStart: (e) => lessonDragHandlers.onDragStart(e, i),
                onDragOver: (e) => lessonDragHandlers.onDragOver(e, i),
                onDragLeave: () => lessonDragHandlers.onDragLeave(),
                onDrop: (e) => lessonDragHandlers.onDrop(e, i),
              }}
            />
          ))}

          {/* Add lesson */}
          <div className={styles.addLessonRow}>
            <input
              className={styles.addLessonInput}
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLesson(); }}
              placeholder={isHt ? 'Tit nouvo leson...' : 'New lesson title...'}
              maxLength={200}
              disabled={creating}
            />
            <button
              type="button"
              className={styles.addLessonBtn}
              onClick={handleCreateLesson}
              disabled={creating || !newLessonTitle.trim()}
              title={isHt ? 'Ajoute leson' : 'Add lesson'}
            >
              <Icon name={creating ? 'spinner fa-spin' : 'plus'} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main CurriculumBuilder ──────────────────────────────────────── */
export default function CurriculumBuilder({ courseId, lang = 'ht', onSelectLesson, selectedLessonId, showToast }) {
  const isHt = lang === 'ht';

  const [chapters, setChapters] = useState([]);
  const [lessonsMap, setLessonsMap] = useState({}); // chapterId → [lesson]
  const [loading, setLoading] = useState(true);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [creatingChapter, setCreatingChapter] = useState(false);

  /* ─── Load chapters + lessons ────────────────────────────────────── */
  const loadChapters = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await chapterService.list(courseId);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setChapters(data);

      // Load lessons for each chapter
      const map = {};
      await Promise.all(data.map(async (ch) => {
        try {
          const lr = await lessonService.list(ch.id);
          map[ch.id] = Array.isArray(lr.data) ? lr.data : (lr.data?.results || []);
        } catch {
          map[ch.id] = ch.lessons || [];
        }
      }));
      setLessonsMap(map);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (isHt ? 'Pa t kapab chaje chapit yo.' : 'Could not load chapters.'), 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [courseId, isHt, showToast]);

  useEffect(() => { loadChapters(); }, [loadChapters]);

  /* ─── Chapter CRUD ───────────────────────────────────────────────── */
  const handleCreateChapter = useCallback(async () => {
    if (!newChapterTitle.trim() || !courseId) return;
    setCreatingChapter(true);
    try {
      const res = await chapterService.create({
        course: courseId,
        title: newChapterTitle.trim(),
      });
      setChapters((prev) => [...prev, res.data]);
      setLessonsMap((prev) => ({ ...prev, [res.data.id]: [] }));
      setNewChapterTitle('');
      setSelectedChapterId(res.data.id);
      showToast?.(isHt ? '✅ Chapit kreye!' : '✅ Chapter created!', 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (isHt ? 'Pa t kapab kreye chapit.' : 'Could not create chapter.'), 'circle-exclamation');
    } finally {
      setCreatingChapter(false);
    }
  }, [newChapterTitle, courseId, isHt, showToast]);

  const handleUpdateChapter = useCallback(async (id, data) => {
    setChapters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...data } : ch)));
    try {
      await chapterService.update(id, data);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
      loadChapters(); // revert
    }
  }, [showToast, loadChapters]);

  const handleDeleteChapter = useCallback(async (id) => {
    if (!window.confirm(isHt ? 'Efase chapit sa a ak tout leson li yo?' : 'Delete this chapter and all its lessons?')) return;
    try {
      await chapterService.delete(id);
      setChapters((prev) => prev.filter((ch) => ch.id !== id));
      setLessonsMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
      if (selectedChapterId === id) setSelectedChapterId(null);
      showToast?.(isHt ? '✅ Chapit efase!' : '✅ Chapter deleted!', 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
    }
  }, [isHt, selectedChapterId, showToast]);

  const handleMoveChapter = useCallback((index, dir) => {
    setChapters((prev) => {
      const arr = [...prev];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      // Update orders
      const items = arr.map((ch, i) => ({ id: ch.id, order: i + 1 }));
      chapterService.reorder(courseId, items).catch(() => {});
      return arr;
    });
  }, [courseId]);

  /* ─── Lesson CRUD ────────────────────────────────────────────────── */
  const handleUpdateLesson = useCallback((id, data, append = false) => {
    if (append && data?.chapter) {
      setLessonsMap((prev) => ({
        ...prev,
        [data.chapter]: [...(prev[data.chapter] || []), data],
      }));
      return;
    }
    setLessonsMap((prev) => {
      const next = { ...prev };
      for (const chId of Object.keys(next)) {
        next[chId] = next[chId].map((l) => (l.id === id ? { ...l, ...data } : l));
      }
      return next;
    });
    if (id && data) {
      lessonService.update(id, data).catch((err) => {
        showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
        loadChapters();
      });
    }
  }, [showToast, loadChapters]);

  const handleDeleteLesson = useCallback(async (id) => {
    if (!window.confirm(isHt ? 'Efase leson sa a?' : 'Delete this lesson?')) return;
    try {
      await lessonService.delete(id);
      setLessonsMap((prev) => {
        const next = { ...prev };
        for (const chId of Object.keys(next)) {
          next[chId] = next[chId].filter((l) => l.id !== id);
        }
        return next;
      });
      if (selectedLessonId === id) onSelectLesson?.(null);
      showToast?.(isHt ? '✅ Leson efase!' : '✅ Lesson deleted!', 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || 'Error', 'circle-exclamation');
    }
  }, [isHt, selectedLessonId, onSelectLesson, showToast]);

  const handleReorderLessons = useCallback(async (chapterId, lessons, srcIdx, targetIdx) => {
    setLessonsMap((prev) => {
      const arr = [...(prev[chapterId] || [])];
      const [moved] = arr.splice(srcIdx, 1);
      arr.splice(targetIdx, 0, moved);
      // Update orders
      const items = arr.map((l, i) => ({ id: l.id, order: i + 1 }));
      lessonService.reorder(chapterId, items).catch(() => {});
      return { ...prev, [chapterId]: arr };
    });
  }, []);

  /* ─── Render ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.curriculumLoading}>
        <Icon name="spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div className={styles.curriculumBuilder}>
      <div className={styles.curriculumHeader}>
        <Icon name="sitemap" className={styles.curriculumHeaderIcon} />
        <span className={styles.curriculumHeaderText}>
          {isHt ? 'Kurikilom' : 'Curriculum'}
        </span>
        <span className={styles.curriculumHeaderCount}>
          {chapters.length} {isHt ? 'chapit' : 'chapters'}
        </span>
      </div>

      {/* Chapter list */}
      <div className={styles.curriculumChapters}>
        {chapters.map((chapter, i) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            index={i}
            isActive={selectedChapterId === chapter.id}
            lessons={lessonsMap[chapter.id] || []}
            selectedLessonId={selectedLessonId}
            onSelectChapter={(ch) => setSelectedChapterId(ch.id)}
            onSelectLesson={(lesson) => {
              setSelectedChapterId(lesson.chapter || lesson.chapter_id);
              onSelectLesson?.(lesson);
            }}
            onCreateLesson={null}
            onUpdateLesson={handleUpdateLesson}
            onDeleteLesson={handleDeleteLesson}
            onReorderLessons={handleReorderLessons}
            onUpdateChapter={handleUpdateChapter}
            onDeleteChapter={handleDeleteChapter}
            onMoveChapterUp={(idx) => handleMoveChapter(idx, -1)}
            onMoveChapterDown={(idx) => handleMoveChapter(idx, 1)}
            isHt={isHt}
            lang={lang}
          />
        ))}
      </div>

      {/* Add chapter */}
      <div className={styles.addChapterRow}>
        <input
          className={styles.addChapterInput}
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChapter(); }}
          placeholder={isHt ? 'Tit nouvo chapit...' : 'New chapter title...'}
          maxLength={200}
          disabled={creatingChapter}
        />
        <button
          type="button"
          className={styles.addChapterBtn}
          onClick={handleCreateChapter}
          disabled={creatingChapter || !newChapterTitle.trim()}
          title={isHt ? 'Ajoute chapit' : 'Add chapter'}
        >
          <Icon name={creatingChapter ? 'spinner fa-spin' : 'plus'} />
          {isHt ? 'Ajoute Chapit' : 'Add Chapter'}
        </button>
      </div>

      {chapters.length === 0 && (
        <p className={styles.curriculumEmpty}>
          {isHt
            ? 'Pa gen chapit ankò. Kreye premye chapit la pou kòmanse bati kurikilom lan.'
            : 'No chapters yet. Create the first chapter to start building the curriculum.'}
        </p>
      )}
    </div>
  );
}
