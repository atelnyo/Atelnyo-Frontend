/**
 * src/components/affiliate/ProgramDiscovery.jsx
 *
 * Browse all active affiliate programs and apply to join.
 *
 * Features:
 *   - List all active programs with creator info, commission rates
 *   - Search/filter by creator name
 *   - Apply to program (opens apply modal)
 *   - Shows approval mode, min account age, max affiliates
 */

import React, { useState, useCallback, useEffect } from 'react';
import { affiliateApi } from '../../services/affiliateApi';
import useFetch from '../../hooks/useFetch';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { translations } from '../../data/translations';
import './AffiliateDashboard.css';

const LANG_FALLBACK = {
  discover_title: 'Discover Programs',
  discover_subtitle: 'Browse and join affiliate programs from top creators',
  search_placeholder: 'Search creators...',
  apply_btn: 'Apply',
  applying: 'Applying...',
  applied: 'Applied',
  applied_success: 'Application submitted!',
  apply_error: 'Failed to apply',
  no_programs: 'No programs available yet',
  no_programs_hint: 'Check back later for new opportunities',
  commission_label: 'Commission',
  affiliates_label: 'Affiliates',
  approval_label: 'Approval',
  approval_automatic: 'Automatic',
  approval_manual: 'Manual',
  approval_invite: 'Invite Only',
  min_age_label: 'Min account age',
  days_label: 'days',
  max_affiliates_label: 'Max affiliates',
  unlimited: 'Unlimited',
  apply_modal_title: 'Apply to Program',
  apply_motivation_label: 'Why do you want to join?',
  apply_platforms_label: 'Promotion platforms (comma separated)',
  apply_reach_label: 'Estimated reach',
  apply_submit: 'Submit Application',
  apply_cancel: 'Cancel',
  already_applied: 'Already applied',
  application_pending: 'Pending',
  login_required: 'Please log in to apply',
};

function fmtCount(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="aff-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="aff-skeleton-row">
          <div className="aff-skeleton-bar w-75" />
          <div className="aff-skeleton-bar w-50" />
        </div>
      ))}
    </div>
  );
}

