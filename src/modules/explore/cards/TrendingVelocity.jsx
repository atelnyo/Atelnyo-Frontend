/**
 * src/modules/explore/cards/TrendingVelocity.jsx
 *
 * Visual indicator showing how fast content is trending/rising.
 * Renders a small badge with:
 *   - Arrow icon (up/down/steady)
 *   - Trending score (0-100)
 *   - Velocity label (e.g. "Viral", "Rising", "Hot")
 *
 * Props:
 *   score   — trending_score from RecommendationScore (0-100)
 *   lang    — 'ht' | 'en' | 'fr' etc.
 *   size    — 'sm' | 'md' (default: 'sm')
 *   showLabel — show text label (default: false for compact cards)
 */
import React from 'react';

// Velocity tiers with colors and labels
const VELOCITY_TIERS = [
  { min: 80, label: { ht: 'Viral', en: 'Viral', fr: 'Viral' }, icon: 'fa-rocket', color: '#ef4444', bgColor: 'rgba(239,68,68,0.12)' },
  { min: 60, label: { ht: 'Trè cho', en: 'Very Hot', fr: 'Très chaud' }, icon: 'fa-fire', color: '#f97316', bgColor: 'rgba(249,115,22,0.12)' },
  { min: 40, label: { ht: 'Cho', en: 'Hot', fr: 'Chaud' }, icon: 'fa-fire', color: '#eab308', bgColor: 'rgba(234,179,8,0.12)' },
  { min: 20, label: { ht: 'Ap monte', en: 'Rising', fr: 'En hausse' }, icon: 'fa-arrow-trend-up', color: '#22c55e', bgColor: 'rgba(34,197,94,0.12)' },
  { min: 5, label: { ht: 'Popilè', en: 'Popular', fr: 'Populaire' }, icon: 'fa-chart-line', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.12)' },
  { min: 0, label: { ht: '', en: '', fr: '' }, icon: '', color: '', bgColor: '' },
];

function getVelocityTier(score) {
  const numScore = Number(score) || 0;
  for (const tier of VELOCITY_TIERS) {
    if (numScore >= tier.min) return { ...tier, score: numScore };
  }
  return { min: 0, label: {}, icon: '', color: '', bgColor: '', score: 0 };
}

export default function TrendingVelocity({ score, lang = 'ht', size = 'sm', showLabel = false }) {
  const numScore = Number(score) || 0;
  if (numScore <= 0) return null;

  const tier = getVelocityTier(numScore);
  if (!tier.icon) return null;

  const label = tier.label[lang] || tier.label.en || '';

  // Compact mode (default) — just the icon + score
  // Expanded mode — icon + score + label
  return (
    <div
      className={`trending-velocity trending-velocity--${size}`}
      style={{
        '--tv-color': tier.color,
        '--tv-bg': tier.bgColor,
      }}
      title={`${label}: ${Math.round(numScore)}`}
      aria-label={`Trending velocity: ${label} ${Math.round(numScore)}`}
    >
      <i className={`fas ${tier.icon} trending-velocity-icon`} aria-hidden="true" />
      <span className="trending-velocity-score">{Math.round(numScore)}</span>
      {showLabel && label && (
        <span className="trending-velocity-label">{label}</span>
      )}
    </div>
  );
}

/**
 * Mini sparkline for velocity trend (optional — renders a tiny inline chart).
 * Used in detail sheets, not on cards (too small).
 */
export function VelocitySparkline({ score, history, lang = 'ht', width = 60, height = 20 }) {
  const numScore = Number(score) || 0;
  if (numScore <= 0 || !history?.length) return null;

  // Simple sparkline: just show the trend direction
  const max = Math.max(...history, 1);
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');

  const tier = getVelocityTier(numScore);

  return (
    <div className="velocity-sparkline" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          points={points}
          fill="none"
          stroke={tier.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
