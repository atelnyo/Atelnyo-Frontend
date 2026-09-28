/**
 * src/components/business/BusinessInquiriesSection.jsx
 *
 * Phase 8 — Business Messages tab inside the Workspace.
 *
 * The OWNER's view of customer inquiries for ONE Business Profile:
 * topic-categorized (general / product / order / support — never one
 * unstructured inbox), status-filterable (new / replied / closed),
 * with an inline reply box and a close action. Backend is
 * owner-scoped — a stranger never reaches this data.
 *
 * Data flow
 * ---------
 *   GET  /api/business/inquiries/?profile=<slug>[&status=]  — owner list
 *   POST /api/business/inquiries/<id>/reply/                — owner reply
 *   POST /api/business/inquiries/<id>/close/                — owner close
 */
import React, { useEffect, useState } from 'react';
import { businessInquiryService } from '../../services/api';

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

const TOPIC_ICONS = {
  general: 'fa-envelope',
  product: 'fa-cube',
  order: 'fa-cart-shopping',
  support: 'fa-life-ring',
};

export default function BusinessInquiriesSection({ lang = 'ht', t = {}, showToast, profile }) {
  const isHt = lang === 'ht';
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!profile?.slug) return;
    try {
      const res = await businessInquiryService.list({ profile: profile.slug });
      const data = res?.data?.data ?? res?.data ?? [];
      setInquiries(Array.isArray(data) ? data : []);
    } catch {
      setInquiries([]);
    }
  };

  // Fetch-on-mount with a cancellation guard — the same pattern as
  // BusinessFaqSection (never recreated per render, so reply/close
  // call ``refresh`` for a silent reload instead).
  useEffect(() => {
    if (!profile?.slug) return undefined;
    let cancelled = false;
    // Fetch-on-mount resets the loading shape synchronously — the
    // same intentional pattern as the rest of the codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await businessInquiryService.list({ profile: profile.slug });
        const data = res?.data?.data ?? res?.data ?? [];
        if (!cancelled) setInquiries(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setInquiries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.slug]);

  const statusLabel = (status) => ({
    new: t?.business_inquiry_status_new || (isHt ? 'Nouvo' : 'New'),
    replied: t?.business_inquiry_status_replied || (isHt ? 'Reponn' : 'Replied'),
    closed: t?.business_inquiry_status_closed || (isHt ? 'Fèmen' : 'Closed'),
  }[status] || status);

  const topicLabel = (topic) => ({
    general: t?.business_inquiry_topic_general || (isHt ? 'Jeneral' : 'General'),
    product: t?.business_inquiry_topic_product || (isHt ? 'Pwodui' : 'Product'),
    order: t?.business_inquiry_topic_order || (isHt ? 'Kòmand' : 'Order'),
    support: t?.business_inquiry_topic_support || (isHt ? 'Sipò' : 'Support'),
  }[topic] || topic);

  const filtered = statusFilter === 'all'
    ? inquiries
    : inquiries.filter((q) => q.status === statusFilter);

  const submitReply = async (inq) => {
    if (busy || !replyText.trim()) return;
    setBusy(true);
    try {
      await businessInquiryService.reply(inq.id, replyText.trim());
      showToast?.(
        t?.business_inquiry_reply_sent || (isHt ? '✅ Repons lan voye!' : '✅ Reply sent!'),
        'check-circle',
      );
      setReplyingId(null);
      setReplyText('');
      refresh();
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail || (isHt ? 'Pa t ka voye repons lan.' : 'Could not send the reply.'),
        'circle-exclamation',
      );
    } finally {
      setBusy(false);
    }
  };

  const closeInquiry = async (inq) => {
    if (busy) return;
    setBusy(true);
    try {
      await businessInquiryService.close(inq.id);
      showToast?.(
        t?.business_inquiry_closed || (isHt ? 'Fèmen ✓' : 'Closed ✓'),
        'check-circle',
      );
      refresh();
    } catch {
      showToast?.(isHt ? 'Pa t ka fèmen.' : 'Could not close.', 'circle-exclamation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="biz-inquiries" data-testid="business-inquiries">
      <div className="biz-ws-section-head">
        <h3 className="biz-ws-section-title">
          <i className="fas fa-envelope" aria-hidden="true" />
          {t?.business_section_inquiries || (isHt ? 'Mesaj kliyan' : 'Customer messages')}
        </h3>
        <p className="biz-ws-section-hint">
          {t?.business_inquiries_hint || (isHt
            ? 'Kesyon kliyan yo sou biznis ou a — reponn pou fèmen bouk la.'
            : 'Questions customers ask your business — reply to close the loop.')}
        </p>
      </div>

      {/* ─── Status filter chips ─────────────────────────────── */}
      <div className="biz-inquiry-filters" role="group" aria-label={isHt ? 'Filtre pa estati' : 'Filter by status'}>
        {(['all', 'new', 'replied', 'closed']).map((f) => (
          <button
            type="button"
            key={f}
            className={classNames('biz-chip', statusFilter === f && 'biz-chip-active')}
            onClick={() => setStatusFilter(f)}
            data-testid={`business-inquiry-filter-${f}`}
          >
            {f === 'all'
              ? (isHt ? 'Tout' : 'All')
              : statusLabel(f)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="biz-ws-loading">
          <i className="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="biz-hub-empty" data-testid="business-inquiries-empty">
          <i className="fas fa-envelope-open-text" aria-hidden="true" />
          <h3>{t?.business_inquiry_empty || (isHt ? 'Pa gen demann ankò' : 'No inquiries yet')}</h3>
          <p>{t?.business_inquiry_empty_hint || (isHt
            ? 'Lè yon kliyan poze yon kesyon sou paj piblik biznis ou a, li ap parèt isit la.'
            : 'When a customer asks a question on your public business page, it will appear here.')}</p>
        </div>
      ) : (
        <div className="biz-inquiry-list">
          {filtered.map((inq) => (
            <article className="biz-card biz-inquiry-card" key={inq.id} data-testid="business-inquiry-card">
              <div className="biz-inquiry-head">
                <span className="biz-inquiry-topic" data-testid="business-inquiry-topic">
                  <i className={`fas ${TOPIC_ICONS[inq.topic] || 'fa-envelope'}`} aria-hidden="true" />
                  {topicLabel(inq.topic)}
                </span>
                <span
                  className="biz-status-pill"
                  style={{
                    background: `${statusColorFor(inq.status)}1f`,
                    color: statusColorFor(inq.status),
                    border: `1px solid ${statusColorFor(inq.status)}55`,
                  }}
                >
                  {statusLabel(inq.status)}
                </span>
              </div>
              <h4 className="biz-inquiry-subject">{inq.subject}</h4>
              <p className="biz-inquiry-meta">
                <i className="fas fa-user" aria-hidden="true" /> @{inq.customer_username}
                {' · '}
                {new Date(inq.created_at).toLocaleDateString(isHt ? 'fr-HT' : 'en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </p>
              {inq.item_name && (
                <p className="biz-inquiry-item">
                  <i className="fas fa-cube" aria-hidden="true" /> {inq.item_name}
                </p>
              )}
              <p className="biz-inquiry-body">{inq.body}</p>

              {inq.reply && (
                <div className="biz-inquiry-reply-box">
                  <p className="biz-inquiry-reply-label">
                    <i className="fas fa-reply" aria-hidden="true" /> {isHt ? 'Repons ou:' : 'Your reply:'}
                  </p>
                  <p className="biz-inquiry-reply-text">{inq.reply}</p>
                </div>
              )}

              <div className="biz-inquiry-actions">
                {inq.status !== 'closed' && (
                  <>
                    {replyingId === inq.id ? (
                      <>
                        <textarea
                          className="biz-form-input biz-inquiry-reply-input"
                          rows="3"
                          maxLength="3000"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={t?.business_inquiry_reply_placeholder || (isHt
                            ? 'Ekri repons ou...'
                            : 'Write your reply...')}
                          data-testid="business-inquiry-reply-input"
                        />
                        <div className="biz-inquiry-actions-row">
                          <button
                            type="button"
                            className="biz-btn biz-btn-ghost"
                            onClick={() => { setReplyingId(null); setReplyText(''); }}
                            disabled={busy}
                          >
                            {isHt ? 'Anile' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            className="biz-btn biz-btn-primary"
                            onClick={() => submitReply(inq)}
                            disabled={busy || !replyText.trim()}
                            data-testid="business-inquiry-reply-send"
                          >
                            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />
                            {t?.business_inquiry_send || (isHt ? 'Voye' : 'Send')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="biz-inquiry-actions-row">
                        <button
                          type="button"
                          className="biz-btn biz-btn-primary biz-btn-sm"
                          onClick={() => { setReplyingId(inq.id); setReplyText(''); }}
                          data-testid="business-inquiry-reply-btn"
                        >
                          <i className="fas fa-reply" aria-hidden="true" />
                          {t?.business_inquiry_reply || (isHt ? 'Reponn' : 'Reply')}
                        </button>
                        <button
                          type="button"
                          className="biz-btn biz-btn-ghost biz-btn-sm"
                          onClick={() => closeInquiry(inq)}
                          disabled={busy}
                          data-testid="business-inquiry-close-btn"
                        >
                          <i className="fas fa-xmark" aria-hidden="true" />
                          {t?.business_inquiry_close || (isHt ? 'Fèmen' : 'Close')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function statusColorFor(status) {
  return {
    new: '#f59e0b',
    replied: '#34d399',
    closed: '#94a3b8',
  }[status] || '#94a3b8';
}
