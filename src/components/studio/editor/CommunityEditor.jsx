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
import { ImageUrlField } from '../modals/shared';
import styles from './editor.module.css';

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
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  const editorContent = (
    <div className={styles.editorMain} style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
      {errors._api && <div className={styles.apiError} role="alert" style={{ marginBottom: 16 }}>{errors._api}</div>}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><i className="fas fa-users" /> {isHt ? 'Enfòmasyon Kominote' : 'Community Info'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <PropField label={isHt ? 'Non Kominote' : 'Community Name'} required error={errors.name}>
            <PropInput value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder={isHt ? 'Non kominote a' : 'Community name'} />
          </PropField>
          <PropField label={isHt ? 'Deskripsyon' : 'Description'}>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} className={styles.textarea} rows={4} placeholder={isHt ? 'Dekri kominote a...' : 'Describe the community...'} />
          </PropField>
          <PropField label={isHt ? 'Kategori' : 'Category'}>
            <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} className={styles.select}>
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
      <div className={styles.formSection} style={{ marginTop: 24 }}>
        <h3 className={styles.sectionTitle}><i className="fas fa-image" /> {isHt ? 'Imaj' : 'Images'}</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <ImageUrlField label={isHt ? 'URL Avatè' : 'Avatar URL'} value={form.avatar_url} onChange={(v) => handleChange('avatar_url', v)} lang={lang} />
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, 'avatar_url'); e.target.value = ''; }} />
            <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
              style={{ marginTop: 8, border: '1px dashed var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-images'}`} aria-hidden="true" style={{ marginRight: 6 }} />
              {uploadingAvatar ? (isHt ? 'Ap telechaje...' : 'Uploading...') : (isHt ? 'Chwazi nan galri' : 'Choose from gallery')}
            </button>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{isHt ? 'Kole yon URL oswa pran yon foto nan galri telefòn ou.' : 'Paste a URL or pick a photo from your gallery.'}</div>
          </div>
          <div>
            <ImageUrlField label={isHt ? 'URL Banner' : 'Banner URL'} value={form.banner_url} onChange={(v) => handleChange('banner_url', v)} lang={lang} />
            <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f, 'banner_url'); e.target.value = ''; }} />
            <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner}
              style={{ marginTop: 8, border: '1px dashed var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              <i className={`fas ${uploadingBanner ? 'fa-spinner fa-spin' : 'fa-images'}`} aria-hidden="true" style={{ marginRight: 6 }} />
              {uploadingBanner ? (isHt ? 'Ap telechaje...' : 'Uploading...') : (isHt ? 'Chwazi nan galri' : 'Choose from gallery')}
            </button>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{isHt ? 'Kole yon URL oswa pran yon foto nan galri telefòn ou.' : 'Paste a URL or pick a photo from your gallery.'}</div>
          </div>
        </div>
      </div>

    </div>
  );

  const propertiesContent = (
    <StudioPropertiesPanel>
      <PropertyGroup title={isHt ? 'Aksè' : 'Access'} defaultOpen>
        <PropField label={isHt ? 'Fason antre' : 'Join Mode'}>
          <select value={form.join_mode} onChange={(e) => handleChange('join_mode', e.target.value)} className={styles.select}>
            <option value="public">{isHt ? 'Piblik — nenpòt moun antre touswit' : 'Public — anyone joins instantly'}</option>
            <option value="approval">{isHt ? 'Apwobasyon — ou revize chak demann' : 'Approval — you review each request'}</option>
            <option value="invite">{isHt ? 'Fèmen — lyen envitasyon obligatwa' : 'Invite-only — invitation link required'}</option>
          </select>
        </PropField>
        {form.join_mode === 'approval' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {isHt ? 'Demann yo tann nan Studio → Kominote jiskaske ou apwouve oswa rejte yo.' : 'Requests wait in Studio → Communities until you approve or reject them.'}
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
    </StudioPropertiesPanel>
  );

  return (
    <StudioEditorShell
      title={isHt ? 'Editè Kominote' : 'Community Editor'}
      icon="fa-users"
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
