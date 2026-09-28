/**
 * src/components/admin/AdminCompanyReview.jsx
 *
 * Full Admin Company Profile Management Page.
 * ============================================
 *
 * Gives admins control over company profiles:
 *   - List all profiles (pending, approved, rejected)
 *   - Filter by status, search by username/company name
 *   - Approve / Reject with notes
 *   - Toggle the verified badge (approved profiles only)
 *   - Quick "view public page" link for approved profiles
 *
 * Route: /sheet/admin/companies
 * API:  GET  /api/companies/admin-all/       — list all profiles
 *       POST /api/companies/<id>/approve/     — approve
 *       POST /api/companies/<id>/reject/      — reject with note
 *       POST /api/companies/<id>/verify/      — toggle verified badge
 */
import { useEffect, useState, useCallback } from 'react';
import { companyProfileService } from '../../services/api';
import { COMPANY_STATUS } from '../../constants/statusConfig';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtDateTime(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleString(); } catch { return str; }
}

function shorten(s, n = 80) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const STATUS_CFG = COMPANY_STATUS;

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ─── Status Badge ────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span className="acr-status-badge" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: cfg.bg || 'rgba(148,163,184,0.12)',
      color: cfg.color || '#94a3b8',
      borderRadius: 999, padding: '4px 10px', fontSize: '0.72rem',
      fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      <i className={`fas ${cfg.icon || 'fa-circle'}`} aria-hidden="true" />
      {cfg.labelEn}
    </span>
  );
}

// ─── Small field renderers ───────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="acr-field">
      <span className="acr-field-label" style={{
        display: 'block', fontSize: '0.66rem', fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'rgba(148,163,184,0.75)', marginBottom: 4,
      }}>{label}</span>
      <div style={{ fontSize: '0.86rem', color: 'var(--text-primary, #e2e8f0)', wordBreak: 'break-word' }}>
        {children || '—'}
      </div>
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────

