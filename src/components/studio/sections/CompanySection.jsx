/**
 * src/components/studio/sections/CompanySection.jsx
 *
 * Company Profile section — create / edit the owner's in-app
 * company page from the Creator Studio. Mirrors the Spotlight
 * self-service pattern:
 *
 *   * One profile per user (OneToOne backend).
 *   * New profiles start ``pending`` → admin approval required
 *     before the page goes public.
 *   * Editing an approved profile drops it back to ``pending``
 *     (backend-enforced) — the status pill reflects that.
 *   * ``is_verified`` is admin-granted; the owner cannot set it.
 *
 * Data flow
 * ---------
 *   GET  /api/companies/mine/    — load my profile (any status)
 *   POST /api/companies/         — first-time create
 *   PATCH /api/companies/<id>/   — edit existing
 */
import React, { useCallback, useEffect, useState } from 'react';
import { companyProfileService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import styles from './sections.module.css';

const EMPTY_MEMBER = { name: '', role: '', bio: '' };
const EMPTY_OFFERING = { title: '', description: '', icon: 'fa-cube' };
const EMPTY_SOCIAL = { platform: '', url: '' };

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function CompanySection({ lang = 'ht', t, showToast }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);   // null = no profile yet
  const [saving, setSaving] = useState(false);

  // Form state (kept separate so the form can be edited freely)
  const [form, setForm] = useState({
    company_name: '',
    logo_url: '',
    tagline: '',
    description: '',
    country: '',
    city: '',
    website: '',
    social_links: [],
    team_members: [],
    products_services: [],
  });

  const isHt = lang === 'ht';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyProfileService.mine();
      const data = res?.data?.data ?? res?.data ?? null;
      if (data && typeof data === 'object' && data.id) {
        setProfile(data);
        setForm({
          company_name: data.company_name || '',
          logo_url: data.logo_url || '',
          tagline: data.tagline || '',
          description: data.description || '',
          country: data.country || '',
          city: data.city || '',
          website: data.website || '',
          social_links: Array.isArray(data.social_links) ? data.social_links : [],
          team_members: Array.isArray(data.team_members) ? data.team_members : [],
          products_services: Array.isArray(data.products_services) ? data.products_services : [],
        });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null); // 404 = no profile yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Repeatable-row helpers
  const updateRow = (key, idx, patch) =>
    set(key, form[key].map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const addRow = (key, empty) => set(key, [...form[key], { ...empty }]);
  const removeRow = (key, idx) => set(key, form[key].filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      showToast?.(isHt ? 'Non konpanyi a obligatwa.' : 'Company name is required.', 'circle-exclamation');
      return;
    }
    setSaving(true);
    try {
      if (profile?.id) {
        await companyProfileService.update(profile.id, {
          ...form,
          social_links: form.social_links.filter((s) => s.url?.trim()),
          team_members: form.team_members.filter((m) => m.name?.trim()),
          products_services: form.products_services.filter((o) => o.title?.trim()),
        });
      } else {
        await companyProfileService.create({
          ...form,
          social_links: form.social_links.filter((s) => s.url?.trim()),
          team_members: form.team_members.filter((m) => m.name?.trim()),
          products_services: form.products_services.filter((o) => o.title?.trim()),
        });
      }
      showToast?.(
        profile?.id
          ? (isHt ? '✅ Pwofil mete ajou! Sou apwobasyon ankò si li te apwouve.' : '✅ Profile updated! Back to pending if it was approved.')
          : (isHt ? '✅ Pwofil soumèt pou apwobasyon!' : '✅ Profile submitted for approval!'),
        'check-circle',
      );
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.company_name?.[0]
        || (isHt ? 'Pa t kapab sove pwofil la.' : 'Could not save the profile.');
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (status) => ({
    pending: isHt ? 'Annatant apwobasyon' : 'Pending approval',
    approved: isHt ? 'Apwouve — pibliye' : 'Approved — live',
    rejected: isHt ? 'Rejete' : 'Rejected',
  }[status] || status);

  const statusColor = {
    pending: '#fbbf24',
    approved: '#34d399',
    rejected: '#f87171',
  }[profile?.status] || '#94a3b8';

  if (loading) return <StudioSkeleton rows={3} />;

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-building"
        title={t?.company_profile || (isHt ? 'Pwofil Konpanyi' : 'Company Profile')}
        lang={lang}
        help={{
          ht: 'Yon paj konpanyi dedye pou brand ou — non, tagline, logo, istwa, ekip ak pwodwi/sèvis. Soumèt li epi administratè a ap apwouve l anvan li pibliye.',
          en: 'A dedicated company page for your brand — name, tagline, logo, story, team and products/services. Submit it and an admin approves it before it goes public.',
        }}
        tip={isHt
          ? 'Modifye yon pwofil apwouve remèt l annatant apwobasyon ankò.'
          : 'Editing an approved profile drops it back to pending approval.'}
        action={
          profile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                className="studio-company-status-pill"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: `${statusColor}1f`, color: statusColor,
                  border: `1px solid ${statusColor}55`, borderRadius: 999,
                  padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700,
                }}
                data-testid="company-status-pill"
              >
                <i className={`fas ${profile.status === 'approved' ? 'fa-check-circle' : profile.status === 'rejected' ? 'fa-circle-xmark' : 'fa-clock'}`} aria-hidden="true" />
                {statusLabel(profile.status)}
              </span>
              {profile.is_verified && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  color: '#34d399', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  <i className="fas fa-badge-check" aria-hidden="true" />
                  {isHt ? 'Konpanyi Verifye' : 'Verified Company'}
                </span>
              )}
              {profile.status === 'approved' && (
                <a
                  href={`/company/${profile.slug}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#93c5fd', fontSize: '0.8rem', textDecoration: 'none' }}
                  data-testid="company-view-public-link"
                >
                  <i className="fas fa-external-link-alt" aria-hidden="true" /> {isHt ? 'Wè paj piblik' : 'View public page'}
                </a>
              )}
            </div>
          ) : null
        }
      />

      <p className={styles.sectionHint} style={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.82rem', marginBottom: 16 }}>
        {t?.company_profile_hint || (isHt
          ? 'Yon paj konpanyi dedye pou brand ou. Soumèt li, epi administratè a ap apwouve l anvan li pibliye.'
          : 'A dedicated company page for your brand. Submit it and an admin approves it before it goes public.')}
      </p>

      {!profile && !loading && (
        <EmptyState
          icon="fa-building"
          title={t?.company_profile_no_profile || (isHt ? 'Ou poko gen pwofil konpanyi.' : 'No company profile yet.')}
          hint={isHt ? 'Kreye paj konpanyi ou anba a.' : 'Create your company page below.'}
        />
      )}

      {profile?.review_note && (
        <div style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem',
        }} data-testid="company-review-note">
          <strong style={{ color: '#fbbf24' }}>
            {t?.company_profile_review_note || (isHt ? 'Nòt revizyon' : 'Review note')}:
          </strong>{' '}
          <span style={{ color: 'rgba(226,232,240,0.9)' }}>{profile.review_note}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form} data-testid="company-form">
        {/* ─── Identity ───────────────────────────────────────── */}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {t?.company_profile_field_name || (isHt ? 'Non konpanyi / brand' : 'Company / brand name')} *
          </label>
          <input
            type="text"
            className={styles.formInput}
            value={form.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            maxLength={120}
            placeholder={isHt ? 'Egzanp: Kreyatif Studio' : 'e.g. Creative Studio'}
            data-testid="company-form-name"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {t?.company_profile_field_tagline || (isHt ? 'Slogan / tagline' : 'Tagline')}
          </label>
          <input
            type="text"
            className={styles.formInput}
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            maxLength={200}
            placeholder={isHt ? 'Yon fraz ki dekri konpanyi ou' : 'One line that describes your company'}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {t?.company_profile_field_logo || (isHt ? 'Logo (URL)' : 'Logo (URL)')}
          </label>
          <input
            type="url"
            className={styles.formInput}
            value={form.logo_url}
            onChange={(e) => set('logo_url', e.target.value)}
            placeholder="https://…/logo.png"
          />
          {form.logo_url && (
            <img src={form.logo_url} alt="logo preview" loading="lazy"
              style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', marginTop: 8 }} />
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            {t?.company_profile_field_description || (isHt ? 'Istwa konpanyi ou' : 'Company story')}
          </label>
          <textarea
            className={styles.formInput}
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={3000}
            placeholder={isHt ? 'Kisa konpanyi ou fè, pou kisa li egziste...' : 'What your company does, why it exists...'}
          />
        </div>

        {/* ─── Location + website ─────────────────────────────── */}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {t?.company_profile_field_country || (isHt ? 'Peyi' : 'Country')}
            </label>
            <input
              type="text"
              className={styles.formInput}
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="Haiti / US / CA"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {t?.company_profile_field_city || (isHt ? 'Vil' : 'City')}
            </label>
            <input
              type="text"
              className={styles.formInput}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Port-au-Prince"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {t?.company_profile_field_website || (isHt ? 'Sit wèb' : 'Website')}
            </label>
            <input
              type="url"
              className={styles.formInput}
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        {/* ─── Social links ───────────────────────────────────── */}
        <div className={styles.formGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className={styles.formLabel} style={{ marginBottom: 4 }}>
              {t?.company_profile_field_social || (isHt ? 'Lyen sosyal' : 'Social links')}
            </label>
            <button type="button" className="studio-company-add-btn"
              onClick={() => addRow('social_links', EMPTY_SOCIAL)}
              style={{ background: 'none', border: 'none', color: '#f472b6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              <i className="fas fa-plus" aria-hidden="true" /> {t?.company_profile_add || (isHt ? 'Ajoute' : 'Add')}
            </button>
          </div>
          {form.social_links.length === 0 && (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.78rem', margin: '6px 0' }}>
              {isHt ? 'Pa gen lyen sosyal.' : 'No social links yet.'}
            </p>
          )}
          {form.social_links.map((s, i) => (
            <div key={`social-${i}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 1 }}
                value={s.platform}
                onChange={(e) => updateRow('social_links', i, { platform: e.target.value })}
                placeholder={isHt ? 'Platfòm (instagram, tiktok…)' : 'Platform (instagram, tiktok…)'}
              />
              <input
                type="url"
                className={styles.formInput}
                style={{ flex: 2 }}
                value={s.url}
                onChange={(e) => updateRow('social_links', i, { url: e.target.value })}
                placeholder="https://…"
              />
              <button type="button" onClick={() => removeRow('social_links', i)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                aria-label={isHt ? 'Retire' : 'Remove'}>
                <i className="fas fa-trash" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {/* ─── Team ───────────────────────────────────────────── */}
        <div className={styles.formGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className={styles.formLabel} style={{ marginBottom: 4 }}>
              {t?.company_profile_field_team || (isHt ? 'Ekip' : 'Team')}
            </label>
            <button type="button" onClick={() => addRow('team_members', EMPTY_MEMBER)}
              style={{ background: 'none', border: 'none', color: '#f472b6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              <i className="fas fa-plus" aria-hidden="true" /> {t?.company_profile_add || (isHt ? 'Ajoute' : 'Add')}
            </button>
          </div>
          {form.team_members.length === 0 && (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.78rem', margin: '6px 0' }}>
              {t?.company_profile_empty_team || (isHt ? 'Pokò gen manm ekip.' : 'No team members yet.')}
            </p>
          )}
          {form.team_members.map((m, i) => (
            <div key={`member-${i}`} style={{
              display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap',
              background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10,
            }}>
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 1, minWidth: 120 }}
                value={m.name}
                onChange={(e) => updateRow('team_members', i, { name: e.target.value })}
                placeholder={t?.company_profile_field_team_member_name || (isHt ? 'Non manm' : 'Member name')}
              />
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 1, minWidth: 100 }}
                value={m.role}
                onChange={(e) => updateRow('team_members', i, { role: e.target.value })}
                placeholder={t?.company_profile_field_team_member_role || (isHt ? 'Wòl' : 'Role')}
              />
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 2, minWidth: 160 }}
                value={m.bio}
                onChange={(e) => updateRow('team_members', i, { bio: e.target.value })}
                placeholder={t?.company_profile_field_team_member_bio || (isHt ? 'Biyo' : 'Bio')}
              />
              <button type="button" onClick={() => removeRow('team_members', i)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                aria-label={isHt ? 'Retire' : 'Remove'}>
                <i className="fas fa-trash" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {/* ─── Products & services ────────────────────────────── */}
        <div className={styles.formGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className={styles.formLabel} style={{ marginBottom: 4 }}>
              {t?.company_profile_field_products_services || (isHt ? 'Pwodwi / Sèvis' : 'Products / Services')}
            </label>
            <button type="button" onClick={() => addRow('products_services', EMPTY_OFFERING)}
              style={{ background: 'none', border: 'none', color: '#f472b6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              <i className="fas fa-plus" aria-hidden="true" /> {t?.company_profile_add || (isHt ? 'Ajoute' : 'Add')}
            </button>
          </div>
          {form.products_services.length === 0 && (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.78rem', margin: '6px 0' }}>
              {t?.company_profile_empty_offerings || (isHt ? 'Pokò gen pwodwi oswa sèvis.' : 'No products or services yet.')}
            </p>
          )}
          {form.products_services.map((o, i) => (
            <div key={`offering-${i}`} style={{
              display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap',
              background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10,
            }}>
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 1, minWidth: 120 }}
                value={o.title}
                onChange={(e) => updateRow('products_services', i, { title: e.target.value })}
                placeholder={t?.company_profile_field_item_title || (isHt ? 'Tit' : 'Title')}
              />
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 2, minWidth: 160 }}
                value={o.description}
                onChange={(e) => updateRow('products_services', i, { description: e.target.value })}
                placeholder={t?.company_profile_field_item_description || (isHt ? 'Deskripsyon' : 'Description')}
              />
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 0, minWidth: 90, maxWidth: 120 }}
                value={o.icon}
                onChange={(e) => updateRow('products_services', i, { icon: e.target.value })}
                placeholder="fa-cube"
                title="FontAwesome icon class"
              />
              <button type="button" onClick={() => removeRow('products_services', i)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                aria-label={isHt ? 'Retire' : 'Remove'}>
                <i className="fas fa-trash" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        {/* ─── Submit ─────────────────────────────────────────── */}
        <div className={styles.formActions}>
          <button
            type="submit"
            className={classNames(styles.primaryBtn, 'studio-company-submit')}
            disabled={saving}
            data-testid="company-form-submit"
            style={{ cursor: saving ? 'wait' : 'pointer' }}
          >
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
            {saving
              ? (isHt ? 'Ap sove...' : 'Saving...')
              : (profile?.id
                ? (t?.company_profile_edit || (isHt ? 'Modifye Pwofil Konpanyi' : 'Edit Company Profile'))
                : (t?.company_profile_apply || (isHt ? 'Kreye Pwofil Konpanyi' : 'Create Company Profile')))}
          </button>
        </div>
      </form>
    </div>
  );
}
