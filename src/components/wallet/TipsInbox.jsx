/**
 * TipsInbox — Tips received and sent with amounts, senders, dates.
 *
 * Tabs: Received / Sent
 * Shows: sender/recipient avatar, amount, message, date, status
 */
import React, { useState, useCallback } from 'react';
import SendTipModal from '../studio/modals/SendTipModal';

function fmtCurrency(n) {
  if (n == null) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

export default function TipsInbox({
  tipsReceived = [],
  tipsSent = [],
  loading = false,
  onRefresh,
  lang = 'ht',
  className = '',
  currentUserId,
  showToast,
}) {
  const isHt = lang === 'ht';
  const [tab, setTab] = useState('received');
  const [showSendTip, setShowSendTip] = useState(false);
  const [sendTipTarget, setSendTipTarget] = useState('');

  const handleSendTipSuccess = useCallback(() => {
    setShowSendTip(false);
    setSendTipTarget('');
    onRefresh?.();
  }, [onRefresh]);

  const handleOpenSendTip = useCallback((e) => {
    e.preventDefault();
    if (!sendTipTarget.trim()) return;
    setShowSendTip(true);
  }, [sendTipTarget]);

  const items = tab === 'received' ? tipsReceived : tipsSent;
  const isEmpty = !items || items.length === 0;

  return (
    <div className={`wlt-tips ${className}`}>
      {/* Header */}
      <div className="wlt-tips-header">
        <h3 className="wlt-tips-title">
          <i className="fas fa-hand-holding-heart" />
          {isHt ? 'Tips' : 'Tips'}
        </h3>
        <div className="wlt-tips-actions">
          <form className="wlt-tips-send-form" onSubmit={handleOpenSendTip}>
            <input
              type="text"
              value={sendTipTarget}
              onChange={(e) => setSendTipTarget(e.target.value)}
              placeholder={isHt ? 'Username kreyatè...' : 'Creator username...'}
              disabled={!currentUserId}
            />
            <button type="submit" className="wlt-tips-send-btn" disabled={!currentUserId || !sendTipTarget.trim()}>
              <i className="fas fa-paper-plane" />
            </button>
          </form>
          {onRefresh && (
            <button type="button" className="wlt-refresh-btn" onClick={onRefresh} disabled={loading}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="wlt-tips-tabs">
        <button
          type="button"
          className={`wlt-tips-tab ${tab === 'received' ? 'wlt-tips-tab-active' : ''}`}
          onClick={() => setTab('received')}
        >
          <i className="fas fa-hand-holding-heart" />
          {isHt ? 'Resevwa' : 'Received'}
          {tipsReceived.length > 0 && <span className="wlt-tips-count">{tipsReceived.length}</span>}
        </button>
        <button
          type="button"
          className={`wlt-tips-tab ${tab === 'sent' ? 'wlt-tips-tab-active' : ''}`}
          onClick={() => setTab('sent')}
        >
          <i className="fas fa-paper-plane" />
          {isHt ? 'Voye' : 'Sent'}
          {tipsSent.length > 0 && <span className="wlt-tips-count">{tipsSent.length}</span>}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="wlt-loading"><i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap chaje...' : 'Loading...'}</div>
      )}

      {/* Empty */}
      {!loading && isEmpty && (
        <div className="wlt-empty">
          <i className={`fas ${tab === 'received' ? 'fa-hand-holding-heart' : 'fa-paper-plane'}`} />
          <h4>
            {tab === 'received'
              ? (isHt ? 'Pa gen tips resevwa' : 'No tips received')
              : (isHt ? 'Pa gen tips voye' : 'No tips sent')}
          </h4>
          <p>
            {tab === 'received'
              ? (isHt ? 'Lè yon moun voye w yon tip, li ap parèt isit la.' : 'When someone sends you a tip, it will appear here.')
              : (isHt ? 'Lè ou voye yon tip, li ap parèt isit la.' : 'When you send a tip, it will appear here.')}
          </p>
        </div>
      )}

      {/* List */}
      {!loading && !isEmpty && (
        <div className="wlt-tips-list">
          {items.map((tip, i) => (
            <div key={tip.id || i} className="wlt-tip-item">
              <div className="wlt-tip-avatar">
                {(tab === 'received' ? tip.tipper_username : tip.creator_username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="wlt-tip-body">
                <div className="wlt-tip-name">
                  {tab === 'received' ? tip.tipper_username : tip.creator_username || (isHt ? 'Anonim' : 'Anonymous')}
                </div>
                <div className="wlt-tip-meta">
                  {tip.message && <span className="wlt-tip-msg">"{tip.message}"</span>}
                  <span className="wlt-tip-date">{fmtRelative(tip.created_at)}</span>
                </div>
              </div>
              <div className="wlt-tip-amount">{fmtCurrency(tip.amount)}</div>
            </div>
          ))}
        </div>
      )}

      {showSendTip && (
        <SendTipModal
          lang={lang}
          showToast={showToast}
          onClose={handleSendTipSuccess}
          creatorId={sendTipTarget}
          creatorName={sendTipTarget}
        />
      )}
    </div>
  );
}
