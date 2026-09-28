/**
 * TrustScoreBadge.jsx — Visual trust score indicator for Spotlight Identity.
 *
 * Displays a circular progress ring with the trust score (0-100)
 * and color-coded by level:
 *   0-30:   Red (New)
 *   31-60:  Yellow (Growing)
 *   61-80:  Blue (Trusted)
 *   81-100: Green (Verified)
 */
import React from 'react';

const TRUST_LEVELS = [
  { min: 0, max: 30, label: 'Nouvo', labelEn: 'New', color: '#ef4444', bgColor: '#fef2f2' },
  { min: 31, max: 60, label: 'Ap grandi', labelEn: 'Growing', color: '#f59e0b', bgColor: '#fffbeb' },
  { min: 61, max: 80, label: 'Fyab', labelEn: 'Trusted', color: '#3b82f6', bgColor: '#eff6ff' },
  { min: 81, max: 100, label: 'Verifye', labelEn: 'Verified', color: '#22c55e', bgColor: '#f0fdf4' },
];

function getTrustLevel(score) {
  return TRUST_LEVELS.find(l => score >= l.min && score <= l.max) || TRUST_LEVELS[0];
}

export default function TrustScoreBadge({ score = 0, size = 80, lang = 'ht' }) {
  const level = getTrustLevel(score);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={4}
          />
          {/* Progress circle */}
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
        {/* Score number */}
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
            {score}
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: level.color,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {lang === 'ht' ? level.label : level.labelEn}
      </div>
    </div>
  );
}
