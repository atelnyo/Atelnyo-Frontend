/**
 * src/components/studio/editor/CollaborationPanel.jsx
 *
 * Course collaboration management — invite users, assign roles,
 * manage permissions, and remove collaborators.
 *
 * Roles:
 *   Owner    — full control (implicit, from course.created_by)
 *   Editor   — create, edit content
 *   Reviewer — view + comment
 *   Instructor — manage students, view analytics
 *
 * All operations are owner-only for invite/remove/update.
 * Any collaborator can view the list.
 */
import React, { useState, useCallback } from 'react';
import { courseService } from '../../../services/api';

const ROLE_INFO = {
  owner: { icon: 'fa-crown', color: '#f59e0b', label: { ht: 'Pwopriyetè', en: 'Owner' } },
  editor: { icon: 'fa-pen', color: '#3b82f6', label: { ht: 'Editè', en: 'Editor' } },
  reviewer: { icon: 'fa-eye', color: '#8b5cf6', label: { ht: 'Revizè', en: 'Reviewer' } },
  instructor: { icon: 'fa-chalkboard-teacher', color: '#10b981', label: { ht: 'Enstriktè', en: 'Instructor' } },
};

const ROLE_DESCRIPTIONS = {
  owner: { ht: 'Kontwòl konplè sou kou a', en: 'Full control over the course' },
  editor: { ht: 'Kreye epi modifye kontni', en: 'Create and edit content' },
  reviewer: { ht: 'Wè kontni a sèlman', en: 'View content only' },
  instructor: { ht: 'Jere elèv ak pwogrè', en: 'Manage students and progress' },
};

export default function CollaborationPanel({ courseId, lang = 'ht', isOwner = false }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadCollaborators = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError('');
    try {
      const res = await courseService.getCollaborators(courseId);
      setCollaborators(Array.isArray(res?.data) ? res.data : []);
      setLoaded(true);
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not load collaborators.', 'Pa t kapab chaje kolaboratè yo.'));
    } finally {
      setLoading(false);
    }
  }, [courseId, loaded, t, isHt]);

  const handleInvite = useCallback(async () => {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    setError('');
    try {
      await courseService.inviteCollaborator(courseId, {
        username: inviteUsername.trim(),
        role: inviteRole,
      });
      setInviteUsername('');
      setLoaded(false); // force reload
      loadCollaborators();
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not invite.', 'Pa t kapab envite.'));
    } finally {
      setInviting(false);
    }
  }, [courseId, inviteUsername, inviteRole, loadCollaborators, t, isHt]);

  const handleRemove = useCallback(async (collabId) => {
    if (!window.confirm(t('Remove this collaborator?', 'Retire kolaboratè sa a?'))) return;
    setError('');
    try {
      await courseService.removeCollaborator(courseId, collabId);
      setLoaded(false);
      loadCollaborators();
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not remove.', 'Pa t kapab retire.'));
    }
  }, [courseId, loadCollaborators, t, isHt]);

  const handleRoleChange = useCallback(async (collabId, newRole) => {
    setError('');
    try {
      await courseService.updateCollaborator(courseId, collabId, { role: newRole });
      setLoaded(false);
      loadCollaborators();
    } catch (e) {
      setError(e?.response?.data?.detail || t('Could not update.', 'Pa t kapab mete ajou.'));
    }
  }, [courseId, loadCollaborators, t, isHt]);

  return (
    <div style={{
      border: '1px solid var(--border-color, #334155)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color, #334155)',
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        }}
        onClick={loadCollaborators}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') loadCollaborators(); }}
      >
        <i className="fas fa-users" style={{ color: '#3b82f6' }} />
        <span style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>
          {t('Kolaboratè', 'Collaborators')}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          {collaborators.length}
        </span>
        <i className={`fas ${loaded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }} />
      </div>

      {loaded && (
        <div style={{ padding: 12 }}>
          {error && (
            <p style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem', marginBottom: 8 }}>
              <i className="fas fa-circle-exclamation" /> {error}
            </p>
          )}

          {/* Invite form (owner only) */}
          {isOwner && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder={t('Non itilizatè', 'Username')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 8,
                  border: '1px solid var(--border-color, #334155)',
                  background: 'var(--bg, #0f172a)', color: 'var(--text)',
                  fontSize: '0.8rem', fontFamily: 'inherit',
                }}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{
                  padding: '6px 8px', borderRadius: 8,
                  border: '1px solid var(--border-color, #334155)',
                  background: 'var(--bg, #0f172a)', color: 'var(--text)',
                  fontSize: '0.78rem', fontFamily: 'inherit',
                }}
              >
                {Object.entries(ROLE_INFO).filter(([k]) => k !== 'owner').map(([key, info]) => (
                  <option key={key} value={key}>{info.label[lang] || info.label.en}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || !inviteUsername.trim()}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: inviting ? '#666' : '#3b82f6',
                  color: '#fff', fontWeight: 600, cursor: inviting ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem', fontFamily: 'inherit',
                }}
              >
                {inviting ? '...' : t('Envite', 'Invite')}
              </button>
            </div>
          )}

          {/* Collaborator list */}
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 12, fontSize: '0.8rem' }}>
              <i className="fas fa-spinner fa-spin" /> {t('Ap chaje...', 'Loading...')}
            </p>
          ) : collaborators.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 12, fontSize: '0.78rem' }}>
              {t('Pa gen kolaboratè ankò.', 'No collaborators yet.')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {collaborators.map((c) => {
                const roleInfo = ROLE_INFO[c.role] || ROLE_INFO.editor;
                const isExpanded = expandedId === (c.id || c.user);
                return (
                  <div key={c.id || c.user} style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: 'var(--bg-elevated, #1e293b)',
                    border: '1px solid var(--border-color, #334155)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: roleInfo.color, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover' }} />
                        ) : (
                          (c.display_name || c.username || '?').charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Name + role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.display_name || c.username}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {c.username} · {roleInfo.label[lang] || roleInfo.label.en}
                        </div>
                      </div>

                      {/* Role badge */}
                      <span style={{
                        fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                        background: `${roleInfo.color}15`, color: roleInfo.color, fontWeight: 600,
                      }}>
                        <i className={`fas ${roleInfo.icon}`} style={{ marginRight: 3 }} />
                        {roleInfo.label[lang] || roleInfo.label.en}
                      </span>

                      {/* Actions (owner only, not for owner row) */}
                      {isOwner && !c.is_owner && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : (c.id || c.user))}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', padding: 4,
                          }}
                          aria-label={t('Plis opsyon', 'More options')}
                        >
                          <i className="fas fa-ellipsis-v" />
                        </button>
                      )}
                    </div>

                    {/* Expanded options */}
                    {isExpanded && !c.is_owner && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color, #334155)' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                          {Object.entries(ROLE_INFO).filter(([k]) => k !== 'owner').map(([key, info]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleRoleChange(c.id, key)}
                              style={{
                                padding: '3px 8px', borderRadius: 6, fontSize: '0.7rem',
                                border: `1px solid ${c.role === key ? info.color : 'var(--border-color)'}`,
                                background: c.role === key ? `${info.color}15` : 'transparent',
                                color: c.role === key ? info.color : 'var(--text-secondary)',
                                cursor: 'pointer', fontFamily: 'inherit',
                                fontWeight: c.role === key ? 600 : 400,
                              }}
                            >
                              {info.label[lang] || info.label.en}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(c.id)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.05)', color: '#ef4444',
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <i className="fas fa-trash" /> {t('Retire', 'Remove')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
