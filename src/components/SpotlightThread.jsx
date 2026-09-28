/**
 * src/components/SpotlightThread.jsx
 *
 * Phase 49 §11.1 — Applicant↔Admin message thread for the Creator
 * Spotlight application flow.
 *
 * ─── Why this component exists ───────────────────────────────────
 *
 * Before §11.1 the message-thread UI lived as ~55 lines of JSX
 * inline in ``src/components/Settings.jsx``. The shared Settings
 * file already owned the form (Phase 47), the KYC section
 * (Phase 48), the reply submission state, the toggle unlock
 * state, etc. — extracting just the thread keeps Settings from
 * growing unbounded while making the thread file stand on its
 * own for a future contributor who wants to improve the deadline
 * UX without spelunking through Settings.
 *
 * Contract:
 *   * Pure presentational component. ALL state is owned by the
 *     parent (Settings.jsx) and passed in via props. This keeps
 *     the reply submission logic, the
 *     ``spotlightService.postMessage()`` call, and the
 *     ``setSpotlightStep('form')`` back-navigation in one
 *     place. The component renders → the parent wires effects.
 *   * ``onSubmitReply`` should accept the standard ``(e) =>`` shape
 *     so we can pass it directly to the form's onSubmit prop.
 *     The component does NOT preventDefault — the parent owns
 *     the decision flow. (We do call ``?.preventDefault?.()``
 *     defensively in the form for the case where a parent forgets
 *     to wrap the handler.)
 *   * ``onBack`` is the single explicit dismiss-the-thread
 *     affordance. Because the modal already owns its own
 *     backdrop click + Escape keypress to close the modal
 *     entirely (wired at the Settings.jsx modal wrapper level),
 *     the thread component does NOT need its own close-modal
 *     callback. The × in the header calls ``onBack``; the parent
 *     flips ``spotlightStep`` back to ``'form'`` so a user with
 *     admin questions pending can still see the (read-only) KYC
 *     + invention summary. The form view IS the same modal —
 *     just the inner sub-view has changed.
 *
 * ─── Deadline banner (the ≥80% reply-rate design) ───────────────
 *
 * Phase 48 wired up the ``days_until_auto_reject`` serializer field
 * on the BE; §11.1 turns it into a visible, escalating UI:
 *
 *   1. ``safe`` (>14 days) — soft blue-gray pill. Encouraging
 *      copy: "Admin is reviewing your application. Reply when
 *      you're ready." Goal: don't bury the applicant in urgency
 *      on day 1 (which feels like spam); start gentle.
 *   2. ``soon`` (8–14 days) — amber pill. Direct reminder copy:
 *      "Reply to keep your application in review." Goal: surface
 *      the deadline without alarm, ~1/3 of the window in.
 *   3. ``urgent`` (4–7 days) — orange pill with subtle background
 *      tint. Action-prompted copy: "Reply within this window to
 *      avoid auto-rejection." Goal: the median applicant should
 *      reply in this band — copy is the agent here.
 *   4. ``critical`` (1–3 days) — red pill with a 2s pulse
 *      animation. Imperative copy: "Reply today or your
 *      application will be auto-rejected." Goal: catch the tail of
 *      applicants who haven't replied in 27 days; the animation
 *      is the urgency cue.
 *   5. ``expired`` (≤0 days OR application status === 'rejected'
 *      AND no applicant reply) — neutral gray pill. No CTA in
 *      the banner itself; the parent can still surface a
 *      re-apply button on the launcher.
 *
 * The thresholds (14/8/4/1) trace back to the bulk auto-reject
 * sweep in ``SpotlightViewSet`` — the BE auto-rejects after
 * ``SPOTLIGHT_INFO_REQUESTED_TIMEOUT_DAYS`` (30 days). The
 * banner enters ``urgent`` 4 days before the 27-day mark so an
 * applicant who replies on day 28 still has 2 days of buffer.
 *
 * The spec's acceptance metric — ``≥80% of applicants reply
 * within the 30-day window`` — is engineered by the
 * escalating urgency levels:
 *   * The soft ``safe`` banner doesn't push reply-now anxiety on
 *     day 1 (which backfires into abandonment).
 *   * The ``soon`` reminder surfaces the deadline at day 16,
 *     before it feels too late.
 *   * The ``urgent`` prompt at day 23 makes the reply the
 *     single most visible action in the modal.
 *   * The ``critical`` alarm at day 27 is the last chance; the
 *     pulse animation + red color force the applicant to act.
 *
 * ─── Why a pure component (not a hook / not a context) ─────────
 *
 * Three alternatives were considered:
 *   * ``useSpotlightThread(application)`` hook — would require
 *     the component to own state, defeating Settings.jsx's
 *     existing consolidated reply state.
 *   * ``<SpotlightThreadContext.Provider>`` — overkill for one
 *     use site; a future thread-on-profile surface would lean
 *     on this if we ever extract beyond Settings.
 *   * Pure prop-driven component — chosen. Tradeoff: a future
 *     consumer has to lift the 5 props themselves. Acceptable
 *     because Settings.jsx already keeps everything else.
 *
 * ─── Accessibility ───────────────────────────────────────────────
 *
 * The header close button has ``aria-label={thread close}``; the
 * back-to-application affordance is rendered as a button (not a
 * div) so screen readers can interact with it; each message
 * row is labeled with ``data-sender={sender_role}`` so test
 * selectors can target admin vs applicant bubbles; the reply
 * form has ``aria-label`` via the surrounding
 * ``<form data-testid="spotlightreply-form">``.
 */
