/**
 * src/components/communities/CreateCommunityModal.jsx
 *
 * Founding a community — Phase 24 endpoint (POST /api/communities/),
 * gated server-side to creators with published content (courses,
 * products, or music). The parent checks ``communitiesService.canCreate()``
 * before mounting this modal, so the form only ever renders for
 * eligible users; the 403 path is a defensive fallback that explains
 * the requirement.
 *
 * Data flow
 * ---------
 *   POST /api/communities/  → serializer stamps created_by from JWT,
 *                             model auto-generates the slug from name,
 *                             perform_create auto-joins founder as owner.
 *
 * Styles: src/styles/communities.css (``cm-`` prefix, token-based).
 */
/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere; t is a plain translations object (same as BusinessCreateModal) */
import React, { useState } from 'react';
import { communitiesService } from '../../services/api';

const CATEGORY_OPTIONS = [
  { value: 'tech', icon: 'fa-microchip', en: 'Technology', ht: 'Teknoloji' },
  { value: 'art', icon: 'fa-palette', en: 'Art & Design', ht: 'A & Design' },
  { value: 'music', icon: 'fa-music', en: 'Music', ht: 'Mizik' },
  { value: 'education', icon: 'fa-graduation-cap', en: 'Education', ht: 'Edikasyon' },
  { value: 'business', icon: 'fa-briefcase', en: 'Business', ht: 'Biznis' },
  { value: 'health', icon: 'fa-heart-pulse', en: 'Health & Wellness', ht: 'Sante' },
  { value: 'gaming', icon: 'fa-gamepad', en: 'Gaming', ht: 'Jwèt' },
  { value: 'sports', icon: 'fa-futbol', en: 'Sports', ht: 'Espò' },
  { value: 'food', icon: 'fa-utensils', en: 'Food & Cooking', ht: 'Manje & Kwi' },
  { value: 'travel', icon: 'fa-plane', en: 'Travel', ht: 'Vwayaj' },
  { value: 'charity', icon: 'fa-hand-holding-heart', en: 'Charity & Causes', ht: 'Charite' },
  { value: 'other', icon: 'fa-layer-group', en: 'Other', ht: 'Lòt' },
];

const JOIN_MODES = [
  {
    value: 'public',
    icon: 'fa-lock-open',
    label: { ht: 'Piblik', en: 'Public' },
    hint: { ht: 'Nenpòt moun ka antre touswit', en: 'Anyone can join instantly' },
  },
  {
    value: 'approval',
    icon: 'fa-user-clock',
    label: { ht: 'Apwobasyon', en: 'Approval' },
    hint: { ht: 'Ou revize chak demann', en: 'You review each request' },
  },
  {
    value: 'invite',
    icon: 'fa-envelope',
    label: { ht: 'Envite', en: 'Invite' },
    hint: { ht: 'Sèlman moun ou envite', en: 'Only people you invite' },
  },
];

