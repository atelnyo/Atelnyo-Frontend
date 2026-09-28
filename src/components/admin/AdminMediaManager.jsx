/**
 * src/components/admin/AdminMediaManager.jsx
 *
 * Admin Media Provider Manager — full page inside the admin panel.
 *
 * Tabs:
 *   providers      — List all providers with toggle, category, difficulty
 *   validation-logs— Recent URL validation attempts
 *   stats          — Summary stats (total URLs, valid, broken, etc.)
 *
 * Route: /sheet/admin/media
 * Access: Staff / superuser only
 */

// React itself is unused here — the new JSX runtime
// (configured by @vitejs/plugin-react) auto-injects the
// jsx-runtime import, so a default React import isn't
// needed. Dropping it keeps the dep graph clean and
// silences future "unused React" warnings.
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { mediaProviderService } from '../../services/api';
import '../../styles/admin-media.css';

// ─── Provider Create Form Modal ────────────────────────────────────────

const DIFFICULTY_OPTIONS = ['beginner', 'intermediate', 'professional'];
const CATEGORY_OPTIONS = ['recommended', 'professional'];

function AddProviderForm({ onClose, onCreated, showToast }) {
  const [form, setForm] = useState({
    key: '', name: '', category: 'professional', difficulty: 'intermediate',
    media_types: 'image', website_url: '', free_plan: '', description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.key.trim() || !form.name.trim()) {
      setError('Key and Name are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await mediaProviderService.create(form);
      showToast?.(`Provider "${form.name}" created!`, 'check');
      onCreated();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.key?.[0] || 'Failed to create provider.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="amm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="amm-modal-card">
        <div className="amm-modal-header">
          <h3 className="amm-modal-title">
            <i className="fas fa-plus-circle" /> Add Provider
          </h3>
          <button type="button" className="amm-modal-close" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>
        <form className="amm-modal-form" onSubmit={handleSubmit}>
          <div className="amm-modal-row">
            <div className="amm-modal-field">
              <label className="amm-modal-field-label">Key *</label>
              <input className="amm-modal-input" placeholder="e.g. my_provider" value={form.key}
                onChange={handleChange('key')} disabled={saving} />
            </div>
            <div className="amm-modal-field">
              <label className="amm-modal-field-label">Name *</label>
              <input className="amm-modal-input" placeholder="e.g. My Provider" value={form.name}
                onChange={handleChange('name')} disabled={saving} />
            </div>
          </div>
          <div className="amm-modal-row">
            <div className="amm-modal-field">
              <label className="amm-modal-field-label">Category</label>
              <select className="amm-modal-input" value={form.category} onChange={handleChange('category')} disabled={saving}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="amm-modal-field">
              <label className="amm-modal-field-label">Difficulty</label>
              <select className="amm-modal-input" value={form.difficulty} onChange={handleChange('difficulty')} disabled={saving}>
                {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="amm-modal-field">
            <label className="amm-modal-field-label">Media Types</label>
            <input className="amm-modal-input" placeholder="image,video,audio,document" value={form.media_types}
              onChange={handleChange('media_types')} disabled={saving} />
          </div>
          <div className="amm-modal-field">
            <label className="amm-modal-field-label">Website URL</label>
            <input className="amm-modal-input" placeholder="https://example.com" value={form.website_url}
              onChange={handleChange('website_url')} disabled={saving} />
          </div>
          <div className="amm-modal-field">
            <label className="amm-modal-field-label">Free Plan</label>
            <input className="amm-modal-input" placeholder="Free: 10 GB storage, ..." value={form.free_plan}
              onChange={handleChange('free_plan')} disabled={saving} />
          </div>
          <div className="amm-modal-field">
            <label className="amm-modal-field-label">Description</label>
            <textarea className="amm-modal-input amm-modal-textarea" placeholder="Short description..." value={form.description}
              onChange={handleChange('description')} disabled={saving} rows={2} />
          </div>
          {error && <div className="amm-modal-error"><i className="fas fa-exclamation-circle" /> {error}</div>}
          <div className="amm-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Creating...</> : <><i className="fas fa-plus" /> Create Provider</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return '—'; }
}

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ─── Tab config ───────────────────────────────────────────────────────

const TABS = [
  { id: 'providers',       icon: 'fa-cloud',        label: 'Providers' },
  { id: 'validation-logs', icon: 'fa-history',       label: 'Validation Logs' },
  { id: 'stats',           icon: 'fa-chart-simple',  label: 'Stats' },
];

// ─── Provider Row ─────────────────────────────────────────────────────

function ProviderRow({ provider, onToggle, onEdit }) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(provider);
    } finally {
      setToggling(false);
    }
  };

  const difficultyMeta = {
    beginner:     { color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.1))' },
    intermediate: { color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.1))' },
    professional: { color: 'var(--state-error, #ef4444)', bg: 'var(--severity-high-bg, rgba(239,68,68,0.1))' },
  };
  const diff = difficultyMeta[provider.difficulty] || difficultyMeta.beginner;

  return (
    <tr className="amm-row" data-active={provider.is_active}>
      <td className="amm-cell amm-cell-name">
        <div className="amm-provider-info">
          <div className="amm-provider-logo-sm">
            {provider.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="amm-provider-name">{provider.name}</div>
            <div className="amm-provider-key">{provider.key}</div>
          </div>
        </div>
      </td>
      <td className="amm-cell">
        <span className="amm-badge" style={{ background: provider.category === 'recommended' ? 'var(--severity-medium-bg, rgba(245,158,11,0.1))' : 'var(--state-neutral-bg, rgba(100,116,139,0.1))', color: provider.category === 'recommended' ? 'var(--state-warning, #f59e0b)' : 'var(--text-secondary, #64748b)' }}>
          {provider.category === 'recommended' ? '⭐' : ''} {provider.category}
        </span>
      </td>
      <td className="amm-cell">
        <span className="amm-badge" style={{ background: diff.bg, color: diff.color }}>
          {provider.difficulty}
        </span>
      </td>
      <td className="amm-cell">
        {provider.media_types?.split(',').map((mt) => mt.trim()).filter(Boolean).map((mt) => (
          <span key={mt} className="amm-media-tag">{mt}</span>
        ))}
      </td>
      <td className="amm-cell amm-cell-center">
        <span className="amm-free-badge" data-free={provider.free_plan}>
          {provider.free_plan ? 'Free' : 'Paid'}
        </span>
      </td>
      <td className="amm-cell amm-cell-center">
        <span className={`amm-status-dot ${provider.is_active ? 'amm-status-active' : 'amm-status-inactive'}`} />
        {provider.is_active ? 'Active' : 'Inactive'}
      </td>
      <td className="amm-cell amm-cell-actions">
        <button
          type="button"
          className={`amm-toggle-btn ${provider.is_active ? 'amm-toggle-on' : 'amm-toggle-off'}`}
          onClick={handleToggle}
          disabled={toggling}
          title={provider.is_active ? 'Disable provider' : 'Enable provider'}
        >
          {toggling ? (
            <i className="fas fa-spinner fa-spin" />
          ) : provider.is_active ? (
            <i className="fas fa-pause" />
          ) : (
            <i className="fas fa-play" />
          )}
        </button>
      </td>
    </tr>
  );
}

