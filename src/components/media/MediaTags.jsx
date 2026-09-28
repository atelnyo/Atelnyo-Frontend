/**
 * MediaTags — Antre etikèt pou medya yo.
 *
 * Chak medya kapab genyen:
 *   - Tags
 *   - Labels
 *   - Color
 *   - Priority
 *   - Favorite
 *   - Archived
 *   - Verified
 *   - AI Generated
 *   - Official
 *   - Premium
 *   - Reusable
 *
 * Sa ede Search pi rapid.
 */
import React, { useState } from 'react';

const PRESET_TAGS = [
  { id: 'favorite', icon: 'fa-star', labelEn: 'Favorite', labelHt: 'Favori', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  { id: 'verified', icon: 'fa-check-circle', labelEn: 'Verified', labelHt: 'Verifye', color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  { id: 'ai_generated', icon: 'fa-robot', labelEn: 'AI Generated', labelHt: 'AI Jenere', color: 'var(--pr-color-violet-500, #8b5cf6)', bg: 'var(--pr-color-violet-500-bg, rgba(139,92,246,0.08))' },
  { id: 'official', icon: 'fa-certificate', labelEn: 'Official', labelHt: 'Ofisyèl', color: 'var(--state-info, #38bdf8)', bg: 'var(--state-info-bg, rgba(56,189,248,0.08))' },
  { id: 'premium', icon: 'fa-crown', labelEn: 'Premium', labelHt: 'Premium', color: 'var(--state-warning, #f59e0b)', bg: 'var(--severity-medium-bg, rgba(245,158,11,0.08))' },
  { id: 'reusable', icon: 'fa-recycle', labelEn: 'Reusable', labelHt: 'Reitilize', color: 'var(--state-success, #10b981)', bg: 'var(--severity-low-bg, rgba(16,185,129,0.08))' },
  { id: 'archived', icon: 'fa-archive', labelEn: 'Archived', labelHt: 'Achive', color: 'var(--text-secondary, #64748b)', bg: 'var(--state-neutral-bg, rgba(100,116,139,0.08))' },
];

const PRIORITY_OPTIONS = [
  { value: '', labelEn: 'No priority', labelHt: 'Pa gen priyorite', color: 'var(--text-secondary, #94a3b8)' },
  { value: 'low', labelEn: 'Low', labelHt: 'Ba', color: 'var(--state-info, #38bdf8)' },
  { value: 'medium', labelEn: 'Medium', labelHt: 'Mwayen', color: 'var(--state-warning, #f59e0b)' },
  { value: 'high', labelEn: 'High', labelHt: 'Wo', color: 'var(--state-error, #ef4444)' },
];

export default function MediaTags({
  tags = [],
  customLabels = [],
  priority = '',
  onChange,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [newLabel, setNewLabel] = useState('');

  const activeTags = new Set(tags);

  const handleTogglePreset = (tagId) => {
    const next = new Set(activeTags);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    onChange?.({ tags: [...next], customLabels, priority });
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    const next = [...customLabels, newLabel.trim()];
    onChange?.({ tags: [...tags], customLabels: next, priority });
    setNewLabel('');
  };

  const handleRemoveLabel = (index) => {
    const next = customLabels.filter((_, i) => i !== index);
    onChange?.({ tags: [...tags], customLabels: next, priority });
  };

  const handlePriorityChange = (value) => {
    onChange?.({ tags: [...tags], customLabels, priority: value });
  };

  return (
    <div className={`media-tags ${className}`}>
      {/* Preset Tags */}
      <div className="media-tags-presets">
        {PRESET_TAGS.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`media-tags-preset-btn ${activeTags.has(tag.id) ? 'media-tags-preset-active' : ''}`}
            onClick={() => handleTogglePreset(tag.id)}
            style={activeTags.has(tag.id) ? { borderColor: tag.color, color: tag.color, background: tag.bg } : undefined}
          >
            <i className={`fas ${tag.icon}`} />
            {isHt ? tag.labelHt : tag.labelEn}
          </button>
        ))}
      </div>

      {/* Priority */}
      <div className="media-tags-priority">
        <span className="media-tags-priority-label">
          <i className="fas fa-flag" />
          {isHt ? 'Priyorite' : 'Priority'}
        </span>
        <div className="media-tags-priority-options">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`media-tags-priority-btn ${priority === opt.value ? 'media-tags-priority-active' : ''}`}
              onClick={() => handlePriorityChange(opt.value)}
              style={priority === opt.value ? { borderColor: opt.color, color: opt.color } : undefined}
            >
              {isHt ? opt.labelHt : opt.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Labels */}
      {customLabels.length > 0 && (
        <div className="media-tags-custom">
          <span className="media-tags-custom-label">
            <i className="fas fa-tag" />
            {isHt ? 'Etikèt' : 'Labels'}
          </span>
          <div className="media-tags-custom-list">
            {customLabels.map((label, i) => (
              <span key={i} className="media-tags-custom-item">
                {label}
                <button
                  type="button"
                  className="media-tags-custom-remove"
                  onClick={() => handleRemoveLabel(i)}
                  aria-label={isHt ? 'Retire' : 'Remove'}
                >
                  <i className="fas fa-times" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add label */}
      <div className="media-tags-add">
        <input
          type="text"
          className="field-input"
          placeholder={isHt ? 'Ajoute yon etikèt...' : 'Add a label...'}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddLabel(); }}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={handleAddLabel}
          disabled={!newLabel.trim()}
        >
          <i className="fas fa-plus" />
        </button>
      </div>
    </div>
  );
}
