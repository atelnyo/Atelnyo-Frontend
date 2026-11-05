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
 *   * Milestones (per-contract panel below): milestoneService.list() for
 *     the rows, .create() to define a checkpoint, .submit() (freelancer)
 *     and .approve() (client). Funding goes through CheckoutModal
 *     type="escrow" (PayPal AUTHORIZE hold) while pending/in_progress.
 */
import React, { useState, useCallback } from 'react';
import useFetch from '../../../hooks/useFetch';
import { contractService, milestoneService } from '../../../services/api';
import CheckoutModal from '../../CheckoutModal';
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

const MS_STATUS_LABEL = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
  disputed: 'Disputed',
};

const MS_STATUS_COLOR = {
  pending: '#d97706',
  in_progress: '#2563eb',
  submitted: '#b45309',
  approved: '#059669',
  paid: '#047857',
  disputed: '#dc2626',
};

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

  // ─── Milestones — the per-contract workspace ────────────────────────
  // Backend lifecycle: pending →(freelancer submit) submitted →(client
  // approve) approved → paid. Funding (escrow AUTHORIZE hold) happens
  // while pending/in_progress via CheckoutModal type="escrow".
  const [expandedMs, setExpandedMs] = useState({});
  const [milestones, setMilestones] = useState({});
  const [msLoading, setMsLoading] = useState({});
  const [msBusy, setMsBusy] = useState(null);
  const [msFormOpen, setMsFormOpen] = useState({});
  const [msForm, setMsForm] = useState({});
  const [fundTarget, setFundTarget] = useState(null); // { ...milestone, contractId }

  const loadMilestones = useCallback(async (contractId, silent = false) => {
    if (!silent) setMsLoading((m) => ({ ...m, [contractId]: true }));
    try {
      const res = await milestoneService.list({ contract: contractId });
      const rows = Array.isArray(res?.data)
        ? res.data
        : (Array.isArray(res?.data?.results) ? res.data.results : []);
      setMilestones((m) => ({ ...m, [contractId]: rows }));
    } catch {
      if (!silent) showToast?.(lang === 'ht' ? 'Pa t kapab chaje milestones yo.' : 'Could not load milestones.', 'circle-exclamation');
    } finally {
      if (!silent) setMsLoading((m) => ({ ...m, [contractId]: false }));
    }
  }, [lang, showToast]);

  const toggleMilestones = useCallback((contract) => {
    setExpandedMs((e) => {
      const next = !e[contract.id];
      if (next && milestones[contract.id] === undefined) loadMilestones(contract.id);
      return { ...e, [contract.id]: next };
    });
  }, [milestones, loadMilestones]);

  const setFormField = useCallback((contractId, field, value) => {
    setMsForm((m) => ({ ...m, [contractId]: { ...(m[contractId] || {}), [field]: value } }));
  }, []);

  const handleCreateMilestone = useCallback(async (contract) => {
    const f = msForm[contract.id] || {};
    if (!f.title?.trim()) {
      showToast?.(lang === 'ht' ? 'Bay milestone lan yon tit.' : 'Give the milestone a title.', 'circle-exclamation');
      return;
    }
    const amount = Number(f.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast?.(lang === 'ht' ? 'Mete yon montan valid (> 0).' : 'Enter a valid amount (> 0).', 'circle-exclamation');
      return;
    }
    setMsBusy(`create:${contract.id}`);
    try {
      await milestoneService.create({
        contract: contract.id,
        title: f.title.trim(),
        description: f.description?.trim() || '',
        amount,
        due_date: f.due_date ? new Date(f.due_date).toISOString() : null,
        order: (milestones[contract.id] || []).length,
      });
      setMsForm((m) => ({ ...m, [contract.id]: {} }));
      setMsFormOpen((m) => ({ ...m, [contract.id]: false }));
      showToast?.(lang === 'ht' ? '✅ Milestone kreye!' : '✅ Milestone created!', 'check-circle');
      await loadMilestones(contract.id, true);
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || err?.response?.data?.title?.[0] || (lang === 'ht' ? 'Pa t kapab kreye milestone lan.' : 'Could not create the milestone.'), 'circle-exclamation');
    } finally {
      setMsBusy(null);
    }
  }, [lang, showToast, msForm, milestones, loadMilestones, refetch]);

  const handleMilestoneAction = useCallback(async (contractId, milestone, action) => {
    const key = `${action}:${milestone.id}`;
    setMsBusy(key);
    try {
      await milestoneService[action](milestone.id);
      showToast?.(
        action === 'submit'
          ? (lang === 'ht' ? '✅ Milestone soumèt pou revizyon!' : '✅ Milestone submitted for review!')
          : action === 'markPaid'
            ? (lang === 'ht' ? '✅ Milestone make peye!' : '✅ Milestone marked paid!')
            : (lang === 'ht' ? '✅ Milestone apwouve!' : '✅ Milestone approved!'),
        'check-circle',
      );
      await loadMilestones(contractId, true);
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab fè aksyon an.' : 'Could not perform action.'), 'circle-exclamation');
    } finally {
      setMsBusy(null);
    }
  }, [lang, showToast, loadMilestones, refetch]);

  const handleFundClose = useCallback(() => {
    const target = fundTarget;
    setFundTarget(null);
    // The escrow hold may have completed behind the modal — silently
    // refresh so funded/in_progress states show up immediately.
    if (target?.contractId) {
      loadMilestones(target.contractId, true);
      refetch();
    }
  }, [fundTarget, loadMilestones, refetch]);

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
                  {/* ── Milestones workspace: define → fund → submit → approve → paid ── */}
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => toggleMilestones(contract)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', borderRadius: 999, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', cursor: 'pointer' }}
                      aria-expanded={Boolean(expandedMs[contract.id])}
                    >
                      <i className="fas fa-list-check" aria-hidden="true" />
                      {lang === 'ht' ? 'Milestones' : 'Milestones'}
                      {' '}({contract.milestone_count ?? (milestones[contract.id] || []).length})
                      <i className={`fas fa-chevron-${expandedMs[contract.id] ? 'up' : 'down'}`} aria-hidden="true" />
                    </button>
                  </div>
                  {expandedMs[contract.id] && (
                    <div style={{ marginTop: 8, border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 10, padding: 10, background: 'var(--bg-subtle, rgba(148,163,184,0.06))' }}>
                      {msLoading[contract.id] ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
                          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Ap chaje…' : 'Loading…'}
                        </div>
                      ) : (milestones[contract.id] || []).length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
                          {lang === 'ht' ? 'Pokò gen milestone. Defini premye etap peman an anba a.' : 'No milestones yet. Define the first payment checkpoint below.'}
                        </div>
                      ) : (
                        (milestones[contract.id] || []).map((ms) => {
                          const msStatus = ms.status || 'pending';
                          const msIsFreelancer = currentUserId != null && String(contract.freelancer) === String(currentUserId);
                          const msIsClient = currentUserId != null && String(contract.client) === String(currentUserId);
                          return (
                            <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'normal' }}>{ms.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                                  {ms.amount} {contract.currency || 'USD'}
                                  {ms.due_date && <> · 📅 {new Date(ms.due_date).toLocaleDateString()}</>}
                                  {' · '}
                                  <span className={styles.badge} style={{ background: `${MS_STATUS_COLOR[msStatus] || '#64748b'}1a`, color: MS_STATUS_COLOR[msStatus] || '#64748b' }}>
                                    {MS_STATUS_LABEL[msStatus] || msStatus}
                                  </span>
                                </div>
                              </div>
                              {status === 'active' && msIsFreelancer && (msStatus === 'pending' || msStatus === 'in_progress') && (
                                <button type="button" className={styles.acceptBtn} disabled={msBusy === `submit:${ms.id}`} title={lang === 'ht' ? 'Soumèt pou revizyon' : 'Submit for review'} aria-label={lang === 'ht' ? 'Soumèt milestone lan' : 'Submit milestone'}
                                  onClick={() => handleMilestoneAction(contract.id, ms, 'submit')}>
                                  {msBusy === `submit:${ms.id}` ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-paper-plane" aria-hidden="true" />}
                                </button>
                              )}
                              {status === 'active' && msIsClient && msStatus === 'submitted' && (
                                <button type="button" className={styles.acceptBtn} disabled={msBusy === `approve:${ms.id}`} title={lang === 'ht' ? 'Apwouve milestone lan' : 'Approve milestone'} aria-label={lang === 'ht' ? 'Apwouve milestone lan' : 'Approve milestone'}
                                  onClick={() => handleMilestoneAction(contract.id, ms, 'approve')}>
                                  {msBusy === `approve:${ms.id}` ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-thumbs-up" aria-hidden="true" />}
                                </button>
                              )}
                              {status === 'active' && (msIsClient || user?.is_staff) && msStatus === 'approved' && ms.linked_transaction_status === 'succeeded' && (
                                <button type="button" className={styles.acceptBtn} disabled={msBusy === `markPaid:${ms.id}`} title={lang === 'ht' ? 'Make peye (lajan konfime)' : 'Mark paid (funds confirmed)'} aria-label={lang === 'ht' ? 'Make milestone lan peye' : 'Mark milestone paid'}
                                  onClick={() => handleMilestoneAction(contract.id, ms, 'markPaid')}>
                                  {msBusy === `markPaid:${ms.id}` ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-money-bill-wave" aria-hidden="true" />}
                                </button>
                              )}
                              {status === 'active' && msIsClient && (msStatus === 'pending' || msStatus === 'in_progress') && (
                                <button type="button" className={styles.editBtn} title={lang === 'ht' ? 'Fonde nan escrow (PayPal)' : 'Fund in escrow (PayPal)'} aria-label={lang === 'ht' ? 'Fonde milestone lan' : 'Fund milestone'}
                                  onClick={() => setFundTarget({ ...ms, contractId: contract.id })}>
                                  <i className="fas fa-vault" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                      {status === 'active' && (isClient || (currentUserId != null && String(contract.freelancer) === String(currentUserId))) && (
                        <div style={{ marginTop: 8 }}>
                          {!msFormOpen[contract.id] ? (
                            <button type="button" onClick={() => setMsFormOpen((m) => ({ ...m, [contract.id]: true }))}
                              style={{ border: '1px dashed var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', cursor: 'pointer', width: '100%' }}>
                              <i className="fas fa-plus" aria-hidden="true" /> {lang === 'ht' ? 'Ajoute yon milestone' : 'Add a milestone'}
                            </button>
                          ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                              <input value={msForm[contract.id]?.title || ''} onChange={(e) => setFormField(contract.id, 'title', e.target.value)}
                                placeholder={lang === 'ht' ? 'Tit milestone lan *' : 'Milestone title *'}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.82rem', background: 'var(--bg-default, #fff)', color: 'inherit' }} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <input type="number" min="0" step="0.01" value={msForm[contract.id]?.amount || ''} onChange={(e) => setFormField(contract.id, 'amount', e.target.value)}
                                  placeholder={lang === 'ht' ? 'Montan *' : 'Amount *'}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.82rem', background: 'var(--bg-default, #fff)', color: 'inherit' }} />
                                <input type="datetime-local" value={msForm[contract.id]?.due_date || ''} onChange={(e) => setFormField(contract.id, 'due_date', e.target.value)}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.82rem', background: 'var(--bg-default, #fff)', color: 'inherit' }} aria-label={lang === 'ht' ? 'Dat limit' : 'Due date'} />
                              </div>
                              <textarea value={msForm[contract.id]?.description || ''} onChange={(e) => setFormField(contract.id, 'description', e.target.value)}
                                placeholder={lang === 'ht' ? 'Deskripsyon (opsyonèl)' : 'Description (optional)'} rows={2}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)', fontSize: '0.82rem', background: 'var(--bg-default, #fff)', color: 'inherit', resize: 'vertical' }} />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className={styles.acceptBtn} disabled={msBusy === `create:${contract.id}`} onClick={() => handleCreateMilestone(contract)}>
                                  {msBusy === `create:${contract.id}` ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />}
                                  {' '}{lang === 'ht' ? 'Kreye' : 'Create'}
                                </button>
                                <button type="button" className={styles.deleteBtn} onClick={() => { setMsFormOpen((m) => ({ ...m, [contract.id]: false })); setMsForm((m) => ({ ...m, [contract.id]: {} })); }}>
                                  {lang === 'ht' ? 'Anile' : 'Cancel'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
      {/* Escrow funding — PayPal AUTHORIZE hold on the milestone. The
          server flips the milestone to in_progress and links the pending
          transaction; approval later releases the funds. */}
      {fundTarget && (
        <CheckoutModal
          isOpen
          type="escrow"
          meta={{ milestone_id: fundTarget.id, amount: Number(fundTarget.amount) }}
          lang={lang}
          user={user}
          showToast={showToast}
          onClose={handleFundClose}
          onSuccess={() => showToast?.(lang === 'ht' ? '✅ Escrow fande — lajan an kenbe!' : '✅ Escrow funded — amount held!', 'check-circle')}
        />
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
