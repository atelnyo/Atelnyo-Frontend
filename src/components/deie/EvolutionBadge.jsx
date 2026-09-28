/**
 * EvolutionBadge — Displays the user's DEIE evolution score and tier.
 *
 * Shows a visual badge with:
 * - Evolution score number
 * - Tier label (Seed, Sprout, Growing, Strong, Established, Evolution Master)
 * - Progress toward next tier
 */
import React, { useEffect, useState } from 'react';
import { getMyEvolutionScore, recalculateEvolution } from '../../services/deie';

const TIER_CONFIG = {
  seed: { icon: 'fa-seedling', color: '#4caf50', min: 0, max: 100 },
  sprout: { icon: 'fa-leaf', color: '#8bc34a', min: 101, max: 250 },
  growing: { icon: 'fa-tree', color: '#ff9800', min: 251, max: 500 },
  strong: { icon: 'fa-mountain', color: '#2196f3', min: 501, max: 750 },
  established: { icon: 'fa-crown', color: '#9c27b0', min: 751, max: 950 },
  evolution_master: { icon: 'fa-gem', color: '#ffd700', min: 951, max: 1000 },
};

export default function EvolutionBadge({ lang = 'ht', showDetails = true, onRefresh }) {
  const isHt = lang === 'ht';
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadScore();
  }, []);

  const loadScore = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyEvolutionScore();
      setScore(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await recalculateEvolution();
      await loadScore();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="evo-badge evo-loading"><i className="fas fa-spinner fa-spin" /></div>;
  }

  if (error) {
    return (
      <div className="evo-badge evo-error">
        <i className="fas fa-exclamation-circle" />
        <button className="evo-retry-btn" onClick={loadScore}>
          {isHt ? 'Rekòmanse' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!score) return null;

  const tier = score.tier || 'seed';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.seed;
  const total = score.total || 0;
  const minTier = config.min;
  const maxTier = config.max;
  const progress = Math.min(100, ((total - minTier) / (maxTier - minTier)) * 100);

  return (
    <div className="evo-badge" style={{ '--evo-color': config.color }}>
      <div className="evo-badge-icon">
        <i className={`fas ${config.icon}`} style={{ color: config.color }} />
      </div>

      <div className="evo-badge-info">
        <div className="evo-score-number">
          {Math.round(total)}
          <span className="evo-score-label">
            {isHt ? 'nòt evolisyon' : 'evolution score'}
          </span>
        </div>

        <div className="evo-tier-label" style={{ color: config.color }}>
          {score.tier_label || (isHt ? 'Grenn' : 'Seed')}
        </div>

        {showDetails && (
          <>
            <div className="evo-progress-bar">
              <div className="evo-progress-fill" style={{ width: `${Math.max(2, progress)}%` }} />
            </div>

            <div className="evo-components">
              {score.components && Object.entries(score.components).slice(0, 3).map(([key, val]) => (
                <div key={key} className="evo-component">
                  <span className="evo-component-label">
                    {isHt ? getHtComponent(key) : key.replace('_', ' ')}
                  </span>
                  <span className="evo-component-value">{Math.round(val)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <button className="evo-refresh-btn" onClick={handleRefresh} disabled={refreshing}
              title={isHt ? 'Mete ajou' : 'Refresh score'}>
        <i className={`fas ${refreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} />
      </button>
    </div>
  );
}

function getHtComponent(key) {
  const map = {
    learning_growth: 'Aprantisaj',
    creation_growth: 'Kreyasyon',
    community_contribution: 'Kominote',
    professional_development: 'Pwofesyonèl',
    positive_impact: 'Enpak',
  };
  return map[key] || key;
}
