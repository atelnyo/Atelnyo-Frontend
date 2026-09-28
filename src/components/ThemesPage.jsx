/**
 * src/components/ThemesPage.jsx
 *
 * Theme Library — browse published themes from the backend Theme Engine
 * (/api/themes/) and apply one with a single tap.
 *
 * Apply flow:
 *   1. Fetch the theme detail (token_overrides + category).
 *   2. Map category → ThemeContext mode (dark/amoled/glass/...).
 *   3. Derive the accent hex from token_overrides.
 *   4. Call ThemeContext.applyThemeBySlug → persists the slug in
 *      localStorage so the choice survives reloads (ThemeProvider
 *      re-applies it at boot), sets the mode + accent live, and
 *      records the active slug for the "Active" badge.
 *
 * Empty / error states are fully translated via the translations
 * object (themes_* keys), with inline fallbacks so the page never
 * blanks out on a partial i18n flush.
 */
import React, { useEffect, useState } from 'react';
import SEOHead from './shared/SEOHead';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { themeService } from '../services/themeApi';
import { useTheme } from '../context/ThemeContext';

// ─── Category → label key (falls back to raw category name) ─────────────
const CATEGORY_LABEL_KEY = {
  light: 'themes_cat_light',
  dark: 'themes_cat_dark',
  amoled: 'themes_cat_amoled',
  glass: 'themes_cat_glass',
  cyber: 'themes_cat_cyber',
  minimal: 'themes_cat_minimal',
  professional: 'themes_cat_professional',
  enterprise: 'themes_cat_enterprise',
  custom: 'themes_cat_custom',
};

/** Fallback accent per category (used when a theme has no token_overrides). */
const CATEGORY_ACCENT = {
  light: '#d81b60',
  dark: '#f06292',
  amoled: '#00acc1',
  glass: '#8e24aa',
  cyber: '#00e5ff',
  minimal: '#43a047',
  professional: '#6366f1',
  enterprise: '#d81b60',
  custom: '#d81b60',
};

// ─── Styles ─────────────────────────────────────────────────────────────
const s = {
  shell: {
    maxWidth: '980px',
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
  },
  header: {
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 800,
    margin: '0 0 0.5rem',
    color: 'var(--text-main, #1a1a1a)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  subtitle: {
    color: 'var(--text-secondary, #666)',
    fontSize: '0.95rem',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
    cursor: 'pointer',
  },
  preview: {
    height: '110px',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '12px',
  },
  previewBadge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'rgba(0,0,0,0.45)',
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: '20px',
    backdropFilter: 'blur(4px)',
  },
  body: {
    padding: '14px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  name: {
    fontSize: '1.05rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text-main, #1a1a1a)',
  },
  category: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    alignSelf: 'flex-start',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--pink-primary, #d81b60)',
    background: 'var(--surface-highlight, rgba(216,27,96,0.08))',
    padding: '3px 10px',
    borderRadius: '20px',
  },
  desc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary, #666)',
    margin: 0,
    lineHeight: 1.45,
    flex: 1,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  tag: {
    fontSize: '0.68rem',
    color: 'var(--text-secondary, #666)',
    background: 'var(--surface-highlight-md, rgba(0,0,0,0.05))',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginTop: '4px',
  },
  applyBtn: {
    background: 'linear-gradient(135deg, var(--pink-primary, #d81b60), var(--cp-primary, #d81b60))',
    color: '#fff',
    border: 'none',
    borderRadius: '50px',
    padding: '9px 20px',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
    boxShadow: 'var(--btn-primary-shadow, 0 2px 8px rgba(216,27,96,0.3))',
  },
  activeBtn: {
    background: 'var(--surface-highlight, rgba(216,27,96,0.1))',
    color: 'var(--pink-primary, #d81b60)',
    boxShadow: 'none',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '50px',
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-secondary, #666)',
    cursor: 'pointer',
    marginTop: '1.5rem',
    transition: 'border-color 0.2s ease, color 0.2s ease',
  },
  center: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: 'var(--text-secondary, #666)',
  },
  retryBtn: {
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    border: 'none',
    borderRadius: '50px',
    padding: '10px 24px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '1rem',
  },
};

