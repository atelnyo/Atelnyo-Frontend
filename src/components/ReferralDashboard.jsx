/**
 * src/components/ReferralDashboard.jsx
 *
 * Phase 39 — Referral & Affiliate Dashboard.
 * Refactored for immersive UI (Phase 57 glassmorphism refresh).
 *
 * Shows:
 *   • Referral code + copy/share buttons
 *   • Stats (total referrals, active, earned, pending)
 *   • Commission rates table
 *   • Referrals list (who you referred)
 *   • Commission history (what you earned)
 *
 * Backed by GET /api/referral/code/ + /stats/ + /referrals/ + /commissions/
 */
import React, { useEffect, useState, useCallback } from 'react';
import { referralService } from '../services/api';

function fmtCurrency(n) {
  if (n == null || !Number.isFinite(Number(n))) return '$0.00';
  return `$${Number(n).toFixed(2)}`;
}

function StatCard({ icon, label, value }) {
  return (
    <div className="rd-stat-card">
      <div className="rd-stat-icon">
        <i className={`fas ${icon}`} aria-hidden="true" />
      </div>
      <div className="rd-stat-body">
        <div className="rd-stat-value">{value}</div>
        <div className="rd-stat-label">{label}</div>
      </div>
    </div>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <button type="button" className="rd-copy-btn" onClick={handleCopy}>
      <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
      {copied ? 'Copied!' : label || 'Copy'}
    </button>
  );
}

