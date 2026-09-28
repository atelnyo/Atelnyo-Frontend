/**
 * src/components/learning/workspace/ProjectWorkspace.jsx
 *
 * §1-§49 — Reusable Student Workspace and Project-Based Learning.
 *
 * Conceptually:
 *   Course → Project Template → Student Project Instance → Sections → Fields → Student Work
 *
 * The workspace must be reusable across many future Atelnyo courses.
 * Do not build it as something usable only for one business course.
 *
 * Primary principle: Learn → Apply → Build → Reflect → Improve → Complete
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';
import SectionEditor from './SectionEditor';
import ProjectSidebar from './ProjectSidebar';
import ProjectSummaryView from './ProjectSummaryView';
import './ProjectWorkspace.css';

export default function ProjectWorkspace({
  courseId,
  lang = 'ht',
  user,
  showToast,
  // §15 — Return context: which lesson the student came from
  originLesson = null,
  // §16 — Return to lesson callback
  onReturnToLesson,
}) {
  const isHt = lang === 'ht';
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // §44 — Notification queue
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((msg, type = 'info', priority = 'normal') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg, type, priority }]);
    const delay = priority === 'high' ? 5000 : 3000;
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), delay);
  }, []);

  // Load project
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    api.get(`projects/my/${courseId}/`)
      .then((res) => {
        setProject(res.data);
        // §15 — Restore context
        const sections = res.data.sections || [];
        if (originLesson) {
          // Find section related to this lesson
          const related = sections.find((s) =>
            (s.related_lessons || []).includes(originLesson)
          );
          if (related) setActiveSectionId(related.id);
        }
        if (!activeSectionId && sections.length > 0) {
          setActiveSectionId(sections[0].id);
        }
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          // No template — create project
          api.post(`projects/my/${courseId}/`)
            .then((res) => setProject(res.data))
            .catch(() => setError(isHt ? 'Pa gen modèl pwojè pou kou sa a.' : 'No project template for this course.'));
        } else {
          setError(isHt ? 'Pa t kapab chaje pwojè a.' : 'Could not load project.');
        }
      })
      .finally(() => setLoading(false));
  }, [courseId, originLesson]);

  // §17 — §18 — Save field data (targeted update)
  const saveField = useCallback(async (fieldId, valueText, valueNumber, valueDate, valueJson) => {
    setSaving(true);
    try {
      await api.post(`projects/my/${courseId}/fields/${fieldId}/`, {
        value_text: valueText,
        value_number: valueNumber,
        value_date: valueDate,
        value_json: valueJson,
      });
      setLastSaved(new Date());
      // Update local project state
      setProject((prev) => {
        if (!prev) return prev;
        const sections = prev.sections.map((s) => ({
          ...s,
          fields: s.fields.map((f) =>
            f.id === fieldId
              ? { ...f, value_text: valueText, value_number: valueNumber, value_date: valueDate, value_json: valueJson }
              : f
          ),
        }));
        return { ...prev, sections };
      });
    } catch {
      notify(
        isHt ? '⚠️ Erè sove — travay ou an sekirite lokalman.' : '⚠️ Save error — your work is safe locally.',
        'error',
        'high',
      );
    } finally {
      setSaving(false);
    }
  }, [courseId, isHt, notify]);

  // §22 — Complete section
  const completeSection = useCallback(async (sectionId) => {
    try {
      const res = await api.post(`projects/my/${courseId}/complete-section/`, {
        section_id: sectionId,
      });
      setProject(res.data);
      notify(
        isHt ? '✅ Seksyon fini!' : '✅ Section complete!',
        'success',
      );
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      notify(
        isHt ? `⚠️ ${detail}` : `⚠️ ${detail}`,
        'error',
        'high',
      );
    }
  }, [courseId, isHt, notify]);

  // §41 — Submit project
  const submitProject = useCallback(async () => {
    try {
      const res = await api.post(`projects/my/${courseId}/submit/`);
      setProject(res.data);
      notify(
        isHt ? '🎉 Pwojè soumèt!' : '🎉 Project submitted!',
        'success',
        'high',
      );
    } catch (err) {
      const missing = err?.response?.data?.missing_fields;
      if (missing?.length) {
        notify(
          isHt ? `⚠️ Chanp obligatwa ki manke: ${missing.length}` : `⚠️ Missing required fields: ${missing.length}`,
          'warning',
          'high',
        );
      } else {
        notify(
          isHt ? '⚠️ Erè nan soumèt pwojè a.' : '⚠️ Error submitting project.',
          'error',
          'high',
        );
      }
    }
  }, [courseId, isHt, notify]);

  // Get active section data
  const activeSection = useMemo(() => {
    if (!project?.sections || !activeSectionId) return null;
    return project.sections.find((s) => s.id === activeSectionId) || null;
  }, [project, activeSectionId]);

  if (loading) {
    return (
      <div className="pw-loading" role="status" aria-busy="true">
        <div className="pw-spinner" />
        <p>{isHt ? 'Ap chaje pwojè a...' : 'Loading project...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pw-error" role="alert">
        <i className="fas fa-triangle-exclamation" aria-hidden="true" />
        <p>{error}</p>
        {onReturnToLesson && (
          <button className="pw-btn pw-btn--secondary" onClick={onReturnToLesson}>
            <i className="fas fa-arrow-left" aria-hidden="true" />
            {isHt ? 'Retounen nan leson an' : 'Return to lesson'}
          </button>
        )}
      </div>
    );
  }

  if (!project) return null;

  const sections = project.sections || [];
  const completedCount = (project.completed_sections || []).length;
  const totalRequired = sections.filter((s) => s.is_required).length;

  return (
    <div className="pw-workspace">
      {/* §44 — Notification queue */}
      {notifications.length > 0 && (
        <div className="pw-notifications" aria-live="polite">
          {notifications.map((n) => (
            <div key={n.id} className={`pw-notification pw-notification--${n.type}`} role="status">
              {n.msg}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="pw-header">
        <div className="pw-header-left">
          <button
            className="pw-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={isHt ? ' Seksyon' : ' Sections'}
          >
            <i className="fas fa-bars" aria-hidden="true" />
          </button>
          <div className="pw-header-info">
            <h2 className="pw-title">{project.title || (isHt ? 'Pwojè Mwen' : 'My Project')}</h2>
            <div className="pw-meta">
              {completedCount}/{totalRequired} {isHt ? 'sekasyon fini' : 'sections complete'}
              {lastSaved && (
                <span className="pw-save-status">
                  {saving
                    ? (isHt ? '💾 Ap sove...' : '💾 Saving...')
                    : (isHt ? `💾 Sove ${lastSaved.toLocaleTimeString()}` : `💾 Saved ${lastSaved.toLocaleTimeString()}`)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="pw-header-actions">
          {/* §25 — Project summary button */}
          <button
            className="pw-btn pw-btn--ghost"
            onClick={() => setShowSummary(!showSummary)}
          >
            <i className="fas fa-list-check" aria-hidden="true" />
            {isHt ? 'Rezime' : 'Summary'}
          </button>
          {/* §16 — Return to lesson */}
          {onReturnToLesson && (
            <button className="pw-btn pw-btn--ghost" onClick={onReturnToLesson}>
              <i className="fas fa-book-open" aria-hidden="true" />
              {isHt ? 'Retounen nan leson' : 'Return to lesson'}
            </button>
          )}
          {/* §41 — Submit */}
          {project.status !== 'submitted' && project.status !== 'approved' && (
            <button className="pw-btn pw-btn--primary" onClick={submitProject}>
              <i className="fas fa-paper-plane" aria-hidden="true" />
              {isHt ? 'Soumèt' : 'Submit'}
            </button>
          )}
        </div>
        {/* Progress bar */}
        <div className="pw-progress-bar" role="progressbar" aria-valuenow={project.completion_percentage} aria-valuemin={0} aria-valuemax={100}>
          <div className="pw-progress-fill" style={{ width: `${project.completion_percentage}%` }} />
        </div>
      </div>

      {/* §12 — Mobile sidebar drawer */}
      {sidebarOpen && <div className="pw-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* §12 — Sidebar */}
      <div className={`pw-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <ProjectSidebar
          sections={sections}
          completedSections={project.completed_sections || []}
          activeSectionId={activeSectionId}
          onSelect={(id) => { setActiveSectionId(id); setSidebarOpen(false); }}
          isHt={isHt}
          percentage={project.completion_percentage}
        />
      </div>

      {/* Content */}
      <div className="pw-content">
        {showSummary ? (
          <ProjectSummaryView
            project={project}
            isHt={isHt}
            user={user}
            onBack={() => setShowSummary(false)}
          />
        ) : activeSection ? (
          <SectionEditor
            section={activeSection}
            onSave={saveField}
            onComplete={completeSection}
            isHt={isHt}
            isSectionCompleted={(project.completed_sections || []).includes(activeSection.id)}
          />
        ) : (
          <div className="pw-empty">
            <i className="fas fa-folder-open" aria-hidden="true" />
            <p>{isHt ? 'Chwazi yon seksyon nan lis la.' : 'Select a section from the list.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
