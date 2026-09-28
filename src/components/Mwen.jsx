/**
 * src/components/Mwen.jsx
 *
 * Phase 19 — The "Mwen" (My) personal space.
 *
 * Three sections backed by the explore-saves + recent-views API
 * (see backend/api/views/explore_saved.py):
 *
 *   1. Saved Talents   — GET /api/explore/saved/talents/
 *   2. Saved Music     — GET /api/explore/saved/music/
 *   3. Saves           — GET /api/explore/saved/items/?item_type=…
 *                        for product / job / spotlight / event /
 *                        portfolio / course, merged newest-first
 *   4. Recent Activity — GET /api/explore/recent/  (mixed feed,
 *                        newest first, expanded into talent /
 *                        music / course cards)
 *
 * ─── Phase 19.1 refactor: unified row ────────────────────────────
 * TalentRowCard, MusicRowCard, and the three inline branches in
 * RecentRowCard are now collapsed into a single ``MwenEntityRow``
 * component driven by a normalized prop shape. This kills ~120
 * lines of duplicated JSX and one class of bugs:
 *   • When ``.mwen-row-avatar`` (48px) and ``.mwen-row-cover``
 *     (56px) had different sizes, talent + music rows in the
 *     Recent view had different mathematical heights, producing
 *     a jagged "un-stacked" rhythm when scrolled. The unified
 *     component normalizes both to 56px via a single CSS rule.
 *   • The previous ``InitialAvatar`` inspected ``className`` to
 *     decide between avatar-vs-cover sizing; a brittle string-
 *     match that broke whenever a future card passed a className
 *     containing ``cover``. The new API takes an explicit
 *     ``kind: 'talent'|'music'|'orphan'|'course'`` so the JSX
 *     side never string-tests.css for layout decisions.
 *
 * Auth: this component is ONLY useful when the user is signed
 * in. We pull `user` from props; if absent we render a
 * "Sign in to see your saves" empty state with a Sign-in CTA
 * that opens the /sheet/auth route.
 */
import React, { useEffect, useState, useCallback, useRef, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { requireLogin } from '../utils/history';
import { t2 } from '../utils/i18n';

import { savedMusicService, savedTalentsService, savedItemService, recentService, creatorProfileService } from '../services/api';
import { buildContentUrl } from '../utils/contentUrl';
import { SHEETS } from '../routes/sheets';
import { ActivityTimeline } from './ActivityTimeline';
import { getUserIdentity } from '../utils/userIdentity';
import { fmtDate, premiumPlanLabel } from '../utils/formatMedia';

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function formatTimeAgo(isoString, lang) {
  if (!isoString) {return '';}
  const now = new Date();
  const then = new Date(isoString);
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) {return t2(lang, { ht: 'kounye a', en: 'just now' });}
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return lang === 'ht'
      ? `${diffMin} min de sa`
      : `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return lang === 'ht'
      ? `${diffHr}è de sa`
      : `${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    return lang === 'ht'
      ? `${diffDay} jou de sa`
      : `${diffDay}d ago`;
  }
  return then.toLocaleDateString();
}

// ─── Image handling (fallback + safe loading) ─────────────────────
//
// Each row passes an explicit ``kind`` (``'talent'`` / ``'music'`` /
// ``'orphan'`` / ``'course'``). The kind controls BOTH the size of
// the rendered image placeholder and the icon shown when no image
// is available. This is strictly better than the previous
// className-inspection approach because:
//   - The CSS owns sizing (no JSX string-matching).
//   - Orphan/Course kinds always render their identifying badge
//     icon, even if a stale ``image.avatar`` URL is still in the
//     saved-talent payload from a deleted account.
//
// ``placeholderConfig`` is the single source of truth for which
// kind renders which size + which icon. Adding a new kind is a
// 2-line change (table row + CSS class).

const PLACEHOLDER_CONFIG = {
  talent: { sizeClass: 'mwen-row-avatar',  showInitial: true  },
  music:  { sizeClass: 'mwen-row-cover',   showInitial: true  },
  orphan: { sizeClass: 'mwen-row-avatar',  showInitial: false, icon: 'fa-ghost' },
  course: { sizeClass: 'mwen-row-avatar',  showInitial: false, icon: 'fa-graduation-cap' },
  // Generic SavedItem kinds (product / job / spotlight / event /
  // portfolio) — cover-sized placeholder with a per-type icon.
  product:   { sizeClass: 'mwen-row-cover', showInitial: false, icon: 'fa-box' },
  job:       { sizeClass: 'mwen-row-cover', showInitial: false, icon: 'fa-briefcase' },
  spotlight: { sizeClass: 'mwen-row-cover', showInitial: false, icon: 'fa-lightbulb' },
  event:     { sizeClass: 'mwen-row-cover', showInitial: false, icon: 'fa-calendar-days' },
  portfolio: { sizeClass: 'mwen-row-cover', showInitial: false, icon: 'fa-folder-open' },
};

function placeholderConfig(kind) {
  return PLACEHOLDER_CONFIG[kind] || PLACEHOLDER_CONFIG.talent;
}

