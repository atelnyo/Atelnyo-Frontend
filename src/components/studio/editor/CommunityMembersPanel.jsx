/**
 * src/components/studio/editor/CommunityMembersPanel.jsx
 *
 * "Manm" tab of the founder workspace. Surfaces the founder's member
 * roster and the moderation actions the backend already exposes:
 *
 *   * Pending join requests (approval-mode communities) → approve/reject
 *   * Staff roster (owner/admin/moderator) and plain members
 *   * Promote one rank (member→moderator→admin), demote one rank — owner only
 *   * Mute 24h / unmute (manager)
 *   * Ban (manager) and unban from the banned list — owner/admin only
 *
 * The server re-checks every hierarchy gate (ROLE_RANK in the viewset),
 * so the client-side gating here is progressive disclosure, not security.
 */
import React, { useCallback, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communitiesService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  PanelEmpty, PanelError, PanelHeader, useInitialLoading,
} from './communityPanelUI';
import styles from './communityEditor.module.css';

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));

const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const initials = (name) => (name || '?').trim().slice(0, 2).toUpperCase();

const ROLE_LABELS = {
  owner: { ht: 'Fondatè', en: 'Founder' },
  admin: { ht: 'Admin', en: 'Admin' },
  moderator: { ht: 'Moderatè', en: 'Moderator' },
  member: { ht: 'Manm', en: 'Member' },
};

