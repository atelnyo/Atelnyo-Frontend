import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// The PWA install surfaces (banner + Settings panel) are hidden by
// default — re-enable with VITE_INSTALL_PROMPT_ENABLED=1 at build time.
const INSTALL_PROMPT_ENABLED =
  import.meta.env?.VITE_INSTALL_PROMPT_ENABLED === '1' ||
  import.meta.env?.VITE_INSTALL_PROMPT_ENABLED === 'true';
import ConfirmModal from './common/ConfirmModal';
import useSafeNavigate from '../hooks/useSafeNavigate';
import api, { authService, spotlightService } from '../services/api';
import { resizeImage } from '../utils/profileUtils';
import { usePlanKreyatif } from '../utils/planKreyatif';
import SpotlightThread from './SpotlightThread';
import InstallAppPanel from './settings/InstallAppPanel';
import StoragePanel from './settings/StoragePanel';
import TwoFactorSettings from './settings/TwoFactorSettings';
import LocationSettings from './settings/LocationSettings';
import PremiumPreview from '../modules/premium/components/PremiumPreview';
import LocationPicker from './shared/LocationPicker';
import { COMMON_COUNTRIES } from '../services/locationService';
import { SHEETS } from '../routes/sheets';
import { getUserIdentity } from '../utils/userIdentity';
import { t2 } from '../utils/i18n';
import { ensureBrowserNotificationPermission, getNotificationPermission } from '../services/notificationPermission';
// Phase 4 — market/country switcher options come from the SAME
// centralized config (src/config/markets.js) that drives URL
// validation — the switcher can never offer a disabled market.
import { MARKET_OPTIONS } from '../config/markets';
import { fmtDate, premiumPlanLabel } from '../utils/formatMedia';

/**
 * src/components/Settings.jsx
 *
 * Settings panel — appearance + language + atelier + logout ONLY.
 *
 * Privacy / identity / security editors and the cover / interests /
 * social / country inline forms have been moved into a dedicated
 * Profile section. Settings now only hosts the "vibe" controls
 * (theme / FX / language) so its identity stays clear.
 *
 * The deep-link launcher rows in each former section point at the new
 * overlay so existing muscle memory still finds the surface, just two
 * taps away. Each row uses the `.privacy-link` glassmorphic pill pattern
 * shared with Atelier's launcher so the visual language is consistent.
 */

const PREFERRED_API_ERROR_FIELDS = [
  'cover_photo', 'avatar', 'username', 'bio', 'status_text',
  'interests', 'social_links', 'country', 'notification_prefs',
  'non_field_errors', 'detail', 'error',
];
function extractApiErrorMessage(data) {
  if (!data) {return null;}
  if (typeof data === 'string') {return data;}
  if (typeof data !== 'object') {return null;}
  for (const key of PREFERRED_API_ERROR_FIELDS) {
    const v = data[key];
    if (typeof v === 'string' && v) {return v;}
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') {return v[0];}
  }
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('__')) {continue;}
    if (typeof v === 'string' && v) {return v;}
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') {return v[0];}
  }
  return null;
}

// ─── Settings category hub — the settings panel is organized into
// categories so nothing is scattered in one long scroll. The hub shows
// one tile per category; clicking a tile drills into that category's
// settings with a back button ("subsystem click" → category page).
const SETTINGS_CATEGORIES = [
  { id: 'account',       icon: 'fa-user',         ht: 'Kont',                    en: 'Account',       fr: 'Compte',        es: 'Cuenta',                descHt: 'Pwofil, logout, abònman Premium',       descEn: 'Profile, sign out, Premium plan' },
  { id: 'appearance',    icon: 'fa-palette',      ht: 'Aparans',                 en: 'Appearance',    fr: 'Apparence',     es: 'Apariencia',            descHt: 'Tèm, koulè, font, efè vizyèl',           descEn: 'Theme, color, font, visual effects' },
  { id: 'language',      icon: 'fa-language',     ht: 'Lang',                    en: 'Language',      fr: 'Langue',        es: 'Idioma',                descHt: 'Kreyòl, English, Français, Español',      descEn: 'Haitian, English, French, Spanish' },
  { id: 'notifications', icon: 'fa-bell',         ht: 'Notifikasyon',            en: 'Notifications', fr: 'Notifications', es: 'Notificaciones',        descHt: 'Son, imel, push, preview',                descEn: 'Sounds, email, push, preview' },
  { id: 'location',      icon: 'fa-map-location-dot', ht: 'Lokalizasyon',         en: 'Location',      fr: 'Localisation',  es: 'Ubicación',            descHt: 'Peyi/region kont ou — deteksyon otomatik', descEn: 'Your account country/region — auto detection' },
  { id: 'storage',       icon: 'fa-database',     ht: 'Depo & Enstalasyon',      en: 'Storage & Install', fr: 'Stockage & Installation', es: 'Almacenamiento e Instalación', descHt: 'Jere depo, enstalasyon PWA',               descEn: 'Manage storage, PWA install' },
  { id: 'security',      icon: 'fa-shield-halved', ht: 'Sekirite & Kont',        en: 'Security',      fr: 'Sécurité',       es: 'Seguridad',             descHt: 'Verifikasyon 2 etap (2FA)',               descEn: 'Two-factor authentication (2FA)' },
  { id: 'legal',         icon: 'fa-scale-balanced', ht: 'Legal & Konfidansyalite', en: 'Legal & Privacy', fr: 'Légal & Confidentialité', es: 'Legal y Privacidad', descHt: 'Kondisyon, politik, GDPR',                 descEn: 'Terms, policies, GDPR' },
  { id: 'navigation',    icon: 'fa-compass',      ht: 'Navigasyon Sheet',        en: 'Sheet Navigation', fr: 'Navigation des feuilles', es: 'Navegación de hojas', descHt: 'Tout paj /sheet/ yo reyini',               descEn: 'All /sheet/ pages in one place' },
  { id: 'creator',       icon: 'fa-crown',        ht: 'Kreyatè',                 en: 'Creator',       fr: 'Créateur',       es: 'Creador',               descHt: 'Plan Kreyatif, aplike kreyatè, Spotlight', descEn: 'Plan Kreyatif, creator apply, Spotlight' },
  { id: 'atelier',       icon: 'fa-flask',        ht: 'Atelye Envantè',          en: 'Inventor\'s Atelier', fr: 'Atelier de l\'Inventeur', es: 'Atelier del Inventor', descHt: '5 envansyon ou pa jwenn okenn lòt kote',   descEn: '5 inventions found nowhere else' },
];
const categoryLabel = (cat, lang) => t2(lang, { ht: cat.ht, fr: cat.fr, es: cat.es, en: cat.en });
const categoryDesc = (cat, lang) => t2(lang, { ht: cat.descHt, en: cat.descEn });

