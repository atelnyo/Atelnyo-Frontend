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
import { inlineText } from '../../../utils/inlineI18n';

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
    data: membersPage, loading: loadingMembers, error: membersError, refetch: refetchMembers,
  } = useFetch(
    () => communitiesService.members(slug, { page: 1, page_size: 50 }),
    { defaultValue: { count: 0, results: [] }, deps: [slug] },
  );
  const {
    data: requests, loading: loadingRequests, refetch: refetchRequests,
  } = useFetch(
    () => communitiesService.joinRequests(slug).catch(() => ({ data: [] })),
    { defaultValue: [], transform: asArray, deps: [slug] },
  );
  const {
    data: announcementsPage, loading: loadingAnnouncements, refetch: refetchAnnouncements,
  } = useFetch(
    () => communitiesService.announcements(slug, { page: 1, page_size: 1 }),
    { defaultValue: { count: 0, results: [] }, deps: [slug] },
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

  const memberRows = asArray(membersPage?.results ?? membersPage);
  const memberCount = typeof membersPage?.count === 'number' ? membersPage.count : memberRows.length;
  const announcementCount = typeof announcementsPage?.count === 'number'
    ? announcementsPage.count
    : asArray(announcementsPage?.results ?? announcementsPage).length;

  const newMembers = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return memberRows.filter((m) => {
      const joined = m?.joined_at ? new Date(m.joined_at).getTime() : NaN;
      return Number.isFinite(joined) && joined >= cutoff;
    }).length;
  }, [memberRows]);

  const founderName = community?.created_by_username || '';
  const role = community?.current_user_role || 'owner';
  const roleLabel = isHt
    ? { owner: 'Fondatè', admin: 'Admin', moderator: 'Moderatè', member: 'Manm' }[role] || role
    : { owner: 'Founder', admin: 'Admin', moderator: 'Moderator', member: 'Member' }[role] || role;

  if (initialLoading) return <PanelSkeleton variant="overview" label={isHt ? 'Ap chaje apèsi a' : inlineText(lang, 'Loading overview')} />;

  return (
    <div>
      {membersError && (
        <PanelError
          message={isHt ? 'Pat chaje manm yo. Tcheke koneksyon w epi eseye ankò.' : inlineText(lang, 'Could not load members. Check your connection and try again.')}
          onRetry={retry}
          retryLabel={isHt ? 'Reyese' : inlineText(lang, 'Retry')}
        />
      )}
      {/* ── Founder identity ─────────────────────────────────── */}
      <div className={styles.founderCard}>
        <div className={styles.founderAvatar} aria-hidden="true">
          <i className="fas fa-crown" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.founderName}>
            {founderName ? `@${founderName}` : (isHt ? 'Fondatè a' : inlineText(lang, 'The founder'))}
            <span className={styles.pill + ' ' + styles.pillOwner} style={{ marginLeft: 8 }}>{roleLabel}</span>
          </div>
          <div className={styles.founderMeta}>
            {community?.created_at
              ? (isHt ? `Kominote a fonde ${fmtDate(community.created_at)}` : `Founded ${fmtDate(community.created_at)}`)
              : (isHt ? 'Dat fondasyon an pa disponib' : inlineText(lang, 'Founding date unavailable'))}
            {community?.category ? ` · ${community.category}` : ''}
          </div>
        </div>
      </div>

      {/* ── Numbers ──────────────────────────────────────────── */}
      <div className={styles.statGrid}>
        <StatCard icon="fa-users" label={isHt ? 'Manm' : inlineText(lang, 'Members')} value={memberCount} accent="primary" onClick={() => onOpenTab?.('members')} />
        <StatCard
          icon="fa-user-plus"
          label={isHt ? 'Nouvo (30 jou)' : inlineText(lang, 'New (30 days)')}
          value={newMembers}
          subtitle={isHt ? 'Sou 50 dènye manm chaje yo' : inlineText(lang, 'From the latest 50 loaded members')}
        />
        <StatCard
          icon="fa-user-clock"
          label={isHt ? 'Demann annatant' : inlineText(lang, 'Pending requests')}
          value={requests.length}
          accent={requests.length > 0 ? 'warning' : 'default'}
          onClick={() => onOpenTab?.('members')}
        />
        <StatCard
          icon="fa-bullhorn"
          label={isHt ? 'Anons' : inlineText(lang, 'Announcements')}
          value={announcementCount}
          onClick={() => onOpenTab?.('announcements')}
        />
        <StatCard icon="fa-comments" label={isHt ? 'Pòs' : inlineText(lang, 'Posts')} value={postCount} onClick={() => onOpenTab?.('posts')} />
        <StatCard icon="fa-calendar-days" label={isHt ? 'Evènman' : inlineText(lang, 'Events')} value={community?.event_count ?? 0} onClick={() => onOpenTab?.('events')} />
      </div>

      {/* ── Status & checklist ───────────────────────────────── */}
      {(() => {
        const staffCount = memberRows.filter((m) => ['owner', 'admin', 'moderator'].includes(m.role)).length;
        const mutedCount = memberRows.filter((m) => m.is_muted).length;
        return (
          <div className={styles.founderCard} style={{ marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.rowName}>
                <span className={`${styles.pill} ${styles.pillStaff}`}>{community?.join_mode || 'public'}</span>
                <span className={`${styles.pill} ${community?.is_active === false ? styles.pillMuted : styles.pillOwner}`}>
                  {community?.is_active === false ? (isHt ? 'Achive' : inlineText(lang, 'Archived')) : (isHt ? 'Aktif' : inlineText(lang, 'Active'))}
                </span>
                {requests.length > 0 && (
                  <span className={`${styles.pill} ${styles.pillOwner}`}>
                    {requests.length} {isHt ? 'demand annatant' : inlineText(lang, 'pending')}
                  </span>
                )}
              </div>
              <div className={styles.founderMeta}>
                {isHt
                  ? `Ekip: ${staffCount} · Silans: ${mutedCount} · Estati ak aksè nan Paramèt.`
                  : `Staff: ${staffCount} · Muted: ${mutedCount} · Status and access in Settings.`}
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const checklist = [
          {
            done: Boolean(community?.description),
            label: isHt ? 'Ajoute yon deskripsyon kominote a' : inlineText(lang, 'Add a community description'),
            tab: 'profile',
          },
          {
            done: (community?.rules?.length || 0) > 0,
            label: isHt ? 'Defini règleman kominote a' : inlineText(lang, 'Set community rules'),
            tab: 'settings',
          },
          {
            done: announcementCount > 0,
            label: isHt ? 'Pibliye yon premye anons' : inlineText(lang, 'Publish a first announcement'),
            tab: 'announcements',
          },
          {
            done: (community?.event_count ?? 0) > 0,
            label: isHt ? 'Planifye premye evènman an' : inlineText(lang, 'Plan your first event'),
            tab: 'events',
          },
          {
            done: memberCount > 1,
            label: isHt ? 'Envite premye manm yo' : inlineText(lang, 'Invite your first members'),
            tab: 'members',
          },
        ];
        const doneCount = checklist.filter((i) => i.done).length;
        if (doneCount === checklist.length) return null;
        return (
          <div className={styles.founderCard} style={{ marginBottom: 12, display: 'block' }}>
            <div className={styles.rowName} style={{ marginBottom: 6 }}>
              <i className="fas fa-list-check" aria-hidden="true" />
              {isHt ? 'Lis preparasyon' : inlineText(lang, 'Setup checklist')}
              <span className={styles.pill}>{doneCount}/{checklist.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {checklist.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => !item.done && onOpenTab?.(item.tab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textAlign: 'left',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: item.done ? 'rgba(22,163,74,0.06)' : 'var(--surface-card, #fff)',
                    color: item.done ? 'var(--text-secondary, #64748b)' : 'var(--text-primary, #1e293b)',
                    cursor: item.done ? 'default' : 'pointer',
                    font: 'inherit',
                  }}
                >
                  <i className={`fas ${item.done ? 'fa-circle-check' : 'fa-circle'}`} aria-hidden="true" style={{ color: item.done ? '#16a34a' : 'var(--text-secondary, #64748b)' }} />
                  <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                  {!item.done && <i className="fas fa-chevron-right" aria-hidden="true" style={{ fontSize: '0.7rem', opacity: 0.7 }} />}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className={styles.primaryBtn} onClick={() => onOpenTab?.('members')}>
          <i className="fas fa-users-gear" aria-hidden="true" />
          {isHt ? 'Jere manm yo' : inlineText(lang, 'Manage members')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('posts')}>
          <i className="fas fa-comments" aria-hidden="true" />
          {isHt ? 'Modere pòs' : inlineText(lang, 'Moderate posts')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('announcements')}>
          <i className="fas fa-bullhorn" aria-hidden="true" />
          {isHt ? 'Ekri yon anons' : inlineText(lang, 'Write an announcement')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('events')}>
          <i className="fas fa-calendar-plus" aria-hidden="true" />
          {isHt ? 'Planifye yon evènman' : inlineText(lang, 'Plan an event')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('resources')}>
          <i className="fas fa-folder-plus" aria-hidden="true" />
          {isHt ? 'Pataje resous' : inlineText(lang, 'Share resources')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onOpenTab?.('settings')}>
          <i className="fas fa-sliders" aria-hidden="true" />
          {isHt ? 'Paramèt' : inlineText(lang, 'Settings')}
        </button>
      </div>
    </div>
  );
}
