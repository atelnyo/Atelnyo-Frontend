/**
 * SmartWarning — Avètisman anvan efase yon medya.
 *
 * Montre konbyen kote medya a itilize epi avèti itilizatè a
 * ke tout referans yo pral disparèt.
 */
import React from 'react';
import LinkedContent from './LinkedContent';

export default function SmartWarning({
  open = false,
  media,
  usages = [],
  onConfirm,
  onCancel,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';

  if (!open || !media) return null;

  const usageCount = usages.length;
  const url = media.url || media.media_url || media.public_url || '';

  return (
    <div className="smart-warning-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="smart-warning-modal" role="alertdialog" aria-label={isHt ? 'Avètisman efasman' : 'Delete warning'}>
        <div className="smart-warning-header">
          <div className="smart-warning-icon">
            <i className="fas fa-exclamation-triangle" />
          </div>
          <h3 className="smart-warning-title">
            {isHt ? 'Atansyon!' : 'Warning!'}
          </h3>
        </div>

        <div className="smart-warning-body">
          <p className="smart-warning-desc">
            {isHt
              ? 'Medya sa itilize nan plizyè kote. Si ou retire referans sa a, tout seksyon sa yo pap montre medya ankò.'
              : 'This media is used in multiple places. If you remove this reference, all these sections will no longer show the media.'}
          </p>

          {usageCount > 0 && (
            <div className="smart-warning-count">
              <span className="smart-warning-count-badge">
                <i className="fas fa-link" />
                {usageCount} {isHt ? 'koneksyon' : 'connections'}
              </span>
            </div>
          )}

          <div className="smart-warning-details">
            <LinkedContent usages={usages} lang={lang} />
          </div>

          {url && (
            <div className="smart-warning-url">
              <span className="smart-warning-url-label">
                {isHt ? 'URL la' : 'The URL'}
              </span>
              <code className="smart-warning-url-value">{url}</code>
            </div>
          )}

          <p className="smart-warning-note">
            <i className="fas fa-info-circle" />
            {isHt
              ? 'Sa pa efase fichye orijinal la sou provider ou. Li sèlman retire referans nan atelnyo.'
              : 'This does NOT delete the original file from your provider. It only removes the reference in atelnyo.'}
          </p>
        </div>

        <div className="smart-warning-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <i className="fas fa-times" />
            {isHt ? 'Anile' : 'Cancel'}
          </button>
          <button type="button" className="smart-warning-delete-btn" onClick={onConfirm}>
            <i className="fas fa-trash" />
            {usageCount > 0
              ? (isHt ? 'Retire referans ak tout koneksyon' : 'Remove reference & all connections')
              : (isHt ? 'Retire referans' : 'Remove reference')}
          </button>
        </div>
      </div>
    </div>
  );
}
