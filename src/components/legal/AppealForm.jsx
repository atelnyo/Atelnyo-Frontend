/**
 * src/components/legal/AppealForm.jsx
 *
 * Appeal Form — allows users to file an appeal against a policy
 * violation or enforcement action.
 *
 * Trust First design:
 *   - Clear explanation of the appeal process
 *   - Character count for reason field
 *   - Preview before submission
 *   - Confirmation after submission
 *   - Reference to appeal timeout
 *
 * Integration:
 *   - Used in ViolationNotice component
 *   - Accessible from Settings or Profile
 *   - Can be embedded in a modal or full page
 */

import React, { useState, useCallback } from 'react';
import legalService from '../../services/legalService';

// ═══════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════

const s = {
  shell: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '1.5rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-main, #1a1a1a)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary, #666)',
    marginBottom: '1.5rem',
    lineHeight: 1.5,
  },
  field: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-main, #1a1a1a)',
    marginBottom: '6px',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #ddd)',
    background: 'var(--bg-card, #fff)',
    color: 'var(--text-main, #1a1a1a)',
    fontSize: '0.9rem',
    resize: 'vertical',
    minHeight: '120px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  charCount: {
    fontSize: '0.72rem',
    color: 'var(--text-secondary, #999)',
    textAlign: 'right',
    marginTop: '4px',
  },
  charCountWarn: {
    fontSize: '0.72rem',
    color: '#ef4444',
    textAlign: 'right',
    marginTop: '4px',
  },
  evidenceHelp: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary, #777)',
    marginTop: '4px',
    fontStyle: 'italic',
  },    actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '1.5rem',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #ddd)',
    background: 'var(--bg-card, #fff)',
    color: 'var(--text-main, #1a1a1a)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  submitBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  cancelBtn: {
    padding: '12px 24px',
    background: 'transparent',
    color: 'var(--text-secondary, #666)',
    border: '1px solid var(--border-color, #ddd)',
    borderRadius: '10px',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  alert: {
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  alertError: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
  alertSuccess: {
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.2)',
  },
  infoBox: {
    background: 'var(--bg-secondary, #f8f9fa)',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1.5rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary, #555)',
  },
};

const MAX_REASON_LENGTH = 5000;
const MIN_REASON_LENGTH = 20;


// ═══════════════════════════════════════════════════════════════════════
// AppealForm Component
// ═══════════════════════════════════════════════════════════════════════