import React from 'react';

/**
 * Derive the urgency level + matched CSS class for a given
 * days-until-auto-reject integer.
 *
 *   * ``null``/``undefined`` → ``'unknown'`` (the BE did not
 *     provide the field; e.g. the application has not yet been
 *     put into ``info_requested`` status). The banner is NOT
 *     rendered in that case — the parent decides whether to
 *     show it based on the application status.
 *   * ``>14`` → ``'safe'``
 *   * ``8–14`` → ``'soon'``
 *   * ``4–7`` → ``'urgent'``
 *   * ``1–3`` → ``'critical'``
 *   * ``≤0`` → ``'expired'`` (the auto-reject sweep has fired)
 *
 * Exported at module scope so a future Storybook story or unit
 * test can import the function directly without rendering the
 * whole component.
 *
 * @param {number|null|undefined} days  days_until_auto_reject
 *                                      from the BE serializer.
 * @returns {{level: string, bannerClass: string, animated: boolean}}
 */
export function computeDeadlineUrgency(days) {
  // Defensive: the BE serializer can return null while the
  // application is still being created or after the field was
  // added. Treat null/undefined/non-number as "no banner".
  if (typeof days !== 'number' || !Number.isFinite(days)) {
    return { level: 'unknown', bannerClass: '', animated: false };
  }
  if (days <= 0) {
    return { level: 'expired', bannerClass: 'spotlight-deadline-banner--expired', animated: false };
  }
  if (days <= 3) {
    return { level: 'critical', bannerClass: 'spotlight-deadline-banner--critical', animated: true };
  }
  if (days <= 7) {
    return { level: 'urgent', bannerClass: 'spotlight-deadline-banner--urgent', animated: false };
  }
  if (days <= 14) {
    return { level: 'soon', bannerClass: 'spotlight-deadline-banner--soon', animated: false };
  }
  return { level: 'safe', bannerClass: 'spotlight-deadline-banner--safe', animated: false };
}

/**
 * Resolve the right copy for a given urgency level.
 *
 * The copy is per-language, sourced from the ``t`` (translations)
 * object the parent passes in. We fall back to safe English
 * defaults when a key is missing so a partial i18n flush does
 * not blank out the banner.
 *
 * @param {string} level  'safe' | 'soon' | 'urgent' | 'critical' | 'expired'
 * @param {object} t      translations dict for the active lang
 * @param {string} lang   active lang code (used for the fallback
 *                        copy branch on en/fr/es/ht)
 * @returns {{title: string, body: string, daysLabel: string}}
 */
