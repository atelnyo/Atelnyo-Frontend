/**
 * src/components/admin/AdminUserManagement.jsx
 *
 * Admin User Management — Premium Entitlements.
 * =============================================
 *
 * Allows staff/superusers to:
 *   - List users with premium status + expiry (premium_until)
 *   - Filter by premium status: All / Premium / Non-premium
 *     (the "Non-premium" filter is the admin approve queue — every
 *     user who does NOT have an active subscription appears here)
 *   - Search by username / email
 *   - GRANT premium to a user (plan: monthly/quarterly/yearly/lifetime,
 *     optional custom days for trials) — the admin panel is the
 *     approve surface, mirroring AdminCreatorReview's approve flow
 *   - REVOKE premium (cancels active subscriptions immediately)
 *
 * API endpoints:
 *   GET  /api/admin/users/?premium=true|false&search=q
 *   POST /api/admin/users/{id}/grant_premium/  { plan, days? }
 *   POST /api/admin/users/{id}/revoke_premium/ { reason? }
 *   GET  /api/admin/users/{id}/premium_history/  grant/revoke timeline
 *
 * Route: /sheet/admin/users (accessible only to staff/superusers)
 */

import { useEffect, useState, useCallback } from 'react';
import { adminUserService } from '../../services/api';
import { useRoleGate } from '../../hooks/useRoleGate';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import permissionManager from '../../pwa/permissions/PermissionManager.js';

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return '—'; }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

/**
 * Build + trigger a browser-side CSV download.
 *
 * Escapes every cell (commas, quotes, newlines) and prepends the UTF-8
 * BOM so Excel opens accented chars (ê, ò…) correctly. Purely client-side:
 * no server round-trip, no PII leaves the admin's browser beyond the data
 * they're already looking at.
 */
