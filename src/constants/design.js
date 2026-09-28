/**
 * src/constants/design.js — Atelnyo Enterprise Design Tokens v2.0
 *
 * Enterprise Design System — single source of truth for EVERY visual
 * property in the application. No hardcoded colors, spacing, typography,
 * shadows, or breakpoints anywhere else.
 *
 * TOKEN HIERARCHY:
 *   Layer 1: PRIMITIVES — raw atomic values (PRIMITIVE.colors, PRIMITIVE.sizes)
 *   Layer 2: SEMANTIC   — purpose-driven (SEMANTIC.colors, SEMANTIC.surfaces)
 *   Layer 3: COMPONENT  — component-specific (COMPONENT.button, COMPONENT.card)
 *   Layer 4: CATEGORY   — role/status badges (CATEGORY.badges, CATEGORY.status)
 *   Layer 5: THEME MODE — mode presets (THEME_MODES.dark, THEME_MODES.amoled, etc.)
 *
 * Usage in React components:
 *   import { SEMANTIC, COMPONENT, CATEGORY } from '../../constants/design';
 *   <div style={{ color: SEMANTIC.colors.primary, padding: COMPONENT.button.paddingY }} />
 *
 * CSS classes use the variables defined in tokens.css.
 */

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1 — PRIMITIVE TOKENS (raw atomic values)
// ═══════════════════════════════════════════════════════════════════════════

