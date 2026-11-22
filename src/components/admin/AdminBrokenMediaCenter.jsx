/**
 * AdminBrokenMediaCenter — Broken Media Center for admin operations.
 *
 * Spec (Phase ADMIN MEDIA CENTER — Broken Media Center):
 *   "Yon Dashboard espesyal. Broken Today, Broken This Week,
 *    Broken This Month, Most Broken Providers, Most Broken Creators,
 *    Most Broken Modules, Recently Fixed, Waiting Replacement,
 *    Auto Retry Running."
 *
 * Route: /sheet/admin/broken-media
 * Access: Staff / superuser only
 */
import { useEffect, useState, useCallback } from 'react';
import { useHasAdminAccess } from '../../hooks/useHasAdminAccess';
import { adminMediaService } from '../../services/api';
import { inlineText } from '../../utils/inlineI18n';

function fmtNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="abmc-stat-card" style={{ '--accent': color || 'var(--pink-primary)' }}>
      <i className={`fas ${icon}`} />
      <div className="abmc-stat-body">
        <span className="abmc-stat-value">{value != null ? fmtNumber(value) : '—'}</span>
        <span className="abmc-stat-label">{label}</span>
      </div>
    </div>
  );
}

function TopList({ title, items, keyField, valueField, icon }) {
  return (
    <div className="abmc-top-section">
      <h3 className="abmc-top-title">
        <i className={`fas ${icon || 'fa-list'}`} /> {title}
      </h3>
      {!items || items.length === 0 ? (
        <div className="abmc-empty-mini">—</div>
      ) : (
        <ol className="abmc-top-list">
          {items.slice(0, 8).map((item, i) => (
            <li key={i} className="abmc-top-item">
              <span className="abmc-top-rank">{i + 1}</span>
              <span className="abmc-top-name">{item[keyField] || 'Unknown'}</span>
              <span className="abmc-top-count">{fmtNumber(item[valueField])}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function AdminBrokenMediaCenter({ lang = 'en', showToast, user, onNavigate }) {
  const isHt = lang === 'ht';
  const { isAdmin, loading: permsLoading } = useHasAdminAccess();
  const hasStaffAccess = (user?.is_staff === true || user?.is_superuser === true) || isAdmin === true;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin gate
  useEffect(() => {
    if (user && !permsLoading && !hasStaffAccess) {
      showToast?.(
        isHt ? 'Aksè rezeve pou administratè.' : inlineText(lang, 'Staff access required.'),
        'user-lock',
      );
      if (onNavigate) onNavigate('/', { replace: true });
    }
  }, [user, hasStaffAccess, permsLoading, isHt, onNavigate, showToast]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminMediaService.brokenStats();
      setStats(res.data);
    } catch {
      showToast?.(
        isHt ? 'Pa kapab chaje estatistik.' : inlineText(lang, 'Failed to load stats.'),
        'exclamation-triangle',
      );
    } finally {
      setLoading(false);
    }
  }, [isHt, showToast]);

  useEffect(() => { if (hasStaffAccess) fetchStats(); }, [fetchStats, hasStaffAccess]);

  if (!permsLoading && !hasStaffAccess) {
    return (
      <div className="abmc-shell">
        <div className="avq-empty">
          <i className="fas fa-user-lock" />
          <h3>{isHt ? 'Aksè Rezeve' : inlineText(lang, 'Staff Access Required')}</h3>
          <p>{isHt ? 'Ou bezwen pèmisyon administratè.' : inlineText(lang, 'You need staff permissions.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="abmc-shell">
      {/* Header */}
      <div className="abmc-header">
        <button type="button" className="abmc-back" onClick={() => onNavigate?.(-1)}>
          <i className="fas fa-arrow-left" />
        </button>
        <div className="abmc-header-center">
          <h1 className="abmc-title">
            <i className="fas fa-link-slash" /> {isHt ? 'Sant Medya Kase' : inlineText(lang, 'Broken Media Center')}
          </h1>
          <p className="abmc-subtitle">
            {isHt
              ? 'Siveye tout medya ki kase sou platfòm la.'
              : inlineText(lang, 'Monitor all broken media across the platform.')}
          </p>
        </div>
        <div className="abmc-header-actions">
          <button type="button" className="abmc-btn" onClick={fetchStats}>
            <i className="fas fa-sync" /> {isHt ? 'Rafrechi' : inlineText(lang, 'Refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="abmc-loading">
          <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : inlineText(lang, 'Loading...')}
        </div>
      ) : (
        <div className="abmc-body">
          <div className="abmc-stats-grid">
            <StatCard icon="fa-link-slash" label={isHt ? 'Total Kase' : inlineText(lang, 'Total Broken')} value={stats?.total_broken} color="var(--state-error, #ef4444)" />
            <StatCard icon="fa-calendar-day" label={isHt ? 'Jodi a' : inlineText(lang, 'Today')} value={stats?.broken_today} color="var(--state-warning, #f59e0b)" />
            <StatCard icon="fa-calendar-week" label={isHt ? 'Semèn sa' : inlineText(lang, 'This Week')} value={stats?.broken_this_week} color="var(--pr-color-orange-500, #f97316)" />
            <StatCard icon="fa-calendar-alt" label={isHt ? 'Mwa sa' : inlineText(lang, 'This Month')} value={stats?.broken_this_month} color="var(--pr-color-orange-400, #fb923c)" />
            <StatCard icon="fa-heart-pulse" label={isHt ? 'Fikse Resamman' : inlineText(lang, 'Recently Fixed')} value={stats?.recently_fixed} color="var(--state-success, #10b981)" />
            <StatCard icon="fa-clock" label={isHt ? 'Ap Tann Ranplasman' : inlineText(lang, 'Waiting Replacement')} value={stats?.waiting_replacement} color="var(--pr-color-violet-500, #8b5cf6)" />
          </div>
          <div className="abmc-tops-grid">
            <TopList title={isHt ? 'Providers ki pi kase' : inlineText(lang, 'Most Broken Providers')} items={stats?.most_broken_providers} keyField="name" valueField="count" icon="fa-cloud" />
            <TopList title={isHt ? 'Kreyatè ki pi kase' : inlineText(lang, 'Most Broken Creators')} items={stats?.most_broken_creators} keyField="username" valueField="count" icon="fa-users" />
            <TopList title={isHt ? 'Modil ki pi kase' : inlineText(lang, 'Most Broken Modules')} items={stats?.most_broken_modules} keyField="module" valueField="count" icon="fa-cubes" />
          </div>
        </div>
      )}
    </div>
  );
}
