/**
 * src/modules/premium/components/PremiumPreview.jsx
 *
 * Premium Preview Modal — redesigned for faster conversion.
 * CTA button is immediately visible at the top (no scrolling needed).
 * Features and pricing are side-by-side on desktop, stacked on mobile.
 *
 * Layout:
 *   Header → CTA (always visible) → Features (compact) → Pricing → Footer
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PREMIUM_FEATURES, PREMIUM_PLANS } from '../constants/premiumFeatures';

/* ─── i18n helper ────────────────────────────────────────────── */
const T = (obj, lang, fallback) => {
  if (!obj) return fallback || '';
  return obj[lang] || obj.en || fallback || '';
};

export default function PremiumPreview({ isOpen, onClose, lang = 'ht', user, onOpenCheckout }) {
  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const [notified, setNotified] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
      setSelectedPlan('monthly');
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) onClose?.();
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && isOpen) onClose?.();
  };

  const handleNotifyMe = () => {
    setNotified(true);
    setTimeout(() => setNotified(false), 3000);
  };

  const handlePay = () => {
    if (!user) { handleNotifyMe(); return; }
    const selected = PREMIUM_PLANS.find((p) => p.id === selectedPlan) || PREMIUM_PLANS[0];
    onOpenCheckout?.('premium', selected?.price || 4.99, { plan: selected?.id || 'monthly', amount: selected?.price || 4.99 });
    onClose?.();
  };

  if (!isOpen) return null;

  const selected = PREMIUM_PLANS.find((p) => p.id === selectedPlan) || PREMIUM_PLANS[0];

  return (
    <div
      className={`pp-overlay ${animateIn ? 'pp-overlay--visible' : ''}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Premium Preview"
    >
      <div
        className={`pp-content ${animateIn ? 'pp-content--visible' : ''}`}
        ref={contentRef}
        style={{ maxWidth: 680 }}
      >
        {/* ─── Header (compact) ──────────────────────────── */}
        <div className="pp-header" style={{ paddingBottom: 8 }}>
          <button className="pp-close-btn" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="pp-header-icon" style={{ width: 36, height: 36, fontSize: '1rem' }}>
              <i className="fas fa-crown" />
            </div>
            <h2 className="pp-title" style={{ fontSize: '1.15rem', margin: 0 }}>
              {T({ ht: 'Atelnyo Premium', en: 'Atelnyo Premium' }, lang)}
            </h2>
          </div>
          <p className="pp-subtitle" style={{ fontSize: '0.8rem', margin: 0 }}>
            {T({
              ht: 'Bèl avantaj, gwo valè.',
              en: 'Great perks, great value.',
            }, lang)}
          </p>
        </div>

        {/* ─── IMMEDIATE CTA — always visible, no scroll ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(251, 191, 36, 0.04))',
          border: '1.5px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                  padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600,
                }}>
                  <i className="fas fa-circle" style={{ fontSize: 5 }} /> LIVE
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                  {T({ ht: 'Kòmanse kounye a!', en: 'Start now!' }, lang)}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', margin: 0, lineHeight: 1.4 }}>
                {T({
                  ht: 'Peye ak PayPal oswa Stripe. Aktif otomatikman.',
                  en: 'Pay with PayPal or Stripe. Activates instantly.',
                }, lang)}
              </p>
            </div>
            <button
              onClick={handlePay}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #d81b60, #ff5e8a)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(216, 27, 96, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fab fa-paypal" />
              ${selected.price}/mo
            </button>
          </div>
        </div>

        {/* ─── Features + Pricing side-by-side ────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Left: Compact feature list */}
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-gem" style={{ color: '#f59e0b', fontSize: '0.7rem' }} />
              {T({ ht: 'Avantaj', en: 'Benefits' }, lang)}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PREMIUM_FEATURES.slice(0, 6).map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${f.color}15`, color: f.color, fontSize: '0.6rem', flexShrink: 0,
                  }}>
                    <i className={`fas ${f.icon}`} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)', lineHeight: 1.3 }}>
                    {T(f.title, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Compact pricing cards */}
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-tags" style={{ color: '#d81b60', fontSize: '0.7rem' }} />
              {T({ ht: 'Pri', en: 'Pricing' }, lang)}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PREMIUM_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    border: selectedPlan === plan.id
                      ? '1.5px solid #d81b60'
                      : '1.5px solid var(--border-color, #e2e8f0)',
                    background: selectedPlan === plan.id ? 'rgba(216, 27, 96, 0.04)' : 'var(--bg-secondary, #f8fafc)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: selectedPlan === plan.id ? '2px solid #d81b60' : '2px solid #ccc',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s ease',
                  }}>
                    {selectedPlan === plan.id && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d81b60' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                      {T(plan.label, lang)}
                    </div>
                    {plan.savings && (
                      <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>
                        <i className="fas fa-leaf" style={{ fontSize: '0.5rem' }} /> {T(plan.savings, lang)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#d81b60' }}>${plan.price}</span>
                    {plan.period && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary, #64748b)', display: 'block' }}>
                        {T(plan.period, lang)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Footer (compact) ───────────────────────────── */}
        <div style={{
          textAlign: 'center', padding: '10px 0 0',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
        }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
            <i className="fas fa-shield-alt" style={{ marginRight: 4 }} />
            {T({
              ht: 'Sekirite PayPal/Stripe. Anile nenpòt moman.',
              en: 'Secure PayPal/Stripe. Cancel anytime.',
            }, lang)}
          </p>
        </div>
      </div>
    </div>
  );
}