function resolveDeadlineCopy(level, t, lang, days) {
  // Per-language copy pivot. Keys live on the ``t`` object so
  // a translator adding a new language only has to add the
  // 5 ``settings_spotlight_deadline_*`` keys (one per urgency
  // level) to wire up the new locale. We map ``days`` here
  // because the copy templates use "{days}" as a placeholder.
  const key = `settings_spotlight_deadline_${level}`;
  const titleKey = `settings_spotlight_deadline_${level}_title`;
  const raw = t?.[key];
  const rawTitle = t?.[titleKey];

  // Hard-coded per-language defaults in case a key is missing.
  // Use the same "{days}" placeholder pattern the translator
  // is expected to follow.
  const FALLBACK = {
    safe: {
      title: lang === 'ht' ? '✨ Fenèt repons' : lang === 'fr' ? '✨ Fenêtre de réponse' : lang === 'es' ? '✨ Ventana de respuesta' : '✨ Reply window',
      body: lang === 'ht'
        ? 'Administratè a ap tann. Reponn lè ou pare — ou gen {days} jou.'
        : lang === 'fr'
        ? "L'administrateur attend. Répondez quand vous êtes prêt — il vous reste {days} jours."
        : lang === 'es'
        ? 'El administrador espera. Responde cuando estés listo — te quedan {days} días.'
        : 'Admin is reviewing your application. Reply when you are ready — {days} days left.',
    },
    soon: {
      title: lang === 'ht' ? '⏰ Sonje reponn' : lang === 'fr' ? '⏰ Pensez à répondre' : lang === 'es' ? '⏰ Recuerda responder' : '⏰ Reply before too long',
      body: lang === 'ht'
        ? 'Reponn nan {days} jou pou aplikasyon ou rete sourevizyon.'
        : lang === 'fr'
        ? 'Répondez dans les {days} jours pour rester en cours de révision.'
        : lang === 'es'
        ? 'Responde en {days} días para mantener tu solicitud en revisión.'
        : 'Reply within {days} days to keep your application in active review.',
    },
    urgent: {
      title: lang === 'ht' ? '⚠️ Reponn kounye a' : lang === 'fr' ? '⚠️ Répondez maintenant' : lang === 'es' ? '⚠️ Responde ya' : '⚠️ Reply window closing',
      body: lang === 'ht'
        ? 'Ou gen {days} jou. Si ou pa reponn, aplikasyon an ap rejte otomatikman.'
        : lang === 'fr'
        ? "Il vous reste {days} jours. Sans réponse, votre candidature sera automatiquement rejetée."
        : lang === 'es'
        ? 'Te quedan {days} días. Si no respondes, tu solicitud será rechazada automáticamente.'
        : 'You have {days} days. If you do not reply, your application will be auto-rejected.',
    },
    critical: {
      title: lang === 'ht' ? '🚨 Dènye jou' : lang === 'fr' ? '🚨 Derniers jours' : lang === 'es' ? '🚨 últimos días' : '🚨 Final days',
      body: lang === 'ht'
        ? '{days} jou rete. Reponn jodi a oswa aplikasyon an ap rejte otomatikman.'
        : lang === 'fr'
        ? "{days} jours restants. Répondez aujourd'hui sinon votre candidature sera rejetée."
        : lang === 'es'
        ? 'Quedan {days} días. Responde hoy o tu solicitud será rechazada.'
        : '{days} days left. Reply today or your application will be auto-rejected.',
    },
    expired: {
      title: lang === 'ht' ? '⛔ Rejte otomatikman' : lang === 'fr' ? '⛔ Rejet automatique' : lang === 'es' ? '⛔ Rechazo automático' : '⛔ Was auto-rejected',
      body: lang === 'ht'
        ? 'Ou pa t reponn nan 30 jou. Re-soumet aplikasyon an pou yon nouvo chans.'
        : lang === 'fr'
        ? "Vous n'avez pas répondu dans les 30 jours. Re-soumettez votre candidature pour une nouvelle chance."
        : lang === 'es'
        ? 'No respondiste en 30 días. Reenvía tu solicitud para una nueva oportunidad.'
        : 'You did not reply within 30 days. Re-submit for a new chance.',
    },
  };

  const fb = FALLBACK[level] || FALLBACK.safe;
  // Use translation-key-provided copy when present; otherwise
  // fall back to the inline FALLBACK above. The ``{days}``
  // placeholder is replaced LAST so a translator can include
  // it verbatim in either branch.
  const safe = (s, fallback) => (typeof s === 'string' && s.trim().length > 0 ? s : fallback);
  const title = safe(rawTitle, fb.title);
  const bodySafe = safe(raw, fb.body);
  // ``bodySafe`` may contain the ``'{days}'`` placeholder; replace
  // it last so a translator who omitted it from their copy still
  // gets a sensible text instead of ``'{days}'`` leaking through.
  const body = typeof days === 'number' ? bodySafe.replace('{days}', String(days)) : bodySafe;
  return { title, body };
}

