/**
 * AdminMediaIncidents — Media Incident Center for admin.
 *
 * Spec (Phase ADMIN MEDIA CENTER — Media Incident Center):
 *   "Si anpil URL kraze ansanm. Sistèm nan kreye yon Incident.
 *    Incident Name, Provider, Start Time, Affected Media,
 *    Affected Creators, Status, Recovery, History, Notes."
 *
 * Route: /sheet/admin/incidents
 * Access: Staff / superuser only
 */
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { adminMediaService, mediaProviderService } from '../../services/api';

const STATUSES = [
  { key: 'open', label: 'Open', color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
  { key: 'investigating', label: 'Investigating', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
  { key: 'resolved', label: 'Resolved', color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.09))' },
  { key: 'closed', label: 'Closed', color: 'var(--text-secondary, #9ca3af)', bg: 'var(--state-neutral-bg, rgba(156,163,175,0.09))' },
];

const STATUS_COLORS = {
  open: 'var(--state-error, #ef4444)', investigating: 'var(--state-warning, #f59e0b)', resolved: 'var(--state-success, #10b981)', closed: 'var(--text-secondary, #9ca3af)',
};

export default function AdminMediaIncidents({ lang = 'ht', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [incidents, setIncidents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // ── Create Modal State ──────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createProviderId, setCreateProviderId] = useState('');
  const [createAuto, setCreateAuto] = useState(false);
  const [providers, setProviders] = useState([]);

  // ── Status Update Modal ─────────────────────────────────────
  const [statusModal, setStatusModal] = useState(null);
  const [statusNote, setStatusNote] = useState('');

  // ── Resolve Modal ───────────────────────────────────────────
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveInfo, setResolveInfo] = useState('');

  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.(isHt ? 'Aksè rezeve.' : 'Staff access required.', 'user-lock');
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminMediaService.incidentsList(statusFilter);
      setIncidents(res.data?.incidents || []);
    } catch {
      showToast?.(isHt ? 'Pa kapab chaje.' : 'Failed to load.', 'exclamation-triangle');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await mediaProviderService.list();
      setProviders(res.data?.results || res.data || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { if (hasStaffAccess) { fetchIncidents(); fetchProviders(); } }, [fetchIncidents, fetchProviders, hasStaffAccess]);

  const handleCreate = async () => {
    if (!createName.trim()) {
      showToast?.(isHt ? 'Non obligatwa.' : 'Name required.', 'exclamation-triangle');
      return;
    }
    setActionLoading('create');
    try {
      await adminMediaService.incidentCreate({
        name: createName,
        description: createDesc,
        provider_id: createProviderId || undefined,
        auto_from_provider: createAuto,
      });
      showToast?.('✓ ' + (isHt ? 'Kreye' : 'Created'), 'check-circle');
      setShowCreate(false);
      setCreateName(''); setCreateDesc(''); setCreateProviderId(''); setCreateAuto(false);
      fetchIncidents();
    } catch {
      showToast?.(isHt ? 'Erè kreye.' : 'Create failed.', 'exclamation-triangle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    setActionLoading(id);
    try {
      await adminMediaService.incidentUpdate(id, { status: newStatus, notes: statusNote });
      showToast?.('✓ ' + newStatus, 'check-circle');
      setStatusModal(null); setStatusNote('');
      fetchIncidents();
    } catch {
      showToast?.(isHt ? 'Erè.' : 'Failed.', 'exclamation-triangle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (id) => {
    setActionLoading(id);
    try {
      await adminMediaService.incidentResolve(id, resolveInfo);
      showToast?.('✓ ' + (isHt ? 'Rezoud' : 'Resolved'), 'check-circle');
      setResolveModal(null); setResolveInfo('');
      fetchIncidents();
    } catch {
      showToast?.(isHt ? 'Erè.' : 'Failed.', 'exclamation-triangle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async (id) => {
    setActionLoading(id);
    try {
      await adminMediaService.incidentRefresh(id);
      showToast?.('✓ ' + (isHt ? 'Rafrechi' : 'Refreshed'), 'check-circle');
      fetchIncidents();
    } catch {
      showToast?.(isHt ? 'Erè.' : 'Failed.', 'exclamation-triangle');
    } finally {
      setActionLoading(null);
    }
  };

  const detail = detailId ? incidents.find(i => i.id === detailId) : null;

  if (!permsLoading && !hasStaffAccess) {
    return <div className="amic-shell"><div className="amic-empty"><i className="fas fa-user-lock" /><h3>Staff Access Required</h3></div></div>;
  }

  return (
    <div className="amic-shell">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="amic-header">
        <button type="button" className="amic-back" onClick={() => onNavigate?.(-1)}><i className="fas fa-arrow-left" /></button>
        <div className="amic-header-center">
          <h1 className="amic-title"><i className="fas fa-triangle-exclamation" /> {isHt ? 'Sant Ensidan' : 'Incident Center'}</h1>
          <p className="amic-subtitle">{isHt ? 'Swiv ensidan masiv lyen kase yo.' : 'Track mass broken-link incidents.'}</p>
        </div>
        <div className="amic-header-actions">
          <button type="button" className="amic-btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="fas fa-plus" /> {isHt ? 'Nouvo' : 'New'}
          </button>
          <button type="button" className="amic-btn" onClick={fetchIncidents}>
            <i className="fas fa-sync" /> {isHt ? 'Rafrechi' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Status Filter Tabs ──────────────────────────────────── */}
      <div className="amic-filters">
        {[{ key: 'all', label: isHt ? 'Tout' : 'All', color: 'var(--text-secondary, #64748b)' }, ...STATUSES].map(f => (
          <button key={f.key} type="button" className={`amic-filter-btn ${statusFilter === f.key ? 'amic-filter-active' : ''}`}
            style={{ '--f-accent': f.color }} onClick={() => setStatusFilter(f.key)}>
            {f.key !== 'all' && <span className="amic-filter-dot" style={{ background: f.color }} />}{f.label}
          </button>
        ))}
      </div>

      {/* ── Body: List + Detail Panel ───────────────────────────── */}
      <div className="amic-body" style={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', borderRight: detail ? '1px solid var(--border-color, rgba(216,27,96,0.06))' : 'none' }}>
          {loading ? <div className="amic-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
          : incidents.length === 0 ? <div className="amic-empty"><i className="fas fa-shield-halved" style={{ opacity: .3 }} /><p>{isHt ? 'Pa gen ensidan.' : 'No incidents.'}</p></div>
          : (
            <div className="amic-list">
              {incidents.map(inc => (
                <button key={inc.id} type="button" className={`amic-list-item ${detailId === inc.id ? 'amic-list-active' : ''}`}
                  onClick={() => setDetailId(detailId === inc.id ? null : inc.id)}>
                  <div className="amic-list-item-header">
                    <span className="amic-list-name">{inc.name}</span>
                    <span className="amic-list-status" style={{ background: (STATUSES.find(s=>s.key===inc.status)||STATUSES[0]).bg, color: STATUS_COLORS[inc.status] || 'var(--text-secondary, #888)' }}>
                      {inc.status}
                    </span>
                  </div>
                  <div className="amic-list-meta">
                    {inc.provider && <span><i className="fas fa-cloud" /> {inc.provider}</span>}
                    <span><i className="fas fa-link-slash" /> {inc.affected_media_count} {(isHt ? 'lyen' : 'URLs')}</span>
                    <span><i className="fas fa-users" /> {inc.affected_creator_count} {(isHt ? 'kreyatè' : 'creators')}</span>
                    {inc.resolved_url_count > 0 && <span><i className="fas fa-check-circle" /> {inc.resolved_url_count} {(isHt ? 'retabli' : 'recovered')}</span>}
                  </div>
                  <div className="amic-list-time">
                    <i className="fas fa-clock" /> {new Date(inc.detected_at).toLocaleString()}
                    {inc.resolved_at && <span className="amic-resolved-tag"><i className="fas fa-check" /> {new Date(inc.resolved_at).toLocaleDateString()}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail Panel ──────────────────────────────────────── */}
        {detail && (
          <div className="amic-detail" style={{ width: 400, flexShrink: 0, overflowY: 'auto', padding: '16px 20px' }}>
            <h3 className="amic-detail-title">{detail.name}</h3>
            <dl className="amic-detail-dl">
              <dt>{isHt ? 'Founisè' : 'Provider'}</dt>
              <dd>{detail.provider || '—'}</dd>
              <dt>{isHt ? 'Estati' : 'Status'}</dt>
              <dd><span style={{ color: STATUS_COLORS[detail.status] }}><i className="fas fa-circle" style={{ fontSize: 8, marginRight: 6 }} />{detail.status}</span></dd>
              <dt>{isHt ? 'Detekte' : 'Detected'}</dt>
              <dd>{new Date(detail.detected_at).toLocaleString()}</dd>
              {detail.started_at && <><dt>{isHt ? 'Kòmanse' : 'Started'}</dt><dd>{new Date(detail.started_at).toLocaleString()}</dd></>}
              {detail.resolved_at && <><dt>{isHt ? 'Rezoud' : 'Resolved'}</dt><dd style={{ color: '#10b981' }}>{new Date(detail.resolved_at).toLocaleString()}</dd></>}
              <dt>{isHt ? 'Medya Afekte' : 'Affected Media'}</dt>
              <dd><strong>{detail.affected_media_count}</strong> URLs ({detail.affected_creator_count} {(isHt ? 'kreyatè' : 'creators')})</dd>
              {detail.resolved_url_count > 0 && <><dt>{isHt ? 'Retabli' : 'Recovered'}</dt><dd style={{ color: '#10b981' }}><strong>{detail.resolved_url_count}</strong> URLs</dd></>}
              {detail.description && <><dt>{isHt ? 'Deskripsyon' : 'Description'}</dt><dd>{detail.description}</dd></>}
              {detail.recovery_info && <><dt>{isHt ? 'Rekiperasyon' : 'Recovery'}</dt><dd style={{ color: '#10b981' }}>{detail.recovery_info}</dd></>}
              {detail.notes && <><dt>{isHt ? 'Nòt' : 'Notes'}</dt><dd className="amic-detail-notes">{detail.notes}</dd></>}
            </dl>

            {/* Sample affected URLs */}
            {detail.affected_media_urls && detail.affected_media_urls.length > 0 && (
              <div className="amic-detail-urls">
                <h4>{isHt ? 'Egzanp URL Afekte' : 'Sample Affected URLs'}</h4>
                {detail.affected_media_urls.slice(0, 10).map((url, i) => (
                  <div key={i} className="amic-detail-url-row" title={url}>{url.slice(0, 60)}{url.length > 60 ? '…' : ''}</div>
                ))}
              </div>
            )}

            {/* History timeline */}
            {detail.history && detail.history.length > 0 && (
              <div className="amic-detail-history">
                <h4>{isHt ? 'Istwa' : 'History'}</h4>
                {[...detail.history].reverse().slice(0, 10).map((entry, i) => (
                  <div key={i} className="amic-history-entry">
                    <div className="amic-history-meta">
                      <span className="amic-history-action" style={{ color: STATUS_COLORS[entry.action] || '#64748b' }}>{entry.action}</span>
                      <span className="amic-history-by">{isHt ? 'pa' : 'by'} {entry.by}</span>
                      <span className="amic-history-time">{entry.at ? new Date(entry.at).toLocaleString() : ''}</span>
                    </div>
                    {entry.note && <div className="amic-history-note">{entry.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="amic-detail-actions">
              <button type="button" className="amic-btn amic-btn-outline" onClick={() => handleRefresh(detail.id)}
                disabled={actionLoading === detail.id}>
                <i className={`fas ${actionLoading === detail.id ? 'fa-spinner fa-spin' : 'fa-sync'}`} />
                {isHt ? 'Rafrechi Kontè' : 'Refresh Counts'}
              </button>
              {(detail.status === 'open' || detail.status === 'investigating') && (
                <>
                  <button type="button" className="amic-btn amic-btn-warning"
                    onClick={() => setStatusModal(detail.id)}
                    disabled={actionLoading === detail.id}>
                    <i className="fas fa-edit" /> {isHt ? 'Mete Ajou' : 'Update'}
                  </button>
                  <button type="button" className="amic-btn amic-btn-success"
                    onClick={() => setResolveModal(detail.id)}
                    disabled={actionLoading === detail.id}>
                    <i className="fas fa-check" /> {isHt ? 'Rezoud' : 'Resolve'}
                  </button>
                </>
              )}
              {detail.status === 'resolved' && (
                <button type="button" className="amic-btn amic-btn-outline"
                  onClick={() => handleStatusUpdate(detail.id, 'closed')}
                  disabled={actionLoading === detail.id}>
                  <i className="fas fa-lock" /> {isHt ? 'Fèmen' : 'Close'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ────────────────────────────────────────── */}
      {showCreate && (
        <div className="amic-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="amic-modal-card">
            <div className="amic-modal-header">
              <h3><i className="fas fa-triangle-exclamation" /> {isHt ? 'Nouvo Ensidan' : 'New Incident'}</h3>
              <button type="button" className="amic-modal-close" onClick={() => setShowCreate(false)}><i className="fas fa-times" /></button>
            </div>
            <div className="amic-modal-body">
              <label className="amic-modal-label">{isHt ? 'Non Ensidan' : 'Incident Name'} *</label>
              <input type="text" className="amic-modal-input" value={createName} onChange={e => setCreateName(e.target.value)}
                placeholder={isHt ? 'Egz: "ImgBB pa disponib"' : 'e.g. "ImgBB outage"'} style={{ width: '100%' }} />

              <label className="amic-modal-label">{isHt ? 'Deskripsyon' : 'Description'}</label>
              <textarea className="amic-modal-textarea" value={createDesc} onChange={e => setCreateDesc(e.target.value)}
                placeholder={isHt ? 'Dekri ensidan an...' : 'Describe the incident...'} />

              <label className="amic-modal-label">{isHt ? 'Founisè' : 'Provider'}</label>
              <select className="amic-modal-select" value={createProviderId} onChange={e => setCreateProviderId(e.target.value)} style={{ width: '100%' }}>
                <option value="">— {isHt ? 'Okenn' : 'None'} —</option>
                {providers.map(p => <option key={p.id || p.key} value={p.id}>{p.name}</option>)}
              </select>

              {createProviderId && (
                <label className="amic-modal-checkbox">
                  <input type="checkbox" checked={createAuto} onChange={e => setCreateAuto(e.target.checked)} />
                  <span>{isHt ? 'Oto-detekte URL ki kase nan dènye èdtan an' : 'Auto-detect broken URLs in the last hour'}</span>
                </label>
              )}

              <div className="amic-modal-footer">
                <button type="button" className="amic-btn" onClick={() => setShowCreate(false)}>{isHt ? 'Anile' : 'Cancel'}</button>
                <button type="button" className="amic-btn btn-primary" onClick={handleCreate}
                  disabled={actionLoading === 'create'} style={{ marginLeft: 8 }}>
                  <i className={`fas ${actionLoading === 'create' ? 'fa-spinner fa-spin' : 'fa-plus'}`} />
                  {isHt ? 'Kreye' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Update Modal ─────────────────────────────────── */}
      {statusModal && (
        <div className="amic-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setStatusModal(null); setStatusNote(''); } }}>
          <div className="amic-modal-card">
            <div className="amic-modal-header">
              <h3><i className="fas fa-edit" /> {isHt ? 'Mete Ajou Estati' : 'Update Status'}</h3>
              <button type="button" className="amic-modal-close" onClick={() => { setStatusModal(null); setStatusNote(''); }}><i className="fas fa-times" /></button>
            </div>
            <div className="amic-modal-body">
              <div className="amic-status-grid">
                {STATUSES.filter(s => s.key !== 'resolved').map(s => (
                  <button key={s.key} type="button" className="amic-status-card" style={{ '--s-color': s.color }}
                    onClick={() => handleStatusUpdate(statusModal, s.key)}>
                    <span className="amic-status-dot" style={{ background: s.color }} />
                    {s.label}
                  </button>
                ))}
              </div>
              <textarea className="amic-modal-textarea" value={statusNote} onChange={e => setStatusNote(e.target.value)}
                placeholder={isHt ? 'Nòt (opsyonèl)...' : 'Note (optional)...'} style={{ marginTop: 12 }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Resolve Modal ───────────────────────────────────────── */}
      {resolveModal && (
        <div className="amic-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setResolveModal(null); setResolveInfo(''); } }}>
          <div className="amic-modal-card">
            <div className="amic-modal-header">
              <h3><i className="fas fa-check-circle" style={{ color: 'var(--state-success, #10b981)' }} /> {isHt ? 'Rezoud Ensidan' : 'Resolve Incident'}</h3>
              <button type="button" className="amic-modal-close" onClick={() => { setResolveModal(null); setResolveInfo(''); }}><i className="fas fa-times" /></button>
            </div>
            <div className="amic-modal-body">
              <label className="amic-modal-label">{isHt ? 'Ki jan li te rezoud?' : 'How was it resolved?'}</label>
              <textarea className="amic-modal-textarea" value={resolveInfo} onChange={e => setResolveInfo(e.target.value)}
                placeholder={isHt ? 'Dekri rekiperasyon an...' : 'Describe the recovery...'} style={{ minHeight: 100 }} />
              <div className="amic-modal-footer">
                <button type="button" className="amic-btn" onClick={() => { setResolveModal(null); setResolveInfo(''); }}>{isHt ? 'Anile' : 'Cancel'}</button>
                <button type="button" className="amic-btn amic-btn-success" onClick={() => handleResolve(resolveModal)}
                  disabled={actionLoading === resolveModal} style={{ marginLeft: 8 }}>
                  <i className={`fas ${actionLoading === resolveModal ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                  {isHt ? 'Rezoud' : 'Resolve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
