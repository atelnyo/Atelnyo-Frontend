import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { storeService } from './storeService';

export default function StoreClaimPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error
  const [message, setMessage] = useState('');

  if (!orderId || !token) {
    return (
      <section className="store-state">
        <h1 className="store-title">Link not valid</h1>
        <p>This account link is incomplete. Check the link in your email.</p>
      </section>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      await storeService.claimOrder(orderId, token, password);
      setStatus('done');
    } catch (err) {
      const data = err?.response?.data || {};
      const detail = data.detail || (Array.isArray(data.password) ? data.password.join(' ') : '');
      setMessage(String(detail || 'This link could not be used.'));
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <section className="store-state">
        <Helmet>
          <title>Account created · Atelnyo Store</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <h1 className="store-title">Account created</h1>
        <p>Your order is now linked to your account.</p>
        <p><Link to="/store/login?next=%2Faccount">Sign in</Link></p>
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
    </section>
  );
}
