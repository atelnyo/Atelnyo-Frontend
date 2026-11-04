/**
 * src/components/CommunityDetail.jsx
 *
 * Phase 36 — Community detail page with URL-driven tabs.
 *
 * Mounted at /community/:slug via App.jsx Routes. Sub-tabs
 * each have their own URL segment so the browser Back button +
 * deep links work correctly:
 *
 *   /community/:slug              → redirect to /events
 *   /community/:slug/events       → CommunityEvents
 *   /community/:slug/members      → CommunityMembers
 *   /community/:slug/announcements → CommunityAnnouncements
 *   /community/:slug/files        → CommunityFiles
 *   /community/:slug/courses      → CommunityCourses
 *
 * Legacy /sheet/community/* URLs redirect (replace) to this shape.
 *
 * Phase 36.1 — the parent layout fetches the community ONCE (banner,
 * join/leave, member count, is_member, current_user_role) and exposes
 * the resulting object via React Router's ``<Outlet context={...}>``.
 * Each tab component reads ``community`` (plus ``lang`` and ``showToast``)
 * through ``useOutletContext()`` and is responsible for its OWN list
 * fetch — ``events`` calls ``communityEventsService.list``, the rest
 * call into ``communitiesService``. This keeps the parent fetch stable
 * for the lifetime of the route while tab switches remain
 * independent (no parent re-render on tab change, no shared
 * ``tabLoading`` map).
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import SEOHead from './shared/SEOHead';
import { useParams, NavLink, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import { communitiesService, communityEventsService } from '../services/api';
import useVirtualScroll from '../hooks/useVirtualScroll';
import { t as t4 } from '../utils/i18n';

const TAB_KEYS = ['events', 'members', 'banned', 'announcements', 'files', 'courses'];
// The banned list is a moderation surface — only owner/admin see the tab.
const MOD_ONLY_TABS = ['banned'];

// ── Shared helpers (used by both layout + tab sub-components) ───────────

/** Translates a role slug into the localized label shown in the Members tab. */
function roleLabel(role, lang) {
  switch (role) {
    case 'owner':     return t4(lang, "Fondatè", "Owner", "Fondateur", "Fundador");
    case 'admin':     return 'Admin';
    case 'moderator': return t4(lang, "Moderatè", "Moderator", "Modérateur", "Moderador");
    default:          return t4(lang, "Manm", "Member", "Membre", "Miembro");
  }
}

/** Localized "Loading…" copy shared by every tab. */
function LoadingLine({ lang }) {
  return (
    <div className="c-state">
      <i className="fas fa-spinner fa-spin" />
      {' '}{t4(lang, "Ap chaje...", "Loading...", "Chargement...", "Cargando...")}
    </div>
  );
}

/** Localized empty-state block for any tab whose list came back empty. */
function EmptyState({ icon, lang, ht, en, fr, es }) {
  return (
    <div className="c-state">
      <i className={`fas ${icon} c-state-icon`} />
      <p className="c-state-text">{t4(lang, ht, en, fr || en, es || en)}</p>
    </div>
  );
}

// ── Tab components ──────────────────────────────────────────────────────
// Each tab reads community + lang + t from useOutletContext() and
// fetches its own list on mount.

/**
 * /events — list of community events.
 */
