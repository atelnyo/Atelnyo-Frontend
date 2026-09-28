/**
 * src/components/studio/modals/ProposalDecisionModal.jsx
 *
 * Beautiful confirmation modal for accepting / rejecting a job proposal
 * — replaces the bare window.confirm / window.prompt UX in
 * ProposalsSection.
 *
 * Accept mode:
 *   * freelancer summary (name, reputation/verified chips)
 *   * prominent bid amount + currency
 *   * estimated delivery date (computed from the freelancer's
 *     estimated_duration_days) so the client sees the timeline before
 *     committing
 *   * optional client note — persisted by the backend accept action
 *     (proposal.client_note), visible to the freelancer later
 *
 * Reject mode:
 *   * same bid summary for context
 *   * optional client note (proposalService.reject → client_note)
 *
 * On success calls onDone() so the parent can refetch + toast.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { proposalService } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso || ''; }
};

export default function ProposalDecisionModal({
  proposal,
  mode = 'accept', // 'accept' | 'reject'
  lang = 'ht',
  onClose,
  onDone,
}) {
  const isAccept = mode === 'accept';
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const deliveryDate = useMemo(() => {
    const days = Number(proposal?.estimated_duration_days);
    if (!days || days <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDate(d.toISOString());
  }, [proposal?.estimated_duration_days]);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isAccept) {
        await proposalService.accept(proposal.id, { client_note: note.trim() });
      } else {
        await proposalService.reject(proposal.id, note.trim());
      }
      onDone?.();
    } catch (err) {
      setError(
        err?.response?.data?.detail
        || (lang === 'ht'
          ? 'Pa t kapab fè aksyon an. Eseye ankò.'
          : 'Could not complete this action. Please try again.'),
      );
      setLoading(false);
    }
  }, [isAccept, proposal.id, note, lang, onDone]);

  const freelancerName = proposal?.freelancer_name || `#${proposal?.freelancer}`;
  const initial = (freelancerName || 'F').slice(0, 1).toUpperCase();

  return (
    <StudioModal
      onClose={loading ? undefined : onClose}
      icon={isAccept ? 'fa-check-circle' : 'fa-xmark-circle'}
      title={isAccept
        ? (lang === 'ht' ? 'Aksepte Proposal' : 'Accept Proposal')
        : (lang === 'ht' ? 'Rejte Proposal' : 'Reject Proposal')}
      subtitle={proposal?.job_title || ''}
    >
      <div className={styles.form}>
        {/* ─── Freelancer summary ─────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-xl)',
          padding: 'var(--sp-xl) var(--sp-2xl)',
          background: 'var(--bg-highlight, #f8fafc)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary-gradient, linear-gradient(135deg,#6366f1,#a855f7))',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 'var(--text-md)',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-sm)',
              flexWrap: 'wrap',
            }}>
              {freelancerName}
              {proposal?.freelancer_verified && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#059669',
                    background: 'rgba(16,185,129,0.1)',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  <i className="fas fa-badge-check" aria-hidden="true" />{' '}
                  {lang === 'ht' ? 'Verifye' : 'Verified'}
                </span>
              )}
            </div>
            {proposal?.freelancer_reputation != null && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                <i className="fas fa-star" style={{ color: '#f59e0b' }} aria-hidden="true" />{' '}
                {proposal.freelancer_reputation}
                {proposal.freelancer_account_type ? ` · ${proposal.freelancer_account_type}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* ─── Bid amount ─────────────────────────────────────── */}
        <div style={{
          textAlign: 'center',
          padding: 'var(--sp-2xl)',
          background: isAccept
            ? 'rgba(16,185,129,0.06)'
            : 'rgba(239,68,68,0.05)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary, #64748b)',
            marginBottom: 4,
          }}>
            {lang === 'ht' ? 'Montan Bid la' : 'Bid amount'}
          </div>
          <div style={{
            fontSize: 'var(--text-4xl, 2rem)',
            fontWeight: 700,
            color: isAccept ? '#059669' : '#dc2626',
            letterSpacing: '-0.02em',
          }}>
            {proposal?.bid_amount} {proposal?.currency || 'USD'}
          </div>
        </div>

        {/* ─── Delivery estimate ──────────────────────────────── */}
        {deliveryDate && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-md)',
            padding: 'var(--sp-lg) var(--sp-2xl)',
            background: 'rgba(37,99,235,0.05)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary, #475569)',
          }}>
            <i className="fas fa-calendar-check" style={{ color: '#2563eb' }} aria-hidden="true" />
            <span>
              {lang === 'ht'
                ? `Livrezon estimative: ${deliveryDate} (~${proposal.estimated_duration_days} jou)`
                : `Estimated delivery: ${deliveryDate} (~${proposal.estimated_duration_days} days)`}
            </span>
          </div>
        )}

        {/* ─── Cover letter (context) ─────────────────────────── */}
        {proposal?.cover_letter && (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary, #475569)',
            lineHeight: 1.6,
            padding: 'var(--sp-lg) var(--sp-xl)',
            borderLeft: '3px solid var(--border-color, #e5e7eb)',
          }}>
            <span style={{ fontStyle: 'italic' }}>“{proposal.cover_letter}”</span>
          </div>
        )}

        {/* ─── Client note ────────────────────────────────────── */}
        <FormField
          label={isAccept
            ? (lang === 'ht' ? 'Nòt pou freelancer la (opsyonèl)' : 'Note for the freelancer (optional)')
            : (lang === 'ht' ? 'Nòt rejtman (opsyonèl)' : 'Rejection note (optional)')}
          hint={isAccept
            ? (lang === 'ht' ? 'Mesaj ou ap parèt sou proposal la.' : 'Your message will be visible on the proposal.')
            : (lang === 'ht' ? 'Ede freelancer la konprann poukisa.' : 'Help the freelancer understand why.')}
        >
          <textarea
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={isAccept
              ? (lang === 'ht' ? 'Mèsi pou bid ou a!' : 'Thanks for your bid!')
              : (lang === 'ht' ? 'Nou chwazi yon lòt kandidat...' : 'We chose another candidate...')}
          />
        </FormField>

        {error && <div className={styles.apiError} role="alert">{error}</div>}

        {/* ─── Actions ────────────────────────────────────────── */}
        <LoadingOverlay loading={loading}>
          <div className={styles.actions}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              {lang === 'ht' ? 'Retounen' : 'Go back'}
            </button>
            {isAccept ? (
              <button type="button" className="btn-primary" onClick={handleConfirm} disabled={loading}>
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Ap kreye kontra...' : 'Creating contract...'}</>
                ) : (
                  <><i className="fas fa-check" aria-hidden="true" /> {lang === 'ht' ? 'Aksepte & Kreye Kontra' : 'Accept & Create Contract'}</>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="studio-btn-danger"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Ap rejte...' : 'Rejecting...'}</>
                ) : (
                  <><i className="fas fa-xmark" aria-hidden="true" /> {lang === 'ht' ? 'Rejte Proposal' : 'Reject Proposal'}</>
                )}
              </button>
            )}
          </div>
        </LoadingOverlay>
      </div>
    </StudioModal>
  );
}