function DetailPanel({ profile, onApprove, onReject, onVerify, busy, rejectNote, setRejectNote }) {
  const [showReject, setShowReject] = useState(false);
  const team = Array.isArray(profile?.team_members) ? profile.team_members : [];
  const offerings = Array.isArray(profile?.products_services) ? profile.products_services : [];
  const socials = Array.isArray(profile?.social_links) ? profile.social_links : [];

  return (
    <div style={{
      background: 'var(--surface, #1e293b)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {profile.logo_url ? (
          <img src={profile.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #d81b60, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <i className="fas fa-building" aria-hidden="true" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary, #f1f5f9)' }}>
              {profile.company_name}
            </span>
            <StatusBadge status={profile.status} />
            {profile.is_verified && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                color: '#34d399', fontSize: '0.72rem', fontWeight: 700,
              }}>
                <i className="fas fa-badge-check" aria-hidden="true" />
                Verified
              </span>
            )}
          </div>
          <div style={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem', marginTop: 2 }}>
            @{profile.username} · {profile.rejection_count || 0} rejections · created {fmtDateTime(profile.created_at)}
          </div>
        </div>
        {profile.status === 'approved' && (
          <a
            href={`/company/${profile.slug}`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: '#93c5fd', fontSize: '0.8rem', textDecoration: 'none' }}
          >
            <i className="fas fa-external-link-alt" aria-hidden="true" /> View
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Field label="Tagline">{profile.tagline}</Field>
        <Field label="Location">{[profile.city, profile.country].filter(Boolean).join(', ') || '—'}</Field>
        <Field label="Website">
          {profile.website ? (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd' }}>
              {profile.website}
            </a>
          ) : '—'}
        </Field>
      </div>

      {profile.description && (
        <div style={{ marginBottom: 12 }}>
          <span className="acr-field-label" style={{
            display: 'block', fontSize: '0.66rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(148,163,184,0.75)', marginBottom: 4,
          }}>Description</span>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
            {profile.description}
          </p>
        </div>
      )}

      {team.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span className="acr-field-label" style={{
            display: 'block', fontSize: '0.66rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(148,163,184,0.75)', marginBottom: 4,
          }}>Team ({team.length})</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {team.map((m, i) => (
              <span key={`${m.name}-${i}`} style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 999,
                padding: '4px 10px', fontSize: '0.74rem',
              }}>
                {m.name}{m.role ? ` · ${m.role}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {offerings.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span className="acr-field-label" style={{
            display: 'block', fontSize: '0.66rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(148,163,184,0.75)', marginBottom: 4,
          }}>Products / Services ({offerings.length})</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {offerings.map((o, i) => (
              <span key={`${o.title}-${i}`} style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 999,
                padding: '4px 10px', fontSize: '0.74rem',
              }}>
                {o.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {socials.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span className="acr-field-label" style={{
            display: 'block', fontSize: '0.66rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(148,163,184,0.75)', marginBottom: 4,
          }}>Social</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {socials.map((s, i) => (
              <a key={`${s.platform}-${i}`} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#93c5fd', fontSize: '0.74rem' }}>
                {s.platform || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {profile.review_note && (
        <div style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: '0.8rem',
        }}>
          <strong style={{ color: '#fbbf24' }}>Review note:</strong>{' '}
          <span style={{ color: 'rgba(226,232,240,0.9)' }}>{profile.review_note}</span>
        </div>
      )}

      {/* ─── Actions ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {profile.status !== 'approved' && (
          <button
            type="button"
            className="acr-btn acr-btn-approve"
            onClick={() => onApprove(profile)}
            disabled={busy}
            style={{
              background: 'rgba(52,211,153,0.15)', color: '#34d399',
              border: '1px solid rgba(52,211,153,0.4)', borderRadius: 10,
              padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            }}
          >
            <i className="fas fa-check" aria-hidden="true" /> Approve
          </button>
        )}
        {profile.status === 'approved' && (
          <button
            type="button"
            className="acr-btn acr-btn-verify"
            onClick={() => onVerify(profile)}
            disabled={busy}
            style={{
              background: profile.is_verified ? 'rgba(244,114,182,0.12)' : 'rgba(96,165,250,0.15)',
              color: profile.is_verified ? '#f472b6' : '#60a5fa',
              border: '1px solid currentColor', borderRadius: 10,
              padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            }}
          >
            <i className={`fas ${profile.is_verified ? 'fa-badge-check' : 'fa-badge'}`} aria-hidden="true" />
            {profile.is_verified ? 'Unverify' : 'Verify'}
          </button>
        )}
        {profile.status !== 'rejected' && (
          <button
            type="button"
            className="acr-btn acr-btn-reject"
            onClick={() => setShowReject((v) => !v)}
            style={{
              background: 'rgba(248,113,113,0.12)', color: '#f87171',
              border: '1px solid rgba(248,113,113,0.4)', borderRadius: 10,
              padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <i className="fas fa-xmark" aria-hidden="true" /> Reject
          </button>
        )}
      </div>

      {showReject && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Rejection reason (required)..."
            style={{
              flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
              padding: '8px 12px', color: '#e2e8f0', fontSize: '0.82rem', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => onReject(profile)}
            disabled={busy || !rejectNote.trim()}
            style={{
              background: 'rgba(248,113,113,0.2)', color: '#f87171',
              border: '1px solid rgba(248,113,113,0.5)', borderRadius: 10,
              padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700,
              cursor: busy || !rejectNote.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Confirm reject
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function AdminCompanyReview({ lang = 'en', showToast, user }) {
  const [profiles, setProfiles] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await companyProfileService.adminAll({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { q: search.trim() } : {}),
      });
      const data = res?.data?.results ?? res?.data?.data ?? res?.data ?? [];
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      if (showToast) showToast('Could not load company profiles.');
      setProfiles([]);
    }
  }, [statusFilter, search, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (profile) => {
    setBusy(true);
    try {
      await companyProfileService.approve(profile.id);
      if (showToast) showToast(`Approved ${profile.company_name}.`);
      await load();
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.detail || 'Approve failed.');
    } finally { setBusy(false); }
  };

  const handleReject = async (profile) => {
    if (!rejectNote.trim()) {
      if (showToast) showToast('A rejection reason is required.');
      return;
    }
    setBusy(true);
    try {
      await companyProfileService.reject(profile.id, rejectNote.trim());
      if (showToast) showToast(`Rejected ${profile.company_name}.`);
      setRejectNote('');
      await load();
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.detail || 'Reject failed.');
    } finally { setBusy(false); }
  };

  const handleVerify = async (profile) => {
    setBusy(true);
    try {
      await companyProfileService.toggleVerified(profile.id);
      if (showToast) showToast(profile.is_verified ? 'Verified badge removed.' : 'Verified badge granted.');
      await load();
    } catch (err) {
      if (showToast) showToast(err?.response?.data?.detail || 'Verify failed.');
    } finally { setBusy(false); }
  };

  const FILTERS = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="admin-page" data-testid="admin-company-review">
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary, #f1f5f9)' }}>
            <i className="fas fa-building" aria-hidden="true" style={{ marginRight: 10, color: '#f472b6' }} />
            Company Profiles — Review
          </h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(148,163,184,0.9)', fontSize: '0.85rem' }}>
            Approve, reject, or verify in-app company pages. Approved profiles become public at /company/:slug.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={classNames('acr-filter-btn', statusFilter === f.key && 'acr-filter-btn-active')}
              style={{
                background: statusFilter === f.key ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.05)',
                color: statusFilter === f.key ? '#f472b6' : 'rgba(148,163,184,0.9)',
                border: `1px solid ${statusFilter === f.key ? 'rgba(244,114,182,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 999, padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company name / username..."
            style={{
              flex: 1, minWidth: 180, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
              padding: '7px 12px', color: '#e2e8f0', fontSize: '0.8rem', outline: 'none',
            }}
          />
        </div>

        {/* Counts */}
        <div style={{ marginBottom: 14, fontSize: '0.8rem', color: 'rgba(148,163,184,0.85)' }}>
          {profiles === null
            ? 'Loading...'
            : `${profiles.length} profile${profiles.length === 1 ? '' : 's'}${statusFilter ? ` (${statusFilter})` : ''}`}
        </div>

        {/* List */}
        {profiles === null ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.7)' }}>
            <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading…
          </div>
        ) : profiles.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.7)',
            background: 'rgba(255,255,255,0.03)', borderRadius: 16,
          }}>
            <i className="fas fa-building-circle-check" aria-hidden="true" style={{ fontSize: '1.6rem', display: 'block', marginBottom: 8, opacity: 0.6 }} />
            No company profiles{statusFilter ? ` with status "${statusFilter}"` : ''}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profiles.map((profile) => (
              <div key={profile.id} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                <button
                  type="button"
                  onClick={() => { setDetailId(detailId === profile.id ? null : profile.id); setRejectNote(''); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '12px 16px', textAlign: 'left',
                  }}
                >
                  {profile.logo_url ? (
                    <img src={profile.logo_url} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, #d81b60, #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    }}>
                      <i className="fas fa-building" aria-hidden="true" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>{profile.company_name}</span>
                      {profile.is_verified && (
                        <i className="fas fa-badge-check" aria-hidden="true" style={{ color: '#34d399' }} />
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'rgba(148,163,184,0.75)' }}>
                      @{profile.username} · {shorten(profile.tagline || profile.description, 60)}
                    </div>
                  </div>
                  <StatusBadge status={profile.status} />
                  <i className={`fas fa-chevron-${detailId === profile.id ? 'up' : 'down'}`} aria-hidden="true"
                    style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.7rem' }} />
                </button>
                {detailId === profile.id && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <DetailPanel
                      profile={profile}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onVerify={handleVerify}
                      busy={busy}
                      rejectNote={rejectNote}
                      setRejectNote={setRejectNote}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
