/**
 * AdminContentModeration — Content moderation panel for admin.
 *
 * Spec (Phase ADMIN MEDIA CENTER — Content Moderation):
 *   "Admin ka make yon Media. Approved, Rejected, Sensitive,
 *    Adult, Violence, Spam, Scam, Copyright, Illegal, Restricted,
 *    Hidden, Review Required. Tout Action dwe antre nan Audit Log."
 *
 * Route: /sheet/admin/moderation
 * Access: Staff / superuser only
 */
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { adminMediaService, creatorProfileService, contentStateService } from '../../services/api';
import ContentLifecycleControls from '../shared/ContentLifecycleControls';
import { useRoleGate } from '../../hooks/useRoleGate';

const MOD_STATUSES = [
  { key: '', label: 'All', icon: 'fa-list', color: 'var(--text-secondary, #64748b)' },
  { key: 'review_required', label: 'Review', icon: 'fa-eye', color: 'var(--state-warning, #f59e0b)' },
  { key: 'sensitive', label: 'Sensitive', icon: 'fa-exclamation-circle', color: 'var(--pr-color-orange-500, #f97316)' },
  { key: 'adult', label: 'Adult', icon: 'fa-user-slash', color: 'var(--state-error, #ef4444)' },
  { key: 'spam', label: 'Spam', icon: 'fa-envelope', color: 'var(--state-error, #ef4444)' },
  { key: 'copyright', label: 'Copyright', icon: 'fa-copyright', color: 'var(--pr-color-violet-500, #8b5cf6)' },
  { key: 'hidden', label: 'Hidden', icon: 'fa-eye-slash', color: 'var(--text-secondary, #64748b)' },
];

const ACTION_STATUSES = [
  { key: 'none', label: 'Clear', icon: 'fa-eraser', color: 'var(--text-secondary, #64748b)' },
  { key: 'approved', label: 'Approve', icon: 'fa-check-circle', color: 'var(--state-success, #10b981)' },
  { key: 'rejected', label: 'Reject', icon: 'fa-xmark-circle', color: 'var(--state-error, #ef4444)' },
  { key: 'review_required', label: 'Review', icon: 'fa-eye', color: 'var(--state-warning, #f59e0b)' },
  { key: 'sensitive', label: 'Sensitive', icon: 'fa-exclamation-circle', color: 'var(--pr-color-orange-500, #f97316)' },
  { key: 'adult', label: 'Adult', icon: 'fa-ban', color: 'var(--state-error, #ef4444)' },
  { key: 'violence', label: 'Violence', icon: 'fa-fist-raised', color: 'var(--state-error, #ef4444)' },
  { key: 'spam', label: 'Spam', icon: 'fa-envelope', color: 'var(--state-error, #ef4444)' },
  { key: 'scam', label: 'Scam', icon: 'fa-skull', color: 'var(--state-error, #ef4444)' },
  { key: 'copyright', label: 'Copyright', icon: 'fa-copyright', color: 'var(--pr-color-violet-500, #8b5cf6)' },
  { key: 'illegal', label: 'Illegal', icon: 'fa-gavel', color: 'var(--state-error, #ef4444)' },
  { key: 'restricted', label: 'Restrict', icon: 'fa-lock', color: 'var(--state-warning, #f59e0b)' },
  { key: 'hidden', label: 'Hide', icon: 'fa-eye-slash', color: 'var(--text-secondary, #64748b)' },
];

