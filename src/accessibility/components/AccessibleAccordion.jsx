/**
 * src/accessibility/components/AccessibleAccordion.jsx
 *
 * Accessible accordion component.
 *
 * Features:
 *   - Button semantics for triggers
 *   - aria-expanded state
 *   - aria-controls linking trigger to panel
 *   - Panel hidden via aria-hidden or conditional render
 *   - Keyboard: Enter/Space to toggle, optional Arrow navigation
 *
 * Usage:
 *   <AccessibleAccordion items={[
 *     { id: 'item-1', title: 'Section 1', content: <div>...</div> },
 *     { id: 'item-2', title: 'Section 2', content: <div>...</div> },
 *   ]} />
 */
import React, { useState, useCallback, useId } from 'react';

export default function AccessibleAccordion({
  items = [],
  allowMultiple = false,
  lang = 'en',
  className = '',
  defaultOpen = [],
}) {
  const groupId = useId?.() || `a11y-acc-${Math.random().toString(36).slice(2, 8)}`;
  const [openItems, setOpenItems] = useState(() => new Set(defaultOpen));

  const toggleItem = useCallback((id) => {
    setOpenItems((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [allowMultiple]);

  if (items.length === 0) return null;

  return (
    <div className={`a11y-accordion ${className}`} role="presentation">
      {items.map((item) => {
        const isOpen = openItems.has(item.id);
        const panelId = `${groupId}-panel-${item.id}`;
        const triggerId = `${groupId}-trigger-${item.id}`;

        return (
          <div key={item.id} className="a11y-accordion-item">
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                id={triggerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '14px 16px',
                  border: 'none',
                  background: isOpen ? 'var(--surface-highlight, rgba(0,0,0,0.03))' : 'transparent',
                  borderRadius: isOpen ? '10px 10px 0 0' : '10px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary, #1e293b)',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  minHeight: '44px',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.icon && <i className={`fas ${item.icon}`} aria-hidden="true" style={{ color: 'var(--color-primary, #d81b60)' }} />}
                  {item.title}
                </span>
                <i
                  className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}
                  aria-hidden="true"
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary, #64748b)',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
            </h3>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                style={{
                  padding: '0 16px 16px',
                  borderRadius: '0 0 10px 10px',
                  background: 'var(--surface-highlight, rgba(0,0,0,0.03))',
                }}
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
