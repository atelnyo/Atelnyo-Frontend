/**
 * src/components/Header.jsx
 *
 * Global header with:
 *   - Settings cog
 *   - Brand name
 *   - Search trigger
 *   - Notification bell
 *   - Theme toggle
 *   - Profile menu (avatar + username + dropdown)
 *   - Language switcher dropdown
 *   - Creator Studio shortcut (if user.is_creator)
 *   - Admin shortcut (if user.is_staff || user.is_superuser)
 *   - All using Theme Engine CSS variables
 */
import React, { useState, useRef, useEffect, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import useSafeNavigate from '../hooks/useSafeNavigate';
import { creatorProfileService } from '../services/api';
import { SHEETS } from '../routes/sheets';
import { getUserIdentity } from '../utils/userIdentity';
import { t2 } from '../utils/i18n';

const LANGUAGES = [
  { code: 'ht', label: 'Kreyòl' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

const Header = ({
  lang,
  translations,
  toggleTheme,
  darkMode,
  onOpenSearch,
  onBellClick,
  isNotifOpen,
  unreadNotifCount = 0,
  bellSwing = false,
  user,
  onLogout,
  onLangChange,
}) => {
  const navigate = useSafeNavigate();
  const location = useLocation();
  const t = translations[lang] || translations?.ht || {};
  const identity = getUserIdentity(user);

  // ─── Fetch creator avatar_url from CreatorProfile ────────────────
  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState(null);
  useEffect(() => {
    if (!user?.is_creator || !identity.creatorLookupKey) {
      // Reset the cached avatar when the identity flips to a
      // non-creator — intentional effect-driven sync, not a cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreatorAvatarUrl(null);
      return;
    }
    let cancelled = false;
    creatorProfileService.get(identity.creatorLookupKey)
      .then((res) => {
        if (cancelled) {return;}
        const avatar = res?.data?.avatar_url;
        if (avatar) {setCreatorAvatarUrl(avatar);}
      })
      .catch(() => { if (!cancelled) {setCreatorAvatarUrl(null);} });
    return () => { cancelled = true; };
  }, [identity.creatorLookupKey, user?.is_creator]);

  // Avatar source: the creator public-profile avatar (fetched above)
  // first, then the user payload's avatar_url (Google photo for a
  // Google sign-in — visible for every user, creator or not), else
  // initials.
  const avatarSrc = creatorAvatarUrl || user?.avatar_url || '';

  // ─── Profile dropdown state ───────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const profileRef = useRef(null);
  const langRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Keep --layout-header-height in sync with the live header ─────
  // Sticky surfaces below the header (.explore-search-wrap) stick at
  // var(--layout-header-height). tokens.css defaults it to 69px, but
  // if the header wraps or the OS scales fonts the real height differs
  // — measuring it live keeps the sticky offset exact so the Explore
  // search bar never gaps or slides under the header (unstable top).
  useEffect(() => {
    const el = document.querySelector('.app-header');
    if (!el) return undefined;
    const update = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty('--layout-header-height', `${h}px`);
      }
    };
    update();
    window.addEventListener('resize', update);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, []);

  const openSettings = () => startTransition(() => navigate(SHEETS.SETTINGS));

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <header className="app-header" role="banner" aria-label={t2(lang, { ht: 'Navigasyon prensipal', en: 'Main navigation', fr: 'Navigation principale', es: 'Navegación principal' })}>
      {/* Left: Settings */}
      <button className="icon-btn header-btn" onClick={openSettings} title={t.settings} aria-label={t.settings}>
        <i className="fas fa-cog" aria-hidden="true" />
      </button>

      {/* Center: Brand name */}
      <h1 className="app-header__brand">
        <i className="fas fa-graduation-cap" aria-hidden="true" />
        <span>{t.brand_name}</span>
      </h1>

      {/* Right: actions */}
      <div className="app-header__actions">
        {/* Creator shortcut */}
        {user?.is_creator && (
          <button
            className="icon-btn header-btn header-creator-btn"
            onClick={() => startTransition(() => navigate(SHEETS.STUDIO))}
            title="Creator Studio"
            aria-label="Creator Studio"
          >
            <i className="fas fa-crown" aria-hidden="true" />
          </button>
        )}

        {/* Admin shortcut */}
        {(user?.is_staff || user?.is_superuser) && (
          <button
            className="icon-btn header-btn header-admin-btn"
            onClick={() => startTransition(() => navigate(SHEETS.ADMIN_DASHBOARD))}
            title="Admin Dashboard"
            aria-label="Admin Dashboard"
          >
            <i className="fas fa-shield-halved" aria-hidden="true" />
          </button>
        )}

        {/* Search */}
        {typeof onOpenSearch === 'function' && (
          <button
            className="icon-btn header-btn"
            onClick={onOpenSearch}
            title={t2(lang, { ht: 'Chèche (Ctrl+K)', fr: 'Rechercher (Ctrl+K)', es: 'Buscar (Ctrl+K)', en: 'Search (Ctrl+K)' })}
            aria-label={t2(lang, { ht: 'Chèche', fr: 'Rechercher', es: 'Buscar', en: 'Search' })}
          >
            <i className="fas fa-search" aria-hidden="true" />
          </button>
        )}

        {/* Notification bell */}
        {typeof onBellClick === 'function' && (
          <button
            className={`icon-btn header-btn notif-bell-btn${isNotifOpen ? ' is-open' : ''}${unreadNotifCount > 0 ? ' has-unread' : ''}${bellSwing ? ' is-swinging' : ''}`}
            onClick={onBellClick}
            title={t2(lang, { ht: 'Notifikasyon', fr: 'Notifications', es: 'Notificaciones', en: 'Notifications' })}
            aria-label={lang === 'ht' ? `${unreadNotifCount} notifikasyon nouvo` : lang === 'fr' ? `${unreadNotifCount} nouvelles notifications` : lang === 'es' ? `${unreadNotifCount} notificaciones nuevas` : `${unreadNotifCount} new notifications`}
            aria-haspopup="true"
            aria-expanded={isNotifOpen}
          >
            <i className="fas fa-bell" aria-hidden="true" />
            {unreadNotifCount > 0 && (
              /* key={count} remounts the badge on each change so the pop
                 animation replays; .is-many widens the pill for 99+ */
              <span key={unreadNotifCount} className={`notif-bell-badge${unreadNotifCount > 99 ? ' is-many' : ''}`} aria-hidden="true">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
        )}

        {/* Theme toggle */}
        <button className="icon-btn header-btn" onClick={toggleTheme} title={t.toggle_theme} aria-label={t.toggle_theme}>
          <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`} aria-hidden="true" />
        </button>

        {/* Language switcher */}
        <div className="header-lang-wrapper" ref={langRef}>
          <button
            className="icon-btn header-btn header-lang-btn"
            onClick={() => setLangOpen((o) => !o)}
            title={t2(lang, { ht: 'Lang', fr: 'Langue', es: 'Idioma', en: 'Language' })}
            aria-label={t2(lang, { ht: 'Chwazi lang', fr: 'Choisir la langue', es: 'Elegir idioma', en: 'Choose language' })}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
          >
            <i className="fas fa-language" aria-hidden="true" />
          </button>
          {langOpen && (
            <div className="header-dropdown header-lang-dropdown">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`header-dropdown-item${l.code === lang ? ' active' : ''}`}
                  onClick={() => {
                    if (onLangChange) {onLangChange(l.code);}
                    setLangOpen(false);
                  }}
                >
                  <span className="header-lang-label">{l.label}</span>
                  <span className="header-lang-code">{l.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profile menu — only when logged in */}
        {user && (
          <div className="header-profile-wrapper" ref={profileRef}>
            <button
              className="header-profile-btn"
              onClick={() => setProfileOpen((o) => !o)}
              aria-label={identity.displayLabel || (t2(lang, { ht: 'Pwofil', fr: 'Profil', es: 'Perfil', en: 'Profile' }))}
              aria-haspopup="true"
              aria-expanded={profileOpen}
            >
              <div className="header-avatar">
                {avatarSrc ? (
                  <img className="header-avatar-img" src={avatarSrc} alt={identity.displayName}
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = identity.initial || '?'; }}
                  />
                ) : (
                  identity.initial || '?'
                )}
              </div>
              <span className="header-username">{identity.displayLabel || identity.displayName}</span>
              <i className={`fas fa-chevron-${profileOpen ? 'up' : 'down'} header-chevron`} />
            </button>

            {profileOpen && (
              <div className="header-dropdown header-profile-dropdown">
                <div className="header-dropdown-user">
                  <div className="header-avatar header-avatar-lg">
                    {avatarSrc ? (
                      <img className="header-avatar-img" src={avatarSrc} alt={identity.displayName}
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = identity.initial || '?'; }}
                      />
                    ) : (
                      identity.initial || '?'
                    )}
                  </div>
                  <div className="header-dropdown-user-meta">
                    <div className="header-dropdown-user-name">{identity.displayName}</div>
                    <div className="header-dropdown-user-email">{identity.email || ''}</div>
                  </div>
                </div>
                <div className="header-dropdown-divider" />
                <button
                  type="button"
                  className="header-dropdown-item"
                  onClick={() => { setProfileOpen(false); openSettings(); }}
                >
                  <i className="fas fa-gear" />
                  <span>{t.settings || 'Settings'}</span>
                </button>
                {user.is_creator && (
                  <button
                    type="button"
                    className="header-dropdown-item"
                    onClick={() => { setProfileOpen(false); startTransition(() => navigate(SHEETS.STUDIO)); }}
                  >
                    <i className="fas fa-crown" />
                    <span>{t.mwen_studio || 'Creator Studio'}</span>
                  </button>
                )}
                {/* Phase Business — every account can manage Business
                    Profiles (separate identity from the Creator branch).
                    The hub is owner-scoped; a first-time visitor gets the
                    create CTA instead of a 404. */}
                <button
                  type="button"
                  className="header-dropdown-item"
                  onClick={() => { setProfileOpen(false); startTransition(() => navigate(SHEETS.BUSINESS)); }}
                  data-testid="header-business-link"
                >
                  <i className="fas fa-store" />
                  <span>{t.business_hub_title || (t2(lang, { ht: 'Biznis mwen', en: 'My Businesses' }))}</span>
                </button>
                {(user.is_staff || user.is_superuser) && (
                  <button
                    type="button"
                    className="header-dropdown-item"
                    onClick={() => { setProfileOpen(false); startTransition(() => navigate(SHEETS.ADMIN_DASHBOARD)); }}
                  >
                    <i className="fas fa-shield-halved" />
                    <span>Admin Dashboard</span>
                  </button>
                )}
                <div className="header-dropdown-divider" />
                <button
                  type="button"
                  className="header-dropdown-item header-dropdown-item-danger"
                  onClick={() => { setProfileOpen(false); if (onLogout) {onLogout('user');} }}
                >
                  <i className="fas fa-sign-out-alt" />
                  <span>{t.logout || (t2(lang, { ht: 'Dekonekte', en: 'Logout' }))}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
