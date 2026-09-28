/**
 * src/routes/EmailVerificationRoute.jsx — /verify-email landing.
 *
 * The verification email links here with ?token=<JWT>. This route:
 *   1. POSTs the token to /api/email/verify/confirm/ (AllowAny — the
 *      signed token is the proof of identity, no session needed);
 *   2. Renders the outcome (verified / invalid / network error);
 *   3. Strips the token from the address bar either way.
 *
 * Deliberately NOT inside AuthRoute: a user clicking an emailed link
 * may be signed out on another device, and requiring a session to
 * verify would defeat the flow.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';

const COPY = {
  ht: {
    verifying: 'N ap verifye imel ou…',
    ok: 'Imel ou verifye avèk siksè! ✅',
    okDesc: 'Kont ou konplètman aktif. Ou ka fèmen tab sa a oswa tounen nan aplikasyon an.',
    invalid: 'Lyen sa a pa valid oswa li ekspire.',
    invalidDesc: 'Mande yon nouvo lyen verifye nan Paramèt → Kont.',
    network: 'Pa t kapab rive jwenn sèvè a.',
    networkDesc: 'Tcheke koneksyon ou an epi eseye ankò.',
    back: 'Tounen nan Atelnyo',
  },
  en: {
    verifying: 'Verifying your email…',
    ok: 'Your email has been verified! ✅',
    okDesc: 'Your account is fully active. You can close this tab or head back to the app.',
    invalid: 'This link is invalid or has expired.',
    invalidDesc: 'Request a new verification link from Settings → Account.',
    network: 'Could not reach the server.',
    networkDesc: 'Check your connection and try again.',
    back: 'Back to Atelnyo',
  },
};

export default function EmailVerificationRoute() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState('verifying'); // verifying | ok | invalid | network
  const lang = (navigator.language || 'en').startsWith('ht') ? 'ht' : 'en';
  const t = COPY[lang];
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const token = (searchParams.get('token') || '').trim();
    const timer = setTimeout(() => {
      // Strip the secret from the address bar before anything else.
      searchParams.delete('token');
      const qs = searchParams.toString();
      window.history.replaceState(
        window.history.state, '',
        window.location.pathname + (qs ? `?${qs}` : ''),
      );

      if (!token) {
        setState('invalid');
        return;
      }
      authService.confirmEmailVerification(token)
        .then(() => setState('ok'))
        .catch((err) => {
          const status = err?.response?.status;
          setState(status === 400 || status === 401 || status === 404 ? 'invalid' : 'network');
        });
    }, 0);
    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '32px 16px',
    }}>
      <div style={{
        maxWidth: 440, width: '100%', textAlign: 'center',
        padding: '40px 28px', borderRadius: 20,
        background: 'var(--bg-card, #fff)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {state === 'verifying' && (
          <>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--pink-primary, #d81b60)' }} aria-hidden="true" />
            <h1 style={{ fontSize: '1.25rem', margin: '20px 0 8px' }}>{t.verifying}</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <h1 style={{ fontSize: '1.25rem', margin: '16px 0 8px' }}>{t.ok}</h1>
            <p style={{ color: 'var(--text-secondary, #64748b)', margin: '0 0 20px' }}>{t.okDesc}</p>
          </>
        )}
        {(state === 'invalid' || state === 'network') && (
          <>
            <div style={{ fontSize: '3rem' }}>{state === 'invalid' ? '⚠️' : '📡'}</div>
            <h1 style={{ fontSize: '1.25rem', margin: '16px 0 8px' }}>
              {state === 'invalid' ? t.invalid : t.network}
            </h1>
            <p style={{ color: 'var(--text-secondary, #64748b)', margin: '0 0 20px' }}>
              {state === 'invalid' ? t.invalidDesc : t.networkDesc}
            </p>
          </>
        )}
        {state !== 'verifying' && (
          <Link
            to="/"
            className="auth-btn auth-btn-primary"
            style={{ display: 'inline-block', padding: '12px 28px', textDecoration: 'none' }}
          >
            {t.back}
          </Link>
        )}
      </div>
    </div>
  );
}
