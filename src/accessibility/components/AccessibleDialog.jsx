/**
 * src/accessibility/components/AccessibleDialog.jsx
 *
 * Reusable accessible dialog component.
 *
 * Features:
 *   - Correct ARIA attributes (role="dialog", aria-modal, aria-labelledby)
 *   - Focus trap (Tab cycling within dialog)
 *   - Escape to close
 *   - Focus returns to trigger element on close
 *   - Background scroll lock
 *   - Overlay click to close (configurable)
 *   - Accessible close button with aria-label
 *
 * Usage:
 *   <AccessibleDialog
 *     isOpen={showModal}
 *     onClose={closeModal}
 *     title="Confirm Delete"
 *     lang="en"
 *   >
 *     <p>Are you sure you want to delete this?</p>
 *   </AccessibleDialog>
 */
import React, { useRef, useEffect, useCallback, useId } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';
import { getA11yString } from '../utils/constants';

export default function AccessibleDialog({
  isOpen,
  onClose,
  title,
  titleId,
  lang = 'en',
  children,
  className = '',
  overlayClassName = '',
  closeOnOverlay = true,
  closeOnEscape = true,
  width = 440,
  showCloseButton = true,
  labelledBy,
  describedBy,
}) {
  const dialogId = useId?.() || `a11y-dialog-${Math.random().toString(36).slice(2, 8)}`;
  const containerRef = useRef(null);

  const effectiveTitleId = labelledBy || titleId || `${dialogId}-title`;

  // Focus trap
  useFocusTrap(containerRef, {
    isActive: isOpen,
    onEscape: closeOnEscape ? onClose : undefined,
    restoreFocus: true,
  });

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const handleOverlayClick = useCallback((e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose?.();
    }
  }, [closeOnOverlay, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`a11y-dialog-overlay ${overlayClassName}`}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--modal-backdrop, rgba(0,0,0,0.7))',
        backdropFilter: 'blur(4px)',
        padding: '20px',
      }}
      data-a11y-dialog-overlay
    >
      <div
        ref={containerRef}
        className={`a11y-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={effectiveTitleId}
        aria-describedby={describedBy || undefined}
        style={{
          background: 'var(--modal-bg, var(--surface-card, #fff))',
          borderRadius: 'var(--modal-radius, 20px)',
          padding: 'var(--modal-padding, 32px)',
          maxWidth: `${width}px`,
          width: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: 'var(--modal-shadow, 0 20px 60px rgba(0,0,0,0.25))',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
        }}>
          {title && (
            <h2
              id={effectiveTitleId}
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary, #1e293b)',
                flex: 1,
              }}
            >
              {title}
            </h2>
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label={getA11yString(lang, 'closeModal')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #64748b)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
                flexShrink: 0,
                lineHeight: 1,
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              data-a11y-dialog-close
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="a11y-dialog-body">
          {children}
        </div>
      </div>
    </div>
  );
}
