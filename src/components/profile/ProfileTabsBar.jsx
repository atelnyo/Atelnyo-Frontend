import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PROFILE_TABS } from './profileConstants';

/**
 * TabsBar — glass sticky, swipe-friendly on mobile.
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * Includes touch swipe handling, scrollIntoView, arrow-key navigation, labelHt fallback.
 *
 * @param {{ activeTab: string, onChange: (id:string)=>void, lang: string, badges: Record<string, number>, items: Array<{id:string,label:string,labelHt:string,icon:string}> }} props
 */
export default function TabsBar({ activeTab, onChange, lang, badges, items }) {
  const tabItems = items || PROFILE_TABS;
  const tabsRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);

  const handleTouchStart = useCallback((e) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (touchStart == null) return;
      const diff = e.changedTouches[0].clientX - touchStart;
      const threshold = 60;
      if (Math.abs(diff) > threshold) {
        const currentIdx = tabItems.findIndex((t) => t.id === activeTab);
        if (diff < 0 && currentIdx < tabItems.length - 1) {
          onChange(tabItems[currentIdx + 1].id);
        } else if (diff > 0 && currentIdx > 0) {
          onChange(tabItems[currentIdx - 1].id);
        }
      }
      setTouchStart(null);
    },
    [touchStart, activeTab, onChange, tabItems],
  );

  // Scroll active tab into view
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(`#csp-tab-${activeTab}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  return (
    <div
      className="csp-tabs"
      role="tablist"
      aria-label="Profile tabs"
      ref={tabsRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {tabItems.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            id={`csp-tab-${tab.id}`}
            aria-controls={`csp-panel-${tab.id}`}
            className={`csp-tab ${isActive ? 'csp-tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const i = tabItems.findIndex((t) => t.id === tab.id);
              const next = e.key === 'ArrowRight'
                ? (i + 1) % tabItems.length
                : (i - 1 + tabItems.length) % tabItems.length;
              onChange(tabItems[next].id);
              requestAnimationFrame(() => {
                document.getElementById(`csp-tab-${tabItems[next].id}`)?.focus();
              });
            }}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true" />{' '}
            {lang === 'ht' ? tab.labelHt : tab.label}
            {badges?.[tab.id] != null && badges[tab.id] > 0 && (
              <span className="csp-tab-badge">{badges[tab.id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
