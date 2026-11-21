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
  const tablistLabel = lang === 'ht'
    ? 'Onglet pwofil'
    : lang === 'fr' ? 'Onglets du profil' : 'Profile tabs';

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (touchStart == null) return;
      const touch = e.changedTouches?.[0];
      if (!touch) { setTouchStart(null); return; }
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      // A mostly-vertical gesture is a page scroll, not a tab swipe.
      const isHorizontalSwipe = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2;
      if (isHorizontalSwipe) {
        const currentIdx = tabItems.findIndex((t) => t.id === activeTab);
        if (dx < 0 && currentIdx < tabItems.length - 1) {
          onChange(tabItems[currentIdx + 1].id);
        } else if (dx > 0 && currentIdx > 0) {
          onChange(tabItems[currentIdx - 1].id);
        }
      }
      setTouchStart(null);
    },
    [touchStart, activeTab, onChange, tabItems],
  );

  // Scroll active tab into view; respect reduced motion and browsers that
  // do not implement scrollIntoView (older embedded webviews).
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(`#csp-tab-${activeTab}`);
    if (!activeEl) return;
    const reduceMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeEl.scrollIntoView?.({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeTab]);

  const handleTabKeyDown = useCallback((event, tab) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabItems.findIndex((item) => item.id === tab.id);
    let nextIndex = index;
    if (event.key === 'ArrowRight') { nextIndex = (index + 1) % tabItems.length; }
    else if (event.key === 'ArrowLeft') { nextIndex = (index - 1 + tabItems.length) % tabItems.length; }
    else if (event.key === 'Home') { nextIndex = 0; }
    else { nextIndex = tabItems.length - 1; }

    const nextTab = tabItems[nextIndex];
    onChange(nextTab.id);
    const focusTab = () => document.getElementById(`csp-tab-${nextTab.id}`)?.focus();
    if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(focusTab); }
    else { focusTab(); }
  }, [onChange, tabItems]);

  return (
    <div
      className="csp-tabs"
      role="tablist"
      aria-label={tablistLabel}
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
            onKeyDown={(event) => handleTabKeyDown(event, tab)}
          >
            <i className={tab.icon.startsWith('fab ') ? tab.icon : `fas ${tab.icon}`} aria-hidden="true" />{' '}
            {lang === 'ht' ? tab.labelHt : lang === 'fr' ? tab.labelFr : tab.label}
            {badges?.[tab.id] != null && badges[tab.id] > 0 && (
              <span className="csp-tab-badge">{badges[tab.id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
