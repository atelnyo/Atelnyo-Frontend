/**
 * CreatorUniqueFeatures.jsx — Unique Creator Studio Features.
 *
 * These features are ONLY available in Creator Studio,
 * NOT in Business Workspace:
 *
 * 1. Content Calendar — schedule posts and content
 * 2. Achievement Showcase — display achievements prominently
 * 3. Collaboration Hub — work with other creators
 * 4. Learning Path Builder — create learning paths for students
 * 5. Community Builder — manage community engagement
 */
import React, { useState } from 'react';

// ─── 1. Content Calendar ───────────────────────────────────────────
export function ContentCalendar({ lang = 'ht', scheduledContent = [] }) {
  const [view, setView] = useState('week');
  const t = (ht, en) => lang === 'ht' ? ht : en;

  const days = [
    { key: 'mon', labelHt: 'Lun', labelEn: 'Mon' },
    { key: 'tue', labelHt: 'Mar', labelEn: 'Tue' },
    { key: 'wed', labelHt: 'Mer', labelEn: 'Wed' },
    { key: 'thu', labelHt: 'Jeu', labelEn: 'Thu' },
    { key: 'fri', labelHt: 'Ven', labelEn: 'Fri' },
    { key: 'sat', labelHt: 'Sam', labelEn: 'Sat' },
    { key: 'sun', labelHt: 'Dim', labelEn: 'Sun' },
  ];

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          <i className="fas fa-calendar-alt" style={{ marginRight: 8, color: '#6366f1' }} />
          {t('Kalandriye Kontni', 'Content Calendar')}
        </h4>
        <div style={{ display: 'flex', gap: 4 }}>
          {['week', 'month'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: view === v ? '#6366f1' : 'var(--bg-tertiary)',
                color: view === v ? '#fff' : 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {v === 'week' ? t('Semèn', 'Week') : t('Mwa', 'Month')}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
      }}>
        {days.map(day => (
          <div key={day.key} style={{
            padding: '8px 4px',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            borderBottom: '2px solid var(--border-color)',
          }}>
            {lang === 'ht' ? day.labelHt : day.labelEn}
          </div>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{
            minHeight: 80,
            padding: 4,
            borderRadius: 6,
            background: i === 3 ? 'var(--pink-primary-light, #fdf2f8)' : 'var(--bg-primary)',
            border: i === 3 ? '1px solid var(--pink-primary)' : '1px solid transparent',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: i === 3 ? 'var(--pink-primary)' : 'var(--text-secondary)',
              marginBottom: 4,
            }}>
              {i + 15}
            </div>
            {scheduledContent.filter(c => c.day === i).map((content, j) => (
              <div key={j} style={{
                padding: '2px 4px',
                borderRadius: 4,
                background: content.type === 'course' ? '#dbeafe' : content.type === 'music' ? '#fce7f3' : '#d1fae5',
                fontSize: 10,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {content.title}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#dbeafe' }} />
          {t('Kou', 'Course')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#fce7f3' }} />
          {t('Mizik', 'Music')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#d1fae5' }} />
          {t('Pòtfolyo', 'Portfolio')}
        </span>
      </div>
    </div>
  );
}

// ─── 2. Achievement Showcase ────────────────────────────────────────
export function AchievementShowcase({ achievements = [], lang = 'ht' }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;

  const ACHIEVEMENT_TYPES = [
    { type: 'badge', icon: 'fa-medal', color: '#fbbf24', labelHt: 'Badges', labelEn: 'Badges' },
    { type: 'course', icon: 'fa-graduation-cap', color: '#34d399', labelHt: 'Kou', labelEn: 'Courses' },
    { type: 'certificate', icon: 'fa-certificate', color: '#8b5cf6', labelHt: 'Sètifikasyon', labelEn: 'Certificates' },
    { type: 'review', icon: 'fa-star', color: '#f59e0b', labelHt: 'Revizyon', labelEn: 'Reviews' },
    { type: 'milestone', icon: 'fa-trophy', color: '#3b82f6', labelHt: 'Milesèt', labelEn: 'Milestones' },
  ];

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        <i className="fas fa-trophy" style={{ marginRight: 8, color: '#fbbf24' }} />
        {t('Ekspozisyon Reyalisasyon', 'Achievement Showcase')}
      </h4>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8,
      }}>
        {ACHIEVEMENT_TYPES.map(at => {
          const count = achievements.filter(a => a.type === at.type).length;
          return (
            <div key={at.type} style={{
              padding: '12px 8px',
              borderRadius: 8,
              background: 'var(--bg-primary)',
              textAlign: 'center',
              border: count > 0 ? `2px solid ${at.color}` : '1px solid var(--border-color)',
            }}>
              <i className={`fas ${at.icon}`} style={{
                fontSize: 20,
                color: count > 0 ? at.color : 'var(--text-tertiary)',
                marginBottom: 4,
              }} />
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: count > 0 ? at.color : 'var(--text-secondary)',
              }}>
                {count}
              </div>
              <div style={{
                fontSize: 10,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}>
                {lang === 'ht' ? at.labelHt : at.labelEn}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Achievements */}
      {achievements.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {t('Dènye Reyalisasyon', 'Recent Achievements')}
          </div>
          {achievements.slice(0, 3).map((a, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              borderBottom: i < 2 ? '1px solid var(--border-color)' : 'none',
            }}>
              <i className={`fas ${a.icon || 'fa-trophy'}`} style={{ color: a.color || '#fbbf24', fontSize: 14 }} />
              <span style={{ fontSize: 12, flex: 1 }}>{a.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 3. Collaboration Hub ───────────────────────────────────────────
export function CollaborationHub({ lang = 'ht', collaborators = [] }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          <i className="fas fa-users-cog" style={{ marginRight: 8, color: '#10b981' }} />
          {t('Biwo Kolyaborasyon', 'Collaboration Hub')}
        </h4>
        <button style={{
          padding: '4px 12px',
          borderRadius: 6,
          border: 'none',
          background: '#10b981',
          color: '#fff',
          fontSize: 12,
          cursor: 'pointer',
        }}>
          <i className="fas fa-user-plus" /> {t('Envite', 'Invite')}
        </button>
      </div>

      {/* Active Collaborations */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {collaborators.length === 0 ? (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            <i className="fas fa-handshake" style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }} />
            <p>{t('Pa gen kolyaborasyon ankò', 'No collaborations yet')}</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>
              {t(
                'Envite lòt kreyatè pou kolabore sou pwojè',
                'Invite other creators to collaborate on projects'
              )}
            </p>
          </div>
        ) : (
          collaborators.map((c, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--bg-primary)',
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
              }}>
                {c.name?.[0] || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.role}</div>
              </div>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: c.status === 'active' ? '#d1fae5' : '#fef3c7',
                color: c.status === 'active' ? '#059669' : '#d97706',
              }}>
                {c.status === 'active' ? t('Aktif', 'Active') : t('Lap tann', 'Pending')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 4. Learning Path Builder ───────────────────────────────────────
export function LearningPathBuilder({ lang = 'ht', courses = [] }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          <i className="fas fa-route" style={{ marginRight: 8, color: '#f97316' }} />
          {t('Konstraktè Chimen Aprantisaj', 'Learning Path Builder')}
        </h4>
        <button style={{
          padding: '4px 12px',
          borderRadius: 6,
          border: 'none',
          background: '#f97316',
          color: '#fff',
          fontSize: 12,
          cursor: 'pointer',
        }}>
          <i className="fas fa-plus" /> {t('Kreye Chimen', 'Create Path')}
        </button>
      </div>

      {/* Learning Path Visual */}
      <div style={{
        position: 'relative',
        padding: '8px 0 8px 24px',
      }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute',
          left: 12,
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--border-color)',
        }} />

        {courses.length === 0 ? (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            <i className="fas fa-route" style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }} />
            <p>{t('Pa gen chimen ankò', 'No learning paths yet')}</p>
          </div>
        ) : (
          courses.map((course, i) => (
            <div key={i} style={{
              position: 'relative',
              padding: '12px 16px',
              marginBottom: 8,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
            }}>
              {/* Step number */}
              <div style={{
                position: 'absolute',
                left: -18,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#f97316',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {i + 1}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{course.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {course.lessons} {t('leson', 'lessons')} • {course.duration}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: 'var(--bg-tertiary)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}>
                    <i className="fas fa-grip-vertical" />
                  </button>
                  <button style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#fee2e2',
                    color: '#ef4444',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 5. Community Builder ───────────────────────────────────────────
export function CommunityBuilder({ lang = 'ht', stats = {} }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        <i className="fas fa-users" style={{ marginRight: 8, color: '#ec4899' }} />
        {t('Konstraktè Kominote', 'Community Builder')}
      </h4>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-users" style={{ fontSize: 24, color: '#ec4899', marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.members || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('Manm', 'Members')}
          </div>
        </div>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-comments" style={{ fontSize: 24, color: '#8b5cf6', marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.posts || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('Pòs', 'Posts')}
          </div>
        </div>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-calendar-check" style={{ fontSize: 24, color: '#3b82f6', marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.events || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('Evènman', 'Events')}
          </div>
        </div>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-bullhorn" style={{ fontSize: 24, color: '#f59e0b', marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.announcements || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('Anons', 'Announcements')}
          </div>
        </div>
      </div>

      <button style={{
        width: '100%',
        marginTop: 12,
        padding: '10px',
        borderRadius: 8,
        border: 'none',
        background: '#ec4899',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}>
        <i className="fas fa-plus" /> {t('Jere Kominote', 'Manage Community')}
      </button>
    </div>
  );
}

export default {
  ContentCalendar,
  AchievementShowcase,
  CollaborationHub,
  LearningPathBuilder,
  CommunityBuilder,
};
