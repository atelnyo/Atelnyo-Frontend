/**
 * src/context/ThemeContext.jsx — Enterprise Theme Context + Provider
 *
 * Phase 3: Build-time + runtime theme engine. Consumes the CSS
 * token system v2.0 (tokens.css) and injects dynamic overrides
 * onto :root at runtime, driven by:
 *   1. localStorage preference (atelnyo_theme_mode)
 *   2. Backend Theme API (future — /api/themes/active/)
 *   3. System prefers-color-scheme media query
 *
 * EXPORTS:
 *   ThemeProvider   — wraps the app tree, injects CSS variables
 *   useTheme        — hook for components to read/switch themes
 *
 * USAGE:
 *   import { ThemeProvider } from '../context/ThemeContext';
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 *
 *   const { mode, setMode, isDark, token } = useTheme();
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { themeService } from '../services/themeApi';

// ─── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY_MODE = 'atelnyo_theme_mode';
const STORAGE_KEY_COLOR = 'atelnyo_theme_color';
const STORAGE_KEY_FONT = 'atelnyo_fontsize';
// Persisted when the user applies a backend theme from the Themes page
// (ThemesPage.jsx). On next boot the provider re-fetches the theme and
// re-applies mode + accent + token overrides.
const STORAGE_KEY_THEME_SLUG = 'atelnyo_theme_slug';

/** All supported theme modes. */
export const THEME_MODES = [
  { id: 'system',   label: 'System',   icon: 'fa-laptop' },
  { id: 'light',    label: 'Light',    icon: 'fa-sun' },
  { id: 'dark',     label: 'Dark',     icon: 'fa-moon' },
  { id: 'amoled',   label: 'AMOLED',   icon: 'fa-mobile-screen' },
  { id: 'glass',    label: 'Glass',    icon: 'fa-glass-water' },
  { id: 'cyber',    label: 'Cyber',    icon: 'fa-bolt' },
  { id: 'minimal',  label: 'Minimal',  icon: 'fa-minus' },
  { id: 'professional', label: 'Pro',  icon: 'fa-briefcase' },
  { id: 'enterprise',   label: 'Enterprise', icon: 'fa-building' },
];

/** Map mode → body class */
const MODE_BODY_CLASS = {
  system:   '',
  light:    '',
  dark:     'dark-mode',
  amoled:   'dark-mode theme-amoled',
  glass:    'theme-glass',
  cyber:    'dark-mode theme-cyber',
  minimal:  'theme-minimal',
  professional: 'theme-professional',
  enterprise:   'dark-mode theme-enterprise',
};

/** Map backend Theme.category → ThemeContext mode. */
const CATEGORY_TO_MODE = {
  light: 'light',
  dark: 'dark',
  amoled: 'amoled',
  glass: 'glass',
  cyber: 'cyber',
  minimal: 'minimal',
  professional: 'professional',
  enterprise: 'enterprise',
  custom: 'system', // custom → respect the OS preference
};

/** Default accent color presets (user can pick from Settings) */
const ACCENT_PRESETS = [
  { id: 'rose',        hex: '#d81b60', rgb: '216, 27, 96' },
  { id: 'cyan',        hex: '#00acc1', rgb: '0, 172, 193' },
  { id: 'emerald',     hex: '#43a047', rgb: '67, 160, 71' },
  { id: 'violet',      hex: '#8e24aa', rgb: '142, 36, 170' },
  { id: 'amber',       hex: '#d97706', rgb: '217, 119, 6' },
  { id: 'indigo',      hex: '#6366f1', rgb: '99, 102, 241' },
];

// ─── Context ────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback for tests / non-wrapped renders
    return {
      mode: 'system',
      resolvedMode: 'light',
      accentColor: '#d81b60',
      accentRgb: '216, 27, 96',
      fontSize: 16,
      isDark: false,
      setMode: () => {},
      setAccentColor: () => {},
      setFontSize: () => {},
      isMode: () => false,
      token: (cssVar, fallback) => fallback || '',
      activeThemeSlug: null,
      applyThemeBySlug: async () => null,
    };
  }
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function resolveSystemMode() {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function getStoredMode() {
  try {
    return localStorage.getItem(STORAGE_KEY_MODE) || 'system';
  } catch {
    return 'system';
  }
}

function getStoredAccent() {
  try {
    return localStorage.getItem(STORAGE_KEY_COLOR) || '#d81b60';
  } catch {
    return '#d81b60';
  }
}

function getStoredFontSize() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY_FONT)) || 16;
  } catch {
    return 16;
  }
}

/**
 * Apply a mode's CSS classes to <body> and clean up any previous
 * mode classes so they don't pile up over switches.
 */
