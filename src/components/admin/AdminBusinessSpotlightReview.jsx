/**
 * src/components/admin/AdminBusinessSpotlightReview.jsx
 *
 * Admin UI for reviewing Business Spotlight applications.
 * =======================================
 *
 * Features:
 *   - List all Business Spotlight applications
 *   - Filter by status, search by business name
 *   - Approve / Reject with notes
 *   - View business details, services, testimonials
 *   - Quick status change actions inline
 *
 * Route: /sheet/admin/business-spotlight
 * API:  GET  /api/business-spotlight/          — list all apps
 *       POST /api/business-spotlight/<id>/approve/ — approve
 *       POST /api/business-spotlight/<id>/reject/  — reject with note
 *       POST /api/business-spotlight/<id>/request-info/ — ask for more info
 */

import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import api from '../../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtDateTime(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleString(); } catch { return str; }
}

function shorten(s, n = 80) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const STATUS_CFG = {
  pending:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b33', label: 'Pending',        icon: 'fa-clock' },
  under_review:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: '#3b82f633', label: 'Under Review',    icon: 'fa-eye' },
  info_requested: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  border: '#8b5cf633', label: 'Info Requested',  icon: 'fa-circle-question' },
  approved:       { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: '#22c55e33', label: 'Approved',        icon: 'fa-check-circle' },
  rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: '#ef444433', label: 'Rejected',        icon: 'fa-xmark-circle' },
};

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ─── Status Badge ────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span
      className="ad-spot-status-badge"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <i className={`fas ${cfg.icon}`} aria-hidden="true" />
      {' '}{cfg.label}
    </span>
  );
}

// ─── Application Row ─────────────────────────────────────────────────

