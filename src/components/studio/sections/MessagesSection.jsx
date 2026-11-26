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
import api, { messagesService } from '../../../services/api';
import { EmptyState, SectionHeader, fmtDate } from '../shared';
import styles from './sections.module.css';
import { inlineText } from '../../../utils/inlineI18n';

const CONVERSATIONS_URL = 'messages/conversations/';

// Shared bilingual help for the page header — reused across the
// unavailable / error / main render paths so the copy stays in one place.
const MESSAGES_HELP = {
  ht: 'Bwat mesaj ou — konvèsasyon ak etidyan, kliyan ak lòt kreyatè yo. Klike sou yon konvèsasyon pou li mesaj yo.',
  en: 'Your inbox — conversations with students, clients and fellow creators. Click a conversation to read its messages.',
};

// Canned replies — the fastest way to answer the questions creators get
// most (price, delivery, thanks for a tip). Inserted into the draft, never
// sent straight away: the creator edits then sends.
const REPLY_TEMPLATES = [
  {
    id: 'greeting',
    icon: 'fa-hand-wave',
    ht: 'Bonjou! Mèsi pou mesaj ou. Ki jan mwen ka ede w?',
    en: 'Hi! Thanks for reaching out. How can I help?',
  },
  {
    id: 'quote',
    icon: 'fa-tag',
    ht: 'Mèsi pou enterè w. Pri a se $— . Mwen ka voye detay yo si w vle.',
    en: 'Thanks for your interest. The price is $—. I can send the details if you want.',
  },
  {
    id: 'delivery',
    icon: 'fa-truck',
    ht: 'Kòmand ou an ap prepare. Li ap soti nan 2 a 3 jou ouvrab epi w ap resevwa yon imèl ak nimewo swivi a.',
    en: 'Your order is being prepared. It ships in 2–3 business days and you will get a tracking email.',
  },
  {
    id: 'tip',
    icon: 'fa-hand-holding-heart',
    ht: 'Mèsi anpil pou tip la — sa ede m kontinye kreye!',
    en: 'Thank you so much for the tip — it keeps me creating!',
  },
  {
    id: 'later',
    icon: 'fa-clock',
    ht: 'Mèsi pou mesaj ou. M ap reponn ou pi vit posib.',
    en: 'Thanks for your message. I will reply as soon as I can.',
  },
];

