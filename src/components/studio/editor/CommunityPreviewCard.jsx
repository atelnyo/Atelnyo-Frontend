/**
 * src/components/studio/editor/CommunityPreviewCard.jsx
 *
 * Live "what people will see" card for the community editor. It reads
 * the unsaved form state, so the founder can tell — before publishing —
 * how the page opens for a visitor and what changes once someone joins.
 *
 * The two modes mirror the two real moments on the public page:
 *   visitor → banner, name, description, rules, and the join button the
 *             community's join_mode produces;
 *   member  → the same identity plus the tab bar, the post composer, and
 *             the first-steps list a new member lands on.
 */
/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere (same as the other community panels) */
import React, { useState } from 'react';
import styles from './communityEditor.module.css';
import { joinPlan } from '../../community/communityOnboarding';

// Join wording lives in communityOnboarding so the preview quotes the
// public page word for word instead of drifting from it.
const JOIN_CTA_HT = { public: 'Antre', approval: 'Mande pou antre', invite: 'Envitasyon sèlman' };
const JOIN_CTA_EN = { public: 'Join', approval: 'Request to join', invite: 'Invite only' };

const TABS = [
  { id: 'home', en: 'Home', ht: 'Akèy' },
  { id: 'events', en: 'Events', ht: 'Evènman' },
  { id: 'posts', en: 'Posts', ht: 'Pòs' },
  { id: 'members', en: 'Members', ht: 'Manm' },
];

export default function CommunityPreviewCard({
  lang = 'en',
  value = {},
  rules = [],
  memberCount = 0,
}) {
  const isHt = lang === 'ht';
  const key = isHt ? 'ht' : 'en';
  const [mode, setMode] = useState('visitor');
  const isMember = mode === 'member';
  const plan = joinPlan(value.join_mode, lang);
  const joinMode = plan.mode;
  const joinCopy = {
    badge: plan.badge,
    hint: plan.short,
    cta: isHt ? JOIN_CTA_HT[joinMode] : JOIN_CTA_EN[joinMode],
  };

  const name = (value.name || '').trim() || (isHt ? 'Non kominote w' : 'Your community name');
  const description = (value.description || '').trim()
    || (isHt
      ? 'Deskripsyon an ap parèt isit la. Eseye di an de liy poukisa moun ta dwe antre.'
      : 'Your description appears here. Try two lines on why someone should join.');
  const previewRules = (rules || []).filter((rule) => (rule.title || '').trim()).slice(0, 3);
  const bannerStyle = value.banner_url
    ? { backgroundImage: `url(${value.banner_url})` }
    : undefined;

  return (
    <aside className={styles.previewCard} aria-labelledby="community-preview-title">
      <div className={styles.previewHead}>
        <h3 className={styles.formTitle} id="community-preview-title">
          <i className="fas fa-eye" aria-hidden="true" />
          {isHt ? 'Apèsi' : 'Preview'}
        </h3>
        <div className={styles.previewToggle} role="tablist" aria-label={isHt ? 'Wè kòm' : 'View as'}>
          {[
            { id: 'visitor', icon: 'fa-user', label: { en: 'Visitor', ht: 'Vizitè' } },
            { id: 'member', icon: 'fa-user-check', label: { en: 'Member', ht: 'Manm' } },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={mode === option.id}
              className={`${styles.previewToggleBtn}${mode === option.id ? ` ${styles.previewToggleBtnActive}` : ''}`}
              onClick={() => setMode(option.id)}
            >
              <i className={`fas ${option.icon}`} aria-hidden="true" />
              {option.label[key]}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`${styles.previewBanner}${value.banner_url ? ` ${styles.previewBannerImage}` : ''}`}
        style={bannerStyle}
      >
        <span className={styles.previewAvatar} aria-hidden="true">
          {value.avatar_url
            ? <img src={value.avatar_url} alt="" />
            : <i className="fas fa-users" />}
        </span>
        <div className={styles.previewIdentity}>
          <strong>{name}</strong>
          <span>
            {memberCount} {isHt ? 'manm' : 'members'}
            {' · '}
            {joinCopy.badge}
          </span>
        </div>
        <span className={`${styles.previewCta}${isMember ? ` ${styles.previewCtaMember}` : ''}`}>
          <i className={`fas ${isMember ? 'fa-pen' : joinMode === 'invite' ? 'fa-lock' : 'fa-user-plus'}`} aria-hidden="true" />
          {isMember ? (isHt ? 'Kreye yon pòs' : 'Write a post') : joinCopy.cta}
        </span>
      </div>

      <p className={styles.previewDesc}>{description}</p>

      {isMember && (
        <div className={styles.previewMember}>
          <div className={styles.previewTabs} aria-hidden="true">
            {TABS.map((tab, index) => (
              <span key={tab.id} className={index === 0 ? styles.previewTabActive : undefined}>
                {tab[key]}
              </span>
            ))}
          </div>
          <div className={styles.previewComposer} aria-hidden="true">
            <i className="fas fa-pen-to-square" />
            {isHt ? 'Pataje yon bagay ak kominote a…' : 'Share something with the community…'}
          </div>
          <div className={styles.previewWelcome}>
            <span className={styles.previewWelcomeTitle}>
              <i className="fas fa-hand-sparkles" aria-hidden="true" />
              {isHt ? 'Apre yon moun antre' : 'After someone joins'}
            </span>
            <ul>
              <li>{isHt ? 'Prezante tèt li nan yon premye pòs' : 'Introduce themselves in a first post'}</li>
              {previewRules.length > 0 && (
                <li>{isHt ? 'Li règleman kominote a' : 'Read the house rules'}</li>
              )}
              <li>{isHt ? 'Wè evènman ki gen pou rive' : 'See what events are coming up'}</li>
              <li>{isHt ? 'Envite yon zanmi' : 'Invite a friend'}</li>
            </ul>
          </div>
        </div>
      )}

      {!isMember && previewRules.length > 0 && (
        <div className={styles.previewRules}>
          <span className={styles.previewRulesTitle}>
            <i className="fas fa-scroll" aria-hidden="true" />
            {isHt ? 'Règleman' : 'House rules'}
          </span>
          <ol>
            {previewRules.map((rule) => (
              <li key={`${rule.title}-${rule.description || ''}`}>
                <strong>{rule.title}</strong>
                {rule.description && <span> — {rule.description}</span>}
              </li>
            ))}
          </ol>
          {(rules || []).length > previewRules.length && (
            <span className={styles.previewMore}>
              +{(rules || []).length - previewRules.length} {isHt ? 'lòt règ' : 'more rules'}
            </span>
          )}
        </div>
      )}

      <p className={styles.previewHint}>
        <i className="fas fa-circle-info" aria-hidden="true" />
        {isMember
          ? joinCopy.hint
          : (isHt
            ? 'Se sa yon vizitè wè anvan l antre. CTA a chanje selon fason antre ou chwazi a.'
            : 'This is what a visitor sees before joining. The button follows the join mode you chose.')}
      </p>
    </aside>
  );
}
