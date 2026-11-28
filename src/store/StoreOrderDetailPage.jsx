import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';
import { regionCodeFor } from './regions';
import { useShippingDestinations } from './useShippingDestinations';
import { fulfillmentLabel, storeOrderStatus } from '../components/business/storeOrderStatus';
import { formatDate, money } from './storeFormat';

const STEP_LABELS = ['Order placed', 'Paid', 'Preparing', 'Shipped', 'Completed'];
const CLOSED_STATUSES = new Set(['cancelled', 'refunded']);
// Printify stages that mean "the seller is working on it, not shipped yet".
const PREPARING_STATUSES = new Set([
  'pending', 'on-hold', 'in-production', 'partially-fulfilled',
]);
// Delivery-address fields shown when the buyer corrects the order address.
const ADDRESS_FIELDS = [
  ['first_name', 'First name'],
  ['last_name', 'Last name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['address1', 'Address line 1'],
  ['address2', 'Apartment, suite, etc. (optional)'],
  ['city', 'City'],
  ['region', 'State / Province / Region'],
  ['zip', 'Postal / ZIP code'],
  ['country', 'Country (2-letter code)'],
];
const ADDRESS_FIELD_STYLE = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '10px',
  border: '1px solid #d8dee9',
  font: 'inherit',
};

const addressLines = (address) => {
  if (!address || typeof address !== 'object') return [];
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ');
  const cityLine = [address.city, address.region].filter(Boolean).join(', ');
  const cityZip = [cityLine, address.zip].filter(Boolean).join(' ');
  return [name, address.address1, address.address2, cityZip, address.country].filter(Boolean);
};

// Manual seller tracking and Printify shipments share one list: the shopper
// does not care which pipeline produced the parcel.
const collectShipments = (order) => {
  const shipments = [];
  const manual = order.tracking;
  if (manual && (manual.number || manual.url || manual.carrier)) {
    shipments.push({
      key: 'manual',
      carrier: manual.carrier,
      number: manual.number,
      url: manual.url,
      date: manual.shipped_at,
    });
  }
  const fulfillments = Array.isArray(order.printify_fulfillment) ? order.printify_fulfillment : [];
  fulfillments.forEach((fulfillment, fi) => {
    const rows = Array.isArray(fulfillment?.shipments) ? fulfillment.shipments : [];
    rows.forEach((shipment, si) => {
      if (!shipment || (!shipment.number && !shipment.url && !shipment.carrier)) return;
      shipments.push({
        key: `printify-${fi}-${si}`,
        carrier: shipment.carrier,
        number: shipment.number,
        url: shipment.url,
        date: shipment.delivered_at,
      });
    });
  });
  return shipments;
};

const stepIndex = (order, shipments) => {
  if (CLOSED_STATUSES.has(order.status)) return -1;
  if (order.status === 'completed') return 4;
  if (order.status === 'fulfilled' || shipments.length > 0) return 3;
  if (order.status === 'paid') {
    // A paid POD order is printed before it ships — show that, so the buyer
    // sees movement instead of a silent "Paid" while the parcel is produced.
    const preparing = (order.printify_fulfillment || []).some(
      (row) => PREPARING_STATUSES.has(row?.status),
    );
    return preparing ? 2 : 1;
  }
  return 0;
};

