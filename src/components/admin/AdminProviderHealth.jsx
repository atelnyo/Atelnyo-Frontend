/**
 * AdminProviderHealth — Admin Provider Health Monitor.
 *
 * Route: /sheet/admin/provider-health
 * Access: Staff / superuser only
 *
 * Displays per-provider health metrics:
 *   - Provider status (healthy / degraded / unhealthy)
 *   - Availability %
 *   - Avg response time
 *   - Success rate
 *   - Timeout rate
 *   - Failure rate
 *   - Redirect issues
 *   - Certificate errors
 *   - Total validations
 *   - Last checked
 *
 * Clicking a provider opens detail view with trend data.
 */

import { useEffect, useState, useCallback } from 'react';
import { mediaProviderService } from '../../services/api';
import '../../styles/admin-provider-health.css';

function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(1)}%`;
}

const STATUS_CFG = {
  healthy:   { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Healthy' },
  degraded:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Degraded' },
  unhealthy: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Unhealthy' },
  unknown:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: 'Unknown' },
};

function ProviderCard({ provider, onClick }) {
  const cfg = STATUS_CFG[provider.status] || STATUS_CFG.unknown;
  return (
    <div
      className="aph-provider-card"
      style={{ '--aph-accent': cfg.color }}
      onClick={() => onClick?.(provider)}
      role="button"
      tabIndex={0}
    >
      <div className="aph-provider-header">
        <div className="aph-provider-name">{provider.provider_name || provider.provider_key}</div>
        <span className="aph-provider-status" style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
      <div className="aph-provider-grid">
        <div className="aph-provider-metric">
          <div className="aph-metric-value" style={{ color: cfg.color }}>{pct(provider.availability_pct)}</div>
          <div className="aph-metric-label">Availability</div>
        </div>
        <div className="aph-provider-metric">
          <div className="aph-metric-value">{provider.avg_response_time_ms != null ? `${Math.round(provider.avg_response_time_ms)}ms` : '—'}</div>
          <div className="aph-metric-label">Avg Response</div>
        </div>
        <div className="aph-provider-metric">
          <div className="aph-metric-value">{pct(provider.success_rate_pct)}</div>
          <div className="aph-metric-label">Success Rate</div>
        </div>
        <div className="aph-provider-metric">
          <div className="aph-metric-value" style={{ color: provider.failure_rate_pct > 5 ? '#ef4444' : undefined }}>{pct(provider.failure_rate_pct)}</div>
          <div className="aph-metric-label">Failure Rate</div>
        </div>
        <div className="aph-provider-metric">
          <div className="aph-metric-value">{fmtCount(provider.total_validations)}</div>
          <div className="aph-metric-label">Validations</div>
        </div>
        <div className="aph-provider-metric">
          <div className="aph-metric-value">{provider.timeout_rate_pct > 0 ? `${provider.timeout_rate_pct.toFixed(1)}%` : '0%'}</div>
          <div className="aph-metric-label">Timeouts</div>
        </div>
      </div>
      {(provider.redirect_issues > 0 || provider.certificate_errors > 0) && (
        <div className="aph-provider-warnings">
          {provider.redirect_issues > 0 && (
            <span className="aph-warning" style={{ color: '#f59e0b' }}>
              <i className="fas fa-exclamation-triangle" /> {fmtCount(provider.redirect_issues)} redirect issues
            </span>
          )}
          {provider.certificate_errors > 0 && (
            <span className="aph-warning" style={{ color: '#ef4444' }}>
              <i className="fas fa-lock" /> {fmtCount(provider.certificate_errors)} cert errors
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderDetail({ provider, onBack }) {
  const [trends, setTrends] = useState(null);
  const [loadingTrends, setLoadingTrends] = useState(true);

  useEffect(() => {
    if (!provider?.provider_key) return;
    setLoadingTrends(true);
    mediaProviderService.providerHealthTrends(provider.provider_key, 30)
      .then((res) => {
        const data = res?.data;
        setTrends(Array.isArray(data) ? data : (data?.trends || data?.results || []));
      })
      .catch(() => setTrends([]))
      .finally(() => setLoadingTrends(false));
  }, [provider]);

  const cfg = STATUS_CFG[provider.status] || STATUS_CFG.unknown;

  return (
    <div className="aph-detail">
      <button type="button" className="aph-back" onClick={onBack}>
        <i className="fas fa-arrow-left" /> Back
      </button>

      <div className="aph-detail-header">
        <div>
          <h2 className="aph-detail-title">{provider.provider_name || provider.provider_key}</h2>
          <span className="aph-provider-status" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="aph-detail-meta">
          {provider.last_checked && (
            <span>Last checked: {new Date(provider.last_checked).toLocaleString()}</span>
          )}
          <span>Window: {provider.window_hours || 168}h</span>
        </div>
      </div>

      <div className="aph-detail-grid">
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Availability</div>
          <div className="aph-detail-card-value" style={{ color: cfg.color }}>{pct(provider.availability_pct)}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Avg Response Time</div>
          <div className="aph-detail-card-value">{provider.avg_response_time_ms != null ? `${Math.round(provider.avg_response_time_ms)}ms` : '—'}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Success Rate</div>
          <div className="aph-detail-card-value">{pct(provider.success_rate_pct)}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Failure Rate</div>
          <div className="aph-detail-card-value" style={{ color: provider.failure_rate_pct > 5 ? '#ef4444' : undefined }}>{pct(provider.failure_rate_pct)}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Timeout Rate</div>
          <div className="aph-detail-card-value">{pct(provider.timeout_rate_pct)}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Total Validations</div>
          <div className="aph-detail-card-value">{fmtCount(provider.total_validations)}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Redirect Issues</div>
          <div className="aph-detail-card-value" style={{ color: provider.redirect_issues > 0 ? '#f59e0b' : undefined }}>{fmtCount(provider.redirect_issues)}</div>
        </div>
        <div className="aph-detail-card">
          <div className="aph-detail-card-label">Certificate Errors</div>
          <div className="aph-detail-card-value" style={{ color: provider.certificate_errors > 0 ? '#ef4444' : undefined }}>{fmtCount(provider.certificate_errors)}</div>
        </div>
      </div>

      <div className="aph-trends-section">
        <h3 className="aph-trends-title">30-Day Trends</h3>
        {loadingTrends ? (
          <div className="aph-trends-loading"><i className="fas fa-spinner fa-spin" /> Loading...</div>
        ) : trends && trends.length > 0 ? (
          <div className="aph-trends-table-wrap">
            <table className="aph-trends-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Validations</th>
                  <th>Success Rate</th>
                  <th>Avg Response</th>
                  <th>Failures</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t, i) => (
                  <tr key={i}>
                    <td>{t.date || t.day || `Day ${i + 1}`}</td>
                    <td>{fmtCount(t.total_validations || t.count || t.validations)}</td>
                    <td>{pct(t.success_rate_pct || t.success_rate)}</td>
                    <td>{t.avg_response_time_ms != null ? `${Math.round(t.avg_response_time_ms)}ms` : '—'}</td>
                    <td style={{ color: (t.failure_rate_pct || t.failure_rate || 0) > 5 ? '#ef4444' : undefined }}>
                      {pct(t.failure_rate_pct || t.failure_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="aph-trends-empty">No trend data available for this provider.</div>
        )}
      </div>
    </div>
  );
}

export default function AdminProviderHealth({ lang = 'ht', showToast }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [windowHours, setWindowHours] = useState(168);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    mediaProviderService.providerHealthList(windowHours)
      .then((res) => {
        const list = res?.data?.providers || res?.data || [];
        setProviders(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Failed to load provider health.');
      })
      .finally(() => setLoading(false));
  }, [windowHours]);

  useEffect(() => { load(); }, [load]);

  const healthyCount = providers.filter((p) => p.status === 'healthy').length;
  const degradedCount = providers.filter((p) => p.status === 'degraded').length;
  const unhealthyCount = providers.filter((p) => p.status === 'unhealthy').length;

  if (selected) {
    return <ProviderDetail provider={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="aph-page">
      <div className="aph-page-header">
        <h2 className="aph-page-title">
          <i className="fas fa-heart-pulse" /> Provider Health
        </h2>
        <div className="aph-page-controls">
          <label className="aph-window-label">Window:</label>
          <select
            className="aph-window-select"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
          >
            <option value="24">24h</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
            <option value="336">14 days</option>
            <option value="720">30 days</option>
          </select>
        </div>
      </div>

      <div className="aph-summary-row">
        <div className="aph-summary-card" style={{ '--aph-accent': '#10b981' }}>
          <div className="aph-summary-value">{healthyCount}</div>
          <div className="aph-summary-label">Healthy</div>
        </div>
        <div className="aph-summary-card" style={{ '--aph-accent': '#f59e0b' }}>
          <div className="aph-summary-value">{degradedCount}</div>
          <div className="aph-summary-label">Degraded</div>
        </div>
        <div className="aph-summary-card" style={{ '--aph-accent': '#ef4444' }}>
          <div className="aph-summary-value">{unhealthyCount}</div>
          <div className="aph-summary-label">Unhealthy</div>
        </div>
        <div className="aph-summary-card" style={{ '--aph-accent': '#94a3b8' }}>
          <div className="aph-summary-value">{providers.length}</div>
          <div className="aph-summary-label">Total Providers</div>
        </div>
      </div>

      {error && (
        <div className="aph-error">
          <i className="fas fa-circle-exclamation" /> {error}
        </div>
      )}

      {loading ? (
        <div className="aph-loading"><i className="fas fa-spinner fa-spin" /> Loading...</div>
      ) : (
        <div className="aph-provider-list">
          {providers.map((p) => (
            <ProviderCard key={p.provider_key} provider={p} onClick={setSelected} />
          ))}
          {providers.length === 0 && (
            <div className="aph-empty">No providers found.</div>
          )}
        </div>
      )}
    </div>
  );
}
