/**
 * src/components/business/BusinessHub.jsx
 *
 * Business Hub — the landing page for the account's business branch.
 * Lists the account's Business Profiles (separate identity from the
 * Creator branch) with a create CTA and per-profile "Enter Workspace".
 *
 * Route: /business  (auth-gated in App.jsx)
 *
 * Data flow
 * ---------
 *   GET /api/business/profiles/   — my profiles (owner-scoped)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { SHEETS } from '../../routes/sheets';
import { translations } from '../../data/translations';
import BusinessCreateModal from './BusinessCreateModal';
import { businessProfileService } from '../../services/api';
import '../../styles/business.css';

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function BusinessHub({ lang = 'ht', showToast }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = translations[lang] || translations.en || {};
  const isHt = lang === 'ht';

  // Phase 2 — Business is a PRIVILEGED CREATOR CAPABILITY. The hub
  // hides the create CTA (and shows a locked state) for non-creators;
  // the BACKEND is the enforcement point (403 on direct POST).
  //
  // Phase 10 display fix: ``canCreate`` comes from the backend's
  // ``/eligibility/`` endpoint — NEVER the client-side ``is_creator``
  // flag, which is derived from ``CreatorProfile.is_active`` and stays
  // ``true`` after a Creator suspension (the existing ``suspend``
  // admin action does not deactivate CreatorProfile). The endpoint
  // re-derives everything from the DB, so the CTA + lock state always
  // match the 403 the API actually enforces. The local flag is only a
  // network-failure fallback (the backend stays authoritative).
  const [elig, setElig] = useState(null);
  const [eligLoaded, setEligLoaded] = useState(false);
  // Conservative posture (review fix): while eligibility loads, and on
  // network failure, ONLY staff can see the create CTA — everyone else
  // defaults to "cannot create until proven". Falling back to the
  // client-side ``is_creator`` flag would re-introduce the stale-
  // after-suspension display this endpoint exists to kill.
  const canCreate = eligLoaded
    ? elig?.can_create === true
    : (user?.is_staff === true || user?.is_superuser === true);
  const workspaceLocked = elig?.workspace_locked === true;

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await businessProfileService.list();
      const data = res?.data?.data ?? res?.data ?? [];
      setProfiles(Array.isArray(data) ? data : []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount resets the loading shape synchronously — the
    // same intentional pattern as the rest of the codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    (async () => {
      try {
        const res = await businessProfileService.eligibility();
        const data = res?.data?.data ?? res?.data ?? null;
        if (data && typeof data === 'object') setElig(data);
      } catch {
        // Network failure → fall back to the local flag; the backend
        // still enforces the real gate on any write.
      } finally {
        setEligLoaded(true);
      }
    })();
  }, [load]);

  const statusLabel = (status) => ({
    active: t?.business_status_active || (isHt ? 'Aktif' : 'Active'),
    deactivated: t?.business_status_deactivated || (isHt ? 'Dezaktive' : 'Deactivated'),
    archived: t?.business_status_archived || (isHt ? 'Achive' : 'Archived'),
  }[status] || status);

  const statusColorMap = {
    active: '#34d399',
    deactivated: '#f87171',
    archived: '#94a3b8',
  };

  return (
    <div className="biz-hub" data-testid="business-hub">
      <div className="biz-hub-hero">
        <div className="biz-hub-badge"><i className="fas fa-briefcase" aria-hidden="true" /></div>
        <h1 className="biz-hub-title">
          {t?.business_hub_title || (isHt ? 'Biznis mwen' : 'My Businesses')}
        </h1>
        <p className="biz-hub-hint">
          {t?.business_hub_hint || (isHt
            ? 'Jere brand, biznis, oswa òganizasyon ou — separe de pwofil kreatè ou.'
            : 'Manage your brand, business, or organization — separate from your Creator Profile.')}
        </p>
        {!eligLoaded ? (
          // One short beat while the backend truth resolves — no
          // flash of the wrong CTA for anyone.
          <div className="biz-hub-locked biz-hub-elig-loading" data-testid="business-hub-elig-loading">
            <i className="fas fa-spinner fa-pulse" aria-hidden="true" />
          </div>
        ) : canCreate ? (
          <button
            type="button"
            className="biz-btn biz-btn-primary biz-hub-create-cta"
            onClick={() => setShowCreate(true)}
            data-testid="business-hub-create"
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {t?.business_create || (isHt ? 'Kreye yon Business Profile' : 'Create a Business Profile')}
          </button>
        ) : workspaceLocked ? (
          // Phase 10 — the owner's Creator branch is SUSPENDED: no
          // create CTA, no apply CTA (they are already a creator) —
          // just the moderation-hold message. Backend-derived, never
          // client-side. Hub-scoped copy (no "managing this business"
          // wording — the user may have zero businesses yet).
          <div className="biz-hub-locked" data-testid="business-hub-locked">
            <i className="fas fa-user-slash" aria-hidden="true" />
            <p>
              {t?.business_locked_hub_hint || t?.business_locked_hint || (isHt
                ? 'Kont kreatè w la sispann pa moderasyon platfòm la. Kontakte sipò Atelnyo a pou plis enfòmasyon.'
                : 'Your creator account is suspended by platform moderation. Contact Atelnyo support for more information.')}
            </p>
          </div>
        ) : (
          <div className="biz-hub-locked" data-testid="business-hub-locked">
            <i className="fas fa-lock" aria-hidden="true" />
            <p>
              {t?.business_creator_required_hint || (isHt
                ? 'Business Profile yo rezève pou kreatè apwouve. Aplike pou w vin Kreatè an premye — Pwofil Kreatè w la rete entak.'
                : 'Business Profiles are reserved for approved creators. Apply to become a Creator first — your Creator Profile stays untouched.')}
            </p>
            <button
              type="button"
              className="biz-btn biz-btn-ghost biz-hub-apply-cta"
              onClick={() => navigate(SHEETS.CREATOR_APPLY)}
              data-testid="business-hub-apply-creator"
            >
              <i className="fas fa-star" aria-hidden="true" />
              {t?.business_apply_creator || (isHt ? 'Aplike pou vin Kreatè' : 'Apply to become a Creator')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="biz-hub-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="biz-hub-empty">
          <i className="fas fa-store" aria-hidden="true" />
          <h3>{t?.business_no_profile || (isHt ? 'Ou poko gen Business Profile.' : "You don't have a Business Profile yet.")}</h3>
          <p>{workspaceLocked
            ? (isHt ? 'Workspace a rete verrouye pandan sispansyon an.' : 'The workspace stays locked during the suspension.')
            : canCreate
              ? (isHt ? 'Kreye yon premye biznis pou w kòmanse jere li nan Workspace li.' : 'Create your first business to start managing it from its own workspace.')
              : (isHt ? 'Lè w apwouve kòm Kreatè, ou pral kapab kreye biznis ou isit la.' : 'Once you are an approved Creator, you will be able to create your business here.')}</p>
        </div>
      ) : (
        <div className="biz-hub-grid">
          {profiles.map((p) => {
            const pillColor = statusColorMap[p.status] || '#94a3b8';
            return (
            <article className="biz-card" key={p.id} data-testid="business-card">
              {p.logo_url ? (
                <img src={p.logo_url} alt="" className="biz-card-logo" loading="lazy" />
              ) : (
                <div className="biz-card-logo biz-card-logo-placeholder">
                  <i className="fas fa-store" aria-hidden="true" />
                </div>
              )}
              <div className="biz-card-body">
                <div className="biz-card-title-row">
                  <h3 className="biz-card-title">{p.name}</h3>
                  <span
                    className="biz-status-pill"
                    style={{
                      background: `${pillColor}1f`,
                      color: pillColor,
                      border: `1px solid ${pillColor}55`,
                    }}
                    data-testid="business-status-pill"
                  >
                    {statusLabel(p.status)}
                  </span>
                  {/* Phase 10 — creator-suspension workspace lock: the
                      owner's list payload carries the derived flag. */}
                  {p.workspace_locked && (
                    <span
                      className="biz-status-pill biz-status-pill-locked"
                      data-testid="business-card-locked"
                    >
                      <i className="fas fa-lock" aria-hidden="true" />
                      {t?.business_locked_badge || (isHt ? 'Verrouye' : 'Locked')}
                    </span>
                  )}
                </div>
                {p.tagline && <p className="biz-card-tagline">{p.tagline}</p>}
                <p className="biz-card-slug">/business/{p.slug}/workspace</p>
                <button
                  type="button"
                  className={classNames('biz-btn', p.status === 'active' ? 'biz-btn-primary' : 'biz-btn-ghost')}
                  onClick={() => navigate(`/business/${p.slug}/workspace`)}
                  data-testid="business-enter-workspace"
                >
                  <i className="fas fa-arrow-right" aria-hidden="true" />
                  {t?.business_enter || (isHt ? 'Antre nan Workspace' : 'Enter Workspace')}
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {showCreate && (
        <BusinessCreateModal
          lang={lang}
          t={t}
          showToast={showToast}
          onClose={() => setShowCreate(false)}
          onCreated={(profile) => {
            setShowCreate(false);
            if (profile?.slug) {
              navigate(`/business/${profile.slug}/workspace`);
            } else {
              load();
            }
          }}
        />
      )}
    </div>
  );
}
