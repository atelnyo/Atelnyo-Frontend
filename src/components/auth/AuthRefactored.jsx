/**
 * AuthRefactored.jsx — Authentication modal (JWT-driven).
 *
 * Refactored from the original 600+ line Auth.jsx into modular pieces:
 *   - authUtils.js       — Pure utility functions
 *   - useGoogleAuth.js   — Google OAuth hook
 *   - useRecaptcha.js    — reCAPTCHA escalation hook
 *   - AuthForms.jsx      — Presentational form components
 *
 * Modes:
 *   'login'            — email + password
 *   'signup'           — email + password
 *   'forgot'           — email entry → triggers reset
 *   'forgot_success'   — email sent confirmation
 *   'reset'            — dev-mode: new_password + token
 *   '2fa'              — TOTP verification
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import api, { authService, applyTokenPair, clearTokenPair } from '../../services/api';
import { translations } from '../../data/translations';
import { BASE_URL } from '../../seo/seoConfig';
import useFocusTrap from '../../accessibility/hooks/useFocusTrap';

import useGoogleAuth from './useGoogleAuth';
import useRecaptcha from './useRecaptcha';
import {
  LoginForm, SignupForm, ForgotForm, ResetForm, TwoFactorForm,
  ForgotSuccess, DeletionCancelForm, AuthFooter, TwoFactorFooter,
  EmailVerifyPrompt,
} from './AuthForms';
import {
  readReferralParams, extractError, clearFailedAttempts,
  validateSignupFields, validateLoginFields,
} from './authUtils';

// ─── SEO meta tags (only on dedicated /login or /signup routes) ──────
function AuthSeoMeta({ lang, mode }) {
  const t = translations[lang] || translations.ht || {};
  const siteName = 'Atelnyo';
  const isLogin = mode === 'login' || mode === '2fa';
  const title = isLogin
    ? `${t.login || 'Login'} — ${siteName}`
    : `${t.signup || 'Sign up'} — ${siteName}`;
  const description = isLogin
    ? (t.login_soon || 'Log in to your account to continue learning, saving progress, and managing your profile.')
    : (t.signup_soon || 'Create an account to save your progress, join communities, and access your learning dashboard.');
  // Canonical must point at the PRODUCTION host (not window.location.origin —
  // that would leak the dev/staging origin into every auth page canonical).
  const canonical = BASE_URL + window.location.pathname;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex, nofollow" />
      <meta name="theme-color" content="#2563eb" />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content="https://atelnyo.site/og-default.jpg" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}

// ─── Translations object ─────────────────────────────────────────────
function buildTranslations(t, lang) {
  return {
    login: t.login || 'Login',
    signup: t.signup || 'Sign up',
    login_subtitle: t.login_soon || 'Log in to your account.',
    signup_subtitle: t.signup_soon || 'Create an account.',
    forgot_title: t.forgot_title || 'Forgot password',
    forgot_subtitle: t.forgot_subtitle || 'Enter your email to receive a reset link.',
    forgot_send: t.forgot_send || 'Send reset link',
    forgot_back_to_login: t.forgot_back_to_login || 'Back to login',
    reset_title: t.reset_title || 'Reset password',
    reset_subtitle: t.reset_subtitle || 'Choose a new password for your account.',
    reset_new: t.reset_new_password || 'New password',
    reset_confirm: t.reset_confirm_password || 'Confirm new password',
    reset_use_token: t.reset_use_token || 'Reset token',
    reset_submit: t.reset_submit || 'Save new password',
    forgot_success: t.forgot_success || 'If the email is registered, a reset link has been issued.',
    reset_success: t.reset_success || 'Password updated. Please log in.',
    placeholder_email: t.wizard_email || 'Email',
    placeholder_password: t.password_placeholder || 'Password',
    forgot_link: t.forgot_password_link || 'Forgot password?',
    no_account: lang === 'ht' ? 'Ou pa gen kont?' : 'No account?',
    have_account: lang === 'ht' ? 'Ou gen kont deja?' : 'Already have an account?',
    cancel: t.common_cancel || 'Cancel',
    switch_to_login: t.login || 'Login',
    switch_to_signup: t.signup || 'Sign up',
  };
}

// ─── Main Auth Component ─────────────────────────────────────────────
const Auth = ({
  isOpen, onClose, onLoginSuccess, lang, showToast,
  initialMode = 'login', onModeSwitch, seo = false,
}) => {
  const t = translations[lang] || {};
  const T = buildTranslations(t, lang);

  // ─── Core state ──────────────────────────────────────────────────
  const [mode, setMode] = useState(initialMode || 'login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState('');
  const [resetInfo, setResetInfo] = useState({ email: '', token: '', resetUrl: '' });
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  const [pendingDeletion, setPendingDeletion] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', username: '',
    confirmPassword: '', newPassword: '', confirmNewPassword: '', resetToken: '',
    twoFactorCode: '',
  });

  // Sync mode with route-driven initialMode
  useEffect(() => {
    if (initialMode && initialMode !== mode) {
      setMode(initialMode);
      setError('');
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  // ─── Hooks ───────────────────────────────────────────────────────
  const {
    googleClientId, googleRef, pendingGoogle,
    dismissPendingGoogle, triggerGooglePrompt,
  } = useGoogleAuth({ lang, onLoginSuccess, showToast, isLoading });

  const {
    recaptchaV2Key, showV2Checkbox, v2ContainerRef,
    getToken, onFailedSubmit, resetFailedAttempts,
  } = useRecaptcha({ mode });

  // ─── Helpers ─────────────────────────────────────────────────────
  const update = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const persistSession = useCallback(({ access, refresh, user }) => {
    applyTokenPair({ access, refresh, user });
    try { localStorage.removeItem('token'); } catch { /* */ }
  }, []);

  const switchMode = useCallback((next) => {
    setError('');
    setFieldErrors({});
    if (next === 'login' && mode !== 'login') {
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '', twoFactorCode: '' }));
      setTwoFactorChallenge(null);
    }
    setMode(next);
    if ((next === 'login' || next === 'signup') && typeof onModeSwitch === 'function') {
      onModeSwitch(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onModeSwitch]);

  // Password-reset deep link: /reset-password?token=<django token> —
  // landed here from the branded email CTA (or the Django form's SPA
  // redirect). Pre-seed the token + flip the mode to 'reset' so the
  // user arrives on the new-password form with the field filled in;
  // they only type (and confirm) the new password. The 6-digit emailed
  // code works in this field too (the confirm endpoint accepts both).
  // Mounted AFTER all useState declarations; runs once on mount. The
  // setState calls are deferred via a macrotask (project rule: no
  // synchronous setState inside effects — it can trigger cascading
  // renders during hydration).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlToken = (params.get('token') || '').trim();
        if (urlToken) {
          setResetInfo((prev) => ({ ...prev, token: urlToken, resetUrl: window.location.href }));
          setFormData((prev) => ({ ...prev, resetToken: urlToken }));
          setMode('reset');
          // Strip the secret from the address bar (referrer/shoulder-surf
          // hygiene) while keeping the page state — history.replaceState
          // avoids an extra history entry.
          params.delete('token');
          const qs = params.toString();
          const cleaned = window.location.pathname + (qs ? `?${qs}` : '');
          window.history.replaceState(window.history.state, '', cleaned);
        }
      } catch { /* URL parsing is best-effort */ }
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Title / subtitle ────────────────────────────────────────────
  const renderTitle = () => {
    if (mode === 'login') return T.login;
    if (mode === 'signup') return T.signup;
    if (mode === 'forgot') return T.forgot_title;
    if (mode === 'forgot_success') return lang === 'ht' ? 'Email Voye!' : 'Email Sent!';
    if (mode === 'reset') return T.reset_title;
    if (mode === '2fa') return lang === 'ht' ? 'Verifikasyon De Fakèy' : 'Two-Factor Verification';
    return '';
  };

  const renderSubtitle = () => {
    if (mode === 'login') return T.login_subtitle;
    if (mode === 'signup') return T.signup_subtitle;
    if (mode === 'forgot') return T.forgot_subtitle;
    if (mode === 'forgot_success') return lang === 'ht'
      ? 'Si imèl la enskri, nou voye yon lyen reset password ba ou. Verifie bwat resepsyon ou.'
      : 'If the email is registered, we sent a password reset link. Check your inbox.';
    if (mode === 'reset') return T.reset_subtitle;
    if (mode === '2fa') return lang === 'ht'
      ? 'Antre kòd 6 chif ki nan aplikasyon aktestriktè ou an.'
      : 'Enter the 6-digit code from your authenticator app.';
    return '';
  };

  // ─── Submit handler ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ── Pre-submit client validation (instant, bilingual) ──
    const errs = mode === 'signup'
      ? validateSignupFields(formData, lang)
      : mode === 'login'
        ? validateLoginFields(formData, lang)
        : {};
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setIsLoading(true);
    try {
      // Get reCAPTCHA token
      const recaptchaToken = await getToken();
      if (showV2Checkbox && recaptchaToken === null) {
        setError(lang === 'ht' ? 'Konfime ou pa yon robo anvan ou kontinye.' : 'Please confirm you are not a robot before continuing.');
        setIsLoading(false);
        return;
      }

      if (mode === 'login') {
        const identifier = formData.email.trim();
        const { data } = await authService.login({
          username: identifier,
          email: identifier,
          password: formData.password,
          ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
        });
        if (data.requires_2fa) {
          setTwoFactorChallenge(data.challenge);
          setMode('2fa');
          setIsLoading(false);
          return;
        }
        persistSession(data);
        resetFailedAttempts();
        clearFailedAttempts();
        dismissPendingGoogle();
        if (showToast) showToast(lang === 'ht' ? 'Koneksyon siksè!' : 'Login successful!', 'check-circle');
        onLoginSuccess(data.user);

      } else if (mode === '2fa') {
        const { data } = await authService.twoFactorVerifyLogin(twoFactorChallenge, formData.twoFactorCode);
        persistSession(data);
        setTwoFactorChallenge(null);
        if (showToast) showToast(lang === 'ht' ? 'Koneksyon siksè!' : 'Login successful!', 'check-circle');
        onLoginSuccess(data.user);

      } else if (mode === 'signup') {
        const { ref, refSource } = readReferralParams();
        const { data } = await authService.signup({
          email: formData.email,
          password: formData.password,
          ...(ref ? { ref, ...(refSource ? { ref_source: refSource } : {}) } : {}),
          ...(recaptchaToken ? { recaptcha_token: recaptchaToken } : {}),
        });
        persistSession(data);
        resetFailedAttempts();
        clearFailedAttempts();
        dismissPendingGoogle();
        if (showToast) showToast(lang === 'ht' ? 'Kont ou kreye ak siksè!' : 'Account created successfully!', 'user-check');

        // ── Email verification nudge (optional, never blocking) ──
        // Instead of closing immediately, offer a one-tap verify flow.
        // onVerified → normal close; Skip → normal close as well.
        lastUserRef.current = data.user;
        setSignedUpEmail(formData.email);
        setShowVerifyPrompt(true);
        setIsLoading(false);
        return;

      } else if (mode === 'forgot') {
        const email = formData.email.trim();
        if (!email) { setError(lang === 'ht' ? 'Antre imel ou.' : 'Please enter your email.'); setIsLoading(false); return; }
        const { data } = await authService.forgotPassword(email, recaptchaToken);
        if (showToast) showToast(T.forgot_success, 'envelope');
        resetFailedAttempts();
        clearFailedAttempts();
        if (data?.dev_reset_token) {
          setResetInfo({ email, token: data.dev_reset_token, resetUrl: data?.dev_reset_url || '' });
          update('resetToken', data.dev_reset_token);
          setMode('reset');
        } else {
          setError('');
          setFormData((prev) => ({ ...prev, email: '' }));
          setMode('forgot_success');
        }

      } else if (mode === 'reset') {
        const { resetToken, newPassword, confirmNewPassword } = formData;
        if (newPassword !== confirmNewPassword) {
          setError(lang === 'ht' ? 'Modpas yo pa menm.' : 'Passwords do not match.');
          setIsLoading(false); return;
        }
        if (newPassword.length < 6) {
          setError(lang === 'ht' ? 'Modpas dwe omwen 6 karaktè.' : 'Password must be at least 6 characters.');
          setIsLoading(false); return;
        }
        await authService.resetPasswordConfirm(resetToken || resetInfo.token, newPassword, recaptchaToken);
        if (showToast) showToast(T.reset_success, 'check-circle');
        clearTokenPair();
        clearFailedAttempts();
        setMode('login');
        setFormData((prev) => ({ ...prev, password: '', newPassword: '', confirmNewPassword: '', resetToken: '' }));
      }
    } catch (err) {
      onFailedSubmit();
      const msg = extractError(err, lang);
      if (err.response?.status === 403 && typeof msg === 'string' && msg.includes('scheduled for deletion')) {
        setPendingDeletion(true);
        setError('');
      } else {
        setError(msg);
      }
      if (showToast) showToast(msg, 'exclamation-triangle');
    } finally { setIsLoading(false); }
  };

  // ─── Post-signup verification prompt handlers ────────────────────
  const lastUserRef = React.useRef(null);
  const finishAuth = useCallback(() => {
    setShowVerifyPrompt(false);
    dismissPendingGoogle();
    if (onLoginSuccess && lastUserRef.current) onLoginSuccess(lastUserRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoginSuccess]);

  // ─── Accessibility: dialog semantics, focus trap, Escape ─────────
  // The auth modal is the only top-level overlay in the app that was
  // missing them — every other modal uses role=dialog + a focus trap
  // (AccessibleDialog, CheckoutModal, admin modals, …).
  const authCardRef = useRef(null);

  // Lock body scroll while open. Save/restore the PREVIOUS value so
  // stacking over another modal (profile contact, checkout) restores
  // that modal's lock instead of releasing it early.
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Declared after finishAuth so the closure can reference it (TDZ).
  // Escape routes by context: loading → ignored; post-signup verify
  // prompt → skip; everywhere else → onClose (Cancel/Back behavior).
  // Latest-ref pattern: the handler passed to useFocusTrap NEVER changes
  // identity (a new callback would re-arm the trap, which steals focus
  // back to the first field — catastrophic mid-keystroke), while still
  // always calling the freshest logic. AuthRoute's inline onClose and
  // App's toast re-renders can churn identities freely.
  const escapeRef = useRef(() => {});
  escapeRef.current = () => {
    if (isLoading) return;
    if (showVerifyPrompt) finishAuth();
    else if (onClose) onClose();
  };
  const handleEscape = useCallback(() => escapeRef.current(), []);

  useFocusTrap(authCardRef, { isActive: isOpen, onEscape: handleEscape });

  // ─── Account deletion cancel ─────────────────────────────────────
  const handleCancelDeletion = async () => {
    if (cancelLoading) return;
    const email = (formData.email || '').trim();
    const pw = (formData.password || '').trim();
    if (!email || !pw) {
      setError(lang === 'ht' ? 'Antre imèl ak modpas ou.' : 'Please enter your email and password.');
      return;
    }
    setCancelLoading(true);
    try {
      const { data } = await authService.cancelAccountDeletionPublic(email, pw);
      setPendingDeletion(false);
      persistSession(data);
      clearFailedAttempts();
      if (showToast) showToast(
        lang === 'ht' ? 'Efase kont anile! Kont ou aktif ankò.' : 'Account deletion cancelled! Your account is active again.',
        'check-circle',
      );
      onLoginSuccess(data.user);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail
        || (lang === 'ht' ? 'Pa t kapab anile efase kont.' : 'Could not cancel account deletion.');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally { setCancelLoading(false); }
  };

  if (!isOpen) return null;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      {seo && <AuthSeoMeta lang={lang} mode={mode} />}
      <div className="auth-shell">
      {/* Brand aside — desktop only (CSS hides it on small screens) */}
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-logo">
          <i className="fas fa-layer-group" aria-hidden="true" />
          <span>Atelnyo</span>
        </div>
        <h3 className="auth-aside-title">
          {lang === 'ht'
            ? 'Aprann. Kreye. Pataje.'
            : 'Learn. Create. Share.'}
        </h3>
        <ul className="auth-aside-points">
          <li>
            <i className="fas fa-circle-check" aria-hidden="true" />
            <span>{lang === 'ht' ? 'Kou ak sètifika gratis' : 'Free courses and certificates'}</span>
          </li>
          <li>
            <i className="fas fa-circle-check" aria-hidden="true" />
            <span>{lang === 'ht' ? 'Kominote kreyatè global' : 'A global creator community'}</span>
          </li>
          <li>
            <i className="fas fa-circle-check" aria-hidden="true" />
            <span>{lang === 'ht' ? 'Vann travay ou nan maché a' : 'Sell your work on the marketplace'}</span>
          </li>
        </ul>
        <p className="auth-aside-quote">
          {lang === 'ht'
            ? '« Atelnyo se lekòl ou nan pòch ou. »'
            : '"Atelnyo is your school in your pocket."'}
        </p>
      </aside>

      <div ref={authCardRef} className="auth-card">
        {/* Mode nav tabs (hidden during the post-signup verify prompt) */}
        {!showVerifyPrompt && (
        <nav className="auth-mode-nav" aria-label={lang === 'ht' ? 'Opsyon koneksyon' : 'Authentication navigation'}>
          {['login', 'signup', 'forgot'].map((tab) => (
            <a
              key={tab}
              href={`#${tab}`}
              className={`auth-mode-link ${
                (tab === 'login' && (mode === 'login' || mode === '2fa'))
                || (tab === 'signup' && mode === 'signup')
                || (tab === 'forgot' && (mode === 'forgot' || mode === 'reset'))
                  ? 'is-active' : ''
              }`}
              onClick={(e) => {
                e.preventDefault();
                if (!isLoading) switchMode(tab);
              }}
            >
              {tab === 'login' ? T.login : tab === 'signup' ? T.signup : T.forgot_title}
            </a>
          ))}
        </nav>
        )}

        <h1 id="auth-title">{renderTitle()}</h1>
        <p>{renderSubtitle()}</p>

        {/* Error display */}
        {error && !pendingDeletion && (
          <div className="auth-error">
            <i className="fas fa-exclamation-circle" aria-hidden="true" />{error}
          </div>
        )}

        {/* Account deletion cancel flow */}
        {pendingDeletion && (
          <DeletionCancelForm
            isLoading={cancelLoading}
            lang={lang}
            onSubmit={handleCancelDeletion}
            onGoBack={() => { setPendingDeletion(false); setError(''); }}
          />
        )}

        {/* Main form (hidden while the post-signup verify prompt shows) */}
        {!pendingDeletion && mode !== 'forgot_success' && !showVerifyPrompt && (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'login' && <LoginForm formData={formData} update={update} isLoading={isLoading} lang={lang} T={T} errors={fieldErrors} />}
            {mode === 'signup' && <SignupForm formData={formData} update={update} isLoading={isLoading} lang={lang} T={T} errors={fieldErrors} />}
            {mode === 'forgot' && <ForgotForm formData={formData} update={update} isLoading={isLoading} T={T} />}
            {mode === 'reset' && <ResetForm formData={formData} update={update} resetInfo={resetInfo} isLoading={isLoading} lang={lang} T={T} />}
            {mode === '2fa' && <TwoFactorForm formData={formData} update={update} isLoading={isLoading} lang={lang} />}

            {/* reCAPTCHA v2 checkbox */}
            {showV2Checkbox && (
              <div className="auth-recaptcha">
                <p className="auth-recaptcha-note">
                  {lang === 'ht' ? 'Plizyè tantativ echwe. Konfime ou se yon moun.' : 'Several attempts failed. Confirm you are human.'}
                </p>
                <div ref={v2ContainerRef} className="auth-recaptcha-box" />
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={isLoading}>
              {isLoading && <i className="fas fa-spinner fa-spin" />}
              {mode === 'login' && T.login}
              {mode === 'signup' && T.signup}
              {mode === 'forgot' && T.forgot_send}
              {mode === 'reset' && T.reset_submit}
              {mode === '2fa' && (lang === 'ht' ? 'Konfime de fakèy' : 'Verify')}
            </button>
          </form>
        )}

        {/* Forgot success screen */}
        {mode === 'forgot_success' && (
          <ForgotSuccess lang={lang} onBackToLogin={() => switchMode('login')} />
        )}

        {/* Post-signup email verification prompt (optional, non-blocking) */}
        {showVerifyPrompt && mode === 'signup' && (
          <EmailVerifyPrompt
            email={signedUpEmail}
            lang={lang}
            authService={authService}
            onSkip={finishAuth}
            onVerified={finishAuth}
          />
        )}

        {/* Footer links */}
        {!showVerifyPrompt && (
          <AuthFooter mode={mode} isLoading={isLoading} lang={lang} T={T} onSwitch={switchMode} />
        )}
        {mode === '2fa' && (
          <TwoFactorFooter isLoading={isLoading} lang={lang} onBackToLogin={() => { setTwoFactorChallenge(null); setMode('login'); }} />
        )}

        {/* Google OAuth */}
        {googleClientId && (mode === 'login' || mode === 'signup') && !showVerifyPrompt && (
          <div className="auth-provider-rows">
            <div className="auth-provider-divider" aria-hidden="true">
              <span>{lang === 'ht' ? 'oswa' : 'or'}</span>
            </div>
            {pendingGoogle && pendingGoogle.email && (
              <div className="auth-google-resume">
                <button
                  type="button"
                  className="auth-resume-chip"
                  onClick={() => { setError(''); triggerGooglePrompt(); }}
                  disabled={isLoading}
                  title={pendingGoogle.email}
                >
                  {pendingGoogle.picture && <img className="auth-resume-avatar" src={pendingGoogle.picture} alt="" />}
                  <span>
                    {lang === 'ht' ? 'Kontinye kòm' : 'Continue as'}{' '}
                    <strong>{pendingGoogle.name || pendingGoogle.email}</strong>
                  </span>
                  <i className="fas fa-arrow-right" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="auth-resume-dismiss"
                  aria-label={lang === 'ht' ? 'Efase rapèl sa a' : 'Dismiss this reminder'}
                  onClick={dismissPendingGoogle}
                  disabled={isLoading}
                >
                  <i className="fas fa-xmark" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="auth-google-row">
              <div ref={googleRef} className="auth-google-btn" />
            </div>
          </div>
        )}

        {/* Forgot password link (login only) */}
        {mode === 'login' && (
          <p className="auth-forgot-row">
            <button type="button" className="auth-link" onClick={() => !isLoading && switchMode('forgot')} disabled={isLoading}>
              {T.forgot_link}
            </button>
          </p>
        )}

        {!showVerifyPrompt && (
          <button onClick={onClose} disabled={isLoading} className="auth-btn auth-btn--secondary auth-btn--cancel">
            {T.cancel}
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

export default Auth;
