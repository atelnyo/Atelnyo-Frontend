/**
 * src/components/studio/modals/SendTipModal.jsx
 *
 * Modal for sending a tip to a creator from the wallet.
 * Backed by POST /api/tips/send/.
 */
import React, { useState, useCallback } from 'react';
import api, { walletService } from '../../../services/api';

const MIN_TIP = 0.50;

export default function SendTipModal({ lang = 'ht', showToast, onClose, creatorId, creatorName }) {
  const isHt = lang === 'ht';
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed < MIN_TIP) {
      setError(isHt ? `Tip minimòm se $${MIN_TIP.toFixed(2)}.` : `Minimum tip is $${MIN_TIP.toFixed(2)}.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await walletService.sendTip({
        creator_id: Number(creatorId),
        amount: parsed,
        message: message.trim(),
      });
      showToast?.(isHt ? '✅ Tip voye!' : '✅ Tip sent!');
      onClose?.(res.data);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || (isHt ? 'Erè.' : 'Error.');
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  }, [amount, message, creatorId, showToast, onClose, isHt]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={isHt ? 'Voye Tip' : 'Send Tip'}>
        <div className="modal-header">
          <h3>
            <i className="fas fa-hand-holding-heart" aria-hidden="true" />
            {isHt ? 'Voye Tip' : 'Send Tip'}
            {creatorName ? ` · @${creatorName}` : ''}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={isHt ? 'Fèmen' : 'Close'}>
            <i className="fas fa-times" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="modal-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="tip-amount">{isHt ? 'Kantite (USD)' : 'Amount (USD)'}</label>
            <div className="input-with-prefix">
              <span className="input-prefix">$</span>
              <input
                id="tip-amount"
                type="number"
                min={MIN_TIP}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${MIN_TIP.toFixed(2)}`}
                required
                disabled={submitting}
              />
            </div>
            <span className="form-hint">{isHt ? `Tip minimòm $${MIN_TIP.toFixed(2)}` : `Minimum tip $${MIN_TIP.toFixed(2)}`}</span>
          </div>
          <div className="form-group">
            <label htmlFor="tip-message">{isHt ? 'Mesaj (opsyonèl)' : 'Message (optional)'}</label>
            <textarea
              id="tip-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isHt ? 'Mesaj ou...' : 'Your message...'}
              rows={3}
              maxLength={280}
              disabled={submitting}
            />
            <span className="form-hint">{isHt ? 'Opsyonèl, maks 280 karaktè' : 'Optional, max 280 chars'}</span>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              {isHt ? 'Anile' : 'Cancel'}
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? (isHt ? 'Ap voye...' : 'Sending...')
                : (isHt ? 'Voye Tip' : 'Send Tip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
