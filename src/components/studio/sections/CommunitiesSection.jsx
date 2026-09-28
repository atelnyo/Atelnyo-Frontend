/**
 * src/components/studio/sections/CommunitiesSection.jsx
 *
 * Communities section — the creator's community hub in the studio:
 *   * Founded — communities this creator created (server-side
 *     ``?created_by=`` filter), each linking to its public page.
 *   * Joined — memberships surfaced client-side from the public list
 *     (``is_member`` on each row, excluding ones they founded).
 *   * Pending join requests — per founded community with
 *     ``join_mode='approval'``; approve/reject inline.
 *   * "Found a Community" opens the same gated CreateCommunityModal
 *     used in Explore: can_create is probed first so ineligible
 *     creators get the explanation toast instead of a dead form.
 *
 * Styles: src/styles/communities.css (``cm-`` prefix, token-based).
 */
import React, { useState, useCallback } from 'react';
import useFetch from '../../../hooks/useFetch';
import useSafeNavigate from '../../../hooks/useSafeNavigate';
import { communitiesService } from '../../../services/api';
import { buildContentUrl } from '../../../utils/contentUrl';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import CreateCommunityModal from '../../communities/CreateCommunityModal';
import ConfirmModal from '../../common/ConfirmModal';
import styles from './sections.module.css';