export default function CreateCommunityModal({ lang = 'ht', t, showToast, onClose, onCreated }) {
  const isHt = lang === 'ht';
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'other',
    join_mode: 'public',
    avatar_url: '',
    banner_url: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast?.(t?.community_name_required || (isHt ? 'Non kominote a obligatwa.' : 'Community name is required.'), 'circle-exclamation');
      return;
    }
    setSaving(true);
    try {
      const res = await communitiesService.create({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        join_mode: form.join_mode,
        avatar_url: form.avatar_url.trim(),
        banner_url: form.banner_url.trim(),
      });
      const community = res?.data?.data ?? res?.data ?? null;
      showToast?.(t?.community_created || (isHt ? '✅ Kominote a kreye! Ou se fondatè li.' : '✅ Community created! You are its founder.'), 'check-circle');
      onCreated?.(community);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      let detail;
      if (status === 403 || code === 'no_creator_content') {
        detail = t?.community_create_gated || (isHt
          ? 'Sèlman kreyatè ki gen kontni pibliye ka fonde kominote.'
          : 'Only creators with published content can found a community.');
      } else {
        detail = err?.response?.data?.detail
          || err?.response?.data?.name?.[0]
          || (isHt ? 'Pa t kapab kreye kominote a.' : 'Could not create the community.');
      }
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  const activeMode = JOIN_MODES.find((m) => m.value === form.join_mode);

  return (
    <div className="cm-overlay" onClick={onClose} role="presentation">
      <div
        className="cm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t?.community_create || (isHt ? 'Fonde yon Kominote' : 'Found a Community')}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="cm-modal-header">
          <h3 className="cm-modal-title">
            <i className="fas fa-users" aria-hidden="true" />
            {t?.community_create || (isHt ? 'Fonde yon Kominote' : 'Found a Community')}
          </h3>
          <button type="button" className="cm-modal-close" onClick={onClose} aria-label={isHt ? 'Fèmen' : 'Close'}>
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <p className="cm-modal-hint">
          {t?.community_create_hint || (isHt
            ? 'Kominote ou a ap parèt nan Explore. Ou vin fondatè — ou ka ajoute règleman ak modere.'
            : 'Your community appears in Explore. You become its founder — you can add rules and moderate.')}
        </p>

        <form onSubmit={handleSubmit} className="cm-form" data-testid="community-create-form">
          <div className="cm-field">
            <label className="cm-label" htmlFor="cc-name">
              {t?.community_name || (isHt ? 'Non kominote a *' : 'Community name *')}
            </label>
            <input
              id="cc-name"
              className="cm-input"
              type="text"
              maxLength={120}
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={isHt ? 'Egzanp: Atis Yo Nouvo Jenerasyon' : 'e.g. New Generation Artists'}
            />
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="cc-desc">
              {t?.community_description || (isHt ? 'Deskripsyon' : 'Description')}
            </label>
            <textarea
              id="cc-desc"
              className="cm-input"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={isHt ? 'Kisa kominote a ye? Kilè moun ta dwe vin antre?' : 'What is this community about? Who should join?'}
            />
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="cc-category">
              {t?.community_category || (isHt ? 'Kategori' : 'Category')}
            </label>
            <select
              id="cc-category"
              className="cm-input"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isHt ? `${opt.ht} — ` : ''}{opt.en}
                </option>
              ))}
            </select>
          </div>

          <div className="cm-field" role="radiogroup" aria-label={t?.community_join_mode || (isHt ? 'Kijan moun antre?' : 'How do people join?')}>
            <span className="cm-label">
              {t?.community_join_mode || (isHt ? 'Kijan moun antre?' : 'How do people join?')}
            </span>
            <div className="cm-segmented">
              {JOIN_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={form.join_mode === mode.value}
                  className={`cm-segment${form.join_mode === mode.value ? ' cm-segment-active' : ''}`}
                  onClick={() => set('join_mode', mode.value)}
                >
                  <i className={`fas ${mode.icon}`} aria-hidden="true" />
                  {mode.label[isHt ? 'ht' : 'en']}
                </button>
              ))}
            </div>
            {activeMode && (
              <span className="cm-mode-hint">
                <i className={`fas ${activeMode.icon}`} aria-hidden="true" />
                {' '}{activeMode.hint[isHt ? 'ht' : 'en']}
              </span>
            )}
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="cc-avatar">
              {t?.community_avatar_url || (isHt ? 'Avatar (URL imaj)' : 'Avatar (image URL)')}
            </label>
            <input
              id="cc-avatar"
              className="cm-input"
              type="url"
              value={form.avatar_url}
              onChange={(e) => set('avatar_url', e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="cc-banner">
              {t?.community_banner_url || (isHt ? 'Banè (URL imaj)' : 'Banner (image URL)')}
            </label>
            <input
              id="cc-banner"
              className="cm-input"
              type="url"
              value={form.banner_url}
              onChange={(e) => set('banner_url', e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="cm-actions">
            <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose} disabled={saving}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button type="submit" className="cm-btn cm-btn-primary" disabled={saving}>
              {saving
                ? (isHt ? 'Ap kreye…' : 'Creating…')
                : (t?.community_create_cta || (isHt ? 'Fonde Kominote a' : 'Found Community'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
