/**
 * Compact completeness card for the public-profile editor.
 *
 * Uses the backend's persisted score (no client-side guessing) and lets a
 * creator jump straight to the editor tab that fixes each missing field.
 */
import React, { useState } from 'react';
import styles from './sections.module.css';
import { inlineText } from '../../../utils/inlineI18n';

export default function ProfileCompletenessCard({
  completeness,
  lang = 'en',
  isDirty = false,
  onJump,
}) {
  const [expanded, setExpanded] = useState(false);
  const isHt = lang === 'ht';

  if (!completeness) {
    return null;
  }

  const { score, missing = [] } = completeness;
  const visible = expanded ? missing : missing.slice(0, 4);
  const title = isHt
    ? (score >= 100 ? 'Pwofil ou konplè' : `Pwofil ou ${score}% konplè`)
    : (score >= 100 ? 'Your profile is complete' : `Your profile is ${score}% complete`);
  const hint = missing.length > 0
    ? (isHt
      ? `${missing.length} bagay ki manke pou pwofil ou parèt pi konplè.`
      : `${missing.length} item${missing.length === 1 ? '' : 's'} missing to make your profile more complete.`)
    : (isHt
      ? 'Tout baz prensipal yo ranpli. Pwofil ou pare pou vizitè yo.'
      : inlineText(lang, 'Every core field is filled in. Your profile is ready for visitors.'));

  return (
    <section className={styles.profileCompletenessCard} aria-labelledby="profile-completeness-title">
      <div className={styles.profileCompletenessTop}>
        <div
          className={styles.profileCompletenessScore}
          style={{ '--profile-complete': score }}
          aria-hidden="true"
        >
          <span>{score}%</span>
        </div>
        <div className={styles.profileCompletenessCopy}>
          <h3 id="profile-completeness-title" className={styles.profileCompletenessTitle}>
            {title}
          </h3>
          <p className={styles.profileCompletenessHint}>{hint}</p>
        </div>
        {isDirty && (
          <span className={styles.profileCompletenessDirty}>
            <i className="fas fa-rotate" aria-hidden="true" />{' '}
            {isHt ? 'Nòt la ap mete ajou apre sove' : inlineText(lang, 'Score updates after saving')}
          </span>
        )}
      </div>

      {missing.length > 0 && (
        <div className={styles.profileCompletenessMissing}>
          {visible.map((item) => {
            const label = isHt ? item.label_ht : item.label;
            if (!item.tab) {
              return (
                <span
                  key={item.key}
                  className={`${styles.profileCompletenessChip} ${styles.profileCompletenessChipStatic}`}
                  title={isHt
                    ? 'Sa a pa modifye nan editè pwofil la.'
                    : inlineText(lang, 'This is managed outside the profile editor.')}
                >
                  {label}
                </span>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                className={styles.profileCompletenessChip}
                onClick={() => onJump?.(item.tab)}
                aria-label={`${isHt ? 'Ale nan' : inlineText(lang, 'Go to')} ${label}`}
              >
                <i className="fas fa-plus" aria-hidden="true" />
                {label}
                <i className="fas fa-arrow-right" aria-hidden="true" />
              </button>
            );
          })}

          {missing.length > 4 && (
            <button
              type="button"
              className={styles.profileCompletenessMore}
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded
                ? (isHt ? 'Mwens' : inlineText(lang, 'Show less'))
                : `+${missing.length - 4} ${isHt ? 'lòt' : inlineText(lang, 'more')}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
