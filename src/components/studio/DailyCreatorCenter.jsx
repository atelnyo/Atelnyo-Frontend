/**
 * src/components/studio/DailyCreatorCenter.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PROMPT 22 — Daily Creator Center
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Today-at-a-glance dashboard for creators. Shows:
 *   - Today's earnings, sales, students, followers
 *   - Pending items (drafts, reviews, messages)
 *   - Suggested tasks (next best actions)
 *   - Active goal progress
 *   - Platform announcements + tips
 *
 * All data comes from real platform metrics — nothing invented.
 */

import React, { useEffect, useState, useCallback } from 'react';

function classNames(...parts) { return parts.filter(Boolean).join(' '); }

function fmtCurrency(n) {
  if (n == null || !Number.isFinite(Number(n))) return '$0.00';
  return `$${Number(n).toFixed(2)}`;
}

export default function DailyCreatorCenter({ lang = 'en', showToast, apiGet }) {
  const isHt = lang === 'ht';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!apiGet) return;
    setLoading(true);
    try {
      const res = await apiGet('creator-daily-center/', { params: { lang } });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [lang, apiGet]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="dcc-loading" role="status" aria-busy="true">
        <div className="dcc-skel-row" />
        <div className="dcc-skel-row" style={{ width: '70%' }} />
        <div className="dcc-skel-row" style={{ width: '40%' }} />
      </div>
    );
  }

  if (!data) return null;

  const { today_progress, pending_items, suggested_tasks, goal_progress, announcements, tips } = data;

  return (
    <div className="dcc-container">
      {/* Today's Progress */}
      <section className="dcc-section">
        <h3 className="dcc-section-title">
          <i className="fas fa-calendar-day" aria-hidden="true" />
          {isHt ? 'Jodi a' : 'Today'}
        </h3>
        <div className="dcc-stats-row">
          {today_progress?.earnings > 0 && (
            <div className="dcc-stat" data-accent="emerald">
              <i className="fas fa-dollar-sign" aria-hidden="true" />
              <span className="dcc-stat-value">{fmtCurrency(today_progress.earnings)}</span>
              <span className="dcc-stat-label">{isHt ? 'Revni' : 'Earnings'}</span>
            </div>
          )}
          {today_progress?.sales > 0 && (
            <div className="dcc-stat" data-accent="sky">
              <i className="fas fa-shopping-cart" aria-hidden="true" />
              <span className="dcc-stat-value">{today_progress.sales}</span>
              <span className="dcc-stat-label">{isHt ? 'Vant' : 'Sales'}</span>
            </div>
          )}
          {today_progress?.new_students > 0 && (
            <div className="dcc-stat" data-accent="violet">
              <i className="fas fa-user-graduate" aria-hidden="true" />
              <span className="dcc-stat-value">{today_progress.new_students}</span>
              <span className="dcc-stat-label">{isHt ? 'Nouvo Elèv' : 'New Students'}</span>
            </div>
          )}
          {today_progress?.new_followers > 0 && (
            <div className="dcc-stat" data-accent="amber">
              <i className="fas fa-user-plus" aria-hidden="true" />
              <span className="dcc-stat-value">{today_progress.new_followers}</span>
              <span className="dcc-stat-label">{isHt ? 'Nouvo Swivan' : 'New Followers'}</span>
            </div>
          )}
          {/* No activity yet */}
          {!today_progress?.earnings && !today_progress?.sales && !today_progress?.new_students && !today_progress?.new_followers && (
            <div className="dcc-no-activity">
              <i className="fas fa-coffee" aria-hidden="true" />
              <span>{isHt ? 'Pa gen aktivite jodi a — kontinye kreye!' : 'No activity yet today — keep creating!'}</span>
            </div>
          )}
        </div>
      </section>

      {/* Pending Items */}
      {(pending_items?.draft_courses > 0 || pending_items?.draft_products > 0) && (
        <section className="dcc-section">
          <h3 className="dcc-section-title">
            <i className="fas fa-clock" aria-hidden="true" />
            {isHt ? 'Annatant' : 'Pending'}
          </h3>
          <div className="dcc-pending-list">
            {pending_items.draft_courses > 0 && (
              <div className="dcc-pending-item">
                <i className="fas fa-graduation-cap" aria-hidden="true" />
                <span>
                  <strong>{pending_items.draft_courses}</strong> {' '}
                  {isHt ? 'kou nan bwouyon' : 'courses in draft'}
                </span>
              </div>
            )}
            {pending_items.draft_products > 0 && (
              <div className="dcc-pending-item">
                <i className="fas fa-cube" aria-hidden="true" />
                <span>
                  <strong>{pending_items.draft_products}</strong> {' '}
                  {isHt ? 'pwodwi nan bwouyon' : 'products in draft'}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Goal Progress */}
      {goal_progress?.length > 0 && (
        <section className="dcc-section">
          <h3 className="dcc-section-title">
            <i className="fas fa-bullseye" aria-hidden="true" />
            {isHt ? 'Objektif' : 'Goals'}
          </h3>
          <div className="dcc-goals-mini">
            {goal_progress.slice(0, 3).map((goal) => (
              <div key={goal.id} className="dcc-goal-mini">
                <div className="dcc-goal-mini-top">
                  <span className="dcc-goal-mini-title">{goal.title}</span>
                  <span className="dcc-goal-mini-pct">{goal.progress}%</span>
                </div>
                <div className="dcc-mini-bar">
                  <div
                    className="dcc-mini-bar-fill"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested Tasks */}
      {suggested_tasks?.length > 0 && (
        <section className="dcc-section">
          <h3 className="dcc-section-title">
            <i className="fas fa-lightbulb" aria-hidden="true" />
            {isHt ? 'Sijesyon' : 'Suggestions'}
          </h3>
          <div className="dcc-suggestions">
            {suggested_tasks.map((task, i) => (
              <div key={i} className="dcc-suggestion">
                <i className={`fas ${task.icon}`} aria-hidden="true" />
                <div className="dcc-suggestion-body">
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Announcements + Tips (side by side) */}
      <div className="dcc-bottom-row">
        {announcements?.length > 0 && (
          <section className="dcc-section dcc-half">
            <h3 className="dcc-section-title">
              <i className="fas fa-bullhorn" aria-hidden="true" />
              {isHt ? 'Anons' : 'Announcements'}
            </h3>
            <div className="dcc-announcements">
              {announcements.map((ann, i) => (
                <div key={i} className="dcc-announcement" data-type={ann.type}>
                  <strong>{ann.title}</strong>
                  <p>{ann.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {tips?.length > 0 && (
          <section className="dcc-section dcc-half">
            <h3 className="dcc-section-title">
              <i className="fas fa-lightbulb" aria-hidden="true" />
              {isHt ? 'Konsèy' : 'Tips'}
            </h3>
            <div className="dcc-tips">
              {tips.map((tip, i) => (
                <div key={i} className="dcc-tip">
                  <i className="fas fa-circle-info" style={{ color: 'var(--pink-primary)', marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <strong>{tip.title}</strong>
                    <p>{tip.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
