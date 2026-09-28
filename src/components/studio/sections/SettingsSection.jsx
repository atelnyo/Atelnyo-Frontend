/**
 * src/components/studio/sections/SettingsSection.jsx
 *
 * Settings section — grid of setting cards (Profile, Branding, Notifications,
 * Verification). Each card has an icon, title, description, and edit button
 * that opens the corresponding modal.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React from 'react';
import { SectionHeader } from '../shared';
import styles from './sections.module.css';

export default function SettingsSection({
  lang,
  t,
  setShowProfileModal,
  setShowPasswordModal,
  setShowBrandingModal,
  setShowNotifModal,
  setShowVerifModal,
}) {
  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-sliders-h"
        title={t.studio_creator_settings || 'Creator Settings'}
        lang={lang}
        help={{
          ht: 'Jere tout anviwònman kreyatè ou — pwofil, branding (koulè/logo/kouvèti), notifikasyon, verifikasyon (KYC) ak modpas. Chak kat louvri modal ki koresponn lan.',
          en: 'Manage all your creator settings — profile, branding (colors/logo/cover), notifications, verification (KYC) and password. Each card opens its own editor.',
        }}
        tip={lang === 'ht'
          ? 'Verifikasyon (KYC) nesesè pou debloke retrè ak fonksyonalite premium.'
          : 'Verification (KYC) is required to unlock payouts and premium features.'}
      />
      <div className={styles.settingsGrid}>
        <div className={styles.settingsCard}>
          <i className="fas fa-user-circle" aria-hidden="true" />
          <h4>{t.studio_profile || 'Profile'}</h4>
          <p>{t.studio_profile_hint || 'Manage your public creator profile, bio, and avatar.'}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowProfileModal(true)}
          >
            {t.studio_edit || 'Edit'}
          </button>
        </div>
        <div className={styles.settingsCard}>
          <i className="fas fa-palette" aria-hidden="true" />
          <h4>{t.studio_branding || 'Branding'}</h4>
          <p>{t.studio_branding_hint || 'Customize your store colors, logo, and cover image.'}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowBrandingModal(true)}
          >
            {t.studio_edit || 'Edit'}
          </button>
        </div>
        <div className={styles.settingsCard}>
          <i className="fas fa-bell" aria-hidden="true" />
          <h4>{t.studio_notifications || 'Notifications'}</h4>
          <p>{t.studio_notifications_hint || 'Configure what alerts you receive and how.'}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowNotifModal(true)}
          >
            {t.studio_edit || 'Edit'}
          </button>
        </div>
        <div className={styles.settingsCard}>
          <i className="fas fa-shield-alt" aria-hidden="true" />
          <h4>{t.studio_verification || 'Verification'}</h4>
          <p>{t.studio_verification_hint || 'Complete your KYC to unlock payouts and premium features.'}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowVerifModal(true)}
          >
            {t.studio_edit || 'Edit'}
          </button>
        </div>
        <div className={styles.settingsCard}>
          <i className="fas fa-key" aria-hidden="true" />
          <h4>{lang === 'ht' ? 'Modpas' : 'Password'}</h4>
          <p>{lang === 'ht' ? 'Chanje modpas koneksyon ou an.' : 'Change your login password.'}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowPasswordModal(true)}
          >
            {t.studio_edit || 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );
}
