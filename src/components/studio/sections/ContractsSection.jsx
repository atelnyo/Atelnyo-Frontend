/**
 * src/components/studio/sections/ContractsSection.jsx
 *
 * Contracts section — both sides of a job agreement see their contracts
 * here and drive the lifecycle from Creator Studio.
 *
 * Data flow:
 *   * contractService.list()   → GET /api/job-contracts/  — the backend
 *     isolates the queryset to contracts where I'm the client OR the
 *     freelancer, so this single list IS the whole surface.
 *   * contractService.complete(id) → POST .../complete/  — both parties
 *     can mark completed (backend requires all milestones approved/paid).
 *   * contractService.dispute(id)  → POST .../dispute/   — either party.
 *   * contractService.cancel(id)   → POST .../cancel/    — client only.
 */
import React, { useState, useCallback } from 'react';
import useFetch from '../../../hooks/useFetch';
import { contractService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

const STATUS_LABEL = {
  active: 'Active',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR = {
  active: '#2563eb',
  completed: '#059669',
  disputed: '#d97706',
  cancelled: '#64748b',
};

// Which actions are available per (role, status) — mirrors the backend
// gates in JobContractViewSet (complete/dispute: participants, active;
// cancel: client, active or disputed).
const CAN_COMPLETE = { active: true };
const CAN_DISPUTE = { active: true };
const CAN_CANCEL = { active: true, disputed: true };

export default function ContractsSection({ lang, t, showToast, user }) {
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const currentUserId = user?.id;

  const { data: contracts, loading, refetch } = useFetch(
    () => contractService.list(),
    {
      defaultValue: [],
      transform: (d) => {
        if (Array.isArray(d)) return d;
        if (d?.results) return d.results;
        return [];
      },
    },
  );

  const runAction = useCallback(async (contract, action, confirmMsg, successMsg) => {
    // Use ConfirmModal instead of window.confirm — handled by the
    // handleConfirmCallback pattern below
    return new Promise((resolve) => {
      setConfirm({ contract, action, confirmMsg, successMsg, resolve });
    });
  }, []);

  const handleConfirmedAction = useCallback(async (contract, action, successMsg) => {
    setBusyId(`${contract.id}:${action}`);
    try {
      await contractService[action](contract.id);
      showToast?.(successMsg, 'check-circle');
      refetch();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      showToast?.(detail || (lang === 'ht' ? 'Pa t kapab fè aksyon an.' : 'Could not perform action.'), 'circle-exclamation');
    } finally {
      setBusyId(null);
    }
  }, [lang, showToast, refetch]);

  // Handle confirm modal result
  const handleConfirm = useCallback(() => {
    if (!confirm) return;
    handleConfirmedAction(confirm.contract, confirm.action, confirm.successMsg);
    setConfirm(null);
  }, [confirm, handleConfirmedAction]);

  const handleCancelConfirm = useCallback(() => {
    setConfirm(null);
  }, []);

  const handleComplete = useCallback((contract) => {
    const msg = lang === 'ht'
      ? `Maké kontra a kòm completed? (Tout milestones yo dwe apwouve.)`
      : 'Mark this contract as completed? (All milestones must be approved.)';
    runAction(contract, 'complete', msg, lang === 'ht' ? '✅ Kontra completed!' : '✅ Contract completed!');
  }, [lang, runAction]);

  const handleDispute = useCallback((contract) => {
    const msg = lang === 'ht'
      ? `Louvri yon dispit sou kontra sa a? Yon moderatè ap antre.`
      : 'Open a dispute on this contract? A moderator will step in.';
    runAction(contract, 'dispute', msg, lang === 'ht' ? 'Dispit louvri.' : 'Dispute opened.');
  }, [lang, runAction]);

  const handleCancel = useCallback((contract) => {
    const msg = lang === 'ht'
      ? `Anile kontra sa a? (Aksyon final — job la ap maké cancelled.)`
      : 'Cancel this contract? (Final — the job will be marked cancelled.)';
    runAction(contract, 'cancel', msg, lang === 'ht' ? 'Kontra anile.' : 'Contract cancelled.');
  }, [lang, runAction]);

  if (loading) return <StudioSkeleton rows={4} />;

  const isEmpty = contracts.length === 0;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-handshake"
        title={lang === 'ht' ? 'Kontra yo' : 'Contracts'}
        lang={lang}
        help={{
          ht: 'Kontra yo kouvri tou de bò yon akò travay — ou kòm kliyan oswa freelancer. Yon kontra kreye otomatikman lè yon proposal aksepte, epi li swiv milestones li yo isit la.',
          en: 'Contracts cover both sides of a work agreement — you as client or freelancer. A contract is created automatically when a proposal is accepted and tracked milestone-by-milestone here.',
        }}
        tip={lang === 'ht'
          ? 'Tou de pati yo ka maké completed oswa louvri yon dispit; sèlman kliyan an ka anile.'
          : 'Either party can mark completed or open a dispute; only the client can cancel.'}
      />

      {isEmpty ? (
        <EmptyState
          icon="fa-handshake"
          title={lang === 'ht' ? 'Pokò gen kontra' : 'No contracts yet'}
          hint={lang === 'ht'
            ? 'Lè yon proposal aksepte, yon kontra kreye epi li ap parèt isit la.'
            : 'When a proposal is accepted, a contract is created and will appear here.'}
        />
      ) : (
        <div className={styles.list}>
          {contracts.map((contract) => {
            const status = contract.status || 'active';
            const isClient = currentUserId != null && String(contract.client) === String(currentUserId);
            const canComplete = isClient || String(contract.freelancer) === String(currentUserId);
            const pct = contract.milestone_count
              ? Math.round(((contract.completed_milestone_count || 0) / contract.milestone_count) * 100)
              : 0;
            return (
              <div key={contract.id} className={styles.listItem} style={{ alignItems: 'flex-start' }}>
                <div className={styles.listAvatar} style={{ flexShrink: 0, marginTop: 2 }}>
                  <i className="fas fa-handshake" aria-hidden="true" />
                </div>
                <div className={styles.listBody}>
                  <div className={styles.listTitle} style={{ whiteSpace: 'normal' }}>
                    {contract.job_title || `#${contract.job}`}
                    <span
                      style={{
                        fontWeight: 400,
                        color: 'var(--text-secondary, #64748b)',
                        fontSize: '0.8rem',
                        marginLeft: 8,
                      }}
                    >
                      {isClient
                        ? `↔ ${contract.freelancer_name}`
                        : `↔ ${contract.client_name}`}
                    </span>
                  </div>
                  <div className={styles.listMeta}>
                    <span
                      className={styles.badge}
                      style={{
                        background: isClient
                          ? 'rgba(37, 99, 235, 0.1)'
                          : 'rgba(147, 51, 234, 0.1)',
                        color: isClient ? '#2563eb' : '#9333ea',
                      }}
                    >
                      <i className={`fas ${isClient ? 'fa-user-tie' : 'fa-laptop-code'}`} aria-hidden="true" />
                      {' '}{isClient
                        ? (lang === 'ht' ? 'Kliyan' : 'Client')
                        : 'Freelancer'}
                    </span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>
                      {contract.total_amount} {contract.currency || 'USD'}
                    </span>
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
                  {(contract.milestone_count || 0) > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary, #64748b)',
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          {lang === 'ht' ? 'Milestones' : 'Milestones'}:{' '}
                          {contract.completed_milestone_count || 0}/{contract.milestone_count}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: 'var(--border-color, #e5e7eb)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #2563eb, #059669)',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {contract.paid_amount > 0 && (
                    <div className={styles.listMeta} style={{ marginTop: 6 }}>
                      <span style={{ color: '#059669' }}>
                        {lang === 'ht' ? 'Peye' : 'Paid'}: {contract.paid_amount} {contract.currency || 'USD'}
                      </span>
                    </div>
                  )}
                </div>
                {/* Actions show for active AND disputed (backend allows
                    client-cancel on disputed too — the CAN_* maps gate each
                    individual button by status). */}
                {(status === 'active' || status === 'disputed') && (
                  <div className={styles.itemActions} style={{ alignItems: 'center' }}>
                    {canComplete && CAN_COMPLETE[status] && (
                      <button
                        type="button"
                        className={styles.acceptBtn}
                        onClick={() => handleComplete(contract)}
                        disabled={busyId === `${contract.id}:complete`}
                        title={lang === 'ht' ? 'Maké completed' : 'Mark completed'}
                        aria-label={lang === 'ht' ? 'Maké kontra a completed' : 'Mark contract completed'}
                      >
                        {busyId === `${contract.id}:complete`
                          ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                          : <i className="fas fa-check" aria-hidden="true" />}
                      </button>
                    )}
                    {CAN_DISPUTE[status] && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDispute(contract)}
                        disabled={busyId === `${contract.id}:dispute`}
                        title={lang === 'ht' ? 'Louvri dispit' : 'Open dispute'}
                        aria-label={lang === 'ht' ? 'Louvri yon dispit' : 'Open a dispute'}
                      >
                        {busyId === `${contract.id}:dispute`
                          ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                          : <i className="fas fa-scale-balanced" aria-hidden="true" />}
                      </button>
                    )}
                    {isClient && CAN_CANCEL[status] && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleCancel(contract)}
                        disabled={busyId === `${contract.id}:cancel`}
                        title={lang === 'ht' ? 'Anile' : 'Cancel'}
                        aria-label={lang === 'ht' ? 'Anile kontra a' : 'Cancel contract'}
                      >
                        {busyId === `${contract.id}:cancel`
                          ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                          : <i className="fas fa-xmark" aria-hidden="true" />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {contracts.length > 0 && (
        <p className={styles.sectionDescription} style={{ marginTop: 16 }}>
          {lang === 'ht'
            ? '💡 Tou de pati yo ka maké completed oswa louvri yon dispit. Sèlman kliyan an ka anile. Tout aksyon yo fèt ak konfimasyon.'
            : '💡 Either party can mark completed or open a dispute. Only the client can cancel. All actions require confirmation.'}
        </p>
      )}
      {/* ConfirmModal for actions */}
      {confirm && (
        <ConfirmModal
          title={lang === 'ht'
            ? 'Konfime aksyon'
            : 'Confirm action'}
          message={confirm.confirmMsg}
          lang={lang}
          variant={confirm.action === 'cancel' ? 'danger' : confirm.action === 'dispute' ? 'warning' : 'info'}
          confirmText={lang === 'ht' ? 'Wi, konfime' : 'Yes, confirm'}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
          loading={busyId !== null}
        />
      )}
    </div>
  );
}
