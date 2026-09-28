/**
 * src/components/settings/TwoFactorSettings.jsx
 *
 * F-013 / T053 — TOTP two-factor authentication settings panel.
 *
 * Driven by ``authService``:
 *   setup()        → POST /api/2fa/setup/   → {secret, otpauth_url}
 *   enable(code)   → POST /api/2fa/enable/  → {enabled, message}
 *   disable(code)  → POST /api/2fa/disable/ → {enabled, message}
 *
 * States:
 *   disabled   → "Set up 2FA" CTA → setup() → verify mode
 *   verify     → QR canvas + otpauth secret + 6-digit input → enable()
 *   enabled    → green "On" badge + "Disable 2FA" CTA
 *   disabling  → 6-digit input → disable()
 *
 * The QR canvas is generated with the ``qrcode`` JS lib (same lib the
 * ShareModal uses) — no Python ``qrcode`` dependency needed server-side.
 */
import React, { useState, useRef, useCallback } from 'react';
import QRCodeLib from 'qrcode';
import { authService } from '../../services/api';

const CODE_LEN = 6;

function t2f(lang, key) {
  const T = {
    title: {
      ht: 'De Fakèy (TOTP)',
      en: 'Two-Factor Authentication',
      fr: 'Authentification à deux facteurs',
      es: 'Autenticación de dos factores',
    },
    enabledTitle: {
      ht: 'Sekirite Atelnyo an pil fen',
      en: 'Atelnyo security is fully on',
      fr: 'La sécurité Atelnyo est activée',
      es: 'La seguridad de Atelnyo está activada',
    },
    enabledBody: {
      ht: 'Ou dwe pouse 6 chiff ki bay aplikasyon aktestriktè a chak fwa w konekte.',
      en: 'You’ll enter a 6-digit code from your authenticator app each time you log in.',
      fr: 'Vous saisirez un code à 6 chiffres de votre application d’authentification à chaque connexion.',
      es: 'Ingresarás un código de 6 dígitos de tu app de autenticación cada vez que inicies sesión.',
    },
    disabledTitle: {
      ht: 'Ajoute yon degre sèlman',
      en: 'Add a second lock to your account',
      fr: 'Ajoutez un deuxième verrou à votre compte',
      es: 'Añade una segunda capa a tu cuenta',
    },
    disabledBody: {
      ht: 'Aktive de fakèy pou pi plis sekirite. Ou pral soti yon kòd QR ki bay aplikasyon aktestriktè.',
      en: 'Enable two-factor auth for extra security. You’ll scan a QR code with your authenticator app.',
      fr: 'Activez l’authentification à deux facteurs pour plus de sécurité. Vous scannez un code QR avec votre application d’authentification.',
      es: 'Activa la autenticación de dos factores para más seguridad. Escanearás un código QR con tu app de autenticación.',
    },
    setupBtn: {
      ht: 'Komanse akte', en: 'Set up', fr: 'Configurer', es: 'Configurar',
    },
    disableBtn: {
      ht: 'Dezaktive de fakèy', en: 'Disable two-factor', fr: 'Désactiver l’authentification à deux facteurs', es: 'Desactivar autenticación de dos factores',
    },
    scanTitle: {
      ht: 'Scanne kòd QR sa a',
      en: 'Scan this QR code',
      fr: 'Scannez ce code QR',
      es: 'Escanea este código QR',
    },
    scanBody: {
      ht: 'Pwovèb li kòd la nan Google Authenticator, Authy, oswa 1Password. Si ou pa ka skene, kole sekre a.',
      en: 'Open Google Authenticator, Authy, or 1Password and scan. If scanning fails, paste the secret below.',
      fr: 'Ouvrez Google Authenticator, Authy ou 1Password et scannez. Si l’analyse échoue, collez le secret ci-dessous.',
      es: 'Abre Google Authenticator, Authy o 1Password y escanea. Si falla, pega el secreto abajo.',
    },
    secretLabel: {
      ht: 'Sekre TOTP', en: 'TOTP secret', fr: 'Secret TOTP', es: 'Secreto TOTP',
    },
    codePlaceholder: {
      ht: '6 chiff ki nan ekran ou an', en: '6-digit code', fr: 'Code à 6 chiffres', es: 'Código de 6 dígitos',
    },
    verifyBtn: {
      ht: 'Konfime ak chèf la', en: 'Verify & enable', fr: 'Vérifier et activer', es: 'Verificar y activar',
    },
    disableConfirmTitle: {
      ht: 'Dezaktive de fakèy?',
      en: 'Disable two-factor?',
      fr: 'Désactiver l’authentification à deux facteurs ?',
      es: '¿Desactivar autenticación de dos factores?',
    },
    disableConfirmBody: {
      ht: 'Antre kòd 6 chiff ki nan ekran ou an pou konfime.',
      en: 'Enter your 6-digit code to confirm.',
      fr: 'Saisissez votre code à 6 chiffres pour confirmer.',
      es: 'Ingresa tu código de 6 dígitos para confirmar.',
    },
    cancelBtn: {
      ht: 'Anpe', en: 'Cancel', fr: 'Annuler', es: 'Cancelar',
    },
    errGeneric: {
      ht: 'Ere à aktiv 2FA. Esai ankò.',
      en: 'Could not update 2FA. Please try again.',
      fr: 'Impossible de mettre à jour l’authentification à deux facteurs. Réessayez.',
      es: 'No se pudo actualizar la autenticación de dos factores. Inténtalo de nuevo.',
    },
    errVerify: {
      ht: 'Kòd pa valab. Verifye kèk minit ak aplikasyon an.',
      en: 'Invalid code. Double-check against your authenticator app.',
      fr: 'Code invalide. Vérifiez par rapport à votre application.',
      es: 'Código inválido. Verifica contra tu app de autenticación.',
    },
    errAlreadyEnabled: {
      ht: 'De fakèy pa gen okenn ankò.',
      en: '2FA is already enabled for this account.',
      fr: 'L’authentification à deux facteurs est déjà activée.',
      es: 'La autenticación de dos factores ya está activada.',
    },
  };
  return T[key]?.[lang] || T[key]?.en || '';
}

