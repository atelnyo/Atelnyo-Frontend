/**
 * src/components/community/UserModerationTools.jsx
 *
 * Advanced User Moderation Tools for Community Managers.
 *
 * Features:
 *   - Progressive warning system (3 warnings = ban)
 *   - Temporary/permanent mute management
 *   - User activity history and patterns
 *   - Strike system with escalation
 *   - Custom warning messages
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────

const WARNING_LEVELS = [
  { level: 1, label: 'First Warning', color: '#f59e0b', icon: 'fa-exclamation', action: 'warning' },
  { level: 2, label: 'Second Warning', color: '#ea580c', icon: 'fa-exclamation-triangle', action: 'strong_warning' },
  { level: 3, label: 'Final Warning', color: '#dc2626', icon: 'fa-ban', action: 'ban' },
];

const MUTE_DURATIONS = [
  { value: 3600, label: '1 Hour' },
  { value: 86400, label: '24 Hours' },
  { value: 604800, label: '7 Days' },
  { value: 2592000, label: '30 Days' },
  { value: -1, label: 'Permanent' },
];

// ─── Helpers ──────────────────────────────────────────────────────

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

function formatDuration(seconds) {
  if (seconds === -1) return 'Permanent';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ─── Warning Badge ────────────────────────────────────────────────

function WarningBadge({ warnings }) {
  if (!warnings || warnings.length === 0) return <span className="umt-badge umt-badge-clean">Clean</span>;

  const activeWarnings = warnings.filter(w => !w.revoked_at);
  const level = activeWarnings.length;

  if (level === 0) return <span className="umt-badge umt-badge-clean">Clean</span>;

  const wl = WARNING_LEVELS[Math.min(level - 1, 2)];

  return (
    <span className="umt-badge" style={{ background: wl.color + '18', color: wl.color }}>
      <i className={`fas ${wl.icon}`} /> {wl.label}
    </span>
  );
}

// ─── User Activity Timeline ───────────────────────────────────────

function ActivityTimeline({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="umt-timeline-empty">
        <i className="fas fa-history" />
        <span>No activity recorded</span>
      </div>
    );
  }

  return (
    <div className="umt-timeline">
      {activities.map((activity, idx) => (
        <div key={idx} className="umt-timeline-item">
          <div className="umt-timeline-dot" />
          <div className="umt-timeline-content">
            <div className="umt-timeline-action">{activity.action}</div>
            <div className="umt-timeline-details">{activity.details}</div>
            <div className="umt-timeline-time">{formatTimeAgo(activity.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Strike Card ──────────────────────────────────────────────────

function StrikeCard({ warning, index, onRevoke, lang }) {
  const wl = WARNING_LEVELS[Math.min(index, 2)];
  const isActive = !warning.revoked_at;

  return (
    <div className={`umt-strike ${!isActive ? 'umt-strike-revoked' : ''}`}>
      <div className="umt-strike-header">
        <div className="umt-strike-level" style={{ color: wl.color }}>
          <i className={`fas ${wl.icon}`} />
          <span>Strike {index + 1}</span>
        </div>
        {isActive && onRevoke && (
          <button className="umt-btn umt-btn-revoke" onClick={() => onRevoke(warning.id)}>
            <i className="fas fa-undo" /> {lang === 'ht' ? 'Anile' : 'Revoke'}
          </button>
        )}
      </div>
      <div className="umt-strike-body">
        <div className="umt-strike-reason">{warning.reason || 'No reason provided'}</div>
        <div className="umt-strike-meta">
          <span><i className="fas fa-user-shield" /> {warning.issued_by_name || 'System'}</span>
          <span><i className="fas fa-clock" /> {formatTimeAgo(warning.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Mute Panel ───────────────────────────────────────────────────

function MutePanel({ user, onMute, onUnmute, lang }) {
  const [duration, setDuration] = useState(86400);
  const [reason, setReason] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleMute = () => {
    onMute?.({ duration, reason, user_id: user.id });
    setReason('');
  };

  return (
    <div className="umt-mute-panel">
      <h4>
        <i className="fas fa-volume-mute" />
        {lang === 'ht' ? 'Mute Itilizatè' : 'Mute User'}
      </h4>

      <div className="umt-mute-durations">
        {MUTE_DURATIONS.map((d) => (
          <button
            key={d.value}
            className={`umt-duration-btn ${duration === d.value ? 'umt-duration-active' : ''}`}
            onClick={() => setDuration(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="umt-mute-reason">
        <input
          type="text"
          placeholder={lang === 'ht' ? 'Rezon (opsyonèl)' : 'Reason (optional)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <button className="umt-btn umt-btn-mute" onClick={handleMute}>
        <i className="fas fa-volume-mute" />
        {lang === 'ht' ? 'Mute' : 'Mute User'}
      </button>
    </div>
  );
}

// ─── Warning Dialog ───────────────────────────────────────────────

function WarningDialog({ user, warningLevel, onConfirm, onCancel, lang }) {
  const [message, setMessage] = useState('');
  const wl = WARNING_LEVELS[Math.min(warningLevel - 1, 2)];

  const templates = {
    1: lang === 'ht'
      ? 'Avètisman: Kontni ou viole règman communautaire yo. Tanpri revize Règman an.'
      : 'Warning: Your content violates community guidelines. Please review our rules.',
    2: lang === 'ht'
      ? 'Avètisman fò: Sa a dezyèm avètisman ou. Yon lòt viole pral rezilte nan yon ban.'
      : 'Strong Warning: This is your second warning. Another violation will result in a ban.',
    3: lang === 'ht'
      ? 'Dènye avètisman: Sa a dènye avètisman ou anvan yon ban pèmanan.'
      : 'Final Warning: This is your last warning before a permanent ban.',
  };

  return (
    <div className="umt-dialog-overlay">
      <div className="umt-dialog">
        <div className="umt-dialog-header" style={{ borderColor: wl.color }}>
          <i className={`fas ${wl.icon}`} style={{ color: wl.color }} />
          <h4>{wl.label}</h4>
        </div>

        <div className="umt-dialog-body">
          <p>{lang === 'ht' ? 'Itilizatè:' : 'User:'} <strong>{user?.username}</strong></p>
          <p>{lang === 'ht' ? 'Nivo Avètisman:' : 'Warning Level:'} <strong>{warningLevel}/3</strong></p>

          <div className="umt-dialog-message">
            <label>{lang === 'ht' ? 'Mesaj:' : 'Message:'}</label>
            <textarea
              value={message || templates[warningLevel] || ''}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="umt-dialog-actions">
          <button className="umt-btn umt-btn-cancel" onClick={onCancel}>
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button
            className="umt-btn umt-btn-confirm"
            style={{ background: wl.color }}
            onClick={() => onConfirm({ user_id: user.id, message, level: warningLevel })}
          >
            <i className={`fas ${wl.icon}`} />
            {lang === 'ht' ? 'Kontinye' : 'Send Warning'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function UserModerationTools({ community, user, lang = 'ht', showToast, onUpdate }) {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showMutePanel, setShowMutePanel] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchUserData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [userRes, activitiesRes, warningsRes] = await Promise.allSettled([
        api.get(`/communities/${community?.id}/moderation/users/${user.id}/`),
        api.get(`/communities/${community?.id}/moderation/users/${user.id}/activities/`),
        api.get(`/communities/${community?.id}/moderation/users/${user.id}/warnings/`),
      ]);

      if (userRes.status === 'fulfilled') setUserData(userRes.value.data);
      if (activitiesRes.status === 'fulfilled') setActivities(activitiesRes.value.data || []);
      if (warningsRes.status === 'fulfilled') setWarnings(warningsRes.value.data || []);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  }, [community?.id, user?.id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleWarning = async ({ user_id, message, level }) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/warn/`, {
        user_id,
        message,
        level,
      });
      setShowWarningDialog(false);
      fetchUserData();
      showToast?.(
        lang === 'ht' ? 'Avètisman voye!' : 'Warning sent!',
        'success'
      );
      onUpdate?.();
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleMute = async ({ duration, reason, user_id }) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/mute/`, {
        user_id,
        duration,
        reason,
      });
      setShowMutePanel(false);
      fetchUserData();
      showToast?.(
        lang === 'ht' ? 'Itilizatè mute!' : 'User muted!',
        'success'
      );
      onUpdate?.();
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleUnmute = async () => {
    try {
      await api.post(`/communities/${community?.id}/moderation/unmute/`, {
        user_id: user.id,
      });
      fetchUserData();
      showToast?.(
        lang === 'ht' ? 'Itilizatè demute!' : 'User unmuted!',
        'success'
      );
      onUpdate?.();
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleRevokeWarning = async (warningId) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/warnings/${warningId}/revoke/`);
      fetchUserData();
      showToast?.(
        lang === 'ht' ? 'Avètisman anile!' : 'Warning revoked!',
        'success'
      );
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleBan = async (permanent = true) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/ban/`, {
        user_id: user.id,
        permanent,
        reason: 'Community rules violation',
      });
      fetchUserData();
      showToast?.(
        lang === 'ht' ? 'Itilizatè bloke!' : 'User banned!',
        'success'
      );
      onUpdate?.();
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  if (loading) {
    return (
      <div className="umt-loading">
        <i className="fas fa-spinner fa-spin" />
        <span>{lang === 'ht' ? 'Ap chaje...' : 'Loading...'}</span>
      </div>
    );
  }

  const activeWarnings = warnings.filter(w => !w.revoked_at);
  const strikeCount = activeWarnings.length;

  return (
    <div className="umt-container">
      <div className="umt-header">
        <div className="umt-user-info">
          <div className="umt-avatar">
            {userData?.avatar ? (
              <img src={userData.avatar} alt={userData.username} />
            ) : (
              <span>{userData?.username?.charAt(0)?.toUpperCase()}</span>
            )}
          </div>
          <div className="umt-user-details">
            <h3>{userData?.username}</h3>
            <div className="umt-user-badges">
              <WarningBadge warnings={warnings} />
              {userData?.is_muted && (
                <span className="umt-badge umt-badge-muted">
                  <i className="fas fa-volume-mute" /> Muted
                </span>
              )}
              {userData?.is_banned && (
                <span className="umt-badge umt-badge-banned">
                  <i className="fas fa-ban" /> Banned
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="umt-actions">
          {strikeCount < 3 && (
            <button className="umt-btn umt-btn-warn" onClick={() => setShowWarningDialog(true)}>
              <i className="fas fa-exclamation-triangle" />
              {lang === 'ht' ? 'Avètisman' : 'Warn'}
            </button>
          )}
          <button className="umt-btn umt-btn-mute" onClick={() => setShowMutePanel(!showMutePanel)}>
            <i className="fas fa-volume-mute" />
            {lang === 'ht' ? 'Mute' : 'Mute'}
          </button>
          <button className="umt-btn umt-btn-ban" onClick={() => handleBan(true)}>
            <i className="fas fa-ban" />
            {lang === 'ht' ? 'Bloke' : 'Ban'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="umt-tabs">
        <button className={activeTab === 'overview' ? 'umt-tab-active' : ''} onClick={() => setActiveTab('overview')}>
          <i className="fas fa-info-circle" /> Overview
        </button>
        <button className={activeTab === 'strikes' ? 'umt-tab-active' : ''} onClick={() => setActiveTab('strikes')}>
          <i className="fas fa-gavel" /> Strikes ({strikeCount})
        </button>
        <button className={activeTab === 'activity' ? 'umt-tab-active' : ''} onClick={() => setActiveTab('activity')}>
          <i className="fas fa-history" /> Activity
        </button>
      </div>

      {/* Content */}
      <div className="umt-content">
        {activeTab === 'overview' && (
          <div className="umt-overview">
            <div className="umt-stat-grid">
              <div className="umt-stat">
                <div className="umt-stat-value" style={{ color: strikeCount >= 3 ? '#dc2626' : strikeCount > 0 ? '#f59e0b' : '#10b981' }}>
                  {strikeCount}/3
                </div>
                <div className="umt-stat-label">Strikes</div>
              </div>
              <div className="umt-stat">
                <div className="umt-stat-value">{activities.length}</div>
                <div className="umt-stat-label">Actions</div>
              </div>
              <div className="umt-stat">
                <div className="umt-stat-value">{userData?.content_count || 0}</div>
                <div className="umt-stat-label">Posts</div>
              </div>
            </div>

            {strikeCount >= 3 && (
              <div className="umt-alert umt-alert-danger">
                <i className="fas fa-exclamation-circle" />
                <span>{lang === 'ht' ? 'Itilizatè sa a gen 3 avètisman. Li kapab bloke.' : 'This user has 3 strikes. They may be banned.'}</span>
                <button className="umt-btn umt-btn-ban" onClick={() => handleBan(true)}>
                  {lang === 'ht' ? 'Bloke Kounye a' : 'Ban Now'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'strikes' && (
          <div className="umt-strikes">
            {warnings.length === 0 ? (
              <div className="umt-empty">
                <i className="fas fa-check-circle" />
                <p>{lang === 'ht' ? 'Pa gen avètisman' : 'No warnings'}</p>
              </div>
            ) : (
              warnings.map((warning, idx) => (
                <StrikeCard
                  key={warning.id}
                  warning={warning}
                  index={idx}
                  onRevoke={!warning.revoked_at ? handleRevokeWarning : null}
                  lang={lang}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityTimeline activities={activities} />
        )}
      </div>

      {/* Mute Panel */}
      {showMutePanel && (
        <MutePanel
          user={user}
          onMute={handleMute}
          onUnmute={handleUnmute}
          lang={lang}
        />
      )}

      {/* Warning Dialog */}
      {showWarningDialog && (
        <WarningDialog
          user={user}
          warningLevel={strikeCount + 1}
          onConfirm={handleWarning}
          onCancel={() => setShowWarningDialog(false)}
          lang={lang}
        />
      )}
    </div>
  );
}
