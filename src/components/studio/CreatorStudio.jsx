/**
 * src/components/studio/CreatorStudio.jsx
 *
 * Creator Studio — The professional workspace for Atelnyo creators.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  Header (back + title + notification bell)  │
 *   ├──────────┬──────────────────────────────────┤
 *   │ Sidebar  │  Main Content Area               │
 *   │ Nav      │  (changes per section)           │
 *   │          │                                   │
 *   │ • 📊    │  Dashboard · Courses · Music      │
 *   │ • 🎬    │  Products · Portfolio · Analytics │
 *   │ • 🎵    │  Wallet · Messages · Settings     │
 *   │ • 🛒    │                                   │
 *   │ • 🎨    │                                   │
 *   │ • 📈    │                                   │
 *   │ • 💰    │                                   │
 *   │ • 💬    │                                   │
 *   │ • ⚙️    │                                   │
 *   └──────────┴──────────────────────────────────┘
 *
 * Creator gating: Redirects non-creators to / (root) with a toast.
 * Uses user?.is_creator from the Django UserSerializer.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSafeNavigate from '../../hooks/useSafeNavigate';
import { translations } from '../../data/translations';
import { creatorProfileService, courseService } from '../../services/api';
import { getUserIdentity } from '../../utils/userIdentity';
// Continuity — the Studio is the WORKSPACE slice of the continuity
// state; it reports which section/media tab the user is on via the
// manager's façade (never appStateStore directly).
import continuityManager from '../../pwa/continuity/ContinuityManager';
import styles from './CreatorStudio.module.css';
import MediaProviderSection from './MediaProviderSection';
import TikTokConnect from './TikTokConnect'; // TikTok OAuth card — TIKTOK_INTEGRATION_PLAN.md Faz A.6
import MediaLibrary from './MediaLibrary';
import MediaHub from './MediaHub';
import MyMediaDashboard from './MyMediaDashboard';
import WelcomeChecklist from '../WelcomeChecklist';
import CreatorProfileHealth from './CreatorProfileHealth';
import {
  ProjectFormModal,
  WithdrawModal,
  ProfileEditModal,
  BrandingModal,
  NotificationSettingsModal,
  VerificationModal,
  PasswordChangeModal,
  TalentFormModal,
  JobFormModal,
  EventFormModal,
  AvatarEditModal,
} from './modals';
// Editor-first workspaces — full-viewport creator editors that replace
// the old creation-form modals for the main content types. They share
// one StudioEditorShell and keep the exact same API/save behavior.
import CourseEditor from './editor/CourseEditor';
import CourseTypeModal from './editor/CourseTypeModal';
import MusicEditor from './editor/MusicEditor';
import ProductEditor from './editor/ProductEditor';
import ProductTypeModal from './editor/ProductTypeModal';
import { classNames } from './shared';
import {
  DashboardSection,
  CoursesSection,
  MusicSection,
  OrdersSection,
  ProductsSection,
  PortfolioSection,
  AnalyticsSection,
  WalletSection,
  MessagesSection,
  SettingsSection,
  PromotionsSection,
  TalentSection,
  JobsSection,
  EventsSection,
  CommunitiesSection,
  ProposalsSection,
  ContractsSection,
  LevelsBadgesSection,
} from './sections';
// Heavy sections — lazy-loaded to split the CreatorStudio chunk
const PublicProfileSection = React.lazy(() => import('./sections/PublicProfileSection'));
const AffiliateSection = React.lazy(() => import('./sections/AffiliateSection'));
const IntelligenceSection = React.lazy(() => import('./sections/IntelligenceSection'));
const ProfileSettingsSection = React.lazy(() => import('./sections/ProfileSettingsSection'));
const CompanySection = React.lazy(() => import('./sections/CompanySection'));

// ─── Sidebar config — grouped into categories ─────────────────────────────
// The sidebar renders each category as a labeled block so the 21 sections
// read as: Main · Content · Business · Profile & Settings.

const SIDEBAR_CATEGORIES = [
  {
    id: 'main',
    label: 'Main',
    labelHt: 'Prensipal',
    items: [
      { id: 'dashboard',   icon: 'fa-chart-pie',       label: 'Dashboard',      labelHt: 'Tablodbò' },
      { id: 'levels_badges', icon: 'fa-medal',         label: 'Levels & Badges', labelHt: 'Nivo ak Badge' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    labelHt: 'Kontni',
    items: [
      { id: 'courses',     icon: 'fa-graduation-cap',   label: 'Courses',       labelHt: 'Kou' },
      { id: 'music',       icon: 'fa-music',            label: 'Music',         labelHt: 'Mizik' },
      { id: 'talent',      icon: 'fa-star',             label: 'Talents',       labelHt: 'Talan' },
      { id: 'jobs',        icon: 'fa-file-signature',   label: 'Jobs',          labelHt: 'Travay' },
      { id: 'events',      icon: 'fa-calendar-check',   label: 'Events',        labelHt: 'Evènman' },
      { id: 'communities', icon: 'fa-users',            label: 'Communities',   labelHt: 'Kominote' },
      { id: 'products',    icon: 'fa-cube',             label: 'Products',      labelHt: 'Pwodwi' },
      { id: 'portfolio',   icon: 'fa-briefcase',        label: 'Portfolio',     labelHt: 'Pòtfolyo' },
      { id: 'media',       icon: 'fa-cloud-upload-alt', label: 'Media',         labelHt: 'Medya' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    labelHt: 'Biznis',
    items: [
      { id: 'analytics',   icon: 'fa-chart-line',       label: 'Analytics',     labelHt: 'Analitik' },
      { id: 'orders',      icon: 'fa-cart-shopping',    label: 'Orders',        labelHt: 'Lòd' },
      { id: 'wallet',      icon: 'fa-wallet',           label: 'Wallet',        labelHt: 'Bous' },
      { id: 'messages',    icon: 'fa-envelope',         label: 'Messages',      labelHt: 'Mesaj' },
      { id: 'proposals',   icon: 'fa-inbox',            label: 'Proposals',     labelHt: 'Proposal' },
      { id: 'contracts',   icon: 'fa-handshake',        label: 'Contracts',     labelHt: 'Kontra' },
      { id: 'affiliate',   icon: 'fa-handshake',        label: 'Affiliate',     labelHt: 'Afilye' },
      { id: 'promotions',  icon: 'fa-tags',             label: 'Promotions',    labelHt: 'Promosyon' },
      { id: 'intelligence', icon: 'fa-brain',           label: 'Intelligence',  labelHt: 'Intelligence' },
      { id: 'company',     icon: 'fa-building',         label: 'Company',       labelHt: 'Konpanyi' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile & Settings',
    labelHt: 'Pwofil & Anviwònman',
    items: [
      { id: 'public_profile',   icon: 'fa-user-circle', label: 'Public Profile',   labelHt: 'Pwofil Piblik' },
      { id: 'settings',         icon: 'fa-sliders-h',   label: 'Settings',         labelHt: 'Anviwònman' },
      { id: 'profile_settings', icon: 'fa-sliders-h',   label: 'Profile Settings', labelHt: 'Anviwònman Pwofil' },
    ],
  },
];

// Flat list (deep-links, lookups) — category order preserved.
const SIDEBAR_SECTIONS = SIDEBAR_CATEGORIES.flatMap((cat) => cat.items);

// ─── ═══════════════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
//
// Shared primitives (StatCard, EmptyState, StudioSkeleton, WelcomeHeader,
// QuickActions, PendingActions, and helpers) are now imported from ./shared/
// (Etap 1 refactor — 2026-07-19).

//
// All sections extracted to ./sections/ (Etap 2 refactor — 2026-07-19).
//

// ─── ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function CreatorStudio({ lang = 'ht', showToast, user }) {
  const navigate = useSafeNavigate();
  const t = translations?.[lang] || translations?.ht || {};
  const identity = getUserIdentity(user);
  // Deep-link support: /sheet/studio?section=public_profile (used by the
  // "Edit profile" button on the public page and the Profile Settings CTA
  // in the editor) opens the studio on the requested section.
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(() => {
    const fromUrl = searchParams.get('section');
    return fromUrl && SIDEBAR_SECTIONS.some((s) => s.id === fromUrl)
      ? fromUrl
      : 'dashboard';
  });
  const [activeMediaTab, setActiveMediaTab] = useState(() => {
    const fromUrl = searchParams.get('mediaTab');
    return ['hub', 'provider', 'library', 'tiktok'].includes(fromUrl) ? fromUrl : 'hub';
  });
  const [mobileSidebar, setMobileSidebar] = useState(false);
  // Continuity — persist the workspace slice (media sub-tab) whenever
  // it changes, so a relaunch restores the exact media surface.
  useEffect(() => {
    continuityManager.saveWorkspaceState({ mediaTab: activeMediaTab }).catch(() => {});
  }, [activeMediaTab]);
  // Modal state — one per section type (replaces placeholder toasts)
  // Course creation never starts with a form: a delivery-type chooser
  // (Teach on Atelnyo / Teach elsewhere) opens first, then the editor.
  const [showCourseTypeModal, setShowCourseTypeModal] = useState(false);
  const [courseTypeChoice, setCourseTypeChoice] = useState('online');
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  // Product creation follows the same editor-first rule: a kind chooser
  // (Digital / Physical / Service) opens first, then the Product Editor.
  const [showProductTypeModal, setShowProductTypeModal] = useState(false);
  const [productKindChoice, setProductKindChoice] = useState('digital');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTalentModal, setShowTalentModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  // Edit state — stores the item being edited + its type
  const [editingItem, setEditingItem] = useState(null);
  const [editingType, setEditingType] = useState(null);

  // ─── Profile data for WelcomeChecklist auto-detection ───────────
  const [profileData, setProfileData] = useState(null);
  const [coursesCount, setCoursesCount] = useState(0);
  const [portfolioCount, setPortfolioCount] = useState(0);

  // Only users with is_creator: true can access the Studio. Non-creators
  // get redirected to / with a helpful toast.
  const isCreator = user?.is_creator === true;
  // Anonymous users are caught by AuthGate BEFORE this component mounts,
  // but we add an extra safety check here for defense-in-depth.
  const isAnonymous = !user;

  // Must be declared BEFORE any conditional return (rules-of-hooks)
  const handleSectionChange = useCallback((sectionId) => {
    // Special case: FAQ navigates to the /sheet/faq route
    if (sectionId === 'faq') {
      navigate('/sheet/faq');
      return;
    }
    setActiveSection(sectionId);
    setMobileSidebar(false);
    // Continuity — persist the workspace slice (studio section) so a
    // relaunch can put the user back on this tab. Fire-and-forget;
    // the restore point is a nicety, never a gate.
    continuityManager.saveWorkspaceState({ section: sectionId }).catch(() => {});
  }, [navigate]);

  // ─── Edit handler — open modal pre-filled with item data ───────
  const handleEdit = useCallback((item, type) => {
    setEditingItem(item);
    setEditingType(type);
    if (type === 'course') {setShowCourseModal(true);}
    else if (type === 'music') {setShowMusicModal(true);}
    else if (type === 'product') {setShowProductModal(true);}
    else if (type === 'portfolio') {setShowProjectModal(true);}
    else if (type === 'talent') {setShowTalentModal(true);}
    else if (type === 'job') {setShowJobModal(true);}
    else if (type === 'event') {setShowEventModal(true);}
  }, []);

  // ─── Create course — ask the delivery question FIRST ───────────
  const handleCreateCourse = useCallback(() => {
    setEditingItem(null);
    setEditingType(null);
    setShowCourseTypeModal(true);
  }, []);

  const handleCourseTypeSelect = useCallback((type) => {
    setCourseTypeChoice(type);
    setShowCourseTypeModal(false);
    setShowCourseModal(true);
  }, []);

  // ─── Create product — ask WHAT is being sold FIRST ────────────
  const handleCreateProduct = useCallback(() => {
    setEditingItem(null);
    setEditingType(null);
    setShowProductTypeModal(true);
  }, []);

  const handleProductTypeSelect = useCallback((kind) => {
    setProductKindChoice(kind);
    setShowProductTypeModal(false);
    setShowProductModal(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingItem(null);
    setEditingType(null);
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('atelnyo:auth:logout', { detail: { reason: 'user' } }));
    } catch { /* ignore */ }
    navigate('/', { replace: true });
  }, [navigate]);

  // ─── Fetch profile data for WelcomeChecklist auto-detection ───
  useEffect(() => {
    if (!identity.creatorLookupKey || !isCreator) { return; }
    let cancelled = false;

    // Fetch public profile (for completeness, avatar_url, cover_url)
    creatorProfileService.get(identity.creatorLookupKey)
      .then((res) => {
        if (cancelled) { return; }
        setProfileData(res?.data || null);
      })
      .catch(() => { if (!cancelled) { setProfileData(null); } });

    // Fetch courses count — the owner sees ALL their courses (drafts
    // included), so this uses the authenticated /courses/?mine=1 view,
    // NOT the public-profile endpoint (which lists published only — a
    // creator with drafts would otherwise show "0 courses").
    courseService.getAll({ mine: true })
      .then((res) => {
        if (cancelled) { return; }
        const data = res?.data;
        const list = Array.isArray(data) ? data : (data?.results || []);
        setCoursesCount(list.length);
      })
      .catch(() => {});

    // Fetch portfolio count
    creatorProfileService.portfolio(identity.creatorLookupKey)
      .then((res) => {
        if (cancelled) { return; }
        const data = res?.data;
        setPortfolioCount(Array.isArray(data) ? data.length : (data?.results?.length || 0));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [identity.creatorLookupKey, isCreator]);
  useEffect(() => {
    if (user && !isCreator) {
      showToast?.('Only creators can access the Studio. Apply to become a creator!', 'user-lock');
      navigate('/', { replace: true });
    }
  }, [user, isCreator, navigate, showToast]);

  // ─── Early redirect guard ────────────────────────────────────────
  // Shows a redirecting state instead of flashing the full UI before
  // the useEffect fires, so non-creators never see a glimpse of the
  // Studio shell. Also catches anonymous users who might slip past
  // the AuthGate (defense-in-depth).
  if (!user || (user && !isCreator)) {
    return (
      <div className={styles.redirectGuard}>
        <div className={styles.redirectGuardContent}>
          <i className="fas fa-spinner fa-spin" />
          <p>
            {lang === 'ht' ? 'Redireksyon...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }



  // ─── Render active section ───────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return (
        <>
          {/* Welcome Checklist for first-time creators */}
          <WelcomeChecklist
            lang={lang}
            showToast={showToast}
            profileData={profileData}
            coursesCount={coursesCount}
            portfolioCount={portfolioCount}
            onNavigate={handleSectionChange}
            onOpenModal={(type) => {
              if (type === 'course') {handleCreateCourse();}
              else if (type === 'project') {setShowProjectModal(true);}
              else if (type === 'withdraw') {setShowWithdrawModal(true);}
            }}
          />
          <DashboardSection
            lang={lang}
            t={t}
            showToast={showToast}
            setShowCourseModal={handleCreateCourse}
            setShowProductModal={handleCreateProduct}
            setShowProjectModal={setShowProjectModal}
            setActiveSection={handleSectionChange}
            user={user}
            profileData={profileData}
          />
        </>
      );
      case 'levels_badges': return (
        <LevelsBadgesSection
          lang={lang}
          t={t}
          user={user}
        />
      );
      case 'company':    return <CompanySection lang={lang} t={t} showToast={showToast} />;
      case 'courses':   return <CoursesSection lang={lang} t={t} showToast={showToast} setShowCourseModal={handleCreateCourse} onEdit={(item) => handleEdit(item, 'course')} />;
      case 'talent':    return <TalentSection lang={lang} t={t} showToast={showToast} setShowTalentModal={setShowTalentModal} onEdit={(item) => handleEdit(item, 'talent')} />;
      case 'jobs':      return <JobsSection lang={lang} t={t} showToast={showToast} setShowJobModal={setShowJobModal} onEdit={(item) => handleEdit(item, 'job')} />;
      case 'events':    return <EventsSection lang={lang} t={t} showToast={showToast} setShowEventModal={setShowEventModal} onEdit={(item) => handleEdit(item, 'event')} user={user} />;
      case 'communities': return <CommunitiesSection lang={lang} t={t} showToast={showToast} user={user} />;
      case 'proposals': return <ProposalsSection lang={lang} t={t} showToast={showToast} />;
      case 'contracts': return <ContractsSection lang={lang} t={t} showToast={showToast} user={user} />;
      case 'music':     return <MusicSection lang={lang} t={t} showToast={showToast} setShowMusicModal={setShowMusicModal} onEdit={(item) => handleEdit(item, 'music')} />;
      case 'media':     return (
        <div className={styles.mediaView}>
          <MyMediaDashboard
            lang={lang}
            user={user}
            showToast={showToast}
            setActiveSection={setActiveSection}
          />
          <div className={styles.mediaTabs}>
            <button
              type="button"
              className={`${styles.mediaTabBtn} ${activeMediaTab === 'hub' ? styles.mediaTabBtnActive : ''}`}
              onClick={() => setActiveMediaTab('hub')}
            >
              <i className="fas fa-photo-video" aria-hidden="true" />
              {t.studio_media_hub || 'Media Hub'}
            </button>
            <button
              type="button"
              className={`${styles.mediaTabBtn} ${activeMediaTab === 'provider' ? styles.mediaTabBtnActive : ''}`}
              onClick={() => setActiveMediaTab('provider')}
            >
              <i className="fas fa-cloud" aria-hidden="true" />
              {t.studio_media_providers || 'Provider Center'}
            </button>
            <button
              type="button"
              className={`${styles.mediaTabBtn} ${activeMediaTab === 'library' ? styles.mediaTabBtnActive : ''}`}
              onClick={() => setActiveMediaTab('library')}
            >
              <i className="fas fa-photo-video" aria-hidden="true" />
              {t.studio_media_library || 'Media Library'}
            </button>
            <button
              type="button"
              className={`${styles.mediaTabBtn} ${activeMediaTab === 'tiktok' ? styles.mediaTabBtnActive : ''}`}
              onClick={() => setActiveMediaTab('tiktok')}
            >
              <i className="fab fa-tiktok" aria-hidden="true" />
              {t.studio_media_tiktok || 'TikTok'}
            </button>
          </div>
          {activeMediaTab === 'hub' ? (
            <MediaHub
              lang={lang}
              showToast={showToast}
              user={user}
              onNavigateToProvider={() => setActiveMediaTab('provider')}
              onNavigateToLibrary={() => setActiveMediaTab('library')}
            />
          ) : activeMediaTab === 'provider' ? (
            <MediaProviderSection lang={lang} showToast={showToast} />
          ) : activeMediaTab === 'tiktok' ? (
            <TikTokConnect lang={lang} showToast={showToast} />
          ) : (
            <MediaLibrary lang={lang} showToast={showToast} user={user} />
          )}
        </div>
      );
      case 'products':  return <ProductsSection lang={lang} t={t} showToast={showToast} setShowProductModal={handleCreateProduct} onEdit={(item) => handleEdit(item, 'product')} />;
      case 'portfolio': return <PortfolioSection lang={lang} t={t} showToast={showToast} setShowProjectModal={setShowProjectModal} onEdit={(item) => handleEdit(item, 'portfolio')} />;
      case 'analytics': return <AnalyticsSection lang={lang} t={t} showToast={showToast} />;
      case 'orders':    return <OrdersSection lang={lang} t={t} />;
      case 'wallet':    return <WalletSection lang={lang} t={t} showToast={showToast} setShowWithdrawModal={setShowWithdrawModal} user={user} />;
      case 'public_profile': return (
        <>
          <CreatorProfileHealth lang={lang} showToast={showToast} user={user} />
          <PublicProfileSection lang={lang} t={t} showToast={showToast} user={user} />
        </>
      );
      case 'messages':  return <MessagesSection lang={lang} t={t} showToast={showToast} />;
      case 'settings':  return <SettingsSection lang={lang} t={t} showToast={showToast} user={user} setShowProfileModal={setShowProfileModal} setShowPasswordModal={setShowPasswordModal} setShowBrandingModal={setShowBrandingModal} setShowNotifModal={setShowNotifModal} setShowVerifModal={setShowVerifModal} />;      case 'affiliate':  return <AffiliateSection lang={lang} t={t} showToast={showToast} />;
      case 'promotions': return <PromotionsSection lang={lang} t={t} showToast={showToast} />;
      case 'intelligence': return <IntelligenceSection lang={lang} t={t} showToast={showToast} />;
      case 'profile_settings': return <ProfileSettingsSection lang={lang} t={t} showToast={showToast} user={user} />;
      default:          return <DashboardSection lang={lang} t={t} showToast={showToast} />;
    }
  };

  const tStudio = (en, ht) => lang === 'ht' ? (ht || en) : en;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <div className={styles.shell} data-creator-studio>
        {/* Header */}
        <header className={styles.header}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t.common_back || 'Back'}
            className={styles.headerBackBtn}
          >
            <i className="fas fa-arrow-left" aria-hidden="true" />
            <span>{t.common_back || 'Back'}</span>
          </button>
          <div className={styles.headerTitle}>
            <i className="fas fa-crown" aria-hidden="true" />
            <h1>
              {tStudio('Creator Studio', 'Kreyatè Studio')}
            </h1>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerBurger}
              onClick={() => setMobileSidebar((v) => !v)}
              aria-label={mobileSidebar ? 'Close menu' : 'Open menu'}
              title={mobileSidebar ? 'Close menu' : 'Open menu'}
            >
              <i className={`fas ${mobileSidebar ? 'fa-times' : 'fa-bars'}`} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Mobile sidebar overlay */}
        {mobileSidebar && (
          <div
            className={styles.overlay}
            onClick={() => setMobileSidebar(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <nav
          className={classNames(
            styles.sidebar,
            mobileSidebar && styles.sidebarMobileOpen,
          )}
          aria-label="Creator Studio navigation"
        >
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>
              {profileData?.avatar_url ? (
                <img
                  className={styles.sidebarAvatarImg}
                  src={profileData.avatar_url}
                  alt={identity.displayName || 'Creator'}
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = identity.initial; }}
                />
              ) : (
                identity.initial
              )}
              <button
                type="button"
                className={styles.sidebarAvatarEdit}
                onClick={() => setShowAvatarModal(true)}
                aria-label={lang === 'ht' ? 'Chanje foto profile' : 'Change profile photo'}
                title={lang === 'ht' ? 'Chanje foto' : 'Change photo'}
              >
                <i className="fas fa-camera" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUsername}>
                {identity.displayName || 'Creator'}
              </div>
              <div className={styles.sidebarRole}>
                <i className="fas fa-check-circle" aria-hidden="true" />{' '}
                {tStudio('Creator', 'Kreyatè')}
              </div>
            </div>
          </div>

          <ul className={styles.nav} role="tablist" aria-label="Studio sections">
            {SIDEBAR_CATEGORIES.map((category) => (
              <li key={category.id} className={styles.navCategory} role="presentation">
                <div className={styles.navCategoryLabel}>
                  {lang === 'ht' ? category.labelHt : category.label}
                </div>
                <ul className={styles.navCategoryList} role="presentation">
                  {category.items.map((section) => (
                    <li key={section.id} role="none">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeSection === section.id}
                        className={classNames(
                          styles.navItem,
                          activeSection === section.id && styles.navItemActive,
                        )}
                        onClick={() => handleSectionChange(section.id)}
                      >
                        <i className={`fas ${section.icon}`} aria-hidden="true" />
                        <span>{lang === 'ht' ? section.labelHt : section.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {/* Sidebar footer — logout + version */}
          <div className={styles.sidebarFooter}>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
              title={lang === 'ht' ? 'Dekonekte' : 'Sign Out'}
            >
              <i className="fas fa-sign-out-alt" aria-hidden="true" />
              <span>{lang === 'ht' ? 'Dekonekte' : 'Sign Out'}</span>
            </button>
            <div className={styles.versionInfo}>Atelnyo · Creator Studio</div>
          </div>
        </nav>

        {/* Main Content */}
        <main
          className={styles.main}
          role="tabpanel"
          aria-label={activeSection}
        >
          <div className={styles.mainInner} key={activeSection}>
            <React.Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <i className="fas fa-spinner fa-pulse fa-2x" style={{ color: '#6366f1' }} />
              </div>
            }>
              {renderSection()}
            </React.Suspense>
          </div>
        </main>
      </div>

        {/* ─── Modals ──────────────────────────────────────────────── */}
        {/* Modals keep the studio's blue/indigo theme: they mount as
            siblings of the shell div, so they need the same data-
            creator-studio scope or they fall back to the global rose
            primary (visible as pink hover/focus on inputs). */}
        <div data-creator-studio>
        {showCourseModal && (
          <CourseEditor
            lang={lang}
            showToast={showToast}
            user={user}
            onClose={() => { setShowCourseModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowCourseModal(false); handleCloseEdit(); setActiveSection('courses'); }}
            item={editingType === 'course' ? editingItem : null}
            deliveryType={courseTypeChoice}
          />
        )}
        {showCourseTypeModal && (
          <CourseTypeModal
            lang={lang}
            onClose={() => setShowCourseTypeModal(false)}
            onSelect={handleCourseTypeSelect}
          />
        )}
        {showMusicModal && (
          <MusicEditor
            lang={lang}
            showToast={showToast}
            user={user}
            onClose={() => { setShowMusicModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowMusicModal(false); handleCloseEdit(); setActiveSection('music'); }}
            item={editingType === 'music' ? editingItem : null}
          />
        )}
        {showProductModal && (
          <ProductEditor
            lang={lang}
            showToast={showToast}
            user={user}
            onClose={() => { setShowProductModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowProductModal(false); handleCloseEdit(); setActiveSection('products'); }}
            item={editingType === 'product' ? editingItem : null}
            kind={productKindChoice}
          />
        )}
        {showProductTypeModal && (
          <ProductTypeModal
            lang={lang}
            onClose={() => setShowProductTypeModal(false)}
            onSelect={handleProductTypeSelect}
          />
        )}
        {showProjectModal && (
          <ProjectFormModal
            lang={lang}
            showToast={showToast}
            onClose={() => { setShowProjectModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowProjectModal(false); handleCloseEdit(); setActiveSection('portfolio'); }}
            item={editingType === 'portfolio' ? editingItem : null}
          />
        )}
        {showWithdrawModal && (
          <WithdrawModal
            lang={lang}
            showToast={showToast}
            onClose={() => setShowWithdrawModal(false)}
            onSuccess={() => { setActiveSection('wallet'); }}
            onOpenVerification={() => {
              // KYC gate → hand off to the verification modal (which has
              // the submission form). Close the withdraw modal so the two
              // don't stack; reopening Withdraw re-checks status on mount.
              setShowWithdrawModal(false);
              setShowVerifModal(true);
            }}
          />
        )}
        {showProfileModal && (
          <ProfileEditModal
            lang={lang}
            showToast={showToast}
            user={user}
            onClose={() => setShowProfileModal(false)}
            onSuccess={() => { setActiveSection('settings'); }}
          />
        )}
        {showBrandingModal && (
          <BrandingModal
            lang={lang}
            showToast={showToast}
            onClose={() => setShowBrandingModal(false)}
            onSuccess={() => { setActiveSection('settings'); }}
          />
        )}
        {showNotifModal && (
          <NotificationSettingsModal
            lang={lang}
            showToast={showToast}
            onClose={() => setShowNotifModal(false)}
            onSuccess={() => { setActiveSection('settings'); }}
          />
        )}
        {showVerifModal && (
          <VerificationModal
            lang={lang}
            showToast={showToast}
            onClose={() => setShowVerifModal(false)}
            onSuccess={() => { setActiveSection('settings'); }}
          />
        )}
        {showPasswordModal && (
          <PasswordChangeModal
            lang={lang}
            showToast={showToast}
            onClose={() => setShowPasswordModal(false)}
          />
        )}
        {showAvatarModal && (
          <AvatarEditModal
            lang={lang}
            showToast={showToast}
            currentAvatarUrl={profileData?.avatar_url}
            userName={identity.displayName}
            onClose={() => setShowAvatarModal(false)}
            onSuccess={(newUrl) => {
              // Mete ajou avatar nan profileData san re-fetch
              setProfileData((prev) => prev ? { ...prev, avatar_url: newUrl } : prev);
            }}
          />
        )}
        {showTalentModal && (
          <TalentFormModal
            lang={lang}
            showToast={showToast}
            onClose={() => { setShowTalentModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowTalentModal(false); handleCloseEdit(); setActiveSection('talent'); }}
            talent={editingType === 'talent' ? editingItem : null}
          />
        )}
        {showJobModal && (
          <JobFormModal
            lang={lang}
            showToast={showToast}
            onClose={() => { setShowJobModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowJobModal(false); handleCloseEdit(); setActiveSection('jobs'); }}
            job={editingType === 'job' ? editingItem : null}
          />
        )}
        {showEventModal && (
          <EventFormModal
            lang={lang}
            showToast={showToast}
            onClose={() => { setShowEventModal(false); handleCloseEdit(); }}
            onSuccess={() => { setShowEventModal(false); handleCloseEdit(); setActiveSection('events'); }}
            event={editingType === 'event' ? editingItem : null}
          />
        )}
        </div>
    </>
  );
}
