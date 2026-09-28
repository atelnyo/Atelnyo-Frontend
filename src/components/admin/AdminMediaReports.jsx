/**
 * AdminMediaReports — Media report review center for admin.
 *
 * Spec (Phase ADMIN MEDIA CENTER — Media Report Center):
 *   "Si itilizatè rapòte yon medya. Li antre isit.
 *    Report Type, Reporter, Owner, Module, Reason, Description,
 *    Evidence, Status, Assigned Moderator, Decision, History."
 *
 * Route: /sheet/admin/reports
 * Access: Staff / superuser only
 */
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { adminMediaService } from '../../services/api';

const REPORT_STATUSES = [
  { key: 'pending', label: 'Pending', icon: 'fa-clock', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
  { key: 'under_review', label: 'In Review', icon: 'fa-eye', color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.09))' },
  { key: 'resolved', label: 'Resolved', icon: 'fa-check-circle', color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.09))' },
  { key: 'dismissed', label: 'Dismissed', icon: 'fa-xmark-circle', color: 'var(--text-secondary, #9ca3af)', bg: 'var(--state-neutral-bg, rgba(156,163,175,0.09))' },
];

const DECISIONS = [
  { key: 'approved', label: 'Approve', icon: 'fa-check-circle', color: 'var(--state-success, #10b981)' },
  { key: 'rejected', label: 'Reject', icon: 'fa-xmark-circle', color: 'var(--state-error, #ef4444)' },
  { key: 'sensitive', label: 'Sensitive', icon: 'fa-exclamation-circle', color: 'var(--pr-color-orange-500, #f97316)' },
  { key: 'hidden', label: 'Hide', icon: 'fa-eye-slash', color: 'var(--text-secondary, #64748b)' },
  { key: 'restricted', label: 'Restrict', icon: 'fa-lock', color: 'var(--state-warning, #f59e0b)' },
  { key: 'no_action', label: 'No Action', icon: 'fa-minus-circle', color: 'var(--text-secondary, #9ca3af)' },
];

const TYPE_LABELS = {
  inappropriate: 'Inappropriate', copyright: 'Copyright', spam: 'Spam', broken: 'Broken Link',
  adult: 'Adult', violence: 'Violence', illegal: 'Illegal', misleading: 'Misleading',
  privacy: 'Privacy', other: 'Other',
};

