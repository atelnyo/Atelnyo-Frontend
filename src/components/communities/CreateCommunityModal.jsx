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
 *                             perform_create auto-joins founder as owner,
 *                             and the nested ``rules`` list is persisted
 *                             in the same transaction.
 *
 * This form only sends fields the existing model/serializer already
 * supports. Avatars and banners are URL fields on ``Community`` — there
 * is no upload endpoint in this module — so the form validates and
 * previews a URL rather than inventing a second storage path.
 *
 * Styles: src/styles/communities.css (``cm-`` prefix, token-based).
 */
/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere; t is a plain translations object (same as BusinessCreateModal) */
import React, { useMemo, useRef, useState } from 'react';
import { communitiesService } from '../../services/api';
import { t as tr } from '../../utils/i18n';
import RuleTemplatePicker from '../community/RuleTemplatePicker';
import { mergeRuleLists } from '../community/ruleTemplates';

const MAX_RULES = 20;
const MAX_RULE_TITLE = 120;
const MAX_RULE_DESCRIPTION = 1000;
const MAX_DESCRIPTION = 5000;
const MAX_URL = 500;
const IMAGE_URL_RE = /^https?:\/\/[^\s]+$/i;

const CATEGORY_OPTIONS = [
  { value: 'tech', icon: 'fa-microchip', en: 'Technology', ht: 'Teknoloji', fr: 'Technologie' },
  { value: 'art', icon: 'fa-palette', en: 'Art & Design', ht: 'A & Design', fr: 'Art et design' },
  { value: 'music', icon: 'fa-music', en: 'Music', ht: 'Mizik', fr: 'Musique' },
  { value: 'education', icon: 'fa-graduation-cap', en: 'Education', ht: 'Edikasyon', fr: 'Éducation' },
  { value: 'business', icon: 'fa-briefcase', en: 'Business', ht: 'Biznis', fr: 'Affaires' },
  { value: 'health', icon: 'fa-heart-pulse', en: 'Health & Wellness', ht: 'Sante', fr: 'Santé et bien-être' },
  { value: 'gaming', icon: 'fa-gamepad', en: 'Gaming', ht: 'Jwèt', fr: 'Jeux' },
  { value: 'sports', icon: 'fa-futbol', en: 'Sports', ht: 'Espò', fr: 'Sports' },
  { value: 'food', icon: 'fa-utensils', en: 'Food & Cooking', ht: 'Manje & Kwi', fr: 'Cuisine' },
  { value: 'travel', icon: 'fa-plane', en: 'Travel', ht: 'Vwayaj', fr: 'Voyage' },
  { value: 'charity', icon: 'fa-hand-holding-heart', en: 'Charity & Causes', ht: 'Charite', fr: 'Charité et causes' },
  { value: 'other', icon: 'fa-layer-group', en: 'Other', ht: 'Lòt', fr: 'Autre' },
];

const JOIN_MODES = [
  {
    value: 'public',
    icon: 'fa-lock-open',
    label: { ht: 'Piblik', en: 'Public', fr: 'Public' },
    hint: { ht: 'Nenpòt moun ka antre touswit', en: 'Anyone can join instantly', fr: 'Tout le monde peut rejoindre immédiatement' },
  },
  {
    value: 'approval',
    icon: 'fa-user-clock',
    label: { ht: 'Apwobasyon', en: 'Approval', fr: 'Approbation' },
    hint: { ht: 'Ou revize chak demann', en: 'You review each request', fr: 'Vous examinez chaque demande' },
  },
  {
    value: 'invite',
    icon: 'fa-envelope',
    label: { ht: 'Envite', en: 'Invite', fr: 'Invitation' },
    hint: { ht: 'Sèlman moun ou envite', en: 'Only people you invite', fr: 'Uniquement les personnes invitées' },
  },
];

function categoryLabel(option, lang) {
  if (!option) return tr(lang, 'Lòt', 'Other', 'Autre');
  return tr(lang, option.ht, option.en, option.fr);
}

