/**
 * ResourceBlock — §32-§33 Resource Block + Safety
 *
 * §32 — Resource Blocks may include:
 *   External links, Downloads, Reference materials, Templates, Useful documents
 *
 * §33 — Download and Resource Safety:
 *   - Do not assume all external URLs are safe
 *   - Open external resources intentionally (with confirmation)
 *   - Clearly indicate external destinations
 *   - Do not expose private resource URLs without authorization
 *
 * Block data:
 *   - title: string
 *   - description: string (optional)
 *   - resources: [{ title, url, type: 'link' | 'download' | 'template' }]
 *   - required: boolean (whether this block affects completion)
 */
import React, { useCallback, useState } from 'react';

const RESOURCE_TYPE_CONFIG = {
  link: { icon: 'fa-external-link-alt', label: { en: 'External Link', ht: 'Lyen Ekstèn' } },
  download: { icon: 'fa-download', label: { en: 'Download', ht: 'Telechaje' } },
  template: { icon: 'fa-file-word', label: { en: 'Template', ht: 'Modèl' } },
  document: { icon: 'fa-file-pdf', label: { en: 'Document', ht: 'Dokiman' } },
};

/**
 * Check if a URL is external (not same origin).
 * §33 — Clearly indicate external destinations.
 */
function isExternalUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * §33 — Validate URL scheme for safety.
 * Only allow http/https. Block javascript:, data:, file: etc.
 */
function isSafeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export default function ResourceBlock({ block, lang = 'ht', reportComplete, onComplete }) {
  const isHt = lang === 'ht';
  const [confirmedExternal, setConfirmedExternal] = useState(null); // URL waiting for confirmation

  const title = block?.title || (isHt ? 'Resous' : 'Resources');
  const description = block?.description || '';
  const resources = block?.resources || [];

  // §33 — Handle resource click with safety check
  const handleResourceClick = useCallback((resource) => {
    const { url, type } = resource;
    if (!url) return;

    // §33 — Validate URL safety
    if (!isSafeUrl(url)) {
      return; // Block unsafe URLs silently
    }

    const isExternal = isExternalUrl(url);

    // §33 — For external links, confirm with user
    if (isExternal && type !== 'download') {
      setConfirmedExternal({ url, title: resource.title, isExternal });
      return;
    }

    // §33 — Downloads open directly (but still external check)
    if (isExternal) {
      // §33 — Clearly indicate: "This will open an external site"
      setConfirmedExternal({ url, title: resource.title, isExternal, isDownload: true });
      return;
    }

    // Internal links: open directly
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleConfirmExternal = useCallback(() => {
    if (confirmedExternal) {
      window.open(confirmedExternal.url, '_blank', 'noopener,noreferrer');
      setConfirmedExternal(null);
      // Mark as viewed for completion
      reportComplete?.();
      onComplete?.({ resource: confirmedExternal.title });
    }
  }, [confirmedExternal, reportComplete, onComplete]);

  return (
    <div className="ls-question" role="region" aria-label={title}>
      {/* Header */}
      <div className="ls-question-header">
        <h3 className="ls-question-text">
          <i className="fas fa-link" aria-hidden="true" style={{ marginRight: 8, opacity: 0.6 }} />
          {title}
        </h3>
        {description && (
          <p className="ls-question-description">{description}</p>
        )}
      </div>

      {/* Resource list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {resources.map((resource, i) => {
          const config = RESOURCE_TYPE_CONFIG[resource.type] || RESOURCE_TYPE_CONFIG.link;
          const external = isExternalUrl(resource.url);

          return (
            <button
              key={i}
              type="button"
              className="ls-question-option"
              onClick={() => handleResourceClick(resource)}
              style={{ cursor: 'pointer' }}
            >
              <span className="ls-question-option-indicator">
                <i className={`fas ${config.icon}`} aria-hidden="true" />
              </span>
              <span className="ls-question-option-text" style={{ flex: 1, textAlign: 'left' }}>
                <strong>{resource.title || resource.url}</strong>
                {resource.description && (
                  <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {resource.description}
                  </span>
                )}
              </span>
              {/* §33 — Clearly indicate external destination */}
              {external && (
                <span style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-card-alt, #f1f5f9)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}>
                  <i className="fas fa-external-link-alt" aria-hidden="true" style={{ marginRight: 4 }} />
                  {isHt ? 'Ekstèn' : 'External'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* §33 — External link confirmation dialog */}
      {confirmedExternal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300,
          padding: 20,
        }}>
          <div style={{
            background: 'var(--surface-card, #fff)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <i className="fas fa-external-link-alt" style={{ fontSize: '1.5rem', color: 'var(--color-primary, #3b82f6)' }} aria-hidden="true" />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                {isHt ? 'Lyen ekstèn' : 'External link'}
              </h3>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {isHt
                ? 'Ou pral ale sou yon sit ekstèn. Atelnyo pa kontwole sa ki nan lyen sa a.'
                : 'You are about to visit an external site. Atelnyo does not control the content of external links.'}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
              <strong>{confirmedExternal.title || confirmedExternal.url}</strong>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ls-btn"
                onClick={() => setConfirmedExternal(null)}
              >
                {isHt ? 'Anile' : 'Cancel'}
              </button>
              <button
                type="button"
                className="ls-btn ls-btn--primary"
                onClick={handleConfirmExternal}
              >
                {isHt ? 'Continuer' : 'Continue'}
                <i className="fas fa-arrow-right" style={{ marginLeft: 6 }} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
