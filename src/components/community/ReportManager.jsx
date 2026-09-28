/**
 * src/components/community/ReportManager.jsx
 *
 * Advanced Report Management for Community Managers.
 *
 * Features:
 *   - Priority-based report queue
 *   - Batch processing (resolve/dismiss multiple)
 *   - Report escalation system
 *   - Reporter feedback loop
 *   - Report analytics
 *   - Auto-escalation for repeat offenders
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────

const REPORT_REASONS = {
  spam: { label: 'Spam', icon: 'fa-ban', color: '#6b7280' },
  harassment: { label: 'Harassment', icon: 'fa-user-slash', color: '#dc2626' },
  fake_profile: { label: 'Fake Profile', icon: 'fa-user-secret', color: '#ea580c' },
  violence: { label: 'Violence', icon: 'fa-fist-raised', color: '#991b1b' },
  scam: { label: 'Scam', icon: 'fa-money-bill-wave', color: '#d97706' },
  illegal: { label: 'Illegal Content', icon: 'fa-gavel', color: '#7c3aed' },
  copyright: { label: 'Copyright', icon: 'fa-copyright', color: '#2563eb' },
  other: { label: 'Other', icon: 'fa-flag', color: '#6b7280' },
};

const REPORT_STATUSES = {
  pending: { label: 'Pending', color: '#f59e0b', icon: 'fa-clock' },
  reviewed: { label: 'Reviewed', color: '#3b82f6', icon: 'fa-eye' },
  escalated: { label: 'Escalated', color: '#dc2626', icon: 'fa-arrow-up' },
  resolved: { label: 'Resolved', color: '#10b981', icon: 'fa-check-circle' },
  dismissed: { label: 'Dismissed', color: '#6b7280', icon: 'fa-times-circle' },
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getReportPriority(report) {
  if (report.severity === 'critical') return 4;
  if (report.severity === 'high') return 3;
  if (report.report_count > 5) return 3;
  if (report.report_count > 2) return 2;
  return 1;
}

// ─── Report Card ──────────────────────────────────────────────────

function ReportCard({ report, selected, onSelect, onAction, onExpand, expanded, lang }) {
  const reason = REPORT_REASONS[report.reason] || REPORT_REASONS.other;
  const status = REPORT_STATUSES[report.status] || REPORT_STATUSES.pending;
  const priority = getReportPriority(report);

  return (
    <div className={`rm-report ${selected ? 'rm-report-selected' : ''} rm-priority-${priority}`}>
      <div className="rm-report-main">
        <div className="rm-report-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.(report.id)}
          />
        </div>

        <div className="rm-report-priority">
          {Array.from({ length: priority }, (_, i) => (
            <i key={i} className="fas fa-circle" style={{ fontSize: '6px', color: priority >= 3 ? '#dc2626' : priority >= 2 ? '#f59e0b' : '#10b981' }} />
          ))}
        </div>

        <div className="rm-report-body" onClick={() => onExpand?.(report.id)}>
          <div className="rm-report-header">
            <div className="rm-report-reason" style={{ color: reason.color }}>
              <i className={`fas ${reason.icon}`} /> {reason.label}
            </div>
            <div className="rm-report-status" style={{ color: status.color }}>
              <i className={`fas ${status.icon}`} /> {status.label}
            </div>
          </div>

          <div className="rm-report-target">
            <i className="fas fa-bullseye" />
            <span>{report.target_type} by {report.target_author}</span>
          </div>

          <div className="rm-report-reporter">
            <i className="fas fa-user" />
            <span>Reported by {report.reporter_name}</span>
            <span className="rm-report-time">{formatTimeAgo(report.created_at)}</span>
          </div>

          {report.description && (
            <div className="rm-report-description">
              "{report.description.substring(0, 150)}{report.description.length > 150 ? '...' : ''}"
            </div>
          )}

          {report.report_count > 1 && (
            <div className="rm-report-count">
              <i className="fas fa-users" /> {report.report_count} users reported this
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="rm-report-expanded">
          <div className="rm-report-details">
            <div className="rm-report-detail">
              <strong>Evidence:</strong>
              {report.evidence_urls?.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="rm-evidence-link">
                  <i className="fas fa-external-link-alt" /> Evidence {i + 1}
                </a>
              ))}
            </div>
            {report.context && (
              <div className="rm-report-detail">
                <strong>Context:</strong> {report.context}
              </div>
            )}
          </div>

          <div className="rm-report-actions">
            <button className="rm-btn rm-btn-resolve" onClick={() => onAction?.('resolve', report)}>
              <i className="fas fa-check" /> {lang === 'ht' ? 'Rezoud' : 'Resolve'}
            </button>
            <button className="rm-btn rm-btn-dismiss" onClick={() => onAction?.('dismiss', report)}>
              <i className="fas fa-times" /> {lang === 'ht' ? 'Rejte' : 'Dismiss'}
            </button>
            <button className="rm-btn rm-btn-escalate" onClick={() => onAction?.('escalate', report)}>
              <i className="fas fa-arrow-up" /> {lang === 'ht' ? 'Eskale' : 'Escalate'}
            </button>
            <button className="rm-btn rm-btn-ban" onClick={() => onAction?.('ban', report)}>
              <i className="fas fa-ban" /> {lang === 'ht' ? 'Bloke' : 'Ban User'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report Analytics ─────────────────────────────────────────────

function ReportAnalytics({ stats, lang }) {
  if (!stats) return null;

  const total = stats.total || 0;
  const byReason = stats.by_reason || {};
  const byStatus = stats.by_status || {};
  const topReported = stats.top_reported_users || [];

  return (
    <div className="rm-analytics">
      <h4>
        <i className="fas fa-chart-bar" />
        {lang === 'ht' ? 'Analiz Rapò' : 'Report Analytics'}
      </h4>

      <div className="rm-analytics-grid">
        <div className="rm-analytics-card">
          <div className="rm-analytics-value">{total}</div>
          <div className="rm-analytics-label">{lang === 'ht' ? 'Tout Rapò' : 'Total Reports'}</div>
        </div>
        <div className="rm-analytics-card">
          <div className="rm-analytics-value">{stats.pending || 0}</div>
          <div className="rm-analytics-label">{lang === 'ht' ? 'An atant' : 'Pending'}</div>
        </div>
        <div className="rm-analytics-card">
          <div className="rm-analytics-value">{stats.escalated || 0}</div>
          <div className="rm-analytics-label">{lang === 'ht' ? 'Eskale' : 'Escalated'}</div>
        </div>
        <div className="rm-analytics-card">
          <div className="rm-analytics-value">{stats.resolved_today || 0}</div>
          <div className="rm-analytics-label">{lang === 'ht' ? 'Rezoud Jodi a' : 'Resolved Today'}</div>
        </div>
      </div>

      {/* By Reason */}
      <div className="rm-analytics-section">
        <h5>{lang === 'ht' ? 'Pa Rezon' : 'By Reason'}</h5>
        <div className="rm-bar-chart">
          {Object.entries(byReason).map(([reason, count]) => {
            const r = REPORT_REASONS[reason] || REPORT_REASONS.other;
            const percentage = total > 0 ? (count / total * 100) : 0;
            return (
              <div key={reason} className="rm-bar-row">
                <div className="rm-bar-label">
                  <i className={`fas ${r.icon}`} style={{ color: r.color }} /> {r.label}
                </div>
                <div className="rm-bar-track">
                  <div className="rm-bar-fill" style={{ width: `${percentage}%`, background: r.color }} />
                </div>
                <div className="rm-bar-value">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Reported Users */}
      {topReported.length > 0 && (
        <div className="rm-analytics-section">
          <h5>{lang === 'ht' ? 'Plis Rapòte' : 'Most Reported'}</h5>
          <div className="rm-top-list">
            {topReported.slice(0, 5).map((user, idx) => (
              <div key={idx} className="rm-top-item">
                <span className="rm-top-rank">#{idx + 1}</span>
                <span className="rm-top-name">{user.username}</span>
                <span className="rm-top-count">{user.report_count} reports</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Actions Bar ─────────────────────────────────────────────

function BulkActionsBar({ selectedCount, onBulkAction, onClear, lang }) {
  if (selectedCount === 0) return null;

  return (
    <div className="rm-bulk-bar">
      <div className="rm-bulk-info">
        <span className="rm-bulk-count">{selectedCount}</span>
        {lang === 'ht' ? ' seleksyone' : ' selected'}
      </div>
      <div className="rm-bulk-actions">
        <button className="rm-btn rm-btn-resolve" onClick={() => onBulkAction('resolve')}>
          <i className="fas fa-check" /> Resolve All
        </button>
        <button className="rm-btn rm-btn-dismiss" onClick={() => onBulkAction('dismiss')}>
          <i className="fas fa-times" /> Dismiss All
        </button>
        <button className="rm-btn rm-btn-escalate" onClick={() => onBulkAction('escalate')}>
          <i className="fas fa-arrow-up" /> Escalate All
        </button>
        <button className="rm-btn rm-btn-clear" onClick={onClear}>
          <i className="fas fa-times" /> Clear
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function ReportManager({ community, lang = 'ht', showToast }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({});
  const [stats, setStats] = useState({});
  const [showAnalytics, setShowAnalytics] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const [reportsRes, statsRes] = await Promise.allSettled([
        api.get(`/communities/${community?.id}/moderation/reports/?${params}`),
        api.get(`/communities/${community?.id}/moderation/reports/stats/`),
      ]);

      if (reportsRes.status === 'fulfilled') {
        setReports(Array.isArray(reportsRes.value.data) ? reportsRes.value.data : (reportsRes.value.data?.results || []));
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || {});
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [community?.id, filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleAction = useCallback(async (action, report) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/reports/${action}/`, {
        report_id: report.id,
        reason: report.reason,
      });
      fetchReports();
      showToast?.(
        lang === 'ht' ? 'Aksyon reyisi!' : 'Action completed!',
        'success'
      );
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  }, [community?.id, lang, showToast, fetchReports]);

  const handleBulkAction = useCallback(async (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      await api.post(`/communities/${community?.id}/moderation/reports/bulk-${action}/`, { ids });
      setSelectedIds(new Set());
      fetchReports();
      showToast?.(
        lang === 'ht' ? `${ids.length} rapò trete!` : `${ids.length} reports processed!`,
        'success'
      );
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  }, [community?.id, selectedIds, lang, showToast, fetchReports]);

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => getReportPriority(b) - getReportPriority(a));
  }, [reports]);

  return (
    <div className="rm-container">
      <div className="rm-header">
        <h3>
          <i className="fas fa-flag" />
          {lang === 'ht' ? 'Jesyon Rapò' : 'Report Manager'}
        </h3>
        <div className="rm-header-actions">
          <button className="rm-btn rm-btn-analytics" onClick={() => setShowAnalytics(!showAnalytics)}>
            <i className="fas fa-chart-bar" /> Analytics
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rm-filters">
        <select value={filters.status || ''} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={filters.reason || ''} onChange={(e) => setFilters(f => ({ ...f, reason: e.target.value }))}>
          <option value="">All Reasons</option>
          {Object.entries(REPORT_REASONS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Analytics */}
      {showAnalytics && <ReportAnalytics stats={stats} lang={lang} />}

      {/* Bulk Actions */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onBulkAction={handleBulkAction}
        onClear={() => setSelectedIds(new Set())}
        lang={lang}
      />

      {/* Report List */}
      <div className="rm-list">
        {sortedReports.length === 0 && !loading ? (
          <div className="rm-empty">
            <i className="fas fa-check-circle" />
            <p>{lang === 'ht' ? 'Pa gen rapò nan atant' : 'No pending reports'}</p>
          </div>
        ) : (
          sortedReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              selected={selectedIds.has(report.id)}
              onSelect={handleSelect}
              onAction={handleAction}
              onExpand={handleExpand}
              expanded={expandedId === report.id}
              lang={lang}
            />
          ))
        )}

        {loading && (
          <div className="rm-loading">
            <i className="fas fa-spinner fa-spin" />
            <span>{lang === 'ht' ? 'Ap chaje...' : 'Loading...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
