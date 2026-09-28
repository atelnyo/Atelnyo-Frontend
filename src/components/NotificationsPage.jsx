/**
 * src/components/NotificationsPage.jsx
 *
 * Phase 58 — Full-screen notification center.
 * Mounted at /sheet/notifications.
 *
 * Renders the shared <ActivityTimeline> (single source of truth for the
 * event list) with the mark-all-read toolbar enabled, plus inline
 * accept/reject actions for job proposals. Also receives the app-level
 * `refreshToken` so a real-time notification that arrives while the
 * page is open re-fetches the list instantly (same contract as the
 * header-bell dropdown).
 */
import React, { useEffect, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { activityFeedService, proposalService } from '../services/api';
import { SHEETS } from '../routes/sheets';
import ActivityTimeline from './ActivityTimeline';
import ConfirmModal from './common/ConfirmModal';
import { historyBack, requireLogin } from '../utils/history';

export default function NotificationsPage({
  lang = 'ht',
  user,
  t = {},
  refreshToken,
  onMarkRead,
  onMarkAllRead,
}) {
  const navigate = useSafeNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const showToast = useCallback((message, icon = 'info-circle') => {
    setToast({ id: Date.now(), message, icon });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!user) {
      requireLogin(navigate, location, SHEETS.LOGIN);
    }
  }, [user, navigate, location]);

  // history.state.idx based — history.length is unreliable on fresh tabs
  // (a direct deep-link already has length 2, which would navigate to
  // about:blank instead of falling back to '/').
  const handleBack = () => historyBack(navigate);

  const handleAcceptProposal = useCallback((event) => {
    const proposalId = event?.data?.proposal_id;
    if (!proposalId) return;
    setConfirm({
      title: lang === 'ht' ? 'Aksepte proposal' : 'Accept proposal',
      message: event?.data?.job_title
        ? (lang === 'ht' ? `Aksepte proposal sa a pou "${event.data.job_title}"?` : `Accept this proposal for "${event.data.job_title}"?`)
        : (lang === 'ht' ? 'Aksepte proposal sa a?' : 'Accept this proposal?'),
      onConfirm: async () => {
        try {
          await proposalService.accept(proposalId, {});
          showToast(
            lang === 'ht' ? '✅ Proposal aksepte!' : '✅ Proposal accepted!',
            'check-circle',
          );
        } catch (err) {
          showToast(
            err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab aksepte.' : 'Could not accept.'),
            'circle-exclamation',
          );
        }
        setConfirm(null);
      },
    });
  }, [lang, showToast]);

  const handleRejectProposal = useCallback((event) => {
    const proposalId = event?.data?.proposal_id;
    if (!proposalId) return;
    setConfirm({
      title: lang === 'ht' ? 'Rejte proposal' : 'Reject proposal',
      message: event?.data?.job_title
        ? (lang === 'ht' ? `Rejte proposal sa a pou "${event.data.job_title}"?` : `Reject this proposal for "${event.data.job_title}"?`)
        : (lang === 'ht' ? 'Rejte proposal sa a?' : 'Reject this proposal?'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await proposalService.reject(proposalId, '');
          showToast(
            lang === 'ht' ? 'Proposal rejte.' : 'Proposal rejected.',
            'ban',
          );
        } catch (err) {
          showToast(
            err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab rejte.' : 'Could not reject.'),
            'circle-exclamation',
          );
        }
        setConfirm(null);
      },
    });
  }, [lang, showToast]);

  // ─── Phase 59 — profile invitations (hire / collab / book) ────────
  // Same decision pattern as proposals, but accepting opens the
  // auto-created DM thread with the requester.
  const handleAcceptRequest = useCallback((event) => {
    if (!event?.id) return;
    setConfirm({
      title: lang === 'ht' ? 'Aksepte demann' : 'Accept request',
      message: event?.data?.title || event?.data?.project_title || event?.data?.idea || event?.data?.service_name
        ? (lang === 'ht' ? `Aksepte demann sa a pou "${event.data.title || event.data.project_title || event.data.idea || event.data.service_name}"? Konvèsasyon y ap louvri pou diskite detay yo.` : `Accept this request for "${event.data.title || event.data.project_title || event.data.idea || event.data.service_name}"? A conversation will open to discuss details.`)
        : (lang === 'ht' ? 'Aksepte demann sa a? Konvèsasyon y ap louvri.' : 'Accept this request? A conversation will open.'),
      onConfirm: async () => {
        try {
          await activityFeedService.respond(event.id, 'accept');
          showToast(
            lang === 'ht' ? '✅ Demann aksepte! Konvèsasyon louvri.' : '✅ Request accepted! Conversation opened.',
            'check-circle',
          );
          // Land in the new thread (top of the inbox list).
          navigate('/sheet/messages');
        } catch (err) {
          showToast(
            err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab aksepte.' : 'Could not accept.'),
            'circle-exclamation',
          );
        }
        setConfirm(null);
      },
    });
  }, [lang, showToast, navigate]);

  const handleRejectRequest = useCallback((event) => {
    if (!event?.id) return;
    setConfirm({
      title: lang === 'ht' ? 'Rejte demann' : 'Reject request',
      message: event?.data?.title || event?.data?.project_title || event?.data?.idea || event?.data?.service_name
        ? (lang === 'ht' ? `Rejte demann sa a pou "${event.data.title || event.data.project_title || event.data.idea || event.data.service_name}"?` : `Reject this request for "${event.data.title || event.data.project_title || event.data.idea || event.data.service_name}"?`)
        : (lang === 'ht' ? 'Rejte demann sa a?' : 'Reject this request?'),
      variant: 'danger',
      onConfirm: async () => {
        try {
          await activityFeedService.respond(event.id, 'reject');
          showToast(
            lang === 'ht' ? 'Demann rejte.' : 'Request rejected.',
            'ban',
          );
        } catch (err) {
          showToast(
            err?.response?.data?.detail || (lang === 'ht' ? 'Pa t kapab rejte.' : 'Could not reject.'),
            'circle-exclamation',
          );
        }
        setConfirm(null);
      },
    });
  }, [lang, showToast]);

  return (
    <div className="notifications-page">
      {toast && (
        <div className="notif-toast" role="alert" style={{
          position: 'fixed', top: 16, right: 16, zIndex: 10001,
          background: 'var(--bg-card, #fff)', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '0.9rem', animation: 'slideInRight 0.3s ease',
        }}>
          <i className={`fas fa-${toast.icon}`} style={{ color: 'var(--pink-primary, #d81b60)' }} aria-hidden="true" />
          <span>{toast.message}</span>
        </div>
      )}
      <div className="notifications-page__header">
        <button
          type="button"
          className="notifications-page__back"
          onClick={handleBack}
          aria-label={lang === 'ht' ? 'Retounen' : 'Back'}
        >
          <i className="fas fa-arrow-left" />
        </button>
        <h1 className="notifications-page__title">
          {lang === 'ht' ? 'Notifikasyon' : 'Notifications'}
        </h1>
        <div className="notifications-page__spacer" />
      </div>
      <div className="notifications-page__body">
        <ActivityTimeline
          lang={lang}
          userId={user?.id}
          t={t}
          refreshToken={refreshToken}
          showMarkAllRead
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onNavigate={navigate}
          onAcceptProposal={handleAcceptProposal}
          onRejectProposal={handleRejectProposal}
          onAcceptRequest={handleAcceptRequest}
          onRejectRequest={handleRejectRequest}
        />
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          lang={lang}
          variant={confirm.variant || 'info'}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
