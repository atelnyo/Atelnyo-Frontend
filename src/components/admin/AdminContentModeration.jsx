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
import { adminMediaService } from '../../services/api';

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

export default function AdminContentModeration({ lang = 'ht', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [actionModal, setActionModal] = useState(null);

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

  useEffect(() => { if (hasStaffAccess) fetchItems(); }, [fetchItems, hasStaffAccess]);

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
