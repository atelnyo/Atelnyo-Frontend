/**
 * ActionDrawer — Mobile-friendly + Desktop-aware slide-in drawer.
 *
 * Spec (Prompt 23 §4 — Media Drawer):
 *   - On desktop, drawer slides in from the right edge.
 *   - On mobile (or `position="bottom"`), drawer slides up from the
 *     bottom edge (existing behavior).
 *   - The two variants are toggled via the `position` prop.
 *   - Underlying page content is NEVER re-mounted behind the drawer.
 *
 * Features:
 *   - Overlay backdrop click to close
 *   - Grouped actions with section titles
 *   - Danger actions highlighted
 *   - Swipe down to close (mobile only)
 *   - Dark mode support
 *   - Keyboard: Escape closes (already wired)
 */
import React, { useEffect, useRef, useCallback } from 'react';

export default function ActionDrawer({
  open = false,
  title = '',
  actions = [],
  onClose,
  lang = 'ht',
  // 'bottom' = mobile slide-up (default)
  // 'right'  = desktop slide-from-right
  position = 'bottom',
}) {
  const isHt = lang === 'ht';
  const drawerRef = useRef(null);
  const touchStartY = useRef(0);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.();
  }, [onClose]);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (position !== 'bottom') return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 80) onClose?.();
  }, [onClose, position]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && open) onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const positionClass =
    position === 'right' ? 'action-drawer--right' : 'action-drawer--bottom';

  const groups = [];
  let currentGroup = null;
  actions.forEach((action) => {
    if (action.groupTitle) {
      currentGroup = { title: action.groupTitle, items: [] };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.items.push(action);
    } else {
      if (groups.length === 0 || groups[groups.length - 1].title) {
        groups.push({ title: null, items: [] });
      }
      groups[groups.length - 1].items.push(action);
    }
  });

  return (
    <div className={`action-drawer-overlay ${positionClass}`} onClick={handleBackdropClick}>
      <div
        ref={drawerRef}
        className={`action-drawer ${positionClass}`}
        onTouchStart={position === 'bottom' ? handleTouchStart : undefined}
        onTouchEnd={position === 'bottom' ? handleTouchEnd : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title || (isHt ? 'Aksyon' : 'Actions')}
      >
        {/* Handle (bottom variant only) */}
        {position === 'bottom' && (
          <div className="action-drawer-handle">
            <div className="action-drawer-handle-bar" />
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="action-drawer-header">
            <h3 className="action-drawer-title">{title}</h3>
            <button
              type="button"
              className="action-drawer-close"
              onClick={onClose}
              aria-label={isHt ? 'Fèmen' : 'Close'}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="action-drawer-body">
          {groups.map((group, gi) => (
            <div key={gi} className="action-drawer-group">
              {group.title && (
                <div className="action-drawer-group-title">{group.title}</div>
              )}
              {group.items.map((action, ai) => (
                <button
                  key={action.id || action.label || ai}
                  type="button"
                  className={`action-drawer-item ${action.danger ? 'action-drawer-item-danger' : ''} ${action.disabled ? 'action-drawer-item-disabled' : ''}`}
                  disabled={action.disabled}
                  aria-label={action.label || action.labelHt}
                  onClick={() => {
                    action.action?.();
                    if (!action.keepOpen) onClose?.();
                  }}
                >
                  {action.icon && (
                    <span className="action-drawer-item-icon" aria-hidden="true">
                      <i className={`fas ${action.icon}`} />
                    </span>
                  )}
                  <span className="action-drawer-item-label">
                    {action.label || action.labelHt}
                  </span>
                  {action.description && (
                    <span className="action-drawer-item-desc">{action.description}</span>
                  )}
                  {action.badge != null && (
                    <span className="action-drawer-item-badge">{action.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Cancel (bottom variant only — desktop right uses the X button) */}
        {position === 'bottom' && (
          <div className="action-drawer-footer">
            <button type="button" className="action-drawer-cancel" onClick={onClose}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
