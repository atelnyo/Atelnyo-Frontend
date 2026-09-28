/**
 * src/components/studio/shared/index.js
 *
 * Barrel export — single import point for all shared studio primitives.
 *
 * Usage:
 *   import { StatCard, EmptyState, StudioSkeleton, WelcomeHeader,
 *            QuickActions, PendingActions, fmtCurrency, fmtCount, fmtDate,
 *            classNames } from './shared';
 */

export { default as StatCard } from './StatCard';
export { default as EmptyState } from './EmptyState';
export { default as StudioSkeleton } from './StudioSkeleton';
export { default as WelcomeHeader } from './WelcomeHeader';
export { default as QuickActions } from './QuickActions';
export { default as PendingActions } from './PendingActions';
export { default as StatusSummary } from './StatusSummary';
export { default as SectionHeader } from './SectionHeader';
export { fmtCurrency, fmtCount, fmtDate, classNames } from './helpers';
// HelpTip / FieldTip / HELP_COPY are the shared field-education
// primitives (defined in the modals shared system). Re-exported here
// so section PAGES import them from the same barrel as the rest of the
// studio shared kit — one import path for the whole workspace.
export { HelpTip, FieldTip, HELP_COPY } from '../modals/shared';
