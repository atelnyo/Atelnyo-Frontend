/**
 * useGoogleAuth.js — Google Identity Services (GSI) integration.
 *
 * Handles loading the GSI script, rendering the "Continue with Google"
 * button, One-Tap for returning users, and credential exchange with
 * the Atelnyo backend.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { authService, applyTokenPair } from '../../services/api';
import {
  getGoogleClientId, gsiPromptSkipped, rememberGsiSkipped,
  readPendingGoogle, writePendingGoogle, clearPendingGoogle,
  isDarkTheme,
} from './authUtils';

export default function useGoogleAuth({ lang, onLoginSuccess, showToast, isLoading }) {
  const googleRef = useRef(null);
  // Keeps the LATEST credential handler alive: initialize() runs only
  // once (GSI warns "called multiple times" otherwise — the effect
  // re-runs when isLoading/handler identity change), so every real
  // credential event is routed through this ref instead of a stale
  // closure captured at first initialize.
  const handlerRef = useRef(null);
  const [googleClientId, setGoogleClientId] = useState(() => getGoogleClientId());
  const [pendingGoogle, setPendingGoogle] = useState(() => readPendingGoogle());
  const [googleLoading, setGoogleLoading] = useState(false);

  // Top up the client id from the public runtime config.
  useEffect(() => {
    if (googleClientId) return undefined;
    let cancelled = false;
    import('../../services/api').then(({ default: api }) => {
      api.get('config/public/')
        .then((res) => {
          if (cancelled) return;
          const runtimeId = (res?.data?.google_client_id || '').trim();
          if (runtimeId) {
            setGoogleClientId((prev) => prev || runtimeId);
            try { localStorage.setItem('atelnyo_google_client_id', runtimeId); } catch { /* */ }
          }
        })
        .catch(() => { /* runtime config is best-effort */ });
    });
    return () => { cancelled = true; };
  }, [googleClientId]);

  const handleGoogleCredential = useCallback(async (response) => {
    const idToken = response?.credential;
    if (!idToken) {
      return { error: lang === 'ht' ? 'Google pa retounen kredansyal.' : 'Google returned no credential.' };
    }
    setGoogleLoading(true);
    try {
      const { data: raw } = await authService.googleLogin(idToken);
      // Unwrap the optional ApiResponseRenderer envelope ({success, data}) so
      // both plain and wrapped login payloads resolve the same way.
      const payload = raw?.data ?? raw;
      // PERSIST THE SESSION — exactly like the password login does.
      // Without this the Google session only lived in React state, so a
      // page refresh (which restores `access_token` / `refresh_token` /
      // `user` from localStorage in App.jsx) logged the user straight
      // back out. The JWT pair + user blob are all the boot path reads.
      applyTokenPair({
        access: payload?.access,
        refresh: payload?.refresh,
        user: payload?.user,
      });
      clearPendingGoogle();
      setPendingGoogle(null);
      if (showToast) showToast(lang === 'ht' ? 'Koneksyon siksè!' : 'Login successful!', 'check-circle');
      onLoginSuccess(payload?.user, payload);
      return { success: true, user: payload?.user };
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail
        || (lang === 'ht' ? 'Google koneksyon echwe.' : 'Google sign-in failed.');
      try {
        const raw = idToken.split('.')[1];
        const payload = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
        writePendingGoogle({
          name: payload?.name || '',
          email: payload?.email || '',
          picture: payload?.picture || '',
        });
        setPendingGoogle(readPendingGoogle());
      } catch (_) { /* unparseable token */ }
      return { error: typeof msg === 'string' ? msg : 'Google sign-in failed.' };
    } finally {
      setGoogleLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, onLoginSuccess, showToast]);

  // Load GSI + render button + One-Tap
  useEffect(() => {
    if (!googleClientId || typeof window === 'undefined') return undefined;
    let cancelled = false;
    handlerRef.current = handleGoogleCredential;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleRef.current) return;
      try {
        // Initialize only the FIRST time per client id — calling
        // initialize() on every effect run makes GSI log "initialize()
        // is called multiple times. This could cause unexpected
        // behavior and only the last initialized instance will be
        // used" (seen in production console).
        if (window.__atelnyoGsiClientId !== googleClientId) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (resp) => { handlerRef.current?.(resp); },
            auto_select: true,
            itp_supported: true,
            // Opt in to FedCM (Chrome's new identity platform API) so
            // the One-Tap prompt keeps working once Google makes FedCM
            // mandatory; silences the GSI_LOGGER FedCM migration warning.
            use_fedcm_for_prompt: true,
          });
          window.__atelnyoGsiClientId = googleClientId;
        }
        const avail = googleRef.current?.clientWidth || 280;
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: isDarkTheme() ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          width: Math.min(280, Math.max(200, Math.round(avail))),
          text: 'continue_with',
        });
        if (!cancelled && !isLoading && !gsiPromptSkipped()) {
          window.google.accounts.id.prompt((notification) => {
            if (notification?.isSkippedMoment?.() || notification?.isDismissedMoment?.()) {
              rememberGsiSkipped();
            }
          });
        }
      } catch (_) { /* GSI render failures are non-fatal */ }
    };

    const inject = () => {
      if (window.google?.accounts?.id) { render(); return; }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    };
    inject();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, handleGoogleCredential, isLoading]);

  const dismissPendingGoogle = useCallback(() => {
    clearPendingGoogle();
    setPendingGoogle(null);
  }, []);

  const triggerGooglePrompt = useCallback(() => {
    window.google?.accounts?.id?.prompt?.(() => {});
  }, []);

  return {
    googleClientId,
    googleRef,
    pendingGoogle,
    googleLoading,
    handleGoogleCredential,
    dismissPendingGoogle,
    triggerGooglePrompt,
  };
}
