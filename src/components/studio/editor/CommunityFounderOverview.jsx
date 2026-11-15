/**
 * src/components/studio/editor/CommunityFounderOverview.jsx
 *
 * "Apèsi" tab of the founder workspace — a read-only dashboard over the
 * community: size, recent growth, pending join requests, announcements
 * volume, posts and events, plus the founder identity card (who founded
 * the community, when, and the viewer's own role).
 *
 * Everything shown comes from endpoints the founder can already read:
 *   * communities/<slug>/members/          (active members)
 *   * communities/<slug>/join_requests/    (approval-mode queues)
 *   * community-announcements/?community=  (paginated count + rows)
 *   * community-posts/?community=          (paginated count)
 * The community row itself carries member_count / event_count.
 */
import React, { useMemo } from 'react';
import useFetch from '../../../hooks/useFetch';
import { communitiesService } from '../../../services/api';
import { StatCard } from '../shared';
import PanelSkeleton, { PanelError, useInitialLoading } from './communityPanelUI';
import styles from './communityEditor.module.css';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const asArray = (data) => (Array.isArray(data) ? data : (data?.results || []));
const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function CommunityFounderOverview({ community, slug, lang = 'en', onOpenTab }) {
  const isHt = lang === 'ht';

  const {
    data: members, loading: loadingMembers, error: membersError, refetch: refetchMembers,
  } = useFetch(
    () => communitiesService.members(slug),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const {
    data: requests, loading: loadingRequests, refetch: refetchRequests,
  } = useFetch(
    () => communitiesService.joinRequests(slug).catch(() => ({ data: [] })),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const {
    data: announcements, loading: loadingAnnouncements, refetch: refetchAnnouncements,
  } = useFetch(
    () => communitiesService.announcements(slug),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const {
    data: postCount, loading: loadingPosts, refetch: refetchPosts,
  } = useFetch(
    () => communitiesService.posts(slug, { page_size: 1 }),
    {
      defaultValue: 0,
      transform: (data) => (typeof data?.count === 'number' ? data.count : asArray(data).length),
      deps: [slug],
    },
  );

  const loading = loadingMembers || loadingRequests || loadingAnnouncements || loadingPosts;
  const initialLoading = useInitialLoading(loading);
  const retry = () => {
    refetchMembers();
    refetchRequests();
    refetchAnnouncements();
    refetchPosts();
  };

  const newMembers = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return (members || []).filter((m) => {
      const joined = m?.joined_at ? new Date(m.joined_at).getTime() : NaN;
      return Number.isFinite(joined) && joined >= cutoff;
    }).length;
  }, [members]);

  const founderName = community?.created_by_username || '';
  const role = community?.current_user_role || 'owner';
  const roleLabel = isHt
    ? { owner: 'Fondatè', admin: 'Admin', moderator: 'Moderatè', member: 'Manm' }[role] || role
    : { owner: 'Founder', admin: 'Admin', moderator: 'Moderator', member: 'Member' }[role] || role;

  if (initialLoading) return <PanelSkeleton variant="overview" label={isHt ? 'Ap chaje apèsi a' : 'Loading overview'} />;

  return (
    <div>
      {membersError && (
        <PanelError
          message={isHt ? 'Pat chaje manm yo. Tcheke koneksyon w epi eseye ankò.' : 'Could not load members. Check your connection and try again.'}
          onRetry={retry}
          retryLabel={isHt ? 'Reyese' : 'Retry'}
        />
      )}
      {/* ── Founder identity ─────────────────────────────────── */}
      <div className={styles.founderCard}>
        <div className={styles.founderAvatar} aria-hidden="true">
          <i className="fas fa-crown" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.founderName}>
            {founderName ? `@${founderName}` : (isHt ? 'Fondatè a' : 'The founder')}
            <span className={styles.pill + ' ' + styles.pillOwner} style={{ marginLeft: 8 }}>{roleLabel}</span>
          </div>
          <div className={styles.founderMeta}>
            {community?.created_at
              ? (isHt ? `Kominote a fonde ${fmtDate(community.created_at)}` : `Founded ${fmtDate(community.created_at)}`)
              : (isHt ? 'Dat fondasyon an pa disponib' : 'Founding date unavailable')}
            {community?.category ? ` · ${community.category}` : ''}
          </div>
        </div>
      </div>

      {/* ── Numbers ──────────────────────────────────────────── */}
      <div className={styles.statGrid}>
        <StatCard icon="fa-users" label={isHt ? 'Manm' : 'Members'} value={members.length} accent="primary" />
        <StatCard
          icon="fa-user-plus"
          label={isHt ? 'Nouvo (30 jou)' : 'New (30 days)'}
          value={newMembers}
          subtitle={isHt ? 'Antre nan dènye mwa a' : 'Joined this month'}
        />
        <StatCard
          icon="fa-user-clock"
          label={isHt ? 'Demann annatant' : 'Pending requests'}
          value={requests.length}
          accent={requests.length > 0 ? 'warning' : 'default'}
          onClick={requests.length > 0 ? () => onOpenTab?.('members') : undefined}
        />
        <StatCard
          icon="fa-bullhorn"
          label={isHt ? 'Anons' : 'Announcements'}
          value={announcements.length}
          onClick={() => onOpenTab?.('announcements')}
        />
        <StatCard icon="fa-comments" label={isHt ? 'Pòs' : 'Posts'} value={postCount} />
        <StatCard icon="fa-calendar-days" label={isHt ? 'Evènman' : 'Events'} value={community?.event_count ?? 0} />
      </div>

      {/* ── Shortcut ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className={styles.primaryBtn} onClick={() => onOpenTab?.('members')}>
          <i className="fas fa-users-gear" aria-hidden="true" />
          {isHt ? 'Jere manm yo' : 'Manage members'}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('announcements')}>
          <i className="fas fa-bullhorn" aria-hidden="true" />
          {isHt ? 'Ekri yon anons' : 'Write an announcement'}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('events')}>
          <i className="fas fa-calendar-plus" aria-hidden="true" />
          {isHt ? 'Planifye yon evènman' : 'Plan an event'}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('resources')}>
          <i className="fas fa-folder-plus" aria-hidden="true" />
          {isHt ? 'Pataje resous' : 'Share resources'}
        </button>
      </div>
    </div>
  );
}
