/**
 * TrustScoreBadge.jsx — Visual trust score indicator for Spotlight Identity.
 *
 * Displays a circular progress ring with the trust score (0-100)
 * and color-coded by level:
 *   0-30:   Red (New)
 *   31-60:  Yellow (Growing)
 *   61-80:  Blue (Trusted)
 *   81-100: Green (Verified)
 *
 * The ring is decoration; the score + level are announced through a
 * single role="img" label. Ring colours come from tokens so light and
 * dark themes both keep the track visible.
 */
import React from 'react';

const TRUST_LEVELS = [
  { min: 0, max: 30, labels: { ht: 'Nouvo', en: 'New', fr: 'Nouveau', es: 'Nuevo' }, color: '#ef4444' },
  { min: 31, max: 60, labels: { ht: 'Ap grandi', en: 'Growing', fr: 'En croissance', es: 'Creciendo' }, color: '#f59e0b' },
  { min: 61, max: 80, labels: { ht: 'Fyab', en: 'Trusted', fr: 'Fiable', es: 'Confiable' }, color: '#3b82f6' },
  { min: 81, max: 100, labels: { ht: 'Verifye', en: 'Verified', fr: 'Vérifié', es: 'Verificado' }, color: '#22c55e' },
];

function getTrustLevel(score) {
  return TRUST_LEVELS.find((l) => score >= l.min && score <= l.max) || TRUST_LEVELS[0];
}

export default function TrustScoreBadge({ score = 0, size = 80, lang = 'en' }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const level = getTrustLevel(safeScore);
  const label = level.labels[lang] || level.labels.en;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (safeScore / 100) * circumference;

  return (
    <div
      role="img"
      aria-label={`${safeScore} / 100 · ${label}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }} aria-hidden="true">
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-color, #e5e7eb)"
            strokeWidth={4}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={level.color}
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: size * 0.25,
            fontWeight: 700,
            color: level.color,
            lineHeight: 1,
          }}>
            {safeScore}
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: level.color,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
    </div>
  );
}
