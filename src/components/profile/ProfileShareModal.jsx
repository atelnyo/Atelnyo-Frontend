import React, { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

/**
 * ShareModal — modal dialog for sharing the creator profile URL.
 * Kreyol + English copy. Uses navigator.clipboard for copy. Stops overlay click
 * propagation so the modal doesn't dismiss when the user clicks inside.
 * Includes QR code generation for easy mobile sharing.
 *
 * @param {{ url: string, onClose: ()=>void, lang: string }} props
 */
export default function ShareModal({ url, onClose, lang }) {
  const [copiedModal, setCopiedModal] = useState(false);
  const canvasRef = useRef(null);

  // ─── Generate QR code on mount ─────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: 180,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    }, (err) => {
      if (err) console.error('[QR] generate error:', err);
    });
  }, [url]);

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedModal(true);
        setTimeout(() => setCopiedModal(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="csp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share profile">
      <div className="csp-modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{lang === 'ht' ? 'Pataje pwofil' : 'Share Profile'}</h3>

        {/* ─── QR Code ──────────────────────────────────────── */}
        <div className="csp-share-qr">
          <canvas ref={canvasRef} aria-hidden="true" />
          <p className="csp-share-qr-label">
            {lang === 'ht'
              ? 'Scanne pou ouvri pwofil la'
              : 'Scan to open profile'}
          </p>
        </div>

        {/* ─── URL + Copy ──────────────────────────────────── */}
        <div className="csp-modal-input-row">
          <input type="text" readOnly value={url} aria-label="Profile URL" onClick={(e) => e.target.select()} />
          <button type="button" onClick={handleCopy}>
            {copiedModal ? <i className="fas fa-check" /> : (lang === 'ht' ? 'Kopye' : 'Copy')}
          </button>
        </div>

        <button type="button" onClick={onClose} style={{
          width: '100%', padding: '8px', border: '1px solid var(--csp-border)',
          background: 'transparent', borderRadius: 8, fontSize: '0.72rem', cursor: 'pointer',
          color: 'var(--csp-text-secondary)', fontWeight: 500,
        }}>
          {lang === 'ht' ? 'Fèmen' : 'Close'}
        </button>
      </div>
    </div>
  );
}
