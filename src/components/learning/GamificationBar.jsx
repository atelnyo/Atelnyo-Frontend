/**
 * src/components/learning/GamificationBar.jsx — Duolingo-style header
 * chips for the learner surfaces.
 *
 *   🔥 streak      — consecutive days of learning (the flame).
 *   ⭐ XP + level  — cumulative XP with a mini progress bar to the
 *                    next level.
 *   ❤ hearts      — limited mistakes; a refill button appears when 0.
 *   🎯 daily goal  — SVG ring of today's XP toward the learner-chosen
 *                    goal; click to pick a new goal (10/20/30/50).
 *
 * Pure presentational: receives the stats payload + callbacks. Renders
 * nothing when stats aren't loaded yet.
 */
import React, { useState } from 'react';

const GOAL_OPTIONS = [10, 20, 30, 50];

export default function GamificationBar({
  stats, lang = 'ht', onRefillHearts, onUpdateGoal, compact = false,
}) {
  const isHt = lang === 'ht';
  const [goalOpen, setGoalOpen] = useState(false);
  if (!stats) return null;

  const hearts = Number(stats.hearts) || 0;
  const heartsMax = Number(stats.hearts_max) || 5;
  const goal = Number(stats.daily_goal) || 20;
  const dailyXp = Number(stats.daily_xp) || 0;
  const goalPct = Math.min(100, Math.round((dailyXp / goal) * 100));
  const ringR = 15;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className={`gami-bar${compact ? ' gami-bar--compact' : ''}`}>
      {/* ─── Daily streak (flame) ─────────────────────────────── */}
      <div
        className={`gami-chip gami-streak${Number(stats.daily_streak) > 0 ? ' is-lit' : ''}`}
        title={isHt ? 'Jou konsekitif aprantisaj' : 'Consecutive days of learning'}
      >
        <i className="fas fa-fire" aria-hidden="true" />
        <strong>{Number(stats.daily_streak) || 0}</strong>
      </div>

      {/* ─── XP + level ───────────────────────────────────────── */}
      <div
        className="gami-chip gami-xp"
        title={isHt ? 'Pwen eksperyans' : 'Experience points'}
      >
        <span className="gami-level-badge" aria-hidden="true">{Number(stats.level) || 1}</span>
        <span className="gami-xp-text">
          <strong>{Number(stats.xp) || 0} XP</strong>
          <span className="gami-xp-bar">
            <span
              className="gami-xp-fill"
              style={{ width: `${Math.min(100, Number(stats.level_progress_pct) || 0)}%` }}
            />
          </span>
        </span>
      </div>

      {/* ─── Hearts ───────────────────────────────────────────── */}
      <div
        className={`gami-chip gami-hearts${hearts === 0 ? ' is-empty' : ''}`}
        title={isHt ? 'Kè — erè ki rete' : 'Hearts — mistakes left'}
      >
        {Array.from({ length: heartsMax }, (_, i) => (
          <i
            key={i}
            className={`fas fa-heart ${i < hearts ? 'is-full' : 'is-lost'}`}
            aria-hidden="true"
          />
        ))}
        {hearts === 0 && (
          <button
            type="button"
            className="gami-refill-btn"
            onClick={onRefillHearts}
            title={isHt ? 'Ranpli kè yo' : 'Refill hearts'}
          >
            <i className="fas fa-plus" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ─── Daily goal ring ──────────────────────────────────── */}
      {!compact && (
        <div className={`gami-chip gami-goal${goalOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="gami-goal-ring"
            onClick={() => setGoalOpen((o) => !o)}
            aria-expanded={goalOpen}
            aria-label={isHt ? `Objektif jodi a: ${dailyXp} sou ${goal} XP` : `Today's goal: ${dailyXp} of ${goal} XP`}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
              <circle className="gami-ring-bg" cx="20" cy="20" r={ringR} />
              <circle
                className="gami-ring-fill"
                cx="20" cy="20" r={ringR}
                strokeDasharray={ringC}
                strokeDashoffset={ringC - (ringC * goalPct) / 100}
              />
              <text x="20" y="23" textAnchor="middle" className="gami-ring-text">
                {goalPct}%
              </text>
            </svg>
            <span className="gami-goal-label">
              <strong>{dailyXp}/{goal}</strong>
              <em>{isHt ? 'XP jodi a' : 'XP today'}</em>
            </span>
          </button>
          {goalOpen && (
            <div className="gami-goal-menu">
              <p>{isHt ? 'Objektif chak jou' : 'Daily goal'}</p>
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={g === goal ? 'is-active' : ''}
                  onClick={() => {
                    onUpdateGoal?.(g);
                    setGoalOpen(false);
                  }}
                >
                  {g} XP {g === goal && <i className="fas fa-check" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
