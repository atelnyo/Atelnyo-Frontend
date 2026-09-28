/**
 * src/components/chatbotCommands.js
 *
 * Extracted chatbot command/intent detection + action execution.
 * Pure functions for detection, API-connected functions for execution.
 */
import api from '../services/api';

// ─── Quick Actions / Intent Detection ───────────────────────────
export const INTENTS = {
  course: {
    patterns: /kou|course|approndi|learn|klass|class|lecon|lesson|pwogramasyon|programming|design|mizik|music|lang|business/i,
    action: 'browse_courses',
    label: { ht: '📚 Vizyalize kou yo', en: '📚 Browse courses', fr: '📚 Voir les cours', es: '📚 Ver cursos' },
  },
  explore: {
    patterns: /explore|dekovri|discover|gade|see|tcheke|check|tout|all|anyen|everything/i,
    action: 'browse_explore',
    label: { ht: '🔍 Ale sou Explore', en: '🔍 Go to Explore', fr: '🔍 Aller à Explore', es: '🔍 Ir a Explorar' },
  },
  premium: {
    patterns: /premium|abone|subscribe|plan|membership|konpayi|pay|pri|price/i,
    action: 'show_premium',
    label: { ht: '⭐ Wè Premium', en: '⭐ See Premium', fr: '⭐ Voir Premium', es: '⭐ Ver Premium' },
  },
  help: {
    patterns: /kipi|mwen|kijan|how|ki jan|konnen|know|ed|help|assist|akide/i,
    action: 'get_help',
    label: { ht: '💡 Ede m', en: '💡 Help me', fr: '💡 Aidez-moi', es: '💡 Ayúdame' },
  },
  creator: {
    patterns: /kreyatè|creator|create|fè|make|kreye|studio|upload|pibliye|publish/i,
    action: 'creator_info',
    label: { ht: '🎨 Enfo kreyatè', en: '🎨 Creator info', fr: '🎨 Info créateur', es: '🎨 Info creador' },
  },
  progress: {
    patterns: /progres|pwoGRES|apprantisaj|learning|aprendizaje|kou mwen|my courses|mwen ap aprann|i'm learning|mwen enskri|enrolled|swiper|swiper$/,
    action: 'show_progress',
    label: { ht: '📊 PwoGRES mwen', en: '📊 My Progress', fr: '📊 Mon progrès', es: '📊 Mi progreso' },
  },
  calendar: {
    patterns: /kalann|kalandriye|calendar|evènman|events|dat|date|rantevou|appointment|semèn|week/i,
    action: 'show_calendar',
    label: { ht: '📅 Evènman', en: '📅 Events', fr: '📅 Événements', es: '📅 Eventos' },
  },
  wallet: {
    patterns: /bous|wallet|lajan|money|solde|balance|transaksyon|transactions|ransan|earnings|peye|payout/i,
    action: 'show_wallet',
    label: { ht: '💰 Bous mwen', en: '💰 My Wallet', fr: '💰 Mon portefeuille', es: '💰 Mi billetera' },
  },
  saved: {
    patterns: /sove|saved|bookmark|renmen|favorite|liked|mwen make|mwen guard|mwen retne/i,
    action: 'show_saved',
    label: { ht: '⭐ Moun yo sove', en: '⭐ Saved Items', fr: '⭐ Éléments sauvegardés', es: '⭐ Elementos guardados' },
  },
};

