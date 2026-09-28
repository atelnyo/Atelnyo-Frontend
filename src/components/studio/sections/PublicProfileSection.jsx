/**
 * src/components/studio/sections/PublicProfileSection.jsx
 *
 * Public Profile section — full profile editor with file upload for
 * avatar + cover images, plus fields for artist name, bio, country/city,
 * languages, skills, website, contact email, availability, and SEO metadata.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 * File upload support added — Etap 7 (2026-07-19).
 */
import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import useSafeNavigate from '../../../hooks/useSafeNavigate';
import { creatorProfileService } from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader } from '../shared';
import LocationPicker from '../../shared/LocationPicker';
import { getUserIdentity } from '../../../utils/userIdentity';
import styles from './sections.module.css';

// The real public profile page, lazy-loaded for the in-editor preview modal
// (keeps it out of the studio chunk; App.jsx already lazy-loads it too).
const CreatorPublicProfile = lazy(() => import('../../../components/CreatorPublicProfile'));

// Repeatable-entry defaults for the dynamic list editors (experience /
// education / social links) — same row-editor pattern as CompanySection.
const EMPTY_EXPERIENCE = { title: '', company: '', period: '', description: '' };
const EMPTY_EDUCATION = { institution: '', degree: '', year: '', description: '' };
const EMPTY_SOCIAL = { platform: '', url: '' };

