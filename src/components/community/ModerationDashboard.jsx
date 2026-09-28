/**
 * src/components/community/ModerationDashboard.jsx
 *
 * Moderation Dashboard for Community Managers.
 * Provides tools for managing community content, users, and reports.
 *
 * Features:
 *   - Content moderation (approve/reject/flag)
 *   - User management (ban/mute/warn)
 *   - Report handling
 *   - Moderation logs
 *   - Auto-moderation settings
 *   - Queue management
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────

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

function getStatusColor(status) {
  const colors = {
    pending: '#f59e0b',
    approved: '#10b981',
    rejected: '#ef4444',
    flagged: '#8b5cf6',
    banned: '#ef4444',
    muted: '#6b7280',
    warned: '#f59e0b',
  };
  return colors[status] || '#6b7280';
}

// ─── Stats Card ────────────────────────────────────────────────────

function StatsCard({ icon, label, value, color, onClick }) {
  return (
    <div className="mod-stats-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="mod-stats-icon" style={{ background: `${color}15`, color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="mod-stats-content">
        <div className="mod-stats-value">{value}</div>
        <div className="mod-stats-label">{label}</div>
      </div>
    </div>
  );
}

// ─── Content Queue Item ────────────────────────────────────────────

function ContentQueueItem({ item, onApprove, onReject, onFlag, lang }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`mod-queue-item mod-queue-${item.status}`}>
      <div className="mod-queue-header">
        <div className="mod-queue-type">
          <i className={`fas ${item.type === 'post' ? 'fa-comment' : item.type === 'discussion' ? 'fa-comments' : 'fa-file'}`} />
          <span>{item.type}</span>
        </div>
        <div className="mod-queue-status" style={{ color: getStatusColor(item.status) }}>
          {item.status}
        </div>
      </div>

      <div className="mod-queue-content">
        <div className="mod-queue-author">
          <i className="fas fa-user" />
          {item.author_name || 'Anonymous'}
        </div>
        <p className="mod-queue-text">{item.content?.substring(0, 200)}</p>
        {item.reason && (
          <div className="mod-queue-reason">
            <i className="fas fa-flag" />
            {item.reason}
          </div>
        )}
      </div>

      <div className="mod-queue-meta">
        <span><i className="fas fa-clock" /> {formatTimeAgo(item.created_at)}</span>
        <span><i className="fas fa-flag" /> {item.report_count || 0} reports</span>
      </div>

      {item.status === 'pending' && (
        <div className="mod-queue-actions">
          <button className="mod-btn mod-btn-approve" onClick={() => onApprove?.(item)}>
            <i className="fas fa-check" /> {lang === 'ht' ? 'Apwouve' : 'Approve'}
          </button>
          <button className="mod-btn mod-btn-reject" onClick={() => onReject?.(item)}>
            <i className="fas fa-times" /> {lang === 'ht' ? 'Rejte' : 'Reject'}
          </button>
          <button className="mod-btn mod-btn-flag" onClick={() => onFlag?.(item)}>
            <i className="fas fa-flag" /> {lang === 'ht' ? 'Flagge' : 'Flag'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── User Management Item ──────────────────────────────────────────

function UserManagementItem({ user, onBan, onMute, onWarn, onUnban, lang }) {
  const isBanned = user.status === 'banned';
  const isMuted = user.status === 'muted';

  return (
    <div className={`mod-user-item ${isBanned ? 'mod-user-banned' : ''}`}>
      <div className="mod-user-avatar">
        {user.avatar ? (
          <img src={user.avatar} alt={user.username} />
        ) : (
          <span>{user.username?.charAt(0)?.toUpperCase()}</span>
        )}
      </div>

      <div className="mod-user-info">
        <div className="mod-user-name">{user.username}</div>
        <div className="mod-user-meta">
          <span className="mod-user-role">{user.role || 'Member'}</span>
          <span className="mod-user-status" style={{ color: getStatusColor(user.status) }}>
            {user.status || 'Active'}
          </span>
        </div>
        {user.warn_count > 0 && (
          <div className="mod-user-warnings">
            <i className="fas fa-exclamation-triangle" />
            {user.warn_count} warnings
          </div>
        )}
      </div>

      <div className="mod-user-actions">
        {isBanned ? (
          <button className="mod-btn mod-btn-unban" onClick={() => onUnban?.(user)}>
            <i className="fas fa-unlock" /> Unban
          </button>
        ) : (
          <>
            <button className="mod-btn mod-btn-warn" onClick={() => onWarn?.(user)}>
              <i className="fas fa-exclamation" />
            </button>
            <button className="mod-btn mod-btn-mute" onClick={() => onMute?.(user)}>
              <i className="fas fa-volume-mute" />
            </button>
            <button className="mod-btn mod-btn-ban" onClick={() => onBan?.(user)}>
              <i className="fas fa-ban" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Report Item ───────────────────────────────────────────────────

function ReportItem({ report, onResolve, onDismiss, lang }) {
  return (
    <div className={`mod-report-item mod-report-${report.status}`}>
      <div className="mod-report-header">
        <div className="mod-report-type">
          <i className={`fas ${report.type === 'spam' ? 'fa-ban' : report.type === 'harassment' ? 'fa-user-slash' : 'fa-flag'}`} />
          <span>{report.type}</span>
        </div>
        <div className="mod-report-status" style={{ color: getStatusColor(report.status) }}>
          {report.status}
        </div>
      </div>

      <div className="mod-report-content">
        <div className="mod-report-reporter">
          <i className="fas fa-user" />
          Reported by: {report.reporter_name}
        </div>
        <div className="mod-report-target">
          <i className="fas fa-bullseye" />
          Target: {report.target_type} by {report.target_author}
        </div>
        <p className="mod-report-reason">{report.reason}</p>
      </div>

      <div className="mod-report-meta">
        <span><i className="fas fa-clock" /> {formatTimeAgo(report.created_at)}</span>
      </div>

      {report.status === 'pending' && (
        <div className="mod-report-actions">
          <button className="mod-btn mod-btn-resolve" onClick={() => onResolve?.(report)}>
            <i className="fas fa-check" /> Resolve
          </button>
          <button className="mod-btn mod-btn-dismiss" onClick={() => onDismiss?.(report)}>
            <i className="fas fa-times" /> Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Moderation Log Item ───────────────────────────────────────────

function LogItem({ log }) {
  const icons = {
    approve: 'fa-check',
    reject: 'fa-times',
    ban: 'fa-ban',
    unban: 'fa-unlock',
    mute: 'fa-volume-mute',
    warn: 'fa-exclamation',
    delete: 'fa-trash',
    flag: 'fa-flag',
  };

  return (
    <div className="mod-log-item">
      <div className="mod-log-icon" style={{ color: getStatusColor(log.action) }}>
        <i className={`fas ${icons[log.action] || 'fa-circle'}`} />
      </div>
      <div className="mod-log-content">
        <span className="mod-log-moderator">{log.moderator_name}</span>
        <span className="mod-log-action">{log.action}</span>
        <span className="mod-log-target">{log.target_type} #{log.target_id}</span>
      </div>
      <div className="mod-log-time">{formatTimeAgo(log.created_at)}</div>
    </div>
  );
}

// ─── Auto-Moderation Settings ──────────────────────────────────────

function AutoModSettings({ settings, onSave, lang }) {
  const [localSettings, setLocalSettings] = useState(settings || {});

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="mod-automod">
      <h3>
        <i className="fas fa-robot" />
        {lang === 'ht' ? 'Otomatik Moderasyon' : 'Auto-Moderation'}
      </h3>

      <div className="mod-automod-settings">
        <div className="mod-setting">
          <label>
            <input
              type="checkbox"
              checked={localSettings.spam_filter || false}
              onChange={(e) => handleChange('spam_filter', e.target.checked)}
            />
            <span>{lang === 'ht' ? 'Filtre Spam' : 'Spam Filter'}</span>
          </label>
          <p className="mod-setting-desc">
            {lang === 'ht' ? 'Automatikman bloke mesaj spam' : 'Automatically block spam messages'}
          </p>
        </div>

        <div className="mod-setting">
          <label>
            <input
              type="checkbox"
              checked={localSettings.link_filter || false}
              onChange={(e) => handleChange('link_filter', e.target.checked)}
            />
            <span>{lang === 'ht' ? 'Filtre Lyen' : 'Link Filter'}</span>
          </label>
          <p className="mod-setting-desc">
            {lang === 'ht' ? 'Filtre lyen sispèk' : 'Filter suspicious links'}
          </p>
        </div>

        <div className="mod-setting">
          <label>
            <input
              type="checkbox"
              checked={localSettings.word_filter || false}
              onChange={(e) => handleChange('word_filter', e.target.checked)}
            />
            <span>{lang === 'ht' ? 'Filtre Mo' : 'Word Filter'}</span>
          </label>
          <p className="mod-setting-desc">
            {lang === 'ht' ? 'Filtre mo ofansif' : 'Filter offensive words'}
          </p>
        </div>

        <div className="mod-setting">
          <label>
            <input
              type="checkbox"
              checked={localSettings.auto_approve || false}
              onChange={(e) => handleChange('auto_approve', e.target.checked)}
            />
            <span>{lang === 'ht' ? 'Otomatik Apwouve' : 'Auto-Approve'}</span>
          </label>
          <p className="mod-setting-desc">
            {lang === 'ht' ? 'Otomatikman apwouve kontni ki pa gen pwoblèm' : 'Automatically approve content with no issues'}
          </p>
        </div>

        <div className="mod-setting">
          <label>
            <span>{lang === 'ht' ? 'Max Rapò pou Auto-Flag' : 'Max Reports to Auto-Flag'}</span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={localSettings.auto_flag_threshold || 3}
            onChange={(e) => handleChange('auto_flag_threshold', parseInt(e.target.value))}
          />
        </div>
      </div>

      <button className="mod-btn mod-btn-save" onClick={() => onSave?.(localSettings)}>
        <i className="fas fa-save" /> {lang === 'ht' ? 'Sove' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function ModerationDashboard({ community, lang = 'ht', showToast }) {
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [autoModSettings, setAutoModSettings] = useState({});

  useEffect(() => {
    fetchData();
  }, [community?.id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [statsRes, queueRes, usersRes, reportsRes, logsRes, autoModRes] = await Promise.allSettled([
        api.get(`/communities/${community?.id}/moderation/stats/`),
        api.get(`/communities/${community?.id}/moderation/queue/`),
        api.get(`/communities/${community?.id}/moderation/users/`),
        api.get(`/communities/${community?.id}/moderation/reports/`),
        api.get(`/communities/${community?.id}/moderation/logs/`),
        api.get(`/communities/${community?.id}/moderation/automod/`),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data || {});
      if (queueRes.status === 'fulfilled') setQueue(Array.isArray(queueRes.value.data) ? queueRes.value.data : []);
      if (usersRes.status === 'fulfilled') setUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      if (reportsRes.status === 'fulfilled') setReports(Array.isArray(reportsRes.value.data) ? reportsRes.value.data : []);
      if (logsRes.status === 'fulfilled') setLogs(Array.isArray(logsRes.value.data) ? logsRes.value.data : []);
      if (autoModRes.status === 'fulfilled') setAutoModSettings(autoModRes.value.data || {});
    } catch (err) {
      console.error('Failed to fetch moderation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/approve/`, { id: item.id });
      fetchData();
      showToast?.(lang === 'ht' ? 'Apwouve!' : 'Approved!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleReject = async (item) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/reject/`, { id: item.id });
      fetchData();
      showToast?.(lang === 'ht' ? 'Rejte!' : 'Rejected!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleBan = async (user) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/ban/`, { user_id: user.id });
      fetchData();
      showToast?.(lang === 'ht' ? 'Bloke!' : 'Banned!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleMute = async (user) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/mute/`, { user_id: user.id });
      fetchData();
      showToast?.(lang === 'ht' ? 'Mute!' : 'Muted!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleWarn = async (user) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/warn/`, { user_id: user.id });
      fetchData();
      showToast?.(lang === 'ht' ? 'Avètisman!' : 'Warning!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleResolveReport = async (report) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/reports/resolve/`, { id: report.id });
      fetchData();
      showToast?.(lang === 'ht' ? 'Rezoud!' : 'Resolved!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleSaveAutoMod = async (settings) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/automod/`, settings);
      setAutoModSettings(settings);
      showToast?.(lang === 'ht' ? 'Sove!' : 'Saved!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  return (
    <div className="mod-container">
      <div className="mod-header">
        <h2>
          <i className="fas fa-shield-alt" />
          {lang === 'ht' ? 'Moderasyon' : 'Moderation'}
        </h2>
      </div>

      {/* Stats */}
      <div className="mod-stats-grid">
        <StatsCard icon="fa-clock" label="Pending" value={stats.pending || 0} color="#f59e0b" onClick={() => setActiveTab('queue')} />
        <StatsCard icon="fa-check-circle" label="Approved" value={stats.approved || 0} color="#10b981" />
        <StatsCard icon="fa-times-circle" label="Rejected" value={stats.rejected || 0} color="#ef4444" />
        <StatsCard icon="fa-flag" label="Reports" value={stats.reports || 0} color="#8b5cf6" onClick={() => setActiveTab('reports')} />
        <StatsCard icon="fa-ban" label="Banned" value={stats.banned || 0} color="#ef4444" />
        <StatsCard icon="fa-exclamation-triangle" label="Warnings" value={stats.warnings || 0} color="#f59e0b" />
      </div>

      {/* Tabs */}
      <div className="mod-tabs">
        <button className={activeTab === 'queue' ? 'mod-tab-active' : ''} onClick={() => setActiveTab('queue')}>
          <i className="fas fa-list" /> Queue
        </button>
        <button className={activeTab === 'users' ? 'mod-tab-active' : ''} onClick={() => setActiveTab('users')}>
          <i className="fas fa-users" /> Users
        </button>
        <button className={activeTab === 'reports' ? 'mod-tab-active' : ''} onClick={() => setActiveTab('reports')}>
          <i className="fas fa-flag" /> Reports
        </button>
        <button className={activeTab === 'logs' ? 'mod-tab-active' : ''} onClick={() => setActiveTab('logs')}>
          <i className="fas fa-history" /> Logs
        </button>
        <button className={activeTab === 'automod' ? 'mod-tab-active' : ''} onClick={() => setActiveTab('automod')}>
          <i className="fas fa-robot" /> Auto-Mod
        </button>
      </div>

      {/* Content */}
      <div className="mod-content">
        {loading ? (
          <div className="mod-loading">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {activeTab === 'queue' && (
              <div className="mod-queue">
                {queue.length === 0 ? (
                  <div className="mod-empty">
                    <i className="fas fa-check-circle" />
                    <p>{lang === 'ht' ? 'Pa gen kontni nan ke a' : 'No items in queue'}</p>
                  </div>
                ) : (
                  queue.map((item) => (
                    <ContentQueueItem
                      key={item.id}
                      item={item}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      lang={lang}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="mod-users">
                {users.length === 0 ? (
                  <div className="mod-empty">
                    <i className="fas fa-users" />
                    <p>{lang === 'ht' ? 'Pa gen itilizatè' : 'No users'}</p>
                  </div>
                ) : (
                  users.map((user) => (
                    <UserManagementItem
                      key={user.id}
                      user={user}
                      onBan={handleBan}
                      onMute={handleMute}
                      onWarn={handleWarn}
                      lang={lang}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="mod-reports">
                {reports.length === 0 ? (
                  <div className="mod-empty">
                    <i className="fas fa-flag" />
                    <p>{lang === 'ht' ? 'Pa gen rapò' : 'No reports'}</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <ReportItem
                      key={report.id}
                      report={report}
                      onResolve={handleResolveReport}
                      lang={lang}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="mod-logs">
                {logs.length === 0 ? (
                  <div className="mod-empty">
                    <i className="fas fa-history" />
                    <p>{lang === 'ht' ? 'Pa gen jounal' : 'No logs'}</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <LogItem key={log.id} log={log} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'automod' && (
              <AutoModSettings
                settings={autoModSettings}
                onSave={handleSaveAutoMod}
                lang={lang}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
