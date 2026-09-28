/**
 * AuthForms.jsx — Individual form components for each auth mode.
 *
 * Each form is a pure presentational component that receives props
 * and calls callbacks. No business logic — the parent Auth component
 * handles state + API calls.
 *
 * UX toolkit (2026 refresh):
 *   - AuthField      — label + input wrapper (accessible, no placeholder-only)
 *   - PasswordField  — visibility toggle + Caps Lock warning
 *   - StrengthMeter  — live password checklist (signup)
 *   - EmailVerifyPrompt — post-signup "verify your email" nudge
 */
import React, { useState, useMemo, useCallback } from 'react';
import { scorePassword, MIN_PASSWORD_LENGTH, extractOtpCode } from './authUtils';

// ─── Shared field: label + input ─────────────────────────────────────
function AuthField({ label, id, hint, error, children }) {
  return (
    <div className={`form-group auth-field ${error ? 'has-error' : ''}`}>
      {label && <label className="auth-label" htmlFor={id}>{label}</label>}
      {children}
      {error ? (
        <span className="auth-field-error" role="alert">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
        </span>
      ) : hint ? (
        <span className="auth-field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

// ─── Password input with visibility toggle + Caps Lock warning ───────
export function PasswordField({
  id, name, placeholder, value, onChange, disabled, required,
  autoComplete = 'current-password', label, error, lang = 'en', strength = false,
}) {
  const [visible, setVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const ht = lang === 'ht';

  const capsDetect = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsOn(e.getModifierState('CapsLock'));
    }
  };

  const strengthInfo = useMemo(
    () => (strength ? scorePassword(value) : null),
    [strength, value],
  );
  const strengthLabel = strength && ['fèb', 'fèb', 'mwayen', 'bon', 'fos'][
    strengthInfo?.score ?? 0
  ];
  const strengthLabelEn = ['weak', 'weak', 'fair', 'good', 'strong'][
    strengthInfo?.score ?? 0
  ];

  return (
    <div className={`form-group auth-field ${error ? 'has-error' : ''}`}>
      {label && <label className="auth-label" htmlFor={id}>{label}</label>}
      <div className="auth-pw-wrap">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          id={id}
          className="form-control auth-pw-input"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyUp={capsDetect}
          onKeyDown={capsDetect}
          onBlur={() => setCapsOn(false)}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          aria-describedby={capsOn ? `${id}-caps` : undefined}
        />
        <button
          type="button"
          className="auth-pw-toggle"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          tabIndex={0}
          aria-label={visible ? (ht ? 'Kache modpas' : 'Hide password') : (ht ? 'Montre modpas' : 'Show password')}
          aria-pressed={visible}
        >
          <i className={`fas ${visible ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
        </button>
      </div>
      {capsOn && (
        <span id={`${id}-caps`} className="auth-caps-warning" role="status">
          <i className="fas fa-arrow-up-right-dots" aria-hidden="true" />
          {ht ? 'Caps Lock aktif.' : 'Caps Lock is on.'}
        </span>
      )}
      {error && (
        <span className="auth-field-error" role="alert">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
        </span>
      )}
      {strength && strengthInfo && value.length > 0 && (
        <div className="auth-strength" data-score={strengthInfo.score}>
          <div className="auth-strength-bars" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`auth-strength-bar ${i < strengthInfo.score ? 'is-on' : ''}`} />
            ))}
          </div>
          <span className="auth-strength-label">
            {ht ? strengthLabel : strengthLabelEn}
          </span>
        </div>
      )}
      {strength && strengthInfo && value.length > 0 && !strengthInfo.met && (
        <ul className="auth-pw-checklist">
          <li className={strengthInfo.checks.length ? 'ok' : ''}>
            {ht ? `Omwen ${MIN_PASSWORD_LENGTH} karaktè` : `At least ${MIN_PASSWORD_LENGTH} characters`}
          </li>
          <li className={strengthInfo.checks.letter ? 'ok' : ''}>
            {ht ? 'Yon lèt' : 'A letter'}
          </li>
          <li className={strengthInfo.checks.number ? 'ok' : ''}>
            {ht ? 'Yon chif' : 'A number'}
          </li>
        </ul>
      )}
    </div>
  );
}

// ─── Login Form ──────────────────────────────────────────────────────
export function LoginForm({ formData, update, isLoading, lang, errors = {} }) {
  const ht = lang === 'ht';
  return (
    <>
      <AuthField
        label={ht ? 'Imèl oswa non itilizatè' : 'Email or username'}
        id="auth-login-identifier"
        error={errors.email}
      >
        <input
          type="text"
          name="email"
          id="auth-login-identifier"
          className="form-control"
          placeholder={ht ? 'Imèl oswa non itilizatè' : 'Email or Username'}
          value={formData.email}
          onChange={(e) => update('email', e.target.value)}
          required disabled={isLoading} autoComplete="username"
        />
      </AuthField>
      <PasswordField
        id="auth-login-password"
        name="password"
        label={ht ? 'Modpas' : 'Password'}
        placeholder={ht ? 'Modpas ou' : 'Your password'}
        value={formData.password}
        onChange={(e) => update('password', e.target.value)}
        required disabled={isLoading} autoComplete="current-password"
        lang={lang} error={errors.password}
      />
    </>
  );
}

// ─── Signup Form ─────────────────────────────────────────────────────
export function SignupForm({ formData, update, isLoading, lang, errors = {}, showStrength = true }) {
  const ht = lang === 'ht';
  return (
    <>
      <AuthField
        label={ht ? 'Imèl' : 'Email'}
        id="auth-signup-email"
        error={errors.email}
      >
        <input
          type="email"
          name="email"
          id="auth-signup-email"
          className="form-control"
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => update('email', e.target.value)}
          required disabled={isLoading} autoComplete="email"
        />
      </AuthField>
      <PasswordField
        id="auth-signup-password"
        name="password"
        label={ht ? 'Modpas' : 'Password'}
        placeholder={ht ? 'Omwen 8 karaktè' : 'At least 8 characters'}
        value={formData.password}
        onChange={(e) => update('password', e.target.value)}
        required disabled={isLoading} autoComplete="new-password"
        lang={lang} error={errors.password} strength={showStrength}
      />
      <PasswordField
        id="auth-signup-confirm"
        name="confirmPassword"
        label={ht ? 'Konfime modpas' : 'Confirm password'}
        placeholder={ht ? 'Re-antre modpas la' : 'Re-enter the password'}
        value={formData.confirmPassword}
        onChange={(e) => update('confirmPassword', e.target.value)}
        required disabled={isLoading} autoComplete="new-password"
        lang={lang} error={errors.confirmPassword}
      />
    </>
  );
}

// ─── Forgot Password Form ────────────────────────────────────────────
export function ForgotForm({ formData, update, isLoading, T, lang }) {
  const ht = lang === 'ht';
  return (
    <AuthField
      label={T.placeholder_email || 'Email'}
      id="auth-forgot-email"
      hint={ht
        ? 'Nou voye yon lyen reset nan imèl sa a.'
        : "We'll send a reset link to this address."}
    >
      <div className="auth-icon-input">
        <i className="fas fa-envelope" aria-hidden="true" />
        <input
          type="email"
          name="email"
          id="auth-forgot-email"
          className="form-control"
          placeholder={T.placeholder_email}
          value={formData.email}
          onChange={(e) => update('email', e.target.value)}
          required disabled={isLoading} autoComplete="email"
          inputMode="email"
        />
      </div>
    </AuthField>
  );
}

// ─── Reset Password Form (dev mode) ──────────────────────────────────
export function ResetForm({ formData, update, resetInfo, isLoading, lang, T }) {
  const ht = lang === 'ht';
  // Pasting the whole email into the token field extracts just the
  // 6-digit code; anything else (the long dev token) pastes raw.
  const handleTokenPaste = useCallback((e) => {
    const code = extractOtpCode(e.clipboardData?.getData('text') ?? '');
    if (code) {
      e.preventDefault();
      update('resetToken', code);
    }
  }, [update]);
  return (
    <>
      {resetInfo.token && (
        <div className="auth-dev-info">
          <i className="fas fa-circle-info" aria-hidden="true" />
          <span>{ht
            ? 'Mòd dev: rezilta a soti nan /api/password/forgot/. Nan pwodiksyon, lyen reset la ap vin nan imel.'
            : 'Dev mode: token came back from /api/password/forgot/. In production this would arrive by email.'}</span>
        </div>
      )}
      <PasswordField
        id="auth-reset-new"
        name="newPassword"
        label={T.reset_new}
        value={formData.newPassword}
        onChange={(e) => update('newPassword', e.target.value)}
        required disabled={isLoading} autoComplete="new-password"
        lang={lang} strength
      />
      <PasswordField
        id="auth-reset-confirm"
        name="confirmNewPassword"
        label={T.reset_confirm}
        value={formData.confirmNewPassword}
        onChange={(e) => update('confirmNewPassword', e.target.value)}
        required disabled={isLoading} autoComplete="new-password"
        lang={lang}
      />
      <AuthField
        label={ht ? 'Kòd 6-chif oswa token' : '6-digit code or token'}
        id="auth-reset-token"
        hint={ht
          ? 'Tape kòd 6-chif nan imel la — oswa token long la si ou genyen l'
          : 'Enter the 6-digit code from the email — or the long token if you have it'}
      >
        <div className="auth-icon-input">
          <i className="fas fa-key" aria-hidden="true" />
          <input
            type="text"
            name="resetToken"
            id="auth-reset-token"
            className="form-control auth-monospace"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={ht ? '6 chif' : '6-digit code'}
            value={formData.resetToken}
            onChange={(e) => update('resetToken', e.target.value.replace(/[^0-9a-zA-Z-._]/g, ''))}
            onPaste={handleTokenPaste}
            disabled={isLoading}
          />
        </div>
      </AuthField>
    </>
  );
}

// ─── Two-Factor Form — 6-digit OTP display ───────────────────────────
// Visual-only segmentation: the state stays a single string so the API
// contract and validation logic are untouched.
export function TwoFactorForm({ formData, update, isLoading, lang }) {
  const ht = lang === 'ht';
  const code = formData.twoFactorCode || '';
  const digits = code.split('').concat(Array(6 - code.length).fill(''));
  // Paste the whole email/SMS → just the 6-digit code lands. Without
  // this, maxLength would keep the first 6 characters of the pasted
  // text ("Kòd re…") and the digit filter would wipe them → empty field.
  const handleOtpPaste = useCallback((e) => {
    const extracted = extractOtpCode(e.clipboardData?.getData('text') ?? '');
    if (extracted) {
      e.preventDefault();
      update('twoFactorCode', extracted);
    }
  }, [update]);
  return (
    <AuthField
      label={ht ? 'Kòd verifikasyon' : 'Verification code'}
      id="auth-2fa-code"
      hint={ht ? 'Nan aplikasyon otantifikatè ou' : 'From your authenticator app'}
    >
      <div className="auth-otp-wrap">
        <div className="auth-otp">
          {digits.map((d, i) => (
            <span
              key={i}
              className={`auth-otp-cell ${i === code.length && code.length < 6 ? 'is-next' : ''}`}
              aria-hidden="true"
            >
              {d}
            </span>
          ))}
        </div>
        {/* Invisible input layered over the cells: taps/clicks land on it
            (so the keyboard opens without extra JS), the label + SR text
            still target it, and one-time-code autofill fills it. */}
        <input
          type="text"
          name="twoFactorCode"
          id="auth-2fa-code"
          inputMode="numeric"
          maxLength={6}
          className="form-control auth-otp-input"
          placeholder={ht ? 'Antre 6 chif yo' : 'Enter the 6 digits'}
          value={code}
          onChange={(e) => update('twoFactorCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
          onPaste={handleOtpPaste}
          required disabled={isLoading} autoComplete="one-time-code"
        />
      </div>
    </AuthField>
  );
}

// ─── Forgot Success Screen ─────────────────────────────────────────
export function ForgotSuccess({ lang, onBackToLogin }) {
  const ht = lang === 'ht';
  return (
    <div className="auth-success">
      <div className="auth-success-icon" aria-hidden="true">&#x2709;&#xFE0F;</div>
      <p className="auth-success-main">
        {ht
          ? 'Nou voye yon lyen reset password ba ou. Verifie bwat resepsyon imèl ou an epi klike sou lyen an.'
          : 'We sent a password reset link to your email. Check your inbox and click the link.'}
      </p>
      <p className="auth-success-sub">
        {ht
          ? 'Lyen an ekspire apre 24 èdtan. Si ou pa resevwa anyen, verifye folder spam ou.'
          : 'The link expires in 24 hours. If you did not receive it, check your spam folder.'}
      </p>
      <button
        type="button"
        className="auth-btn"
        onClick={onBackToLogin}
      >
        {ht ? 'Tounen nan Koneksyon' : 'Back to Login'}
      </button>
    </div>
  );
}

// ─── Account Deletion Cancel Flow ────────────────────────────────
export function DeletionCancelForm({ isLoading, lang, onSubmit, onGoBack }) {
  const ht = lang === 'ht';
  return (
    <div className="auth-deletion-cancel">
      <div className="auth-error auth-deletion-warning">
        <i className="fas fa-triangle-exclamation" aria-hidden="true" />
        {ht
          ? 'Kont ou planifye pou efase. Ou gen 7 jou pou anile l.'
          : 'Your account is scheduled for deletion. You have 7 days to cancel it.'}
      </div>
      <p className="auth-deletion-text">
        {ht
          ? 'Antre modpas ou anba a pou anile efase kont ou epi retabli aksè.'
          : 'Enter your password below to cancel the deletion and restore access.'}
      </p>
      <button
        type="button"
        className="auth-btn"
        disabled={isLoading}
        onClick={onSubmit}
      >
        {isLoading
          ? (ht ? 'Ap anile...' : 'Cancelling...')
          : (ht ? 'Anile efase kont' : 'Cancel account deletion')}
      </button>
      <button
        type="button"
        className="auth-btn auth-btn--secondary auth-deletion-back"
        onClick={onGoBack}
      >
        {ht ? 'Tounen' : 'Go back'}
      </button>
    </div>
  );
}

// ─── Auth Footer (switch links) ──────────────────────────────────
export function AuthFooter({ mode, isLoading, lang, T, onSwitch }) {
  if (mode === 'forgot_success' || mode === 'reset' || mode === '2fa') return null;

  return (
    <p className="auth-footer">
      {mode === 'login' && (
        <>{T.no_account}{' '}
          <button type="button" className="auth-link" onClick={() => !isLoading && onSwitch('signup')} disabled={isLoading}>
            {T.switch_to_signup}
          </button>
        </>
      )}
      {mode === 'signup' && (
        <>{T.have_account}{' '}
          <button type="button" className="auth-link" onClick={() => !isLoading && onSwitch('login')} disabled={isLoading}>
            {T.switch_to_login}
          </button>
        </>
      )}
      {mode === 'forgot' && (
        <button type="button" className="auth-link" onClick={() => !isLoading && onSwitch('login')} disabled={isLoading}>
          {T.forgot_back_to_login}
        </button>
      )}
    </p>
  );
}

// ─── 2FA Footer ──────────────────────────────────────────────────────
export function TwoFactorFooter({ isLoading, lang, onBackToLogin }) {
  return (
    <p className="auth-footer">
      <button type="button" className="auth-link" onClick={() => { if (!isLoading) onBackToLogin(); }} disabled={isLoading}>
        {lang === 'ht' ? 'Tounen nan koneksyon' : 'Back to login'}
      </button>
    </p>
  );
}

// ─── Post-signup email verification prompt ───────────────────────────
// Shown right after a successful signup (before the modal closes).
// Fires POST /api/email/verify/send/ and surfaces the dev-mode token
// flow (identical UX to the password-reset dev flow). Failure is
// silent — verification is optional and must never block login.
export function EmailVerifyPrompt({ email, lang, onSkip, onVerified, authService }) {
  const [state, setState] = useState('idle'); // idle | sending | sent | verified
  const [token, setToken] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [error, setError] = useState('');
  const ht = lang === 'ht';

  const send = async () => {
    setError('');
    setState('sending');
    try {
      const { data } = await authService.sendEmailVerification();
      if (data?.dev_verify_token) {
        setToken(data.dev_verify_token);
        setDevUrl(data.dev_verify_url || '');
      }
      setState('sent');
    } catch {
      setState('idle');
      setError(ht ? 'Pa t kapab voye imèl la. Eseye ankò.' : 'Could not send the email. Try again.');
    }
  };

  const confirm = async () => {
    setError('');
    try {
      await authService.confirmEmailVerification(token.trim());
      setState('verified');
      if (onVerified) onVerified();
    } catch {
      setError(ht ? 'Token la pa valid oswa li ekspire.' : 'That token is invalid or expired.');
    }
  };

  if (state === 'verified') {
    return (
      <div className="auth-verify-prompt is-verified" role="status">
        <i className="fas fa-circle-check" aria-hidden="true" />
        <p>{ht ? 'Imèl ou verifye. Mèsi!' : 'Your email is verified. Thanks!'}</p>
      </div>
    );
  }

  return (
    <div className="auth-verify-prompt" role="region" aria-label={ht ? 'Verifikasyon imèl' : 'Email verification'}>
      <div className="auth-verify-icon" aria-hidden="true">
        <i className="fas fa-envelope-circle-check" />
      </div>
      <p className="auth-verify-title">
        {ht ? 'Verifye imèl ou' : 'Verify your email'}
      </p>
      <p className="auth-verify-text">
        {ht
          ? `Konfime ${email || 'imèl ou'} pou ou ka resevwa nòtifikatè ak retabli modpas ou.`
          : `Confirm ${email || 'your email'} so you can receive notifications and reset your password.`}
      </p>
      {error && (
        <div className="auth-error">
          <i className="fas fa-exclamation-circle" aria-hidden="true" />{error}
        </div>
      )}
      {state !== 'sent' ? (
        <div className="auth-verify-actions">
          <button type="button" className="auth-btn" onClick={send} disabled={state === 'sending'}>
            {state === 'sending' && <i className="fas fa-spinner fa-spin" />}
            {ht ? 'Voye lyen verifikasyon' : 'Send verification link'}
          </button>
          <button type="button" className="auth-link" onClick={onSkip} disabled={state === 'sending'}>
            {ht ? 'Pita' : 'Later'}
          </button>
        </div>
      ) : (
        <div className="auth-verify-actions">
          <input
            type="text"
            className="form-control auth-monospace"
            placeholder={ht ? 'Kole token verifikasyon an' : 'Paste the verification token'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-label={ht ? 'Token verifikasyon' : 'Verification token'}
          />
          <button type="button" className="auth-btn" onClick={confirm} disabled={!token.trim()}>
            {ht ? 'Konfime' : 'Confirm'}
          </button>
          {devUrl && (
            <span className="auth-dev-info">
              <i className="fas fa-info-circle" aria-hidden="true" />
              {ht ? 'Mòd dev:' : 'Dev mode:'} <code>{devUrl}</code>
            </span>
          )}
          <button type="button" className="auth-link" onClick={onSkip}>
            {ht ? 'Kontinye san verifikasyon' : 'Continue without verifying'}
          </button>
        </div>
      )}
    </div>
  );
}
