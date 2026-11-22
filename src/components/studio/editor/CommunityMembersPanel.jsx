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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communitiesService } from '../../../services/api';
import ConfirmModal from '../../common/ConfirmModal';
import PanelSkeleton, {
  PanelEmpty, PanelError, PanelHeader,
} from './communityPanelUI';
import styles from './communityEditor.module.css';
import { inlineText } from '../../../utils/inlineI18n';

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));
const PAGE_SIZE = 30;

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

  const [members, setMembers] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const requestIdRef = useRef(0);

  const fetchMembersPage = useCallback(async (pageToLoad, { append = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const res = await communitiesService.members(slug, { page: pageToLoad, page_size: PAGE_SIZE });
      if (requestId !== requestIdRef.current) return;
      const data = res?.data;
      const list = asArray(data);
      const count = Array.isArray(data) ? list.length : (typeof data?.count === 'number' ? data.count : null);
      const more = Array.isArray(data)
        ? false
        : (typeof data?.next === 'string' ? Boolean(data.next) : list.length === PAGE_SIZE);
      setMembers((prev) => (append ? [...prev, ...list] : list));
      setTotalCount(count);
      setPage(pageToLoad);
      setHasMore(more);
      setLoadedOnce(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (!append) setMembers([]);
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    setMembers([]);
    setTotalCount(null);
    setPage(1);
    setHasMore(false);
    setLoadedOnce(false);
    fetchMembersPage(1, { append: false });
  }, [slug, fetchMembersPage]);

  const refetchMembers = useCallback(() => {
    fetchMembersPage(1, { append: false });
  }, [fetchMembersPage]);

  const loadMoreMembers = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchMembersPage(page + 1, { append: true });
  }, [fetchMembersPage, hasMore, loading, loadingMore, page]);

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
        err?.response?.data?.detail || (isHt ? 'Aksyon an refize.' : inlineText(lang, 'Action refused.')),
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
    isHt ? 'Demann nan rejte.' : inlineText(lang, 'Request rejected.'),
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

  const initialLoading = loading && !loadedOnce;
  if (initialLoading) return <PanelSkeleton rows={4} label={isHt ? 'Ap chaje manm yo' : inlineText(lang, 'Loading members')} />;

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
              title={isHt ? 'Pwomote yon nivo' : inlineText(lang, 'Promote one rank')}
              aria-label={isHt ? `Pwomote ${m.username}` : `Promote ${m.username}`}
            >
              <i className="fas fa-arrow-up" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => demote(m)}
              disabled={Boolean(busyId) || m.role === 'member'}
              title={isHt ? 'Desann yon nivo' : inlineText(lang, 'Demote one rank')}
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
              title={m.is_muted ? (isHt ? 'Retire silans la' : inlineText(lang, 'Unmute')) : (isHt ? 'Silans 24 èdtan' : inlineText(lang, 'Mute 24h'))}
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
                title={isHt ? 'Bloke manm nan' : inlineText(lang, 'Ban member')}
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
            {m.is_muted && <span className={`${styles.pill} ${styles.pillMuted}`}>{isHt ? 'Silans' : inlineText(lang, 'Muted')}</span>}
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
        title={isHt ? 'Jesyon manm' : inlineText(lang, 'Member management')}
        count={typeof totalCount === 'number' ? totalCount : members.length}
        subtitle={isHt
          ? 'Pwomote yon nivo alafwa. Silans bloke pòs 24 èdtan; blokaj retire aksè nèt.'
          : inlineText(lang, 'Promote one rank at a time. Mute blocks posting for 24h; a ban removes access entirely.')}
        refreshing={loading && loadedOnce}
        onRefresh={refreshAll}
        refreshLabel={isHt ? 'Rafrechi manm yo' : inlineText(lang, 'Refresh members')}
      />

      {error && (
        <PanelError
          message={isHt ? 'Pat kapab chaje manm yo.' : inlineText(lang, 'Could not load the member roster.')}
          onRetry={refreshAll}
          retryLabel={isHt ? 'Reyese' : inlineText(lang, 'Retry')}
        />
      )}

      <div className={styles.searchBox}>
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isHt ? 'Chèche yon manm…' : inlineText(lang, 'Search members…')}
          aria-label={isHt ? 'Chèche yon manm' : inlineText(lang, 'Search members')}
        />
      </div>

      {visibleRequests.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>
            <i className="fas fa-user-clock" aria-hidden="true" />
            {isHt ? 'Demann antre' : inlineText(lang, 'Join requests')} ({visibleRequests.length})
          </h4>
          <div className={styles.list}>
            {visibleRequests.map((m) => (
              <div key={`req-${m.id}`} className={styles.row}>
                <div className={styles.avatar} aria-hidden="true">{initials(m.username)}</div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>@{m.username}</div>
                  <div className={styles.rowMeta}>
                    {isHt ? 'Mande antre' : inlineText(lang, 'Requested to join')}
                    {m.joined_at ? ` · ${fmtDate(m.joined_at)}` : ''}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnApprove}`}
                    onClick={() => approve(m)}
                    disabled={Boolean(busyId)}
                    title={isHt ? 'Apwouve' : inlineText(lang, 'Approve')}
                    aria-label={isHt ? `Apwouve ${m.username}` : `Approve ${m.username}`}
                  >
                    <i className="fas fa-check" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => reject(m)}
                    disabled={Boolean(busyId)}
                    title={isHt ? 'Rejte' : inlineText(lang, 'Reject')}
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
            {isHt ? 'Ekip la' : inlineText(lang, 'Staff')}
          </h4>
          <div className={styles.list}>{staff.map(renderMemberRow)}</div>
        </>
      )}

      <h4 className={styles.sectionTitle}>
        <i className="fas fa-user" aria-hidden="true" />
        {isHt ? 'Manm' : inlineText(lang, 'Members')} ({plainMembers.length})
      </h4>
      {plainMembers.length === 0 ? (
        <>
          <PanelEmpty
            icon={needle ? 'fa-magnifying-glass' : 'fa-user-group'}
            title={needle
              ? (isHt ? 'Pa gen manm ki koresponn.' : inlineText(lang, 'No members match your search.'))
              : (isHt ? 'Poko gen manm òdinè.' : inlineText(lang, 'No regular members yet.'))}
            description={needle
              ? undefined
              : (isHt ? 'Pataje lyen envitasyon an pou fè moun rantre.' : inlineText(lang, 'Share the invite link to bring people in.'))}
          />
          {!needle && hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={loadMoreMembers}
                disabled={loadingMore}
              >
                {loadingMore
                  ? (isHt ? 'Ap chaje…' : inlineText(lang, 'Loading…'))
                  : (isHt ? 'Chaje plis manm' : inlineText(lang, 'Load more members'))}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.list}>{plainMembers.map(renderMemberRow)}</div>
          {!needle && hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={loadMoreMembers}
                disabled={loadingMore}
              >
                {loadingMore
                  ? (isHt ? 'Ap chaje…' : inlineText(lang, 'Loading…'))
                  : (isHt ? 'Chaje plis manm' : inlineText(lang, 'Load more members'))}
              </button>
            </div>
          )}
        </>
      )}

      {isOwner && visibleBanned.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>
            <i className="fas fa-ban" aria-hidden="true" />
            {isHt ? 'Manm bloke' : inlineText(lang, 'Banned')} ({visibleBanned.length})
          </h4>
          <div className={styles.list}>
            {visibleBanned.map((m) => (
              <div key={`banned-${m.id}`} className={styles.row}>
                <div className={styles.avatar} aria-hidden="true">{initials(m.username)}</div>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>
                    @{m.username}
                    <span className={`${styles.pill} ${styles.pillMuted}`}>{isHt ? 'Bloke' : inlineText(lang, 'Banned')}</span>
                  </div>
                  <div className={styles.rowMeta}>
                    {m.banned_by_username
                      ? (isHt ? `Pa @${m.banned_by_username}` : `By @${m.banned_by_username}`)
                      : (isHt ? 'Blokaj' : inlineText(lang, 'Banned'))}
                    {m.ban_reason ? ` · ${m.ban_reason}` : ''}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => unban(m)}
                    disabled={Boolean(busyId)}
                    title={isHt ? 'Debloke' : inlineText(lang, 'Unban')}
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
            : inlineText(lang, 'The member loses access immediately. You can unban them later from the banned list.')}
          confirmText={isHt ? 'Bloke' : inlineText(lang, 'Ban')}
          cancelText={isHt ? 'Anile' : inlineText(lang, 'Cancel')}
          onConfirm={confirmBan}
          onCancel={() => setBanTarget(null)}
        />
      )}
    </div>
  );
}
