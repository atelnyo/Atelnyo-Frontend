/**
 * src/components/studio/sections/JobsSection.jsx
 *
 * Jobs section — list, create, edit, delete job posts for the
 * Explore "Travay" catalog. Mirrors TalentSection pattern.
 * Uses jobService.mine() (GET /api/jobs/mine/) so creators only
 * see their own posts, including drafts.
 */
import React, { useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { jobService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

function formatBudget(j) {
  if (!j || j.budget_min == null) return '';
  const min = Number(j.budget_min);
  const max = Number(j.budget_max);
  const cur = j.currency || 'USD';
  if (j.budget_type === 'hourly') return `$${min}-${max}/${cur === 'USD' ? 'hr' : cur}`;
  return `$${min} — $${max} ${cur}`;
}

const STATUS_LABEL = {
  draft: 'Draft',
  published: 'Published',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function JobsSection({ lang, t, showToast, setShowJobModal, onEdit }) {
  const [confirm, setConfirm] = useState(null);
  const { data: jobs, loading, refetch } = useFetch(
    () => jobService.mine(),
    { defaultValue: [], transform: (d) => {
      if (Array.isArray(d)) return d;
      if (d?.results) return d.results;
      return [];
    } },
  );

  const handleDeleteClick = (item) => {
    setConfirm({
      item,
      title: lang === 'ht' ? 'Efase travay' : 'Delete job',
      message: lang === 'ht' ? `Eske w sèten ou vle efase "${item.title}"?` : `Are you sure you want to delete "${item.title}"?`,
      onConfirm: async () => {
        try {
          await jobService.delete(item.id);
          showToast?.(lang === 'ht' ? '✅ Travay efase!' : '✅ Job deleted!', 'check-circle');
          refetch();
        } catch (err) {
          showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
        }
        setConfirm(null);
      },
    });
  };

  const handlePublish = async (item) => {
    try {
      await jobService.publish(item.id);
      showToast?.(lang === 'ht' ? 'Travay pibliye!' : 'Job published!', 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab pibliye.' : 'Could not publish.'), 'circle-exclamation');
    }
  };

  if (loading) return <StudioSkeleton rows={3} />;

  const isEmpty = jobs.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-briefcase"
        title={lang === 'ht' ? 'Travay mwen yo' : 'My Jobs'}
        lang={lang}
        help={{
          ht: 'Travay ou pibliye yo parèt nan Explore Travay. Yon imaj kouvèti (opsyonèl) fè yon travay parèt pi byen epi atire plis kandida.',
          en: 'Your published jobs appear in Explore Jobs. An optional cover image makes a job stand out and attracts more applicants.',
        }}
        tip={lang === 'ht'
          ? 'Nouvo: ou ka ajoute yon imaj kouvèti a chak travay.'
          : 'New: you can add a cover image to every job post.'}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowJobModal(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {lang === 'ht' ? 'Kreye Travay' : 'Create Job'}
          </button>
        }
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-briefcase"
          title={lang === 'ht' ? 'PokO gen travay' : 'No jobs yet'}
          hint={lang === 'ht'
            ? 'Kreye premye travay ou pou parèt nan Explore Travay.'
            : 'Create your first job to appear in Explore Jobs.'}
          ctaLabel={lang === 'ht' ? 'Kreye Premye Travay' : 'Create First Job'}
          onCta={() => setShowJobModal(true)}
        />
      ) : (
        <div className={styles.list}>
          {jobs.map((job) => {
            const budget = formatBudget(job);
            const status = job.status || 'draft';
            return (
              <div key={job.id} className={styles.listItem}>
                <div className={styles.listIcon} style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                  <i className="fas fa-briefcase" aria-hidden="true" />
                </div>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>
                    {job.title}
                    <span
                      className={styles.badge}
                      style={{
                        marginLeft: 8,
                        background: status === 'published'
                          ? 'rgba(16,185,129,0.1)'
                          : status === 'draft' ? 'rgba(245,158,11,0.1)'
                          : 'rgba(100,116,139,0.1)',
                        color: status === 'published' ? '#059669'
                          : status === 'draft' ? '#d97706' : 'var(--color-gray-500)',
                      }}
                    >
                      {STATUS_LABEL[status] || status}
                    </span>
                  </div>
                  <div className={styles.listMeta}>
                    {budget && <span>{budget}</span>}
                    {job.is_remote && <span> · 🌐 {t.explore_remote || 'Remote'}</span>}
                    {job.location && <span> · {job.location}</span>}
                    {job.proposal_count != null && (
                      <span> · {job.proposal_count} {t.explore_job_proposals || 'proposals'}</span>
                    )}
                  </div>
                  {Array.isArray(job.skills_required) && job.skills_required.length > 0 && (
                    <div className={styles.tagRow}>
                      {job.skills_required.slice(0, 4).map((s) => (
                        <span key={s} className={styles.tag}>{s}</span>
                      ))}
                      {job.skills_required.length > 4 && (
                        <span className={styles.tag}>+{job.skills_required.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.itemActions}>
                  {status === 'draft' && (
                    <button type="button" className={styles.editBtn} onClick={() => handlePublish(job)}
                      title={lang === 'ht' ? 'Pibliye' : 'Publish'}>
                      <i className="fas fa-rocket" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" className={styles.editBtn} onClick={() => onEdit?.(job)}
                    title={lang === 'ht' ? 'Modifye' : 'Edit'}>
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => handleDeleteClick(job)}
                    title={lang === 'ht' ? 'Efase' : 'Delete'}>
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
