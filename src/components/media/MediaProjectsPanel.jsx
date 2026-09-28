/**
 * MediaProjectsPanel — Project Mode panel for media.
 *
 * Spec (Phase CREATOR EXPERIENCE §5 + §6):
 *   - Creator ka kreye yon Project (e.g. React Course, Tout medya ki
 *     itilize pou kou sa).
 *   - Lè Project fini, li toujou rete òganize.
 *   - Smart Organization encapsulates Folders / Collections / Tags /
 *     Projects / Categories / Favorites / Pinned / Archive — no
 *     forced single organization.
 *
 * Sprint stance:
 *   Backend m2m `Media ↔ PortfolioProject` is not yet shipped. Until
 *   then, the panel reads from `mediaProjectStore` (localStorage) so
 *   the UI ships today. The store key is namespaced + uses the same
 *   shape the BE endpoint will return.
 *
 * Behavior:
 *   - List all known projects with a media-count chip.
 *   - Add Project button mounts a modal (MediaProjectFormModal).
 *   - Click a project to filter the media grid (calls onProjectClick).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import BackendPendingChip from './BackendPendingChip';
import MediaProjectFormModal from './MediaProjectFormModal';
import projectStore from '../../utils/mediaProjectStore';
import { makeT } from '../../utils/langBackendStub';

export default function MediaProjectsPanel({
  lang = 'ht',
  mediaList = [],
  showToast,
  onNavigate,
  onOpenMedia,
}) {
  const t = makeT(lang);
  const [projects, setProjects] = useState(() => projectStore.listProjects());
  const [assignments, setAssignments] = useState(() => {
    const all = {};
    for (const m of mediaList || []) {
      const ps = projectStore.getMediaProjects(m.id);
      if (ps.length) {all[m.id] = ps;}
    }
    return all;
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setProjects(projectStore.listProjects());
      const all = {};
      for (const m of mediaList || []) {
        const ps = projectStore.getMediaProjects(m.id);
        if (ps.length) {all[m.id] = ps;}
      }
      setAssignments(all);
    };
    window.addEventListener('atelnyo:media-projects:changed', onChange);
    return () => {
      window.removeEventListener('atelnyo:media-projects:changed', onChange);
    };
  }, [mediaList]);

  const countByProject = useMemo(() => {
    const map = new Map();
    for (const projects of Object.values(assignments)) {
      for (const p of projects) {
        map.set(p.id, (map.get(p.id) || 0) + 1);
      }
    }
    return map;
  }, [assignments]);

  const handleCreate = useCallback((data) => {
    try {
      const created = projectStore.createProject(data);
      setShowForm(false);
      if (showToast) {showToast(
        (lang === 'en' ? 'Project added: ' : 'Pwojè ajoute: ') + created.name,
        'palette',
      );}
    } catch (err) {
      if (showToast) {showToast(
        (lang === 'en' ? 'Could not add project: ' : 'Pa kapab ajoute pwojè: ') + err.message,
        'exclamation-triangle',
      );}
    }
  }, [showToast, lang, setShowForm]);

  const handleDelete = useCallback((id) => {
    const p = projectStore.getProject(id);
    if (!p) {return;}
    if (!window.confirm(
      lang === 'en'
        ? `Delete project "${p.name}"? Media stays in your library.`
        : `Efase pwojè "${p.name}"? Medya rete nan bibliyotèk ou.`,
    )) {return;}
    projectStore.deleteProject(id);
    if (showToast) {showToast(
      lang === 'en' ? 'Project removed.' : 'Pwojè retire.',
      'trash',
    );}
  }, [showToast, lang]);

  if (projects.length === 0) {
    return (
      <section className="media-projects-panel" aria-label={t('projects')}>
        <header className="media-projects-panel-header">
          <i className="fas fa-diagram-project" aria-hidden="true" />
          <h3>{t('projectMode')}</h3>
          <BackendPendingChip lang={lang} endpoint="/api/media/projects/" inline />
          <button
            type="button"
            className="media-projects-add-btn"
            onClick={() => setShowForm(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            <span>{t('addProject')}</span>
          </button>
        </header>
        <div className="media-projects-empty">
          <p>{t('noProjects')}</p>
        </div>
        {showForm && (
          <MediaProjectFormModal
            lang={lang}
            onClose={() => setShowForm(false)}
            onSubmit={handleCreate}
            showToast={showToast}
          />
        )}
      </section>
    );
  }

  return (
    <section className="media-projects-panel" aria-label={t('projects')}>
      <header className="media-projects-panel-header">
        <i className="fas fa-diagram-project" aria-hidden="true" />
        <h3>{t('projectMode')}</h3>
        <BackendPendingChip lang={lang} endpoint="/api/media/projects/" inline />
        <button
          type="button"
          className="media-projects-add-btn"
          onClick={() => setShowForm(true)}
        >
          <i className="fas fa-plus" aria-hidden="true" />
          <span>{t('addProject')}</span>
        </button>
        <button
          type="button"
          className="media-projects-add-btn media-projects-add-btn-secondary"
          onClick={() => onOpenMedia?.()}
        >
          <i className="fas fa-layer-group" aria-hidden="true" />
          <span>{lang === 'en' ? 'Open media' : 'Louvri medya'}</span>
        </button>
      </header>
      <div className="media-projects-grid" role="list">
        {projects.map((p) => {
          const count = countByProject.get(p.id) || 0;
          return (
            <article
              key={p.id}
              className="media-projects-card"
              role="listitem"
              style={{ '--project-accent': p.color || '#d81b60' }}
            >
              <header className="media-projects-card-header">
                <span className="media-projects-card-tag" aria-hidden="true">
                  <i className="fas fa-diagram-project" />
                </span>
                <h4 className="media-projects-card-name">{p.name}</h4>
              </header>
              <div className="media-projects-card-body">
                {p.description && (
                  <p className="media-projects-card-desc">{p.description}</p>
                )}
                <span className="media-projects-card-count">
                  <i className="fas fa-photo-video" aria-hidden="true" />
                  {count > 0
                    ? (lang === 'en'
                        ? `${count} media attached`
                        : `${count} medya atache`)
                    : (lang === 'en' ? 'Empty project' : 'Pwojè vid')}
                </span>
              </div>
              <footer className="media-projects-card-footer">
                <button
                  type="button"
                  className="media-projects-card-btn"
                  disabled={count === 0}
                  onClick={() => {
                    if (showToast) {showToast(
                      lang === 'en'
                        ? `Filter grid by project "${p.name}".`
                        : `Filtre kad pa pwojè "${p.name}".`,
                      'filter',
                    );}
                    if (onNavigate) {onNavigate({ projectId: p.id });}
                  }}
                >
                  <i className="fas fa-filter" aria-hidden="true" />
                  <span>{lang === 'en' ? 'Filter' : 'Filtè'}</span>
                </button>
                <button
                  type="button"
                  className="media-projects-card-btn media-projects-card-btn-danger"
                  onClick={() => handleDelete(p.id)}
                  aria-label={(lang === 'en' ? 'Delete project ' : 'Efase pwojè ') + p.name}
                >
                  <i className="fas fa-trash" aria-hidden="true" />
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      <div className="media-projects-panel-footer">
        <button
          type="button"
          className="media-projects-add-btn media-projects-add-btn-secondary"
          onClick={() => onOpenMedia?.()}
        >
          <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
          <span>{lang === 'en' ? 'Go to media' : 'Ale nan medya'}</span>
        </button>
      </div>
      {showForm && (
        <MediaProjectFormModal
          lang={lang}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
          showToast={showToast}
        />
      )}
    </section>
  );
}