// ─── Validation Log Row ───────────────────────────────────────────────

function ValidationLogRow({ log }) {
  return (
    <tr className="amm-row">
      <td className="amm-cell amm-cell-url">
        <span className="amm-url-text" title={log.url}>{log.url}</span>
      </td>
      <td className="amm-cell">
        <span className={`amm-status-badge ${log.is_valid ? 'amm-status-valid' : 'amm-status-invalid'}`}>
          {log.is_valid ? 'Valid' : 'Invalid'}
        </span>
      </td>
      <td className="amm-cell">{log.detected_provider || '—'}</td>
      <td className="amm-cell">{log.mime_type || '—'}</td>
      <td className="amm-cell">{log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}</td>
      <td className="amm-cell">{log.error_message || '—'}</td>
      <td className="amm-cell amm-cell-date">{fmtDate(log.validated_at)}</td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export default function AdminMediaManager({ lang = 'ht', showToast, user, onNavigate }) {
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;

  const [activeTab, setActiveTab] = useState('providers');
  const [providers, setProviders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [logFilter, setLogFilter] = useState('all'); // 'all' | 'invalid'
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // ─── Admin gate ──────────────────────────────────────────────────
  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.('Staff access required.', 'user-lock');
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, onNavigate, showToast]);

  // ─── Fetch data ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        mediaProviderService.list(),
        mediaProviderService.validationLogs({ limit: 50 }),
        mediaProviderService.validationStats(),
      ]);

      if (results[0].status === 'fulfilled') {
        const data = results[0].value.data?.results || results[0].value.data || [];
        setProviders(Array.isArray(data) ? data : []);
      }

      if (results[1].status === 'fulfilled') {
        const data = results[1].value.data?.results || results[1].value.data || [];
        setLogs(Array.isArray(data) ? data : []);
      }

      if (results[2].status === 'fulfilled') {
        setStats(results[2].value.data || null);
      }

      if (results[0].status === 'rejected') {
        setError('Failed to load providers.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll, lastRefresh]);

  // ─── Refresh provider list after creation ───────────────────────
  const handleProviderCreated = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Toggle provider ─────────────────────────────────────────────
  const handleToggle = useCallback(async (provider) => {
    try {
      await mediaProviderService.toggle(provider.key);
      setProviders((prev) =>
        prev.map((p) =>
          p.key === provider.key ? { ...p, is_active: !p.is_active } : p
        )
      );
      showToast?.(`${provider.name} ${provider.is_active ? 'disabled' : 'enabled'}`, 'check');
    } catch (err) {
      showToast?.(`Failed to toggle ${provider.name}`, 'exclamation-triangle');
    }
  }, [showToast]);

  // ─── Early non-staff return ──────────────────────────────────────
  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="amm-shell">
        <div className="amm-empty">
          <i className="fas fa-user-lock" />
          <h3>Staff Access Required</h3>
          <p>You need staff permissions to manage media providers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="amm-shell">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="amm-header">
        <div className="amm-header-left">
          <button type="button" className="amm-back" onClick={() => onNavigate?.(-1)} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="amm-title">
              <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
              {' '}Media Provider Manager
            </h1>
            <p className="amm-subtitle">
              Manage media providers, view validation logs, and monitor stats
            </p>
          </div>
        </div>
        <div className="amm-header-right">
          <button type="button" className="amm-refresh" onClick={() => setLastRefresh(Date.now())} title="Refresh">
            <i className="fas fa-rotate" />
          </button>
        </div>
      </div>

      <div className="amm-body">
        {/* ── Tabs ──────────────────────────────────────────────── */}
        <div className="amm-tabs" role="tablist" aria-label="Media manager sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={classNames('amm-tab', activeTab === tab.id && 'amm-tab-active')}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fas ${tab.icon}`} aria-hidden="true" />
              {tab.label}
              {tab.id === 'providers' && providers.length > 0 && (
                <span className="amm-tab-count">{providers.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Error banner ──────────────────────────────────────── */}
        {error && (
          <div className="amm-error-banner">
            <i className="fas fa-circle-exclamation" />
            <span>{error}</span>
            <button type="button" onClick={fetchAll}>Retry</button>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────── */}
        {loading && !providers.length && (
          <div className="amm-loading">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading...</span>
          </div>
        )}

        {/* ── Tab: Providers ────────────────────────────────────── */}
        {activeTab === 'providers' && (
          <div className="amm-section">
            <div className="amm-section-header">
              <h2 className="amm-section-title">
                <i className="fas fa-cloud" aria-hidden="true" />
                {' '}All Providers
              </h2>
              <div className="amm-section-header-right">
                <button type="button" className="btn-primary" onClick={() => setShowAddForm(true)}>
                  <i className="fas fa-plus" /> Add Provider
                </button>
                <span className="amm-section-count">{providers.length} total</span>
              </div>
            </div>
            {providers.length === 0 && !loading ? (
              <div className="amm-empty">
                <i className="fas fa-cloud" />
                <p>No providers found. Run <code>seed_media_providers</code> to populate.</p>
              </div>
            ) : (
              <div className="amm-table-wrap">
                <table className="amm-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Media Types</th>
                      <th className="amm-cell-center">Pricing</th>
                      <th className="amm-cell-center">Status</th>
                      <th className="amm-cell-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((p) => (
                      <ProviderRow
                        key={p.id || p.key}
                        provider={p}
                        onToggle={handleToggle}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Validation Logs ──────────────────────────────── */}
        {activeTab === 'validation-logs' && (
          <div className="amm-section">
            <div className="amm-section-header">
              <h2 className="amm-section-title">
                <i className="fas fa-history" aria-hidden="true" />
                {' '}Recent Validations
              </h2>
              <div className="amm-section-header-right">
                <div className="amm-filter-group">
                  <button
                    type="button"
                    className={`amm-filter-btn ${logFilter === 'all' ? 'amm-filter-active' : ''}`}
                    onClick={() => setLogFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`amm-filter-btn ${logFilter === 'invalid' ? 'amm-filter-active' : ''}`}
                    onClick={() => setLogFilter('invalid')}
                  >
                    <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                    {' '}Broken Links
                  </button>
                </div>
                <span className="amm-section-count">{logs.length} entries</span>
              </div>
            </div>
            {logs.length === 0 && !loading ? (
              <div className="amm-empty">
                <i className="fas fa-inbox" />
                <p>No validation logs yet. Try validating a URL first.</p>
              </div>
            ) : (
              <>
                {logFilter === 'invalid' && logs.filter((l) => !l.is_valid).length === 0 && (
                  <div className="amm-empty" style={{ padding: '20px' }}>
                    <i className="fas fa-check-circle" style={{ color: 'var(--state-success, #10b981)', opacity: 0.4 }} />
                    <p>No broken links found. All recent validations passed.</p>
                  </div>
                )}
                {(logFilter === 'all' || logs.filter((l) => !l.is_valid).length > 0) && (
                  <div className="amm-table-wrap">
                    <table className="amm-table">
                      <thead>
                        <tr>
                          <th>URL</th>
                          <th>Status</th>
                          <th>Provider</th>
                          <th>MIME</th>
                          <th>Response Time</th>
                          <th>Error</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(logFilter === 'invalid' ? logs.filter((l) => !l.is_valid) : logs).map((log, i) => (
                          <ValidationLogRow key={log.id || i} log={log} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab: Stats ────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="amm-section">
            <h2 className="amm-section-title">
              <i className="fas fa-chart-simple" aria-hidden="true" />
              {' '}Validation Statistics
            </h2>
            {!stats && !loading ? (
              <div className="amm-empty">
                <i className="fas fa-chart-bar" />
                <p>No stats available yet.</p>
              </div>
            ) : (
              <div className="amm-stats-grid">
                <div className="amm-stat-card" data-accent="pink">
                  <i className="fas fa-cloud" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Total Providers</span>
                    <span className="amm-stat-value">{providers.length}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="emerald">
                  <i className="fas fa-check-circle" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Active</span>
                    <span className="amm-stat-value">{providers.filter((p) => p.is_active).length}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="red">
                  <i className="fas fa-pause-circle" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Inactive</span>
                    <span className="amm-stat-value">{providers.filter((p) => !p.is_active).length}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="sky">
                  <i className="fas fa-check" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Valid URLs</span>
                    <span className="amm-stat-value">{stats?.valid_count != null ? fmtNumber(stats.valid_count) : '—'}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="amber">
                  <i className="fas fa-times" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Invalid URLs</span>
                    <span className="amm-stat-value">{stats?.invalid_count != null ? fmtNumber(stats.invalid_count) : '—'}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="violet">
                  <i className="fas fa-clock" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Avg Response</span>
                    <span className="amm-stat-value">{stats?.avg_response_time_ms != null ? `${Math.round(stats.avg_response_time_ms)}ms` : '—'}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="teal">
                  <i className="fas fa-database" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Total Logs</span>
                    <span className="amm-stat-value">{stats?.total_count != null ? fmtNumber(stats.total_count) : '—'}</span>
                  </div>
                </div>
                <div className="amm-stat-card" data-accent="indigo">
                  <i className="fas fa-percent" aria-hidden="true" />
                  <div className="amm-stat-body">
                    <span className="amm-stat-label">Success Rate</span>
                    <span className="amm-stat-value">
                      {stats?.valid_count != null && stats?.total_count > 0
                        ? `${Math.round((stats.valid_count / stats.total_count) * 100)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="amm-footer">
        <span className="amm-footer-text">
          <i className="fas fa-shield-halved" /> Admin Panel · Media Providers
        </span>
        <span className="amm-footer-text">
          <i className="fas fa-sync" /> Last refresh: {new Date(lastRefresh).toLocaleTimeString()}
        </span>
      </div>

      {/* ── Add Provider Modal ──────────────────────────────────── */}
      {showAddForm && (
        <AddProviderForm
          onClose={() => setShowAddForm(false)}
          onCreated={handleProviderCreated}
          showToast={showToast}
        />
      )}
    </div>
  );
}
