/**
 * src/components/studio/editor/CommunityEditor.jsx
 */
import React, { useCallback, useRef, useState } from 'react';
import api, { communitiesService } from '../../../services/api';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';

// Canonical category vocabulary — same slugs as CreateCommunityModal and
// the backend CATEGORY_CHOICES. The backend auto-creates unknown labels,
// so the editor stays on the fixed list to avoid polluting the taxonomy.
// Labels are display names; the API resolves slug or name on write.
const CATEGORY_OPTIONS = [
  { value: 'tech', ht: 'Teknoloji', en: 'Technology' },
  { value: 'art', ht: 'A & Design', en: 'Art & Design' },
  { value: 'music', ht: 'Mizik', en: 'Music' },
  { value: 'education', ht: 'Edikasyon', en: 'Education' },
  { value: 'business', ht: 'Biznis', en: 'Business' },
  { value: 'health', ht: 'Sante', en: 'Health & Wellness' },
  { value: 'gaming', ht: 'Jwèt', en: 'Gaming' },
  { value: 'sports', ht: 'Espò', en: 'Sports' },
  { value: 'food', ht: 'Manje & Kwi', en: 'Food & Cooking' },
  { value: 'travel', ht: 'Vwayaj', en: 'Travel' },
  { value: 'charity', ht: 'Charite', en: 'Charity & Causes' },
  { value: 'other', ht: 'Lòt', en: 'Other' },
];

// The API returns the display name ("Technology"); the select works on
// slugs ("tech"). Match either so edit mode preselects correctly.
const categoryToSlug = (raw) => {
  if (!raw) return 'other';
  const needle = String(raw).trim().toLowerCase();
  const hit = CATEGORY_OPTIONS.find(
    (o) => o.value === needle || o.en.toLowerCase() === needle || o.ht.toLowerCase() === needle,
  );
  return hit ? hit.value : 'other';
};
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, { PropertyGroup, PropField, PropInput } from './StudioPropertiesPanel';
import CommunityFounderOverview from './CommunityFounderOverview';
import CommunityMembersPanel from './CommunityMembersPanel';
import CommunityPostsPanel from './CommunityPostsPanel';
import CommunityEventsPanel from './CommunityEventsPanel';
import CommunityFilesPanel from './CommunityFilesPanel';
import CommunityAnnouncementsPanel from './CommunityAnnouncementsPanel';
import CommunityStarterTemplates from './CommunityStarterTemplates';
import CommunityPreviewCard from './CommunityPreviewCard';
import { buildTemplateDraft } from './communityTemplates';
import RuleTemplatePicker from '../../community/RuleTemplatePicker';
import { mergeRuleLists } from '../../community/ruleTemplates';
import { PanelHeader } from './communityPanelUI';
import { ImageUrlField } from '../modals/shared';
import panelStyles from './communityEditor.module.css';