export default function StoreOrderDetailPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  // Region choices mirror the enabled backend destinations.
  const destinations = useShippingDestinations();
  // Guest access: the token from checkout (query string, then this tab's
  // session) is the only proof a guest can present. Keeping it means the
  // order page survives a reload — and lets the receipt link straight here.
  const tokenParam = params.get('token') || '';
  const [guestToken, setGuestToken] = useState(() => {
    if (tokenParam) return tokenParam;
    try {
      return sessionStorage.getItem(`atelnyo_guest_order_${orderId}`) || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    if (!tokenParam) return;
    try {
      sessionStorage.setItem(`atelnyo_guest_order_${orderId}`, tokenParam);
    } catch {
      // Storage may be unavailable (private mode); the URL still carries it.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuestToken(tokenParam);
  }, [tokenParam, orderId]);
  const [order, setOrder] = useState(null);
  // 'not_found' | 'failed' — null while loading and after a successful load.
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  // "Contact the seller" — the seller is reachable from the order itself,
  // so a missing parcel never dead-ends at a generic support page.
  // Which seller's thread is open. A paid cart can hold several shops, so
  // the buyer must be able to pick who they are writing to.
  const [contactSellerId, setContactSellerId] = useState(null);
  const [contactBody, setContactBody] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactNotice, setContactNotice] = useState(null);
  // Address correction — allowed until the supplier has the order.
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressForm, setAddressForm] = useState(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressNotice, setAddressNotice] = useState(null);
  // An unpaid order reserves its stock; the buyer can release it instead of
  // waiting for the abandoned-order sweep to do it.
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(null);

  useEffect(() => {
    if (!user && !guestToken) {
      return undefined;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(null);
    setError(null);
    storeService.getOrder(orderId, guestToken)
      .then((res) => {
        if (cancelled) {
          return;
        }
        setOrder(res?.data ?? res);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err?.response?.status === 404 ? 'not_found' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, user, guestToken, reloadTick]);

  const isGuest = !user && Boolean(guestToken);

  if (!user && !guestToken) {
    return (
      <Navigate
        to={`/store/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}`}
        replace
      />
    );
  }

  const status = order ? storeOrderStatus(order.status, false) : null;
  const items = Array.isArray(order?.items) ? order.items : [];
  const sellers = Array.isArray(order?.sellers) ? order.sellers : [];
  const shipments = order ? collectShipments(order) : [];
  const currentStep = order ? stepIndex(order, shipments) : 0;
  const fulfillments = Array.isArray(order?.printify_fulfillment) ? order.printify_fulfillment : [];
  const lines = addressLines(order?.shipping_address);
  const hasPhysical = items.some((item) => item.product_kind !== 'digital');

  const startAddressEdit = () => {
    const saved = order?.shipping_address || {};
    setAddressForm({
      first_name: saved.first_name || '',
      last_name: saved.last_name || '',
      email: saved.email || '',
      phone: saved.phone || '',
      address1: saved.address1 || '',
      address2: saved.address2 || '',
      city: saved.city || '',
      // A legacy full name ("California") becomes the code Printify expects.
      region: regionCodeFor(saved.country, saved.region),
      zip: saved.zip || '',
      country: saved.country || '',
    });
    setAddressNotice(null);
    setAddressEditing(true);
  };

  const setAddressField = (key, value) => {
    setAddressForm((form) => {
      if (!form) {
        return form;
      }
      const next = { ...form, [key]: key === 'country' ? value.toUpperCase() : value };
      if (key === 'country') {
        // US and CA use different code sets; drop a province that no longer
        // matches the chosen country.
        const options = destinations.find((country) => country.code === next.country);
        if (options && !options.regions.some((region) => region.code === next.region)) {
          next.region = '';
        }
      }
      return next;
    });
  };

  const saveAddress = async () => {
    if (!addressForm) {
      return;
    }
    setAddressBusy(true);
    setAddressNotice(null);
    try {
      const { data } = await storeService.updateShippingAddress(orderId, addressForm, guestToken);
      setOrder((previous) => ({
        ...previous,
        shipping_address: data.shipping_address,
        can_edit_shipping: data.can_edit_shipping,
      }));
      setAddressEditing(false);
      setAddressNotice({
        kind: 'ok',
        text: 'Address updated — the seller will ship to this one.',
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setAddressNotice({
        kind: 'error',
        text: String(detail || 'Could not update the address. Try again or message the seller.'),
      });
    } finally {
      setAddressBusy(false);
    }
  };

  const cancelOrder = async () => {
    setCancelBusy(true);
    setCancelNotice(null);
    try {
      const { data } = await storeService.cancelOrder(orderId, guestToken);
      setOrder(data);
      setCancelConfirm(false);
      setCancelNotice({
        kind: 'ok',
        text: 'Order cancelled — the reserved items are back in stock.',
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setCancelNotice({
        kind: 'error',
        text: String(detail || 'Could not cancel this order. Try again or contact support.'),
      });
    } finally {
      setCancelBusy(false);
    }
  };

  const sendSellerMessage = async (seller) => {
    const body = contactBody.trim();
    if (!body) {
      return;
    }
    setContactBusy(true);
    setContactNotice(null);
    try {
      await storeService.contactSeller(orderId, body, seller.id, guestToken);
      setContactBody('');
      setContactSellerId(null);
      setContactNotice({
        kind: 'ok',
        text: isGuest
          ? `Message sent to ${seller.username || 'the seller'} — the reply goes to the email on this order.`
          : `Message sent to ${seller.username || 'the seller'} — the reply lands in your messages.`,
      });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.body;
      setContactNotice({
        kind: 'error',
        text: String(detail || 'Could not send the message. Try again or contact support.'),
      });
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <section className="store-order">
      <Helmet>
        <title>Order #{orderId} · Atelnyo Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <p className="store-order__back"><Link to="/account">← Back to account</Link></p>

      <div className="store-order__head">
        <h1 className="store-title store-order__title">Order #{orderId}</h1>
        {order && (
          <span
            className="store-account__order-status"
            style={{
              background: `${status.color}1f`,
              color: status.color,
              border: `1px solid ${status.color}55`,
            }}
          >
            {status.label}
          </span>
        )}
      </div>
      {order && <p className="store-order__date">Placed {formatDate(order.created_at)}</p>}

      {order && cancelNotice && (
        <p
          className="store-order__hint"
          role={cancelNotice.kind === 'error' ? 'alert' : 'status'}
        >
          {cancelNotice.text}
        </p>
      )}

      {!order && error === 'not_found' && (
        <p className="store-state" role="alert">
          This order was not found on your account. <Link to="/account">See your orders</Link>.
        </p>
      )}
      {!order && error === 'failed' && (
        <p className="store-state store-state--error" role="alert">
          Your order could not be loaded.{' '}
          <button
            type="button"
            className="store-btn store-btn--ghost"
            onClick={() => setReloadTick((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
      {!order && !error && <p className="store-state" role="status">Loading your order…</p>}

      {order && (
        <>
          {isGuest && (
            <section className="store-order__card">
              <h2>Keep following this order</h2>
              <p className="store-order__hint">
                You checked out as a guest. Create an account with the email you
                used to keep the tracking, downloads and seller messages in one
                place.
              </p>
              <Link
                className="store-btn"
                to={`/store/claim?order=${order.id}&token=${encodeURIComponent(guestToken)}`}
              >
                Create my account
              </Link>
            </section>
          )}
          {currentStep === -1 ? (
            <p className="store-order__cancelled" role="status">
              This order is {status.label.toLowerCase()}. Contact support if you need help with it.
            </p>
          ) : (
            <ol className="store-order__steps" aria-label="Order progress">
              {STEP_LABELS.map((label, index) => {
                const state = index < currentStep ? 'done' : index === currentStep ? 'current' : 'todo';
                return (
                  <li
                    key={label}
                    className={`store-order__step is-${state}`}
                    aria-current={index === currentStep ? 'step' : undefined}
                  >
                    <span className="store-order__step-dot" aria-hidden="true">
                      {index < currentStep ? '✓' : index + 1}
                    </span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {order.status === 'pending' && (
            <section className="store-order__card">
              <h2>Complete your payment</h2>
              <p className="store-order__hint">
                This order is still waiting for payment. Your items are reserved —
                resume checkout to pay for this same order.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <Link
                  className="store-btn"
                  to={`/store/cart?resume_order=${order.id}${isGuest ? `&token=${encodeURIComponent(guestToken)}` : ''}`}
                >
                  Resume payment
                </Link>
                {cancelConfirm ? (
                  <>
                    <button
                      type="button"
                      className="store-btn"
                      onClick={cancelOrder}
                      disabled={cancelBusy}
                    >
                      {cancelBusy ? 'Cancelling…' : 'Yes, cancel it'}
                    </button>
                    <button
                      type="button"
                      className="store-btn store-btn--ghost"
                      onClick={() => setCancelConfirm(false)}
                      disabled={cancelBusy}
                    >
                      Keep my order
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="store-btn store-btn--ghost"
                    onClick={() => {
                      setCancelConfirm(true);
                      setCancelNotice(null);
                    }}
                  >
                    Cancel order
                  </button>
                )}
              </div>
              {cancelConfirm && (
                <p className="store-order__hint">
                  Cancelling releases the reserved items — you can order again later.
                </p>
              )}
            </section>
          )}

          <section className="store-order__card">
            <h2>Items</h2>
            <ul className="store-order__items">
              {items.map((item) => (
                <li key={item.id}>
                  <div className="store-order__item-main">
                    <span className="store-order__item-title">{item.product_title || 'Item'}</span>
                    {item.variant_name && (
                      <span className="store-order__muted">{item.variant_name}</span>
                    )}
                    <span className="store-order__muted">
                      Qty {item.quantity} · {money(item.unit_price)} each
                    </span>
                    {item.product_kind === 'digital' && !item.download_url && (
                      <span className="store-order__muted">
                        Download available once payment is confirmed.
                      </span>
                    )}
                  </div>
                  <div className="store-order__item-side">
                    <strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong>
                    {item.download_url && (
                      <a
                        className="store-btn"
                        href={item.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="store-order__card">
            <h2>Summary</h2>
            <dl className="store-order__totals">
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
              {Number(order.shipping_total) > 0 && (
                <>
                  <dt>Shipping</dt>
                  <dd>{money(order.shipping_total)}</dd>
                </>
              )}
              <dt>Total</dt>
              <dd>{money(order.total)}</dd>
            </dl>
          </section>

          {(lines.length > 0 || order.can_edit_shipping) && (
            <section className="store-order__card">
              <h2>Shipping address</h2>
              {addressNotice && (
                <p
                  className="store-order__hint"
                  role={addressNotice.kind === 'error' ? 'alert' : 'status'}
                >
                  {addressNotice.text}
                </p>
              )}
              {addressEditing && addressForm ? (
                <div>
                  {ADDRESS_FIELDS.map(([key, label]) => {
                    const countryEntry = key === 'region'
                      ? destinations.find((country) => country.code === String(addressForm.country || '').toUpperCase())
                      : null;
                    const regionOptions = countryEntry?.regions || null;
                    return (
                      <label key={key} style={{ display: 'block', marginBottom: '0.5rem' }}>
                        <span className="store-order__hint">{label}</span>
                        {regionOptions ? (
                          <select
                            value={addressForm.region}
                            onChange={(event) => setAddressField(key, event.target.value)}
                            aria-label={label}
                            style={ADDRESS_FIELD_STYLE}
                          >
                            <option value="">Select state / province</option>
                            {regionOptions.map((region) => (
                              <option key={region.code} value={region.code}>{region.code} — {region.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={key === 'email' ? 'email' : 'text'}
                            value={addressForm[key]}
                            maxLength={key === 'country' ? 2 : 250}
                            onChange={(event) => setAddressField(key, event.target.value)}
                            aria-label={label}
                            style={ADDRESS_FIELD_STYLE}
                          />
                        )}
                      </label>
                    );
                  })}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="store-btn"
                      onClick={saveAddress}
                      disabled={addressBusy}
                    >
                      {addressBusy ? 'Saving…' : 'Save address'}
                    </button>
                    <button
                      type="button"
                      className="store-btn store-btn--ghost"
                      onClick={() => setAddressEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <address className="store-order__address">
                    {lines.map((line, index) => (
                      <span key={`${index}-${line}`}>{line}<br /></span>
                    ))}
                  </address>
                  {order.can_edit_shipping ? (
                    <button
                      type="button"
                      className="store-btn store-btn--ghost"
                      onClick={startAddressEdit}
                    >
                      Edit address
                    </button>
                  ) : order.status === 'paid' && (
                    <p className="store-order__hint">
                      The seller already has this order. Message them below to
                      change the delivery address.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {(shipments.length > 0 || hasPhysical) && (
            <section className="store-order__card">
              <h2>Tracking</h2>
              {shipments.length > 0 ? (
                <ul className="store-order__shipments">
                  {shipments.map((shipment) => (
                    <li key={shipment.key}>
                      <strong>{shipment.carrier || 'Shipment'}</strong>
                      {shipment.number && (
                        <span className="store-order__mono">{shipment.number}</span>
                      )}
                      {shipment.date && (
                        <span className="store-order__muted">{formatDate(shipment.date)}</span>
                      )}
                      {shipment.url && (
                        <a href={shipment.url} target="_blank" rel="noopener noreferrer">
                          Track package
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="store-order__hint">
                  Tracking appears here as soon as the seller ships your order.
                </p>
              )}
              {fulfillments.length > 0 && (
                <ul className="store-order__fulfillment">
                  {fulfillments.map((fulfillment, index) => (
                    <li key={`${fulfillment.status}-${index}`} className="store-order__muted">
                      {fulfillmentLabel(fulfillment.status, false)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {order.buyer_note && (
            <section className="store-order__card">
              <h2>Your note</h2>
              <p className="store-order__hint">{order.buyer_note}</p>
            </section>
          )}

          {sellers.length > 0 && (
            <section className="store-order__card">
              <h2>{sellers.length > 1 ? 'Your sellers' : 'Your seller'}</h2>
              <p className="store-order__hint">
                Delivery question? Message whoever is preparing this order —
                {isGuest
                  ? ' as a guest, their reply goes to the email you used at checkout.'
                  : ' the thread and the reply live in your messages.'}
              </p>
              {contactNotice && (
                <p
                  className="store-order__hint"
                  role={contactNotice.kind === 'error' ? 'alert' : 'status'}
                >
                  {contactNotice.text}
                </p>
              )}
              <ul className="store-order__items">
                {sellers.map((seller) => (
                  <li key={seller.id}>
                    <div className="store-order__item-main">
                      <span className="store-order__item-title">
                        {seller.username || 'Seller'}
                      </span>
                      {seller.username && (
                        <Link
                          className="store-order__seller-link"
                          to={`/store/sellers/${encodeURIComponent(seller.username)}`}
                        >
                          Visit store
                        </Link>
                      )}
                    </div>
                    {contactSellerId === seller.id ? (
                      <div className="store-order__item-side">
                        <textarea
                          rows={4}
                          maxLength={4000}
                          value={contactBody}
                          onChange={(event) => setContactBody(event.target.value)}
                          placeholder="Describe the issue with this order"
                          aria-label="Message to the seller"
                          style={{
                            width: '100%',
                            minWidth: '260px',
                            minHeight: '96px',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            border: '1px solid #d8dee9',
                            font: 'inherit',
                            resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="store-btn"
                            onClick={() => sendSellerMessage(seller)}
                            disabled={contactBusy || !contactBody.trim()}
                          >
                            {contactBusy ? 'Sending…' : 'Send message'}
                          </button>
                          <button
                            type="button"
                            className="store-btn store-btn--ghost"
                            onClick={() => {
                              setContactSellerId(null);
                              setContactBody('');
                              setContactNotice(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="store-btn"
                        onClick={() => {
                          setContactSellerId(seller.id);
                          setContactNotice(null);
                        }}
                      >
                        Message {seller.username || 'the seller'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="store-order__hint">
            Need help with this order? <Link to="/contact">Contact support</Link>.
          </p>
        </>
      )}
    </section>
  );
}
