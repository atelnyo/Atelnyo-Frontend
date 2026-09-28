/**
 * src/accessibility/components/AccessibleDrawer.jsx
 *
 * Accessible side or bottom drawer (panel) component.
 *
 * Features:
 *   - Correct ARIA attributes (role="dialog", aria-modal)
 *   - Focus management (focus enters drawer, returns on close)
 *   - Escape to close
 *   - Overlay click to close
 *   - Body scroll lock
 *   - Accessible close button
 *   - Responsive: side on desktop, bottom on mobile
 *
 * Usage:
 *   <AccessibleDrawer
 *     isOpen={showPanel}
 *     onClose={closePanel}
 *     title="Settings"
 *     lang="en"
 *     side="right"
 *   >
 *     <p>Drawer content</p>
 *   </AccessibleDrawer>
 */
import React, { useRef, useEffect, useCallback, useId } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';
import { getA11yString } from '../utils/constants';

export default function AccessibleDrawer({
  isOpen,
  onClose,
  title,
  lang = 'en',
  children,
  side = 'right', // 'left' | 'right' | 'bottom'
  width = 320,
  className = '',
  closeOnEscape = true,
  closeOnOverlay = true,
  labelledBy,
}) {
  const drawerId = useId?.() || `a11y-drawer-${Math.random().toString(36).slice(2, 8)}`;
  const containerRef = useRef(null);
  const titleId = labelledBy || `${drawerId}-title`;

  useFocusTrap(containerRef, {
    isActive: isOpen,
    onEscape: closeOnEscape ? onClose : undefined,
    restoreFocus: true,
  });

  // Lock body scroll
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

  const isBottom = side === 'bottom';

  const drawerStyle = isBottom ? {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80vh',
    background: 'var(--surface-card, #fff)',
    borderRadius: 'var(--radius-2xl, 20px) var(--radius-2xl, 20px) 0 0',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
    overflow: 'auto',
    zIndex: 5001,
    padding: '0',
  } : {
    position: 'fixed',
    top: 0,
    bottom: 0,
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
    width: `${width}px`,
    maxWidth: '90vw',
    background: 'var(--surface-card, #fff)',
    borderRadius: side === 'left' ? '0 var(--radius-2xl, 20px) var(--radius-2xl, 20px) 0' : 'var(--radius-2xl, 20px) 0 0 var(--radius-2xl, 20px)',
    boxShadow: side === 'left'
      ? '4px 0 20px rgba(0,0,0,0.15)'
      : '-4px 0 20px rgba(0,0,0,0.15)',
    overflow: 'auto',
    zIndex: 5001,
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div
      className="a11y-drawer-overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'var(--surface-overlay, rgba(0,0,0,0.5))',
        backdropFilter: 'blur(4px)',
      }}
      data-a11y-drawer-overlay
    >
      <div
        ref={containerRef}
        className={`a11y-drawer a11y-drawer--${side} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={drawerStyle}
        data-a11y-drawer
      >
        {/* Header */}
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color-subtle, rgba(0,0,0,0.06))',
            flexShrink: 0,
          }}>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary, #1e293b)',
              }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={getA11yString(lang, 'closeDialog')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #64748b)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '8px',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
