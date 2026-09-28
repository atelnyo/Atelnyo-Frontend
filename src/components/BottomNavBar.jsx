/**
 * src/components/BottomNavBar.jsx
 *
 * Shared bottom navigation bar — Phase 10 accessibility upgrades:
 *   - role="navigation" with aria-label
 *   - aria-current="page" on active tab
 *   - aria-hidden="true" on decorative icons
 *   - Proper labels on all tabs
 *   - Minimum 44px touch targets
 */
import React, { startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { SHEETS } from '../routes/sheets';

const BottomNavBar = ({
  activeTab,
  setActiveTab,
  lang,
  t,
  isStaff = false,
  showSettings = false,
  onNavigate,
}) => {
  const navigate = useSafeNavigate();
  const location = useLocation();
  const isHt = lang === 'ht';

  const handleTabClick = (tabId) => {
    if (onNavigate) {
      onNavigate(tabId);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <nav
      className="bottom-nav-bar"
      role="navigation"
      aria-label={isHt ? 'Navigasyon anba' : 'Bottom navigation'}
    >
      <button
        type="button"
        className={`bottom-nav-item ${activeTab === 'explore' ? 'active' : ''}`}
        onClick={() => handleTabClick('explore')}
        aria-current={activeTab === 'explore' ? 'page' : undefined}
        aria-label={t.tab_explore || 'Explore'}
      >
        <i className="fas fa-compass" aria-hidden="true" />
        <span>{t.tab_explore || 'Explore'}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${location.pathname.startsWith('/sheet/learn') ? 'active' : ''}`}
        onClick={() => {
          if (location.pathname.startsWith('/sheet/learn')) return;
          startTransition(() => navigate(SHEETS.LEARN));
        }}
        aria-current={location.pathname.startsWith('/sheet/learn') ? 'page' : undefined}
        aria-label={isHt ? 'Aprann' : 'Learn'}
      >
        <i className="fas fa-book-open" aria-hidden="true" />
        <span>{isHt ? 'Aprann' : 'Learn'}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${activeTab === 'mwen' ? 'active' : ''}`}
        onClick={() => handleTabClick('mwen')}
        data-testid="mwen-nav-item"
        aria-current={activeTab === 'mwen' ? 'page' : undefined}
        aria-label={t.tab_mwen || (isHt ? 'Mwen' : 'Mine')}
      >
        <i className="fas fa-bookmark" aria-hidden="true" />
        <span>{t.tab_mwen || (isHt ? 'Mwen' : 'Mine')}</span>
      </button>

      {isStaff && (
        <button
          type="button"
          className={`bottom-nav-item ${location.pathname.startsWith('/sheet/admin') ? 'active' : ''}`}
          onClick={() => {
            if (location.pathname.startsWith('/sheet/admin')) return;
            startTransition(() => navigate(SHEETS.ADMIN_DASHBOARD));
          }}
          aria-current={location.pathname.startsWith('/sheet/admin') ? 'page' : undefined}
          aria-label="Admin Panel"
        >
          <i className="fas fa-shield-halved" aria-hidden="true" />
          <span>Admin</span>
        </button>
      )}

      {showSettings && (
        <button
          type="button"
          className={`bottom-nav-item ${location.pathname === SHEETS.SETTINGS ? 'active' : ''}`}
          onClick={() => {
            if (location.pathname === SHEETS.SETTINGS) return;
            startTransition(() => navigate(SHEETS.SETTINGS));
          }}
          aria-current={location.pathname === SHEETS.SETTINGS ? 'page' : undefined}
          aria-label={isHt ? 'Paramèt' : 'Settings'}
        >
          <i className="fas fa-cog" aria-hidden="true" />
          <span>{isHt ? 'Paramèt' : 'Settings'}</span>
        </button>
      )}
    </nav>
  );
};

export default BottomNavBar;
