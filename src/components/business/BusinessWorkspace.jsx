/**
 * src/components/business/BusinessWorkspace.jsx
 *
 * Business Workspace — the management context for ONE Business
 * Profile. The brief's core UX contract:
 *
 *   * It must be obvious the user is managing "Business Profile:
 *     [Name]" — NOT their Creator Profile.
 *   * The user must be able to return to the Creator context.
 *
 * The workspace is a separate context: a persistent context header
 * ("Business Profile: [Name]" + status pill) plus a "← Return to
 * Creator Studio" link. It is URL-driven (/business/:slug/workspace),
 * owner-scoped (the backend 404s non-owners), and sheet-isolated in
 * App.jsx so the global chrome stays out of the way.
 *
 * Data flow
 * ---------
 *   GET  /api/business/profiles/<slug>/          — owner fetch
 *   POST /api/business/profiles/<id>/deactivate/ — owner soft-deactivate
 *   POST /api/business/profiles/<id>/activate/   — owner re-activate
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SHEETS } from '../../routes/sheets';
import { translations } from '../../data/translations';
import BusinessCatalogSection from './BusinessCatalogSection';
import BusinessOrdersSection from './BusinessOrdersSection';
import BusinessAnalyticsSection from './BusinessAnalyticsSection';
import BusinessSellerSection from './BusinessSellerSection';
import BusinessSettingsSection from './BusinessSettingsSection';
import BusinessFaqSection from './BusinessFaqSection';
import BusinessInquiriesSection from './BusinessInquiriesSection';
import { businessProfileService } from '../../services/api';
import '../../styles/business.css';

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function BusinessWorkspace({ lang = 'ht', showToast }) {
  const { slug } = useParams();
  const t = translations[lang] || translations.en || {};
  const isHt = lang === 'ht';

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState(null);
  const [section, setSection] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  // Fetch-on-mount with a cancellation guard so a stale response can
  // never overwrite a newer one if the slug changes mid-flight. The
  // owner-scoped backend 404s non-owners, so ``notFound`` covers both
  // "doesn't exist" and "not yours" — no existence leak on the FE.
  useEffect(() => {
    let cancelled = false;
    // Fetch-on-mount resets the loading shape synchronously — the
    // same intentional pattern as the rest of the codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const res = await businessProfileService.get(slug);
        const data = res?.data?.data ?? res?.data ?? null;
        if (cancelled) return;
        setProfile(data && typeof data === 'object' && data.id ? data : null);
        if (!data || !data.id) setNotFound(true);
      } catch {
        if (cancelled) return;
        setProfile(null);
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const statusLabel = (status) => ({
    active: t?.business_status_active || (isHt ? 'Aktif' : 'Active'),
    deactivated: t?.business_status_deactivated || (isHt ? 'Dezaktive' : 'Deactivated'),
    archived: t?.business_status_archived || (isHt ? 'Achive' : 'Archived'),
  }[status] || status);

  const statusColor = {
    active: '#34d399',
    deactivated: '#f87171',
    archived: '#94a3b8',
  }[profile?.status] || '#94a3b8';

  const runToggle = async (action) => {
    if (!profile) return;
    setBusy(true);
    try {
      const res = action === 'deactivate'
        ? await businessProfileService.deactivate(profile.id)
        : await businessProfileService.activate(profile.id);
      const data = res?.data?.data ?? res?.data ?? null;
      if (data?.id) setProfile(data);
      showToast?.(
        action === 'deactivate'
          ? (isHt ? 'Business Profile dezaktive.' : 'Business profile deactivated.')
          : (isHt ? 'Business Profile re-aktive!' : 'Business profile reactivated!'),
        'check-circle',
      );
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail
        || (isHt ? 'Aksyon an pa t mache.' : 'The action failed.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = () => setConfirmingDeactivate(true);

  const confirmMessage = () => (t?.business_confirm_deactivate || (isHt
    ? 'Eske w sèten ou vle dezaktive "{name}"? Ou ka re-aktive li nenpòt lè.'
    : 'Are you sure you want to deactivate "{name}"? You can reactivate it anytime.'))
    .replace('{name}', profile?.name || '');

  if (loading) {
    return (
      <div className="biz-workspace" data-testid="business-workspace">
        <div className="biz-workspace-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="biz-workspace" data-testid="business-workspace">
        <div className="biz-workspace-empty">
          <i className="fas fa-store-slash" aria-hidden="true" />
          <h2>{t?.business_error_not_found || (isHt
            ? 'Business Profile sa pa egziste oswa se pa ou ki posede l.'
            : "This business profile does not exist or you don't own it.")}</h2>
          <Link className="biz-btn biz-btn-primary" to={SHEETS.BUSINESS}>
            <i className="fas fa-arrow-left" aria-hidden="true" />
            {t?.business_back_hub || (isHt ? 'Biznis mwen' : 'My Businesses')}
          </Link>
        </div>
      </div>
    );
  }

  // Phase 10 — Creator-suspension lock (same moderation model as
  // seller/suspend, DERIVED from the CreatorApplication status). The
  // owner's profile payload carries ``workspace_locked``; while true,
  // the workspace renders read-only: the context header stays (so the
  // user knows WHICH business) but every management surface is
  // replaced by the lock panel. The public page keeps serving
  // customers — this is a management hold, not a takedown.
  const wsHeader = (
    <header className="biz-ws-header">
      <div className="biz-ws-header-row">
        {profile.logo_url ? (
          <img src={profile.logo_url} alt="" className="biz-ws-logo" loading="lazy" />
        ) : (
          <div className="biz-ws-logo biz-ws-logo-placeholder">
            <i className="fas fa-store" aria-hidden="true" />
          </div>
        )}
        <div className="biz-ws-header-text">
          <p className="biz-ws-kicker">
            <i className="fas fa-briefcase" aria-hidden="true" />
            {t?.business_context_label || (isHt ? 'Business Profile:' : 'Business Profile:')}
          </p>
          <h1 className="biz-ws-title">{profile.name}</h1>
          <div className="biz-ws-meta">
            <span
              className="biz-status-pill"
              style={{
                background: `${statusColor}1f`,
                color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}
              data-testid="business-status-pill"
            >
              {statusLabel(profile.status)}
            </span>
            <span className="biz-ws-slug">/business/{profile.slug}/workspace</span>
          </div>
        </div>
      </div>

      <div className="biz-ws-return">
        <Link className="biz-btn biz-btn-ghost" to={SHEETS.STUDIO} data-testid="business-return-creator">
          <i className="fas fa-arrow-left" aria-hidden="true" />
          {t?.business_return_creator || (isHt ? '← Retounen nan Creator Studio' : '← Return to Creator Studio')}
        </Link>
        <Link className="biz-btn biz-btn-ghost" to={SHEETS.BUSINESS}>
          <i className="fas fa-th-large" aria-hidden="true" />
          {t?.business_back_hub || (isHt ? 'Biznis mwen' : 'My Businesses')}
        </Link>
        <Link
          className="biz-btn biz-btn-ghost"
          to={SHEETS.BUSINESS_PUBLIC_URL(profile.slug)}
          data-testid="business-view-public"
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fas fa-eye" aria-hidden="true" />
          {t?.business_public_view || (isHt ? 'Wè paj piblik' : 'View public page')}
        </Link>
      </div>
    </header>
  );

  if (profile.workspace_locked) {
    return (
      <div className="biz-workspace" data-testid="business-workspace">
        {wsHeader}
        <main className="biz-ws-content">
          <div className="biz-workspace-locked" data-testid="business-workspace-locked">
            <div className="biz-workspace-locked-icon">
              <i className="fas fa-user-slash" aria-hidden="true" />
            </div>
            <h2>
              {t?.business_locked_title || (isHt ? 'Workspace verrouye' : 'Workspace locked')}
            </h2>
            <p>
              {t?.business_locked_hint || (isHt
                ? 'Kont kreatè w la sispann pa moderasyon platfòm la. Kontakte sipò Atelnyo anvan w jere biznis sa a. Paj piblik la rete aktif pou kliyan w yo.'
                : 'Your creator account is suspended by platform moderation. Contact Atelnyo support before managing this business. Your public page stays live for your customers.')}
            </p>
            <div className="biz-workspace-locked-actions">
              <Link className="biz-btn biz-btn-primary" to={SHEETS.STUDIO}>
                <i className="fas fa-arrow-left" aria-hidden="true" />
                {t?.business_return_creator || (isHt ? '← Retounen nan Creator Studio' : '← Return to Creator Studio')}
              </Link>
              <Link className="biz-btn biz-btn-ghost" to={SHEETS.BUSINESS}>
                <i className="fas fa-th-large" aria-hidden="true" />
                {t?.business_back_hub || (isHt ? 'Biznis mwen' : 'My Businesses')}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="biz-workspace" data-testid="business-workspace">
      {/* ─── Context header: "Business Profile: [Name]" ─────────── */}
      {wsHeader}

      {/* ─── Section rail ──────────────────────────────────────── */}
      <nav className="biz-ws-rail" aria-label={isHt ? 'Seksyon Workspace' : 'Workspace sections'}>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'overview' && 'biz-ws-tab-active')}
          onClick={() => setSection('overview')}
          data-testid="business-tab-overview"
        >
          <i className="fas fa-gauge-high" aria-hidden="true" />
          {t?.business_section_overview || (isHt ? 'Apèsi' : 'Overview')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'catalog' && 'biz-ws-tab-active')}
          onClick={() => setSection('catalog')}
          data-testid="business-tab-catalog"
        >
          <i className="fas fa-box-open" aria-hidden="true" />
          {t?.business_section_catalog || (isHt ? 'Katalòg' : 'Catalog')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'orders' && 'biz-ws-tab-active')}
          onClick={() => setSection('orders')}
          data-testid="business-tab-orders"
        >
          <i className="fas fa-cart-shopping" aria-hidden="true" />
          {t?.business_section_orders || (isHt ? 'Kòmand' : 'Orders')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'faqs' && 'biz-ws-tab-active')}
          onClick={() => setSection('faqs')}
          data-testid="business-tab-faqs"
        >
          <i className="fas fa-circle-question" aria-hidden="true" />
          {t?.business_section_faqs || (isHt ? 'FAQ' : 'FAQs')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'inquiries' && 'biz-ws-tab-active')}
          onClick={() => setSection('inquiries')}
          data-testid="business-tab-inquiries"
        >
          <i className="fas fa-envelope" aria-hidden="true" />
          {t?.business_section_inquiries || (isHt ? 'Mesaj' : 'Messages')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'analytics' && 'biz-ws-tab-active')}
          onClick={() => setSection('analytics')}
          data-testid="business-tab-analytics"
        >
          <i className="fas fa-chart-pie" aria-hidden="true" />
          {t?.business_section_analytics || (isHt ? 'Analitik' : 'Analytics')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'seller' && 'biz-ws-tab-active')}
          onClick={() => setSection('seller')}
          data-testid="business-tab-seller"
        >
          <i className="fas fa-hand-holding-dollar" aria-hidden="true" />
          {t?.business_section_seller || (isHt ? 'Seller' : 'Seller')}
        </button>
        <button
          type="button"
          className={classNames('biz-ws-tab', section === 'settings' && 'biz-ws-tab-active')}
          onClick={() => setSection('settings')}
          data-testid="business-tab-settings"
        >
          <i className="fas fa-gear" aria-hidden="true" />
          {t?.business_section_settings || (isHt ? 'Anviwònman' : 'Settings')}
        </button>
      </nav>

      {/* ─── Section content ───────────────────────────────────── */}
      <main className="biz-ws-content">
        {section === 'overview' && (
          <div className="biz-ws-overview" data-testid="business-overview">
            <div className="biz-ws-overview-grid">
              <div className="biz-ws-card">
                <h3 className="biz-ws-card-title">
                  <i className="fas fa-circle-info" aria-hidden="true" />
                  {isHt ? 'Enfòmasyon' : 'Information'}
                </h3>
                {profile.tagline && <p className="biz-ws-card-line"><strong>{isHt ? 'Slogan:' : 'Tagline:'}</strong> {profile.tagline}</p>}
                {profile.description && <p className="biz-ws-card-line"><strong>{isHt ? 'Deskripsyon:' : 'Description:'}</strong> {profile.description}</p>}
                <p className="biz-ws-card-line"><strong>{isHt ? 'Slug:' : 'Slug:'}</strong> {profile.slug}</p>
                <p className="biz-ws-card-line">
                  <strong>{t?.business_created_at || (isHt ? 'Kreye:' : 'Created:')}</strong>{' '}
                  {new Date(profile.created_at).toLocaleDateString(isHt ? 'fr-HT' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <div className="biz-ws-card">
                <h3 className="biz-ws-card-title">
                  <i className="fas fa-power-off" aria-hidden="true" />
                  {isHt ? 'Sik lavi' : 'Lifecycle'}
                </h3>
                <p className="biz-ws-card-line">
                  {isHt
                    ? 'Dezaktivasyon se yon transisyon dou (pa efase). Ou ka re-aktive nenpòt lè.'
                    : 'Deactivation is a soft transition (never a delete). You can reactivate anytime.'}
                </p>
                {profile.status === 'active' ? (
                  confirmingDeactivate ? (
                    <div className="biz-confirm" data-testid="business-confirm-deactivate">
                      <p className="biz-confirm-text">{confirmMessage()}</p>
                      <div className="biz-confirm-actions">
                        <button
                          type="button"
                          className="biz-btn biz-btn-ghost"
                          onClick={() => setConfirmingDeactivate(false)}
                          disabled={busy}
                        >
                          {isHt ? 'Anile' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          className="biz-btn biz-btn-danger"
                          onClick={() => { setConfirmingDeactivate(false); runToggle('deactivate'); }}
                          disabled={busy}
                        >
                          <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-circle-pause'}`} aria-hidden="true" />
                          {isHt ? 'Wi, dezaktive' : 'Yes, deactivate'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="biz-btn biz-btn-danger"
                      onClick={handleDeactivate}
                      disabled={busy}
                      data-testid="business-deactivate"
                    >
                      <i className="fas fa-circle-pause" aria-hidden="true" />
                      {t?.business_deactivate || (isHt ? 'Dezaktive' : 'Deactivate')}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="biz-btn biz-btn-primary"
                    onClick={() => runToggle('activate')}
                    disabled={busy}
                    data-testid="business-activate"
                  >
                    <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-circle-play'}`} aria-hidden="true" />
                    {t?.business_activate || (isHt ? 'Re-aktive' : 'Reactivate')}
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

        {section === 'catalog' && (
          <div className="biz-ws-catalog" data-testid="business-catalog-tab">
            <BusinessCatalogSection lang={lang} t={t} showToast={showToast} profile={profile} />
          </div>
        )}

        {section === 'orders' && (
          <div className="biz-ws-orders" data-testid="business-orders-tab">
            <BusinessOrdersSection lang={lang} t={t} showToast={showToast} profile={profile} />
          </div>
        )}

        {section === 'faqs' && (
          <div className="biz-ws-faqs" data-testid="business-faqs-tab">
            <BusinessFaqSection lang={lang} t={t} showToast={showToast} profile={profile} />
          </div>
        )}

        {section === 'inquiries' && (
          <div className="biz-ws-inquiries" data-testid="business-inquiries-tab">
            <BusinessInquiriesSection lang={lang} t={t} showToast={showToast} profile={profile} />
          </div>
        )}

        {section === 'analytics' && (
          <div className="biz-ws-analytics" data-testid="business-analytics-tab">
            <BusinessAnalyticsSection lang={lang} t={t} showToast={showToast} profile={profile} />
          </div>
        )}

        {section === 'seller' && (
          <div className="biz-ws-seller" data-testid="business-seller-tab">
            <BusinessSellerSection lang={lang} t={t} showToast={showToast} profile={profile} />
          </div>
        )}

        {section === 'settings' && (
          <div className="biz-ws-settings" data-testid="business-settings">
            <BusinessSettingsSection
              lang={lang}
              t={t}
              showToast={showToast}
              profile={profile}
              onSaved={(updated) => updated?.id && setProfile(updated)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