function applyBodyClasses(mode) {
  const allModeClasses = Object.values(MODE_BODY_CLASS)
    .flatMap((s) => s.split(' '))
    .filter(Boolean);

  // Remove ALL known mode classes from previous toggles
  document.body.classList.remove(...allModeClasses);
  // Also clear lingering dark-mode from system-detection (below)
  document.body.classList.remove('dark-mode');

  // Add the new mode's classes (if any)
  const classes = (MODE_BODY_CLASS[mode] || '').split(' ').filter(Boolean);
  if (classes.length > 0) {
    document.body.classList.add(...classes);
  }

  // ── System mode: sync body.dark-mode with OS preference ──
  // MODE_BODY_CLASS['system'] is '' (empty), so body gets no dark-mode
  // class even when the OS is dark. This means ALL dark-mode CSS in
  // tokens.css silently fails for users who leave the default.
  // Fix: manually add 'dark-mode' to body when OS is dark and the
  // user hasn't picked an explicit mode.
  if (mode === 'system') {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
      }
    } catch { /* ignore — matchMedia not available in extreme legacy */ }
  }
}

/**
 * Inject CSS custom property overrides directly onto :root
 * so components using var(--xxx) pick up theme changes in real-time.
 */
function applyAccentColor(hex) {
  const style = document.documentElement.style;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rgb = `${r}, ${g}, ${b}`;
  const hue = hueFromRgb(r, g, b);

  // Override the brand tokens on :root
  style.setProperty('--pr-color-rose-50',  `hsl(${hueFromRgb(r,g,b)}, 100%, 95%)`);
  style.setProperty('--pr-color-rose-500', hex);
  style.setProperty('--pr-color-rose-600', `hsl(${hueFromRgb(r,g,b)}, 80%, 35%)`);
  style.setProperty('--pr-color-rose-700', `hsl(${hueFromRgb(r,g,b)}, 90%, 25%)`);
  style.setProperty('--pink-primary', hex);
  style.setProperty('--dash-pink', hex);
  style.setProperty('--admin-pink', hex);
  style.setProperty('--studio-pink', hex);
  style.setProperty('--cp-primary', hex);
  style.setProperty('--surface-highlight', `rgba(${rgb}, 0.05)`);
  style.setProperty('--surface-highlight-md', `rgba(${rgb}, 0.1)`);
  style.setProperty('--surface-selected', `rgba(${rgb}, 0.08)`);
  style.setProperty('--border-color', `rgba(${rgb}, 0.1)`);
  style.setProperty('--border-color-strong', `rgba(${rgb}, 0.25)`);
  style.setProperty('--border-color-subtle', `rgba(${rgb}, 0.06)`);
  style.setProperty('--btn-primary-shadow', `0 2px 8px rgba(${rgb}, 0.3)`);
  style.setProperty('--shadow-primary', `0 4px 12px rgba(${rgb}, 0.25)`);
  style.setProperty('--shadow-primary-lg', `0 8px 32px rgba(${rgb}, 0.35)`);
  style.setProperty('--color-primary-gradient',
    `linear-gradient(135deg, ${hex}, hsl(${hueFromRgb(r,g,b)}, 70%, 60%))`);
}

/** Approximate hue from RGB for hsl generation */
function hueFromRgb(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 340; // default pink hue
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return Math.round(h);
}

// ─── Provider Component ──────────────────────────────────────────────────

