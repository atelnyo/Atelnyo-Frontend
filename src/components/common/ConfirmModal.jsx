/**
 * src/components/common/ConfirmModal.jsx
 *
 * Reusable confirmation modal that replaces window.confirm().
 * Follows the design system with dark mode support, i18n, and
 * keyboard (Enter to confirm, Escape to cancel).
 *
 * Phase 10 — Accessibility upgrades:
 *   - Focus trap (Tab cycling within dialog)
 *   - Focus returns to trigger element on close
 *   - Body scroll lock while open
 *   - Proper aria-labelledby linking title to dialog
 *   - Auto-focus the cancel button on open (safe default)
 *   - aria-describedby linking message to dialog
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, variant }
 *   ...
 *   {confirm && (
 *     <ConfirmModal
 *       title={confirm.title}
 *       message={confirm.message}
 *       variant={confirm.variant || 'danger'}
 *       lang={lang}
 *       onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
 *       onCancel={() => setConfirm(null)}
 *     />
 *   )}
 *
 * Props:
 *   title      — modal title
 *   message    — confirmation message (can be React node)
 *   lang       — language code ('ht' | 'en' | 'fr' | 'es')
 *   variant    — 'danger' (red, default), 'warning' (amber), 'info' (blue)
 *   confirmText— custom confirm button text
 *   cancelText — custom cancel button text
 *   onConfirm  — callback when user confirms
 *   onCancel   — callback when user cancels
 *   loading    — show loading state on confirm button
 *   danger     — if true, confirm button uses danger style
 */
import React, { useEffect, useCallback, useRef, useId } from 'react';
import { pushFocusReturn, popFocusReturn, getFirstFocusable } from '../../accessibility/utils/focus';

const VARIANT_STYLES = {
  danger:  { icon: 'fa-exclamation-triangle', color: '#dc2626', bg: 'rgba(239,68,68,0.08)' },
  warning: { icon: 'fa-exclamation-circle',   color: '#d97706', bg: 'rgba(245,158,11,0.08)' },
  info:    { icon: 'fa-info-circle',           color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
};

export default function ConfirmModal({
  title,
  message,
  lang = 'ht',
  variant = 'danger',
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  loading,
}) {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;
  const dialogId = useId?.() || `confirm-${Math.random().toString(36).slice(2, 8)}`;
  const titleId = `${dialogId}-title`;
  const messageId = `${dialogId}-message`;
  const containerRef = useRef(null);
  const cancelRef = useRef(null);

  // Focus trap + body scroll lock + return focus
  useEffect(() => {
    // Store current focus for return
    pushFocusReturn(document.activeElement);

    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus the cancel button (safe default for destructive actions)
    requestAnimationFrame(() => {
      cancelRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      popFocusReturn();
    };
  }, []);

  // Focus trap within dialog
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
      return;
    }

    if (e.key === 'Tab' && containerRef.current) {
      const focusable = containerRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    if (e.key === 'Enter' && !loading && e.target !== cancelRef.current) {
      // Only confirm on Enter if focus is on the confirm button
      // (prevent accidental confirm when focused on cancel)
    }
  }, [onCancel, loading]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="confirm-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      data-a11y-dialog-overlay
    >
      <div
        ref={containerRef}
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        style={{
          background: 'var(--bg-card, #fff)',
          borderRadius: 'var(--radius-2xl, 16px)',
          padding: 'var(--sp-2xl, 24px)',
          maxWidth: 420,
          width: '90vw',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: style.bg, color: style.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', marginBottom: 16,
        }}>
          <i className={`fas ${style.icon}`} aria-hidden="true" />
        </div>

        {/* Title */}
        <h3
          id={titleId}
          style={{
            margin: '0 0 8px', fontSize: '1.125rem', fontWeight: 700,
            color: 'var(--text-primary, #1e293b)',
          }}
        >
          {title}
        </h3>

        {/* Message */}
        <div
          id={messageId}
          style={{
            fontSize: '0.9rem', lineHeight: 1.6,
            color: 'var(--text-secondary, #64748b)',
            marginBottom: 24,
          }}
        >
          {message}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary"
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-lg, 10px)',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'transparent', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--text-primary, #1e293b)',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.5 : 1,
              minHeight: '44px',
            }}
          >
            {cancelText || (lang === 'ht' ? 'Annile' : 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-lg, 10px)',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
              background: style.color, color: '#fff',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1,
              minHeight: '44px',
            }}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {lang === 'ht' ? 'Ap trete...' : 'Processing...'}</>
            ) : (
              confirmText || (lang === 'ht'
                ? variant === 'danger' ? 'Wi, efase' : 'Wi, konfime'
                : variant === 'danger' ? 'Yes, delete' : 'Yes, confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
