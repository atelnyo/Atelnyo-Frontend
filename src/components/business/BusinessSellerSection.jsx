/**
 * src/components/business/BusinessSellerSection.jsx
 *
 * Phase 5 — Seller capability management for a Business Profile.
 *
 * Shows the seller gate: the capability status (inactive/active) and
 * the OWNER's live KYC status (the existing account-level
 * IdentityVerification gate — no business-specific PII). Activation
 * is owner-initiated; the backend refuses without an approved KYC
 * and returns the reason, which this section renders with a pointer
 * to the wallet/identity verification flow.
 *
 * Data flow
 * ---------
 *   GET  /api/business/profiles/<id>/seller/           — status + KYC
 *   POST /api/business/profiles/<id>/seller/activate/  — KYC-gated on
 *   POST /api/business/profiles/<id>/seller/deactivate/— owner soft stop
 */
import React, { useEffect, useState } from 'react';
import { businessProfileService } from '../../services/api';

export default function BusinessSellerSection({
  lang = 'ht', t = {}, showToast, profile,
}) {
  const isHt = lang === 'ht';
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const res = await businessProfileService.seller(profile.id);
      const data = res?.data?.data ?? res?.data ?? null;
      setSeller(data && typeof data === 'object' && data.id ? data : null);
    } catch {
      setSeller(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.id]);

  const kycLabel = (status) => ({
    approved: isHt ? 'Apwouve ✓' : 'Approved ✓',
    pending: isHt ? 'An revizyon' : 'Pending review',
    rejected: isHt ? 'Refize' : 'Rejected',
    unverified: isHt ? 'Pa verifye' : 'Unverified',
    expired: isHt ? 'Ekspire' : 'Expired',
  }[status] || (isHt ? 'Pa konplete' : 'Not completed'));

  const kycColor = {
    approved: '#34d399',
    pending: '#fbbf24',
    rejected: '#f87171',
    unverified: '#94a3b8',
    expired: '#94a3b8',
  }[seller?.kyc_status] || '#94a3b8';

  const runToggle = async (activate) => {
    if (!profile?.id) return;
    setBusy(true);
    try {
      const res = activate
        ? await businessProfileService.sellerActivate(profile.id)
        : await businessProfileService.sellerDeactivate(profile.id);
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) setSeller(data);
      showToast?.(
        activate
          ? (isHt ? 'Seller aktive — kliyan kapab peye kounye a!' : 'Seller active — customers can pay now!')
          : (isHt ? 'Seller dezaktive — kòmand yo tounen lead.' : 'Seller deactivated — orders are leads again.'),
        'check-circle',
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail) {
        showToast?.(detail, 'circle-exclamation');
      } else {
        showToast?.(
          isHt ? 'Aksyon an pa t mache.' : 'The action failed.',
          'circle-exclamation',
        );
      }
      await load(); // refresh the true server state
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="biz-seller" data-testid="business-seller">
        <div className="biz-catalog-loading">
          <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const active = seller?.status === 'active';
  const suspended = seller?.status === 'suspended';
  const kycOk = seller?.kyc_status === 'approved';

  return (
    <div className="biz-seller" data-testid="business-seller">
      <div className="biz-catalog-header">
        <div>
          <h3 className="biz-catalog-title">
            <i className="fas fa-hand-holding-dollar" aria-hidden="true" />
            {t?.business_seller_title || (isHt ? 'Seller Capability' : 'Seller Capability')}
          </h3>
          <p className="biz-catalog-hint">
            {t?.business_seller_hint || (isHt
              ? 'Aktive sa a pou kliyan yo ka peye atik katalòg ou yo ak balans Wallet yo. '
                + 'Seller se yon kapasite biznis ou — li pa chanje pwofil Kreatè ou.'
              : 'Turn this on to let customers pay for your catalog items with their '
                + 'Wallet balance. Seller is a capability of your business — it never '
                + 'changes your Creator Profile.')}
          </p>
        </div>
      </div>

      <div className="biz-ws-card biz-seller-card">
        <div className="biz-seller-status-row">
          <span
            className="biz-status-pill"
            style={{
              background: suspended ? 'rgba(248,113,113,0.15)' : (active ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.12)'),
              color: suspended ? '#f87171' : (active ? '#34d399' : '#94a3b8'),
              border: `1px solid ${suspended ? 'rgba(248,113,113,0.4)' : (active ? 'rgba(52,211,153,0.4)' : 'rgba(148,163,184,0.3)')}`,
            }}
            data-testid="business-seller-status"
          >
            <i className={`fas ${suspended ? 'fa-circle-stop' : (active ? 'fa-circle-check' : 'fa-circle-pause')}`} aria-hidden="true" />
            {suspended
              ? (t?.business_seller_suspended || (isHt ? 'Seller Sispann' : 'Seller Suspended'))
              : (active
                ? (t?.business_seller_active || (isHt ? 'Seller Aktif' : 'Seller Active'))
                : (t?.business_seller_inactive || (isHt ? 'Seller Inaktif' : 'Seller Inactive')))}
          </span>
        </div>

        <p className="biz-ws-card-line" style={{ marginTop: 12 }}>
          <strong>{isHt ? 'KYC (Verifikasyon Idantite):' : 'KYC (Identity Verification):'}</strong>{' '}
          <span style={{ color: kycColor, fontWeight: 700 }}>{kycLabel(seller?.kyc_status)}</span>
        </p>
        <p className="biz-ws-card-line">
          {suspended
            ? (isHt
              ? 'Seller la sispann pa modération platfòm lan — kliyan yo pa ka peye kounye a. Kontakte sipò Atelnyo pou chèche konnen plis.'
              : 'Seller was suspended by platform moderation — customers cannot pay right now. Contact Atelnyo support for details.')
            : active
              ? (isHt
                ? 'Kliyan yo ka peye kòmand yo kounye a. Revni a ale nan Wallet ou (peman yo soti nan sistem Wallet platfòm lan).'
                : 'Customers can pay orders now. Revenue lands in your Wallet (payments settle through the platform wallet system).')
              : kycOk
                ? (isHt
                  ? 'KYC ou apwouve — ou ka aktive Seller nenpòt lè.'
                  : 'Your KYC is approved — you can activate Seller anytime.')
                : (isHt
                  ? 'Ou bezwen KYC apwouve anvan ou ka aktive Seller. Konplete verifikasyon nan anviwònman Wallet ou.'
                  : 'You need an approved KYC before activating Seller. Complete verification in your wallet settings.')}
        </p>

        <div className="biz-form-actions" style={{ marginTop: 14 }}>
          {suspended ? (
            <span className="biz-form-hint" style={{ marginTop: 0 }}>
              <i className="fas fa-shield-halved" aria-hidden="true" />{' '}
              {isHt
                ? 'Aksyon Seller yo fèmen pandan sispansyon an. Lè yo leve l, ou ka re-aktive.'
                : 'Seller actions are locked during the suspension. Once lifted, you can reactivate.'}
            </span>
          ) : active ? (
            <button
              type="button"
              className="biz-btn biz-btn-danger biz-btn-sm"
              onClick={() => runToggle(false)}
              disabled={busy}
              data-testid="business-seller-deactivate"
            >
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-circle-pause'}`} aria-hidden="true" />
              {t?.business_seller_deactivate || (isHt ? 'Dezaktive Seller' : 'Deactivate Seller')}
            </button>
          ) : (
            <button
              type="button"
              className="biz-btn biz-btn-primary biz-btn-sm"
              onClick={() => runToggle(true)}
              disabled={busy || (!kycOk && !active)}
              title={!kycOk && !active
                ? (isHt ? 'KYC apwouve obligatwa' : 'Approved KYC required')
                : undefined}
              data-testid="business-seller-activate"
            >
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-circle-play'}`} aria-hidden="true" />
              {t?.business_seller_activate || (isHt ? 'Aktive Seller' : 'Activate Seller')}
            </button>
          )}
        </div>

        {!kycOk && !active && (
          <p className="biz-form-hint" style={{ marginTop: 10 }}>
            <i className="fas fa-shield-halved" aria-hidden="true" />{' '}
            {isHt
              ? 'KYC se menm verifikasyon ki deja pwoteje peman (Payout) ou yo — pa gen okenn dosye PII anplis.'
              : 'KYC is the same verification that already protects your payouts — no extra PII records.'}
          </p>
        )}
      </div>
    </div>
  );
}
