/**
 * src/components/studio/sections/ProfileSettingsSection.jsx
 *
 * Profile Settings — Section Order, Visibility Toggles & Featured Content.
 *
 * Controls how the creator's public profile renders:
 *   1. Section Order — reorder sections on the public profile
 *   2. Visibility Toggles — show/hide individual sections
 *   3. Featured Content — pin courses, products, portfolio items
 *
 * All settings save to CreatorPublicProfile.section_config (JSONField)
 * and the existing featured_*_id fields.
 *
 * Etap 8 — 2026-07-24
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { creatorProfileService, creatorProfileHealthService, courseService, marketplaceService, portfolioService } from '../../../services/api';
import { StudioSkeleton, SectionHeader, classNames } from '../shared';
import DraftRecoveryBanner from '../shared/DraftRecoveryBanner';
import { removeFormDraft, restoreFormDraft, saveFormDraft } from '../../../services/appStateStore';
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
import { inlineText } from '../../../utils/inlineI18n';

// ─── Available sections ──────────────────────────────────────────────
const ALL_SECTIONS = [
  { id: 'dashboard', icon: 'fa-th-large',  label: 'Dashboard', labelHt: 'Tablo' },
  { id: 'picks',     icon: 'fa-bookmark',  label: 'Picks',     labelHt: 'Picks' },
  { id: 'courses',   icon: 'fa-graduation-cap', label: 'Courses',  labelHt: 'Kou' },
  { id: 'products',  icon: 'fa-cube',      label: 'Products',  labelHt: 'Pwodwi' },
  { id: 'portfolio', icon: 'fa-briefcase', label: 'Portfolio', labelHt: 'Pòtfolyo' },
  { id: 'reviews',   icon: 'fa-star',      label: 'Reviews',   labelHt: 'Revi' },
  { id: 'about',     icon: 'fa-user',      label: 'About',     labelHt: 'Sou nou' },
];

const DEFAULT_SECTION_CONFIG = {
  section_order: ALL_SECTIONS.map(s => s.id),
  section_visibility: Object.fromEntries(
    ALL_SECTIONS.map(s => [s.id, true]),
  ),
};

// Canonical monthly price string ("" = subscriptions off). Used both for the
// payload and for the dirty check, so typing "5" then "5.00" is NOT dirty.
function normalizeSubscriptionPrice(value) {
  const parsed = Number.parseFloat(value);
  if (!String(value || '').trim() || Number.isNaN(parsed) || parsed <= 0) {
    return '';
  }
  return String(Math.round(parsed * 100) / 100);
}

export default function ProfileSettingsSection({ lang, showToast, user }) {
  const isHt = lang === 'ht';
  const identity = getUserIdentity(user);
  const draftKey = identity.creatorLookupKey
    ? `creator-profile-settings:${identity.creatorLookupKey}`
    : null;

  // ─── State ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_CONFIG.section_order);
  const [sectionVisibility, setSectionVisibility] = useState(DEFAULT_SECTION_CONFIG.section_visibility);
  const [savedConfig, setSavedConfig] = useState(null);

  // Featured content state
  const [featuredPins, setFeaturedPins] = useState({});
  const [courses, setCourses] = useState([]);
  const [products, setProducts] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Phase 60 — paid subscriptions: monthly price (USD). '' = disabled.
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [savedSubscriptionPrice, setSavedSubscriptionPrice] = useState('');

  // Crash/refresh recovery for layout + price changes.
  const [profileId, setProfileId] = useState(null);
  const [recoverDraft, setRecoverDraft] = useState(null);
  const [draftCheckDone, setDraftCheckDone] = useState(false);
  const draftCheckedFor = useRef(undefined);
  const draftSaveWarned = useRef(false);

  // ─── Fetch data ───────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current profile + health
      const [profileRes, healthRes] = await Promise.allSettled([
        identity.creatorLookupKey ? creatorProfileService.get(identity.creatorLookupKey) : Promise.reject(),
        creatorProfileHealthService.get(),
      ]);

      const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      const health = healthRes.status === 'fulfilled' ? healthRes.value.data : null;
      setProfileId(profile?.id || null);

      // Load section config — merged so sections added after the creator
      // first saved (e.g. tiktok) still appear; the merged baseline is what
      // hasChanges compares against, so no phantom "unsaved changes".
      const merged = mergeSectionConfig(profile?.section_config || null);
      setSectionOrder(merged.section_order);
      setSectionVisibility(merged.section_visibility);
      setSavedConfig(merged);

      // Load featured pins
      const pins = health?.featured_pins || {};
      setFeaturedPins(pins);

      // Phase 60 — subscription price ('' when disabled)
      const price = profile?.subscription_price;
      const priceText = price && Number(price) > 0 ? String(price) : '';
      setSubscriptionPrice(priceText);
      setSavedSubscriptionPrice(normalizeSubscriptionPrice(priceText));

      // Fetch available content for featured pickers
      const [coursesRes, productsRes, portsRes] = await Promise.allSettled([
        courseService.getAll(),
        marketplaceService.list({ limit: 20 }),
        portfolioService.list({ limit: 20 }),
      ]);
      setCourses(Array.isArray(coursesRes.value?.data) ? coursesRes.value.data : []);
      setProducts(Array.isArray(productsRes.value?.data?.results || productsRes.value?.data) 
        ? (productsRes.value?.data?.results || productsRes.value?.data) : []);
      setPortfolios(Array.isArray(portsRes.value?.data?.results || portsRes.value?.data)
        ? (portsRes.value?.data?.results || portsRes.value?.data) : []);
    } catch {
      showToast?.(isHt ? 'Erè nan chaje paramèt' : inlineText(lang, 'Error loading settings'), 'exclamation-triangle');
    } finally {
      setLoading(false);
    }
  }, [identity.creatorLookupKey, isHt, showToast]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {fetchData();}
    });
    return () => { cancelled = true; };
  }, [fetchData]);

  // Restore a local draft once the saved baseline is known. The prompt stays
  // until the creator chooses; autosave is paused until this check finishes.
  useEffect(() => {
    const draftScope = profileId ?? 'default';
    if (!draftKey || !savedConfig || draftCheckedFor.current === draftScope) {
      return undefined;
    }
    draftCheckedFor.current = draftScope;
    let cancelled = false;
    restoreFormDraft(draftKey)
      .then((draft) => {
        if (cancelled || !draft) { return; }
        if (draft.profileId && profileId && draft.profileId !== profileId) {
          removeFormDraft(draftKey).catch(() => {});
          return;
        }
        const config = mergeSectionConfig({
          section_order: Array.isArray(draft.sectionOrder) ? draft.sectionOrder : undefined,
          section_visibility: draft.sectionVisibility && typeof draft.sectionVisibility === 'object'
            ? draft.sectionVisibility
            : {},
        });
        const price = normalizeSubscriptionPrice(draft.subscriptionPrice);
        const sameLayout = JSON.stringify(config) === JSON.stringify(savedConfig);
        const samePrice = price === savedSubscriptionPrice;
        if (sameLayout && samePrice) {
          removeFormDraft(draftKey).catch(() => {});
          return;
        }
        setRecoverDraft({ ...draft, config, price });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { setDraftCheckDone(true); } });
    return () => { cancelled = true; };
  }, [draftKey, profileId, savedConfig, savedSubscriptionPrice]);

  // ─── Section order: move up/down (keyboard / touch fallback) ─────
  const moveSection = useCallback((index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= sectionOrder.length) { return; }
    const section = ALL_SECTIONS.find((item) => item.id === sectionOrder[index]);
    setSectionOrder(prev => {
      const arr = [...prev];
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
    if (section) {
      setReorderAnnouncement(isHt
        ? `${section.labelHt} deplase nan pozisyon ${target + 1} sou ${sectionOrder.length}.`
        : `${section.label} moved to position ${target + 1} of ${sectionOrder.length}.`);
    }
  }, [sectionOrder, isHt]);

  // ─── Drag & drop reorder (pointer events — works with mouse AND touch) ─
  // Native HTML5 drag-and-drop does not fire on touch devices, and the
  // studio is mobile-first, so we use pointer events with live reordering:
  // the dragged row follows the pointer and swaps with whatever row it is
  // over. The up/down buttons stay as the keyboard/assistive fallback.
  const [dragIndex, setDragIndex] = useState(null);
  // Synchronous mirror of sectionOrder — pointermove events can fire faster
  // than React re-renders, so reorders are computed from this ref (and the
  // DOM data-rows re-stamped immediately) instead of possibly-stale indices.
  const orderRef = useRef(sectionOrder);
  useEffect(() => { orderRef.current = sectionOrder; }, [sectionOrder]);
  // Container + active cleanup handle so the DOM re-stamp stays scoped to
  // this list and listeners are removed if the section unmounts mid-drag.
  const listRef = useRef(null);
  const endDragRef = useRef(null);
  useEffect(() => () => {
    if (endDragRef.current) {endDragRef.current(); endDragRef.current = null;}
  }, []);

  const beginDrag = useCallback((e, index) => {
    if (e.button != null && e.button !== 0) {return;}
    e.preventDefault(); // avoid text selection / touch scroll during drag
    setDragIndex(index);

    // The dragged row's CURRENT position; reorders shift positions, so the
    // NEXT pointermove must compare against the row's NEW position.
    let currentIndex = index;

    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest?.('[data-section-row]');
      const target = row ? Number(row.dataset.sectionRow) : null;
      if (target == null || target === currentIndex) {return;}

      // Compute the new order synchronously from the ref (the source of
      // truth during a drag) so rapid pointermoves never race a pending
      // React render or read stale DOM indices.
      const arr = [...orderRef.current];
      const [moved] = arr.splice(currentIndex, 1);
      // Dropping BEFORE the target row; when moving down the removal
      // shifts positions by one, so subtract one from the insert point.
      const insertAt = target > currentIndex ? target - 1 : target;
      arr.splice(insertAt, 0, moved);
      orderRef.current = arr;
      currentIndex = insertAt;

      setSectionOrder(arr);
      setDragIndex(currentIndex);

      // Re-stamp the DOM data-row indices immediately so the NEXT
      // pointermove (possibly within the same frame) reads fresh values.
      // Scoped to this list's container so other [data-section-id] uses
      // elsewhere in the app can never be touched.
      listRef.current?.querySelectorAll('[data-section-id]').forEach((item) => {
        item.dataset.sectionRow = String(arr.indexOf(item.dataset.sectionId));
      });
    };

    const endDrag = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('blur', endDrag);
      endDragRef.current = null;
      setDragIndex(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    // Clean up on gesture interrupt (touch scroll steal, browser back,
    // window losing focus) so the drag state never gets stuck.
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
    endDragRef.current = endDrag;
  }, []);

  // ─── Section visibility toggle ─────────────────────────────────
  const toggleVisibility = useCallback((sectionId) => {
    setSectionVisibility(prev => ({
      ...prev,
      [sectionId]: !(prev[sectionId] !== false),
    }));
  }, []);

  // ─── Featured content pin ──────────────────────────────────────
  const handlePin = async (field, value) => {
    setPinSubmitting(true);
    try {
      const payload = {};
      payload[field] = value || null;
      await creatorProfileHealthService.pin(payload);
      setFeaturedPins(prev => ({ ...prev, [field]: value || null }));
      showToast?.(isHt ? 'Ansekle aktyalize!' : inlineText(lang, 'Pin updated!'), 'check-circle');
    } catch {
      showToast?.(isHt ? 'Erè' : inlineText(lang, 'Error'), 'exclamation-triangle');
    } finally {
      setPinSubmitting(false);
    }
  };

  // ─── Save all settings ─────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) { return; }
    if (recoverDraft) {
      showToast?.(
        isHt
          ? 'Chwazi Retabli oswa Efase bouyon an anvan w sove.'
          : inlineText(lang, 'Recover or discard the local draft before saving.'),
        'exclamation-triangle',
      );
      return;
    }
    setSaving(true);
    let configSaved = false;
    try {
      const config = {
        section_order: sectionOrder,
        section_visibility: sectionVisibility,
      };
      await creatorProfileService.updateSectionConfig(config);
      configSaved = true;
      // The section config is already persisted at this point — reflect that
      // even if the subscription-price call below fails.
      setSavedConfig(config);
      // Phase 60 — subscription price saves through the profile PATCH
      // endpoint (the same one that persists artist_name / bio / …).
      const normalizedPrice = normalizeSubscriptionPrice(subscriptionPrice);
      const pricePayload = normalizedPrice || null;
      await creatorProfileService.updateMe({ subscription_price: pricePayload });
      setSavedSubscriptionPrice(normalizedPrice);
      if (draftKey) { removeFormDraft(draftKey).catch(() => {}); }
      showToast?.(
        isHt ? 'Anviwònman pwofil sove!' : inlineText(lang, 'Profile settings saved!'),
        'check-circle',
      );
    } catch {
      showToast?.(
        configSaved
          ? (isHt
            ? 'Layout sove, men pri abònman an pa t kapab mete ajou. Eseye ankò.'
            : inlineText(lang, 'Layout saved, but the subscription price could not be updated. Try again.'))
          : (isHt ? 'Erè nan sove anviwònman yo.' : inlineText(lang, 'Error saving settings.')),
        'exclamation-triangle',
      );
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    recoverDraft,
    isHt,
    showToast,
    sectionOrder,
    sectionVisibility,
    subscriptionPrice,
    draftKey,
  ]);

  // Keep the keyboard listener stable while always invoking the latest save.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  // ─── Has changes? ──────────────────────────────────────────────
  const hasChanges = JSON.stringify(savedConfig) !== JSON.stringify({
    section_order: sectionOrder,
    section_visibility: sectionVisibility,
  }) || normalizeSubscriptionPrice(subscriptionPrice) !== savedSubscriptionPrice;

  // Comfort shortcut: Ctrl/Cmd+S applies the same guarded save as the button.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || String(e.key).toLowerCase() !== 's') { return; }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) { return; }
      e.preventDefault();
      if (hasChanges && !saving) { handleSaveRef.current(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasChanges, saving]);

  // Local autosave of layout + price while the section is dirty.
  useEffect(() => {
    if (!draftKey || !hasChanges || recoverDraft || !draftCheckDone) { return undefined; }
    const timer = setTimeout(() => {
      saveFormDraft(draftKey, {
        sectionOrder,
        sectionVisibility,
        subscriptionPrice,
        savedAt: Date.now(),
        profileId,
      })
        .then((result) => {
          if (result?.ok === false && !draftSaveWarned.current) {
            draftSaveWarned.current = true;
            showToast?.(
              isHt
                ? 'Espas stokaj la plen — bouyon lokal la pa ka sovgade. Sove manyèlman pou pa pèdi travay ou.'
                : inlineText(lang, 'Local storage is full — the safety draft cannot be saved. Save manually so you do not lose work.'),
              'exclamation-triangle',
            );
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [
    draftKey,
    hasChanges,
    recoverDraft,
    draftCheckDone,
    sectionOrder,
    sectionVisibility,
    subscriptionPrice,
    profileId,
    isHt,
    showToast,
  ]);

  // Browser-level guard: reload/close with unsaved section changes asks
  // first (the in-page banner covers the normal flow).
  useEffect(() => {
    if (!hasChanges) { return undefined; }
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);

  // Which curated preset matches the current draft (null = custom).
  const templateId = detectProfileTemplate({
    section_order: sectionOrder,
    section_visibility: sectionVisibility,
  });

  const handleApplyTemplate = (template) => {
    // Preserve sections this build doesn't know about (forward compatible).
    const config = applyProfileTemplate(template, {
      section_order: sectionOrder,
      section_visibility: sectionVisibility,
    });
    setSectionOrder(config.section_order);
    setSectionVisibility(config.section_visibility);
  };

  const handleDiscardChanges = () => {
    if (draftKey) { removeFormDraft(draftKey).catch(() => {}); }
    if (!savedConfig) { return; }
    setSectionOrder(savedConfig.section_order);
    setSectionVisibility(savedConfig.section_visibility);
    setSubscriptionPrice(savedSubscriptionPrice);
  };

  const handleRecoverDraft = () => {
    if (!recoverDraft) { return; }
    setSectionOrder(recoverDraft.config.section_order);
    setSectionVisibility(recoverDraft.config.section_visibility);
    setSubscriptionPrice(recoverDraft.subscriptionPrice || '');
    setRecoverDraft(null);
    showToast?.(
      isHt ? 'Bouyon retabli — verifye epi sove.' : inlineText(lang, 'Draft recovered — review and save.'),
      'check-circle',
    );
  };

  const handleDiscardDraft = () => {
    if (draftKey) { removeFormDraft(draftKey).catch(() => {}); }
    setRecoverDraft(null);
    showToast?.(
      isHt ? 'Bouyon efase. Anviwònman yo rete jan yo te sove a.' : inlineText(lang, 'Draft discarded. Settings are back to the saved version.'),
      'check-circle',
    );
  };

  if (loading) {return <StudioSkeleton rows={4} />;}

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-sliders-h"
        title={isHt ? 'Anviwònman Pwofil' : inlineText(lang, 'Profile Settings')}
        lang={lang}
        help={{
          ht: 'Kontwole fason pwofil piblik ou a parèt: lòd seksyon yo, vizibilite chak seksyon, ak kontni an vedèt (kou, pwodwi, pòtfolyo). Tout chanjman aplike sèlman lè w klike "Sove tout".',
          en: 'Control how your public profile renders: section order, visibility toggles, and featured content (courses, products, portfolio). Changes only apply when you click "Save All".',
        }}
        tip={isHt
          ? 'Trennen seksyon yo pou reòganize, oswa sèvi ak bouton flèch yo. Ctrl/⌘+S sove chanjman yo.'
          : inlineText(lang, 'Drag sections to reorder, or use the arrow buttons. Ctrl/⌘+S saves your changes.')}
        action={
          <div className={styles.headerActions}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} aria-hidden="true" />
              {saving
                ? (isHt ? 'Ap sove...' : inlineText(lang, 'Saving...'))
                : (isHt ? 'Sove tout' : inlineText(lang, 'Save All'))}
            </button>
          </div>
        }
      />

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

      {/* ─── Layout Templates ──────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-layer-group" aria-hidden="true" />
          {isHt ? 'Modèl Layout' : inlineText(lang, 'Layout Templates')}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Kòmanse ak yon layout ki bati pou objektif ou. Yon modèl chanje sèlman lòd ak vizibilite seksyon yo — kontni ou rete menm jan an.'
            : inlineText(lang, 'Start from a layout built for your goal. A template only changes section order and visibility — your content stays exactly the same.')}
        </p>
        <div className={styles.profileTemplateStrip}>
          {PROFILE_TEMPLATES.map((template) => {
            const active = templateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={active}
                className={`${styles.profileTemplateChip}${active ? ` ${styles.profileTemplateChipActive}` : ''}`}
                onClick={() => handleApplyTemplate(template)}
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
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 10 }}>
          {templateId
            ? (isHt ? 'Modèl aktyèl la aplikè.' : inlineText(lang, 'The current layout matches a template.'))
            : (isHt ? 'Layout pèsonalize — chwazi yon modèl oswa kontinye manyèlman.' : inlineText(lang, 'Custom layout — pick a template or keep customizing manually.'))}
        </p>
      </section>

      {/* ─── Section Order ─────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-arrows-alt-v" aria-hidden="true" />
          {isHt ? 'Lòd Seksyon' : inlineText(lang, 'Section Order')}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Reòganize lòd seksyon yo sou pwofil piblik ou a — trennen ak grip la, oswa sèvi ak bouton flèch yo. Seksyon yo parèt nan lòd sa a.'
            : inlineText(lang, 'Reorder how sections appear on your public profile — drag with the grip, or use the arrow buttons.')}
        </p>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {reorderAnnouncement}
        </span>
        <div
          ref={listRef}
          role="list"
          aria-label={isHt ? 'Lòd seksyon pwofil' : inlineText(lang, 'Profile section order')}
          className={classNames(styles.list, dragIndex != null && styles.listDragging)}
        >
          {sectionOrder.map((sectionId, index) => {
            const section = ALL_SECTIONS.find(s => s.id === sectionId);
            if (!section) {return null;}
            const isVisible = sectionVisibility[sectionId] !== false;
            return (
              <div
                key={sectionId}
                data-section-id={sectionId}
                data-section-row={index}
                role="listitem"
                aria-posinset={index + 1}
                aria-setsize={sectionOrder.length}
                className={classNames(styles.listItem, dragIndex === index && styles.listItemDragging)}
                style={{ opacity: isVisible ? 1 : 0.45 }}
              >
                <span
                  className={styles.listDragHandle}
                  onPointerDown={(e) => beginDrag(e, index)}
                  role="button"
                  tabIndex={0}
                  aria-label={isHt ? 'Trennen pou reòganize' : inlineText(lang, 'Drag to reorder')}
                  title={isHt ? 'Trennen pou reòganize' : inlineText(lang, 'Drag to reorder')}
                  onKeyDown={(e) => {
                    // Keyboard alternative: ArrowUp / ArrowDown moves the row.
                    if (e.key === 'ArrowUp') { e.preventDefault(); moveSection(index, -1); }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); moveSection(index, 1); }
                  }}
                >
                  <i className="fas fa-grip-vertical" aria-hidden="true" />
                </span>
                <span className={styles.listIcon}>
                  <i className={section.icon} />
                </span>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>
                    {isHt ? section.labelHt : section.label}
                  </div>
                  <div className={styles.listMeta}>
                    {isVisible
                      ? (isHt ? 'Vizib' : inlineText(lang, 'Visible'))
                      : (isHt ? 'Kache' : inlineText(lang, 'Hidden'))}
                    {' · '}#{index + 1}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="studio-btn-sm"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    title={isHt ? 'Moute' : inlineText(lang, 'Move up')}
                    aria-label={isHt ? `Monte ${section.labelHt}` : `Move ${section.label} up`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <i className="fas fa-chevron-up" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="studio-btn-sm"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === sectionOrder.length - 1}
                    title={isHt ? 'Desann' : inlineText(lang, 'Move down')}
                    aria-label={isHt ? `Desann ${section.labelHt}` : `Move ${section.label} down`}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <i className="fas fa-chevron-down" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Visibility Toggles ────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-eye" aria-hidden="true" />
          {isHt ? 'Vizibilite Seksyon' : inlineText(lang, 'Section Visibility')}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Chwazi ki seksyon ki vizib sou pwofil piblik ou a. Seksyon kache yo pa parèt ditou.'
            : inlineText(lang, 'Toggle which sections are visible on your public profile. Hidden sections won\'t appear at all.')}
        </p>
        {ALL_SECTIONS.map((section) => {
          const isVisible = sectionVisibility[section.id] !== false;
          return (
            <div
              key={section.id}
              className={styles.listItem}
              style={{
                marginBottom: 6,
                cursor: 'pointer',
                opacity: isVisible ? 1 : 0.5,
              }}
              onClick={() => toggleVisibility(section.id)}
            >
              <span className={styles.listIcon}>
                <i className={section.icon} />
              </span>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>
                  {isHt ? section.labelHt : section.label}
                </div>
              </div>
              <label
                className="affiliateSwitch"
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0 }}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleVisibility(section.id)}
                  aria-label={isHt
                    ? `${isVisible ? 'Kache' : 'Montre'} ${section.labelHt}`
                    : `${isVisible ? 'Hide' : 'Show'} ${section.label}`}
                />
                <span className="affiliateSwitchSlider" />
              </label>
            </div>
          );
        })}
      </section>

      {/* ─── Featured Content ──────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-thumbtack" aria-hidden="true" />
          {isHt ? 'Kontni An Vedèt' : inlineText(lang, 'Featured Content')}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Chwazi ki kontni ki parèt an premye sou pwofil ou a.'
            : inlineText(lang, 'Choose which content is highlighted on your profile.')}
        </p>

        {/* Featured Course */}
        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-graduation-cap" /> {isHt ? 'Kou An Vedèt' : inlineText(lang, 'Featured Course')}
          </span>
          <select
            className={styles.formSelect}
            value={featuredPins?.featured_course_id || ''}
            onChange={(e) => handlePin('featured_course_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={pinSubmitting}
          >
            <option value="">{isHt ? '— Okenn —' : inlineText(lang, '— None —')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Featured Product */}
        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-cube" /> {isHt ? 'Pwodwi An Vedèt' : inlineText(lang, 'Featured Product')}
          </span>
          <select
            className={styles.formSelect}
            value={featuredPins?.featured_product_id || ''}
            onChange={(e) => handlePin('featured_product_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={pinSubmitting}
          >
            <option value="">{isHt ? '— Okenn —' : inlineText(lang, '— None —')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Featured Portfolio */}
        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-briefcase" /> {isHt ? 'Pòtfolyo An Vedèt' : inlineText(lang, 'Featured Portfolio')}
          </span>
          <select
            className={styles.formSelect}
            value={featuredPins?.featured_portfolio_id || ''}
            onChange={(e) => handlePin('featured_portfolio_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={pinSubmitting}
          >
            <option value="">{isHt ? '— Okenn —' : inlineText(lang, '— None —')}</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ─── Paid Subscriptions (Phase 60) ──────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-star" /> {isHt ? 'Abònman Peyan' : inlineText(lang, 'Paid Subscriptions')}
        </h3>
        <p className={styles.fieldHint} style={{ marginBottom: 14 }}>
          {isHt
            ? 'Mete yon pri chak mwa pou kontni "Abonè Sèlman" ou. Lè pri a vid oswa 0, abònman yo fèmen epi bouton Abòne a kache sou pwofil ou.'
            : inlineText(lang, 'Set a monthly price for your "Subscribers Only" content. Empty or 0 disables subscriptions and hides the Subscribe button on your profile.')}
        </p>
        <div className={styles.fieldGroup} style={{ marginBottom: 16, maxWidth: 280 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-dollar-sign" /> {isHt ? 'Pri chak mwa (USD)' : inlineText(lang, 'Monthly price (USD)')}
          </span>
          <input
            className={styles.formInput}
            type="number"
            min="0"
            step="0.50"
            placeholder={isHt ? 'Egz. 5.00 (vid = fèmen)' : inlineText(lang, 'e.g. 5.00 (empty = off)')}
            value={subscriptionPrice}
            onChange={(e) => setSubscriptionPrice(e.target.value)}
          />
        </div>
        {subscriptionPrice.trim() && (
          <p className={styles.fieldHint}>
            {isHt
              ? `Abonè yo pral peye $${subscriptionPrice}/mwa pou jwenn aksè a kontni abonè sèlman.`
              : `Subscribers will pay $${subscriptionPrice}/month for access to your subscribers-only content.`}
          </p>
        )}
      </section>

      {/* ─── Unsaved changes indicator ──────────────────────────── */}
      {hasChanges && (
        <div className={styles.profileEditorDirtyBar} role="status">
          <span className={styles.profileEditorDirtyText}>
            <i className="fas fa-circle-exclamation" aria-hidden="true" />{' '}
            {isHt
              ? 'Gen chanjman ki poko sove. Klike sou "Sove tout" pou aplike yo.'
              : inlineText(lang, 'You have unsaved changes. Click "Save All" to apply them.')}
          </span>
          <div className={styles.profileEditorDirtyActions}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDiscardChanges}
              disabled={saving}
            >
              {isHt ? 'Jete chanjman' : inlineText(lang, 'Discard')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