function Empty({ icon = 'fa-briefcase', title, hint }) {
  return (
    <div className="aff-empty">
      <i className={`fas ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

function ApplyModal({ program, lang, t, showToast, onClose, onApplied }) {
  const [motivation, setMotivation] = useState('');
  const [platforms, setPlatforms] = useState('');
  const [reach, setReach] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!motivation.trim()) return;
    setSubmitting(true);
    try {
      await affiliateApi.apply(program.creator, {
        motivation: motivation.trim(),
        promotion_platforms: platforms.split(',').map((s) => s.trim()).filter(Boolean),
        estimated_reach: reach.trim(),
      });
      showToast?.(t('applied_success') || 'Application submitted!', 'check');
      onApplied?.();
      onClose();
    } catch {
      showToast?.(t('apply_error') || 'Failed to apply', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [program, motivation, platforms, reach, showToast, t, onClose, onApplied]);

  return (
    <div className="aff-modal-overlay" onClick={onClose}>
      <div className="aff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aff-modal-header">
          <h3>{t('apply_modal_title') || 'Apply to Program'}</h3>
          <button type="button" className="aff-modal-close" onClick={onClose}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="aff-form-group">
            <label>{t('apply_motivation_label') || 'Why do you want to join?'}</label>
            <textarea
              className="aff-input aff-textarea"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder={lang === 'ht' ? 'Eksplike poukisa ou vle antre...' : 'Explain why you want to join...'}
              rows={3}
              required
            />
          </div>
          <div className="aff-form-group">
            <label>{t('apply_platforms_label') || 'Promotion platforms (comma separated)'}</label>
            <input
              type="text"
              className="aff-input"
              value={platforms}
              onChange={(e) => setPlatforms(e.target.value)}
              placeholder="Instagram, TikTok, YouTube, Twitter..."
            />
          </div>
          <div className="aff-form-group">
            <label>{t('apply_reach_label') || 'Estimated reach'}</label>
            <input
              type="text"
              className="aff-input"
              value={reach}
              onChange={(e) => setReach(e.target.value)}
              placeholder="10k followers, 5k subscribers..."
            />
          </div>
          <div className="aff-modal-actions">
            <button type="button" className="aff-btn aff-btn-ghost" onClick={onClose}>
              {t('apply_cancel') || 'Cancel'}
            </button>
            <button type="submit" className="aff-btn aff-btn-primary" disabled={submitting}>
              {submitting ? <><i className="fas fa-spinner fa-spin" /> {t('applying') || 'Applying...'}</> : t('apply_submit') || 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProgramDiscovery({ lang = 'ht', showToast }) {
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};
  const { data: programs, loading, refetch } = useFetch(
    () => affiliateApi.getPublicPrograms(),
    { defaultValue: [], deps: [] },
  );

  const [search, setSearch] = useState('');
  const [applyProgram, setApplyProgram] = useState(null);
  const [appliedIds, setAppliedIds] = useState(new Set());

  // Load user's existing applications to show "Already applied" state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await affiliateApi.getMyApplications();
        if (!cancelled && Array.isArray(res?.data)) {
          setAppliedIds(new Set(res.data.map((a) => a.program_creator_id || a.program?.creator)));
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = (programs || []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.creator_username || '').toLowerCase().includes(q);
  });

  const approvalLabel = (mode) => {
    if (mode === 'automatic') return t('approval_automatic') || 'Automatic';
    if (mode === 'invite_only') return t('approval_invite') || 'Invite Only';
    return t('approval_manual') || 'Manual';
  };

  const approvalColor = (mode) => {
    if (mode === 'automatic') return '#10b981';
    if (mode === 'invite_only') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div className="aff-discovery">
      <div className="aff-discovery-header">
        <button
          type="button"
          className="aff-back-btn"
          onClick={() => navigate(-1)}
          aria-label={t.common_back || 'Back'}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <div>
          <h1><i className="fas fa-compass" aria-hidden="true" /> {t('discover_title') || 'Discover Programs'}</h1>
          <p className="aff-subtitle">{t('discover_subtitle') || 'Browse and join affiliate programs from top creators'}</p>
        </div>
      </div>

      {/* Search */}
      <div className="aff-discovery-search">
        <i className="fas fa-search" aria-hidden="true" />
        <input
          type="text"
          className="aff-input"
          placeholder={t('search_placeholder') || 'Search creators...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Programs Grid */}
      {loading ? (
        <Skeleton rows={4} />
      ) : filtered.length === 0 ? (
        <Empty
          icon="fa-briefcase"
          title={t('no_programs') || 'No programs available yet'}
          hint={t('no_programs_hint') || 'Check back later for new opportunities'}
        />
      ) : (
        <div className="aff-programs-grid">
          {filtered.map((program) => {
            const isApplied = appliedIds.has(program.creator);
            const isInviteOnly = program.approval_mode === 'invite_only';
            return (
              <div key={program.creator} className="aff-program-card">
                <div className="aff-program-header">
                  <div className="aff-program-avatar">
                    {(program.creator_username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="aff-program-info">
                    <div className="aff-program-name">{program.creator_username}</div>
                    <div className="aff-program-meta">
                      <span
                        className="aff-badge"
                        style={{ background: approvalColor(program.approval_mode) }}
                      >
                        {approvalLabel(program.approval_mode)}
                      </span>
                      {program.total_affiliates > 0 && (
                        <span>{fmtCount(program.total_affiliates)} {t('affiliates_label') || 'affiliates'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="aff-program-stats">
                  <div className="aff-program-stat">
                    <span className="aff-program-stat-value">{program.default_commission_pct}%</span>
                    <span className="aff-program-stat-label">{t('commission_label') || 'Commission'}</span>
                  </div>
                  {program.vip_commission_pct > program.default_commission_pct && (
                    <div className="aff-program-stat">
                      <span className="aff-program-stat-value">{program.vip_commission_pct}%</span>
                      <span className="aff-program-stat-label">VIP</span>
                    </div>
                  )}
                </div>

                <div className="aff-program-details">
                  {program.min_account_age_days > 0 && (
                    <div className="aff-program-detail">
                      <i className="fas fa-clock" aria-hidden="true" />
                      <span>{program.min_account_age_days} {t('days_label') || 'days'}</span>
                    </div>
                  )}
                  {program.max_affiliates > 0 && (
                    <div className="aff-program-detail">
                      <i className="fas fa-users" aria-hidden="true" />
                      <span>
                        {fmtCount(program.total_affiliates)} / {fmtCount(program.max_affiliates)}
                      </span>
                    </div>
                  )}
                  {program.max_affiliates === 0 && (
                    <div className="aff-program-detail">
                      <i className="fas fa-infinity" aria-hidden="true" />
                      <span>{t('unlimited') || 'Unlimited'}</span>
                    </div>
                  )}
                </div>

                <div className="aff-program-actions">
                  {isApplied ? (
                    <button type="button" className="aff-btn aff-btn-secondary" disabled>
                      <i className="fas fa-check" aria-hidden="true" />
                      {t('applied') || 'Applied'}
                    </button>
                  ) : isInviteOnly ? (
                    <button type="button" className="aff-btn aff-btn-secondary" disabled>
                      {t('approval_invite') || 'Invite Only'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="aff-btn aff-btn-primary"
                      onClick={() => setApplyProgram(program)}
                    >
                      {t('apply_btn') || 'Apply'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Modal */}
      {applyProgram && (
        <ApplyModal
          program={applyProgram}
          lang={lang}
          t={t}
          showToast={showToast}
          onClose={() => setApplyProgram(null)}
          onApplied={() => {
            setAppliedIds((prev) => new Set([...prev, applyProgram.creator]));
            setApplyProgram(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
