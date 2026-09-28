/**
 * src/components/studio/CreatorGoals.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PROMPT 22 — Creator Goals System
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Creators define personal objectives and track progress.
 * Goals are NOT auto-generated — the creator chooses them.
 * Progress is tracked from real platform data.
 *
 * States: loading, empty, hasGoals, addGoal overlay, completed celebration.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { creatorGoalService } from '../../services/api';

const CATEGORY_ICONS = {
  creation: 'fa-lightbulb',
  revenue: 'fa-dollar-sign',
  audience: 'fa-users',
  growth: 'fa-arrow-trend-up',
  learning: 'fa-book',
  other: 'fa-bullseye',
};

const CATEGORY_COLORS = {
  creation: '#8b5cf6',
  revenue: '#10b981',
  audience: '#38bdf8',
  growth: '#f59e0b',
  learning: '#ec4899',
  other: '#94a3b8',
};

function classNames(...parts) { return parts.filter(Boolean).join(' '); }

export default function CreatorGoals({ lang = 'en', showToast }) {
  const isHt = lang === 'ht';
  const [goals, setGoals] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', category: 'other', target_value: '', unit: '' });
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, tmplRes] = await Promise.allSettled([
        creatorGoalService.list(),
        creatorGoalService.templates(lang),
      ]);
      setGoals(goalsRes.status === 'fulfilled' ? (Array.isArray(goalsRes.value.data) ? goalsRes.value.data : []) : []);
      setTemplates(tmplRes.status === 'fulfilled' ? (Array.isArray(tmplRes.value.data) ? tmplRes.value.data : []) : []);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreate = async () => {
    if (!newGoal.title.trim()) {
      showToast?.(isHt ? 'Antre yon tit objektif' : 'Enter a goal title', 'exclamation-circle');
      return;
    }
    setSaving(true);
    try {
      await creatorGoalService.create({
        title: newGoal.title,
        description: newGoal.description,
        category: newGoal.category,
        target_value: newGoal.target_value ? parseInt(newGoal.target_value, 10) : null,
        unit: newGoal.unit,
      });
      showToast?.(isHt ? 'Objektif kreye! 🎯' : 'Goal created! 🎯', 'check-circle');
      setNewGoal({ title: '', description: '', category: 'other', target_value: '', unit: '' });
      setShowAdd(false);
      fetchGoals();
    } catch {
      showToast?.(isHt ? 'Erè nan kreye objektif' : 'Error creating goal', 'exclamation-triangle');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (goalId) => {
    try {
      await creatorGoalService.complete(goalId);
      showToast?.(isHt ? 'Objektif fini! ✅' : 'Goal completed! ✅', 'trophy');
      fetchGoals();
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    }
  };

  const handleArchive = async (goalId) => {
    try {
      await creatorGoalService.archive(goalId);
      fetchGoals();
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    }
  };

  const handleTemplateClick = (tmpl) => {
    setNewGoal({
      title: tmpl.title,
      description: tmpl.description,
      category: tmpl.category,
      target_value: tmpl.target_value || '',
      unit: tmpl.unit || '',
    });
    setShowAdd(true);
  };

  const activeGoals = Array.isArray(goals) ? goals.filter(g => g.status === 'active') : [];
  const completedGoals = Array.isArray(goals) ? goals.filter(g => g.status === 'completed') : [];

  if (loading) {
    return (
      <div className="cg-loading" role="status" aria-busy="true">
        <i className="fas fa-spinner fa-spin" />
      </div>
    );
  }

  return (
    <div className="cg-container">
      {/* Header */}
      <div className="cg-header">
        <div className="cg-header-left">
          <i className="fas fa-bullseye" aria-hidden="true" />
          <h3 className="cg-title">{isHt ? 'Objektif Kreyatè' : 'Creator Goals'}</h3>
        </div>
        <button
          type="button"
          className="cg-add-btn"
          onClick={() => setShowAdd(true)}
          aria-label={isHt ? 'Ajoute objektif' : 'Add goal'}
        >
          <i className="fas fa-plus" /> {isHt ? 'Ajoute' : 'Add'}
        </button>
      </div>

      {/* No goals yet */}
      {goals && activeGoals.length === 0 && completedGoals.length === 0 && (
        <div className="cg-empty" role="status">
          <i className="fas fa-flag-checkered" aria-hidden="true" />
          <h4>{isHt ? 'Pa gen objektif ankò' : 'No goals yet'}</h4>
          <p>{isHt ? 'Mete objektif pou swiv vwayaj kreyatè ou.' : 'Set goals to track your creator journey.'}</p>
          <div className="cg-templates">
            <span className="cg-templates-label">{isHt ? 'Sijesyon:' : 'Suggestions:'}</span>
            <div className="cg-template-chips">
              {templates.slice(0, 4).map((tmpl, i) => (
                <button
                  key={i}
                  type="button"
                  className="cg-template-chip"
                  onClick={() => handleTemplateClick(tmpl)}
                >
                  <i className="fas fa-plus-circle" aria-hidden="true" /> {tmpl.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="cg-goals-list">
          {activeGoals.map((goal) => (
            <div key={goal.id} className="cg-goal-card" data-category={goal.category}>
              <div className="cg-goal-top">
                <div className="cg-goal-info">
                  <div className="cg-goal-category" style={{ color: CATEGORY_COLORS[goal.category] || '#94a3b8' }}>
                    <i className={`fas ${CATEGORY_ICONS[goal.category] || 'fa-bullseye'}`} aria-hidden="true" />
                    <span>{goal.category}</span>
                  </div>
                  <h4 className="cg-goal-title">{goal.title}</h4>
                </div>
                <div className="cg-goal-actions">
                  <button
                    type="button"
                    className="cg-goal-complete-btn"
                    onClick={() => handleComplete(goal.id)}
                    title={isHt ? 'Fini' : 'Complete'}
                    aria-label={isHt ? 'Fini objektif' : 'Complete goal'}
                  >
                    <i className="fas fa-check" />
                  </button>
                </div>
              </div>

              {goal.target_value != null && (
                <div className="cg-goal-progress">
                  <div className="cg-goal-progress-bar">
                    <div
                      className="cg-goal-progress-fill"
                      style={{
                        width: `${Math.min(100, goal.progress_pct || 0)}%`,
                        backgroundColor: CATEGORY_COLORS[goal.category] || '#8b5cf6',
                      }}
                    />
                  </div>
                  <span className="cg-goal-progress-text">
                    {goal.current_value || 0}/{goal.target_value} {goal.unit || ''}
                    {' '}({goal.progress_pct || 0}%)
                  </span>
                </div>
              )}

              {goal.description && (
                <p className="cg-goal-desc">{goal.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <details className="cg-completed-section">
          <summary className="cg-completed-toggle">
            <i className="fas fa-trophy" aria-hidden="true" style={{ color: '#f59e0b' }} />
            <span>{isHt ? 'Objektif Fini' : 'Completed Goals'} ({completedGoals.length})</span>
            <i className="fas fa-chevron-down" aria-hidden="true" />
          </summary>
          <div className="cg-completed-list">
            {completedGoals.map((goal) => (
              <div key={goal.id} className="cg-completed-item">
                <div className="cg-completed-info">
                  <i className="fas fa-circle-check" style={{ color: '#10b981' }} aria-hidden="true" />
                  <span>{goal.title}</span>
                </div>
                <button
                  type="button"
                  className="cg-archive-btn"
                  onClick={() => handleArchive(goal.id)}
                  title={isHt ? 'Archive' : 'Archive'}
                >
                  <i className="fas fa-box-archive" />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add Goal Overlay */}
      {showAdd && (
        <div className="cg-overlay" role="dialog" aria-modal="true" aria-label={isHt ? 'Ajoute objektif' : 'Add goal'}>
          <div className="cg-overlay-card">
            <div className="cg-overlay-header">
              <h3>{isHt ? 'Nouvo Objektif' : 'New Goal'}</h3>
              <button
                type="button"
                className="cg-overlay-close"
                onClick={() => setShowAdd(false)}
                aria-label={isHt ? 'Fèmen' : 'Close'}
              >
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="cg-overlay-body">
              <label className="cg-field">
                <span>{isHt ? 'Tit' : 'Title'} *</span>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(p => ({ ...p, title: e.target.value }))}
                  placeholder={isHt ? 'Egzanp: Rive jwenn 100 elèv' : 'e.g., Reach 100 students'}
                  className="cg-input"
                />
              </label>
              <label className="cg-field">
                <span>{isHt ? 'Deskripsyon' : 'Description'}</span>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(p => ({ ...p, description: e.target.value }))}
                  placeholder={isHt ? 'Plis detay...' : 'More details...'}
                  className="cg-input cg-textarea"
                  rows={2}
                />
              </label>
              <div className="cg-field-row">
                <label className="cg-field">
                  <span>{isHt ? 'Kategori' : 'Category'}</span>
                  <select
                    value={newGoal.category}
                    onChange={(e) => setNewGoal(p => ({ ...p, category: e.target.value }))}
                    className="cg-input"
                  >
                    <option value="creation">{isHt ? 'Kreyasyon' : 'Creation'}</option>
                    <option value="revenue">{isHt ? 'Revni' : 'Revenue'}</option>
                    <option value="audience">{isHt ? 'Odyans' : 'Audience'}</option>
                    <option value="growth">{isHt ? 'Kwasans' : 'Growth'}</option>
                    <option value="learning">{isHt ? 'Aprantisaj' : 'Learning'}</option>
                    <option value="other">{isHt ? 'Lòt' : 'Other'}</option>
                  </select>
                </label>
                <label className="cg-field">
                  <span>{isHt ? 'Sib (si genyen)' : 'Target (optional)'}</span>
                  <input
                    type="number"
                    value={newGoal.target_value}
                    onChange={(e) => setNewGoal(p => ({ ...p, target_value: e.target.value }))}
                    placeholder="100"
                    className="cg-input"
                    min="1"
                  />
                </label>
              </div>
              <label className="cg-field">
                <span>{isHt ? 'Inite' : 'Unit'} ({isHt ? 'si gen sib' : 'if target set'})</span>
                <input
                  type="text"
                  value={newGoal.unit}
                  onChange={(e) => setNewGoal(p => ({ ...p, unit: e.target.value }))}
                  placeholder={isHt ? 'elèv, kou, USD' : 'students, courses, USD'}
                  className="cg-input"
                />
              </label>

              {/* Templates */}
              {templates.length > 0 && (
                <div className="cg-templates-inline">
                  <span className="cg-templates-label">{isHt ? 'Oswa chwazi yon sijesyon:' : 'Or pick a suggestion:'}</span>
                  <div className="cg-template-chips">
                    {templates.slice(0, 6).map((tmpl, i) => (
                      <button
                        key={i}
                        type="button"
                        className="cg-template-chip"
                        onClick={() => handleTemplateClick(tmpl)}
                      >
                        {tmpl.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="cg-overlay-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
                {isHt ? 'Anile' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={saving || !newGoal.title.trim()}
              >
                {saving ? (
                  <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap kreye...' : 'Creating...'}</>
                ) : (
                  <><i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Kreye Objektif' : 'Create Goal'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
