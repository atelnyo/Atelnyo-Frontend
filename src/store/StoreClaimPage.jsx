import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { storeService } from './storeService';
import { useAuthStore } from './useAuthStore';

const MY_ORDERS = '/business/orders/mine';

/**
 * A guest who lost the claim link (closed the email, cleared the browser,
 * opened it on another phone) can have it re-sent. The backend answers the
 * same way whether or not the pair matches, so this form never reveals
 * whether an order or an address exists.
 */
function RequestLinkForm({ defaultOrderId = '' }) {
  const [orderId, setOrderId] = useState(defaultOrderId || '');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [notice, setNotice] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    setState('sending');
    setNotice('');
    try {
      const res = await storeService.requestClaimLink(orderId, email);
      setNotice(
        res?.data?.detail
          || 'If those details match an unclaimed order, we emailed the link.',
      );
      setState('done');
    } catch {
      setNotice('Could not send the link. Try again in a moment.');
      setState('error');
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
      <p>Lost the link? Enter the order number and the email you used at checkout.</p>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Order number
        <input
          required
          inputMode="numeric"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="submit" className="store-btn" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me the link'}
      </button>
      {notice && (
        <p role={state === 'error' ? 'alert' : 'status'}>{notice}</p>
      )}
    </form>
  );
}

export default function StoreClaimPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = params.get('order');
  const token = params.get('token');
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [message, setMessage] = useState('');
  const [signInLink, setSignInLink] = useState('');

  if (!orderId || !token) {
    return (
      <section className="store-state">
        <h1 className="store-title">Link not valid</h1>
        <p>
          This account link is incomplete. Check the link in your email — or
          have a new one sent.
        </p>
        <RequestLinkForm defaultOrderId={orderId} />
      </section>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');
    setSignInLink('');
    try {
      const res = await storeService.claimOrder(orderId, token, password);
      const data = res?.data || {};
      // A freshly created account is signed in straight away, so the shopper
      // lands on their orders instead of a "sign in" dead end. A signed-in
      // shopper (data.created === false) already has a session.
      if (data.created && password) {
        await login({ email: data.email, password });
      }
      setStatus('done');
    } catch (err) {
      const data = err?.response?.data || {};
      const detail = data.detail || (Array.isArray(data.password) ? data.password.join(' ') : '');
      setMessage(String(detail || 'This link could not be used.'));
      setStatus('error');
      if (data.code === 'account_exists' || data.code === 'email_mismatch') {
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        setSignInLink(`/store/login?next=${next}`);
      }
    }
  };

  const onSwitchAccount = async () => {
    await logout();
    navigate(signInLink, { replace: true });
  };

  if (status === 'done') {
    return (
      <section className="store-state">
        <Helmet>
          <title>Order linked · Atelnyo Store</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <h1 className="store-title">Order linked</h1>
        <p>Order #{orderId} is now linked to your account.</p>
        <p>
          {user ? (
            <Link to={MY_ORDERS}>View my orders</Link>
          ) : (
            <Link to={`/store/login?next=${encodeURIComponent(MY_ORDERS)}`}>Sign in to see it</Link>
          )}
        </p>
      </section>
    );
  }

  const signInActions = signInLink && (
    <p className="store-state__actions">
      {user ? (
        <>
          <button type="button" className="store-btn store-btn--ghost" onClick={onSwitchAccount}>
            Sign in with the order email
          </button>
        </>
      ) : (
        <Link to={signInLink} className="store-btn">Sign in to claim this order</Link>
      )}
    </p>
  );

  // Signed in: the token from the email is enough — no new password, and no
  // second account. The backend refuses if the session's email differs.
  if (user) {
    return (
      <section className="store-state">
        <Helmet>
          <title>Link this order · Atelnyo Store</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <h1 className="store-title">Link this order</h1>
        <p>
          Order #{orderId} was placed with an email before you signed in. Link it to{' '}
          {user.email || 'your account'} to follow it from My orders.
        </p>
        <form onSubmit={onSubmit}>
          <button type="submit" className="store-btn" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Linking…' : 'Link order to my account'}
          </button>
        </form>
        {message && <p role="alert" className="store-state store-state--error">{message}</p>}
        {signInActions}
      </section>
    );
  }

  return (
    <section className="store-state">
      <Helmet>
        <title>Create your account · Atelnyo Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 className="store-title">Create your account</h1>
      <p>Set a password to create your account and keep access to order #{orderId}.</p>
      <form onSubmit={onSubmit}>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="store-btn" disabled={status === 'submitting'}>
          Create account
        </button>
      </form>
      {message && <p role="alert" className="store-state store-state--error">{message}</p>}
      {signInActions}
      {status === 'error' && <RequestLinkForm defaultOrderId={orderId} />}
    </section>
  );
}
