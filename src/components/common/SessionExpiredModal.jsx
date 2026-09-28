/**
 * src/components/common/SessionExpiredModal.jsx
 *
 * Unmissable, blocking notice shown when the server kills the user's
 * session (expired / revoked / token erased) while they were browsing —
 * including full-screen /sheet/ routes where the small 4s toast is
 * easy to miss. Gives the user a one-tap path straight back to the
 * sign-in sheet instead of leaving them stranded on a "logged out"
 * page with no explanation.
 *
 * Mirrors ConfirmModal's overlay/card structure + design tokens so it
 * matches the rest of the app (dark mode safe, i18n, Escape to dismiss).
 *
 * Props:
 *   open     — boolean; renders nothing when false
 *   lang     — 'ht' | 'en' | 'fr' | 'es'
 *   onLogin  — callback when the user taps "Log in again" (open auth sheet)
 *   onDismiss— callback to close the modal ("Later")
 */
import React, { useEffect, useCallback } from 'react';

const COPY = {
  ht: {
    title: 'Sesyon ou ekspire',
    body: 'Sesyon ou te fini oswa yo te retire token ou a (ou konekte sou yon lòt aparèy, ou chanje modpas ou, oswa sesyon an ekspire). Tanpri konekte ankò pou w kontinye. Done ou yo an sekirite.',
    login: 'Konekte ankò',
    later: 'Pita',
  },
  en: {
    title: 'Your session has expired',
    body: 'Your session ended or your login token was revoked (you may have signed in on another device, changed your password, or the session simply timed out). Please log in again to continue. Your data is safe.',
    login: 'Log in again',
    later: 'Later',
  },
  fr: {
    title: 'Votre session a expiré',
    body: 'Votre session a pris fin ou votre jeton de connexion a été révoqué (connexion depuis un autre appareil, changement de mot de passe, ou simple expiration). Veuillez vous reconnecter pour continuer. Vos données sont en sécurité.',
    login: 'Se reconnecter',
    later: 'Plus tard',
  },
  es: {
    title: 'Tu sesión ha expirado',
    body: 'Tu sesión terminó o tu token de acceso fue revocado (quizás iniciaste sesión en otro dispositivo, cambiaste tu contraseña, o la sesión simplemente expiró). Inicia sesión de nuevo para continuar. Tus datos están a salvo.',
    login: 'Iniciar sesión',
    later: 'Más tarde',
  },
};

export default function SessionExpiredModal({ open, lang = 'ht', onLogin, onDismiss }) {
  const copy = COPY[lang] || COPY.en;

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onDismiss?.(); }
  }, [onDismiss]);

  useEffect(() => {
    if (!open) { return undefined; }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) { return null; }

  return (
    <div
      className="session-expired-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) { onDismiss?.(); } }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
    >
      <div
        className="session-expired-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={copy.title}
        style={{
          background: 'var(--bg-card, #fff)',
          borderRadius: 'var(--radius-2xl, 16px)',
          padding: 'var(--sp-2xl, 24px)',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(220,38,38,0.08)', color: '#dc2626',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', margin: '0 auto 16px',
        }}>
          <i className="fas fa-user-lock" aria-hidden="true" />
        </div>

        {/* Title */}
        <h3 style={{
          margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 700,
          color: 'var(--text-primary, #1e293b)',
        }}>
          {copy.title}
        </h3>

        {/* Body */}
        <div style={{
          fontSize: '0.9rem', lineHeight: 1.65,
          color: 'var(--text-secondary, #64748b)',
          marginBottom: 24,
        }}>
          {copy.body}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onDismiss}
            className="btn-secondary"
            style={{
              padding: '10px 20px', borderRadius: 'var(--radius-lg, 10px)',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'transparent', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--text-primary, #1e293b)',
              transition: 'all 0.15s ease',
            }}
          >
            {copy.later}
          </button>
          <button
            type="button"
            onClick={onLogin}
            autoFocus
            style={{
              padding: '10px 22px', borderRadius: 'var(--radius-lg, 10px)',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #d81b60, #c2185b)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(216,27,96,0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="fas fa-sign-in-alt" aria-hidden="true" /> {copy.login}
          </button>
        </div>
      </div>
    </div>
  );
}