function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    // CSV-injection guard: a cell starting (ignoring leading whitespace)
    // with = + - @ (e.g. a username or payment_ref) would be interpreted
    // as a formula by Excel. Prefix with a single quote so it stays
    // literal text.
    const safe = /^\s*[=+\-@]/.test(s) ? `'${s}` : s;
    return /[,"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [
    headers.map(esc).join(','),
    ...rows.map((r) => r.map(esc).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PLANS = [
  { value: 'monthly',   label: 'Monthly',   icon: 'fa-calendar-day' },
  { value: 'quarterly', label: 'Quarterly', icon: 'fa-calendar' },
  { value: 'yearly',    label: 'Yearly',    icon: 'fa-calendar-check' },
  { value: 'lifetime',  label: 'Lifetime',  icon: 'fa-infinity' },
];

// ─── AdminRole choices (mirror of backend AdminRole.ROLE_CHOICES) ───
const ADMIN_ROLES = [
  { value: 'super_admin',  label: 'Super Admin',       ht: 'Super Admin',       icon: 'fa-crown',        desc: 'Full access to every permission' },
  { value: 'admin',        label: 'Administrator',     ht: 'Administratè',      icon: 'fa-user-shield',  desc: 'Ban, suspend, restore, force logout, broadcast' },
  { value: 'moderator',    label: 'Moderator',         ht: 'Moderatè',          icon: 'fa-gavel',        desc: 'Suspend users, resolve reports' },
  { value: 'support',      label: 'Support Agent',     ht: 'Ajan Sipò',         icon: 'fa-headset',      desc: 'View audit + activity history' },
  { value: 'content_mod',  label: 'Content Moderator', ht: 'Moderatè Kontni',   icon: 'fa-flag',         desc: 'Resolve reports, remove content' },
  { value: 'viewer',       label: 'Viewer',            ht: 'Vizitè',            icon: 'fa-eye',          desc: 'Read-only admin surface' },
];

// ═══════════════════════════════════════════════════════════════════════
// PremiumBadge
// ═══════════════════════════════════════════════════════════════════════

function PremiumBadge({ isPremium, until }) {
  if (!isPremium) {
    return <span className="aum-badge aum-badge--none"><i className="fas fa-crown" aria-hidden="true" /> Free</span>;
  }
  return (
    <span className="aum-badge aum-badge--premium" title={`Premium until ${fmtDateTime(until)}`}>
      <i className="fas fa-crown" aria-hidden="true" /> Premium
      {until && <em className="aum-badge-until">until {fmtDate(until)}</em>}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GrantModal — approve a user for premium (choose plan + optional days)
// ═══════════════════════════════════════════════════════════════════════

function GrantModal({ user, onClose, onGranted, showToast, lang }) {
  const isHt = lang === 'ht';
  const [plan, setPlan] = useState('monthly');
  const [customDays, setCustomDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError(null);
    try {
      const days = customDays.trim() ? Number(customDays.trim()) : undefined;
      const resp = await adminUserService.grantPremium(user.id, plan, days);
      showToast?.(
        isHt
          ? `✅ ${user.username} vin Premium (${plan})!`
          : `✅ ${user.username} granted Premium (${plan})!`,
        'crown',
      );
      onGranted?.(resp.data);
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.message
        || 'Grant failed.';
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [user, plan, customDays, isHt, showToast, onGranted, onClose]);

  return (
    <div
      className="aum-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Grant premium"
    >
      <div className="aum-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aum-modal-header">
          <div>
            <h3 className="aum-modal-title">
              <i className="fas fa-crown" aria-hidden="true" />
              {' '}{isHt ? 'Bay Premium' : 'Grant Premium'}
            </h3>
            <p className="aum-modal-subtitle">
              {user.username} · {user.email || '—'}
            </p>
          </div>
          <button type="button" className="aum-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="aum-form">
          {error && <div className="aum-error" role="alert">{error}</div>}

          <label className="aum-field">
            <span className="aum-field-label">
              {isHt ? 'Plan' : 'Plan'}
            </span>
            <div className="aum-plan-grid">
              {PLANS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={classNames('aum-plan-option', plan === p.value && 'aum-plan-option-selected')}
                  onClick={() => setPlan(p.value)}
                >
                  <i className={`fas ${p.icon}`} aria-hidden="true" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </label>

          <label className="aum-field">
            <span className="aum-field-label">
              {isHt
                ? 'Jou (si ou vle yon esè — kite vid pou plan konplè)'
                : 'Days (optional — e.g. a trial; empty = full plan duration)'}
            </span>
            <input
              className="aum-input"
              type="number"
              min="1"
              max="36500"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder={isHt ? 'ex: 7 pou yon esè' : 'e.g. 7 for a trial'}
            />
          </label>

          <div className="aum-actions">
            <button type="button" className="aum-btn-secondary" onClick={onClose} disabled={loading}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap bay...' : 'Granting...'}</>
              ) : (
                <><i className="fas fa-crown" aria-hidden="true" /> {isHt ? 'Konfime Grant' : 'Confirm Grant'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HistoryModal — per-user grant/revoke timeline
// ═══════════════════════════════════════════════════════════════════════

function HistoryModal({ user, onClose, showToast, lang }) {
  const isHt = lang === 'ht';
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminUserService.premiumHistory(user.id);
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setHistory(data);
      } catch (err) {
        const detail = err?.response?.data?.error || err?.message || 'Failed to load history.';
        if (!cancelled) setError(detail);
        showToast?.(detail, 'circle-exclamation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id, showToast]);

  const statusIcon = (status) =>
    status === 'active' ? 'fa-circle-check'
      : status === 'cancelled' ? 'fa-minus-circle'
        : status === 'expired' ? 'fa-clock'
          : 'fa-rotate-left';

  // ─── CSV export (uses the already-loaded history rows) ─────────
  const handleExportCsv = useCallback(() => {
    if (!history || history.length === 0) return;
    const headers = [
      'id', 'plan', 'status', 'source',
      'started_at', 'expires_at', 'cancelled_at',
      'granted_by_username', 'revoked_by_username', 'payment_ref',
    ];
    const rows = history.map((row) => [
      row.id, row.plan, row.status, row.source,
      row.started_at || '', row.expires_at || '', row.cancelled_at || '',
      row.granted_by_username || '', row.revoked_by_username || '',
      row.payment_ref || '',
    ]);
    downloadCsv(`premium-history-${user.username}.csv`, headers, rows);
  }, [history, user.username]);

  return (
    <div
      className="aum-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Premium history"
    >
      <div className="aum-modal aum-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="aum-modal-header">
          <div>
            <h3 className="aum-modal-title">
              <i className="fas fa-clock-rotate-left" aria-hidden="true" />
              {' '}{isHt ? 'Istorik Premium' : 'Premium History'}
            </h3>
            <p className="aum-modal-subtitle">
              {user.username} · {user.email || '—'}
            </p>
          </div>
          <div className="aum-modal-header-actions">
            {history && history.length > 0 && (
              <button
                type="button"
                className="aum-btn aum-btn-csv"
                onClick={handleExportCsv}
                title={isHt ? 'Ekspòte istorik la an CSV' : 'Export history as CSV'}
              >
                <i className="fas fa-file-csv" aria-hidden="true" />
                {isHt ? 'Ekspòte CSV' : 'Export CSV'}
              </button>
            )}
            <button type="button" className="aum-modal-close" onClick={onClose} aria-label="Close">
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="aum-history-body">
          {loading ? (
            <div className="aum-history-loading">
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              <span>{isHt ? 'Ap chaje istorik la...' : 'Loading history...'}</span>
            </div>
          ) : error ? (
            <div className="aum-error" role="alert">{error}</div>
          ) : !history || history.length === 0 ? (
            <div className="aum-history-empty">
              <i className="fas fa-crown" aria-hidden="true" />
              <p>{isHt ? 'Pa gen istorik Premium pou itilizatè sa a.' : 'No premium history for this user yet.'}</p>
            </div>
          ) : (
            <div className="aum-history-timeline">
              {history.map((row) => {
                const isGrant = row.source === 'admin' && row.status === 'active';
                const isRevoke = row.status === 'cancelled';
                const isProvider = row.source === 'provider';
                return (
                  <div key={row.id} className={`aum-history-item ${isGrant ? 'aum-history-item-grant' : isRevoke ? 'aum-history-item-revoke' : ''}`}>
                    <div className="aum-history-dot">
                      <i className={`fas ${statusIcon(row.status)}`} aria-hidden="true" />
                    </div>
                    <div className="aum-history-content">
                      <div className="aum-history-head">
                        <strong className="aum-history-title">
                          {isProvider
                            ? (isHt ? 'Abònman PayPal' : 'PayPal subscription')
                            : isRevoke
                              ? (isHt ? 'Revoke Premium' : 'Premium revoked')
                              : (isHt ? 'Grant Premium' : 'Premium granted')}
                        </strong>
                        <span className={`aum-history-status aum-history-status--${row.status}`}>
                          <i className={`fas ${statusIcon(row.status)}`} aria-hidden="true" /> {row.status}
                        </span>
                      </div>
                      <div className="aum-history-meta">
                        <span><i className="fas fa-calendar-check" aria-hidden="true" /> {row.plan}</span>
                        <span><i className="fas fa-play" aria-hidden="true" /> {fmtDateTime(row.started_at)}</span>
                        <span><i className="fas fa-hourglass-end" aria-hidden="true" /> {fmtDateTime(row.expires_at)}</span>
                        {row.cancelled_at && (
                          <span><i className="fas fa-stop" aria-hidden="true" /> {fmtDateTime(row.cancelled_at)}</span>
                        )}
                      </div>
                      <div className="aum-history-actors">
                        {row.granted_by_username && (
                          <span className="aum-history-actor aum-history-actor-grant">
                            <i className="fas fa-user-shield" aria-hidden="true" />
                            {isHt ? 'Bay pa' : 'Granted by'} {row.granted_by_username}
                          </span>
                        )}
                        {row.revoked_by_username && (
                          <span className="aum-history-actor aum-history-actor-revoke">
                            <i className="fas fa-user-slash" aria-hidden="true" />
                            {isHt ? 'Revoke pa' : 'Revoked by'} {row.revoked_by_username}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ChangePlanModal — upgrade/downgrade a user's active premium plan
// ═══════════════════════════════════════════════════════════════════════

function ChangePlanModal({ user, onClose, onChanged, showToast, lang }) {
  const isHt = lang === 'ht';
  const [plan, setPlan] = useState('');
  const [customDays, setCustomDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!plan) {
      setError(isHt ? 'Chwazi yon plan.' : 'Choose a plan.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const days = customDays.trim() ? Number(customDays.trim()) : undefined;
      const resp = await adminUserService.changePlan(user.id, plan, days);
      const from = (resp?.data?.from_plans || []).join(', ');
      showToast?.(`🔄 ${user.username}: ${from || '?'} → ${plan}`, 'arrows-rotate');
      onChanged?.(resp.data);
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.message
        || 'Plan change failed.';
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [user, plan, customDays, isHt, showToast, onChanged, onClose]);

  return (
    <div
      className="aum-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Change premium plan"
    >
      <div className="aum-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aum-modal-header">
          <div>
            <h3 className="aum-modal-title">
              <i className="fas fa-arrows-rotate" aria-hidden="true" />
              {' '}{isHt ? 'Chanje Plan' : 'Change Plan'}
            </h3>
            <p className="aum-modal-subtitle">
              {user.username} · {user.email || '—'}
            </p>
          </div>
          <button type="button" className="aum-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="aum-form">
          {error && <div className="aum-error" role="alert">{error}</div>}

          <label className="aum-field">
            <span className="aum-field-label">
              {isHt ? 'Nouvo plan' : 'New plan'}
            </span>
            <div className="aum-plan-grid">
              {PLANS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={classNames('aum-plan-option', plan === p.value && 'aum-plan-option-selected')}
                  onClick={() => setPlan(p.value)}
                >
                  <i className={`fas ${p.icon}`} aria-hidden="true" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </label>

          <label className="aum-field">
            <span className="aum-field-label">
              {isHt
                ? 'Jou (si ou vle yon dure espesyal — kite vid pou dure plan an)'
                : 'Days (optional — empty = full plan duration)'}
            </span>
            <input
              className="aum-input"
              type="number"
              min="1"
              max="36500"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder={isHt ? 'ex: 7 pou yon esè' : 'e.g. 7 for a trial'}
            />
          </label>

          <div className="aum-actions">
            <button type="button" className="aum-btn-secondary" onClick={onClose} disabled={loading}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap chanje...' : 'Changing...'}</>
              ) : (
                <><i className="fas fa-arrows-rotate" aria-hidden="true" /> {isHt ? 'Konfime Chanjman' : 'Confirm Change'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ChangePasswordModal — admin sets a new password for a user
// ═══════════════════════════════════════════════════════════════════════

function ChangePasswordModal({ user, onClose, onChanged, showToast, lang }) {
  const isHt = lang === 'ht';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!password || password.length < 6) {
      setError(isHt ? 'Modpas la dwe gen omwen 6 karaktè.' : 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await adminUserService.changePassword(user.id, password);
      showToast?.(isHt ? '🔑 Modpas chanje.' : '🔑 Password updated.', 'check-circle');
      onChanged?.();
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Failed to change password.';
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [user, password, isHt, showToast, onChanged, onClose]);

  return (
    <div
      className="aum-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Change password"
    >
      <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="aum-modal-header">
          <div>
            <h3 className="aum-modal-title">
              <i className="fas fa-key" aria-hidden="true" />
              {' '}{isHt ? 'Chanje Modpas' : 'Change Password'}
            </h3>
            <p className="aum-modal-subtitle">
              {user.username} · {user.email || '—'}
            </p>
          </div>
          <button type="button" className="aum-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="aum-form">
          {error && <div className="aum-error" role="alert">{error}</div>}

          <label className="aum-field">
            <span className="aum-field-label">
              {isHt ? 'Nouvo modpas' : 'New password'}
            </span>
            <input
              className="aum-input"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isHt ? 'Nouvo modpas...' : 'New password...'}
              autoFocus
            />
          </label>

          <div className="aum-actions">
            <button type="button" className="aum-btn-secondary" onClick={onClose} disabled={loading}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap chanje...' : 'Changing...'}</>
              ) : (
                <><i className="fas fa-key" aria-hidden="true" /> {isHt ? 'Konfime Chanjman' : 'Confirm Change'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RoleModal — grant/revoke AdminRole assignments
// ═══════════════════════════════════════════════════════════════════════

function RoleModal({ user, currentUserId, onClose, onChanged, showToast, lang }) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyRole, setBusyRole] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminUserService.roles(user.id);
        if (!cancelled) setData(res?.data || null);
      } catch (err) {
        const detail = err?.response?.data?.error || err?.message || 'Failed to load roles.';
        if (!cancelled) setError(detail);
        showToast?.(detail, 'circle-exclamation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id, showToast]);

  const activeRoles = data?.roles?.filter((r) => r.active) || [];
  const activeRoleNames = new Set(activeRoles.map((r) => r.role));
  const isSuperuser = !!data?.is_superuser;
  const isInactive = !data?.is_active;

  const handleToggle = useCallback(async (roleValue, nextActive) => {
    setBusyRole(roleValue);
    setError(null);
    try {
      const resp = await adminUserService.setRole(user.id, roleValue, nextActive);
      const label = ADMIN_ROLES.find((r) => r.value === roleValue);
      showToast?.(
        nextActive
          ? (isHt ? `✅ Wòl "${label?.ht || roleValue}" bay ${user.username}.` : `✅ Role "${label?.label || roleValue}" granted to ${user.username}.`)
          : (isHt ? `❌ Wòl "${label?.ht || roleValue}" retire pou ${user.username}.` : `❌ Role "${label?.label || roleValue}" revoked from ${user.username}.`),
        nextActive ? 'user-shield' : 'user-slash',
      );
      onChanged?.(resp.data);
      // Re-fetch so the toggle reflects server truth.
      const res = await adminUserService.roles(user.id);
      setData(res?.data || null);
      // Refresh the permission matrix if the target user is the
      // current user — so new buttons appear/disappear immediately.
      if (user.id === currentUserId) {
        permissionManager.refreshPermissionsMatrix();
      }
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Role change failed.';
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setBusyRole(null);
    }
  }, [user.id, user.username, isHt, showToast, onChanged]);

  return (
    <div
      className="aum-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Manage roles"
    >
      <div className="aum-modal aum-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="aum-modal-header">
          <div>
            <h3 className="aum-modal-title">
              <i className="fas fa-user-shield" aria-hidden="true" />
              {' '}{isHt ? 'Jere Wòl' : 'Manage Roles'}
            </h3>
            <p className="aum-modal-subtitle">
              {user.username} · {user.email || '—'}
            </p>
          </div>
          <button type="button" className="aum-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className="aum-role-body">
          {loading ? (
            <div className="aum-history-loading">
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              <span>{isHt ? 'Ap chaje wòl yo...' : 'Loading roles...'}</span>
            </div>
          ) : error ? (
            <div className="aum-error" role="alert">{error}</div>
          ) : (
            <>
              {/* Django-level flags summary */}
              <div className="aum-role-flags">
                <span className={`aum-role-flag ${isSuperuser ? 'aum-role-flag--active' : ''}`}>
                  <i className="fas fa-crown" aria-hidden="true" />
                  {isHt ? 'Superuser' : 'Superuser'} {isSuperuser ? '✓' : ''}
                </span>
                <span className={`aum-role-flag ${isInactive ? 'aum-role-flag--danger' : ''}`}>
                  <i className="fas fa-user-slash" aria-hidden="true" />
                  {isHt ? 'Kont' : 'Account'} {isInactive ? (isHt ? 'Deaktive' : 'Inactive') : (isHt ? 'Aktif' : 'Active')}
                </span>
              </div>

              {isSuperuser && (
                <p className="aum-role-hint">
                  <i className="fas fa-info-circle" aria-hidden="true" />
                  {isHt
                    ? 'Itilizatè sa a se yon superuser — li gen aksè total kèlkeswa wòl yo.'
                    : 'This user is a superuser — they have full access regardless of role assignments.'}
                </p>
              )}

              <div className="aum-role-list">
                {ADMIN_ROLES.map((r) => {
                  const granted = activeRoleNames.has(r.value);
                  return (
                    <div key={r.value} className={`aum-role-item ${granted ? 'aum-role-item--granted' : ''}`}>
                      <div className="aum-role-item-info">
                        <div className="aum-role-item-name">
                          <i className={`fas ${r.icon}`} aria-hidden="true" />
                          {isHt ? r.ht : r.label}
                        </div>
                        <div className="aum-role-item-desc">{r.desc}</div>
                      </div>
                      <button
                        type="button"
                        className={`aum-role-toggle ${granted ? 'aum-role-toggle--on' : ''}`}
                        onClick={() => handleToggle(r.value, !granted)}
                        disabled={busyRole === r.value || isInactive}
                        aria-pressed={granted}
                        title={isInactive
                          ? (isHt ? 'Aktive kont la anvan' : 'Activate the account first')
                          : granted
                            ? (isHt ? 'Retire wòl sa a' : 'Revoke this role')
                            : (isHt ? 'Bay wòl sa a' : 'Grant this role')}
                      >
                        {busyRole === r.value ? (
                          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                        ) : (
                          <>
                            <i className={`fas ${granted ? 'fa-toggle-on' : 'fa-toggle-off'}`} aria-hidden="true" />
                            <span>{granted ? (isHt ? 'Aktif' : 'Granted') : (isHt ? 'Bay' : 'Grant')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ActivityModal — unified per-user activity timeline
// ═══════════════════════════════════════════════════════════════════════

function ActivityModal({ user, onClose, showToast, lang }) {
  const isHt = lang === 'ht';
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminUserService.activityHistory(user.id);
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.events || []);
        if (!cancelled) setEvents(data);
      } catch (err) {
        const detail = err?.response?.data?.error || err?.message || 'Failed to load activity.';
        if (!cancelled) setError(detail);
        showToast?.(detail, 'circle-exclamation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id, showToast]);

  const ACTION_LABELS = {
    admin_user_suspend:        { en: 'Suspended',              ht: 'Sispann' },
    admin_user_ban:            { en: 'Banned',                 ht: 'Banni' },
    admin_user_restore:        { en: 'Restored',               ht: 'Restore' },
    admin_user_force_logout:   { en: 'Forced logout',          ht: 'Dekonekte fòse' },
    admin_user_change_password:{ en: 'Password changed',       ht: 'Modpas chanje' },
    admin_user_deactivate:     { en: 'Account deactivated',    ht: 'Kont deaktive' },
    admin_user_activate:       { en: 'Account activated',      ht: 'Kont aktive' },
    admin_user_grant_premium:  { en: 'Premium granted',        ht: 'Premium bay' },
    admin_user_revoke_premium: { en: 'Premium revoked',        ht: 'Premium retire' },
    admin_user_change_plan:    { en: 'Plan changed',           ht: 'Plan chanje' },
    admin_user_role_grant:     { en: 'Admin role granted',     ht: 'Wòl admin bay' },
    admin_user_role_revoke:    { en: 'Admin role revoked',     ht: 'Wòl admin retire' },
    login_success:             { en: 'Login success',          ht: 'Koneksyon siksè' },
    login_failed:              { en: 'Login failed',           ht: 'Koneksyon echwe' },
    session_created:           { en: 'Session started',        ht: 'Sesyon kòmanse' },
    session_revoked:           { en: 'Session revoked',        ht: 'Sesyon revoke' },
  };

  const kindIcon = (kind) =>
    kind === 'login' ? 'fa-right-to-bracket'
      : kind === 'session' ? 'fa-laptop'
        : kind === 'audit' ? 'fa-shield-halved'
          : 'fa-circle';

  const kindTint = (kind, action) => {
    if (kind === 'login') return action === 'login_success' ? 'aum-act-item--success' : 'aum-act-item--danger';
    if (kind === 'session') return 'aum-act-item--info';
    return 'aum-act-item--admin';
  };

  return (
    <div
      className="aum-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Activity history"
    >
      <div className="aum-modal aum-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="aum-modal-header">
          <div>
            <h3 className="aum-modal-title">
              <i className="fas fa-activity" aria-hidden="true" />
              {' '}{isHt ? 'Istwa Aktivite' : 'Activity History'}
            </h3>
            <p className="aum-modal-subtitle">
              {user.username} · {user.email || '—'}
            </p>
          </div>
          <button type="button" className="aum-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className="aum-history-body">
          {loading ? (
            <div className="aum-history-loading">
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              <span>{isHt ? 'Ap chaje aktivite a...' : 'Loading activity...'}</span>
            </div>
          ) : error ? (
            <div className="aum-error" role="alert">{error}</div>
          ) : !events || events.length === 0 ? (
            <div className="aum-history-empty">
              <i className="fas fa-activity" aria-hidden="true" />
              <p>{isHt ? 'Pa gen aktivite anrejistre pou itilizatè sa a.' : 'No recorded activity for this user yet.'}</p>
            </div>
          ) : (
            <div className="aum-history-timeline">
              {events.map((ev, i) => {
                const label = ACTION_LABELS[ev.action] || { en: ev.action, ht: ev.action };
                const meta = ev.metadata || {};
                return (
                  <div key={i} className={`aum-history-item ${kindTint(ev.kind, ev.action)}`}>
                    <div className="aum-history-dot">
                      <i className={`fas ${kindIcon(ev.kind)}`} aria-hidden="true" />
                    </div>
                    <div className="aum-history-content">
                      <div className="aum-history-head">
                        <strong className="aum-history-title">
                          {isHt ? label.ht : label.en}
                        </strong>
                        <span className="aum-history-status">{fmtDateTime(ev.created_at)}</span>
                      </div>
                      <div className="aum-history-meta">
                        {ev.actor && <span><i className="fas fa-user" aria-hidden="true" /> {ev.actor}</span>}
                        {meta.ip && <span><i className="fas fa-globe" aria-hidden="true" /> {meta.ip}</span>}
                        {meta.device && <span><i className="fas fa-laptop" aria-hidden="true" /> {meta.device}</span>}
                        {meta.days && <span><i className="fas fa-calendar" aria-hidden="true" /> {meta.days}j</span>}
                        {meta.role && <span><i className="fas fa-user-shield" aria-hidden="true" /> {meta.role}</span>}
                        {meta.reason && <span className="aum-history-actor aum-history-actor-grant"><i className="fas fa-comment" aria-hidden="true" /> {meta.reason}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// UserCard
// ═══════════════════════════════════════════════════════════════════════

function UserCard({ user, onGrant, onRevoke, onHistory, onChangePlan, onChangePassword, onManageRoles, onActivity, onDeactivate, onActivate, onSuspend, onBan, onRestore, onForceLogout, canManageBilling, canManageRoles, canManageUsers, canDeactivate, canReactivate, canBan, canForceLogout }) {
  return (
    <div className={classNames('aum-card', user.is_premium && 'aum-card-premium')}>
      <div className="aum-card-top">
        <div className="aum-card-user">
          <div className="aum-card-avatar">
            {user.username?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="aum-card-user-info">
            <div className="aum-card-username">
              {user.username}
              {user.is_staff && (
                <span className="aum-staff-tag" title="Staff"><i className="fas fa-shield-halved" aria-hidden="true" /></span>
              )}
            </div>
            <div className="aum-card-email">{user.email || '—'}</div>
          </div>
        </div>
        <PremiumBadge isPremium={user.is_premium} until={user.premium_until} />
      </div>

      <div className="aum-card-meta">
        <span title="Joined">
          <i className="fas fa-calendar" aria-hidden="true" /> {fmtDate(user.date_joined)}
        </span>
        <span title="Last login">
          <i className="fas fa-clock" aria-hidden="true" /> {fmtDate(user.last_login)}
        </span>
        {user.is_banned && (
          <span className="aum-banned-tag" title="Banned">
            <i className="fas fa-ban" aria-hidden="true" /> Banned
          </span>
        )}
        {!user.is_active && (
          <span className="aum-inactive-tag" title="Account deactivated">
            <i className="fas fa-user-slash" aria-hidden="true" /> Inactive
          </span>
        )}
      </div>

      <div className="aum-card-actions">
        <button
          type="button"
          className="aum-btn aum-btn-history"
          onClick={() => onHistory(user)}
          title={user.is_premium ? 'View grant/revoke history' : 'No history yet — view anyway'}
        >
          <i className="fas fa-clock-rotate-left" aria-hidden="true" /> History
        </button>
        <button
          type="button"
          className="aum-btn aum-btn-activity"
          onClick={() => onActivity?.(user)}
          title="View activity history"
        >
          <i className="fas fa-activity" aria-hidden="true" /> Activity
        </button>
        {canManageUsers && (
          <button
            type="button"
            className="aum-btn aum-btn-password"
            onClick={() => onChangePassword?.(user)}
            title="Change password"
          >
            <i className="fas fa-key" aria-hidden="true" /> Password
          </button>
        )}
        {canManageRoles && (
          <button
            type="button"
            className="aum-btn aum-btn-roles"
            onClick={() => onManageRoles?.(user)}
            title="Manage admin roles"
          >
            <i className="fas fa-user-shield" aria-hidden="true" /> Roles
          </button>
        )}
        {canManageBilling && (user.is_premium ? (
          <>
            <button
              type="button"
              className="aum-btn aum-btn-switch"
              onClick={() => onChangePlan(user)}
              title="Change plan (upgrade/downgrade)"
            >
              <i className="fas fa-arrows-rotate" aria-hidden="true" /> Change Plan
            </button>
            <button
              type="button"
              className="aum-btn aum-btn-danger"
              onClick={() => onRevoke(user)}
            >
              <i className="fas fa-minus-circle" aria-hidden="true" /> Revoke
            </button>
          </>
        ) : (
          <button
            type="button"
            className="aum-btn aum-btn-grant"
            onClick={() => onGrant(user)}
          >
            <i className="fas fa-crown" aria-hidden="true" /> Grant Premium
          </button>
        ))}
        {/* Moderation: Suspend / Ban / Restore / Force Logout */}
        {canBan && !user.is_banned && (
          <>
            <button
              type="button"
              className="aum-btn aum-btn-suspend"
              onClick={() => onSuspend?.(user)}
              title="Suspend (temporary ban)"
            >
              <i className="fas fa-clock" aria-hidden="true" /> Suspend
            </button>
            <button
              type="button"
              className="aum-btn aum-btn-ban"
              onClick={() => onBan?.(user)}
              title="Ban (permanent)"
            >
              <i className="fas fa-ban" aria-hidden="true" /> Ban
            </button>
          </>
        )}
        {canBan && user.is_banned && (
          <button
            type="button"
            className="aum-btn aum-btn-restore"
            onClick={() => onRestore?.(user)}
            title="Restore (lift ban)"
          >
            <i className="fas fa-rotate-left" aria-hidden="true" /> Restore
          </button>
        )}
        {canForceLogout && user.active_sessions > 0 && (
          <button
            type="button"
            className="aum-btn aum-btn-logout"
            onClick={() => onForceLogout?.(user)}
            title={`Force logout (${user.active_sessions} active sessions)`}
          >
            <i className="fas fa-right-from-bracket" aria-hidden="true" /> Logout ({user.active_sessions})
          </button>
        )}
        {user.is_active ? (
          canDeactivate && (
            <button
              type="button"
              className="aum-btn aum-btn-deactivate"
              onClick={() => onDeactivate?.(user)}
              title="Deactivate account"
            >
              <i className="fas fa-user-slash" aria-hidden="true" /> Deactivate
            </button>
          )
        ) : (
          canReactivate && (
            <button
              type="button"
              className="aum-btn aum-btn-reactivate"
              onClick={() => onActivate?.(user)}
              title="Re-activate account"
            >
              <i className="fas fa-user-check" aria-hidden="true" /> Reactivate
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Loading / Empty
// ═══════════════════════════════════════════════════════════════════════

function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="aum-skel-list" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="aum-skel-row" aria-hidden="true" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, hint }) {
  return (
    <div className="aum-empty" role="status">
      <i className={`fas ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// StatsBar — premium KPIs (counts, potential revenue, approval latency)
// ═══════════════════════════════════════════════════════════════════════

function StatsBar({ stats, loading, lang, onRefresh }) {
  const isHt = lang === 'ht';
  if (loading && !stats) {
    return (
      <div className="aum-stats aum-stats-loading" role="status" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aum-stat-skel" aria-hidden="true" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
  const fmtDays = (n) => {
    const v = Number(n) || 0;
    return `${v.toFixed(1)} ${isHt ? 'jou' : 'd'}`;
  };

  const cards = [
    {
      icon: 'fa-users',
      value: String(stats.total_users ?? '—'),
      label: isHt ? 'Itilizatè total' : 'Total users',
      tint: 'blue',
    },
    {
      icon: 'fa-crown',
      value: String(stats.non_premium_count ?? '—'),
      label: isHt ? 'Non-premium (dwe aprouve)' : 'Non-premium (to approve)',
      tint: 'amber',
      sub: isHt
        ? `${stats.premium_count ?? 0} premium · ${stats.premium_rate ?? 0}%`
        : `${stats.premium_count ?? 0} premium · ${stats.premium_rate ?? 0}%`,
    },
    {
      icon: 'fa-chart-line',
      value: fmtMoney(stats.potential_monthly_revenue),
      label: isHt ? 'Revni potansyèl / mwa' : 'Potential rev / month',
      tint: 'green',
      sub: isHt
        ? `si tout moun pran monthly · ${fmtMoney(stats.potential_yearly_revenue)}/an`
        : `if all convert monthly · ${fmtMoney(stats.potential_yearly_revenue)}/yr`,
    },
    {
      icon: 'fa-hourglass-half',
      value: fmtDays(stats.avg_pending_days),
      label: isHt ? 'Mwayèn ap tann' : 'Avg waiting',
      tint: 'purple',
      sub: isHt
        ? `mwayèn tan pou aprouve: ${fmtDays(stats.avg_approval_days)}`
        : `avg approval time: ${fmtDays(stats.avg_approval_days)}`,
    },
  ];

  return (
    <div className="aum-stats">
      {cards.map((c) => (
        <div key={c.label} className={`aum-stat aum-stat--${c.tint}`}>
          <div className="aum-stat-icon">
            <i className={`fas ${c.icon}`} aria-hidden="true" />
          </div>
          <div className="aum-stat-body">
            <div className="aum-stat-value">{c.value}</div>
            <div className="aum-stat-label">{c.label}</div>
            {c.sub && <div className="aum-stat-sub">{c.sub}</div>}
          </div>
        </div>
      ))}
      <button type="button" className="aum-stats-refresh" onClick={onRefresh} title="Refresh stats">
        <i className="fas fa-rotate" aria-hidden="true" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

const FILTER_OPTIONS = [
  { value: '',      label: 'All',           icon: 'fa-list' },
  { value: 'false', label: 'Non-premium',   icon: 'fa-crown' },
  { value: 'true',  label: 'Premium',       icon: 'fa-circle-check' },
  { value: 'auto_renew:false', label: 'Not Renewing', icon: 'fa-hourglass-half' },
];

export default function AdminUserManagement({ lang = 'ht', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';

  // ─── Billing permission gate ───────────────────────────────────
  // The backend gates grant/revoke/change-plan on the
  // ``can_manage_billing`` permission (super_admin, or an explicit
  // AdminRole) — NOT on plain is_staff. The matrix is the FE mirror
  // of that: gate the premium action buttons here so a staff user
  // without billing rights doesn't see buttons that 403 on click.
  //
  // FALLBACK: superusers ALWAYS have billing permission regardless
  // of matrix state. This covers stale-cache + fresh-deploy races.
  const billing = useRoleGate('can_manage_billing');
  const canManageBilling = billing.allowed === true || user?.is_superuser === true;
  const roleGate = useRoleGate('can_grant_admin_role');
  const canManageRoles = roleGate.allowed === true || user?.is_superuser === true;
  const suspendGate = useRoleGate('can_suspend_user');
  const canDeactivate = suspendGate.allowed === true || user?.is_superuser === true;
  const manageUsersGate = useRoleGate('can_manage_users');
  const canManageUsers = manageUsersGate.allowed === true || user?.is_superuser === true;
  const restoreGate = useRoleGate('can_restore_user');
  const canReactivate = restoreGate.allowed === true || user?.is_superuser === true;
  const banGate = useRoleGate('can_ban_user');
  const canBan = banGate.allowed === true || user?.is_superuser === true;
  const forceLogoutGate = useRoleGate('can_force_logout');
  const canForceLogout = forceLogoutGate.allowed === true || user?.is_superuser === true;

  // Force-refresh the permissions matrix on mount so stale cached
  // permissions from before a deploy never hide action buttons.
  useEffect(() => {
    permissionManager.refreshPermissionsMatrix().catch(() => {});
  }, []);
  const [users, setUsers] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('false'); // default: show the non-premium approve queue
  const [searchQuery, setSearchQuery] = useState('');
  const [grantTarget, setGrantTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [changePlanTarget, setChangePlanTarget] = useState(null);
  const [changePasswordTarget, setChangePasswordTarget] = useState(null);
  const [rolesTarget, setRolesTarget] = useState(null);
  const [activityTarget, setActivityTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  // Moderation modals
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendDays, setSuspendDays] = useState('7');
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [forceLogoutTarget, setForceLogoutTarget] = useState(null);
  const [forceLogoutReason, setForceLogoutReason] = useState('');
  const [forceLogouting, setForceLogouting] = useState(false);

  // ─── Admin gate ────────────────────────────────────────────────
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.('Staff access required.', 'user-lock');
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, onNavigate, showToast]);

  // ─── Fetch users ───────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page };
      if (filter === 'auto_renew:false') {
        params.auto_renew = 'false';
      } else if (filter) {
        params.premium = filter;
      }
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await adminUserService.list(params);
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setUsers(data);
      const count = res?.data?.count;
      setTotalUsers(Number.isFinite(count) ? count : data.length);
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.error
        || err?.message
        || 'Failed to load users.';
      setError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ─── Fetch premium stats (independent of list filter) ──────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await adminUserService.premiumStats();
      setStats(res?.data || null);
    } catch {
      setStats(null); // stats are additive — don't block the user list
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Revoke confirm ────────────────────────────────────────────
  const handleRevoke = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await adminUserService.revokePremium(revokeTarget.id, revokeReason.trim());
      showToast?.(
        isHt ? `❌ ${revokeTarget.username} pa gen Premium ankò.` : `❌ ${revokeTarget.username} premium revoked.`,
        'minus-circle',
      );
      setRevokeTarget(null);
      setRevokeReason('');
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Revoke failed.';
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setRevoking(false);
    }
  }, [revokeTarget, revokeReason, isHt, showToast, fetchUsers]);

  // ─── Deactivate confirm ────────────────────────────────────────
  const handleDeactivate = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await adminUserService.deactivate(deactivateTarget.id, deactivateReason.trim());
      showToast?.(
        isHt ? `🔒 ${deactivateTarget.username} kont deaktive.` : `🔒 ${deactivateTarget.username} account deactivated.`,
        'user-slash',
      );
      setDeactivateTarget(null);
      setDeactivateReason('');
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Deactivate failed.';
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setDeactivating(false);
    }
  }, [deactivateTarget, deactivateReason, isHt, showToast, fetchUsers]);

  // ─── Reactivate ────────────────────────────────────────────────
  const handleActivate = useCallback(async (user) => {
    if (!user) return;
    try {
      await adminUserService.activate(user.id);
      showToast?.(
        isHt ? `✅ ${user.username} kont reaktive.` : `✅ ${user.username} account re-activated.`,
        'user-check',
      );
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Activate failed.';
      showToast?.(detail, 'circle-exclamation');
    }  }, [isHt, showToast, fetchUsers]);

  // ─── Suspend confirm ──────────────────────────────────────────
  const handleSuspend = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      const days = Math.max(1, Math.min(365, Number(suspendDays) || 7));
      await adminUserService.suspend(suspendTarget.id, days, suspendReason.trim());
      showToast?.(
        isHt ? `⏰ ${suspendTarget.username} sispann pou ${days} jou.` : `⏰ ${suspendTarget.username} suspended for ${days} days.`,
        'clock',
      );
      setSuspendTarget(null);
      setSuspendDays('7');
      setSuspendReason('');
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Suspend failed.';
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSuspending(false);
    }
  }, [suspendTarget, suspendDays, suspendReason, isHt, showToast, fetchUsers]);

  // ─── Ban confirm ──────────────────────────────────────────────
  const handleBan = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!banTarget) return;
    setBanning(true);
    try {
      await adminUserService.ban(banTarget.id, banReason.trim(), true);
      showToast?.(
        isHt ? `🚫 ${banTarget.username} entèdi.` : `🚫 ${banTarget.username} banned.`,
        'ban',
      );
      setBanTarget(null);
      setBanReason('');
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Ban failed.';
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setBanning(false);
    }
  }, [banTarget, banReason, isHt, showToast, fetchUsers]);

  // ─── Restore confirm ──────────────────────────────────────────
  const handleRestore = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await adminUserService.restore(restoreTarget.id, restoreReason.trim());
      showToast?.(
        isHt ? `✅ ${restoreTarget.username} rekipere.` : `✅ ${restoreTarget.username} restored.`,
        'rotate-left',
      );
      setRestoreTarget(null);
      setRestoreReason('');
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Restore failed.';
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setRestoring(false);
    }
  }, [restoreTarget, restoreReason, isHt, showToast, fetchUsers]);

  // ─── Force Logout confirm ─────────────────────────────────────
  const handleForceLogout = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!forceLogoutTarget) return;
    setForceLogouting(true);
    try {
      await adminUserService.forceLogout(forceLogoutTarget.id, forceLogoutReason.trim());
      showToast?.(
        isHt ? `🔌 ${forceLogoutTarget.username} dekonekte.` : `🔌 ${forceLogoutTarget.username} logged out.`,
        'right-from-bracket',
      );
      setForceLogoutTarget(null);
      setForceLogoutReason('');
      fetchUsers();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.message || 'Force logout failed.';
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setForceLogouting(false);
    }
  }, [forceLogoutTarget, forceLogoutReason, isHt, showToast, fetchUsers]);

  // ─── Early non-admin return ────────────────────────────────────
  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="aum-shell">
        <div className="aum-empty">
          <i className="fas fa-user-lock" aria-hidden="true" />
          <h3>Staff Access Required</h3>
          <p>You need staff permissions to view this page.</p>
        </div>
      </div>
    );
  }

  const premiumCount = users?.filter((u) => u.is_premium).length || 0;
  const totalCount = totalUsers;
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <div className="aum-shell">
      {/* Header */}
      <div className="aum-header">
        <div className="aum-header-left">
          <button type="button" className="aum-back" onClick={() => onNavigate?.(-1)} aria-label="Back">
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </button>
          <div>
            <h1 className="aum-title">
              <i className="fas fa-users" aria-hidden="true" />
              {' '}User Management
            </h1>
            <p className="aum-subtitle">
              {isHt
                ? `Pèsonalize pouvwa Premium — ${totalCount} itilizatè`
                : `Premium entitlements — ${totalCount} user${totalCount !== 1 ? 's' : ''}`}
              {filter !== 'false' && premiumCount > 0 && ` · ${premiumCount} premium`}
            </p>
          </div>
        </div>
        <div className="aum-header-right">
          <button type="button" className="aum-refresh" onClick={() => { fetchUsers(); fetchStats(); }} title="Refresh">
            <i className="fas fa-rotate" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar
        stats={stats}
        loading={statsLoading}
        lang={lang}
        onRefresh={fetchStats}
      />

      {/* Filters */}
      <div className="aum-filters">
        <div className="aum-filter-tabs">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={classNames('aum-filter-tab', filter === opt.value && 'aum-filter-tab-active')}
              onClick={() => { setPage(1); setFilter(opt.value); }}
            >
              <i className={`fas ${opt.icon}`} aria-hidden="true" />
              <span>{opt.label}</span>
              {opt.value === 'false' && totalCount > 0 && (
                <span className="aum-count-badge">{totalCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="aum-search">
          <i className="fas fa-search" aria-hidden="true" />
          <input
            className="aum-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => { setPage(1); setSearchQuery(e.target.value); }}
            placeholder={isHt ? 'Chèche pa username oswa email...' : 'Search by username or email...'}
            aria-label="Search users"
          />
          {searchQuery && (
            <button
              type="button"
              className="aum-search-clear"
              onClick={() => { setPage(1); setSearchQuery(''); }}
              aria-label="Clear search"
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="aum-content">
        {!billing.loading && !canManageBilling && (
          <div
            className="aum-empty"
            style={{ padding: '18px 16px', marginBottom: 14, background: 'rgba(245, 158, 11, 0.06)', borderRadius: 14 }}
            role="note"
          >
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
              <i className="fas fa-lock" aria-hidden="true" style={{ color: 'var(--pr-color-amber-500, #f59e0b)', marginRight: 8 }} />
              {isHt
                ? 'W ap wè lis la, men sèlman admin ki gen pèmisyon billing ka bay / retire Premium.'
                : 'You can view the list, but only admins with billing permission can grant / revoke Premium.'}
            </p>
          </div>
        )}
        {loading && users === null ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <EmptyState icon="fa-circle-exclamation" title="Failed to load" hint={error} />
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon="fa-crown"
            title={filter === 'false' ? 'Everyone has premium 🎉' : 'No users found'}
            hint={
              filter === 'false'
                ? 'All users currently have an active premium subscription.'
                : 'Try a different filter or search term.'
            }
          />
        ) : (
          <div className="aum-grid">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                canManageBilling={canManageBilling}
                canManageRoles={canManageRoles}
                canManageUsers={canManageUsers}
                canBan={canBan}
                canForceLogout={canForceLogout}
                onGrant={setGrantTarget}
                onRevoke={setRevokeTarget}
                onHistory={setHistoryTarget}
                onChangePlan={setChangePlanTarget}
                onChangePassword={setChangePasswordTarget}
                onManageRoles={setRolesTarget}
                onActivity={setActivityTarget}
                onDeactivate={setDeactivateTarget}
                onActivate={handleActivate}
                onSuspend={setSuspendTarget}
                onBan={setBanTarget}
                onRestore={setRestoreTarget}
                onForceLogout={setForceLogoutTarget}
                canDeactivate={canDeactivate}
                canReactivate={canReactivate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {users && users.length > 0 && (
        <div className="aum-footer">
          <button type="button" className="aum-refresh-btn" onClick={fetchUsers}>
            <i className="fas fa-rotate" aria-hidden="true" /> Refresh
          </button>
          <div className="aum-pagination">
            <button
              type="button"
              className="aum-page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <i className="fas fa-chevron-left" aria-hidden="true" />
            </button>
            <span className="aum-page-text">
              {isHt ? `Paj ${page} / ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
            <button
              type="button"
              className="aum-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <i className="fas fa-chevron-right" aria-hidden="true" />
            </button>
          </div>
          <span className="aum-count-text">{totalCount} user{totalCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* History Modal */}
      {historyTarget && (
        <HistoryModal
          user={historyTarget}
          lang={lang}
          onClose={() => setHistoryTarget(null)}
          showToast={showToast}
        />
      )}

      {/* Grant Modal */}
      {grantTarget && (
        <GrantModal
          user={grantTarget}
          lang={lang}
          onClose={() => setGrantTarget(null)}
          onGranted={fetchUsers}
          showToast={showToast}
        />
      )}

      {/* Change Plan Modal */}
      {changePlanTarget && (
        <ChangePlanModal
          user={changePlanTarget}
          lang={lang}
          onClose={() => setChangePlanTarget(null)}
          onChanged={() => { fetchUsers(); fetchStats(); }}
          showToast={showToast}
        />
      )}

      {/* Change Password Modal */}
      {changePasswordTarget && (
        <ChangePasswordModal
          user={changePasswordTarget}
          lang={lang}
          onClose={() => setChangePasswordTarget(null)}
          onChanged={fetchUsers}
          showToast={showToast}
        />
      )}

      {/* Roles Modal */}
      {rolesTarget && (
        <RoleModal
          user={rolesTarget}
          currentUserId={user?.id}
          lang={lang}
          onClose={() => setRolesTarget(null)}
          onChanged={fetchUsers}
          showToast={showToast}
        />
      )}

      {/* Activity Modal */}
      {activityTarget && (
        <ActivityModal
          user={activityTarget}
          lang={lang}
          onClose={() => setActivityTarget(null)}
          showToast={showToast}
        />
      )}

      {/* Deactivate Confirm Modal */}
      {deactivateTarget && (
        <div
          className="aum-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setDeactivateTarget(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Deactivate account"
        >
          <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="aum-modal-header">
              <div>
                <h3 className="aum-modal-title">
                  <i className="fas fa-user-slash" aria-hidden="true" />
                  {' '}{isHt ? 'Deaktive Kont' : 'Deactivate Account'}
                </h3>
                <p className="aum-modal-subtitle">
                  {deactivateTarget.username} · {deactivateTarget.email || '—'}
                </p>
              </div>
              <button type="button" className="aum-modal-close" onClick={() => setDeactivateTarget(null)} aria-label="Close">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleDeactivate} className="aum-form">
              <p className="aum-revoke-warning">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                {' '}
                {isHt
                  ? 'Sa a ap deaktive kont la — itilizatè a p ap ka konekte ankò, epi tout sesyon yo ap revoke.'
                  : 'This deactivates the account — the user can no longer log in, and all sessions are revoked.'}
              </p>

              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Rezon (si genyen)' : 'Reason (optional)'}</span>
                <input
                  className="aum-input"
                  type="text"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder={isHt ? 'Rezon deaktivasyon...' : 'Reason for deactivation...'}
                />
              </label>

              <div className="aum-actions">
                <button type="button" className="aum-btn-secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
                  {isHt ? 'Anile' : 'Cancel'}
                </button>
                <button type="submit" className="aum-btn-danger-solid" disabled={deactivating}>
                  {deactivating ? (
                    <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap deaktive...' : 'Deactivating...'}</>
                  ) : (
                    <><i className="fas fa-user-slash" aria-hidden="true" /> {isHt ? 'Konfime Deaktivasyon' : 'Confirm Deactivate'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirm Modal */}
      {revokeTarget && (
        <div
          className="aum-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setRevokeTarget(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Revoke premium"
        >
          <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="aum-modal-header">
              <div>
                <h3 className="aum-modal-title">
                  <i className="fas fa-minus-circle" aria-hidden="true" />
                  {' '}{isHt ? 'Retire Premium' : 'Revoke Premium'}
                </h3>
                <p className="aum-modal-subtitle">
                  {revokeTarget.username} · {revokeTarget.email || '—'}
                </p>
              </div>
              <button type="button" className="aum-modal-close" onClick={() => setRevokeTarget(null)} aria-label="Close">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleRevoke} className="aum-form">
              <p className="aum-revoke-warning">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                {' '}
                {isHt
                  ? 'Sa a ap anile tout abònman Premium aktif imedyatman. Itilizatè a p ap gen aksè Premium ankò.'
                  : 'This cancels all active premium subscriptions immediately. The user loses premium access right away.'}
              </p>

              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Rezon (si genyen)' : 'Reason (optional)'}</span>
                <input
                  className="aum-input"
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder={isHt ? 'Rezon revokasyon...' : 'Reason for revocation...'}
                />
              </label>

              <div className="aum-actions">
                <button type="button" className="aum-btn-secondary" onClick={() => setRevokeTarget(null)} disabled={revoking}>
                  {isHt ? 'Anile' : 'Cancel'}
                </button>
                <button type="submit" className="aum-btn-danger-solid" disabled={revoking}>
                  {revoking ? (
                    <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap retire...' : 'Revoking...'}</>
                  ) : (
                    <><i className="fas fa-minus-circle" aria-hidden="true" /> {isHt ? 'Konfime Revokasyon' : 'Confirm Revoke'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Confirm Modal */}
      {suspendTarget && (
        <div
          className="aum-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setSuspendTarget(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Suspend user"
        >
          <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="aum-modal-header">
              <div>
                <h3 className="aum-modal-title">
                  <i className="fas fa-clock" aria-hidden="true" />
                  {' '}{isHt ? 'Sispann Itilizatè' : 'Suspend User'}
                </h3>
                <p className="aum-modal-subtitle">
                  {suspendTarget.username} · {suspendTarget.email || '—'}
                </p>
              </div>
              <button type="button" className="aum-modal-close" onClick={() => setSuspendTarget(null)} aria-label="Close">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSuspend} className="aum-form">
              <p className="aum-revoke-warning">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                {' '}{isHt
                  ? 'Sa a ap sispann itilizatè a pou yon tan. Li pa pral ka konekte jiskaske tan an fini.'
                  : 'This suspends the user temporarily. They cannot log in until the period expires.'}
              </p>
              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Kantite jou' : 'Number of days'}</span>
                <input className="aum-input" type="number" min="1" max="365" value={suspendDays} onChange={(e) => setSuspendDays(e.target.value)} />
              </label>
              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Rezon (si genyen)' : 'Reason (optional)'}</span>
                <input className="aum-input" type="text" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder={isHt ? 'Rezon sispann...' : 'Reason for suspension...'} />
              </label>
              <div className="aum-actions">
                <button type="button" className="aum-btn-secondary" onClick={() => setSuspendTarget(null)} disabled={suspending}>{isHt ? 'Anile' : 'Cancel'}</button>
                <button type="submit" className="aum-btn-danger-solid" disabled={suspending}>
                  {suspending ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap sispann...' : 'Suspending...'}</> : <><i className="fas fa-clock" /> {isHt ? 'Konfime' : 'Confirm Suspend'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban Confirm Modal */}
      {banTarget && (
        <div
          className="aum-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setBanTarget(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Ban user"
        >
          <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="aum-modal-header">
              <div>
                <h3 className="aum-modal-title">
                  <i className="fas fa-ban" aria-hidden="true" />
                  {' '}{isHt ? 'Entèdi Itilizatè' : 'Ban User'}
                </h3>
                <p className="aum-modal-subtitle">
                  {banTarget.username} · {banTarget.email || '—'}
                </p>
              </div>
              <button type="button" className="aum-modal-close" onClick={() => setBanTarget(null)} aria-label="Close">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleBan} className="aum-form">
              <p className="aum-revoke-warning">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                {' '}{isHt
                  ? 'Sa a ap entèdi itilizatè a pèmanan. Li pa pral ka konekte ankò.'
                  : 'This permanently bans the user. They can no longer log in.'}
              </p>
              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Rezon (si genyen)' : 'Reason (optional)'}</span>
                <input className="aum-input" type="text" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder={isHt ? 'Rezon entèdiksyon...' : 'Reason for ban...'} />
              </label>
              <div className="aum-actions">
                <button type="button" className="aum-btn-secondary" onClick={() => setBanTarget(null)} disabled={banning}>{isHt ? 'Anile' : 'Cancel'}</button>
                <button type="submit" className="aum-btn-danger-solid" disabled={banning}>
                  {banning ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap entèdi...' : 'Banning...'}</> : <><i className="fas fa-ban" /> {isHt ? 'Konfime Entèdiksyon' : 'Confirm Ban'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal */}
      {restoreTarget && (
        <div
          className="aum-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setRestoreTarget(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Restore user"
        >
          <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="aum-modal-header">
              <div>
                <h3 className="aum-modal-title">
                  <i className="fas fa-rotate-left" aria-hidden="true" />
                  {' '}{isHt ? 'Rekipere Itilizatè' : 'Restore User'}
                </h3>
                <p className="aum-modal-subtitle">
                  {restoreTarget.username} · {restoreTarget.email || '—'}
                </p>
              </div>
              <button type="button" className="aum-modal-close" onClick={() => setRestoreTarget(null)} aria-label="Close">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleRestore} className="aum-form">
              <p className="aum-revoke-warning">
                <i className="fas fa-info-circle" aria-hidden="true" />
                {' '}{isHt
                  ? 'Sa a ap retire tout entèdiksyon aktif pou itilizatè sa a.'
                  : 'This lifts all active bans for this user.'}
              </p>
              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Rezon (si genyen)' : 'Reason (optional)'}</span>
                <input className="aum-input" type="text" value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)} placeholder={isHt ? 'Rezon rekiperasyon...' : 'Reason for restore...'} />
              </label>
              <div className="aum-actions">
                <button type="button" className="aum-btn-secondary" onClick={() => setRestoreTarget(null)} disabled={restoring}>{isHt ? 'Anile' : 'Cancel'}</button>
                <button type="submit" className="btn-primary" disabled={restoring}>
                  {restoring ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap rekipere...' : 'Restoring...'}</> : <><i className="fas fa-rotate-left" /> {isHt ? 'Konfime Rekiperasyon' : 'Confirm Restore'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Logout Confirm Modal */}
      {forceLogoutTarget && (
        <div
          className="aum-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setForceLogoutTarget(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Force logout"
        >
          <div className="aum-modal aum-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="aum-modal-header">
              <div>
                <h3 className="aum-modal-title">
                  <i className="fas fa-right-from-bracket" aria-hidden="true" />
                  {' '}{isHt ? 'Dekonekte Fòse' : 'Force Logout'}
                </h3>
                <p className="aum-modal-subtitle">
                  {forceLogoutTarget.username} · {forceLogoutTarget.email || '—'}
                </p>
              </div>
              <button type="button" className="aum-modal-close" onClick={() => setForceLogoutTarget(null)} aria-label="Close">
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleForceLogout} className="aum-form">
              <p className="aum-revoke-warning">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                {' '}{isHt
                  ? `Sa a ap revoke tout sesyon aktif pou itilizatè sa a (${forceLogoutTarget.active_sessions} sesyon). Li pral oblije konekte ankò.`
                  : `This revokes all active sessions for this user (${forceLogoutTarget.active_sessions} session(s)). They will need to log in again.`}
              </p>
              <label className="aum-field">
                <span className="aum-field-label">{isHt ? 'Rezon (si genyen)' : 'Reason (optional)'}</span>
                <input className="aum-input" type="text" value={forceLogoutReason} onChange={(e) => setForceLogoutReason(e.target.value)} placeholder={isHt ? 'Rezon dekoneksyon...' : 'Reason for logout...'} />
              </label>
              <div className="aum-actions">
                <button type="button" className="aum-btn-secondary" onClick={() => setForceLogoutTarget(null)} disabled={forceLogouting}>{isHt ? 'Anile' : 'Cancel'}</button>
                <button type="submit" className="aum-btn-danger-solid" disabled={forceLogouting}>
                  {forceLogouting ? <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap dekonekte...' : 'Logging out...'}</> : <><i className="fas fa-right-from-bracket" /> {isHt ? 'Konfime Dekoneksyon' : 'Confirm Logout'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
