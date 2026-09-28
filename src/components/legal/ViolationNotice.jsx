/**
 * src/components/legal/ViolationNotice.jsx
 *
 * Violation Notice — alerts users about active policy violations
 * and enforcement actions against their account.
 *
 * Trust First design:
 *   - Clear, non-judgmental explanation of what happened
 *   - Shows specific violation type, severity, and enforcement action
 *   - "File an Appeal" button opens the AppealForm
 *   - Links to relevant policy for transparency
 *
 * States:
 *   - Loading: skeleton while fetching violations
 *   - Empty: no violations (returns null)
 *   - Active violations: shows violation cards with enforcement details
 *   - Error: fallback error message
 *
 * Integration:
 *   - Used in App.jsx (shown after login if user has active enforcements)
 *   - Available from Settings or Mwen tab
 *   - Links directly to AppealForm for easy contesting
 */

import React, { useEffect, useState, useCallback } from 'react';
import legalService from '../../services/legalService';
import AppealForm from './AppealForm';

// ═══════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════

const s = {
  shell: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--bg-card, #ffffff)',
    borderRadius: '16px',
    maxWidth: '640px',
    width: '100%',
    maxHeight: '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  warningIcon: {
    fontSize: '1.5rem',
    color: '#ef4444',
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-main, #1a1a1a)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary, #666)',
    margin: '2px 0 0',
  },
  body: {
    padding: '1rem 1.5rem 0',
    overflowY: 'auto',
    flex: 1,
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--border-color, #e0e0e0)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  closeBtn: {
    padding: '8px 20px',
    background: 'transparent',
    color: 'var(--text-secondary, #666)',
    border: '1px solid var(--border-color, #ddd)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  primaryBtn: {
    padding: '8px 20px',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  // ─── Violation card ────────────────────────────────────────
  card: {
    background: 'var(--bg-secondary, #f8f9fa)',
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderLeft: '4px solid #ef4444',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  cardType: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-main, #1a1a1a)',
  },
  severityBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    textTransform: 'uppercase',
  },
  cardDate: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary, #888)',
    marginBottom: '0.25rem',
  },
  cardDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary, #555)',
    lineHeight: 1.5,
    margin: '0 0 0.75rem',
  },
  enforcementBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '6px',
    marginBottom: '0.5rem',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '0.5rem',
  },
  appealBtn: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--pink-primary, #d81b60)',
    border: '1px solid var(--pink-primary, #d81b60)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  viewPolicyBtn: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--text-secondary, #666)',
    border: '1px solid var(--border-color, #ddd)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.78rem',
  },
  noViolations: {
    textAlign: 'center',
    padding: '2rem 0',
    color: 'var(--text-secondary, #666)',
  },
  loadingCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 0',
    color: 'var(--text-secondary, #666)',
  },
  // ─── Severity colors ───────────────────────────────────────
  severityLow: { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderLeftColor: '#f59e0b' },
  severityMedium: { background: 'rgba(251, 140, 0, 0.1)', color: '#fb8c00', borderLeftColor: '#fb8c00' },
  severityHigh: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderLeftColor: '#ef4444' },
  severityCritical: { background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderLeftColor: '#dc2626' },
  enforcementWarning: { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
  enforcementSuspend: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
  enforcementBan: { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' },
};

// ─── Helper: get severity style ─────────────────────────────────────

function getSeverityStyle(severity) {
  const map = {
    low: s.severityLow,
    medium: s.severityMedium,
    high: s.severityHigh,
    critical: s.severityCritical,
  };
  return map[severity] || s.severityLow;
}

function getEnforcementStyle(type) {
  if (type === 'warning') return s.enforcementWarning;
  if (type === 'temporary_suspend') return s.enforcementSuspend;
  if (type === 'permanent_ban') return s.enforcementBan;
  return s.enforcementWarning;
}

function getEnforcementIcon(type) {
  const map = {
    warning: 'fa-triangle-exclamation',
    content_removal: 'fa-trash-alt',
    feature_suspension: 'fa-ban',
    temporary_suspend: 'fa-clock',
    permanent_ban: 'fa-hand',
    legal_escalation: 'fa-gavel',
  };
  return map[type] || 'fa-exclamation-circle';
}


// ═══════════════════════════════════════════════════════════════════════
// ViolationNotice Component
// ═══════════════════════════════════════════════════════════════════════

export default function ViolationNotice({
  isOpen,
  onClose,
  lang = 'en',
  showToast,
}) {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appealingViolation, setAppealingViolation] = useState(null);

  const isHt = lang === 'ht';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';

  const t = (ht, en, fr, es) => {
    if (isHt) return ht;
    if (isFr) return fr;
    if (isEs) return es;
    return en;
  };

  // ─── Fetch violations ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    legalService.myViolations()
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        // Only show active/pending violations
        const active = data.filter((v) =>
          ['pending_review', 'under_review', 'confirmed', 'appealed'].includes(v.status)
        );
        setViolations(active);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load violations');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  // ─── Format date ────────────────────────────────────────────
  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return '—'; }
  };

  // ─── Handle appeal filed ────────────────────────────────────
  const handleAppealSuccess = useCallback(() => {
    setAppealingViolation(null);
    // Refresh violations list
    legalService.myViolations()
      .then((res) => {
        const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        setViolations(data.filter((v) =>
          ['pending_review', 'under_review', 'confirmed', 'appealed'].includes(v.status)
        ));
      })
      .catch(() => {});
  }, []);

  // ─── If not open, render nothing ────────────────────────────
  if (!isOpen) return null;

  return (
    <div
      style={s.shell}
      onClick={(e) => { if (e.target === e.currentTarget && !appealingViolation) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Avi Vyolasyon Politik', 'Policy violations notice', 'Avis de violations de politique', 'Aviso de violaciones de política')}
    >
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ───────────────────────────────────────── */}
        <div style={s.header}>
          <i className="fas fa-shield-exclamation" style={s.warningIcon} />
          <div>
            <h2 style={s.title}>
              {loading ? t('Ap chaje...', 'Loading...', 'Chargement...', 'Cargando...') :
                violations.length > 0
                  ? t(`Avi Kont (${violations.length})`, `Account Notice (${violations.length})`, `Avis de compte (${violations.length})`, `Aviso de cuenta (${violations.length})`)
                  : t('Pa gen vyolasyon aktif', 'No Active Violations', 'Aucune violation active', 'Sin violaciones activas')}
            </h2>
            <p style={s.subtitle}>
              {violations.length > 0
                ? t(
                    'Kont ou gen vyolasyon politik aktif ki bezwen atansyon ou.',
                    'Your account has active policy violations that require your attention.',
                    'Votre compte a des violations de politique actives qui nécessitent votre attention.',
                    'Su cuenta tiene violaciones de política activas que requieren su atención.'
                  )
                : t(
                    'Kont ou nan bon pozisyon.',
                    'Your account is in good standing.',
                    'Votre compte est en bonne position.',
                    'Su cuenta está en buen estado.'
                  )}
            </p>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div style={s.body}>

          {/* Loading */}
          {loading && (
            <div style={s.loadingCenter}>
              <i className="fas fa-spinner fa-pulse" style={{ marginRight: '0.5rem' }} />
              {t('Ap tcheke estati kont ou...', 'Checking your account status...', 'Vérification du statut de votre compte...', 'Verificando el estado de su cuenta...')}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
              <i className="fas fa-circle-exclamation" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block' }} />
              <p>{t('Pa t kapab tcheke vyolasyon yo. Tanpri eseye ankò pita.', 'Unable to check violations. Please try again later.', 'Impossible de vérifier les violations. Veuillez réessayer plus tard.', 'No se pudieron verificar las violaciones. Por favor, inténtelo más tarde.')}</p>
            </div>
          )}

          {/* No violations — show good standing message */}
          {!loading && !error && violations.length === 0 && (
            <div style={s.noViolations}>
              <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', color: '#10b981', marginBottom: '0.75rem', display: 'block' }} />
              <h3 style={{ color: '#10b981', fontWeight: 600, margin: '0 0 0.5rem' }}>{t('Bon Pozisyon', 'Good Standing', 'Bonne position', 'Buen estado')}</h3>
              <p>{t('Kont ou pa gen vyolasyon politik. Ou tout bon!', 'Your account has no policy violations. You\'re all clear!', 'Votre compte n\'a aucune violation de politique. Tout est en ordre !', 'Su cuenta no tiene violaciones de política. ¡Todo está en orden!')}</p>
            </div>
          )}

          {/* Active violations list */}
          {!loading && !error && violations.map((v) => {
            const severityStyle = getSeverityStyle(v.severity?.toLowerCase());
            const enforcement = v.enforcement_actions?.[0];
            const enforcementStyle = enforcement ? getEnforcementStyle(enforcement.enforcement_type) : {};

            return (
              <div
                key={v.id}
                style={{
                  ...s.card,
                  borderLeftColor: severityStyle.borderLeftColor || '#ef4444',
                }}
              >
                {/* Violation header */}
                <div style={s.cardHeader}>
                  <span style={s.cardType}>
                    <i className="fas fa-gavel" style={{ marginRight: '0.4rem', fontSize: '0.75rem' }} />
                    {v.violation_type_name || t('Vyolasyon Politik', 'Policy Violation', 'Violation de politique', 'Violación de política')}
                  </span>
                  <span style={{
                    ...s.severityBadge,
                    background: severityStyle.background,
                    color: severityStyle.color,
                  }}>
                    {v.severity || 'Unknown'}
                  </span>
                </div>

                {/* Date */}
                <div style={s.cardDate}>
                  <i className="fas fa-calendar" style={{ marginRight: '0.3rem' }} />
                  {fmtDateTime(v.created_at)}
                </div>

                {/* Description */}
                {v.description && (
                  <p style={s.cardDesc}>
                    {v.description.slice(0, 300)}
                    {v.description.length > 300 && '...'}
                  </p>
                )}

                {/* Enforcement action */}
                {enforcement && (
                  <div style={{
                    ...s.enforcementBadge,
                    ...enforcementStyle,
                  }}>
                    <i className={`fas ${getEnforcementIcon(enforcement.enforcement_type)}`} />
                    {enforcement.enforcement_type_label || enforcement.enforcement_type}
                    {enforcement.escalation_level > 1 && ` (Level ${enforcement.escalation_level})`}
                    {enforcement.expires_at && ` — Expires ${fmtDate(enforcement.expires_at)}`}
                    {enforcement.duration_hours && !enforcement.expires_at && ` — ${enforcement.duration_hours}h`}
                  </div>
                )}

                {/* Content snippet (if applicable) */}
                {v.content_snippet && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#888',
                    background: 'var(--bg-page, #f0f0f0)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    marginBottom: '0.5rem',
                    fontStyle: 'italic',
                  }}>
                    "{v.content_snippet.slice(0, 150)}{v.content_snippet.length > 150 ? '...' : ''}"
                  </div>
                )}

                {/* Appeal actions */}
                <div style={s.cardActions}>
                  <button
                    type="button"
                    style={s.appealBtn}
                    onClick={() => setAppealingViolation(v)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--pink-primary, #d81b60)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--pink-primary, #d81b60)';
                    }}
                  >
                    <i className="fas fa-scale-balanced" style={{ marginRight: '0.3rem', fontSize: '0.7rem' }} />
                    {t('Fè Apèl', 'File Appeal', 'Déposer un appel', 'Presentar apelación')}
                  </button>
                  <button
                    type="button"
                    style={s.viewPolicyBtn}
                    onClick={() => window.open('/legal/content-policy', '_blank')}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--pink-primary, #d81b60)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, #ddd)'; }}
                  >
                    <i className="fas fa-external-link-alt" style={{ marginRight: '0.3rem', fontSize: '0.65rem' }} />
                    {t('Gade Polisye', 'View Policy', 'Voir la politique', 'Ver política')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        {!appealingViolation && (
          <div style={s.footer}>
            <button
              type="button"
              style={s.closeBtn}
              onClick={onClose}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--pink-primary, #d81b60)'; e.currentTarget.style.color = 'var(--pink-primary, #d81b60)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, #ddd)'; e.currentTarget.style.color = 'var(--text-secondary, #666)'; }}
            >
              {violations.length > 0 ? t('Mwen konprann', 'I Understand', 'Je comprends', 'Entiendo') : t('Fèmen', 'Close', 'Fermer', 'Cerrar')}
            </button>
            {violations.length > 0 && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #888)', margin: 0 }}>
                <i className="fas fa-info-circle" style={{ marginRight: '0.3rem' }} />
                {t('Apèl yo dwe depoze nan limit tan ki otorize', 'Appeals must be filed within the allowed timeframe', 'Les appels doivent être déposés dans le délai autorisé', 'Las apelaciones deben presentarse dentro del plazo permitido')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Appeal Form modal (overlaid on top) ─────────────── */}
      {appealingViolation && (
        <AppealForm
          violation={appealingViolation}
          enforcementAction={appealingViolation.enforcement_actions?.[0] || null}
          onSuccess={handleAppealSuccess}
          onCancel={() => {
            setAppealingViolation(null);
            // If no violations remain after appeal, close the notice
            if (violations.length === 0) onClose?.();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
