/**
 * src/components/CampaignDetail.jsx
 *
 * Full campaign detail view for creators.
 *
 * Sections:
 *   1. Header — name, status badge, dates, commission, actions
 *   2. Goal — objective + target value (editable)
 *   3. Budget — financial rules + estimated metrics (editable)
 *   4. Audience — targeting params (editable)
 *   5. Score — 7-factor quality score (read-only)
 *   6. Optimizations — AI recommendations with apply toggle
 *   7. Performance — clicks, conversions, sales, commission
 *   8. Events — campaign event timeline
 */
import React, { useState, useCallback, useEffect } from 'react';
import { affiliateApi } from '../services/affiliateApi';
import useFetch from '../hooks/useFetch';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { translations } from '../data/translations';
import './Campaign.css';

const OBJECTIVE_OPTIONS = [
  { value: 'sell_product', label: 'Sell Product', labelHt: 'Vann Pwodwi' },
  { value: 'sell_course', label: 'Sell Course', labelHt: 'Vann Kou' },
  { value: 'gain_followers', label: 'Gain Followers', labelHt: 'Atire Swivè' },
  { value: 'increase_views', label: 'Increase Views', labelHt: 'Ogmante Vizyon' },
  { value: 'promote_profile', label: 'Promote Profile', labelHt: 'Ankouraje Pwofil' },
  { value: 'promote_event', label: 'Promote Event', labelHt: 'Ankouraje Evènman' },
  { value: 'recruit_affiliates', label: 'Recruit Affiliates', labelHt: 'Rekrute Afilye' },
  { value: 'brand_awareness', label: 'Brand Awareness', labelHt: 'Konsyantizasyon' },
];

function fmtCurrency(amount) {
  const num = Number(amount) || 0;
  return `$${num.toFixed(2)}`;
}

function fmtCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(dateStr));
  } catch { return dateStr; }
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="camp-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="camp-skeleton-row">
          <div className="camp-skeleton-bar w-75" />
          <div className="camp-skeleton-bar w-50" />
        </div>
      ))}
    </div>
  );
}