export default function AppealForm({
  violation,
  enforcementAction,
  onSuccess,
  onCancel,
  showToast,
  lang = 'en',
}) {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const isHt = lang === 'ht';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';

  const t = (ht, en, fr, es) => {
    if (isHt) return ht;
    if (isFr) return fr;
    if (isEs) return es;
    return en;
  };

  const charCount = reason.length;
  const isValid = reason.trim().length >= MIN_REASON_LENGTH
    && reason.trim().length <= MAX_REASON_LENGTH;

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!isValid) return;

    setSubmitting(true);
    setError(null);

    try {
      let evidenceData = {};
      if (evidence.trim()) {
        try {
          evidenceData = JSON.parse(evidence);
        } catch {
          evidenceData = { description: evidence.trim() };
        }
      }

      await legalService.fileAppeal({
        violation_id: violation.id,
        enforcement_action_id: enforcementAction?.id || null,
        reason: reason.trim(),
        evidence_data: evidenceData,
      });

      setSuccess(true);
      showToast?.(`✓ ${t('Apèl depoze avèk siksè', 'Appeal filed successfully', 'Appel déposé avec succès', 'Apelación presentada con éxito')}`, 'check-circle');
      onSuccess?.();
    } catch (err) {
      const msg = err?.response?.data?.error
        || err?.response?.data?.reason?.[0]
        || err?.message
        || t('Pa t kapab depoze apèl la. Tanpri eseye ankò.', 'Failed to file appeal. Please try again.', 'Impossible de déposer l\'appel. Veuillez réessayer.', 'No se pudo presentar la apelación. Por favor, inténtelo de nuevo.');
      setError(msg);
      showToast?.(msg, 'circle-exclamation');
    } finally {
      setSubmitting(false);
    }
  }, [reason, evidence, violation, enforcementAction, onSuccess, showToast, isValid]);

  // ─── Success state ───────────────────────────────────────────
  if (success) {
    return (
      <div style={s.shell}>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            <i className="fas fa-check-circle" style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ color: 'var(--text-main, #1a1a1a)', marginBottom: '0.5rem' }}>
            {t('Apèl Depoze Avèk Siksè', 'Appeal Filed Successfully', 'Appel déposé avec succès', 'Apelación presentada con éxito')}
          </h2>
          <p style={{ color: 'var(--text-secondary, #666)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            {t(
              'Apèl ou a soumèt. Yon moderatè ap revize l epi reponn nan yon delai rezonab. Ou ka swiv estati l nan paramèt ou yo.',
              'Your appeal has been submitted. A moderator will review it and respond within a reasonable timeframe. You can track the status in your settings.',
              'Votre appel a été soumis. Un modérateur l\'examinera et répondra dans un délai raisonnable. Vous pouvez suivre le statut dans vos paramètres.',
              'Su apelación ha sido presentada. Un moderador la revisará y responderá dentro de un plazo razonable. Puede seguir el estado en su configuración.'
            )}
          </p>
          <button
            type="button"
            style={s.submitBtn}
            onClick={onCancel}
          >
            <i className="fas fa-arrow-left" style={{ marginRight: '0.5rem' }} />
            {t('Retounen nan Vyolasyon yo', 'Back to Violations', 'Retour aux violations', 'Volver a las violaciones')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Main form ───────────────────────────────────────────────
  return (
    <div style={s.shell}>
      <div style={s.title}>
        <i className="fas fa-scale-balanced" style={{ color: 'var(--pink-primary, #d81b60)' }} />
        {t('Depoze yon Apèl', 'File an Appeal', 'Déposer un appel', 'Presentar una apelación')}
      </div>

      <p style={s.subtitle}>
        {t(
          'Ou gen dwa konteste desizyon sa a. Bay yon eksplikasyon klè poukisa ou kwaze vyolasyon oswa efòt lan enkorek. Apèl ou a ap revize pa yon moderatè nan 30 jou.',
          'You have the right to contest this decision. Provide a clear explanation of why you believe the violation or enforcement was incorrect. Your appeal will be reviewed by a moderator within 30 days.',
          'Vous avez le droit de contester cette décision. Fournissez une explication claire de pourquoi vous pensez que la violation ou l\'application était incorrecte. Votre appel sera examiné par un modérateur dans les 30 jours.',
          'Tienes derecho a impugnar esta decisión. Proporciona una explicación clara de por qué crees que la violación o aplicación fue incorrecta. Tu apelación será revisada por un moderador dentro de los 30 días.'
        )}
      </p>

      {/* Violation info */}
      <div style={s.infoBox}>
        <strong>{t('Vyolasyon', 'Violation', 'Violation', 'Violación')}:</strong> {violation.violation_type_name || violation.violation_type}
        <br />
        <strong>{t('Dat', 'Date', 'Date', 'Fecha')}:</strong> {violation.created_at ? new Date(violation.created_at).toLocaleDateString() : '—'}
        <br />
        {violation.description && (
          <>
            <strong>{t('Deskripsyon', 'Description', 'Description', 'Descripción')}:</strong> {violation.description.slice(0, 200)}
          </>
        )}
        {violation.violation_type_appeal_timeout && (
          <>
            <br />
            <span style={{ color: '#ef4444' }}>
              <i className="fas fa-clock" /> {t('Apèl la dwe depoze nan', 'Appeal must be filed within', 'L\'appel doit être déposé dans', 'La apelación debe presentarse dentro de')} {violation.violation_type_appeal_timeout} {t('jou', 'days', 'jours', 'días')}
            </span>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...s.alert, ...s.alertError }}>
          <i className="fas fa-circle-exclamation" style={{ marginRight: '0.5rem' }} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Reason */}
        <div style={s.field}>
          <label style={s.label}>
            {t('Poukisa w ap fè apèl sou desizyon sa a? *', 'Why are you appealing this decision? *', 'Pourquoi faites-vous appel de cette décision ? *', '¿Por qué apela esta decisión? *')}
          </label>
          <textarea
            style={s.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              'Eksplike poukisa ou kwaze vyolasyon oswa efòt lan enkorek. Enfòme nenpòt kontèks oswa prèv ki apwopriye...',
              'Explain why you believe this violation was incorrect. Include any relevant context or evidence...',
              'Expliquez pourquoi vous pensez que cette violation était incorrecte. Incluez tout contexte ou preuve pertinent...',
              'Explique por qué crees que esta violación fue incorrecta. Incluye cualquier contexto o prueba relevante...'
            )}
            maxLength={MAX_REASON_LENGTH}
            disabled={submitting}
            onFocus={(e) => { e.target.style.borderColor = 'var(--pink-primary, #d81b60)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-color, #ddd)'; }}
          />
          <div style={charCount >= MAX_REASON_LENGTH - 100 ? s.charCountWarn : s.charCount}>
            {charCount}/{MAX_REASON_LENGTH}
            {charCount < MIN_REASON_LENGTH && ` (${t('minimòm', 'minimum', 'minimum', 'mínimo')} ${MIN_REASON_LENGTH} ${t('karaktè', 'characters', 'caractères', 'caracteres')})`}
          </div>
        </div>

        {/* Evidence (optional) */}
        <div style={s.field}>
          <label style={s.label}>
            {t('Prèv (opsyonèl)', 'Evidence (optional)', 'Preuve (facultative)', 'Evidencia (opcional)')}
          </label>
          <textarea
            style={{ ...s.textarea, minHeight: '80px' }}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={t(
              'Ou ka kole nenpòt prèv sipò isit (JSON, oswa deskripsyon tèks)...',
              'You can paste any supporting evidence here (JSON, or text description)...',
              'Vous pouvez coller toute preuve à l\'appui ici (JSON, ou description textuelle)...',
              'Puedes pegar cualquier evidencia de apoyo aquí (JSON, o descripción de texto)...'
            )}
            disabled={submitting}
            onFocus={(e) => { e.target.style.borderColor = 'var(--pink-primary, #d81b60)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-color, #ddd)'; }}
          />
          <div style={s.evidenceHelp}>
            {t('Opsyonèl: ekran an, lyen, oswa lòt prèv ki sipòte ka ou', 'Optional: screenshots, links, or other evidence supporting your case', 'Facultatif : captures d\'écran, liens ou autres preuves soutenant votre cas', 'Opcional: capturas de pantalla, enlaces u otra evidencia que respalde su caso')}
          </div>
        </div>

        {/* Actions */}
        <div style={s.actions}>
          <button
            type="button"
            style={s.cancelBtn}
            onClick={onCancel}
            disabled={submitting}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--pink-primary, #d81b60)'; e.currentTarget.style.color = 'var(--pink-primary, #d81b60)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color, #ddd)'; e.currentTarget.style.color = 'var(--text-secondary, #666)'; }}
          >
            {t('Anile', 'Cancel', 'Annuler', 'Cancelar')}
          </button>
          <button
            type="submit"
            style={{
              ...s.submitBtn,
              opacity: (!isValid || submitting) ? 0.6 : 1,
              cursor: (!isValid || submitting) ? 'not-allowed' : 'pointer',
            }}
            disabled={!isValid || submitting}
            onMouseOver={(e) => { if (isValid && !submitting) e.currentTarget.style.opacity = '0.85'; }}
            onMouseOut={(e) => { if (isValid && !submitting) e.currentTarget.style.opacity = '1'; }}
          >
            {submitting ? (
              <><i className="fas fa-spinner fa-spin" /> {t('Ap soumèt...', 'Submitting...', 'Soumission...', 'Enviando...')}</>
            ) : (
              <><i className="fas fa-paper-plane" /> {t('Soumèt Apèl la', 'Submit Appeal', 'Soumettre l\'appel', 'Enviar apelación')}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
