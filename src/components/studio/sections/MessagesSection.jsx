/**
 * src/components/studio/sections/MessagesSection.jsx
 *
 * Messages section — split-pane layout with conversation list on the left
 * and a chat view on the right.
 *
 * Honest-state contract: the conversations API (``messages/conversations/``)
 * may not be deployed yet on a given environment (the chat surface was
 * dropped from the backend in Phase 51 and has not been re-added). This
 * component distinguishes three outcomes instead of faking an empty inbox:
 *
 *   1. 200 + rows      → real conversations → split-pane list.
 *   2. 200 + no rows   → real (empty) inbox → EmptyState with a CTA.
 *   3. 404 / endpoint
 *      missing         → messaging not available on this backend → a clear
 *                        "Messages coming soon" state (NOT "no messages"),
 *                        so the user knows the feature is off, not broken.
 *   4. network error   → "Could not load" with a Retry button.
 *
 * Chat pane: clicking a conversation fetches its thread via
 * ``GET messages/conversations/<id>/messages/`` (the backend marks inbound
 * messages read there) and POSTs replies to the same route. Since a
 * conversation is always 1:1, ``sender_id === conv.participant_id`` means
 * the bubble is from the other person — everything else is mine.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../../services/api';
import { StudioSkeleton, EmptyState, SectionHeader, fmtDate } from '../shared';
import styles from './sections.module.css';

const CONVERSATIONS_URL = 'messages/conversations/';

// Shared bilingual help for the page header — reused across the
// unavailable / error / main render paths so the copy stays in one place.
const MESSAGES_HELP = {
  ht: 'Bwat mesaj ou — konvèsasyon ak etidyan, kliyan ak lòt kreyatè yo. Klike sou yon konvèsasyon pou li mesaj yo.',
  en: 'Your inbox — conversations with students, clients and fellow creators. Click a conversation to read its messages.',
};

export default function MessagesSection({ lang, t, showToast }) {
  const isHt = lang === 'ht';
  const [activeChat, setActiveChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState(null);
  // 'ok' | 'unavailable' | 'error' — see header comment for the contract.
  const [state, setState] = useState('ok');
  const [retryKey, setRetryKey] = useState(0);
  // ─── Thread state ─────────────────────────────────────────────────────
  const [thread, setThread] = useState(null);        // null = not loaded yet
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setState('ok');
    api.get(CONVERSATIONS_URL, { params: { limit: 20 } })
      .then((res) => {
        if (!cancelled) {
          const data = res.data?.results || res.data || [];
          setConversations(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // A 404 means the endpoint doesn't exist on this backend —
        // messaging is not available yet (NOT an empty inbox).
        if (err?.response?.status === 404) {
          setState('unavailable');
          setConversations([]);
        } else {
          setState('error');
          setConversations([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retryKey]);

  // Intentional synchronous reset so the retry button starts a clean
  // fetch — matches the fetch-effect pattern used across App.jsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => load(), [load]);

  // ─── Open a conversation → fetch its thread ───────────────────────────
  // GET also marks every inbound message as read server-side, so zero out
  // the local unread badge for the conversation we just opened.
  const openChat = useCallback((convId) => {
    setActiveChat(convId);
    setThread(null);
    setThreadLoading(true);
    api.get(`${CONVERSATIONS_URL}${convId}/messages/`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setThread(data);
        // Inbound messages are now read — drop the badge locally so the
        // list reflects the server state without a refetch.
        setConversations((prev) => (prev || []).map((c) =>
          c.id === convId ? { ...c, unread_count: 0 } : c,
        ));
      })
      .catch(() => {
        setThread([]);
        showToast?.(isHt ? 'Pa t kapab chaje konvèsasyon an.' : 'Could not load the conversation.', 'exclamation-triangle');
      })
      .finally(() => setThreadLoading(false));
  }, [isHt, showToast]);

  // Auto-scroll the thread to the newest message whenever it changes.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [thread, threadLoading]);

  // ─── Send a reply ─────────────────────────────────────────────────────
  const sendReply = useCallback(() => {
    const body = draft.trim();
    if (!body || sending || activeChat == null) return;
    setSending(true);
    api.post(`${CONVERSATIONS_URL}${activeChat}/messages/`, { body })
      .then((res) => {
        const created = res.data;
        setThread((prev) => [...(prev || []), created]);
        setDraft('');
        // Bump the list preview + float the conversation to the top, the
        // same way the backend's updated_at touch reorders it on refetch.
        setConversations((prev) => {
          const list = prev || [];
          const rest = list.filter((c) => c.id !== activeChat);
          const current = list.find((c) => c.id === activeChat);
          if (!current) return list;
          return [{
            ...current,
            last_message: created.body,
            last_message_at: created.created_at,
          }, ...rest];
        });
      })
      .catch(() => {
        showToast?.(isHt ? 'Pa t kapab voye mesaj la.' : 'Could not send the message.', 'exclamation-triangle');
      })
      .finally(() => setSending(false));
  }, [draft, sending, activeChat, isHt, showToast]);

  if (loading) return <StudioSkeleton rows={4} />;

  // ─── Messaging not deployed on this backend (404) ────────────────
  if (state === 'unavailable') {
    return (
      <div className={styles.section}>
        <SectionHeader
          icon="fa-envelope"
          title={t.studio_messages || 'Messages'}
          lang={lang}
          help={MESSAGES_HELP}
        />
        <div className={styles.messagesUnavailable}>
          <div className={styles.messagesUnavailableIcon}>
            <i className="fas fa-hourglass-half" aria-hidden="true" />
          </div>
          <h3>{isHt ? 'Mesaj ap vini byento' : 'Messaging is coming soon'}</h3>
          <p>
            {isHt
              ? 'N ap travay sou yon sistèm mesaj pou kreyatè yo. Lè li pare, konvèsasyon ou yo ap parèt isit la.'
              : 'We are building a messaging system for creators. When it ships, your conversations will appear here.'}
          </p>
          <button
            type="button"
            className={styles.messagesRetryBtn}
            onClick={() => { setRetryKey(k => k + 1); }}
          >
            <i className="fas fa-rotate-right" aria-hidden="true" />
            {isHt ? 'Tcheke ankò' : 'Check again'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Network / server error ──────────────────────────────────────
  if (state === 'error') {
    return (
      <div className={styles.section}>
        <SectionHeader
          icon="fa-envelope"
          title={t.studio_messages || 'Messages'}
          lang={lang}
          help={MESSAGES_HELP}
        />
        <div className={styles.messagesError}>
          <div className={styles.messagesErrorIcon}>
            <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          </div>
          <h3>{isHt ? 'Pa t kapab chaje mesaj yo' : 'Could not load messages'}</h3>
          <p>
            {isHt
              ? 'Gen yon pwoblèm koneksyon. Eseye ankò nan kèk segond.'
              : 'There was a connection problem. Try again in a moment.'}
          </p>
          <button
            type="button"
            className={styles.messagesRetryBtn}
            onClick={() => { setRetryKey(k => k + 1); }}
          >
            <i className="fas fa-rotate-right" aria-hidden="true" />
            {isHt ? 'Eseye ankò' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = !conversations || conversations.length === 0;
  const activeConv = (conversations || []).find((c) => c.id === activeChat) || null;
  // Thread subject — the first message that carries one (messages sent
  // from the public-profile contact modal include the visitor's subject
  // line; plain chat replies have none, so the header falls back to the
  // participant name only).
  const threadSubject = (thread || []).find((m) => String(m.subject || '').trim())?.subject || '';

  return (
    <div className={styles.section}>
      <SectionHeader
        icon="fa-envelope"
        title={t.studio_messages || 'Messages'}
        lang={lang}
        help={MESSAGES_HELP}
        action={!isEmpty ? (
          <span className={`${styles.badge} ${styles.unreadCount}`}>
            {conversations.filter((c) => c.unread_count > 0).length}{' '}
            {isHt ? 'nouvo' : 'new'}
          </span>
        ) : null}
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-envelope-open-text"
          title={t.studio_no_messages_title || 'No messages yet'}
          hint={t.studio_no_messages_hint || 'When students or clients contact you, their conversations will appear here.'}
        />
      ) : (
        <div className={styles.messagesLayout}>
          <div className={styles.conversationList}>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className={`${styles.conversationItem} ${activeChat === conv.id ? styles.conversationActive : ''}`}
                onClick={() => openChat(conv.id)}
              >
                <div className={styles.conversationAvatar}>
                  {conv.participant_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className={styles.conversationBody}>
                  <div className={styles.conversationName}>
                    {conv.participant_name || 'Unknown'}
                    {conv.unread_count > 0 && (
                      <span className={styles.unreadBadge}>{conv.unread_count}</span>
                    )}
                  </div>
                  <div className={styles.conversationPreview}>
                    {conv.last_message || '(no messages)'}
                  </div>
                  <div className={styles.conversationTime}>
                    {fmtDate(conv.last_message_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className={styles.chatView}>
            {activeConv == null ? (
              <div className={styles.chatPlaceholder}>
                <i className="fas fa-envelope-open-text" aria-hidden="true" />
                <p>
                  {isHt ? 'Chwazi yon konvèsasyon' : 'Select a conversation'}
                </p>
              </div>
            ) : threadLoading ? (
              <div className={styles.chatPlaceholder}>
                <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                <p>{isHt ? 'Ap chaje...' : 'Loading...'}</p>
              </div>
            ) : (
              <div className={styles.chatPane}>
                <div className={styles.chatHeader}>
                  <div className={styles.chatHeaderAvatar}>
                    {activeConv.participant_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className={styles.chatHeaderName}>
                    {activeConv.participant_name || 'Unknown'}
                  </span>
                  {threadSubject && (
                    <span className={styles.chatHeaderSubject} title={threadSubject}>
                      {threadSubject}
                    </span>
                  )}
                </div>
                <div className={styles.chatThread}>
                  {(thread || []).map((msg) => {
                    const mine = msg.sender_id !== activeConv.participant_id;
                    return (
                      <div
                        key={msg.id}
                        className={`${styles.chatBubble} ${mine ? styles.chatBubbleMine : styles.chatBubbleTheirs}`}
                      >
                        <div className={styles.chatBubbleText}>{msg.body}</div>
                        <div className={styles.chatBubbleTime}>
                          {fmtDate(msg.created_at)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>
                <form
                  className={styles.chatComposer}
                  onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                >
                  <input
                    type="text"
                    className={styles.chatComposerInput}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={isHt ? 'Ekri yon mesaj...' : 'Type a message...'}
                    aria-label={isHt ? 'Mesaj' : 'Message'}
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className={styles.chatComposerSend}
                    disabled={sending || !draft.trim()}
                    aria-label={isHt ? 'Voye' : 'Send'}
                  >
                    {sending
                      ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      : <i className="fas fa-paper-plane" aria-hidden="true" />}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