export default function PublicProfileSection({ lang, showToast, user }) {
  const isHt = lang === 'ht';
  const identity = getUserIdentity(user);
  const navigate = useSafeNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({});
  const [fetchError, setFetchError] = useState(null);
  // Upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Preview modal — renders the REAL public profile page from the current
  // form draft (snapshot at click time) so the creator can see exactly how
  // the page will look before saving.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(null);

  // Escape closes the preview + body scroll lock while it's open.
  useEffect(() => {
    if (!previewOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPreviewOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [previewOpen]);

  // Build the preview profile from the CURRENT form draft. Shared by the
  // full-screen preview modal AND the always-on live pane, so both show
  // exactly what the creator has typed so far — never the last saved profile.
  const buildDraft = useCallback(() => {
    if (!profile) return null;
    const languages = form.languages
      ? form.languages.split(',').map((s) => s.trim()).filter(Boolean)
      : (profile.languages || []);
    const skills = form.skills
      ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : (profile.skills || []);
    const displayName = (form.artist_name || profile.artist_name || profile.display_name || '').trim();
    return {
      ...profile,
      artist_name: form.artist_name || profile.artist_name || '',
      display_name: displayName || profile.display_name,
      avatar_initial: (displayName || profile.display_name || 'C').charAt(0).toUpperCase(),
      avatar_url: form.avatar_url || '',
      cover_url: form.cover_url || '',
      bio: form.bio || '',
      country: form.country || profile.country || '',
      city: form.city || profile.city || '',
      postal_code: form.postal_code || profile.postal_code || '',
      languages,
      skills,
      website_url: form.website_url || '',
      contact_email: form.contact_email || '',
      contact_phone: form.contact_phone || '',
      availability: form.availability || 'available',
      experience: Array.isArray(form.experience) ? form.experience : [],
      education: Array.isArray(form.education) ? form.education : [],
      social_links: Object.fromEntries(
        (Array.isArray(form.social_links) ? form.social_links : [])
          .filter((s) => s.platform?.trim() && s.url?.trim())
          .map((s) => [s.platform.trim().toLowerCase(), s.url.trim()]),
      ),
      seo_keywords: form.seo_keywords
        ? form.seo_keywords.split(',').map((s) => s.trim()).filter(Boolean)
        : (profile.seo_keywords || []),
    };
  }, [profile, form]);

  const openPreview = useCallback(() => {
    const draft = buildDraft();
    if (!draft) return;
    setPreviewProfile(draft);
    setPreviewOpen(true);
  }, [buildDraft]);

  // ─── Live preview pane — the REAL public page from the draft ──────
  // Kept in sync while the creator types: the heavy page re-renders only
  // after typing pauses (debounced), never on every keystroke.
  const [liveDraft, setLiveDraft] = useState(null);

  useEffect(() => {
    if (!profile) return undefined;
    const timer = setTimeout(() => setLiveDraft(buildDraft()), 350);
    return () => clearTimeout(timer);
  }, [buildDraft, profile]);

  // ─── Editor tabs — the form is split into short focused panels so
  // the editor doesn't scroll forever: Appearance / Profile / Story /
  // Social & Contact / SEO / Layout, each with its own accent color.
  const [editorTab, setEditorTab] = useState('appearance');
  const EDITOR_TABS = [
    { id: 'appearance', icon: 'fa-image',        ht: 'Aparans',       en: 'Appearance' },
    { id: 'profile',    icon: 'fa-user-circle',  ht: 'Pwofil',        en: 'Profile' },
    { id: 'story',      icon: 'fa-briefcase',    ht: 'Istwa',         en: 'Story' },
    { id: 'contact',    icon: 'fa-share-alt',    ht: 'Rezo & Kontak', en: 'Social & Contact' },
    { id: 'seo',        icon: 'fa-search',       ht: 'SEO',           en: 'SEO' },
    { id: 'layout',     icon: 'fa-layer-group',  ht: 'Layout',        en: 'Layout' },
  ];
  const tabLabel = (t) => (isHt ? t.ht : t.en);

  const populateForm = useCallback((data) => {
    setForm({
      artist_name: data?.artist_name || '',
      bio: data?.bio || '',
      cover_url: data?.cover_url || '',
      avatar_url: data?.avatar_url || '',
      country: data?.country || '',
      city: data?.city || '',
      postal_code: data?.postal_code || '',
      languages: Array.isArray(data?.languages)
        ? data.languages.join(', ')
        : '',
      skills: Array.isArray(data?.skills)
        ? data.skills.join(', ')
        : '',
      website_url: data?.website_url || '',
      contact_email: data?.contact_email || '',
      contact_phone: data?.contact_phone || '',
      availability: data?.availability || 'available',
      seo_title: data?.seo_title || '',
      seo_description: data?.seo_description || '',
      // About-tab list editors (the profile page renders these — the
      // editor must too for it to be "real").
      experience: Array.isArray(data?.experience) ? data.experience : [],
      education: Array.isArray(data?.education) ? data.education : [],
      // Backend stores social_links as a {platform: url} dict; the form
      // edits them as rows — convert dict → [{platform, url}].
      social_links: (() => {
        const raw = data?.social_links;
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') {
          return Object.entries(raw).map(([platform, url]) => ({ platform, url }));
        }
        return [];
      })(),
      seo_keywords: Array.isArray(data?.seo_keywords)
        ? data.seo_keywords.join(', ')
        : '',
    });
  }, []);

  // Repeatable-row helpers (mirror CompanySection): edit/add/remove an
  // entry inside form.experience / form.education / form.social_links.
  const updateRow = (key, idx, patch) =>
    setForm((prev) => ({ ...prev, [key]: prev[key].map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));
  const addRow = (key, empty) =>
    setForm((prev) => ({ ...prev, [key]: [...(Array.isArray(prev[key]) ? prev[key] : []), { ...empty }] }));
  const removeRow = (key, idx) =>
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));

  useEffect(() => {
    if (!identity.creatorLookupKey) {return undefined;}
    let cancelled = false;
    Promise.resolve().then(() => {
      creatorProfileService.get(identity.creatorLookupKey)
        .then((res) => {
          if (cancelled) {return;}
          setProfile(res?.data || null);
          populateForm(res?.data || {});
          setFetchError(null);
        })
        .catch((err) => {
          if (cancelled) {return;}
          setProfile(null);
          setFetchError(err?.response?.status || 'error');
        })
        .finally(() => { if (!cancelled) {setLoading(false);} });
    });
    return () => { cancelled = true; };
  }, [identity.creatorLookupKey, populateForm]);

  // ─── File upload handlers ──────────────────────────────────────────

  const handleAvatarUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    // Validate type
    if (!file.type.startsWith('image/')) {
      showToast?.(
        isHt ? 'Chwazi yon fichye imaj.' : 'Please select an image file.',
        'exclamation-triangle',
      );
      return;
    }

    setUploadingAvatar(true);
    creatorProfileService.uploadAvatar(file)
      .then((res) => {
        const url = res?.data?.url;
        if (url) {
          setForm((prev) => ({ ...prev, avatar_url: url }));
          showToast?.(
            isHt ? 'Avatè telechaje!' : 'Avatar uploaded!',
            'check-circle',
          );
        }
      })
      .catch(() => {
        showToast?.(
          isHt ? 'Erè nan telechaje avatè.' : 'Error uploading avatar.',
          'exclamation-triangle',
        );
      })
      .finally(() => {
        setUploadingAvatar(false);
        if (avatarInputRef.current) {avatarInputRef.current.value = '';}
      });
  }, [isHt, showToast]);

  const handleCoverUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    if (!file.type.startsWith('image/')) {
      showToast?.(
        isHt ? 'Chwazi yon fichye imaj.' : 'Please select an image file.',
        'exclamation-triangle',
      );
      return;
    }

    setUploadingCover(true);
    creatorProfileService.uploadCover(file)
      .then((res) => {
        const url = res?.data?.url;
        if (url) {
          setForm((prev) => ({ ...prev, cover_url: url }));
          showToast?.(
            isHt ? 'Kouvèti telechaje!' : 'Cover uploaded!',
            'check-circle',
          );
        }
      })
      .catch(() => {
        showToast?.(
          isHt ? 'Erè nan telechaje kouvèti.' : 'Error uploading cover.',
          'exclamation-triangle',
        );
      })
      .finally(() => {
        setUploadingCover(false);
        if (coverInputRef.current) {coverInputRef.current.value = '';}
      });
  }, [isHt, showToast]);

  // Auto-create profile for active creators whose profile wasn't
  // created by the approval signal (self-healing).
  const handleCreateProfile = useCallback(() => {
    setCreating(true);
    creatorProfileService.updateMe({})
      .then((res) => {
        showToast?.(
          isHt ? 'Pwofil piblik kreye!' : 'Public profile created!',
          'check-circle',
        );
        setProfile(res?.data || null);
        populateForm(res?.data || {});
        setFetchError(null);
      })
      .catch((err) => {
        if (err?.response?.status === 403) {
          setFetchError('not_creator');
        } else {
          showToast?.(
            isHt ? 'Erè nan kreye pwofil.' : 'Error creating profile.',
            'exclamation-triangle',
          );
        }
      })
      .finally(() => setCreating(false));
  }, [isHt, showToast, populateForm]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    const payload = {
      ...form,
      languages: form.languages
        ? form.languages.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      skills: form.skills
        ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      // Drop empty rows, then convert the row editors to the shapes the
      // backend model stores (experience/education lists, social_links
      // dict, seo_keywords string list).
      experience: (Array.isArray(form.experience) ? form.experience : [])
        .filter((x) => x.title?.trim() || x.company?.trim()),
      education: (Array.isArray(form.education) ? form.education : [])
        .filter((x) => x.institution?.trim() || x.degree?.trim()),
      social_links: Object.fromEntries(
        (Array.isArray(form.social_links) ? form.social_links : [])
          .filter((s) => s.platform?.trim() && s.url?.trim())
          .map((s) => [s.platform.trim().toLowerCase(), s.url.trim()]),
      ),
      seo_keywords: form.seo_keywords
        ? form.seo_keywords.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    creatorProfileService.updateMe(payload)
      .then((res) => {
        setProfile(res?.data || profile);
        showToast?.(
          isHt ? 'Pwofil aktyalize!' : 'Profile updated!',
          'check-circle'
        );
      })
      .catch(() => {
        showToast?.(
          isHt ? 'Erè nan sove.' : 'Error saving.',
          'exclamation-triangle'
        );
      })
      .finally(() => setSaving(false));
  };

  if (loading) {return <StudioSkeleton rows={4} />;}

  // ─── Empty / Error states ──────────────────────────────────────────
  if (!profile) {
    if (fetchError === 'not_creator') {
      return (
        <div className={styles.section}>
          <EmptyState
            icon="fa-user-circle"
            title={isHt ? 'Pa gen pwofil piblik' : 'No public profile'}
            hint={isHt
              ? 'Ou dwe vin yon kreyatè anvan ou ka kreye yon pwofil piblik.'
              : 'You must become a creator before you can create a public profile.'}
          />
        </div>
      );
    }

    return (
      <div className={styles.section}>
        <SectionHeader
          icon="fa-user-circle"
          title={isHt ? 'Pwofil Piblik' : 'Public Profile'}
          lang={lang}
          help={{
            ht: 'Pwofil piblik ou a se paj ou sou platfòm — li montre avatè, kouvèti, atis, biyo, lokalisasyon ak tout kontni ou. Chèche tout moun ka wè l la.',
            en: 'Your public profile is your page on the platform — it shows your avatar, cover, artist name, bio, location and all your content. It is visible to everyone.',
          }}
        />
        <EmptyState
          icon="fa-user-plus"
          title={isHt ? 'Pwofil poko kreye' : 'Profile not created yet'}
          hint={isHt
            ? 'Pwofil piblik ou a poko kreye. Klike sou bouton ki anba a pou kreye l.'
            : 'Your public profile has not been created yet. Click the button below to create it.'}
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateProfile}
              disabled={creating}
              style={{ marginTop: 16 }}
            >
              <i className={`fas ${creating ? 'fa-spinner fa-spin' : 'fa-plus-circle'}`} aria-hidden="true" />
              {creating
                ? (isHt ? 'Ap kreye...' : 'Creating...')
                : (isHt ? 'Kreye Pwofil Piblik' : 'Create Public Profile')}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className={`${styles.section} ${styles.profileEditorSection}`}>
      <SectionHeader
        icon="fa-user-circle"
        title={isHt ? 'Pwofil Piblik' : 'Public Profile'}
        lang={lang}
        help={{
          ht: 'Pwofil piblik ou a se paj ou sou platfòm — li montre avatè, kouvèti, atis, biyo, lokalisasyon ak tout kontni ou. Sove chanjman ou pou yo parèt sou paj la.',
          en: 'Your public profile is your page on the platform — it shows your avatar, cover, artist name, bio, location and all your content. Save your changes to publish them.',
        }}
        tip={isHt
          ? 'Aperè an dirèk a nan bò dwat la mete ajou pandan w tape — tcheke l pou w wè paj la anvan w sove.'
          : 'The live preview on the right updates as you type — watch it to see the page before saving.'}
        action={
          <div className={styles.headerActions}>
            <button
              type="button"
              className="btn-secondary"
              onClick={openPreview}
              disabled={!profile || !identity.creatorLookupKey}
              title={isHt ? 'Aperè pwofil piblik ou' : 'Preview your public profile'}
            >
              <i className="fas fa-eye" aria-hidden="true" />{' '}
              {isHt ? 'Aperè' : 'Preview'}
            </button>
            {/* Only render the live link when a username exists — an empty
                key would produce a broken "/@" URL that bounces to 404. */}
            {identity.creatorLookupKey ? (
              <a
                href={`/c/${identity.creatorLookupKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <i className="fas fa-external-link-alt" aria-hidden="true" />{' '}
                {isHt ? 'Gade piblik' : 'View live'}
              </a>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
              {saving
                ? (isHt ? 'Ap sove...' : 'Saving...')
                : (isHt ? 'Sove' : 'Save')}
            </button>
          </div>
        }
      />

      <div className={styles.profileEditorSplit}>
        {/* ─── Left: the form ─────────────────────────────────── */}
        <div className={styles.profileEditorFormPane}>
          {/* Editor tabs — short focused panels instead of one long form */}
          <div className={styles.profileEditorTabs} role="tablist" aria-label={isHt ? 'Seksyon editè' : 'Editor sections'}>
            {EDITOR_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={editorTab === t.id}
                className={`${styles.profileEditorTab} ${editorTab === t.id ? styles.profileEditorTabActive : ''}`}
                onClick={() => setEditorTab(t.id)}
              >
                <i className={`fas ${t.icon}`} aria-hidden="true" />
                {tabLabel(t)}
              </button>
            ))}
          </div>

      <div className={styles.profileForm}>
        {/* ─── Tab: Appearance — cover + avatar + identity ────── */}
        {editorTab === 'appearance' && (
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardIndigo}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-image" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Aparans' : 'Appearance'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Kouvèti, avatè ak non piblik ou.' : 'Your cover, avatar and public name.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* ─── M3 Cover Card — pink gradient hero with image ───── */}

        <div className={`${styles.coverCard}${form.cover_url ? ` ${styles.hasImage}` : ''}`}>
          {form.cover_url ? (
            <img src={form.cover_url} alt="Cover preview" />
          ) : (
            <div className={styles.coverCardPlaceholder}>
              <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
              <span>{isHt ? 'Ajoute yon foto kouvèti' : 'Add a cover image'}</span>
            </div>
          )}
        </div>

        {/* Upload + URL row for cover */}
        <div className={styles.coverUploadRow}>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleCoverUpload}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
          >
            <i className={`fas ${uploadingCover ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`} aria-hidden="true" />
            {' '}{uploadingCover ? (isHt ? 'Ap telechaje...' : 'Uploading...') : (isHt ? 'Telechaje' : 'Upload')}
          </button>
          <input
            type="url"
            className={styles.formInput}
            value={form.cover_url || ''}
            onChange={(e) => handleChange('cover_url', e.target.value)}
            placeholder="https://... (URL)"
          />
        </div>

        {/* ─── M3 Avatar — gradient ring overlapping cover ─────── */}

        <div className={styles.avatarSection}>
          <div className={styles.avatarRing}>
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Avatar" className={styles.avatarPreview} />
            ) : (
              <div className={styles.avatarInitial}>
                {identity.initial}
              </div>
            )}
          </div>
        </div>

        {/* Upload + URL row for avatar */}
        <div className={styles.avatarUploadRow}>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`} aria-hidden="true" />
            {' '}{uploadingAvatar ? (isHt ? 'Ap telechaje...' : 'Uploading...') : (isHt ? 'Telechaje' : 'Upload')}
          </button>
          <input
            type="url"
            className={styles.formInput}
            value={form.avatar_url || ''}
            onChange={(e) => handleChange('avatar_url', e.target.value)}
            placeholder="https://... (URL)"
          />
        </div>

        {/* ─── Profile Identity — name + username ──────────────── */}

        <div className={styles.profileIdentity}>
          <h3 className={styles.profileName}>
            {form.artist_name || identity.displayName || 'Creator'}
          </h3>
          <p className={styles.profileUsername}>
            @{identity.username || identity.emailPrefix || 'creator'}
          </p>
        </div>

        {/* ─── Artist Name ───────────────────────────────────────── */}

        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Non Atis' : 'Artist Name'}
          </span>
          <input
            type="text"
            className={styles.formInput}
            value={form.artist_name || ''}
            onChange={(e) => handleChange('artist_name', e.target.value)}
            placeholder={isHt ? 'Non piblik ou' : 'Your public name'}
          />
        </label>
          </div>
        </section>
        )}

        {/* ─── Tab: Profile — bio + location + languages ─────── */}
        {editorTab === 'profile' && (
        <>
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardRose}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-align-left" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Biyografi' : 'Biography'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Deskripsyon kout sou ou — li parèt anba non ou.' : 'A short description about you — shown under your name.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* Bio */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Biyo' : 'Bio'} ({(form.bio || '').length}/500)
          </span>
          <textarea
            className={styles.formTextarea}
            value={form.bio || ''}
            onChange={(e) => handleChange('bio', e.target.value.slice(0, 500))}
            placeholder={isHt ? 'Biyo kout ou...' : 'Your short bio...'}
            rows={3}
          />
        </label>
          </div>
        </section>

        {/* ─── Location — country + city + postal code ───────── */}
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardTeal}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-map-marker-alt" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Lokalizasyon' : 'Location'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Kote w ye — peyi, vil ak kòd postal.' : 'Where you are — country, city and postal code.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* Location — country + city + postal code with geolocation */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Lokalisasyon' : 'Location'}
          </span>
          <LocationPicker
            value={{
              country: form.country || '',
              city: form.city || '',
              postcode: form.postal_code || '',
            }}
            onChange={(loc) => {
              setForm((prev) => ({
                ...prev,
                country: loc.country,
                city: loc.city,
                postal_code: loc.postcode || prev.postal_code,
              }));
            }}
            lang={lang}
            showPostcode
            showAddress={false}
          />
        </div>
          </div>
        </section>

        {/* ─── Languages & Skills ────────────────────────────── */}
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardViolet}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-language" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Lang & Konpetans' : 'Languages & Skills'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Lang ou pale ak konpetans ou — separe ak virgill.' : 'The languages you speak and your skills — comma separated.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
            <div className={styles.formRow}>
        {/* Languages */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Lang (separe ak virgill)' : 'Languages (comma separated)'}
          </span>
          <input
            type="text"
            className={styles.formInput}
            value={form.languages || ''}
            onChange={(e) => handleChange('languages', e.target.value)}
            placeholder="Kreyol, English, Francais"
          />
        </label>

        {/* Skills */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Konpetans (separe ak virgill)' : 'Skills (comma separated)'}
          </span>
          <input
            type="text"
            className={styles.formInput}
            value={form.skills || ''}
            onChange={(e) => handleChange('skills', e.target.value)}
            placeholder="Python, React, Music Production"
          />
        </label>
            </div>
          </div>
        </section>
        </>
        )}

        {/* ─── Tab: Story — experience + education (About) ───── */}
        {editorTab === 'story' && (
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardAmber}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-briefcase" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Istwa' : 'Story'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Eksperyans pwofesyonèl ak edikasyon ou — yo parèt nan tab About la.' : 'Your professional experience and education — shown in the About tab.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* ─── Experience — repeatable work history (rendered in the About tab) ─ */}
        <div className={styles.fieldGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={styles.fieldLabel}>
              {isHt ? 'Eksperyans' : 'Experience'}
            </span>
            <button type="button"
              onClick={() => addRow('experience', EMPTY_EXPERIENCE)}
              className={styles.profileAddChip}>
              <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute' : 'Add'}
            </button>
          </div>
          {!form.experience?.length && (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.78rem', margin: '6px 0' }}>
              {isHt ? 'Pa gen eksperyans ankò.' : 'No experience yet.'}
            </p>
          )}
          {(form.experience || []).map((exp, i) => (
            <div key={`exp-${i}`} className={styles.profileEditorEntry}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  value={exp.title || ''}
                  onChange={(e) => updateRow('experience', i, { title: e.target.value })}
                  placeholder={isHt ? 'Pòs (eg. Devlòpè Web)' : 'Role (e.g. Web Developer)'}
                />
                <input
                  type="text"
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  value={exp.company || ''}
                  onChange={(e) => updateRow('experience', i, { company: e.target.value })}
                  placeholder={isHt ? 'Konpanyi' : 'Company'}
                />
              </div>
              <input
                type="text"
                className={styles.formInput}
                value={exp.period || ''}
                onChange={(e) => updateRow('experience', i, { period: e.target.value })}
                placeholder={isHt ? 'Peryòd (eg. 2022 — 2025)' : 'Period (e.g. 2022 — 2025)'}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  className={styles.formTextarea}
                  style={{ flex: 1 }}
                  value={exp.description || ''}
                  onChange={(e) => updateRow('experience', i, { description: e.target.value })}
                  placeholder={isHt ? 'Deskripsyon...' : 'Description...'}
                  rows={2}
                />
                <button type="button" onClick={() => removeRow('experience', i)}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', paddingTop: 6 }}
                  aria-label={isHt ? 'Retire' : 'Remove'}>
                  <i className="fas fa-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Education — repeatable (rendered in the About tab) ── */}
        <div className={styles.fieldGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={styles.fieldLabel}>
              {isHt ? 'Edikasyon' : 'Education'}
            </span>
            <button type="button"
              onClick={() => addRow('education', EMPTY_EDUCATION)}
              className={styles.profileAddChip}>
              <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute' : 'Add'}
            </button>
          </div>
          {!form.education?.length && (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.78rem', margin: '6px 0' }}>
              {isHt ? 'Pa gen edikasyon ankò.' : 'No education yet.'}
            </p>
          )}
          {(form.education || []).map((edu, i) => (
            <div key={`edu-${i}`} className={styles.profileEditorEntry}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  value={edu.institution || ''}
                  onChange={(e) => updateRow('education', i, { institution: e.target.value })}
                  placeholder={isHt ? 'Enstitisyon (eg. INUQUA)' : 'Institution (e.g. INUQUA)'}
                />
                <input
                  type="text"
                  className={styles.formInput}
                  style={{ flex: 1 }}
                  value={edu.degree || ''}
                  onChange={(e) => updateRow('education', i, { degree: e.target.value })}
                  placeholder={isHt ? 'Diplòm (eg. Licence)' : 'Degree (e.g. Bachelor)'}
                />
              </div>
              <input
                type="text"
                className={styles.formInput}
                value={edu.year || ''}
                onChange={(e) => updateRow('education', i, { year: e.target.value })}
                placeholder={isHt ? 'Ane (eg. 2023)' : 'Year (e.g. 2023)'}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  className={styles.formTextarea}
                  style={{ flex: 1 }}
                  value={edu.description || ''}
                  onChange={(e) => updateRow('education', i, { description: e.target.value })}
                  placeholder={isHt ? 'Deskripsyon...' : 'Description...'}
                  rows={2}
                />
                <button type="button" onClick={() => removeRow('education', i)}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', paddingTop: 6 }}
                  aria-label={isHt ? 'Retire' : 'Remove'}>
                  <i className="fas fa-trash" aria-hidden="true" />
                </button>
              </div>
            </div>              ))}
        </div>
          </div>
        </section>
        )}

        {/* ─── Tab: Social & Contact — links + contact ───────── */}
        {editorTab === 'contact' && (
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardCyan}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-globe" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Sitwèb & Kontak' : 'Website & Contact'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Lyen ou ak fason moun ka kontakte ou.' : 'Your links and how people can reach you.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* Website */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Sit Wèb' : 'Website'}
          </span>
          <input
            type="url"
            className={styles.formInput}
            value={form.website_url || ''}
            onChange={(e) => handleChange('website_url', e.target.value)}
            placeholder="https://..."
          />
        </label>

        {/* ─── Social Links — repeatable platform → url (sidebar + About) ─ */}
        <div className={styles.fieldGroup}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={styles.fieldLabel}>
              {isHt ? 'Lyen Sosyal' : 'Social Links'}
            </span>
            <button type="button"
              onClick={() => addRow('social_links', EMPTY_SOCIAL)}
              className={styles.profileAddChip}>
              <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute' : 'Add'}
            </button>
          </div>
          {!form.social_links?.length && (
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.78rem', margin: '6px 0' }}>
              {isHt ? 'Pa gen lyen sosyal.' : 'No social links yet.'}
            </p>
          )}
          {(form.social_links || []).map((s, i) => (
            <div key={`social-${i}`} className={styles.profileEditorEntryRow}>
              <input
                type="text"
                className={styles.formInput}
                style={{ flex: 1 }}
                value={s.platform || ''}
                onChange={(e) => updateRow('social_links', i, { platform: e.target.value })}
                placeholder={isHt ? 'Platfòm (instagram, github…)' : 'Platform (instagram, github…)'}
              />
              <input
                type="url"
                className={styles.formInput}
                style={{ flex: 2 }}
                value={s.url || ''}
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

        <div className={styles.formRow}>
        {/* Contact Email */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Imèl Kontak' : 'Contact Email'}
          </span>
          <input
            type="email"
            className={styles.formInput}
            value={form.contact_email || ''}
            onChange={(e) => handleChange('contact_email', e.target.value)}
            placeholder="hello@example.com"
          />
        </label>

        {/* Contact Phone */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Telefòn Kontak' : 'Contact Phone'}
          </span>
          <input
            type="tel"
            className={styles.formInput}
            value={form.contact_phone || ''}
            onChange={(e) => handleChange('contact_phone', e.target.value)}
            placeholder="+509..."
          />
        </label>
        </div>

        {/* Availability */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Disponibilite' : 'Availability'}
          </span>
          <select
            className={styles.formSelect}
            value={form.availability || 'available'}
            onChange={(e) => handleChange('availability', e.target.value)}
          >
            <option value="available">{isHt ? 'Disponib' : 'Available'}</option>
            <option value="busy">{isHt ? 'Okipe' : 'Busy'}</option>
            <option value="unavailable">{isHt ? 'Pa disponib' : 'Unavailable'}</option>            </select>
        </label>
          </div>
        </section>
        )}

        {/* ─── Tab: SEO — search-engine metadata ─────────────── */}
        {editorTab === 'seo' && (
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardEmerald}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-search" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>SEO</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Meta pou motè rechèch lè moun chache ou.' : 'Search-engine metadata used when people look you up.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* SEO Title */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Tit SEO' : 'SEO Title'} ({(form.seo_title || '').length}/160)
          </span>
          <input
            type="text"
            className={styles.formInput}
            value={form.seo_title || ''}
            onChange={(e) => handleChange('seo_title', e.target.value.slice(0, 160))}
            placeholder={isHt ? 'Tit pou motè rechèch' : 'Title for search engines'}
          />
        </label>

        {/* SEO Description */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Deskripsyon SEO' : 'SEO Description'}
          </span>
          <textarea
            className={styles.formTextarea}
            value={form.seo_description || ''}
            onChange={(e) => handleChange('seo_description', e.target.value)}
            placeholder={isHt ? 'Deskripsyon pou motè rechèch' : 'Description for search engines'}
            rows={2}
          />
        </label>

        {/* SEO Keywords */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Mo Kle SEO (separe ak virgill)' : 'SEO Keywords (comma separated)'}
          </span>
          <input
            type="text"
            className={styles.formInput}
            value={form.seo_keywords || ''}
            onChange={(e) => handleChange('seo_keywords', e.target.value)}
            placeholder="creator, music, design"
          />
        </label>
          </div>
        </section>
        )}

        {/* ─── Tab: Layout — section order & visibility ──────── */}
        {editorTab === 'layout' && (
        <section className={`${styles.profileEditorCard} ${styles.profileEditorCardPurple}`}>
          <header className={styles.profileEditorCardHeader}>
            <span className={styles.profileEditorIcon}><i className="fas fa-layer-group" aria-hidden="true" /></span>
            <div className={styles.profileEditorCardHeaderText}>
              <h4 className={styles.profileEditorCardTitle}>{isHt ? 'Layout' : 'Layout'}</h4>
              <p className={styles.profileEditorCardHint}>
                {isHt ? 'Òd ak viwabilite seksyon yo sou paj ou.' : 'How your profile sections are ordered and shown.'}
              </p>
            </div>
          </header>
          <div className={styles.profileEditorBody}>
        {/* ─── Section Order & Visibility — managed in Profile Settings ─ */}
        <div className={styles.profileEditorNote}>
          <i className="fas fa-sliders-h" aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isHt ? 'Òd ak Viwabilite Seksyon' : 'Section Order & Visibility'}
            </p>
            <p style={{ margin: '4px 0 10px', fontSize: '0.8rem', color: 'var(--text-secondary, #888)' }}>
              {isHt
                ? 'Lòd ak viwabilite seksyon yo jere nan Profile Settings — tcheke l la pou reòganize ak kache seksyon yo.'
                : 'Section order & visibility are managed in Profile Settings — head there to reorder and hide sections.'}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/sheet/studio?section=profile_settings')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <i className="fas fa-sliders-h" aria-hidden="true" />
              {isHt ? 'Ale nan Profile Settings' : 'Go to Profile Settings'}
            </button>
          </div>
        </div>
          </div>
        </section>
        )}
      </div>
        </div>

        {/* ─── Right: live preview — the REAL page from the draft ─ */}
        <aside className={styles.profileEditorPreviewPane}>
          <div className={styles.profileEditorPreviewBar}>
            <span className={styles.profileEditorPreviewDot} aria-hidden="true" />
            <span className={styles.profileEditorPreviewLabel}>
              {isHt ? 'Aperè an dirèk' : 'Live Preview'}
            </span>
            <button
              type="button"
              className={styles.profileEditorPreviewExpand}
              onClick={openPreview}
              title={isHt ? 'Aperè tout ekran' : 'Full-screen preview'}
            >
              <i className="fas fa-expand" aria-hidden="true" />
            </button>
          </div>
          <div className={styles.profileEditorPreviewFrame}>
            {liveDraft ? (
              <Suspense
                fallback={
                  <div className={styles.profileEditorPreviewLoading}>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                  </div>
                }
              >
                <CreatorPublicProfile
                  lang={lang}
                  showToast={showToast}
                  currentUserId={user?.id}
                  editingMode
                  username={identity.creatorLookupKey}
                  overrideProfile={liveDraft}
                />
              </Suspense>
            ) : (
              <div className={styles.profileEditorPreviewLoading}>
                <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ─── Full-screen preview — the REAL public profile page from the draft ─ */}
      {previewOpen && previewProfile && (
        <div
          className="csp-preview-shell"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={isHt ? 'Aperè pwofil piblik' : 'Public profile preview'}
        >
          <button
            type="button"
            className="csp-preview-close"
            onClick={() => setPreviewOpen(false)}
            aria-label={isHt ? 'Fèmen aperè' : 'Close preview'}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
          <div className="csp-preview-frame" onClick={(e) => e.stopPropagation()}>
            <Suspense
              fallback={
                <div className="csp-preview-loading">
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                </div>
              }
            >
              <CreatorPublicProfile
                lang={lang}
                showToast={showToast}
                currentUserId={user?.id}
                editingMode
                username={identity.creatorLookupKey}
                overrideProfile={previewProfile}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
