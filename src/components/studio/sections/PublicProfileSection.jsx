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
import DraftRecoveryBanner from '../shared/DraftRecoveryBanner';
import LocationPicker from '../../shared/LocationPicker';
import ProfileTemplateModal from '../modals/ProfileTemplateModal';
import { StudioModal } from '../modals/shared';
import ProfileCompletenessCard from './ProfileCompletenessCard';
import { removeFormDraft, restoreFormDraft, saveFormDraft } from '../../../services/appStateStore';
import { getProfileCompleteness } from '../../profile/profileCompleteness';
import { parseProfileSaveError } from '../../profile/profileSaveError';
import { SEO_RECOMMENDED, buildSeoPreview } from '../../profile/seoPreview';
import { RAIL_ITEMS } from '../../profile/profileConstants';
import {
  PROFILE_TEMPLATES,
  applyProfileTemplate,
  detectProfileTemplate,
  mergeSectionConfig,
  templateDescription,
  templateName,
} from '../../profile/profileTemplates';
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
  // Drafts are per creator — one creator must never restore another
  // account's local work on a shared device.
  const draftKey = identity.creatorLookupKey
    ? `creator-public-profile:${identity.creatorLookupKey}`
    : null;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({});
  // Snapshot of the form as last loaded/saved — powers the unsaved-changes
  // guard (banner + beforeunload). Null until the profile loads.
  const [baselineForm, setBaselineForm] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  // Actionable save failure — field errors rendered with jumps to their tab.
  const [saveError, setSaveError] = useState(null);
  // Upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const previewDialogRef = useRef(null);
  const previewCloseRef = useRef(null);
  // Crash recovery: only check once per loaded profile, not after every save.
  const draftCheckedFor = useRef(null);
  const draftSaveWarned = useRef(false);
  const [recoverDraft, setRecoverDraft] = useState(null);
  // Autosave must wait until the recovery check finishes, otherwise typing
  // immediately after mount could overwrite the very draft we want to offer.
  const [draftCheckDone, setDraftCheckDone] = useState(false);

  // Preview modal — renders the REAL public profile page from the current
  // form draft (snapshot at click time) so the creator can see exactly how
  // the page will look before saving.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(null);
  // Full template picker modal (Layout tab) — drafts only; saved with Save.
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  // Accessible in-app confirmation instead of window.confirm when leaving
  // with unpublished edits.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // Preview device framing: desktop by default, phone width for a realistic
  // mobile check without opening devtools.
  const [previewViewport, setPreviewViewport] = useState('desktop');
  // Live preview starts collapsed on narrow screens: the form is the task
  // there, and keeping the real page unmounted saves work + scroll. Desktop
  // starts expanded like a classic two-pane editor.
  const [previewCollapsed, setPreviewCollapsed] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') { return false; }
    return window.matchMedia('(max-width: 1200px)').matches;
  });

  // Full-screen preview is a REAL modal: focus starts on Close, Tab cycles
  // inside it, Escape closes it, background scroll locks, and focus returns
  // to the control that opened it.
  useEffect(() => {
    if (!previewOpen) return undefined;
    const previousFocus = document.activeElement;
    const node = previewDialogRef.current;
    const getFocusable = () => (node
      ? Array.from(node.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      : []);
    previewCloseRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreviewOpen(false);
        return;
      }
      if (e.key !== 'Tab') { return; }
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (node && !node.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
        try { previousFocus.focus(); } catch { /* opener left the DOM */ }
      }
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
      // Layout drafts render live too: the real page reads section_config
      // for its tab bar and sidebar visibility.
      section_config: mergeSectionConfig(
        Array.isArray(form.section_order)
          ? {
            section_order: form.section_order,
            section_visibility: form.section_visibility,
          }
          : profile.section_config,
      ),
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

  // Keyboard contract for the editor tab bar: ArrowLeft/ArrowRight cycle,
  // Home/End jump to the edges — the same pattern as the public profile.
  const handleEditorTabKeyDown = (e, index) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) { return; }
    e.preventDefault();
    let nextIndex = index;
    if (e.key === 'ArrowRight') { nextIndex = (index + 1) % EDITOR_TABS.length; }
    else if (e.key === 'ArrowLeft') { nextIndex = (index - 1 + EDITOR_TABS.length) % EDITOR_TABS.length; }
    else if (e.key === 'Home') { nextIndex = 0; }
    else { nextIndex = EDITOR_TABS.length - 1; }
    const nextTab = EDITOR_TABS[nextIndex];
    setEditorTab(nextTab.id);
    const focusTab = () => document.getElementById(`profile-editor-tab-${nextTab.id}`)?.focus();
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(focusTab); }
    else { focusTab(); }
  };

  // Comfort: keep the active tab visible inside the horizontally scrolling
  // mobile tab row after a click or keyboard jump.
  useEffect(() => {
    document.getElementById(`profile-editor-tab-${editorTab}`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [editorTab]);

  const populateForm = useCallback((data) => {
    const sectionConfig = mergeSectionConfig(data?.section_config || null);
    const nextForm = {
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
      // Layout state (order + visibility) lives in the same draft so the
      // Save button publishes profile fields and layout together.
      section_order: sectionConfig.section_order,
      section_visibility: sectionConfig.section_visibility,
    };
    setForm(nextForm);
    setBaselineForm(nextForm);
  }, []);

  // Repeatable-row helpers (mirror CompanySection): edit/add/remove an
  // entry inside form.experience / form.education / form.social_links.
  const updateRow = (key, idx, patch) =>
    setForm((prev) => ({ ...prev, [key]: prev[key].map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));
  const addRow = (key, empty) =>
    setForm((prev) => ({ ...prev, [key]: [...(Array.isArray(prev[key]) ? prev[key] : []), { ...empty }] }));
  const removeRow = (key, idx) =>
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));

  // ─── Layout draft helpers (templates + order + visibility) ────────
  const applyTemplate = useCallback((config, template) => {
    setForm((prev) => ({
      ...prev,
      section_order: [...config.section_order],
      section_visibility: { ...config.section_visibility },
    }));
    showToast?.(
      isHt
        ? `Modèl « ${templateName(template, 'ht')} » aplike — sove pou pibliye l.`
        : `“${templateName(template, 'en')}” template applied — save to publish it.`,
      'check-circle',
    );
  }, [isHt, showToast]);

  const moveLayoutSection = useCallback((index, direction) => {
    setForm((prev) => {
      const arr = [...(prev.section_order || [])];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...prev, section_order: arr };
    });
  }, []);

  const toggleLayoutSection = useCallback((sectionId) => {
    setForm((prev) => {
      const visibility = prev.section_visibility || {};
      return {
        ...prev,
        section_visibility: {
          ...visibility,
          [sectionId]: visibility[sectionId] === false,
        },
      };
    });
  }, []);

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

  // Crash/refresh recovery: once the server form is loaded, look for local
  // work that never reached the backend. The prompt stays until the creator
  // chooses Retabli or Efase — no timer hides a decision they still owe.
  useEffect(() => {
    if (!draftKey || !profile?.id || !baselineForm || draftCheckedFor.current === profile.id) {
      return undefined;
    }
    draftCheckedFor.current = profile.id;
    let cancelled = false;
    restoreFormDraft(draftKey)
      .then((draft) => {
        if (cancelled || !draft || !draft.form) { return; }
        if (draft.profileId && draft.profileId !== profile.id) {
          removeFormDraft(draftKey).catch(() => {});
          return;
        }
        if (JSON.stringify(draft.form) === JSON.stringify(baselineForm)) {
          removeFormDraft(draftKey).catch(() => {});
          return;
        }
        setRecoverDraft(draft);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { setDraftCheckDone(true); } });
    return () => { cancelled = true; };
  }, [draftKey, profile?.id, baselineForm]);

  // ─── File upload handlers ──────────────────────────────────────────

  const handleAvatarUpload = useCallback(async (e) => {
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
    try {
      // Shared guard: size cap + downscale before the request goes out.
      const { prepareImageForUpload } = await import('../../../utils/prepareImageUpload');
      const prepared = await prepareImageForUpload(file);
      const res = await creatorProfileService.uploadAvatar(prepared);
      const url = res?.data?.url;
      if (url) {
        setForm((prev) => ({ ...prev, avatar_url: url }));
        showToast?.(
          isHt ? 'Avatè telechaje!' : 'Avatar uploaded!',
          'check-circle',
        );
      }
    } catch (err) {
      showToast?.(
        err?.message === 'too_large'
          ? (isHt ? 'Imaj twò gwo (maks 8 MB).' : 'Image too large (max 8 MB).')
          : (isHt ? 'Erè nan telechaje avatè.' : 'Error uploading avatar.'),
        'exclamation-triangle',
      );
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {avatarInputRef.current.value = '';}
    }
  }, [isHt, showToast]);

  const handleCoverUpload = useCallback(async (e) => {
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
    try {
      // Same shared guard as the avatar (size cap + downscale).
      const { prepareImageForUpload } = await import('../../../utils/prepareImageUpload');
      const prepared = await prepareImageForUpload(file);
      const res = await creatorProfileService.uploadCover(prepared);
      const url = res?.data?.url;
      if (url) {
        setForm((prev) => ({ ...prev, cover_url: url }));
        showToast?.(
          isHt ? 'Kouvèti telechaje!' : 'Cover uploaded!',
          'check-circle',
        );
      }
    } catch (err) {
      showToast?.(
        err?.message === 'too_large'
          ? (isHt ? 'Imaj twò gwo (maks 8 MB).' : 'Image too large (max 8 MB).')
          : (isHt ? 'Erè nan telechaje kouvèti.' : 'Error uploading cover.'),
        'exclamation-triangle',
      );
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {coverInputRef.current.value = '';}
    }
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

  const handleSave = useCallback(async () => {
    if (saving) { return; }
    if (recoverDraft) {
      showToast?.(
        isHt
          ? 'Chwazi Retabli oswa Efase bouyon an anvan w sove.'
          : 'Recover or discard the local draft before saving.',
        'exclamation-triangle',
      );
      return;
    }
    setSaveError(null);
    setSaving(true);
    // Layout is saved through its own settings endpoint; profile fields
    // through updateMe. Strip the layout keys from the profile payload so
    // the profile serializer never sees them.
    const draft = { ...form };
    delete draft.section_order;
    delete draft.section_visibility;
    const layout = mergeSectionConfig({
      section_order: form.section_order,
      section_visibility: form.section_visibility,
    });
    const savedLayout = mergeSectionConfig(profile?.section_config || null);
    const layoutChanged = JSON.stringify(layout) !== JSON.stringify(savedLayout);
    const payload = {
      ...draft,
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
    let layoutFailed = false;
    try {
      const res = await creatorProfileService.updateMe(payload);
      let nextProfile = res?.data || profile;
      if (layoutChanged) {
        try {
          await creatorProfileService.updateSectionConfig(layout);
          nextProfile = { ...nextProfile, section_config: layout };
        } catch {
          layoutFailed = true;
          setSaveError({
            message: isHt
              ? 'Pwofil la sove, men layout la pa t kapab mete ajou. Lòd ak vizibilite seksyon yo poko pibliye.'
              : 'The profile was saved, but the layout could not be updated. Section order and visibility are not published yet.',
            fields: [{
              field: 'section_config',
              label: 'Layout',
              message: isHt ? 'Ouvri Layout epi sove ankò.' : 'Open Layout and save again.',
              tab: 'layout',
            }],
          });
        }
      }
      setProfile(nextProfile);
      // Only a fully persisted save clears the dirty state. A failed layout
      // write keeps the banner so the creator can retry that half.
      if (!layoutFailed) {
        setBaselineForm(form);
        // The saved profile is now the source of truth; keep the local
        // safety copy only when the layout half failed and still needs retry.
        if (draftKey) { removeFormDraft(draftKey).catch(() => {}); }
      }
      showToast?.(
        layoutFailed
          ? (isHt
            ? 'Pwofil sove, men layout la pa t kapab mete ajou. Eseye ankò.'
            : 'Profile saved, but the layout could not be updated. Try again.')
          : (isHt ? 'Pwofil aktyalize!' : 'Profile updated!'),
        layoutFailed ? 'exclamation-triangle' : 'check-circle',
      );
    } catch (err) {
      const parsed = parseProfileSaveError(err, lang);
      setSaveError(parsed);
      showToast?.(parsed.message, 'exclamation-triangle');
    } finally {
      setSaving(false);
    }
  }, [form, profile, saving, isHt, lang, showToast, recoverDraft, draftKey]);

  // Comfort shortcut: Ctrl/Cmd+S saves without hunting for the button, and
  // never triggers the browser's "save page" dialog while this editor is up.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || String(e.key).toLowerCase() !== 's') { return; }
      // Never save the page behind an open modal/preview dialog.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) { return; }
      e.preventDefault();
      handleSave();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  // Which preset matches the current draft? null = customized layout.
  const currentTemplateId = detectProfileTemplate({
    section_order: form.section_order,
    section_visibility: form.section_visibility,
  });
  const isDirty = Boolean(baselineForm)
    && JSON.stringify(form) !== JSON.stringify(baselineForm);

  const completeness = getProfileCompleteness(profile);
  const seoPreview = buildSeoPreview({
    title: form.seo_title,
    description: form.seo_description,
    artistName: form.artist_name || identity.displayName,
    username: identity.creatorLookupKey,
    bio: form.bio,
  }, lang);
  const jumpToCompletenessTab = useCallback((tabId) => {
    setEditorTab(tabId);
    const focusTab = () => document.getElementById(`profile-editor-tab-${tabId}`)?.focus();
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(focusTab); }
    else { focusTab(); }
  }, []);

  // Autosave the draft locally while it differs from the saved profile.
  // Paused while a recovery prompt is open so the current server form never
  // overwrites the very draft the creator is being asked about.
  useEffect(() => {
    if (!draftKey || !isDirty || recoverDraft || !draftCheckDone) { return undefined; }
    const timer = setTimeout(() => {
      saveFormDraft(draftKey, {
        form,
        savedAt: Date.now(),
        profileId: profile?.id || null,
      })
        .then((result) => {
          // Storage quota failure is a real state — warn once instead of
          // pretending the safety copy exists.
          if (result?.ok === false && !draftSaveWarned.current) {
            draftSaveWarned.current = true;
            showToast?.(
              isHt
                ? 'Espas stokaj la plen — bouyon lokal la pa ka sovgade. Sove manyèlman pou pa pèdi travay ou.'
                : 'Local storage is full — the safety draft cannot be saved. Save manually so you do not lose work.',
              'exclamation-triangle',
            );
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draftKey, isDirty, recoverDraft, draftCheckDone, form, profile?.id, isHt, showToast]);

  // Browser-level safety net: a reload/tab-close with unpublished edits
  // must ask first. In-app navigation is guarded by the visible banner.
  useEffect(() => {
    if (!isDirty) { return undefined; }
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const handleDiscard = useCallback(() => {
    setSaveError(null);
    if (draftKey) { removeFormDraft(draftKey).catch(() => {}); }
    if (profile) { populateForm(profile); }
  }, [draftKey, profile, populateForm]);

  const handleRecoverDraft = useCallback(() => {
    if (!recoverDraft?.form) { return; }
    setSaveError(null);
    // Merge onto the server form so keys added in newer app versions stay.
    setForm((prev) => ({ ...prev, ...recoverDraft.form }));
    setRecoverDraft(null);
    showToast?.(
      isHt ? 'Bouyon retabli — verifye epi sove.' : 'Draft recovered — review and save.',
      'check-circle',
    );
  }, [recoverDraft, isHt, showToast]);

  const handleDiscardDraft = useCallback(() => {
    if (draftKey) { removeFormDraft(draftKey).catch(() => {}); }
    setRecoverDraft(null);
    showToast?.(
      isHt ? 'Bouyon efase. Fòm nan rete jan li te sove a.' : 'Draft discarded. The form is back to the saved version.',
      'check-circle',
    );
  }, [draftKey, isHt, showToast]);

  // The only in-app navigation out of this editor still asks before losing
  // unpublished work; "View live" opens a new tab and never loses it.
  const handleGoToSettings = useCallback(() => {
    if (isDirty) {
      setLeaveConfirmOpen(true);
      return;
    }
    navigate('/sheet/studio?section=profile_settings');
  }, [isDirty, navigate]);

  const confirmLeaveWithoutSaving = useCallback(() => {
    setLeaveConfirmOpen(false);
    navigate('/sheet/studio?section=profile_settings');
  }, [navigate]);

  if (loading) {return <StudioSkeleton rows={4} />;}

  // ─── Empty / Error states ──────────────────────────────────────────
  if (!profile) {
    if (user?.premium?.is_premium) {
      return (
        <div className={styles.section}>
          <SectionHeader
            icon="fa-user-circle"
            title={isHt ? 'Foto pwofil Premium' : 'Premium profile photo'}
            lang={lang}
            help={{
              ht: 'Kont Premium yo ka mete foto kont yo isit la. Sa pa aktive yon pwofil kreyatè ni lòt zouti kreyatè.',
              en: 'Premium accounts can upload their account photo here. This does not activate a creator profile or other creator tools.',
            }}
          />
          {(form.avatar_url || user.avatar_url) && (
            <img
              src={form.avatar_url || user.avatar_url}
              alt={isHt ? 'Foto pwofil' : 'Profile photo'}
              style={{ width: 112, height: 112, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }}
            />
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
          >
            <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`} aria-hidden="true" />{' '}
            {uploadingAvatar
              ? (isHt ? 'Ap telechaje...' : 'Uploading...')
              : (isHt ? 'Telechaje foto pwofil' : 'Upload profile photo')}
          </button>
        </div>
      );
    }

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
          ? 'Aperè an dirèk a mete ajou pandan w tape. Ctrl/⌘+S sove san w kite jaden an.'
          : 'The live preview updates as you type. Ctrl/⌘+S saves without leaving the field.'}
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

      {saveError && (
        <div className={styles.profileSaveError} role="alert">
          <div className={styles.profileSaveErrorHead}>
            <i className="fas fa-circle-exclamation" aria-hidden="true" />
            <strong>{isHt ? 'Pwofil la pa t sove' : 'Profile could not be saved'}</strong>
          </div>
          <p className={styles.profileSaveErrorMessage}>{saveError.message}</p>
          {saveError.fields.length > 0 && (
            <ul className={styles.profileSaveErrorFields}>
              {saveError.fields.map((field) => (
                <li key={field.field}>
                  {field.tab ? (
                    <button
                      type="button"
                      className={styles.profileSaveErrorField}
                      onClick={() => jumpToCompletenessTab(field.tab)}
                      aria-label={`${isHt ? 'Ale nan' : 'Go to'} ${field.label}: ${field.message}`}
                    >
                      <strong>{field.label}</strong>
                      <span>{field.message}</span>
                      <i className="fas fa-arrow-right" aria-hidden="true" />
                    </button>
                  ) : (
                    <div className={`${styles.profileSaveErrorField} ${styles.profileSaveErrorFieldStatic}`}>
                      <strong>{field.label}</strong>
                      <span>{field.message}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recoverDraft && (
        <div className={styles.profileDraftBanner}>
          <DraftRecoveryBanner
            lang={lang}
            timestamp={recoverDraft.savedAt}
            onRecover={handleRecoverDraft}
            onDiscard={handleDiscardDraft}
          />
        </div>
      )}

      {completeness && (
        <ProfileCompletenessCard
          completeness={completeness}
          lang={lang}
          isDirty={isDirty}
          onJump={jumpToCompletenessTab}
        />
      )}

      {isDirty && (
        <div className={styles.profileEditorDirtyBar} role="status">
          <span className={styles.profileEditorDirtyText}>
            <i className="fas fa-circle-exclamation" aria-hidden="true" />{' '}
            {isHt
              ? 'Chanjman ki poko sove — sove pou pibliye yo.'
              : 'Unsaved changes — save to publish them.'}
          </span>
          <div className={styles.profileEditorDirtyActions}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDiscard}
              disabled={saving}
            >
              {isHt ? 'Jete chanjman' : 'Discard'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />{' '}
              {isHt ? 'Sove kounye a' : 'Save now'}
            </button>
          </div>
        </div>
      )}

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
                id={`profile-editor-tab-${t.id}`}
                aria-selected={editorTab === t.id}
                aria-controls={`profile-editor-panel-${t.id}`}
                tabIndex={editorTab === t.id ? 0 : -1}
                className={`${styles.profileEditorTab} ${editorTab === t.id ? styles.profileEditorTabActive : ''}`}
                onClick={() => setEditorTab(t.id)}
                onKeyDown={(e) => handleEditorTabKeyDown(e, EDITOR_TABS.indexOf(t))}
              >
                <i className={`fas ${t.icon}`} aria-hidden="true" />
                {tabLabel(t)}
              </button>
            ))}
          </div>

      <div
        className={styles.profileForm}
        role="tabpanel"
        id={`profile-editor-panel-${editorTab}`}
        aria-labelledby={`profile-editor-tab-${editorTab}`}
      >
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
            {isHt ? 'Tit SEO' : 'SEO Title'}{' '}
            <span className={`${styles.seoCounter}${seoPreview.titleTooLong ? ` ${styles.seoCounterWarn}` : ''}`}>
              ({(form.seo_title || '').length}/{SEO_RECOMMENDED.title})
            </span>
          </span>
          <input
            type="text"
            className={styles.formInput}
            value={form.seo_title || ''}
            maxLength={160}
            onChange={(e) => handleChange('seo_title', e.target.value.slice(0, 160))}
            placeholder={isHt ? 'Tit pou motè rechèch' : 'Title for search engines'}
            aria-describedby="profile-seo-guidance"
          />
        </label>

        {/* SEO Description */}
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Deskripsyon SEO' : 'SEO Description'}{' '}
            <span className={`${styles.seoCounter}${seoPreview.descriptionTooLong ? ` ${styles.seoCounterWarn}` : ''}`}>
              ({(form.seo_description || '').length}/{SEO_RECOMMENDED.description})
            </span>
          </span>
          <textarea
            className={styles.formTextarea}
            value={form.seo_description || ''}
            onChange={(e) => handleChange('seo_description', e.target.value)}
            placeholder={isHt ? 'Deskripsyon pou motè rechèch' : 'Description for search engines'}
            rows={3}
            aria-describedby="profile-seo-guidance"
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

        {/* Real search-result preview built from the current draft. */}
        <div
          className={styles.seoPreview}
          role="group"
          aria-label={isHt ? 'Apèsi rezilta rechèch' : 'Search result preview'}
        >
          <div className={styles.seoPreviewLabel}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" />{' '}
            {isHt ? 'Apèsi nan rechèch' : 'Search preview'}
          </div>
          <div className={styles.seoPreviewCard}>
            <div className={styles.seoPreviewSite}>
              <span className={styles.seoPreviewFavicon} aria-hidden="true">
                {identity.initial}
              </span>
              <span className={styles.seoPreviewSiteText}>
                <strong>Atelnyo</strong>
                <span className={styles.seoPreviewUrl}>{seoPreview.url}</span>
              </span>
            </div>
            <div className={styles.seoPreviewTitle}>{seoPreview.title}</div>
            <p className={styles.seoPreviewDesc}>{seoPreview.description}</p>
          </div>
          <p className={styles.seoPreviewHint} id="profile-seo-guidance">
            {isHt
              ? 'Apèsi sa a tronke jan Google souvan fè l. Rekòmande: 60 karaktè pou tit, 160 pou deskripsyon. Tit la gen yon maks backend 160.'
              : 'This preview truncates the way search results often do. Recommended: 60 characters for the title, 160 for the description. The title has a backend maximum of 160.'}
          </p>
        </div>
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
        {/* ─── Profile templates — one-click layout presets ──── */}
        <div className={styles.fieldGroup}>
          <div className={styles.profileTemplateHeader}>
            <span className={styles.fieldLabel}>
              {isHt ? 'Modèl Pwofil' : 'Profile Templates'}
            </span>
            <button
              type="button"
              className={styles.profileAddChip}
              onClick={() => setTemplateModalOpen(true)}
            >
              <i className="fas fa-layer-group" aria-hidden="true" />{' '}
              {isHt ? 'Wè tout modèl yo' : 'Browse templates'}
            </button>
          </div>
          <p className={styles.profileLayoutHint}>
            {isHt
              ? 'Yon modèl chanje lòd ak vizibilite seksyon yo — li pa janm efase kontni ou.'
              : 'A template changes section order and visibility — it never deletes your content.'}
          </p>
          <div className={styles.profileTemplateStrip}>
            {PROFILE_TEMPLATES.map((template) => {
              const active = currentTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={active}
                  className={`${styles.profileTemplateChip}${active ? ` ${styles.profileTemplateChipActive}` : ''}`}
                  onClick={() => applyTemplate(
                    applyProfileTemplate(template, {
                      section_order: form.section_order,
                      section_visibility: form.section_visibility,
                    }),
                    template,
                  )}
                >
                  <span className={styles.profileTemplateChipIcon}>
                    <i className={`fas ${template.icon}`} aria-hidden="true" />
                  </span>
                  <span className={styles.profileTemplateChipName}>
                    {templateName(template, lang)}
                  </span>
                  <span className={styles.profileTemplateChipDesc}>
                    {templateDescription(template, lang)}
                  </span>
                </button>
              );
            })}
          </div>
          {!currentTemplateId && (
            <span className={styles.profileTemplateCustom}>
              <i className="fas fa-sliders-h" aria-hidden="true" />{' '}
              {isHt ? 'Layout pèsonalize' : 'Custom layout'}
            </span>
          )}
        </div>

        {/* ─── Section order + visibility (saved with Save) ──── */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {isHt ? 'Òd ak Viwabilite Seksyon' : 'Section Order & Visibility'}
          </span>
          <p className={styles.profileLayoutHint}>
            {isHt
              ? 'Monte oswa desann seksyon yo epi itilize switch la pou kache oswa montre yo. Chanjman yo parèt nan aperè a epi yo sove ak bouton Sove a.'
              : 'Move sections up or down and use the switch to hide or show them. Changes appear in the preview and are saved with the Save button.'}
          </p>
          <div className={styles.profileLayoutList}>
            {(form.section_order || []).map((sectionId, index) => {
              const section = RAIL_ITEMS.find((item) => item.id === sectionId);
              if (!section) return null;
              const visible = form.section_visibility?.[sectionId] !== false;
              const label = lang === 'ht' ? section.labelHt : lang === 'fr' ? section.labelFr : section.label;
              return (
                <div
                  key={sectionId}
                  className={`${styles.profileLayoutRow}${visible ? '' : ` ${styles.profileLayoutRowHidden}`}`}
                >
                  <span className={styles.profileLayoutOrder}>{index + 1}</span>
                  <span className={styles.profileLayoutIcon}>
                    <i className={`fas ${section.icon}`} aria-hidden="true" />
                  </span>
                  <span className={styles.profileLayoutLabel}>{label}</span>
                  <div className={styles.profileLayoutButtons}>
                    <button
                      type="button"
                      className={styles.profileLayoutBtn}
                      onClick={() => moveLayoutSection(index, -1)}
                      disabled={index === 0}
                      title={isHt ? 'Monte' : 'Move up'}
                      aria-label={`${label}: ${isHt ? 'monte' : 'move up'}`}
                    >
                      <i className="fas fa-chevron-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.profileLayoutBtn}
                      onClick={() => moveLayoutSection(index, 1)}
                      disabled={index === (form.section_order || []).length - 1}
                      title={isHt ? 'Desann' : 'Move down'}
                      aria-label={`${label}: ${isHt ? 'desann' : 'move down'}`}
                    >
                      <i className="fas fa-chevron-down" aria-hidden="true" />
                    </button>
                  </div>
                  <label className={styles.profileLayoutToggle}>
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleLayoutSection(sectionId)}
                      aria-label={`${label}: ${isHt ? 'vizib' : 'visible'}`}
                    />
                    <span className={styles.profileLayoutToggleTrack} aria-hidden="true" />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.profileEditorNote}>
          <i className="fas fa-circle-info" aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isHt ? 'Plis opsyon nan Profile Settings' : 'More options in Profile Settings'}
            </p>
            <p style={{ margin: '4px 0 10px', fontSize: '0.8rem', color: 'var(--text-secondary, #888)' }}>
              {isHt
                ? 'Profile Settings gen tou kontni an vedèt (kou, pwodwi, pòtfolyo) ak abònman peyan.'
                : 'Profile Settings also holds featured content (courses, products, portfolio) and paid subscriptions.'}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleGoToSettings}
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
        <aside className={`${styles.profileEditorPreviewPane}${previewCollapsed ? ` ${styles.profileEditorPreviewPaneCollapsed}` : ''}`}>
          <div className={styles.profileEditorPreviewBar}>
            <span className={styles.profileEditorPreviewDot} aria-hidden="true" />
            <span className={styles.profileEditorPreviewLabel}>
              {isHt ? 'Aperè an dirèk' : 'Live Preview'}
            </span>
            <button
              type="button"
              className={`${styles.profileEditorPreviewDevice}${previewViewport === 'mobile' ? ` ${styles.profileEditorPreviewDeviceActive}` : ''}`}
              onClick={() => setPreviewViewport((value) => (value === 'mobile' ? 'desktop' : 'mobile'))}
              aria-pressed={previewViewport === 'mobile'}
              aria-label={previewViewport === 'mobile'
                ? (isHt ? 'Aperè desktop' : 'Desktop preview')
                : (isHt ? 'Aperè mobil' : 'Mobile preview')}
              title={previewViewport === 'mobile'
                ? (isHt ? 'Aperè desktop' : 'Desktop preview')
                : (isHt ? 'Aperè mobil' : 'Mobile preview')}
            >
              <i className={`fas ${previewViewport === 'mobile' ? 'fa-desktop' : 'fa-mobile-alt'}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.profileEditorPreviewCollapse}
              onClick={() => setPreviewCollapsed((collapsed) => !collapsed)}
              aria-expanded={!previewCollapsed}
              aria-label={previewCollapsed
                ? (isHt ? 'Montre aperè a' : 'Show live preview')
                : (isHt ? 'Kache aperè a' : 'Hide live preview')}
              title={previewCollapsed
                ? (isHt ? 'Montre aperè a' : 'Show live preview')
                : (isHt ? 'Kache aperè a' : 'Hide live preview')}
            >
              <i className={`fas ${previewCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.profileEditorPreviewExpand}
              onClick={openPreview}
              title={isHt ? 'Aperè tout ekran' : 'Full-screen preview'}
              aria-label={isHt ? 'Aperè tout ekran' : 'Full-screen preview'}
            >
              <i className="fas fa-expand" aria-hidden="true" />
            </button>
          </div>
          {!previewCollapsed && (
            <div className={`${styles.profileEditorPreviewFrame}${previewViewport === 'mobile' ? ` ${styles.profileEditorPreviewFrameMobile}` : ''}`}>
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
          )}
        </aside>
      </div>

      {/* ─── Full-screen preview — the REAL public profile page from the draft ─ */}
      {previewOpen && previewProfile && (
        <div
          ref={previewDialogRef}
          tabIndex={-1}
          className="csp-preview-shell"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={isHt ? 'Aperè pwofil piblik' : 'Public profile preview'}
        >
          <button
            ref={previewCloseRef}
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

      {/* ─── Template picker — drafts only; Save publishes ────── */}
      {templateModalOpen && (
        <ProfileTemplateModal
          lang={lang}
          currentTemplateId={currentTemplateId}
          currentConfig={{
            section_order: form.section_order,
            section_visibility: form.section_visibility,
          }}
          onClose={() => setTemplateModalOpen(false)}
          onApply={applyTemplate}
        />
      )}

      {leaveConfirmOpen && (
        <StudioModal
          onClose={() => setLeaveConfirmOpen(false)}
          icon="fa-triangle-exclamation"
          title={isHt ? 'Kite paj la?' : 'Leave this page?'}
        >
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {isHt
              ? 'Ou gen chanjman ki poko pibliye. Yon bouyon lokal konsève yo, men yo p ap parèt sou pwofil piblik ou jiskaske w sove.'
              : 'You have unpublished changes. A local draft keeps them, but they will not appear on your public profile until you save.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setLeaveConfirmOpen(false)}
            >
              {isHt ? 'Rete sou paj la' : 'Stay on this page'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={confirmLeaveWithoutSaving}
            >
              {isHt ? 'Kite san sove' : 'Leave without saving'}
            </button>
          </div>
        </StudioModal>
      )}
    </div>
  );
}
