/**
 * src/components/legal/PolicyConsentBanner.jsx
 *
 * Policy Consent Banner — shows when a user has pending policy
 * consents that need their acceptance.
 *
 * Trust First principle: the banner clearly explains what changed,
 * provides a link to the full policy, and offers Accept / Decline
 * buttons. The user's decision is recorded and auditable.
 *
 * Design:
 *   - Slides in from the bottom on mount
 *   - Shows policy title, change summary, and highlights
 *   - "View Policy" link opens a modal or sheet
 *   - "Accept" or "I Agree" button records consent
 *   - "Decline" button is shown for non-mandatory policies
 *   - Dismissed after user acts on all pending policies
 *
 * Integration:
 *   - Used in App.jsx or Header.jsx after login
 *   - Calls legalService.checkPendingConsents() on mount
 *   - Calls legalService.recordConsent() on accept
 */

import React, { useEffect, useState, useCallback } from 'react';
import legalService from '../../services/legalService';

// ═══════════════════════════════════════════════════════════════════════
// Styles (inline CSS variables — will migrate to CSS classes)
// ═══════════════════════════════════════════════════════════════════════

const styles = {
  overlay: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: 'var(--bg-card, #ffffff)',
    borderTop: '2px solid var(--pink-primary, #d81b60)',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
    padding: '0',
    transform: 'translateY(0)',
    transition: 'transform 0.3s ease, opacity 0.3s ease',
  },
  overlayHidden: {
    transform: 'translateY(100%)',
    opacity: 0,
    pointerEvents: 'none',
  },
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  icon: {
    fontSize: '1.3rem',
    color: 'var(--pink-primary, #d81b60)',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-main, #1a1a1a)',
    margin: 0,
  },
  badge: {
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    marginLeft: '8px',
  },
  summary: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary, #666)',
    lineHeight: 1.5,
    margin: 0,
  },    highlights: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  highlight: {
    background: 'var(--bg-secondary, #f5f5f5)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '0.75rem',
    color: 'var(--text-main, #1a1a1a)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  viewLink: {
    color: 'var(--pink-primary, #d81b60)',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  acceptBtn: {
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 20px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  declineBtn: {
    background: 'transparent',
    color: 'var(--text-secondary, #666)',
    border: '1px solid var(--border-color, #ddd)',
    borderRadius: '8px',
    padding: '8px 20px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },    progress: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary, #666)',
    textAlign: 'right',
    marginLeft: 'auto',
  },
};


// ═══════════════════════════════════════════════════════════════════════
// PolicyConsentBanner Component
// ═══════════════════════════════════════════════════════════════════════

export default function PolicyConsentBanner({
  lang = 'en',
  showToast,
  onConsentChange,
}) {
  const [pending, setPending] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const isHt = lang === 'ht';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';

  const t = (ht, en, fr, es) => {
    if (isHt) return ht;
    if (isFr) return fr;
    if (isEs) return es;
    return en;
  };

  // ─── Fetch pending consents ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    legalService.checkPendingConsents(lang)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || res || {};
        const list = data.pending_policies || [];
        setPending(list);
        if (list.length > 0) {
          // Show banner with animation after a short delay
          setTimeout(() => setHidden(false), 500);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lang]);

  // ─── Accept current policy ──────────────────────────────────
  // ─── Accept current policy ──────────────────────────────────
  const handleAccept = useCallback(async () => {
    const current = pending[currentIndex];
    if (!current) return;

    setAccepting(true);
    try {
      await legalService.recordConsent(current.policy_id, true, 'policy_update', { language: lang });
      showToast?.(`✓ ${current.title} ${t('aksepte', 'accepted', 'acceptée', 'aceptada')}`, 'check-circle');

      // Move to next pending policy
      if (currentIndex < pending.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // All consents recorded — hide banner
        setHidden(true);
        onConsentChange?.();
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to record consent';
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setAccepting(false);
    }
  }, [pending, currentIndex, showToast, onConsentChange]);

  // ─── Accept ALL pending policies at once ────────────────────
  const handleAcceptAll = useCallback(async () => {
    setAccepting(true);
    try {
      const res = await legalService.acceptAllConsents(lang);
      const count = res?.data?.accepted_count ?? pending.length;
      showToast?.(
        t(`✓ ${count} polisye aksepte!`, `✓ ${count} policies accepted!`, `✓ ${count} politiques acceptées !`, `✓ ${count} políticas aceptadas!`),
        'check-circle',
      );
      setHidden(true);
      onConsentChange?.();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to accept policies';
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setAccepting(false);
    }
  }, [pending.length, lang, showToast, onConsentChange]);

  // ─── Decline current policy (if optional) ───────────────────
  const handleDecline = useCallback(async () => {
    const current = pending[currentIndex];
    if (!current) return;

    if (current.is_mandatory) {
      showToast?.(t(
        'Politik sa a obligatwa. Ou dwe aksepte l pou kontinye.',
        'This policy is mandatory. You must accept it to continue.',
        'Cette politique est obligatoire. Vous devez l\'accepter pour continuer.',
        'Esta política es obligatoria. Debes aceptarla para continuar.'
      ), 'info-circle');
      return;
    }

    setAccepting(true);
    try {
      await legalService.recordConsent(current.policy_id, false, 'policy_update', { language: lang });
      showToast?.(`✗ ${t('Refize', 'Declined', 'Refusée', 'Rechazada')} ${current.title}`, 'circle-xmark');

      if (currentIndex < pending.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setHidden(true);
        onConsentChange?.();
      }
    } catch (err) {
      showToast?.(err?.response?.data?.error || 'Failed to record decision', 'circle-exclamation');
    } finally {
      setAccepting(false);
    }
  }, [pending, currentIndex, showToast, onConsentChange]);

  // ─── Don't render if no pending policies ────────────────────
  if (loading || pending.length === 0) return null;

  const current = pending[currentIndex];
  if (!current) return null;

  const totalCount = pending.length;
  const remainingCount = totalCount - currentIndex;
  const highlights = current.current_version?.highlights || [];

  return (
    <div style={{ ...styles.overlay, ...(hidden ? styles.overlayHidden : {}) }}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <i className="fas fa-file-shield" style={styles.icon} />
          <h3 style={styles.title}>
            {current.policy_type_label}
            <span style={styles.badge}>v{current.version}</span>
          </h3>
          <div style={styles.progress}>
            {remainingCount} {t('sou', 'of', 'sur', 'de')} {totalCount} {t('ki rete', 'remaining', 'restants', 'restantes')}
          </div>
        </div>

        {/* Change summary */}
        {current.current_version?.summary && (
          <p style={styles.summary}>
            {current.current_version.summary}
          </p>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <div style={styles.highlights}>
            {highlights.map((h, i) => (
              <span key={i} style={styles.highlight}>
                <i className="fas fa-circle-info" style={{ fontSize: '0.65rem', marginRight: '4px' }} />
                {h}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <a
            href={`/legal/${current.slug}`}
            style={styles.viewLink}
            onClick={(e) => {
              e.preventDefault();
              window.open(`/legal/${current.slug}`, '_blank');
            }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fas fa-external-link-alt" style={{ marginRight: '4px', fontSize: '0.7rem' }} />
            {t('Gade polisye konplè', 'View full policy', 'Voir la politique complète', 'Ver política completa')}
          </a>

          <button
            type="button"
            style={styles.acceptBtn}
            onClick={handleAccept}
            disabled={accepting}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {accepting ? (
              <><i className="fas fa-spinner fa-spin" /> {t('Ap aksepte...', 'Accepting...', 'Acceptation...', 'Aceptando...')}</>
            ) : (
              <><i className="fas fa-check-circle" /> {t('M dakò', 'I Agree', 'J\'accepte', 'Acepto')}</>
            )}
          </button>

          {/* Accept All — skip one-by-one when multiple pending */}
          {pending.length > 1 && (
            <button
              type="button"
              onClick={handleAcceptAll}
              disabled={accepting}
              style={{
                background: 'var(--pink-primary, #d81b60)',
                color: '#fff',
                border: '2px solid #fff',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(216,27,96,0.3)',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              <i className="fas fa-check-double" style={{ marginRight: '6px' }} />
              {accepting
                ? t('Ap aksepte tout...', 'Accepting all...', 'Acceptation...', 'Aceptando...')
                : t(`Aksepte tout (${pending.length})`, `Accept All (${pending.length})`, `Tout accepter (${pending.length})`, `Aceptar todo (${pending.length})`)}
            </button>
          )}

          {!current.is_mandatory && (
            <button
              type="button"
              style={styles.declineBtn}
              onClick={handleDecline}
              disabled={accepting}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, #ddd)'; e.currentTarget.style.color = 'var(--text-secondary, #666)'; }}
            >
              <i className="fas fa-times" /> {t('Refize', 'Decline', 'Refuser', 'Rechazar')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
