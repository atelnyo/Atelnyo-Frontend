/**
 * src/components/business/BusinessMyOrdersPage.jsx
 *
 * Phase Business — the CUSTOMER-side order tracker.
 *
 * Lists every order the signed-in account has placed across business
 * profiles (the counterpart to the owner's workspace Orders tab).
 * Customers can watch their lead status, pay unpaid orders straight
 * from their Wallet (when the business has Seller active), and cancel
 * a ``new`` + ``unpaid`` order themselves.
 *
 * Route: /business/orders/mine  (auth-gated in App.jsx)
 *
 * Data flow
 * ---------
 *   GET  /api/business/orders/mine/            — my orders (all shops)
 *   POST /api/business/orders/<id>/cancel/     — cancel (new + unpaid)
 *   POST /api/business/orders/<id>/pay/        — pay from Wallet
 *
 * Entry points: the "Kòmand mwen" quick-nav card in Mwen (tab Mwen)
 * and the "Wè kòmand mwen yo" link in the public page's order modal.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SHEETS } from '../../routes/sheets';
import { historyBack } from '../../utils/history';
import { translations } from '../../data/translations';
import { businessOrderService } from '../../services/api';
import '../../styles/business.css';

const STATUS_FLOW_LABEL = {
  new: { ht: 'Nouvo', en: 'New' },
  contacted: { ht: 'Kontakte', en: 'Contacted' },
  fulfilled: { ht: 'Ranpli', en: 'Fulfilled' },
  cancelled: { ht: 'Anile', en: 'Cancelled' },
};

const PAY_LABEL = {
  unpaid: { ht: 'Pa peye', en: 'Unpaid' },
  paid: { ht: 'Peye', en: 'Paid' },
  refunded: { ht: 'Rembouse', en: 'Refunded' },
};

function payColor(paymentStatus) {
  if (paymentStatus === 'paid') return '#34d399';
  if (paymentStatus === 'refunded') return '#94a3b8';
  return '#fbbf24';
}

function money(n, lang) {
  return Number(n ?? 0).toLocaleString(lang === 'ht' ? 'fr-HT' : 'en-US', {
    minimumFractionDigits: 2,
  });
}

export default function BusinessMyOrdersPage({ lang = 'ht', showToast }) {
  const navigate = useNavigate();
  const t = translations[lang] || translations.en || {};
  const isHt = lang === 'ht';

  const [orders, setOrders] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Phase 6b — review modal state.
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = async () => {
    setOrders(null);
    try {
      const res = await businessOrderService.mine();
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setOrders(data);
    } catch {
      setOrders([]);
    }
  };

  useEffect(() => {
    // load() resets the loading shape synchronously on entry — the
    // same intentional pattern as the rest of the codebase (see
    // CheckoutModal.jsx / Mwen.jsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const runCancel = async (order) => {
    if (!window.confirm(
      isHt
        ? `Anile kòmand #${order.id} (${order.item_name})?`
        : `Cancel order #${order.id} (${order.item_name})?`,
    )) return;
    setBusyId(`cancel_${order.id}`);
    try {
      const res = await businessOrderService.cancel(order.id);
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) {
        setOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      }
      showToast?.(isHt ? 'Kòmand la anile.' : 'Order cancelled.', 'check-circle');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t ka anile kòmand la.' : 'Could not cancel the order.'),
        'circle-exclamation',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runPay = async (order) => {
    if (!window.confirm(
      isHt
        ? `Peye kòmand #${order.id} (${order.item_name}) ak Wallet ou? Total: ${money(order.total, lang)} ${order.currency}.`
        : `Pay order #${order.id} (${order.item_name}) with your Wallet? Total: ${money(order.total, lang)} ${order.currency}.`,
    )) return;
    setBusyId(`pay_${order.id}`);
    try {
      const res = await businessOrderService.pay(order.id);
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) {
        setOrders((prev) => prev.map((o) => (o.id === data.id ? data : o)));
      }
      showToast?.(isHt ? 'Peman an reyisi!' : 'Payment successful!', 'check-circle');
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 402) {
        showToast?.(
          isHt
            ? 'Balans Wallet ou pa sifi. Mete lajan nan Wallet ou anvan ou peye.'
            : 'Insufficient wallet balance. Top up your wallet before paying.',
          'circle-exclamation',
        );
      } else {
        showToast?.(detail || (isHt ? 'Peman an pa t mache.' : 'Payment failed.'), 'circle-exclamation');
      }
    } finally {
      setBusyId(null);
    }
  };

  const openShop = (order) => {
    if (order?.business_profile_slug) {
      navigate(SHEETS.BUSINESS_PUBLIC_URL(order.business_profile_slug));
    }
  };

  // ─── Phase 6b — review a fulfilled order ───────────────────────────
  const openReview = (order) => {
    setReviewOrder(order);
    setReviewRating(0);
    setReviewComment('');
  };

  const closeReview = () => {
    if (reviewBusy) return;
    setReviewOrder(null);
    setReviewRating(0);
    setReviewComment('');
  };

  const submitReview = async () => {
    if (!reviewOrder || reviewBusy) return;
    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      showToast?.(
        isHt ? 'Chwazi yon nòt 1 a 5.' : 'Choose a rating from 1 to 5.',
        'circle-exclamation',
      );
      return;
    }
    setReviewBusy(true);
    try {
      const res = await businessOrderService.review(reviewOrder.id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) {
        setOrders((prev) => prev.map((o) => (o.id === reviewOrder.id ? { ...o, reviewed: true } : o)));
      }
      showToast?.(isHt ? '✅ Revizyon ou voye! Mèsi.' : '✅ Review submitted! Thank you.', 'check-circle');
      setReviewOrder(null);
      setReviewRating(0);
      setReviewComment('');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t ka voye revizyon an.' : 'Could not submit the review.'),
        'circle-exclamation',
      );
    } finally {
      setReviewBusy(false);
    }
  };

  // Cold deep-link safe: only history-back when there IS history,
  // otherwise land on the root surface. history.state.idx based —
  // history.length is unreliable on fresh tabs (length is already 2 on
  // a direct deep-link, which would navigate to about:blank).
  const goBack = () => historyBack(navigate);

  return (
    <div className="biz-hub biz-my-orders" data-testid="business-my-orders">
      <div className="biz-hub-hero">
        <div className="biz-hub-badge"><i className="fas fa-receipt" aria-hidden="true" /></div>
        <h1 className="biz-hub-title">
          {t?.business_my_orders_title || (isHt ? 'Kòmand mwen' : 'My Orders')}
        </h1>
        <p className="biz-hub-hint">
          {t?.business_my_orders_hint || (isHt
            ? 'Swiv kòmand ou yo nan tout biznis — peye ak Wallet ou oswa anile yon kòmand ki poko peye.'
            : 'Track your orders across businesses — pay with your Wallet or cancel an unpaid order.')}
        </p>
        <button
          type="button"
          className="biz-btn biz-btn-ghost biz-hub-create-cta"
          onClick={goBack}
          data-testid="business-my-orders-back"
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
          {t?.business_public_back || (isHt ? 'Retounen' : 'Back')}
        </button>
      </div>

      {orders === null ? (
        <div className="biz-hub-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      ) : orders.length === 0 ? (
        <div className="biz-hub-empty">
          <i className="fas fa-receipt" aria-hidden="true" />
          <h3>{t?.business_my_orders_empty || (isHt ? 'Ou poko gen kòmand' : 'No orders yet')}</h3>
          <p>{isHt
            ? 'Lè w kòmande yon atik sou paj piblik yon biznis, li ap parèt isit la.'
            : 'When you order an item on a business public page, it will appear here.'}</p>
        </div>
      ) : (
        <div className="biz-orders-list" style={{ maxWidth: 720, margin: '0 auto' }}>
          {orders.map((order) => {
            const pc = payColor(order.payment_status);
            const canCancel = order.status === 'new' && order.payment_status === 'unpaid';
            const canPay = order.payment_status === 'unpaid' && order.payable;
            const canReview = order.status === 'fulfilled' && !order.reviewed;
            const reviewed = order.status === 'fulfilled' && order.reviewed;
            return (
              <div className="biz-order-card" key={order.id} data-testid="business-my-order-item">
                <div className="biz-order-main">
                  <div className="biz-order-title-row">
                    <span className="biz-order-name">{order.item_name}</span>
                    <span
                      className="biz-status-pill"
                      style={{
                        background: `${pc}1f`,
                        color: pc,
                        border: `1px solid ${pc}55`,
                      }}
                    >
                      {PAY_LABEL[order.payment_status]?.[isHt ? 'ht' : 'en'] || order.payment_status}
                    </span>
                  </div>
                  <p className="biz-order-meta">
                    <i className="fas fa-store" aria-hidden="true" />{' '}
                    {order.business_profile_name || `#${order.business_profile}`}
                    {' · '}<i className="fas fa-cubes" aria-hidden="true" /> {order.quantity}×{' '}
                    {money(order.item_price, lang)} {order.currency}
                    {' · '}<strong>{money(order.total, lang)} {order.currency}</strong>
                    {' · '}
                    <span className={`biz-order-lead biz-order-lead-${order.status}`}>
                      {STATUS_FLOW_LABEL[order.status]?.[isHt ? 'ht' : 'en'] || order.status}
                    </span>
                  </p>
                  {order.note && <p className="biz-order-note">“{order.note}”</p>}
                </div>

                <div className="biz-order-actions">
                  {canPay && (
                    <button
                      type="button"
                      className="biz-btn biz-btn-primary biz-btn-sm"
                      onClick={() => runPay(order)}
                      disabled={busyId === `pay_${order.id}`}
                      data-testid="business-my-order-pay"
                    >
                      <i className={`fas ${busyId === `pay_${order.id}` ? 'fa-spinner fa-spin' : 'fa-wallet'}`} aria-hidden="true" />
                      {t?.business_order_pay || (isHt ? 'Peye ak Wallet' : 'Pay with Wallet')}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      className="biz-btn biz-btn-danger biz-btn-sm"
                      onClick={() => runCancel(order)}
                      disabled={busyId === `cancel_${order.id}`}
                      data-testid="business-my-order-cancel"
                    >
                      <i className={`fas ${busyId === `cancel_${order.id}` ? 'fa-spinner fa-spin' : 'fa-xmark'}`} aria-hidden="true" />
                      {isHt ? 'Anile' : 'Cancel'}
                    </button>
                  )}
                  {canReview && (
                    <button
                      type="button"
                      className="biz-btn biz-btn-ghost biz-btn-sm biz-review-cta"
                      onClick={() => openReview(order)}
                      data-testid="business-my-order-review"
                    >
                      <i className="fas fa-star" aria-hidden="true" />
                      {t?.business_review_cta || (isHt ? 'Kite yon revizyon' : 'Leave a review')}
                    </button>
                  )}
                  {reviewed && (
                    <span
                      className="biz-status-pill biz-review-done-pill"
                      style={{
                        background: '#f59e0b1f',
                        color: '#fbbf24',
                        border: '1px solid #f59e0b55',
                      }}
                      data-testid="business-my-order-reviewed"
                    >
                      <i className="fas fa-star" aria-hidden="true" />
                      {t?.business_review_done || (isHt ? 'Revize ✓' : 'Reviewed ✓')}
                    </span>
                  )}
                  {order.business_profile_slug && (
                    <button
                      type="button"
                      className="biz-btn biz-btn-ghost biz-btn-sm"
                      onClick={() => openShop(order)}
                      data-testid="business-my-order-shop"
                    >
                      <i className="fas fa-store" aria-hidden="true" />
                      {isHt ? 'Biznis la' : 'View shop'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Phase 6b — review modal ─────────────────────────────── */}
      {reviewOrder && (
        <div className="biz-modal-overlay" onClick={closeReview} data-testid="business-review-modal">
          <div className="biz-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="biz-modal-header">
              <h3 className="biz-modal-title">
                <i className="fas fa-star" aria-hidden="true" />
                {t?.business_review_title || (isHt ? 'Kite yon revizyon' : 'Leave a review')}
              </h3>
              <button type="button" className="biz-modal-close" onClick={closeReview} aria-label="Close">
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <p className="biz-modal-hint">
              {reviewOrder.item_name} · {reviewOrder.business_profile_name || `#${reviewOrder.business_profile}`}
            </p>
            <p className="biz-modal-hint">
              {t?.business_review_hint || (isHt
                ? 'Kòmand la ranpli — pataje eksperyans ou ak biznis la.'
                : 'Order fulfilled — share your experience with the business.')}
            </p>

            <div className="biz-form">
              <div className="biz-form-group">
                <label className="biz-form-label">
                  {t?.business_review_rating_label || (isHt ? 'Nòt ou' : 'Your rating')}
                </label>
                <div className="biz-review-stars" data-testid="business-review-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`biz-review-star${n <= reviewRating ? ' biz-review-star-on' : ''}`}
                      onClick={() => setReviewRating(n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      data-testid={`business-review-star-${n}`}
                    >
                      {/* The on/off state is styled by the parent button's
                          .biz-review-star-on class (amber fill) — same icon. */}
                      <i className="fas fa-star" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="biz-form-group">
                <label className="biz-form-label" htmlFor="biz-review-comment">
                  {t?.business_review_comment || (isHt ? 'Kòmantè (si gen)' : 'Comment (optional)')}
                </label>
                <textarea
                  id="biz-review-comment"
                  className="biz-form-input"
                  rows="3"
                  maxLength="2000"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  data-testid="business-review-comment"
                />
              </div>
              <div className="biz-form-actions">
                <button type="button" className="biz-btn biz-btn-ghost" onClick={closeReview} disabled={reviewBusy}>
                  {isHt ? 'Anile' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="biz-btn biz-btn-primary"
                  onClick={submitReview}
                  disabled={reviewBusy || !reviewRating}
                  data-testid="business-review-submit"
                >
                  <i className={`fas ${reviewBusy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
                  {t?.business_review_submit || (isHt ? 'Voye revizyon' : 'Submit review')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
