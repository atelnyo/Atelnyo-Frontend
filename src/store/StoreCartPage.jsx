import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';
import { loadCart, saveCart, setQuantity, removeFromCart } from './cart';
import SEOHead from '../components/shared/SEOHead';
import { loadPayPalScript } from '../components/CheckoutModal';
import { paymentConfigService, checkoutService } from '../services/api';

export default function StoreCartPage() {
  const [items, setItems] = useState(() => loadCart());
  // Display-only details (name, image, price) fetched per product id.
  // The server recalculates the real total at checkout.
  const [details, setDetails] = useState({});

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(items.map((it) => it.productId))];
    ids.forEach((id) => {
      if (details[id]) return;
      storeService.getProduct(id)
        .then(({ data }) => {
          if (!cancelled) setDetails((d) => ({ ...d, [id]: data }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  // idle | submitting (creating the order) | preparing (waiting for the
  // PayPal buttons) | capturing (buyer approved, settlement in flight) | error
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [txnId, setTxnId] = useState(null);
  const [pendingShippingConfirmation, setPendingShippingConfirmation] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  // Guest token is kept in memory only: shown once by the server, never stored.
  const [guestToken, setGuestToken] = useState(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [shippingAddress, setShippingAddress] = useState({
    first_name: '', last_name: '', email: '', phone: '', country: 'US',
    region: '', address1: '', address2: '', city: '', zip: '',
  });
  const [shippingQuote, setShippingQuote] = useState(null);
  const [shippingMethod, setShippingMethod] = useState('');
  const [shippingBusy, setShippingBusy] = useState(false);
  const [orderTotal, setOrderTotal] = useState(null);
  const [loginLink, setLoginLink] = useState(null);
  const [providerShippingConfirmation, setProviderShippingConfirmation] = useState(null);
  const [confirmProviderShipping, setConfirmProviderShipping] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [shippingFormAnimating, setShippingFormAnimating] = useState(false);
  const user = useAuthStore((s) => s.user);
  const buttonsRef = useRef(null);
  const requiresShipping = items.some((line) => details[line.productId]?.kind === 'physical');
  const hasPrintifyItems = items.some((line) => details[line.productId]?.printify_product_id);
  // Require shipping details upfront for physical items so shipping cost is calculated.
  const needsShippingForm = requiresShipping;

  // One label per in-flight step so the Checkout button always says what is
  // happening instead of flickering back to "Checkout" while the payment
  // surface below it is still being prepared.
  const busyLabel = {
    submitting: 'Starting checkout',
    preparing: 'Preparing payment',
    capturing: 'Confirming payment',
  }[status] || '';

  const update = (next) => {
    setItems(next);
    saveCart(next);
    setShippingQuote(null);
    setShippingMethod('');
    setOrderTotal(null);
    window.dispatchEvent(new Event('store-cart-changed'));
  };

  // Render PayPal buttons once the server has created the PayPal order.
  useEffect(() => {
    if (!paypalOrderId || !buttonsRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await paymentConfigService.config();
        if (!cfg?.data?.configured || !cfg?.data?.client_id) {
          setMessage('PayPal is not configured.');
          setStatus('error');
          return;
        }
        const pp = await loadPayPalScript(cfg.data.client_id, cfg.data.sandbox, 'capture');
        if (cancelled || !buttonsRef.current) return;
        buttonsRef.current.innerHTML = '';
        pp.Buttons({
          createOrder: () => paypalOrderId,
          onApprove: async (data) => {
            // Settlement takes a round-trip; say so instead of looking idle.
            setStatus('capturing');
            try {
              await checkoutService.capturePaypal(
                txnId, data.orderID || paypalOrderId, guestToken, confirmProviderShipping,
              );
              update([]);
              setPaypalOrderId(null);
              setMessage(`Payment received for order #${orderId}.`);
              setStatus('idle');
            } catch (err) {
              const body = err?.response?.data || {};
              if (body.code === 'shipping_confirmation_required' && body.shipping_address) {
                setProviderShippingConfirmation(body.shipping_address);
                setPendingShippingConfirmation(true);
                setConfirmProviderShipping(false);
              }
              setMessage(String(body.error || 'Payment could not be confirmed.'));
              setStatus('error');
            }
          },
          onError: () => {
            setMessage('PayPal is unavailable right now.');
            setStatus('error');
          },
        }).render(buttonsRef.current).then(() => {
          if (cancelled) return;
          // The buttons are on screen now — the status quo ante is back.
          setStatus('idle');
        });
      } catch (err) {
        if (!cancelled) {
          // A deadline miss is not the same failure as a blocked SDK: say
          // which one happened so the shopper knows what to try next.
          setMessage(err?.code === 'timeout'
            ? 'PayPal took too long to load. Check your connection and press Checkout again.'
            : 'PayPal is unavailable right now.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paypalOrderId, txnId, orderId, guestToken]);

  const onQty = (line, quantity) =>
    update(setQuantity(items, { ...line, quantity }));
  const onRemove = (line) => update(removeFromCart(items, line));

  const onShippingAddressChange = (event) => {
    const { name, value } = event.target;
    setShippingAddress((current) => ({ ...current, [name]: value }));
    setShippingQuote(null);
    setShippingMethod('');
    setOrderTotal(null);
    setProviderShippingConfirmation(null);
    setConfirmProviderShipping(false);
  };

  const onQuoteShipping = async () => {
    setShippingBusy(true);
    setMessage('');
    setProviderShippingConfirmation(null);
    setConfirmProviderShipping(false);
    setShippingQuote(null);
    setShippingMethod('');
    try {
      const response = await storeService.quoteShipping(
        items.map((line) => ({
          product_id: line.productId,
          variant_id: line.variantId,
          quantity: line.quantity,
        })),
        { ...shippingAddress, email: shippingAddress.email || user?.email || guestEmail },
      );
      const quote = response?.data || {};
      setShippingQuote(quote);
      if (quote.status !== 'ELIGIBLE') {
        setMessage(quote.warnings?.join(' ') || 'Shipping could not be verified for this address.');
      }
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Shipping could not be checked. Try again.');
    } finally {
      setShippingBusy(false);
    }
  };

  const onCheckout = async (resumeExistingPayment = false) => {
    if (!items.length) return;
    if (pendingShippingConfirmation && (!providerShippingConfirmation || !confirmProviderShipping)) {
      setMessage('Review and confirm the final payment-provider delivery address to continue.');
      return;
    }
    const resumeExistingOrder = pendingShippingConfirmation;
    // Require shipping quote and method for physical items
    if (!resumeExistingOrder && needsShippingForm) {
      if (!shippingQuote) {
        setMessage('Check shipping options for your address before checkout.');
        setStatus('error');
        return;
      }
      if (shippingQuote.status !== 'ELIGIBLE') {
        setMessage(shippingQuote.warnings?.join(' ') || 'Shipping is not available for this address. Check shipping options or update your address.');
        setStatus('error');
        return;
      }
      if (shippingQuote.shipping_methods?.length && !shippingMethod) {
        setMessage('Choose an available shipping method before checkout.');
        setStatus('error');
        return;
      }
    }
    const guest = !user;
    if (guest && (!guestEmail.trim() || !guestEmail.includes('@'))) {
      setMessage('Enter a valid email to check out.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setMessage('');
    if (!pendingShippingConfirmation) {
      setProviderShippingConfirmation(null);
      setConfirmProviderShipping(false);
    }
    setLoginLink(null);
    setOrderTotal(null);
    try {
      // Only create another order for a new checkout. A shipping confirmation
      // resumes the same provider order; it never creates or charges twice.
      let orderRes = { data: { id: orderId, total: orderTotal, guest_token: guestToken } };
      try {
        if (!resumeExistingOrder) orderRes = await storeService.createOrder(
        items.map((it) => ({
          product_id: it.productId,
          variant_id: it.variantId,
          quantity: it.quantity,
        })),
        guest ? { email: guestEmail.trim(), name: guestName.trim() } : null,
        requiresShipping ? {
          ...shippingAddress,
          email: shippingAddress.email || user?.email || guestEmail.trim(),
        } : null,
        requiresShipping ? (shippingMethod || null) : null,
        );
      } catch (err) {
        if (err?.response?.data?.code === 'account_exists') {
          const next = encodeURIComponent('/store/cart');
          setMessage('An account already uses this email. Sign in to check out with it.');
          setLoginLink(`/store/login?next=${next}`);
          setStatus('error');
          return;
        }
        throw err;
      }
      const resolvedOrderId = orderRes?.data?.id || orderId;
      setOrderTotal(orderRes?.data?.total ?? orderTotal);
      const token = orderRes?.data?.guest_token || guestToken || null;
      setGuestToken(token);
      const payRes = await storeService.checkoutOrder(
        resolvedOrderId, 'paypal', token, resumeExistingPayment,
      );
      const pay = payRes?.data || {};
      if (!pay.paypal_order_id) {
        setMessage('Payment is not available right now.');
        setStatus('error');
        return;
      }
      setOrderId(resolvedOrderId);
      setTxnId(pay.transaction_id);
      setPaypalOrderId(pay.paypal_order_id);
      setPendingShippingConfirmation(false);
      setProviderShippingConfirmation(null);
      setConfirmProviderShipping(false);
      setMessage('');
      // Stay in "preparing" until the buttons have actually rendered: the
      // config fetch + PayPal SDK download + render used to happen against
      // an empty area under the button, which reads as "checkout is broken"
      // (especially on a slow connection). The placeholder below covers it.
      setStatus('preparing');
    } catch (err) {
      const detail =
        err?.response?.data?.detail || err?.response?.data?.error || 'Checkout could not be started.';
      setMessage(String(detail));
      setStatus('error');
    }
  };

  if (!items.length) {
    return (
      <section className="store-cart-empty" role="status">
        <SEOHead title="Cart" url="/store/cart" noindex />
        <div className="store-cart-empty__icon" aria-hidden="true">🛒</div>
        <h1 className="store-title">Your cart is empty</h1>
        <p className="store-state">Looks like you haven't added anything yet.</p>
        <Link to="/store" className="store-btn store-cart-empty__cta">Continue shopping</Link>
      </section>
    );
  }

  return (
    <section>
      <style>{`
        @keyframes slideDown {
          from {
            max-height: 0;
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            max-height: 2000px;
            opacity: 1;
            transform: translateY(0);
          }
        }
        .store-shipping-address--animate {
          animation: slideDown 0.4s ease-out;
        }
      `}</style>
      <SEOHead title="Cart" url="/store/cart" noindex />
      <h1 className="store-title">Cart</h1>
      <ul className="store-cart">
        {items.map((line) => {
          const detail = details[line.productId];
          const variant = detail?.variants?.find((entry) => entry.id === line.variantId);
          const unit = Number(variant?.price ?? detail?.price);
          const lineTotal = Number.isFinite(unit) ? unit * line.quantity : null;
          return (
          <li key={`${line.productId}-${line.variantId ?? 'base'}`} className="store-cart__line">
            {detail?.image_url && (
              <img className="store-cart__img" src={detail.image_url} alt="" />
            )}
            <div className="store-cart__info">
              <span className="store-cart__title">{detail?.title || 'Loading product…'}</span>
              {variant && (variant.name || variant.size || variant.color) && (
                <span className="store-cart__variant">{[variant.color, variant.size].filter(Boolean).join(' / ') || variant.name}</span>
              )}
              <span className="store-cart__price">
                {lineTotal == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: detail.currency || 'USD' }).format(lineTotal)}
              </span>
            </div>
            <div className="store-cart__actions">
            <div className="store-cart__qty" role="group" aria-label="Quantity">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={line.quantity <= 1}
                onClick={() => onQty(line, Math.max(1, line.quantity - 1))}
              >
                −
              </button>
              <span aria-live="polite">{line.quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={line.quantity >= 99}
                onClick={() => onQty(line, Math.min(99, line.quantity + 1))}
              >
                +
              </button>
            </div>
            <button type="button" className="store-cart__remove" onClick={() => onRemove(line)}>
              Remove
            </button>
            </div>
          </li>
          );
        })}
      </ul>
      <p className="store-state">Totals are calculated by the server at checkout.</p>
      {!user && (
        <div className="store-guest">
          <label>
            Email (receipt and order access)
            <input
              type="email"
              autoComplete="email"
              required
              value={guestEmail}
              onChange={(e) => { setGuestEmail(e.target.value); setShippingQuote(null); setShippingMethod(''); setShowShippingForm(false); }}
            />
          </label>
          <label>
            Name (optional)
            <input
              type="text"
              autoComplete="name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </label>
        </div>
      )}
      {needsShippingForm && !showShippingForm && (
        <button
          type="button"
          className="store-btn"
          style={{ marginTop: '1rem', width: '100%' }}
          disabled={(!user && (!guestEmail.trim() || !guestEmail.includes('@'))) || shippingBusy}
          onClick={() => {
            setShippingFormAnimating(true);
            setShowShippingForm(true);
            setTimeout(() => setShippingFormAnimating(false), 400);
          }}
        >
          Continue to shipping address
        </button>
      )}
      {needsShippingForm && showShippingForm && (
        <fieldset
          className={`store-shipping-address ${shippingFormAnimating ? 'store-shipping-address--animate' : ''}`}
          disabled={shippingBusy || Boolean(busyLabel)}
          style={{ animation: shippingFormAnimating ? 'slideDown 0.4s ease-out' : 'none', overflow: 'hidden' }}
        >
          <legend>Shipping address</legend>
          <div className="store-shipping-address__grid">
            {[
              ['first_name', 'First name'], ['last_name', 'Last name'],
              ['email', 'Email'], ['phone', 'Phone (optional)'],
              ['address1', 'Address'], ['address2', 'Apartment, suite (optional)'],
              ['city', 'City'], ['region', 'State / region'], ['zip', 'Postal code'],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type={name === 'email' ? 'email' : 'text'}
                  autoComplete={name === 'address1' ? 'address-line1' : name === 'zip' ? 'postal-code' : name}
                  value={shippingAddress[name]}
                  onChange={onShippingAddressChange}
                  required={!label.includes('optional')}
                />
              </label>
            ))}
            <label>
              Country
              <input name="country" autoComplete="country" maxLength={2} value={shippingAddress.country}
                onChange={onShippingAddressChange} required />
            </label>
          </div>
          <button type="button" className="store-btn" onClick={onQuoteShipping} disabled={shippingBusy}>
            {shippingBusy ? 'Checking shipping…' : 'Check shipping options'}
          </button>
          {shippingQuote?.status === 'ELIGIBLE' && shippingQuote.shipping_methods?.length > 0 && (
            <div role="group" aria-label="Shipping method">
              {shippingQuote.shipping_methods.map((method) => (
                <label key={method.id}>
                  <input type="radio" name="shipping_method" value={method.id}
                    checked={shippingMethod === method.id}
                    onChange={() => { setShippingMethod(method.id); setMessage(''); }} />
                  {method.name} · {new Intl.NumberFormat('en-US', { style: 'currency', currency: method.currency || 'USD' }).format(Number(method.price))}
                </label>
              ))}
            </div>
          )}
          {shippingQuote?.status === 'ELIGIBLE' && shippingQuote.shipping_methods?.length > 0 && shippingMethod && (
            <p className="store-state" role="status">
              Shipping: {new Intl.NumberFormat('en-US', { style: 'currency', currency: shippingQuote.currency || 'USD' }).format(Number(shippingQuote.shipping_methods.find((method) => method.id === shippingMethod)?.price || 0))}
            </p>
          )}
        </fieldset>
      )}

      {shippingQuote?.status === 'ELIGIBLE' && shippingQuote.shipping_methods?.length > 0 && shippingMethod && (() => {
        const subtotal = items.reduce((sum, line) => {
          const detail = details[line.productId];
          const variant = detail?.variants?.find((entry) => entry.id === line.variantId);
          const price = Number(variant?.price ?? detail?.price);
          return sum + (Number.isFinite(price) ? price * line.quantity : 0);
        }, 0);
        const method = shippingQuote.shipping_methods.find((entry) => entry.id === shippingMethod);
        return method && (
          <p className="store-state" role="status">
            Estimated total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: method.currency || 'USD' }).format(subtotal + Number(method.price))}
          </p>
        );
      })()}
      {providerShippingConfirmation && (
        <fieldset className="store-shipping-address" aria-label="Confirm payment provider shipping address">
          <legend>Confirm the final delivery address</legend>
          <address>
            {[providerShippingConfirmation.first_name, providerShippingConfirmation.last_name].filter(Boolean).join(' ')}<br />
            {providerShippingConfirmation.address1}<br />
            {providerShippingConfirmation.address2 && <>{providerShippingConfirmation.address2}<br /></>}
            {[providerShippingConfirmation.city, providerShippingConfirmation.region, providerShippingConfirmation.zip].filter(Boolean).join(', ')}<br />
            {providerShippingConfirmation.country}
          </address>
          <label>
            <input
              type="checkbox"
              checked={confirmProviderShipping}
              onChange={(event) => setConfirmProviderShipping(event.target.checked)}
            />
            I confirm this is the delivery address. Billing details are not used for shipping.
          </label>
          <button
            type="button"
            className="store-btn"
            disabled={!confirmProviderShipping || Boolean(busyLabel)}
            onClick={() => {
              onCheckout(true);
            }}
          >
            Confirm address and continue
          </button>
          <p className="store-state">We will resume the same PayPal payment. The payment will not be captured unless the final destination remains eligible at the quoted shipping cost.</p>
        </fieldset>
      )}
      {orderTotal !== null && (
        <p className="store-state" role="status">
          Order total including verified shipping: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(orderTotal))}
        </p>
      )}
      <button
        type="button"
        className="store-btn store-cart__checkout"
        onClick={onCheckout}
        disabled={Boolean(busyLabel)}
      >
        {busyLabel ? (
          <span className="store-cart__busy" role="status" aria-label={busyLabel}>
            {busyLabel}<span className="store-cart__dots" aria-hidden="true"><i /><i /><i /></span>
          </span>
        ) : (
          'Checkout'
        )}
      </button>
      {paypalOrderId && status === 'preparing' && (
        <div className="store-paypal-loading" role="status" aria-live="polite">
          <span className="store-paypal-loading__button" aria-hidden="true" />
          <p>Loading secure payment options…</p>
        </div>
      )}
      {paypalOrderId && <div ref={buttonsRef} className="store-paypal" />}
      {message && (
        <p role={status === 'error' ? 'alert' : 'status'} className={status === 'error' ? 'store-state store-state--error' : 'store-state'}>
          {message}
          {loginLink && <> <Link to={loginLink}>Sign in</Link></>}
        </p>
      )}
    </section>
  );
}
