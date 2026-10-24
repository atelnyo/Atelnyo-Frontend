/**
 * src/components/studio/sections/SettingsSection.jsx
 *
 * Settings section — grid of setting controls (Profile, Branding,
 * Notifications, Verification, Password). Each card is ONE accessible
 * button (click / Enter / Space) that opens the corresponding modal —
 * no nested interactive elements, so focus and touch behave predictably.
 *
 * The Verification card carries a live status badge (fetched from
 * walletService.identityStatus, same source the KYC modal uses) so the
 * section doubles as a status dashboard, not just a launcher.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 * Responsiveness + control semantics reworked (2026-10).
 */
import React, { useEffect, useState } from 'react';
import { SectionHeader } from '../shared';
import { walletService } from '../../../services/api';
import PrintifyConnectionCard from './PrintifyConnectionCard';
import styles from './sections.module.css';

// KYC status → badge label + variant class (lang-aware).
function kycBadge(status, lang) {
  const isHt = lang === 'ht';
  switch (status) {
    case 'approved':
      return { cls: styles.settingsStatusApproved, label: isHt ? 'Verifye' : 'Verified' };
    case 'pending':
      return { cls: styles.settingsStatusPending, label: isHt ? 'Ap tann' : 'Pending' };
    case 'rejected':
      return { cls: styles.settingsStatusRejected, label: isHt ? 'Rejete' : 'Rejected' };
    default:
      return { cls: styles.settingsStatusNeutral, label: isHt ? 'Pa verifye' : 'Not verified' };
  }
}

// One reusable card control: whole card is the button.
// Declared at module scope so it is NOT re-created on every render
// (react-hooks/static-components) and never remounts.
function SettingCard({ icon, title, desc, onOpen, statusBadge, editLabel }) {
  return (
    <button
      type="button"
      className={styles.settingsCard}
      onClick={onOpen}
      aria-label={`${title} — ${editLabel}`}
    >
      <span className={styles.settingsCardIcon} aria-hidden="true">
        <i className={`fas ${icon}`} />
      </span>
      <span className={styles.settingsCardBody}>
        <span className={styles.settingsCardTitle}>{title}</span>
        <span className={styles.settingsCardDesc}>{desc}</span>
      </span>
      {statusBadge && <span className={`${styles.settingsStatusBadge} ${statusBadge.cls}`}>{statusBadge.label}</span>}
      <span className={styles.settingsCardEdit}>{editLabel}</span>
      <i className={`fas fa-chevron-right ${styles.settingsCardChevron}`} aria-hidden="true" />
    </button>
  );
}

export default function SettingsSection({
  lang,
  t,
  showToast,
  setShowProfileModal,
  setShowPasswordModal,
  setShowBrandingModal,
  setShowNotifModal,
  setShowVerifModal,
}) {
  // Live KYC status for the Verification card badge.
  // null = loading (badge hidden), string = known status.
  const [kycStatus, setKycStatus] = useState(null);
  useEffect(() => {
    let cancelled = false;
    walletService.identityStatus()
      .then((resp) => { if (!cancelled) setKycStatus(resp?.data?.status || 'unverified'); })
      .catch(() => { if (!cancelled) setKycStatus('unverified'); });
    return () => { cancelled = true; };
  }, []);

  const badge = kycBadge(kycStatus, lang);
  const isHt = lang === 'ht';
  const editLabel = t.studio_edit || 'Edit';

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-sliders-h"
        title={t.studio_creator_settings || 'Creator Settings'}
        lang={lang}
        help={{
          ht: 'Jere tout anviwònman kreyatè ou — pwofil, branding (koulè/logo/kouvèti), notifikasyon, verifikasyon (KYC) ak modpas. Klike sou yon kat pou louvri editè ki koresponn lan.',
          en: 'Manage all your creator settings — profile, branding (colors/logo/cover), notifications, verification (KYC) and password. Click a card to open its editor.',
        }}
        tip={isHt
          ? 'Verifikasyon (KYC) nesesè pou debloke retrè ak fonksyonalite premium.'
          : 'Verification (KYC) is required to unlock payouts and premium features.'}
      />
      <div className={styles.settingsGrid}>
        <SettingCard
          icon="fa-user-circle"
          title={t.studio_profile || 'Profile'}
          desc={t.studio_profile_hint || 'Manage your public creator profile, bio, and avatar.'}
          onOpen={() => setShowProfileModal(true)}
          editLabel={editLabel}
        />
        <SettingCard
          icon="fa-palette"
          title={t.studio_branding || 'Branding'}
          desc={t.studio_branding_hint || 'Customize your store colors, logo, and cover image.'}
          onOpen={() => setShowBrandingModal(true)}
          editLabel={editLabel}
        />
        <SettingCard
          icon="fa-bell"
          title={t.studio_notifications || 'Notifications'}
          desc={t.studio_notifications_hint || 'Configure what alerts you receive and how.'}
          onOpen={() => setShowNotifModal(true)}
          editLabel={editLabel}
        />
        <SettingCard
          icon="fa-shield-alt"
          title={t.studio_verification || 'Verification'}
          desc={t.studio_verification_hint || 'Complete your KYC to unlock payouts and premium features.'}
          onOpen={() => setShowVerifModal(true)}
          statusBadge={kycStatus ? badge : null}
          editLabel={editLabel}
        />
        <SettingCard
          icon="fa-key"
          title={isHt ? 'Modpas' : 'Password'}
          desc={isHt ? 'Chanje modpas koneksyon ou an.' : 'Change your login password.'}
          onOpen={() => setShowPasswordModal(true)}
          editLabel={editLabel}
        />
      </div>
      <PrintifyConnectionCard isHt={isHt} showToast={showToast} />
    </div>
  );
}