function computeHue(name) {
  // Stable, name-driven hue so the same talent gets the same gradient
  // across reloads. Sum of char codes modulo 360 is consistent
  // across browsers + Node.
  return (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function gradientStyleFor(name) {
  const hue = computeHue(name);
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 70%, 45%))`,
  };
}

function InitialAvatar({ name, kind = 'talent' }) {
  const cfg = placeholderConfig(kind);
  if (!cfg.showInitial) {
    return (
      <div
        className={`${cfg.sizeClass} mwen-row-avatar-orphan`}
        aria-hidden="true"
      >
        <i className={`fas ${cfg.icon}`} />
      </div>
    );
  }
  // The gradient placeholder is computed on every render of
  // InitialAvatar. The wrapper component only re-renders when
  // the parent re-mounts (e.g. an image fails-after-load), so
  // React's deep-equality rerender cost is bounded — no need
  // to memoise a one-line string computation.
  return (
    <div
      className={`${cfg.sizeClass} mwen-row-avatar-placeholder`}
      style={gradientStyleFor(name)}
      aria-hidden="true"
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function SafeImage({ src, alt, name, kind = 'talent' }) {
  const [failed, setFailed] = useState(false);
  // Reset failed state when src changes so we retry loading each
  // time the underlying save data swaps (handles optimistic
  // unsave→re-save round-trips where the same row receives a
  // fresh image URL). Intentional "reset state when a prop changes"
  // effect-driven sync — the SafeImage is remounted on identity
  // swap anyway, so this only guards the in-place prop update.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return <InitialAvatar name={name || alt} kind={kind} />;
  }
  const sizeClass = placeholderConfig(kind).sizeClass;
  return (
    <img
      className={sizeClass}
      src={src}
      alt={alt || ''}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Subtitle composition ──────────────────────────────────────────
//
// Returns a flat React fragment for the .mwen-row-sub line:
//   "Designer"                                 (no secondary)
//   "Designer · NYC"                           (with separator)
//   "Designer · <icon> NYC"                    (with separator + icon)
//
// Wrapping in plain text (not <span>) keeps the line as a single
// inline flow so the parent's `display: block; white-space:
// nowrap; overflow: hidden; text-overflow: ellipsis;` truncates
// predictably. Browsers reliably baseline-align raw text + inline
// icons; an anonymous flex item (the previous implementation) is
// what was causing the inconsistent "they don't stack cleanly
// one on top of the other" symptom on some Chromium builds.
function composeSubtitle(primary, secondary, secondaryIcon) {
  if (!primary && !secondary) {return null;}
  if (!secondary) {return primary;}
  if (secondaryIcon) {
    return (
      <>
        {primary}
        {' · '}
        <i className={`fas ${secondaryIcon}`} aria-hidden="true" /> {secondary}
      </>
    );
  }
  return <>{primary}{' · '}{secondary}</>;
}

// ─── Unified row card ──────────────────────────────────────────────
//
// One component, one DOM shape, one CSS contract. Takes a normalized
// prop shape regardless of which entity we're showing. The caller
// (see builders below) is responsible for mapping raw API data into
// these props — the row itself is purely presentational.
//
// Accessibility notes:
//   • Orphan + Course rows render ``<div class="mwen-row-cta
//     mwen-row-cta-static">`` (not <button>), and skip onUnsave,
//     because screen readers should NOT announce a disabled/dead
//     button for catalog items that no longer exist or are
//     read-only placeholders.
//   • When the row IS clickable, the CTA <button> and the Unsave
//     <button> stay as adjacent siblings inside the listitem, not
//     nested (nested buttons invalidate HTML).
function MwenEntityRow({
  image,
  fallbackKind,
  title,
  subtitle,
  interactive,
  onOpen,
  onUnsave,
  ariaLabel,
  t,
  dim,
}) {
  const ctaContent = (
    <>
      <SafeImage
        src={image?.src}
        alt={image?.alt}
        name={image?.name || title}
        kind={fallbackKind}
      />
      <div className="mwen-row-meta">
        <div className="mwen-row-title">{title}</div>
        {subtitle !== null && subtitle !== undefined && (
          <div className="mwen-row-sub">{subtitle}</div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={classNames('mwen-row-card', dim && 'mwen-row-orphan')}
      role="listitem"
    >
      {interactive ? (
        <button
          type="button"
          className="mwen-row-cta"
          onClick={onOpen}
          aria-label={ariaLabel}
        >
          {ctaContent}
        </button>
      ) : (
        <div className="mwen-row-cta mwen-row-cta-static" aria-label={ariaLabel}>
          {ctaContent}
        </div>
      )}
      {onUnsave && (
        <button
          type="button"
          className="mwen-row-action"
          onClick={onUnsave}
          aria-label={t?.mwen_unsave || 'Remove'}
          title={t?.mwen_unsave || 'Remove'}
        >
          <i className="fas fa-bookmark" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── Section header + empty state ─────────────────────────────────

function SectionHeader({ label, count }) {
  return (
    <div className="mwen-section-header">
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="mwen-section-count">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ icon, title, hint, ctaLabel, onCta }) {
  return (
    <div className="mwen-empty" role="status">
      <div className="mwen-empty-icon-wrap">
        <i className={`fas ${icon}`} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {ctaLabel && onCta && (
        <button type="button" className="mwen-empty-cta" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

const SECTIONS = [
  { id: 'saved_talents', icon: 'fa-star' },
  { id: 'saved_music',   icon: 'fa-music' },
  { id: 'saved_items',   icon: 'fa-heart' },
  { id: 'recent',        icon: 'fa-clock-rotate-left' },
  { id: 'activity',      icon: 'fa-rss' },
];

// Catalog types backed by the generic SavedItem endpoint — fetched in
// parallel and merged into the single "Saves" section (newest first).
const SAVED_ITEM_TYPES = ['product', 'job', 'spotlight', 'event', 'portfolio', 'course'];

function savedItemTypeLabel(type, lang, t) {
  return {
    product:   t.explore_marketplace || (t2(lang, { ht: 'Mache', en: 'Product' })),
    job:       t.explore_jobs || (t2(lang, { ht: 'Travay', en: 'Job' })),
    spotlight: t.explore_spotlight || 'Spotlight',
    event:     t.explore_events || (t2(lang, { ht: 'Evènman', en: 'Event' })),
    portfolio: t.explore_portfolio || (t2(lang, { ht: 'Pòtfolyo', en: 'Portfolio' })),
    course:    t.mwen_course_label || (t2(lang, { ht: 'Kou', en: 'Course' })),
  }[type] || type;
}

// ─── Affiliate state view-model ──────────────────────────────────
// Single derived value so the card list never sprinkles boolean soup
// about the user's affiliate situation. Backed by the DB field the
// backend exposes on /api/me/ (affiliate_application_status) — never
// inferred from role flags or content presence.
//   'active'    — approved + active AffiliateProfile (is_affiliate)
//   'pending'   — application awaiting review
//   'suspended' — profile deactivated
//   'rejected'  — latest application rejected
//   'none'      — never applied
function getAffiliateState(user) {
  if (!user) {return 'none';}
  if (user.is_affiliate) {return 'active';}
  return user.affiliate_application_status || 'none';
}

function formatSavedItemSubtitle(type, item, lang, t) {
  // One-line detail per type; falls back to the type label so a
  // row is never bare.
  if (!item) {return null;}
  if (type === 'product') {
    // ``price`` is a DRF DecimalField → arrives as a string
    // ("10.00"); ``!= null`` accepts both string + number.
    const price = item.price != null ? `${item.currency || '$'}${item.price}` : null;
    return composeSubtitle(price, item.category || null);
  }
  if (type === 'job') {
    const hasBudget = item.budget_min != null && item.budget_max != null;
    const budget = hasBudget
      ? `${item.currency || '$'}${item.budget_min}–${item.currency || '$'}${item.budget_max}`
      : null;
    return composeSubtitle(budget, item.location || null);
  }
  if (type === 'spotlight') {return item.category || null;}
  if (type === 'event') {
    // ``start_time`` is usually in the future — render the date
    // (not a "time ago"), falling back to the raw string.
    let when = null;
    if (item.start_time) {
      try {
        when = new Date(item.start_time).toLocaleDateString(
          lang === 'ht' ? 'fr-HT' : lang,
          { month: 'short', day: 'numeric' },
        );
      } catch (_) {
        when = item.start_time;
      }
    }
    return composeSubtitle(when, item.location || null);
  }
  if (type === 'portfolio') {return item.category || null;}
  if (type === 'course') {return item.category || null;}
  return null;
}

export function Mwen({
  user,
  lang = 'ht',
  translations,
  showToast,
  onOpenTalentSheet,
  onOpenMusicSheet,
  onOpenExplore,
}) {
  const t = translations?.[lang] || translations?.ht || {};
  const navigate = useSafeNavigate();
  const location = useLocation();
  const identity = getUserIdentity(user);
  const displayName = identity.displayName || (t2(lang, { ht: 'Mwen', en: 'Me' }));
  const displayTag = identity.email || identity.username || '';
  // Affiliate lifecycle for the quick-nav card list below (see
  // getAffiliateState). Kept next to the other derived identity
  // values so the card array reads declaratively.
  const affiliateState = getAffiliateState(user);

  // ─── Fetch creator avatar for hero ──────────────────────────
  const [mwenAvatarUrl, setMwenAvatarUrl] = useState(null);
  useEffect(() => {
    if (!user?.is_creator || !identity.creatorLookupKey) {
      // Reset the hero avatar when the identity flips to a
      // non-creator — intentional effect-driven sync, not a cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMwenAvatarUrl(null);
      return;
    }
    let cancelled = false;
    creatorProfileService.get(identity.creatorLookupKey)
      .then((res) => {
        if (cancelled) {return;}
        const avatar = res?.data?.avatar_url;
        if (avatar) {setMwenAvatarUrl(avatar);}
      })
      .catch(() => { if (!cancelled) {setMwenAvatarUrl(null);} });
    return () => { cancelled = true; };
  }, [identity.creatorLookupKey, user?.is_creator]);

  const [section, setSection] = useState('saved_talents');
  // ─── Tab-bar overflow detection ────────────────────────────────────
  // The right-edge fade affordance (``.mwen-section-tabs-wrap::after``)
  // must only appear when the scrollable tab bar actually overflows — a
  // bar that fits its container should show no phantom gradient. We
  // measure ``scrollWidth > clientWidth`` after mount, on every section
  // change (counts/labels can widen a pill), and on window resize, then
  // toggle ``is-overflowing`` on the wrapper. A ResizeObserver on the
  // bar itself catches width changes that resize doesn't (e.g. font
  // loading, locale switch) without a polling loop.
  const tabsWrapRef = useRef(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);

  useEffect(() => {
    const wrap = tabsWrapRef.current;
    const bar = wrap?.querySelector('.mwen-section-tabs');
    if (!wrap || !bar) return undefined;
    const update = () => {
      const overflowing = bar.scrollWidth > bar.clientWidth + 1;
      // Only setState when the value flips to avoid re-render churn on
      // every scroll event (scrollWidth is stable, but cheap guard).
      setTabsOverflow((prev) => (prev === overflowing ? prev : overflowing));
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(bar);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [section]);
  const [savedTalents, setSavedTalents] = useState(null);
  const [savedMusic, setSavedMusic] = useState(null);
  const [savedItems, setSavedItems] = useState(null);
  const [recent, setRecent] = useState(null);
  // Per-section error flags so a failed /saved/talents/ fetch
  // doesn't blank the whole tab — the other sections can still
  // render and the failed one shows a retry button.
  const [err, setErr] = useState({ saved_talents: null, saved_music: null, saved_items: null, recent: null });

  const loadAll = useCallback(async () => {
    if (!user) {return;}
    // Reset to "loading" shape (null) so the skeleton renders on
    // every retry; the section is keyed on the truthiness of the
    // state so any retry visibly re-suspends.
    setSavedTalents(null);
    setSavedMusic(null);
    setSavedItems(null);
    setRecent(null);
    setErr({ saved_talents: null, saved_music: null, saved_items: null, recent: null });
    try {
      const [talentsRes, musicRes, ...rest] = await Promise.allSettled([
        savedTalentsService.list(),
        savedMusicService.list(),
        ...SAVED_ITEM_TYPES.map((type) => savedItemService.list(type)),
        recentService.list(),
      ]);
      // last element of ``rest`` is the recent feed (same order as
      // the allSettled array above).
      const savedItemResults = rest.slice(0, SAVED_ITEM_TYPES.length);
      const recentRes = rest[rest.length - 1];
      if (talentsRes.status === 'fulfilled') {
        setSavedTalents(Array.isArray(talentsRes.value?.data) ? talentsRes.value.data : []);
      } else {
        setSavedTalents([]);
        setErr((e) => ({ ...e, saved_talents: talentsRes.reason?.message || 'error' }));
      }
      if (musicRes.status === 'fulfilled') {
        setSavedMusic(Array.isArray(musicRes.value?.data) ? musicRes.value.data : []);
      } else {
        setSavedMusic([]);
        setErr((e) => ({ ...e, saved_music: musicRes.reason?.message || 'error' }));
      }
      // Generic saves: merge all 6 types into one newest-first list.
      // A single failing type doesn't blank the section — only when
      // EVERY list failed do we surface the error state.
      let merged = [];
      let allFailed = true;
      savedItemResults.forEach((res) => {
        if (res.status === 'fulfilled') {
          allFailed = false;
          const rows = Array.isArray(res.value?.data)
            ? res.value.data
            : (res.value?.data?.results || []);
          merged = merged.concat(rows);
        }
      });
      merged.sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
      setSavedItems(merged);
      if (allFailed) {
        setErr((e) => ({ ...e, saved_items: 'error' }));
      }
      if (recentRes.status === 'fulfilled') {
        setRecent(Array.isArray(recentRes.value?.data) ? recentRes.value.data : []);
      } else {
        setRecent([]);
        setErr((e) => ({ ...e, recent: recentRes.reason?.message || 'error' }));
      }
    } catch (e) {
      // Promise.allSettled never throws, but the catch is here
      // defensively in case a future refactor swaps to
      // Promise.all (which DOES reject on first failure).
       
      console.error('Mwen loadAll failed', e);
    }
  }, [user]);

  useEffect(() => {
    // loadAll() is async (network) but resets the loading shape
    // synchronously on entry — the same intentional pattern as the
    // rest of the codebase (see CheckoutModal.jsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  // ─── Anonymous-user guard ─────────────────────────────────────────────
  if (!user) {
    return (
      <div className="mwen-page">
        <EmptyState
          icon="fa-user-lock"
          title={t.mwen_signin_required || 'Sign in to see your saves'}
          hint={t.mwen_signin_hint || 'Your saved talents, music, and recent activity will appear here.'}
          ctaLabel={t.mwen_signin_cta || (t2(lang, { ht: 'Konekte', en: 'Sign in' }))}
          onCta={() => requireLogin(navigate, location, SHEETS.LOGIN)}
        />
      </div>
    );
  }

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleUnsaveTalent = async (save) => {
    const id = save?.talent?.id;
    if (!id) {return;}
    // Optimistic remove — drop from UI immediately, restore on
    // failure. Faster than waiting for the round-trip, and the
    // user can always re-save (the backend POST is idempotent).
    const prev = savedTalents;
    setSavedTalents((list) => (list || []).filter((s) => s.talent?.id !== id));
    try {
      await savedTalentsService.remove(id);
    } catch (e) {
      setSavedTalents(prev);
      showToast?.(t.mwen_unsave_error || 'Could not remove. Try again.', 'circle-exclamation');
    }
  };
  const handleUnsaveMusic = async (save) => {
    const id = save?.music?.id;
    if (!id) {return;}
    const prev = savedMusic;
    setSavedMusic((list) => (list || []).filter((s) => s.music?.id !== id));
    try {
      await savedMusicService.remove(id);
    } catch (e) {
      setSavedMusic(prev);
      showToast?.(t.mwen_unsave_error || 'Could not remove. Try again.', 'circle-exclamation');
    }
  };
  const handleUnsaveItem = async (save) => {
    const itemId = save?.item_id ?? save?.item?.id;
    if (!save?.item_type || !itemId) {return;}
    const prev = savedItems;
    setSavedItems((list) => (list || []).filter((s) => s.id !== save.id));
    try {
      await savedItemService.remove(save.item_type, itemId);
    } catch (e) {
      setSavedItems(prev);
      showToast?.(t.mwen_unsave_error || 'Could not remove. Try again.', 'circle-exclamation');
    }
  };
  const handleOpen = (entity, kind) => {
    if (!entity) {return;}
    // Both sheet handlers are always passed by App.jsx. No silent fallback:
    // a dead fallback (talent → onOpenExplore) used to quietly route a saved-
    // talent click to the Explore surface whenever onOpenTalentSheet was
    // missing, masking wiring bugs. Music has always been symmetric.
    if (kind === 'music' && onOpenMusicSheet) {onOpenMusicSheet(entity);}
    else if (kind === 'talent' && onOpenTalentSheet) {onOpenTalentSheet(entity);}
  };

  // ─── Row builders: raw API → normalized MwenEntityRow props ────────
  // These are tiny mappers: each one just lifts the right fields
  // out of the raw entity and lets MwenEntityRow own the markup.

  const buildSavedTalentRow = (save) => {
    const talent = save?.talent || {};
    return {
      key: save.id,
      image: {
        src: talent.avatar || talent.avatar_url,
        alt: talent.name,
        name: talent.name,
      },
      fallbackKind: 'talent',
      title: talent.name || '',
      subtitle: composeSubtitle(talent.role, talent.location, 'fa-map-marker-alt'),
      interactive: true,
      ariaLabel: talent.name || 'Talent',
      dim: false,
      onOpen: () => handleOpen(talent, 'talent'),
      onUnsave: () => handleUnsaveTalent(save),
    };
  };

  const buildSavedItemRow = (save) => {
    const type = save?.item_type;
    const item = save?.item || null;
    const orphan = !item || !item.id;
    const title = orphan
      ? (t.mwen_removed_item || 'Removed item')
      : (item.title || item.name || item.invention_title || savedItemTypeLabel(type, lang, t));
    const imageSrc = orphan ? null : (item.image_url || item.cover_url);
    return {
      key: save.id,
      image: imageSrc
        ? { src: imageSrc, alt: title, name: title }
        : undefined,
      fallbackKind: orphan ? 'orphan' : (type || 'course'),
      title,
      subtitle: formatSavedItemSubtitle(type, item, lang, t),
      interactive: !orphan,
      ariaLabel: title,
      dim: orphan,
      onOpen: () => {
        if (!item?.id) {return;}
        // Canonical /{slug}@{user}/{type} deep-link — the same URL
        // the heart buttons on the detail pages share.
        startTransition(() => navigate(buildContentUrl(type, item)));
      },
      onUnsave: () => handleUnsaveItem(save),
    };
  };

  const buildSavedMusicRow = (save) => {
    const track = save?.music || {};
    return {
      key: save.id,
      image: {
        src: track.cover || track.cover_url,
        alt: track.title,
        name: track.title || track.artist,
      },
      fallbackKind: 'music',
      title: track.title || '',
      subtitle: composeSubtitle(track.artist, track.genre),
      interactive: true,
      ariaLabel: track.title || 'Track',
      dim: false,
      onOpen: () => handleOpen(track, 'music'),
      onUnsave: () => handleUnsaveMusic(save),
    };
  };

  const buildRecentRow = (recentEntry) => {
    const item = recentEntry.item;
    if (!item) {
      // Orphan row (catalog entity was deleted) — render a
      // tombstone so the user understands why the card is empty
      // rather than seeing a broken card.
      return {
        key: recentEntry.id,
        title: t.mwen_removed_item || 'Removed item',
        subtitle: formatTimeAgo(recentEntry.viewed_at, lang),
        fallbackKind: 'orphan',
        interactive: false,
        ariaLabel: t.mwen_removed_item || 'Removed item',
        dim: true,
      };
    }
    if (recentEntry.item_type === 'talent') {
      return {
        key: recentEntry.id,
        image: {
          src: item.avatar || item.avatar_url,
          alt: item.name,
          name: item.name,
        },
        fallbackKind: 'talent',
        title: item.name || '',
        subtitle: composeSubtitle(item.role, formatTimeAgo(recentEntry.viewed_at, lang)),
        interactive: true,
        ariaLabel: item.name || 'Talent',
        dim: false,
        onOpen: () => handleOpen(item, 'talent'),
      };
    }
    if (recentEntry.item_type === 'music') {
      return {
        key: recentEntry.id,
        image: {
          src: item.cover || item.cover_url,
          alt: item.title,
          name: item.title || item.artist,
        },
        fallbackKind: 'music',
        title: item.title || '',
        subtitle: composeSubtitle(item.artist, formatTimeAgo(recentEntry.viewed_at, lang)),
        interactive: true,
        ariaLabel: item.title || 'Track',
        dim: false,
        onOpen: () => handleOpen(item, 'music'),
      };
    }
    // Course (forward compatibility — the backend supports
    // 'course' recent views; render a static tombstone until the
    // CourseSheet flow is wired in Phase 19.x).
    return {
      key: recentEntry.id,
      title: item.title || t.mwen_course_label || 'Course',
      subtitle: formatTimeAgo(recentEntry.viewed_at, lang),
      fallbackKind: 'course',
      interactive: false,
      ariaLabel: item.title || 'Course',
      dim: false,
    };
  };

  // ─── Section state helpers ──────────────────────────────────────
  const isLoading = {
    saved_talents: savedTalents === null && !err.saved_talents,
    saved_music:   savedMusic   === null && !err.saved_music,
    saved_items:   savedItems   === null && !err.saved_items,
    recent:        recent       === null && !err.recent,
  };
  const counts = {
    saved_talents: (savedTalents || []).length,
    saved_music:   (savedMusic || []).length,
    saved_items:   (savedItems || []).length,
    recent:        (recent || []).length,
  };

  const renderSkeleton = (n = 3) => (
    <div className="mwen-skel-list" role="list" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="mwen-skel-row" aria-hidden="true" />
      ))}
    </div>
  );

  const renderError = (errKey) => (
    <EmptyState
      icon="fa-circle-exclamation"
      title={t.mwen_load_error || 'Could not load'}
      hint={err[errKey]}
      ctaLabel={t.common_retry || 'Retry'}
      onCta={loadAll}
    />
  );

  // ─── Section renderers ──────────────────────────────────────────────
  function renderSavedTalents() {
    if (isLoading.saved_talents) {return renderSkeleton(3);}
    if (err.saved_talents) {return renderError('saved_talents');}
    if (counts.saved_talents === 0) {
      return (
        <EmptyState
          icon="fa-bookmark"
          title={t.mwen_no_saved_talents || (t2(lang, { ht: 'Ou pa gen talan anrejistre', en: 'No saved talents yet' }))}
          hint={t.mwen_no_saved_talents_hint || (t2(lang, { ht: 'Klike sou 📋 sou yon talan pou sove l.', en: 'Tap the bookmark on a talent to save it.' }))}
          ctaLabel={t.mwen_explore_cta || (t2(lang, { ht: 'Ale nan Explore', en: 'Explore talents' }))}
          onCta={onOpenExplore}
        />
      );
    }
    return (
      <div className="mwen-row-list" role="list">
        {savedTalents.map((save) => {
          const props = buildSavedTalentRow(save);
          return <MwenEntityRow key={props.key} {...props} t={t} />;
        })}
      </div>
    );
  }

  function renderSavedItems() {
    if (isLoading.saved_items) {return renderSkeleton(3);}
    if (err.saved_items) {return renderError('saved_items');}
    if (counts.saved_items === 0) {
      return (
        <EmptyState
          icon="fa-heart"
          title={t.mwen_no_saved_items || (t2(lang, { ht: 'Ou poko gen Saves', en: 'No saved items yet' }))}
          hint={t.mwen_no_saved_items_hint || (t2(lang, { ht: 'Klike sou ❤️ sou yon pwodwi, travay, evènman, pòtfolyo, spotlight oswa kou pou sove l.', en: 'Tap the heart on a product, job, event, portfolio, spotlight or course to save it.' }))}
          ctaLabel={t.mwen_explore_cta || (t2(lang, { ht: 'Ale nan Explore', en: 'Explore' }))}
          onCta={onOpenExplore}
        />
      );
    }
    return (
      <div className="mwen-row-list" role="list">
        {savedItems.map((save) => {
          const props = buildSavedItemRow(save);
          return <MwenEntityRow key={props.key} {...props} t={t} />;
        })}
      </div>
    );
  }

  function renderSavedMusic() {
    if (isLoading.saved_music) {return renderSkeleton(3);}
    if (err.saved_music) {return renderError('saved_music');}
    if (counts.saved_music === 0) {
      return (
        <EmptyState
          icon="fa-bookmark"
          title={t.mwen_no_saved_music || (t2(lang, { ht: 'Ou pa gen mizik anrejistre', en: 'No saved music yet' }))}
          hint={t.mwen_no_saved_music_hint || (t2(lang, { ht: 'Klike sou 📋 sou yon mizik pou sove l.', en: 'Tap the bookmark on a track to save it.' }))}
          ctaLabel={t.mwen_explore_cta || (t2(lang, { ht: 'Ale nan Explore', en: 'Explore music' }))}
          onCta={onOpenExplore}
        />
      );
    }
    return (
      <div className="mwen-row-list" role="list">
        {savedMusic.map((save) => {
          const props = buildSavedMusicRow(save);
          return <MwenEntityRow key={props.key} {...props} t={t} />;
        })}
      </div>
    );
  }

  function renderRecent() {
    if (isLoading.recent) {return renderSkeleton(4);}
    if (err.recent) {return renderError('recent');}
    if (counts.recent === 0) {
      return (
        <EmptyState
          icon="fa-clock-rotate-left"
          title={t.mwen_no_recent || (t2(lang, { ht: 'Pa gen aktivite resan', en: 'No recent activity yet' }))}
          hint={t.mwen_no_recent_hint || (t2(lang, { ht: 'Ouvri yon talan oswa yon mizik pou wè l isit la.', en: 'Open a talent or a track to see it here.' }))}
          ctaLabel={t.mwen_explore_cta || (t2(lang, { ht: 'Ale nan Explore', en: 'Explore' }))}
          onCta={onOpenExplore}
        />
      );
    }
    return (
      <div className="mwen-row-list" role="list">
        {recent.map((recentEntry) => {
          const props = buildRecentRow(recentEntry);
          return <MwenEntityRow key={props.key} {...props} t={t} />;
        })}
      </div>
    );
  }

  function renderActiveSection() {
    switch (section) {
      case 'saved_music': return renderSavedMusic();
      case 'saved_items': return renderSavedItems();
      case 'recent':      return renderRecent();
      case 'activity':    return <ActivityTimeline lang={lang} userId={user?.id} t={t} />;
      case 'saved_talents':
      default:            return renderSavedTalents();
    }
  }

  // ─── Section labels (i18n) ──────────────────────────────────────────
  const sectionLabels = {
    saved_talents: t.mwen_section_saved_talents || (t2(lang, { ht: 'Talan Saved', en: 'Saved Talents' })),
    saved_music:   t.mwen_section_saved_music   || (lang === 'ht' ? 'Mizik Saved'   : 'Saved Music'),
    saved_items:   t.mwen_section_saved_items   || (lang === 'ht' ? 'Saves'          : 'Saves'),
    recent:        t.mwen_section_recent        || (lang === 'ht' ? 'Dènye Aksyon'  : 'Recent'),
    activity:      t.activity_feed_tab          || (lang === 'ht' ? 'Aktivite'       : 'Activity'),
  };

  // ─── Quick-nav cards — data-driven, role-gated ───────────────────
  // Each card declares its icon, labels, destination and an optional
  // ``when`` predicate. Rendering is a single filter+map; adding a card
  // is a one-object change instead of ~8 lines of JSX + a wrapper <div>.
  const quickNavCards = [
    // Phase Business — the Business Profile entry point (separate
    // identity from the Creator branch). Shown to EVERY signed-in
    // account (no creator gate): the hub itself renders the create
    // CTA for first-time visitors and the profile list for owners.
    {
      id: 'business',
      icon: 'fa-store',
      title: t.business_hub_title || (t2(lang, { ht: 'Biznis mwen', en: 'My Businesses' })),
      hint: t.business_hub_hint || (t2(lang, { ht: 'Jere brand, biznis, oswa òganizasyon ou — separe de pwofil kreatè ou.', en: 'Manage your brand, business, or organization — separate from your Creator Profile.' })),
      to: SHEETS.BUSINESS,
      gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
      testId: 'mwen-business-card',
    },
    // Phase Business — customer-side order tracker. Shown to every
    // signed-in account: anyone can be a customer of a business.
    {
      id: 'my-orders',
      icon: 'fa-receipt',
      title: t.business_my_orders_title || (t2(lang, { ht: 'Kòmand mwen', en: 'My Orders' })),
      hint: t.business_my_orders_hint || (lang === 'ht'
        ? 'Swiv kòmand ou yo ak peman Wallet ou.'
        : 'Track your orders and wallet payments.'),
      to: SHEETS.BUSINESS_MY_ORDERS,
      gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
      testId: 'mwen-my-orders-card',
    },
    // Universal DM inbox — shown to EVERY signed-in account (creator or
    // not): a non-creator who messaged a creator reads the reply here.
    {
      id: 'messages',
      icon: 'fa-envelope',
      title: t.mwen_messages_title || (t2(lang, { ht: 'Mesaj mwen', en: 'My Messages' })),
      hint: t.mwen_messages_hint || (lang === 'ht'
        ? 'Konvèsasyon ou ak kreyatè, kliyan, etidyan yo.'
        : 'Your conversations with creators, clients, and students.'),
      to: SHEETS.MESSAGES,
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      testId: 'mwen-messages-card',
    },
    {
      id: 'studio',
      icon: 'fa-crown',
      title: t.mwen_studio || 'Creator Studio',
      hint: t.mwen_studio_hint || (t2(lang, { ht: 'Jere kou, mizik, pwodwi ou — tout nan yon sèl kote.', en: 'Manage courses, music, products — all in one place.' })),
      to: SHEETS.STUDIO,
      gradient: 'linear-gradient(135deg, #d81b60, #c2185b)',
      when: (u) => u?.is_creator,
      testId: 'mwen-studio-card',
    },
    {
      id: 'analytics',
      icon: 'fa-chart-pie',
      title: t.mwen_analytics || (t2(lang, { ht: 'Analitik Kreyatè', en: 'Creator Analytics' })),
      hint: t.mwen_analytics_hint || (t2(lang, { ht: 'Revni, angajman, ak kwasans ou.', en: 'Revenue, engagement, and growth.' })),
      to: SHEETS.ANALYTICS,
      gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      // Creator-only: the sheet is the creator revenue/engagement
      // dashboard — a non-creator has no data there (previously this
      // was ``!is_creator``, presenting the dashboard to everyone else).
      when: (u) => u?.is_creator,
      testId: 'mwen-creator-analytics-card',
    },
    {
      id: 'referral',
      icon: 'fa-share-nodes',
      title: t.mwen_referral || (t2(lang, { ht: 'Referral', en: 'Referral' })),
      hint: t.mwen_referral_hint || (t2(lang, { ht: 'Envite zanmi epi touche kominisyon.', en: 'Invite friends and earn commissions.' })),
      to: SHEETS.REFERRAL,
      gradient: 'linear-gradient(135deg, #2ecc71, #27ae60)',
      // Affiliates only — the "earn commissions" copy must never
      // present a normal user as if they already run an affiliate
      // program (product decision; the /sheet/referral route stays
      // reachable for everyone, this card is just not shown).
      when: (u) => u?.is_affiliate,
      testId: 'mwen-referral-card',
    },
    {
      id: 'discover',
      icon: 'fa-compass',
      title: t2(lang, { ht: 'Dekouvri Pwogram', en: 'Discover Programs' }),
      hint: t2(lang, { ht: 'Parcou ak aplike nan pwogram afilyasyon kreyatè yo.', en: 'Browse and apply to creator affiliate programs.' }),
      to: '/affiliate/discover',
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      // The "Vin Affiliate" invitation — shown to users who are NOT
      // active affiliates and have something to apply for: normal
      // users (never applied) and rejected applicants (can re-apply).
      // Hidden for creators (their own affiliate entry point lives on
      // their public profile, not Paj Mwen), pending applicants (they
      // already applied — see the status card), suspended accounts
      // (resolve first) and active affiliates (they have the dashboard).
      when: (u) => {
        if (u?.is_creator || u?.is_affiliate) {return false;}
        const s = getAffiliateState(u);
        return s === 'none' || s === 'rejected';
      },
      testId: 'mwen-discover-card',
    },
    {
      id: 'affiliate',
      icon: 'fa-handshake',
      title: t2(lang, { ht: 'Afilyasyon', en: 'Affiliate' }),
      hint: t2(lang, { ht: 'Pwomouje kontni epi touche komisyon.', en: 'Promote content and earn commissions.' }),
      to: '/affiliate',
      gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      when: (u) => u?.is_affiliate,
      testId: 'mwen-affiliate-card',
    },
    // Affiliate application status card — rendered for users who have
    // an application on file (or a suspended account) but are NOT
    // active affiliates. Informational only: no fake "Affiliate
    // dashboard", just the user's real state. Gated on the three
    // known states so an anomalous 'approved' (approved application
    // without an active profile) can never fall through to the
    // "Rejected" copy.
    ...(['pending', 'suspended', 'rejected'].includes(affiliateState) ? [{
      id: 'affiliate-status',
      status: affiliateState, // 'pending' | 'suspended' | 'rejected'
      icon: affiliateState === 'pending'
        ? 'fa-hourglass-half'
        : affiliateState === 'suspended'
          ? 'fa-pause-circle'
          : 'fa-circle-xmark',
      title: affiliateState === 'pending'
        ? (t2(lang, { ht: 'Demann Affiliate', en: 'Affiliate Application' }))
        : affiliateState === 'suspended'
          ? (t2(lang, { ht: 'Kont Afilye Sispann', en: 'Affiliate Suspended' }))
          : (t2(lang, { ht: 'Aplikasyon Rejte', en: 'Application Rejected' })),
      hint: affiliateState === 'pending'
        ? (lang === 'ht'
          ? 'Demann Affiliate ou ap tann verifikasyon. Nou pral enfòme ou lè yo revize l.'
          : 'Your affiliate application is pending review. We will notify you once it is reviewed.')
        : affiliateState === 'suspended'
          ? (lang === 'ht'
            ? 'Kont Afilye ou sispann. Kontakte sipò pou rezoud pwoblèm nan.'
            : 'Your affiliate account is suspended. Contact support to resolve this.')
          : (lang === 'ht'
            ? 'Aplikasyon ou te rejte. Ou ka aplike nan lòt pwogram kreyatè yo.'
            : 'Your application was rejected. You can apply to other creator programs.'),
      gradient: affiliateState === 'pending'
        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
        : affiliateState === 'suspended'
          ? 'linear-gradient(135deg, #ef4444, #dc2626)'
          : 'linear-gradient(135deg, #64748b, #475569)',
      testId: 'mwen-affiliate-status-card',
    }] : []),
    {
      id: 'security',
      icon: 'fa-shield-halved',
      title: t2(lang, { ht: 'Sekirite Kont', en: 'Account Security' }),
      hint: t2(lang, { ht: 'Aktive de fakèy pou pi plis pwoteksyon kont ou.', en: 'Enable two-factor auth for extra account protection.' }),
      to: SHEETS.SETTINGS,
      gradient: 'linear-gradient(135deg, #d81b60, #c2185b)',
      testId: 'mwen-security-card',
    },
    {
      id: 'admin-dashboard',
      icon: 'fa-gauge-high',
      title: 'Admin Dashboard',
      hint: t2(lang, { ht: 'Estistik, koleksyon Kreyatè, health checks.', en: 'System stats, Creator queue, health checks.' }),
      to: SHEETS.ADMIN_DASHBOARD,
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      when: (u) => u?.is_staff || u?.is_superuser,
      testId: 'mwen-admin-dashboard-card',
    },
    {
      id: 'creator-review',
      icon: 'fa-users-gear',
      title: t2(lang, { ht: 'Review Kreyatè', en: 'Creator Review' }),
      hint: t2(lang, { ht: 'Apwouve oswa rejte aplikasyon Kreyatè yo.', en: 'Approve or reject creator applications.' }),
      to: SHEETS.ADMIN_CREATORS,
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      when: (u) => u?.is_staff || u?.is_superuser,
      testId: 'mwen-creator-review-card',
    },
  ];

  return (
    <div className="mwen-page">
      {/* Hero */}
      <div className="mwen-hero">
        {/* Avatar + username card */}
        <div className="mwen-hero-profile">
          <div className="mwen-hero-avatar">
            {mwenAvatarUrl ? (
              <img className="mwen-hero-avatar-img" src={mwenAvatarUrl} alt={displayName}
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = displayName?.charAt(0).toUpperCase() || '?'; }}
              />
            ) : (
              displayName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          <div className="mwen-hero-info">
            <h2 className="mwen-hero-title">{t.mwen_title || (t2(lang, { ht: 'Mwen', en: 'Mine' }))}</h2>
            {/* The @handle is the username — the display name may be a
                Google name (with spaces), never the handle. */}
            <span className="mwen-hero-username">@{identity.creatorLookupKey || identity.username || displayName}</span>
            {displayTag && (
              <div className="mwen-hero-subtag">{displayTag}</div>
            )}
            {/* Phase — Premium subscription chip: plan + expiry from
                /api/me/ (UserSerializer.premium). Only for ACTIVE
                subscriptions — cancelled/expired rows read is_premium
                False and fall through to the normal hero. */}
            {user?.premium?.is_premium && (
              <div className="mwen-premium-chip" title={
                user.premium.expires_at && user.premium.plan !== 'lifetime'
                  ? (lang === 'ht'
                      ? `Premium — ekspirasyon ${fmtDate(user.premium.expires_at)}`
                      : `Premium — expires ${fmtDate(user.premium.expires_at)}`)
                  : (t2(lang, { ht: 'Premium — pou tout vi', en: 'Premium — for life' }))
              }>
                <i className="fas fa-crown" aria-hidden="true" />
                <span className="mwen-premium-chip-label">Premium</span>
                {user.premium.plan && user.premium.plan !== 'lifetime' && (
                  <span className="mwen-premium-chip-plan">
                    {premiumPlanLabel(user.premium.plan, lang)}
                  </span>
                )}
                {user.premium.expires_at && user.premium.plan !== 'lifetime' && (
                  <span className="mwen-premium-chip-exp">
                    {t2(lang, { ht: 'jiska', en: 'until' })}{' '}
                    {fmtDate(user.premium.expires_at)}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="mwen-edit-btn"
            onClick={() => startTransition(() => navigate(SHEETS.SETTINGS))}
            aria-label={t.mwen_edit_profile || (t2(lang, { ht: 'Modifye pwofil', en: 'Edit profile' }))}
            title={t.mwen_edit_profile || (t2(lang, { ht: 'Modifye pwofil', en: 'Edit profile' }))}
          >
            <i className="fas fa-pen" aria-hidden="true" />
          </button>
        </div>
        <p className="mwen-hero-desc">
          {t.mwen_desc || (t2(lang, { ht: 'Talan ou yo, mizik ou yo, ak dènye aktivite.', en: 'Your saved talents, music, and recent activity.' }))}
        </p>
      </div>

      <div className="mwen-nav-grid">
        {quickNavCards
          .filter((card) => (card.when ? card.when(user) : true))
          .map((card) => (
            <QuickNavCard
              key={card.id}
              icon={card.icon}
              title={card.title}
              hint={card.hint}
              onClick={() => { if (card.to) {startTransition(() => navigate(card.to));} }}
              gradient={card.gradient}
              testId={card.testId}
              status={card.status}
            />
          ))}
      </div>{/* /.mwen-nav-grid */}

      {/* Section tabs — wrapped so the right-edge fade affordance
          (CSS ::after on .mwen-section-tabs-wrap) can sit above the
          horizontally-scrolling bar without scrolling with it. The
          wrapper itself never scrolls; only the inner bar does. */}
      <div ref={tabsWrapRef} className={classNames('mwen-section-tabs-wrap', tabsOverflow && 'is-overflowing')}>
        <div className="mwen-section-tabs" role="tablist" aria-label={t.mwen_sections_aria || 'My sections'}>
          {SECTIONS.map((s) => (
            <button
              type="button"
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              className={classNames('mwen-section-tab', section === s.id && 'active')}
              onClick={() => setSection(s.id)}
            >
              <i className={`fas ${s.icon}`} aria-hidden="true" />
              <span className="mwen-section-tab-label">{sectionLabels[s.id]}</span>
              {counts[s.id] > 0 && <span className="mwen-section-tab-count">{counts[s.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Active section content */}
      <div className="mwen-section">
        <SectionHeader
          label={sectionLabels[section]}
          count={counts[section]}
        />
        {renderActiveSection()}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// QUICK NAV CARD — reusable gradient card for navigation links
// ═══════════════════════════════════════════════════════════════════════
function QuickNavCard({ icon, title, hint, onClick, gradient, testId, status }) {
  if (status) {
    // Informational status card — deliberately NOT a navigation control.
    // Rendered for pending/suspended/rejected affiliate states so the
    // user sees their real application state (readable status message,
    // role="status") instead of an active-looking Affiliate dashboard
    // or an empty hole where a card used to be.
    return (
      <div
        className="mwen-analytics-card mwen-status-card"
        role="status"
        data-testid={testId}
      >
        <div className="mwen-analytics-card-icon" style={{ background: gradient, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <i className={`fas ${icon}`} aria-hidden="true" />
        </div>
        <div className="mwen-analytics-card-body">
          <div className="mwen-analytics-card-title">{title}</div>
          <div className="mwen-analytics-card-hint">{hint}</div>
        </div>
        <span className={`mwen-status-badge mwen-status-badge--${status}`}>{status}</span>
      </div>
    );
  }
  return (
    <div
      className="mwen-analytics-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      data-testid={testId}
    >
      <div className="mwen-analytics-card-icon" style={{ background: gradient, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <i className={`fas ${icon}`} aria-hidden="true" />
      </div>
      <div className="mwen-analytics-card-body">
        <div className="mwen-analytics-card-title">{title}</div>
        <div className="mwen-analytics-card-hint">{hint}</div>
      </div>
      <i className="fas fa-chevron-right mwen-analytics-card-arrow" aria-hidden="true" />
    </div>
  );
}

export default Mwen;
