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
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { data: projects, loading, refetch, removeLocal } = useFetch(
    () => portfolioService.list({ limit: 10, mine: true }),
    { defaultValue: [], transform: (d) => (Array.isArray(d?.results || d) ? (d?.results || d) : []) },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase pwojè' : 'Delete project',
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
            await portfolioService.delete(item.id);
            showToast?.(lang === 'ht' ? '✅ Pwojè efase!' : '✅ Project deleted!', 'check-circle');
          } catch (err) {
            showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
          }
          refetch();
        })();
      },
    });
  };

  if (loading && projects.length === 0) return <StudioSkeleton rows={3} />;

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
              {p.cover_url ? (
                <img
                  src={p.cover_url}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div className={styles.listIcon}>
                  <i className="fas fa-palette" aria-hidden="true" />
                </div>
              )}
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  {p.title}
                  {p.is_featured && (
                    <span className={styles.badge} style={{ marginLeft: 8, background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                      ⭐ {lang === 'ht' ? 'Vedèt' : 'Featured'}
                    </span>
                  )}
                  {p.is_published === false && (
                    <span className={styles.badge} style={{ marginLeft: 8, background: 'rgba(100,116,139,0.12)', color: 'var(--color-gray-500)' }}>
                      {lang === 'ht' ? 'Bouyon' : 'Draft'}
                    </span>
                  )}
                </div>
                <div className={styles.listMeta}>
                  {p.category && <span>{p.category}</span>}
                  {p.difficulty && <span> · {p.difficulty}</span>}
                  {p.visibility && p.visibility !== 'public' && (
                    <span> · <i className={p.visibility === 'subscribers' ? 'fas fa-crown' : 'fas fa-user-check'} aria-hidden="true" /> {p.visibility}</span>
                  )}
                  {p.view_count > 0 && <span> · 👁 {fmtCount(p.view_count)}</span>}
                  {p.like_count > 0 && <span> · ❤️ {fmtCount(p.like_count)}</span>}
                  {Array.isArray(p.media_gallery) && p.media_gallery.length > 0 && (
                    <span> · 🎞 {p.media_gallery.length}</span>
                  )}
                </div>
                {Array.isArray(p.skills_used) && p.skills_used.length > 0 && (
                  <div className={styles.tagRow}>
                    {p.skills_used.slice(0, 4).map((s) => (
                      <span key={s} className={styles.tag}>#{String(s).replace(/^#/, '')}</span>
                    ))}
                    {p.skills_used.length > 4 && (
                      <span className={styles.tag}>+{p.skills_used.length - 4}</span>
                    )}
                  </div>
                )}
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
          loading={confirmBusy}
          onConfirm={confirm.onConfirm}
          onCancel={() => { if (!confirmBusy) setConfirm(null); }}
        />
      )}
    </div>
  );
}
