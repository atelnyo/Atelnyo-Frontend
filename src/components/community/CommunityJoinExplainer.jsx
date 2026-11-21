/* eslint-disable react/prop-types -- presentational card, the codebase does not use PropTypes */
/**
 * src/components/community/CommunityJoinExplainer.jsx
 *
 * The "what happens if I join" card on /community/:slug/home. A visitor
 * sees how this particular community's join mode behaves and what
 * membership unlocks; someone waiting on approval sees the same card in
 * its "nothing else to do" state. Wording comes from communityOnboarding
 * so the Studio preview can reuse it.
 */
import React from 'react';
import { t } from '../../utils/i18n';
import { joinPlan, communityUnlocks } from './communityOnboarding';

export default function CommunityJoinExplainer({
  community, lang = 'en', pending = false, joining = false, canJoin = true, onJoin,
}) {
  const plan = joinPlan(community?.join_mode, lang, { pending });
  const unlocks = communityUnlocks(lang);
  const memberCount = Number(community?.member_count) || 0;
  const rulesCount = Array.isArray(community?.rules) ? community.rules.length : 0;
  const locked = pending || (!canJoin && plan.mode === 'invite');

  return (
    <section
      className="c-join-explainer"
      data-testid="community-join-explainer"
      data-mode={plan.mode}
      aria-label={t(lang, 'Kijan pou antre', 'How joining works', 'Comment rejoindre')}
    >
      <div className="c-join-explainer-head">
        <span className="c-join-explainer-icon" aria-hidden="true">
          <i className={`fas ${plan.icon}`} />
        </span>
        <div className="c-join-explainer-copy">
          <h3>{plan.title}</h3>
          <p>{plan.body}</p>
        </div>
      </div>

      <ul className="c-join-explainer-bullets">
        {plan.bullets.map((bullet) => (
          <li key={bullet.icon + bullet.text}>
            <i className={`fas ${bullet.icon}`} aria-hidden="true" />
            <span>{bullet.text}</span>
          </li>
        ))}
      </ul>

      <div className="c-join-explainer-unlocks">
        <span className="c-join-explainer-unlocks-label">
          {t(lang, 'Sa w ap jwenn lè w antre', 'What you get inside', 'Ce que vous y trouverez')}
        </span>
        <div className="c-join-explainer-chips">
          {unlocks.map((item) => (
            <span
              key={item.key}
              className={`c-join-explainer-chip${pending ? ' is-locked' : ''}`}
              title={item.hint}
            >
              <i className={`fas ${item.icon}`} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="c-join-explainer-foot">
        <div className="c-join-explainer-meta">
          {memberCount > 0 && (
            <span>
              <i className="fas fa-users" aria-hidden="true" /> {memberCount}
            </span>
          )}
          {rulesCount > 0 && (
            <span>
              <i className="fas fa-gavel" aria-hidden="true" /> {rulesCount}
            </span>
          )}
        </div>
        {pending ? (
          <span className="c-join-explainer-status" data-testid="community-join-explainer-status">
            <i className="fas fa-clock" aria-hidden="true" /> {plan.cta}
          </span>
        ) : (
          <button
            type="button"
            className="c-join-explainer-cta"
            onClick={onJoin}
            disabled={locked || joining || !onJoin}
            data-testid="community-join-explainer-cta"
          >
            <i className={`fas ${joining ? 'fa-spinner fa-spin' : plan.mode === 'invite' ? 'fa-lock' : 'fa-user-plus'}`} aria-hidden="true" />
            {joining ? t(lang, 'Ap tann...', 'Please wait...', 'Patientez...') : plan.cta}
          </button>
        )}
      </div>
    </section>
  );
}
