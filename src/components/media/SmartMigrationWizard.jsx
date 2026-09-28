/**
 * SmartMigrationWizard — URL replacement workflow UI.
 *
 * When a Creator wants to change provider or fix a broken media link:
 *   1. Replace URL — paste new URL
 *   2. Validate — auto-detect provider, validate accessibility
 *   3. Preview — see preview of new media
 *   4. Update References — confirm to update ALL references across modules
 *
 * Uses SmartReplaceService on the backend to auto-update all references.
 */
import React, { useState, useCallback } from 'react';
import MediaPreview from './MediaPreview';
import MediaStatus from './MediaStatus';
import { mediaEnterpriseService } from '../../services/api';

export default function SmartMigrationWizard({
  media = {},
  onComplete,
  onCancel,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [step, setStep] = useState('replace'); // replace → validate → preview → confirm → done
  const [newUrl, setNewUrl] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const [error, setError] = useState(null);

  const mediaUrl = media.media_url || media.public_url || '';
  const mediaType = media.media_type || media.kind || '';
  const provider = media.provider_name || media.provider || '';
  const usages = Array.isArray(media.usages) ? media.usages : [];
  const usageCount = usages.length;

  // Step 2: Validate
  const handleValidate = useCallback(async () => {
    if (!newUrl.trim()) return;
    setValidating(true);
    setValidationError(null);
    setValidationResult(null);
    try {
      const res = await mediaEnterpriseService.inspectMedia({ url: newUrl });
      setValidationResult(res.data || res);
      setStep('preview');
    } catch (err) {
      setValidationError(err.response?.data?.error || err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [newUrl]);

  // Step 4: Confirm Update
  const handleConfirmUpdate = useCallback(async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await mediaEnterpriseService.smartReplace({
        media_id: media.id || media.media_id,
        old_url: mediaUrl,
        new_url: newUrl,
      });
      setUpdateResult(res.data || res);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  }, [media, mediaUrl, newUrl]);

  const handleReset = useCallback(() => {
    setStep('replace');
    setNewUrl('');
    setValidationResult(null);
    setValidationError(null);
    setUpdateResult(null);
    setError(null);
  }, []);

  return (
    <div className={`smw-container ${className}`}>
      {/* Header */}
      <div className="smw-header">
        <h3 className="smw-title">
          <i className="fas fa-exchange-alt" />
          {isHt ? 'Ranplase Medya' : 'Replace Media'}
        </h3>
        {step !== 'done' && onCancel && (
          <button type="button" className="smw-close" onClick={onCancel}>
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {/* Steps Indicator */}
      <div className="smw-steps">
        {[
          { id: 'replace', icon: 'fa-paste', label: isHt ? 'Nouvo URL' : 'New URL' },
          { id: 'validate', icon: 'fa-stethoscope', label: isHt ? 'Validasyon' : 'Validate' },
          { id: 'preview', icon: 'fa-eye', label: isHt ? 'Aperçu' : 'Preview' },
          { id: 'confirm', icon: 'fa-sync', label: isHt ? 'Konfime' : 'Confirm' },
        ].map((s, i) => {
          const stepIds = ['replace', 'validate', 'preview', 'confirm'];
          const currentIdx = stepIds.indexOf(step);
          const sIdx = stepIds.indexOf(s.id);
          const isDone = sIdx < currentIdx;
          const isCurrent = s.id === step;
          return (
            <div key={s.id} className={`smw-step ${isDone ? 'smw-step-done' : ''} ${isCurrent ? 'smw-step-current' : ''}`}>
              <div className="smw-step-circle">
                {isDone ? <i className="fas fa-check" /> : <i className={`fas ${s.icon}`} />}
              </div>
              <span className="smw-step-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Current Media Info */}
      {step !== 'done' && mediaUrl && (
        <div className="smw-current-media">
          <div className="smw-current-label">{isHt ? 'Medya aktyèl' : 'Current Media'}</div>
          <div className="smw-current-details">
            <span className="smw-current-badge">{provider || mediaType || 'Media'}</span>
            <code className="smw-current-url">{mediaUrl.slice(0, 80)}...</code>
            {usageCount > 0 && (
              <span className="smw-current-usage">
                <i className="fas fa-link" />
                {usageCount} {isHt ? 'referans' : 'references'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Step: Replace ───────────────────────────────────── */}
      {step === 'replace' && (
        <div className="smw-body">
          <p className="smw-instruction">
            {isHt
              ? 'Kole nouvo URL piblik la soti nan provider ou. Sistèm nan pral otomatikman detekte provider a epi verifye li.'
              : 'Paste the new public URL from your provider. The system will automatically detect the provider and validate it.'}
          </p>
          <div className="smw-field">
            <label className="smw-label">{isHt ? 'Nouvo URL' : 'New URL'}</label>
            <textarea
              className="smw-input"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              rows={2}
              autoFocus
            />
          </div>
          <div className="smw-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep('validate')}
              disabled={!newUrl.trim()}
            >
              {isHt ? 'Kontinye' : 'Continue'}
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Validate ──────────────────────────────────── */}
      {step === 'validate' && (
        <div className="smw-body">
          <p className="smw-instruction">
            {isHt
              ? 'Klike sou "Verifye" pou tcheke si URL la aksesib epi detekte provider a.'
              : 'Click "Validate" to check if the URL is accessible and detect the provider.'}
          </p>
          <div className="smw-url-display">
            <code>{newUrl}</code>
          </div>
          {validationError && (
            <div className="smw-error">
              <i className="fas fa-exclamation-circle" />
              {validationError}
            </div>
          )}
          <div className="smw-actions">
            <button type="button" className="btn-secondary" onClick={() => setStep('replace')}>
              <i className="fas fa-chevron-left" />
              {isHt ? 'Retou' : 'Back'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleValidate}
              disabled={validating}
            >
              {validating ? (
                <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap verifye...' : 'Validating...'}</>
              ) : (
                <><i className="fas fa-stethoscope" /> {isHt ? 'Verifye' : 'Validate'}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Preview ───────────────────────────────────── */}
      {step === 'preview' && validationResult && (
        <div className="smw-body">
          <p className="smw-instruction">
            {isHt
              ? 'Verifye ke nouvo medya a pwop. Si tout bagay bon, kontinye pou mete ajou tout referans yo.'
              : 'Verify the new media looks correct. If everything looks good, continue to update all references.'}
          </p>
          <div className="smw-preview">
            <MediaPreview data={validationResult} lang={lang} />
          </div>
          {validationResult.health_status && (
            <div className="smw-status">
              <MediaStatus status={validationResult.health_status} lang={lang} />
            </div>
          )}
          <div className="smw-actions">
            <button type="button" className="btn-secondary" onClick={() => setStep('validate')}>
              <i className="fas fa-chevron-left" />
              {isHt ? 'Retou' : 'Back'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep('confirm')}
            >
              {isHt ? 'Kontinye' : 'Continue'}
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Confirm ───────────────────────────────────── */}
      {step === 'confirm' && (
        <div className="smw-body">
          <div className="smw-confirm-warning">
            <i className="fas fa-exclamation-triangle" />
            <div>
              <strong>{isHt ? 'Atansyon!' : 'Warning!'}</strong>
              <p>
                {isHt
                  ? 'Sa pral ranplase URL la nan tout kote li itilize. Asire w nouvo URL la kòrèk.'
                  : 'This will replace the URL everywhere it is used. Make sure the new URL is correct.'}
              </p>
            </div>
          </div>
          {usageCount > 0 && (
            <div className="smw-usage-count">
              <i className="fas fa-link" />
              {isHt
                ? `Ap mete ajou ${usageCount} referans`
                : `Will update ${usageCount} reference(s)`}
            </div>
          )}
          <div className="smw-compare">
            <div className="smw-compare-item">
              <div className="smw-compare-label">{isHt ? 'Ansyen URL' : 'Old URL'}</div>
              <code className="smw-compare-url smw-compare-old">{mediaUrl.slice(0, 80)}</code>
            </div>
            <div className="smw-compare-arrow">
              <i className="fas fa-arrow-right" />
            </div>
            <div className="smw-compare-item">
              <div className="smw-compare-label">{isHt ? 'Nouvo URL' : 'New URL'}</div>
              <code className="smw-compare-url smw-compare-new">{newUrl.slice(0, 80)}</code>
            </div>
          </div>
          {error && (
            <div className="smw-error">
              <i className="fas fa-exclamation-circle" />
              {error}
            </div>
          )}
          <div className="smw-actions">
            <button type="button" className="btn-secondary" onClick={() => setStep('preview')}>
              <i className="fas fa-chevron-left" />
              {isHt ? 'Retou' : 'Back'}
            </button>
            <button
              type="button"
              className="smw-confirm-btn"
              onClick={handleConfirmUpdate}
              disabled={updating}
            >
              {updating ? (
                <><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap mete ajou...' : 'Updating...'}</>
              ) : (
                <><i className="fas fa-sync" /> {isHt ? 'Ranplase tout referans' : 'Replace all references'}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step: Done ──────────────────────────────────────── */}
      {step === 'done' && (
        <div className="smb-body">
          <div className="smw-success">
            <i className="fas fa-check-circle" />
            <h3>{isHt ? 'Siksè!' : 'Success!'}</h3>
            <p>
              {isHt
                ? 'URL la te ranplase avèk siksè nan tout referans yo. Pa gen lòt aksyon nesesè.'
                : 'The URL was successfully replaced in all references. No further action needed.'}
            </p>
            {updateResult && (
              <div className="smw-update-details">
                {updateResult.updated_count != null && (
                  <span className="smw-detail-badge">
                    <i className="fas fa-link" />
                    {updateResult.updated_count} {isHt ? 'referans mete ajou' : 'references updated'}
                  </span>
                )}
                {updateResult.failed_count > 0 && (
                  <span className="smw-detail-badge smw-detail-warn">
                    <i className="fas fa-exclamation-circle" />
                    {updateResult.failed_count} {isHt ? 'echèk' : 'failed'}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="smw-actions">
            {onComplete && (
              <button type="button" className="btn-primary" onClick={() => onComplete(updateResult)}>
                <i className="fas fa-check" />
                {isHt ? 'Fèmen' : 'Done'}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={handleReset}>
              <i className="fas fa-redo" />
              {isHt ? 'Ranplase yon lòt' : 'Replace another'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