const STATUS_COLORS = {
  none:    { color: 'var(--text-secondary, #9ca3af)', bg: 'var(--state-neutral-bg, rgba(156,163,175,0.09))' },
  approved:{ color: 'var(--state-success, #10b981)',   bg: 'var(--severity-low-bg, rgba(16,185,129,0.09))' },
  rejected:{ color: 'var(--state-error, #ef4444)',     bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  review_required: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
  sensitive:{ color: 'var(--pr-color-orange-500, #f97316)', bg: 'var(--pr-color-orange-500-bg, rgba(249,115,22,0.09))' },
  adult:   { color: 'var(--state-error, #ef4444)',     bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  violence:{ color: 'var(--state-error, #ef4444)',     bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  spam:    { color: 'var(--state-error, #ef4444)',     bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  scam:    { color: 'var(--state-error, #ef4444)',     bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  copyright:{ color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.09))' },
  illegal: { color: 'var(--state-error, #ef4444)',     bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  restricted:{ color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
  hidden:  { color: 'var(--text-secondary, #64748b)',  bg: 'var(--state-neutral-bg, rgba(100,116,139,0.09))' },
};

export default function AdminContentModeration({ lang = 'en', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [actionModal, setActionModal] = useState(null);
  // Admin siprime nenpòt creator post + rezon notifye otè a (lis konplè)
  const modGate = useRoleGate('can_resolve_reports');
  const canModeratePosts = modGate.allowed === true || user?.is_superuser === true;
  const [posts, setPosts] = useState([]);
  const [postTotal, setPostTotal] = useState(0);
  const [postSearch, setPostSearch] = useState('');
  const [postReason, setPostReason] = useState('');
  const [postsLoading, setPostsLoading] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState('');
  // Phase 11/12 — publication lifecycle rows (ContentState). Staff can
  // publish / unpublished / archive / change visibility per item.
  const [lifecycle, setLifecycle] = useState([]);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleType, setLifecycleType] = useState('course');

  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.(isHt ? 'Aksè rezeve.' : 'Staff access required.', 'user-lock');
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminMediaService.moderatedList(statusFilter);
      setItems(res.data?.items || []);
    } catch {
      showToast?.(isHt ? 'Pa kapab chaje.' : 'Failed to load.', 'exclamation-triangle');
    } finally { setLoading(false); }
  }, [statusFilter]);

  const fetchLifecycle = useCallback(async () => {
    setLifecycleLoading(true);
    try {
      const res = await contentStateService.list({ content_type: lifecycleType });
      const payload = res.data?.results || res.data || [];
      setLifecycle(Array.isArray(payload) ? payload : []);
    } catch {
      showToast?.(isHt ? 'Pa kapab chaje estati yo.' : 'Failed to load lifecycle rows.', 'exclamation-triangle');
    } finally {
      setLifecycleLoading(false);
    }
  }, [lifecycleType, isHt, showToast]);

  useEffect(() => { if (hasStaffAccess) { fetchItems(); } }, [fetchItems, hasStaffAccess]);
  useEffect(() => { if (hasStaffAccess) { fetchLifecycle(); } }, [fetchLifecycle, hasStaffAccess]);

  // Lis konplè post yo — pa bezwen kole slug alamen.
  const fetchPosts = useCallback(async () => {
    if (!canModeratePosts) return;
    setPostsLoading(true);
    try {
      const res = await creatorProfileService.adminList({
        ...(postSearch.trim() ? { search: postSearch.trim() } : {}),
        page_size: 20,
      });
      setPosts(res.data?.results || []);
      setPostTotal(res.data?.count || 0);
    } catch {
      showToast?.(isHt ? 'Pa kapab chaje post yo.' : 'Failed to load posts.', 'exclamation-triangle');
    } finally { setPostsLoading(false); }
  }, [canModeratePosts, postSearch, isHt, showToast]);

  // Post yo chaje sou demann (bouton Chaje) pou evite setState-in-effect.
  // Pa auto-fetch isit la — lint entèdi setState synchrone nan effect.

  const handleDeletePostRow = async (post) => {
    if (!post?.slug) return;
    const ok = window.confirm(
      isHt
        ? `Siprime post @${post.author_username} (${post.slug})? Otè a ap resevwa rezon an.`
        : `Delete post @${post.author_username} (${post.slug})? Author will be notified.`,
    );
    if (!ok) return;
    setDeletingSlug(post.slug);
    try {
      await creatorProfileService.adminDelete(post.slug, postReason.trim());
      showToast?.(isHt ? '🗑️ Post siprime + otè a notifye.' : '🗑️ Post deleted + author notified.', 'trash');
      setPostReason('');
      fetchPosts();
    } catch (err) {
      showToast?.(err?.response?.data?.error || (isHt ? 'Erè siprime post.' : 'Delete post failed.'), 'exclamation-triangle');
    } finally { setDeletingSlug(''); }
  };

  const handleModerate = async (id, status, reason) => {
    try {
      await adminMediaService.moderate(id, status, reason);
      showToast?.('✓ ' + status, 'check-circle');
      fetchItems();
    } catch {
      showToast?.(isHt ? 'Erè modere.' : 'Moderation failed.', 'exclamation-triangle');
    }
    setActionModal(null);
    setReason('');
  };

  if (!permsLoading && !hasStaffAccess) {
    return <div className="acm-shell"><div className="acm-empty"><i className="fas fa-user-lock" /><h3>Staff Access Required</h3></div></div>;
  }

  return (
    <div className="acm-shell">
      <div className="acm-header">
        <button type="button" className="acm-back" onClick={() => onNavigate?.(-1)}><i className="fas fa-arrow-left" /></button>
        <div className="acm-header-center">
          <h1 className="acm-title"><i className="fas fa-shield-halved" /> {isHt ? 'Moderasyon Kontni' : 'Content Moderation'}</h1>
          <p className="acm-subtitle">{isHt ? 'Make medya dapre politik kontni.' : 'Flag media according to content policy.'}</p>
        </div>
        <button type="button" className="acm-btn" onClick={fetchItems}><i className="fas fa-sync" /> {isHt ? 'Rafrechi' : 'Refresh'}</button>
      </div>

      {/* Phase 11/12 — publication lifecycle. Generic controls: the
          backend enforces ownership, staff moderation and validation. */}
      <div className="acm-filters" style={{ marginBottom: 12, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '.85rem' }}>
            {isHt ? 'Estati piblikasyon' : 'Publication status'}
          </strong>
          <select
            value={lifecycleType}
            onChange={(e) => setLifecycleType(e.target.value)}
            aria-label="lifecycle content type"
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '.82rem' }}
          >
            {['course', 'post', 'product', 'music', 'talent', 'community', 'event', 'job', 'portfolio'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="button" className="acm-btn" onClick={fetchLifecycle} disabled={lifecycleLoading}>
            <i className="fas fa-sync" /> {isHt ? 'Chaje' : 'Load'}
          </button>
        </div>
        {lifecycleLoading ? (
          <div className="acm-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
        ) : lifecycle.length === 0 ? (
          <p style={{ fontSize: '.82rem', opacity: .7 }}>
            {isHt ? 'Poko gen estati pou tip sa a.' : 'No lifecycle rows for this type yet.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {lifecycle.map((row) => (
              <div key={row.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 600 }}>
                    {row.content_type} #{row.object_id} · {row.publication_state}
                  </div>
                  <div style={{ fontSize: '.75rem', opacity: .7 }}>
                    {isHt ? 'Distribisyon' : 'Distribution'}: {row.effective_distribution}
                  </div>
                </div>
                <ContentLifecycleControls
                  contentType={row.content_type}
                  objectId={row.object_id}
                  initialState={row}
                  lang={lang}
                  onChanged={fetchLifecycle}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {canModeratePosts && (
        <div className="acm-filters" style={{ marginBottom: 12, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '.85rem' }}>
              {isHt ? `Post kreyatè yo (${postTotal}) — admin ka siprime nenpòt:` : `Creator posts (${postTotal}) — admin can delete any:`}
            </strong>
            <input type="text" value={postSearch} onChange={(e) => setPostSearch(e.target.value)} placeholder={isHt ? 'Chèche tèks oswa @user...' : 'Search text or @user...'} aria-label="search posts" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '.82rem', minWidth: 200 }} />
            <input type="text" value={postReason} onChange={(e) => setPostReason(e.target.value)} placeholder={isHt ? 'Rezon (voye bay otè)' : 'Reason (sent to author)'} aria-label="reason" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '.82rem', minWidth: 220 }} />
            <button type="button" className="acm-btn" onClick={fetchPosts} disabled={postsLoading}>
              <i className="fas fa-sync" /> {isHt ? 'Chaje' : 'Load'}
            </button>
          </div>
          {postsLoading ? (
            <div className="acm-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje post...' : 'Loading posts...'}</div>
          ) : posts.length === 0 ? (
            <p style={{ fontSize: '.82rem', opacity: .7 }}>{isHt ? 'Pa gen post.' : 'No posts.'}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {posts.map((p) => (
                <div key={p.slug} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600 }}>@{p.author_username} · <span style={{ opacity: .6 }}>{p.slug}</span></div>
                    <div style={{ fontSize: '.82rem', opacity: .85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.body}</div>
                  </div>
                  <button type="button" className="acm-action-btn" disabled={deletingSlug === p.slug} onClick={() => handleDeletePostRow(p)} title={isHt ? 'Siprime + notifye otè' : 'Delete + notify author'}>
                    <i className="fas fa-trash" /> {deletingSlug === p.slug ? '...' : (isHt ? 'Siprime' : 'Delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="acm-filters">
        {MOD_STATUSES.map((f) => (
          <button key={f.key} type="button" className={`acm-filter-btn ${statusFilter === f.key ? 'acm-filter-active' : ''}`}
            style={{ '--f-accent': f.color }} onClick={() => setStatusFilter(f.key)}>
            <i className={`fas ${f.icon}`} />{f.label}
          </button>
        ))}
      </div>

      <div className="acm-body">
        {loading ? <div className="acm-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
        : items.length === 0 ? <div className="acm-empty"><i className="fas fa-check-circle" style={{opacity:.3}} /><p>{isHt ? 'Pa gen medya make.' : 'No flagged media.'}</p></div>
        : (
          <div className="acm-table-wrap">
            <table className="acm-table">
              <thead><tr>
                <th>{isHt ? 'Medya' : 'Media'}</th><th>{isHt ? 'Mèt' : 'Owner'}</th>
                <th>{isHt ? 'Mak' : 'Flag'}</th><th>{isHt ? 'Moderatè' : 'Moderator'}</th>
                <th>{isHt ? 'Reyon' : 'Reason'}</th><th>{isHt ? 'Dat' : 'Date'}</th>
                <th>{isHt ? 'Aksyon' : 'Actions'}</th>
              </tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="acm-row">
                    <td className="acm-cell-url"><span className="acm-url" title={item.url}>{item.url?.slice(0,45)}{item.url?.length>45?'…':''}</span></td>
                    <td>{item.owner||'—'}</td>
                    <td><span className="acm-status-badge" style={{background:(STATUS_COLORS[item.moderation_status]||STATUS_COLORS.none).bg,color:(STATUS_COLORS[item.moderation_status]||STATUS_COLORS.none).color}}>{item.moderation_status}</span></td>
                    <td>{item.moderated_by||'—'}</td>
                    <td className="acm-cell-reason">{item.moderation_reason?.slice(0,60)||'—'}</td>
                    <td className="acm-cell-time">{item.moderated_at?new Date(item.moderated_at).toLocaleDateString():'—'}</td>
                    <td className="acm-cell-actions">
                      <button type="button" className="acm-action-btn" onClick={() => setActionModal({id:item.id, url:item.url, current:item.moderation_status})}>
                        <i className="fas fa-flag" /> {isHt?'Make':'Flag'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionModal && (
        <div className="acm-modal-backdrop" onClick={(e) => { if (e.target===e.currentTarget) { setActionModal(null); setReason(''); } }}>
          <div className="acm-modal-card">
            <div className="acm-modal-header">
              <h3><i className="fas fa-flag" /> {isHt?'Make Medya':'Flag Media'}</h3>
              <button type="button" className="acm-modal-close" onClick={()=>{setActionModal(null); setReason('');}}><i className="fas fa-times"/></button>
            </div>
            <div className="acm-modal-body">
              <p className="acm-modal-url">{actionModal.url?.slice(0,80)}</p>
              <p className="acm-modal-current">{isHt?'Mak aktyèl':'Current'}: <strong>{actionModal.current||'none'}</strong></p>
              <input
                type="text"
                className="acm-modal-input"
                placeholder={isHt?'Reyon (opsyonèl)':'Reason (optional)'}
                value={reason}
                onChange={(e)=>setReason(e.target.value)}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--border-color)',marginBottom:12,fontSize:'.82rem',fontFamily:'inherit'}}
              />
              <div className="acm-actions-grid">
                {ACTION_STATUSES.map((a) => (
                  <button key={a.key} type="button" className="acm-action-card" style={{'--a-color':a.color}}
                    onClick={() => handleModerate(actionModal.id, a.key, reason)}>
                    <i className={`fas ${a.icon}`} />{a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
