import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from './storeService';
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
              await checkoutService.capturePaypal(txnId, data.orderID || paypalOrderId);
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
  }, [paypalOrderId, txnId, orderId]);

  const onQty = (line, quantity) =>
    update(setQuantity(items, { ...line, quantity }));
  const onRemove = (line) => update(removeFromCart(items, line));

  const onCheckout = async () => {
    if (!items.length) return;
    setStatus('submitting');
    setMessage('');
    try {
      // Only ids and quantities are sent; the backend prices and validates them.
      const orderRes = await storeService.createOrder(
        items.map((it) => ({
          product_id: it.productId,
          variant_id: it.variantId,
          quantity: it.quantity,
        })),
      );
      const orderId = orderRes?.data?.id;
      const payRes = await storeService.checkoutOrder(orderId, 'paypal');
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
      <section className="store-state">
        <SEOHead title="Cart" url="/store/cart" noindex />
        <h1 className="store-title">Your cart is empty</h1>
        <p><Link to="/store">Continue shopping</Link></p>
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
            <span className="store-cart__title">{detail?.title || 'Loading product…'}</span>
            <span className="store-cart__price">
              {lineTotal == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: detail.currency || 'USD' }).format(lineTotal)}
            </span>
            <label className="store-sr-only" htmlFor={`qty-${line.productId}-${line.variantId ?? 'base'}`}>
              Quantity
            </label>
            <input
              id={`qty-${line.productId}-${line.variantId ?? 'base'}`}
              type="number"
              min={1}
              max={99}
              value={line.quantity}
              onChange={(e) => onQty(line, Number(e.target.value) || 1)}
            />
            <button type="button" className="store-btn store-btn--ghost" onClick={() => onRemove(line)}>
              Remove
            </button>
          </li>
          );
        })}
      </ul>
      <p className="store-state">Totals are calculated by the server at checkout.</p>
      <button type="button" className="store-btn" onClick={onCheckout} disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Starting checkout…' : 'Checkout'}
      </button>
      {paypalOrderId && <div ref={buttonsRef} className="store-paypal" />}
      {message && (
        <p role={status === 'error' ? 'alert' : 'status'} className={status === 'error' ? 'store-state store-state--error' : 'store-state'}>
          {message}
        </p>
      )}
    </section>
  );
}
