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
 * Responsive: on phones the split pane becomes two screens, not two
 * stacked boxes — the list fills the width until a conversation is
 * opened, then the thread takes over and the chat header's back button
 * returns to the list (see ``.messagesLayoutChatOpen`` in the CSS).
 *
 * Platform behaviours: the inbox refreshes itself every 30s (paused while
 * the tab is hidden) so a reply does not need a page reload, the list
 * filters as you type (accent-folded), the thread marks day boundaries,
 * and the creator's saved replies can be inserted, renamed (PATCH) and
 * deleted up to the backend's 30-template cap.
 *
 * Extracted from CreatorStudio.jsx during Etap 2 refactor.
 */
import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import api, { messagesService } from '../../../services/api';
import { EmptyState, SectionHeader, fmtDate } from '../shared';
import styles from './sections.module.css';
import { inlineText } from '../../../utils/inlineI18n';

const CONVERSATIONS_URL = 'messages/conversations/';

// Thread page size — matches THREAD_PAGE_SIZE in messaging/views.py. A long
// conversation loads newest-first; a page shorter than this means the top
// of the thread has been reached.
const THREAD_PAGE_SIZE = 50;

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

// Backend cap — MessageTemplate.MAX_PER_OWNER in messaging/models.py.
// Mirrored here only to show the creator where they stand ("12/30").
const MAX_TEMPLATES = 30;

