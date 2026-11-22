/**
 * src/components/studio/modals/BrandingModal.jsx
 *
 * Modal for editing brand/artist name. PATCHes /api/me/.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor.
 */
import React, { useState, useCallback } from 'react';
import api, { applyTokenPair } from '../../../services/api';
import { StudioModal, FormField, LoadingOverlay } from './shared';
import styles from './modals.module.css';
import { inlineText } from '../../../utils/inlineI18n';

export default function BrandingModal({ onClose, onSuccess, lang, showToast }) {
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const trimmed = brandName.trim();
    if (!trimmed) {
      setError(lang === 'ht' ? 'Non mak oblije' : inlineText(lang, 'Brand name required'));
      return;
    }
    setError(null); setLoading(true);
    try {
      const res = await api.patch('me/', { username: trimmed });
      // Persist the fresh user blob + notify the app so the Header /
      // Studio / Mwen surfaces reflect the new username immediately.
      if (res?.data) {
        applyTokenPair({ user: res.data });
        try {
          window.dispatchEvent(new CustomEvent('atelnyo:auth:user-updated', {
            detail: { user: res.data },
          }));
        } catch (_) { /* ignore */ }
      }
      showToast?.(
        lang === 'ht' ? '✅ Non mak mete ajou!' : inlineText(lang, '✅ Brand name updated!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.error || err?.response?.data?.detail
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab mete brand la ajou.' : inlineText(lang, 'Could not update brand.'));
      setError(detail);
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [brandName, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-palette"
      title={lang === 'ht' ? 'Non Mak' : inlineText(lang, 'Brand Name')}
      subtitle={lang === 'ht' ? 'Chwazi non mak ou sou Atelnyo' : inlineText(lang, 'Choose your brand name on Atelnyo')}>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.apiError} role="alert">{error}</div>}
        <LoadingOverlay loading={loading}>
          <FormField label={lang === 'ht' ? 'Non Mak / Atis' : inlineText(lang, 'Brand / Artist Name')} required>
            <input className={styles.input} value={brandName}
              onChange={(e) => { setBrandName(e.target.value); setError(null); }}
              placeholder="DJ Rose, Professor Dev, ..."
              maxLength={150} autoFocus />
          </FormField>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {lang === 'ht'
              ? '💡 Non mak ou pral parèt sou pwofil Creator ou. Ou ka itilize yon non atis, non biznis, oswa non lekòl.'
              : inlineText(lang, '💡 Your brand name will appear on your Creator profile. You can use an artist name, business name, or school name.')}
          </p>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : inlineText(lang, 'Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : inlineText(lang, 'Saving...')}</>
            ) : (
              <><i className="fas fa-save" /> {lang === 'ht' ? 'Sove Mak' : inlineText(lang, 'Save Brand')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
