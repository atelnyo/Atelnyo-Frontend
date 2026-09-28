/**
 * ContextMenu — Right-click context menu for media items.
 *
 * Features:
 *   - Positioned at cursor on right-click
 *   - Dismiss on click outside / Escape
 *   - Nested submenus
 *   - Icons per action
 *   - Keyboard navigation (arrow keys)
 *   - Dark mode support
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function ContextMenu({
  items = [],
  position,
  onClose,
}) {
  const menuRef = useRef(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const handleClickOutside = useCallback((e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      onClose?.();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIndex((i) => Math.min(i + 1, items.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && items[focusIndex]) {
      e.preventDefault();
      if (items[focusIndex].children) {
        setActiveSubmenu(activeSubmenu === focusIndex ? null : focusIndex);
      } else {
        items[focusIndex].action?.();
        onClose?.();
      }
    }
  }, [items, focusIndex, activeSubmenu, onClose]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Auto-position to stay within viewport
  const style = position ? {
    left: Math.min(position.x, window.innerWidth - 240),
    top: Math.min(position.y, window.innerHeight - items.length * 44 - 20),
  } : {};

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={style}
      role="menu"
      tabIndex={-1}
    >
      {items.map((item, i) => (
        <div key={item.id || item.label || i}>
          {item.separator ? (
            <div className="context-menu-separator" />
          ) : (
            <button
              type="button"
              className={`context-menu-item ${focusIndex === i ? 'context-menu-item-focused' : ''}`}
              role="menuitem"
              disabled={item.disabled}
              onMouseEnter={() => setFocusIndex(i)}
              onClick={() => {
                if (item.children) {
                  setActiveSubmenu(activeSubmenu === i ? null : i);
                } else {
                  item.action?.();
                  onClose?.();
                }
              }}
            >
              {item.icon && (
                <span className="context-menu-icon">
                  <i className={`fas ${item.icon}`} />
                </span>
              )}
              <span className="context-menu-label">{item.label || item.labelHt}</span>
              {item.shortcut && (
                <span className="context-menu-shortcut">{item.shortcut}</span>
              )}
              {item.children && (
                <span className="context-menu-arrow">
                  <i className="fas fa-chevron-right" />
                </span>
              )}
              {item.badge != null && (
                <span className="context-menu-badge">{item.badge}</span>
              )}
            </button>
          )}
          {/* Submenu */}
          {item.children && activeSubmenu === i && (
            <div className="context-menu-submenu">
              {item.children.map((child, j) => (
                <button
                  key={child.id || child.label || j}
                  type="button"
                  className="context-menu-item"
                  disabled={child.disabled}
                  onClick={() => {
                    child.action?.();
                    onClose?.();
                  }}
                >
                  {child.icon && (
                    <span className="context-menu-icon">
                      <i className={`fas ${child.icon}`} />
                    </span>
                  )}
                  <span className="context-menu-label">{child.label || child.labelHt}</span>
                  {child.shortcut && (
                    <span className="context-menu-shortcut">{child.shortcut}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