export default function CommunityMembersPanel({
  slug,
  lang = 'en',
  showToast,
  isOwner = false,
  canModerate = false,
  currentUserId = null,
}) {
  const isHt = lang === 'ht';
  const [busyId, setBusyId] = useState(null);
  const [banTarget, setBanTarget] = useState(null);
  const [query, setQuery] = useState('');

  const {
    data: members, loading, error, refetch: refetchMembers,
  } = useFetch(
    () => communitiesService.members(slug),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const { data: requests, refetch: refetchRequests } = useFetch(
    () => communitiesService.joinRequests(slug).catch(() => ({ data: [] })),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const { data: banned, refetch: refetchBanned } = useFetch(
    () => (isOwner ? communitiesService.bannedMembers(slug).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })),
    { defaultValue: [], transform: asArray, deps: [slug, isOwner] },
  );

  const act = useCallback(async (membershipId, fn, successMessage) => {
    if (busyId) return;
    setBusyId(membershipId);
    try {
      await fn();
      showToast?.(successMessage, 'shield-halved');
      refetchMembers();
      refetchRequests();
      refetchBanned();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Aksyon an refize.' : 'Action refused.'),
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  }, [busyId, showToast, isHt, refetchMembers, refetchRequests, refetchBanned]);

  const approve = (m) => act(
    m.user_id ?? m.user ?? m.id,
    () => communitiesService.approveJoinRequest(slug, m.user_id ?? m.user ?? m.id),
    isHt ? `✅ ${m.username} antre nan kominote a.` : `✅ ${m.username} joined the community.`,
  );

  const reject = (m) => act(
    m.user_id ?? m.user ?? m.id,
    () => communitiesService.rejectJoinRequest(slug, m.user_id ?? m.user ?? m.id),
    isHt ? 'Demann nan rejte.' : 'Request rejected.',
  );

  const promote = (m) => {
    const next = m.role === 'member' ? 'moderator' : 'admin';
    return act(
      m.id,
      () => communitiesService.promote(slug, m.id, next),
      isHt ? `@${m.username} kounye a ${ROLE_LABELS[next]?.ht || next}.` : `@${m.username} is now ${ROLE_LABELS[next]?.en || next}.`,
    );
  };

  const demote = (m) => act(
    m.id,
    () => communitiesService.demote(slug, m.id),
    isHt ? `@${m.username} desann yon nivo.` : `@${m.username} demoted one rank.`,
  );

  const toggleMute = (m) => (m.is_muted
    ? act(m.id, () => communitiesService.unmute(slug, m.id), isHt ? `@${m.username} ka pale ankò.` : `@${m.username} unmuted.`)
    : act(m.id, () => communitiesService.mute(slug, m.id, 24), isHt ? `@${m.username} mute 24 èdtan.` : `@${m.username} muted for 24h.`));

  const confirmBan = () => {
    const m = banTarget;
    setBanTarget(null);
    if (!m) return;
    act(
      m.id,
      () => communitiesService.banMember(slug, m.id, ''),
      isHt ? `@${m.username} bloke.` : `@${m.username} banned.`,
    );
  };

  const unban = (m) => act(
    m.id,
    () => communitiesService.unbanMember(slug, m.id),
    isHt ? `@${m.username} debloke.` : `@${m.username} unbanned.`,
  );

  const initialLoading = useInitialLoading(loading);
  if (initialLoading) return <PanelSkeleton rows={4} label={isHt ? 'Ap chaje manm yo' : 'Loading members'} />;

  const needle = query.trim().toLowerCase();
  const matches = (m) => !needle || (m.username || '').toLowerCase().includes(needle);
  const staff = members.filter((m) => m.role !== 'member' && matches(m));
  const plainMembers = members.filter((m) => m.role === 'member' && matches(m));
  const visibleRequests = requests.filter(matches);
  const visibleBanned = banned.filter(matches);
  const isSelf = (m) => currentUserId != null && (m.user === currentUserId || m.user_id === currentUserId);
  const refreshAll = () => {
    refetchMembers();
    refetchRequests();
    refetchBanned();
  };

  const renderActions = (m) => {
    // The owner row is never actionable — ownership transfer is a
    // separate, explicit flow (the API refuses it here too).
    if (m.role === 'owner') return null;
    return (
      <div className={styles.actions}>
        {isOwner && (
          <>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => promote(m)}
              disabled={Boolean(busyId) || m.role === 'admin'}
              title={isHt ? 'Pwomote yon nivo' : 'Promote one rank'}
              aria-label={isHt ? `Pwomote ${m.username}` : `Promote ${m.username}`}
            >
              <i className="fas fa-arrow-up" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => demote(m)}
              disabled={Boolean(busyId) || m.role === 'member'}
              title={isHt ? 'Desann yon nivo' : 'Demote one rank'}
              aria-label={isHt ? `Desann ${m.username}` : `Demote ${m.username}`}
            >
              <i className="fas fa-arrow-down" aria-hidden="true" />
            </button>
          </>
        )}
        {canModerate && (
          <>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => toggleMute(m)}
              disabled={Boolean(busyId)}
              title={m.is_muted ? (isHt ? 'Retire silans la' : 'Unmute') : (isHt ? 'Silans 24 èdtan' : 'Mute 24h')}
              aria-label={m.is_muted ? (isHt ? `Retire silans ${m.username}` : `Unmute ${m.username}`) : (isHt ? `Silans ${m.username}` : `Mute ${m.username}`)}
            >
              <i className={`fas ${m.is_muted ? 'fa-microphone' : 'fa-microphone-slash'}`} aria-hidden="true" />
            </button>
            {!isSelf(m) && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                onClick={() => setBanTarget(m)}
                disabled={Boolean(busyId)}
                title={isHt ? 'Bloke manm nan' : 'Ban member'}
                aria-label={isHt ? `Bloke ${m.username}` : `Ban ${m.username}`}
              >
                <i className="fas fa-ban" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderMemberRow = (m) => {
    const role = ROLE_LABELS[m.role] || ROLE_LABELS.member;
    return (
      <div key={m.id} className={styles.row}>
        <div className={styles.avatar} aria-hidden="true">
          {m.avatar ? <img src={m.avatar} alt="" /> : initials(m.username)}
        </div>
        <div className={styles.rowBody}>
          <div className={styles.rowName}>
            @{m.username}
            <span className={`${styles.pill} ${m.role === 'owner' ? styles.pillOwner : styles.pillStaff}`}>
              {isHt ? role.ht : role.en}
            </span>
            {m.is_muted && <span className={`${styles.pill} ${styles.pillMuted}`}>{isHt ? 'Silans' : 'Muted'}</span>}
          </div>
          <div className={styles.rowMeta}>
            {m.joined_at ? (isHt ? `Manm depi ${fmtDate(m.joined_at)}` : `Member since ${fmtDate(m.joined_at)}`) : ''}
          </div>
        </div>
        {renderActions(m)}
      </div>
    );
  };

  return (
    <div>
      <PanelHeader
        icon="fa-users-gear"
        title={isHt ? 'Jesyon manm' : 'Member management'}
        count={members.length}
        subtitle={isHt
          ? 'Pwomote yon nivo alafwa. Silans bloke pòs 24 èdtan; blokaj retire aksè nèt.'
          : 'Promote one rank at a time. Mute blocks posting for 24h; a ban removes access entirely.'}
        refreshing={loading}
        onRefresh={refreshAll}
        refreshLabel={isHt ? 'Rafrechi manm yo' : 'Refresh members'}
      />

      {error && (
        <PanelError
          message={isHt ? 'Pat kapab chaje manm yo.' : 'Could not load the member roster.'}
          onRetry={refreshAll}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}

      <div className={styles.searchBox}>
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isHt ? 'Chèche yon manm…' : 'Search members…'}
          aria-label={isHt ? 'Chèche yon manm' : 'Search members'}
        />
      </div>

      {visibleRequests.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>
            <i className="fas fa-user-clock" aria-hidden="true" />
            {isHt ? 'Demann antre' : 'Join requests'} ({visibleRequests.length})
          </h4>
          <div className={styles.list}>
            {visibleRequests.map((m) => (
              <div key={`req-${m.id}`} className={styles.row}>
                <div className={styles.avatar} aria-hidden="true">{initials(m.username)}</div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>@{m.username}</div>
                  <div className={styles.rowMeta}>
                    {isHt ? 'Mande antre' : 'Requested to join'}
                    {m.joined_at ? ` · ${fmtDate(m.joined_at)}` : ''}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnApprove}`}
                    onClick={() => approve(m)}
                    disabled={Boolean(busyId)}
                    title={isHt ? 'Apwouve' : 'Approve'}
                    aria-label={isHt ? `Apwouve ${m.username}` : `Approve ${m.username}`}
                  >
                    <i className="fas fa-check" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => reject(m)}
                    disabled={Boolean(busyId)}
                    title={isHt ? 'Rejte' : 'Reject'}
                    aria-label={isHt ? `Rejte ${m.username}` : `Reject ${m.username}`}
                  >
                    <i className="fas fa-xmark" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {staff.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>
            <i className="fas fa-shield-halved" aria-hidden="true" />
            {isHt ? 'Ekip la' : 'Staff'}
          </h4>
          <div className={styles.list}>{staff.map(renderMemberRow)}</div>
        </>
      )}

      <h4 className={styles.sectionTitle}>
        <i className="fas fa-user" aria-hidden="true" />
        {isHt ? 'Manm' : 'Members'} ({plainMembers.length})
      </h4>
      {plainMembers.length === 0 ? (
        <PanelEmpty
          icon={needle ? 'fa-magnifying-glass' : 'fa-user-group'}
          title={needle
            ? (isHt ? 'Pa gen manm ki koresponn.' : 'No members match your search.')
            : (isHt ? 'Poko gen manm òdinè.' : 'No regular members yet.')}
          description={needle
            ? undefined
            : (isHt ? 'Pataje lyen envitasyon an pou fè moun rantre.' : 'Share the invite link to bring people in.')}
        />
      ) : (
        <div className={styles.list}>{plainMembers.map(renderMemberRow)}</div>
      )}

      {isOwner && visibleBanned.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>
            <i className="fas fa-ban" aria-hidden="true" />
            {isHt ? 'Manm bloke' : 'Banned'} ({visibleBanned.length})
          </h4>
          <div className={styles.list}>
            {visibleBanned.map((m) => (
              <div key={`banned-${m.id}`} className={styles.row}>
                <div className={styles.avatar} aria-hidden="true">{initials(m.username)}</div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>
                    @{m.username}
                    <span className={`${styles.pill} ${styles.pillMuted}`}>{isHt ? 'Bloke' : 'Banned'}</span>
                  </div>
                  <div className={styles.rowMeta}>
                    {m.banned_by_username
                      ? (isHt ? `Pa @${m.banned_by_username}` : `By @${m.banned_by_username}`)
                      : (isHt ? 'Blokaj' : 'Banned')}
                    {m.ban_reason ? ` · ${m.ban_reason}` : ''}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => unban(m)}
                    disabled={Boolean(busyId)}
                    title={isHt ? 'Debloke' : 'Unban'}
                    aria-label={isHt ? `Debloke ${m.username}` : `Unban ${m.username}`}
                  >
                    <i className="fas fa-rotate-left" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {banTarget && (
        <ConfirmModal
          lang={lang}
          title={isHt ? `Bloke @${banTarget.username}?` : `Ban @${banTarget.username}?`}
          message={isHt
            ? 'Manm nan pèdi aksè imedyatman. Ou ka debloke l pita nan lis manm bloke yo.'
            : 'The member loses access immediately. You can unban them later from the banned list.'}
          confirmText={isHt ? 'Bloke' : 'Ban'}
          cancelText={isHt ? 'Anile' : 'Cancel'}
          onConfirm={confirmBan}
          onCancel={() => setBanTarget(null)}
        />
      )}
    </div>
  );
}
