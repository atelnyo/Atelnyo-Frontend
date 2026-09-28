/**
 * src/components/admin/AdminCreatorReview.jsx
 *
 * Admin Creator Review Dashboard.
 * ================================
 *
 * Allows staff/superusers to review creator applications:
 *   - List all applications with status filters
 *   - View applicant details (bio, skills, portfolio, etc.)
 *   - Approve / Reject / Mark as Under Review
 *   - Add review notes
 *
 * API endpoints:
 *   GET  /api/identity/creator-apply/admin_all/  — list all applications
 *   PATCH /api/identity/creator-apply/{id}/review/  — review action
 *
 * Route: /sheet/admin/creators (accessible only to staff/superusers)
 *
 * Uses Theme Engine (CSS variables) and supports dark mode.
 */

// React itself is unused here — the new JSX runtime
// (configured by @vitejs/plugin-react) auto-injects the
// jsx-runtime import, so a default React import isn't
// needed. Dropping it keeps the dep graph clean and
// silences future "unused React" warnings.
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import api from '../../services/api';
import { CREATOR_STATUS_CONFIG, getStatusConfig, getStatusLabel, getStatusIcon, getStatusStyle } from '../../constants/statusConfig';

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return '—'; }
}

function fmtNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ═══════════════════════════════════════════════════════════════════════
// RiskScoreBadge — Risk Analysis Widget
// ═══════════════════════════════════════════════════════════════════════

