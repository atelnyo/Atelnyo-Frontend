/**
 * AdminMediaMonitor — Tablodbò admin pou siveye sante medya yo.
 *
 * Montre an tan reyèl:
 *   - Broken Media Today
 *   - Failed Validations
 *   - Top Providers
 *   - Most Active Creators
 *   - Flagged URLs
 *   - Provider Availability
 *   - System Health
 *   - Validation Queue
 *   - Recent Errors
 *   - Provider Incidents
 */
import React, { useEffect, useState, useCallback } from 'react';
import { mediaProviderService } from '../../services/api';
import MediaBadge from '../media/MediaBadge';
import MediaStatus from '../media/MediaStatus';
import MediaHelp from '../media/MediaHelp';

function fmtCount(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function StatCard({ icon, label, value, color, subtitle }) {
  return (
    <div className="admin-monitor-card" style={{ '--monitor-accent': color || 'var(--studio-pink)' }}>
      <div className="admin-monitor-card-icon">
        <i className={`fas ${icon}`} />
      </div>
      <div className="admin-monitor-card-body">
        <div className="admin-monitor-card-value">{value != null ? fmtCount(value) : '—'}</div>
        <div className="admin-monitor-card-label">{label}</div>
        {subtitle && <div className="admin-monitor-card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

export default function AdminMediaMonitor({ lang = 'ht', showToast }) {
  const isHt = lang === 'ht';
  const [validationStats, setValidationStats] = useState(null);
  const [providers, setProviders] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, provRes, logsRes] = await Promise.allSettled([
        mediaProviderService.validationStats(),
        mediaProviderService.list(),
        mediaProviderService.validationLogs({ limit: 20 }),
      ]);

      if (statsRes.status === 'fulfilled') setValidationStats(statsRes.value.data);
      if (provRes.status === 'fulfilled') {
        const data = provRes.value.data?.results || provRes.value.data || [];
        setProviders(Array.isArray(data) ? data : []);
      }
      if (logsRes.status === 'fulfilled') {
        const data = logsRes.value.data?.results || logsRes.value.data || [];
        setRecentLogs(Array.isArray(data) ? data.slice(0, 20) : []);
      }
    } catch (err) {
      showToast?.(isHt ? 'Pa kapab chaje done yo' : 'Failed to load data', 'exclamation-triangle');
    } finally {
      setLoading(false);
    }
  }, [isHt, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalValidations = validationStats?.total || 0;
  const validCount = validationStats?.valid || 0;
  const invalidCount = validationStats?.invalid || 0;
  const brokenRatio = totalValidations > 0 ? ((invalidCount / totalValidations) * 100).toFixed(1) : '0.0';

  return (
    <div className="admin-monitor">
      {/* Header */}
      <div className="admin-monitor-header">
        <h2 className="studio-section-title" style={{ margin: 0 }}>
          <i className="fas fa-heartbeat" /> {isHt ? 'Siveyans Medya' : 'Media Monitoring'}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={fetchData}>
            <i className="fas fa-sync" /> {isHt ? 'Rafrechi' : 'Refresh'}
          </button>
          <MediaHelp context="library" lang={lang} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="admin-monitor-grid">
        <StatCard icon="fa-database" label={isHt ? 'Total validasyon' : 'Total Validations'} value={totalValidations} color="#38bdf8" />
        <StatCard icon="fa-check-circle" label={isHt ? 'Valid' : 'Valid'} value={validCount} color="#10b981" subtitle={`${totalValidations > 0 ? ((validCount / totalValidations) * 100).toFixed(1) : '0'}%`} />
        <StatCard icon="fa-times-circle" label={isHt ? 'Envalid' : 'Invalid'} value={invalidCount} color="#ef4444" subtitle={`${brokenRatio}%`} />
        <StatCard icon="fa-cloud" label={isHt ? 'Providers' : 'Providers'} value={providers.length} color="#8b5cf6" />
        <StatCard icon="fa-check-double" label={isHt ? 'Sante sistèm' : 'System Health'} value={brokenRatio < 10 ? 'Good' : brokenRatio < 30 ? 'Fair' : 'Poor'} color={brokenRatio < 10 ? '#10b981' : brokenRatio < 30 ? '#f59e0b' : '#ef4444'} />
      </div>

      {/* Provider Stats */}
      {validationStats?.by_provider && (
        <div className="admin-monitor-section">
          <h3 className="hub-section-subtitle">
            <i className="fas fa-cloud" /> {isHt ? 'Estati pa Provider' : 'Status by Provider'}
          </h3>
          <div className="admin-monitor-providers">
            {Object.entries(validationStats.by_provider).map(([key, data]) => (
              <div key={key} className="admin-monitor-provider-card">
                <div className="admin-monitor-provider-name">{data.name || key}</div>
                <div className="admin-monitor-provider-metrics">
                  <span className="admin-monitor-metric-green">
                    <i className="fas fa-check-circle" /> {data.valid || 0}
                  </span>
                  <span className="admin-monitor-metric-red">
                    <i className="fas fa-times-circle" /> {data.invalid || 0}
                  </span>
                  <span className="admin-monitor-metric-total">
                    {data.total || 0} {isHt ? 'total' : 'total'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Validation Logs */}
      <div className="admin-monitor-section">
        <h3 className="hub-section-subtitle">
          <i className="fas fa-list" /> {isHt ? 'Dènye Validasyon' : 'Recent Validations'}
        </h3>
        <div className="admin-monitor-logs">
          {loading ? (
            <div className="admin-monitor-loading">
              <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="admin-monitor-empty">
              <i className="fas fa-inbox" />
              <p>{isHt ? 'Pa gen validasyon ankò.' : 'No validations yet.'}</p>
            </div>
          ) : (
            <table className="admin-monitor-table">
              <thead>
                <tr>
                  <th>{isHt ? 'URL' : 'URL'}</th>
                  <th>{isHt ? 'Estati' : 'Status'}</th>
                  <th>{isHt ? 'Sante' : 'Health'}</th>
                  <th>{isHt ? 'Kòd' : 'Code'}</th>
                  <th>{isHt ? 'Dat' : 'Date'}</th>
                  <th>{isHt ? 'Itilizatè' : 'User'}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="admin-monitor-url" title={log.url}>
                      {log.url?.slice(0, 50)}...
                    </td>
                    <td>
                      <MediaBadge status={log.health_status || 'unknown'} size="sm" lang={lang} />
                    </td>
                    <td>{log.is_valid ? '✅' : '❌'}</td>
                    <td>{log.status_code || '—'}</td>
                    <td className="admin-monitor-date">
                      {log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>{log.checked_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Provider Health */}
      <div className="admin-monitor-section">
        <h3 className="hub-section-subtitle">
          <i className="fas fa-stethoscope" /> {isHt ? 'Sante Providers' : 'Provider Health'}
        </h3>
        <div className="admin-monitor-providers-health">
          {providers.map((p) => (
            <div key={p.key || p.id} className="admin-monitor-health-item">
              <span className="admin-monitor-health-name">{p.name}</span>
              <MediaStatus
                status={p.is_active ? 'healthy' : 'blocked'}
                lang={lang}
                size="sm"
              />
              <span className="admin-monitor-health-types">
                {p.media_types || '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
