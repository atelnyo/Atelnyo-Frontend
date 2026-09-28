/**
 * Auth.jsx — Re-export from refactored modules.
 *
 * The original 600+ line file has been refactored into:
 *   - auth/authUtils.js       — Pure utility functions
 *   - auth/useGoogleAuth.js   — Google OAuth hook
 *   - auth/useRecaptcha.js    — reCAPTCHA escalation hook
 *   - auth/AuthForms.jsx      — Presentational form components
 *   - auth/AuthRefactored.jsx — Main Auth component
 *
 * This file re-exports AuthRefactored so all existing imports
 * (e.g. `import Auth from '../components/Auth'`) continue to work.
 */
export { default } from './auth/AuthRefactored';
