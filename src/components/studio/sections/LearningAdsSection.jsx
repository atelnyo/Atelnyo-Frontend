import React, { useCallback, useEffect, useState } from 'react';
import { learningPromotionService } from '../../../services/api';
import { EmptyState, SectionHeader } from '../shared';
import styles from './sections.module.css';

export default function LearningAdsSection({ lang = 'ht', showToast }) {
  const isHt = lang === 'ht';
  const tr = (en, ht) => (isHt ? ht : en);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', video_url: '', destination_url: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await learningPromotionService.list();
      const data = response?.data;
      setAds(Array.isArray(data) ? data : (data?.results || []));
    } catch {
      setError(tr('Could not load promotional videos.', 'Pa t kapab chaje videyo pwomosyon yo.'));
    } finally {
      setLoading(false);
    }
  }, [isHt]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await learningPromotionService.create({
        title: form.title.trim(),
        video_url: form.video_url.trim(),
        destination_url: form.destination_url.trim(),
      });
      setForm({ title: '', video_url: '', destination_url: '' });
      showToast?.(tr('Video submitted for review.', 'Videyo a voye pou revizyon.'), 'check-circle');
      await load();
    } catch (e) {
      setError(e?.response?.data?.video_url?.[0]
        || e?.response?.data?.detail
        || tr('Could not submit the video.', 'Pa t kapab voye videyo a.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (ad) => {
    setError('');
    try {
      await learningPromotionService.update(ad.id, { is_active: !ad.is_active });
      await load();
    } catch {
      setError(tr('Could not update the promotion.', 'Pa t kapab mete pwomosyon an ajou.'));
    }
  };

  const remove = async (ad) => {
    if (!window.confirm(tr(`Delete "${ad.title}"?`, `Efase "${ad.title}"?`))) return;
    try {
      await learningPromotionService.remove(ad.id);
      setAds((previous) => previous.filter((item) => item.id !== ad.id));
    } catch {
      setError(tr('Could not delete the promotion.', 'Pa t kapab efase pwomosyon an.'));
    }
  };

  return (
    <section className={styles.section}>
      <SectionHeader
        icon="fa-circle-play"
        title={tr('Rewarded learning videos', 'Videyo rekonpans pou aprantisaj')}
        lang={lang}
        help={{
          ht: 'Voye yon videyo HTTPS ki dire omwen 10 segonn. Apre ekip la apwouve li, elèv yo ka gade l pou jwenn 1 kè (jiska 3 pa jou).',
          en: 'Submit an HTTPS video at least 10 seconds long. After staff approval, learners can watch it to earn 1 heart (up to 3 per day).',
        }}
      />
      <form className={styles.promoForm} onSubmit={submit}>
        <div className={styles.promoFormGrid}>
          <label className={styles.promoField}>
            <span>{tr('Promotion title', 'Tit pwomosyon an')}</span>
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className={styles.promoField}>
            <span>{tr('Direct video URL (HTTPS)', 'Adrès videyo dirèk (HTTPS)')}</span>
            <input
              required
              type="url"
              placeholder="https://…/video.mp4"
              value={form.video_url}
              onChange={(e) => setForm((prev) => ({ ...prev, video_url: e.target.value }))}
            />
          </label>
          <label className={styles.promoField}>
            <span>{tr('Destination link (optional)', 'Lyen destinasyon (opsyonèl)')}</span>
            <input
              type="url"
              placeholder="https://…"
              value={form.destination_url}
              onChange={(e) => setForm((prev) => ({ ...prev, destination_url: e.target.value }))}
            />
          </label>
        </div>
        {error && <p className={styles.promoFormError} role="alert">{error}</p>}
        <div className={styles.promoFormActions}>
          <button type="submit" className={styles.promoCreate} disabled={busy}>
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
            {busy ? tr('Submitting…', 'Ap voye…') : tr('Submit for review', 'Voye pou revizyon')}
          </button>
        </div>
      </form>

      {loading ? (
        <p role="status">{tr('Loading promotions…', 'Ap chaje pwomosyon yo…')}</p>
      ) : ads.length === 0 ? (
        <EmptyState
          icon="fa-video"
          title={tr('No promotional videos yet', 'Poko gen videyo pwomosyon')}
          hint={tr('Submit a video above. It must be approved before learners can see it.', 'Voye yon videyo anlè a. Yo dwe apwouve l anvan elèv yo ka wè l.')}
        />
      ) : (
        <div className={styles.list}>
          {ads.map((ad) => (
            <div className={styles.listItem} key={ad.id}>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  <strong>{ad.title}</strong>
                  <span className={`${styles.badge} ${ad.is_approved ? styles.badgePublished : styles.badgePending}`}>
                    {ad.is_approved
                      ? (ad.is_active ? tr('Approved · active', 'Apwouve · aktif') : tr('Approved · paused', 'Apwouve · poz'))
                      : tr('Pending review', 'Ap tann revizyon')}
                  </span>
                </div>
                <div className={styles.listMeta}>
                  <a href={ad.video_url} target="_blank" rel="noreferrer">{tr('Preview video', 'Gade videyo')}</a>
                </div>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.editBtn} onClick={() => toggle(ad)}
                  title={ad.is_active ? tr('Pause', 'Poz') : tr('Activate', 'Aktive')}>
                  <i className={`fas ${ad.is_active ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={() => remove(ad)}
                  title={tr('Delete', 'Efase')}>
                  <i className="fas fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
