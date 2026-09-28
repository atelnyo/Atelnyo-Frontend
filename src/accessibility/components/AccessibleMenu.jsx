/**
 * src/accessibility/components/AccessibleMenu.jsx
 *
 * Accessible dropdown menu component.
 *
 * Features:
 *   - role="menu" / role="menuitem"
 *   - Arrow key navigation
 *   - Escape to close
 *   - Enter/Space to select
 *   - Home/End navigation
 *   - Focus management (focus enters menu on open)
 *   - aria-expanded on trigger
 *   - Disabled item support
 *
 * Usage:
 *   <AccessibleMenu
 *     trigger={<button>Options</button>}
 *     isOpen={menuOpen}
 *     onToggle={() => setMenuOpen(!menuOpen)}
 *     onClose={() => setMenuOpen(false)}
 *   >
 *     <AccessibleMenuItem onClick={handleEdit}>Edit</AccessibleMenuItem>
 *     <AccessibleMenuItem onClick={handleDelete} danger>Delete</AccessibleMenuItem>
 *   </AccessibleMenu>
 */
import React, { useRef, useCallback } from 'react';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';

export function AccessibleMenu({
  children,
  trigger,
  isOpen,
  onToggle,
  onClose,
  className = '',
  style = {},
}) {
  const menuRef = useRef(null);

  useKeyboardNavigation({
    containerRef: menuRef,
    isActive: isOpen,
    onEscape: onClose,
    itemSelector: '[role="menuitem"]:not([aria-disabled="true"])',
    orientation: 'vertical',
    wrap: true,
  });

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {React.cloneElement(trigger, {
        onClick: onToggle,
        'aria-haspopup': 'menu',
        'aria-expanded': isOpen,
      })}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={`a11y-menu ${className}`}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '180px',
            background: 'var(--surface-card, #fff)',
            border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '4px',
            zIndex: 5000,
            ...style,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function AccessibleMenuItem({
  children,
  onClick,
  disabled = false,
  danger = false,
  icon,
  className = '',
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled}
      onClick={() => { if (!disabled) onClick?.(); }}
      className={`a11y-menu-item ${className}`}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.85rem',
        fontWeight: 500,
        color: danger ? 'var(--state-error, #dc2626)' : 'var(--text-primary, #1e293b)',
        borderRadius: '8px',
        textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
        minHeight: '44px',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.target.style.background = 'var(--surface-highlight, rgba(0,0,0,0.04))'; }}
      onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
    >
      {icon && <i className={`fas ${icon}`} aria-hidden="true" style={{ fontSize: '0.8rem', width: '16px', textAlign: 'center' }} />}
      {children}
    </button>
  );
}

export function AccessibleMenuDivider() {
  return (
    <div
      role="separator"
      style={{
        height: '1px',
        background: 'var(--border-color-subtle, rgba(0,0,0,0.06))',
        margin: '4px 8px',
      }}
    />
  );
}
