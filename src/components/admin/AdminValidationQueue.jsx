/**
 * AdminValidationQueue — Pending validation queue for admin.
 *
 * Spec (Phase ADMIN MEDIA CENTER — Validation Queue):
 *   "Tout URL ki poko verifye. Yo antre nan Queue.
 *    Admin wè: Media, Creator, Provider, Validation Started,
 *    Current Status, Retry Count, Risk Level, Last Error,
 *    Duration, Actions: Retry, Inspect, Skip, Force Validation."
 *
 * Route: /sheet/admin/validation-queue
 * Access: Staff / superuser only
 */
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { adminMediaService } from '../../services/api';

const RISK_COLORS = {
  low:    { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.09))' },
  medium: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
  high:   { color: 'var(--state-error, #ef4444)',   bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
};

const STATUS_FILTERS = [
  { value: 'broken', label: 'Broken', icon: 'fa-link-slash', color: 'var(--state-error, #ef4444)' },
  { value: 'checking', label: 'Checking', icon: 'fa-spinner', color: 'var(--state-info, #38bdf8)' },
  { value: 'warning', label: 'Warning', icon: 'fa-triangle-exclamation', color: 'var(--state-warning, #f59e0b)' },
  { value: 'all', label: 'All', icon: 'fa-list', color: 'var(--text-secondary, #64748b)' },
];

function fmtNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function fmtRelative(dateLike) {
  if (!dateLike) return '—';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '< 1m';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function AdminValidationQueue({ lang = 'ht', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('broken');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Admin gate
  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.(
        isHt ? 'Aksè rezeve pou administratè.' : 'Staff access required.',
        'user-lock',
      );
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, isHt, onNavigate, showToast]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminMediaService.validationQueue(statusFilter);
      setQueue(res.data?.queue || []);
      setTotal(res.data?.total || 0);
    } catch {
      showToast?.(
        isHt ? 'Pa kapab chaje ke a.' : 'Failed to load queue.',
        'exclamation-triangle',
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isHt, showToast]);

  useEffect(() => { if (hasStaffAccess) fetchQueue(); }, [fetchQueue, hasStaffAccess]);

  const handleRetry = async (id) => {
    setActionLoading(id);
    try {
      const res = await adminMediaService.retryValidation(id);
      showToast?.(
        res.data?.is_valid
          ? (isHt ? 'Validasyon reyisi!' : 'Validation passed!')
          : (isHt ? 'Toujou kase.' : 'Still broken.'),
        res.data?.is_valid ? 'check-circle' : 'exclamation-triangle',
      );
      fetchQueue();
    } catch {
      showToast?.(isHt ? 'Erè retry.' : 'Retry failed.', 'exclamation-triangle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async (id) => {
    setActionLoading(id);
    try {
      await adminMediaService.skipValidation(id);
      showToast?.(isHt ? 'Sote.' : 'Skipped.', 'check');
      fetchQueue();
    } catch {
      showToast?.(isHt ? 'Erè skip.' : 'Skip failed.', 'exclamation-triangle');
    } finally {
      setActionLoading(null);
    }
  };

  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="avq-shell">
        <div className="avq-empty">
          <i className="fas fa-user-lock" />
          <h3>{isHt ? 'Aksè Rezeve' : 'Staff Access Required'}</h3>
          <p>{isHt ? 'Ou bezwen pèmisyon administratè.' : 'You need staff permissions.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="avq-shell">
      {/* Header */}
      <div className="avq-header">
        <button type="button" className="avq-back" onClick={() => onNavigate?.(-1)}>
          <i className="fas fa-arrow-left" />
        </button>
        <div className="avq-header-center">
          <h1 className="avq-title">
            <i className="fas fa-spinner" /> {isHt ? 'Ke Validasyon' : 'Validation Queue'}
          </h1>
          <p className="avq-subtitle">
            {isHt
              ? `${fmtNumber(total)} validasyon annatant.`
              : `${fmtNumber(total)} validations pending.`}
          </p>
        </div>
        <div className="avq-header-actions">
          <button type="button" className="avq-btn" onClick={fetchQueue}>
            <i className="fas fa-sync" /> {isHt ? 'Rafrechi' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="avq-filters">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`avq-filter-btn ${statusFilter === f.value ? 'avq-filter-active' : ''}`}
            style={{ '--filter-accent': f.color }}
            onClick={() => setStatusFilter(f.value)}
          >
            <i className={`fas ${f.icon}`} />
            {f.label}
          </button>
        ))}
      </div>

      {/* Queue Table */}
      <div className="avq-body">
        {loading ? (
          <div className="avq-loading">
            <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}
          </div>
        ) : queue.length === 0 ? (
          <div className="avq-empty">
            <i className="fas fa-check-circle" style={{ opacity: 0.3 }} />
            <p>{isHt ? 'Pa gen validasyon annatant.' : 'No pending validations.'}</p>
          </div>
        ) : (
          <div className="avq-table-wrap">
            <table className="avq-table">
              <thead>
                <tr>
                  <th>{isHt ? 'Medya' : 'Media'}</th>
                  <th>{isHt ? 'Kreyatè' : 'Creator'}</th>
                  <th>{isHt ? 'Provider' : 'Provider'}</th>
                  <th>{isHt ? 'Retry' : 'Retries'}</th>
                  <th>{isHt ? 'Risk' : 'Risk'}</th>
                  <th>{isHt ? 'Dènye Erè' : 'Last Error'}</th>
                  <th>{isHt ? 'Depi' : 'Since'}</th>
                  <th>{isHt ? 'Aksyon' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id} className="avq-row">
                    <td className="avq-cell-url" title={item.url}>
                      <span className="avq-url">{item.url?.slice(0, 50)}{item.url?.length > 50 ? '…' : ''}</span>
                    </td>
                    <td>{item.creator || '—'}</td>
                    <td>
                      <span className="avq-provider-badge">{item.provider || '—'}</span>
                    </td>
                    <td className="avq-cell-center">
                      <span className={`avq-retry-count ${item.retry_count >= 3 ? 'avq-retry-high' : ''}`}>
                        {item.retry_count}
                      </span>
                    </td>
                    <td className="avq-cell-center">
                      <span
                        className="avq-risk-badge"
                        style={{ background: (RISK_COLORS[item.risk_level] || RISK_COLORS.low).bg, color: (RISK_COLORS[item.risk_level] || RISK_COLORS.low).color }}
                      >
                        {item.risk_level || 'low'}
                      </span>
                    </td>
                    <td className="avq-cell-error" title={item.last_error}>
                      {item.last_error?.slice(0, 80) || '—'}
                    </td>
                    <td className="avq-cell-time">{fmtRelative(item.created_at)}</td>
                    <td className="avq-cell-actions">
                      <button
                        type="button"
                        className="avq-action-btn avq-action-retry"
                        title={isHt ? 'Rekòmanse' : 'Retry'}
                        onClick={() => handleRetry(item.id)}
                        disabled={actionLoading === item.id}
                      >
                        <i className={`fas ${actionLoading === item.id ? 'fa-spinner fa-spin' : 'fa-rotate'}`} />
                      </button>
                      <button
                        type="button"
                        className="avq-action-btn avq-action-skip"
                        title={isHt ? 'Sote' : 'Skip'}
                        onClick={() => handleSkip(item.id)}
                        disabled={actionLoading === item.id}
                      >
                        <i className="fas fa-forward" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
