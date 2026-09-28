/**
 * src/components/admin/AdminSpotlightReview.jsx
 *
 * Full Admin Spotlight Management Page.
 * =======================================
 *
 * Gives admins total control over spotlight applications:
 *   - List all applications (pending, under_review, info_requested, approved, rejected)
 *   - Filter by status, category, search by username/title
 *   - Approve / Reject with notes
 *   - Request more info from applicant
 *   - View KYC details, message thread
 *   - Quick status change actions inline
 *
 * Route: /sheet/admin/spotlight
 * API:  GET  /api/spotlight/admin-all/   — list all apps
 *       POST /api/spotlight/<id>/approve/ — approve
 *       POST /api/spotlight/<id>/reject/  — reject with note
 *       POST /api/spotlight/<id>/request-info/ — ask for more info
 *       GET  /api/spotlight/<id>/messages/ — thread
 *       GET  /api/spotlight/<id>/kyc/     — KYC detail
 */

// React itself is unused here — the new JSX runtime
// (configured by @vitejs/plugin-react) auto-injects the
// jsx-runtime import, so a default React import isn't
// needed. Dropping it keeps the dep graph clean and
// silences future "unused React" warnings.
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import api from '../../services/api';
import { SPOTLIGHT_STATUS } from '../../constants/statusConfig';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtDateTime(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleString(); } catch { return str; }
}

function shorten(s, n = 80) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const STATUS_CFG = SPOTLIGHT_STATUS;

const CATEGORY_CFG = {
  talent:   { color: 'var(--color-accent-pink, #f472b6)',  bg: 'rgba(244,114,182,0.1)',  label: 'Talent / Service' },
  commerce: { color: 'var(--pr-color-emerald-400, #34d399)', bg: 'rgba(52,211,153,0.1)',  label: 'Commerce / Product' },
  course:   { color: 'var(--state-info, #60a5fa)',         bg: 'rgba(96,165,250,0.1)',  label: 'Course / Learning' },
  other:    { color: 'var(--pr-color-violet-400, #a78bfa)', bg: 'rgba(167,139,250,0.1)', label: 'Other / Invention' },
};

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ─── Status Badge ────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = SPOTLIGHT_STATUS[status] || SPOTLIGHT_STATUS.pending;
  return (
    <span
      className="ad-spot-status-badge"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <i className={`fas ${cfg.icon}`} aria-hidden="true" />
      {' '}{cfg.labelEn}
    </span>
  );
}

// ─── Category Pill ───────────────────────────────────────────────────

