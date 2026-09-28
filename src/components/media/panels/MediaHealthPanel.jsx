/**
 * MediaHealthPanel — Health tab content (Slice 0 retro).
 *
 * Shows health score ring + 3 mini stats. Pure-read; no actions.
 * Self-contained so it can be embedded in the Entity Page Section
 * "Health" without depending on MediaInspector.
 */
import React from 'react';

function StatBox({ icon, label, value, color }) {
  return (
    <div className="inspector-stat-box" style={{ '--stat-color': color || '#ec4899' }}>
      <div className="inspector-stat-icon"><i className={`fas ${icon}`} /></div>
      <div className="inspector-stat-body">
        <div className="inspector-stat-value">{value ?? '—'}</div>
        <div className="inspector-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function MediaHealthPanel({ media, lang = 'ht' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const healthScore = item.health_score ?? item.score ?? null;
  const validationHistory = Array.isArray(item.validation_history) ? item.validation_history : [];

  return (
    <div className="media-panel media-panel-health">
      <div className="inspector-health-score">
        <div className="inspector-score-ring">
          <svg viewBox="0 0 120 120" className="inspector-score-svg" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none"
              stroke="rgba(216,27,96,0.08)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none"
              stroke={healthScore == null ? '#cbd5e1' : healthScore >= 80 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8"
              strokeDasharray={`${(healthScore || 0) * 3.27} 327`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
              fill="var(--text-main, #222)" fontSize="1.6rem" fontWeight="700">
              {healthScore == null ? '?' : `${healthScore}%`}
            </text>
          </svg>
        </div>
        <div className="inspector-score-stats">
          <StatBox
            icon="fa-tachometer-alt"
            label={isHt ? 'Latansi' : 'Latency'}
            value={item.response_time_ms != null ? `${item.response_time_ms}ms` : '—'}
            color="#38bdf8"
          />
          <StatBox
            icon="fa-chart-bar"
            label={isHt ? 'Disponibilite' : 'Uptime'}
            value={item.is_valid ? '100%' : (healthScore != null ? `${healthScore}%` : '—')}
            color="#10b981"
          />
          <StatBox
            icon="fa-redo"
            label={isHt ? 'Validasyon' : 'Validations'}
            value={String(validationHistory.length)}
            color="#8b5cf6"
          />
          <StatBox
            icon="fa-shield-alt"
            label={isHt ? 'Sekirite' : 'Security Score'}
            value={item.security_score != null ? `${item.security_score}%` : '—'}
            color="#0ea5e9"
          />
        </div>
      </div>
    </div>
  );
}
