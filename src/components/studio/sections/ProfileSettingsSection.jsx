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
import { getUserIdentity } from '../../../utils/userIdentity';
import styles from './sections.module.css';

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
  section_visibility: Object.fromEntries(ALL_SECTIONS.map(s => [s.id, true])),
};

export default function ProfileSettingsSection({ lang, showToast, user }) {
  const isHt = lang === 'ht';
  const identity = getUserIdentity(user);

  // ─── State ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      // Load section config
      const config = profile?.section_config || DEFAULT_SECTION_CONFIG;
      setSectionOrder(Array.isArray(config.section_order) ? config.section_order : DEFAULT_SECTION_CONFIG.section_order);
      setSectionVisibility(config.section_visibility || DEFAULT_SECTION_CONFIG.section_visibility);
      setSavedConfig(config);

      // Load featured pins
      const pins = health?.featured_pins || {};
      setFeaturedPins(pins);

      // Phase 60 — subscription price ('' when disabled)
      const price = profile?.subscription_price;
      setSubscriptionPrice(price && Number(price) > 0 ? String(price) : '');

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
      showToast?.(isHt ? 'Erè nan chaje paramèt' : 'Error loading settings', 'exclamation-triangle');
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

  // ─── Section order: move up/down (keyboard / touch fallback) ─────
  const moveSection = useCallback((index, direction) => {
    setSectionOrder(prev => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) {return prev;}
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }, []);

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
      showToast?.(isHt ? 'Ansekle aktyalize!' : 'Pin updated!', 'check-circle');
    } catch {
      showToast?.(isHt ? 'Erè' : 'Error', 'exclamation-triangle');
    } finally {
      setPinSubmitting(false);
    }
  };

  // ─── Save all settings ─────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const config = {
        section_order: sectionOrder,
        section_visibility: sectionVisibility,
      };
      await creatorProfileService.updateSectionConfig(config);
      // Phase 60 — subscription price saves through the profile PATCH
      // endpoint (the same one that persists artist_name / bio / …).
      const priceNum = Number.parseFloat(subscriptionPrice);
      const pricePayload = (!subscriptionPrice.trim() || Number.isNaN(priceNum) || priceNum <= 0)
        ? null
        : String(Math.round(priceNum * 100) / 100);
      await creatorProfileService.updateMe({ subscription_price: pricePayload });
      setSavedConfig(config);
      showToast?.(
        isHt ? 'Anviwònman pwofil sove!' : 'Profile settings saved!',
        'check-circle',
      );
    } catch {
      showToast?.(
        isHt ? 'Erè nan sove anviwònman yo.' : 'Error saving settings.',
        'exclamation-triangle',
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Has changes? ──────────────────────────────────────────────
  const hasChanges = JSON.stringify(savedConfig) !== JSON.stringify({
    section_order: sectionOrder,
    section_visibility: sectionVisibility,
  });

  if (loading) {return <StudioSkeleton rows={4} />;}

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-sliders-h"
        title={isHt ? 'Anviwònman Pwofil' : 'Profile Settings'}
        lang={lang}
        help={{
          ht: 'Kontwole fason pwofil piblik ou a parèt: lòd seksyon yo, vizibilite chak seksyon, ak kontni an vedèt (kou, pwodwi, pòtfolyo). Tout chanjman aplike sèlman lè w klike "Sove tout".',
          en: 'Control how your public profile renders: section order, visibility toggles, and featured content (courses, products, portfolio). Changes only apply when you click "Save All".',
        }}
        tip={isHt
          ? 'Trennen seksyon yo pou reòganize — oswa sèvi ak bouton flèch yo sou ekran touche.'
          : 'Drag sections to reorder — or use the arrow buttons on touch screens.'}
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
                ? (isHt ? 'Ap sove...' : 'Saving...')
                : (isHt ? 'Sove tout' : 'Save All')}
            </button>
          </div>
        }
      />

      {/* ─── Section Order ─────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionSubtitle}>
          <i className="fas fa-arrows-alt-v" aria-hidden="true" />
          {isHt ? 'Lòd Seksyon' : 'Section Order'}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Reòganize lòd seksyon yo sou pwofil piblik ou a — trennen ak grip la, oswa sèvi ak bouton flèch yo. Seksyon yo parèt nan lòd sa a.'
            : 'Reorder how sections appear on your public profile — drag with the grip, or use the arrow buttons.'}
        </p>
        <div ref={listRef} className={classNames(styles.list, dragIndex != null && styles.listDragging)}>
          {sectionOrder.map((sectionId, index) => {
            const section = ALL_SECTIONS.find(s => s.id === sectionId);
            if (!section) {return null;}
            const isVisible = sectionVisibility[sectionId] !== false;
            return (
              <div
                key={sectionId}
                data-section-id={sectionId}
                data-section-row={index}
                className={classNames(styles.listItem, dragIndex === index && styles.listItemDragging)}
                style={{ opacity: isVisible ? 1 : 0.45 }}
              >
                <span
                  className={styles.listDragHandle}
                  onPointerDown={(e) => beginDrag(e, index)}
                  role="button"
                  tabIndex={0}
                  aria-label={isHt ? 'Trennen pou reòganize' : 'Drag to reorder'}
                  title={isHt ? 'Trennen pou reòganize' : 'Drag to reorder'}
                  onKeyDown={(e) => {
                    // Keyboard alternative: ArrowUp / ArrowDown moves the row.
                    if (e.key === 'ArrowUp') {moveSection(index, -1);}
                    else if (e.key === 'ArrowDown') {moveSection(index, 1);}
                  }}
                >
                  <i className="fas fa-grip-vertical" aria-hidden="true" />
                </span>
                <span className={styles.listIcon}>
                  <i className={`fas ${section.icon}`} />
                </span>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>
                    {isHt ? section.labelHt : section.label}
                  </div>
                  <div className={styles.listMeta}>
                    {isVisible
                      ? (isHt ? 'Vizib' : 'Visible')
                      : (isHt ? 'Kache' : 'Hidden')}
                    {' · '}#{index + 1}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="studio-btn-sm"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    title={isHt ? 'Moute' : 'Move up'}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <i className="fas fa-chevron-up" />
                  </button>
                  <button
                    type="button"
                    className="studio-btn-sm"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === sectionOrder.length - 1}
                    title={isHt ? 'Desann' : 'Move down'}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <i className="fas fa-chevron-down" />
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
          {isHt ? 'Vizibilite Seksyon' : 'Section Visibility'}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Chwazi ki seksyon ki vizib sou pwofil piblik ou a. Seksyon kache yo pa parèt ditou.'
            : 'Toggle which sections are visible on your public profile. Hidden sections won\'t appear at all.'}
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
                <i className={`fas ${section.icon}`} />
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
          {isHt ? 'Kontni An Vedèt' : 'Featured Content'}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {isHt
            ? 'Chwazi ki kontni ki parèt an premye sou pwofil ou a.'
            : 'Choose which content is highlighted on your profile.'}
        </p>

        {/* Featured Course */}
        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-graduation-cap" /> {isHt ? 'Kou An Vedèt' : 'Featured Course'}
          </span>
          <select
            className={styles.formSelect}
            value={featuredPins?.featured_course_id || ''}
            onChange={(e) => handlePin('featured_course_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={pinSubmitting}
          >
            <option value="">{isHt ? '— Okenn —' : '— None —'}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Featured Product */}
        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-cube" /> {isHt ? 'Pwodwi An Vedèt' : 'Featured Product'}
          </span>
          <select
            className={styles.formSelect}
            value={featuredPins?.featured_product_id || ''}
            onChange={(e) => handlePin('featured_product_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={pinSubmitting}
          >
            <option value="">{isHt ? '— Okenn —' : '— None —'}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Featured Portfolio */}
        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-briefcase" /> {isHt ? 'Pòtfolyo An Vedèt' : 'Featured Portfolio'}
          </span>
          <select
            className={styles.formSelect}
            value={featuredPins?.featured_portfolio_id || ''}
            onChange={(e) => handlePin('featured_portfolio_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={pinSubmitting}
          >
            <option value="">{isHt ? '— Okenn —' : '— None —'}</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ─── Paid Subscriptions (Phase 60) ──────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <h3 className={styles.sectionTitle}>
          <i className="fas fa-star" /> {isHt ? 'Abònman Peyan' : 'Paid Subscriptions'}
        </h3>
        <p className={styles.fieldHint} style={{ marginBottom: 14 }}>
          {isHt
            ? 'Mete yon pri chak mwa pou kontni "Abonè Sèlman" ou. Lè pri a vid oswa 0, abònman yo fèmen epi bouton Abòne a kache sou pwofil ou.'
            : 'Set a monthly price for your "Subscribers Only" content. Empty or 0 disables subscriptions and hides the Subscribe button on your profile.'}
        </p>
        <div className={styles.fieldGroup} style={{ marginBottom: 16, maxWidth: 280 }}>
          <span className={styles.fieldLabel}>
            <i className="fas fa-dollar-sign" /> {isHt ? 'Pri chak mwa (USD)' : 'Monthly price (USD)'}
          </span>
          <input
            className={styles.formInput}
            type="number"
            min="0"
            step="0.50"
            placeholder={isHt ? 'Egz. 5.00 (vid = fèmen)' : 'e.g. 5.00 (empty = off)'}
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
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#d97706',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <i className="fas fa-exclamation-circle" />
          {isHt
            ? 'Gen chanjman ki poko sove. Klike sou "Sove tout" pou aplike yo.'
            : 'You have unsaved changes. Click "Save All" to apply them.'}
        </div>
      )}
    </div>
  );
}
