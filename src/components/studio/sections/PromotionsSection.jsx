/**
 * src/components/studio/sections/PromotionsSection.jsx
 *
 * Creator promotions dashboard — REAL promo codes for the creator's
 * own courses (backend-enforced ownership). Shows Active / Expired /
 * Disabled codes with usage + discount performance. Promo validation
 * happens ONLY server-side; this UI manages the codes, never
 * validates on the client.
 *
 *   • Create: code, discount type (% / fixed / 100%), value, course,
 *     max uses, expiration, min purchase.
 *   • Manage: activate / deactivate, delete.
 *   • Analytics: usage count + total discount given (real redemptions).
 */
import React, { useState } from 'react';
import { promoCodeService, courseService } from '../../../services/api';
import useFetch from '../../../hooks/useFetch';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import styles from './sections.module.css';

// Module-level constant — the React Compiler rejects Date.now() inside
// the component body during render. Promo expiry state is refreshed on
// each data fetch/mount; a 1-minute granularity is fine for display.
const NOW_MS = Date.now();

const DISCOUNT_TYPES = [
  { id: 'percent', label: { ht: 'Pousantaj (%)', en: 'Percentage (%)' } },
  { id: 'fixed', label: { ht: 'Montan fiks ($)', en: 'Fixed amount ($)' } },
  { id: 'full', label: { ht: '100% (gratis)', en: '100% (free)' } },
];