function ApplicationRow({ app, onSelect, isSelected }) {
  const cfg = STATUS_CFG[app.status] || STATUS_CFG.pending;
  return (
    <button
      type="button"
      className={classNames('ad-spot-row', isSelected && 'ad-spot-row-selected')}
      onClick={() => onSelect(app)}
      data-status={app.status}
    >
      <div className="ad-spot-row-avatar">
        <span style={{ background: cfg.color }}>
          {app.business_name?.charAt(0)?.toUpperCase() || 'B'}
        </span>
      </div>
      <div className="ad-spot-row-body">
        <div className="ad-spot-row-title">{shorten(app.business_name, 60)}</div>
        <div className="ad-spot-row-meta">
          <span className="ad-spot-row-user">
            <i className="fas fa-building" aria-hidden="true" /> {app.user?.username || 'Unknown'}
          </span>
          <StatusBadge status={app.status} />
        </div>
        <div className="ad-spot-row-desc">{shorten(app.business_description, 100)}</div>
      </div>
      <div className="ad-spot-row-date">{fmtDateTime(app.created_at)}</div>
    </button>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────

function DetailPanel({ app, onRefresh }) {
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { if (app) { setNote(''); } }, [app?.id]);

  if (!app) {
    return (
      <div className="ad-spot-detail-empty">
        <i className="fas fa-hand-pointer" />
        <p>Select a Business Spotlight application to review</p>
      </div>
    );
  }

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      if (action === 'approve') {
        await api.post(`business-spotlight/${app.id}/approve/`, { note });
      } else if (action === 'reject') {
        if (!note.trim()) return;
        await api.post(`business-spotlight/${app.id}/reject/`, { note });
      } else if (action === 'request-info') {
        if (!note.trim()) return;
        await api.post(`business-spotlight/${app.id}/request-info/`, { note });
      }
      setNote('');
      onRefresh?.();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    } finally { setActionLoading(null); }
  };

  const canApprove = app.status !== 'approved';
  const canReject = app.status !== 'rejected';
  const canRequestInfo = app.status !== 'approved' && app.status !== 'rejected';

  return (
    <div className="ad-spot-detail">
      {/* Header */}
      <div className="ad-spot-detail-header">
        <h2 className="ad-spot-detail-title">
          <i className="fas fa-building" aria-hidden="true" />
          {' '}{app.business_name}
        </h2>
        <StatusBadge status={app.status} />
      </div>

      {/* Meta grid */}
      <div className="ad-spot-detail-meta">
        <div className="ad-spot-detail-meta-item">
          <i className="fas fa-user" /> <strong>Owner:</strong> {app.user?.username || 'Unknown'}
        </div>
        {app.business_category && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-tag" /> <strong>Category:</strong> {app.business_category}
          </div>
        )}
        {app.website_url && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-link" /> <strong>Website:</strong>{' '}
            <a href={app.website_url} target="_blank" rel="noopener noreferrer">{shorten(app.website_url, 40)}</a>
          </div>
        )}
        <div className="ad-spot-detail-meta-item">
          <i className="fas fa-calendar" /> <strong>Submitted:</strong> {fmtDateTime(app.created_at)}
        </div>
        {app.is_verified_business && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-check-circle" style={{ color: '#22c55e' }} /> <strong>Business Verified</strong>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="ad-spot-detail-section">
        <h3><i className="fas fa-align-left" /> Description</h3>
        <p className="ad-spot-detail-desc">{app.business_description}</p>
      </div>

      {/* Services offered */}
      {app.services_offered?.length > 0 && (
        <div className="ad-spot-detail-section">
          <h3><i className="fas fa-briefcase" /> Services Offered</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {app.services_offered.map((service, idx) => (
              <span key={idx} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem',
                background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 600,
              }}>
                {typeof service === 'string' ? service : service.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Client testimonials */}
      {app.client_testimonials?.length > 0 && (
        <div className="ad-spot-detail-section">
          <h3><i className="fas fa-quote-left" /> Client Testimonials</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {app.client_testimonials.map((t, idx) => (
              <div key={idx} style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>"{t.text || t}"</p>
                {t.author && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', marginTop: 4, display: 'block' }}>
                    — {t.author}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio items */}
      {app.portfolio_items?.length > 0 && (
        <div className="ad-spot-detail-section">
          <h3><i className="fas fa-images" /> Portfolio Items</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {app.portfolio_items.map((item, idx) => (
              <div key={idx} style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                fontSize: '0.8rem',
              }}>
                {typeof item === 'string' ? item : item.title || item.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review note */}
      {app.review_note && (
        <div className="ad-spot-detail-section" data-note>
          <h3><i className="fas fa-sticky-note" /> Review Note</h3>
          <p className="ad-spot-detail-note">{app.review_note}</p>
        </div>
      )}

      {/* Actions */}
      <div className="ad-spot-detail-section">
        <h3><i className="fas fa-gavel" /> Actions</h3>
        <div className="ad-spot-detail-actions">
          {canApprove && (
            <button
              type="button"
              className="ad-spot-btn ad-spot-btn-approve"
              onClick={() => handleAction('approve')}
              disabled={actionLoading === 'approve'}
            >
              {actionLoading === 'approve' ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check-circle" />}
              {' '}Approve
            </button>
          )}
          {canReject && (
            <div className="ad-spot-action-with-note">
              <input
                type="text"
                className="ad-spot-note-input"
                placeholder="Reason for rejection..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
              <button
                type="button"
                className="ad-spot-btn ad-spot-btn-reject"
                onClick={() => handleAction('reject')}
                disabled={actionLoading === 'reject' || !note.trim()}
              >
                {actionLoading === 'reject' ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-xmark-circle" />}
                {' '}Reject
              </button>
            </div>
          )}
          {canRequestInfo && (
            <div className="ad-spot-action-with-note">
              <input
                type="text"
                className="ad-spot-note-input"
                placeholder="What info do you need?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
              <button
                type="button"
                className="ad-spot-btn ad-spot-btn-info"
                onClick={() => handleAction('request-info')}
                disabled={actionLoading === 'request-info' || !note.trim()}
              >
                {actionLoading === 'request-info' ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-circle-question" />}
                {' '}Request Info
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────────

function FilterBar({ status, setStatus, query, setQuery }) {
  const statuses = ['', 'pending', 'under_review', 'info_requested', 'approved', 'rejected'];

  return (
    <div className="ad-spot-filters">
      <div className="ad-spot-filter-group">
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => (
            <option key={s} value={s}>{s ? (STATUS_CFG[s]?.label || s) : 'All Statuses'}</option>
          ))}
        </select>
      </div>
      <div className="ad-spot-filter-group ad-spot-filter-search">
        <label>Search</label>
        <input
          type="text"
          placeholder="Search by business name, owner, description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────

function StatsBar({ applications }) {
  const total = applications?.length || 0;
  const counts = {};
  Object.keys(STATUS_CFG).forEach((s) => { counts[s] = 0; });
  (applications || []).forEach((app) => { if (counts[app.status] !== undefined) counts[app.status]++; });
  return (
    <div className="ad-spot-stats">
      <span className="ad-spot-stat"><strong>{total}</strong> Total</span>
      {Object.entries(STATUS_CFG).map(([key, cfg]) => (
        <span key={key} className="ad-spot-stat" style={{ '--stat-color': cfg.color }}>
          <i className={`fas ${cfg.icon}`} style={{ color: cfg.color }} />
          {' '}{counts[key]} {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminBusinessSpotlightReview({ lang = 'ht', showToast, user, onNavigate }) {
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (query.trim()) params.q = query.trim();
      const res = await api.get('business-spotlight/', { params });
      const data = res.data?.results || res.data || [];
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load applications');
      setApplications([]);
    } finally { setLoading(false); }
  }, [statusFilter, query, refreshKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.('Staff access required.', 'user-lock');
      if (onNavigate) onNavigate('/sheet/admin/dashboard', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, onNavigate, showToast]);

  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="ad-dash-shell">
        <div className="ad-dash-empty">
          <i className="fas fa-user-lock" /> <h3>Staff Access Required</h3>
          <p>You need staff permissions to manage Business Spotlight applications.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-spot-shell">
      {/* Header */}
      <div className="ad-spot-header">
        <div className="ad-spot-header-left">
          <button type="button" className="ad-dash-back" onClick={() => onNavigate?.('/sheet/admin/dashboard')} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="ad-spot-title">
              <i className="fas fa-building" aria-hidden="true" /> Business Spotlight
            </h1>
            <p className="ad-spot-subtitle">Review and manage Business Spotlight applications</p>
          </div>
        </div>
        <button type="button" className="ad-spot-refresh" onClick={() => setRefreshKey((k) => k + 1)} title="Refresh">
          <i className="fas fa-rotate" />
        </button>
      </div>

      {/* Stats */}
      {applications && <StatsBar applications={applications} />}

      {/* Filters */}
      <FilterBar
        status={statusFilter} setStatus={setStatusFilter}
        query={query} setQuery={setQuery}
      />

      {/* Content */}
      <div className="ad-spot-content">
        {/* List panel */}
        <div className="ad-spot-list">
          {loading ? (
            <div className="ad-spot-panel-loading"><i className="fas fa-spinner fa-spin" /> Loading...</div>
          ) : error ? (
            <div className="ad-spot-error">
              <i className="fas fa-circle-exclamation" /> {error}
              <button type="button" onClick={fetchAll}>Retry</button>
            </div>
          ) : !applications || applications.length === 0 ? (
            <div className="ad-spot-empty">
              <i className="fas fa-inbox" />
              <p>No Business Spotlight applications found</p>
              {(statusFilter || query) && (
                <button type="button" onClick={() => { setStatusFilter(''); setQuery(''); }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="ad-spot-list-inner">
              {applications.map((app) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  onSelect={setSelected}
                  isSelected={selected?.id === app.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="ad-spot-detail-panel">
          <DetailPanel
            app={selected}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}
