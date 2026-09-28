/**
 * src/accessibility/components/AccessibleTabs.jsx
 *
 * Accessible tabs component following WAI-ARIA Tabs pattern.
 *
 * Features:
 *   - role="tablist" / role="tab" / role="tabpanel"
 *   - aria-selected, aria-controls, aria-labelledby
 *   - Arrow key navigation between tabs
 *   - Home/End to jump to first/last tab
 *   - Tab key moves focus to the panel content
 *   - Visible focus indicators
 *
 * Usage:
 *   <AccessibleTabs
 *     tabs={[
 *       { id: 'tab-1', label: 'Overview', content: <div>...</div> },
 *       { id: 'tab-2', label: 'Lessons', content: <div>...</div> },
 *     ]}
 *     lang="en"
 *   />
 */
import React, { useState, useRef, useCallback, useId } from 'react';

export default function AccessibleTabs({
  tabs = [],
  defaultTab,
  lang = 'en',
  className = '',
  tabClassName = '',
  panelClassName = '',
  onChange,
}) {
  const groupId = useId?.() || `a11y-tabs-${Math.random().toString(36).slice(2, 8)}`;
  const [activeIndex, setActiveIndex] = useState(() => {
    if (defaultTab) {
      const idx = tabs.findIndex((t) => t.id === defaultTab);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const tabRefs = useRef([]);

  const selectTab = useCallback((index) => {
    if (index < 0 || index >= tabs.length) return;
    setActiveIndex(index);
    tabRefs.current[index]?.focus();
    onChange?.(tabs[index]?.id, index);
  }, [tabs, onChange]);

  const handleKeyDown = useCallback((e) => {
    const len = tabs.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        selectTab((activeIndex + 1) % len);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        selectTab((activeIndex - 1 + len) % len);
        break;
      case 'Home':
        e.preventDefault();
        selectTab(0);
        break;
      case 'End':
        e.preventDefault();
        selectTab(len - 1);
        break;
      default:
        break;
    }
  }, [activeIndex, tabs, selectTab]);

  if (tabs.length === 0) return null;

  const activeTab = tabs[activeIndex];

  return (
    <div className={`a11y-tabs ${className}`}>
      {/* Tab list */}
      <div
        role="tablist"
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '2px solid var(--border-color, rgba(0,0,0,0.08))',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map((tab, index) => {
          const panelId = `${groupId}-${tab.id}`;
          const isSelected = index === activeIndex;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              id={`tab-${panelId}`}
              aria-controls={panelId}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTab(index)}
              className={`a11y-tab ${tabClassName}`}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.9rem',
                color: isSelected ? 'var(--color-primary, #d81b60)' : 'var(--text-secondary, #64748b)',
                borderBottom: isSelected ? '2px solid var(--color-primary, #d81b60)' : '2px solid transparent',
                marginBottom: '-2px',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                minHeight: '44px',
                fontFamily: 'inherit',
              }}
            >
              {tab.icon && <i className={`fas ${tab.icon}`} aria-hidden="true" style={{ marginRight: '6px' }} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {activeTab && (
        <div
          role="tabpanel"
          id={`${groupId}-${activeTab.id}`}
          aria-labelledby={`tab-${groupId}-${activeTab.id}`}
          tabIndex={0}
          className={`a11y-tabpanel ${panelClassName}`}
          style={{
            padding: '20px 0',
            outline: 'none',
          }}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