function imageUrlError(value, lang) {
  const url = (value || '').trim();
  if (!url) return '';
  if (url.length > MAX_URL) {
    return tr(
      lang,
      `Lyen an twò long (maksimòm ${MAX_URL} karaktè).`,
      `The link is too long (maximum ${MAX_URL} characters).`,
      `Le lien est trop long (${MAX_URL} caractères maximum).`,
    );
  }
  if (!IMAGE_URL_RE.test(url)) {
    return tr(
      lang,
      'Sèvi ak yon lyen imaj konplè ki kòmanse ak http oswa https.',
      'Use a full image link starting with http or https.',
      'Utilisez un lien d’image complet commençant par http ou https.',
    );
  }
  return '';
}

export default function CreateCommunityModal({ lang = 'en', t, showToast, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'other',
    join_mode: 'public',
    avatar_url: '',
    banner_url: '',
    rules: [],
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [bannerBroken, setBannerBroken] = useState(false);
  // Stable per-row id so reordering/deleting rules keeps React state and
  // the creator's cursor attached to the same rule.
  const ruleIdRef = useRef(1);
  const [showRuleTemplates, setShowRuleTemplates] = useState(false);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addRule = () => {
    if (form.rules.length >= MAX_RULES) return;
    const id = ruleIdRef.current;
    ruleIdRef.current += 1;
    setForm((prev) => ({
      ...prev,
      rules: [...prev.rules, { id, title: '', description: '' }],
    }));
  };

  const updateRule = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)),
    }));
    // Clear the per-rule error as soon as the creator edits that rule,
    // instead of leaving a stale message next to a corrected field.
    setErrors((prev) => {
      if (!prev.ruleItems?.[id]) return prev;
      const ruleItems = { ...prev.ruleItems };
      delete ruleItems[id];
      const next = { ...prev, ruleItems };
      if (Object.keys(ruleItems).length === 0) delete next.ruleItems;
      return next;
    });
  };

  const removeRule = (rule, index) => {
    const hasContent = Boolean(rule.title.trim() || rule.description.trim());
    if (hasContent && !window.confirm(tr(
      lang,
      `Retire règ ${index + 1}? Kontni w te ekri a ap pèdi.`,
      `Remove rule ${index + 1}? What you typed will be lost.`,
      `Supprimer la règle ${index + 1} ? Ce que vous avez saisi sera perdu.`,
    ))) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.filter((row) => row.id !== rule.id),
    }));
  };

  const moveRule = (index, delta) => setForm((prev) => {
    const next = [...prev.rules];
    const target = index + delta;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...prev, rules: next };
  });

  // Template rules are appended, never substituted: the creator's own
  // rules keep their text and position, and duplicate titles are skipped.
  const addTemplateRules = (incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    const merged = mergeRuleLists(form.rules, incoming).slice(0, MAX_RULES);
    const addedCount = merged.length - form.rules.length;
    setForm((prev) => ({
      ...prev,
      rules: merged.map((rule) => (rule.id ? rule : { ...rule, id: ruleIdRef.current++ })),
    }));
    if (addedCount > 0) {
      showToast?.(tr(
        lang,
        `${addedCount} règ ajoute. Ou ka chanje yo anba a.`,
        `${addedCount} rule${addedCount === 1 ? '' : 's'} added. You can edit them below.`,
        `${addedCount} règle${addedCount === 1 ? '' : 's'} ajoutée${addedCount === 1 ? '' : 's'}. Vous pouvez les modifier ci-dessous.`,
      ), 'wand-magic-sparkles');
    }
  };

  // Empty rows the creator never typed into are simply ignored; a row with
  // a description but no title is a real validation error.
  const rulesForSubmit = useMemo(() => form.rules
    .map((rule) => ({
      id: rule.id,
      title: rule.title.trim(),
      description: rule.description.trim(),
    }))
    .filter((rule) => rule.title || rule.description), [form.rules]);

  const validate = () => {
    const next = {};
    const name = form.name.trim();
    if (!name) {
      next.name = tr(lang, 'Non kominote a obligatwa.', 'Community name is required.', 'Le nom de la communauté est obligatoire.');
    } else if (name.length > 120) {
      next.name = tr(lang, 'Non an pa ka depase 120 karaktè.', 'The name cannot exceed 120 characters.', 'Le nom ne peut pas dépasser 120 caractères.');
    }
    if (form.description.length > MAX_DESCRIPTION) {
      next.description = tr(
        lang,
        `Deskripsyon an pa ka depase ${MAX_DESCRIPTION} karaktè.`,
        `The description cannot exceed ${MAX_DESCRIPTION} characters.`,
        `La description ne peut pas dépasser ${MAX_DESCRIPTION} caractères.`,
      );
    }
    const avatarError = imageUrlError(form.avatar_url, lang);
    if (avatarError) next.avatar_url = avatarError;
    const bannerError = imageUrlError(form.banner_url, lang);
    if (bannerError) next.banner_url = bannerError;

    const ruleErrors = {};
    rulesForSubmit.forEach((rule, index) => {
      const messages = [];
      if (!rule.title) {
        messages.push(tr(
          lang,
          `Règ ${index + 1} bezwen yon tit.`,
          `Rule ${index + 1} needs a title.`,
          `La règle ${index + 1} doit avoir un titre.`,
        ));
      } else if (rule.title.length > MAX_RULE_TITLE) {
        messages.push(tr(
          lang,
          `Tit règ ${index + 1} twò long (maks ${MAX_RULE_TITLE}).`,
          `Rule ${index + 1} title is too long (max ${MAX_RULE_TITLE}).`,
          `Le titre de la règle ${index + 1} est trop long (max ${MAX_RULE_TITLE}).`,
        ));
      }
      if (rule.description.length > MAX_RULE_DESCRIPTION) {
        messages.push(tr(
          lang,
          `Deskripsyon règ ${index + 1} twò long (maks ${MAX_RULE_DESCRIPTION}).`,
          `Rule ${index + 1} description is too long (max ${MAX_RULE_DESCRIPTION}).`,
          `La description de la règle ${index + 1} est trop longue (max ${MAX_RULE_DESCRIPTION}).`,
        ));
      }
      if (messages.length) ruleErrors[rule.id] = messages;
    });
    if (Object.keys(ruleErrors).length) next.ruleItems = ruleErrors;
    if (rulesForSubmit.length > MAX_RULES) {
      next.rules = tr(
        lang,
        `Ou ka gen ${MAX_RULES} règ maksimòm.`,
        `You can have at most ${MAX_RULES} rules.`,
        `Vous pouvez avoir ${MAX_RULES} règles au maximum.`,
      );
    }
    return next;
  };

  const errorList = useMemo(() => {
    const list = [];
    if (errors.name) list.push(errors.name);
    if (errors.description) list.push(errors.description);
    if (errors.avatar_url) list.push(errors.avatar_url);
    if (errors.banner_url) list.push(errors.banner_url);
    if (errors.rules) list.push(errors.rules);
    if (errors.ruleItems) list.push(...Object.values(errors.ruleItems).flat());
    return list;
  }, [errors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Guard against double-click / double-Enter while the POST is in
    // flight — the button is disabled too, but the form submit path can
    // still fire from the keyboard.
    if (saving) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      // Read the message from the freshly computed errors, not from the
      // previous render's errorList (which is still empty on first submit).
      const firstError = nextErrors.name
        || nextErrors.description
        || nextErrors.avatar_url
        || nextErrors.banner_url
        || nextErrors.rules
        || Object.values(nextErrors.ruleItems || {}).flat()[0]
        || tr(
          lang,
          'Verifye fòm nan epi eseye ankò.',
          'Check the form and try again.',
          'Vérifiez le formulaire et réessayez.',
        );
      showToast?.(firstError, 'circle-exclamation');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await communitiesService.create({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        join_mode: form.join_mode,
        avatar_url: form.avatar_url.trim(),
        banner_url: form.banner_url.trim(),
        rules: rulesForSubmit.map(({ title, description }) => ({ title, description })),
      });
      const community = res?.data?.data ?? res?.data ?? null;
      showToast?.(t?.community_created || tr(
        lang,
        '✅ Kominote a kreye! Ou se fondatè li.',
        '✅ Community created! You are its founder.',
        '✅ Communauté créée ! Vous en êtes le fondateur.',
      ), 'check-circle');
      onCreated?.(community);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      let detail;
      if (status === 403 || code === 'no_creator_content') {
        detail = t?.community_create_gated || tr(
          lang,
          'Sèlman kreyatè ki gen kontni pibliye ka fonde kominote.',
          'Only creators with published content can found a community.',
          'Seuls les créateurs avec du contenu publié peuvent fonder une communauté.',
        );
      } else {
        const data = err?.response?.data;
        detail = data?.detail
          || data?.name?.[0]
          || (Array.isArray(data?.rules) ? data?.rules?.[0]?.title?.[0] : null)
          || tr(lang, 'Pa t kapab kreye kominote a.', 'Could not create the community.', 'Impossible de créer la communauté.');
      }
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  const activeMode = JOIN_MODES.find((m) => m.value === form.join_mode);
  const category = CATEGORY_OPTIONS.find((opt) => opt.value === form.category);
  const previewRules = rulesForSubmit.filter((rule) => rule.title).slice(0, 3);
  const previewBanner = form.banner_url.trim();
  const previewAvatar = form.avatar_url.trim();

  return (
    <div className="cm-overlay" onClick={onClose} role="presentation">
      <div
        className="cm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t?.community_create || tr(lang, 'Fonde yon Kominote', 'Found a Community', 'Fonder une communauté')}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="cm-modal-header">
          <h3 className="cm-modal-title">
            <i className="fas fa-users" aria-hidden="true" />
            {t?.community_create || tr(lang, 'Fonde yon Kominote', 'Found a Community', 'Fonder une communauté')}
          </h3>
          <button
            type="button"
            className="cm-modal-close"
            onClick={onClose}
            aria-label={tr(lang, 'Fèmen', 'Close', 'Fermer')}
          >
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <p className="cm-modal-hint">
          {t?.community_create_hint || tr(
            lang,
            'Kominote ou a ap parèt nan Explore. Ou vin fondatè — ou ka ajoute règleman ak modere.',
            'Your community appears in Explore. You become its founder — you can add rules and moderate.',
            'Votre communauté apparaît dans Explorer. Vous en devenez le fondateur — vous pouvez ajouter des règles et modérer.',
          )}
        </p>

        <form onSubmit={handleSubmit} className="cm-form" data-testid="community-create-form" noValidate>
          {errorList.length > 0 && (
            <div className="cm-error-summary" role="alert">
              <i className="fas fa-circle-exclamation" aria-hidden="true" />
              <div>
                <strong>{tr(lang, 'Verifye sa ki pi ba a', 'Check the highlighted fields', 'Vérifiez les champs signalés')}</strong>
                <ul>
                  {errorList.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── A. Identity ─────────────────────────────────────────── */}
          <section className="cm-create-section" aria-labelledby="cc-identity-title">
            <div className="cm-create-section-head">
              <h4 id="cc-identity-title">{tr(lang, 'Idantite kominote a', 'Community identity', 'Identité de la communauté')}</h4>
              <p>{tr(
                lang,
                'Non, deskripsyon ak imaj ki pral reprezante kominote w nan Explore ak sou paj li.',
                'The name, description and images that represent your community in Explore and on its page.',
                'Le nom, la description et les images qui représentent votre communauté dans Explorer et sur sa page.',
              )}</p>
            </div>

            <div className="cm-field">
              <label className="cm-label" htmlFor="cc-name">
                {t?.community_name || tr(lang, 'Non kominote a *', 'Community name *', 'Nom de la communauté *')}
              </label>
              <input
                id="cc-name"
                className={`cm-input${errors.name ? ' cm-input--invalid' : ''}`}
                type="text"
                maxLength={120}
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'cc-name-error' : undefined}
                placeholder={tr(lang, 'Egzanp: Atis Yo Nouvo Jenerasyon', 'e.g. New Generation Artists', 'Ex. : Artistes de la nouvelle génération')}
              />
              {errors.name
                ? <span className="cm-field-error" id="cc-name-error">{errors.name}</span>
                : <span className="cm-field-hint">{tr(lang, 'Chwazi yon non klè — li parèt nan rechèch ak envitasyon.', 'Choose a clear name — it appears in search and invitations.', 'Choisissez un nom clair — il apparaît dans la recherche et les invitations.')}</span>}
            </div>

            <div className="cm-field">
              <label className="cm-label" htmlFor="cc-desc">
                {t?.community_description || tr(lang, 'Deskripsyon', 'Description', 'Description')}
              </label>
              <textarea
                id="cc-desc"
                className={`cm-input${errors.description ? ' cm-input--invalid' : ''}`}
                rows={3}
                maxLength={MAX_DESCRIPTION}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                aria-invalid={Boolean(errors.description)}
                placeholder={tr(
                  lang,
                  'Kisa kominote a ye? Kilè moun ta dwe vin antre?',
                  'What is this community about? Who should join?',
                  'De quoi parle cette communauté ? Qui devrait la rejoindre ?',
                )}
              />
              {errors.description
                ? <span className="cm-field-error">{errors.description}</span>
                : <span className="cm-field-hint">{tr(
                  lang,
                  'Yon paragraf kout ede moun deside si kominote a pou yo.',
                  'A short paragraph helps people decide if this community is for them.',
                  'Un court paragraphe aide les gens à décider si cette communauté leur convient.',
                )}</span>}
            </div>

            <div className="cm-field">
              <label className="cm-label" htmlFor="cc-category">
                {t?.community_category || tr(lang, 'Kategori', 'Category', 'Catégorie')}
              </label>
              <select
                id="cc-category"
                className="cm-input"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{categoryLabel(opt, lang)}</option>
                ))}
              </select>
            </div>

            <div className="cm-field">
              <label className="cm-label" htmlFor="cc-avatar">
                {t?.community_avatar_url || tr(lang, 'Avatar (lyen imaj)', 'Avatar (image URL)', 'Avatar (URL de l’image)')}
              </label>
              <input
                id="cc-avatar"
                className={`cm-input${errors.avatar_url ? ' cm-input--invalid' : ''}`}
                type="url"
                inputMode="url"
                maxLength={MAX_URL}
                value={form.avatar_url}
                onChange={(e) => { setAvatarBroken(false); set('avatar_url', e.target.value); }}
                aria-invalid={Boolean(errors.avatar_url)}
                aria-describedby={errors.avatar_url ? 'cc-avatar-error' : 'cc-avatar-hint'}
                placeholder="https://…"
              />
              {errors.avatar_url
                ? <span className="cm-field-error" id="cc-avatar-error">{errors.avatar_url}</span>
                : <span className="cm-field-hint" id="cc-avatar-hint">{tr(lang, 'Opsyonèl. Yon kare oswa won parèt pi byen.', 'Optional. A square or round image looks best.', 'Facultatif. Une image carrée ou ronde rend mieux.')}</span>}
            </div>

            <div className="cm-field">
              <label className="cm-label" htmlFor="cc-banner">
                {t?.community_banner_url || tr(lang, 'Kouvèti (lyen imaj)', 'Cover image (URL)', 'Image de couverture (URL)')}
              </label>
              <input
                id="cc-banner"
                className={`cm-input${errors.banner_url ? ' cm-input--invalid' : ''}`}
                type="url"
                inputMode="url"
                maxLength={MAX_URL}
                value={form.banner_url}
                onChange={(e) => { setBannerBroken(false); set('banner_url', e.target.value); }}
                aria-invalid={Boolean(errors.banner_url)}
                aria-describedby={errors.banner_url ? 'cc-banner-error' : 'cc-banner-hint'}
                placeholder="https://…"
              />
              {errors.banner_url
                ? <span className="cm-field-error" id="cc-banner-error">{errors.banner_url}</span>
                : <span className="cm-field-hint" id="cc-banner-hint">{tr(lang, 'Opsyonèl. Yon imaj laj (16:9) reprezante kominote a.', 'Optional. A wide (16:9) image represents the community.', 'Facultatif. Une image large (16:9) représente la communauté.')}</span>}
            </div>
          </section>

          {/* ── B. Access ───────────────────────────────────────────── */}
          <section className="cm-create-section" aria-labelledby="cc-access-title">
            <div className="cm-create-section-head">
              <h4 id="cc-access-title">{tr(lang, 'Aksè ak antre', 'Access and joining', 'Accès et adhésion')}</h4>
              <p>{tr(
                lang,
                'Chwazi kijan moun dekouvri kominote a epi kijan yo vin manm. Vizibilite ak dwa pou pibliye se de bagay separe.',
                'Choose how people discover the community and how they become members. Visibility and posting rights are separate.',
                'Choisissez comment les gens découvrent la communauté et comment ils en deviennent membres. La visibilité et le droit de publier sont distincts.',
              )}</p>
            </div>

            <div
              className="cm-field"
              role="radiogroup"
              aria-label={t?.community_join_mode || tr(lang, 'Kijan moun antre?', 'How do people join?', 'Comment rejoint-on ?')}
            >
              <span className="cm-label">{t?.community_join_mode || tr(lang, 'Kijan moun antre?', 'How do people join?', 'Comment rejoint-on ?')}</span>
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
                    {tr(lang, mode.label.ht, mode.label.en, mode.label.fr)}
                  </button>
                ))}
              </div>
              {activeMode && (
                <span className="cm-mode-hint">
                  <i className={`fas ${activeMode.icon}`} aria-hidden="true" />
                  {' '}{tr(lang, activeMode.hint.ht, activeMode.hint.en, activeMode.hint.fr)}
                </span>
              )}
            </div>

            <p className="cm-access-note">
              <i className="fas fa-circle-info" aria-hidden="true" />
              {' '}{tr(
                lang,
                'Piblik vle di nenpòt moun ka jwenn li epi mande antre. Li pa vle di tout moun ka pibliye — dwa manm yo toujou kontwole.',
                'Public means anyone can discover the community and ask to join. It does not mean everyone can post — member rights are still controlled.',
                'Public signifie que tout le monde peut découvrir la communauté et demander à rejoindre. Cela ne veut pas dire que tout le monde peut publier — les droits des membres restent contrôlés.',
              )}
            </p>
          </section>

          {/* ── C. Rules ────────────────────────────────────────────── */}
          <section className="cm-create-section" aria-labelledby="cc-rules-title">
            <div className="cm-create-section-head">
              <h4 id="cc-rules-title">
                {t?.community_rules || tr(lang, 'Règleman kominote a', 'Community rules', 'Règles de la communauté')}
                <span className="cm-rule-counter">{rulesForSubmit.length}/{MAX_RULES}</span>
              </h4>
              <p>{tr(
                lang,
                'Règ yo ede manm yo konnen sa ki aksepte. Ou ka ajoute, ranje, epi deplase yo nenpòt lè.',
                'Rules help members know what is expected. You can add, edit, and reorder them anytime.',
                'Les règles aident les membres à savoir ce qui est attendu. Vous pouvez les ajouter, les modifier et les réordonner à tout moment.',
              )}</p>
            </div>

            {errors.rules && <span className="cm-field-error">{errors.rules}</span>}

            <button
              type="button"
              className="cm-template-toggle"
              aria-expanded={showRuleTemplates}
              onClick={() => setShowRuleTemplates((value) => !value)}
              disabled={form.rules.length >= MAX_RULES}
            >
              <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
              {tr(lang, 'Ajoute soti nan modèl', 'Add from templates', 'Ajouter depuis des modèles')}
            </button>

            {showRuleTemplates && (
              <RuleTemplatePicker
                lang={lang}
                existingRules={form.rules}
                onAdd={addTemplateRules}
                onClose={() => setShowRuleTemplates(false)}
                testId="community-create-rule-templates"
              />
            )}

            {form.rules.map((rule, index) => {
              const ruleErrors = errors.ruleItems?.[rule.id];
              return (
                <div className={`cm-rule-row${ruleErrors ? ' cm-rule-row--invalid' : ''}`} key={rule.id}>
                  <div className="cm-rule-head">
                    <span className="cm-rule-number">
                      {tr(lang, `Règ ${index + 1}`, `Rule ${index + 1}`, `Règle ${index + 1}`)}
                    </span>
                    <div className="cm-rule-actions">
                      <button
                        type="button"
                        className="cm-icon-action"
                        onClick={() => moveRule(index, -1)}
                        disabled={index === 0}
                        aria-label={tr(lang, 'Monte règ la', 'Move rule up', 'Monter la règle')}
                      >
                        <i className="fas fa-chevron-up" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cm-icon-action"
                        onClick={() => moveRule(index, 1)}
                        disabled={index === form.rules.length - 1}
                        aria-label={tr(lang, 'Desann règ la', 'Move rule down', 'Descendre la règle')}
                      >
                        <i className="fas fa-chevron-down" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cm-icon-action cm-icon-action--danger"
                        onClick={() => removeRule(rule, index)}
                        aria-label={tr(lang, 'Retire règ la', 'Remove rule', 'Supprimer la règle')}
                      >
                        <i className="fas fa-trash-can" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <input
                    className={`cm-input${ruleErrors ? ' cm-input--invalid' : ''}`}
                    type="text"
                    maxLength={MAX_RULE_TITLE}
                    value={rule.title}
                    onChange={(e) => updateRule(rule.id, 'title', e.target.value)}
                    placeholder={tr(lang, 'Tit règ la (obligatwa)', 'Rule title (required)', 'Titre de la règle (obligatoire)')}
                    aria-label={tr(lang, `Tit règ ${index + 1}`, `Rule ${index + 1} title`, `Titre de la règle ${index + 1}`)}
                    aria-invalid={Boolean(ruleErrors)}
                  />
                  <textarea
                    className="cm-input"
                    rows={2}
                    maxLength={MAX_RULE_DESCRIPTION}
                    value={rule.description}
                    onChange={(e) => updateRule(rule.id, 'description', e.target.value)}
                    placeholder={tr(lang, 'Eksplikasyon règ la (opsyonèl)', 'Explain the rule (optional)', 'Expliquez la règle (facultatif)')}
                    aria-label={tr(lang, `Eksplikasyon règ ${index + 1}`, `Rule ${index + 1} description`, `Description de la règle ${index + 1}`)}
                  />
                  {ruleErrors ? (
                    <span className="cm-field-error">{ruleErrors.join(' ')}</span>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              className="cm-add-rule"
              onClick={addRule}
              disabled={form.rules.length >= MAX_RULES}
            >
              <i className="fas fa-plus" aria-hidden="true" />
              {tr(lang, 'Ajoute yon lòt règ', 'Add another rule', 'Ajouter une autre règle')}
            </button>
          </section>

          {/* ── D. Preview ──────────────────────────────────────────── */}
          <section className="cm-create-preview" aria-label={tr(lang, 'Apèsi kominote a', 'Community preview', 'Aperçu de la communauté')}>
            <div className="cm-preview-banner">
              {previewBanner && !bannerBroken && (
                <img
                  className="cm-preview-banner-img"
                  src={previewBanner}
                  alt=""
                  onError={() => setBannerBroken(true)}
                />
              )}
              <span className="cm-preview-avatar">
                {previewAvatar && !avatarBroken ? (
                  <img
                    className="cm-preview-avatar-img"
                    src={previewAvatar}
                    alt=""
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <i className="fas fa-users" aria-hidden="true" />
                )}
              </span>
            </div>
            <div className="cm-preview-body">
              <strong className="cm-preview-name">
                {form.name.trim() || tr(lang, 'Non kominote ou', 'Your community name', 'Le nom de votre communauté')}
              </strong>
              <div className="cm-preview-meta">
                {categoryLabel(category, lang)}
                {activeMode ? ` · ${tr(lang, activeMode.label.ht, activeMode.label.en, activeMode.label.fr)}` : ''}
              </div>
              <p className="cm-preview-desc">
                {form.description.trim() || tr(
                  lang,
                  'Deskripsyon w ap parèt isit la.',
                  'Your description will appear here.',
                  'Votre description apparaîtra ici.',
                )}
              </p>
              {previewRules.length > 0 && (
                <ol className="cm-preview-rules">
                  {previewRules.map((rule) => (
                    <li key={rule.id}>
                      <strong>{rule.title}</strong>
                      {rule.description ? <div>{rule.description}</div> : null}
                    </li>
                  ))}
                </ol>
              )}
              {rulesForSubmit.length > previewRules.length && (
                <div className="cm-preview-more">
                  {tr(
                    lang,
                    `+${rulesForSubmit.length - previewRules.length} lòt règ`,
                    `+${rulesForSubmit.length - previewRules.length} more rules`,
                    `+${rulesForSubmit.length - previewRules.length} autres règles`,
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="cm-actions">
            <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose} disabled={saving}>
              {tr(lang, 'Anile', 'Cancel', 'Annuler')}
            </button>
            <button type="submit" className="cm-btn cm-btn-primary" disabled={saving} aria-busy={saving}>
              {saving
                ? tr(lang, 'Ap kreye…', 'Creating…', 'Création…')
                : (t?.community_create_cta || tr(lang, 'Fonde Kominote a', 'Found Community', 'Fonder la communauté'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