export function CommunityEvents() {
  const { community, lang } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = community?.slug;
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communityEventsService.list({ community: slug })
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        // Moderators can see draft events server-side, but the public
        // community page must never show them.
        setList(data.filter((ev) => ['published', 'completed'].includes(ev.status)));
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [community?.slug]);

  if (loading) return <LoadingLine lang={lang} />;
  if (list.length === 0) return <EmptyState icon="fa-calendar-alt" lang={lang} ht="Pa gen evènman ankò" en="No events yet" fr="Aucun événement pour le moment" es="Aún no hay eventos" />;

  return (
    <div className="c-list c-list--gap10">
      {list.map((ev) => (
        <div key={ev.id} className="c-row-card">
          <div className="c-date-badge">
            <span className="c-date-badge-day">
              {ev.start_time ? new Date(ev.start_time).getDate() : '?'}
            </span>
            <span>
              {ev.start_time
                ? new Date(ev.start_time).toLocaleDateString(undefined, { month: 'short' })
                : ''}
            </span>
          </div>
          <div className="c-info">
            <div className="c-title c-title--sm">{ev.title}</div>
            <div className="c-subtitle">
              {ev.start_time ? new Date(ev.start_time).toLocaleString() : ''}
              {ev.location && ` · ${ev.location}`}
            </div>
          </div>
          <span className={`c-badge-price ${ev.is_free ? 'c-badge-price--free' : 'c-badge-price--paid'}`}>
            {ev.is_free ? (t4(lang, "Gratis", "Free", "Gratuit", "Gratis")) : `$${ev.price}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * /members — list of community members + their roles.
 *
 * T073 — virtualized for communities with many members: only the rows
 * visible in the scroll viewport (+overscan) are mounted, so a 1000+
 * member community stays smooth. Row height is fixed at 72px
 * (c-row-card: 38px avatar + 2×12px padding + 2px border + 8px gap).
 *
 * 2026-09 — moderation actions wired to the real backend endpoints
 * (promote/demote/mute/unmute/ban/unban), gated client-side by the
 * viewer's role (current_user_role) and enforced again server-side by
 * the hierarchy gates. Banned members are not in this list (the
 * members endpoint filters them); the owner manages bans via unban
 * in the request-queue surface.
 */
export function CommunityMembers() {
  const { community, lang, showToast } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // Ban-reason dialog state: the member row being banned (null = closed).
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const MEMBER_ROW_HEIGHT = 72;
  const myRole = community?.current_user_role || null;
  const canModerate = ['owner', 'admin', 'moderator'].includes(myRole);
  const canPromote = myRole === 'owner';

  const refresh = useCallback(() => {
    const slug = community?.slug;
    if (!slug) return;
    communitiesService.members(slug)
      .then((r) => setList(Array.isArray(r?.data) ? r.data : []))
      .catch(() => { /* silent — list stays as-is */ });
  }, [community?.slug]);

  const act = useCallback(async (membershipId, label, fn) => {
    if (busyId) return;
    setBusyId(membershipId);
    try {
      await fn();
      showToast?.(label, 'shield-halved');
      refresh();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || (t4(lang, "Aksyon an refize.", "Action refused.", "Action refusée.", "Acción rechazada."));
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setBusyId(null);
    }
  }, [busyId, showToast, lang, refresh]);

  const handleMute = (m) => act(
    m.id,
    t4(lang, `@${m.username} mute 24 èdtan.`, `@${m.username} muted for 24h.`, `@${m.username} en sourdine pour 24 h.`, `@${m.username} silenciado por 24 h.`),
    () => communitiesService.mute(community.slug, m.id, 24),
  );
  const handleUnmute = (m) => act(
    m.id,
    t4(lang, `@${m.username} ka pale ankò.`, `@${m.username} unmuted.`, `@${m.username} peut parler à nouveau.`, `@${m.username} puede hablar de nuevo.`),
    () => communitiesService.unmute(community.slug, m.id),
  );
  // Ban asks for a reason first (stored in the audit trail the banned
  // tab shows). Empty reason allowed but discouraged via the hint; the
  // actual API call happens on dialog confirm.
  const handleBan = (m) => {
    setBanTarget(m);
    setBanReason('');
  };

  const confirmBan = async () => {
    const m = banTarget;
    if (!m) return;
    setBanTarget(null);
    await act(
      m.id,
      t4(lang, `@${m.username} bloke.`, `@${m.username} banned.`, `@${m.username} banni.`, `@${m.username} expulsado.`),
      () => communitiesService.banMember(community.slug, m.id, banReason.trim()),
    );
  };
  const handlePromote = (m) => {
    const next = m.role === 'member' ? 'moderator' : 'admin';
    return act(
      m.id,
      t4(lang, `@${m.username} kounye a ${next}.`, `@${m.username} is now ${next}.`, `@${m.username} est maintenant ${next}.`, `@${m.username} ahora es ${next}.`),
      () => communitiesService.promote(community.slug, m.id, next),
    );
  };
  const handleDemote = (m) => act(
    m.id,
    t4(lang, `@${m.username} desann yon nivo.`, `@${m.username} demoted.`, `@${m.username} rétrogradé.`, `@${m.username} degradado.`),
    () => communitiesService.demote(community.slug, m.id),
  );

  // Ban-reason confirm dialog. Renders via renderBanDialog() in both
  // list branches; Enter confirms, Escape cancels, autofocus on input.
  const renderBanDialog = () => {
    if (!banTarget) return null;
    return (
      <div
        className="c-ban-dialog-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="c-ban-dialog-title"
        onClick={() => setBanTarget(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 6000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          className="c-ban-dialog"
          role="document"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 380, boxSizing: 'border-box',
            background: 'var(--card-bg, #fff)', borderRadius: 16,
            padding: '20px 20px 16px', boxShadow: '0 24px 70px rgba(0,0,0,0.3)',
          }}
        >
          <h3
            id="c-ban-dialog-title"
            style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--text-primary, #1f2937)' }}
          >
            <i className="fas fa-ban" style={{ color: '#ef4444', marginRight: 8 }} aria-hidden="true" />
            {t4(lang, `Bloke @${banTarget.username}?`, `Ban @${banTarget.username}?`, `Bannir @${banTarget.username} ?`, `¿Expulsar a @${banTarget.username}?`)}
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', lineHeight: 1.45 }}>
            {t4(lang, "Manm nan pèdi aksè imedyatman. Rezon an soti nan lis bloke a — li ede owner a revize desizyon an.", "The member loses access immediately. The reason appears in the banned list — it helps the owner review the decision.", "Le membre perd l'accès immédiatement. La raison figure dans la liste des bannis — cela aide le fondateur à réexaminer la décision.", "El miembro pierde el acceso de inmediato. El motivo aparece en la lista de expulsados — ayuda al fundador a revisar la decisión.")}
          </p>
          <input
            type="text"
            autoFocus
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmBan(); }
              if (e.key === 'Escape') setBanTarget(null);
            }}
            maxLength={255}
            placeholder={t4(lang, "Rezon (egz: spam)...", "Reason (e.g. spam)...", "Raison (ex : spam)...", "Motivo (p. ej. spam)...")}
            aria-label={t4(lang, "Rezon blokaj", "Ban reason", "Motif du bannissement", "Motivo de expulsión")}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px',
              border: '1.5px solid var(--border-color, #d1d5db)', borderRadius: 10,
              background: 'var(--input-bg, #f9fafb)', color: 'var(--text-primary, #1f2937)',
              fontSize: '16px', fontFamily: 'inherit', marginBottom: 14,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setBanTarget(null)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid var(--border-color, #d1d5db)',
                background: 'transparent', color: 'var(--text-secondary, #64748b)',
                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t4(lang, "Anile", "Cancel", "Annuler", "Cancelar")}
            </button>
            <button
              type="button"
              onClick={confirmBan}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
                background: '#ef4444', color: '#fff',
                fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t4(lang, "Bloke", "Ban", "Bannir", "Expulsar")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const slug = community?.slug;
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communitiesService.members(slug)
      .then((r) => {
        if (cancelled) return;
        setList(Array.isArray(r?.data) ? r.data : []);
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [community?.slug]);

  // Virtualize only once the list is large enough to matter; short lists
  // keep the plain map so row layout stays identical.
  const virtualized = list.length > 60;
  const { visibleItems, containerRef, totalHeight } = useVirtualScroll({
    items: virtualized ? list : [],
    itemHeight: MEMBER_ROW_HEIGHT,
    overscan: 6,
    containerHeight: 480,
  });

  if (loading) return <LoadingLine lang={lang} />;
  if (list.length === 0) return <EmptyState icon="fa-user" lang={lang} ht="Pa gen manm ankò" en="No members yet" fr="Aucun membre pour le moment" es="Aún no hay miembros" />;

  const renderRow = (m, style) => (
    <div key={m.id} className="c-row-card" style={style}>
      <div className="c-member-avatar">
        {(m.username || '?').slice(0, 2).toUpperCase()}
      </div>
      <div className="c-info">
        <div className="c-title c-title--xs">@{m.username}</div>
        <div className="c-subtitle">
          {new Date(m.joined_at).toLocaleDateString()}
          {m.is_muted && (
            <span className="c-role-badge c-role-badge--member" style={{ marginLeft: 6 }}>
              <i className="fas fa-volume-xmark" aria-hidden="true" /> {t4(lang, "mute", "muted", "en sourdine", "silenciado")}
            </span>
          )}
        </div>
      </div>
      {canModerate && m.role !== 'owner' && (
        <div className="c-member-actions" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {canPromote && (
            <>
              {m.role !== 'member' && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 32, height: 32, fontSize: '0.75rem' }}
                  title={t4(lang, "Desann yon nivo", "Demote one rank", "Rétrograder d'un rang", "Degradar un rango")}
                  aria-label={t4(lang, `Desann @${m.username}`, `Demote @${m.username}`, `Rétrograder @${m.username}`, `Degradar a @${m.username}`)}
                  disabled={busyId === m.id}
                  onClick={() => handleDemote(m)}
                >
                  <i className="fas fa-arrow-down" aria-hidden="true" />
                </button>
              )}
              {m.role !== 'admin' && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 32, height: 32, fontSize: '0.75rem' }}
                  title={t4(lang, "Monte yon nivo", "Promote one rank", "Promouvoir d'un rang", "Ascender un rango")}
                  aria-label={t4(lang, `Monte @${m.username}`, `Promote @${m.username}`, `Promouvoir @${m.username}`, `Ascender a @${m.username}`)}
                  disabled={busyId === m.id}
                  onClick={() => handlePromote(m)}
                >
                  <i className="fas fa-arrow-up" aria-hidden="true" />
                </button>
              )}
            </>
          )}
          {m.is_muted ? (
            <button
              type="button"
              className="icon-btn"
              style={{ width: 32, height: 32, fontSize: '0.75rem', color: 'var(--color-success, #10b981)' }}
              title={t4(lang, "Leve mute a", "Unmute", "Réactiver le son", "Quitar silencio")}
              aria-label={t4(lang, `Leve mute @${m.username}`, `Unmute @${m.username}`, `Réactiver le son de @${m.username}`, `Quitar silencio a @${m.username}`)}
              disabled={busyId === m.id}
              onClick={() => handleUnmute(m)}
            >
              <i className="fas fa-volume-high" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="icon-btn"
              style={{ width: 32, height: 32, fontSize: '0.75rem' }}
              title={t4(lang, "Mute 24 èdtan", "Mute for 24h", "Muet pendant 24 h", "Silenciar por 24 h")}
              aria-label={t4(lang, `Mute @${m.username}`, `Mute @${m.username}`, `Mettre en sourdine @${m.username}`, `Silenciar a @${m.username}`)}
              disabled={busyId === m.id}
              onClick={() => handleMute(m)}
            >
              <i className="fas fa-volume-xmark" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            style={{ width: 32, height: 32, fontSize: '0.75rem', color: '#ef4444' }}
            title={t4(lang, "Bloke", "Ban", "Bannir", "Expulsar")}
            aria-label={t4(lang, `Bloke @${m.username}`, `Ban @${m.username}`, `Bannir @${m.username}`, `Expulsar a @${m.username}`)}
            disabled={busyId === m.id}
            onClick={() => handleBan(m)}
          >
            <i className="fas fa-ban" aria-hidden="true" />
          </button>
        </div>
      )}
      <span className={`c-role-badge c-role-badge--${m.role === 'moderator' ? 'member' : m.role}`}>
        {roleLabel(m.role, lang)}
      </span>
    </div>
  );

  if (virtualized) {
    return (
      <>
        <div ref={containerRef} className="c-list c-list--gap8" style={{ height: 480, overflow: 'auto' }}>
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visibleItems.map((m) => renderRow(m, {
              position: 'absolute', top: m.y, left: 0, right: 0,
              height: MEMBER_ROW_HEIGHT - 8, boxSizing: 'border-box',
            }))}
          </div>
        </div>
        {renderBanDialog()}
      </>
    );
  }

  return (
    <>
      <div className="c-list c-list--gap8">
        {list.map((m) => renderRow(m, undefined))}
      </div>
      {renderBanDialog()}
    </>
  );
}

/**
 * /banned — banned members with their ban audit trail (who banned them
 * and why). Owner/admin only: the members endpoint hides banned rows, so
 * without this surface a wrongful ban was un-reviewable and the unban
 * action had no UI. Rows show reason + moderator + date; the unban
 * button returns the member to plain-member status server-side.
 */
export function CommunityBannedMembers() {
  const { community, lang, showToast } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const myRole = community?.current_user_role || null;
  const canSee = ['owner', 'admin'].includes(myRole);

  const refresh = useCallback(() => {
    const slug = community?.slug;
    if (!slug) return;
    communitiesService.bannedMembers(slug)
      .then((r) => setList(Array.isArray(r?.data) ? r.data : []))
      .catch(() => { /* silent */ });
  }, [community?.slug]);

  useEffect(() => {
    const slug = community?.slug;
    if (!slug || !canSee) return;
    let cancelled = false;
    // Deferral (react-hooks/set-state-in-effect): push the spinner state
    // into a microtask so the effect body stays free of synchronous
    // setState — same pattern as the public-profile fetches.
    Promise.resolve().then(() => { if (!cancelled) setLoading(true); });
    communitiesService.bannedMembers(slug)
      .then((r) => { if (!cancelled) setList(Array.isArray(r?.data) ? r.data : []); })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [community?.slug, canSee]);

  if (!canSee) {
    return (
      <EmptyState
        icon="fa-lock"
        lang={lang}
        ht="Se owner ak admin ka wè lis bloke yo."
        en="Only the owner and admins can view the banned list."
        fr="Seuls le fondateur et les admins peuvent voir la liste des bannis."
        es="Solo el fundador y los administradores pueden ver la lista de expulsados."
      />
    );
  }

  if (loading) return <LoadingLine lang={lang} />;
  if (list.length === 0) {
    return (
      <EmptyState
        icon="fa-circle-check"
        lang={lang}
        ht="Pa gen pyès manm bloke."
        en="No banned members."
        fr="Aucun membre banni."
        es="Ningún miembro expulsado."
      />
    );
  }

  const handleUnban = async (m) => {
    if (busyId) return;
    setBusyId(m.id);
    try {
      await communitiesService.unbanMember(community.slug, m.id);
      showToast?.(
        t4(lang, `@${m.username} debloke.`, `@${m.username} unbanned.`, `@${m.username} débanni.`, `@${m.username} readmitido.`),
        'shield-halved',
      );
      setList((prev) => prev.filter((row) => row.id !== m.id));
    } catch (err) {
      const detail = err?.response?.data?.detail
        || (t4(lang, "Aksyon an refize.", "Action refused.", "Action refusée.", "Acción rechazada."));
      showToast?.(detail, 'circle-exclamation');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="c-list c-list--gap8">
      {list.map((m) => (
        <div key={m.id} className="c-row-card">
          <div className="c-member-avatar" style={{ filter: 'grayscale(1)' }}>
            {(m.username || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="c-info">
            <div className="c-title c-title--xs">@{m.username}</div>
            <div className="c-subtitle">
              {m.ban_reason
                ? (t4(lang, `Rezon: ${m.ban_reason}`, `Reason: ${m.ban_reason}`, `Motif : ${m.ban_reason}`, `Motivo: ${m.ban_reason}`))
                : (t4(lang, "Pa gen rezon", "No reason given", "Aucune raison indiquée", "Sin motivo indicado"))}
              {m.banned_by_username && (
                <> · {t4(lang, "pa", "by", "par", "por")} @{m.banned_by_username}</>
              )}
            </div>
          </div>
          <button
            type="button"
            className="c-role-badge c-role-badge--member"
            style={{ cursor: 'pointer', border: 'none' }}
            disabled={busyId === m.id}
            onClick={() => handleUnban(m)}
            title={t4(lang, "Debloke manm sa a", "Unban this member", "Débannir ce membre", "Readmitir a este miembro")}
          >
            {busyId === m.id
              ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              : <i className="fas fa-unlock" aria-hidden="true" />}
            {' '}{t4(lang, "Debloke", "Unban", "Débannir", "Readmitir")}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * /announcements — pinned + chronological community announcements.
 */
export function CommunityAnnouncements() {
  const { community, lang } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = community?.slug;
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communitiesService.announcements(slug)
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        setList(data);
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [community?.slug]);

  if (loading) return <LoadingLine lang={lang} />;
  if (list.length === 0) return <EmptyState icon="fa-bullhorn" lang={lang} ht="Pa gen anons" en="No announcements" fr="Aucune annonce" es="Ningún anuncio" />;

  return (
    <div className="c-list c-list--gap12">
      {list.map((a) => (
        <div key={a.id} className={`c-ann-card${a.is_pinned ? ' c-ann-card--pinned' : ''}`}>
          <div className="c-ann-header">
            {a.is_pinned && <i className="fas fa-thumbtack c-ann-pin-icon" />}
            <span className="c-title c-title--sm">{a.title}</span>
            {a.created_by_username && (
              <span className="c-ann-author">
                {t4(lang, "pa", "by", "par", "por")} {a.created_by_username}
              </span>
            )}
          </div>
          <p className="c-ann-content">{a.content}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * /files — community file library.
 */
export function CommunityFiles() {
  const { community, lang } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = community?.slug;
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communitiesService.files(slug)
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        setList(data);
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [community?.slug]);

  if (loading) return <LoadingLine lang={lang} />;
  if (list.length === 0) return <EmptyState icon="fa-file" lang={lang} ht="Pa gen fichye" en="No files" fr="Aucun fichier" es="Ningún archivo" />;

  return (
    <div className="c-files-grid">
      {list.map((f) => (
        <a
          key={f.id}
          href={f.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="c-file-card"
        >
          <i className="fas fa-file c-file-icon" />
          <div>
            <div className="c-file-name">{f.name}</div>
            <div className="c-file-meta">
              {f.size ? `${(f.size / 1024).toFixed(1)} KB` : ''}
              {f.uploaded_by_username && ` · ${f.uploaded_by_username}`}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

/**
 * /courses — courses linked to this community.
 */
export function CommunityCourses() {
  const { community, lang } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = community?.slug;
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communitiesService.linkedCourses(slug)
      .then((r) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        setList(data);
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [community?.slug]);

  if (loading) return <LoadingLine lang={lang} />;
  if (list.length === 0) return <EmptyState icon="fa-graduation-cap" lang={lang} ht="Pa gen kou" en="No linked courses" fr="Aucun cours lié" es="Ningún curso vinculado" />;

  return (
    <div className="c-list c-list--gap10">
      {list.map((c) => (
        <div key={c.id} className="c-row-card">
          <i className="fas fa-graduation-cap c-list-icon" />
          <div className="c-info">
            <div className="c-title c-title--xs">{c.course_title}</div>
          </div>
          {c.is_featured && (
            <span className="c-featured-badge">
              {t4(lang, "Rekòmande", "Featured", "En vedette", "Destacado")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Parent layout ───────────────────────────────────────────────────────

export default function CommunityDetail({ lang = 'ht', t = {}, showToast, user }) {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [myStatus, setMyStatus] = useState(null); // 'active' | 'pending' | null
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync skeleton flip on slug change is intentional
    setLoading(true);
    communitiesService.get(slug)
      .then((r) => {
        if (cancelled) return;
        const comm = r.data;
        setCommunity(comm);
        setIsMember(Boolean(comm?.is_member));
        setMyStatus(comm?.my_status ?? (comm?.is_member ? 'active' : null));
        setMemberCount(comm?.member_count || 0);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail || (t4(lang, "Kominote a pa jwenn.", "Community not found", "Communauté introuvable", "Comunidad no encontrada")));
          setCommunity(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, lang]);

  // ─── Content Intelligence SEO data ─────────────────────────────
  const [ciSeo, setCiSeo] = useState(null);
  useEffect(() => {
    if (!community?.id) return;
    let cancelled = false;
    communitiesService.getSEO(community.id)
      .then((res) => {
        if (!cancelled && res?.data?.status === 'ready') setCiSeo(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [community?.id]);

  async function handleJoin() {
    if (!user) {
      showToast?.(t.mwen_signin_required || (t4(lang, "Konekte pou w antre", "Sign in to join", "Connectez-vous pour rejoindre", "Inicia sesión para unirte")), 'user-lock');
      return;
    }
    setJoining(true);
    try {
      const res = await communitiesService.join(slug);
      const joinedStatus = res?.data?.status || res?.data?.data?.status || 'active';
      setMyStatus(joinedStatus);
      setIsMember(joinedStatus === 'active');
      if (joinedStatus === 'active') setMemberCount((c) => c + 1);
      showToast?.(
        joinedStatus === 'pending'
          ? (t4(lang, "Demann ou voye! Tann apwobasyon fondatè a.", "Request sent! Wait for the founder's approval.", "Demande envoyée ! Attendez l'approbation du fondateur.", "¡Solicitud enviada! Espera la aprobación del fundador."))
          : (t?.explore_community_join || (t4(lang, "Ou rantre!", "Joined!", "Rejoint !", "¡Te uniste!"))),
        'check-circle',
      );
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (t4(lang, "Nou pa ka rantre.", "Could not join", "Impossible de rejoindre", "No se pudo unir")), 'circle-exclamation');
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setJoining(true);
    try {
      await communitiesService.leave(slug);
      setIsMember(false);
      setMyStatus(null);
      setMemberCount((c) => Math.max(0, c - 1));
      showToast?.(t4(lang, "Ou kite kominote a.", "Left community.", "Communauté quittée.", "Saliste de la comunidad."), 'sign-out-alt');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (t4(lang, "Nou pa ka kite.", "Could not leave", "Impossible de quitter", "No se pudo salir")), 'circle-exclamation');
    } finally {
      setJoining(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t4(lang, "Èske w sèten w vle efase kominote sa a? Aksyon sa a pa ka anile.", "Are you sure you want to delete this community? This action cannot be undone.", "Êtes-vous sûr de vouloir supprimer cette communauté ? Cette action est irréversible.", "¿Seguro que quieres eliminar esta comunidad? Esta acción no se puede deshacer."))) {
      return;
    }
    try {
      await communitiesService.delete(slug);
      showToast?.(t4(lang, "Kominote a efase.", "Community deleted.", "Communauté supprimée.", "Comunidad eliminada."), 'trash');
      navigate('/sheet/studio?section=communities');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || (t4(lang, "Pa t kapab efase kominote a.", "Could not delete community", "Impossible de supprimer la communauté", "No se pudo eliminar la comunidad")), 'circle-exclamation');
    }
  }

  const isOwner = Boolean(community?.current_user_role === 'owner');

  // Hooks must run unconditionally — tabLabels/outletContext useMemo
  // calls were MOVED ABOVE the early returns (they used to sit after
  // them, violating rules-of-hooks and crashing when the
  // loading→content branch flipped mid-navigation).
  const tabLabels = useMemo(() => ({
    events:        lang === 'ht' ? 'Evènman' : lang === 'fr' ? 'Événements' : lang === 'es' ? 'Eventos' : 'Events',
    members:       lang === 'ht' ? 'Manm'     : lang === 'fr' ? 'Membres'     : lang === 'es' ? 'Miembros'  : 'Members',
    banned:        lang === 'ht' ? 'Bloke'    : lang === 'fr' ? 'Bannis'      : lang === 'es' ? 'Baneados' : 'Banned',
    announcements: lang === 'ht' ? 'Anons'    : lang === 'fr' ? 'Annonces'    : lang === 'es' ? 'Anuncios'  : 'Announcements',
    files:         lang === 'ht' ? 'Fichye'   : lang === 'fr' ? 'Fichiers'    : lang === 'es' ? 'Archivos'  : 'Files',
    courses:       lang === 'ht' ? 'Kou'      : lang === 'fr' ? 'Cours'       : lang === 'es' ? 'Cursos'    : 'Courses',
  }), [lang]);

  const outletContext = useMemo(
    () => ({ community: { ...community, slug }, lang, t, user, showToast }),
    [community, slug, lang, t, user, showToast],
  );

  if (loading) {
    return (
      <div className="c-state">
        <i className="fas fa-spinner fa-spin c-state-spinner" />
        <p>{t4(lang, "Ap chaje...", "Loading...", "Chargement...", "Cargando...")}</p>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="c-state">
        <i className="fas fa-users-slash c-state-icon c-state-icon--lg" />
        <p className="c-state-text">{error || (t4(lang, "Kominote a pa jwenn.", "Community not found.", "Communauté introuvable.", "Comunidad no encontrada."))}</p>
      </div>
    );
  }

  return (
    <div className="community-detail" data-testid="community-detail-sheet">
      <SEOHead
        title={ciSeo?.title || community.name}
        description={ciSeo?.description || community.description}
        image={ciSeo?.og_image || community.banner_url}
        url={`/community/${slug}`}
        type="website"
        lang={lang}
        keywords={[...(ciSeo?.keywords || []), community.name].filter(Boolean)}
      />
      {/* Banner — minimal inline style for dynamic background URL/gradient only */}
      <div
        className="c-banner"
        style={{
          background: community.banner_url
            ? `url(${community.banner_url}) center/cover`
            : 'linear-gradient(135deg, #2d1b69, #d81b60)',
        }}
      >
        <div className="c-banner-overlay" />
        <div className="c-banner-content">
          <div
            className={`c-banner-avatar${!community.avatar_url ? ' c-banner-avatar--default' : ''}`}
            style={community.avatar_url ? {
              background: `url(${community.avatar_url}) center/cover`,
            } : undefined}
          >
            {!community.avatar_url && <i className="fas fa-users" />}
          </div>
          <div className="c-banner-info">
            <h2 className="c-banner-name">{community.name}</h2>
            <div className="c-banner-meta">
              <i className="fas fa-user" /> {memberCount} {t4(lang, "manm", "members", "membres", "miembros")}
              {community.category && ` · ${community.category}`}
            </div>
          </div>
          {myStatus === 'pending' ? (
            <button
              type="button"
              className="c-banner-btn c-banner-btn--pending"
              disabled
              title={t4(lang, "Demann ou nan tann apwobasyon", "Your request is awaiting approval", "Votre demande est en attente d’approbation", "Tu solicitud está pendiente de aprobación")}
            >
              <i className="fas fa-user-clock" aria-hidden="true" />
              {t4(lang, "Demann voye", "Request sent", "Demande envoyée", "Solicitud enviada")}
            </button>
          ) : isMember ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isOwner && (
                <>
                  <button
                    type="button"
                    className="c-banner-btn"
                    onClick={() => navigate('/sheet/studio?section=communities')}
                    title={t4(lang, "Paramèt kominote a", "Community settings", "Paramètres de la communauté", "Ajustes de la comunidad")}
                  >
                    <i className="fas fa-cog" aria-hidden="true" />
                    {t4(lang, "Paramèt", "Settings", "Paramètres", "Ajustes")}
                  </button>
                  <button
                    type="button"
                    className="c-banner-btn"
                    onClick={handleDelete}
                    style={{ background: 'rgba(239,68,68,0.9)', border: '1px solid rgba(239,68,68,0.9)' }}
                    title={t4(lang, "Efase kominote a", "Delete community", "Supprimer la communauté", "Eliminar comunidad")}
                  >
                    <i className="fas fa-trash" aria-hidden="true" />
                    {t4(lang, "Efase", "Delete", "Supprimer", "Eliminar")}
                  </button>
                </>
              )}
              {!isOwner && (
                <button
                  type="button"
                  className="c-banner-btn c-banner-btn--leave"
                  onClick={handleLeave}
                  disabled={joining}
                >
                  {joining ? <i className="fas fa-spinner fa-spin" /> : (t4(lang, "Kite", "Leave", "Quitter", "Salir"))}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="c-banner-btn c-banner-btn--join"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? <i className="fas fa-spinner fa-spin" /> : (t4(lang, "Antre", "Join", "Rejoindre", "Unirse"))}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {community.description && (
        <p className="c-desc">{community.description}</p>
      )}

      {/* Tabs — URL-driven via NavLink. The banned tab renders only for
          owner/admin (moderation surface); others never see it and a
          direct URL still 403s server-side. */}
      <div className="c-tabs">
        {TAB_KEYS.filter((key) => !MOD_ONLY_TABS.includes(key) || ['owner', 'admin'].includes(community?.current_user_role)).map((key) => (
          <NavLink
            key={key}
            to={key}
            className={({ isActive }) => `c-tab${isActive ? ' c-tab--active' : ''}`}
          >
            {tabLabels[key]}
          </NavLink>
        ))}
      </div>

      {/* Tab content via React Router Outlet */}
      <div className="community-tab-content">
        <Outlet context={outletContext} />
      </div>
    </div>
  );
}
