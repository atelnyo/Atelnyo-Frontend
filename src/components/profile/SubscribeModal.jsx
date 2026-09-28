/**
 * src/components/profile/SubscribeModal.jsx
 *
 * Paid creator subscription modal (Phase 60). A visitor subscribes to a
 * creator's subscribers-only content for the monthly price the CREATOR
 * set on their profile (the backend always owns the amount — this modal
 * never sends a price).
 *
 * Flows:
 *   - wallet balance → POST creator-profiles/<slug>/subscribe/
 *   - insufficient balance → direct PayPal (server creates the order,
 *     the PayPal SDK renders its buttons, capture activates the period).
 *     The CREATOR pays the PayPal fee (2.9% + $0.30), shown transparently.
 *
 * Props:
 *   slug          — profile slug
 *   price         — monthly price string (e.g. "5.00") or null
 *   lang / t      — 'ht'|'en'|'es'|'fr' + translations object
 *   showToast     — toast helper
 *   onClose       — close the modal
 *   onOpenWallet  — navigate to /sheet/wallet (top-up link)
 *   onSubscribed  — callback after a successful subscription (refresh UI)
 *   user          — current user (null when anonymous)
 *   onAuthRequired— open the auth modal in place (anonymous flow)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { creatorProfileService, paymentConfigService } from '../../services/api';

// ─── PayPal SDK loader (injected once, capture intent) ─────────────────
// Mirrors ProfileContactModal / DepositModal — the SDK is loaded from the
// PayPal CDN with the publishable client id only.
let _paypalScriptPromise = null;

function loadPayPalScript(clientId, isSandbox) {
  if (window.paypal && window.paypal.Buttons) {
    return Promise.resolve(window.paypal);
  }
  if (_paypalScriptPromise) return _paypalScriptPromise;
  const base = isSandbox ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
  _paypalScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${base}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      _paypalScriptPromise = null;
      reject(new Error('PayPal SDK failed to load'));
    };
    document.body.appendChild(script);
  });
  return _paypalScriptPromise;
}

export default function SubscribeModal({
  slug,
  price,
  lang = 'en',
  t = {},
  showToast,
  onClose,
  onOpenWallet,
  onSubscribed,
  user,
  onAuthRequired,
}) {
  const isHt = lang === 'ht';

  const [phase, setPhase] = useState('idle'); // idle | paying | success | error
  const [error, setError] = useState(null);
  const [needFunds, setNeedFunds] = useState(false);
  // Direct PayPal state: idle → loading (SDK + order) → ready → processing
  const [ppPhase, setPpPhase] = useState('idle');
  const [ppOrder, setPpOrder] = useState(null);
  const [paypal, setPaypal] = useState(null);
  const [periodEnd, setPeriodEnd] = useState(null);
  const ppContainerRef = useRef(null);
  const ppProcessingRef = useRef(false);
  const pendingSubscribeRef = useRef(false);

  const priceDisplay = price ? `$${price}` : '';
  const title = t.profile_subscribe_title || (isHt
    ? 'Abòne w nan kontni eksklizif'
    : 'Subscribe to exclusive content');
  const cancelLabel = t.profile_contact_cancel || (isHt ? 'Anile' : 'Cancel');

  // Anonymous visitor pressed Subscribe → open auth in place; after
  // sign-in the subscribe fires automatically (they stay on this page).
  const performSubscribe = useCallback(async () => {
    if (!user) return;
    setPhase('paying');
    setError(null);
    try {
      const res = await creatorProfileService.subscribeWallet(slug);
      const data = res?.data;
      setPeriodEnd(data?.period_end || null);
      setPhase('success');
      showToast?.(
        t.profile_subscribe_success || (isHt ? 'Abònman an aktive! 🎉' : 'Subscription active! 🎉'),
        'check-circle',
      );
      onSubscribed?.(data);
    } catch (err) {
      if (err?.response?.status === 402) {
        // Insufficient wallet balance → offer direct PayPal right here.
        setNeedFunds(true);
        setPhase('idle');
        setError(null);
        return;
      }
      setPhase('error');
      setError(err?.response?.data?.detail || err?.response?.data?.error || err?.message || (isHt
        ? 'Abònman an echwe. Tanpri eseye ankò.'
        : 'Subscription failed. Please try again.'));
    }
  }, [user, slug, t, isHt, showToast, onSubscribed]);

  useEffect(() => {
    if (user && pendingSubscribeRef.current) {
      pendingSubscribeRef.current = false;
      performSubscribe();
    }
  }, [user, performSubscribe]);

  const handleSubscribe = () => {
    if (!user) {
      pendingSubscribeRef.current = true;
      onAuthRequired?.();
      return;
    }
    performSubscribe();
  };

  // ── Direct PayPal subscription ──────────────────────────────────────
  const startPayPalFlow = useCallback(async () => {
    if (!user) return;
    setPpPhase('loading');
    setError(null);
    try {
      const config = await paymentConfigService.config();
      const cfgData = config?.data;
      if (!cfgData?.configured || !cfgData?.client_id) {
        throw new Error(t.profile_tip_paypal_unavailable || (isHt
          ? 'PayPal poko disponib kounye a.'
          : 'PayPal is not available right now.'));
      }
      const pp = await loadPayPalScript(cfgData.client_id, cfgData.sandbox);
      setPaypal(pp);
      const res = await creatorProfileService.subscriptionPaypalOrder(slug);
      const order = res?.data;
      if (!order?.paypal_order_id) throw new Error('no order');
      setPpOrder(order);
      setPpPhase('ready');
    } catch (err) {
      setPpPhase('failed');
      setError(err?.response?.data?.error || err?.message || (isHt
        ? 'Pa t kapab kòmanse peman an.'
        : 'Could not start the payment.'));
    }
  }, [user, slug, t, isHt]);

  useEffect(() => {
    if (ppPhase !== 'ready' || !paypal || !ppOrder?.paypal_order_id) return;
    const container = ppContainerRef.current;
    if (!container) return;
    if (container.dataset.renderedFor === ppOrder.paypal_order_id) return;

    container.innerHTML = '';
    const buttons = paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
      createOrder: () => ppOrder.paypal_order_id,
      onApprove: async () => {
        if (ppProcessingRef.current) return;
        ppProcessingRef.current = true;
        setPpPhase('processing');
        try {
          const res = await creatorProfileService.subscriptionPaypalCapture(
            slug, ppOrder.paypal_order_id,
          );
          const data = res?.data;
          setPeriodEnd(data?.period_end || null);
          setPhase('success');
          showToast?.(
            t.profile_subscribe_success || (isHt ? 'Abònman an aktive! 🎉' : 'Subscription active! 🎉'),
            'check-circle',
          );
          onSubscribed?.(data);
        } catch (err) {
          setPpPhase('failed');
          setError(err?.response?.data?.error || err?.message || (isHt
            ? 'Peman echwe. Tanpri eseye ankò.'
            : 'Payment failed. Please try again.'));
        } finally {
          ppProcessingRef.current = false;
        }
      },
      onCancel: () => setPpPhase('idle'),
      onError: () => {
        setPpPhase('failed');
        setError(t.profile_tip_paypal_unavailable || (isHt
          ? 'PayPal poko disponib kounye a.'
          : 'PayPal is not available right now.'));
      },
    });
    buttons.render(container).then(() => {
      if (container) container.dataset.renderedFor = ppOrder.paypal_order_id;
    }).catch(() => {
      setPpPhase('failed');
      setError(t.profile_tip_paypal_unavailable || (isHt
        ? 'PayPal poko disponib kounye a.'
        : 'PayPal is not available right now.'));
    });
    return () => { try { container.innerHTML = ''; } catch (_) {} };
  }, [ppPhase, paypal, ppOrder, slug, t, showToast, onSubscribed, isHt]);

  const handleClose = () => {
    if (phase === 'paying' || ppPhase === 'processing') return;
    onClose?.();
  };

  return (
    <div className="csp-modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="csp-modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="csp-modal-close" onClick={handleClose} aria-label={cancelLabel}>
          <i className="fas fa-times" aria-hidden="true" />
        </button>

        <div className="csp-modal-body" style={{ padding: '26px 22px 22px' }}>
          <div className="csp-modal-type-badge">
            <i className="fas fa-star" aria-hidden="true" />
            {isHt ? 'Abònman' : 'Subscription'}
          </div>
          <h2 className="csp-modal-title" style={{ padding: '10px 0 4px', fontSize: '1rem' }}>
            {title}
          </h2>

          {phase === 'success' ? (
            <div className="csp-subscribe-success">
              <i className="fas fa-check-circle" aria-hidden="true" />
              <p>{t.profile_subscribe_success_body || (isHt
                ? 'Ou gen aksè a tout kontni abonè kounye a. Mèsi pou sipò ou!'
                : 'You now have access to all subscribers-only content. Thanks for your support!')}</p>
              {periodEnd && (
                <p className="csp-subscribe-period">
                  {t.profile_subscribe_period_end || (isHt
                    ? 'Abònman an fini:'
                    : 'Subscription ends:')}{' '}
                  {new Date(periodEnd).toLocaleDateString()}
                </p>
              )}
              <button
                type="button"
                className="csp-modal-btn csp-modal-btn--primary"
                onClick={onClose}
              >
                {t.profile_subscribe_done || (isHt ? 'Fèmen' : 'Done')}
              </button>
            </div>
          ) : (
            <div className="csp-subscribe-plan">
              <div className="csp-subscribe-price">
                <span className="csp-subscribe-price-amount">{priceDisplay}</span>
                <span className="csp-subscribe-price-period">
                  {t.profile_subscribe_per_month || (isHt ? '/mwa' : '/month')}
                </span>
              </div>
              <p className="csp-subscribe-blurb">
                {t.profile_subscribe_blurb || (isHt
                  ? 'Jwenn aksè a tout kontni abonè sèlman pandan 30 jou.'
                  : 'Get access to all subscribers-only content for 30 days.')}
              </p>

              {error && (
                <div className="csp-contact-error" role="alert">
                  <i className="fas fa-exclamation-triangle" aria-hidden="true" /> {error}
                </div>
              )}

              <div className="csp-modal-actions" style={{ marginTop: 18, borderTop: 'none', paddingTop: 0 }}>
                {needFunds ? (
                  ppPhase === 'idle' ? (
                    <button
                      type="button"
                      className="csp-modal-btn csp-modal-btn--primary"
                      onClick={startPayPalFlow}
                      disabled={ppPhase === 'loading'}
                    >
                      <i className="fab fa-paypal" aria-hidden="true" /> {t.profile_tip_paypal || (isHt ? 'Paye ak PayPal' : 'Pay with PayPal')}
                    </button>
                  ) : ppPhase === 'ready' || ppPhase === 'processing' ? (
                    <div className="csp-tip-paypal-box">
                      <div className="csp-tip-paypal-note">
                        <i className="fas fa-info-circle" aria-hidden="true" />
                        {ppOrder
                          ? (t.profile_tip_fee_note
                            ? t.profile_tip_fee_note.replace('{net}', `$${ppOrder.net_amount}`).replace('{fee}', `$${ppOrder.fee}`)
                            : (isHt
                              ? `Kreyatè a pral resevwa $${ppOrder.net_amount} (frè PayPal $${ppOrder.fee} dedui).`
                              : `The creator will receive $${ppOrder.net_amount} (PayPal fee $${ppOrder.fee} deducted).`))
                          : ''}
                      </div>
                      <div ref={ppContainerRef} className="csp-tip-paypal-buttons" />
                      {ppPhase === 'processing' && (
                        <div className="csp-tip-paypal-processing">
                          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t.profile_contact_sending || (isHt ? 'Ap voye...' : 'Sending...')}
                        </div>
                      )}
                    </div>
                  ) : ppPhase === 'failed' ? (
                    <button
                      type="button"
                      className="csp-modal-btn csp-modal-btn--primary"
                      onClick={startPayPalFlow}
                    >
                      <i className="fas fa-rotate-right" aria-hidden="true" /> {isHt ? 'Eseye ankò' : 'Retry'}
                    </button>
                  ) : (
                    <div className="csp-tip-paypal-loading">
                      <i className="fas fa-spinner fa-spin" aria-hidden="true" /> {isHt ? 'Ap prepare PayPal...' : 'Preparing PayPal...'}
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className="csp-modal-btn csp-modal-btn--primary"
                    onClick={handleSubscribe}
                    disabled={phase === 'paying'}
                  >
                    {phase === 'paying'
                      ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t.profile_contact_sending || (isHt ? 'Ap voye...' : 'Sending...')}</>
                      : <><i className="fas fa-star" aria-hidden="true" /> {t.profile_subscribe_btn || (isHt ? 'Abòne kounye a' : 'Subscribe now')}</>}
                  </button>
                )}
                {needFunds && (
                  <button
                    type="button"
                    className="csp-modal-btn csp-modal-btn--secondary csp-tip-wallet-link"
                    onClick={() => { handleClose(); onOpenWallet?.(); }}
                  >
                    <i className="fas fa-wallet" aria-hidden="true" /> {t.profile_tip_topup || (isHt ? 'Oubyen ranpli bous la' : 'Or top up wallet')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