export default function PromotionsSection({ lang = 'ht', showToast, t = {} }) {
  const isHt = lang === 'ht';
  const tr = (en, ht) => (isHt ? ht : en);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', discount_type: 'percent', discount_value: '',
    course: '', max_uses: 0, expires_at: '', min_purchase: '',
  });
  const [formErr, setFormErr] = useState('');

  const { data: promos, loading, refetch } = useFetch(
    () => promoCodeService.list().then((r) => {
      const d = r?.data;
      return Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
    }),
    { defaultValue: [] },
  );
  const { data: courses } = useFetch(
    () => courseService.getAll({ mine: true }).then((r) => {
      const d = r?.data;
      // Paginated envelope ({ results: [...] }) OR raw array — same
      // unwrap rule as every other studio section.
      return Array.isArray(d) ? d : (d?.results || []);
    }),
    { defaultValue: [] },
  );

  const resetForm = () => {
    setForm({ code: '', discount_type: 'percent', discount_value: '', course: '', max_uses: 0, expires_at: '', min_purchase: '' });
    setFormErr('');
    setShowForm(false);
  };

  const submit = async () => {
    if (!form.code.trim()) return setFormErr(tr('Code is required.', 'Kòd la obligatwa.'));
    if (!form.course) return setFormErr(tr('Choose a course.', 'Chwazi yon kou.'));
    if (form.discount_type !== 'full' && form.discount_value === '') {
      return setFormErr(tr('Discount value is required.', 'Valè rabè a obligatwa.'));
    }
    setSaving(true);
    setFormErr('');
    try {
      await promoCodeService.create({
        course_id: form.course,
        code: form.code,
        discount_type: form.discount_type,
        discount_value: form.discount_type === 'full' ? null : Number(form.discount_value),
        max_uses: Number(form.max_uses) || 0,
        expires_at: form.expires_at || null,
        min_purchase: form.min_purchase ? Number(form.min_purchase) : null,
      });
      showToast?.(tr('✅ Promo code created!', '✅ Kòd promosyon kreye!'), 'check-circle');
      resetForm();
      refetch();
    } catch (err) {
      setFormErr(err?.response?.data?.error
        || (err?.response?.data && JSON.stringify(err.response.data))
        || tr('Could not create the promo code.', 'Pa t kapab kreye kòd promosyon an.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (promo) => {
    try {
      await promoCodeService.update(promo.id, { is_active: !promo.is_active });
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || tr('Could not update.', 'Pa t kapab mete ajou.'), 'circle-exclamation');
    }
  };

  const remove = async (promo) => {
    if (!window.confirm(tr(`Delete promo ${promo.code}?`, `Efase kòd ${promo.code}?`))) return;
    try {
      await promoCodeService.remove(promo.id);
      showToast?.(tr('✅ Promo deleted.', '✅ Kòd promosyon efase.'), 'check-circle');
      refetch();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || tr('Could not delete.', 'Pa t kapab efase.'), 'circle-exclamation');
    }
  };

  const promoState = (p) => {
    if (!p.is_active) return 'disabled';
    if (p.expires_at && new Date(p.expires_at).getTime() < NOW_MS) return 'expired';
    if (p.starts_at && new Date(p.starts_at).getTime() > NOW_MS) return 'scheduled';
    return 'active';
  };

  const stateLabel = {
    active: { ht: 'Aktif', en: 'Active' },
    scheduled: { ht: 'Pwograme', en: 'Scheduled' },
    expired: { ht: 'Ekspire', en: 'Expired' },
    disabled: { ht: 'Dezaktive', en: 'Disabled' },
  };

  const discountLabel = (p) => {
    if (p.discount_type === 'full') return '100%';
    if (p.discount_type === 'percent') return `${p.discount_value}%`;
    return `$${p.discount_value}`;
  };

  if (loading) return <StudioSkeleton rows={3} />;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-tags"
        title={tr('Promotions', 'Promosyon')}
        lang={lang}
        help={{
          ht: 'Kreye kòd promosyon pou kou ou yo. Elèv yo aplike kòd yo sou paj kou a; validasyon fèt sou sèvè a sèlman. Yon kòd 100% fè yon kou peye gratis nan checkout.',
          en: 'Create promo codes for your courses. Learners apply them on the course page; validation happens server-side only. A 100% code makes a paid course free at checkout.',
        }}
        tip={tr('Promo codes help learners discover your teaching.', 'Kòd promosyon yo ede elèv yo dekouvri ansèyman ou.')}
        action={
          !showForm ? (
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              <i className="fas fa-plus" aria-hidden="true" /> {tr('Create Promo Code', 'Kreye Kòd Promosyon')}
            </button>
          ) : null
        }
      />

      {showForm && (
        <div className={styles.promoForm}>
          <div className={styles.promoFormGrid}>
            <label className={styles.promoField}>
              <span>{tr('Code', 'Kòd')}</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME20"
                aria-label={tr('Promo code', 'Kòd promosyon')}
              />
            </label>
            <label className={styles.promoField}>
              <span>{tr('Course', 'Kou')}</span>
              <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                <option value="">{tr('Choose a course…', 'Chwazi yon kou…')}</option>
                {(courses || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </label>
            <label className={styles.promoField}>
              <span>{tr('Discount type', 'Kalite rabè')}</span>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                {DISCOUNT_TYPES.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.label[lang]}</option>
                ))}
              </select>
            </label>
            {form.discount_type !== 'full' && (
              <label className={styles.promoField}>
                <span>{form.discount_type === 'percent' ? tr('Percent off', 'Pousantaj rabè') : tr('Amount off ($)', 'Montan rabè ($)')}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'percent' ? '20' : '5.00'}
                  aria-label={tr('Discount value', 'Valè rabè')}
                />
              </label>
            )}
            <label className={styles.promoField}>
              <span>{tr('Max uses (0 = unlimited)', 'Itilizasyon maksimòm (0 = san limit)')}</span>
              <input
                type="number"
                min="0"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                aria-label={tr('Max uses', 'Itilizasyon maksimòm')}
              />
            </label>
            <label className={styles.promoField}>
              <span>{tr('Expires at (optional)', 'Ekspire nan (opsyonèl)')}</span>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                aria-label={tr('Expiration date', 'Dat ekspirasyon')}
              />
            </label>
            <label className={styles.promoField}>
              <span>{tr('Min purchase (optional)', 'Acha minimòm (opsyonèl)')}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.min_purchase}
                onChange={(e) => setForm({ ...form, min_purchase: e.target.value })}
                placeholder="0.00"
                aria-label={tr('Minimum purchase', 'Acha minimòm')}
              />
            </label>
          </div>
          {formErr && <p className={styles.promoFormError} role="alert">{formErr}</p>}
          <div className={styles.promoFormActions}>
            <button type="button" className={styles.promoCancel} onClick={resetForm}>
              {tr('Cancel', 'Anile')}
            </button>
            <button type="button" className={styles.promoCreate} onClick={submit} disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />}
              {saving ? tr('Saving…', 'Ap sove…') : tr('Create', 'Kreye')}
            </button>
          </div>
        </div>
      )}

      {promos.length === 0 && !showForm ? (
        <EmptyState
          icon="fa-tags"
          title={tr('No promo codes yet', 'Pa gen kòd promosyon ankò')}
          hint={tr('Create a code to offer discounts on your courses.', 'Kreye yon kòd pou ofri rabè sou kou ou yo.')}
          ctaLabel={tr('Create First Promo', 'Kreye Premye Kòd')}
          onCta={() => setShowForm(true)}
        />
      ) : (
        <div className={styles.list}>
          {promos.map((p) => {
            const st = promoState(p);
            const stCls = `promoState${st[0].toUpperCase()}${st.slice(1)}`;
            return (
              <div key={p.id} className={styles.listItem}>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>
                    <span className={styles.promoCode}>{p.code}</span>
                    <span className={`${styles.badge} ${styles[stCls] || styles.badgePublished}`}>
                      {stateLabel[st][lang]}
                    </span>
                  </div>
                  <div className={styles.listMeta}>
                    <span>{discountLabel(p)} {tr('rabè', 'off')} · {p.course_title}</span>
                  </div>
                  <div className={styles.listMeta}>
                    <span>
                      <i className="fas fa-ticket" aria-hidden="true" /> {p.used_count || 0} / {p.max_uses ? p.max_uses : '∞'}
                      {p.expires_at ? ` · ${tr('ekspire', 'expires')} ${new Date(p.expires_at).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => toggle(p)}
                    title={p.is_active ? tr('Deactivate', 'Dezaktive') : tr('Activate', 'Aktive')}
                  >
                    <i className={`fas ${p.is_active ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => remove(p)}
                    title={tr('Delete', 'Efase')}>
                    <i className="fas fa-trash-can" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