// Layout-matched loading state: the inbox is a list + a chat pane, so the
// placeholder copies that geometry instead of flashing generic bars.
function MessagesSkeleton() {
  return (
    <div
      className={styles.section}
      role="status"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className={styles.messagesSkeletonLayout} aria-hidden="true">
        <div className={styles.messagesSkeletonList}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.conversationSkeleton}>
              <span className={styles.skeletonDot} />
              <span className={styles.skeletonStack}>
                <span className={styles.skeletonLineLg} />
                <span className={styles.skeletonLineSm} />
              </span>
            </div>
          ))}
        </div>
        <div className={styles.messagesSkeletonChat}>
          <span className={styles.skeletonLineSm} style={{ width: '35%' }} />
          <span className={`${styles.chatSkeletonBubble} ${styles.chatSkeletonTheirs}`} />
          <span className={`${styles.chatSkeletonBubble} ${styles.chatSkeletonMine}`} />
          <span className={`${styles.chatSkeletonBubble} ${styles.chatSkeletonTheirs} ${styles.chatSkeletonShort}`} />
        </div>
      </div>
    </div>
  );
}

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
  const [templateOpen, setTemplateOpen] = useState(false);
  // The creator's own saved replies, next to the five built-in ones.
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const threadEndRef = useRef(null);
  const composerRef = useRef(null);

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
    setTemplateOpen(false);
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
        showToast?.(isHt ? 'Pa t kapab chaje konvèsasyon an.' : inlineText(lang, 'Could not load the conversation.'), 'exclamation-triangle');
      })
      .finally(() => setThreadLoading(false));
  }, [isHt, showToast]);

  // Load the creator's saved replies once (and on retry).
  useEffect(() => {
    let cancelled = false;
    messagesService.templates()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        setSavedTemplates(Array.isArray(data) ? data : (data?.results || []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [retryKey]);

  // Insert a canned reply into the draft (editable before sending).
  const insertTemplate = useCallback((text) => {
    const value = String(text || '').trim();
    if (!value) return;
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${value}` : value));
    setTemplateOpen(false);
    composerRef.current?.focus();
  }, []);

  // Save the current draft as the creator's own template — the title is
  // the first few words so it is recognisable in the menu without asking
  // for a second form.
  const saveTemplate = useCallback(() => {
    const body = draft.trim();
    if (!body || templateSaving) return;
    const title = body.split(/\s+/).slice(0, 4).join(' ').slice(0, 60);
    setTemplateSaving(true);
    messagesService.createTemplate({ title, body })
      .then((res) => {
        setSavedTemplates((prev) => [res.data, ...prev]);
        showToast?.(
          isHt ? 'Modèl sove.' : inlineText(lang, 'Template saved.'),
          'check-circle',
        );
      })
      .catch((err) => {
        showToast?.(
          err?.response?.data?.detail
          || (isHt ? 'Pa t kapab sove modèl la.' : inlineText(lang, 'Could not save the template.')),
          'exclamation-triangle',
        );
      })
      .finally(() => setTemplateSaving(false));
  }, [draft, templateSaving, isHt, lang, showToast]);

  const removeTemplate = useCallback((id) => {
    messagesService.deleteTemplate(id)
      .then(() => setSavedTemplates((prev) => prev.filter((tpl) => tpl.id !== id)))
      .catch(() => showToast?.(
        isHt ? 'Pa t kapab efase modèl la.' : inlineText(lang, 'Could not delete the template.'),
        'exclamation-triangle',
      ));
  }, [isHt, lang, showToast]);

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
        showToast?.(isHt ? 'Pa t kapab voye mesaj la.' : inlineText(lang, 'Could not send the message.'), 'exclamation-triangle');
      })
      .finally(() => setSending(false));
  }, [draft, sending, activeChat, isHt, showToast]);

  if (loading) return <MessagesSkeleton />;

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
          <h3>{isHt ? 'Mesaj ap vini byento' : inlineText(lang, 'Messaging is coming soon')}</h3>
          <p>
            {isHt
              ? 'N ap travay sou yon sistèm mesaj pou kreyatè yo. Lè li pare, konvèsasyon ou yo ap parèt isit la.'
              : inlineText(lang, 'We are building a messaging system for creators. When it ships, your conversations will appear here.')}
          </p>
          <button
            type="button"
            className={styles.messagesRetryBtn}
            onClick={() => { setRetryKey(k => k + 1); }}
          >
            <i className="fas fa-rotate-right" aria-hidden="true" />
            {isHt ? 'Tcheke ankò' : inlineText(lang, 'Check again')}
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
          <h3>{isHt ? 'Pa t kapab chaje mesaj yo' : inlineText(lang, 'Could not load messages')}</h3>
          <p>
            {isHt
              ? 'Gen yon pwoblèm koneksyon. Eseye ankò nan kèk segond.'
              : inlineText(lang, 'There was a connection problem. Try again in a moment.')}
          </p>
          <button
            type="button"
            className={styles.messagesRetryBtn}
            onClick={() => { setRetryKey(k => k + 1); }}
          >
            <i className="fas fa-rotate-right" aria-hidden="true" />
            {isHt ? 'Eseye ankò' : inlineText(lang, 'Retry')}
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
            {isHt ? 'nouvo' : inlineText(lang, 'new')}
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
                  {isHt ? 'Chwazi yon konvèsasyon' : inlineText(lang, 'Select a conversation')}
                </p>
              </div>
            ) : threadLoading ? (
              <div
                className={styles.chatPane}
                role="status"
                aria-busy="true"
                aria-label={isHt ? 'Ap chaje konvèsasyon an' : inlineText(lang, 'Loading conversation')}
              >
                <div className={styles.chatThread} aria-hidden="true">
                  <span className={`${styles.chatSkeletonBubble} ${styles.chatSkeletonTheirs}`} />
                  <span className={`${styles.chatSkeletonBubble} ${styles.chatSkeletonMine}`} />
                  <span className={`${styles.chatSkeletonBubble} ${styles.chatSkeletonTheirs} ${styles.chatSkeletonShort}`} />
                </div>
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
                <div className={styles.chatComposeArea}>
                  {templateOpen && (
                    <div
                      className={styles.chatTemplates}
                      role="menu"
                      aria-label={isHt ? 'Modèl repons' : inlineText(lang, 'Reply templates')}
                    >
                      {savedTemplates.length > 0 && (
                        <>
                          <div className={styles.chatTemplatesGroup} role="presentation">
                            {isHt ? 'Modèl pa m' : inlineText(lang, 'My templates')}
                          </div>
                          {savedTemplates.map((tpl) => (
                            <div key={tpl.id} className={styles.chatTemplateRow}>
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.chatTemplateItem}
                                onClick={() => insertTemplate(tpl.body)}
                              >
                                <i className="fas fa-bookmark" aria-hidden="true" />
                                <span>{tpl.title}</span>
                              </button>
                              <button
                                type="button"
                                className={styles.chatTemplateDelete}
                                onClick={() => removeTemplate(tpl.id)}
                                aria-label={`${isHt ? 'Efase modèl' : inlineText(lang, 'Delete template')}: ${tpl.title}`}
                                title={isHt ? 'Efase modèl' : inlineText(lang, 'Delete template')}
                              >
                                <i className="fas fa-trash" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <div className={styles.chatTemplatesGroup} role="presentation">
                            {isHt ? 'Modèl debaz' : inlineText(lang, 'Built-in templates')}
                          </div>
                        </>
                      )}
                      {REPLY_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          role="menuitem"
                          className={styles.chatTemplateItem}
                          onClick={() => insertTemplate(isHt ? tpl.ht : inlineText(lang, tpl.en))}
                        >
                          <i className={`fas ${tpl.icon}`} aria-hidden="true" />
                          <span>{isHt ? tpl.ht : inlineText(lang, tpl.en)}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.chatTemplatesSave}
                        onClick={saveTemplate}
                        disabled={!draft.trim() || templateSaving}
                      >
                        <i className={`fas ${templateSaving ? 'fa-spinner fa-spin' : 'fa-plus'}`} aria-hidden="true" />
                        {isHt ? 'Sove mesaj sa a kòm modèl' : inlineText(lang, 'Save this message as a template')}
                      </button>
                    </div>
                  )}
                  <form
                    className={styles.chatComposer}
                    onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                  >
                    <button
                      type="button"
                      className={styles.chatTemplatesToggle}
                      onClick={() => setTemplateOpen((open) => !open)}
                      aria-expanded={templateOpen}
                      aria-haspopup="menu"
                      aria-label={isHt ? 'Modèl repons' : inlineText(lang, 'Reply templates')}
                      title={isHt ? 'Modèl repons' : inlineText(lang, 'Reply templates')}
                    >
                      <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
                    </button>
                    <input
                      ref={composerRef}
                      type="text"
                      className={styles.chatComposerInput}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={isHt ? 'Ekri yon mesaj...' : inlineText(lang, 'Type a message...')}
                      aria-label={isHt ? 'Mesaj' : inlineText(lang, 'Message')}
                      maxLength={2000}
                    />
                    <button
                      type="submit"
                      className={styles.chatComposerSend}
                      disabled={sending || !draft.trim()}
                      aria-label={isHt ? 'Voye' : inlineText(lang, 'Send')}
                    >
                      {sending
                        ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                        : <i className="fas fa-paper-plane" aria-hidden="true" />}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