// ─── Command Detection — parse action intents from user message ──
const COMMAND_PATTERNS = [
  // Open / navigate
  { regex: /^(?:ouvri|open|ale|go\s+to|avigate|navigue|va\s+a|lanse|launch|montre\s+m|mwen\s+vle\s+wi?e?|show\s+me|I\s+want\s+to\s+see|d\u00e9sire\s+voir|quiero\s+ver)\s+(?:kou|course|pwogram|program|mizik|music|talan|talent|travay|job|kominote|community|pwodwi|product|event|evènman|pòtfolyo|portfolio)/i,
    type: 'search_and_navigate',
  },
  // Course-specific search
  { regex: /^(?:ki\s+kou|ki\s+enskri|kou\s+(?:sou|nan|pou|about|on|for)|course\s+(?:about|on|for|in)|enskri\s+m\s+dans|enskri\s+m\s+sou|konseye\s+m\s+pou|rekomande\s+m\s+pou|rekomande\s+m\s+n|ban\s+m\s+kou|give\s+me\s+course|suggest\s+course|recommend\s+course|kijan\s+mwen\s+ka\s+apprann|how\s+(?:can\s+I|do\s+I)\s+learn|comment\s+(?:puis-je|apprendre)|c[oó]mo\s+(?:puedo|aprender))\s*(.*)/i,
    type: 'course_search',
  },
  // Search
  { regex: /^(?:cheche|search|chihche|trouv|find|recherche|buscar|chim|look\s+for|hunt\s+for|mwen\s+chim|mwen\s+bezwen|I\s+need|I'm\s+looking|je\s+cherche|busco)\s+(.+)/i,
    type: 'search',
  },
  // Enroll
  { regex: /^(?:enskri|enroll|enskri\s+m|inscris|inscri|join|anrejistre|register|mwen\s+vle\s+enskri|I\s+want\s+to\s+enroll|je\s+veux\s+m'inscrire|quiero\s+inscribirme)\s+(?:\s+(?:\w+\s*)+)?$/i,
    type: 'enroll',
  },
  // Save / bookmark
  { regex: /^(?:sove|save|bookmark|ranpli|marquer|guardar|retne|mwen\s+vle\s+sove|I\s+want\s+to\s+save|je\s+veux\s+sauvegarder)\s+(.+)/i,
    type: 'save',
  },
  // My progress / learning
  { regex: /^(?:ki\s+kou|mwen\s+enskri|mwen\s+ap\s+aprann|my\s+(?:courses|progress|learning)|mes\s+cours|mwen\s+progrès|mwen\s+swiper|swiper\s+mwen|mwen\s+touche|courses?\s+(?:I|sa|mwen))/i,
    type: 'progress',
  },
  // Calendar / events
  { regex: /^(?:kalann|kalandriye|calendar|evènman|events?|dat|rantevou|mwen\s+vle\s+wè\s+evènman|show\s+(?:me\s+)?events?|upcoming|pròch)/i,
    type: 'calendar',
  },
  // Wallet / earnings
  { regex: /^(?:bous|wallet|lajan|solde|balance|transaksyon|transactions?|ransan|earnings|mwen\s+touche|peye|payout|ban\s+mwen\s+solde|wallet\s+mwen)/i,
    type: 'wallet',
  },
  // Saved / bookmarks
  { regex: /^(?:sove|mwen\s+sove|saved|bookmark|mwen\s+make|liked|mwen\s+renmen|mwen\s+guard|mwen\s+retne|show\s+(?:me\s+)?saved)/i,
    type: 'saved',
  },
  // Follow creator
  { regex: /^(?:follow|swiv|abonne|mwen\s+vle\s+swiv|mwen\s+vle\s+follow|rekomande\s+m\s+kreyatè)/i,
    type: 'follow',
  },
  // Send message
  { regex: /^(?:voye\s+mesaj|send\s+message|ekri\s+ba|write\s+to|mwen\s+vle\s+voye|mwen\s+vle\s+ekri)/i,
    type: 'send_message',
  },
  // Join community
  { regex: /^(?:rejwine|join|mwen\s+vle\s+rejwine|mwen\s+vle\s+join|antre\s+dans)/i,
    type: 'join_community',
  },
  // Check notifications
  { regex: /^(?:notifikasyon|notifications?|notify|ban\s+mwen\s+notifikasyon|show\s+(?:me\s+)?notifications?|ki\s+notifikasyon|mwen\s+gen\s+notifikasyon)(?:\s+(?:kou|course|mizik|music|kreyatè|creator|kominote|community|mesaj|message|tout|all|pa\s+li|unread|li|read))?/i,
    type: 'notifications',
  },
  // Mark notifications as read
  { regex: /^(?:mark\s+read|li\s+tout|read\s+all|efase\s+notifikasyon|clear\s+notifikasyon|mark\s+all\s+read)/i,
    type: 'mark_read',
  },
];

/**
 * Parse a user message into a structured command.
 * Returns { type, query, raw } or { type: 'url', url, raw } or null.
 */
export function parseCommand(message) {
  const msg = message.trim().toLowerCase();
  for (const cmd of COMMAND_PATTERNS) {
    const match = msg.match(cmd.regex);
    if (match) {
      return { type: cmd.type, query: (match[1] || '').trim(), raw: message };
    }
  }
  // Detect standalone URLs
  const urlMatch = message.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    return { type: 'url', url: urlMatch[0], raw: message };
  }
  return null;
}

/**
 * Detect user intent from message (for inline suggestions).
 * Returns { key, patterns, action, label } or null.
 */
export function detectIntent(message) {
  for (const [key, intent] of Object.entries(INTENTS)) {
    if (intent.patterns.test(message)) {
      return { key, ...intent };
    }
  }
  return null;
}

/**
 * DEIE Mentor intent detection.
 */
const MENTOR_PATTERNS = /\b(learn|approndi|course|kou|skill|konpetans|career|karye|job|travay|plan|path|chimen|recommend|sugger|advise|konsey|gap|manke|next|sa m dwe|what should i|ki sa mwen dwe|ki sa m ap bezwen)\b/i;

export function isMentorIntent(message) {
  return MENTOR_PATTERNS.test(message);
}

// ═══════════════════════════════════════════════════════════════════
// ACTION EXECUTION — connect chatbot commands to real API calls
// ═══════════════════════════════════════════════════════════════════

/**
 * Enroll the current user in a course.
 * @param {number|string} courseId
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function executeEnroll(courseId) {
  try {
    await api.post(`courses/${courseId}/enroll/`);
    return { success: true, message: 'enrolled' };
  } catch (err) {
    const msg = err?.response?.data?.detail || err?.message || 'Enrollment failed';
    return { success: false, message: msg };
  }
}

/**
 * Save/unsave an item (course, music, talent).
 * @param {string} type — 'course' | 'music' | 'talent'
 * @param {number|string} itemId
 * @returns {Promise<{success: boolean, saved: boolean}>}
 */
export async function executeToggleSave(type, itemId) {
  try {
    // Check if already saved, then toggle
    const check = await api.get('explore/saved/items/', { params: { item_type: type, item_id: itemId, limit: 1 } });
    const existing = (check?.data?.results || check?.data || []).length > 0;
    if (existing) {
      await api.delete(`explore/saved/items/0/?item_type=${type}&item_id=${itemId}`);
      return { success: true, saved: false };
    }
    await api.post('explore/saved/items/', { item_type: type, item_id: Number(itemId) });
    return { success: true, saved: true };
  } catch (err) {
    return { success: false, saved: false };
  }
}

/**
 * Follow/unfollow a creator.
 * @param {string} username
 * @returns {Promise<{success: boolean, following: boolean}>}
 */
export async function executeFollowCreator(username) {
  try {
    const res = await api.post(`creator-profiles/${encodeURIComponent(username)}/follow/`);
    return { success: true, following: res?.data?.following ?? true };
  } catch (err) {
    return { success: false, following: false };
  }
}

/**
 * Send a message to a creator.
 * @param {string} username — creator slug
 * @param {string} message — message text
 * @returns {Promise<{success: boolean, conversationId?: number}>}
 */
export async function executeSendMessage(username, message) {
  try {
    const res = await api.post(`creator-profiles/${encodeURIComponent(username)}/send-message/`, { subject: 'Message from chatbot', body: message });
    return { success: true, conversationId: res?.data?.conversation_id };
  } catch (err) {
    const msg = err?.response?.data?.detail || err?.message || 'Message failed';
    return { success: false, message: msg };
  }
}

/**
 * Join a community.
 * @param {string} slug — community slug
 * @returns {Promise<{success: boolean, member: boolean}>}
 */
export async function executeJoinCommunity(slug) {
  try {
    const res = await api.post(`communities/${slug}/join/`);
    return { success: true, member: res?.data?.member ?? true };
  } catch (err) {
    return { success: false, member: false };
  }
}

/**
 * Search the platform.
 * @param {string} query
 * @param {string} [type] — optional content type filter
 * @returns {Promise<Array<{title: string, url: string, type: string}>>}
 */
export async function executeSearch(query, type) {
  try {
    const res = await api.get('search/', { params: { q: query, type } });
    return (res?.data?.results || []).map(r => ({
      title: r.title || r.display_name || 'Result',
      url: r.url || '/explore',
      type: r.item_type || r.type || 'unknown',
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch notification feed with optional filtering.
 * @param {object} [opts]
 * @param {string} [opts.filter] — 'kou'|'mizik'|'kreyatè'|'kominote'|'mesaj'|'pa li'|'li'|'tout'
 * @returns {Promise<{events: Array, unread: number, filter: string}>}
 */
export async function executeGetNotifications({ filter = 'tout' } = {}) {
  try {
    const [feedRes, unreadRes] = await Promise.all([
      api.get('activity/feed/', { params: { page_size: 20 } }),
      api.get('activity/feed/unread_count/'),
    ]);
    let events = (feedRes?.data?.results || []).map(e => ({
      id: e.id,
      verb: e.verb || e.action || '',
      actor: e.actor_display_name || e.actor_username || 'Someone',
      target: e.target_title || e.target_name || '',
      target_type: e.target_type || e.content_type || '',
      timestamp: e.created_at || e.timestamp,
      read: e.read || false,
    }));

    // Apply filter
    const filterLower = filter.toLowerCase();
    if (filterLower === 'pa li' || filterLower === 'unread') {
      events = events.filter(e => !e.read);
    } else if (filterLower === 'li' || filterLower === 'read') {
      events = events.filter(e => e.read);
    } else if (filterLower === 'kou' || filterLower === 'course') {
      events = events.filter(e => /course|kou|enroll|lesson/i.test(e.verb + ' ' + e.target + ' ' + e.target_type));
    } else if (filterLower === 'mizik' || filterLower === 'music') {
      events = events.filter(e => /music|mizik|track|audio/i.test(e.verb + ' ' + e.target + ' ' + e.target_type));
    } else if (filterLower === 'kreyatè' || filterLower === 'creator') {
      events = events.filter(e => /follow|creator|kreyatè|profile/i.test(e.verb + ' ' + e.target + ' ' + e.target_type));
    } else if (filterLower === 'kominote' || filterLower === 'community') {
      events = events.filter(e => /community|kominote|group|join/i.test(e.verb + ' ' + e.target + ' ' + e.target_type));
    } else if (filterLower === 'mesaj' || filterLower === 'message') {
      events = events.filter(e => /message|mesaj|comment|reply/i.test(e.verb + ' ' + e.target + ' ' + e.target_type));
    }
    // else 'tout' / 'all' → no filter

    return {
      events: events.slice(0, 10),
      unread: unreadRes?.data?.unread || 0,
      filter,
    };
  } catch {
    return { events: [], unread: 0, filter };
  }
}

/**
 * Mark all notifications as read.
 * @returns {Promise<{success: boolean}>}
 */
export async function executeMarkAllRead() {
  try {
    await api.post('activity/feed/mark_all_read/');
    return { success: true };
  } catch {
    return { success: false };
  }
}