function formatWhen(value) {
  if (!value) { return ''; }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { return ''; }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CommunitiesSection({ lang, t, showToast, user }) { // eslint-disable-line react/prop-types -- the codebase defines no PropTypes anywhere (same as EventsSection)
  const navigate = useSafeNavigate();
  const isHt = lang === 'ht';
  // Same modal flow as Explore — eligibility is server-owned.
  const [showCreate, setShowCreate] = useState(false);

  // Founded: the ?created_by= filter exists exactly for the public
  // profile dashboard (see CommunityViewSet.get_queryset) — reuse it.
  const { data: founded, loading: loadingFounded, refetch: refetchFounded } = useFetch(
    // eslint-disable-next-line react/prop-types -- user comes from the router/session, untyped by convention
    () => communitiesService.list({ created_by: user?.id, limit: 50 }),
    {
      defaultValue: [],
      transform: (d) => (Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []),
    },
  );

  // Joined: the public catalog carries ``is_member`` per row for the
  // authenticated caller; intersect it with founded to avoid doubles.
  const { data: joined, loading: loadingJoined } = useFetch(
    () => communitiesService.list({ limit: 100 }),
    {
      defaultValue: [],
      transform: (d) => {
        const rows = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];
        const foundedIds = new Set((founded || []).map((c) => c.id));
        return rows.filter((c) => c.is_member && !foundedIds.has(c.id));
      },
    },
  );

  const openCommunity = useCallback((community) => {
    if (community?.slug || community?.id) {
      navigate(buildContentUrl('community', community), { state: { community } });
    }
  }, [navigate]);

  // ── Join-request moderation (approval-mode communities) ──────────
  // Founded communities' pending queues, fetched in ONE Promise.all —
  // join_requests is 403 for communities the user does not moderate,
  // so per-community failures just mean an empty queue.
  const [rejectTarget, setRejectTarget] = useState(null); // { community, membership }
  const foundedKey = founded.map((c) => c.id).join(',');
  const { data: requestQueues, loading: loadingRequests, refetch: refetchRequests } = useFetch(
    () => Promise.all(
      founded.map((c) =>
        communitiesService.joinRequests(c.slug || c.id)
          .then((r) => {
            const rows = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.results) ? r.data.results : [];
            return { community: c, requests: rows };
          })
          .catch(() => ({ community: c, requests: [] })),
      ),
    ),
    { defaultValue: [], deps: [foundedKey] },
  );

  const handleApprove = useCallback(async (community, membership) => {
    try {
      await communitiesService.approveJoinRequest(community.slug || community.id, membership.user ?? membership.id);
      showToast?.(isHt ? `✅ ${membership.username} antre nan ${community.name}.` : `✅ ${membership.username} joined ${community.name}.`, 'check-circle');
      refetchRequests(); // queue shrinks; founded refetch updates member_count
      refetchFounded();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (isHt ? 'Pa t kapab apwouve demann nan.' : 'Could not approve the request.'), 'circle-exclamation');
    }
  }, [isHt, showToast, refetchRequests, refetchFounded]);

  const handleReject = useCallback(async (community, membership) => {
    try {
      await communitiesService.rejectJoinRequest(community.slug || community.id, membership.user ?? membership.id);
      showToast?.(isHt ? 'Demann nan rejte.' : 'Request rejected.', 'check-circle');
      refetchRequests();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (isHt ? 'Pa t kapab rejte demann nan.' : 'Could not reject the request.'), 'circle-exclamation');
    }
    setRejectTarget(null);
  }, [isHt, showToast, refetchRequests]);

  // Probe can_create before showing the modal (same flow as Explore —
  // ineligible creators get the explanation toast, not a dead form).
  const handleFoundClick = useCallback(async () => {
    if (!user) {
      showToast?.(isHt ? 'Konekte pou w ka fonde yon kominote.' : 'Log in to found a community.', 'circle-exclamation');
      return;
    }
    try {
      const res = await communitiesService.canCreate();
      const data = res?.data?.data ?? res?.data ?? {};
      if (data?.can_create) {
        setShowCreate(true);
      } else {
        // eslint-disable-next-line react/prop-types -- t is a plain translations object, untyped by convention
        showToast?.(t?.community_create_gated || (isHt
          ? 'Sèlman kreyatè ki gen kontni pibliye ka fonde kominote. Pibliye yon kou, yon pwodwi, oswa yon mizik anvan.'
          : 'Only creators with published content can found a community. Publish a course, product, or music first.'), 'circle-exclamation');
      }
    } catch {
      setShowCreate(true); // server re-checks on submit
    }
  }, [user, isHt, t, showToast]);

  const handleCreated = useCallback((community) => {
    setShowCreate(false);
    // eslint-disable-next-line react/prop-types -- t is a plain translations object, untyped by convention
    showToast?.(t?.community_created || (isHt ? '✅ Kominote a kreye! Ou se fondatè li.' : '✅ Community created! You are its founder.'), 'check-circle');
    if (community?.slug || community?.id) { openCommunity(community); }
  }, [openCommunity, showToast, t, isHt]);

  const loading = loadingFounded || loadingJoined;
  if (loading) { return <StudioSkeleton rows={3} />; }

  const pendingQueues = (requestQueues || []).filter((q) => q.requests.length > 0);
  const noFounded = founded.length === 0;
  const noJoined = joined.length === 0;

  const renderCommunityCard = (c, isFounder) => (
    <div key={c.id} className="cm-card">
      <div className="cm-avatar">
        {c.avatar_url
          ? <img src={c.avatar_url} alt="" />
          : <i className="fas fa-users" aria-hidden="true" />}
      </div>
      <div className="cm-card-body">
        <div className="cm-card-name">
          <span>{c.name}</span>
          {isFounder && <span className="cm-badge">{isHt ? 'Fondatè' : 'Founder'}</span>}
        </div>
        <div className="cm-card-meta">
          {c.member_count != null && <span>👥 {c.member_count}</span>}
          {c.event_count > 0 && <span>· 📅 {c.event_count}</span>}
          {c.category && <span>· {c.category}</span>}
          {c.created_at && <span>· {formatWhen(c.created_at)}</span>}
        </div>
        {c.description && <div className="cm-card-desc">{c.description}</div>}
      </div>
      <div className="cm-card-actions">
        <button
          type="button"
          className="cm-icon-btn"
          onClick={() => openCommunity(c)}
          title={isHt ? 'Ouvri kominote a' : 'Open community'}
          aria-label={isHt ? 'Ouvri kominote a' : 'Open community'}
        >
          <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-users"
        title={isHt ? 'Kominote mwen yo' : 'My Communities'}
        lang={lang}
        help={{
          ht: 'Kominote ou fonde yo ak sa ou vin manmb. Fondatè ajoute règleman, fikse anons, epi modere manm yo depi paj kominote a.',
          en: 'Communities you founded and ones you joined. Founders add rules, pin announcements, and moderate members from the community page.',
        }}
        tip={isHt
          ? 'Fondasyon an rezève pou kreyatè ki gen kontni pibliye — yon kou, yon pwodwi, oswa yon mizik.'
          : 'Founding is reserved for creators with published content — a course, product, or music upload.'}
        action={
          <button type="button" className="btn-primary cm-found-btn" onClick={handleFoundClick}>
            <i className="fas fa-plus" aria-hidden="true" />
            {/* eslint-disable-next-line react/prop-types -- t is a plain translations object, untyped by convention */}
            {t?.community_create_cta || (isHt ? 'Fonde yon Kominote' : 'Found a Community')}
          </button>
        }
      />

      <div className="cm-section">
        {/* ── Pending join requests (approval-mode communities) ────── */}
        {loadingRequests ? (
          <StudioSkeleton rows={1} />
        ) : (
          pendingQueues.map(({ community, requests }) => (
            <div key={`req-${community.id}`}>
              <h3 className="cm-group-title">
                <i className="fas fa-user-clock" aria-hidden="true" />
                {isHt ? 'Demann antre' : 'Join requests'}
                <span className="cm-count">{requests.length}</span>
                <span className="cm-card-meta">· {community.name}</span>
              </h3>
              <div className="cm-list">
                {requests.map((m) => (
                  <div key={m.id} className="cm-card">
                    <div className="cm-avatar cm-avatar-pending">
                      <i className="fas fa-user-clock" aria-hidden="true" />
                    </div>
                    <div className="cm-card-body">
                      <div className="cm-card-name">{m.username}</div>
                      <div className="cm-card-meta">
                        {isHt ? 'Mandee antre nan' : 'Requested to join'} · {community.name}
                      </div>
                    </div>
                    <div className="cm-card-actions">
                      <button
                        type="button"
                        className="cm-icon-btn cm-icon-btn-approve"
                        onClick={() => handleApprove(community, m)}
                        title={isHt ? 'Apwouve' : 'Approve'}
                        aria-label={isHt ? 'Apwouve demann nan' : 'Approve request'}
                      >
                        <i className="fas fa-check" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cm-icon-btn cm-icon-btn-reject"
                        onClick={() => setRejectTarget({ community, membership: m })}
                        title={isHt ? 'Rejte' : 'Reject'}
                        aria-label={isHt ? 'Rejte demann nan' : 'Reject request'}
                      >
                        <i className="fas fa-xmark" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {noFounded && noJoined ? (
          <EmptyState
            icon="fa-users"
            title={isHt ? 'Poko gen kominote' : 'No communities yet'}
            hint={isHt
              ? 'Fonde premye kominote ou, oswa vin manmb nan yon sèl depi Explore.'
              : 'Found your first community, or join one from Explore.'}
            // eslint-disable-next-line react/prop-types -- t is a plain translations object, untyped by convention
            ctaLabel={t?.community_create_cta || (isHt ? 'Fonde yon Kominote' : 'Found a Community')}
            onCta={handleFoundClick}
          />
        ) : (
          <>
            {founded.length > 0 && (
              <>
                <h3 className="cm-group-title">
                  <i className="fas fa-crown" aria-hidden="true" />
                  {isHt ? 'Mwen fonde' : 'Founded by me'}
                  <span className="cm-count">{founded.length}</span>
                </h3>
                <div className="cm-list">
                  {founded.map((c) => renderCommunityCard(c, true))}
                </div>
              </>
            )}
            {joined.length > 0 && (
              <>
                <h3 className="cm-group-title">
                  <i className="fas fa-user-check" aria-hidden="true" />
                  {isHt ? 'Mwen vin manmb' : 'Joined'}
                  <span className="cm-count">{joined.length}</span>
                </h3>
                <div className="cm-list">
                  {joined.map((c) => renderCommunityCard(c, false))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateCommunityModal
          lang={lang}
          t={t}
          showToast={showToast}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {rejectTarget && (
        <ConfirmModal
          lang={lang}
          title={isHt ? 'Rejte demann antre' : 'Reject join request'}
          message={isHt
            ? `Rejte demann ${rejectTarget.membership.username} pou « ${rejectTarget.community.name} »? Li ka mande ankò pita.`
            : `Reject ${rejectTarget.membership.username}'s request to join "${rejectTarget.community.name}"? They can request again later.`}
          confirmText={isHt ? 'Rejte' : 'Reject'}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={() => handleReject(rejectTarget.community, rejectTarget.membership)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