const ThemesPage = ({ lang = 'ht', translations, showToast }) => {
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || {};
  const {
    activeThemeSlug,
    applyThemeBySlug,
  } = useTheme();

  const [themes, setThemes] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [applying, setApplying] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const L = (key, fallback) => t[key] || fallback;

  // ─── Load the published theme list + their details ───────────────
  useEffect(() => {
    let cancelled = false;
    async function loadThemes() {
      setLoading(true);
      setError(false);
      try {
        const res = await themeService.list();
        if (cancelled) { return; }
        const data = res?.data;
        const items = Array.isArray(data) ? data : (data?.results ?? []);
        setThemes(items);

        // Fetch details in parallel so each card can render its real
        // token-based preview (list payload stays lightweight).
        const settled = await Promise.allSettled(
          items.map((th) => themeService.getBySlug(th.slug)),
        );
        if (cancelled) { return; }
        const detailMap = {};
        settled.forEach((outcome, i) => {
          if (outcome.status === 'fulfilled') {
            const d = outcome.value?.data ?? outcome.value;
            if (d?.slug) detailMap[d.slug] = d;
            else if (items[i]?.slug) detailMap[items[i].slug] = d;
          }
        });
        setDetails(detailMap);
      } catch {
        if (!cancelled) { setError(true); }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    }
    loadThemes();
    return () => { cancelled = true; };
  }, [retryKey]);

  // ─── Preview accent for a theme ──────────────────────────────────
  const themeAccent = (th) => {
    const detail = details[th.slug];
    const overrides = detail?.token_overrides || {};
    return (
      overrides['--pink-primary'] ||
      overrides['--color-primary'] ||
      CATEGORY_ACCENT[th.category] ||
      '#d81b60'
    );
  };

  const isDarkCategory = (th) =>
    ['dark', 'amoled', 'cyber', 'enterprise'].includes(th.category);

  const categoryLabel = (th) =>
    L(CATEGORY_LABEL_KEY[th.category], th.category);

  // ─── Apply ────────────────────────────────────────────────────────
  const handleApply = async (th) => {
    if (applying) return;
    setApplying(th.slug);
    try {
      await applyThemeBySlug(th.slug);
      if (showToast) showToast(L('themes_applied', 'Theme applied!'));
    } catch (_err) {
      if (showToast) showToast(L('themes_apply_error', 'Could not apply this theme.'));
    } finally {
      setApplying(null);
    }
  };

  const isActive = (th) => activeThemeSlug === th.slug;

  // ─── States ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.shell}>
        <div style={s.center}>
          <i className="fas fa-palette fa-spin" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--pink-primary, #d81b60)' }} />
          <p>{L('themes_loading', 'Loading themes...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.shell}>
        <div style={s.center}>
          <i className="fas fa-triangle-exclamation" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--pink-primary, #d81b60)' }} />
          <p>{L('themes_error', 'Could not load themes.')}</p>
          <button style={s.retryBtn} onClick={() => setRetryKey((k) => k + 1)}>{L('themes_retry', 'Retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.shell}>
      <SEOHead
        title="Themes"
        description="Browse and apply themes to customize the look and feel of Atelnyo."
        url="https://atelnyo.site/themes"
        robots="noindex"
        lang={lang}
      />
      <header style={s.header}>
        <h1 style={s.title}>
          <i className="fas fa-palette" style={{ color: 'var(--pink-primary, #d81b60)' }} />
          {L('themes_page_title', 'Atelnyo Themes')}
        </h1>
        <p style={s.subtitle}>{L('themes_page_subtitle', 'Pick the theme that fits you best — the app updates instantly.')}</p>
      </header>

      {themes.length === 0 ? (
        <div style={s.center}>
          <i className="fas fa-sparkles" style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--pink-primary, #d81b60)' }} />
          <p>{L('themes_empty', 'No themes available yet.')}</p>
        </div>
      ) : (
        <div style={s.grid}>
          {themes.map((th) => {
            const accent = themeAccent(th);
            const active = isActive(th);
            const darkCat = isDarkCategory(th);
            const busy = applying === th.slug;
            return (
              <article
                key={th.slug}
                style={{
                  ...s.card,
                  ...(active ? { borderColor: 'var(--pink-primary, #d81b60)', boxShadow: 'var(--shadow-primary, 0 4px 12px rgba(216,27,96,0.25))' } : {}),
                }}
                aria-label={`${th.name} — ${categoryLabel(th)}`}
              >
                <div
                  style={{
                    ...s.preview,
                    background: darkCat
                      ? `linear-gradient(135deg, #14141f 0%, ${accent}cc 100%)`
                      : `linear-gradient(135deg, ${accent}22 0%, ${accent}99 100%)`,
                  }}
                >
                  {active && (
                    <span style={s.previewBadge}>
                      <i className="fas fa-check" style={{ marginRight: '4px' }} />
                      {L('themes_active', 'Active')}
                    </span>
                  )}
                  {th.is_default && (
                    <span style={{ ...s.previewBadge, right: active ? 'auto' : '10px', left: active ? '10px' : 'auto' }}>
                      <i className="fas fa-star" style={{ marginRight: '4px' }} />
                      Default
                    </span>
                  )}
                  {/* Mini color swatches derived from the real accent */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
                    {[accent, `${accent}b3`, `${accent}66`].map((c, i) => (
                      <span key={i} style={{ width: '22px', height: '22px', borderRadius: '8px', background: c, border: '2px solid rgba(255,255,255,0.35)' }} />
                    ))}
                  </div>
                </div>

                <div style={s.body}>
                  <h3 style={s.name}>{th.name}</h3>
                  <span style={s.category}>
                    <i className="fas fa-tag" style={{ fontSize: '0.62rem' }} />
                    {categoryLabel(th)}
                  </span>
                  {th.description && <p style={s.desc}>{th.description}</p>}
                  {Array.isArray(th.tags) && th.tags.length > 0 && (
                    <div style={s.tags}>
                      {th.tags.slice(0, 3).map((tag) => (
                        <span key={tag} style={s.tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div style={s.footer}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #666)' }}>
                      <i className="fas fa-circle" style={{ color: accent, marginRight: '4px', fontSize: '0.6rem' }} />
                      {accent}
                    </span>
                    <button
                      style={{ ...s.applyBtn, ...(active ? s.activeBtn : {}), ...(busy ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                      onClick={(e) => { e.stopPropagation(); handleApply(th); }}
                      disabled={busy}
                    >
                      {busy ? (
                        <i className="fas fa-spinner fa-spin" />
                      ) : active ? (
                        <span><i className="fas fa-check" style={{ marginRight: '5px' }} />{L('themes_active', 'Active')}</span>
                      ) : (
                        <span><i className="fas fa-brush" style={{ marginRight: '5px' }} />{L('themes_apply', 'Apply')}</span>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <button style={s.backBtn} onClick={() => navigate('/')}>
        <i className="fas fa-arrow-left" />
        {L('themes_back', 'Back')}
      </button>
    </div>
  );
};

export default ThemesPage;