// Accent-insensitive haystack so "jose" finds "José" and "yè" finds "ye".
function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// One key per calendar day, so the thread only draws a divider where the
// day actually changes instead of above every bubble.
function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today - day) / 86400000);
  const isHt = lang === 'ht';
  if (diffDays === 0) return isHt ? 'Jodi a' : inlineText(lang, 'Today');
  if (diffDays === 1) return isHt ? 'Yè' : inlineText(lang, 'Yesterday');
  return d.toLocaleDateString(isHt ? 'fr' : undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  // Which saved reply is being renamed ({ id, title }) — null when idle.
  const [editingTemplate, setEditingTemplate] = useState(null);
  // Inbox filter — local, because the list endpoint returns the whole
  // inbox for this user rather than one page of it.
  const [query, setQuery] = useState('');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  // Pagination of the open thread: is there more above the first page?
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const threadEndRef = useRef(null);
  const threadRef = useRef(null);
  const composerRef = useRef(null);
  // Scroll bookkeeping for "load older": remember the height before the
  // prepend, and skip the jump-to-bottom that a new thread normally does.
  const pendingScrollRef = useRef(null);
  const skipAutoScrollRef = useRef(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setState('ok');
    // No page param on purpose: the list endpoint returns the user's whole
    // inbox, which is what the search box filters over.
    api.get(CONVERSATIONS_URL)
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

  // Keep the inbox live while it is on screen: a platform inbox cannot
  // make people reload the page to see a reply. Silent — no skeleton, no
  // toast — and paused while the tab is hidden. The thread is fetched
  // first because its GET marks inbound messages read, so the badge
  // counts the conversation list then reports are already correct.
  useEffect(() => {
    if (state !== 'ok') return undefined;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        if (activeChat != null && !sending) {
          const threadRes = await api.get(`${CONVERSATIONS_URL}${activeChat}/messages/`, {
            params: { limit: THREAD_PAGE_SIZE },
          });
          const fresh = Array.isArray(threadRes.data) ? threadRes.data : [];
          // Refresh only the newest window — older pages the reader
          // loaded stay where they are.
          setThread((prev) => {
            if (!prev || prev.length === 0) return fresh;
            if (fresh.length === 0) return prev;
            const oldestFreshId = fresh[0].id;
            return [...prev.filter((m) => m.id < oldestFreshId), ...fresh];
          });
        }
        const res = await api.get(CONVERSATIONS_URL);
        const data = res.data?.results || res.data || [];
        setConversations(Array.isArray(data) ? data : []);
      } catch {
        // A dropped poll is not worth interrupting the user — the next
        // tick retries, and the retry button still covers real failures.
      }
    };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [state, activeChat, sending]);

  // ─── Open a conversation → fetch its thread ───────────────────────────
  // GET also marks every inbound message as read server-side, so zero out
  // the local unread badge for the conversation we just opened.
  const openChat = useCallback((convId) => {
    setActiveChat(convId);
    setTemplateOpen(false);
    setThread(null);
    setThreadLoading(true);
    api.get(`${CONVERSATIONS_URL}${convId}/messages/`, {
      params: { limit: THREAD_PAGE_SIZE },
    })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setThread(data);
        setHasMoreOlder(data.length === THREAD_PAGE_SIZE);
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

  // Back to the conversation list — the mobile half of the two-pane
  // layout, where the thread replaces the list instead of sitting next
  // to it. Clearing the thread also drops any open template menu.
  const closeChat = useCallback(() => {
    setActiveChat(null);
    setThread(null);
    setTemplateOpen(false);
    setHasMoreOlder(false);
  }, []);

  // Prepend the page above the oldest message we hold. The scroll position
  // is anchored on the message the reader was looking at, not reset to
  // the top — that is the whole difference between "history" and "jump".
  const loadOlder = useCallback(() => {
    if (olderLoading || activeChat == null) return;
    const oldest = (thread || [])[0];
    if (!oldest) return;
    pendingScrollRef.current = threadRef.current ? threadRef.current.scrollHeight : null;
    skipAutoScrollRef.current = true;
    setOlderLoading(true);
    api.get(`${CONVERSATIONS_URL}${activeChat}/messages/`, {
      params: { limit: THREAD_PAGE_SIZE, before: oldest.id },
    })
      .then((res) => {
        const older = Array.isArray(res.data) ? res.data : [];
        if (older.length === 0) {
          // Nothing older: stop offering the button, and do not swallow
          // the next real scroll with the skip flag.
          setHasMoreOlder(false);
          pendingScrollRef.current = null;
          skipAutoScrollRef.current = false;
          return;
        }
        setThread((prev) => [...older, ...(prev || [])]);
        setHasMoreOlder(older.length === THREAD_PAGE_SIZE);
      })
      .catch(() => {
        pendingScrollRef.current = null;
        skipAutoScrollRef.current = false;
        showToast?.(
          isHt ? 'Pa t kapab chaje plis mesaj.' : inlineText(lang, 'Could not load older messages.'),
          'exclamation-triangle',
        );
      })
      .finally(() => setOlderLoading(false));
  }, [olderLoading, activeChat, thread, isHt, lang, showToast]);

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
      .then(() => {
        setSavedTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
        setEditingTemplate((current) => (current?.id === id ? null : current));
      })
      .catch(() => showToast?.(
        isHt ? 'Pa t kapab efase modèl la.' : inlineText(lang, 'Could not delete the template.'),
        'exclamation-triangle',
      ));
  }, [isHt, lang, showToast]);

  // Clear every unread inbound message in one tap. Optimistic — the
  // badges drop immediately and are restored if the call fails, because
  // a triage button that waits on the network feels broken.
  const markAllRead = useCallback(() => {
    if (markingAllRead) return;
    const before = conversations || [];
    setMarkingAllRead(true);
    setConversations((prev) => (prev || []).map((conv) => (
      conv.unread_count > 0 ? { ...conv, unread_count: 0 } : conv
    )));
    messagesService.markAllRead()
      .then(() => showToast?.(
        isHt ? 'Tout mesaj make kòm li.' : inlineText(lang, 'All messages marked as read.'),
        'check-circle',
      ))
      .catch(() => {
        setConversations(before);
        showToast?.(
          isHt ? 'Pa t kapab make mesaj yo kòm li.' : inlineText(lang, 'Could not mark messages as read.'),
          'exclamation-triangle',
        );
      })
      .finally(() => setMarkingAllRead(false));
  }, [markingAllRead, conversations, isHt, lang, showToast]);

  // Rename a saved reply in place. Only the title goes up (PATCH), so the
  // creator's wording survives the rename untouched.
  const renameTemplate = useCallback((id, title) => {
    const next = String(title || '').trim();
    if (!next) return;
    messagesService.updateTemplate(id, { title: next })
      .then((res) => {
        setSavedTemplates((prev) => prev.map((tpl) => (
          tpl.id === id ? { ...tpl, ...res.data } : tpl
        )));
        setEditingTemplate(null);
      })
      .catch((err) => showToast?.(
        err?.response?.data?.title?.[0]
        || err?.response?.data?.detail
        || (isHt ? 'Pa t kapab chanje non modèl la.' : inlineText(lang, 'Could not rename the template.')),
        'exclamation-triangle',
      ));
  }, [isHt, lang, showToast]);

  // Auto-scroll the thread to the newest message whenever it changes —
  // except when the change WAS an older page being prepended.
  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [thread, threadLoading]);

  // Keep the reader's place after a page is prepended: layout effects run
  // before the passive auto-scroll above, so this wins.
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (!el || pendingScrollRef.current == null) return;
    el.scrollTop = el.scrollHeight - pendingScrollRef.current;
    pendingScrollRef.current = null;
  }, [thread]);

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
  // Unread across the whole inbox — drives the header badge and whether
  // "mark all as read" is worth showing at all.
  const unreadTotal = (conversations || []).reduce(
    (total, conv) => total + (conv.unread_count || 0), 0,
  );
  // Filter as you type — name AND last message, so "invoice" finds the
  // thread where somebody asked about one.
  const needle = normalize(query).trim();
  const conversationRows = needle
    ? (conversations || []).filter((conv) => normalize(
      `${conv.participant_name || ''} ${conv.last_message || ''}`,
    ).includes(needle))
    : (conversations || []);
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
        action={!isEmpty && unreadTotal > 0 ? (
          <div className={styles.messagesHeaderActions}>
            <span className={`${styles.badge} ${styles.unreadCount}`}>
              {conversations.filter((c) => c.unread_count > 0).length}{' '}
              {isHt ? 'nouvo' : inlineText(lang, 'new')}
            </span>
            <button
              type="button"
              className={styles.messagesMarkAllRead}
              onClick={markAllRead}
              disabled={markingAllRead}
            >
              <i
                className={`fas ${markingAllRead ? 'fa-spinner fa-spin' : 'fa-check-double'}`}
                aria-hidden="true"
              />
              {isHt ? 'Make tout kòm li' : inlineText(lang, 'Mark all as read')}
            </button>
          </div>
        ) : null}
      />
      {isEmpty ? (
        <EmptyState
          icon="fa-envelope-open-text"
          title={t.studio_no_messages_title || 'No messages yet'}
          hint={t.studio_no_messages_hint || 'When students or clients contact you, their conversations will appear here.'}
        />
      ) : (
        <div
          className={`${styles.messagesLayout} ${
            activeConv != null
              ? styles.messagesLayoutChatOpen
              : styles.messagesLayoutIdle
          }`}
        >
          <div className={styles.conversationList}>
            <div className={styles.conversationSearchWrap}>
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                className={styles.conversationSearch}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isHt ? 'Chèche yon konvèsasyon…' : inlineText(lang, 'Search conversations…')}
                aria-label={isHt ? 'Chèche konvèsasyon' : inlineText(lang, 'Search conversations')}
              />
              {query && (
                <button
                  type="button"
                  className={styles.conversationSearchClear}
                  onClick={() => setQuery('')}
                  aria-label={isHt ? 'Efase rechèch la' : inlineText(lang, 'Clear search')}
                >
                  <i className="fas fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>
            {conversationRows.map((conv) => (
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
            {conversationRows.length === 0 && (
              <p className={styles.conversationNoMatch}>
                {isHt
                  ? 'Pa gen konvèsasyon ki matche ak rechèch la.'
                  : inlineText(lang, 'No conversations match your search.')}
              </p>
            )}
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
                  {/* Mobile-only: the list is hidden while a thread is
                      open, so this is the way back to it. */}
                  <button
                    type="button"
                    className={styles.chatHeaderBack}
                    onClick={closeChat}
                    aria-label={isHt ? 'Tounen nan konvèsasyon yo' : inlineText(lang, 'Back to conversations')}
                    title={isHt ? 'Tounen' : inlineText(lang, 'Back')}
                  >
                    <i className="fas fa-arrow-left" aria-hidden="true" />
                  </button>
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
                {/* role="log" is the chat-transcript role: additions (a
                    polled reply, your own send) are announced politely. */}
                <div
                  className={styles.chatThread}
                  role="log"
                  ref={threadRef}
                  aria-label={isHt ? 'Konvèsasyon an' : inlineText(lang, 'Conversation')}
                >
                  {hasMoreOlder && (
                    <button
                      type="button"
                      className={styles.chatLoadOlder}
                      onClick={loadOlder}
                      disabled={olderLoading}
                    >
                      <i
                        className={`fas ${olderLoading ? 'fa-spinner fa-spin' : 'fa-clock-rotate-left'}`}
                        aria-hidden="true"
                      />
                      {olderLoading
                        ? (isHt ? 'Ap chaje…' : inlineText(lang, 'Loading…'))
                        : (isHt ? 'Chaje ansyen mesaj' : inlineText(lang, 'Load older messages'))}
                    </button>
                  )}
                  {(thread || []).length === 0 && (
                    <div className={styles.chatEmpty}>
                      <i className="fas fa-comment-dots" aria-hidden="true" />
                      <p>
                        {isHt
                          ? 'Poko gen mesaj nan konvèsasyon sa a. Voye yon bonjou.'
                          : inlineText(lang, 'No messages in this conversation yet. Say hello.')}
                      </p>
                    </div>
                  )}
                  {(thread || []).map((msg, index, all) => {
                    const mine = msg.sender_id !== activeConv.participant_id;
                    // Draw the day divider only where the day changes.
                    const key = dayKey(msg.created_at);
                    const prevKey = index > 0 ? dayKey(all[index - 1]?.created_at) : null;
                    const showDay = Boolean(key) && key !== prevKey;
                    return (
                      <React.Fragment key={msg.id}>
                        {showDay && (
                          <div className={styles.chatDayDivider} role="separator">
                            <span>{dayLabel(msg.created_at, lang)}</span>
                          </div>
                        )}
                        <div
                          className={`${styles.chatBubble} ${mine ? styles.chatBubbleMine : styles.chatBubbleTheirs}`}
                        >
                          <div className={styles.chatBubbleText}>{msg.body}</div>
                          <div className={styles.chatBubbleTime}>
                            {fmtDate(msg.created_at)}
                          </div>
                        </div>
                      </React.Fragment>
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
                            <span>{isHt ? 'Modèl pa m' : inlineText(lang, 'My templates')}</span>
                            <span className={styles.chatTemplatesCount}>
                              {savedTemplates.length}/{MAX_TEMPLATES}
                            </span>
                          </div>
                          {savedTemplates.map((tpl) => (
                            <div key={tpl.id} className={styles.chatTemplateRow}>
                              {editingTemplate?.id === tpl.id ? (
                                <form
                                  className={styles.chatTemplateEdit}
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    renameTemplate(tpl.id, editingTemplate.title);
                                  }}
                                >
                                  <input
                                    className={styles.chatTemplateEditInput}
                                    value={editingTemplate.title}
                                    onChange={(e) => setEditingTemplate({
                                      id: tpl.id,
                                      title: e.target.value,
                                    })}
                                    maxLength={80}
                                    aria-label={isHt ? 'Non modèl la' : inlineText(lang, 'Template title')}
                                  />
                                  <button
                                    type="submit"
                                    className={styles.chatTemplateEditBtn}
                                    disabled={!editingTemplate.title.trim()}
                                    aria-label={isHt ? 'Sove non an' : inlineText(lang, 'Save title')}
                                  >
                                    <i className="fas fa-check" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.chatTemplateEditBtn}
                                    onClick={() => setEditingTemplate(null)}
                                    aria-label={isHt ? 'Anile' : inlineText(lang, 'Cancel')}
                                  >
                                    <i className="fas fa-xmark" aria-hidden="true" />
                                  </button>
                                </form>
                              ) : (
                                <>
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
                                    onClick={() => setEditingTemplate({ id: tpl.id, title: tpl.title })}
                                    aria-label={`${isHt ? 'Chanje non modèl' : inlineText(lang, 'Edit template')}: ${tpl.title}`}
                                    title={isHt ? 'Chanje non modèl' : inlineText(lang, 'Edit template')}
                                  >
                                    <i className="fas fa-pen" aria-hidden="true" />
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
                                </>
                              )}
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