export function ThemeProvider({ children }) {
  const [mode, setModeRaw] = useState(getStoredMode);
  const [accentColor, setAccentColorRaw] = useState(getStoredAccent);
  const [fontSize, setFontSizeRaw] = useState(getStoredFontSize);
  const [activeThemeSlug, setActiveThemeSlug] = useState(null);

  // Resolve "system" → actual light/dark
  const resolvedMode = useMemo(() => {
    if (mode === 'system') return resolveSystemMode();
    return mode;
  }, [mode]);

  const isDark = useMemo(() => {
    return ['dark', 'amoled', 'cyber', 'enterprise'].includes(resolvedMode);
  }, [resolvedMode]);

  // ── Apply body classes whenever mode changes ──
  useEffect(() => {
    applyBodyClasses(mode);
  }, [mode]);

  // ── Apply accent color CSS variables (side effect in useEffect) ──
  // React rule: DOM mutations belong in useEffect, not useMemo.
  // useMemo computes the RGB string; the effect applies it to :root.
  const accentRgb = useMemo(() => {
    const r = parseInt(accentColor.slice(1, 3), 16);
    const g = parseInt(accentColor.slice(3, 5), 16);
    const b = parseInt(accentColor.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }, [accentColor]);

  useEffect(() => {
    applyAccentColor(accentColor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor]);

  // ── Fetch active theme from backend on mount ──
  const [backendTheme, setBackendTheme] = useState(null);
  useEffect(() => {
    themeService.getActive()
      .then((res) => {
        const data = res?.data ?? res;
        if (data?.slug) setActiveThemeSlug(data.slug);
        if (data?.token_overrides && Object.keys(data.token_overrides).length > 0) {
          setBackendTheme(data);
          applyTokenOverrides(data.token_overrides);
        }
      })
      .catch(() => { /* backend unavailable — use localStorage/local defaults */ });
  }, []);

  /** Inject backend token_overrides onto :root. */
  function applyTokenOverrides(overrides) {
    const style = document.documentElement.style;
    for (const [key, value] of Object.entries(overrides)) {
      if (key.startsWith('--')) {
        style.setProperty(key, value);
      }
    }
  }

  // ── Refresh theme from backend ──
  const refreshFromBackend = useCallback(async () => {
    try {
      const res = await themeService.getActive();
      const data = res?.data ?? res;
      if (data?.token_overrides) {
        setBackendTheme(data);
        applyTokenOverrides(data.token_overrides);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Apply font size ──
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  // ── Listen for system color-scheme changes ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (mode === 'system') {
        applyBodyClasses('system');
      }
    };
    try { mq.addEventListener('change', handler); } catch { /* IE fallback */ }
    return () => { try { mq.removeEventListener('change', handler); } catch {} };
  }, [mode]);

  // ── Persisted setters ──
  const setMode = useCallback((newMode) => {
    setModeRaw(newMode);
    try { localStorage.setItem(STORAGE_KEY_MODE, newMode); } catch {}
  }, []);

  const setAccentColor = useCallback((hex) => {
    setAccentColorRaw(hex);
    try { localStorage.setItem(STORAGE_KEY_COLOR, hex); } catch {}
  }, []);

  const setFontSize = useCallback((px) => {
    setFontSizeRaw(px);
    try { localStorage.setItem(STORAGE_KEY_FONT, String(px)); } catch {}
  }, []);

  /**
   * Apply a backend theme detail payload: token overrides + accent +
   * mode (derived from category) + persist the slug so the choice
   * survives reloads. Shared by the boot-restore effect and the
   * public applyThemeBySlug. Defined AFTER the persisted setters so
   * the useCallback factories never hit the const TDZ.
   */
  const applyThemeDetail = useCallback((data) => {
    if (!data) return;
    const overrides = data.token_overrides;
    if (overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0) {
      applyTokenOverrides(overrides);
    }
    const accent = (overrides && (overrides['--pink-primary'] || overrides['--color-primary']));
    if (accent) setAccentColor(accent);
    const m = CATEGORY_TO_MODE[data.category];
    if (m) setMode(m);
    if (data.slug) {
      setActiveThemeSlug(data.slug);
      try { localStorage.setItem(STORAGE_KEY_THEME_SLUG, data.slug); } catch (_) {}
    }
  }, [setAccentColor, setMode]);

  /**
   * Apply a backend theme by slug (Themes page). Fetches the detail,
   * applies it, and returns the payload for the caller to toast on.
   */
  const applyThemeBySlug = useCallback(async (slug) => {
    const res = await themeService.getBySlug(slug);
    const data = res?.data ?? res;
    applyThemeDetail(data);
    return data;
  }, [applyThemeDetail]);

  // ── Restore the user-applied theme on boot ──
  useEffect(() => {
    let slug = null;
    try { slug = localStorage.getItem(STORAGE_KEY_THEME_SLUG); } catch (_) {}
    if (!slug) return;
    themeService.getBySlug(slug)
      .then((res) => {
        const data = res?.data ?? res;
        if (data?.token_overrides) applyThemeDetail(data);
      })
      .catch(() => { /* stored theme no longer exists — keep local defaults */ });
  }, [applyThemeDetail]);

  // ── isMode helper ──
  const isMode = useCallback((m) => mode === m, [mode]);

  // ── token reader (runtime CSS var accessor) ──
  const token = useCallback((cssVar, fallback = '') => {
    if (typeof window === 'undefined') return fallback;
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim() || fallback;
    } catch {
      return fallback;
    }
  }, [resolvedMode]); // recalc on mode change

  const value = useMemo(() => ({
    mode,
    resolvedMode,
    accentColor,
    accentRgb,
    fontSize,
    isDark,
    setMode,
    setAccentColor,
    setFontSize,
    isMode,
    token,
    backendTheme,
    refreshFromBackend,
    activeThemeSlug,
    applyThemeBySlug,
  }), [
    mode, resolvedMode, accentColor, accentRgb,
    fontSize, isDark, setMode, setAccentColor,
    setFontSize, isMode, token,
    backendTheme, refreshFromBackend,
    activeThemeSlug, applyThemeBySlug,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
