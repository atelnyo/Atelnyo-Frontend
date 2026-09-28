/**
 * CheckoutModal — unified payment surface.
 *
 * Provider-agnostic checkout UI following the design system. PayPal is the
 * PRIMARY provider (default, first, visually prominent); Stripe remains as
 * the SECONDARY provider.
 *
 * Flow (webhook-first confirmation):
 *   1. Open modal → create the payment server-side (authoritative amount):
 *        order   → POST /api/checkout/order/        (provider=paypal default)
 *        premium → POST /api/checkout/premium/      (PayPal Subscriptions)
 *        escrow  → POST /api/checkout/escrow/       (intent=AUTHORIZE)
 *   2. PayPal: load the JS SDK, render PayPal Buttons wired to the
 *      server-created order id; on approval POST /api/checkout/paypal/capture/
 *      which captures server-side. The PAYMENT.CAPTURE.COMPLETED webhook is
 *      the authoritative confirmation (idempotent).
 *   3. Stripe: create with provider='stripe', confirm with Stripe.js via the
 *      returned client_secret.
 *
 * The frontend NEVER: holds secret credentials, determines the amount, or
 * marks a payment paid without backend confirmation.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkoutService, marketplaceService, paymentConfigService } from '../services/api';
import { translations } from '../data/translations';
import { getAffiliateAttributionToken, clearAffiliateAttributionToken } from '../utils/affiliateAttribution';
import '../styles/checkout.css';

const LANG_FALLBACK = {
  title: 'Checkout',
  choose_method: 'Choose payment method',
  paypal_primary: 'Pay with Card or PayPal',
  paypal_primary_hint: 'Credit card, debit card, or PayPal account',
  stripe_secondary: 'Pay with Card',
  stripe_secondary_hint: 'Credit or debit card only',
  amount: 'Amount',
  processing: 'Processing payment…',
  creating: 'Preparing checkout…',
  success: 'Payment successful!',
  cancelled: 'Payment cancelled.',
  failed: 'Payment failed. Please try again.',
  paypal_unavailable: 'PayPal is not available right now.',
  stripe_unavailable: 'Stripe is not configured on this server.',
  login_required: 'Please log in to continue.',
  complete_subscription: 'Complete your payment',
  open_paypal: 'Continue to payment',
  waiting_activation: 'Your subscription activates automatically once payment is confirmed.',
  back: 'Back',
  cancel: 'Cancel',
  try_again: 'Try again',
  choose_plan: 'Choose a plan',
  select_milestone: 'Select a milestone to fund first.',
  missing_event: 'Missing event.',
  missing_order: 'Missing order.',
};

// ─── Affiliate attribution token ────────────────────────────────────────
// The /go/<code> redirect lands the visitor with #aff_token=<JWT> in the
// URL fragment. App.jsx captures it into sessionStorage on every route
// change (the fragment is dropped by SPA navigation), and this module's
// getAffiliateAttributionToken() reads it from storage at payment time —
// falling back to the hash for the no-navigation landing case. The token
// is cleared once the purchase completes so it can't mis-attribute a
// later, unrelated order.

// ─── PayPal SDK loader (injected once) ───────────────────────────────────
// ``intent`` must match the server-created order: 'capture' for regular
// purchases, 'authorize' for escrow (funds held until milestone approval).
let _paypalScriptPromise = null;
let _paypalScriptIntent = null;

function loadPayPalScript(clientId, isSandbox, intent = 'capture') {
  if (window.paypal && window.paypal.Buttons && _paypalScriptIntent === intent) {
    return Promise.resolve(window.paypal);
  }
  // Different intent → need a fresh SDK instance. Reset so the new script
  // is injected with the right query param.
  if (window.paypal && _paypalScriptIntent !== intent) {
    _paypalScriptPromise = null;
  }
  if (_paypalScriptPromise) {return _paypalScriptPromise;}
  _paypalScriptIntent = intent;
  const base = isSandbox ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
  _paypalScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${base}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=${intent}`;
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

// ─── i18n ────────────────────────────────────────────────────────────────
// ``KEY_MAP`` bridges this modal's short keys to the project's canonical
// ``checkout_*`` translation keys (src/data/translations.js, 4 languages).
// ``LANG_FALLBACK`` is the English safety net ONLY for keys the project
// dictionary doesn't carry yet (back / cancel / try_again / …).
const KEY_MAP = {
  title: 'checkout_title',
  choose_method: 'checkout_choose_method',
  paypal_primary: 'checkout_paypal',
  paypal_primary_hint: 'checkout_paypal_hint',
  stripe_secondary: 'checkout_stripe',
  stripe_secondary_hint: 'checkout_stripe_hint',
  amount: 'checkout_amount',
  processing: 'checkout_processing',
  creating: 'checkout_creating',
  success: 'checkout_success',
  cancelled: 'checkout_cancelled',
  failed: 'checkout_failed',
  paypal_unavailable: 'checkout_paypal_unavailable',
  stripe_unavailable: 'checkout_stripe_unavailable',
  login_required: 'checkout_login_required',
  complete_subscription: 'checkout_complete_subscription',
  open_paypal: 'checkout_open_paypal',
  waiting_activation: 'checkout_waiting_activation',
  pay_now: 'checkout_pay_now',
  primary: 'checkout_primary',
  secondary: 'checkout_secondary',
  back: 'checkout_back',
  cancel: 'checkout_cancel',
  try_again: 'checkout_try_again',
  select_milestone: 'checkout_select_milestone',
  missing_event: 'checkout_missing_event',
  missing_order: 'checkout_missing_order',
};

function tr(lang, key) {
  // Project i18n first (HT/EN/FR/ES) — matches every other component
  // (e.g. ``const t = translations[lang] || translations.ht || {}``).
  const map = (translations && translations[lang]) || translations?.ht || {};
  const dictKey = KEY_MAP[key] || key;
  const translated = map[dictKey];
  if (translated) {return translated;}
  // English safety net for keys missing from the dictionary.
  return LANG_FALLBACK[key] || key;
}

// ─── State machine helper ────────────────────────────────────────────────
const PHASES = {
  idle: 'idle',
  creating: 'creating',
  ready: 'ready',        // PayPal buttons rendered / Stripe form shown
  processing: 'processing',
  success: 'success',
  cancelled: 'cancelled',
  failed: 'failed',
};

export default function CheckoutModal({
  isOpen,
  onClose,
  type = 'order',          // 'order' | 'premium' | 'escrow'
  meta = {},
  lang = 'ht',
  user = null,
  onAuthRequired,
  showToast,
  onSuccess,               // optional callback fired when payment succeeds
}) {
  const [phase, setPhase] = useState(PHASES.idle);
  const [provider, setProvider] = useState('paypal'); // PRIMARY
  const [errorMsg, setErrorMsg] = useState('');
  const [payment, setPayment] = useState(null);        // server-created payment payload
  const [ppConfig, setPpConfig] = useState(null);
  const [paypal, setPaypal] = useState(null);
  const [stripeReady, setStripeReady] = useState(false);
  const buttonContainerRef = useRef(null);
  const cardElementRef = useRef(null);
  const stripeRef = useRef(null);
  const processingRef = useRef(false);

  const amount = meta?.amount ?? meta?.price ?? 0;
  const plan = meta?.plan || 'monthly';

  const t = useCallback((k) => tr(lang, k), [lang]);

  // ── Boot: fetch safe config ───────────────────────────────────────────
  const bootPaypal = useCallback(async () => {
    const config = await paymentConfigService.config();
    setPpConfig(config?.data || null);
    if (!config?.data?.configured || !config?.data?.client_id) {
      return false;
    }
    try {
      // Escrow orders are created with intent=AUTHORIZE server-side, so
      // the SDK must load with intent=authorize to match.
      const sdkIntent = type === 'escrow' ? 'authorize' : 'capture';
      const pp = await loadPayPalScript(config.data.client_id, config.data.sandbox, sdkIntent);
      setPaypal(pp);
      return true;
    } catch (err) {
      setErrorMsg(t('paypal_unavailable'));
      return false;
    }
  }, [t, type]);

  // ── Create the payment server-side ────────────────────────────────────
  // ``providerParam`` is passed explicitly (defaults to the state value)
  // so switching providers never creates the payment with a stale value.
  const createPayment = useCallback(async (providerParam) => {
    const activeProvider = providerParam || provider;
    if (!user) {
      onAuthRequired?.();
      onClose?.();
      return null;
    }
    setPhase(PHASES.creating);
    setErrorMsg('');
    try {
      let resp;
      if (type === 'premium') {
        resp = await checkoutService.premium(plan, activeProvider);
      } else if (type === 'event') {
        // Paid community event ticket — creates a RESERVED ticket server-
        // side; the capture/webhook confirms it on payment success.
        if (!meta?.event_id) {
          setPhase(PHASES.failed);
          setErrorMsg(t('missing_event'));
          return null;
        }
        resp = await checkoutService.eventTicket(meta.event_id, activeProvider);
      } else if (type === 'escrow') {
        if (!meta?.milestone_id) {
          setPhase(PHASES.failed);
          setErrorMsg(t('select_milestone'));
          return null;
        }
        resp = await checkoutService.escrow(meta.milestone_id, activeProvider);
      } else {
        // Resolve the order id: the caller may pass product_id (from a
        // product card) or an existing order_id. When only a product is
        // given, create a PENDING order server-side first (hold_payment)
        // so the checkout can settle it with the authoritative amount.
        let orderId = meta?.order_id;
        if (!orderId && meta?.product_id) {
          const orderResp = await marketplaceService.createOrder([
            {
              product_id: meta.product_id,
              quantity: meta.quantity || 1,
              // Real variant selection (price/stock applied server-side).
              variant_id: meta.variant_id,
            },
          ]);
          orderId = orderResp?.data?.id;
        }
        if (!orderId) {
          setPhase(PHASES.failed);
          setErrorMsg(t('missing_order'));
          return null;
        }
        const affToken = getAffiliateAttributionToken();
        resp = await checkoutService.createOrder(orderId, activeProvider, affToken);
      }
      setPayment(resp.data);
      setPhase(PHASES.ready);
      return resp.data;
    } catch (err) {
      setPhase(PHASES.failed);
      setErrorMsg(err?.response?.data?.error || t('failed'));
      return null;
    }
  }, [type, provider, plan, meta, user, t, onClose, onAuthRequired]);

  // Keep a ref to the latest createPayment so the open-effect below can
  // depend ONLY on [isOpen] — otherwise a provider switch (which changes
  // createPayment's identity) would re-fire this effect and create the
  // payment twice (duplicate pending orders for product_id checkouts).
  // The ref is synced inside an effect (not during render) to satisfy the
  // react-hooks/refs rule; effects run in declaration order, so the sync
  // effect below runs BEFORE the open-effect on the render where isOpen
  // flips true.
  const createPaymentRef = useRef(createPayment);
  useEffect(() => {
    createPaymentRef.current = createPayment;
  });

  // Reset checkout state when the modal opens/closes. Done via React's
  // "adjusting state during render" pattern (React docs) instead of a
  // synchronous setState-in-effect — avoids cascading-render lint errors
  // and keeps the reset atomic with the open/close transition.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setPhase(PHASES.creating);
      setErrorMsg('');
      setPayment(null);
    } else {
      setPhase(PHASES.idle);
      setPayment(null);
    }
  }

  // On open: boot PayPal config + create the payment (default provider).
  // Provider switches go through handleSelectProvider, which calls
  // createPayment itself — this effect never re-fires on provider change.
  //
  // The open/close state reset lives in the render-phase adjustment above
  // (React-sanctioned pattern); this effect only fires side effects. The
  // boot/create helpers are async and set state after awaiting the network
  // — the synchronous-first-statement setState inside createPayment is the
  // same intentional pattern the rest of the codebase uses (see App.jsx),
  // so the lint rule is suppressed here for consistency.
  useEffect(() => {
    if (isOpen) {
      processingRef.current = false;
      // bootPaypal/createPayment are async and set state after awaiting the
      // network; the synchronous-first-statement setState inside them is the
      // same intentional pattern the rest of the codebase uses (see App.jsx),
      // so the set-state-in-effect rule is suppressed on these two lines.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      bootPaypal();
       
      createPaymentRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── PayPal buttons render (after server payment created) ──────────────
  useEffect(() => {
    if (!isOpen || phase !== PHASES.ready || provider !== 'paypal' || !paypal || !payment) {
      return;
    }
    // Guard: only render buttons once per payment (prevents duplicate
    // renders when the effect re-fires from the ready transition).
    if (payment.paypal_order_id && buttonContainerRef.current?.dataset.renderedFor === payment.paypal_order_id) {
      return;
    }
    if (!payment.paypal_order_id && !payment.subscription_id) {
      // For premium we use the approve_url flow instead of buttons.
      return;
    }
    if (payment.subscription_id) {
      return; // handled by approve_url UI
    }

    const container = buttonContainerRef.current;
    if (!container) {return;}
    container.innerHTML = '';

    const buttons = paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
      createOrder: () => payment.paypal_order_id, // server-created order (authoritative amount)
      onApprove: async (data) => {
        if (processingRef.current) {return;} // prevent double-click
        processingRef.current = true;
        setPhase(PHASES.processing);
        try {
          const capture = await checkoutService.capturePaypal(
            payment.transaction_id,
            data.orderID || payment.paypal_order_id,
          );
          // Purchase settled — the attribution token did its job (it was
          // stored on the order at checkout creation). Forget it so a later
          // unrelated order in this session is never mis-attributed.
          clearAffiliateAttributionToken();
          setPhase(PHASES.success);
          showToast?.(t('success'), 'check-circle');
          onSuccess?.();
        } catch (err) {
          setPhase(PHASES.failed);
          setErrorMsg(err?.response?.data?.error || t('failed'));
        } finally {
          processingRef.current = false;
        }
      },
      onCancel: () => setPhase(PHASES.cancelled),
      onError: () => setPhase(PHASES.failed),
    });
    buttons.render(container).then(() => {
      // Mark rendered only AFTER success so a failed render can retry.
      if (payment.paypal_order_id && buttonContainerRef.current) {
        buttonContainerRef.current.dataset.renderedFor = payment.paypal_order_id;
      }
    }).catch(() => {
      setPhase(PHASES.failed);
      setErrorMsg(t('paypal_unavailable'));
    });
    return () => {
      try { container.innerHTML = ''; } catch (_) {}
    };
  }, [isOpen, phase, provider, paypal, payment, showToast, t]);

  // ── Stripe secondary: load Elements + create card form ────────────────
  useEffect(() => {
    if (!isOpen || phase !== PHASES.ready || provider !== 'stripe' || !payment?.client_secret) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@stripe/stripe-js');
        const { loadStripe } = mod;
        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
        if (!stripe) {
          setPhase(PHASES.failed);
          setErrorMsg(t('stripe_unavailable'));
          return;
        }
        const elements = stripe.elements();
        const card = elements.create('card', { hidePostalCode: true });
        card.mount('#checkout-stripe-card');
        cardElementRef.current = card;
        stripeRef.current = stripe;
        if (!cancelled) {setStripeReady(true);}
      } catch (_err) {
        if (!cancelled) {
          setPhase(PHASES.failed);
          setErrorMsg(t('stripe_unavailable'));
        }
      }
    })();
    return () => {
      cancelled = true;
      setStripeReady(false);
    };
  }, [isOpen, phase, provider, payment, lang]);

  const handleConfirmStripe = async () => {
    if (processingRef.current) {return;}
    processingRef.current = true;
    setPhase(PHASES.processing);
    try {
      const { error } = await stripeRef.current.confirmCardPayment(
        payment.client_secret,
        { payment_method: { card: cardElementRef.current } },
      );
      if (error) {
        setPhase(PHASES.failed);
        setErrorMsg(error.message || t('failed'));
      } else {
        // Purchase settled — forget the attribution token (see PayPal path).
        clearAffiliateAttributionToken();
        setPhase(PHASES.success);
        showToast?.(t('success'), 'check-circle');
        onSuccess?.();
      }
    } catch (_err) {
      setPhase(PHASES.failed);
      setErrorMsg(t('failed'));
    } finally {
      processingRef.current = false;
    }
  };

  // ── Provider switch: reset + recreate payment ─────────────────────────
  const handleSelectProvider = async (next) => {
    if (next === provider) {return;}
    setProvider(next);
    setPayment(null);
    setErrorMsg('');
    setPhase(PHASES.creating);
    await createPayment(next);
  };


  if (!isOpen) {return null;}

  const isPaypalUnavailable = provider === 'paypal' && ppConfig && !ppConfig.configured;

  return (
    <div className="checkout-overlay" role="dialog" aria-modal="true" aria-label={t('title')}>
      <div className="checkout-modal">
        <button type="button" className="checkout-close" onClick={onClose} aria-label={t('cancel')}>
          <i className="fas fa-times" />
        </button>

        <div className="checkout-head">
          <h3 className="checkout-title">
            <i className="fas fa-shield-alt" /> {t('title')}
          </h3>
          <p className="checkout-amount">
            {t('amount')}: <strong>${Number(amount || 0).toFixed(2)}</strong>
          </p>
        </div>

        {/* ── Provider selector: PayPal PRIMARY first ─────────────── */}
        <div className="checkout-providers" role="radiogroup" aria-label={t('choose_method')}>
          <button
            type="button"
            role="radio"
            aria-checked={provider === 'paypal'}
            className={`checkout-provider ${provider === 'paypal' ? 'is-active' : ''}`}
            onClick={() => handleSelectProvider('paypal')}
          >
            <span className="checkout-provider-logo pp"><i className="far fa-credit-card" /></span>
            <span className="checkout-provider-meta">
              <strong>{t('paypal_primary')}</strong>
              <small>{t('paypal_primary_hint')}</small>
            </span>
            <span className="checkout-provider-check"><i className="fas fa-check" /></span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={provider === 'stripe'}
            className={`checkout-provider ${provider === 'stripe' ? 'is-active' : ''}`}
            onClick={() => handleSelectProvider('stripe')}
          >
            <span className="checkout-provider-logo st"><i className="far fa-credit-card" /></span>
            <span className="checkout-provider-meta">
              <strong>{t('stripe_secondary')}</strong>
              <small>{t('stripe_secondary_hint')}</small>
            </span>
            <span className="checkout-provider-check"><i className="fas fa-check" /></span>
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="checkout-body">
          {phase === PHASES.creating && (
            <div className="checkout-state">
              <span className="checkout-spinner" />
              <p>{t('creating')}</p>
            </div>
          )}

          {phase === PHASES.ready && provider === 'paypal' && (
            <>
              {isPaypalUnavailable ? (
                <div className="checkout-state checkout-error">
                  <p>{t('paypal_unavailable')}</p>
                  <button type="button" className="btn-secondary" onClick={() => handleSelectProvider('stripe')}>
                    {t('stripe_secondary')}
                  </button>
                </div>
              ) : payment?.subscription_id ? (
                <div className="checkout-subscription">
                  <p>{t('complete_subscription')}</p>
                  <a className="btn-primary" href={payment.approve_url} target="_blank" rel="noreferrer">
                    <i className="fab fa-paypal" /> {t('open_paypal')}
                  </a>
                  <p className="checkout-hint">{t('waiting_activation')}</p>
                </div>
              ) : (
                <div ref={buttonContainerRef} className="checkout-paypal-buttons" />
              )}
            </>
          )}

          {phase === PHASES.ready && provider === 'stripe' && (
            <div className="checkout-stripe">
              <div id="checkout-stripe-card" className="checkout-stripe-card" />
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmStripe}
                disabled={!stripeReady}
              >
                {t('pay_now')}
              </button>
            </div>
          )}

          {phase === PHASES.processing && (
            <div className="checkout-state">
              <span className="checkout-spinner" />
              <p>{t('processing')}</p>
            </div>
          )}

          {phase === PHASES.success && (
            <div className="checkout-state checkout-success">
              <i className="fas fa-check-circle" />
              <p>{t('success')}</p>
              <button type="button" className="btn-primary" onClick={onClose}>
                {t('back')}
              </button>
            </div>
          )}

          {phase === PHASES.cancelled && (
            <div className="checkout-state checkout-cancelled">
              <i className="fas fa-times-circle" />
              <p>{t('cancelled')}</p>
              <button type="button" className="btn-secondary" onClick={() => setPhase(PHASES.ready)}>
                {t('try_again')}
              </button>
            </div>
          )}

          {phase === PHASES.failed && (
            <div className="checkout-state checkout-error">
              <i className="fas fa-exclamation-circle" />
              <p>{errorMsg || t('failed')}</p>
              <button type="button" className="btn-secondary" onClick={() => setPhase(PHASES.ready)}>
                {t('try_again')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