export default function ReferralDashboard({ lang, showToast }) {
  const [code, setCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, refsRes, comsRes] = await Promise.allSettled([
        referralService.code(),
        referralService.stats(),
        referralService.referrals(10),
        referralService.commissions(10),
      ]);
      setCode(codeRes.status === 'fulfilled' ? codeRes.value.data : null);
      setStats(statsRes.status === 'fulfilled' ? statsRes.value.data : null);
      setReferrals(refsRes.status === 'fulfilled'
        ? (refsRes.value.data?.results || refsRes.value.data || [])
        : []);
      setCommissions(comsRes.status === 'fulfilled'
        ? (comsRes.value.data?.results || comsRes.value.data || [])
        : []);
    } catch (e) {
      showToast?.('Could not load referral data', 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="rd-page">
        <div className="rd-loading">
          <i className="fas fa-spinner fa-spin fa-2x" aria-hidden="true" />
          <span>
            {lang === 'ht' ? 'Ap chaje referans yo...' : 'Loading referral data...'}
          </span>
        </div>
      </div>
    );
  }

  const t = (en, ht) => lang === 'ht' ? (ht || en) : en;

  return (
    <div className="rd-page">
      {/* ─── Sticky Header ──────────────────────────────────────── */}
      <header className="rd-header">
        <div className="rd-header-inner">
          <h1 className="rd-header-title">
            <i className="fas fa-share-nodes" aria-hidden="true" />
            {t('Referral', 'Referral')}
          </h1>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="rd-hero">
        <div className="rd-hero-grad" />
        <div className="rd-hero-content">
          <div className="rd-hero-icon">
            <i className="fas fa-gift" aria-hidden="true" />
          </div>
          <h1 className="rd-hero-title">
            {t('Referral', 'Referral')}
          </h1>
          <p className="rd-hero-desc">
            {t(
              'Invite friends and earn commissions on their purchases!',
              'Envite zanmi ou yo epi touche kominisyon sou acha yo!',
            )}
          </p>
        </div>
      </section>

      <div className="rd-body">
        <div className="rd-body-inner">
          {/* ─── Referral Code Card ─────────────────────────────── */}
          {code && (
            <section className="rd-card rd-card-code">
              <h2 className="rd-card-title">
                <i className="fas fa-qrcode" aria-hidden="true" />
                {t('Your Referral Code', 'Kòd Referral ou')}
              </h2>
              <div className="rd-code-value">{code.code}</div>
              <div className="rd-code-actions">
                <CopyButton
                  text={code.code}
                  label={t('Copy Code', 'Kopye Kòd')}
                />
                <CopyButton
                  text={code.referral_link}
                  label={t('Copy Link', 'Kopye Lyen')}
                />
                <button
                  type="button"
                  className="rd-share-btn"
                  onClick={() => {
                    const text = `${t('Join me on Atelnyo!', 'Rejwenn mwen sou Atelnyo!')} ${code.referral_link}`;
                    if (navigator.share) {
                      navigator.share({ title: 'Atelnyo', text });
                    } else {
                      navigator.clipboard.writeText(text);
                      showToast?.(
                        t('Link copied!', 'Lyen kopye!'),
                        'check-circle',
                      );
                    }
                  }}
                >
                  <i className="fas fa-share-alt" aria-hidden="true" />
                  {t('Share', 'Pataje')}
                </button>
              </div>
            </section>
          )}

          {/* ─── Stats Grid ─────────────────────────────────────── */}
          {stats && (
            <section className="rd-section">
              <h2 className="rd-section-title">
                <i className="fas fa-chart-bar" aria-hidden="true" />
                {t('Your Performance', 'Pèfòmans ou')}
              </h2>
              <div className="rd-stats-grid">
                <StatCard
                  icon="fa-users"
                  label={t('Total Referrals', 'Total Referrals')}
                  value={stats.total_referrals}
                />
                <StatCard
                  icon="fa-user-check"
                  label={t('Active', 'Aktif')}
                  value={stats.active_referrals}
                />
                <StatCard
                  icon="fa-dollar-sign"
                  label={t('Total Earned', 'Total Touche')}
                  value={fmtCurrency(stats.total_earned)}
                />
                <StatCard
                  icon="fa-clock"
                  label={t('Pending', 'An Atant')}
                  value={fmtCurrency(stats.pending_commissions)}
                />
              </div>
            </section>
          )}

          {/* ─── Commission Rates ───────────────────────────────── */}
          {stats?.rates && (
            <section className="rd-section">
              <h2 className="rd-section-title">
                <i className="fas fa-percentage" aria-hidden="true" />
                {t('Commission Rates', 'To Kominisyon')}
              </h2>
              <div className="rd-rates">
                <div className="rd-rate-item">
                  <div className="rd-rate-badge">
                    <i className="fas fa-shopping-cart" aria-hidden="true" />
                  </div>
                  <div className="rd-rate-body">
                    <span className="rd-rate-label">{t('Marketplace', 'Marketplace')}</span>
                    <span className="rd-rate-pct">{stats.rates.order}%</span>
                  </div>
                </div>
                <div className="rd-rate-item">
                  <div className="rd-rate-badge rd-rate-badge--event">
                    <i className="fas fa-ticket-alt" aria-hidden="true" />
                  </div>
                  <div className="rd-rate-body">
                    <span className="rd-rate-label">{t('Events', 'Evènman')}</span>
                    <span className="rd-rate-pct">{stats.rates.event_ticket}%</span>
                  </div>
                </div>
                <div className="rd-rate-item">
                  <div className="rd-rate-badge rd-rate-badge--premium">
                    <i className="fas fa-crown" aria-hidden="true" />
                  </div>
                  <div className="rd-rate-body">
                    <span className="rd-rate-label">{t('Premium', 'Premium')}</span>
                    <span className="rd-rate-pct">{stats.rates.premium}%</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── Your Referrals ─────────────────────────────────── */}
          <section className="rd-section">
            <h2 className="rd-section-title">
              <i className="fas fa-user-plus" aria-hidden="true" />
              {t('People You Invited', 'Moun ou envite')}
            </h2>
            {referrals.length === 0 ? (
              <div className="rd-empty">
                <div className="rd-empty-icon">
                  <i className="fas fa-user-plus" aria-hidden="true" />
                </div>
                <p>{t('No referrals yet. Share your code!', 'Ou poko envite pèsòn. Pataje kòd ou!')}</p>
              </div>
            ) : (
              <div className="rd-list">
                {referrals.map((r) => (
                  <div key={r.id} className="rd-list-item">
                    <div className="rd-list-avatar">
                      {r.referred_username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="rd-list-body">
                      <span className="rd-list-name">{r.referred_username}</span>
                      <div className="rd-list-meta">
                        <span className={`rd-status rd-status--${r.status}`}>{r.status}</span>
                        {r.total_commission > 0 && (
                          <span className="rd-list-earned">+{fmtCurrency(r.total_commission)}</span>
                        )}
                      </div>
                    </div>
                    <i className="fas fa-chevron-right rd-list-arrow" aria-hidden="true" />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Commission History ─────────────────────────────── */}
          <section className="rd-section rd-section-last">
            <h2 className="rd-section-title">
              <i className="fas fa-coins" aria-hidden="true" />
              {t('Commission History', 'Kominisyon')}
            </h2>
            {commissions.length === 0 ? (
              <div className="rd-empty">
                <div className="rd-empty-icon">
                  <i className="fas fa-coins" aria-hidden="true" />
                </div>
                <p>{t('No commissions yet. Keep sharing!', 'Poko gen kominisyon. Kontinye pataje!')}</p>
              </div>
            ) : (
              <div className="rd-list">
                {commissions.map((c) => (
                  <div key={c.id} className="rd-list-item">
                    <div className="rd-list-avatar rd-list-avatar--coin">
                      <i className="fas fa-coins" aria-hidden="true" />
                    </div>
                    <div className="rd-list-body">
                      <span className="rd-list-name">
                        {fmtCurrency(c.amount)}
                      </span>
                      <div className="rd-list-meta">
                        <span className={`rd-status rd-status--${c.status}`}>{c.status}</span>
                        <span className="rd-list-source">
                          {c.rate_pct}% · {c.source_type} · {c.referred_username}
                        </span>
                      </div>
                    </div>
                    <i className="fas fa-chevron-right rd-list-arrow" aria-hidden="true" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
