/**
 * src/components/WelcomeChecklist.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════
 * Welcome Checklist — Auto-detected onboarding for new Creators
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 8 steps that guide a new creator through setup. Unlike the old version,
 * steps are now:
 *   1. Auto-detected from REAL backend data (profile completeness, avatar,
 *      cover, courses count, portfolio count).
 *   2. Actionable — clicking navigates to the right Studio section or opens
 *      the relevant modal (Course form, Project form, Withdraw).
 *   3. No fake completion — no localStorage toggles. You MUST actually
 *      complete the step for it to show as done.
 *
 * Auto-detected steps (verified from data):
 *   • profile        — profile_completeness >= 60% OR artist_name + bio set
 *   • avatar         — avatar_url is set
 *   • banner         — cover_url is set
 *   • first_course   — coursesCount > 0
 *   • first_portfolio— portfolioCount > 0
 *
 * Action steps (click to navigate / open modal):
 *   • media_provider — navigate to Media section
 *   • creator_guide  — open guide link
 *   • wallet         — open Withdraw modal to configure
 *
 * Dismisses on close, stores dismissed state in localStorage so it
 * doesn't re-appear every visit. Re-appears only when localStorage is
 * cleared (e.g., new device).
 */

import React, { useState, useEffect, useCallback } from 'react';

const LS_DISMISSED = 'atelnyo_welcome_dismissed';
const LS_LEGACY = 'atelnyo_welcome_checklist';  // old fake-completion key — cleaned on mount
const AUTO_TOTAL = 5;  // steps that can be auto-detected from real data
// TOTAL removed — only AUTO_TOTAL is used since 3 steps (media_provider, creator_guide, wallet)
// are action-only and can never be auto-detected as "done".

