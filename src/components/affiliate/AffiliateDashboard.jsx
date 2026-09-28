/**
 * src/components/affiliate/AffiliateDashboard.jsx
 *
 * Self-service dashboard for approved affiliates.
 *
 * Sections:
 *   1. Overview  — aggregate stats (clicks, conversions, earned)
 *   2. My Links  — view active links + create new ones
 *   3. Earnings  — conversion history with amounts
 *   4. Profile   — affiliate level, trust score, groups
 */
import React, { useState, useCallback } from 'react';
import { affiliateApi } from '../../services/affiliateApi';
import { API_URL } from '../../services/api';
import useFetch from '../../hooks/useFetch';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { translations } from '../../data/translations';
import './AffiliateDashboard.css';

const DASHBOARD_TABS = [
  { id: 'overview', icon: 'fa-chart-pie',   label: 'Overview',     labelHt: 'Apèsi' },
  { id: 'applications', icon: 'fa-file-alt', label: 'Applications', labelHt: 'Aplikasyon' },
  { id: 'links',    icon: 'fa-link',         label: 'My Links',     labelHt: 'Lyen Mwen' },
  { id: 'earnings', icon: 'fa-coins',        label: 'Earnings',     labelHt: 'Salè' },
  { id: 'profile',  icon: 'fa-user-circle',  label: 'Profile',     labelHt: 'Pwofil' },
];

function fmtCurrency(amount) {
  const num = Number(amount) || 0;
  return `$${num.toFixed(2)}`;
}

function fmtCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(dateStr));
  } catch { return dateStr; }
}

