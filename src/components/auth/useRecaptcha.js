/**
 * useRecaptcha.js — reCAPTCHA v2/v3 escalation hook.
 *
 * v3 invisible tokens ride along on every auth submit; after N failed
 * attempts we escalate to an explicit v2 "I'm not a robot" checkbox.
 */
import { useState, useEffect, useRef } from 'react';
import { getRecaptchaV3Key, getRecaptchaV2Key, cacheRecaptchaKeys,
  executeRecaptcha, renderV2Checkbox, resetV2Checkbox } from '../../services/recaptcha';
import { readFailedAttempts, writeFailedAttempts, RECAPTCHA_FAIL_THRESHOLD, isDarkTheme } from './authUtils';

export default function useRecaptcha({ mode }) {
  const [recaptchaV3Key, setRecaptchaV3Key] = useState(() => getRecaptchaV3Key());
  const [recaptchaV2Key, setRecaptchaV2Key] = useState(() => getRecaptchaV2Key());
  const [failedAttempts, setFailedAttempts] = useState(() => readFailedAttempts());
  const [v2Token, setV2Token] = useState('');
  const [v2Nonce, setV2Nonce] = useState(0);
  const v2ContainerRef = useRef(null);

  const bumpFailedAttempts = () => {
    setFailedAttempts((prev) => {
      const next = prev + 1;
      writeFailedAttempts(next);
      return next;
    });
  };

  const resetFailedAttempts = () => {
    setFailedAttempts(0);
    // Also clear from localStorage
    try { localStorage.removeItem('atelnyo_recaptcha_fails'); } catch { /* */ }
  };

  const showV2Checkbox = Boolean(recaptchaV2Key)
    && failedAttempts >= RECAPTCHA_FAIL_THRESHOLD
    && (mode === 'login' || mode === 'signup');

  // Fetch runtime config for reCAPTCHA keys
  useEffect(() => {
    if (recaptchaV3Key && recaptchaV2Key) return undefined;
    let cancelled = false;
    import('../../services/api').then(({ default: api }) => {
      api.get('config/public/')
        .then((res) => {
          if (cancelled) return;
          const data = res?.data || {};
          const runtimeV3 = (data.recaptcha_site_key || '').trim();
          const runtimeV2 = (data.recaptcha_v2_site_key || '').trim();
          if (runtimeV3) setRecaptchaV3Key((prev) => prev || runtimeV3);
          if (runtimeV2) setRecaptchaV2Key((prev) => prev || runtimeV2);
          if (runtimeV3 || runtimeV2) cacheRecaptchaKeys({ siteKey: runtimeV3, v2SiteKey: runtimeV2 });
        })
        .catch(() => { /* best-effort */ });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render v2 checkbox when warranted
  useEffect(() => {
    if (!showV2Checkbox || !v2ContainerRef.current) return undefined;
    let cancelled = false;
    renderV2Checkbox(v2ContainerRef.current, recaptchaV2Key, {
      theme: isDarkTheme() ? 'dark' : 'light',
    }).then((token) => {
      if (!cancelled) setV2Token(token || '');
    });
    return () => { cancelled = true; };
  }, [showV2Checkbox, recaptchaV2Key, v2Nonce]);

  // Tear down v2 when no longer needed
  useEffect(() => {
    if (showV2Checkbox) return undefined;
    resetV2Checkbox(v2ContainerRef.current);
    setV2Token('');
    return undefined;
  }, [showV2Checkbox]);

  /**
   * Get a reCAPTCHA token: v2 checkbox if escalated, v3 invisible otherwise.
   * Returns '' when CAPTCHA is not configured.
   */
  const getToken = async () => {
    if (showV2Checkbox) {
      if (!v2Token) return null; // signals "need checkbox"
      const token = v2Token;
      setV2Token('');
      setV2Nonce((n) => n + 1);
      return token;
    }
    return await executeRecaptcha(recaptchaV3Key, mode);
  };

  const onFailedSubmit = () => {
    bumpFailedAttempts();
    if (showV2Checkbox) {
      setV2Token('');
      setV2Nonce((n) => n + 1);
    }
  };

  return {
    recaptchaV2Key,
    showV2Checkbox,
    v2ContainerRef,
    getToken,
    onFailedSubmit,
    resetFailedAttempts,
  };
}