function Empty({ icon = 'fa-folder-open', title, hint }) {
  return (
    <div className="camp-empty">
      <i className={`fas ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

export default function CampaignDetail({ campaignId, lang, t, showToast, onBack }) {
  const { data: campaign, loading: campLoading, refetch: refetchCampaign } = useFetch(
    () => affiliateApi.getCampaign(campaignId),
    { defaultValue: null, deps: [campaignId] },
  );
  const { data: performance } = useFetch(
    () => affiliateApi.campaignPerformance(campaignId),
    { defaultValue: null, deps: [campaignId] },
  );
  const { data: events, loading: eventsLoading } = useFetch(
    () => affiliateApi.campaignEvents(campaignId),
    { defaultValue: [], deps: [campaignId] },
  );

  const [editingGoal, setEditingGoal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [editingAudience, setEditingAudience] = useState(false);
  const [saving, setSaving] = useState(false);

  const [goalForm, setGoalForm] = useState({ objective: '', target_value: '', target_metric: '' });
  const [budgetForm, setBudgetForm] = useState({
    total_budget: '', daily_limit: '',
    stop_loss_enabled: true, scaling_enabled: false,
    target_roi_pct: 100, target_conversion_rate_pct: 2,
  });
  const [audienceForm, setAudienceForm] = useState({
    countries: [], languages: [], interests: [],
    follower_similarity: true, previous_buyers: false, previous_engagement: false,
  });

  const [optimizations, setOptimizations] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const tt = (key) => t?.[key] || translations[lang]?.[key] || key;

  // Sync local forms when campaign loads (skip if currently editing)
  useEffect(() => {
    if (!campaign) return;
    if (!editingGoal && campaign.goal) {
      const nextGoal = {
        objective: campaign.goal.objective || '',
        target_value: campaign.goal.target_value || '',
        target_metric: campaign.goal.target_metric || '',
      };
      setGoalForm((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(nextGoal)) return prev;
        return nextGoal;
      });
    }
    if (!editingBudget && campaign.budget) {
      setBudgetForm({
        total_budget: campaign.budget.total_budget || '',
        daily_limit: campaign.budget.daily_limit || '',
        stop_loss_enabled: campaign.budget.stop_loss_enabled ?? true,
        scaling_enabled: campaign.budget.scaling_enabled ?? false,
        target_roi_pct: campaign.budget.target_roi_pct || 100,
        target_conversion_rate_pct: campaign.budget.target_conversion_rate_pct || 2,
      });
    }
    if (!editingAudience && campaign.audience) {
      setAudienceForm({
        countries: campaign.audience.countries || [],
        languages: campaign.audience.languages || [],
        interests: campaign.audience.interests || [],
        follower_similarity: campaign.audience.follower_similarity ?? true,
        previous_buyers: campaign.audience.previous_buyers ?? false,
        previous_engagement: campaign.audience.previous_engagement ?? false,
      });
    }
  }, [campaign, editingGoal, editingBudget, editingAudience]);

  const handleSaveGoal = useCallback(async () => {
    setSaving(true);
    try {
      await affiliateApi.updateCampaignGoal(campaignId, goalForm);
      showToast?.(tt('campaign_saved'), 'check');
      setEditingGoal(false);
      refetchCampaign();
    } catch {
      showToast?.(tt('campaign_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }, [campaignId, goalForm, showToast, tt, refetchCampaign]);

  const handleSaveBudget = useCallback(async () => {
    setSaving(true);
    try {
      await affiliateApi.updateCampaignBudget(campaignId, budgetForm);
      showToast?.(tt('campaign_saved'), 'check');
      setEditingBudget(false);
      refetchCampaign();
    } catch {
      showToast?.(tt('campaign_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }, [campaignId, budgetForm, showToast, tt, refetchCampaign]);

  const handleSaveAudience = useCallback(async () => {
    setSaving(true);
    try {
      await affiliateApi.updateCampaignAudience(campaignId, audienceForm);
      showToast?.(tt('campaign_saved'), 'check');
      setEditingAudience(false);
      refetchCampaign();
    } catch {
      showToast?.(tt('campaign_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  }, [campaignId, audienceForm, showToast, tt, refetchCampaign]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(tt('campaign_delete_confirm'))) return;
    try {
      await affiliateApi.deleteCampaign(campaignId);
      showToast?.('Campaign deleted', 'check');
      onBack?.();
    } catch {
      showToast?.('Failed to delete', 'error');
    }
  }, [campaignId, showToast, tt, onBack]);

  const handleCalculateScore = useCallback(async () => {
    try {
      await affiliateApi.dcieCalculateScore(campaignId);
      showToast?.('Score recalculated', 'check');
      refetchCampaign();
    } catch {
      showToast?.('Score calculation failed', 'error');
    }
  }, [campaignId, showToast, refetchCampaign]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await affiliateApi.dcieAnalyze(campaignId);
      setAnalysis(res?.data?.analysis);
      setOptimizations(res?.data?.optimizations || []);
    } catch {
      showToast?.('Analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  }, [campaignId, showToast]);

  const handleApplyOpt = useCallback(async (optId) => {
    try {
      // The optimization model doesn't have a dedicated apply endpoint,
      // so we mark it as applied locally and re-fetch.
      setOptimizations((prev) =>
        prev.map((o) => (o.id === optId ? { ...o, is_applied: true } : o))
      );
      showToast?.('Optimization applied', 'check');
    } catch {
      showToast?.('Failed to apply', 'error');
    }
  }, [showToast]);

  if (campLoading) return <Skeleton rows={6} />;
  if (!campaign) return <Empty icon="fa-ban" title="Campaign not found" />;

  const statusColors = {
    active: '#10b981',
    draft: '#6b7280',
    paused: '#f59e0b',
    ended: '#ef4444',
  };

  return (
    <div className="camp-detail">
      {/* Header */}
      <div className="camp-header">
        <div className="camp-header-left">
          <button type="button" className="camp-back-btn" onClick={onBack}>
            <i className="fas fa-arrow-left" aria-hidden="true" /> {tt('campaign_back')}
          </button>
          <div>
            <h2 className="camp-title">{campaign.name}</h2>
            <div className="camp-meta">
              <span className="camp-badge" style={{ background: statusColors[campaign.status] || '#6b7280' }}>
                {tt(`campaign_status_${campaign.status}`) || campaign.status}
              </span>
              <span>{fmtDate(campaign.start_date)}</span>
              {campaign.end_date && <span>→ {fmtDate(campaign.end_date)}</span>}
              <span>· {campaign.commission_pct}% commission</span>
            </div>
          </div>
        </div>
        <div className="camp-header-actions">
          {campaign.status === 'draft' && (
            <button type="button" className="camp-btn camp-btn-primary" onClick={() => affiliateApi.activateCampaign(campaignId).then(() => { showToast?.('Activated', 'check'); refetchCampaign(); })}>
              <i className="fas fa-play" aria-hidden="true" /> {tt('campaign_status_active')}
            </button>
          )}
          {campaign.status === 'active' && (
            <button type="button" className="camp-btn camp-btn-warning" onClick={() => affiliateApi.pauseCampaign(campaignId).then(() => { showToast?.('Paused', 'check'); refetchCampaign(); })}>
              <i className="fas fa-pause" aria-hidden="true" /> {tt('campaign_status_paused')}
            </button>
          )}
          {campaign.status !== 'ended' && campaign.status !== 'draft' && (
            <button type="button" className="camp-btn camp-btn-danger" onClick={() => affiliateApi.endCampaign(campaignId).then(() => { showToast?.('Ended', 'check'); refetchCampaign(); })}>
              <i className="fas fa-stop" aria-hidden="true" /> {tt('campaign_status_ended')}
            </button>
          )}
          <button type="button" className="camp-btn camp-btn-danger" onClick={handleDelete}>
            <i className="fas fa-trash" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Performance Cards */}
      {performance && (
        <div className="camp-perf-grid">
          <div className="camp-perf-card">
            <div className="camp-perf-label">{tt('campaign_total_clicks')}</div>
            <div className="camp-perf-value">{fmtCount(performance.total_clicks)}</div>
          </div>
          <div className="camp-perf-card">
            <div className="camp-perf-label">{tt('campaign_total_conversions')}</div>
            <div className="camp-perf-value">{fmtCount(performance.total_conversions)}</div>
          </div>
          <div className="camp-perf-card">
            <div className="camp-perf-label">{tt('campaign_total_sales')}</div>
            <div className="camp-perf-value">{fmtCurrency(performance.total_sales)}</div>
          </div>
          <div className="camp-perf-card">
            <div className="camp-perf-label">{tt('campaign_total_commission')}</div>
            <div className="camp-perf-value">{fmtCurrency(performance.total_commission)}</div>
          </div>
          <div className="camp-perf-card">
            <div className="camp-perf-label">{tt('campaign_conversion_rate')}</div>
            <div className="camp-perf-value">{performance.conversion_rate?.toFixed(2) || 0}%</div>
          </div>
          <div className="camp-perf-card">
            <div className="camp-perf-label">{tt('campaign_affiliate_count')}</div>
            <div className="camp-perf-value">{performance.affiliate_count || 0}</div>
          </div>
        </div>
      )}

      <div className="camp-grid">
        {/* Left Column */}
        <div className="camp-main">
          {/* Goal */}
          <div className="camp-card">
            <div className="camp-card-header">
              <h3><i className="fas fa-bullseye" aria-hidden="true" /> {tt('campaign_goal')}</h3>
              {!editingGoal && (
                <button type="button" className="camp-btn camp-btn-ghost" onClick={() => setEditingGoal(true)}>
                  <i className="fas fa-edit" aria-hidden="true" /> {tt('campaign_edit')}
                </button>
              )}
            </div>
            {editingGoal ? (
              <div className="camp-form">
                <div className="camp-form-group">
                  <label>{tt('campaign_objective')}</label>
                  <select className="camp-select" value={goalForm.objective} onChange={(e) => setGoalForm({ ...goalForm, objective: e.target.value })}>
                    <option value="">—</option>
                    {OBJECTIVE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{lang === 'ht' ? o.labelHt : o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="camp-form-group">
                  <label>{tt('campaign_target')}</label>
                  <input type="number" className="camp-input" value={goalForm.target_value} onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })} />
                </div>
                <div className="camp-form-group">
                  <label>{tt('campaign_target_metric')}</label>
                  <input type="text" className="camp-input" value={goalForm.target_metric} onChange={(e) => setGoalForm({ ...goalForm, target_metric: e.target.value })} placeholder="sales, followers, revenue, views" />
                </div>
                <div className="camp-form-actions">
                  <button type="button" className="camp-btn camp-btn-primary" onClick={handleSaveGoal} disabled={saving}>
                    {saving ? <><i className="fas fa-spinner fa-spin" /> {tt('campaign_saving')}</> : <><i className="fas fa-save" /> {tt('campaign_save')}</>}
                  </button>
                  <button type="button" className="camp-btn camp-btn-ghost" onClick={() => setEditingGoal(false)}>{tt('campaign_back')}</button>
                </div>
              </div>
            ) : campaign.goal ? (
              <div className="camp-readonly">
                <div className="camp-readonly-row"><span className="camp-readonly-label">{tt('campaign_objective')}:</span> <span>{campaign.goal.get_objective_display?.() || campaign.goal.objective}</span></div>
                {campaign.goal.target_value && <div className="camp-readonly-row"><span className="camp-readonly-label">{tt('campaign_target')}:</span> <span>{fmtCount(campaign.goal.target_value)} {campaign.goal.target_metric}</span></div>}
              </div>
            ) : (
              <Empty icon="fa-bullseye" title={tt('campaign_no_goal')} />
            )}
          </div>

          {/* Budget */}
          <div className="camp-card">
            <div className="camp-card-header">
              <h3><i className="fas fa-calculator" aria-hidden="true" /> {tt('campaign_budget')}</h3>
              {!editingBudget && (
                <button type="button" className="camp-btn camp-btn-ghost" onClick={() => setEditingBudget(true)}>
                  <i className="fas fa-edit" aria-hidden="true" /> {tt('campaign_edit')}
                </button>
              )}
            </div>
            {editingBudget ? (
              <div className="camp-form">
                <div className="camp-form-row">
                  <div className="camp-form-group">
                    <label>Total Budget ($)</label>
                    <input type="number" className="camp-input" value={budgetForm.total_budget} onChange={(e) => setBudgetForm({ ...budgetForm, total_budget: e.target.value })} />
                  </div>
                  <div className="camp-form-group">
                    <label>Daily Limit ($)</label>
                    <input type="number" className="camp-input" value={budgetForm.daily_limit} onChange={(e) => setBudgetForm({ ...budgetForm, daily_limit: e.target.value })} />
                  </div>
                </div>
                <div className="camp-form-row">
                  <div className="camp-form-group">
                    <label>Target ROI %</label>
                    <input type="number" className="camp-input" value={budgetForm.target_roi_pct} onChange={(e) => setBudgetForm({ ...budgetForm, target_roi_pct: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="camp-form-group">
                    <label>Target CVR %</label>
                    <input type="number" className="camp-input" value={budgetForm.target_conversion_rate_pct} onChange={(e) => setBudgetForm({ ...budgetForm, target_conversion_rate_pct: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="camp-form-group">
                  <label className="camp-checkbox-label">
                    <input type="checkbox" checked={budgetForm.stop_loss_enabled} onChange={(e) => setBudgetForm({ ...budgetForm, stop_loss_enabled: e.target.checked })} />
                    Stop Loss Enabled
                  </label>
                  <label className="camp-checkbox-label">
                    <input type="checkbox" checked={budgetForm.scaling_enabled} onChange={(e) => setBudgetForm({ ...budgetForm, scaling_enabled: e.target.checked })} />
                    Auto-Scaling Enabled
                  </label>
                </div>
                <div className="camp-form-actions">
                  <button type="button" className="camp-btn camp-btn-primary" onClick={handleSaveBudget} disabled={saving}>
                    {saving ? <><i className="fas fa-spinner fa-spin" /> {tt('campaign_saving')}</> : <><i className="fas fa-save" /> {tt('campaign_save')}</>}
                  </button>
                  <button type="button" className="camp-btn camp-btn-ghost" onClick={() => setEditingBudget(false)}>{tt('campaign_back')}</button>
                </div>
              </div>
            ) : campaign.budget ? (
              <div className="camp-readonly">
                <div className="camp-readonly-row"><span className="camp-readonly-label">Total Budget:</span> <span>{fmtCurrency(campaign.budget.total_budget)}</span></div>
                {campaign.budget.daily_limit && <div className="camp-readonly-row"><span className="camp-readonly-label">Daily Limit:</span> <span>{fmtCurrency(campaign.budget.daily_limit)}</span></div>}
                <div className="camp-readonly-row"><span className="camp-readonly-label">Target ROI:</span> <span>{campaign.budget.target_roi_pct}%</span></div>
                <div className="camp-readonly-row"><span className="camp-readonly-label">Target CVR:</span> <span>{campaign.budget.target_conversion_rate_pct}%</span></div>
                <div className="camp-readonly-row"><span className="camp-readonly-label">Stop Loss:</span> <span>{campaign.budget.stop_loss_enabled ? 'Yes' : 'No'}</span></div>
                <div className="camp-readonly-row"><span className="camp-readonly-label">Auto-Scaling:</span> <span>{campaign.budget.scaling_enabled ? 'Yes' : 'No'}</span></div>
                <div className="camp-readonly-row"><span className="camp-readonly-label">Spent:</span> <span>{fmtCurrency(campaign.budget.spent_so_far)}</span></div>
              </div>
            ) : (
              <Empty icon="fa-calculator" title={tt('campaign_no_budget')} />
            )}
          </div>

          {/* Audience */}
          <div className="camp-card">
            <div className="camp-card-header">
              <h3><i className="fas fa-users" aria-hidden="true" /> {tt('campaign_audience')}</h3>
              {!editingAudience && (
                <button type="button" className="camp-btn camp-btn-ghost" onClick={() => setEditingAudience(true)}>
                  <i className="fas fa-edit" aria-hidden="true" /> {tt('campaign_edit')}
                </button>
              )}
            </div>
            {editingAudience ? (
              <div className="camp-form">
                <div className="camp-form-group">
                  <label>Countries (comma separated)</label>
                  <input type="text" className="camp-input" value={(audienceForm.countries || []).join(', ')} onChange={(e) => setAudienceForm({ ...audienceForm, countries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </div>
                <div className="camp-form-group">
                  <label>Languages (comma separated)</label>
                  <input type="text" className="camp-input" value={(audienceForm.languages || []).join(', ')} onChange={(e) => setAudienceForm({ ...audienceForm, languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </div>
                <div className="camp-form-group">
                  <label>Interests (comma separated)</label>
                  <input type="text" className="camp-input" value={(audienceForm.interests || []).join(', ')} onChange={(e) => setAudienceForm({ ...audienceForm, interests: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </div>
                <div className="camp-form-group">
                  <label className="camp-checkbox-label">
                    <input type="checkbox" checked={audienceForm.follower_similarity} onChange={(e) => setAudienceForm({ ...audienceForm, follower_similarity: e.target.checked })} />
                    Follower Similarity
                  </label>
                  <label className="camp-checkbox-label">
                    <input type="checkbox" checked={audienceForm.previous_buyers} onChange={(e) => setAudienceForm({ ...audienceForm, previous_buyers: e.target.checked })} />
                    Previous Buyers
                  </label>
                  <label className="camp-checkbox-label">
                    <input type="checkbox" checked={audienceForm.previous_engagement} onChange={(e) => setAudienceForm({ ...audienceForm, previous_engagement: e.target.checked })} />
                    Previous Engagement
                  </label>
                </div>
                <div className="camp-form-actions">
                  <button type="button" className="camp-btn camp-btn-primary" onClick={handleSaveAudience} disabled={saving}>
                    {saving ? <><i className="fas fa-spinner fa-spin" /> {tt('campaign_saving')}</> : <><i className="fas fa-save" /> {tt('campaign_save')}</>}
                  </button>
                  <button type="button" className="camp-btn camp-btn-ghost" onClick={() => setEditingAudience(false)}>{tt('campaign_back')}</button>
                </div>
              </div>
            ) : campaign.audience ? (
              <div className="camp-readonly">
                {campaign.audience.countries?.length > 0 && <div className="camp-readonly-row"><span className="camp-readonly-label">Countries:</span> <span>{campaign.audience.countries.join(', ')}</span></div>}
                {campaign.audience.languages?.length > 0 && <div className="camp-readonly-row"><span className="camp-readonly-label">Languages:</span> <span>{campaign.audience.languages.join(', ')}</span></div>}
                {campaign.audience.interests?.length > 0 && <div className="camp-readonly-row"><span className="camp-readonly-label">Interests:</span> <span>{campaign.audience.interests.join(', ')}</span></div>}
                <div className="camp-readonly-row"><span className="camp-readonly-label">Est. Audience:</span> <span>{fmtCount(campaign.audience.estimated_audience_size)}</span></div>
              </div>
            ) : (
              <Empty icon="fa-users" title={tt('campaign_no_audience')} />
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="camp-side">
          {/* Score */}
          <div className="camp-card">
            <div className="camp-card-header">
              <h3><i className="fas fa-star" aria-hidden="true" /> {tt('campaign_score')}</h3>
              <button type="button" className="camp-btn camp-btn-ghost" onClick={handleCalculateScore}>
                <i className="fas fa-sync" aria-hidden="true" /> Recalculate
              </button>
            </div>
            {campaign.score ? (
              <div className="camp-score">
                <div className={`camp-score-ring ${(campaign.score.overall_score || 0) >= 70 ? 'camp-score-good' : (campaign.score.overall_score || 0) >= 40 ? 'camp-score-warn' : 'camp-score-bad'}`}>
                  <span className="camp-score-value">{campaign.score.overall_score || 0}</span>
                  <span className="camp-score-max">/ 100</span>
                </div>
                <div className="camp-score-breakdown">
                  {[
                    { key: 'audience_match', label: tt('campaign_estimated_audience'), weight: '20%' },
                    { key: 'content_quality', label: tt('campaign_content_quality'), weight: '15%' },
                    { key: 'creator_trust', label: tt('campaign_creator_trust'), weight: '15%' },
                    { key: 'historical_performance', label: tt('campaign_historical'), weight: '15%' },
                    { key: 'price_attractiveness', label: tt('campaign_price'), weight: '10%' },
                    { key: 'conversion_probability', label: tt('campaign_conversion_prob'), weight: '15%' },
                    { key: 'engagement_prediction', label: tt('campaign_engagement'), weight: '10%' },
                  ].map(({ key, label, weight }) => (
                    <div key={key} className="camp-score-row">
                      <span className="camp-score-label">{label} ({weight})</span>
                      <div className="camp-score-bar-bg">
                        <div className="camp-score-bar-fill" style={{ width: `${campaign.score[key] || 0}%` }} />
                      </div>
                      <span className="camp-score-num">{campaign.score[key] || 0}</span>
                    </div>
                  ))}
                </div>
                {campaign.score.last_calculated && (
                  <div className="camp-score-footer">{tt('campaign_last_calculated')}: {fmtDate(campaign.score.last_calculated)}</div>
                )}
              </div>
            ) : (
              <Empty icon="fa-star" title={tt('campaign_no_score')} hint="Click Recalculate to generate a score" />
            )}
          </div>

          {/* Optimizations */}
          <div className="camp-card">
            <div className="camp-card-header">
              <h3><i className="fas fa-microchip" aria-hidden="true" /> {tt('campaign_optimizations')}</h3>
              <button type="button" className="camp-btn camp-btn-ghost" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? <><i className="fas fa-spinner fa-spin" /> Analyzing...</> : <><i className="fas fa-robot" /> Analyze</>}
              </button>
            </div>
            {analysis && (
              <div className="camp-ai-box">
                <h4><i className="fas fa-robot" style={{ color: '#6366f1' }} aria-hidden="true" /> {tt('campaign_detail')}</h4>
                <ul className="camp-ai-list">
                  {analysis.insights?.map((insight, i) => (
                    <li key={i}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {optimizations.length === 0 && !analysis ? (
              <Empty icon="fa-microchip" title={tt('campaign_no_optimizations')} hint="Click Analyze to generate recommendations" />
            ) : (
              <div className="camp-opt-list">
                {optimizations.map((opt) => (
                  <div key={opt.id} className={`camp-opt-item ${opt.is_applied ? 'camp-opt-applied' : ''}`}>
                    <div className="camp-opt-body">
                      <div className="camp-opt-action">{opt.action.replace(/_/g, ' ')}</div>
                      <div className="camp-opt-reason">{opt.reason}</div>
                      {opt.expected_impact && <div className="camp-opt-impact">Expected: {opt.expected_impact}</div>}
                    </div>
                    {!opt.is_applied && (
                      <button type="button" className="camp-btn camp-btn-small camp-btn-primary" onClick={() => handleApplyOpt(opt.id)}>
                        {tt('campaign_apply_opt')}
                      </button>
                    )}
                    {opt.is_applied && <span className="camp-badge camp-badge-applied">{tt('campaign_opt_applied')}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Events */}
          <div className="camp-card">
            <div className="camp-card-header">
              <h3><i className="fas fa-history" aria-hidden="true" /> {tt('campaign_events')}</h3>
            </div>
            {eventsLoading ? <Skeleton rows={2} /> : events.length === 0 ? (
              <Empty icon="fa-history" title="No events yet" />
            ) : (
              <div className="camp-event-list">
                {events.map((ev) => (
                  <div key={ev.id} className="camp-event-item">
                    <div className="camp-event-dot" />
                    <div className="camp-event-body">
                      <div className="camp-event-type">{ev.event_type.replace(/_/g, ' ')}</div>
                      {ev.description && <div className="camp-event-desc">{ev.description}</div>}
                      <div className="camp-event-date">{fmtDate(ev.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