// ─── Loading Skeleton ────────────────────────────────────────────────
function Skeleton({ rows = 3 }) {
  return (
    <div className="aff-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="aff-skeleton-row">
          <div className="aff-skeleton-bar w-75" />
          <div className="aff-skeleton-bar w-50" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────
function Empty({ icon = 'fa-folder-open', title, hint }) {
  return (
    <div className="aff-empty">
      <i className={`fas ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────
function OverviewTab({ lang }) {
  const { data: dashboard, loading } = useFetch(
    () => affiliateApi.getDashboard(),
    { defaultValue: null, deps: [] },
  );

  if (loading) return <Skeleton rows={4} />;
  if (!dashboard) return <Empty icon="fa-ban" title={lang === 'ht' ? 'Ou pa afilye' : 'You are not an affiliate'} />;

  const stats = [
    { label: lang === 'ht' ? 'Klik' : 'Clicks',           value: fmtCount(dashboard.total_clicks),        icon: 'fa-mouse-pointer' },
    { label: lang === 'ht' ? 'Konvèsyon' : 'Conversions',   value: fmtCount(dashboard.total_conversions),  icon: 'fa-check-circle' },
    { label: lang === 'ht' ? 'To Konvèsyon' : 'Conversion Rate', value: `${dashboard.conversion_rate?.toFixed(1) || 0}%`, icon: 'fa-percentage' },
    { label: lang === 'ht' ? 'Total Touche' : 'Total Earned',       value: fmtCurrency(dashboard.total_earned), icon: 'fa-dollar-sign' },
    { label: lang === 'ht' ? 'Annatant' : 'Pending',        value: fmtCurrency(dashboard.pending_earnings), icon: 'fa-clock' },
    { label: lang === 'ht' ? 'Peye' : 'Paid Out',          value: fmtCurrency(dashboard.paid_out),       icon: 'fa-hand-holding-usd' },
  ];

  return (
    <div className="aff-overview">
      <div className="aff-stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="aff-stat-card">
            <div className="aff-stat-icon"><i className={`fas ${s.icon}`} aria-hidden="true" /></div>
            <div className="aff-stat-value">{s.value}</div>
            <div className="aff-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="aff-badges">
        <span className={`aff-badge aff-badge-${dashboard.level}`}>
          <i className="fas fa-crown" aria-hidden="true" />
          {dashboard.level}
        </span>
        <span className="aff-badge aff-badge-trust">
          <i className="fas fa-shield-alt" aria-hidden="true" />
          {lang === 'ht' ? 'Konfyans' : 'Trust'}: {dashboard.trust_score}/100
        </span>
        <span className="aff-badge aff-badge-links">
          <i className="fas fa-link" aria-hidden="true" />
          {dashboard.active_links} {lang === 'ht' ? 'lyen aktif' : 'active links'}
        </span>
      </div>
    </div>
  );
}

// ─── Links Tab ───────────────────────────────────────────────────────
function LinksTab({ lang, showToast }) {
  const { data: links, loading, refetch } = useFetch(
    () => affiliateApi.getLinks(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ content_type: 'general', content_id: '', label: '' });
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const payload = { content_type: form.content_type };
      if (form.content_id) payload.content_id = parseInt(form.content_id, 10);
      if (form.label) payload.label = form.label;
      await affiliateApi.createLink(payload);
      showToast?.(lang === 'ht' ? 'Lyen kreye' : 'Link created', 'check');
      setShowForm(false);
      setForm({ content_type: 'general', content_id: '', label: '' });
      refetch();
    } catch {
      showToast?.(lang === 'ht' ? 'Echèk kreye lyen' : 'Failed to create link', 'error');
    } finally {
      setCreating(false);
    }
  }, [form, showToast, refetch, lang]);

  const handleCopy = useCallback((code) => {
    // API_URL (VITE_API_BASE_URL or '/api/') so the share link works for
    // BOTH same-origin and cross-origin backends — window.location.origin
    // would hit the FE origin, where Netlify's SPA rewrite 404s /api/go/*.
    const fullUrl = `${API_URL}go/${code}/`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      // Fallback for HTTP/dev environments where clipboard API is unavailable
      try {
        const input = document.createElement('input');
        input.value = fullUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopiedId(code);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (_) { /* clipboard not available */ }
    });
  }, []);

  if (loading) return <Skeleton rows={3} />;

  return (
    <div className="aff-links">
      <div className="aff-section-header">
        <h3>
          <i className="fas fa-link" aria-hidden="true" />
          {lang === 'ht' ? 'Lyen Afilyasyon' : 'Affiliate Links'}
        </h3>
        <button
          type="button"
          className="aff-btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <i className="fas fa-plus" aria-hidden="true" />
          {lang === 'ht' ? 'Nouvo Lyen' : 'New Link'}
        </button>
      </div>

      {showForm && (
        <div className="aff-form-card">
          <div className="aff-form-group">
            <label>{lang === 'ht' ? 'Kalite Kontni' : 'Content Type'}</label>
            <select
              value={form.content_type}
              onChange={(e) => setForm({ ...form, content_type: e.target.value })}
              className="aff-input"
            >
              <option value="general">{lang === 'ht' ? 'Jeneral' : 'General'}</option>
              <option value="product">{lang === 'ht' ? 'Pwodwi' : 'Product'}</option>
              <option value="course">{lang === 'ht' ? 'Kou' : 'Course'}</option>
            </select>
          </div>
          <div className="aff-form-group">
            <label>{lang === 'ht' ? 'ID Kontni (si genyen)' : 'Content ID (optional)'}</label>
            <input
              type="number"
              value={form.content_id}
              onChange={(e) => setForm({ ...form, content_id: e.target.value })}
              className="aff-input"
              placeholder="e.g. 123"
            />
          </div>
          <div className="aff-form-group">
            <label>{lang === 'ht' ? ' Etikèt' : 'Label (optional)'}</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="aff-input"
              placeholder={lang === 'ht' ? 'Eg: Promosyon mwa sa' : 'e.g. Summer promo'}
            />
          </div>
          <button
            type="button"
            className="aff-btn-primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Kreyasyon...' : 'Creating...'}</>
            ) : (
              <><i className="fas fa-save" aria-hidden="true" /> {lang === 'ht' ? 'Kreye Lyen' : 'Create Link'}</>
            )}
          </button>
        </div>
      )}

      {links.length === 0 ? (
        <div className="aff-empty">
          <i className="fas fa-link" aria-hidden="true" />
          <h3>{lang === 'ht' ? 'Pokò gen lyen' : 'No links yet'}</h3>
          <p>{lang === 'ht' ? 'Klike "Nouvo Lyen" pou kòmanse' : 'Click "New Link" to get started'}</p>
        </div>
      ) : (
        <div className="aff-links-list">
          {links.map((link) => (
            <div key={link.id} className="aff-link-card">
              <div className="aff-link-info">
                <div className="aff-link-type">
                  <span className={`aff-link-badge aff-link-badge-${link.content_type}`}>
                    {link.content_type}
                  </span>
                  {link.label && <span className="aff-link-label">{link.label}</span>}
                </div>
                <div className="aff-link-code">
                  <code>{link.code}</code>
                </div>
                <div className="aff-link-stats">
                  <span>{fmtCount(link.total_clicks)} {lang === 'ht' ? 'klik' : 'clicks'}</span>
                  <span>· {fmtCount(link.total_conversions)} {lang === 'ht' ? 'konvèsyon' : 'conversions'}</span>
                  <span>· {fmtDate(link.created_at)}</span>
                </div>
              </div>
              <button
                type="button"
                className={`aff-btn-copy ${copiedId === link.code ? 'aff-btn-copied' : ''}`}
                onClick={() => handleCopy(link.code)}
              >
                {copiedId === link.code ? (
                  <><i className="fas fa-check" aria-hidden="true" /> {lang === 'ht' ? 'Kopiye' : 'Copied'}</>
                ) : (
                  <><i className="fas fa-copy" aria-hidden="true" /> {lang === 'ht' ? 'Kopye' : 'Copy'}</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Applications Tab ───────────────────────────────────────────────────
function ApplicationsTab({ lang, showToast }) {
  const { data: applications, loading, refetch } = useFetch(
    () => affiliateApi.getMyApplications(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  if (loading) return <Skeleton rows={3} />;

  const statusBadge = (status) => {
    const map = {
      pending: { bg: '#f59e0b', label: lang === 'ht' ? 'Annatant' : 'Pending' },
      approved: { bg: '#10b981', label: lang === 'ht' ? 'Apwouve' : 'Approved' },
      rejected: { bg: '#ef4444', label: lang === 'ht' ? 'Refize' : 'Rejected' },
      suspended: { bg: '#6b7280', label: lang === 'ht' ? 'Sispann' : 'Suspended' },
    };
    const s = map[status] || map.pending;
    return <span className="aff-badge" style={{ background: s.bg }}>{s.label}</span>;
  };

  return (
    <div className="aff-applications">
      <h3>
        <i className="fas fa-file-alt" aria-hidden="true" />
        {lang === 'ht' ? 'Aplikasyon Mwen' : 'My Applications'}
      </h3>

      {applications.length === 0 ? (
        <Empty
          icon="fa-file-alt"
          title={lang === 'ht' ? 'Pokò gen aplikasyon' : 'No applications yet'}
          hint={lang === 'ht' ? 'Aplike nan yon pwogram afilyasyon pou w kòmanse' : 'Apply to an affiliate program to get started'}
        />
      ) : (
        <div className="aff-list">
          {applications.map((app) => (
            <div key={app.id} className="aff-list-item">
              <div className="aff-list-body">
                <div className="aff-list-title">
                  {app.creator_username || 'Unknown Creator'}
                </div>
                <div className="aff-list-meta">
                  {fmtDate(app.created_at)}
                  {app.motivation && <> · <em>"{app.motivation}"</em></>}
                </div>
              </div>
              {statusBadge(app.status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Earnings Tab ─────────────────────────────────────────────────────
function EarningsTab({ lang, showToast }) {
  const { data: conversions, loading } = useFetch(
    () => affiliateApi.getEarnings(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  if (loading) return <Skeleton rows={3} />;

  return (
    <div className="aff-earnings">
      <h3>
        <i className="fas fa-coins" aria-hidden="true" />
        {lang === 'ht' ? 'Istorik Salè' : 'Earnings History'}
      </h3>

      {conversions.length === 0 ? (
        <div className="aff-empty">
          <i className="fas fa-receipt" aria-hidden="true" />
          <h3>{lang === 'ht' ? 'Pokò gen salè' : 'No earnings yet'}</h3>
          <p>{lang === 'ht' ? 'Lè yon moun achte atravè lyen ou, salè ou parèt isit' : 'When someone purchases through your link, earnings appear here'}</p>
        </div>
      ) : (
        <div className="aff-conversions-list">
          {conversions.map((c) => {
            const statusClass = `aff-status-${c.status}`;
            const isApproved = c.status === 'approved';
            const isPending = c.status === 'pending';
            return (
              <div key={c.id} className="aff-conversion-item">
                <div className="aff-conv-info">
                  <div className={`aff-conv-status-dot ${statusClass}`} />
                  <div>
                    <div className="aff-conv-meta">
                      {c.link_code && <code>{c.link_code}</code>}
                      {c.affiliate_username && <span> · {c.affiliate_username}</span>}
                    </div>
                    <div className="aff-conv-date">{fmtDate(c.created_at)}</div>
                  </div>
                </div>
                <div className="aff-conv-amounts">
                  <div className="aff-conv-sale">{fmtCurrency(c.sale_amount)}</div>
                  <div className={`aff-conv-commission ${isApproved ? 'aff-conv-approved' : ''}`}>
                    {isPending && <i className="fas fa-clock" aria-hidden="true" />}
                    {fmtCurrency(c.commission_amount)}
                  </div>
                  <span className={`aff-status-badge ${statusClass}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────
function ProfileTab({ lang, showToast }) {
  const { data: profile, loading } = useFetch(
    () => affiliateApi.getAffiliateProfile(),
    { defaultValue: null, deps: [] },
  );

  if (loading) return <Skeleton rows={3} />;
  if (!profile) return <Empty icon="fa-user-circle" title={lang === 'ht' ? 'Pa gen pwofil afilye' : 'No affiliate profile'} />;

  return (
    <div className="aff-profile">
      <div className="aff-profile-header">
        <div className="aff-profile-avatar">
          {profile.username?.charAt(0)?.toUpperCase() || 'A'}
        </div>
        <div>
          <h3>{profile.username}</h3>
          <span className={`aff-badge aff-badge-${profile.level}`}>
            <i className="fas fa-crown" aria-hidden="true" />
            {profile.level}
          </span>
        </div>
      </div>

      <div className="aff-profile-details">
        <div className="aff-profile-row">
          <span className="aff-profile-label">{lang === 'ht' ? 'Nivo' : 'Level'}</span>
          <span className="aff-profile-value">{profile.level}</span>
        </div>
        <div className="aff-profile-row">
          <span className="aff-profile-label">{lang === 'ht' ? 'Skò Konfyans' : 'Trust Score'}</span>
          <span className="aff-profile-value">{profile.trust_score}/100</span>
        </div>
        <div className="aff-profile-row">
          <span className="aff-profile-label">{lang === 'ht' ? 'Komisyon Pèsonalize' : 'Custom Commission'}</span>
          <span className="aff-profile-value">
            {profile.custom_commission_pct != null ? `${profile.custom_commission_pct}%` : (lang === 'ht' ? 'Pa defini' : 'Not set')}
          </span>
        </div>
        {profile.group_names?.length > 0 && (
          <div className="aff-profile-row">
            <span className="aff-profile-label">{lang === 'ht' ? 'Gwoup' : 'Groups'}</span>
            <span className="aff-profile-value">
              {profile.group_names.map((g) => (
                <span key={g} className="aff-badge aff-badge-group">{g}</span>
              ))}
            </span>
          </div>
        )}
        <div className="aff-profile-row">
          <span className="aff-profile-label">{lang === 'ht' ? 'Aktif' : 'Active'}</span>
          <span className={`aff-profile-value ${profile.is_active ? 'aff-text-success' : 'aff-text-muted'}`}>
            {profile.is_active ? (lang === 'ht' ? 'Wi' : 'Yes') : (lang === 'ht' ? 'Non' : 'No')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Dashboard Component
// ═══════════════════════════════════════════════════════════════════════

export default function AffiliateDashboard({ lang = 'ht', showToast }) {
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="aff-dashboard">
      {/* Header */}
      <div className="aff-dashboard-header">
        <button
          type="button"
          className="aff-back-btn"
          onClick={() => navigate(-1)}
          aria-label={t.common_back || 'Back'}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <div>
          <h1><i className="fas fa-handshake" aria-hidden="true" /> {lang === 'ht' ? 'Afilyasyon' : 'Affiliate'}</h1>
          <p className="aff-subtitle">{lang === 'ht' ? 'Jere lyen afilyasyon ou ak salè ou' : 'Manage your affiliate links and earnings'}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="aff-tabs">
        {DASHBOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`aff-tab ${activeTab === tab.id ? 'aff-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true" />
            {lang === 'ht' ? tab.labelHt : tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="aff-content">
        {activeTab === 'overview' && <OverviewTab lang={lang} />}
        {activeTab === 'applications' && <ApplicationsTab lang={lang} showToast={showToast} />}
        {activeTab === 'links' && <LinksTab lang={lang} showToast={showToast} />}
        {activeTab === 'earnings' && <EarningsTab lang={lang} showToast={showToast} />}
        {activeTab === 'profile' && <ProfileTab lang={lang} showToast={showToast} />}
      </div>
    </div>
  );
}
