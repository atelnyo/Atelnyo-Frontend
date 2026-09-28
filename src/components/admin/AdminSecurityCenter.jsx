/**
 * AdminSecurityCenter — Unified admin view for Media Security & Trust.
 *
 * Combines:
 *   - System Health overview
 *   - Unsafe URLs (blocked/rejected)
 *   - Malicious Reports
 *   - Blocked Domains
 *   - Repeated Failures
 *   - Provider Outages (active incidents)
 *   - Validation Errors
 *   - Creator Warnings
 *   - Spam Attempts
 *   - Recent Security Events
 *
 * Spec: "Admin wè: Unsafe URLs, Malicious Reports, Blocked Domains,
 *        Repeated Failures, Provider Outages, Validation Errors,
 *        Creator Warnings, Spam Attempts. Tout ak filtè avanse."
 *
 * Route: /sheet/admin/security-center
 * Access: Staff / superuser only
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { adminMediaService, mediaProviderService } from '../../services/api';
import '../../styles/trust-center.css';
import MediaHelp from '../media/MediaHelp';

function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function StatCard({ icon, label, value, color, onClick, subtitle }) {
  return (
    <div
      className={`asc-stat-card ${onClick ? 'asc-clickable' : ''}`}
      style={{ '--card-accent': color || 'var(--color-primary, #d81b60)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="asc-stat-icon" style={{ color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="asc-stat-body">
        <div className="asc-stat-value">{value != null ? fmtCount(value) : '—'}</div>
        <div className="asc-stat-label">{label}</div>
        {subtitle && <div className="asc-stat-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

function EventRow({ event, lang }) {
  const isHt = lang === 'ht';
  const statusColors = {
    blocked: { color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
    spam: { color: 'var(--pr-color-orange-500, #f97316)', bg: 'var(--pr-color-orange-500-bg, rgba(249,115,22,0.09))' },
    scam: { color: 'var(--pr-color-orange-500, #f97316)', bg: 'var(--pr-color-orange-500-bg, rgba(249,115,22,0.09))' },
    illegal: { color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.09))' },
    restricted: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
    sensitive: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.09))' },
  };
  const fallback = { color: 'var(--text-secondary, #94a3b8)', bg: 'var(--state-neutral-bg, rgba(148,163,184,0.09))' };
  const sc = statusColors[event.health] || statusColors[event.moderation] || fallback;
  return (
    <div className="asc-event-row">
      <span className="asc-event-dot" style={{ background: sc.color }} />
      <span className="asc-event-url" title={event.url}>{event.url?.slice(0, 60)}</span>
      <span className="asc-event-tag" style={{ background: sc.bg, color: sc.color }}>
        {event.moderation || event.health || '—'}
      </span>
      <span className="asc-event-user">{event.user || '—'}</span>
      <span className="asc-event-date">{event.at ? new Date(event.at).toLocaleDateString() : ''}</span>
    </div>
  );
}

export default function AdminSecurityCenter({ lang = 'ht', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.(
        isHt ? 'Aksè rezeve pou administratè.' : 'Staff access required.',
        'user-lock',
      );
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, isHt, onNavigate, showToast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminMediaService.securityCenter();
      setData(res.data);
    } catch {
      showToast?.(
        isHt ? 'Pa kapab chaje Security Center.' : 'Failed to load Security Center.',
        'exclamation-triangle',
      );
    } finally {
      setLoading(false);
    }
  }, [isHt, showToast]);

  useEffect(() => { if (hasStaffAccess) fetchData(); }, [fetchData, hasStaffAccess]);

  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="asc-shell">
        <div className="asc-empty">
          <i className="fas fa-user-lock" />
          <h3>{isHt ? 'Aksè Rezeve' : 'Staff Access Required'}</h3>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="asc-shell">
        <div className="asc-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>{isHt ? 'Ap chaje Security Center...' : 'Loading Security Center...'}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="asc-shell">
        <div className="asc-empty">
          <i className="fas fa-shield-halved" />
          <h3>{isHt ? 'Pa gen done' : 'No data available'}</h3>
          <button type="button" className="asc-btn" onClick={fetchData}>
            <i className="fas fa-sync" /> {isHt ? 'Eseye ankò' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  const sh = data.system_health || {};
  const unsafe = data.unsafe_urls || {};
  const reports = data.reports || {};
  const blocked = data.blocked_domains || {};
  const events = data.recent_security_events || [];

  return (
    <div className="asc-shell">
      {/* Header */}
      <div className="asc-header">
        <button type="button" className="asc-back" onClick={() => onNavigate?.(-1)}>
          <i className="fas fa-arrow-left" />
        </button>
        <div className="asc-header-center">
          <h1 className="asc-title">
            <i className="fas fa-shield-halved" />{' '}
            {isHt ? 'Sant Sekirite Admin' : 'Admin Security Center'}
          </h1>
          <p className="asc-subtitle">
            {isHt
              ? 'Siveyans sekirite medya avanse ak tout rapò yo.'
              : 'Advanced media security monitoring with all reports.'}
          </p>
        </div>
        <div className="asc-header-actions">
          <button type="button" className="asc-btn" onClick={fetchData}>
            <i className="fas fa-sync" /> {isHt ? 'Rafrechi' : 'Refresh'}
          </button>
          <MediaHelp context="library" lang={lang} />
        </div>
      </div>

      {/* System Health Banner */}
      <div className="asc-health-banner" style={{ borderColor: sh.color || '#94a3b8' }}>
        <div className="asc-health-score" style={{ color: sh.color }}>
          {sh.overall_score || '—'}%
        </div>
        <div className="asc-health-detail">
          <strong>{isHt ? 'Sante Sistèm' : 'System Health'}: {sh.label || 'Unknown'}</strong>
          <span>
            {sh.healthy_providers || 0}/{sh.total_providers || 0} {isHt ? 'provider an sante' : 'healthy providers'} —{' '}
            {sh.avg_availability || 0}% {isHt ? 'disponib' : 'available'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="asc-stats-grid">
        <StatCard
          icon="fa-ban"
          label={isHt ? 'URL Pa Sekirize' : 'Unsafe URLs'}
          value={unsafe.total}
          color="var(--state-error, #ef4444)"
          subtitle={`${unsafe.recent_7d || 0} ${isHt ? 'semèn sa' : 'this week'}`}
        />
        <StatCard
          icon="fa-flag"
          label={isHt ? 'Rapò Malveyan' : 'Malicious Reports'}
          value={reports.total}
          color="var(--pr-color-orange-500, #f97316)"
          subtitle={`${reports.pending || 0} ${isHt ? 'annatant' : 'pending'}`}
        />
        <StatCard
          icon="fa-shield"
          label={isHt ? 'Domain Bloke' : 'Blocked Domains'}
          value={blocked.count}
          color="var(--state-error, #ef4444)"
        />
        <StatCard
          icon="fa-rotate-left"
          label={isHt ? 'Echèk Repete' : 'Repeated Failures'}
          value={data.repeated_failures}
          color="var(--state-warning, #f59e0b)"
          onClick={() => onNavigate?.('/sheet/admin/validation-queue')}
        />
        <StatCard
          icon="fa-triangle-exclamation"
          label={isHt ? 'Ensidan Aktif' : 'Active Incidents'}
          value={data.active_incidents}
          color={data.active_incidents > 0 ? 'var(--state-error, #ef4444)' : 'var(--state-success, #10b981)'}
          onClick={() => onNavigate?.('/sheet/admin/incidents')}
        />
        <StatCard
          icon="fa-times-circle"
          label={isHt ? 'Erè Validasyon (7j)' : 'Validation Errors (7d)'}
          value={data.validation_errors_7d}
          color="var(--state-error, #ef4444)"
        />
        <StatCard
          icon="fa-user-slash"
          label={isHt ? 'Kreyatè ak Avètisman' : 'Creators w/ Warnings'}
          value={data.creators_with_warnings}
          color="var(--state-warning, #f59e0b)"
        />
        <StatCard
          icon="fa-envelope-circle-check"
          label={isHt ? 'Tantativ Spam' : 'Spam Attempts'}
          value={data.spam_attempts}
          color="var(--pr-color-orange-500, #f97316)"
        />
      </div>

      {/* Blocked Domains List */}
      {blocked.domains && blocked.domains.length > 0 && (
        <div className="asc-section">
          <h3 className="asc-section-title">
            <i className="fas fa-ban" style={{ color: 'var(--state-error, #ef4444)' }} />{' '}
            {isHt ? 'Domain Bloke' : 'Blocked Domains'}
          </h3>
          <div className="asc-domain-list">
            {blocked.domains.map((d, i) => (
              <span key={i} className="asc-domain-chip">{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Security Events */}
      <div className="asc-section">
        <h3 className="asc-section-title">
          <i className="fas fa-list" />{' '}
          {isHt ? 'Evènman Sekirite Resan' : 'Recent Security Events'}
          {events.length > 0 && (
            <span className="asc-badge">{events.length}</span>
          )}
        </h3>
        {events.length === 0 ? (
          <div className="asc-empty-mini">
            <i className="fas fa-check-circle" style={{ color: 'var(--state-success, #10b981)' }} />
            <span>{isHt ? 'Pa gen evènman resan.' : 'No recent events.'}</span>
          </div>
        ) : (
          <div className="asc-events-table">
            {events.map((e, i) => (
              <EventRow key={i} event={e} lang={lang} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="asc-section">
        <h3 className="asc-section-title">
          <i className="fas fa-link" />{' '}
          {isHt ? 'Lyen Rapid' : 'Quick Links'}
        </h3>
        <div className="asc-quick-links">
          <button type="button" className="asc-quick-link" onClick={() => onNavigate?.('/sheet/admin/broken-media')}>
            <i className="fas fa-link-slash" /> {isHt ? 'Sant Medya Kase' : 'Broken Media Center'}
          </button>
          <button type="button" className="asc-quick-link" onClick={() => onNavigate?.('/sheet/admin/validation-queue')}>
            <i className="fas fa-list-check" /> {isHt ? 'Fil Validasyon' : 'Validation Queue'}
          </button>
          <button type="button" className="asc-quick-link" onClick={() => onNavigate?.('/sheet/admin/reports')}>
            <i className="fas fa-flag" /> {isHt ? 'Sant Rapò' : 'Report Center'}
          </button>
          <button type="button" className="asc-quick-link" onClick={() => onNavigate?.('/sheet/admin/moderation')}>
            <i className="fas fa-gavel" /> {isHt ? 'Moderasyon' : 'Moderation'}
          </button>
          <button type="button" className="asc-quick-link" onClick={() => onNavigate?.('/sheet/admin/incidents')}>
            <i className="fas fa-triangle-exclamation" /> {isHt ? 'Sant Ensidan' : 'Incident Center'}
          </button>
        </div>
      </div>
    </div>
  );
}
