/**
 * src/components/AlgorithmTransparency.jsx
 *
 * Algorithm Transparency / Explainability component.
 * Shows users WHY content was recommended to them, building trust
 * and giving them control over their feed.
 *
 * Features:
 *   - Shows recommendation reasons (interest match, trending, etc.)
 *   - Shows score breakdown
 *   - Allows users to provide feedback
 *   - Explains privacy/data usage
 */
import React, { useState } from 'react';

const REASON_LABELS = {
  ht: {
    interest_match: 'intéérè ou matche ak kontni sa a',
    trending: 'kontni sa a ap monte vit',
    popular: 'kontni sa a popilè',
    new_content: 'kontni sa a nouvo',
    creator_follow: 'ou swiv kreyatè sa a',
    category_match: 'kategorii ou matche',
    local_content: 'kontni lokal pou ou',
    exploration: 'nouvo dekouvèt pou ou',
    quality: 'kontni sa a gen bon jan kalite',
    fresh: 'kontni sa a fraîch',
  },
  en: {
    interest_match: 'matches your interests',
    trending: 'is trending right now',
    popular: 'is popular with others',
    new_content: 'is new content',
    creator_follow: 'from a creator you follow',
    category_match: 'matches your category preferences',
    local_content: 'is relevant to your location',
    exploration: 'a new discovery for you',
    quality: 'is high quality content',
    fresh: 'is freshly published',
  },
  fr: {
    interest_match: 'correspond à vos centres d\'intérêt',
    trending: 'est en tendance',
    popular: 'est populaire',
    new_content: 'est un nouveau contenu',
    creator_follow: 'd\'un créateur que vous suivez',
    category_match: 'correspond à vos catégories',
    local_content: 'est pertinent pour votre région',
    exploration: 'une nouvelle découverte',
    quality: 'est de haute qualité',
    fresh: 'est fraîchement publié',
  },
};

const REASON_ICONS = {
  interest_match: 'fa-heart',
  trending: 'fa-chart-line',
  popular: 'fa-fire',
  new_content: 'fa-sparkles',
  creator_follow: 'fa-user-check',
  category_match: 'fa-tag',
  local_content: 'fa-map-marker-alt',
  exploration: 'fa-compass',
  quality: 'fa-star',
  fresh: 'fa-clock',
};

function ScoreBreakdown({ item, lang = 'ht' }) {
  const scores = item?._score;
  if (!scores) return null;

  const maxScore = Math.max(
    scores.trending || 0,
    scores.popularity || 0,
    scores.engagement || 0,
    scores.quality || 0,
    1
  );

  return (
    <div className="at-score-breakdown">
      <h4>{lang === 'ht' ? 'Detay Nòt' : 'Score Breakdown'}</h4>
      <div className="at-bars">
        {scores.trending > 0 && (
          <div className="at-bar-row">
            <span className="at-bar-label">
              <i className="fas fa-chart-line" /> Trending
            </span>
            <div className="at-bar-track">
              <div
                className="at-bar-fill at-bar-trending"
                style={{ width: `${(scores.trending / 100) * 100}%` }}
              />
            </div>
            <span className="at-bar-value">{Math.round(scores.trending)}</span>
          </div>
        )}
        {scores.popularity > 0 && (
          <div className="at-bar-row">
            <span className="at-bar-label">
              <i className="fas fa-fire" /> Popularity
            </span>
            <div className="at-bar-track">
              <div
                className="at-bar-fill at-bar-popularity"
                style={{ width: `${(scores.popularity / 100) * 100}%` }}
              />
            </div>
            <span className="at-bar-value">{Math.round(scores.popularity)}</span>
          </div>
        )}
        {scores.engagement > 0 && (
          <div className="at-bar-row">
            <span className="at-bar-label">
              <i className="fas fa-mouse-pointer" /> Engagement
            </span>
            <div className="at-bar-track">
              <div
                className="at-bar-fill at-bar-engagement"
                style={{ width: `${(scores.engagement / 100) * 100}%` }}
              />
            </div>
            <span className="at-bar-value">{Math.round(scores.engagement)}</span>
          </div>
        )}
        {scores.quality > 0 && (
          <div className="at-bar-row">
            <span className="at-bar-label">
              <i className="fas fa-star" /> Quality
            </span>
            <div className="at-bar-track">
              <div
                className="at-bar-fill at-bar-quality"
                style={{ width: `${(scores.quality / 100) * 100}%` }}
              />
            </div>
            <span className="at-bar-value">{Math.round(scores.quality)}</span>
          </div>
        )}
        {scores.freshness > 0 && (
          <div className="at-bar-row">
            <span className="at-bar-label">
              <i className="fas fa-clock" /> Freshness
            </span>
            <div className="at-bar-track">
              <div
                className="at-bar-fill at-bar-freshness"
                style={{ width: `${(scores.freshness / 10) * 100}%` }}
              />
            </div>
            <span className="at-bar-value">{Math.round(scores.freshness)}</span>
          </div>
        )}
      </div>
      {scores.composite > 0 && (
        <div className="at-total">
          <span>Total:</span>
          <strong>{Math.round(scores.composite)}</strong>
        </div>
      )}
    </div>
  );
}