export const PRIMITIVE = {
  colors: {
    // Brand
    rose50:  '#fce4ec',
    rose100: '#f8bbd0',
    rose200: '#f48fb1',
    rose300: '#f06292',
    rose400: '#ec407a',
    rose500: '#d81b60',
    rose600: '#c2185b',
    rose700: '#a01346',
    rose800: '#880e4f',
    rose900: '#6a0d3d',

    // Neutrals
    white:    '#ffffff',
    black:    '#000000',
    gray50:  '#fafafa',
    gray100: '#f5f5f5',
    gray200: '#eeeeee',
    gray300: '#e0e0e0',
    gray400: '#bdbdbd',
    gray500: '#999999',
    gray600: '#888888',
    gray700: '#666666',
    gray800: '#444444',
    gray900: '#333333',

    // Semantic
    emerald50:  '#ecfdf5',
    emerald500: '#10b981',
    emerald600: '#059669',
    red50:      '#fef2f2',
    red500:     '#ef4444',
    red600:     '#dc2626',
    amber50:    '#fffbeb',
    amber400:   '#fbbf24',
    amber500:   '#f59e0b',
    amber600:   '#d97706',
    sky50:      '#f0f9ff',
    sky400:     '#38bdf8',
    sky500:     '#0ea5e9',
    sky600:     '#0284c7',
    violet50:   '#f5f3ff',
    violet400:  '#a78bfa',
    violet500:  '#8b5cf6',
    violet600:  '#7c3aed',
    indigo400:  '#818cf8',
    indigo500:  '#6366f1',
    purple500:  '#6c5ce7',
    cyan500:    '#00e7ff',
    blue500:    '#0084ff',
    teal500:    '#14b8a6',
    pink500:    '#e91e63',
    orange400:  '#fb923c',
    orange500:  '#f97316',
    lime500:    '#84cc16',
  },

  sizes: {
    0:   '0',
    px:  '1px',
    '0_5': '2px',
    1:   '4px',
    '1_5': '6px',
    2:   '8px',
    '2_5': '10px',
    3:   '12px',
    '3_5': '14px',
    4:   '16px',
    5:   '20px',
    6:   '24px',
    7:   '28px',
    8:   '32px',
    9:   '36px',
    10:  '40px',
    11:  '44px',
    12:  '48px',
    14:  '56px',
    16:  '64px',
    20:  '80px',
    24:  '96px',
    28:  '112px',
    32:  '128px',
    40:  '160px',
    50:  '200px',
  },

  font: {
    familySans: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    familyMono: "'JetBrains Mono', 'Courier New', Courier, monospace",
    size2xs: '0.625rem',
    sizeXs:  '0.72rem',
    sizeSm:  '0.8rem',
    sizeBase: '0.875rem',
    sizeMd:  '0.95rem',
    sizeLg:  '1.05rem',
    sizeXl:  '1.15rem',
    size2xl: '1.25rem',
    size3xl: '1.5rem',
    size4xl: '1.75rem',
    size5xl: '2rem',
    size6xl: '2.5rem',
    size7xl: '3rem',
    weightNormal:    400,
    weightMedium:    500,
    weightSemibold:  600,
    weightBold:      700,
    weightExtrabold: 800,
    leadingTight:   1.25,
    leadingNormal:  1.4,
    leadingRelaxed: 1.6,
    trackingTight:   '-0.02em',
    trackingNormal:  '0',
    trackingWide:    '0.04em',
    trackingUpper:   '1px',
  },

  radius: {
    none:   '0',
    xs:     '2px',
    sm:     '4px',
    md:     '8px',
    lg:     '12px',
    xl:     '16px',
    '2xl':  '20px',
    '3xl':  '24px',
    full:   '9999px',
    circle: '50%',
  },

  border: {
    0: '0',
    1: '1px',
    2: '2px',
    3: '3px',
  },

  duration: {
    instant: '0.05s',
    fast:    '0.12s',
    normal:  '0.2s',
    medium:  '0.3s',
    slow:    '0.5s',
    xslow:   '0.8s',
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    out:     'cubic-bezier(0, 0, 0.2, 1)',
    in:      'cubic-bezier(0.4, 0, 1, 1)',
    spring:  'cubic-bezier(0.16, 1, 0.3, 1)',
    bounce:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2 — SEMANTIC TOKENS (purpose-driven)
// ═══════════════════════════════════════════════════════════════════════════

export const SEMANTIC = {
  colors: {
    primary:        PRIMITIVE.colors.rose500,
    primaryLight:   PRIMITIVE.colors.rose50,
    primaryDark:    PRIMITIVE.colors.rose700,
    primaryGradient: `linear-gradient(135deg, ${PRIMITIVE.colors.rose500}, ${PRIMITIVE.colors.rose300})`,
  },

  states: {
    success:       PRIMITIVE.colors.emerald500,
    successLight:  PRIMITIVE.colors.emerald50,
    successDark:   PRIMITIVE.colors.emerald600,
    error:         PRIMITIVE.colors.red500,
    errorLight:    PRIMITIVE.colors.red50,
    errorDark:     PRIMITIVE.colors.red600,
    warning:       PRIMITIVE.colors.amber500,
    warningLight:  PRIMITIVE.colors.amber50,
    warningDark:   PRIMITIVE.colors.amber600,
    info:          PRIMITIVE.colors.sky400,
    infoLight:     PRIMITIVE.colors.sky50,
    infoDark:      PRIMITIVE.colors.sky500,
  },

  accents: {
    gold:    PRIMITIVE.colors.amber400,
    violet:  PRIMITIVE.colors.violet400,
    indigo:  PRIMITIVE.colors.indigo400,
    cyan:    PRIMITIVE.colors.cyan500,
    blue:    PRIMITIVE.colors.blue500,
    teal:    PRIMITIVE.colors.teal500,
    pink:    PRIMITIVE.colors.pink500,
    orange:  PRIMITIVE.colors.orange400,
    lime:    PRIMITIVE.colors.lime500,
  },

  surfaces: {
    page:         PRIMITIVE.colors.rose50,
    card:         PRIMITIVE.colors.white,
    cardAlt:      PRIMITIVE.colors.gray50,
    header:       'rgba(255, 255, 255, 0.8)',
    glass:        'rgba(255, 255, 255, 0.9)',
    input:        PRIMITIVE.colors.rose50,
    inputFocus:   PRIMITIVE.colors.white,
    overlay:      'rgba(0, 0, 0, 0.55)',
    overlayHeavy: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.05)',
    highlight:    'rgba(216, 27, 96, 0.05)',
    highlightMd:  'rgba(216, 27, 96, 0.1)',
    selected:     'rgba(216, 27, 96, 0.08)',
  },

  text: {
    primary:    PRIMITIVE.colors.gray900,
    secondary:  PRIMITIVE.colors.gray600,
    tertiary:   PRIMITIVE.colors.gray400,
    inverse:    PRIMITIVE.colors.white,
    onPrimary:  PRIMITIVE.colors.white,
    link:       PRIMITIVE.colors.rose500,
    linkHover:  PRIMITIVE.colors.rose600,
  },

  border: {
    color:       'rgba(216, 27, 96, 0.1)',
    strong:      'rgba(216, 27, 96, 0.25)',
    subtle:      'rgba(216, 27, 96, 0.06)',
  },

  shadowColors: {
    sm:  'rgba(0, 0, 0, 0.04)',
    md:  'rgba(0, 0, 0, 0.06)',
    lg:  'rgba(0, 0, 0, 0.12)',
    xl:  'rgba(0, 0, 0, 0.2)',
    '2xl': 'rgba(0, 0, 0, 0.3)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3 — COMPONENT TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const COMPONENT = {
  button: {
    primaryBg:        SEMANTIC.colors.primary,
    primaryText:      SEMANTIC.text.onPrimary,
    primaryHoverBg:   PRIMITIVE.colors.rose600,
    primaryPressedBg: PRIMITIVE.colors.rose700,
    primaryDisabledBg: PRIMITIVE.colors.rose200,
    primaryShadow:    `0 2px 8px rgba(216, 27, 96, 0.3)`,
    secondaryBg:      'transparent',
    secondaryText:    SEMANTIC.colors.primary,
    secondaryBorder:  `${PRIMITIVE.border[2]} solid ${SEMANTIC.colors.primary}`,
    secondaryHoverBg: SEMANTIC.surfaces.highlight,
    ghostBg:          'transparent',
    ghostText:        SEMANTIC.text.secondary,
    ghostHoverBg:     SEMANTIC.surfaces.highlight,
    iconBg:           SEMANTIC.colors.primaryLight,
    iconText:         SEMANTIC.colors.primary,
    iconSize:         '40px',
    radius:           PRIMITIVE.radius.md,
    radiusPill:       PRIMITIVE.radius.full,
    radiusIcon:       PRIMITIVE.radius.circle,
    fontWeight:       PRIMITIVE.font.weightSemibold,
    paddingY:         PRIMITIVE.sizes[3],
    paddingX:         PRIMITIVE.sizes[6],
    transition:       `all ${PRIMITIVE.duration.fast} ${PRIMITIVE.easing.default}`,
  },

  card: {
    bg:           SEMANTIC.surfaces.card,
    bgHover:      PRIMITIVE.colors.white,
    border:       `${PRIMITIVE.border[1]} solid ${SEMANTIC.border.color}`,
    radius:       PRIMITIVE.radius.xl,
    radiusSm:     PRIMITIVE.radius.lg,
    shadow:       `0 4px 15px ${SEMANTIC.shadowColors.md}`,
    shadowHover:  `0 8px 25px ${SEMANTIC.shadowColors.lg}`,
    padding:      PRIMITIVE.sizes[5],
    gap:          PRIMITIVE.sizes[4],
    transition:   `all ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.default}`,
    hoverLift:    '-4px',
  },

  input: {
    bg:           SEMANTIC.surfaces.input,
    bgFocus:      SEMANTIC.surfaces.inputFocus,
    text:         SEMANTIC.text.primary,
    placeholder:  SEMANTIC.text.tertiary,
    border:       `${PRIMITIVE.border[2]} solid ${SEMANTIC.colors.primaryLight}`,
    borderFocus:  `${PRIMITIVE.border[2]} solid ${SEMANTIC.colors.primary}`,
    radius:       PRIMITIVE.radius.full,
    radiusMd:     PRIMITIVE.radius.md,
    paddingY:     PRIMITIVE.sizes[3],
    paddingX:     PRIMITIVE.sizes[4],
    height:       '44px',
    focusRing:    `0 0 0 4px rgba(216, 27, 96, 0.15)`,
    transition:   `border-color ${PRIMITIVE.duration.fast} ${PRIMITIVE.easing.default}, box-shadow ${PRIMITIVE.duration.fast} ${PRIMITIVE.easing.default}`,
  },

  modal: {
    bg:           SEMANTIC.surfaces.card,
    backdrop:     'rgba(0, 0, 0, 0.7)',
    backdropBlur: 'blur(5px)',
    radius:       PRIMITIVE.radius['2xl'],
    padding:      PRIMITIVE.sizes[8],
    shadow:       `0 20px 60px ${SEMANTIC.shadowColors['2xl']}`,
    maxWidth:     '440px',
    z:            5000,
  },

  badge: {
    radius:     PRIMITIVE.radius.full,
    paddingY:   PRIMITIVE.sizes[1],
    paddingX:   PRIMITIVE.sizes[3],
    fontSize:   PRIMITIVE.font.sizeXs,
    fontWeight: PRIMITIVE.font.weightBold,
  },

  nav: {
    headerBg:      SEMANTIC.surfaces.header,
    headerBlur:    'blur(10px)',
    headerHeight:  '56px',
    headerZ:       1000,
    headerBorder:  `${PRIMITIVE.border[1]} solid ${SEMANTIC.border.color}`,
    headerShadow:  `0 2px 10px ${SEMANTIC.shadowColors.sm}`,
    bottomBg:      SEMANTIC.surfaces.card,
    bottomHeight:  '60px',
    bottomZ:       2500,
    bottomShadow:  `0 -2px 10px ${SEMANTIC.shadowColors.sm}`,
    sidebarWidth:  '260px',
    sidebarBg:     SEMANTIC.surfaces.card,
    sidebarZ:      1500,
  },

  table: {
    headerBg:     SEMANTIC.surfaces.cardAlt,
    rowHoverBg:   SEMANTIC.surfaces.highlight,
    border:       `${PRIMITIVE.border[1]} solid ${SEMANTIC.border.subtle}`,
    paddingY:     PRIMITIVE.sizes[3],
    paddingX:     PRIMITIVE.sizes[4],
  },

  tooltip: {
    bg:      PRIMITIVE.colors.gray900,
    text:    SEMANTIC.text.inverse,
    radius:  PRIMITIVE.radius.sm,
    padding: `${PRIMITIVE.sizes['1_5']} ${PRIMITIVE.sizes[3]}`,
  },

  avatar: {
    radius:  PRIMITIVE.radius.circle,
    sizeSm:  '32px',
    sizeMd:  '40px',
    sizeLg:  '56px',
    sizeXl:  '80px',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4 — CATEGORY / ROLE / STATUS TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const CATEGORY = {
  badges: {
    premium:    { bg: PRIMITIVE.colors.amber500, text: PRIMITIVE.colors.white },
    verified:   { bg: SEMANTIC.states.success,   text: PRIMITIVE.colors.white },
    creator:    { bg: SEMANTIC.colors.primary,   text: PRIMITIVE.colors.white },
    enterprise: { bg: PRIMITIVE.colors.violet500, text: PRIMITIVE.colors.white },
    partner:    { bg: PRIMITIVE.colors.indigo500, text: PRIMITIVE.colors.white },
    admin:      { bg: PRIMITIVE.colors.gray800,   text: PRIMITIVE.colors.white },
    featured:   { bg: PRIMITIVE.colors.amber400,  text: PRIMITIVE.colors.gray900 },
  },

  status: {
    pending:  { bg: PRIMITIVE.colors.amber50,  text: PRIMITIVE.colors.amber600,  dot: PRIMITIVE.colors.amber500 },
    active:   { bg: PRIMITIVE.colors.emerald50, text: PRIMITIVE.colors.emerald600, dot: PRIMITIVE.colors.emerald500 },
    error:    { bg: PRIMITIVE.colors.red50,     text: PRIMITIVE.colors.red600,     dot: PRIMITIVE.colors.red500 },
    info:     { bg: PRIMITIVE.colors.sky50,     text: PRIMITIVE.colors.sky600,     dot: PRIMITIVE.colors.sky400 },
    neutral:  { bg: PRIMITIVE.colors.gray100,   text: PRIMITIVE.colors.gray600,   dot: PRIMITIVE.colors.gray400 },
  },

  severity: {
    low:      { bg: PRIMITIVE.colors.emerald50, text: PRIMITIVE.colors.emerald600 },
    medium:   { bg: PRIMITIVE.colors.amber50,   text: PRIMITIVE.colors.amber600 },
    high:     { bg: PRIMITIVE.colors.red50,     text: PRIMITIVE.colors.red600 },
    critical: { bg: PRIMITIVE.colors.red500,    text: PRIMITIVE.colors.white },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5 — THEME MODE OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

export const THEME_MODES = {
  dark: {
    surfaces: {
      page:         '#121212',
      card:         '#252525',
      cardAlt:      '#1e1e1e',
      header:       'rgba(30, 30, 30, 0.85)',
      glass:        'rgba(30, 30, 30, 0.92)',
      input:        '#2d2d2d',
      inputFocus:   '#333333',
      overlay:      'rgba(0, 0, 0, 0.8)',
      overlayLight: 'rgba(255, 255, 255, 0.05)',
      highlight:    'rgba(255, 255, 255, 0.06)',
      highlightMd:  'rgba(255, 255, 255, 0.08)',
    },
    text: {
      primary:   '#e0e0e0',
      secondary: '#a0a4ac',
      tertiary:  '#666666',
    },
    status: {
      pending: { bg: 'rgba(245, 158, 11, 0.12)', text: '#fbbf24' },
      active:  { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399' },
      error:   { bg: 'rgba(239, 68, 68, 0.12)',  text: '#f87171' },
      info:    { bg: 'rgba(56, 189, 248, 0.12)',  text: '#7dd3fc' },
      neutral: { bg: 'rgba(255, 255, 255, 0.06)', text: '#a0a4ac' },
    },
  },

  amoled: {
    surfaces: {
      page:  '#000000',
      card:  '#0a0a0a',
      input: '#111111',
    },
  },

  cyber: {
    colors: {
      primary:      '#00ff88',
      primaryLight: 'rgba(0, 255, 136, 0.1)',
      primaryDark:  '#00cc6a',
    },
    surfaces: {
      page:  '#08090f',
      card:  '#11131f',
      input: '#141729',
    },
    text: {
      primary:   '#e0e8ff',
      secondary: '#8890b0',
    },
  },

  minimal: {
    colors: {
      primary:      '#333333',
      primaryLight: '#f0f0f0',
      primaryDark:  '#111111',
    },
    surfaces: {
      page:  '#ffffff',
      card:  '#fafafa',
    },
    minimalDark: {
      colors:  { primary: '#aaaaaa' },
      surfaces: { page: '#111111', card: '#1a1a1a' },
      text:     { primary: '#dddddd' },
    },
  },

  professional: {
    colors: {
      primary:      '#1a56db',
      primaryLight: '#ebf0ff',
      primaryDark:  '#1344af',
    },
    surfaces: { page: '#f8fafc' },
    proDark: {
      colors: { primary: '#3b82f6' },
      surfaces: { page: '#0f172a', card: '#1e293b' },
      text: { primary: '#e2e8f0' },
    },
  },

  enterprise: {
    colors: {
      primary:      '#c8a84e',
      primaryLight: 'rgba(200, 168, 78, 0.1)',
      primaryDark:  '#a88a3e',
    },
    surfaces: { page: '#0d0d12', card: '#1a1a24', input: '#222230' },
    text:     { primary: '#e8e4f0', secondary: '#9a96a8' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SHADOWS — flattened for convenience
// ═══════════════════════════════════════════════════════════════════════════

export const SHADOWS = {
  none:        'none',
  xs:          `0 1px 2px ${SEMANTIC.shadowColors.sm}`,
  sm:          `0 1px 8px ${SEMANTIC.shadowColors.sm}`,
  md:          `0 2px 5px ${SEMANTIC.shadowColors.sm}`,
  lg:          `0 2px 10px ${SEMANTIC.shadowColors.sm}`,
  xl:          `0 4px 15px ${SEMANTIC.shadowColors.md}`,
  '2xl':       `0 8px 25px ${SEMANTIC.shadowColors.lg}`,
  '3xl':       `0 12px 40px ${SEMANTIC.shadowColors.xl}`,
  '4xl':       `0 20px 60px ${SEMANTIC.shadowColors['2xl']}`,
  floating:    `0 4px 15px ${SEMANTIC.shadowColors.xl}`,
  inputFocus:  '0 0 0 4px rgba(216, 27, 96, 0.1)',
  primary:     '0 4px 12px rgba(216, 27, 96, 0.25)',
  primaryLg:   '0 8px 32px rgba(233, 30, 99, 0.35)',
  card:        `0 4px 15px ${SEMANTIC.shadowColors.md}`,
  cardHover:   `0 8px 25px ${SEMANTIC.shadowColors.lg}`,
  modal:       `0 20px 60px ${SEMANTIC.shadowColors['2xl']}`,
  nav:         `0 -2px 10px ${SEMANTIC.shadowColors.sm}`,
  header:      `0 2px 10px ${SEMANTIC.shadowColors.sm}`,
};

// ═══════════════════════════════════════════════════════════════════════════
// SPACING — flattened for convenience
// ═══════════════════════════════════════════════════════════════════════════

export const SPACING = {
  xxs: PRIMITIVE.sizes['0_5'],
  xs:  PRIMITIVE.sizes[1],
  sm:  PRIMITIVE.sizes['1_5'],
  md:  PRIMITIVE.sizes[2],
  lg:  PRIMITIVE.sizes['2_5'],
  xl:  PRIMITIVE.sizes[3],
  '2xl': PRIMITIVE.sizes['3_5'],
  '3xl': PRIMITIVE.sizes[4],
  '4xl': PRIMITIVE.sizes[5],
  '5xl': PRIMITIVE.sizes[6],
  '6xl': PRIMITIVE.sizes[8],
  '7xl': PRIMITIVE.sizes[10],
  '8xl': PRIMITIVE.sizes[12],
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY — flattened for convenience
// ═══════════════════════════════════════════════════════════════════════════

export const TYPO = {
  fontFamily: PRIMITIVE.font.familySans,
  fontMono:   PRIMITIVE.font.familyMono,
  xs:    PRIMITIVE.font.sizeXs,
  sm:    PRIMITIVE.font.sizeSm,
  base:  PRIMITIVE.font.sizeBase,
  md:    PRIMITIVE.font.sizeMd,
  lg:    PRIMITIVE.font.sizeLg,
  xl:    PRIMITIVE.font.sizeXl,
  '2xl': PRIMITIVE.font.size2xl,
  '3xl': PRIMITIVE.font.size3xl,
  '4xl': PRIMITIVE.font.size4xl,
  '5xl': PRIMITIVE.font.size5xl,
  '6xl': PRIMITIVE.font.size6xl,
  '7xl': PRIMITIVE.font.size7xl,
  normal:    PRIMITIVE.font.weightNormal,
  medium:    PRIMITIVE.font.weightMedium,
  semibold:  PRIMITIVE.font.weightSemibold,
  bold:      PRIMITIVE.font.weightBold,
  extrabold: PRIMITIVE.font.weightExtrabold,
  tight:   PRIMITIVE.font.leadingTight,
  normalLH: PRIMITIVE.font.leadingNormal,
  relaxed: PRIMITIVE.font.leadingRelaxed,
  tightSpacing: PRIMITIVE.font.trackingTight,
  normalSpacing: PRIMITIVE.font.trackingNormal,
  wideSpacing: PRIMITIVE.font.trackingWide,
  uppercaseSpacing: PRIMITIVE.font.trackingUpper,
};

// ═══════════════════════════════════════════════════════════════════════════
// RADIUS
// ═══════════════════════════════════════════════════════════════════════════

export const RADIUS = {
  none:   PRIMITIVE.radius.none,
  xs:     PRIMITIVE.radius.xs,
  sm:     PRIMITIVE.radius.sm,
  md:     PRIMITIVE.radius.md,
  lg:     PRIMITIVE.radius.lg,
  xl:     PRIMITIVE.radius.xl,
  '2xl':  PRIMITIVE.radius['2xl'],
  '3xl':  PRIMITIVE.radius['3xl'],
  full:   PRIMITIVE.radius.full,
  circle: PRIMITIVE.radius.circle,
};

// ═══════════════════════════════════════════════════════════════════════════
// Z-INDEX
// ═══════════════════════════════════════════════════════════════════════════

export const Z_INDEX = {
  negative:   -2,
  background: -1,
  default:     1,
  sticky:     25,
  header:   1000,
  sidebar:  1500,
  chatbot:  2600,
  sheet:    2000,
  settings: 2000,
  nav:      2500,
  wizard:   3000,
  overlay:  4000,
  modal:    5000,
  fullscreen: 5000,
  search:   6000,
  toasts:   9999,
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TRANSITIONS = {
  fast:    `all ${PRIMITIVE.duration.fast} ${PRIMITIVE.easing.default}`,
  normal:  `all ${PRIMITIVE.duration.normal} ${PRIMITIVE.easing.default}`,
  medium:  `all ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.default}`,
  slow:    `all ${PRIMITIVE.duration.slow} ${PRIMITIVE.easing.default}`,
  spring:  `all ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.spring}`,
  bounce:  `all ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.bounce}`,
  color:   `background-color ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.default}, color ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.default}, border-color ${PRIMITIVE.duration.medium} ${PRIMITIVE.easing.default}`,
  transform: `transform ${PRIMITIVE.duration.fast} ${PRIMITIVE.easing.default}`,
  opacity:   `opacity ${PRIMITIVE.duration.normal} ${PRIMITIVE.easing.default}`,
};

// ═══════════════════════════════════════════════════════════════════════════
// BREAKPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const BREAKPOINTS = {
  xs:   '0px',
  sm:   '350px',
  md:   '400px',
  lg:   '480px',
  xl:   '600px',
  '2xl': '768px',
  '3xl': '1024px',
  '4xl': '1200px',
  '5xl': '1400px',
};

export const MEDIA = {
  xs:   `@media (min-width: ${BREAKPOINTS.xs})`,
  sm:   `@media (min-width: ${BREAKPOINTS.sm})`,
  md:   `@media (min-width: ${BREAKPOINTS.md})`,
  lg:   `@media (min-width: ${BREAKPOINTS.lg})`,
  xl:   `@media (min-width: ${BREAKPOINTS.xl})`,
  '2xl': `@media (min-width: ${BREAKPOINTS['2xl']})`,
  '3xl': `@media (min-width: ${BREAKPOINTS['3xl']})`,
  '4xl': `@media (min-width: ${BREAKPOINTS['4xl']})`,
  '5xl': `@media (min-width: ${BREAKPOINTS['5xl']})`,
  maxSm: '@media (max-width: 349px)',
  maxMd: '@media (max-width: 399px)',
  maxLg: '@media (max-width: 479px)',
  maxXl: '@media (max-width: 599px)',
  max2xl: '@media (max-width: 767px)',
  max3xl: '@media (max-width: 1023px)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

export const LAYOUT = {
  maxWidth: '1000px',
  containerPadding: PRIMITIVE.sizes[5],
  bottomNavHeight: '60px',
  headerHeight: '56px',
  sidebarWidth: '260px',
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY ALIASES — backward compatibility with existing code
// ═══════════════════════════════════════════════════════════════════════════

export const COLORS = {
  primary:       SEMANTIC.colors.primary,
  primaryLight:  SEMANTIC.colors.primaryLight,
  primaryBg:     '#ffdae9',
  primaryDark:   SEMANTIC.colors.primaryDark,
  primaryGradient: SEMANTIC.colors.primaryGradient,
  white:    PRIMITIVE.colors.white,
  black:    PRIMITIVE.colors.black,
  dark:     PRIMITIVE.colors.gray900,
  gray50:   PRIMITIVE.colors.gray50,
  gray100:  PRIMITIVE.colors.gray100,
  gray200:  PRIMITIVE.colors.gray200,
  gray300:  PRIMITIVE.colors.gray300,
  gray400:  PRIMITIVE.colors.gray400,
  gray500:  PRIMITIVE.colors.gray500,
  gray600:  PRIMITIVE.colors.gray600,
  gray700:  PRIMITIVE.colors.gray700,
  gray800:  PRIMITIVE.colors.gray800,
  gray900:  PRIMITIVE.colors.gray900,
  success:       SEMANTIC.states.success,
  successLight:  SEMANTIC.states.successLight,
  error:         SEMANTIC.states.error,
  errorLight:    '#ff5f56',
  warning:       SEMANTIC.states.warning,
  warningLight:  '#f1c40f',
  info:          PRIMITIVE.colors.sky400,     // aligned with CSS --state-info
  infoDark:      PRIMITIVE.colors.sky500,
  gold:         SEMANTIC.accents.gold,
  amber:        PRIMITIVE.colors.amber400,     // aligned with CSS --color-accent-gold
  indigo:       PRIMITIVE.colors.indigo500,
  indigoLight:  PRIMITIVE.colors.indigo400,
  amberDark:    PRIMITIVE.colors.amber500,
  amberLight:   PRIMITIVE.colors.amber400,
  purple:       PRIMITIVE.colors.purple500,
  cyan:         PRIMITIVE.colors.cyan500,
  blue:         PRIMITIVE.colors.blue500,
  sky:          PRIMITIVE.colors.sky400,
  teal:         PRIMITIVE.colors.teal500,
  emerald:      PRIMITIVE.colors.emerald500,
  violet:       PRIMITIVE.colors.violet500,
  pink:         PRIMITIVE.colors.pink500,
  terminalBg:   '#1e1e1e',
  terminalText: '#ffffff',
  dirBlue:      '#3498db',
  execGreen:    '#2ecc71',
  errorRed:     '#e74c3c',
  cmdOrange:    '#f39c12',
  dotRed:       '#ff5f56',
  dotYellow:    '#ffbd2e',
  dotGreen:     '#27c93f',
  whatsapp:     '#25D366',
  overlay:      'rgba(0, 0, 0, 0.55)',
  overlayHeavy: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.05)',
  overlayDark:  'rgba(0, 0, 0, 0.1)',
  highlight:    'rgba(216, 27, 96, 0.05)',
  highlightMedium: 'rgba(216, 27, 96, 0.1)',
  highlightBorder: 'rgba(216, 27, 96, 0.18)',
  border:       'rgba(216, 27, 96, 0.1)',
  shadow:       'rgba(0, 0, 0, 0.05)',
  shadowMedium: 'rgba(0, 0, 0, 0.1)',
  shadowHeavy:  'rgba(0, 0, 0, 0.2)',
  shadowDarker: 'rgba(0, 0, 0, 0.3)',
  shadowDeep:   'rgba(233, 30, 99, 0.35)',
};

export const DARK_COLORS = {
  primaryBg: '#121212',
  white: '#1e1e1e',
  dark: '#f0f0f0',
  primaryLight: '#2d2d2d',
  cardBg: '#252525',
  gray900: '#e0e0e0',
  gray800: '#c0c4cc',
  gray600: '#a0a4ac',
  textMain: '#e0e0e0',
  headerBg: 'rgba(30, 30, 30, 0.8)',
  glassBg: 'rgba(30, 30, 30, 0.9)',
  border: 'rgba(255, 255, 255, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.75)',
  highlight: 'rgba(255, 255, 255, 0.06)',
  highlightMedium: 'rgba(255, 255, 255, 0.08)',
  overlayLight: 'rgba(255, 255, 255, 0.06)',
  skeletonFrom: '#2a2a35',
  skeletonTo: '#3a3a48',
};

export const BORDER = {
  none: PRIMITIVE.border[0],
  sm:   PRIMITIVE.border[1],
  md:   '1.5px',
  lg:   PRIMITIVE.border[2],
  xl:   PRIMITIVE.border[3],
  '2xl': '3.5px',
};

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT — all-in-one convenience
// ═══════════════════════════════════════════════════════════════════════════

const DESIGN = {
  PRIMITIVE,
  SEMANTIC,
  COMPONENT,
  CATEGORY,
  THEME_MODES,
  SHADOWS,
  SPACING,
  TYPO,
  RADIUS,
  Z_INDEX,
  TRANSITIONS,
  BREAKPOINTS,
  MEDIA,
  LAYOUT,
  BORDER,
  COLORS,
  DARK_COLORS,
};

export default DESIGN;
