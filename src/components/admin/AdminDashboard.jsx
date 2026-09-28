/**
 * src/components/admin/AdminDashboard.jsx
 *
 * Comprehensive Admin Dashboard.
 * ==============================
 *
 * Statistics cards + Creator queue + system health + quick links.
 * Accessible only to staff/superusers.
 *
 * API:
 *   GET  /api/admin/dashboard/                     — 12 stat cards
 *   GET  /api/identity/creator-apply/admin_all/    — Creator queue
 *   GET  /api/admin/security/                      — Security stats
 *
 * Route: /sheet/admin/dashboard
 */

// React itself is unused here — the new JSX runtime
// (configured by @vitejs/plugin-react) auto-injects the
// jsx-runtime import, so a default React import isn't
// needed. Dropping it keeps the dep graph clean and
// silences future "unused React" warnings.
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import api, { mediaProviderService, spotlightService } from '../../services/api';
import { SHEETS } from '../../routes/sheets';
import { CREATOR_APP_STATUS, SPOTLIGHT_STATUS } from '../../constants/statusConfig';
import AdminPlatformConfig from './AdminPlatformConfig';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  const v = Number(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ─── Certificate Preview Panel ──────────────────────────────────────

function CertificatePreviewPanel({ lang: _lang, onNavigate }) {
  const [certs, setCerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/certificates/admin/list/');
        if (!cancelled) {
          setCerts(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const status = err?.response?.status;
          const detail = err?.response?.data?.detail;
          if (status === 403) {
            setError('Staff access required.');
          } else if (status === 404) {
            setError('Endpoint not found — backend may need redeploy.');
          } else {
            setError(detail || 'Could not load certificates.');
          }
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function openPreview(cert) {
    const w = window.open('', '_blank');
    if (!w) return;
    import('../learning/CertificateTemplate.js').then(({ openCertificateWindow }) => {
      if (cert) {
        // Real certificate from database
        // Fallback: regenerate deterministic number if DB value is empty
        const certNum = cert.certificate_number || `ATY-${String(cert.user__id || 0).padStart(8, '0')}-${String(cert.course__id || 0).padStart(8, '0')}`;
        openCertificateWindow({
          certNumber: certNum,
          learnerName: (cert.user__first_name || cert.user__last_name)
            ? `${cert.user__first_name || ''} ${cert.user__last_name || ''}`.trim()
            : cert.user__username,
          courseTitle: cert.course__title || '',
          issuedDate: new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          verifyUrl: `https://atelnyo.site/verify?cert=${certNum}`,
          isHt: false,
        });
      } else {
        // Sample preview (no real certificates yet)
        openCertificateWindow({
          certNumber: 'ATY-00000000-00000000',
          learnerName: 'Sample Learner',
          courseTitle: 'Course Title Preview',
          issuedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          verifyUrl: 'https://atelnyo.site/verify?cert=ATY-00000000-00000000',
          isHt: false,
        });
      }
    });
  }

  return (
    <div className="ad-dash-panel">
      <div className="ad-dash-panel-header">
        <h2 className="ad-dash-panel-title">
          <i className="fas fa-certificate" aria-hidden="true" />
          {' '}Certificates
        </h2>
        {certs && (
          <span className="ad-dash-panel-badge">{certs.total} total</span>
        )}
        <button
          type="button"
          className="ad-dash-panel-action-btn"
          onClick={() => openPreview(certs?.recent?.[0] || null)}
          title="Preview most recent certificate"
        >
          <i className="fas fa-eye" /> Preview
        </button>
      </div>
      <div className="ad-dash-panel-body">
        {loading ? (
          <div className="ad-dash-panel-loading">
            <i className="fas fa-spinner fa-spin" />
          </div>
        ) : error ? (
          <div className="ad-dash-panel-empty">
            <i className="fas fa-exclamation-triangle" style={{ color: '#f59e0b' }} />
            <p>{error}</p>
          </div>
        ) : !certs ? (
          <div className="ad-dash-panel-empty">
            <i className="fas fa-certificate" />
            <p>Could not load certificates</p>
          </div>
        ) : certs.total === 0 ? (
          <div className="ad-dash-panel-empty">
            <i className="fas fa-certificate" />
            <p>No certificates issued yet</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
              Certificates are issued automatically when learners complete 100% of a course
            </p>
          </div>
        ) : (
          <>
            {/* Per-course breakdown */}
            {certs.per_course?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>
                  By Course
                </div>
                {certs.per_course.slice(0, 5).map((c) => (
                  <div key={c.course__id} className="ad-dash-queue-item" style={{ padding: '6px 0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{c.course__title}</div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8,
                      background: '#dbeafe', color: '#1d4ed8',
                      fontSize: '0.75rem', fontWeight: 600,
                    }}>
                      {c.cert_count} cert{c.cert_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Recent certificates */}
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>
                Recent Certificates
              </div>
              {certs.recent.slice(0, 8).map((c) => (
                <div key={c.id} className="ad-dash-queue-item" style={{ padding: '6px 0' }}>
                  <div className="ad-dash-queue-avatar" style={{ background: '#059669' }}>
                    <i className="fas fa-certificate" style={{ fontSize: '0.7rem', color: '#fff' }} />
                  </div>
                  <div className="ad-dash-queue-info">
                    <div className="ad-dash-queue-name">
                      {c.user__first_name || c.user__last_name
                        ? `${c.user__first_name || ''} ${c.user__last_name || ''}`.trim()
                        : c.user__username}
                    </div>
                    <div className="ad-dash-queue-meta">
                      <span><i className="fas fa-graduation-cap" /> {c.course__title}</span>
                      <span style={{ marginLeft: 8 }}>
                        {new Date(c.issued_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8,
                    background: '#d1fae5', color: '#059669',
                    fontSize: '0.7rem', fontWeight: 600,
                    fontFamily: 'monospace',
                  }}>
                    {c.certificate_number || `ATY-${String(c.user__id || 0).padStart(8, '0')}-${String(c.course__id || 0).padStart(8, '0')}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPreview(c)}
                    style={{
                      background: '#0A2540', color: '#fff', border: 'none',
                      borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                      fontSize: '0.7rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    title="View this certificate"
                  >
                    <i className="fas fa-eye" /> View
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}



// ─── Quick Links ──────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: SHEETS.ADMIN_CREATORS, icon: 'fa-users-gear', label: 'Creator Review', desc: 'Approve/reject creator applications' },
  { href: SHEETS.ADMIN_USERS,    icon: 'fa-crown',       label: 'Premium Users',  desc: 'Grant & manage premium access' },
  { href: SHEETS.ADMIN_MEDIA,    icon: 'fa-cloud-upload-alt', label: 'Media Providers', desc: 'Manage media storage providers' },
  { href: SHEETS.ADMIN_PROVIDER_HEALTH, icon: 'fa-heart-pulse', label: 'Provider Health', desc: 'Monitor provider uptime & metrics' },
  { href: SHEETS.ADMIN_MEDIA_MONITOR, icon: 'fa-tv', label: 'Media Monitor', desc: 'Real-time media system monitoring' },
  { href: SHEETS.ADMIN_SECURITY_MONITOR, icon: 'fa-shield-halved', label: 'Security Monitor', desc: 'Security alerts, logins, rate limits' },
  { href: SHEETS.ADMIN_BROKEN_MEDIA, icon: 'fa-link-slash', label: 'Broken Media Center', desc: 'Monitor broken URLs across the platform' },
  { href: SHEETS.ADMIN_VALIDATION_QUEUE, icon: 'fa-spinner', label: 'Validation Queue', desc: 'Pending URL validations needing attention' },
  { href: SHEETS.ADMIN_MODERATION, icon: 'fa-shield-halved', label: 'Content Moderation', desc: 'Flag & moderate media content' },
  { href: SHEETS.ADMIN_REPORTS, icon: 'fa-flag', label: 'Media Reports', desc: 'Review user-submitted media reports' },
  { href: SHEETS.ADMIN_INCIDENTS, icon: 'fa-triangle-exclamation', label: 'Incident Center', desc: 'Track mass broken-link incidents' },
  { href: SHEETS.ADMIN_SPOTLIGHT, icon: 'fa-lightbulb',       label: 'Spotlight',        desc: 'Review & manage spotlight applications' },
  { href: SHEETS.ADMIN_COMPANIES, icon: 'fa-building',        label: 'Companies',        desc: 'Review & manage in-app company profiles' },
  // Phase Language — Language Academy management (staff).
  { href: SHEETS.ADMIN_ACADEMY, icon: 'fa-graduation-cap', label: 'Language Academy', desc: 'Generate & publish official language programs' },
  { href: SHEETS.ADMIN_FAQ,      icon: 'fa-question-circle', label: 'Admin FAQ',     desc: 'Help center for admin tools' },
  { href: '/sheet/admin/platform-faq', icon: 'fa-circle-question', label: 'Platform FAQ', desc: 'Manage the public FAQ page (/faq)' },
  { href: '/api/admin/',         icon: 'fa-database',    label: 'Django Admin',  desc: 'Full Django admin panel' },
  { href: SHEETS.ADMIN_RULE_ENGINE, icon: 'fa-gears', label: 'Rule Engine', desc: 'Manage business rules & automation' },
  { href: '/api/docs/',          icon: 'fa-book',        label: 'API Docs',      desc: 'Interactive Swagger documentation' },
  { href: '/api/healthz/',       icon: 'fa-heart-pulse', label: 'API Health',    desc: 'Backend health check endpoint' },
  { href: null,                  icon: 'fa-wand-magic-sparkles', label: 'Content Intelligence', desc: 'AI-powered course intelligence & search', id: 'ci' },
];

// ─── StatCard ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, formatter, accent, subtitle, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={classNames('ad-dash-card', onClick && 'ad-dash-card-clickable')}
      data-accent={accent || 'default'}
    >
      <div className="ad-dash-card-icon" aria-hidden="true">
        <i className={`fas ${icon}`} />
      </div>
      <div className="ad-dash-card-body">
        <div className="ad-dash-card-label">{label}</div>
        <div className="ad-dash-card-value">
          {formatter ? formatter(value) : fmtNumber(value)}
        </div>
        {subtitle && <div className="ad-dash-card-subtitle">{subtitle}</div>}
      </div>
    </Tag>
  );
}

// ─── QueueItem ────────────────────────────────────────────────────────

function QueueItem({ app, onReview }) {
  const cfg = CREATOR_APP_STATUS[app.status] || CREATOR_APP_STATUS.pending;
  // The backend sends ``user`` as a plain integer FK id (never a nested
  // object), so the display name must come from ``applicant_username`` —
  // same contract AdminCreatorReview uses. Reading ``app.user?.username``
  // here is what rendered "Unknown" for every creator application.
  const applicantName = app.applicant_username || app.user?.username || 'Unknown';

  return (
    <div className="ad-dash-queue-item" onClick={() => onReview?.(app)}>
      <div className="ad-dash-queue-avatar">
        {(applicantName.charAt(0) || '?').toUpperCase()}
      </div>
      <div className="ad-dash-queue-info">
        <div className="ad-dash-queue-name">{applicantName}</div>
        <div className="ad-dash-queue-meta">
          {app.country && <span><i className="fas fa-map-marker-alt" /> {app.country}</span>}
          {app.created_at && <span><i className="fas fa-calendar" /> {new Date(app.created_at).toLocaleDateString()}</span>}
        </div>
      </div>
      <span className="ad-dash-queue-status" style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
        {cfg.labelEn}
      </span>
    </div>
  );
}

// ─── Spotlight Queue Item ────────────────────────────────────────────

function SpotlightQueueItem({ app, onReview }) {
  const cfg = SPOTLIGHT_STATUS[app.status] || SPOTLIGHT_STATUS.pending;
  return (
    <div className="ad-dash-queue-item" onClick={() => onReview?.(app)}>
      <div className="ad-dash-queue-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #f59e0b)' }}>
        <i className="fas fa-lightbulb" style={{ fontSize: '0.7rem' }} />
      </div>
      <div className="ad-dash-queue-info">
        <div className="ad-dash-queue-name">{app.invention_title || 'Untitled'}</div>
        <div className="ad-dash-queue-meta">
          {app.user?.username && <span><i className="fas fa-user" /> {app.user.username}</span>}
          {app.created_at && <span><i className="fas fa-calendar" /> {new Date(app.created_at).toLocaleDateString()}</span>}
        </div>
      </div>
      <span className="ad-dash-queue-status" style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
        <i className={`fas ${cfg.icon}`} style={{ marginRight: 3 }} /> {cfg.labelEn}
      </span>
    </div>
  );
}

// ─── Loading / Empty Skeleton ─────────────────────────────────────────

function DashSkeleton() {
  return (
    <div className="ad-dash-skel-grid" role="status" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="ad-dash-skel-card" aria-hidden="true" />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export default function AdminDashboard({ lang = 'ht', showToast, user, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [queue, setQueue] = useState(null);
  const [mediaProviders, setMediaProviders] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [spotlightApps, setSpotlightApps] = useState(null);
  const [loadingSpotlight, setLoadingSpotlight] = useState(true);
  const [creatorProfiles, setCreatorProfiles] = useState([]);
  const [loadingCreatorProfiles, setLoadingCreatorProfiles] = useState(true);
  const [ciStats, setCiStats] = useState(null);
  const [loadingCI, setLoadingCI] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const { isAdmin, loading: permsLoading } = useHasAdminAccess();

  // ─── Admin gate (defense-in-depth + race-safe) ──────────────────
  // RequireRole in App.jsx already gates at route level. This is a
  // second layer for non-route entry points. We merge two signals:
  //   1. useHasAdminAccess() → server-computed permissions matrix
  //   2. user object → client-side is_staff / is_superuser flags
  // If the matrix is still loading (isAdmin===null), we fall back to
  // the user object so staff users aren't wrongly blocked during the
  // permissions refresh window after login.
  const hasStaffAccess =
    (user?.is_staff === true || user?.is_superuser === true) ||
    isAdmin === true;

  // ─── Fetch all data ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, healthRes, queueRes] = await Promise.allSettled([
        api.get('admin/dashboard/'),
        api.get('admin/health/').catch(() => null),
        api.get('identity/creator-apply/admin_all/', { params: { status: 'pending' } }),
      ]);

      if (dashRes.status === 'fulfilled') {
        setStats(dashRes.value.data);
      } else {
        const reason = dashRes.reason;
        const status = reason?.response?.status;
        const detail = reason?.response?.data?.detail || reason?.response?.data?.error || reason?.message;
        if (status === 403) {
          setError('Admin access required. You don\'t have permission to view dashboard stats.');
        } else if (status === 429) {
          setError('Too many requests. Please wait a moment and try again.');
        } else if (status) {
          setError(`Failed to load dashboard stats (HTTP ${status}${detail ? ': ' + detail : ''})`);
        } else {
          setError(`Failed to load dashboard stats: ${detail || reason?.message || 'Cannot reach server'}.`);
        }
      }

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        const data = healthRes.value.data || healthRes.value;
        // Transform healthz response shape ({status, components: {db, redis, ...}})
        // into the dashboard-expected shape ({db, cache_layer}).
        const components = data?.components || data || {};
        setHealth({
          db: components?.db === 'ok' || components?.db === true || false,
          cache_layer: components?.redis === 'ok' || components?.cache_layer === 'ok' || components?.db === 'ok' || false,
        });
      }

      if (queueRes.status === 'fulfilled') {
        const data = Array.isArray(queueRes.value.data)
          ? queueRes.value.data
          : (queueRes.value.data?.results || []);
        setQueue(data);
      }

      // Fetch media providers
      try {
        const mediaRes = await mediaProviderService.list();
        const mediaData = mediaRes.data?.results || mediaRes.data || [];
        setMediaProviders(Array.isArray(mediaData) ? mediaData : []);
      } catch { /* non-critical */ }
      setLoadingMedia(false);

      // Fetch spotlight applications (pending for the queue)
      try {
        const spotRes = await spotlightService.adminAll({ status: 'pending' });
        const spotData = spotRes.data?.results || spotRes.data || [];
        setSpotlightApps(Array.isArray(spotData) ? spotData : []);
      } catch { /* non-critical */ }
      setLoadingSpotlight(false);

      // Fetch creator public profiles for admin management
      try {
        const profRes = await api.get('creator-profiles/', { params: { page_size: 50 } });
        const profData = profRes.data?.results || profRes.data || [];
        setCreatorProfiles(Array.isArray(profData) ? profData : []);
      } catch { /* non-critical */ }
      setLoadingCreatorProfiles(false);

      // Fetch Content Intelligence stats
      try {
        const ciRes = await api.get('intelligence/stats/');
        setCiStats(ciRes.data);
      } catch { /* non-critical */ }
      setLoadingCI(false);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.error;
      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (status === 403) {
        setError('Admin access required. You don\'t have permission to view this page.');
      } else {
        setError(err?.message || `Failed to load dashboard (HTTP ${status || 'network error'}).`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll, lastRefresh]);

  // ─── Admin actions for creator public profiles ───────────────────
  // The backend action is PATCH /api/creator-profiles/<slug>/admin/
  // (url_path='admin' on the router — slug comes FIRST). The legacy
  // ``creator-profiles/admin/<id>/`` shape 404s; profiles carry the
  // slug on the list payload.
  const handleAdminProfileUpdate = useCallback(async (profile, updates) => {
    const slug = profile?.slug;
    if (!slug) {
      showToast?.(
        lang === 'ht' ? 'Pwofil la pa gen slug.' : 'Profile has no slug.',
        'exclamation-triangle',
      );
      return;
    }
    try {
      await api.patch(`creator-profiles/${encodeURIComponent(slug)}/admin/`, updates);
      setCreatorProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, ...updates } : p)),
      );
      showToast?.(
        lang === 'ht' ? 'Pwofil mete ajou!' : 'Profile updated!',
        'check-circle',
      );
    } catch {
      showToast?.(
        lang === 'ht' ? 'Erè nan mete ajou pwofil.' : 'Error updating profile.',
        'exclamation-triangle',
      );
    }
  }, [lang, showToast]);

  // ─── Early non-staff return (only when matrix is resolved AND user object confirms) ──
  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="ad-dash-shell">
        <div className="ad-dash-empty">
          <i className="fas fa-user-lock" />
          <h3>Staff Access Required</h3>
          <p>You need staff permissions to view this page.</p>
        </div>
      </div>
    );
  }

  // ─── Build stat cards ────────────────────────────────────────────
  const statCards = stats ? [
    { key: 'users',       icon: 'fa-users',         label: 'Total Users',        value: stats.total_users,              accent: 'violet', subtitle: stats.online_users > 0 ? `${fmtNumber(stats.online_users)} online` : undefined },
    { key: 'reports',     icon: 'fa-flag',          label: 'Pending Reports',    value: stats.reports_pending,          accent: 'amber' },
    { key: 'bans',        icon: 'fa-ban',           label: 'Banned Users',       value: stats.banned_users,             accent: 'red' },
    { key: 'calls',       icon: 'fa-phone',         label: 'Calls Today',        value: (stats.voice_calls_today || 0) + (stats.video_calls_today || 0), accent: 'sky', subtitle: `🎤 ${fmtNumber(stats.voice_calls_today)} · 📹 ${fmtNumber(stats.video_calls_today)}` },
    { key: 'messages',    icon: 'fa-comment',       label: 'Messages Today',     value: stats.messages_today,           accent: 'pink' },
    { key: 'conversations', icon: 'fa-comments',    label: 'Active Conversations', value: stats.active_conversations,   accent: 'teal' },
    { key: 'groups',      icon: 'fa-layer-group',   label: 'Groups',             value: stats.groups_created,           accent: 'indigo' },
    { key: 'storage',     icon: 'fa-database',      label: 'Storage Used',       value: stats.storage_bytes,            accent: 'emerald', formatter: fmtBytes },
  ] : [];

  const pendingCount = queue?.length || 0;

  const serverHealth = health || stats?.server_health;
  const dbOk    = serverHealth?.db === true || serverHealth?.db === 'ok';
  const cacheOk = serverHealth?.cache_layer === true || serverHealth?.cache_layer === 'ok';

  return (
    <div className="ad-dash-shell">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="ad-dash-header">
        <div className="ad-dash-header-left">
          <button type="button" className="ad-dash-back" onClick={() => onNavigate?.(-1)} aria-label="Back">
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="ad-dash-title">
              <i className="fas fa-gauge-high" aria-hidden="true" />
              {' '}Admin Dashboard
            </h1>
            <p className="ad-dash-subtitle">
              System overview &amp; moderation
            </p>
          </div>
        </div>
        <div className="ad-dash-header-right">
          {/* Health indicators */}
          <div className="ad-dash-health-badges">
            <span className={`ad-dash-health-badge ${dbOk ? 'ad-dash-health-ok' : 'ad-dash-health-fail'}`} title="Database">
              <i className="fas fa-database" /> DB
            </span>
            <span className={`ad-dash-health-badge ${cacheOk ? 'ad-dash-health-ok' : 'ad-dash-health-fail'}`} title="Cache">
              <i className="fas fa-bolt" /> Cache
            </span>
          </div>
          <button type="button" className="ad-dash-refresh" onClick={() => setLastRefresh(Date.now())} title="Refresh">
            <i className="fas fa-rotate" />
          </button>
        </div>
      </div>

      <div className="ad-dash-body">
        {/* ── Stats Grid ─────────────────────────────────────────── */}
        {loading && !stats ? (
          <DashSkeleton />
        ) : error ? (
          <div className="ad-dash-error-banner">
            <i className="fas fa-circle-exclamation" />
            <span>{error}</span>
            <button type="button" onClick={fetchAll}>Retry</button>
          </div>
        ) : (
          <>
            <div className="ad-dash-stats-grid">
              {statCards.map((s) => <StatCard key={s.key} {...s} />)}
            </div>

            {/* ── Three rows: Creator Queue + Media Providers + Quick Links ── */}
            <div className="ad-dash-panels">
              {/* Spotlight Queue */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-lightbulb" aria-hidden="true" />
                    {' '}Spotlight Queue
                  </h2>
                  {spotlightApps && spotlightApps.length > 0 && (
                    <span className="ad-dash-panel-badge">{spotlightApps.length} pending</span>
                  )}
                  <button
                    type="button"
                    className="ad-dash-panel-action-btn"
                    onClick={() => onNavigate?.(SHEETS.ADMIN_SPOTLIGHT)}
                    title="Manage spotlight"
                  >
                    <i className="fas fa-external-link-alt" /> Manage
                  </button>
                </div>
                <div className="ad-dash-panel-body">
                  {loadingSpotlight ? (
                    <div className="ad-dash-panel-loading">
                      <i className="fas fa-spinner fa-spin" />
                    </div>
                  ) : !spotlightApps || spotlightApps.length === 0 ? (
                    <div className="ad-dash-panel-empty">
                      <i className="fas fa-lightbulb" />
                      <p>No pending spotlight applications</p>
                    </div>
                  ) : (
                    <div className="ad-dash-queue-list">
                      {spotlightApps.slice(0, 6).map((app) => (
                        <SpotlightQueueItem
                          key={app.id}
                          app={app}
                          onReview={() => onNavigate?.(SHEETS.ADMIN_SPOTLIGHT)}
                        />
                      ))}
                      {spotlightApps.length > 6 && (
                        <button
                          type="button"
                          className="ad-dash-queue-more"
                          onClick={() => onNavigate?.(SHEETS.ADMIN_SPOTLIGHT)}
                        >
                          View all {spotlightApps.length} applications →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Creator Queue */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-users-gear" aria-hidden="true" />
                    {' '}Creator Queue
                  </h2>
                  {pendingCount > 0 && (
                    <span className="ad-dash-panel-badge">{pendingCount} pending</span>
                  )}
                </div>
                <div className="ad-dash-panel-body">
                  {queue === null ? (
                    <div className="ad-dash-panel-loading">
                      <i className="fas fa-spinner fa-spin" />
                    </div>
                  ) : queue.length === 0 ? (
                    <div className="ad-dash-panel-empty">
                      <i className="fas fa-inbox" />
                      <p>No pending applications</p>
                    </div>
                  ) : (
                    <div className="ad-dash-queue-list">
                      {queue.slice(0, 8).map((app) => (
                        <QueueItem
                          key={app.id}
                          app={app}
                          onReview={() => onNavigate?.(SHEETS.ADMIN_CREATORS)}
                        />
                      ))}
                      {queue.length > 8 && (
                        <button
                          type="button"
                          className="ad-dash-queue-more"
                          onClick={() => onNavigate?.(SHEETS.ADMIN_CREATORS)}
                        >
                          View all {queue.length} applications →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Media Providers Panel */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
                    {' '}Media Providers
                  </h2>
                  <button
                    type="button"
                    className="ad-dash-panel-action-btn"
                    onClick={() => onNavigate?.(SHEETS.ADMIN_MEDIA)}
                    title="Manage providers"
                  >
                    <i className="fas fa-external-link-alt" /> Manage
                  </button>
                </div>
                <div className="ad-dash-panel-body">
                  {loadingMedia ? (
                    <div className="ad-dash-panel-loading">
                      <i className="fas fa-spinner fa-spin" />
                    </div>
                  ) : mediaProviders.length === 0 ? (
                    <div className="ad-dash-panel-empty">
                      <i className="fas fa-cloud" />
                      <p>No providers configured</p>
                    </div>
                  ) : (
                    <div className="ad-dash-provider-mini-list">
                      {mediaProviders.slice(0, 6).map((p) => (
                        <div key={p.key} className="ad-dash-provider-mini-item">
                          <div className="ad-dash-provider-mini-info">
                            <div className="ad-dash-provider-mini-logo">
                              {p.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="ad-dash-provider-mini-name">{p.name}</div>
                              <div className="ad-dash-provider-mini-meta">
                                <span className="ad-dash-provider-mini-cat" style={{
                                  color: p.category === 'recommended' ? 'var(--state-warning, #f59e0b)' : 'var(--text-secondary, #64748b)'
                                }}>
                                  {p.category}
                                </span>
                                <span className={`ad-dash-status-indicator ${p.is_active ? 'status-active' : 'status-inactive'}`}>
                                  {p.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {mediaProviders.length > 6 && (
                        <button
                          type="button"
                          className="ad-dash-queue-more"
                          onClick={() => onNavigate?.(SHEETS.ADMIN_MEDIA)}
                        >
                          View all {mediaProviders.length} providers →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Media Operations Panel */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-shield-halved" aria-hidden="true" />
                    {' '}Media Operations
                  </h2>
                </div>
                <div className="ad-dash-panel-body">
                  <div className="ad-dash-links">
                    <button
                      type="button"
                      className="ad-dash-link-btn"
                      onClick={() => onNavigate?.(SHEETS.ADMIN_BROKEN_MEDIA)}
                    >
                      <div className="ad-dash-link-icon">
                        <i className="fas fa-link-slash" />
                      </div>
                      <div className="ad-dash-link-text">
                        <strong>Broken Media Center</strong>
                        <span>Track & monitor broken URLs</span>
                      </div>
                      <i className="fas fa-chevron-right ad-dash-link-arrow" />
                    </button>
                    <button
                      type="button"
                      className="ad-dash-link-btn"
                      onClick={() => onNavigate?.(SHEETS.ADMIN_VALIDATION_QUEUE)}
                    >
                      <div className="ad-dash-link-icon">
                        <i className="fas fa-spinner" />
                      </div>
                      <div className="ad-dash-link-text">
                        <strong>Validation Queue</strong>
                        <span>Pending validations needing attention</span>
                      </div>
                      <i className="fas fa-chevron-right ad-dash-link-arrow" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Creator Public Profiles */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-user-circle" aria-hidden="true" />
                    {' '}Creator Public Profiles
                  </h2>
                  {creatorProfiles.length > 0 && (
                    <span className="ad-dash-panel-badge">{creatorProfiles.length} total</span>
                  )}
                </div>
                <div className="ad-dash-panel-body">
                  {loadingCreatorProfiles ? (
                    <div className="ad-dash-panel-loading">
                      <i className="fas fa-spinner fa-spin" />
                    </div>
                  ) : creatorProfiles.length === 0 ? (
                    <div className="ad-dash-panel-empty">
                      <i className="fas fa-user-circle" />
                      <p>No creator profiles yet</p>
                    </div>
                  ) : (
                    <div className="ad-dash-queue-list">
                      {creatorProfiles.slice(0, 8).map((profile) => (
                        <div key={profile.id} className="ad-dash-queue-item">
                          <div className="ad-dash-queue-avatar">
                            {(profile.display_name || profile.artist_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="ad-dash-queue-info">
                            <div className="ad-dash-queue-name">
                              {profile.display_name || profile.artist_name || 'Unknown'}
                            </div>
                            <div className="ad-dash-queue-meta">
                              <span><i className="fas fa-users" /> {profile.followers_count || 0} followers</span>
                              <span><i className="fas fa-graduation-cap" /> {profile.students_count || 0} students</span>
                            </div>
                          </div>
                          <div className="ad-dash-profile-actions">
                            <button
                              type="button"
                              className={`ad-dash-action-btn ${profile.is_verified ? 'ad-dash-action-active' : ''}`}
                              onClick={() => handleAdminProfileUpdate(profile, { is_verified: !profile.is_verified })}
                              title={profile.is_verified ? 'Remove verification' : 'Verify'}
                            >
                              <i className="fas fa-check-circle" />
                            </button>
                            <button
                              type="button"
                              className={`ad-dash-action-btn ${profile.is_featured ? 'ad-dash-action-active' : ''}`}
                              onClick={() => handleAdminProfileUpdate(profile, { is_featured: !profile.is_featured })}
                              title={profile.is_featured ? 'Unfeature' : 'Feature'}
                            >
                              <i className="fas fa-star" />
                            </button>
                            <button
                              type="button"
                              className={`ad-dash-action-btn ${profile.is_suspended ? 'ad-dash-action-danger' : ''}`}
                              onClick={() => handleAdminProfileUpdate(profile, { is_suspended: !profile.is_suspended, is_visible: profile.is_suspended ? true : profile.is_visible })}
                              title={profile.is_suspended ? 'Unsuspend' : 'Suspend'}
                            >
                              <i className="fas fa-ban" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {creatorProfiles.length > 8 && (
                        <button
                          type="button"
                          className="ad-dash-queue-more"
                          onClick={() => window.open('/api/admin/', '_blank', 'noopener,noreferrer')}
                        >
                          View all {creatorProfiles.length} profiles in Django Admin →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet Top-up Limits (runtime config) */}
              <AdminPlatformConfig lang={lang} showToast={showToast} />

              {/* Content Intelligence Panel */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
                    {' '}Content Intelligence
                  </h2>
                  {ciStats && (
                    <span className="ad-dash-panel-badge">
                      {ciStats.by_status?.ready || 0} / {ciStats.total || 0} ready
                    </span>
                  )}
                </div>
                <div className="ad-dash-panel-body">
                  {loadingCI ? (
                    <div className="ad-dash-panel-loading">
                      <i className="fas fa-spinner fa-spin" />
                    </div>
                  ) : !ciStats ? (
                    <div className="ad-dash-panel-empty">
                      <i className="fas fa-wand-magic-sparkles" />
                      <p>No intelligence data</p>
                    </div>
                  ) : (
                    <>
                      <div className="ad-dash-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                        {Object.entries(ciStats.by_status || {}).map(([status, count]) => (
                          <div key={status} className="ad-dash-card" style={{ padding: '8px', textAlign: 'center' }}>
                            <div className="ad-dash-card-value" style={{ fontSize: '1.1rem' }}>{count}</div>
                            <div className="ad-dash-card-label" style={{ fontSize: '0.7rem' }}>{status}</div>
                          </div>
                        ))}
                      </div>
                      {ciStats.recent_jobs?.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>Recent Jobs</div>
                          {ciStats.recent_jobs.slice(0, 5).map((job) => (
                            <div key={job.id} className="ad-dash-queue-item" style={{ padding: '6px 0' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{job.job_type}</div>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                  Course #{job.course_id} · {job.duration_ms ? `${job.duration_ms}ms` : '—'}
                                  {job.tokens_used ? ` · ${job.tokens_used} tokens` : ''}
                                </div>
                              </div>
                              <span style={{
                                padding: '2px 6px', borderRadius: 8,
                                background: job.status === 'success' ? '#d1fae5' : job.status === 'failed' ? '#fee2e2' : '#fef3c7',
                                color: job.status === 'success' ? '#059669' : job.status === 'failed' ? '#dc2626' : '#d97706',
                                fontSize: '0.7rem', fontWeight: 500,
                              }}>
                                {job.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Certificate Preview Panel */}
              <CertificatePreviewPanel lang={lang} onNavigate={onNavigate} />

              {/* Quick Links */}
              <div className="ad-dash-panel">
                <div className="ad-dash-panel-header">
                  <h2 className="ad-dash-panel-title">
                    <i className="fas fa-bolt" aria-hidden="true" />
                    {' '}Quick Links
                  </h2>
                </div>
                <div className="ad-dash-panel-body">
                  <div className="ad-dash-links">
                    {QUICK_LINKS.map((link) => (
                      <button
                        key={link.href || link.id}
                        type="button"
                        className="ad-dash-link-btn"
                        onClick={() => {
                          if (!link.href) return; // null href = informational only
                          if (link.href.startsWith('/sheet/')) {
                            onNavigate?.(link.href);
                          } else {
                            window.open(link.href, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <div className="ad-dash-link-icon">
                          <i className={`fas ${link.icon}`} />
                        </div>
                        <div className="ad-dash-link-text">
                          <strong>{link.label}</strong>
                          <span>{link.desc}</span>
                        </div>
                        <i className="fas fa-chevron-right ad-dash-link-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="ad-dash-footer">
        <span className="ad-dash-footer-text">
          <i className="fas fa-shield-halved" /> Admin Panel
        </span>
        <span className="ad-dash-footer-text">
          <i className="fas fa-sync" /> Last refresh: {new Date(lastRefresh).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