const Settings = ({ isOpen, onClose, onAuthOpen, lang, onLangChange, market, onMarketChange, toggleTheme, darkMode, fontSize, setFontSize, user, onLogout, translations, showToast, onProfileUpdate, onOpenCheckout }) => {
  const t = translations[lang];
  const identity = getUserIdentity(user);
  const fileInputRef = useRef(null);
  const navigate = useSafeNavigate();
  // ─── Settings category drill-down (hub → category → back) ───────
  // The last-open category persists so reopening settings lands where
  // the user left off (same continuity idea as the Studio workspace).
  const [settingsCategory, setSettingsCategory] = useState(() => {
    try { return localStorage.getItem('atelnyo_settings_category') || null; } catch { return null; }
  });
  // Recently-opened categories — a small shortcut strip above the hub.
  const [recentCategories, setRecentCategories] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('atelnyo_settings_recent') || '[]');
      return Array.isArray(raw) ? raw.filter((id) => SETTINGS_CATEGORIES.some((c) => c.id === id)) : [];
    } catch { return []; }
  });
  const settingsContentRef = useRef(null);
  // Drill into a category (or navigate for the Atelier) and remember it.
  const openCategory = useCallback((id) => {
    if (id === 'atelier') { navigate('/sheet/atelier'); return; }
    setSettingsCategory(id);
    setRecentCategories((prev) => {
      const next = [id, ...(prev || []).filter((c) => c !== id)].slice(0, 3);
      try { localStorage.setItem('atelnyo_settings_recent', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [navigate]);
  // Persist the drill-down position; going back to the hub clears it.
  useEffect(() => {
    try {
      if (settingsCategory) { localStorage.setItem('atelnyo_settings_category', settingsCategory); }
      else { localStorage.removeItem('atelnyo_settings_category'); }
    } catch { /* ignore */ }
  }, [settingsCategory]);
  // Jump to the top when drilling into / leaving a category.
  useEffect(() => {
    if (settingsContentRef.current) { settingsContentRef.current.scrollTop = 0; }
  }, [settingsCategory]);
  // ─── Premium Preview modal state ───────────────────────────────
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [cancelPremiumConfirm, setCancelPremiumConfirm] = useState(false);
  const [cancellingPremium, setCancellingPremium] = useState(false);
  // ─── Phase 49 §11.3 — Role-derived permission gates ──────────
  // The matrix says which roles are allowed to apply for Spotlight /
  const [isUploading, setIsUploading] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountInput, setDeleteAccountInput] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [themeColor, setThemeColor] = useState(localStorage.getItem('atelnyo_theme_color') || '#d81b60');
  const [fontFamily, setFontFamily] = useState(localStorage.getItem('atelnyo_font_family') || "'Poppins', sans-serif");
  const [ambientFx, setAmbientFx] = useState(localStorage.getItem('atelnyo_ambient_fx') || 'none');
  const [cardStyle, setCardStyle] = useState(localStorage.getItem('atelnyo_card_style') || 'classic');
  const [showAdvancedAppearance, setShowAdvancedAppearance] = useState(false);
  const [sonicUi, setSonicUi] = useState(localStorage.getItem('atelnyo_sonic_ui') === 'true');
  const [cyberCursor, setCyberCursor] = useState(localStorage.getItem('atelnyo_cyber_cursor') === 'true');
  // ─── Plan Kreyatif — master toggle that gates a family of opt-in
  // surfaces (modals, FABs, banners) so they only render when the
  // user has explicitly flipped the toggle ON. The hook is the single
  // source of truth across this file AND any gated component
  // (cross-component fan-out via ``atelnyo:plan-kreyatif-changed``
  // CustomEvent + cross-tab sync via the browser's ``storage``
  // event). See src/utils/planKreyatif.js for the full design
  // comment. Default false so an unfamiliar user opens the
  // settings panel without surprise modals.
  const { enabled: planKreyatif, toggle: togglePlanKreyatif } = usePlanKreyatif();
  // Phase 49 §11.3 — Notification preferences.
  // Derived from the user prop (source of truth) with an optimistic
  // draft for immediate UI feedback — no setState-in-effect.
  //   * draftNotifPrefs     — set on user toggle (optimistic), cleared
  //                           on API error so the display falls back to
  //                           the last server-verified value.
  //   * notifPrefs (memoised) — draft ?? server prefs ?? defaults.
  const DEFAULT_NOTIF_PREFS = {
    sound: true,
    desktop_notif: false,
    email_notif: false,
    message_preview: true,
    push_notif: false,
  };
  const [draftNotifPrefs, setDraftNotifPrefs] = useState(null);

  const notifPrefs = useMemo(() => {
    if (draftNotifPrefs) return draftNotifPrefs;
    const raw = user?.notification_prefs;
    if (!raw) return DEFAULT_NOTIF_PREFS;
    return {
      sound: raw.sound ?? true,
      desktop_notif: raw.desktop_notif ?? false,
      email_notif: raw.email_notif ?? false,
      message_preview: raw.message_preview ?? true,
      push_notif: raw.push_notif ?? false,
    };
  }, [user?.notification_prefs, draftNotifPrefs]);

  // ─── Browser notification permission status ──────────────────
  // Tracks the real-time Notification.permission value so the
  // notification settings section can show a live status indicator.
  const [browserNotifPerm, setBrowserNotifPerm] = useState(() => getNotificationPermission());

  // Re-read when the user returns to the tab (permission may have
  // changed in browser settings while the tab was backgrounded).
  useEffect(() => {
    if (!('Notification' in window)) return;
    const refresh = () => setBrowserNotifPerm(Notification.permission || 'default');
    document.addEventListener('visibilitychange', refresh);
    // Also poll once on mount in case permission changed since state init.
    refresh();
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const saveNotifPrefs = useCallback(async (next) => {
    setDraftNotifPrefs(next);
    try {
      await api.patch('me/', { notification_prefs: next });
      showToast?.(t2(lang, { ht: '✅ Preferans notifikasyon mete ajou!', fr: '✅ Préférences de notification mises à jour !', es: '✅ ¡Preferencias de notificación actualizadas!', en: '✅ Notification preferences updated!' }));
      onProfileUpdate?.();
    } catch {
      setDraftNotifPrefs(null);
      showToast?.(t2(lang, { ht: '❌ Enfòmasyon pa kapab sove.', fr: '❌ Impossible de sauvegarder les préférences.', es: '❌ No se pudieron guardar las preferencias.', en: '❌ Could not save preferences.' }));
    }
   }, [lang, showToast, onProfileUpdate]);

  // Push toggle is special: enabling it must ALSO ask the browser for
  // notification permission (Notification.requestPermission) and
  // register the FCM token — otherwise the pref saves but no push can
  // ever arrive (the browser never shows the prompt by itself).
  const handleToggleNotif = useCallback(async (key, nextValue) => {
    // ─── desktop_notif: request browser notification permission ───
    // Desktop notifications use the Web Notification API which also
    // requires Notification.requestPermission() — without it the
    // preference saves but no notification ever appears.
    if (key === 'desktop_notif' && nextValue) {
      try {
        const { granted, permission } = await ensureBrowserNotificationPermission();
        setBrowserNotifPerm(permission);
        if (granted) {
          saveNotifPrefs({ ...notifPrefs, desktop_notif: true });
        } else {
          // Permission denied → revert the toggle.
          setDraftNotifPrefs(null);
          showToast?.(lang === 'ht'
            ? '❌ Navigatè a pa t bay pèmisyon pou notifikasyon desktop.'
            : lang === 'fr' ? '❌ Le navigateur n\'a pas accordé la permission de notification bureau.'
            : lang === 'es' ? '❌ El navegador no concedió permiso de notificación de escritorio.'
            : '❌ The browser did not grant desktop notification permission.'
          );
        }
      } catch {
        setDraftNotifPrefs(null);
        showToast?.(t2(lang, { ht: '❌ Navigatè a pa t reponn pou pèmisyon notifikasyon.', fr: '❌ Le navigateur n\'a pas répondu à la demande de permission.', es: '❌ El navegador no respondió a la solicitud de permiso.', en: '❌ The browser did not respond to the permission request.' }));
      }
      return;
    }
    if (key !== 'push_notif' || !nextValue) {
      saveNotifPrefs({ ...notifPrefs, [key]: nextValue });
      return;
    }
    // Enabling push → use the centralized permission helper and then
    // run the real registration flow first. This keeps permission logic
    // consistent across the app and avoids ad-hoc Notification calls.
    try {
      const { granted, permission } = await ensureBrowserNotificationPermission();
      setBrowserNotifPerm(permission);
      if (!granted) {
        setDraftNotifPrefs(null);
        showToast?.(lang === 'ht'
          ? '❌ Navigatè a pa t bay pèmisyon pou notifikasyon push.'
          : lang === 'fr' ? '❌ Le navigateur n\'a pas accordé la permission de notification push.'
          : lang === 'es' ? '❌ El navegador no concedió permiso de notificación push.'
          : '❌ The browser did not grant push notification permission.'
        );
        return;
      }

      const { registerPushNotifications } = await import('../services/firebase');
      const token = await registerPushNotifications();
      if ('Notification' in window) {
        setBrowserNotifPerm(Notification.permission || 'default');
      }
      if (token) {
        saveNotifPrefs({ ...notifPrefs, push_notif: true });
      } else {
        setDraftNotifPrefs(null);
        showToast?.(lang === 'ht'
          ? '❌ Push pa disponib sou aparèy sa a.'
          : lang === 'fr' ? '❌ Les notifications push ne sont pas disponibles sur cet appareil.'
          : lang === 'es' ? '❌ Las notificaciones push no están disponibles en este dispositivo.'
          : '❌ Push is not available on this device.'
        );
      }
    } catch {
      setDraftNotifPrefs(null);
      showToast?.(t2(lang, { ht: '❌ Push pa disponib sou aparèy sa a.', fr: '❌ Les notifications push ne sont pas disponibles sur cet appareil.', es: '❌ Las notificaciones push no están disponibles en este dispositivo.', en: '❌ Push is not available on this device.' }));
    }
  }, [notifPrefs, saveNotifPrefs, lang, showToast]);
  // 'Plan Kreator Assistant' modal — a sample gated surface.
  // Visible ONLY when ``planKreyatif === true`` AND the user taps
  // the chip in the new Plan Kreatè section below; demonstrates
  // the "windows visible in parameters only with Plan Kreyatif
  // ON" deliverable from the user's ask.
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Phase 47 — Creator Spotlight. The unlock counter starts at 0;
  // tapping the hidden version label at the bottom of the panel
  // 5 times within 3s flips ``spotlightUnlocked`` to true, which
  // reveals the "Apply for Spotlight" launcher. Once unlocked, the
  // state is memoised in localStorage so a refresh doesn't reset
  // the unlock (a junior creator who spent 20s finding the easter
  // egg shouldn't have to re-discover it after a refresh).
  const [spotlightUnlocked, setSpotlightUnlocked] = useState(
    () => localStorage.getItem('atelnyo_spotlight_unlocked') === 'true',
  );
  const [spotlightTaps, setSpotlightTaps] = useState(0);
  const spotlightTapsTimerRef = useRef(null);
  // Ref used by ``openSpotlightModal`` to cancel a pending /mine/
  // request when the modal is closed before the response lands.
  const openSpotlightModalRequestRef = useRef(null);
  // Phase 50 — Creator Apply (parallel easter egg to Spotlight).
  // Same pattern as the Spotlight unlock (3-tap on a hidden
  // element, 3s reset window, localStorage persistence) but
  // with its own element so the two unlocks don't interfere.
  // The unlocked section reveals a launcher that navigates to
  // /sheet/creator-apply (a separate routed sheet, not a
  // modal). The route itself is double-gated (no user → auth;
  // no unlock flag → home) inside CreatorApply.jsx.
  const [creatorApplyUnlocked, setCreatorApplyUnlocked] = useState(
    () => localStorage.getItem('atelnyo_creator_apply_unlocked') === 'true',
  );
  const [creatorApplyTaps, setCreatorApplyTaps] = useState(0);
  const creatorApplyTapsTimerRef = useRef(null);

  // Cleanup the 3s reset timer on unmount so a navigation
  // mid-gesture doesn't fire setState on an unmounted
  // component. Without this, a user who opens Settings and
  // navigates away within 3s of tapping the version label
  // would see a React "state update on unmounted" warning
  // in dev. Production builds swallow the warning, but the
  // leaked timer is a small enough footgun to clean up.
  useEffect(() => () => {
    if (spotlightTapsTimerRef.current) {
      clearTimeout(spotlightTapsTimerRef.current);
      spotlightTapsTimerRef.current = null;
    }
    if (creatorApplyTapsTimerRef.current) {
      clearTimeout(creatorApplyTapsTimerRef.current);
      creatorApplyTapsTimerRef.current = null;
    }
    if (openSpotlightModalRequestRef.current) {
      openSpotlightModalRequestRef.current();
    }
  }, []);
  // Application modal state. ``spotlightModalOpen`` controls the
  // form; ``spotlightSubmitting`` disables the submit button while
  // the POST is in flight; ``spotlightMyApp`` holds the user's
  // most recent application (so the form can show a status badge
  // instead of a fresh blank form if they've already applied).
  const [spotlightModalOpen, setSpotlightModalOpen] = useState(false);
  const [spotlightSubmitting, setSpotlightSubmitting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [spotlightMyApp, setSpotlightMyApp] = useState(null);
  // Phase 48 — thread + reply state. ``spotlightMessages`` is
  // populated when the user opens the modal on an existing
  // application; ``replyBody`` is the in-flight reply text;
  // ``replySubmitting`` disables the send button while the
  // POST is in flight. The ``spotlightStep`` state controls
  // which sub-view the modal renders: ``'form'`` (default,
  // for new applications + edits), ``'thread'`` (when
  // status is info_requested), ``'kyc'`` (when the user
  // wants to correct their PII).
  const [spotlightMessages, setSpotlightMessages] = useState([]);
  const [replyBody, setReplyBody] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [spotlightStep, setSpotlightStep] = useState('form');
  // Re-apply state. When the user clicks the re-apply button
  // on a rejected status pill, we POST to /reapply/ and let
  // the BE flip status back to pending. The local state is
  // updated from the response.
  const [reapplySubmitting, setReapplySubmitting] = useState(false);
  // The form mirrors the BE's expected payload structure:
  // top-level fields are the invention pitch (Phase 47);
  // ``kyc.*`` keys hold the PII side-table values (Phase 48).
  // We keep them in a single useState object so a single
  // setState call clears them on submit success / modal close.
  const [spotlightForm, setSpotlightForm] = useState({
    category: 'talent',
    invention_title: '',
    invention_description: '',
    link_url: '',
    cover_image: '',
    kyc: {
      legal_full_name: '',
      date_of_birth: '',
      id_document_type: 'passport',
      id_document_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      postcode: '',
      country_of_birth: 'HT',
      country_of_residence: 'HT',
      phone_number: '',
      accepted_terms: false,
    },
  });


  useEffect(() => {
    document.documentElement.style.setProperty('--font-family', fontFamily);
    localStorage.setItem('atelnyo_font_family', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    document.documentElement.style.setProperty('--pink-primary', themeColor);
    let rgb = '216, 27, 96';
    if (themeColor === '#d81b60') {rgb = '216, 27, 96';}
    else if (themeColor === '#00acc1') {rgb = '0, 172, 193';}
    else if (themeColor === '#43a047') {rgb = '67, 160, 71';}
    else if (themeColor === '#8e24aa') {rgb = '142, 36, 170';}
    else if (themeColor === '#fb8c00') {rgb = '251, 140, 0';}

    document.documentElement.style.setProperty('--pink-light', `rgba(${rgb}, 0.1)`);
    localStorage.setItem('atelnyo_theme_color', themeColor);
  }, [themeColor]);

  // Detect WebP support on mount
  useEffect(() => {
    import('../utils/webpDetection').then(({ detectWebPSupport }) => {
      detectWebPSupport().then((result) => {
        setWebpSupported(result.supported);
      });
    }).catch(() => {
      setWebpSupported(false);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('atelnyo_sonic_ui', sonicUi);
    window.playSynthSound = (type, param) => {
      if (localStorage.getItem('atelnyo_sonic_ui') !== 'true') {return;}
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'hover') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
          osc.frequency.setValueAtTime(1300, audioCtx.currentTime + 0.03);
          gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.05);
        } else if (type === 'save') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, audioCtx.currentTime);
          osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.08);
          osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.16);
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'toggle') {
          osc.type = 'sine';
          const isUp = param === true;
          osc.frequency.setValueAtTime(isUp ? 400 : 700, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(isUp ? 800 : 350, audioCtx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.2);
        }
      } catch (e) {
        console.error(e);
      }
    };
  }, [sonicUi]);

  useEffect(() => {
    localStorage.setItem('atelnyo_cyber_cursor', cyberCursor);
    if (!cyberCursor) {
      document.body.classList.remove('cyber-cursor-active');
      const existingCursor = document.getElementById('cyber-custom-cursor');
      if (existingCursor) {existingCursor.remove();}
      return;
    }

    document.body.classList.add('cyber-cursor-active');

    let cursor = document.getElementById('cyber-custom-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'cyber-custom-cursor';
      cursor.style.position = 'fixed';
      cursor.style.width = '20px';
      cursor.style.height = '20px';
      cursor.style.borderRadius = '50%';
      cursor.style.border = `2px solid ${themeColor}`;
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '99999';
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.style.transition = 'width 0.1s, height 0.1s';
      document.body.appendChild(cursor);
    }

    const moveCursor = (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;

      if (Math.random() < 0.15) {
        const particle = document.createElement('div');
        particle.className = 'cyber-particle-trail';
        particle.style.position = 'fixed';
        particle.style.left = `${e.clientX}px`;
        particle.style.top = `${e.clientY}px`;
        particle.style.width = '4px';
        particle.style.height = '4px';
        particle.style.borderRadius = '50%';
        particle.style.background = themeColor;
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '99998';
        particle.style.transform = 'translate(-50%, -50%)';
        particle.style.transition = 'all 0.5s ease-out';
        document.body.appendChild(particle);

        setTimeout(() => {
          particle.style.transform = 'translate(-50%, -50%) scale(0)';
          particle.style.opacity = '0';
          setTimeout(() => particle.remove(), 500);
        }, 10);
      }
    };

    const pressCursor = () => {
      cursor.style.width = '35px';
      cursor.style.height = '35px';
      cursor.style.background = `rgba(216, 27, 96, 0.2)`;
    };

    const releaseCursor = () => {
      cursor.style.width = '20px';
      cursor.style.height = '20px';
      cursor.style.background = 'transparent';
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mousedown', pressCursor);
    window.addEventListener('mouseup', releaseCursor);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mousedown', pressCursor);
      window.removeEventListener('mouseup', releaseCursor);
      if (cursor) {cursor.remove();}
      document.body.classList.remove('cyber-cursor-active');
    };
  }, [cyberCursor, themeColor]);

  useEffect(() => {
    document.body.classList.remove('fx-glass', 'fx-cyber', 'fx-matrix');
    if (ambientFx !== 'none') {
      document.body.classList.add(`fx-${ambientFx}`);
    }
    localStorage.setItem('atelnyo_ambient_fx', ambientFx);

    if (ambientFx === 'matrix') {
      const canvas = document.getElementById('matrix-canvas');
      if (!canvas) {return;}
      const ctx = canvas.getContext('2d');
      let animationFrameId;

      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      const columns = Math.floor(canvas.width / 20) + 1;
      const ypos = Array(columns).fill(0);

      const matrix = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = themeColor;
        ctx.font = '15pt monospace';

        ypos.forEach((y, ind) => {
          const chars = "ATELNYO10011001";
          const text = chars.charAt(Math.floor(Math.random() * chars.length));
          const x = ind * 20;
          ctx.fillText(text, x, y);

          if (y > 100 + Math.random() * 10000) {
            ypos[ind] = 0;
          } else {
            ypos[ind] = y + 20;
          }
        });
      };

      const render = () => {
        matrix();
        animationFrameId = requestAnimationFrame(render);
      };
      render();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [ambientFx, themeColor]);

  useEffect(() => {
    document.body.classList.remove('design-glass', 'design-brutalist');
    if (cardStyle !== 'classic') {
      document.body.classList.add(`design-${cardStyle}`);
    }
    localStorage.setItem('atelnyo_card_style', cardStyle);
  }, [cardStyle]);

  const handleResetAppearance = () => {
    setResetConfirm(true);
    const APPEARANCE_KEYS = [
      'atelnyo_theme_color',
      'atelnyo_ambient_fx',
      'atelnyo_card_style',
      'atelnyo_sonic_ui',
      'atelnyo_cyber_cursor',
      'atelnyo_font_family',
      'atelnyo_theme',
      'atelnyo_fontsize',
    ];
    APPEARANCE_KEYS.forEach((k) => {
      try { localStorage.removeItem(k);      } catch (_) { /* ignore */ }
    });
    window.location.reload();
  };

  // Sonic + CyberCursor toggle helpers. Both rows used to wire the
  // toggle to the row's ``onClick`` with the input's ``onChange``
  // stubbed to ``() => {}`` — clicking the switch itself did NOTHING
  // because (a) ``e.stopPropagation()`` on the label blocked the
  // bubbling click from reaching the row, AND (b) the input's
  // onChange was a no-op. Now both surfaces (row + switch) call the
  // same helper so a click anywhere on the row or on the switch
  // toggles exactly once. The row's ``onClick`` early-returns when
  // the click target is inside ``label.switch`` or the input itself
  // so we don't ``toggleX(!state)`` AND have ``e.target.checked``
  // fire ``toggleX(checked)`` for the same click — that would flip
  // back to the original state.
  const toggleSonicUi = (nextVal) => {
    setSonicUi(nextVal);
    // The 10ms defer ensures the post-render useEffect has landed
    // ``'true'`` into localStorage BEFORE ``playSynthSound`` (which
    // early-returns if localStorage isn't ``'true'``) is invoked.
    if (nextVal) {
      setTimeout(() => window.playSynthSound?.('toggle', true), 10);
    }
  };
  const toggleCyberCursor = (nextVal) => {
    setCyberCursor(nextVal);
    window.playSynthSound?.('toggle', nextVal);
  };

  // ─── Sheet navigation helper ──────────────────────────────────────
  // Closes settings overlay then navigates to the target sheet.
  // Using onClose first prevents the overlay from lingering over
  // the sheet route (which would create a two-layer UX).
  const navigateToSheet = useCallback((path) => {
    if (onClose) {onClose();}
    navigate(path);
  }, [onClose, navigate]);

  // ─── Sheet links registry — tout lyen sheet yo reyini ──────────────
  // Each entry maps to a /sheet/* route. The ``hint`` field shows
  // a short description in the current language; ``auth`` when true
  // gates the row (the click handler shows a toast + bounces the
  // user to sign in). Order here is the display order in the UI.
  const sheetLinks = [
    {
      path: SHEETS.CALENDAR,
      icon: 'fa-calendar',
      label: lang === 'ht' ? 'Kalandriye'
        : lang === 'fr' ? 'Calendrier'
        : lang === 'es' ? 'Calendario'
        : 'Calendar',
      hint: lang === 'ht' ? 'Aktivite ak evènman'
        : lang === 'fr' ? 'Activités et événements'
        : lang === 'es' ? 'Actividades y eventos'
        : 'Activities and events',
    },
    {
      path: SHEETS.STUDIO,
      icon: 'fa-crown',
      requiresCreator: true,
      label: lang === 'ht' ? 'Creator Studio'
        : lang === 'fr' ? 'Creator Studio'
        : lang === 'es' ? 'Creator Studio'
        : 'Creator Studio',
      hint: lang === 'ht' ? 'Jere kou, mizik, pwodwi, analitik, bous ou'
        : lang === 'fr' ? 'Gérez vos cours, musique, produits, analytics, portefeuille'
        : lang === 'es' ? 'Gestiona tus cursos, música, productos, análisis, billetera'
        : 'Manage your courses, music, products, analytics, wallet',
    },
  ];

  // ─── Phase 47 — Creator Spotlight unlock + apply flow ─────────────
  // 5 taps on the hidden version label (rendered at the bottom of
  // the panel) within 3s of each other flips ``spotlightUnlocked``.
  // The unlock is persisted to localStorage so a page refresh
  // doesn't reset it. The 3s reset window keeps the gesture
  // intentional — a user who taps the label 5 times across a week
  // shouldn't accidentally unlock it.
  const handleSpotlightVersionTap = () => {
    // Reset the timer on every tap; if 3s elapses without a 5th
    // tap, the counter falls back to 0 (the cleanup below).
    if (spotlightTapsTimerRef.current) {
      clearTimeout(spotlightTapsTimerRef.current);
    }
    const nextCount = spotlightTaps + 1;
    setSpotlightTaps(nextCount);
    if (nextCount >= 5) {
      setSpotlightUnlocked(true);
      try { localStorage.setItem('atelnyo_spotlight_unlocked', 'true'); } catch (_) { /* ignore */ }
      setSpotlightTaps(0);
      window.playSynthSound?.('save');
      showToast?.(
        lang === 'ht' ? '🔓 Spotlight dekachre! Klike sou bouton an pou aplike.'
          : lang === 'fr' ? '🔓 Spotlight déverrouillé! Cliquez sur le bouton pour postuler.'
          : lang === 'es' ? '🔓 ¡Spotlight desbloqueado! Haz clic en el botón para postularte.'
          : '🔓 Spotlight unlocked! Tap the button to apply.',
        'unlock',
      );
      return;
    }
    // Schedule a reset if the user stalls mid-gesture.
    spotlightTapsTimerRef.current = setTimeout(() => {
      setSpotlightTaps(0);
      spotlightTapsTimerRef.current = null;
    }, 3000);
  };

  // Phase 50 — Creator Apply unlock. 3 taps on a NEW hidden
  // element ("Made with ❤️ in Ayiti" footer, rendered below
  // the Spotlight version label) within 3s flips
  // ``creatorApplyUnlocked`` to true. Same persistence + 3s
  // reset as the Spotlight 5-tap. The 3-tap vs 5-tap asymmetry
  // keeps the two easter eggs from feeling identical (a
  // user who finds both feels like they got a reward twice,
  // not the same gesture). The unlock flag is mirrored in
  // CreatorApply.jsx (single source of truth: the localStorage
  // key — both files read it but neither holds canonical
  // state in React).
  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    if (deleteAccountInput.trim() !== 'DELETE') {
      showToast?.(
        lang === 'ht' ? 'Tape DELETE nan chan an pou konfime efase kont lan.'
          : lang === 'fr' ? 'Tapez DELETE dans le champ pour confirmer la suppression du compte.'
          : lang === 'es' ? 'Escribe DELETE en el campo para confirmar la eliminación de la cuenta.'
          : 'Type DELETE in the field to confirm account deletion.',
        'circle-exclamation',
      );
      return;
    }
    if (!deletePassword.trim()) {
      showToast?.(
        lang === 'ht' ? 'Antre modpas aktyèl ou pou efase kont lan.'
          : lang === 'fr' ? 'Entrez votre mot de passe actuel pour supprimer le compte.'
          : lang === 'es' ? 'Introduce tu contraseña actual para eliminar tu cuenta.'
          : 'Enter your current password to delete your account.',
        'circle-exclamation',
      );
      return;
    }

    setDeletingAccount(true);
    try {
      await authService.deleteAccount(deletePassword);
      setDeleteAccountOpen(false);
      setDeleteAccountInput('');
      setDeletePassword('');
      if (onClose) { onClose(); }
      if (onLogout) { await onLogout('account_deleted'); }
    } catch (err) {
      const message = err?.response?.data?.error
        || err?.response?.data?.detail
        || (lang === 'ht' ? 'Pa t kapab efase kont ou. Eseye ankò.'
          : lang === 'fr' ? 'Impossible de supprimer votre compte. Réessayez.'
          : lang === 'es' ? 'No se pudo eliminar tu cuenta. Inténtalo de nuevo.'
          : 'Could not delete your account. Please try again.');
      showToast?.(message, 'circle-exclamation');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleCreatorApplyVersionTap = () => {
    if (creatorApplyTapsTimerRef.current) {
      clearTimeout(creatorApplyTapsTimerRef.current);
    }
    const nextCount = creatorApplyTaps + 1;
    setCreatorApplyTaps(nextCount);
    if (nextCount >= 3) {
      setCreatorApplyUnlocked(true);
      try { localStorage.setItem('atelnyo_creator_apply_unlocked', 'true'); } catch (_) { /* ignore */ }
      setCreatorApplyTaps(0);
      window.playSynthSound?.('save');
      showToast?.(
        lang === 'ht' ? '🔓 Devenir Créateur dekachre! Klike sou bouton an pou kontinye.'
          : lang === 'fr' ? '🔓 Devenir Créateur déverrouillé! Cliquez pour continuer.'
          : lang === 'es' ? '🔓 ¡Devenir Créateur desbloqueado! Haz clic para continuar.'
          : '🔓 Become a Creator unlocked! Tap the button to continue.',
        'unlock',
      );
      return;
    }
    creatorApplyTapsTimerRef.current = setTimeout(() => {
      setCreatorApplyTaps(0);
      creatorApplyTapsTimerRef.current = null;
    }, 3000);
  };

  // Phase 50 — Open the Creator Apply sheet. Hard redirect via
  // the navigate call (we don't open a modal — the application
  // lives at a dedicated /sheet/creator-apply route so a user
  // can deep-link the page or share the URL with a candidate).
  const openCreatorApplySheet = () => {
    if (!user) {
      showToast?.(
        lang === 'ht' ? 'Konekte pou wè opsyon Devenir Kreyatè.'
          : lang === 'fr' ? 'Connectez-vous pour voir l\'option Devenir Créateur.'
          : lang === 'es' ? 'Inicia sesión para ver la opción Devenir Creador.'
          : 'Sign in to see the Become a Creator option.',
        'user-lock',
      );
      onAuthOpen?.();
      return;
    }
    // Close the settings overlay first so the routed sheet can
    // take over the viewport. App.jsx will mount the sheet
    // through the <Route path="/sheet/creator-apply" ...> entry.
    if (onClose) {onClose();}
    navigate(SHEETS.CREATOR_APPLY);
  };

  // Open the application modal. If the user already submitted,
  // pre-load their most recent application so the modal shows
  // the status badge instead of a blank form.
  //
  // Phase 48 — the modal opens in different sub-views based on
  // the application status:
  //   * No application yet → ``spotlightStep = 'form'`` (default).
  //   * status=info_requested → ``spotlightStep = 'thread'`` (the
  //     user needs to see + reply to the admin's question before
  //     anything else). We also fetch the full message thread.
  //   * status=approved / pending / under_review → ``'form'``
  //     (read-only summary with a "Submit another application" CTA
  //     if the user wants to start fresh).
  //   * status=rejected → ``'form'`` (the launcher shows a
  //     "Re-apply" button on the status pill, not inside the
  //     modal).
  const openSpotlightModal = async () => {
    if (!user) {
      showToast?.(
        lang === 'ht' ? 'Konekte pou aplike pou Spotlight.'
          : lang === 'fr' ? 'Connectez-vous pour postuler à Spotlight.'
          : lang === 'es' ? 'Inicia sesión para postularte a Spotlight.'
          : 'Sign in to apply for Spotlight.',
        'user-lock',
      );
      onAuthOpen?.();
      return;
    }
    setSpotlightModalOpen(true);
    setSpotlightStep('form');
    setReplyBody('');
    setSpotlightMessages([]);
    // Cancelled guard: if the user closes the modal before the
    // /mine/ response lands, the setState calls would fire on
    // an unmounted component. Without this guard, React logs
    // a "state update on unmounted" warning in dev. Same idiom
    // as the saved-IDs fetch above (reviewer #2).
    let cancelled = false;
    openSpotlightModalRequestRef.current = () => { cancelled = true; };
    try {
      const res = await spotlightService.mine();
      if (cancelled) {return;}
      const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      // Most recent application (the BE returns -created_at).
      const app = list && list.length > 0 ? list[0] : null;
      setSpotlightMyApp(app);
      // Phase 49 §11.1 — Gateway to the thread is now
      // ``app.is_unread === true`` (not ``app.status ===
      // 'info_requested'``). The unread flag is recomputed on
      // every /mine/ read by the BE (admin messages that are
      // newer than the latest applicant reply leave
      // is_unread=true). So this branch fires:
      //   * On a brand-new info_requested application
      //     (admin sent a question but applicant hasn't
      //     responded yet) — classic case.
      //   * On an info_requested application whose admin
      //     sent a FOLLOW-UP after the applicant's last
      //     reply (rare but real — admin refined the
      //     question). The old `status === 'info_requested'`
      //     gate would also fire here, but the new
      //     ``is_unread`` gate reads cleaner and skips a
      //     stale "any unanswered thread" refresh when the
      //     applicant has already replied.
      // The thread component itself owns the deadline
      // banner rendering — we just have to land the user
      // on the thread view.
      if (app && app.is_unread) {
        setSpotlightStep('thread');
        try {
          const msgRes = await spotlightService.messages(app.id);
          if (cancelled) {return;}
          const msgs = Array.isArray(msgRes?.data) ? msgRes.data : [];
          setSpotlightMessages(msgs);
        } catch (_) { /* swallow — empty thread is fine */ }
      }
    } catch (_) {
      if (cancelled) {return;}
      // Network failure — the modal still opens; the form can be
      // submitted and the BE will accept it regardless of whether
      // /mine/ worked. The toast in catch below is intentionally
      // silent to avoid double-toasting on a slow connection.
      setSpotlightMyApp(null);
    } finally {
      openSpotlightModalRequestRef.current = null;
    }
  };

  const closeSpotlightModal = () => {
    setSpotlightModalOpen(false);
    setSpotlightStep('form');
    setReplyBody('');
    setSpotlightMessages([]);
    setSpotlightForm({
      category: 'talent',
      invention_title: '',
      invention_description: '',
      link_url: '',
      cover_image: '',
      kyc: {
        legal_full_name: '',
        date_of_birth: '',
        id_document_type: 'passport',
        id_document_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        country_of_birth: 'HT',
        country_of_residence: 'HT',
        phone_number: '',
        accepted_terms: false,
      },
    });
  };

  // Phase 48 — reply to an admin question in the message thread.
  // The BE auto-flips status back to ``under_review`` on a
  // successful applicant reply, so we re-fetch the application
  // to update the local status pill.
  const submitReply = async (e) => {
    e?.preventDefault?.();
    if (replySubmitting || !spotlightMyApp) {return;}
    const body = replyBody.trim();
    if (!body) {return;}
    setReplySubmitting(true);
    try {
      const res = await spotlightService.postMessage(spotlightMyApp.id, body);
      // Append the new message to the local thread; the BE
      // returns the full message object (with id, created_at,
      // sender_role, etc.). Optimistic append is risky if the
      // server timestamps differ from the local clock, so we
      // wait for the response.
      setSpotlightMessages((prev) => [...prev, res.data]);
      setReplyBody('');
      // Re-fetch the application to update the status pill
      // (it may have flipped back to under_review).
      try {
        const freshRes = await spotlightService.mine();
        const list = Array.isArray(freshRes?.data) ? freshRes.data : (freshRes?.data?.results || []);
        if (list && list.length > 0) {setSpotlightMyApp(list[0]);}
      } catch (_) { /* silent */ }
      showToast?.(
        lang === 'ht' ? '✉️ Repons ou voye!'
          : lang === 'fr' ? '✉️ Réponse envoyée!'
          : lang === 'es' ? '✉️ ¡Respuesta enviada!'
          : '✉️ Reply sent!',
        'paper-plane',
      );
    } catch (err) {
      const msg = err?.response?.data?.body?.[0]
        || err?.response?.data?.detail
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab voye repons lan.'
          : lang === 'fr' ? 'Impossible d\'envoyer la réponse.'
          : lang === 'es' ? 'No se pudo enviar la respuesta.'
          : 'Could not send reply.');
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Phase 48 — re-apply after rejection. The BE resets status
  // to ``pending``; we update local state from the response
  // and surface a toast. The "rejected" status pill disappears
  // because the launcher re-renders with the new status.
  const handleReapply = async () => {
    if (reapplySubmitting || !spotlightMyApp) {return;}
    setReapplySubmitting(true);
    try {
      const res = await spotlightService.reapply(spotlightMyApp.id);
      setSpotlightMyApp(res.data);
      showToast?.(
        lang === 'ht' ? '✨ Aplikasyon ou re-soumet! N ap revize l ankò.'
          : lang === 'fr' ? '✨ Candidature re-soumise! Nous l\'examinerons à nouveau.'
          : lang === 'es' ? '✨ ¡Solicitud reenviada! La revisaremos de nuevo.'
          : '✨ Application re-submitted! We\'ll review it again.',
        'paper-plane',
      );
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab re-soumet aplikasyon an.'
          : lang === 'fr' ? 'Impossible de re-soumettre la candidature.'
          : lang === 'es' ? 'No se pudo reenviar la solicitud.'
          : 'Could not re-submit application.');
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setReapplySubmitting(false);
    }
  };

  const [spotlightCoverUploading, setSpotlightCoverUploading] = useState(false);
  const [spotlightCoverProgress, setSpotlightCoverProgress] = useState(null);
  const [spotlightCoverFormat, setSpotlightCoverFormat] = useState('auto'); // 'auto' | 'jpeg' | 'webp'
  const [spotlightCoverQuality, setSpotlightCoverQuality] = useState(82); // 1-100
  const [webpSupported, setWebpSupported] = useState(null); // null = checking, true/false = result

  // Premium file upload handler for Spotlight cover image
  const handleSpotlightCoverUpload = async (file) => {
    if (!file) return;
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast?.(
        lang === 'ht' ? 'Sèlman imaj yo aksepte.' : 'Only images are accepted.',
        'circle-exclamation',
      );
      return;
    }
    // Validate file size (10MB max before compression)
    if (file.size > 10 * 1024 * 1024) {
      showToast?.(
        lang === 'ht' ? 'Imaj la twò gwo (max 10MB).' : 'Image is too large (max 10MB).',
        'circle-exclamation',
      );
      return;
    }
    setSpotlightCoverUploading(true);
    setSpotlightCoverProgress({ stage: 'starting', percent: 0 });
    try {
      // Compress image before upload for better performance
      let uploadFile = file;
      try {
        const { compressImage, formatFileSize, compressionRatio } = await import('../utils/imageCompression');
        const outputFormat = spotlightCoverFormat === 'webp' ? 'image/webp'
          : spotlightCoverFormat === 'jpeg' ? 'image/jpeg'
          : 'auto';
        const compressed = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 800,
          quality: spotlightCoverQuality / 100,
          outputFormat,
          onProgress: (p) => setSpotlightCoverProgress(p),
        });
        if (!compressed.skipped) {
          uploadFile = compressed.file;
          const savings = compressionRatio(compressed.originalSize, compressed.compressedSize);
          console.log(`[Spotlight] Image compressed: ${formatFileSize(compressed.originalSize)} → ${formatFileSize(compressed.compressedSize)} (${savings})`);
        }
      } catch (compressErr) {
        // Compression failed — upload original
        console.warn('[Spotlight] Compression failed, uploading original:', compressErr);
      }
      setSpotlightCoverProgress({ stage: 'uploading', percent: 85 });
      const url = res?.data?.url || res?.data?.image_url;
      if (url) {
        setSpotlightCoverProgress({ stage: 'done', percent: 100 });
        setSpotlightForm((f) => ({ ...f, cover_image: url }));
        showToast?.(
          lang === 'ht' ? '✅ Imaj la monte!' : '✅ Image uploaded!',
          'check-circle',
        );
      }
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab monte imaj lan.' : 'Could not upload image.');
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setSpotlightCoverUploading(false);
      setTimeout(() => setSpotlightCoverProgress(null), 500);
    }
  };

  const submitSpotlightApplication = async (e) => {
    e.preventDefault();
    if (spotlightSubmitting) {return;}
    // Defensive: if the user signs out mid-modal, the BE will 401
    // and the generic catch handler will show a confusing
    // "Could not submit application" toast. Short-circuit to
    // the "sign in" path so the user knows what to do.
    if (!user) {
      showToast?.(
        lang === 'ht' ? 'Konekte pou aplike pou Spotlight.'
          : lang === 'fr' ? 'Connectez-vous pour postuler à Spotlight.'
          : lang === 'es' ? 'Inicia sesión para postularte a Spotlight.'
          : 'Sign in to apply for Spotlight.',
        'user-lock',
      );
      closeSpotlightModal();
      onAuthOpen?.();
      return;
    }
    setSpotlightSubmitting(true);
    try {
      // Phase 48 — the KYC payload is sent as ``kyc_data`` (the
      // serializer's write-only nested field). The BE unwraps
      // it and creates both the application AND the KYC row
      // inside one transaction. On a re-apply (existing
      // application), the KYC update would have to go through
      // PUT /api/spotlight/<id>/kyc/ — but for first-time
      // submit, this one-shot form is the simplest path.
      const res = await spotlightService.apply({
        category: spotlightForm.category,
        invention_title: spotlightForm.invention_title.trim(),
        invention_description: spotlightForm.invention_description.trim(),
        link_url: spotlightForm.link_url.trim(),
        cover_image: spotlightForm.cover_image.trim(),
        kyc_data: {
          legal_full_name: spotlightForm.kyc.legal_full_name.trim(),
          date_of_birth: spotlightForm.kyc.date_of_birth,
          id_document_type: spotlightForm.kyc.id_document_type,
          id_document_number: spotlightForm.kyc.id_document_number.trim(),
          address_line1: spotlightForm.kyc.address_line1.trim(),
          address_line2: spotlightForm.kyc.address_line2.trim(),
          city: spotlightForm.kyc.city.trim(),
          postcode: (spotlightForm.kyc.postcode || '').trim(),
          country_of_birth: spotlightForm.kyc.country_of_birth.toUpperCase(),
          country_of_residence: spotlightForm.kyc.country_of_residence.toUpperCase(),
          phone_number: spotlightForm.kyc.phone_number.trim(),
          accepted_terms: spotlightForm.kyc.accepted_terms,
        },
      });
      // Update the local "my application" so the success badge
      // appears immediately.
      setSpotlightMyApp(res?.data || {
        ...spotlightForm,
        status: 'pending',
      });
      closeSpotlightModal();
      showToast?.(
        lang === 'ht' ? '✨ Aplikasyon ou voye! N ap revize l byento.'
          : lang === 'fr' ? '✨ Candidature envoyée! Nous l\'examinerons bientôt.'
          : lang === 'es' ? '✨ ¡Solicitud enviada! La revisaremos pronto.'
          : '✨ Application sent! We\'ll review it soon.',
        'paper-plane',
      );
    } catch (err) {
      const fieldErr = err?.response?.data?.invention_description?.[0]
        || err?.response?.data?.invention_title?.[0]
        || err?.response?.data?.kyc_data?.non_field_errors?.[0]
        || err?.response?.data?.kyc_data?.legal_full_name?.[0]
        || err?.response?.data?.kyc_data?.date_of_birth?.[0]
        || err?.response?.data?.kyc_data?.phone_number?.[0]
        || err?.response?.data?.detail
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab voye aplikasyon an.'
          : lang === 'fr' ? 'Impossible d\'envoyer la candidature.'
          : lang === 'es' ? 'No se pudo enviar la solicitud.'
          : 'Could not submit application.');
      showToast?.(fieldErr, 'circle-exclamation');
    } finally {
      setSpotlightSubmitting(false);
    }
  };

  const languages = [
    { id: 'ht', label: 'Kreyòl Ayisyen', icon: 'fa-language' },
    { id: 'en', label: 'English', icon: 'fa-globe' },
    { id: 'es', label: 'Español', icon: 'fa-globe-americas' },
    { id: 'fr', label: 'Français', icon: 'fa-globe-europe' }
  ];

  return (
    <>
    <div className={`settings-overlay ${isOpen ? 'active' : ''}`}>
      <div className="settings-header">
        <button className="icon-btn settings-header-close" onClick={onClose}>
          <i className="fas fa-chevron-down" />
        </button>
        <h2>{t.settings_title || t.settings}</h2>
        <div className="settings-header-spacer" />
      </div>

      <div className="settings-content" ref={settingsContentRef}>
        {deleteAccountOpen && (
          <ConfirmModal
            title={t2(lang, { ht: 'Efase kont definitivman', en: 'Delete account permanently', fr: 'Supprimer définitivement le compte', es: 'Eliminar la cuenta permanentemente' })}
            lang={lang}
            variant="danger"
            loading={deletingAccount}
            onCancel={() => {
              setDeleteAccountOpen(false);
              setDeleteAccountInput('');
              setDeletePassword('');
            }}
            onConfirm={handleDeleteAccount}
            confirmText={t2(lang, { ht: 'Efase kont', en: 'Delete account', fr: 'Supprimer le compte', es: 'Eliminar cuenta' })}
            cancelText={t2(lang, { ht: 'Annile', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' })}
            message={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
                <p style={{ margin: 0 }}>
                  {t2(lang, {
                    ht: 'Aksyon sa a pa ka retounen. Tout profil, mesaj, ak done ou yo ap retire definitivman.',
                    en: 'This action is permanent. Your profile, messages, and data will be removed permanently.',
                    fr: 'Cette action est irréversible. Votre profil, vos messages et vos données seront supprimés définitivement.',
                    es: 'Esta acción es permanente. Tu perfil, mensajes y datos se eliminarán permanentemente.',
                  })}
                </p>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                  {t2(lang, { ht: 'Tape DELETE pou konfime', en: 'Type DELETE to confirm', fr: 'Tapez DELETE pour confirmer', es: 'Escribe DELETE para confirmar' })}
                  <input
                    autoFocus
                    type="text"
                    value={deleteAccountInput}
                    onChange={(e) => setDeleteAccountInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleDeleteAccount();
                      }
                    }}
                    placeholder="DELETE"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color-strong, #cbd5e1)',
                      background: 'var(--bg-primary, #fff)',
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '0.95rem',
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                  {t2(lang, { ht: 'Antre modpas aktyèl ou', en: 'Enter your current password', fr: 'Entrez votre mot de passe actuel', es: 'Introduce tu contraseña actual' })}
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleDeleteAccount();
                      }
                    }}
                    placeholder={t2(lang, { ht: 'Modpas', en: 'Password', fr: 'Mot de passe', es: 'Contraseña' })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color-strong, #cbd5e1)',
                      background: 'var(--bg-primary, #fff)',
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '0.95rem',
                    }}
                  />
                </label>
              </div>
            )}
          />
        )}
        {/* ═══ Category hub — one tile per category; click to drill in ═══ */}
        {settingsCategory === null && (
          <>
            {/* Recently-opened shortcut strip */}
            {recentCategories.length > 0 && (
              <div className="settings-recent" data-testid="settings-recent">
                <div className="settings-recent-title">
                  {t2(lang, { ht: 'Resan', fr: 'Récents', es: 'Recientes', en: 'Recently opened' })}
                </div>
                <div className="settings-recent-chips">
                  {recentCategories.map((id) => {
                    const cat = SETTINGS_CATEGORIES.find((c) => c.id === id);
                    if (!cat) { return null; }
                    return (
                      <button
                        key={id}
                        type="button"
                        className="settings-recent-chip"
                        onClick={() => openCategory(id)}
                        data-testid={`settings-recent-${id}`}
                      >
                        <i className={`fas ${cat.icon}`} aria-hidden="true" />
                        {categoryLabel(cat, lang)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          <div className="settings-category-hub" data-testid="settings-category-hub">
            {SETTINGS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="settings-category-tile"
                onClick={() => openCategory(cat.id)}
                data-testid={`settings-category-${cat.id}`}
              >
                <div className="settings-category-icon">
                  <i className={`fas ${cat.icon}`} aria-hidden="true" />
                </div>
                <div className="settings-category-body">
                  <span className="settings-category-title">{categoryLabel(cat, lang)}</span>
                  <span className="settings-category-desc">{categoryDesc(cat, lang)}</span>
                </div>
                <i className="fas fa-chevron-right settings-category-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
          </>
        )}

        {/* Back to the hub when inside a category */}
        {settingsCategory !== null && (
          <button
            type="button"
            className="settings-back-btn"
            onClick={() => setSettingsCategory(null)}
            data-testid="settings-category-back"
          >
            <i className="fas fa-arrow-left" aria-hidden="true" />
            {lang === 'ht' ? 'Retounen nan kategorì yo'
              : lang === 'fr' ? 'Retour aux catégories'
              : lang === 'es' ? 'Volver a las categorías'
              : 'Back to categories'}
          </button>
        )}

        {/* Account Section — sign-in / log-out only. The avatar / bio /
            username inline editors have moved into the Privacy Space
            Identity tab so the user's identity lives in one place. */}
        {settingsCategory === 'account' && (<>
        <div className="settings-section-title">{t.account_section}</div>
        <div className="settings-section">
          <div className="auth-container">
            {user ? (
              <div className="settings-account">
                <span className="settings-username">
                  {identity.displayLabel || identity.displayName}
                  <i className="fas fa-check-circle" />
                </span>
                {/* NB: must NOT pass the click event as the first arg —
                    handleLogout(reason) would receive an Event object and
                    treat it as a non-'user' reason, skipping the server-side
                    refresh-token blacklist. Header.jsx uses the same pattern. */}
                <button onClick={() => onLogout('user')} className="settings-logout-btn">{t.logout || 'Logout'}</button>
                <button
                  type="button"
                  onClick={() => setDeleteAccountOpen(true)}
                  className="settings-delete-account-btn"
                >
                  <i className="fas fa-trash" aria-hidden="true" />
                  {t2(lang, { ht: 'Efase kont', en: 'Delete account', fr: 'Supprimer le compte', es: 'Eliminar cuenta' })}
                </button>

                {/* Phase 32 — Premium upsell. Only shown to non-premium users.
                    Opens the Stripe CheckoutModal for subscription. */}
                {/* Phase — Premium users see their ACTIVE subscription card
                    (plan + expiry, from /api/me/ UserSerializer.premium)
                    instead of the upsell button. Cancelled / expired rows
                    read is_premium False and fall back to the upsell. */}
                {user?.premium?.is_premium ? (
                  <div className="settings-sub-card">
                    <div className="settings-sub-card-head">
                      <i className="fas fa-crown" aria-hidden="true" />
                      <span className="settings-sub-card-title">
                        {t2(lang, { ht: 'Premium aktive', en: 'Premium active' })}
                      </span>
                      <span className="settings-sub-card-status">
                        <i className="fas fa-circle" aria-hidden="true" />
                        {t2(lang, { ht: 'Aktif', en: 'Active' })}
                      </span>
                    </div>
                    <div className="settings-sub-card-rows">
                      <div className="settings-sub-row">
                        <span className="settings-sub-row-label">Plan</span>
                        <span className="settings-sub-row-value">
                          {premiumPlanLabel(user.premium.plan, lang)}
                        </span>
                      </div>
                      {user.premium.expires_at && user.premium.plan !== 'lifetime' && (
                        <div className="settings-sub-row">
                          <span className="settings-sub-row-label">{t2(lang, { ht: 'Ekspirasyon', en: 'Expires' })}</span>
                          <span className="settings-sub-row-value">
                            {fmtDate(user.premium.expires_at)}
                          </span>
                        </div>
                      )}
                      {user.premium.expires_at && user.premium.plan !== 'lifetime' && (() => {
                        const expiry = new Date(user.premium.expires_at);
                        const now = new Date();
                        const diff = expiry - now;
                        if (diff <= 0) return null;
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const isUrgent = days < 3;
                        return (
                          <div className="settings-countdown">
                            <div className="settings-countdown-label">
                              <i className="fas fa-hourglass-half" aria-hidden="true" />
                              {t2(lang, { ht: 'Rezèv chak', en: 'Remaining' })}
                            </div>
                            <div className="settings-countdown-timer">
                              {days > 0 && (
                                <span className="settings-countdown-block">
                                  <span className={`settings-countdown-num ${isUrgent ? 'settings-countdown-urgent' : ''}`}>{days}</span>
                                  <span className="settings-countdown-unit">
                                    {lang === 'ht' ? 'jou' : 'd'}</span>
                                </span>
                              )}
                              <span className="settings-countdown-block">
                                <span className={`settings-countdown-num ${isUrgent ? 'settings-countdown-urgent' : ''}`}>{hours}</span>
                                <span className="settings-countdown-unit">
                                  {lang === 'ht' ? 'èdtan' : 'h'}</span>
                              </span>
                              <span className="settings-countdown-block">
                                <span className={`settings-countdown-num ${isUrgent ? 'settings-countdown-urgent' : ''}`}>{minutes}</span>
                                <span className="settings-countdown-unit">
                                  {lang === 'ht' ? 'minit' : 'm'}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      {user.premium.plan === 'lifetime' && (
                        <div className="settings-sub-row">
                          <span className="settings-sub-row-label">{t2(lang, { ht: 'Ekspirasyon', en: 'Expires' })}</span>
                          <span className="settings-sub-row-value">
                            {t2(lang, { ht: 'Pa janm — pou tout vi', en: 'Never — for life' })}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Auto-renewal toggle — hidden for lifetime plans */}
                    {user.premium.plan !== 'lifetime' && (
                      <div className="settings-sub-card-footer">
                        <div className="settings-auto-renew-row">
                          <div className="settings-auto-renew-info">
                            <i className="fas fa-sync-alt" aria-hidden="true" />
                            <span className="settings-auto-renew-label">
                              {t2(lang, { ht: 'Renouvèlman otomatik', en: 'Auto-renewal' })}
                            </span>
                          </div>
                          <label className="switch" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={user.premium.auto_renew !== false}
                              disabled={cancellingPremium}
                              onChange={async (e) => {
                                const enable = e.target.checked;
                                try {
                                  setCancellingPremium(true);
                                  const { checkoutService } = await import('../services/api.js');
                                  await checkoutService.toggleAutoRenew(enable);
                                  // Refresh user data to reflect the change
                                  window.location.reload();
                                } catch (err) {
                                  console.error('Toggle auto-renew failed:', err);
                                  setCancellingPremium(false);
                                  alert(t2(lang, {
                                    ht: 'Echwe. Eseye ankò.',
                                    en: 'Failed. Please try again.',
                                  }));
                                }
                              }}
                            />
                            <span className="slider" />
                          </label>
                        </div>
                        <p className="settings-auto-renew-hint">
                          {user.premium.auto_renew !== false
                            ? t2(lang, {
                                ht: 'Abònman ou an pral renouvle otomatikman nan {date}.',
                                en: 'Your subscription will auto-renew on {date}.',
                              }).replace('{date}', user.premium.expires_at ? fmtDate(user.premium.expires_at) : '—')
                            : t2(lang, {
                                ht: 'Ou pa pral renouvle. Ou gen aksè jiskiskè {date}.',
                                en: 'Will not renew. You keep access until {date}.',
                              }).replace('{date}', user.premium.expires_at ? fmtDate(user.premium.expires_at) : '—')
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  user && (
                    <button
                      onClick={() => setPremiumOpen(true)}
                      className="settings-premium-btn"
                    >
                      <i className="fas fa-crown" /> Premium
                    </button>
                  )
                )}
              </div>
            ) : (
              <div onClick={onAuthOpen} className="btn-auth btn-login">{t.login} / {t.signup}</div>
            )}
          </div>
        </div>
        </>)}

        {/* Appearance Section */}
        {settingsCategory === 'appearance' && (<>
        <div className="settings-section-title">{t.appearance_section}</div>
        <div className="settings-section">
          <div className="settings-item-reset">
            <div className="settings-item-icon">
              <i className="fas fa-undo settings-reset-icon" />
              <div className="settings-item-desc">
                <span className="settings-item-label settings-item-label--bold">{t2(lang, { ht: 'Reyajiste tout aparans', en: 'Reset all appearance' })}</span>
                <span className="settings-item-label-sm">
                  {lang === 'ht'
                    ? 'Retire tout efè vizyèl + tèm. W ap toujou konekte.'
                    : 'Clear all visual FX + theme. You will stay logged in.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetAppearance}
              className="btn-reset"
              title={t2(lang, { ht: 'Reyajiste tout', en: 'Reset all' })}
            >
              <i className="fas fa-rotate-left settings-reset-icon-btn" />
              {t2(lang, { ht: 'Reyajiste', en: 'Reset' })}
            </button>
          </div>
          <div className="settings-item" onClick={toggleTheme}>
            <div className="settings-item-icon">
              <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} settings-icon-badge`} />
              <span className="settings-item-label">{t.dark_mode}</span>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={darkMode} onChange={toggleTheme} />
              <span className="slider" />
            </label>
          </div>

          <div className="settings-item-column">
            <div className="settings-item-icon">
              <i className="fas fa-palette settings-icon-badge" />
              <span className="settings-item-label">{t2(lang, { ht: 'Koulè tèm nan', en: 'Theme Color' })}</span>
            </div>
            <div className="settings-theme-colors">
              {[
                { hex: '#d81b60', name: 'Pink' },
                { hex: '#00acc1', name: 'Blue' },
                { hex: '#43a047', name: 'Green' },
                { hex: '#8e24aa', name: 'Purple' },
                { hex: '#fb8c00', name: 'Orange' }
              ].map(color => (
                <button
                  key={color.hex}
                  onClick={() => setThemeColor(color.hex)}
                  className={`settings-theme-color-btn ${themeColor === color.hex ? 'active' : ''}`}
                  style={{ background: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-icon">
              <i className="fas fa-font settings-icon-badge" />
              <span className="settings-item-label">{t2(lang, { ht: 'Kalite Tèks', en: 'Font Family' })}</span>
            </div>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="settings-font-select"
            >
              <option value="'Poppins', sans-serif">Poppins</option>
              <option value="'Outfit', sans-serif">Outfit</option>
              <option value="'Inter', sans-serif">Inter</option>
              <option value="'Roboto Mono', monospace">Roboto Mono</option>
            </select>
          </div>

          <div className="settings-item" style={{ borderBottom: showAdvancedAppearance ? '1px solid var(--pink-light)' : 'none' }}>
            <div className="settings-item-icon">
              <i className="fas fa-text-height settings-icon-badge" />
              <span className="settings-item-label">{t.text_size}</span>
            </div>
            <input
              type="range"
              min="12"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="settings-font-range"
            />
          </div>

          <div
            className="settings-advanced-toggle"
            onClick={() => {
              setShowAdvancedAppearance(!showAdvancedAppearance);
              window.playSynthSound?.('click');
            }}
          >
            <div className="settings-item-icon">
              <i className="fas fa-magic" />
              <span className="settings-advanced-toggle-label">
                {t2(lang, { ht: 'Opsyon Vizyèl & Sonò', en: 'Sonic & Visual FX' })}
              </span>
            </div>
            <i className={`fas ${showAdvancedAppearance ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
          </div>

          {showAdvancedAppearance && (
            <div className="settings-advanced-section">
              <div className="settings-item">
                <div className="settings-item-icon">
                  <i className="fas fa-wind settings-icon-badge" />
                  <span className="settings-item-label">{t2(lang, { ht: 'Ambyans Paj la', en: 'Ambient FX Backdrop' })}</span>
                </div>
                <select
                  value={ambientFx}
                  onChange={(e) => {
                    setAmbientFx(e.target.value);
                    window.playSynthSound?.('toggle', true);
                  }}
                  className="settings-font-select"
                >
                  <option value="none">{t2(lang, { ht: 'Senp / Net', en: 'None / Clean' })}</option>
                  <option value="glass">{t2(lang, { ht: 'Gliss (Glow)', en: 'Floating Globs' })}</option>
                  <option value="cyber">{t2(lang, { ht: 'Cyber (Grid)', en: 'Cyberpunk Grid' })}</option>
                  <option value="matrix">{t2(lang, { ht: 'Kòd Matris', en: 'Matrix Rain' })}</option>
                </select>
              </div>

              <div className="settings-item" onClick={(e) => { if (e.target.closest('label.switch, input[type="checkbox"]')) {return;} toggleSonicUi(!sonicUi); }}>
                <div className="settings-item-icon">
                  <i className="fas fa-volume-up settings-icon-badge" />
                  <span className="settings-item-label">{t2(lang, { ht: 'Feedback Sonò', en: 'Sonic UI Sounds' })}</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={sonicUi} onChange={(e) => toggleSonicUi(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>

              <div className="settings-item" onClick={(e) => { if (e.target.closest('label.switch, input[type="checkbox"]')) {return;} toggleCyberCursor(!cyberCursor); }}>
                <div className="settings-item-icon">
                  <i className="fas fa-mouse-pointer settings-icon-badge" />
                  <span className="settings-item-label">{t2(lang, { ht: 'Kèso Espesyal', en: 'Cyber Cursor Trail' })}</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={cyberCursor} onChange={(e) => toggleCyberCursor(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-icon">
                  <i className="fas fa-cubes settings-icon-badge" />
                  <span className="settings-item-label">{t2(lang, { ht: 'Stil Kat Sit la', en: 'Card Design Style' })}</span>
                </div>
                <select
                  value={cardStyle}
                  onChange={(e) => {
                    setCardStyle(e.target.value);
                    window.playSynthSound?.('toggle', true);
                  }}
                  className="settings-font-select"
                >
                  <option value="classic">{t2(lang, { ht: 'Klasik', en: 'Classic Rounded' })}</option>
                  <option value="glass">{t2(lang, { ht: 'Vit / Blur', en: 'Glassmorphism' })}</option>
                  <option value="brutalist">{t2(lang, { ht: 'Retro / Teknoloji', en: 'Neo-Brutalist' })}</option>
                </select>
              </div>
            </div>
          )}
        </div>

        </>)}

        {/* Location Section — Phase 60 Location Intelligence. Account-only:
            shows the fused detected country + lets the user set their
            country/region, saved to their own /api/me/ (never public). */}
        {settingsCategory === 'location' && (<>
        <LocationSettings
          lang={lang}
          user={user}
          showToast={showToast}
          onProfileUpdate={onProfileUpdate}
          api={api}
          t={t}
        />
        </>)}

        {/* Language Section */}
        {settingsCategory === 'language' && (<>
        <div className="settings-section-title">{t.language_section}</div>
        <div className="settings-section">
          {languages.map(l => (
            <div key={l.id} onClick={() => onLangChange(l.id)} className="settings-item">
              <div className="settings-item-icon">
                <i className={`fas ${l.icon} settings-lang-icon`} />
                <span className="settings-item-label">{l.label}</span>
              </div>
              {lang === l.id && <i className="fas fa-check settings-lang-check" />}
            </div>
          ))}
        </div>

        {/* Market / Country Section — spec §23: language and market are
            independent. Changing market keeps the current language when
            the market supports it (switchLocale in App.jsx handles the
            fallback to the market's default language). */}
        <div className="settings-section-title">
          {lang === 'ht' ? 'Peyi / Market' : (lang === 'fr' ? 'Pays / Marché' : (lang === 'es' ? 'País / Mercado' : 'Country / Market'))}
        </div>
        <div className="settings-section">
          {MARKET_OPTIONS.map((m) => (
            <div
              key={m.code}
              onClick={() => onMarketChange(m.code)}
              className="settings-item"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMarketChange(m.code); } }}
              aria-pressed={market === m.code}
            >
              <div className="settings-item-icon">
                <span className="settings-lang-icon" aria-hidden="true">{m.flag}</span>
                <span className="settings-item-label">
                  {m.name} <span className="settings-market-code">({m.code})</span>
                </span>
              </div>
              {market === m.code && <i className="fas fa-check settings-lang-check" />}
            </div>
          ))}
          <p className="settings-location-hint">
            {lang === 'ht'
              ? 'Lang ak peyi yo endepandan — chanje peyi a pa chanje lang ou (sof si peyi a pa sipòte lang ou).'
              : (lang === 'fr'
                ? 'La langue et le pays sont indépendants — changer de pays ne change pas votre langue (sauf si le pays ne la prend pas en charge).'
                : (lang === 'es'
                  ? 'El idioma y el país son independientes: cambiar de país no cambia tu idioma (a menos que el país no lo admita).'
                  : 'Language and country are independent — changing country does not change your language (unless the country does not support it).'))}
          </p>
        </div>

        </>)}

        {/* Notifications Section */}
        {settingsCategory === 'notifications' && (<>
        <div className="settings-section-title">{t.notif_section || (t2(lang, { ht: 'Notifikasyon', en: 'Notifications' }))}</div>
        {/* ─── Browser permission status indicator ────────────── */}
        {browserNotifPerm !== 'unsupported' && (
          <div className="notif-perm-status">
            <div className="notif-perm-status-inner">
              <i className={`fas ${browserNotifPerm === 'granted' ? 'fa-circle-check' : browserNotifPerm === 'denied' ? 'fa-circle-xmark' : 'fa-circle-question'} notif-perm-status-icon ${browserNotifPerm}`} />
              <span className="notif-perm-status-text">
                {browserNotifPerm === 'granted'
                  ? (lang === 'ht' ? 'Pèmisyon notifikasyon akòde'
                    : lang === 'fr' ? 'Permission de notification accordée'
                    : lang === 'es' ? 'Permiso de notificación concedido'
                    : 'Notification permission granted')
                  : browserNotifPerm === 'denied'
                  ? (lang === 'ht' ? 'Pèmisyon notifikasyon refize — aktive l nan paramèt navigatè a'
                    : lang === 'fr' ? 'Permission de notification refusée — activez-la dans les paramètres du navigateur'
                    : lang === 'es' ? 'Permiso de notificación denegado — actívalo en la configuración del navegador'
                    : 'Notification permission denied — enable it in browser settings')
                  : (lang === 'ht' ? 'Pèmisyon notifikasyon pa mande ankò'
                    : lang === 'fr' ? 'Permission de notification pas encore demandée'
                    : lang === 'es' ? 'Permiso de notificación aún no solicitado'
                    : 'Notification permission not yet requested')
                }
              </span>
            </div>
          </div>
        )}
        <div className="settings-section">
          {[
            { key: 'sound', label: t.notif_sound || (t2(lang, { ht: 'Son notifikasyon', en: 'Notification sounds' })), icon: 'fa-volume-high' },
            { key: 'desktop_notif', label: t.notif_desktop || (t2(lang, { ht: 'Notifikasyon sou desktop', en: 'Desktop notifications' })), icon: 'fa-display' },
            { key: 'email_notif', label: t.notif_email || (t2(lang, { ht: 'Notifikasyon pa imel', en: 'Email notifications' })), icon: 'fa-envelope' },
            { key: 'message_preview', label: t.notif_preview || (t2(lang, { ht: 'Montre kontni mesaj la', en: 'Show message preview' })), icon: 'fa-eye' },
            { key: 'push_notif', label: t2(lang, { ht: 'Notifikasyon push', en: 'Push notifications' }), icon: 'fa-bell' },
          ].map((item) => (
            <div
              key={item.key}
              className="settings-item"
              onClick={(e) => {
                if (e.target.closest('label.switch, input[type="checkbox"]')) return;
                handleToggleNotif(item.key, !notifPrefs[item.key]);
              }}
            >
              <div className="settings-item-icon">
                <i className={`fas ${item.icon} settings-icon-badge`} />
                <span className="settings-item-label">{item.label}</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!!notifPrefs[item.key]}
                  onChange={(e) => handleToggleNotif(item.key, e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          ))}
        </div>

        </>)}

        {/* Storage + Install category */}
        {settingsCategory === 'storage' && (<>
        {/* ═══ PWA Installation Manager — hidden by default (brand
            decision: promote through social channels). Re-enable with
            VITE_INSTALL_PROMPT_ENABLED=1 at build time. ═══ */}
        {INSTALL_PROMPT_ENABLED && (
          <>
            <div className="settings-section-title">
              {lang === 'ht' ? 'Enstalasyon Atelnyo'
                : lang === 'fr' ? "Installation d'Atelnyo"
                : lang === 'es' ? 'Instalación de Atelnyo'
                : 'Install Atelnyo'}
            </div>
            <div className="settings-section">
              <InstallAppPanel lang={lang} />
            </div>
          </>
        )}

        {/* ═══ Storage Manager — Settings surface (Faz C) ═══ */}
        <div className="settings-section-title">
          {lang === 'ht' ? 'Depo Atelnyo'
            : lang === 'fr' ? 'Stockage Atelnyo'
            : lang === 'es' ? 'Almacenamiento de Atelnyo'
            : 'Atelnyo Storage'}
        </div>
        <div className="settings-section">
          <StoragePanel lang={lang} />
        </div>
        </>)}

        {/* Security category */}
        {settingsCategory === 'security' && (<>
        {/* ═══ Security — TOTP 2FA (F-013 / T053) ═══ */}
        <div className="settings-section-title">
          {t.security_section || (lang === 'ht' ? 'Sekirite ak Kont'
            : lang === 'fr' ? 'Sécurité et Compte'
            : lang === 'es' ? 'Seguridad y Cuenta'
            : 'Security & Account')}
        </div>
        <div className="settings-section">
          <TwoFactorSettings user={user} lang={lang} onUpdated={onProfileUpdate} />
        </div>
        </>)}

        {/* Legal & Privacy Section */}
        {settingsCategory === 'legal' && (<>
        <div className="settings-section-title">
          {lang === 'ht' ? 'Legal ak Konfidansyalite'
            : lang === 'fr' ? 'Légal et Confidentialité'
            : lang === 'es' ? 'Legal y Privacidad'
            : 'Legal & Privacy'}
        </div>
        <div className="settings-section">
          {[
            { slug: 'terms-of-service', label: t.footer_link_terms || (t2(lang, { ht: 'Kondisyon Itilizasyon', en: 'Terms of Service' })), icon: 'fa-file-contract' },
            { slug: 'privacy-policy', label: t.footer_link_privacy || (t2(lang, { ht: 'Politik Konfidansyalite', en: 'Privacy Policy' })), icon: 'fa-shield-halved' },
            { slug: 'cookie-policy', label: t.footer_link_cookie || (t2(lang, { ht: 'Politik Cookie', en: 'Cookie Policy' })), icon: 'fa-cookie-bite' },
            { slug: 'refund-policy', label: t.footer_link_refund || (t2(lang, { ht: 'Politik Rembousman', en: 'Refund Policy' })), icon: 'fa-rotate-left' },
            { slug: 'content-policy', label: t.footer_link_content || (t2(lang, { ht: 'Politik Kontni', en: 'Content Policy' })), icon: 'fa-comments' },
            { slug: 'acceptable-use-policy', label: t.footer_link_acceptable || (t2(lang, { ht: 'Itilizasyon Akseptab', en: 'Acceptable Use' })), icon: 'fa-check-circle' },
            { slug: 'creator-agreement', label: t.footer_link_creator || (t2(lang, { ht: 'Kontra Kreyatè', en: 'Creator Agreement' })), icon: 'fa-user-pen' },
            { slug: 'gdpr-compliance', label: t.footer_link_gdpr || (t2(lang, { ht: 'Konfòmite GDPR', en: 'GDPR Compliance' })), icon: 'fa-earth-europe' },
            { slug: 'security-policy', label: t.footer_link_security || (t2(lang, { ht: 'Politik Sekirite', en: 'Security Policy' })), icon: 'fa-lock' },
            { slug: 'moderation-appeals-policy', label: t.footer_link_moderation || (t2(lang, { ht: 'Moderasyon ak Apèl', en: 'Moderation & Appeals' })), icon: 'fa-gavel' },
          ].map((link) => (
            <div
              key={link.slug}
              className="settings-item"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/legal/${link.slug}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/legal/${link.slug}`); }}
            >
              <div className="settings-item-icon">
                <i className={`fas ${link.icon} settings-icon-badge`} />
                <span className="settings-item-label">{link.label}</span>
              </div>
              <i className="fas fa-chevron-right settings-chevron" style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #94a3b8)' }} />
            </div>
          ))}
        </div>

        </>)}

        {/* Sheet Navigation category */}
        {settingsCategory === 'navigation' && (<>
        <div className="settings-section-title">
          {lang === 'ht' ? 'Navigasyon Sheet'
            : lang === 'fr' ? 'Navigation des feuilles'
            : lang === 'es' ? 'Navegación de hojas'
            : 'Sheet Navigation'}
        </div>
        <div className="settings-section">
          {sheetLinks
            .filter((link) => !(link.path === SHEETS.AUTH && user))
            .filter((link) => !(link.requiresCreator && !user?.is_creator))
            .map((link) => (
            <button
              key={link.path}
              type="button"
              className="settings-item"
              onClick={() => {
                if (link.auth && !user) {
                  showToast?.(
                    lang === 'ht' ? 'Konekte pou wè paj sa a.'
                      : lang === 'fr' ? 'Connectez-vous pour voir cette page.'
                      : lang === 'es' ? 'Inicia sesión para ver esta página.'
                      : 'Sign in to view this page.',
                    'user-lock',
                  );
                  onAuthOpen?.();
                  return;
                }
                navigateToSheet(link.path);
              }}
              data-testid={`sheet-nav-${link.path.replace(/\/sheet\//g, '').replace(/\//g, '-')}`}
            >
              <div className="settings-item-icon">
                <i className={`fas ${link.icon} settings-icon-badge`} />
                <div className="settings-item-desc">
                  <span className="settings-item-label">{link.label}</span>
                  <span className="settings-item-label-sm">{link.hint}</span>
                </div>
              </div>
              <i className="fas fa-chevron-right" aria-hidden="true" />
            </button>
          ))}
        </div>

        </>)}

        {/* Creator category — Plan Kreyatif + Creator Apply + Spotlight */}
        {settingsCategory === 'creator' && (<>
        {/* ─── Plan Kreatè — master toggle section ─── */}
        {/* Special section rendered ABOVE the Creator Apply +
            Spotlight launcher rows. Hosts the master Plan Kreyatif
            toggle so the user can opt in to opt-in surfaces (FABs,
            modals, assistance dialogs) before scrolling to the
            gated launcher rows below. The toggle is the single
            source of truth for the entire app — the
            ``usePlanKreyatif()`` hook reads the same localStorage
            key every gated component reads. Click-AND-input dual-
            handler pattern is byte-identical to ``sonicUi`` +
            ``cyberCursor`` (lines 414-419, 1010-1016, 1021-1026),
            so the row's UX (click anywhere on the row OR the
            switch flips exactly once) stays consistent. */}
        <div className="settings-section-title">{t.settings_plan_kreyatif}</div>
        <div className="settings-section">
          <div
            data-testid="settings-plan-kreyatif-row"
            className="settings-item"
            onClick={(e) => {
              if (e.target.closest('label.switch, input[type="checkbox"]')) {return;}
              togglePlanKreyatif(!planKreyatif);
            }}
          >
            <div className="settings-item-icon">
              <i className="fas fa-paint-brush settings-icon-badge" />
              <div className="settings-item-desc">
                <span className="settings-item-label">{t.settings_plan_kreyatif_label}</span>
                <span className="settings-item-label-sm">{t.settings_plan_kreyatif_hint}</span>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={planKreyatif}
                onChange={(e) => togglePlanKreyatif(e.target.checked)}
                data-testid="settings-plan-kreyatif-switch"
              />
              <span className="slider" />
            </label>
          </div>

          {/* ─── Plan Kreator Assistant chip — visible only when
              planKreyatif is ON. Tapping it mounts the assistant
              modal below, demonstrating the gated modal/window
              surface from the user's ask. Without the toggle ON,
              the entire chip is hidden — no surprise surfaces on
              first visit. */}
          {planKreyatif && (
            <div
              className="settings-item"
              data-testid="plan-kreator-assistant-chip"
              role="button"
              tabIndex={0}
              onClick={() => setAssistantOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssistantOpen(true); } }}
            >
              <div className="settings-item-icon">
                <i className="fas fa-wand-magic-sparkles settings-icon-badge" />
                <div className="settings-item-desc">
                  <span className="settings-item-label">{t.plan_kreator_assistant_label}</span>
                  <span className="settings-item-label-sm">{t.plan_kreator_assistant_hint}</span>
                </div>
              </div>
              <i className="fas fa-chevron-right" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Phase 50 — Creator Apply launcher. Only renders after
            the 3-tap easter egg on the "Made with ❤️ in Ayiti"
            footer below is completed. Clicking the launcher closes
            the settings overlay and navigates to the dedicated
            /sheet/creator-apply sheet (NOT a modal — the
            application is long enough to warrant its own page).
            The route is double-gated inside CreatorApply.jsx
            (redirects to auth if !user, redirects to / if no
            unlock flag) so the surface is opt-in and not
            accessible to casual visitors via direct URL. */}
        {/* Phase 50 — Creator Apply section renders on
            easter-egg unlock only; the launcher button
            redirects to auth when !user so the role gate
            is enforced at the action level, not the
            visibility level. */}
        {creatorApplyUnlocked && (
          <div className="creator-apply-section-wrap" data-testid="creator-apply-section">
            <div className="settings-section-title">
              {t.settings_creator_apply_title || (t2(lang, { ht: 'Devenir Kreyatè', en: 'Become a Creator' }))}
            </div>
            <div className="settings-section">
              <button
                type="button"
                className="settings-item creator-apply-launcher"
                onClick={openCreatorApplySheet}
                data-testid="creator-apply-launcher-btn"
              >
                <div className="settings-item-icon">
                  <i className="fas fa-chalkboard-teacher settings-icon-badge" />
                  <span className="settings-item-label">
                    {t.settings_creator_apply_cta || (t2(lang, { ht: 'Aplike pou vin kreyatè', en: 'Apply to be a creator' }))}
                  </span>
                </div>
                <i className="fas fa-chevron-right" aria-hidden="true" />
              </button>
              <p className="creator-apply-launcher-hint">
                {t.settings_creator_apply_hint || (lang === 'ht'
                  ? 'Anseye kou, vann pwodwi, òfri sèvis sou atelnyo. N ap revize aplikasyon w nan 2-3 jou.'
                  : 'Teach courses, sell products, offer services on atelnyo. We review your application in 2-3 days.')}
              </p>
            </div>
          </div>
        )}

        {/* Phase 47 — Creator Spotlight launcher. Only renders after
            the 5-tap easter egg on the version label below is
            completed. We render a full settings-section (not a
            hidden row) so the unlocked path is unmistakable — the
            junior dev who found the easter egg should never wonder
            "did it work?". A status pill (pending / approved /
            rejected) replaces the CTA when the user has already
            submitted, so the surface stays a single source of
            truth. */}
        {/* Phase 47 — Spotlight section renders on easter-egg unlock
            only; the apply button guards with auth check. */}
        {spotlightUnlocked && (
          <div className="spotlight-section-wrap" data-testid="spotlight-section">
            <div className="settings-section-title">
              {t.settings_spotlight_title || (t2(lang, { ht: 'Spotlight', en: 'Spotlight' }))}
            </div>
            <div className="settings-section">
              {spotlightMyApp ? (
                <div className="spotlight-status-row" data-status={spotlightMyApp.status}>
                  <div className="spotlight-status-icon">
                    <i className={
                      spotlightMyApp.status === 'approved' ? 'fas fa-star'
                      : spotlightMyApp.status === 'rejected' ? 'fas fa-circle-xmark'
                      : spotlightMyApp.status === 'info_requested' ? 'fas fa-comments'
                      : 'fas fa-hourglass-half'
                    } aria-hidden="true" />
                    {spotlightMyApp.is_unread && (
                      <span className="spotlight-unread-dot" aria-label="Unread" />
                    )}
                  </div>
                  <div className="spotlight-status-text">
                    <strong>
                      {spotlightMyApp.status === 'approved'
                        ? (t.settings_spotlight_status_approved || (t2(lang, { ht: 'Apwouve! Ou sou Spotlight.', en: 'Approved! You are on Spotlight.' })))
                        : spotlightMyApp.status === 'rejected'
                        ? (t.settings_spotlight_status_rejected || (t2(lang, { ht: 'Rejete. Wè nòt la anba a.', en: 'Rejected. See the note below.' })))
                        : spotlightMyApp.status === 'info_requested'
                        ? (t.settings_spotlight_status_info_requested || (t2(lang, { ht: 'Admin mande plis enfòmasyon.', en: 'Admin requested more info.' })))
                        : (t.settings_spotlight_status_pending || (t2(lang, { ht: 'Aplikasyon ou an ap tann revizyon.', en: 'Your application is awaiting review.' })))}
                    </strong>
                    <span className="spotlight-status-title">
                      {spotlightMyApp.invention_title}
                    </span>
                    {spotlightMyApp.status === 'rejected' && spotlightMyApp.review_note && (
                      <span className="spotlight-status-note">
                        <i className="fas fa-quote-left" aria-hidden="true" /> {spotlightMyApp.review_note}
                      </span>
                    )}
                    {spotlightMyApp.status === 'info_requested' && typeof spotlightMyApp.days_until_auto_reject === 'number' && (
                      <span className="spotlight-status-countdown">
                        <i className="fas fa-clock" aria-hidden="true" /> {spotlightMyApp.days_until_auto_reject} {t.settings_spotlight_days_left || (t2(lang, { ht: 'jou rete', en: 'days left' }))}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="settings-item spotlight-launcher"
                onClick={openSpotlightModal}
                data-testid="spotlight-apply-btn"
              >
                <div className="settings-item-icon">
                  <i className="fas fa-lightbulb settings-icon-badge" />
                  <span className="settings-item-label">
                    {spotlightMyApp?.status === 'info_requested'
                      ? (t.settings_spotlight_view_thread || (t2(lang, { ht: 'Gade mesaj admin', en: 'View admin message' })))
                      : spotlightMyApp?.status === 'rejected'
                      ? (t.settings_spotlight_view_status || (t2(lang, { ht: 'Gade detay', en: 'View details' })))
                      : spotlightMyApp
                      ? (t.settings_spotlight_resubmit || (t2(lang, { ht: 'Soumèt yon lòt aplikasyon', en: 'Submit another application' })))
                      : (t.settings_spotlight_apply || (t2(lang, { ht: 'Aplike pou Spotlight', en: 'Apply for Spotlight' })))}
                  </span>
                  {spotlightMyApp?.is_unread && (
                    <span className="spotlight-launcher-badge" aria-label="Unread" />
                  )}
                </div>
                <i className="fas fa-chevron-right" aria-hidden="true" />
              </button>
              {/* Phase 48 — Re-apply button. Only rendered on a
                  rejected status pill. Hits the ``/reapply/``
                  endpoint which flips status back to pending. */}
              {spotlightMyApp?.status === 'rejected' && (
                <button
                  type="button"
                  className="spotlight-reapply-btn"
                  onClick={handleReapply}
                  disabled={reapplySubmitting}
                  data-testid="spotlight-reapply-btn"
                >
                  {reapplySubmitting
                    ? <><i className="fas fa-spinner fa-spin" /> {t.common_send || (t2(lang, { ht: 'Ap voye…', en: 'Sending…' }))}</>
                    : <><i className="fas fa-rotate-left" /> {t.settings_spotlight_reapply || (t2(lang, { ht: 'Re-soumet aplikasyon', en: 'Re-apply' }))}</>}
                </button>
              )}
              <p className="spotlight-launcher-hint">
                {t.settings_spotlight_hint
                  || (lang === 'ht'
                    ? 'Spotlight se yon lis envansyon ou fè ki poko egziste sou platfòm lan. Aplike pou parèt nan Explore.'
                    : 'Spotlight is a curated list of inventions that do not exist anywhere else on the platform. Apply to appear in Explore.')}
              </p>
            </div>
          </div>
        )}

        </>)}

        {/* Easter-egg triggers — hub-only (hidden inside a category) */}
        {settingsCategory === null && (<>
        {/* Phase 50 — Hidden trigger for Creator Apply. Three quick
            taps on this "Made with ❤️ in Ayiti" footer unlock the
            Creator Apply section above. Uses a SEPARATE element
            from Spotlight's v1.0 version label so the two easter
            eggs don't interfere (a user tapping 5 times on the
            v1.0 label should NOT simultaneously tick up the
            Creator Apply 3-tap counter). ``user-select: none``
            trick to keep mobile taps from selecting the text. */}
        <div className="settings-creator-apply-trigger-wrap">
          <span
            className="settings-creator-apply-trigger"
            role="button"
            tabIndex={-1}
            onClick={handleCreatorApplyVersionTap}
            aria-hidden="true"
            data-testid="settings-creator-apply-tap"
          >
            Made with <span aria-hidden="true">❤️</span> in Ayiti
          </span>
          {creatorApplyTaps > 0 && creatorApplyTaps < 3 && (
            <span className="settings-creator-apply-tap-progress" aria-hidden="true">
              {creatorApplyTaps}/3
            </span>
          )}
        </div>

        {/* Phase 47 — Hidden version label. Five quick taps on this
            label unlock the Creator Spotlight section above. We use
            a small, low-contrast label so the gesture is hidden in
            plain sight: a curious user will find it, an un-curious
            user will never notice it. ``user-select: none`` keeps
            accidental text selection from interfering with the tap
            timing on mobile. */}
        <div className="settings-version-label-wrap">
          <span
            className="settings-version-label"
            role="button"
            tabIndex={-1}
            onClick={handleSpotlightVersionTap}
            aria-hidden="true"
            data-testid="settings-version-tap"
          >
            v1.0 · Atelnyo
          </span>
          {spotlightTaps > 0 && spotlightTaps < 5 && (
            <span className="settings-version-tap-progress" aria-hidden="true">
              {spotlightTaps}/5
            </span>
          )}
        </div>
        </>)}

      </div>

    </div>

    {/* Phase 47 — Creator Spotlight application modal. Renders
        outside the settings-content scroll container so the
        backdrop + form own the viewport (the .settings-overlay
        handles its own backdrop; the modal is a sibling so the
        form can be full-width on mobile). Closes on backdrop
        click + Escape key. The form is disabled while the submit
        is in flight. */}
    {spotlightModalOpen && (
      <div
        className="spotlight-modal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) {closeSpotlightModal();} }}
        onKeyDown={(e) => { if (e.key === 'Escape') {closeSpotlightModal();} }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-modal-title"
        data-testid="spotlight-modal"
      >
        <div className="spotlight-modal">
          <div className="spotlight-modal-header">
            <h3 id="spotlight-modal-title">
              <i className="fas fa-lightbulb" aria-hidden="true" /> {t.settings_spotlight_modal_title || (t2(lang, { ht: 'Aplike pou Spotlight', en: 'Apply for Spotlight' }))}
            </h3>
            <button
              type="button"
              className="icon-btn"
              onClick={closeSpotlightModal}
              aria-label={t.common_close || 'Close'}
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>
          {/*
            Phase 49 §11.1 — The applicant↔admin thread is now
            delegated to the dedicated <SpotlightThread>
            component. The component is purely presentational;
            Settings.jsx still owns:
              * the messages array (spotlightMessages)
              * the reply body state (replyBody)
              * the submit handler (submitReply → spotlightService.postMessage)
              * the in-flight flag (replySubmitting)
              * the application object (spotlightMyApp)
              * the close-modal handler (closeSpotlightModal)
            The component just renders the banner + list +
            form and forwards the controlled change / submit
            events up.

            Why we kept the parent's submit handler instead of
            letting <SpotlightThread> own it: the call lives
            inside the same try/catch flow as the modal-level
            state-machine logic (re-fetch after reply, refresh
            status pill), and reusing that flow eliminates a
            class of bugs where the thread state and the
            modal-level application status drift apart.
          */}
          {spotlightStep === 'thread' ? (
            <SpotlightThread
              application={spotlightMyApp}
              messages={spotlightMessages}
              replyBody={replyBody}
              onReplyBodyChange={(e) => setReplyBody(e.target.value)}
              onSubmitReply={submitReply}
              replySubmitting={replySubmitting}
              onBack={() => setSpotlightStep('form')}
              t={t}
              lang={lang}
              user={user}
            />
          ) : (
          <form className="spotlight-modal-form" onSubmit={submitSpotlightApplication}>
            {/* Section 1 — Invention pitch (Phase 47 fields) */}
            <div className="spotlight-form-section-title">
              1. {t.settings_spotlight_section_pitch || (t2(lang, { ht: 'Envansyon', en: 'Invention' }))}
            </div>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_category || (t2(lang, { ht: 'Kategori', en: 'Category' }))}
              </span>
              <select
                className="spotlight-field-input"
                value={spotlightForm.category}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, category: e.target.value }))}
                required
              >
                <option value="talent">{t.settings_spotlight_cat_talent || (t2(lang, { ht: 'Talan / Sèvis', en: 'Talent / Service' }))}</option>
                <option value="commerce">{t.settings_spotlight_cat_commerce || (t2(lang, { ht: 'Mache / Pwodwi', en: 'Commerce / Product' }))}</option>
                <option value="course">{t.settings_spotlight_cat_course || (t2(lang, { ht: 'Kou / Aprantisaj', en: 'Course / Learning' }))}</option>
                <option value="other">{t.settings_spotlight_cat_other || (t2(lang, { ht: 'Lòt / Envansyon', en: 'Other / Invention' }))}</option>
              </select>
            </label>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_title || (t2(lang, { ht: 'Tit envansyon ou', en: 'Invention title' }))}
              </span>
              <input
                className="spotlight-field-input"
                type="text"
                value={spotlightForm.invention_title}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, invention_title: e.target.value }))}
                placeholder={t.settings_spotlight_title_placeholder || (t2(lang, { ht: 'Egzanp: Live Quiz Defi', en: 'e.g. Live Quiz Challenge' }))}
                maxLength={120}
                minLength={4}
                required
              />
            </label>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_description || (t2(lang, { ht: 'Dekri sa ou fè', en: 'Describe what you made' }))}
              </span>
              <textarea
                className="spotlight-field-input spotlight-field-textarea"
                value={spotlightForm.invention_description}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, invention_description: e.target.value }))}
                placeholder={t.settings_spotlight_desc_placeholder || (t2(lang, { ht: 'Di nou sa ou envante, e pou ki rezon li pa egziste ankour sou platfòm lan.', en: 'Tell us what you invented and why nothing like it exists on the platform.' }))}
                rows={4}
                minLength={30}
                maxLength={2000}
                required
              />
              <span className="spotlight-field-counter">
                {spotlightForm.invention_description.length}/2000
              </span>
            </label>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_link || (t2(lang, { ht: 'Lyen demo (opsyonel)', en: 'Demo link (optional)' }))}
              </span>
              <input
                className="spotlight-field-input"
                type="url"
                value={spotlightForm.link_url}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, link_url: e.target.value }))}
                placeholder="https://..."
                maxLength={500}
              />
            </label>

            {/* Cover Image — Premium users can upload, non-premium paste URL */}
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_cover_image || (t2(lang, { ht: 'Imaj kouvèti', en: 'Cover image' }))}
                <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>
                  ({lang === 'ht' ? 'opsyonel' : 'optional'})
                </span>
              </span>
              {user?.premium?.is_premium ? (
                /* Premium: direct file upload + URL fallback */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* File upload zone */}
                  {spotlightCoverUploading ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '20px 16px', borderRadius: 12,
                      border: '2px solid #d81b60',
                      background: 'rgba(216, 27, 96, 0.05)',
                    }}>
                      <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: '#d81b60', marginBottom: 8 }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d81b60' }}>
                        {spotlightCoverProgress?.stage === 'reading' && (lang === 'ht' ? 'Ap li imaj...' : 'Reading image...')}
                        {spotlightCoverProgress?.stage === 'loading' && (lang === 'ht' ? 'Ap chaje imaj...' : 'Loading image...')}
                        {spotlightCoverProgress?.stage === 'processing' && (lang === 'ht' ? 'Ap tretan imaj...' : 'Processing image...')}
                        {spotlightCoverProgress?.stage === 'compressing' && (lang === 'ht' ? 'Ap konpwese imaj...' : 'Compressing image...')}
                        {spotlightCoverProgress?.stage === 'uploading' && (lang === 'ht' ? 'Ap monte imaj...' : 'Uploading image...')}
                        {spotlightCoverProgress?.stage === 'done' && (lang === 'ht' ? '✅ Fini!' : '✅ Done!')}
                        {!spotlightCoverProgress && (lang === 'ht' ? 'Ap tretan...' : 'Processing...')}
                      </span>
                      {/* Progress bar */}
                      <div style={{
                        width: '100%', maxWidth: 200, height: 4, borderRadius: 2,
                        background: 'rgba(216, 27, 96, 0.15)', marginTop: 10, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${spotlightCoverProgress?.percent || 0}%`,
                          height: '100%', borderRadius: 2,
                          background: 'linear-gradient(90deg, #d81b60, #ff5e8a)',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #94a3b8)', marginTop: 6 }}>
                        {spotlightCoverProgress?.percent || 0}%
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '20px 16px', borderRadius: 12,
                        border: '2px dashed var(--border-color, #e2e8f0)',
                        background: 'var(--bg-secondary, #f8fafc)',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                      }}
                      onClick={() => document.getElementById('spotlight-cover-upload')?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#d81b60'; }}
                      onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
                        const file = e.dataTransfer?.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          handleSpotlightCoverUpload(file);
                        }
                      }}
                    >
                      <i className="fas fa-cloud-arrow-up" style={{ fontSize: '1.5rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: 8 }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                        {lang === 'ht' ? 'Klike pou monte imaj' : 'Click to upload image'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
                        JPG, PNG, WebP — max 5MB
                      </span>
                    </div>
                  )}
                  <input
                    id="spotlight-cover-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSpotlightCoverUpload(file);
                    }}
                  />
                  {/* Format selector for premium */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>
                      {lang === 'ht' ? 'Fòma:' : 'Format:'}
                    </span>
                    {['auto', 'webp', 'jpeg'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setSpotlightCoverFormat(fmt)}
                        disabled={fmt === 'webp' && webpSupported === false}
                        style={{
                          padding: '3px 10px', borderRadius: 6, border: 'none',
                          fontSize: '0.68rem', fontWeight: 600, cursor: fmt === 'webp' && webpSupported === false ? 'not-allowed' : 'pointer',
                          background: spotlightCoverFormat === fmt ? '#d81b60' : 'var(--bg-secondary, #f1f5f9)',
                          color: spotlightCoverFormat === fmt ? '#fff' : 'var(--text-secondary, #64748b)',
                          opacity: fmt === 'webp' && webpSupported === false ? 0.5 : 1,
                          transition: 'all 0.15s ease',
                        }}
                        title={fmt === 'webp' && webpSupported === false ? 'WebP not supported in this browser' : ''}
                      >
                        {fmt === 'auto' ? 'Auto' : fmt.toUpperCase()}
                      </button>
                    ))}
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary, #94a3b8)', marginLeft: 4 }}>
                      {spotlightCoverFormat === 'webp' ? '(smallest)' : spotlightCoverFormat === 'auto' ? '(best)' : ''}
                    </span>
                    {/* WebP support indicator */}
                    {webpSupported !== null && (
                      <span style={{
                        fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4,
                        background: webpSupported ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: webpSupported ? '#22c55e' : '#ef4444',
                        fontWeight: 600,
                      }}>
                        {webpSupported ? '✓ WebP' : '✗ No WebP'}
                      </span>
                    )}
                  </div>
                  {/* Quality slider */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>
                      {lang === 'ht' ? 'Kalite:' : 'Quality:'}
                    </span>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      value={spotlightCoverQuality}
                      onChange={(e) => setSpotlightCoverQuality(Number(e.target.value))}
                      style={{
                        flex: 1, maxWidth: 120, height: 4,
                        accentColor: '#d81b60', cursor: 'pointer',
                      }}
                    />
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, minWidth: 32,
                      color: spotlightCoverQuality >= 80 ? '#22c55e' : spotlightCoverQuality >= 60 ? '#f59e0b' : '#ef4444',
                    }}>
                      {spotlightCoverQuality}%
                    </span>
                  </div>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                    {spotlightCoverQuality >= 80
                      ? (lang === 'ht' ? 'Kalite wo, fichye pi gwo' : 'High quality, larger file')
                      : spotlightCoverQuality >= 60
                        ? (lang === 'ht' ? 'Bon balans' : 'Good balance')
                        : (lang === 'ht' ? 'Fichye piti, kalite redwi' : 'Smaller file, reduced quality')
                    }
                  </span>
                  {/* Preview if image is uploaded */}
                  {spotlightForm.cover_image && (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={spotlightForm.cover_image}
                        alt="Preview"
                        style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <button
                        type="button"
                        onClick={() => setSpotlightForm((f) => ({ ...f, cover_image: '' }))}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)', color: '#fff',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <i className="fas fa-times" style={{ fontSize: '0.7rem' }} />
                      </button>
                    </div>
                  )}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>
                    <i className="fas fa-crown" style={{ color: '#f59e0b', marginRight: 4 }} />
                    {lang === 'ht'
                      ? 'Premium: monte imaj dirèkteman nan òdinatè ou'
                      : 'Premium: upload image directly from your device'}
                  </span>
                </div>
              ) : (
                /* Non-premium: URL from external source only */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="spotlight-field-input"
                    type="url"
                    value={spotlightForm.cover_image}
                    onChange={(e) => setSpotlightForm((f) => ({ ...f, cover_image: e.target.value }))}
                    placeholder="https://imgur.com/... or https://..."
                    maxLength={500}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>
                    <i className="fas fa-link" style={{ marginRight: 4, opacity: 0.6 }} />
                    {lang === 'ht'
                      ? 'Mete yon lyen imaj soti nan yon lòt sous (Imgur, Google Photos, etc.)'
                      : 'Paste an image URL from another source (Imgur, Google Photos, etc.)'}
                  </span>
                </div>
              )}
            </label>

            {/* Section 2 — KYC identity (Phase 48) */}
            <div className="spotlight-form-section-title">
              2. {t.settings_spotlight_section_kyc || (t2(lang, { ht: 'Idantite (KYC)', en: 'Identity (KYC)' }))}
            </div>
            <p className="spotlight-kyc-help">
              {t.settings_spotlight_kyc_help || (lang === 'ht'
                ? 'Nou bezwen idantite ou pou nou ka verifye aplikasyon an. Done sa yo prive.'
                : 'We need your identity to verify this application. These details are private.')}
            </p>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_legal_name || (t2(lang, { ht: 'Non legal konplè', en: 'Legal full name' }))}
              </span>
              <input
                className="spotlight-field-input"
                type="text"
                value={spotlightForm.kyc.legal_full_name}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, legal_full_name: e.target.value } }))}
                minLength={4}
                required
              />
            </label>
            <div className="spotlight-field-row">
              <label className="spotlight-field spotlight-field-half">
                <span className="spotlight-field-label">
                  {t.settings_spotlight_field_dob || (t2(lang, { ht: 'Dat nesans', en: 'Date of birth' }))}
                </span>
                <input
                  className="spotlight-field-input"
                  type="date"
                  value={spotlightForm.kyc.date_of_birth}
                  onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, date_of_birth: e.target.value } }))}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </label>
              <label className="spotlight-field spotlight-field-half">
                <span className="spotlight-field-label">
                  {t.settings_spotlight_field_id_type || (t2(lang, { ht: 'Tip dokiman', en: 'ID document type' }))}
                </span>
                <select
                  className="spotlight-field-input"
                  value={spotlightForm.kyc.id_document_type}
                  onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, id_document_type: e.target.value } }))}
                  required
                >
                  <option value="passport">{t.settings_spotlight_id_type_passport || (t2(lang, { ht: 'Paspo', en: 'Passport' }))}</option>
                  <option value="national_id">{t.settings_spotlight_id_type_national_id || (t2(lang, { ht: 'ID Nasyonal', en: 'National ID' }))}</option>
                  <option value="drivers_license">{t.settings_spotlight_id_type_drivers_license || (t2(lang, { ht: 'Pèmi kondwi', en: 'Driver\'s License' }))}</option>
                </select>
              </label>
            </div>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_id_number || (t2(lang, { ht: 'Nimewo dokiman', en: 'ID document number' }))}
              </span>
              <input
                className="spotlight-field-input"
                type="text"
                value={spotlightForm.kyc.id_document_number}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, id_document_number: e.target.value } }))}
                minLength={4}
                required
              />
            </label>

            {/* Section 3 — Address */}
            <div className="spotlight-form-section-title">
              3. {t.settings_spotlight_section_address || (t2(lang, { ht: 'Adrès', en: 'Address' }))}
            </div>
            <LocationPicker
              value={{
                country: (() => {
                  // Map the 2-letter code to the country's display name
                  // so the dropdown shows a friendly label. If not found,
                  // fall back to the raw code.
                  const code = (spotlightForm.kyc.country_of_residence || '').toUpperCase();
                  const match = COMMON_COUNTRIES.find((c) => c.code === code);
                  return match ? match.name : spotlightForm.kyc.country_of_residence || '';
                })(),
                city: spotlightForm.kyc.city,
                postcode: spotlightForm.kyc.postcode || '',
                address_line1: spotlightForm.kyc.address_line1,
                address_line2: spotlightForm.kyc.address_line2,
              }}
              onChange={(loc) => {
                // Map the selected country display name back to its 2-letter
                // code for the BE. Falls back to the name if no code found.
                const codeOf = (name) => {
                  const found = COMMON_COUNTRIES.find(
                    (c) => c.name.toLowerCase() === String(name || '').trim().toLowerCase(),
                  );
                  return found ? found.code : String(name || '').trim().toUpperCase().slice(0, 2);
                };
                setSpotlightForm((f) => ({
                  ...f,
                  kyc: {
                    ...f.kyc,
                    city: loc.city,
                    country_of_residence: codeOf(loc.country),
                    postcode: loc.postcode || f.kyc.postcode,
                    address_line1: loc.address_line1,
                    address_line2: loc.address_line2,
                  },
                }));
              }}
              lang={lang}
              showAddress
              showPostcode
              required
            />
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_country_birth || (t2(lang, { ht: 'Peyi ou fèt', en: 'Country of birth' }))}
              </span>
              <input
                className="spotlight-field-input settings-uppercase-input"
                type="text"
                value={spotlightForm.kyc.country_of_birth}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, country_of_birth: e.target.value.toUpperCase() } }))}
                placeholder="HT"
                maxLength={2}
                minLength={2}
                pattern="[A-Za-z]{2}"
              />
            </label>

            {/* Section 4 — Contact */}
            <div className="spotlight-form-section-title">
              4. {t.settings_spotlight_section_contact || (t2(lang, { ht: 'Kontak', en: 'Contact' }))}
            </div>
            <label className="spotlight-field">
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_phone || (t2(lang, { ht: 'Telefòn (ak kòd peyi a)', en: 'Phone (with country code)' }))}
              </span>
              <input
                className="spotlight-field-input"
                type="tel"
                value={spotlightForm.kyc.phone_number}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, phone_number: e.target.value } }))}
                placeholder="+509..."
                minLength={8}
                required
              />
            </label>

            {/* Section 5 — Legal consent */}
            <div className="spotlight-form-section-title">
              5. {t.settings_spotlight_section_legal || (t2(lang, { ht: 'Akò Legal', en: 'Legal agreement' }))}
            </div>
            <label className="spotlight-field spotlight-field-checkbox">
              <input
                type="checkbox"
                checked={spotlightForm.kyc.accepted_terms}
                onChange={(e) => setSpotlightForm((f) => ({ ...f, kyc: { ...f.kyc, accepted_terms: e.target.checked } }))}
                required
              />
              <span className="spotlight-field-label">
                {t.settings_spotlight_field_accept_terms || (lang === 'ht'
                  ? 'Mwen sètifye enfòmasyon sa yo vrè e mwen aksepte Règleman Kreyatè a.'
                  : 'I certify this information is true and I accept the Creator Terms.')}
              </span>
            </label>

            <div className="spotlight-legal-links" style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {[
                { slug: 'creator-agreement', label: t.footer_link_creator || (t2(lang, { ht: 'Kontra Kreyatè', en: 'Creator Agreement' })) },
                { slug: 'content-policy', label: t.footer_link_content || (t2(lang, { ht: 'Politik Kontni', en: 'Content Policy' })) },
                { slug: 'acceptable-use-policy', label: t.footer_link_acceptable || (t2(lang, { ht: 'Itilizasyon Akseptab', en: 'Acceptable Use' })) },
                { slug: 'commission-fee-policy', label: t.footer_link_commission || (t2(lang, { ht: 'Komisyon ak Frè', en: 'Commission & Fees' })) },
                { slug: 'withdrawal-payout-policy', label: t.footer_link_withdrawal || (t2(lang, { ht: 'Retrè ak Peman', en: 'Withdrawals & Payouts' })) },
                { slug: 'terms-of-service', label: t.footer_link_terms || (t2(lang, { ht: 'Kondisyon Itilizasyon', en: 'Terms of Service' })) },
                { slug: 'privacy-policy', label: t.footer_link_privacy || (t2(lang, { ht: 'Politik Konfidansyalite', en: 'Privacy Policy' })) },
                { slug: 'gdpr-compliance', label: t.footer_link_gdpr || (t2(lang, { ht: 'Konfòmite GDPR', en: 'GDPR Compliance' })) },
              ].map((link) => (
                <a
                  key={link.slug}
                  href={`/legal/${link.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="spotlight-legal-link"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--pr-color-amber-500, #d81b60)',
                    textDecoration: 'none',
                    border: '1px solid var(--border-color, rgba(100,116,139,0.2))',
                    borderRadius: 999,
                    padding: '0.3rem 0.75rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fas fa-scroll" aria-hidden="true" style={{ fontSize: '0.68rem', marginRight: '0.35rem' }} />
                  {link.label}
                </a>
              ))}
            </div>

            <div className="spotlight-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeSpotlightModal}
                disabled={spotlightSubmitting}
              >
                {t.common_cancel || (t2(lang, { ht: 'Anile', en: 'Cancel' }))}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={spotlightSubmitting || !spotlightForm.kyc.accepted_terms}
                data-testid="spotlight-submit-btn"
              >
                {spotlightSubmitting
                  ? <><i className="fas fa-spinner fa-spin" /> {t.common_send || (t2(lang, { ht: 'Ap voye…', en: 'Sending…' }))}</>
                  : <><i className="fas fa-paper-plane" /> {t.settings_spotlight_submit || (t2(lang, { ht: 'Voye aplikasyon', en: 'Send application' }))}</>}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    )}    {/* ─── Plan Kreator Assistant modal — sample gated surface.
        Only mounts when ``planKreyatif === true`` AND the user
        taps the chip above. Closes on backdrop click + Escape
        key. The Open Atelier CTA closes the modal, closes the
        Settings overlay, and navigates to /sheet/atelier so the
        user lands inside the existing créative-plans flow. */}
    {assistantOpen && (
      <div
        className="plan-kreator-assistant-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) {setAssistantOpen(false);} }}
        onKeyDown={(e) => { if (e.key === 'Escape') {setAssistantOpen(false);} }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-kreator-assistant-title"
        data-testid="plan-kreator-assistant-modal"
      >
        <div className="plan-kreator-assistant-modal">
          <div className="plan-kreator-assistant-header">
            <h3 id="plan-kreator-assistant-title">
              <i className="fas fa-wand-magic-sparkles" aria-hidden="true" /> {t.plan_kreator_assistant_title}
            </h3>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setAssistantOpen(false)}
              aria-label={t.common_close || (t2(lang, { ht: 'Fèmen', en: 'Close' }))}
              data-testid="plan-kreator-assistant-close-btn"
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </div>
          <div className="plan-kreator-assistant-body">
            <p>{t.plan_kreator_assistant_intro}</p>
            <div className="plan-kreator-assistant-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAssistantOpen(false)}
                data-testid="plan-kreator-assistant-cancel-btn"
              >
                {t.common_cancel || (t2(lang, { ht: 'Anile', en: 'Cancel' }))}
              </button>
              <button
                type="button"
                className="btn-primary"
                data-testid="plan-kreator-assistant-open-btn"
                onClick={() => {
                  setAssistantOpen(false);
                  if (onClose) {onClose();}
                  navigate('/sheet/atelier');
                }}
              >
                <i className="fas fa-flask" aria-hidden="true" /> {t.plan_kreator_assistant_open}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
      {/* ═══ Premium Preview Modal ═══ */}
      <PremiumPreview
        isOpen={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        lang={lang}
        user={user}
        onOpenCheckout={onOpenCheckout}
      />

      {/* ═══ Reset Appearance Confirm Modal ═══ */}
      {resetConfirm && (
        <ConfirmModal
          title={t2(lang, { ht: 'Reyajiste aparans', en: 'Reset appearance' })}
          message={lang === 'ht'
            ? 'Reyajiste tout paramèt aparans? W ap toujou konekte.'
            : 'Reset all appearance settings? You will stay logged in.'}
          lang={lang}
          variant="warning"
          confirmText={t2(lang, { ht: 'Wi, reyajiste', en: 'Yes, reset' })}
          onConfirm={() => {
            const APPEARANCE_KEYS = [
              'atelnyo_theme_color', 'atelnyo_ambient_fx', 'atelnyo_card_style',
              'atelnyo_sonic_ui', 'atelnyo_cyber_cursor', 'atelnyo_font_family',
              'atelnyo_theme', 'atelnyo_fontsize',
            ];
            APPEARANCE_KEYS.forEach((k) => {
              try { localStorage.removeItem(k); } catch (_) {}
            });
            window.location.reload();
          }}
          onCancel={() => setResetConfirm(false)}
        />
      )}
    </>

  );

};

export default Settings;
