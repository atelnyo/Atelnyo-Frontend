/**
 * src/components/studio/editor/CommunityStarterTemplates.jsx
 *
 * Template strip for a community that has not been saved yet. It turns
 * the empty Profile form into a choice: pick a starting point, then edit
 * the fields it filled. The name is deliberately not part of a template.
 *
 * Applying is not destructive on its own — the editor replaces only the
 * fields the template owns (description, category, hashtags, join mode,
 * rules) and marks the form dirty, so the founder can still rewrite
 * everything before the first save.
 */
/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere (same as the other community panels) */
import React from 'react';
import { COMMUNITY_TEMPLATES } from './communityTemplates';
import styles from './communityEditor.module.css';

const JOIN_LABELS = {
  public: { en: 'Public', ht: 'Piblik' },
  approval: { en: 'Approval', ht: 'Apwobasyon' },
  invite: { en: 'Invite only', ht: 'Envitasyon sèlman' },
};

export default function CommunityStarterTemplates({ lang = 'en', appliedId = '', onApply }) {
  const isHt = lang === 'ht';
  const key = isHt ? 'ht' : 'en';

  return (
    <section className={styles.templateSection} aria-labelledby="community-templates-title">
      <div className={styles.templateSectionHead}>
        <div>
          <h3 className={styles.formTitle} id="community-templates-title">
            <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
            {isHt ? 'Kòmanse ak yon modèl' : 'Start from a template'}
          </h3>
          <p className={styles.hint} style={{ margin: 0 }}>
            {isHt
              ? 'Chwazi yon pwen depa. Nou ranpli deskripsyon, kategori, règ ak fason moun antre — ou ka chanje tout bagay apre.'
              : 'Pick a starting point. We fill the description, category, rules, and join mode — you can change everything afterwards.'}
          </p>
        </div>
        {appliedId && (
          <span className={styles.templateAppliedPill}>
            <i className="fas fa-check" aria-hidden="true" />
            {isHt ? 'Modèl aplike' : 'Template applied'}
          </span>
        )}
      </div>

      <div className={styles.templateGrid}>
        {COMMUNITY_TEMPLATES.map((template) => {
          const applied = template.id === appliedId;
          return (
            <article
              key={template.id}
              className={`${styles.templateCard}${applied ? ` ${styles.templateCardActive}` : ''}`}
            >
              <span className={styles.templateIcon} aria-hidden="true">
                <i className={`fas ${template.icon}`} />
              </span>
              <h4 className={styles.templateTitle}>{template.title[key]}</h4>
              <p className={styles.templateBlurb}>{template.blurb[key]}</p>
              <div className={styles.templateMeta}>
                <span>{template.categoryLabel[key]}</span>
                <span>·</span>
                <span>{JOIN_LABELS[template.join_mode]?.[key] || template.join_mode}</span>
                <span>·</span>
                <span>
                  {template.rules.length} {isHt ? 'règ' : 'rules'}
                </span>
              </div>
              <button
                type="button"
                className={styles.templateUseBtn}
                onClick={() => onApply?.(template)}
                aria-pressed={applied}
              >
                <i className={`fas ${applied ? 'fa-check' : 'fa-arrow-down-to-bracket'}`} aria-hidden="true" />
                {applied
                  ? (isHt ? 'Aplike' : 'Applied')
                  : (isHt ? 'Sèvi ak modèl sa a' : 'Use this template')}
              </button>
            </article>
          );
        })}
      </div>

      <p className={styles.templateScratch}>
        <i className="fas fa-pen" aria-hidden="true" />
        {isHt
          ? 'Oswa kòmanse nan zewo: pa chwazi anyen epi ranpli fòm nan pi ba a.'
          : 'Or start from scratch: choose nothing and fill the form below.'}
      </p>
    </section>
  );
}