export default function TwoFactorSettings({ user, lang = 'ht', onUpdated }) {
  const [status, setStatus] = useState('idle');
  const [isEnabled, setIsEnabled] = useState(() => !!(user && user.two_factor_enabled));
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState('');
  const canvasRef = useRef(null);

  const handleSetup = useCallback(async () => {
    setStatus('setup_loading');
    try {
      const { data: raw } = await authService.twoFactorSetup();
      const payload = raw?.secret && raw?.otpauth_url ? raw
        : (raw?.data?.secret && raw?.data?.otpauth_url ? raw.data
        : raw);
      setPending({ secret: payload.secret, otpauthUrl: payload.otpauth_url });
      setStatus('verify');
      if (canvasRef.current && payload.otpauth_url) {
        QRCodeLib.toCanvas(canvasRef.current, payload.otpauth_url, {
          width: 160, margin: 1,
          color: { dark: '#1e293b', light: '#ffffff' },
        }, (err) => { if (err) console.error('[2FA] qr error:', err); });
      }
    } catch (err) {
      const msg = err?.response?.data?.error;
      if (msg && /already/i.test(msg)) {
        setStatus('already_enabled');
      } else {
        setStatus('error');
      }
    } finally {
      setCode('');
    }
  }, []);

  const handleEnable = useCallback(async () => {
    if (code.length !== CODE_LEN || !/^\d+$/.test(code)) return;
    setStatus('enable_loading');
    try {
      await authService.twoFactorEnable(code);
      setIsEnabled(true);
      setPending(null);
      setStatus('enabled');
      onUpdated?.();
    } catch {
      setStatus('error');
    } finally {
      setCode('');
    }
  }, [code, onUpdated]);

  const handleDisable = useCallback(async () => {
    if (code.length !== CODE_LEN || !/^\d+$/.test(code)) return;
    setStatus('disable_loading');
    try {
      await authService.twoFactorDisable(code);
      setIsEnabled(false);
      setStatus('disabled');
      onUpdated?.();
    } catch {
      setStatus('error');
    } finally {
      setCode('');
    }
  }, [code, onUpdated]);

  const cancel = useCallback(() => {
    setStatus(isEnabled ? 'enabled' : 'disabled');
    setPending(null);
    setCode('');
  }, [isEnabled]);

  const renderCodeInput = () => (
    <input
      type="text"
      inputMode="numeric"
      maxLength={CODE_LEN}
      placeholder={t2f(lang, 'codePlaceholder')}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LEN))}
      className="inst-app-code-input"
      data-testid="2fa-code-input"
    />
  );

  const isBusy = status === 'setup_loading' || status === 'enable_loading' || status === 'disable_loading';

  // ─── Idle (not yet configured / after an action resets) ─────────────
  if (status === 'idle' || status === 'disabled' || status === 'error' || status === 'already_enabled') {
    const showError = status === 'error';
    const showAlready = status === 'already_enabled';
    return (
      <div className="inst-app-panel" data-testid="twofactor-settings" data-state={isEnabled ? 'enabled' : 'disabled'}>
        {showAlready ? (
          <div className="inst-app-status inst-app-status--ok" data-testid="2fa-state-badge">
            <i className="fas fa-check-circle" aria-hidden="true" /> {t2f(lang, 'enabledTitle')}
          </div>
        ) : (
          <div className={`inst-app-status ${isEnabled ? 'inst-app-status--ok' : 'inst-app-status--ready'}`} data-testid="2fa-state-badge">
            <i className={`fas ${isEnabled ? 'fa-shield-check' : 'fa-shield-alt'}`} aria-hidden="true" />
            {isEnabled ? t2f(lang, 'enabledTitle') : t2f(lang, 'disabledTitle')}
          </div>
        )}

        {showError && (
          <p className="inst-app-body" style={{ color: '#f87171' }} data-testid="2fa-error">
            {t2f(lang, 'errGeneric')}
          </p>
        )}

        {showAlready && (
          <p className="inst-app-body" style={{ color: '#fbbf24' }} data-testid="2fa-already">
            {t2f(lang, 'errAlreadyEnabled')}
          </p>
        )}

        {!isEnabled && !showAlready && (
          <>
            <div className="inst-app-title">{t2f(lang, 'disabledTitle')}</div>
            <p className="inst-app-body">{t2f(lang, 'disabledBody')}</p>
          </>
        )}

        {isEnabled && !showAlready && (
          <>
            <div className="inst-app-title">{t2f(lang, 'enabledTitle')}</div>
            <p className="inst-app-body">{t2f(lang, 'enabledBody')}</p>
          </>
        )}

        {isEnabled ? (
          <button
            type="button"
            className="inst-app-btn"
            onClick={() => setStatus('disabling')}
            disabled={isBusy}
            data-testid="2fa-disable-cta"
          >
            <i className="fas fa-lock-open" aria-hidden="true" /> {t2f(lang, 'disableBtn')}
          </button>
        ) : (
          <button
            type="button"
            className="inst-app-btn"
            onClick={handleSetup}
            disabled={isBusy}
            data-testid="2fa-setup-cta"
          >
            <i className="fas fa-qrcode" aria-hidden="true" /> {isBusy ? (lang === 'ht' ? 'Karg' : '…') : t2f(lang, 'setupBtn')}
          </button>
        )}
      </div>
    );
  }

  // ─── Verify setup — QR + code input ────────────────────────────────
  if (status === 'verify') {
    return (
      <div className="inst-app-panel" data-testid="twofactor-settings" data-state="verify">
        <div className="inst-app-status inst-app-status--ready" data-testid="2fa-state-badge">
          <i className="fas fa-qrcode" aria-hidden="true" /> {t2f(lang, 'scanTitle')}
        </div>
        <div className="inst-app-title">{t2f(lang, 'scanTitle')}</div>
        <p className="inst-app-body">{t2f(lang, 'scanBody')}</p>

        <div className="inst-app-qr" data-testid="2fa-qr" style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <canvas ref={canvasRef} width={160} height={160} />
        </div>

        <div className="inst-app-store" style={{ marginTop: 0, borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
          <span className="inst-app-store-label">{t2f(lang, 'secretLabel')}</span>
          <div
            className="inst-app-secret"
            data-testid="2fa-secret"
            style={{
              fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all',
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer', userSelect: 'all', marginTop: '6px',
            }}
            onClick={() => {
              navigator.clipboard.writeText(pending?.secret || '').catch(() => {});
            }}
            title={lang === 'ht' ? 'Klike pou kopie' : 'Click to copy'}
          >
            {pending?.secret}
          </div>
        </div>

        {renderCodeInput()}

        <div className="inst-app-store-buttons" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="inst-app-btn"
            onClick={handleEnable}
            disabled={code.length !== CODE_LEN}
            data-testid="2fa-enable-confirm"
          >
            <i className="fas fa-check" aria-hidden="true" /> {t2f(lang, 'verifyBtn')}
          </button>
          <button
            type="button"
            className="inst-app-store-btn"
            onClick={cancel}
            data-testid="2fa-cancel"
          >
            {t2f(lang, 'cancelBtn')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Disabling — code input ────────────────────────────────────────
  if (status === 'disabling') {
    return (
      <div className="inst-app-panel" data-testid="twofactor-settings" data-state="disabling">
        <div className="inst-app-status inst-app-status--ready" data-testid="2fa-state-badge">
          <i className="fas fa-lock-open" aria-hidden="true" /> {t2f(lang, 'disableConfirmTitle')}
        </div>
        <div className="inst-app-title">{t2f(lang, 'disableConfirmTitle')}</div>
        <p className="inst-app-body">{t2f(lang, 'disableConfirmBody')}</p>
        {renderCodeInput()}
        <div className="inst-app-store-buttons" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="inst-app-btn"
            onClick={handleDisable}
            disabled={code.length !== CODE_LEN}
            data-testid="2fa-disable-confirm"
          >
            <i className="fas fa-check" aria-hidden="true" /> {t2f(lang, 'disableBtn')}
          </button>
          <button
            type="button"
            className="inst-app-store-btn"
            onClick={cancel}
            data-testid="2fa-cancel"
          >
            {t2f(lang, 'cancelBtn')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Enabled confirmation ──────────────────────────────────────────
  if (status === 'enabled') {
    return (
      <div className="inst-app-panel" data-testid="twofactor-settings" data-state="enabled">
        <div className="inst-app-status inst-app-status--ok" data-testid="2fa-state-badge">
          <i className="fas fa-check-circle" aria-hidden="true" /> {t2f(lang, 'enabledTitle')}
        </div>
        <div className="inst-app-title">{t2f(lang, 'enabledTitle')}</div>
        <p className="inst-app-body">{t2f(lang, 'enabledBody')}</p>
      </div>
    );
  }

  // Fallback
  return null;
}
