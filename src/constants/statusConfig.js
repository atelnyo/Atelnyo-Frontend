/**
 * src/constants/statusConfig.js — Centralized Status, Badge & Severity Maps
 *
 * Enterprise Theme Engine Phase 4 — replaces every per-component
 * hardcoded color map (STATUS_COLORS, BADGE_COLORS, SEVERITY_COLORS,
 * etc.) with a single source of truth.
 *
 * All values reference CSS custom properties via var(--xxx, fallback)
 * so they auto-update when the active theme changes.
 *
 * USAGE:
 *   import { STATUS, BADGE, SEVERITY } from '../constants/statusConfig';
 *   const cfg = STATUS['pending'];
 *   <span style={{ background: cfg.bg, color: cfg.text }}>
 *     {cfg.label}
 *   </span>
 */

// ═══════════════════════════════════════════════════════════════════════════
// STATUS — lifecycle states (pending, active, error, info, neutral)
// ═══════════════════════════════════════════════════════════════════════════

export const STATUS = {
  pending: {
    dot:    'var(--status-pending-dot, #f59e0b)',
    bg:     'var(--status-pending-bg, rgba(245,158,11,0.12))',
    text:   'var(--status-pending-text, #d97706)',
    border: 'var(--status-pending-bg, rgba(245,158,11,0.3))',
    icon:   'fa-clock',
    labelEn: 'Pending',
    labelHt: 'Annatant',
  },
  active: {
    dot:    'var(--status-active-dot, #10b981)',
    bg:     'var(--status-active-bg, rgba(16,185,129,0.12))',
    text:   'var(--status-active-text, #059669)',
    border: 'var(--status-active-bg, rgba(16,185,129,0.3))',
    icon:   'fa-check-circle',
    labelEn: 'Active',
    labelHt: 'Aktif',
  },
  error: {
    dot:    'var(--status-error-dot, #ef4444)',
    bg:     'var(--status-error-bg, rgba(239,68,68,0.12))',
    text:   'var(--status-error-text, #dc2626)',
    border: 'var(--status-error-bg, rgba(239,68,68,0.3))',
    icon:   'fa-times-circle',
    labelEn: 'Error',
    labelHt: 'Erè',
  },
  info: {
    dot:    'var(--status-info-dot, #38bdf8)',
    bg:     'var(--status-info-bg, rgba(56,189,248,0.12))',
    text:   'var(--status-info-text, #0284c7)',
    border: 'var(--status-info-bg, rgba(56,189,248,0.3))',
    icon:   'fa-info-circle',
    labelEn: 'Info',
    labelHt: 'Enfo',
  },
  neutral: {
    dot:    'var(--status-neutral-dot, #bdbdbd)',
    bg:     'var(--status-neutral-bg, rgba(189,189,189,0.12))',
    text:   'var(--status-neutral-text, #888888)',
    border: 'var(--status-neutral-bg, rgba(189,189,189,0.3))',
    icon:   'fa-circle',
    labelEn: 'Neutral',
    labelHt: 'Net',
  },
  warning: {
    dot:    'var(--state-warning, #f59e0b)',
    bg:     'var(--severity-medium-bg, rgba(245,158,11,0.12))',
    text:   'var(--severity-medium-text, #d97706)',
    border: 'var(--severity-medium-bg, rgba(245,158,11,0.3))',
    icon:   'fa-exclamation-triangle',
    labelEn: 'Warning',
    labelHt: 'Avètisman',
  },
  success: {
    dot:    'var(--state-success, #10b981)',
    bg:     'var(--severity-low-bg, rgba(16,185,129,0.12))',
    text:   'var(--severity-low-text, #059669)',
    border: 'var(--severity-low-bg, rgba(16,185,129,0.3))',
    icon:   'fa-check-circle',
    labelEn: 'Success',
    labelHt: 'Siksè',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// BADGE — role/identity badges (premium, verified, creator, enterprise, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export const BADGE = {
  premium: {
    bg:     'var(--badge-premium-bg, #f59e0b)',
    text:   'var(--badge-premium-text, #fff)',
    icon:   'fa-crown',
    labelEn: 'Premium',
    labelHt: 'Premium',
  },
  verified: {
    bg:     'var(--badge-verified-bg, #10b981)',
    text:   'var(--badge-verified-text, #fff)',
    icon:   'fa-check-circle',
    labelEn: 'Verified',
    labelHt: 'Verifye',
  },
  creator: {
    bg:     'var(--badge-creator-bg, #d81b60)',
    text:   'var(--badge-creator-text, #fff)',
    icon:   'fa-paint-brush',
    labelEn: 'Creator',
    labelHt: 'Kreyatè',
  },
  enterprise: {
    bg:     'var(--badge-enterprise-bg, #8b5cf6)',
    text:   'var(--badge-enterprise-text, #fff)',
    icon:   'fa-building',
    labelEn: 'Enterprise',
    labelHt: 'Antrepriz',
  },
  partner: {
    bg:     'var(--badge-partner-bg, #6366f1)',
    text:   'var(--badge-partner-text, #fff)',
    icon:   'fa-handshake',
    labelEn: 'Partner',
    labelHt: 'Patenè',
  },
  featured: {
    bg:     'var(--badge-featured-bg, #fbbf24)',
    text:   'var(--badge-featured-text, #333)',
    icon:   'fa-star',
    labelEn: 'Featured',
    labelHt: 'Anvedèt',
  },
  admin: {
    bg:     'var(--badge-admin-bg, #444)',
    text:   'var(--badge-admin-text, #fff)',
    icon:   'fa-shield-halved',
    labelEn: 'Admin',
    labelHt: 'Admin',
  },
  new: {
    bg:     'var(--pr-color-sky-400, #38bdf8)',
    text:   '#fff',
    icon:   'fa-sparkles',
    labelEn: 'New',
    labelHt: 'Nouvo',
  },
  popular: {
    bg:     'var(--pr-color-orange-500, #f97316)',
    text:   '#fff',
    icon:   'fa-fire',
    labelEn: 'Popular',
    labelHt: 'Popilè',
  },
  free: {
    bg:     'var(--state-success, #10b981)',
    text:   '#fff',
    icon:   'fa-gift',
    labelEn: 'Free',
    labelHt: 'Gratis',
  },
  pro: {
    bg:     'var(--color-primary, #d81b60)',
    text:   '#fff',
    icon:   'fa-rocket',
    labelEn: 'Pro',
    labelHt: 'Pro',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SEVERITY — risk/impact levels (low, medium, high, critical)
// ═══════════════════════════════════════════════════════════════════════════

export const SEVERITY = {
  low: {
    bg:     'var(--severity-low-bg, rgba(16,185,129,0.1))',
    text:   'var(--severity-low-text, #059669)',
    icon:   'fa-circle-check',
    labelEn: 'Low',
    labelHt: 'Ba',
  },
  medium: {
    bg:     'var(--severity-medium-bg, rgba(245,158,11,0.12))',
    text:   'var(--severity-medium-text, #d97706)',
    icon:   'fa-circle-exclamation',
    labelEn: 'Medium',
    labelHt: 'Mwayen',
  },
  high: {
    bg:     'var(--severity-high-bg, rgba(239,68,68,0.12))',
    text:   'var(--severity-high-text, #dc2626)',
    icon:   'fa-triangle-exclamation',
    labelEn: 'High',
    labelHt: 'Wo',
  },
  critical: {
    bg:     'var(--severity-critical-bg, #ef4444)',
    text:   'var(--severity-critical-text, #fff)',
    icon:   'fa-skull',
    labelEn: 'Critical',
    labelHt: 'Kritik',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CREATOR APPLICATION STATUS (specialized for CreatorApply flow)
// ═══════════════════════════════════════════════════════════════════════════

export const CREATOR_APP_STATUS = {
  draft: {
    ...STATUS.neutral,
    icon:   'fa-pen',
    labelEn: 'Draft',
    labelHt: 'Bwouyon',
    hintEn: "Complete your application when you're ready.",
    hintHt: 'Finisman aplikasyon ou an lè w pare.',
  },
  submitted: {
    ...STATUS.pending,
    icon:   'fa-hourglass-half',
    labelEn: 'Submitted',
    labelHt: 'Voye',
    hintEn: "We've received your application!",
    hintHt: 'N ap resevwa aplikasyon ou an!',
  },
  under_review: {
    ...STATUS.info,
    icon:   'fa-magnifying-glass',
    labelEn: 'Under Review',
    labelHt: 'Ap Revize',
    hintEn: 'Our team is reviewing your application.',
    hintHt: 'Ekip n ap revize aplikasyon ou an.',
  },
  need_information: {
    ...STATUS.warning,
    icon:   'fa-circle-info',
    labelEn: 'Need Information',
    labelHt: 'Bezwen Plis',
    hintEn: 'We need more information. Check our message.',
    hintHt: 'N bezwen plis enfòmasyon. Tcheke mesaj nou an.',
  },
  approved: {
    ...STATUS.success,
    icon:   'fa-circle-check',
    labelEn: 'Approved 🎉',
    labelHt: 'Apwouve 🎉',
    hintEn: "Congratulations! You're now a creator.",
    hintHt: 'Felisitasyon! Ou vin yon kreyatè.',
  },
  rejected: {
    ...STATUS.error,
    icon:   'fa-xmark-circle',
    labelEn: 'Rejected',
    labelHt: 'Refize',
    hintEn: 'Your application was not approved. You can re-apply.',
    hintHt: 'Aplikasyon ou an pa apwouve. Ou ka re-aplike.',
  },
  suspended: {
    ...STATUS.warning,
    icon:   'fa-ban',
    labelEn: 'Suspended',
    labelHt: 'Sispann',
    hintEn: 'Your creator account has been suspended.',
    hintHt: 'Kont kreyatè ou a sispann.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SPOTLIGHT APPLICATION STATUS
// ═══════════════════════════════════════════════════════════════════════════

export const SPOTLIGHT_STATUS = {
  pending: {
    ...STATUS.pending,
    icon:   'fa-clock',
    labelEn: 'Pending',
    labelHt: 'Annatant',
  },
  under_review: {
    ...STATUS.info,
    icon:   'fa-eye',
    labelEn: 'Under Review',
    labelHt: 'Ap Revize',
  },
  info_requested: {
    ...STATUS.warning,
    icon:   'fa-circle-question',
    labelEn: 'Info Requested',
    labelHt: 'Enfòmasyon Mande',
  },
  approved: {
    ...STATUS.success,
    icon:   'fa-check-circle',
    labelEn: 'Approved',
    labelHt: 'Apwouve',
  },
  rejected: {
    ...STATUS.danger,
    icon:   'fa-circle-xmark',
    labelEn: 'Rejected',
    labelHt: 'Rejete',
  },
};

// ─── Company Profile (Phase Company) ─────────────────────────────────
// Status pills for the dedicated in-app company page — same lifecycle
// as Spotlight: pending → approved | rejected. ``verified`` is NOT a
// status — it's a separate admin-granted badge (is_verified flag).
export const COMPANY_STATUS = {
  pending: {
    ...STATUS.pending,
    icon:   'fa-clock',
    labelEn: 'Pending',
    labelHt: 'Annatant',
  },
  approved: {
    ...STATUS.success,
    icon:   'fa-check-circle',
    labelEn: 'Approved',
    labelHt: 'Apwouve',
  },
  rejected: {
    ...STATUS.danger,
    icon:   'fa-circle-xmark',
    labelEn: 'Rejected',
    labelHt: 'Rejete',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA HEALTH STATUS
// ═══════════════════════════════════════════════════════════════════════════

export const MEDIA_HEALTH = {
  healthy: {
    ...STATUS.success,
    icon:   'fa-check-circle',
    labelEn: 'Healthy',
    labelHt: 'An sante',
  },
  checking: {
    ...STATUS.info,
    icon:   'fa-spinner fa-spin',
    labelEn: 'Checking',
    labelHt: 'Ap tcheke',
  },
  warning: {
    ...STATUS.warning,
    icon:   'fa-exclamation-triangle',
    labelEn: 'Warning',
    labelHt: 'Avètisman',
  },
  broken: {
    ...STATUS.error,
    icon:   'fa-times-circle',
    labelEn: 'Broken',
    labelHt: 'Kase',
  },
  recovered: {
    ...STATUS.success,
    icon:   'fa-rotate-left',
    labelEn: 'Recovered',
    labelHt: 'Rekiperasyon',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// WALLET TRANSACTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export const TX_TYPE = {
  payment: {
    ...STATUS.success,
    icon:   'fa-credit-card',
    labelEn: 'Payment',
    labelHt: 'Peman',
  },
  withdrawal: {
    ...STATUS.error,
    icon:   'fa-arrow-up',
    labelEn: 'Withdrawal',
    labelHt: 'Retrè',
  },
  deposit: {
    ...STATUS.info,
    icon:   'fa-arrow-down',
    labelEn: 'Deposit',
    labelHt: 'Depo',
  },
  tip_sent: {
    ...STATUS.warning,
    icon:   'fa-paper-plane',
    labelEn: 'Tip Sent',
    labelHt: 'Tip Voye',
  },
  tip_received: {
    ...STATUS.success,
    icon:   'fa-hand-holding-heart',
    labelEn: 'Tip Received',
    labelHt: 'Tip Resevwa',
  },
  refund: {
    ...STATUS.info,
    icon:   'fa-undo',
    labelEn: 'Refund',
    labelHt: 'Ranbousman',
  },
  failed: {
    ...STATUS.error,
    icon:   'fa-times-circle',
    labelEn: 'Failed',
    labelHt: 'Echwe',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MODERATION / INCIDENT STATUS
// ═══════════════════════════════════════════════════════════════════════════

export const MODERATION_STATUS = {
  open:           { ...STATUS.error,    icon: 'fa-folder-open',     labelEn: 'Open',           labelHt: 'Ouvè' },
  investigating:  { ...STATUS.warning,  icon: 'fa-magnifying-glass', labelEn: 'Investigating', labelHt: 'Ap Envestige' },
  resolved:       { ...STATUS.success,  icon: 'fa-check-circle',   labelEn: 'Resolved',       labelHt: 'Rezoud' },
  closed:         { ...STATUS.neutral,  icon: 'fa-lock',           labelEn: 'Closed',         labelHt: 'Fèmen' },
  flagged:        { ...STATUS.warning,  icon: 'fa-flag',           labelEn: 'Flagged',        labelHt: 'Make' },
  spam:           { ...STATUS.error,    icon: 'fa-envelope',        labelEn: 'Spam',           labelHt: 'Spam' },
  adult:          { ...STATUS.error,    icon: 'fa-user-slash',     labelEn: 'Adult',          labelHt: 'Adilt' },
  sensitive:      { ...STATUS.warning,  icon: 'fa-exclamation-circle', labelEn: 'Sensitive', labelHt: 'Sansib' },
};

// ═══════════════════════════════════════════════════════════════════════════
// VISIBILITY (media / content)
// ═══════════════════════════════════════════════════════════════════════════

export const VISIBILITY = {
  public:    { icon: 'fa-globe',          color: 'var(--state-success, #10b981)', labelEn: 'Public',    labelHt: 'Piblik' },
  followers: { icon: 'fa-users',          color: 'var(--state-info, #38bdf8)',    labelEn: 'Followers', labelHt: 'Abonnen' },
  private:   { icon: 'fa-lock',           color: 'var(--text-tertiary, #bdbdbd)', labelEn: 'Private',   labelHt: 'Prive' },
  customers: { icon: 'fa-shopping-bag',   color: 'var(--state-warning, #f59e0b)', labelEn: 'Customers', labelHt: 'Kliyan' },
  unlisted:  { icon: 'fa-eye-slash',      color: 'var(--text-secondary, #888)',   labelEn: 'Unlisted',  labelHt: 'Pako Lis' },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS — used by components that need dynamic lookup
// ═══════════════════════════════════════════════════════════════════════════

/** Get the full config object for a status key (e.g. 'pending', 'approved'). */
export function getStatusConfig(key, configMap = STATUS) {
  return configMap[key] || STATUS.neutral;
}

/** Get the icon class for a status key. */
export function getStatusIcon(key, configMap = STATUS) {
  const cfg = configMap[key];
  return cfg?.icon || 'fa-circle';
}

/** Get the human-readable label for a status key. */
export function getStatusLabel(key, lang = 'en', configMap = STATUS) {
  const cfg = configMap[key];
  if (!cfg) return key || '—';
  return lang === 'ht' ? (cfg.labelHt || cfg.labelEn) : cfg.labelEn;
}

/** Get inline style object for a status key (for React style props). */
export function getStatusStyle(key, configMap = STATUS) {
  const cfg = configMap[key] || STATUS.neutral;
  return {
    color: cfg.text,
    backgroundColor: cfg.bg,
    borderColor: cfg.border || cfg.bg,
  };
}

/** Alias for CreatorApply: CREATOR_APP_STATUS used as CREATOR_STATUS_CONFIG. */
export const CREATOR_STATUS_CONFIG = CREATOR_APP_STATUS;

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA STATUS META — mirrors MediaStatusEngine.STATUS_META (canonical)
// ═══════════════════════════════════════════════════════════════════════════

export const MEDIA_STATUS_META = {
  draft:      { ...STATUS.neutral,   icon: 'fa-file',                 labelEn: 'Draft',      labelHt: 'Brouyon' },
  ready:      { ...STATUS.info,      icon: 'fa-box-open',             labelEn: 'Ready',      labelHt: 'Pare' },
  validating: { ...STATUS.info,      icon: 'fa-spinner',              labelEn: 'Validating', labelHt: 'Ap valide' },
  healthy:    { ...STATUS.success,   icon: 'fa-check-circle',         labelEn: 'Healthy',    labelHt: 'An sante' },
  broken:     { ...STATUS.error,     icon: 'fa-times-circle',         labelEn: 'Broken',     labelHt: 'Kase' },
  disabled:   { ...STATUS.neutral,   icon: 'fa-ban',                  labelEn: 'Disabled',   labelHt: 'Andikape' },
  archived:   { ...STATUS.neutral,   icon: 'fa-box',                  labelEn: 'Archived',   labelHt: 'Achive' },
  hidden:     { ...STATUS.neutral,   icon: 'fa-eye-slash',            labelEn: 'Hidden',     labelHt: 'Rezève' },
  scheduled:  { dot: 'var(--pr-color-violet-500, #8b5cf6)', icon: 'fa-clock', labelEn: 'Scheduled',  labelHt: 'Pwograme' },
  deleted:    { dot: 'var(--pr-color-amber-900, #7c2d12)',   icon: 'fa-trash', labelEn: 'Deleted',    labelHt: 'Siprime' },
  processing: { ...STATUS.info,      icon: 'fa-cog',                  labelEn: 'Processing', labelHt: 'Ap trete' },
  failed:     { ...STATUS.error,     icon: 'fa-exclamation-circle',   labelEn: 'Failed',     labelHt: 'Echwe' },
  success:    { ...STATUS.success,   icon: 'fa-check-double',         labelEn: 'Success',    labelHt: 'Siksè' },
  warning:    { ...STATUS.warning,   icon: 'fa-exclamation-triangle', labelEn: 'Warning',    labelHt: 'Avètisman' },
  premium:    { dot: 'var(--pr-color-yellow-400, #facc15)', bg: 'var(--pr-color-yellow-400-bg, rgba(250,204,21,0.1))', icon: 'fa-crown', labelEn: 'Premium', labelHt: 'Premium' },
};

/** Alias: VISIBILITY_META for MediaCard/MediaBulkToolbar compatibility. */
export const VISIBILITY_META = VISIBILITY;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

const statusConfig = {
  STATUS,
  BADGE,
  SEVERITY,
  CREATOR_APP_STATUS,
  SPOTLIGHT_STATUS,
  COMPANY_STATUS,
  MEDIA_HEALTH,
  TX_TYPE,
  MODERATION_STATUS,
  VISIBILITY,
  MEDIA_STATUS_META,
  VISIBILITY_META,
};

export default statusConfig;
