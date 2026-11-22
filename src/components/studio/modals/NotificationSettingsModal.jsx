/**
 * src/components/studio/modals/NotificationSettingsModal.jsx
 *
 * Modal for managing notification preferences. Saves locally + PATCHes API.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor.
 */
import React, { useState, useCallback } from 'react';
import api from '../../../services/api';
import { ensureBrowserNotificationPermission } from '../../../services/notificationPermission';
import { StudioModal, LoadingOverlay } from './shared';
import styles from './modals.module.css';
import { inlineText } from '../../../utils/inlineI18n';

export default function NotificationSettingsModal({ onClose, onSuccess, lang, showToast }) {
  const [prefs, setPrefs] = useState({
    new_sales: true, new_students: true, new_reviews: true,
    new_followers: true, course_approved: true, course_rejected: true,
    payout_updates: true, weekly_digest: false,
    email_notifications: true, push_notifications: true,
  });
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async (key) => {
    // ─── push_notifications: request browser permission first ───
    // Keep this in one centralized helper so the app cannot drift to
    // ad-hoc permission requests in multiple places.
    if (key === 'push_notifications') {
      const nextValue = !prefs.push_notifications;
      if (nextValue) {
        try {
          const { granted } = await ensureBrowserNotificationPermission();
          if (!granted) {
            showToast?.(
              lang === 'ht' ? '❌ Navigatè a pa t bay pèmisyon pou notifikasyon push.'
                : inlineText(lang, '❌ The browser did not grant push notification permission.'),
              'circle-exclamation',
            );
            return;
          }
        } catch {
          showToast?.(
            lang === 'ht' ? '❌ Navigatè a pa t reponn pou pèmisyon notifikasyon.'
              : inlineText(lang, '❌ The browser did not respond to the permission request.'),
            'circle-exclamation',
          );
          return;
        }
      }
    }
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }, [prefs.push_notifications, lang, showToast]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.(); setLoading(true);
    try {
      try { localStorage.setItem('studio_notification_prefs', JSON.stringify(prefs)); }
      catch (_) { /* unavailable */ }
      await api.patch('session/me/', { notification_prefs: prefs });
      showToast?.(
        lang === 'ht' ? '✅ Preferans notifikasyon mete ajou!' : inlineText(lang, '✅ Notification preferences updated!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch {
      showToast?.(
        lang === 'ht' ? '💾 Preferans yo sove lokalman.' : inlineText(lang, '💾 Preferences saved locally.'),
        'info-circle',
      );
      onSuccess?.(); onClose?.();
    } finally { setLoading(false); }
  }, [prefs, lang, showToast, onSuccess, onClose]);

  const toggle = (key, label) => (
    <div className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <button type="button"
        className={`${styles.toggle} ${prefs[key] ? styles.toggleOn : ''}`}
        onClick={() => handleToggle(key)}
        role="switch" aria-checked={prefs[key]} aria-label={label}>
        <span className={styles.toggleKnob} />
      </button>
    </div>
  );

  return (
    <StudioModal onClose={onClose} icon="fa-bell"
      title={lang === 'ht' ? 'Notifikasyon' : inlineText(lang, 'Notifications')}
      subtitle={lang === 'ht' ? 'Kontwole kisa ou vle resevwa' : inlineText(lang, 'Control what you want to receive')}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <LoadingOverlay loading={loading}>
          <div className={styles.toggleGroup}>
            <h4 className={styles.toggleSectionTitle}>
              {lang === 'ht' ? '💼 Biznis' : inlineText(lang, '💼 Business')}
            </h4>
            {toggle('new_sales', lang === 'ht' ? 'Nouvo Vant' : inlineText(lang, 'New Sales'))}
            {toggle('new_students', lang === 'ht' ? 'Nouvo Elèv' : inlineText(lang, 'New Students'))}
            {toggle('new_reviews', lang === 'ht' ? 'Nouvo Revizyon' : inlineText(lang, 'New Reviews'))}

            <h4 className={styles.toggleSectionTitle} style={{ marginTop: 12 }}>
              {lang === 'ht' ? '📚 Kou' : inlineText(lang, '📚 Courses')}
            </h4>
            {toggle('course_approved', lang === 'ht' ? 'Kou Apwouve' : inlineText(lang, 'Course Approved'))}
            {toggle('course_rejected', lang === 'ht' ? 'Kou Rejete' : inlineText(lang, 'Course Rejected'))}
            {toggle('payout_updates', lang === 'ht' ? 'Mizajou Peman' : inlineText(lang, 'Payout Updates'))}

            <h4 className={styles.toggleSectionTitle} style={{ marginTop: 12 }}>
              {lang === 'ht' ? '📬 Metòd' : inlineText(lang, '📬 Delivery')}
            </h4>
            {toggle('email_notifications', 'Email')}
            {/* Phase 10: accessible push notification explanation */}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 8px', lineHeight: 1.4 }}>
              {lang === 'ht'
                ? 'Atelnyo bezwen pèmisyon navigatè a sèlman lè ou chwazi resevwa notifikasyon push.'
                : inlineText(lang, 'Atelnyo needs browser permission only when you choose to receive push notifications.')}
            </p>
            {toggle('push_notifications', 'Push')}
            {toggle('weekly_digest', lang === 'ht' ? 'Rezime chak Semèn' : inlineText(lang, 'Weekly Digest'))}
          </div>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Fèmen' : inlineText(lang, 'Close')}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : inlineText(lang, 'Saving...')}</>
            ) : (
              <><i className="fas fa-save" /> {lang === 'ht' ? 'Sove Preferans' : inlineText(lang, 'Save Preferences')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
