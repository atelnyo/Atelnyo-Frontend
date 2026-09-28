/**
 * src/components/studio/shared/WelcomeHeader.jsx
 *
 * Personalized welcome header shown at the top of the Dashboard.
 * Displays the creator's initial in a gradient avatar, a greeting,
 * and a contextual sub-message based on whether they have activity.
 *
 * Extracted from CreatorStudio.jsx during Etap 1 refactor.
 */
import React from 'react';
import styles from './shared.module.css';

export default function WelcomeHeader({ lang, user, summary, avatarUrl }) {
  const isHt = lang === 'ht';
  const name =
    user?.artist_name ||
    user?.full_name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    (isHt ? 'Kreyatè' : 'Creator');

  const hasData =
    summary && (summary.total_revenue > 0 || summary.total_orders > 0);

  const [imgFailed, setImgFailed] = React.useState(false);

  // Reset imgFailed lè avatarUrl chanje (pou nouvo imaj ka eseye chaje)
  React.useEffect(() => setImgFailed(false), [avatarUrl]);

  return (
    <div className={styles.welcomeHeader}>
      <div className={styles.welcomeAvatar}>
        {avatarUrl && !imgFailed ? (
          <img
            className={styles.welcomeAvatarImg}
            src={avatarUrl}
            alt={name}
            onError={() => setImgFailed(true)}
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
      <div>
        <h2 className={styles.welcomeGreeting}>
          {isHt ? 'Bonjou' : 'Good'}, {name}! 👋
        </h2>
        <p className={styles.welcomeSub}>
          {hasData
            ? (isHt
                ? 'Men sa k ap pase jodi a.'
                : "Here's what's happening today.")
            : (isHt
                ? 'Kòmanse kreye kontni ou kounye a.'
                : 'Start creating your content now.')}
        </p>
      </div>
    </div>
  );
}
