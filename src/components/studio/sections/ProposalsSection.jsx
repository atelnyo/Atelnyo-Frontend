/**
 * src/components/studio/sections/ProposalsSection.jsx
 *
 * Proposals section — lets a client (job poster) review the bids on
 * their jobs and accept / reject them from Creator Studio.
 *
 * Data flow:
 *   * jobService.mine()        → the user's jobs (for the filter dropdown)
 *   * proposalService.list()   → proposals on the user's own jobs
 *     (the backend isolates non-staff users to their own proposals +
 *     proposals on their own jobs — exactly this surface)
 *   * proposalService.accept(id)  → POST /api/job-proposals/{id}/accept/
 *     (creates the JobContract server-side, rejects the other bids)
 *   * proposalService.reject(id, note) → POST .../reject/ (client note)
 */
import React, { useState, useCallback } from 'react';
import useFetch from '../../../hooks/useFetch';
import { jobService, proposalService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import ProposalDecisionModal from '../modals/ProposalDecisionModal';
import styles from './sections.module.css';

const STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const STATUS_COLOR = {
  pending: '#d97706',
  accepted: '#059669',
  rejected: '#dc2626',
  withdrawn: '#64748b',
};

export default function ProposalsSection({ lang, t, showToast }) {
  const [selectedJob, setSelectedJob] = useState('all');
  // Proposal currently in the accept/reject confirmation modal.
  // null = no modal; { mode: 'accept'|'reject', proposal } = open.
  const [decision, setDecision] = useState(null);

  // ─── User's jobs (for the filter) ─────────────────────────────────────
  const { data: jobs, loading: jobsLoading } = useFetch(
    () => jobService.mine(),
    { defaultValue: [], transform: (d) => {
      if (Array.isArray(d)) return d;
      if (d?.results) return d.results;
      return [];
    } },
  );

  // ─── Proposals on the user's own jobs ─────────────────────────────────
  // deps: [selectedJob] is REQUIRED — useFetch keys its effect on the deps
  // array, so the job filter select must re-trigger the fetch when it
  // changes (without deps it would fetch once and never update).
  const { data: proposals, loading, refetch } = useFetch(
    () => proposalService.list({ job: selectedJob !== 'all' ? selectedJob : undefined }),
    {
      deps: [selectedJob],
      defaultValue: [],
      transform: (d) => {
        if (Array.isArray(d)) return d;
        if (d?.results) return d.results;
        return [];
      },
    },
  );

  // Open the confirmation modal — the modal itself performs the API call
  // and calls onDone on success (toast + refetch here).
  const handleAccept = useCallback((proposal) => {
    setDecision({ mode: 'accept', proposal });
  }, []);

  const handleReject = useCallback((proposal) => {
    setDecision({ mode: 'reject', proposal });
  }, []);

  const handleDecisionDone = useCallback((mode) => {
    setDecision(null);
    showToast?.(
      mode === 'accept'
        ? (lang === 'ht' ? '✅ Proposal aksepte — kontra kreye!' : '✅ Proposal accepted — contract created!')
        : (lang === 'ht' ? 'Proposal rejte.' : 'Proposal rejected.'),
      mode === 'accept' ? 'check-circle' : 'ban',
    );
    refetch();
  }, [lang, showToast, refetch]);

  if (jobsLoading || loading) return <StudioSkeleton rows={4} />;

  const isEmpty = proposals.length === 0;
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-file-signature"
        title={lang === 'ht' ? 'Proposal yo' : 'Proposals'}
        lang={lang}
        help={{
          ht: 'Freelancers yo voye proposal sou travay ou yo. Ou ka filtre pa travay, epi aksepte oswa rejte chak ofi — aksepte yon proposal kreye yon kontra otomatikman.',
          en: 'Freelancers bid on your jobs with proposals. Filter by job, then accept or reject each offer — accepting creates a contract automatically.',
        }}
        tip={lang === 'ht'
          ? 'Aksepte yon proposal rejte lòt proposal yo sou travay sa a otomatikman.'
          : 'Accepting a proposal auto-rejects the other bids on that job.'}
        action={
          jobs.length > 0 ? (
            <select
              className={`${styles.filterSelect}`}
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              aria-label={lang === 'ht' ? 'Filtre pa travay' : 'Filter by job'}
            >
              <option value="all">
                {lang === 'ht' ? 'Tout travay' : 'All jobs'}
                {pendingCount > 0 ? ` (${pendingCount} pendan)` : ''}
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      {isEmpty ? (
        <EmptyState
          icon="fa-file-signature"
          title={lang === 'ht' ? 'Pokò gen proposal' : 'No proposals yet'}
          hint={selectedJob !== 'all'
            ? (lang === 'ht'
              ? 'Travay sa a poko resevwa proposal.'
              : 'This job has not received proposals yet.')
            : (lang === 'ht'
              ? 'Lè freelancers yo voye proposal sou travay ou yo, yo ap parèt isit la.'
              : 'When freelancers bid on your jobs, they will appear here.')}
        />
      ) : (
        <div className={styles.list}>
          {proposals.map((proposal) => {
            const status = proposal.status || 'pending';
            const canAct = status === 'pending';
            return (
              <div key={proposal.id} className={styles.listItem} style={{ alignItems: 'flex-start' }}>
                <div className={styles.listAvatar} style={{ flexShrink: 0, marginTop: 2 }}>
                  {(proposal.freelancer_name || 'F').slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.listBody}>
                  <div className={styles.listTitle} style={{ whiteSpace: 'normal' }}>
                    {proposal.freelancer_name || `#${proposal.freelancer}`}
                    {selectedJob === 'all' && proposal.job_title && (
                      <span style={{ fontWeight: 400, color: 'var(--text-secondary, #64748b)', fontSize: '0.8rem' }}>
                        {' '}· {proposal.job_title}
                      </span>
                    )}
                  </div>
                  <div className={styles.listMeta}>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>
                      {proposal.bid_amount} {proposal.currency || 'USD'}
                    </span>
                    {proposal.estimated_duration_days != null && (
                      <span>
                        · {proposal.estimated_duration_days} {lang === 'ht' ? 'jou' : 'days'}
                      </span>
                    )}
                    <span
                      className={styles.badge}
                      style={{
                        background: `${STATUS_COLOR[status]}1a`,
                        color: STATUS_COLOR[status],
                      }}
                    >
                      {STATUS_LABEL[status] || status}
                    </span>
                  </div>
                  {proposal.cover_letter && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', whiteSpace: 'pre-wrap' }}>
                      {proposal.cover_letter}
                    </p>
                  )}
                  {proposal.client_note && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#dc2626', fontStyle: 'italic' }}>
                      {lang === 'ht' ? 'Nòt kliyan:' : 'Client note:'} {proposal.client_note}
                    </p>
                  )}
                </div>
                {canAct && (
                  <div className={styles.itemActions} style={{ alignItems: 'center' }}>
                    <button
                      type="button"
                      className={styles.acceptBtn}
                      onClick={() => handleAccept(proposal)}
                      title={lang === 'ht' ? 'Aksepte' : 'Accept'}
                      aria-label={lang === 'ht' ? 'Aksepte proposal sa a' : 'Accept this proposal'}
                    >
                      <i className="fas fa-check" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleReject(proposal)}
                      title={lang === 'ht' ? 'Rejte' : 'Reject'}
                      aria-label={lang === 'ht' ? 'Rejte proposal sa a' : 'Reject this proposal'}
                    >
                      <i className="fas fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {proposals.length > 0 && (
        <p className={styles.sectionDescription} style={{ marginTop: 16 }}>
          {lang === 'ht'
            ? '💡 Aksepte yon proposal kreye yon kontra epi rejte lòt proposal yo otomatikman.'
            : '💡 Accepting a proposal creates a contract and auto-rejects the other bids.'}
        </p>
      )}

      {/* Accept/Reject confirmation modal */}
      {decision && (
        <ProposalDecisionModal
          proposal={decision.proposal}
          mode={decision.mode}
          lang={lang}
          onClose={() => setDecision(null)}
          onDone={() => handleDecisionDone(decision.mode)}
        />
      )}
    </div>
  );
}