export default function AdminMediaReports({ lang = 'ht', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) { showToast?.(isHt?'Aksè rezeve.':'Staff access required.','user-lock'); if(onNavigate) onNavigate('/',{replace:true}); }
  }, [user, hasStaffAccess, permsLoading]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try { const res = await adminMediaService.reportsList(statusFilter); setReports(res.data?.reports||[]); }
    catch { showToast?.(isHt?'Pa kapab chaje.':'Failed to load.','exclamation-triangle'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { if (hasStaffAccess) fetchReports(); }, [fetchReports, hasStaffAccess]);

  const handleAssign = async (id) => {
    setActionLoading(id);
    try { await adminMediaService.assignReport(id); showToast?.('✓ Assigned','check-circle'); fetchReports(); }
    catch { showToast?.(isHt?'Erè.':'Failed.','exclamation-triangle'); }
    finally { setActionLoading(null); }
  };

  const handleResolve = async (id, decision) => {
    setActionLoading(id);
    try { await adminMediaService.resolveReport(id, decision); showToast?.('✓ '+decision,'check-circle'); fetchReports(); setDetailId(null); }
    catch { showToast?.(isHt?'Erè.':'Failed.','exclamation-triangle'); }
    finally { setActionLoading(null); }
  };

  const detail = detailId ? reports.find(r => r.id === detailId) : null;

  if (!permsLoading && !hasStaffAccess) {
    return <div className="amr-shell"><div className="amr-empty"><i className="fas fa-user-lock" /><h3>Staff Access Required</h3></div></div>;
  }

  return (
    <div className="amr-shell">
      <div className="amr-header">
        <button type="button" className="amr-back" onClick={() => onNavigate?.(-1)}><i className="fas fa-arrow-left" /></button>
        <div className="amr-header-center">
          <h1 className="amr-title"><i className="fas fa-flag" /> {isHt?'Sant Rapò Medya':'Media Report Center'}</h1>
          <p className="amr-subtitle">{isHt?'Revize rapò itilizatè yo.':'Review user-submitted media reports.'}</p>
        </div>
        <button type="button" className="amr-btn" onClick={fetchReports}><i className="fas fa-sync" /> {isHt?'Rafrechi':'Refresh'}</button>
      </div>

      <div className="amr-filters">
        {REPORT_STATUSES.map(f => (
          <button key={f.key} type="button" className={`amr-filter-btn ${statusFilter===f.key?'amr-filter-active':''}`}
            style={{'--f-accent':f.color}} onClick={()=>setStatusFilter(f.key)}>
            <i className={`fas ${f.icon}`} />{f.label}
          </button>
        ))}
      </div>

      <div className="amr-body" style={{display:'flex',gap:0,flex:1,overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',borderRight:detail?'1px solid var(--border-color, rgba(216,27,96,0.06))':'none'}}>
          {loading ? <div className="amr-loading"><i className="fas fa-spinner fa-spin" /> {isHt?'Ap chaje...':'Loading...'}</div>
          : reports.length===0 ? <div className="amr-empty"><i className="fas fa-inbox" style={{opacity:.3}} /><p>{isHt?'Pa gen rapò.':'No reports.'}</p></div>
          : (
            <div className="amr-list">
              {reports.map(r => (
                <button key={r.id} type="button" className={`amr-list-item ${detailId===r.id?'amr-list-active':''}`}
                  onClick={()=>setDetailId(detailId===r.id?null:r.id)}>
                  <div className="amr-list-item-header">
                    <span className="amr-list-type" style={{color:REPORT_STATUSES.find(s=>s.key===r.status)?.color||'#888'}}>
                      <i className={`fas ${REPORT_STATUSES.find(s=>s.key===r.status)?.icon||'fa-circle'}`} />
                      {TYPE_LABELS[r.report_type]||r.report_type}
                    </span>
                    <span className="amr-list-status" style={{background:REPORT_STATUSES.find(s=>s.key===r.status)?.bg||'var(--state-neutral-bg, rgba(148,163,184,0.09))',color:REPORT_STATUSES.find(s=>s.key===r.status)?.color||'var(--text-secondary, #888)'}}>
                      {r.status}
                    </span>
                  </div>
                  <div className="amr-list-meta">
                    <span>{isHt?'Pa':'By'} {r.reporter||'—'}</span>
                    <span>{isHt?'Sou':'Re'} {r.owner||'—'}</span>
                    {r.assigned_moderator&&<span>→ {r.assigned_moderator}</span>}
                  </div>
                  <div className="amr-list-reason">{r.reason?.slice(0,80)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {detail && (
          <div className="amr-detail" style={{width:380,flexShrink:0,overflowY:'auto',padding:'16px 20px'}}>
            <h3 className="amr-detail-title">{isHt?'Detay Rapò':'Report Detail'}</h3>
            <dl className="amr-detail-dl">
              <dt>{isHt?'Tip':'Type'}</dt><dd>{TYPE_LABELS[detail.report_type]||detail.report_type}</dd>
              <dt>{isHt?'Rapòtè':'Reporter'}</dt><dd>{detail.reporter||'—'}</dd>
              <dt>{isHt?'Pwopriyetè':'Owner'}</dt><dd>{detail.owner||'—'}</dd>
              <dt>{isHt?'Medya':'Media URL'}</dt><dd className="amr-detail-url">{detail.media_url||'—'}</dd>
              <dt>{isHt?'Reyon':'Reason'}</dt><dd>{detail.reason||'—'}</dd>
              <dt>{isHt?'Deskripsyon':'Description'}</dt><dd>{detail.description||'—'}</dd>
              <dt>{isHt?'Moderatè':'Moderator'}</dt><dd>{detail.assigned_moderator||(isHt?'Pa asiyen':'Unassigned')}</dd>
              <dt>{isHt?'Estati':'Status'}</dt><dd>{detail.status}</dd>
              {detail.decision&&<><dt>{isHt?'Desizyon':'Decision'}</dt><dd>{detail.decision}</dd></>}
            </dl>

            <div className="amr-detail-actions">
              {!detail.assigned_moderator && (
                <button type="button" className="btn-primary" onClick={()=>handleAssign(detail.id)}
                  disabled={actionLoading===detail.id}>
                  <i className={`fas ${actionLoading===detail.id?'fa-spinner fa-spin':'fa-user-plus'}`} />
                  {isHt?'Asiyen mwen':'Assign to me'}
                </button>
              )}
              {(detail.status==='pending'||detail.status==='under_review')&&(
                <div className="amr-decision-grid">
                  {DECISIONS.map(d => (
                    <button key={d.key} type="button" className="amr-decision-btn" style={{'--d-color':d.color}}
                      onClick={()=>handleResolve(detail.id,d.key)} disabled={actionLoading===detail.id}>
                      <i className={`fas ${d.icon}`} />{d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