function CategoryPill({ category }) {
  const cfg = CATEGORY_CFG[category] || CATEGORY_CFG.other;
  return (
    <span className="ad-spot-cat-pill" style={{ background: cfg.bg || `${cfg.color}18`, color: cfg.color }}>
      {cfg.label}
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
          {app.user?.username?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>
      <div className="ad-spot-row-body">
        <div className="ad-spot-row-title">{shorten(app.invention_title, 60)}</div>
        <div className="ad-spot-row-meta">
          <span className="ad-spot-row-user">
            <i className="fas fa-user" aria-hidden="true" /> {app.user?.username || 'Unknown'}
          </span>
          <CategoryPill category={app.category} />
          <StatusBadge status={app.status} />
        </div>
        <div className="ad-spot-row-desc">{shorten(app.invention_description, 100)}</div>
      </div>
      <div className="ad-spot-row-date">{fmtDateTime(app.created_at)}</div>
      {app.rejection_count > 0 && (
        <span className="ad-spot-row-rejection" title={`Rejected ${app.rejection_count} time(s)`}>
          <i className="fas fa-rotate-left" /> {app.rejection_count}
        </span>
      )}
    </button>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────

function DetailPanel({ app, onRefresh }) {
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [messages, setMessages] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [showKyc, setShowKyc] = useState(false);
  const [showThread, setShowThread] = useState(false);

  useEffect(() => { if (app) { setNote(''); setMessages(null); setKyc(null); setShowKyc(false); setShowThread(false); } }, [app?.id]);

  if (!app) {
    return (
      <div className="ad-spot-detail-empty">
        <i className="fas fa-hand-pointer" />
        <p>Select an application to review</p>
      </div>
    );
  }

  const cfg = STATUS_CFG[app.status] || STATUS_CFG.pending;

  const loadMessages = async () => {
    if (messages) { setShowThread(!showThread); return; }
    try {
      const res = await api.get(`spotlight/${app.id}/messages/`);
      setMessages(Array.isArray(res.data) ? res.data : (res.data?.results || []));
      setShowThread(true);
    } catch { setMessages([]); setShowThread(true); }
  };

  const loadKyc = async () => {
    if (kyc) { setShowKyc(!showKyc); return; }
    try {
      const res = await api.get(`spotlight/${app.id}/kyc/`);
      setKyc(res.data);
      setShowKyc(true);
    } catch { setKyc(null); setShowKyc(true); }
  };

  const handleAction = async (action, extra = {}) => {
    setActionLoading(action);
    try {
      if (action === 'approve') await api.post(`spotlight/${app.id}/approve/`, extra);
      else if (action === 'reject') {
        if (!note.trim()) return;
        await api.post(`spotlight/${app.id}/reject/`, { review_note: note });
      }
      else if (action === 'request-info') {
        if (!note.trim()) return;
        await api.post(`spotlight/${app.id}/request-info/`, { body: note });
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
          <i className="fas fa-lightbulb" aria-hidden="true" />
          {' '}{app.invention_title}
        </h2>
        <StatusBadge status={app.status} />
      </div>

      {/* Meta grid */}
      <div className="ad-spot-detail-meta">
        <div className="ad-spot-detail-meta-item">
          <i className="fas fa-user" /> <strong>Applicant:</strong> {app.user?.username || 'Unknown'}
        </div>
        <div className="ad-spot-detail-meta-item">
          <i className="fas fa-tag" /> <strong>Category:</strong> <CategoryPill category={app.category} />
        </div>
        {app.link_url && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-link" /> <strong>Link:</strong>{' '}
            <a href={app.link_url} target="_blank" rel="noopener noreferrer">{shorten(app.link_url, 40)}</a>
          </div>
        )}
        <div className="ad-spot-detail-meta-item">
          <i className="fas fa-calendar" /> <strong>Submitted:</strong> {fmtDateTime(app.created_at)}
        </div>
        {app.reviewed_by && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-gavel" /> <strong>Reviewer:</strong> {app.reviewed_by?.username || 'System'}
          </div>
        )}
        {app.reviewed_at && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-clock" /> <strong>Reviewed at:</strong> {fmtDateTime(app.reviewed_at)}
          </div>
        )}
        {app.rejection_count > 0 && (
          <div className="ad-spot-detail-meta-item">
            <i className="fas fa-rotate-left" /> <strong>Rejection count:</strong> {app.rejection_count}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="ad-spot-detail-section">
        <h3><i className="fas fa-align-left" /> Description</h3>
        <p className="ad-spot-detail-desc">{app.invention_description}</p>
      </div>

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
            <>
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
            </>
          )}
          {canRequestInfo && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Detail toggles */}
      <div className="ad-spot-detail-toggles">
        <button type="button" className="ad-spot-toggle-btn" onClick={loadMessages}>
          <i className={`fas ${showThread ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
          {' '}<i className="fas fa-comments" /> Message Thread ({app.message_count ?? messages?.length ?? '...'})
        </button>
        {showThread && (
          <div className="ad-spot-thread">
            {!messages ? (
              <div className="ad-spot-panel-loading"><i className="fas fa-spinner fa-spin" /> Loading...</div>
            ) : messages.length === 0 ? (
              <div className="ad-spot-thread-empty">No messages yet</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`ad-spot-thread-msg ad-spot-thread-msg-${msg.sender_role}`} data-admin-request={msg.is_admin_request || undefined}>
                  <div className="ad-spot-thread-msg-header">
                    <strong>{msg.sender_role === 'admin' ? 'Admin' : msg.sender_role === 'system' ? 'System' : msg.sender_user?.username || 'Applicant'}</strong>
                    <span className="ad-spot-thread-msg-time">{fmtDateTime(msg.created_at)}</span>
                  </div>
                  <p>{msg.body}</p>
                  {msg.is_admin_request && <span className="ad-spot-thread-msg-flag"><i className="fas fa-question-circle" /> Info request</span>}
                </div>
              ))
            )}
          </div>
        )}

        <button type="button" className="ad-spot-toggle-btn" onClick={loadKyc}>
          <i className={`fas ${showKyc ? 'fa-chevron-down' : 'fa-chevron-right'}`} />
          {' '}<i className="fas fa-id-card" /> KYC / Identity
        </button>
        {showKyc && (
          <div className="ad-spot-kyc">
            {!kyc ? (
              <div className="ad-spot-panel-loading">
                {kyc === null ? <><i className="fas fa-spinner fa-spin" /> Loading...</> : 'No KYC on file'}
              </div>
            ) : (
              <div className="ad-spot-kyc-grid">
                <div><strong>Full Name:</strong> {kyc.legal_full_name || '—'}</div>
                <div><strong>DOB:</strong> {kyc.date_of_birth || '—'}</div>
                <div><strong>ID Type:</strong> {kyc.id_document_type || '—'}</div>
                <div><strong>ID Number:</strong> {kyc.id_document_number || '—'}</div>
                <div><strong>Country (Birth):</strong> {kyc.country_of_birth || '—'}</div>
                <div><strong>Country (Residence):</strong> {kyc.country_of_residence || '—'}</div>
                <div><strong>Phone:</strong> {kyc.phone_number || '—'}</div>
                <div><strong>Address:</strong> {[kyc.address_line1, kyc.address_line2, kyc.city].filter(Boolean).join(', ') || '—'}</div>
                <div><strong>Terms Accepted:</strong> {kyc.accepted_terms ? '✅' : '❌'}</div>
                {kyc.legal_consent_at && <div><strong>Consent At:</strong> {fmtDateTime(kyc.legal_consent_at)}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────────

function FilterBar({ status, setStatus, category, setCategory, query, setQuery }) {
  const statuses = ['', 'pending', 'under_review', 'info_requested', 'approved', 'rejected'];
  const categories = ['', 'talent', 'commerce', 'course', 'other'];

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
      <div className="ad-spot-filter-group">
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>{c ? (CATEGORY_CFG[c]?.label || c) : 'All Categories'}</option>
          ))}
        </select>
      </div>
      <div className="ad-spot-filter-group ad-spot-filter-search">
        <label>Search</label>
        <input
          type="text"
          placeholder="Search by username, title, description..."
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

export default function AdminSpotlightReview({ lang = 'ht', showToast, user, onNavigate }) {
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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
      if (categoryFilter) params.category = categoryFilter;
      if (query.trim()) params.q = query.trim();
      const res = await api.get('spotlight/admin-all/', { params });
      const data = res.data?.results || res.data || [];
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load applications');
      setApplications([]);
    } finally { setLoading(false); }
  }, [statusFilter, categoryFilter, query, refreshKey]);

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
          <p>You need staff permissions to manage spotlight applications.</p>
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
              <i className="fas fa-lightbulb" aria-hidden="true" /> Spotlight Applications
            </h1>
            <p className="ad-spot-subtitle">Review, approve, reject, and manage all spotlight applications</p>
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
        category={categoryFilter} setCategory={setCategoryFilter}
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
              <p>No applications found</p>
              {(statusFilter || categoryFilter || query) && (
                <button type="button" onClick={() => { setStatusFilter(''); setCategoryFilter(''); setQuery(''); }}>
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
