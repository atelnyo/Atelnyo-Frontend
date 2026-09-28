/**
 * src/components/studio/sections/PortfolioSection.jsx
 *
 * Portfolio section — lists creator's portfolio projects with category,
 * view count, and file icon. Empty state with CTA.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 * Refactored to use useFetch hook — Etap 5 (2026-07-19).
 */
import React, { useState } from 'react';
import { portfolioService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader, fmtCount } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

export default function PortfolioSection({ lang, t, showToast, setShowProjectModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const { data: projects, loading, refetch } = useFetch(
    () => portfolioService.list({ limit: 10, mine: true }),
    { defaultValue: [], transform: (d) => (Array.isArray(d?.results || d) ? (d?.results || d) : []) },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase pwojè' : 'Delete project',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: async () => {
        try {
          await portfolioService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Pwojè efase!' : '✅ Project deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
      },
    });
  };

  if (loading) return <StudioSkeleton rows={3} />;

  const isEmpty = projects.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-briefcase"
        title={t.studio_my_portfolio || 'My Portfolio'}
        lang={lang}
        help={{
          ht: 'Pwojè pòtfolyo ou yo montre travay ou bay kliyan potansyèl. Bay chak pwojè yon kouvèti ak yon deskripsyon pou fè l parèt byen.',
          en: 'Your portfolio projects showcase your work to potential clients. Give each project a cover and a description to make it stand out.',
        }}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowProjectModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {t.studio_new_project || 'New Project'}
          </button>
        }
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-briefcase"
          title={t.studio_no_projects || 'No projects yet'}
          hint={t.studio_no_projects_hint || 'Showcase your work by adding a project.'}
          ctaLabel={t.studio_add_project || 'Add Project'}
          onCta={() => setShowProjectModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {projects.map((p) => (
            <div key={p.id} className={styles.listItem}>
              <div className={styles.listIcon}>
                <i className="fas fa-file-alt" aria-hidden="true" />
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{p.title}</div>
                <div className={styles.listMeta}>
                  {p.category && <span>{p.category}</span>}
                  {p.views > 0 && <span>· {fmtCount(p.views)} {t.studio_views || 'views'}</span>}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.editBtn} onClick={() => onEdit?.(p)}
                  title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                  <i className="fas fa-pen" aria-hidden="true" />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(p)}
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
    </div>
  );
}
