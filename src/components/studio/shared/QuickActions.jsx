/**
 * src/components/studio/shared/QuickActions.jsx
 *
 * Quick Actions bar — big action buttons shown at the top of the Dashboard.
 * Offers one-click access to the most common creator workflows:
 * create course, create product, create portfolio, upload media, view profile.
 *
 * Prompt 22 v2: Each button either opens a creation modal or navigates
 * to the relevant studio section.
 *
 * Extracted from CreatorStudio.jsx during Etap 1 refactor.
 */
import React from 'react';
import styles from './shared.module.css';

export default function QuickActions({
  lang,
  setActiveSection,
  setShowCourseModal,
  setShowProductModal,
  setShowProjectModal,
  showToast,
}) {
  const isHt = lang === 'ht';

  const actions = [
    {
      id: 'create_course',
      icon: 'fa-graduation-cap',
      label: isHt ? 'Kreye Kou' : 'Create Course',
      handler: () => setShowCourseModal(true),
    },
    {
      id: 'create_product',
      icon: 'fa-cube',
      label: isHt ? 'Kreye Pwodwi' : 'Create Product',
      handler: () => setShowProductModal(true),
    },
    {
      id: 'create_portfolio',
      icon: 'fa-briefcase',
      label: isHt ? 'Kreye Pòtfolyo' : 'Create Portfolio',
      handler: () => setShowProjectModal(true),
    },
    {
      id: 'upload_media',
      icon: 'fa-cloud-upload-alt',
      label: isHt ? 'Mete URL Medya' : 'Upload Media URL',
      handler: () => setActiveSection('media'),
    },
    {
      id: 'view_profile',
      icon: 'fa-user-circle',
      label: isHt ? 'Pwofil Piblik' : 'View Public Profile',
      handler: () => setActiveSection('public_profile'),
    },
  ];

  return (
    <div className={styles.quickActions}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={styles.quickActionBtn}
          onClick={action.handler}
          aria-label={action.label}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              action.handler();
            }
          }}
        >
          <i className={`fas ${action.icon}`} aria-hidden="true" />
          <span className={styles.quickActionLabel}>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
