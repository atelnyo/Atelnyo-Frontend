/**
 * src/components/settings/LocationSettings.jsx
 *
 * Phase 60 — Location Intelligence settings (account-only).
 *
 * Shows the user which country Atelyona *detects* they are in (fused
 * from GeoIP + timezone + granted GPS — the fr-FR browser locale is
 * deliberately NOT a country signal), and lets them explicitly set
 * their country + region. The explicit choice is the strongest signal
 * in the fusion engine (user_profile, 0.98) and is persisted to the
 * account's /api/me/ location_prefs — private to the account, never on
 * a public profile.
 *
 * The detected country display:
 *   * is an ESTIMATE — labeled as such ("Nou estime..."),
 *   * uses the cached/fused context (no GPS prompt on open),
 *   * refreshes via a "Detect again" button that re-fuses available
 *     signals WITHOUT requesting GPS (permission is never prompted
 *     from this screen; the user would grant it in PermissionCenter).
 */
import React, { useEffect, useState, useCallback } from 'react';
import useLocationContext from '../../hooks/useLocationContext';
import { COMMON_COUNTRIES } from '../../services/locationService';

const COUNTRY_NAMES = Object.fromEntries(COMMON_COUNTRIES.map((c) => [c.code, c.name]));

export default function LocationSettings({ lang = 'en', user, showToast, onProfileUpdate, api, t = {} }) {
  const isHt = lang === 'ht';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';

  const accountLoc = user?.location_prefs || {};
  const [country, setCountry] = useState(accountLoc.country || '');
  const [region, setRegion] = useState(accountLoc.region || '');
  const [saving, setSaving] = useState(false);

  // Fused detection — cached; no GPS prompt on open.
  const { context, refresh } = useLocationContext({
    userCountry: accountLoc.country || '',
    userRegion: accountLoc.region || '',
    autoResolve: true,
  });

  // Persist the fused estimate to the account (best-effort, fire-and-forget).
  useEffect(() => {
    if (!api || !user || context?.isDefault) return;
    if (!context?.country) return;
    let cancelled = false;
    // Deferral: avoid setState-in-effect lint + avoid racing the user's
    // own save below.
    Promise.resolve().then(() => {
      if (cancelled) return;
      api.patch('me/', {
        location_prefs: {
          detected_country: context.country,
          detected_region: context.detected_region || '',
          detected_at: new Date(context.timestamp || Date.now()).toISOString(),
        },
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [api, user, context?.country, context?.detected_region, context?.timestamp, context?.isDefault]);

  const handleSave = useCallback(async () => {
    if (!user) {
      showToast?.(isHt ? 'Konekte pou sove lokalizasyon ou.' : 'Sign in to save your location.', 'info-circle');
      return;
    }
    setSaving(true);
    try {
      await api.patch('me/', {
        location_prefs: {
          country: country.toUpperCase(),
          region,
        },
      });
      showToast?.(
        isHt ? '✅ Lokalizasyon kont sove!' : '✅ Account location saved!',
        'check-circle',
      );
      onProfileUpdate?.();
    } catch {
      showToast?.(
        isHt ? '❌ Pa t kapab sove lokalizasyon an.' : '❌ Could not save location.',
        'exclamation-triangle',
      );
    } finally {
      setSaving(false);
    }
  }, [user, country, region, api, showToast, onProfileUpdate, isHt]);

  const detectedName = context?.country ? (COUNTRY_NAMES[context.country] || context.country) : null;
  const detectedConfidence = context?.confidence ? Math.round(context.confidence * 100) : 0;
  const detectedRegion = context?.detected_region || '';

  const sectionTitle = t.location_section
    || (isHt ? 'Lokalizasyon kont' : 'Account location');
  const detectLabel = isHt ? 'Detekte ankò' : 'Detect again';
  const savedRegion = accountLoc.detected_region || '';

  return (
    <>
      <div className="settings-section-title">{sectionTitle}</div>
      <div className="settings-section">
        {!user ? (
          <div className="settings-item">
            <div className="settings-item-icon">
              <i className="fas fa-user-lock" aria-hidden="true" />
              <span className="settings-item-label">
                {isHt ? 'Konekte pou wè ak jere lokalizasyon kont ou.' : 'Sign in to view and manage your account location.'}
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Detected country — an ESTIMATE, labeled as such. */}
            <div className="settings-location-detect">
              <div className="settings-location-detect-head">
                <i className="fas fa-satellite-dish" aria-hidden="true" />
                <span className="settings-location-detect-title">
                  {isHt ? 'Peyi detekte otomatikman' : 'Auto-detected country'}
                </span>
                <button
                  type="button"
                  className="settings-location-detect-btn"
                  onClick={() => refresh({ force: true })}
                  disabled={context.loading}
                >
                  <i className={`fas ${context.loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} aria-hidden="true" />
                  {detectLabel}
                </button>
              </div>
              {context.loading ? (
                <div className="settings-location-detect-value">
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap detekte...' : 'Detecting...'}
                </div>
              ) : detectedName ? (
                <>
                  <div className="settings-location-detect-value">
                    <span className="settings-location-detect-flag">
                      {COMMON_COUNTRIES.find((c) => c.code === context.country)?.flag || '🌍'}
                    </span>
                    {detectedName}
                    {detectedConfidence > 0 && (
                      <span className="settings-location-confidence">
                        {isHt ? `konfyans ${detectedConfidence}%` : `${detectedConfidence}% confidence`}
                      </span>
                    )}
                  </div>
                  {detectedRegion && (
                    <div className="settings-location-detect-region">{detectedRegion}</div>
                  )}
                  {savedRegion && savedRegion !== detectedRegion && (
                    <div className="settings-location-detect-region">{savedRegion}</div>
                  )}
                </>
              ) : (
                <div className="settings-location-detect-value">
                  {isHt
                    ? 'Pa t kapab detekte peyi a — mete peyi ou a anba a.'
                    : 'Could not detect the country — set it below.'}
                </div>
              )}
              <div className="settings-location-detect-hint">
                {isHt
                  ? 'Estimasyon soti nan IP ak timezone ou. Browser language ou pa sèvi pou detekte peyi. Pa janm piblik — sèlman ou wè li.'
                  : 'An estimate from your IP and timezone. Your browser language is never used to detect country. Private — only you can see this.'}
              </div>
            </div>

            {/* User-chosen country + region (the strongest signal). */}
            <div className="settings-item settings-location-form">
              <div className="settings-location-field">
                <label className="settings-location-label" htmlFor="settings-country">
                  {isHt ? 'Peyi ou' : 'Your country'}
                </label>
                <select
                  id="settings-country"
                  className="settings-location-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">{isHt ? '— Chwazi peyi —' : '— Select country —'}</option>
                  {COMMON_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-location-field">
                <label className="settings-location-label" htmlFor="settings-region">
                  {isHt ? 'Region / Vil' : 'Region / City'}
                </label>
                <input
                  id="settings-region"
                  className="settings-location-input"
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder={isHt ? 'Egz. Port-au-Prince' : 'e.g. Port-au-Prince'}
                  maxLength={100}
                />
              </div>
              <button
                type="button"
                className="settings-location-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap sove...' : 'Saving...'}</>
                  : <><i className="fas fa-save" aria-hidden="true" /> {isHt ? 'Sove lokalizasyon' : 'Save location'}</>}
              </button>
              <p className="settings-location-hint">
                {isHt
                  ? 'Chwa sa a pi fò pase deteksyon an — lè ou mete peyi ou, Atelnyo respekte li anvan IP/timezone.'
                  : 'Your choice is stronger than detection — when set, Atelnyo honors it over IP/timezone.'}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