const STEPS = [
  { id: 'profile',         icon: 'fa-user-circle',    en: 'Complete Your Profile',       ht: 'Ranpli Pwofil Ou',
    autoDetect: true,  action: 'public_profile' },
  { id: 'avatar',          icon: 'fa-camera',         en: 'Upload Avatar',               ht: 'Mete Avatè',
    autoDetect: true,  action: 'public_profile' },
  { id: 'banner',          icon: 'fa-image',          en: 'Create Banner',               ht: 'Kreye Banyè',
    autoDetect: true,  action: 'public_profile' },
  { id: 'media_provider',  icon: 'fa-cloud',          en: 'Choose Media Provider',       ht: 'Chwazi Provider Medya',
    autoDetect: false, action: 'media' },
  { id: 'creator_guide',   icon: 'fa-book',           en: 'Read Creator Guide',          ht: 'Li Gid Kreyatè',
    autoDetect: false, action: 'guide' },
  { id: 'first_course',    icon: 'fa-graduation-cap', en: 'Publish First Course',        ht: 'Pibliye Premye Kou',
    autoDetect: true,  action: 'course_modal' },
  { id: 'first_portfolio', icon: 'fa-briefcase',      en: 'Publish Portfolio Project',   ht: 'Pibliye Pwojè Pòtfolyo',
    autoDetect: true,  action: 'project_modal' },
  { id: 'wallet',          icon: 'fa-wallet',         en: 'Configure Wallet',            ht: 'Konfigire Bous',
    autoDetect: false, action: 'withdraw_modal' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function isDismissed() {
  try { return localStorage.getItem(LS_DISMISSED) === 'true'; } catch { return false; }
}

function persistDismissed() {
  try { localStorage.setItem(LS_DISMISSED, 'true'); } catch {}
}

function cleanLegacyKey() {
  try { localStorage.removeItem(LS_LEGACY); } catch {}
}

/**
 * Auto-detect which steps are genuinely completed from real data.
 * Returns an array of step IDs that are verified complete.
 */
function detectCompletedSteps(profileData, coursesCount = 0, portfolioCount = 0) {
  const completed = [];

  if (!profileData) { return completed; }

  // Profile: completeness >= 60% OR has both artist_name and bio
  const completeness = profileData.profile_completeness || 0;
  const hasName = !!profileData.artist_name;
  const hasBio = !!profileData.bio;
  if (completeness >= 60 || (hasName && hasBio)) {
    completed.push('profile');
  }

  // Avatar: has an avatar URL set
  if (profileData.avatar_url) {
    completed.push('avatar');
  }

  // Banner: has a cover URL set
  if (profileData.cover_url) {
    completed.push('banner');
  }

  // First Course: at least one course published
  if (coursesCount > 0) {
    completed.push('first_course');
  }

  // First Portfolio: at least one project
  if (portfolioCount > 0) {
    completed.push('first_portfolio');
  }

  return completed;
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function WelcomeChecklist({
  lang = 'ht',
  profileData,
  coursesCount = 0,
  portfolioCount = 0,
  onNavigate,         // (sectionId) => void
  onOpenModal,        // (type: 'course' | 'project' | 'withdraw') => void
}) {
  const isHt = lang === 'ht';
  const [dismissed, setDismissed] = useState(() => isDismissed());

  // Auto-detect completed steps from real data
  const autoCompleted = detectCompletedSteps(profileData, coursesCount, portfolioCount);
  const completedCount = autoCompleted.length;
  const allAutoDone = completedCount >= AUTO_TOTAL;
  const progress = Math.round((completedCount / AUTO_TOTAL) * 100);

  // Clean legacy localStorage key on mount
  useEffect(() => { cleanLegacyKey(); }, []);

  const handleStepClick = useCallback((step) => {
    const stepDef = STEPS.find(s => s.id === step.id);

    // If auto-detected as complete, click navigates to the relevant section
    if (autoCompleted.includes(step.id)) {
      if (onNavigate) {
        // Navigate to public_profile for profile/avatar/banner,
        // to courses for first_course, to portfolio for first_portfolio
        const navMap = {
          profile: 'public_profile',
          avatar: 'public_profile',
          banner: 'public_profile',
          first_course: 'courses',
          first_portfolio: 'portfolio',
        };
        onNavigate(navMap[step.id] || 'public_profile');
      }
      return;
    }

    // Not auto-detected — trigger the action
    if (!stepDef) { return; }

    switch (stepDef.action) {
      case 'public_profile':
        onNavigate?.('public_profile');
        break;
      case 'media':
        onNavigate?.('media');
        break;
      case 'guide':
        onNavigate?.('faq');
        break;
      case 'course_modal':
        onOpenModal?.('course');
        break;
      case 'project_modal':
        onOpenModal?.('project');
        break;
      case 'withdraw_modal':
        onOpenModal?.('withdraw');
        break;
      default:
        onNavigate?.(stepDef.action);
    }
  }, [autoCompleted, onNavigate, onOpenModal]);

  const handleDismiss = useCallback(() => {
    persistDismissed();
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  // All auto-detectable steps completed — compact status card
  if (allAutoDone) {
    return (
      <div className="wcl-container wcl-container--done" role="region" aria-label={isHt ? 'Lis pou fè — fini' : 'Checklist — complete'}>
        <div className="wcl-header wcl-header--done">
          <i className="fas fa-circle-check" aria-hidden="true" style={{ color: 'var(--color-emerald, #10b981)', fontSize: '1.6rem' }} />
          <div>
            <h3 className="wcl-title">{isHt ? 'Etap konfigirasyon fini' : 'Setup complete'}</h3>
            <p className="wcl-subtitle">{isHt ? 'Tout etap yo fini. Klike sou yon etap pou w ale.' : 'All setup steps are done. Click a step to navigate.'}</p>
          </div>
          <button type="button" className="wcl-dismiss" onClick={handleDismiss} aria-label={isHt ? 'Fèmen' : 'Dismiss'}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="wcl-steps">
          {STEPS.map((step) => (
            <div key={step.id} className="wcl-step wcl-step-done" onClick={() => handleStepClick(step)} style={{ cursor: 'pointer' }}>
              <div className="wcl-step-left">
                <div className="wcl-step-check wcl-step-checked">
                  <i className="fas fa-check" />
                </div>
                <span className="wcl-step-label">{isHt ? step.ht : step.en}</span>
              </div>
              <i className="fas fa-arrow-right wcl-step-arrow" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wcl-container" role="region" aria-label={isHt ? 'Lis pou fè' : 'Checklist'}>
      <div className="wcl-header">
        <div className="wcl-header-left">
          <i className="fas fa-clipboard-check" aria-hidden="true" />
          <div>
            <h3 className="wcl-title">
              {isHt ? 'Kòmanse' : 'Getting Started'}
            </h3>
            <p className="wcl-subtitle">
              {isHt
                ? `${completedCount} sou ${AUTO_TOTAL} etap fini. Klike sou chak etap pou w ale.`
                : `${completedCount} of ${AUTO_TOTAL} steps done. Click each step to go there.`}
            </p>
          </div>
        </div>
        <div className="wcl-header-right">
          <div className="wcl-progress-ring">
            <svg viewBox="0 0 36 36" className="wcl-ring-svg">
              <path className="wcl-ring-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path className="wcl-ring-fill"
                strokeDasharray={`${progress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="21" textAnchor="middle" className="wcl-ring-text">
                {completedCount}
              </text>
            </svg>
          </div>
          <button type="button" className="wcl-dismiss" onClick={handleDismiss}
            aria-label={isHt ? 'Fèmen' : 'Dismiss'}>
            <i className="fas fa-times" />
          </button>
        </div>
      </div>

      <div className="wcl-steps">
        {STEPS.map((step, i) => {
          const isDone = autoCompleted.includes(step.id);
          const hasAction = !isDone && step.action; // show action button for incomplete steps with actions

          return (
            <div key={step.id} className={`wcl-step${isDone ? ' wcl-step-done' : ''}`}>
              <div className="wcl-step-left">
                <div className={`wcl-step-check${isDone ? ' wcl-step-checked' : ''}`}>
                  {isDone ? <i className="fas fa-check" /> : <span>{i + 1}</span>}
                </div>
                <div className="wcl-step-info">
                  <span className="wcl-step-label">
                    {isHt ? step.ht : step.en}
                  </span>
                  {isDone && (
                    <span className="wcl-step-done-label">
                      <i className="fas fa-check-circle" aria-hidden="true" />
                      {isHt ? 'Fini ✓' : 'Done ✓'}
                    </span>
                  )}
                  {!isDone && step.autoDetect && (
                    <span className="wcl-step-done-label" style={{ color: 'var(--text-secondary)' }}>
                      {isHt ? 'Pokò fèt' : 'Not done yet'}
                    </span>
                  )}
                </div>
              </div>
              <div className="wcl-step-right">
                {!isDone && (
                  <button
                    type="button"
                    className="wcl-step-btn"
                    onClick={() => handleStepClick(step)}
                    title={isHt ? 'Ale fè etap sa a' : 'Go do this step'}
                  >
                    {step.action === 'guide' ? (
                      <><i className="fas fa-external-link-alt" aria-hidden="true" /> {isHt ? 'Li' : 'Read'}</>
                    ) : step.action?.endsWith('_modal') ? (
                      <><i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Kreye' : 'Create'}</>
                    ) : (
                      <><i className="fas fa-arrow-right" aria-hidden="true" /> {isHt ? 'Ale' : 'Go'}</>
                    )}
                  </button>
                )}
                {isDone && (
                  <i className="fas fa-check-circle wcl-step-check-icon" aria-hidden="true" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="wcl-progress-bar-track">
        <div className="wcl-progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <button type="button" className="wcl-dismiss-btn" onClick={handleDismiss}>
        {isHt ? 'Kache lis sa a' : 'Hide this checklist'}
      </button>
    </div>
  );
}
