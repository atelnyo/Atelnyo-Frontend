/**
 * src/components/studio/modals/PasswordChangeModal.jsx
 *
 * Modal for changing the authenticated user's password.
 */
import React, { useState, useCallback, useEffect } from 'react';
import api, { broadcastLogout, authService } from '../../../services/api';
import { executeRecaptcha, getRecaptchaV3Key, cacheRecaptchaKeys } from '../../../services/recaptcha';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';

export default function PasswordChangeModal({ onClose, lang, showToast }) {
  const isHt = lang === 'ht';
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // T008 — top up the reCAPTCHA site key from the public runtime config
  // (usually cached by Auth.jsx; one-shot fetch here for users who never
  // opened the auth modal). Best-effort — a failed fetch keeps the
  // build-time key (if any) and CAPTCHA degrades to a no-op.
  useEffect(() => {
    if (getRecaptchaV3Key()) return undefined;
    let cancelled = false;
    api.get('config/public/')
      .then((res) => {
        if (cancelled) return;
        const siteKey = (res?.data?.recaptcha_site_key || '').trim();
        if (siteKey) cacheRecaptchaKeys({ siteKey });
      })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!form.current_password || !form.new_password) {
      setError(isHt ? 'Antre modpas aktyèl ak nouvo modpas la.' : 'Enter current and new password.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError(isHt ? 'Nouvo modpas yo pa menm.' : 'New passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // T008 — invisible v3 token for this sensitive action ('' when
      // CAPTCHA is not configured — the backend check is a no-op then).
      const recaptchaToken = await executeRecaptcha(getRecaptchaV3Key(), 'change_password');
      await authService.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
        ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
      });
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      } catch (_) {}
      broadcastLogout('password_changed');
      showToast?.(
        isHt ? 'Modpas la chanje. Ou dekonekte.' : 'Password changed. Logged out.',
        'key',
      );
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error
        || err?.response?.data?.detail
        || err?.message
        || (isHt ? 'Pa t kapab chanje modpas la.' : 'Could not change password.');
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [form, isHt, onClose, showToast]);

  return (
    <StudioModal
      onClose={onClose}
      icon="fa-key"
      title={isHt ? 'Chanje Modpas' : 'Change Password'}
      subtitle={isHt ? 'Verifye modpas aktyèl la anvan ou mete yon nouvo.' : 'Confirm your current password before setting a new one.'}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.apiError} role="alert">{error}</div>}
        <LoadingOverlay loading={loading}>
          <FormField label={isHt ? 'Modpas aktyèl' : 'Current password'} required>
            <input
              className={styles.input}
              type="password"
              value={form.current_password}
              onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label={isHt ? 'Nouvo modpas' : 'New password'} required>
            <input
              className={styles.input}
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label={isHt ? 'Konfime nouvo modpas' : 'Confirm new password'} required>
            <input
              className={styles.input}
              type="password"
              value={form.confirm_password}
              onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
              autoComplete="new-password"
            />
          </FormField>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {isHt ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap sove...' : 'Saving...'}</>
            ) : (
              <><i className="fas fa-key" /> {isHt ? 'Chanje Modpas' : 'Change Password'}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
