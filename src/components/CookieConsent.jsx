/**
 * src/components/CookieConsent.jsx
 *
 * Cookie Consent Banner — GDPR/CCPA compliant consent management.
 * Shows on first visit and when consent preferences change.
 *
 * Stores consent in localStorage under 'atelnyo_cookie_consent'.
 * Granular controls: necessary (always on), analytics, marketing.
 */
import React, { useState, useEffect } from 'react';
import { t2 } from '../utils/i18n';

const CONSENT_KEY = 'atelnyo_cookie_consent';
const CONSENT_VERSION = '1.0';

const DEFAULT_CONSENT = {
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: null,
};

function loadConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      ...consent,
      timestamp: Date.now(),
    }));
  } catch { /* storage unavailable */ }
}

export function getConsent() {
  return loadConsent() || { ...DEFAULT_CONSENT };
}

export function hasAnalyticsConsent() {
  return getConsent().analytics === true;
}

export function hasMarketingConsent() {
  return getConsent().marketing === true;
}

export default function CookieConsent({ lang = 'en' }) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      // No consent recorded — show banner after a short delay
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    // Existing consent — apply saved preferences
    setPreferences({
      necessary: true,
      analytics: existing.analytics,
      marketing: existing.marketing,
    });
  }, []);

  const handleAcceptAll = () => {
    const consent = { ...DEFAULT_CONSENT, necessary: true, analytics: true, marketing: true };
    saveConsent(consent);
    setPreferences({ necessary: true, analytics: true, marketing: true });
    setVisible(false);
    dispatchConsentEvent(consent);
  };

  const handleRejectAll = () => {
    const consent = { ...DEFAULT_CONSENT, necessary: true, analytics: false, marketing: false };
    saveConsent(consent);
    setPreferences({ necessary: true, analytics: false, marketing: false });
    setVisible(false);
    dispatchConsentEvent(consent);
  };

  const handleSavePreferences = () => {
    const consent = { ...DEFAULT_CONSENT, ...preferences, necessary: true };
    saveConsent(consent);
    setVisible(false);
    dispatchConsentEvent(consent);
  };

  const dispatchConsentEvent = (consent) => {
    try {
      window.dispatchEvent(new CustomEvent('atelnyo:consent', { detail: consent }));
    } catch { /* ignore */ }
  };

  if (!visible) return null;

  const t = (key) => t2(lang, {
    ht: {
      banner_title: 'Cookies & Konfyans',
      banner_desc: 'Atelnyo itilize cookies pou amelyore eksperyans ou. Ou ka chwazi ki kalite cookies ou aksepte.',
      necessary: 'Nesesè',
      necessary_desc: 'Cookies sa yo nesesè pou platfòm la fonksyone. Yo pa ka disable.',
      analytics: 'Analitik',
      analytics_desc: 'Nou itilize analitik pou konprann kijan itilizatè yo itilize platfòm la. Done yo agregé epa idantifye itilizatè endividyèl.',
      marketing: 'Reklam',
      marketing_desc: 'Cookies sa yo itilize pou montre w reklam ki enterese w.',
      accept_all: 'Aksepte Tout',
      reject_all: 'Rejte Tout',
      save: 'Sove Chwa Mwen',
      details: 'Plis Detail',
    },
    en: {
      banner_title: 'Cookies & Consent',
      banner_desc: 'Atelnyo uses cookies to improve your experience. You can choose which types of cookies to accept.',
      necessary: 'Necessary',
      necessary_desc: 'These cookies are essential for the platform to function. They cannot be disabled.',
      analytics: 'Analytics',
      analytics_desc: 'We use analytics to understand how users interact with the platform. Data is aggregated and does not identify individual users.',
      marketing: 'Marketing',
      marketing_desc: 'These cookies are used to show you relevant advertisements.',
      accept_all: 'Accept All',
      reject_all: 'Reject All',
      save: 'Save My Preferences',
      details: 'More Details',
    },
    fr: {
      banner_title: 'Cookies & Consentement',
      banner_desc: 'Atelnyo utilise des cookies pour améliorer votre expérience. Vous pouvez choisir quels types de cookies accepter.',
      necessary: 'Nécessaires',
      necessary_desc: 'Ces cookies sont essentiels au fonctionnement de la plateforme. Ils ne peuvent pas être désactivés.',
      analytics: 'Analytique',
      analytics_desc: 'Nous utilisons l\'analytique pour comprendre comment les utilisateurs interagissent avec la plateforme.',
      marketing: 'Marketing',
      marketing_desc: 'Ces cookies sont utilisés pour vous montrer des publicités pertinentes.',
      accept_all: 'Tout Accepter',
      reject_all: 'Tout Refuser',
      save: 'Enregistrer Mes Préférences',
      details: 'Plus de Détails',
    },
    es: {
      banner_title: 'Cookies y Consentimiento',
      banner_desc: 'Atelnyo utiliza cookies para mejorar su experiencia. Puede elegir qué tipos de cookies aceptar.',
      necessary: 'Necesarias',
      necessary_desc: 'Estas cookies son esenciales para el funcionamiento de la plataforma. No se pueden desactivar.',
      analytics: 'Analítica',
      analytics_desc: 'Utilizamos analítica para comprender cómo los usuarios interactúan con la plataforma.',
      marketing: 'Marketing',
      marketing_desc: 'Estas cookies se utilizan para mostrarle anuncios relevantes.',
      accept_all: 'Aceptar Todas',
      reject_all: 'Rechazar Todas',
      save: 'Guardar Mis Preferencias',
      details: 'Más Detalles',
    },
  }[lang] || {})[key] || key;

  return (
    <div className="cookie-consent-overlay" style={styles.overlay} role="dialog" aria-label={t('banner_title')} aria-modal="false">
      <div style={styles.banner}>
        <div style={styles.header}>
          <span style={styles.icon}>🍪</span>
          <h2 style={styles.title}>{t('banner_title')}</h2>
        </div>
        <p style={styles.desc}>{t('banner_desc')}</p>

        {showDetails && (
          <div style={styles.details}>
            <label style={styles.option}>
              <div style={styles.optionInfo}>
                <span style={styles.optionLabel}>☑️ {t('necessary')}</span>
                <span style={styles.optionDesc}>{t('necessary_desc')}</span>
              </div>
              <input type="checkbox" checked disabled style={styles.checkbox} />
            </label>

            <label style={styles.option}>
              <div style={styles.optionInfo}>
                <span style={styles.optionLabel}>📊 {t('analytics')}</span>
                <span style={styles.optionDesc}>{t('analytics_desc')}</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences(p => ({ ...p, analytics: e.target.checked }))}
                style={styles.checkbox}
              />
            </label>

            <label style={styles.option}>
              <div style={styles.optionInfo}>
                <span style={styles.optionLabel}>📢 {t('marketing')}</span>
                <span style={styles.optionDesc}>{t('marketing_desc')}</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences(p => ({ ...p, marketing: e.target.checked }))}
                style={styles.checkbox}
              />
            </label>
          </div>
        )}

        <div style={styles.actions}>
          {!showDetails && (
            <button type="button" style={styles.detailsBtn} onClick={() => setShowDetails(true)}>
              {t('details')}
            </button>
          )}
          {showDetails && (
            <button type="button" style={styles.saveBtn} onClick={handleSavePreferences}>
              {t('save')}
            </button>
          )}
          <button type="button" style={styles.rejectBtn} onClick={handleRejectAll}>
            {t('reject_all')}
          </button>
          <button type="button" style={styles.acceptBtn} onClick={handleAcceptAll}>
            {t('accept_all')}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    display: 'flex',
    justifyContent: 'center',
    padding: '16px',
    pointerEvents: 'none',
  },
  banner: {
    pointerEvents: 'auto',
    background: 'var(--surface-card, #ffffff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '16px',
    padding: '20px 24px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  icon: {
    fontSize: '1.4rem',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary, #1a1a2e)',
  },
  desc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary, #666)',
    margin: '0 0 12px',
    lineHeight: 1.5,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 10px',
    background: 'var(--surface-secondary, #f8f9fa)',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  optionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  optionLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a2e)',
  },
  optionDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary, #888)',
    lineHeight: 1.4,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: 'var(--pink-primary, #d81b60)',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  detailsBtn: {
    padding: '8px 16px',
    background: 'transparent',
    color: 'var(--pink-primary, #d81b60)',
    border: '1px solid var(--pink-primary, #d81b60)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 16px',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '8px 16px',
    background: 'transparent',
    color: 'var(--text-secondary, #666)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  acceptBtn: {
    padding: '8px 16px',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
