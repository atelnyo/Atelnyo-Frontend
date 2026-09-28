/**
 * src/modules/explore/cards/SpotlightCard.jsx
 *
 * Creator Spotlight card — redesigned with premium visual hierarchy.
 * Shows user avatar in a gradient hero area, category pill,
 * glowing badge, title, description, author info, and external link.
 *
 * Accepts an optional ``onOpen`` prop (same pattern as CourseCard)
 * for interaction logging + navigation. Falls back to internal
 * navigation when ``onOpen`` is absent.
 */
import React, { useState, useMemo } from 'react';
import useSafeNavigate from '../../../hooks/useSafeNavigate';
import { buildContentUrl } from '../../../utils/contentUrl';
import SaveCountChip from './SaveCountChip';

const CATEGORY_CFG = {
  talent:   { bg: 'linear-gradient(135deg, #7c3aed22, #f59e0b18)', border: '#7c3aed44', pill: '#7c3aed', icon: 'fa-star' },
  commerce: { bg: 'linear-gradient(135deg, #05966922, #34d39918)', border: '#05966944', pill: '#059669', icon: 'fa-store' },
  course:   { bg: 'linear-gradient(135deg, #2563eb22, #60a5fa18)', border: '#2563eb44', pill: '#2563eb', icon: 'fa-graduation-cap' },
  other:    { bg: 'linear-gradient(135deg, #d81b6022, #f59e0b18)', border: '#d81b6044', pill: '#d81b60', icon: 'fa-lightbulb' },
};

// Resolves a raw category key to a localized label (same pattern as
// SpotlightDetail — inline here to avoid a cross-module dependency).
function resolveCategoryLabel(cat, t, lang) {
  const FALLBACK = {
    ht: { talent: 'Talan', commerce: 'Mache', course: 'Kou', other: 'Lòt' },
    fr: { talent: 'Talent', commerce: 'Marché', course: 'Cours', other: 'Autre' },
    es: { talent: 'Talento', commerce: 'Mercado', course: 'Curso', other: 'Otro' },
    en: { talent: 'Talent', commerce: 'Commerce', course: 'Course', other: 'Other' },
  };
  const dynamic =
    (cat === 'talent' && t?.explore_spotlight_cat_talent)
    || (cat === 'commerce' && t?.explore_spotlight_cat_commerce)
    || (cat === 'course' && t?.explore_spotlight_cat_course)
    || (cat === 'other' && t?.explore_spotlight_cat_other);
  if (typeof dynamic === 'string' && dynamic.length > 0) return dynamic;
  const fb = FALLBACK[lang] || FALLBACK.en;
  return fb[cat] || fb.other;
}

export default function SpotlightCard({ item, t, lang, onOpen, saveCount = null }) {
  const navigate = useSafeNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  const catKey = item.category || 'other';
  const cfg = CATEGORY_CFG[catKey] || CATEGORY_CFG.other;
  const title = item.invention_title || '';
  const desc = item.invention_description || '';
  const username = item.username || '';
  const displayName = item.display_name || username;
  const initial = (username.charAt(0) || '?').toUpperCase();

  // Real avatar priority: public profile avatar > cover_image > generated SVG > ui-avatars
  const avatarUrl = useMemo(() => {
    // 1. Real user avatar from public profile
    if (item.avatar_url && !imgFailed) return item.avatar_url;
    // 2. Uploaded cover image
    if (item.image_url && !imgFailed) return item.image_url;
    // 3. Fallback to ui-avatars.com (shows initials nicely)
    if (username) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=f59e0b&color=fff&size=256&font-size=0.45&bold=true`;
    }
    return '';
  }, [item.avatar_url, item.image_url, username, imgFailed]);

  const goToDetail = () => {
    if (!item?.id) return;
    // Canonical /{id}@{user}/spotlight deep-link.
    navigate(buildContentUrl('spotlight', item));
  };

  const handleClick = () => {
    if (onOpen) {
      onOpen(item);
    } else {
      goToDetail();
    }
  };

  return (
    <div
      className="explore-card explore-card-spotlight"
      data-category={catKey}
      data-testid="spotlight-card"
      data-spotlight-id={item.id}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      style={
        {
          '--spotlight-border': cfg.border,
          '--spotlight-pill': cfg.pill,
          '--spotlight-bg': cfg.bg,
        }
      }
    >
      {/* ─── Hero area: gradient + avatar ───────────────────── */}
      <div className="spotlight-hero-wrap" style={{ background: cfg.bg }}>
        {/* Shine overlay */}
        <div className="spotlight-hero-shine" aria-hidden="true" />

        {/* Avatar */}
        {avatarUrl && !imgFailed ? (
          <img
            className="spotlight-avatar"
            src={avatarUrl}
            alt={username}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="spotlight-avatar-fallback" style={{ background: `linear-gradient(135deg, ${cfg.pill}, ${cfg.icon === 'fa-star' ? '#f97316' : cfg.pill})` }}>
            <span className="spotlight-avatar-initial">{initial}</span>
          </div>
        )}

        {/* Category pill */}
        <span className="spotlight-category-pill" style={{ background: `${cfg.pill}22`, color: cfg.pill, borderColor: `${cfg.pill}44` }}>
          <i className={`fas ${cfg.icon}`} aria-hidden="true" />
          {resolveCategoryLabel(catKey, t, lang)}
        </span>

        {/* Badge */}
        <div
          className="spotlight-badge"
          title={t.explore_spotlight || 'Spotlight'}
          aria-label={t.explore_spotlight || 'Spotlight'}
          style={{ background: `linear-gradient(135deg, ${cfg.pill}, ${cfg.pill}cc)` }}
        >
          <i className="fas fa-sparkles" aria-hidden="true" />
          <span>{t.explore_spotlight || 'Spotlight'}</span>
        </div>
      </div>

      {/* ─── Card body ──────────────────────────────────────── */}
      <div className="spotlight-card-body">
        {/* Title */}
        <div className="spotlight-card-title" title={title}>
          {title || (lang === 'ht' ? 'Envansyon' : 'Invention')}
        </div>

        {/* Description */}
        {desc && (
          <p className="spotlight-card-desc">
            {desc.slice(0, 120)}{desc.length > 120 ? '…' : ''}
          </p>
        )}

        {/* Author + external link row */}
        <div className="spotlight-card-footer">
          {username ? (
            <span className="spotlight-author">
              <span className="spotlight-author-avatar-mini" style={{ background: `linear-gradient(135deg, ${cfg.pill}, ${cfg.pill}cc)` }}>
                {initial}
              </span>
              <span className="spotlight-author-name">{displayName || `@${username}`}</span>
            </span>
          ) : (
            <span />
          )}
          <SaveCountChip count={saveCount} t={t} />
          <span className="spotlight-card-actions">
            {item.link_url && (
              <a
                href={item.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="spotlight-ext-link"
                aria-label={t.explore_open_external || 'Open external'}
                onClick={(e) => e.stopPropagation()}
                title={t.explore_open_external || 'Open external'}
                style={{ color: cfg.pill }}
              >
                <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
              </a>
            )}
            <span className="spotlight-card-arrow" style={{ color: cfg.pill }}>
              <i className="fas fa-arrow-right" aria-hidden="true" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
