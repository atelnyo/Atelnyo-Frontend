/**
 * src/components/profile/ProfileContactModal.jsx
 *
 * Contact actions modal for the Creator Public Profile — REAL backend
 * connections (previously the ActionBar buttons just toasted "coming
 * soon" while the endpoints existed and were never called):
 *
 *   - message → POST /creator-profiles/<slug>/send-message/
 *   - hire    → POST /creator-profiles/<slug>/hire/
 *   - collab  → POST /creator-profiles/<slug>/collaborate/
 *   - tip     → POST /creator-profiles/<slug>/tip/
 *   - book    → POST /creator-profiles/<slug>/book-service/
 *
 * Modes: 'message' | 'hire' | 'collab' | 'tip' | 'book'. Each mode renders its own field
 * set, validates required fields client-side, posts to the real endpoint,
 * and surfaces success (toast) / failure (inline error) states.
 *
 * Props:
 *   mode          — 'message' | 'hire' | 'collab' | 'tip' | 'book'
 *   username      — profile slug (for profile endpoints)
 *   creatorId     — the creator's USER id (required for the real tip
 *                   endpoint /api/tips/send/)
 *   lang          — 'ht' | 'en' | 'es' | 'fr'
 *   t             — translations object
 *   showToast     — toast helper (fn(message, icon))
 *   onClose       — close the modal
 *   onOpenWallet  — navigate to /sheet/wallet (used when a tip fails
 *                   with insufficient balance so the visitor can top up)
 *   presetSubject — optional pre-filled subject (affiliate/campaigns
 *                   buttons open message mode with a ready-made subject)
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { creatorProfileService, walletService, paymentConfigService } from '../../services/api';

// ─── PayPal SDK loader (injected once, capture intent) ─────────────────
// Mirrors DepositModal/CheckoutModal — the app loads the SDK from the
// PayPal CDN with the publishable client id (no secrets ever touch the
// frontend).
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

const MODE_CONFIG = {
  message: {
    icon: 'fa-envelope',
    titleKey: 'profile_message_title',
    fields: [
      { name: 'subject', type: 'text', labelKey: 'profile_contact_subject', required: false, placeholderKey: 'profile_contact_subject_ph' },
      { name: 'body', type: 'textarea', labelKey: 'profile_contact_body', required: true, placeholderKey: 'profile_contact_body_ph' },
    ],
    send: (ctx, f) => creatorProfileService.sendMessage(ctx.username, {
      subject: f.subject,
      body: f.body,
    }),
    sentKey: 'profile_contact_sent_message',
  },
  hire: {
    icon: 'fa-briefcase',
    titleKey: 'profile_hire_title',
    fields: [
      { name: 'project_title', type: 'text', labelKey: 'profile_contact_project_title', required: true, placeholderKey: 'profile_contact_project_title_ph' },
      { name: 'description', type: 'textarea', labelKey: 'profile_contact_description', required: false, placeholderKey: 'profile_contact_description_ph' },
      { name: 'budget', type: 'text', labelKey: 'profile_contact_budget', required: false, placeholderKey: 'profile_contact_budget_ph' },
      { name: 'timeline', type: 'text', labelKey: 'profile_contact_timeline', required: false, placeholderKey: 'profile_contact_timeline_ph' },
    ],
    send: (ctx, f) => creatorProfileService.hire(ctx.username, {
      project_title: f.project_title,
      description: f.description,
      budget: f.budget,
      timeline: f.timeline,
    }),
    sentKey: 'profile_contact_sent_hire',
  },
  collab: {
    icon: 'fa-handshake',
    titleKey: 'profile_collab_title',
    fields: [
      { name: 'idea', type: 'text', labelKey: 'profile_contact_idea', required: true, placeholderKey: 'profile_contact_idea_ph' },
      { name: 'description', type: 'textarea', labelKey: 'profile_contact_description', required: false, placeholderKey: 'profile_contact_description_ph' },
    ],
    send: (ctx, f) => creatorProfileService.collaborate(ctx.username, {
      idea: f.idea,
      description: f.description,
    }),
    sentKey: 'profile_contact_sent_collab',
  },
  // Phase 60 — REAL tip: POST /api/tips/send/ debits the visitor's
  // wallet and credits the creator's wallet (atomic, min $0.50) instead
  // of the old notification-only /creator-profiles/<slug>/tip/.
  tip: {
    icon: 'fa-hand-holding-heart',
    titleKey: 'profile_tip_title',
    fields: [
      { name: 'amount', type: 'text', labelKey: 'profile_contact_amount', required: true, placeholderKey: 'profile_contact_amount_ph' },
      { name: 'message', type: 'textarea', labelKey: 'profile_contact_tip_message', required: false, placeholderKey: 'profile_contact_tip_message_ph' },
    ],
    send: (ctx, f) => walletService.sendTip({
      creator_id: Number(ctx.creatorId),
      amount: Number.parseFloat(f.amount),
      message: f.message || '',
    }),
    sentKey: 'profile_contact_sent_tip',
  },
  book: {
    icon: 'fa-calendar-check',
    titleKey: 'profile_book_title',
    fields: [
      { name: 'service_name', type: 'text', labelKey: 'profile_contact_service_name', required: true, placeholderKey: 'profile_contact_service_name_ph' },
      { name: 'description', type: 'textarea', labelKey: 'profile_contact_description', required: false, placeholderKey: 'profile_contact_description_ph' },
      { name: 'preferred_date', type: 'text', labelKey: 'profile_contact_preferred_date', required: false, placeholderKey: 'profile_contact_preferred_date_ph' },
    ],
    send: (ctx, f) => creatorProfileService.bookService(ctx.username, {
      service_name: f.service_name,
      description: f.description,
      preferred_date: f.preferred_date,
    }),
    sentKey: 'profile_contact_sent_book',
  },
};

export default function ProfileContactModal({
  mode = 'message',
  username,
  // The creator's USER id — only the tip mode needs it (real wallet
  // transfer via /api/tips/send/).
  creatorId = null,
  lang = 'ht',
  t = {},
  showToast,
  onClose,
  // Navigate to /sheet/wallet — used when a tip fails with 402
  // (insufficient balance) so the visitor can top up and come back.
  onOpenWallet,
  presetSubject = '',
  // The logged-in user (null = anonymous) + a callback that opens the
  // auth modal WITHOUT leaving the profile. Anonymous visitors can still
  // compose a message; the login gate fires when they press Send, and
  // the send completes automatically after they sign in/up.
  user = null,
  onAuthRequired,
}) {
  const isHt = lang === 'ht';
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.message;

  const [form, setForm] = useState(() => {
    const initial = {};
    cfg.fields.forEach((f) => { initial[f.name] = ''; });
    if (mode === 'message' && presetSubject) initial.subject = presetSubject;
    return initial;
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  // True after a 402 from the tip endpoint — the visitor's wallet
  // balance is too low. The modal then offers a DIRECT PayPal payment
  // (no wallet needed) so non-creators can tip without funding a wallet.
  const [needFunds, setNeedFunds] = useState(false);
  // Direct-PayPal tip state: idle → loading (SDK + order) → ready
  // (buttons rendered) → processing (capturing) → done/failed.
  const [ppPhase, setPpPhase] = useState('idle');
  const [ppOrder, setPpOrder] = useState(null); // { paypal_order_id, amount, fee, net_amount }
  const [paypal, setPaypal] = useState(null);
  const [ppError, setPpError] = useState(null);
  const ppContainerRef = useRef(null);
  const ppProcessingRef = useRef(false);
  const firstFieldRef = useRef(null);
  // Pending-send intent: an anonymous visitor pressed Send → the auth
  // modal opens over the profile; once they sign in, the message sends
  // automatically with the exact payload they composed (see the
  // user-transition effect below). Cleared when the modal closes.
  const pendingSendRef = useRef(null);

  // Cancelling the contact modal drops any pending send intent (a stale
  // intent must not fire a message the visitor no longer sees composed).
  const handleClose = useCallback(() => {
    pendingSendRef.current = null;
    onClose();
  }, [onClose]);

  // Focus the first field on open + Escape closes + body scroll lock.
  // handleClose (not onClose) so closing also drops any pending send.
  useEffect(() => {
    firstFieldRef.current?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [handleClose]);

  const handleChange = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  }, [error]);

  const missingRequired = cfg.fields
    .filter((f) => f.required)
    .some((f) => !String(form[f.name] || '').trim());

  // The actual send (API + success toast + close / inline error). Used
  // both by Send (logged-in users) and by the after-login effect (an
  // anonymous visitor who signed in to send).
  const performSend = useCallback((payload) => {
    setSending(true);
    setError(null);
    setNeedFunds(false);
    cfg.send({ username, creatorId }, payload)
      .then(() => {
        setSending(false);
        showToast?.(t[cfg.sentKey] || (isHt ? 'Voye!' : 'Sent!'), 'check-circle');
        onClose();
      })
      .catch((err) => {
        setSending(false);
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setError(t.profile_contact_need_auth || (isHt
            ? 'Ou dwe konekte pou voye mesaj.'
            : 'Please log in to send messages.'));
        } else if (status === 402 && mode === 'tip') {
          // Real tip path: wallet balance too low → offer a top-up.
          setNeedFunds(true);
          setError(t.profile_tip_need_funds || (isHt
            ? 'Balans bous ou pa ase pou tip sa a.'
            : 'Insufficient wallet balance for this tip.'));
        } else {
          // Surface the server's own message when it sends one (e.g. a
          // 400 "Project title is required.") instead of a generic line.
          setError(
            err?.response?.data?.error
            || err?.response?.data?.detail
            || t.profile_contact_error
            || (isHt ? 'Erè voye. Eseye ankò.' : 'Error sending. Try again.')
          );
        }
      });
  }, [cfg, username, creatorId, mode, t, showToast, onClose, isHt]);

  const handleSubmit = useCallback(() => {
    if (sending) return;
    // Never hit the API with a missing slug — encodeURIComponent(undefined)
    // would build /creator-profiles/undefined/… instead of failing cleanly.
    if (!username) {
      setError(t.profile_contact_error || (isHt
        ? 'Erè voye. Eseye ankò.'
        : 'Error sending. Try again.'));
      return;
    }
    setTouched(true);
    if (missingRequired) {
      setError(t.profile_contact_required || (isHt ? 'Champ obligatwa a vid.' : 'Required fields are empty.'));
      return;
    }
    // Tip mode: the amount must parse to a number ≥ $0.50 (the backend
    // enforces the same minimum; catching it here keeps the error in
    // the visitor's language).
    if (mode === 'tip') {
      const amt = Number.parseFloat(form.amount);
      if (!Number.isFinite(amt) || amt < 0.5) {
        setError(t.profile_tip_min || (isHt
          ? 'Tip minimòm se $0.50.'
          : 'Minimum tip is $0.50.'));
        return;
      }
    }
    if (!user) {
      // Anonymous visitor: remember the exact composed payload and open
      // the auth modal IN PLACE (no redirect — the contact modal stays
      // open with their message). The send fires automatically once
      // they sign in or sign up.
      pendingSendRef.current = { ...form };
      onAuthRequired?.();
      return;
    }
    performSend(form);
  }, [sending, missingRequired, cfg, username, form, t, showToast, onClose, isHt, user, performSend, onAuthRequired]);

  // After an anonymous visitor signs in (user flips to truthy) with a
  // pending send, deliver the message automatically. They never leave
  // the profile — the auth modal just closes over the contact modal.
  useEffect(() => {
    if (user && pendingSendRef.current) {
      const payload = pendingSendRef.current;
      pendingSendRef.current = null;
      performSend(payload);
    }
  }, [user, performSend]);

  // ── Phase 60 — Direct PayPal tip (insufficient wallet balance) ──────
  // The visitor pays straight through PayPal: server creates the order,
  // the PayPal SDK renders its buttons, onApprove captures server-side
  // and the creator's wallet is credited the NET amount (creator pays
  // the PayPal fee). No wallet balance needed — the whole flow stays in
  // this modal, on the profile.
  const startPayPalFlow = useCallback(async () => {
    if (!user) return;
    setPpPhase('loading');
    setPpError(null);
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
      const amount = Number.parseFloat(form.amount);
      const res = await walletService.tipPaypalOrder({
        creator_id: Number(creatorId),
        amount,
        message: (form.message || '').slice(0, 280),
      });
      const order = res?.data;
      if (!order?.paypal_order_id) throw new Error('no order');
      setPpOrder(order);
      setPpPhase('ready');
    } catch (err) {
      setPpPhase('failed');
      setPpError(err?.response?.data?.error || err?.message || (isHt
        ? 'Pa t kapab kòmanse peman an.'
        : 'Could not start the payment.'));
    }
  }, [user, creatorId, form, t, isHt]);

  // Render the PayPal buttons once the order exists (mirrors the
  // DepositModal contract: the frontend only exchanges safe order ids).
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
          await walletService.tipPaypalCapture({
            paypal_order_id: ppOrder.paypal_order_id,
            message: (form.message || '').slice(0, 280),
          });
          showToast?.(t[cfg.sentKey] || (isHt ? 'Voye!' : 'Sent!'), 'check-circle');
          onClose();
        } catch (err) {
          setPpPhase('failed');
          setPpError(err?.response?.data?.error || err?.message || (isHt
            ? 'Peman echwe. Tanpri eseye ankò.'
            : 'Payment failed. Please try again.'));
        } finally {
          ppProcessingRef.current = false;
        }
      },
      onCancel: () => setPpPhase('idle'),
      onError: () => {
        setPpPhase('failed');
        setPpError(t.profile_tip_paypal_unavailable || (isHt
          ? 'PayPal poko disponib kounye a.'
          : 'PayPal is not available right now.'));
      },
    });
    buttons.render(container).then(() => {
      if (container) container.dataset.renderedFor = ppOrder.paypal_order_id;
    }).catch(() => {
      setPpPhase('failed');
      setPpError(t.profile_tip_paypal_unavailable || (isHt
        ? 'PayPal poko disponib kounye a.'
        : 'PayPal is not available right now.'));
    });
    return () => { try { container.innerHTML = ''; } catch (_) {} };
  }, [ppPhase, paypal, ppOrder, form, t, showToast, onClose, isHt, cfg.sentKey]);

  const title = t[cfg.titleKey] || (isHt ? 'Kontak' : 'Contact');
  const sendLabel = t.profile_contact_send || (isHt ? 'Voye' : 'Send');
  const sendingLabel = t.profile_contact_sending || (isHt ? 'Ap voye...' : 'Sending...');
  const cancelLabel = t.profile_contact_cancel || (isHt ? 'Anile' : 'Cancel');

  return (
    <div className="csp-modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="csp-modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="csp-modal-close" onClick={handleClose} aria-label={cancelLabel}>
          <i className="fas fa-times" aria-hidden="true" />
        </button>

        <div className="csp-modal-body" style={{ padding: '26px 22px 22px' }}>
          <div className="csp-modal-type-badge">
            <i className={`fas ${cfg.icon}`} aria-hidden="true" />
            {mode}
          </div>
          <h2 className="csp-modal-title" style={{ padding: '10px 0 4px', fontSize: '1rem' }}>
            {title}
          </h2>

          <form
            className="csp-contact-form"
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            noValidate
          >
            {cfg.fields.map((field, i) => {
              const label = t[field.labelKey] || field.name;
              const placeholder = t[field.placeholderKey] || '';
              const value = form[field.name] || '';
              const invalid = touched && field.required && !String(value).trim();
              const fieldProps = {
                className: `csp-contact-input${field.type === 'textarea' ? ' csp-contact-textarea' : ''}${invalid ? ' csp-contact-input--invalid' : ''}`,
                id: `csp-contact-${field.name}`,
                name: field.name,
                value,
                placeholder,
                onChange: (e) => handleChange(field.name, e.target.value),
                'aria-invalid': invalid || undefined,
              };
              return (
                <div className="csp-contact-field" key={field.name}>
                  <label className="csp-contact-label" htmlFor={`csp-contact-${field.name}`}>
                    {label}{field.required ? <span className="csp-contact-required" aria-hidden="true"> *</span> : null}
                  </label>
                  {field.type === 'textarea'
                    ? <textarea rows={3} {...fieldProps} />
                    : <input ref={i === 0 ? firstFieldRef : undefined} {...fieldProps} />}
                  {invalid && (
                    <span className="csp-contact-field-error" role="alert">
                      {t.profile_contact_required || (isHt ? 'Champ obligatwa.' : 'Required field.')}
                    </span>
                  )}
                </div>
              );
            })}

            {error && (
              <div className="csp-contact-error" role="alert">
                <i className="fas fa-exclamation-triangle" aria-hidden="true" /> {error}
              </div>
            )}

            <div className="csp-modal-actions" style={{ marginTop: 18, borderTop: 'none', paddingTop: 0 }}>
              {needFunds ? (
                // Insufficient wallet balance → the visitor can pay
                // DIRECTLY with PayPal (no wallet needed), or top up.
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
              )
              : (
                <>
                  <button
                    type="button"
                    className="csp-modal-btn csp-modal-btn--secondary"
                    onClick={handleClose}
                    disabled={sending}
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="submit"
                    className="csp-modal-btn csp-modal-btn--primary"
                    disabled={sending}
                  >
                    {sending
                      ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {sendingLabel}</>
                      : <><i className="fas fa-paper-plane" aria-hidden="true" /> {sendLabel}</>}
                  </button>
                </>
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
          </form>
        </div>
      </div>
    </div>
  );
}
