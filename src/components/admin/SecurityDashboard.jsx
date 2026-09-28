/**
 * SecurityDashboard.jsx — Atelnyo Security Monitoring Dashboard (Faz 7).
 *
 * Displays real-time security metrics for administrators:
 *   • Security Alerts feed (brute_force, impossible_travel, api_abuse, etc.)
 *   • Login Analytics (success vs failure chart)
 *   • Rate Limit Hits (top throttled endpoints and users)
 *   • Banned IP Management (list, ban, unban)
 *   • Active Sessions overview
 *
 * Pulls data from the existing backend models: SecurityAlert, LoginAttempt,
 * RateLimitBucket, BannedIP. Requires staff authentication.
 */
import React, { useState, useEffect, useCallback } from 'react';
// Use the shared JWT-aware axios client (NOT raw fetch): the admin
// endpoints below are staff-gated, so every request must carry the
// Authorization header the interceptor attaches. Raw fetch() without
// the token made the whole dashboard 401 and render empty panels.
import api, { API_URL } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════

export default function SecurityDashboard({ lang = 'ht' }) {
  const isHt = lang === 'ht';

  const [alerts, setAlerts] = useState([]);
  const [loginStats, setLoginStats] = useState(null);
  const [rateHits, setRateHits] = useState([]);
  const [bannedIPs, setBannedIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('alerts');
  const [busy, setBusy] = useState(null);

  // ── Fetch all data ───────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, loginRes, rateRes, bansRes] = await Promise.all([
        api.get('security/alerts/', { params: { resolved: false } }).then(r => r.data).catch(() => ({ results: [] })),
        api.get('admin/security/logins/', { params: { limit: 50 } }).then(r => r.data).catch(() => null),
        api.get('rate-limits/').then(r => r.data).catch(() => []),
        api.get('admin/security/ips/').then(r => r.data).catch(() => []),
      ]);
      setAlerts(alertsRes?.results || alertsRes || []);
      setLoginStats(loginRes);
      setRateHits(Array.isArray(rateRes) ? rateRes : rateRes?.results || []);
      setBannedIPs(Array.isArray(bansRes) ? bansRes : bansRes?.results || []);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Actions ──────────────────────────────────────────────────
  const resolveAlert = async (id) => {
    setBusy(id);
    try { await api.post(`security/alerts/${id}/resolve/`); refresh(); }
    catch (_) {} finally { setBusy(null); }
  };

  const banIP = async (ip) => {
    if (!ip) return;
    setBusy(`ban-${ip}`);
    try { await api.post('admin/security/ips/', { ip_address: ip }); refresh(); }
    catch (_) {} finally { setBusy(null); }
  };

  const unbanIP = async (id) => {
    setBusy(`unban-${id}`);
    try { await api.delete(`admin/security/ips/${id}/`); refresh(); }
    catch (_) {} finally { setBusy(null); }
  };

  // ── Helpers ──────────────────────────────────────────────────
  const SEVERITY_COLORS = { critical: '#e74c3c', high: '#e67e22', medium: '#f1c40f', low: '#3498db' };
  const ALERT_ICONS = {
    brute_force: 'fa-shield-haltered', impossible_travel: 'fa-plane', api_abuse: 'fa-bolt',
    spam_attack: 'fa-envelopes-bulk', bot_behavior: 'fa-robot',
  };

  const T = {
    title: isHt ? 'Sekirite' : 'Security',
    alerts: isHt ? 'Alèt' : 'Alerts',
    logins: isHt ? 'Koneksyon' : 'Logins',
    rateLimit: isHt ? 'Limit Pousantaj' : 'Rate Limits',
    banned: isHt ? 'IP Bloke' : 'Banned IPs',
    resolve: isHt ? 'Rezoud' : 'Resolve',
    ban: isHt ? 'Bloke' : 'Ban',
    unban: isHt ? 'Debloke' : 'Unban',
    noAlerts: isHt ? 'Okenn alèt sekirite aktif.' : 'No active security alerts.',
    total: isHt ? 'Total' : 'Total',
    failures: isHt ? 'Echèk' : 'Failures',
    success: isHt ? 'Siksè' : 'Success',
  };

  if (loading) {
    return (
      <div className="diag-panel" role="status" aria-busy="true">
        <div className="diag-skel-row skel-pulse" />
        <div className="diag-skel-row skel-pulse" />
        <div className="diag-skel-row skel-pulse" />
      </div>
    );
  }

  return (
    <div className="security-dashboard">
      <div className="security-dash-header">
        <h2><i className="fas fa-shield-haltered" /> {T.title}</h2>
        <button type="button" className="perm-btn perm-btn--small" onClick={refresh}>
          <i className="fas fa-sync-alt" /> {isHt ? 'Rafrechi' : 'Refresh'}
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="security-dash-tabs">
        {['alerts', 'logins', 'rateLimit', 'banned'].map(tab => (
          <button key={tab} type="button"
            className={`security-dash-tab ${activeTab === tab ? 'security-dash-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >{T[tab] || tab}</button>
        ))}
      </div>

      {/* ── Alert Feed ────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="security-dash-feed">
          {alerts.length === 0 && <p className="perm-card-why" style={{ textAlign: 'center', padding: 20 }}>{T.noAlerts}</p>}
          {alerts.map(a => (
            <div key={a.id} className={`security-alert-card security-alert--${a.severity || 'low'}`}>
              <div className="security-alert-icon" style={{ color: SEVERITY_COLORS[a.severity] || '#999' }}>
                <i className={`fas ${ALERT_ICONS[a.kind] || 'fa-triangle-exclamation'}`} />
              </div>
              <div className="security-alert-body">
                <div className="security-alert-kind">{a.kind?.replace('_', ' ').toUpperCase()}</div>
                <div className="security-alert-meta">
                  {a.ip_address && <span><i className="fas fa-globe" /> {a.ip_address}</span>}
                  <span className={`perm-badge perm-badge--${a.severity === 'critical' ? 'error' : a.severity === 'high' ? 'warn' : 'neutral'}`}>{a.severity}</span>
                </div>
              </div>
              <div className="security-alert-actions">
                {!a.resolved && (
                  <button type="button" className="perm-btn perm-btn--small" onClick={() => resolveAlert(a.id)} disabled={busy === a.id}>
                    {busy === a.id ? '…' : <><i className="fas fa-check" /> {T.resolve}</>}
                  </button>
                )}
                {a.ip_address && (
                  <button type="button" className="perm-btn perm-btn--small" onClick={() => banIP(a.ip_address)} disabled={busy === `ban-${a.ip_address}`}>
                    {busy === `ban-${a.ip_address}` ? '…' : <><i className="fas fa-ban" /> {T.ban}</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Login Analytics ───────────────────────────────────── */}
      {activeTab === 'logins' && (
        <div className="diag-section">
          <h3><i className="fas fa-sign-in-alt" /> {T.logins}</h3>
          {loginStats ? (
            <div className="diag-grid diag-grid--3col">
              <div className="diag-card"><div className="diag-card-label">{T.total}</div><div className="diag-card-value">{loginStats.total || '—'}</div></div>
              <div className="diag-card"><div className="diag-card-label">{T.success}</div><div className="diag-card-value" style={{ color: 'var(--color-success, #2ecc71)' }}>{loginStats.success || '—'}</div></div>
              <div className="diag-card"><div className="diag-card-label">{T.failures}</div><div className="diag-card-value" style={{ color: 'var(--color-error, #e74c3c)' }}>{loginStats.failures || '—'}</div></div>
            </div>
          ) : <p className="perm-card-why">{isHt ? 'Pa ka chaje estatistik koneksyon.' : 'Cannot load login statistics.'}</p>}
        </div>
      )}

      {/* ── Rate Limits ───────────────────────────────────────── */}
      {activeTab === 'rateLimit' && (
        <div className="diag-section">
          <h3><i className="fas fa-tachometer-alt" /> {T.rateLimit}</h3>
          {rateHits.length > 0 ? (
            <div className="security-rate-list">
              {rateHits.slice(0, 20).map((r, i) => (
                <div key={i} className="security-rate-row">
                  <span className="security-rate-bucket">{r.bucket || r.key || '—'}</span>
                  <span className="security-rate-count">{r.count || r.hits || '—'}</span>
                </div>
              ))}
            </div>
          ) : <p className="perm-card-why">{isHt ? 'Okenn limit pousantaj depase.' : 'No rate limits exceeded.'}</p>}
        </div>
      )}

      {/* ── Banned IPs ────────────────────────────────────────── */}
      {activeTab === 'banned' && (
        <div className="diag-section">
          <h3><i className="fas fa-ban" /> {T.banned}</h3>
          {bannedIPs.length > 0 ? (
            <div className="security-banned-list">
              {bannedIPs.map(ip => (
                <div key={ip.id || ip.ip_address} className="security-banned-row">
                  <span className="security-banned-ip"><i className="fas fa-globe" /> {ip.ip_address}</span>
                  <span className="security-banned-reason">{ip.reason || ip.note || '—'}</span>
                  <button type="button" className="perm-btn perm-btn--small" onClick={() => unbanIP(ip.id)} disabled={busy === `unban-${ip.id}`}>
                    {busy === `unban-${ip.id}` ? '…' : T.unban}
                  </button>
                </div>
              ))}
            </div>
          ) : <p className="perm-card-why">{isHt ? 'Okenn IP bloke.' : 'No banned IPs.'}</p>}
        </div>
      )}
    </div>
  );
}