/**
 * Pick a friendly thread-sender label for a message row.
 *
 * The BE's SpotlightApplicationMessage model has a
 * ``sender_role`` field that's one of ``'admin'``, ``'applicant'``,
 * or ``'system'`` (for autoflips like the "asked for more info"
 * automatic message). We render the role name in the user's
 * language + a pseudonym for the applicant ("You" in en).
 *
 * @param {object} msg       message row from the BE serializer
 * @param {object} t         translations dict
 * @param {string} lang      active lang code
 * @param {object} user      the parent-passed authed user object
 * @returns {string}         the label to render in the meta row
 */
function resolveSenderLabel(msg, t, lang, user) {
  if (msg?.sender_role === 'admin') {
    return t?.settings_spotlight_sender_admin || (lang === 'ht' ? 'Administratè' : lang === 'fr' ? 'Admin' : lang === 'es' ? 'Admin' : 'Admin');
  }
  if (msg?.sender_role === 'system') {
    return t?.settings_spotlight_sender_system || (lang === 'ht' ? 'Sistèm' : lang === 'fr' ? 'Système' : lang === 'es' ? 'Sistema' : 'System');
  }
  // Applicant rows. We use the authed user's username if it
  // matches (the most common case), otherwise a localized
  // "You" string. ``msg.sender_user`` may be an embedded object
  // (the BE serializer inlines the FK on read) or an integer ID;
  // we don't display it directly — only the username via props.
  if (msg?.sender_role === 'applicant') {
    return user?.username
      || t?.settings_spotlight_sender_you
      || (lang === 'ht' ? 'Ou' : lang === 'fr' ? 'Vous' : lang === 'es' ? 'Tú' : 'You');
  }
  // Fallback for unexpected sender_role values — show a
  // neutral label.
  return t?.settings_spotlight_sender_unknown || (lang === 'ht' ? 'Endiskitab' : 'Unknown');
}

/**
 * Format a UTC ISO timestamp from the BE into the user's local
 * locale + a compact ``time`` string. We don't depend on
 * ``dayjs`` or ``date-fns`` — the BE serializes ``ISO 8601`` and
 * the JS ``Date`` constructor handles it across browsers. The
 * ``toLocaleString`` call returns a localized string that
 * matches the user's selected language where possible.
 *
 * @param {string} iso  ISO 8601 timestamp like "2026-03-09T12:34:56Z"
 * @returns {string}
 */
function formatMessageTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    // Compact format keeps the meta row inside the 320px mobile
    // breakpoint. ``hour/minute`` are AM/PM in en/es and 24h in
    // fr/ht — the locale handles itself.
    const localeString = d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const time = d.toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${localeString} \u00b7 ${time}`;
  } catch (_) {
    return '';
  }
}

/**
 * The exported component. Pure presentational.
 *
 * Props are listed as ``propTypes`` style comments above each
 * parameter — the project doesn't use PropTypes (no runtime
 * cost) so they're doc-only.
 *
 * @param {object}   props
 * @param {object}   props.application          SpotlightApplication row from /api/spotlight/mine/.
 *                                              ``days_until_auto_reject`` is what drives the banner.
 *                                              ``status`` decides whether to render the banner at all
 *                                              (only ``'info_requested'`` shows the 30-day deadline).
 * @param {Array}    props.messages             array of message rows from /api/spotlight/<id>/messages/
 * @param {string}   props.replyBody            controlled input value
 * @param {Function} props.onReplyBodyChange    ``(e) => void``
 * @param {Function} props.onSubmitReply        ``(e) => void`` — parent owns preventDefault + spotlightService.postMessage
 * @param {boolean}  props.replySubmitting      disables the input + submit button
 * @param {Function} props.onBack               flip the parent state back to the form view
 * @param {object}   props.t                    translations dict
 * @param {string}   props.lang                 active lang code
 * @param {object}   props.user                 the authed user (for "You" label)
 */
export function SpotlightThread({
  application,
  messages = [],
  replyBody = '',
  onReplyBodyChange,
  onSubmitReply,
  replySubmitting = false,
  onBack,
  t,
  lang,
  user,
}) {
  // ─── Deadline banner: compute the urgency level + copy ───
  // Only render the banner when the application is in the
  // ``info_requested`` state — that is the only status where
  // the BE auto-rejects after 30 days of no reply. Other
  // statuses (pending, under_review, approved, rejected)
  // have a SERIALIZER field for ``days_until_auto_reject``
  // but it is ``null`` and the banner is not rendered.
  const showDeadlineBanner =
    application?.status === 'info_requested'
    && typeof application?.days_until_auto_reject === 'number';
  const urgency = computeDeadlineUrgency(application?.days_until_auto_reject);
  const copy = resolveDeadlineCopy(urgency.level, t, lang, application?.days_until_auto_reject);

  return (
    <div className="spotlight-thread-view" data-testid="spotlight-thread-view">
      {/*
        Header bar. Three controls:
          * Back-to-application pill (onBack) — lands back on
            the parent form view, NOT closing the modal.
          * Centered "Thread with admin" label — localizable.
          * Close-modal pill (onClose) — calls closeSpotlightModal.
        Both pills are real <button> elements (not divs) so
        screen readers expose them as buttons. The thread label
        itself is a <span> with no role, since it is purely
        informational.
      */}
      <div className="spotlight-thread-header">
        <i className="fas fa-comments" aria-hidden="true" />
        <span>
          {t?.settings_spotlight_thread_header || (lang === 'ht' ? 'Mesaj ak administratè' : lang === 'fr' ? 'Fil avec admin' : lang === 'es' ? 'Hilo con admin' : 'Thread with admin')}
        </span>
        <button
          type="button"
          className="spotlight-thread-back-btn"
          onClick={onBack}
          aria-label={t?.common_close || (lang === 'ht' ? 'Fèmen fil la' : 'Close thread')}
          data-testid="spotlight-thread-back-btn"
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </div>

      {/*
        Deadline banner. Conditional render gated on
        ``showDeadlineBanner``. The ``animated`` flag from
        ``computeDeadlineUrgency`` toggles the CSS animation
        for the critical level only.

        Class structure:
          .spotlight-deadline-banner                root
          .spotlight-deadline-banner--{level}       variant (safe/soon/urgent/critical/expired)
          .spotlight-deadline-banner--animated      only present on 'critical'
          .spotlight-deadline-banner__icon          left icon column
          .spotlight-deadline-banner__body          center text column
          .spotlight-deadline-banner__title         small bold title
          .spotlight-deadline-banner__copy          body line
          .spotlight-deadline-banner__days          right-edge big "X days" chip

        The icon column is per-urgency so we don't have to
        duplicate the icon in each variant's CSS — a single
        ``<i data-icon="urgent" />`` key lets us theme via
        either a CSS class on the icon or by inline content.
      */}
      {showDeadlineBanner && (
        <div
          className={`spotlight-deadline-banner ${urgency.bannerClass}${urgency.animated ? ' spotlight-deadline-banner--animated' : ''}`}
          role={urgency.level === 'critical' || urgency.level === 'expired' ? 'alert' : 'status'}
          aria-live={urgency.level === 'critical' ? 'assertive' : 'polite'}
          aria-atomic="true"
          data-deadline-level={urgency.level}
          data-testid="spotlight-deadline-banner"
          data-days-remaining={application.days_until_auto_reject}
        >
          <div className="spotlight-deadline-banner__icon" aria-hidden="true">
            <i className={
              urgency.level === 'safe' ? 'fas fa-check-circle'
              : urgency.level === 'soon' ? 'fas fa-clock'
              : urgency.level === 'urgent' ? 'fas fa-exclamation-triangle'
              : urgency.level === 'critical' ? 'fas fa-bell'
              : 'fas fa-ban'
            } />
          </div>
          <div className="spotlight-deadline-banner__body">
            <div className="spotlight-deadline-banner__title">
              {copy.title}
            </div>
            <div className="spotlight-deadline-banner__copy">
              {copy.body}
            </div>
          </div>
          {application.days_until_auto_reject > 0 && (
            <div className="spotlight-deadline-banner__days" aria-hidden="true">
              <span className="spotlight-deadline-banner__days-num">
                {application.days_until_auto_reject}
              </span>
              <span className="spotlight-deadline-banner__days-label">
                {t?.settings_spotlight_days_left || (lang === 'ht' ? 'jou rete' : lang === 'fr' ? 'jours' : lang === 'es' ? 'días' : 'days')}
              </span>
            </div>
          )}
        </div>
      )}

      {/*
        Message list. We render a per-message row with the
        sender meta line + body. The ``data-sender`` attribute
        on the row lets Playwright tests target admin-vs-applicant
        bubbles directly. ``key`` is the server-side message ID
        so React reuses the row across re-renders.

        The "is_admin_request" flag adds a styling hook so an
        admin REQUEST (a question, not just a note) gets a
        distinct visual treatment. The existing .spotlight-message-question
        CSS class handles that (orange/amber background).
      */}
      {messages.length === 0 ? (
        <p className="spotlight-thread-empty" data-testid="spotlight-thread-empty">
          {t?.settings_spotlight_no_messages || (lang === 'ht' ? 'Pa gen mesaj ankò.' : lang === 'fr' ? 'Aucun message pour l\'instant.' : lang === 'es' ? 'Aún no hay mensajes.' : 'No messages yet.')}
        </p>
      ) : (
        <div className="spotlight-messages" data-testid="spotlight-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`spotlight-message spotlight-message-${msg.sender_role}${msg.is_admin_request ? ' spotlight-message-question' : ''}`}
              data-sender={msg.sender_role}
              data-testid="spotlight-message"
            >
              <div className="spotlight-message-meta">
                <strong>
                  {resolveSenderLabel(msg, t, lang, user)}
                </strong>
                <span className="spotlight-message-time">
                  {formatMessageTime(msg.created_at)}
                </span>
              </div>
              <div className="spotlight-message-body">{msg.body}</div>
            </div>
          ))}
        </div>
      )}

      {/*
        Reply form. Controlled — the parent passes replyBody
        + onReplyBodyChange. We do a defensive
        ``preventDefault()`` here as a safety net because the
        parent might forget to wire it; the form is not a
        child of another <form>, so the default browser
        submit-to-current-page would land the user on a
        full-page reload — lose the modal, lose the replied
        state, lose the page scroll position.

        The submit button is disabled when:
          * replySubmitting is true (request in flight), OR
          * the trimmed reply body is empty (no point sending
            a whitespace-only reply).

        We render a Font Awesome paper-plane icon in the send
        button; the spinner replaces it while submitting.
      */}
      <form
        className="spotlight-reply-form"
        onSubmit={(e) => {
          if (e?.preventDefault) e.preventDefault();
          if (typeof onSubmitReply === 'function') onSubmitReply(e);
        }}
        data-testid="spotlight-reply-form"
      >
        <input
          type="text"
          className="spotlight-field-input"
          value={replyBody}
          onChange={onReplyBodyChange}
          placeholder={t?.settings_spotlight_reply_placeholder || (lang === 'ht' ? 'Ekri yon repons...' : lang === 'fr' ? 'Tapez une réponse...' : lang === 'es' ? 'Escribe una respuesta...' : 'Type a reply...')}
          disabled={replySubmitting}
          maxLength={2000}
          required
          aria-label={t?.settings_spotlight_reply_placeholder}
          data-testid="spotlight-reply-input"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={replySubmitting || !String(replyBody || '').trim()}
          aria-label={t?.common_send || (lang === 'ht' ? 'Voye repons' : 'Send reply')}
          data-testid="spotlight-reply-send-btn"
        >
          {replySubmitting
            ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            : <i className="fas fa-paper-plane" aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}

export default SpotlightThread;