export default function CommunityEditor({ onClose, onSuccess, onSaved, lang = 'en', showToast, user, item }) {
  const isHt = lang === 'ht';
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    category: categoryToSlug(item?.category),
    hashtags: hashtagsToInput(item?.tags),
    join_mode: item?.join_mode || 'public',
    avatar_url: item?.avatar_url || '',
    banner_url: item?.banner_url || '',
    // Archive switch — is_active=false hides the community everywhere
    // (listings filter it out) without destroying data. DELETE (danger
    // zone below) is the irreversible path, owner only.
    is_active: item?.is_active ?? true,
    // House rules — ordered [{title, description}]. The backend replaces
    // the whole list on save (POST .../rules/), so the editor owns the
    // full list and syncs it after the community itself is saved.
    rules: Array.isArray(item?.rules)
      ? [...item.rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((r) => ({ title: r.title || '', description: r.description || '' }))
      : [],
  });
  const [newRule, setNewRule] = useState({ title: '', description: '' });
  const [showRuleTemplates, setShowRuleTemplates] = useState(false);
  // Which starter template was last applied — purely visual (a check on
  // the card). The form fields remain the source of truth afterwards.
  const [appliedTemplate, setAppliedTemplate] = useState('');
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Founder workspace tab — overview is the landing tab for an existing
  // community; a brand-new one starts on the profile form (management
  // tabs need a persisted slug).
  const [tab, setTab] = useState(isEdit ? 'overview' : 'profile');
  const dirtyRef = useRef(false);
  const savedIdRef = useRef(isEdit ? (item.slug || item.id) : null);
  // Gallery upload — avatar + banner accept URL paste OR file picker.
  // Uses the generic POST /api/media/upload/ (all authenticated users),
  // same flow as MediaUploadButton, so phones can pick from the gallery.
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) { dirtyRef.current = true; setDirty(true); setSaveState('dirty'); }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
  }, [errors, markDirty]);

  const uploadImageFile = useCallback(async (file, field) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      showToast?.(isHt ? 'Chwazi yon fichye imaj.' : 'Please select an image file.', 'exclamation-triangle');
      return;
    }
    const setUploading = field === 'avatar_url' ? setUploadingAvatar : setUploadingBanner;
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      const res = await api.post('media/upload/', { file: base64, kind: 'image', filename: file.name || 'community-image' });
      const url = res?.data?.url;
      if (url) {
        setForm((f) => ({ ...f, [field]: url }));
        setErrors((e) => ({ ...e, [field]: null }));
        markDirty();
        showToast?.(isHt ? 'Imaj telechaje!' : 'Image uploaded!', 'check-circle');
      }
    } catch {
      showToast?.(isHt ? 'Erè nan telechaje imaj.' : 'Image upload failed.', 'circle-exclamation');
    } finally {
      setUploading(false);
    }
  }, [isHt, showToast, markDirty]);

  const validate = useCallback(() => {
    const errs = {};
    if (!form.name.trim()) errs.name = isHt ? 'Non obligatwa' : 'Name required';
    if (form.name.trim().length < 3) errs.name = isHt ? 'Omwen 3 karaktè' : 'At least 3 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isHt]);

  const handleRuleChange = useCallback((index, field, value) => {
    setForm((f) => ({
      ...f,
      rules: (f.rules || []).map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
    markDirty();
  }, [markDirty]);

  const addRule = useCallback(() => {
    if (!newRule.title.trim()) return;
    setForm((f) => ({
      ...f,
      rules: [...(f.rules || []), { title: newRule.title.trim(), description: newRule.description.trim() }],
    }));
    setNewRule({ title: '', description: '' });
    markDirty();
  }, [newRule, markDirty]);

  // Append-only: selecting templates must never erase rules the founder
  // already wrote (the previous shortcut silently replaced the list).
  const addTemplateRules = useCallback((incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setForm((f) => ({
      ...f,
      rules: mergeRuleLists(f.rules || [], incoming),
    }));
    markDirty();
    showToast?.(
      isHt
        ? `${incoming.length} règ ajoute. Ou ka chanje yo anba a.`
        : `${incoming.length} rule${incoming.length === 1 ? '' : 's'} added. You can edit them below.`,
      'wand-magic-sparkles',
    );
  }, [isHt, markDirty, showToast]);

  // Starter templates own only the descriptive fields + the first set
  // of rules. The name, images, and visibility stay the founder's, so
  // applying a template never overwrites an upload or a half-typed name.
  // Existing hand-written rules are kept too — replacing them silently
  // would throw away work (remove them first to take the template's).
  const applyTemplate = useCallback((template) => {
    const draft = buildTemplateDraft(template, lang);
    if (!draft) return;
    const keepsRules = (form.rules || []).length > 0;
    setForm((f) => ({
      ...f,
      description: draft.description,
      category: draft.category,
      hashtags: draft.hashtags,
      join_mode: draft.join_mode,
      rules: (f.rules || []).length > 0 ? f.rules : draft.rules,
    }));
    setAppliedTemplate(template.id);
    setErrors((e) => ({ ...e, _api: null }));
    markDirty();
    showToast?.(
      keepsRules
        ? (isHt
          ? `Modèl « ${template.title.ht} » aplike. Règleman w yo kenbe — efase yo pou pran sa modèl la.`
          : `“${template.title.en}” template applied. Your rules were kept — clear them to use the template's.`)
        : (isHt
          ? `Modèl « ${template.title.ht} » aplike. Ou ka chanje tout bagay.`
          : `“${template.title.en}” template applied. Everything is editable.`),
      'wand-magic-sparkles',
    );
  }, [lang, isHt, form.rules, markDirty, showToast]);

  const removeRule = useCallback((index) => {
    setForm((f) => ({ ...f, rules: (f.rules || []).filter((_, i) => i !== index) }));
    markDirty();
  }, [markDirty]);

  const moveRule = useCallback((index, delta) => {
    setForm((f) => {
      const next = [...(f.rules || [])];
      const target = index + delta;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...f, rules: next };
    });
    markDirty();
  }, [markDirty]);

  const doSave = useCallback(async (publish = false) => {
    if (!validate()) { setSaveState('error'); return false; }
    setSaveState('saving');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category || 'other',
      tags: parseHashtags(form.hashtags),
      join_mode: form.join_mode,
      avatar_url: form.avatar_url.trim() || undefined,
      banner_url: form.banner_url.trim() || undefined,
      is_active: Boolean(form.is_active),
    };
    try {
      let res;
      if (isEdit && savedIdRef.current) {
        res = await communitiesService.update(savedIdRef.current, payload);
      } else {
        res = await communitiesService.create(payload);
        const data = res?.data?.data || res?.data;
        if (data?.slug || data?.id) savedIdRef.current = data.slug || data.id;
      }
      dirtyRef.current = false; setDirty(false); setSaveState('saved');
      onSaved?.();
      // Sync house rules (replace-all). Skipped only for a brand-new
      // community with no rules — avoids a pointless extra call.
      const hadRules = isEdit && Array.isArray(item?.rules) && item.rules.length > 0;
      if (form.rules.length > 0 || hadRules) {
        const slugForRules = isEdit ? (item?.slug || item?.id) : savedIdRef.current;
        try {
          await communitiesService.saveRules(slugForRules, form.rules.map((r) => ({
            title: r.title.trim(),
            description: (r.description || '').trim(),
          })).filter((r) => r.title));
        } catch (ruleErr) {
          showToast?.(ruleErr?.response?.data?.detail || (isHt ? 'Kominote sove, men règleman yo pa sove.' : 'Community saved, but rules were not saved.'), 'circle-exclamation');
        }
      }
      showToast?.(isHt ? '✅ Kominote sove' : '✅ Community saved', 'check-circle');
      setTimeout(() => setSaveState('idle'), 1500);
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.name?.[0] || err?.message || (isHt ? 'Pa t kapab sove' : 'Could not save');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
      setSaveState('error');
      return false;
    }
  }, [form, isEdit, isHt, onSaved, showToast, validate]);

  const handleSave = useCallback(() => doSave(false), [doSave]);
  const handlePublish = useCallback(async () => { const ok = await doSave(true); if (ok) { onSuccess?.(); onClose?.(); } }, [doSave, onClose, onSuccess]);

  // ─── Danger zone: delete (owner only, irreversible) ───────────────
  const [deleteArmed, setDeleteArmed] = useState(false);
  const handleDelete = useCallback(async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }
    const slug = isEdit ? (item?.slug || item?.id) : savedIdRef.current;
    if (!slug) return;
    setSaveState('saving');
    try {
      await communitiesService.delete(slug);
      showToast?.(isHt ? 'Kominote efase.' : 'Community deleted.', 'trash-can');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (isHt ? 'Pa t kapab efase.' : 'Could not delete.'), 'circle-exclamation');
      setSaveState('error');
    } finally {
      setDeleteArmed(false);
    }
  }, [deleteArmed, isEdit, isHt, item, onClose, onSuccess, showToast]);

  const communityIdentifier = isEdit ? (item?.slug || item?.id) : savedIdRef.current;
  const communityUrl = communityIdentifier && typeof window !== 'undefined'
    ? `${window.location.origin}/community/${encodeURIComponent(communityIdentifier)}`
    : '';

  const createInviteLink = useCallback(async () => {
    if (!communityIdentifier) return;
    setInviteBusy(true);
    try {
      const response = await communitiesService.createInviteLink(communityIdentifier);
      const token = response?.data?.token;
      if (!token) throw new Error('The server did not return an invitation token.');
      setInviteUrl(`${window.location.origin}/community/${encodeURIComponent(communityIdentifier)}/home#invite=${encodeURIComponent(token)}`);
      setInviteExpiresAt(response.data.expires_at || '');
      showToast?.(isHt ? 'Nouvo lyen envitasyon kreye.' : 'New invite link created.', 'check-circle');
    } catch (error) {
      showToast?.(
        error?.response?.data?.detail || (isHt ? 'Pa t kapab kreye lyen an.' : 'Could not create the invite link.'),
        'circle-exclamation',
      );
    } finally {
      setInviteBusy(false);
    }
  }, [communityIdentifier, communityUrl, isHt, showToast]);

  const revokeInviteLinks = useCallback(async () => {
    if (!communityIdentifier) return;
    if (!window.confirm(isHt
      ? 'Anile tout lyen envitasyon ki poko ekspire?'
      : 'Revoke all invitation links that have not expired?')) return;
    setInviteBusy(true);
    try {
      await communitiesService.revokeInviteLinks(communityIdentifier);
      setInviteUrl('');
      setInviteExpiresAt('');
      showToast?.(isHt ? 'Lyen envitasyon yo anile.' : 'Invite links revoked.', 'check-circle');
    } catch (error) {
      showToast?.(
        error?.response?.data?.detail || (isHt ? 'Pa t kapab anile lyen yo.' : 'Could not revoke invite links.'),
        'circle-exclamation',
      );
    } finally {
      setInviteBusy(false);
    }
  }, [communityIdentifier, isHt, showToast]);

  const copyInviteLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast?.(isHt ? 'Lyen envitasyon kopye!' : 'Invite link copied!', 'link');
    } catch {
      showToast?.(inviteUrl, 'link');
    }
  }, [inviteUrl, isHt, showToast]);

  const copyLink = useCallback(async () => {
    if (!communityUrl) return;
    try {
      await navigator.clipboard.writeText(communityUrl);
      showToast?.(isHt ? 'Lyen kopye!' : 'Link copied!', 'link');
    } catch {
      showToast?.(communityUrl, 'link');
    }
  }, [communityUrl, isHt, showToast]);

  const validationList = [];
  if (!form.name.trim()) validationList.push({ id: 'name', label: isHt ? 'Non obligatwa' : 'Name required', zone: 'editor' });

  // ─── Founder workspace tabs ─────────────────────────────────────
  // Management surfaces (overview/members/announcements) need a saved
  // community; before the first save only the profile form exists.
  const canManage = Boolean(communityIdentifier);
  const tabs = [
    ...(canManage ? [{ id: 'overview', icon: 'fa-chart-simple', label: isHt ? 'Apèsi' : 'Overview' }] : []),
    { id: 'profile', icon: 'fa-id-card', label: isHt ? 'Pwofil' : 'Profile' },
    ...(canManage ? [
      { id: 'members', icon: 'fa-users-gear', label: isHt ? 'Manm' : 'Members' },
      { id: 'posts', icon: 'fa-comments', label: isHt ? 'Pòs' : 'Posts' },
      { id: 'events', icon: 'fa-calendar-days', label: isHt ? 'Evènman' : 'Events' },
      { id: 'resources', icon: 'fa-folder-open', label: isHt ? 'Fichye & Kou' : 'Files & Courses' },
      { id: 'announcements', icon: 'fa-bullhorn', label: isHt ? 'Anons' : 'Announcements' },
      { id: 'settings', icon: 'fa-sliders', label: isHt ? 'Paramèt' : 'Settings' },
    ] : []),
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'profile';
  const isOwner = (item?.current_user_role || 'owner') === 'owner';
  const canModerate = isOwner || ['admin', 'moderator'].includes(item?.current_user_role);
  // Counts come from the community row itself — no extra request, and
  // they give the tab bar the live-feeling badges of a real dashboard.
  const tabCounts = {
    members: item?.member_count,
    events: item?.event_count,
  };

  const onTabKeyDown = (event, index) => {
    const { key } = event;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    let next = index;
    if (key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (key === 'Home') next = 0;
    if (key === 'End') next = tabs.length - 1;
    setTab(tabs[next].id);
    document.getElementById(`community-tab-${tabs[next].id}`)?.focus();
  };

  const tabBar = (
    <div className={panelStyles.tabBar} role="tablist" aria-label={isHt ? 'Zòn jesyon kominote' : 'Community workspace'}>
      {tabs.map((t, index) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`community-tab-${t.id}`}
          aria-selected={activeTab === t.id}
          aria-controls="community-tabpanel"
          tabIndex={activeTab === t.id ? 0 : -1}
          className={`${panelStyles.tab} ${activeTab === t.id ? panelStyles.tabActive : ''}`}
          onClick={() => setTab(t.id)}
          onKeyDown={(event) => onTabKeyDown(event, index)}
        >
          <i className={`fas ${t.icon}`} aria-hidden="true" />
          {t.label}
          {typeof tabCounts[t.id] === 'number' && tabCounts[t.id] > 0 && (
            <span className={panelStyles.tabCount}>{tabCounts[t.id]}</span>
          )}
        </button>
      ))}
    </div>
  );

  const profileContent = (
    <>
      {errors._api && <div className={panelStyles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      {!canManage && (
        <CommunityStarterTemplates lang={lang} appliedId={appliedTemplate} onApply={applyTemplate} />
      )}
      <div className={panelStyles.profileGrid}>
        <div className={panelStyles.profileColumn}>
          <div className={panelStyles.formSection}>
            <h3 className={panelStyles.formTitle}><i className="fas fa-users" aria-hidden="true" /> {isHt ? 'Enfòmasyon Kominote' : 'Community Info'}</h3>
            <p className={panelStyles.hint} style={{ marginTop: -6 }}>
              {isHt
                ? 'Se sa moun wè sou paj piblik kominote a. Non an obligatwa anvan ou sove.'
                : 'This is what people see on the public community page. The name is required before saving.'}
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              <PropField label={isHt ? 'Non Kominote' : 'Community Name'} required error={errors.name}>
                <PropInput value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={isHt ? 'Non kominote a' : 'Community name'} />
              </PropField>
              <PropField label={isHt ? 'Deskripsyon' : 'Description'}>
                <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={panelStyles.textarea} rows={4} placeholder={isHt ? 'Dekri kominote a...' : 'Describe the community...'} />
              </PropField>
              <PropField label={isHt ? 'Kategori' : 'Category'}>
                <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} className={panelStyles.input}>
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{isHt ? o.ht : o.en}</option>
                  ))}
                </select>
              </PropField>
              <PropField label={isHt ? 'Hashtags' : 'Hashtags'}>
                <PropInput value={form.hashtags} onChange={(e) => handleChange('hashtags', e.target.value)} placeholder="#teknoloji #ayiti" />
              </PropField>
            </div>
          </div>
          <div className={panelStyles.formSection}>
            <h3 className={panelStyles.formTitle}><i className="fas fa-image" aria-hidden="true" /> {isHt ? 'Imaj' : 'Images'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <ImageUrlField label={isHt ? 'URL Avatè' : 'Avatar URL'} value={form.avatar_url} onChange={(v) => handleChange('avatar_url', v)} lang={lang} />
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, 'avatar_url'); e.target.value = ''; }} />
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                  className={panelStyles.secondaryBtn} style={{ marginTop: 8 }}>
                  <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-images'}`} aria-hidden="true" />
                  {uploadingAvatar ? (isHt ? 'Ap telechaje...' : 'Uploading...') : (isHt ? 'Chwazi nan galri' : 'Choose from gallery')}
                </button>
                <div className={panelStyles.hint} style={{ margin: '6px 0 0' }}>{isHt ? 'Kole yon URL oswa pran yon foto nan galri telefòn ou.' : 'Paste a URL or pick a photo from your gallery.'}</div>
              </div>
              <div>
                <ImageUrlField label={isHt ? 'URL Banner' : 'Banner URL'} value={form.banner_url} onChange={(v) => handleChange('banner_url', v)} lang={lang} />
                <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, 'banner_url'); e.target.value = ''; }} />
                <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}
                  className={panelStyles.secondaryBtn} style={{ marginTop: 8 }}>
                  <i className={`fas ${uploadingBanner ? 'fa-spinner fa-spin' : 'fa-images'}`} aria-hidden="true" />
                  {uploadingBanner ? (isHt ? 'Ap telechaje...' : 'Uploading...') : (isHt ? 'Chwazi nan galri' : 'Choose from gallery')}
                </button>
                <div className={panelStyles.hint} style={{ margin: '6px 0 0' }}>{isHt ? 'Kole yon URL oswa pran yon foto nan galri telefòn ou.' : 'Paste a URL or pick a photo from your gallery.'}</div>
              </div>
            </div>
          </div>
        </div>
        <CommunityPreviewCard
          lang={lang}
          value={form}
          rules={form.rules}
          memberCount={item?.member_count ?? 0}
        />
      </div>
    </>
  );

  const settingsGroups = (
    <>
      <PropertyGroup title={isHt ? 'Aksè' : 'Access'} defaultOpen>
        <PropField label={isHt ? 'Fason antre' : 'Join Mode'}>
          <select value={form.join_mode} onChange={(e) => handleChange('join_mode', e.target.value)} className={panelStyles.input}>
            <option value="public">{isHt ? 'Piblik — nenpòt moun antre touswit' : 'Public — anyone joins instantly'}</option>
            <option value="approval">{isHt ? 'Apwobasyon — ou revize chak demann' : 'Approval — you review each request'}</option>
            <option value="invite">{isHt ? 'Fèmen — lyen envitasyon obligatwa' : 'Invite-only — invitation link required'}</option>
          </select>
        </PropField>
        {form.join_mode === 'approval' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {isHt ? 'Demann yo tann nan onglet Manm jiskaske ou apwouve oswa rejte yo.' : 'Requests wait in the Members tab until you approve or reject them.'}
          </p>
        )}
        {form.join_mode === 'invite' && (
          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isHt
                ? 'Kreye yon lyen ki valab 7 jou pou jiska 10 moun. Yon nouvo lyen anile ansyen an.'
                : 'Create a link valid for 7 days and up to 10 people. A new link replaces the previous one.'}
            </p>
            {communityIdentifier ? (
              <>
                <button type="button" onClick={createInviteLink} disabled={inviteBusy}
                  style={{ border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--surface-card, #fff)', borderRadius: 8, padding: '8px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: inviteBusy ? 'wait' : 'pointer' }}>
                  <i className={`fas ${inviteBusy ? 'fa-spinner fa-spin' : 'fa-link'}`} aria-hidden="true" style={{ marginRight: 6 }} />
                  {inviteBusy ? (isHt ? 'Ap travay…' : 'Working…') : (isHt ? 'Kreye / ranplase lyen an' : 'Create / replace link')}
                </button>
                <button type="button" onClick={revokeInviteLinks} disabled={inviteBusy}
                  style={{ border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', borderRadius: 8, padding: '7px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: inviteBusy ? 'wait' : 'pointer' }}>
                  {isHt ? 'Anile tout lyen envitasyon' : 'Revoke all invite links'}
                </button>
                {inviteUrl && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input type="text" readOnly value={inviteUrl} aria-label={isHt ? 'Lyen envitasyon' : 'Invitation link'}
                      style={{ width: '100%', minWidth: 0, border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: '7px 8px', fontSize: '0.72rem' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button type="button" onClick={copyInviteLink}
                        style={{ border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', borderRadius: 8, padding: '5px 9px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        <i className="fas fa-copy" aria-hidden="true" style={{ marginRight: 4 }} />
                        {isHt ? 'Kopye lyen' : 'Copy link'}
                      </button>
                    </div>
                    {inviteExpiresAt && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {isHt ? 'Ekspire:' : 'Expires:'} {new Date(inviteExpiresAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {isHt ? 'Sove kominote a anvan ou kreye lyen an.' : 'Save the community before creating an invite link.'}
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 0' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{isHt ? 'Aktif (vizib tout kote)' : 'Active (visible everywhere)'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{isHt ? 'Etenn pou achive san efase' : 'Turn off to archive without deleting'}</div>
          </div>
          <button type="button" onClick={() => handleChange('is_active', !form.is_active)}
            aria-pressed={Boolean(form.is_active)} aria-label={isHt ? 'Aktif' : 'Active'}
            style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: form.is_active ? 'var(--color-primary)' : 'var(--border-color)', position: 'relative', cursor: 'pointer' }}>
            <span style={{ position: 'absolute', top: 2, left: form.is_active ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
        </div>
      </PropertyGroup>
      <PropertyGroup title={isHt ? 'Enfo' : 'Info'} defaultOpen>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {item?.created_by_username && (
            <div>
              <i className="fas fa-crown" aria-hidden="true" style={{ color: '#f59e0b', marginRight: 6 }} />
              {isHt ? 'Fondatè' : 'Founder'}: @{item.created_by_username}
            </div>
          )}
          <div>👥 {item?.member_count ?? 0} {isHt ? 'manm' : 'members'} · 📅 {item?.event_count ?? 0} {isHt ? 'evènman' : 'events'}</div>
          {communityUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{communityUrl}</span>
              <button type="button" onClick={copyLink}
                style={{ border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <i className="fas fa-link" aria-hidden="true" style={{ marginRight: 4 }} />
                {isHt ? 'Kopye' : 'Copy'}
              </button>
            </div>
          ) : (
            <div>{isHt ? 'Lyen an ap disponib apre premye sove.' : 'The link appears after the first save.'}</div>
          )}
        </div>
      </PropertyGroup>
      {isEdit && (
        <PropertyGroup title={isHt ? 'Zòn danje' : 'Danger zone'} defaultOpen>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saveState === 'saving'}
            style={{ border: `1px solid ${deleteArmed ? '#dc2626' : 'var(--border-color, #e5e7eb)'}`, background: deleteArmed ? 'rgba(220,38,38,0.1)' : 'transparent', color: deleteArmed ? '#dc2626' : 'inherit', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', width: '100%' }}
          >
            <i className="fas fa-trash-can" aria-hidden="true" style={{ marginRight: 6 }} />
            {deleteArmed
              ? (isHt ? 'Konfime efase kominote a?' : 'Confirm delete community?')
              : (isHt ? 'Efase kominote a' : 'Delete community')}
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            {isHt ? 'Aksyon final — sèlman fondatè a. Achive (pi wo a) kache san efase.' : 'Final action — founder only. Archive (above) hides without deleting.'}
          </p>
        </PropertyGroup>
      )}
      <PropertyGroup title={isHt ? 'Règleman' : 'House rules'} defaultOpen>
        <button
          type="button"
          className="cm-template-toggle"
          aria-expanded={showRuleTemplates}
          onClick={() => setShowRuleTemplates((value) => !value)}
          style={{ marginBottom: 10 }}
        >
          <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
          {isHt ? 'Ajoute soti nan modèl' : 'Add from templates'}
        </button>
        {showRuleTemplates && (
          <div style={{ marginBottom: 10 }}>
            <RuleTemplatePicker
              lang={lang}
              existingRules={form.rules || []}
              onAdd={addTemplateRules}
              onClose={() => setShowRuleTemplates(false)}
              testId="community-editor-rule-templates"
            />
          </div>
        )}
        {(form.rules || []).map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', minWidth: 20 }}>{i + 1}.</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => moveRule(i, -1)} disabled={i === 0} aria-label={isHt ? 'Monte' : 'Move up'}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>
                <i className="fas fa-chevron-up" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => moveRule(i, 1)} disabled={i === (form.rules || []).length - 1} aria-label={isHt ? 'Desann' : 'Move down'}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: i === (form.rules || []).length - 1 ? 0.3 : 1 }}>
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => removeRule(i)} aria-label={isHt ? 'Retire règ' : 'Remove rule'}
                style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                <i className="fas fa-trash-can" aria-hidden="true" />
              </button>
            </div>
            <PropInput value={r.title} onChange={(e) => handleRuleChange(i, 'title', e.target.value)} placeholder={isHt ? 'Tit règ la' : 'Rule title'} />
            <div style={{ marginTop: 6 }}>
              <PropInput value={r.description} onChange={(e) => handleRuleChange(i, 'description', e.target.value)} placeholder={isHt ? 'Detay (opsyonèl)' : 'Detail (optional)'} />
            </div>
          </div>
        ))}
        <PropInput value={newRule.title} onChange={(e) => setNewRule((nr) => ({ ...nr, title: e.target.value }))} placeholder={isHt ? 'Nouvo règ...' : 'New rule...'} />
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <PropInput value={newRule.description} onChange={(e) => setNewRule((nr) => ({ ...nr, description: e.target.value }))} placeholder={isHt ? 'Detay (opsyonèl)' : 'Detail (optional)'} />
          <button type="button" onClick={addRule} disabled={!newRule.title.trim()}
            style={{ border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <i className="fas fa-plus" aria-hidden="true" /> {isHt ? 'Ajoute' : 'Add'}
          </button>
        </div>
      </PropertyGroup>
    </>
  );

  const editorContent = (
    <div className={panelStyles.workspace} id="community-tabpanel" role="tabpanel" aria-labelledby={`community-tab-${activeTab}`}>
      {tabBar}
      {activeTab === 'overview' && (
        <CommunityFounderOverview community={item} slug={communityIdentifier} lang={lang} onOpenTab={setTab} />
      )}
      {activeTab === 'profile' && profileContent}
      {activeTab === 'members' && (
        <CommunityMembersPanel
          slug={communityIdentifier}
          lang={lang}
          showToast={showToast}
          isOwner={isOwner}
          canModerate={canModerate}
          currentUserId={user?.id}
        />
      )}
      {activeTab === 'posts' && (
        <CommunityPostsPanel
          slug={communityIdentifier}
          lang={lang}
          showToast={showToast}
          canModerate={canModerate}
        />
      )}
      {activeTab === 'events' && (
        <CommunityEventsPanel
          slug={communityIdentifier}
          communityId={item?.id}
          lang={lang}
          showToast={showToast}
          canModerate={canModerate}
        />
      )}
      {activeTab === 'resources' && (
        <CommunityFilesPanel
          slug={communityIdentifier}
          lang={lang}
          showToast={showToast}
          canModerate={canModerate}
        />
      )}
      {activeTab === 'announcements' && (
        <CommunityAnnouncementsPanel slug={communityIdentifier} lang={lang} showToast={showToast} />
      )}
      {activeTab === 'settings' && (
        <div className={panelStyles.panel} style={{ display: 'grid', gap: 16 }}>
          <PanelHeader
            icon="fa-sliders"
            title={isHt ? 'Paramèt kominote a' : 'Community settings'}
            subtitle={isHt
              ? 'Jere aksè, lyen envitasyon, règleman ak zòn danje nan yon sèl kote.'
              : 'Manage access, invite links, rules, and danger zone in one place.'}
          />
          {settingsGroups}
        </div>
      )}
    </div>
  );

  const propertiesContent = (
    <StudioPropertiesPanel>
      {settingsGroups}
    </StudioPropertiesPanel>
  );

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Kominote' : 'Community Editor'}
      icon="fa-users"
      badge={isEdit ? (
        <span className={panelStyles.badge}>
          <i className="fas fa-crown" aria-hidden="true" />
          {isHt ? 'Fondatè' : 'Founder'}
        </span>
      ) : null}
      lang={lang}
      docTitle={form.name || (isHt ? 'Kominote san tit' : 'Untitled community')}
      isNew={!isEdit}
      dirty={dirty}
      saveState={saveState}
      onBack={onClose}
      onSave={handleSave}
      onPublish={handlePublish}
      saveLabel={isHt ? 'Sove' : 'Save'}
      publishLabel={isHt ? 'Pibliye' : 'Publish'}
      canSave={true}
      validation={validationList}
      editor={editorContent}
      properties={propertiesContent}
    />
  );
}