export default function AlgorithmTransparency({ item, lang = 'ht', onFeedback, onClose }) {
  const [showDetails, setShowDetails] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const t = REASON_LABELS[lang] || REASON_LABELS.en;

  // Extract reasons from item metadata
  const reasons = item?._reasons || [];
  const novelty = item?._novelty;
  const relevance = item?._relevance;
  const affinity = item?._affinity_bonus;
  const bucket = item?._bucket;

  const handleFeedback = (type) => {
    onFeedback?.(item, type);
    setFeedbackGiven(true);
  };

  return (
    <div className="at-container">
      {/* Why this was shown */}
      <div className="at-reasons">
        <div className="at-reasons-header">
          <i className="fas fa-lightbulb" />
          <span>{lang === 'ht' ? 'Poukisa ou wè sa?' : 'Why am I seeing this?'}</span>
        </div>

        <div className="at-reasons-list">
          {reasons.map((reason, idx) => (
            <div key={idx} className="at-reason">
              <i className={`fas ${REASON_ICONS[reason] || 'fa-info-circle'}`} />
              <span>{t[reason] || reason}</span>
            </div>
          ))}

          {relevance > 0 && (
            <div className="at-reason">
              <i className="fas fa-crosshairs" />
              <span>{lang === 'ht' ? 'Relevance' : 'Relevance'}: {Math.round(relevance * 100)}%</span>
            </div>
          )}

          {affinity > 0 && (
            <div className="at-reason">
              <i className="fas fa-heart" />
              <span>{lang === 'ht' ? 'Affinitè' : 'Affinity'}: +{Math.round(affinity)}</span>
            </div>
          )}

          {bucket && (
            <div className="at-reason at-reason-tag">
              <i className="fas fa-tag" />
              <span>{bucket}</span>
            </div>
          )}
        </div>
      </div>

      {/* Score Breakdown (expandable) */}
      <button
        className="at-toggle-details"
        onClick={() => setShowDetails(!showDetails)}
      >
        <i className={`fas fa-chevron-${showDetails ? 'up' : 'down'}`} />
        {lang === 'ht' ? 'Detay Nòt' : 'Score Details'}
      </button>

      {showDetails && (
        <ScoreBreakdown item={item} lang={lang} />
      )}

      {/* Feedback */}
      {!feedbackGiven ? (
        <div className="at-feedback">
          <span className="at-feedback-label">
            {lang === 'ht' ? 'Èske sa itil?' : 'Was this helpful?'}
          </span>
          <button
            className="at-feedback-btn at-feedback-yes"
            onClick={() => handleFeedback('helpful')}
            title={lang === 'ht' ? 'Wi, sa itil' : 'Yes, helpful'}
          >
            <i className="fas fa-thumbs-up" />
          </button>
          <button
            className="at-feedback-btn at-feedback-no"
            onClick={() => handleFeedback('not_helpful')}
            title={lang === 'ht' ? 'Non, pa itil' : 'No, not helpful'}
          >
            <i className="fas fa-thumbs-down" />
          </button>
          <button
            className="at-feedback-btn at-feedback-dismiss"
            onClick={() => handleFeedback('not_interested')}
            title={lang === 'ht' ? 'Pa enterese' : 'Not interested'}
          >
            <i className="fas fa-eye-slash" />
          </button>
        </div>
      ) : (
        <div className="at-feedback-thanks">
          <i className="fas fa-check-circle" />
          {lang === 'ht' ? 'Mèsi pou fidbak ou!' : 'Thanks for your feedback!'}
        </div>
      )}

      {/* Privacy Note */}
      <div className="at-privacy">
        <i className="fas fa-shield-alt" />
        <span>
          {lang === 'ht'
            ? 'Algoritm la itilize enterè ou, kote, ak istwa pou pèsonalize feed ou. Ou ka modifye sa nan Settings.'
            : 'The algorithm uses your interests, location, and history to personalize your feed. You can change this in Settings.'}
        </span>
      </div>
    </div>
  );
}
