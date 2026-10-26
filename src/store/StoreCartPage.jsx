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
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [txnId, setTxnId] = useState(null);
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  // Guest token is kept in memory only: shown once by the server, never stored.
  const [guestToken, setGuestToken] = useState(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [loginLink, setLoginLink] = useState(null);
  const user = useAuthStore((s) => s.user);
  const buttonsRef = useRef(null);

  const update = (next) => {
    setItems(next);
    saveCart(next);
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
            setStatus('submitting');
            try {
              await checkoutService.capturePaypal(txnId, data.orderID || paypalOrderId, guestToken);
              update([]);
              setPaypalOrderId(null);
              setMessage(`Payment received for order #${orderId}.`);
              setStatus('idle');
            } catch (err) {
              setMessage(String(err?.response?.data?.error || 'Payment could not be confirmed.'));
              setStatus('error');
            }
          },
          onError: () => {
            setMessage('PayPal is unavailable right now.');
            setStatus('error');
          },
        }).render(buttonsRef.current);
      } catch {
        if (!cancelled) {
          setMessage('PayPal is unavailable right now.');
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

  const onCheckout = async () => {
    if (!items.length) return;
    const guest = !user;
    if (guest && (!guestEmail.trim() || !guestEmail.includes('@'))) {
      setMessage('Enter a valid email to check out.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setMessage('');
    setLoginLink(null);
    try {
      // Only ids and quantities are sent; the backend prices and validates them.
      let orderRes;
      try {
        orderRes = await storeService.createOrder(
        items.map((it) => ({
          product_id: it.productId,
          variant_id: it.variantId,
          quantity: it.quantity,
        })),
        guest ? { email: guestEmail.trim(), name: guestName.trim() } : null,
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
      const orderId = orderRes?.data?.id;
      const token = orderRes?.data?.guest_token || null;
      setGuestToken(token);
      const payRes = await storeService.checkoutOrder(orderId, 'paypal', token);
      const pay = payRes?.data || {};
      if (!pay.paypal_order_id) {
        setMessage('Payment is not available right now.');
        setStatus('error');
        return;
      }
      setOrderId(orderId);
      setTxnId(pay.transaction_id);
      setPaypalOrderId(pay.paypal_order_id);
      setMessage('');
      setStatus('idle');
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
      <SEOHead title="Cart" url="/store/cart" noindex />
      <h1 className="store-title">Cart</h1>
      <ul className="store-cart">
        {items.map((line) => {
          const detail = details[line.productId];
          const unit = Number(detail?.price);
          const lineTotal = Number.isFinite(unit) ? unit * line.quantity : null;
          return (
          <li key={`${line.productId}-${line.variantId ?? 'base'}`} className="store-cart__line">
            {detail?.image_url && (
              <img className="store-cart__img" src={detail.image_url} alt="" />
            )}
            <div className="store-cart__info">
              <span className="store-cart__title">{detail?.title || 'Loading product…'}</span>
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
              onChange={(e) => setGuestEmail(e.target.value)}
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
      <button type="button" className="store-btn store-cart__checkout" onClick={onCheckout} disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          <span className="store-cart__busy" role="status" aria-label="Starting checkout">
            Starting checkout<span className="store-cart__dots" aria-hidden="true"><i /><i /><i /></span>
          </span>
        ) : (
          'Checkout'
        )}
      </button>
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