function RiskScoreBadge({ score }) {
  const numScore = parseFloat(score) || 0;
  let color = '#10b981'; // low risk
  let label = 'Low Risk';
  if (numScore >= 0.7) {
    color = '#ef4444';
    label = 'High Risk';
  } else if (numScore >= 0.4) {
    color = '#f59e0b';
    label = 'Medium Risk';
  }
  return (
    <div className="admin-cr-risk-badge" style={{ borderColor: color }}>
      <div className="admin-cr-risk-bar">
        <div className="admin-cr-risk-fill" style={{ width: `${Math.min(numScore * 100, 100)}%`, background: color }} />
      </div>
      <div className="admin-cr-risk-info">
        <span className="admin-cr-risk-score" style={{ color }}>{label}</span>
        <span className="admin-cr-risk-value">{(numScore * 100).toFixed(0)}%</span>
      </div>
      {numScore >= 0.4 && (
        <p className="admin-cr-risk-hint">
          <i className="fas fa-exclamation-circle" style={{ color }} aria-hidden="true" />
          {' '}{numScore >= 0.7 ? 'Review carefully — high risk score' : 'Moderate risk — verify documents'}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TimelineWidget — Application Timeline
// ═══════════════════════════════════════════════════════════════════════

function TimelineWidget({ timeline }) {
  const entries = Array.isArray(timeline) ? timeline : [];
  if (entries.length === 0) return null;

  return (
    <div className="admin-cr-timeline-widget">
      <h4 className="admin-cr-timeline-title">
        <i className="fas fa-clock-rotate-left" aria-hidden="true" />
        {' '}Review Timeline
      </h4>
      <div className="admin-cr-timeline-list">
        {entries.map((entry, i) => {
          const actionCfg = getStatusConfig(entry.action, CREATOR_STATUS_CONFIG);
          const isLatest = i === entries.length - 1;
          return (
            <div key={i} className={`admin-cr-tl-item${isLatest ? ' admin-cr-tl-latest' : ''}`}>
              <div className="admin-cr-tl-dot" style={{ background: actionCfg?.color || '#94a3b8' }} />
              <div className="admin-cr-tl-content">
                <strong>{entry.action}</strong>
                {entry.note && <p>{entry.note}</p>}
                <small>
                  <i className="fas fa-user" aria-hidden="true" /> {entry.by || '—'}
                  {' · '}
                  <i className="fas fa-clock" aria-hidden="true" /> {entry.at ? new Date(entry.at).toLocaleString() : '—'}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// StatusPill — Using Universal StatusConfig
// ═══════════════════════════════════════════════════════════════════════

function StatusPill({ status }) {
  const cfg = getStatusConfig(status, CREATOR_STATUS_CONFIG);
  const icon = getStatusIcon(status, CREATOR_STATUS_CONFIG);
  const label = getStatusLabel(status, 'en', CREATOR_STATUS_CONFIG);
  const style = getStatusStyle(status, CREATOR_STATUS_CONFIG);
  return (
    <span className="admin-cr-pill" style={style}>
      <i className={`fas ${icon}`} aria-hidden="true" style={{ fontSize: '0.65rem' }} />
      {' '}{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ReviewModal — With Risk Widget + Enriched Status Options
// ═══════════════════════════════════════════════════════════════════════

function ReviewModal({ application, onClose, onReviewed, showToast }) {
  const [status, setStatus] = useState(application.status);
  const [reviewNote, setReviewNote] = useState(application.review_note || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (status === application.status && !reviewNote.trim()) {
      showToast?.('No changes made.', 'info-circle');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.patch(`identity/creator-apply/${application.id}/review/`, {
        status,
        review_note: reviewNote.trim(),
      });
      showToast?.(
        status === 'approved'
          ? `✅ ${application.applicant_username || application.user?.username || 'User'} approved as creator!`
          : status === 'rejected'
            ? `❌ ${application.applicant_username || application.user?.username || 'User'} rejected.`
            : status === 'need_information'
              ? `ℹ️ Info requested from ${application.applicant_username || application.user?.username || 'User'}`
              : `🔍 ${application.applicant_username || application.user?.username || 'User'} marked as under review.`,
        'check-circle',
      );
      onReviewed?.();
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.message
        || 'Review failed. Please try again.';
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [application, status, reviewNote, showToast, onReviewed, onClose]);

  const reviewStatusOptions = ['approved', 'rejected', 'under_review', 'need_information'];

  return (
    <div
      className="admin-cr-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Review application"
    >
      <div className="admin-cr-modal admin-cr-modal-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-cr-modal-header">
          <div>
            <h3 className="admin-cr-modal-title">
              <i className="fas fa-clipboard-check" aria-hidden="true" />
              {' '}Review: {application.applicant_username || application.user?.username || 'Unknown'}
            </h3>
            <p className="admin-cr-modal-subtitle">
              Submitted {fmtDateTime(application.created_at)}
              {' · '}Current: <StatusPill status={application.status} />
            </p>
          </div>
          <button type="button" className="admin-cr-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        {/* Two-column layout: Applicant Details + Risk Analysis */}
        <div className="admin-cr-review-layout">
          {/* ─── Left: Applicant Details ──────────────────────────── */}
          <div className="admin-cr-details">
            <div className="admin-cr-details-grid admin-cr-details-grid-2col">
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Email</span>
                <span className="admin-cr-detail-value">{application.applicant_email || application.user?.email || '—'}</span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Country</span>
                <span className="admin-cr-detail-value">{application.country || '—'}</span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Full Name</span>
                <span className="admin-cr-detail-value">{application.full_name || '—'}</span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Why Creator</span>
                <span className="admin-cr-detail-value">{application.why_creator || '—'}</span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Experience</span>
                <span className="admin-cr-detail-value">{application.experience_years || '—'} years</span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Applic. Count</span>
                <span className="admin-cr-detail-value">
                  {application.previous_application ? 'Re-apply' : 'First'}
                  {application.report_count > 0 && ` · ${application.report_count} reports`}
                  {application.violation_count > 0 && ` · ${application.violation_count} violations`}
                </span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Skills</span>
                <span className="admin-cr-detail-value">
                  {Array.isArray(application.skills) && application.skills.length > 0
                    ? application.skills.join(', ')
                    : '—'}
                </span>
              </div>
              <div className="admin-cr-detail-item">
                <span className="admin-cr-detail-label">Portfolio</span>
                <span className="admin-cr-detail-value">
                  {application.portfolio_url
                    ? <a href={application.portfolio_url} target="_blank" rel="noopener noreferrer">View <i className="fas fa-external-link-alt" style={{ fontSize: '0.65rem' }} /></a>
                    : '—'}
                </span>
              </div>
            </div>
            <div className="admin-cr-detail-item" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
              <span className="admin-cr-detail-label">Biography</span>
              <p className="admin-cr-bio">{application.biography || '—'}</p>
            </div>
          </div>

          {/* ─── Right: Risk Analysis + Timeline ──────────────────── */}
          <div className="admin-cr-risk-panel">
            <h4 className="admin-cr-panel-title">
              <i className="fas fa-shield-alt" aria-hidden="true" />
              {' '}Risk Analysis
            </h4>
            <RiskScoreBadge score={application.risk_score} />
            <div className="admin-cr-risk-stats">
              <div className="admin-cr-risk-stat">
                <i className="fas fa-flag" aria-hidden="true" />
                <span>{fmtNumber(application.report_count)} Reports</span>
              </div>
              <div className="admin-cr-risk-stat">
                <i className="fas fa-gavel" aria-hidden="true" />
                <span>{fmtNumber(application.violation_count)} Violations</span>
              </div>
              <div className="admin-cr-risk-stat">
                <i className="fas fa-retweet" aria-hidden="true" />
                <span>{application.previous_application ? 'Previous app exists' : 'First application'}</span>
              </div>
            </div>

            {application.review_timeline && (
              <TimelineWidget timeline={application.review_timeline} />
            )}
          </div>
        </div>

        {/* Previous review note */}
        {application.reviewed_by && (
          <div className="admin-cr-previous-review" style={{ margin: '12px 0' }}>
            <i className="fas fa-history" aria-hidden="true" />
            Previously reviewed by {application.reviewer_username || application.reviewed_by?.username || 'someone'}
            {' on '}{fmtDateTime(application.reviewed_at)}
            {application.review_note && <span>: "{application.review_note}"</span>}
          </div>
        )}

        {/* Review form */}
        <form onSubmit={handleSubmit} className="admin-cr-form">
          {error && <div className="admin-cr-error" role="alert">{error}</div>}
          
          <div className="admin-cr-status-options">
            {reviewStatusOptions.map((opt) => {
              const cfg = getStatusConfig(opt, CREATOR_STATUS_CONFIG);
              const icon = getStatusIcon(opt, CREATOR_STATUS_CONFIG);
              const label = getStatusLabel(opt, 'en', CREATOR_STATUS_CONFIG);
              const style = getStatusStyle(opt, CREATOR_STATUS_CONFIG);
              return (
                <button
                  key={opt}
                  type="button"
                  className={classNames('admin-cr-status-option', status === opt && 'admin-cr-status-option-selected')}
                  style={status === opt ? { borderColor: style.borderColor, background: style.backgroundColor } : {}}
                  onClick={() => setStatus(opt)}
                >
                  <i className={`fas ${icon}`} style={{ color: style.color }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <label className="admin-cr-field">
            <span className="admin-cr-field-label">Review Note</span>
            <textarea
              className="field-input field-textarea"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a note explaining your decision..."
              rows={3}
              maxLength={2000}
            />
          </label>

          <div className="admin-cr-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Submitting...</>
              ) : (
                <><i className="fas fa-paper-plane" aria-hidden="true" /> Submit Review</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ApplicationCard
// ═══════════════════════════════════════════════════════════════════════

function ApplicationCard({ app, onReview, showToast }) {
  const isPendingAction = app.status === 'pending' || app.status === 'under_review';
  const needsAttention = app.status === 'pending';

  return (
    <div className={classNames('admin-cr-card', needsAttention && 'admin-cr-card-urgent')}>
      <div className="admin-cr-card-top">
        <div className="admin-cr-card-user">
          <div className="admin-cr-card-avatar">
            {(app.applicant_username || app.user?.username || '?').charAt(0).toUpperCase()}
          </div>
          <div className="admin-cr-card-user-info">
            <div className="admin-cr-card-username">{app.applicant_username || app.user?.username || 'Unknown'}</div>
            <div className="admin-cr-card-email">{app.applicant_email || app.user?.email || '—'}</div>
          </div>
        </div>
        <StatusPill status={app.status} />
      </div>

      <div className="admin-cr-card-meta">
        <span title="Submitted">
          <i className="fas fa-calendar" aria-hidden="true" /> {fmtDate(app.created_at)}
        </span>
        {app.country && (
          <span title="Country">
            <i className="fas fa-map-marker-alt" aria-hidden="true" /> {app.country}
          </span>
        )}
        {Array.isArray(app.skills) && app.skills.length > 0 && (
          <span title="Skills">
            <i className="fas fa-code" aria-hidden="true" /> {app.skills.slice(0, 3).join(', ')}
            {app.skills.length > 3 && ` +${app.skills.length - 3}`}
          </span>
        )}
        {(app.reviewer_username || app.reviewed_by) && (
          <span title="Reviewer">
            <i className="fas fa-user-check" aria-hidden="true" /> {app.reviewer_username || app.reviewed_by}
          </span>
        )}
      </div>

      {app.biography && (
        <p className="admin-cr-card-bio">{app.biography.slice(0, 200)}{app.biography.length > 200 ? '...' : ''}</p>
      )}

      {app.review_note && (
        <div className="admin-cr-card-note">
          <i className="fas fa-quote-left" aria-hidden="true" />
          {app.review_note}
        </div>
      )}

      <div className="admin-cr-card-actions">
        <button
          type="button"
          className={classNames(
            'admin-cr-btn',
            isPendingAction ? 'btn-primary' : 'btn-secondary',
          )}
          onClick={() => onReview(app)}
        >
          <i className={`fas ${isPendingAction ? 'fa-clipboard-check' : 'fa-redo'}`} aria-hidden="true" />
          {isPendingAction ? 'Review' : 'Re-review'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Loading / Empty States
// ═══════════════════════════════════════════════════════════════════════

function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="admin-cr-skel-list" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-cr-skel-row" aria-hidden="true" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, hint }) {
  return (
    <div className="admin-cr-empty" role="status">
      <i className={`fas ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

const FILTER_OPTIONS = [
  { value: '',     label: 'All',        icon: 'fa-list' },
  { value: 'pending',      label: 'Pending',      icon: 'fa-hourglass-half' },
  { value: 'under_review', label: 'Under Review', icon: 'fa-magnifying-glass' },
  { value: 'approved',     label: 'Approved',     icon: 'fa-circle-check' },
  { value: 'rejected',     label: 'Rejected',     icon: 'fa-circle-xmark' },
];

export default function AdminCreatorReview({ lang = 'ht', showToast, user, onNavigate }) {
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);

  // ─── Admin gate ────────────────────────────────────────────────
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.('Staff access required.', 'user-lock');
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, onNavigate, showToast]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filter) params.status = filter;
      if (searchQuery.trim()) params.q = searchQuery.trim();
      const res = await api.get('identity/creator-apply/admin_all/', { params });
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setApplications(data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load applications.';
      setError(msg);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // ─── Early return for non-staff ─────────────────────────────────
  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="admin-cr-shell">
        <div className="admin-cr-empty">
          <i className="fas fa-user-lock" aria-hidden="true" />
          <h3>Staff Access Required</h3>
          <p>You need staff permissions to view this page.</p>
        </div>
      </div>
    );
  }

  const pendingCount = applications?.filter((a) => a.status === 'pending').length || 0;
  const allCount = applications?.length || 0;

  return (
    <div className="admin-cr-shell">
      {/* Header */}
      <div className="admin-cr-header">
        <div className="admin-cr-header-left">
          <button
            type="button"
            className="admin-cr-back"
            onClick={() => onNavigate?.(-1)}
            aria-label="Back"
          >
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <div>
            <h1 className="admin-cr-title">
              <i className="fas fa-users-gear" aria-hidden="true" />
              {' '}Creator Review
            </h1>
            <p className="admin-cr-subtitle">
              {pendingCount > 0
                ? `${pendingCount} pending application${pendingCount > 1 ? 's' : ''} need${pendingCount === 1 ? 's' : ''} review`
                : `${allCount} application${allCount !== 1 ? 's' : ''} total`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-cr-filters">
        <div className="admin-cr-filter-tabs">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={classNames('admin-cr-filter-tab', filter === opt.value && 'admin-cr-filter-tab-active')}
              onClick={() => setFilter(opt.value)}
            >
              <i className={`fas ${opt.icon}`} aria-hidden="true" />
              <span>{opt.label}</span>
              {opt.value === '' && allCount > 0 && <span className="admin-cr-count-badge">{allCount}</span>}
              {opt.value === 'pending' && pendingCount > 0 && <span className="admin-cr-count-badge">{pendingCount}</span>}
            </button>
          ))}
        </div>
        <div className="admin-cr-search">
          <i className="fas fa-search" aria-hidden="true" />
          <input
            className="admin-cr-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username or email..."
            aria-label="Search applications"
          />
          {searchQuery && (
            <button
              type="button"
              className="admin-cr-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="admin-cr-content">
        {loading && applications === null ? (
          <LoadingSkeleton rows={5} />
        ) : error ? (
          <EmptyState
            icon="fa-circle-exclamation"
            title="Failed to load"
            hint={error}
          />
        ) : !applications || applications.length === 0 ? (
          <EmptyState
            icon="fa-inbox"
            title={filter ? `No ${filter} applications` : 'No applications yet'}
            hint={filter
              ? `No applications with status "${filter}". Try a different filter.`
              : 'Applications from aspiring creators will appear here.'}
          />
        ) : (
          <div className="admin-cr-grid">
            {applications.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                onReview={setReviewTarget}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>

      {/* Refresh */}
      {applications && applications.length > 0 && (
        <div className="admin-cr-footer">
          <button type="button" className="admin-cr-refresh-btn" onClick={fetchApplications}>
            <i className="fas fa-rotate" aria-hidden="true" />
            {' '}Refresh
          </button>
          <span className="admin-cr-count-text">{allCount} application{allCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <ReviewModal
          application={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onReviewed={fetchApplications}
          showToast={showToast}
        />
      )}
    </div>
  );
}
