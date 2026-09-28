/**
 * src/components/Chatbot.jsx
 *
 * Atelnyo AI Chat — powered by OpenAI GPT-4o via Cloudflare Worker.
 *
 * Features:
 *   - Markdown rendering for AI responses
 *   - Suggested prompts for first-time users
 *   - Message persistence (localStorage)
 *   - AbortController cancellation on close
 *   - Retry on failure
 *   - Character limit (8000)
 *   - Dark mode support
 *   - Responsive (mobile-friendly)
 *   - Bot & user avatars
 *   - Timestamps on messages
 *   - Smooth open/close animations
 *   - Copy message button
 *   - Code syntax highlighting
 *   - Chat themes (pink, blue, green, purple, orange)
 *   - Conversation context (sends last N messages to AI)
 *   - Quick actions for common intents
 *   - Smart suggestions based on context
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { aiWorkerService, searchService, courseService } from '../services/api';
import {
  executeEnroll,
  executeToggleSave,
  executeFollowCreator,
  executeSendMessage,
  executeJoinCommunity,
  executeSearch,
  executeGetNotifications,
  executeMarkAllRead,
} from './chatbotCommands';
import { useAuthStore } from '../store/useAuthStore';
import userActivity from '../services/userActivity';
import { fetchProjectData, buildProjectContext, fetchUserData, buildUserContext } from '../services/projectDataEngine';
import {
  askMentor,
  getMentorLearningPath,
  getMentorCareerAdvice,
  getMentorSkillGaps,
} from '../services/deie';

// ─── Chat Themes ────────────────────────────────────────────────
const THEMES = {
  pink: {
    name: 'Rose',
    primary: '#d81b60',
    primaryDark: '#ad1457',
    light: '#fce4ec',
    gradient: 'linear-gradient(135deg, #d81b60, #ad1457)',
    userGradient: 'linear-gradient(135deg, #d81b60, #ad1457)',
    shadow: 'rgba(216, 27, 96, 0.4)',
  },
  blue: {
    name: 'Ble',
    primary: '#1976d2',
    primaryDark: '#1565c0',
    light: '#e3f2fd',
    gradient: 'linear-gradient(135deg, #1976d2, #1565c0)',
    userGradient: 'linear-gradient(135deg, #1976d2, #1565c0)',
    shadow: 'rgba(25, 118, 210, 0.4)',
  },
  green: {
    name: 'Vèt',
    primary: '#2e7d32',
    primaryDark: '#1b5e20',
    light: '#e8f5e9',
    gradient: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
    userGradient: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
    shadow: 'rgba(46, 125, 50, 0.4)',
  },
  purple: {
    name: 'Jòn',
    primary: '#7b1fa2',
    primaryDark: '#6a1b9a',
    light: '#f3e5f5',
    gradient: 'linear-gradient(135deg, #7b1fa2, #6a1b9a)',
    userGradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    shadow: 'rgba(123, 31, 162, 0.4)',
  },
  orange: {
    name: 'Orange',
    primary: '#e65100',
    primaryDark: '#bf360c',
    light: '#fff3e0',
    gradient: 'linear-gradient(135deg, #e65100, #bf360c)',
    userGradient: 'linear-gradient(135deg, #e65100, #bf360c)',
    shadow: 'rgba(230, 81, 0, 0.4)',
  },
};

const THEME_STORAGE_KEY = 'atelnyo_chat_theme';

// ─── Quick Actions / Intent Detection ───────────────────────────
const INTENTS = {
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
  follow: {
    patterns: /follow|swiv|abonne|mwen vle swiv/i,
    action: 'follow_creator',
    label: { ht: '👤 Follow kreyatè', en: '👤 Follow creator', fr: '👤 Suivre créateur', es: '👤 Seguir creador' },
  },
  message: {
    patterns: /voye mesaj|send message|ekri ba|write to/i,
    action: 'send_message',
    label: { ht: '💬 Voye mesaj', en: '💬 Send message', fr: '💬 Envoyer message', es: '💬 Enviar mensaje' },
  },
  community: {
    patterns: /rejwine|join.*kominote|antre dans/i,
    action: 'join_community',
    label: { ht: '👥 Rejwine kominote', en: '👥 Join community', fr: '👥 Rejoindre communauté', es: '👥 Unirse comunidad' },
  },
  notifications: {
    patterns: /notifikasyon|notifications?|notify/i,
    action: 'notifications',
    label: { ht: '🔔 Notifikasyon', en: '🔔 Notifications', fr: '🔔 Notifications', es: '🔔 Notificaciones' },
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
];

// ─── Parse command from user message ───────────────────────────
function _parseCommand(message) {
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

// ─── Execute a detected command ─────────────────────────────────
async function _executeCommand(command, lang) {
  const isHt = lang === 'ht';
  switch (command.type) {
    case 'search_and_navigate': {
      // Extract what to search for
      const searchQuery = command.raw
        .replace(/\/^(?:ouvri|open|ale|go\s+to|...)$/i, '')
        .trim();
      try {
        const res = await searchService.search(searchQuery);
        const results = res?.data?.results || [];
        if (results.length > 0) {
          const first = results[0];
          if (first.url) window.location.href = first.url;
          return { executed: true, message: isHt
            ? `🎦 Mwen jwenn **${first.title || 'kontni'}** — mwen ouvri li pou ou!`
            : `🎦 Found **${first.title || 'content'}** — opening it now!` };
        }
        return { executed: false, message: isHt
          ? '❓ Mwen pa t jwenn sa ou chèche a.'
          : "I couldn't find what you're looking for." };
      } catch { return { executed: false, message: '' }; }
    }
    case 'course_search': {
      // Course-specific search — searches only courses
      const query = (command.query || '').trim();
      if (!query) {
        // No query — show popular courses
        try {
          const res = await searchService.search('', 'courses');
          const results = res?.data?.results || [];
          if (results.length > 0) {
            const links = results.slice(0, 5).map((r) => {
              const price = r.price > 0 ? ` 💰$${r.price}` : ' 🆓';
              const difficulty = r.difficulty ? ` [${r.difficulty}]` : '';
              return `- **${r.title || 'Kou'}**${difficulty}${price}\n  ${r.url || ''}`;
            }).join('\n');
            return { executed: true, message: isHt
              ? `📚 **Kou popilè sou Atelnyo:**\n${links}\n\nVizite [Explore](https://atelnyo.site/explore) pou plis kou.`
              : `📚 **Popular courses on Atelnyo:**\n${links}\n\nVisit [Explore](https://atelnyo.site/explore) for more courses.` };
          }
        } catch { /* fall through */ }
        return { executed: false, message: '' };
      }
      try {
        const res = await searchService.search(query, 'courses');
        const results = res?.data?.results || [];
        if (results.length > 0) {
          const links = results.slice(0, 5).map((r) => {
            const price = r.price > 0 ? ` 💰$${r.price}` : ' 🆓';
            const difficulty = r.difficulty ? ` [${r.difficulty}]` : '';
            const creator = r.created_by_username ? ` by ${r.created_by_username}` : '';
            return `- **${r.title || 'Kou'}**${difficulty}${price}${creator}\n  ${r.url || ''}`;
          }).join('\n');
          return { executed: true, message: isHt
            ? `📚 Mwen jwenn **${results.length}** kou pou "${query}":\n${links}\n\nVizite [Explore](https://atelnyo.site/explore) pou wè tout kou yo.`
            : `📚 Found **${results.length}** courses for "${query}":\n${links}\n\nVisit [Explore](https://atelnyo.site/explore) to see all courses.` };
        }
        return { executed: true, message: isHt
          ? `❓ Pa gen kou pou "${query}" sou Atelnyo. Eseye yon lòt tèm oswa [eksplore tout kou yo](https://atelnyo.site/explore).`
          : `No courses found for "${query}" on Atelnyo. Try different keywords or [browse all courses](https://atelnyo.site/explore).` };
      } catch { return { executed: false, message: '' }; }
    }
    case 'search': {
      const query = command.query;
      if (!query) return { executed: false, message: '' };
      try {
        const res = await searchService.search(query);
        const results = res?.data?.results || [];
        if (results.length > 0) {
          const links = results.slice(0, 5).map(r =>
            `- [${r.title || r.display_name || 'Result'}](${r.url || 'https://atelnyo.site/explore'})`
          ).join('\n');
          return { executed: true, message: isHt
            ? `🔍 Mwen jwenn **${results.length}** rezilta pou "${query}":\n${links}`
            : `🔍 Found **${results.length}** results for "${query}":\n${links}` };
        }
        return { executed: true, message: isHt
          ? `❓ Pa gen rezilta pou "${query}". Eseye yon lòt tèm.`
          : `No results for "${query}". Try different keywords.` };
      } catch { return { executed: false, message: '' }; }
    }
    case 'enroll': {
      // Try to extract a course ID/URL from the message
      const courseUrlMatch = command.raw.match(/course\/(\d+)/i);
      if (courseUrlMatch) {
        const result = await executeEnroll(courseUrlMatch[1]);
        if (result.success) {
          return { executed: true, message: isHt
            ? '🎓 **Ou enskri!** Mwen ouvri kou a pou ou.'
            : '🎓 **Enrolled!** Opening the course for you.' };
        }
      }
      // No course ID — show search results with enroll buttons
      try {
        const results = await executeSearch('', 'courses');
        if (results.length > 0) {
          const links = results.slice(0, 5).map(r => `- [${r.title}](${r.url})`).join('\n');
          return { executed: true, message: isHt
            ? `🎓 **Chwazi yon kou pou enskri:**\n${links}\n\nKlike sou yon kou epi mwen pral enskri ou!`
            : `🎓 **Choose a course to enroll in:**\n${links}\n\nClick a course and I'll enroll you!` };
        }
      } catch { /* fall through */ }
      window.location.href = '/explore';
      return { executed: true, message: isHt
        ? '🎓 Mwen mennen ou sou Explore pou chwazi yon kou!'
        : '🎓 Taking you to Explore to pick a course!' };
    }
    case 'save': {
      // Try to extract item type and ID from the message
      const saveMatch = command.raw.match(/(course|music|talent)[\/\\]?(\d+)/i);
      if (saveMatch) {
        const result = await executeToggleSave(saveMatch[1].toLowerCase(), saveMatch[2]);
        if (result.success) {
          const status = result.saved ? (isHt ? 'sove' : 'saved') : (isHt ? 'pañ sove' : 'unsaved');
          return { executed: true, message: isHt
            ? `⭐ Mwen **${status}** sa pou ou!`
            : `⭐ **${status.charAt(0).toUpperCase() + status.slice(1)}** for you!` };
        }
      }
      return { executed: true, message: isHt
        ? '⭐ Chèche sa ou vle sove sou Explore epi voye lyen an ba mwen — mwen pral sove l pou ou!'
        : '⭐ Find what you want to save on Explore and send me the link — I\'ll save it for you!' };
    }
    case 'progress': {
      try {
        const res = await api.get('progress/', { params: { page_size: 10 } });
        const list = res?.data?.results || [];
        if (list.length > 0) {
          const items = list.slice(0, 8).map(p => {
            const pct = p.progress_percentage || p.progress || 0;
            const bar = pct >= 100 ? '✅' : pct >= 50 ? '🟡' : '📖';
            const title = p.course_title || p.title || `Course #${p.course}`;
            return `- ${bar} **${title}** — ${pct}%`;          }).join('\n');
          return { executed: true, message: isHt
            ? `📊 **PwoGRES APRENTISAJ OU:**\n${items}\n\n[Jwenn plis kou](https://atelnyo.site/explore) pou kontinye aprann!`
            : `📊 **YOUR LEARNING PROGRESS:**\n${items}\n\n[Find more courses](https://atelnyo.site/explore) to keep learning!` };
        }
        return { executed: true, message: isHt
          ? '📊 Ou pa enskri nan okenn kou ankò. [Eksplore kou yo](https://atelnyo.site/explore) pou kòmanse aprann!'
          : `📊 You're not enrolled in any courses yet. [Browse courses](https://atelnyo.site/explore) to start learning!` };
      } catch { return { executed: false, message: '' }; }
    }
    case 'calendar': {
      try {
        const res = await api.get('events/', { params: { page_size: 5, upcoming: true } });
        const events = res?.data?.results || [];
        if (events.length > 0) {
          const items = events.map(e => {
            const date = e.date || e.start_date ? new Date(e.date || e.start_date).toLocaleDateString() : 'TBD';
            return `- 📅 **${e.title || 'Evènman'}** — ${date}${e.location ? ' @ ' + e.location : ''}`;
          }).join('\n');
          return { executed: true, message: isHt
            ? `📅 **EVÈNMAN KI AP VENI:**\n${items}\n\nEksplore plis sou [Atelnyo](https://atelnyo.site/explore)!`
            : `📅 **UPCOMING EVENTS:**\n${items}\n\nExplore more on [Atelnyo](https://atelnyo.site/explore)!` };
        }
        return { executed: true, message: isHt
          ? '📅 Pa gen evènman ki ap vini kounye a. Tcheke ankò pita!'
          : '📅 No upcoming events right now. Check back later!' };
      } catch { return { executed: false, message: '' }; }
    }
    case 'wallet': {
      try {
        const res = await api.get('wallet/me/');
        const w = res?.data || {};
        const balance = w.balance || 0;
        const earned = w.lifetime_earned || 0;
        return { executed: true, message: isHt
          ? `💰 **SOLDE BOUS OU:**\n- 💵 Solde: **$${balance.toFixed(2)}**\n- 📈 Touche total: **$${earned.toFixed(2)}**\n- 💱 Mak: ${w.currency || 'USD'}\n\nOu ka wè tranzaksyon ou nan [Bous](https://atelnyo.site/wallet).`
          : `💰 **YOUR WALLET:**\n- 💵 Balance: **$${balance.toFixed(2)}**\n- 📈 Lifetime earned: **$${earned.toFixed(2)}**\n- 💱 Currency: ${w.currency || 'USD'}\n\nView transactions on [Wallet](https://atelnyo.site/wallet).` };
      } catch { return { executed: false, message: '' }; }
    }
    case 'saved': {
      try {
        const [coursesRes, musicRes, talentsRes] = await Promise.allSettled([
          api.get('explore/saved/courses/', { params: { page_size: 3 } }),
          api.get('explore/saved/music/', { params: { page_size: 3 } }),
          api.get('explore/saved/talents/', { params: { page_size: 3 } }),
        ]);
        const courses = coursesRes.status === 'fulfilled' ? (coursesRes.value.data?.results || []) : [];
        const music = musicRes.status === 'fulfilled' ? (musicRes.value.data?.results || []) : [];
        const talents = talentsRes.status === 'fulfilled' ? (talentsRes.value.data?.results || []) : [];
        const totalSaved = courses.length + music.length + talents.length;
        if (totalSaved > 0) {
          let msg = isHt ? '⭐ **MOUN OU SOVE:**\n' : '⭐ **YOUR SAVED ITEMS:**\n';
          if (courses.length > 0) msg += `\n📚 **Kou (${courses.length}):**\n` + courses.map(c => `- ${c.title || c.course_title || 'Kou'}`).join('\n');
          if (music.length > 0) msg += `\n🎵 **Mizik (${music.length}):**\n` + music.map(m => `- ${m.title || 'Mizik'}`).join('\n');
          if (talents.length > 0) msg += `\n🌟 **Talan (${talents.length}):**\n` + talents.map(t => `- ${t.name || t.display_name || 'Talan'}`).join('\n');
          return { executed: true, message: msg };
        }
        return { executed: true, message: isHt
          ? '⭐ Ou pa gen anyen sove ankò. Eksplore [Explore](https://atelnyo.site/explore) epi klike ⭐ sou sa ou renmen!'
          : "⭐ You haven't saved anything yet. Explore [Atelnyo](https://atelnyo.site/explore) and click ⭐ on what you like!" };
      } catch { return { executed: false, message: '' }; }
    }
    case 'notifications': {
      try {
        // Parse filter from message: "notifikasyon kou" → filter='kou'
        const filterMatch = command.raw.toLowerCase().match(/notifikasyon(?:s?)\s+(kou|mizik|kreyatè|kominote|mesaj|pa\s+li|li|tout|course|music|creator|community|message|unread|read|all)/i);
        const filter = filterMatch ? filterMatch[1] : 'tout';
        const { events, unread } = await executeGetNotifications({ filter });
        const filterLabel = filter === 'tout' || filter === 'all' ? '' : ` [${filter}]`;
        if (events.length > 0) {
          const items = events.map(e => {
            const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const read = e.read ? '' : ' 🔵';
            return `- ${e.actor} ${e.verb}${e.target ? ': ' + e.target : ''}${read} ${time}`;
          }).join('\n');
          return { executed: true, message: isHt
            ? `🔔 **NOTIFIKASYON${filterLabel} (${unread} pa li):**\n${items}`
            : `🔔 **NOTIFICATIONS${filterLabel} (${unread} unread):**\n${items}` };
        }
        return { executed: true, message: isHt
          ? `🔔 Pa gen notifikasyon${filterLabel}.`
          : `🔔 No notifications${filterLabel}.` };
      } catch { return { executed: false, message: '' }; }
    }
    case 'mark_read': {
      try {
        await executeMarkAllRead();
        return { executed: true, message: isHt
          ? '✅ Tout notifikasyon yo make kom li!'
          : '✅ All notifications marked as read!' };
      } catch { return { executed: false, message: '' }; }
    }
    case 'url': {
      // Fetch SEO meta for the URL and show preview
      return { executed: false, message: '', url: command.url };
    }
    default:
      return { executed: false, message: '' };
  }
}

// ─── SEO Link Preview Card ─────────────────────────────────────
function _LinkPreview({ url }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Try to extract OG meta from the URL via a proxy or the backend
    fetch(`https://atelnyo.site/api/og-proxy/?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setMeta(data); })
      .catch(() => {
        // Fallback: try to extract basic info from URL path
        try {
          const u = new URL(url);
          const pathParts = u.pathname.split('/').filter(Boolean);
          if (!cancelled) setMeta({ title: pathParts.join(' / ') || u.hostname, description: url, image: null });
        } catch { if (!cancelled) setMeta({ title: url, description: '', image: null }); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return (
    <div className="chat-link-preview chat-link-preview--loading">
      <div className="chat-link-preview-skeleton" />
    </div>
  );
  if (!meta) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="chat-link-preview">
      {meta.image && <img src={meta.image} alt="" className="chat-link-preview-img" />}
      <div className="chat-link-preview-body">
        <div className="chat-link-preview-domain">{new URL(url).hostname}</div>
        <div className="chat-link-preview-title">{meta.title || url}</div>
        {meta.description && <div className="chat-link-preview-desc">{meta.description.substring(0, 120)}</div>}
      </div>
    </a>
  );
}

// ─── Code Syntax Highlighting ────────────────────────────────────
function _highlightCode(code, lang) {
  if (!code) return '';
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g, '<span class="code-string">$&</span>');
  highlighted = highlighted.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm, '<span class="code-comment">$&</span>');
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$&</span>');
  highlighted = highlighted.replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|null|undefined|true|false|def|print|True|False|None)\b/g, '<span class="code-keyword">$&</span>');
  highlighted = highlighted.replace(/\b([a-zA-Z_]\w*)\s*\(/g, '<span class="code-function">$1</span>(');
  return highlighted;
}

// ─── Enhanced Markdown → HTML ────────────────────────────────────
// The AI emits URLs in two shapes: markdown [label](url) and bare
// https://… links. Rendering them in naive passes BREAKS: the bare-URL
// regex used to re-wrap the href of already-rendered anchors, producing
// nested <a> tags and dead links. Placeholder protection keeps each
// pass from re-processing earlier output.
function _renderMarkdown(text) {
  if (!text) return '';
  const stash = [];
  const keep = (html) => `\u0001${stash.push(html) - 1}\u0001`;
  const anchor = (href, inner) =>
    `<a href="${href}" target="_blank" rel="noopener" class="chat-link">${inner} <i class="fas fa-external-link-alt" style="font-size:0.65rem;margin-left:2px;opacity:0.5"></i></a>`;

  let result = text;

  // 1) Fenced code blocks — protected from all later passes
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    const langLabel = lang || 'code';
    const highlighted = _highlightCode(code.trim(), lang);
    return keep(`<div class="chat-code-block"><div class="chat-code-header"><span class="chat-code-lang">${langLabel}</span><button class="chat-code-copy" onclick="(function(btn){const code=btn.closest('.chat-code-block').querySelector('code').textContent;navigator.clipboard.writeText(code);btn.innerHTML='<i class=\\'fas fa-check\\'></i>';setTimeout(()=>btn.innerHTML='<i class=\\'fas fa-copy\\'></i>',1500)})(this)"><i class="fas fa-copy"></i></button></div><pre class="chat-code"><code>${highlighted}</code></pre></div>`);
  });

  // 2) Inline code — protected
  result = result.replace(/`([^`]+)`/g, (m, code) => keep(`<code class="chat-inline-code">${code}</code>`));

  // 3) Markdown links — rendered NOW and protected, so the bare-URL
  //    pass below can never touch their href. Only http(s) hrefs are
  //    linked; anything else (javascript:, data:) stays plain text.
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => keep(anchor(url, label)));

  // 4) Bare URLs — markdown targets are already protected at this point
  result = result.replace(/https?:\/\/[^\s<>)"']+/g, (url) => keep(anchor(url, url)));

  // 5) Inline formatting + lists + paragraphs
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  result = result.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  result = result.replace(/\n\n/g, '</p><p>');
  result = result.replace(/\n/g, '<br/>');
  result = result.replace(/^/, '<p>');
  result = result.replace(/$/, '</p>');

  // 6) Restore protected chunks LAST
  return result.replace(/\u0001(\d+)\u0001/g, (m, i) => stash[Number(i)]);
}

function _formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function _copyToClipboard(text, setIsCopied) {
  try {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }
}

// ─── DEIE Mentor intent detection ───────────────────────────────
const MENTOR_PATTERNS = /\b(learn|approndi|course|kou|skill|konpetans|career|karye|job|travay|plan|path|chimen|recommend|sugger|advise|konsey|gap|manke|next|sa m dwe|what should i|ki sa mwen dwe|ki sa m ap bezwen)\b/i;

function _isMentorIntent(message) {
  // Route mentor-related questions to DEIE when user is logged in
  return MENTOR_PATTERNS.test(message);
}

// ─── Detect user intent from message ────────────────────────────
function _detectIntent(message) {
  for (const [key, intent] of Object.entries(INTENTS)) {
    if (intent.patterns.test(message)) {
      return { key, ...intent };
    }
  }
  return null;
}

// ─── Build system prompt with conversation context ──────────────
function _buildSystemPrompt(lang, conversationHistory = [], user = null, activityContext = null, projectData = null, userData = null) {
  const langName = lang === 'ht' ? 'Haitian Creole' : lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
  // Language matching is MESSAGE-driven: small models weigh early
  // instructions most, so the language rule lives at the TOP of the
  // prompt with concrete few-shot examples. The Creole quality block
  // stays at the end — it only applies when the reply is in Creole.
  const langRules = `LANGUAGE (TOP PRIORITY):
- Reply in the language of the USER'S MESSAGE, whatever the platform UI language is: English message → English reply, Haitian Creole message → Haitian Creole reply, French message → French reply, Spanish message → Spanish reply.
- Examples: "What is Atelnyo?" → reply in English. "Ki sa Atelnyo ye?" → reply in Haitian Creole. "Qu'est-ce qu'Atelnyo ?" → reply in French.
- Use ${langName} ONLY when the message has no detectable language (single word, emoji only).

`;
  const styleBlock = `\n\nREPLY STYLE:
- Keep replies short in any language: 2-4 sentences for simple questions, short simple sentences, one idea per sentence, no walls of text.
- If you reply in Haitian Creole, write CLEAN Creole: never mix French or English words into Creole sentences. Say "pataje" not "publishe", "kontni" not "content", "antre" not "konekte", "gade" not "check", "twò" not "tro".
- Format links as [text](URL) and use **bold** for key info.
`;

  // Build user context block
  let userBlock = '';
  if (user) {
    userBlock = `\n\nCURRENT USER:\n- Name: ${user.display_name || user.username || 'Unknown'}\n- Username: @${user.username || 'unknown'}\n- Premium: ${user.premium?.is_premium ? 'Yes (' + (user.premium.plan || 'active') + ')' : 'No'}\n- Creator: ${user.is_creator ? 'Yes' : 'No'}\n- Staff: ${user.is_staff ? 'Yes' : 'No'}`;
  }

  // Build activity context block — where the user is right now
  // (kept compact: data lines only, one short instruction).
  let activityBlock = '';
  if (activityContext?.current) {
    const c = activityContext.current;
    activityBlock = `\n\nUSER ACTIVITY:\n- On: ${c.page}${c.contentType ? ` (${c.contentType})` : ''}${c.contentId ? ` — "${c.contentId}"` : ''}`;
    if (activityContext.flow?.pattern) activityBlock += `\n- Pattern: ${activityContext.flow.pattern}`;
    activityBlock += `\nUse it for RELEVANT suggestions.`;
  }

  // Build conversation context from recent messages
  // 6 messages × 280 chars — history is the biggest variable cost; this
  // cap keeps a long conversation from doubling the daily token bill.
  let contextBlock = '';
  if (conversationHistory.length > 0) {
    contextBlock = '\n\nCONVERSATION HISTORY (answer the LATEST user message):\n';
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const text = msg.text?.substring(0, 280) || '';
      contextBlock += `${role}: ${text}\n`;
    }
  }

  return `You are Atelnyo AI — the friendly, intelligent assistant for Atelnyo (atelnyo.site), a Haitian educational platform.

${langRules}PERSONALITY:
- Warm, helpful, conversational — like a knowledgeable friend; emojis sparingly 😊
- Honest about what you don't know — redirect to https://atelnyo.site/explore

PLATFORM URLS (use EXACT formats):
- Course: https://atelnyo.site/{slug}/by/{creator}/course
- Creator profile: https://atelnyo.site/c/{creator-slug}
- Explore + Premium info: https://atelnyo.site/explore (Settings → Premium)

CONTENT: courses (programming, design, music, languages, business), digital products, music tracks, talent showcases, communities, events, jobs

PREMIUM (share when asked about pricing/plans):
- Plans: Monthly ($4.99), Quarterly ($11.99), Yearly ($39.99)
- Benefits: 25% off courses, exclusive themes, 2x referral commission

ACTIONS: You guide, you don't execute. When the user asks to DO something (search, enroll, save, follow, join, pay...), tell them exactly where to go and what to do.

RESPONSE RULES:
1. If you don't know, say so honestly and link to https://atelnyo.site/explore
2. NEVER invent course names, prices, or creator names — use ONLY the live data provided below; if nothing matches, say so
3. When asked about progress, wallet, saved items, or calendar, use the personal data below to give SPECIFIC answers with real numbers
4. For creators asking about analytics: guide them to Creator Studio → Analytics
5. For code: use triple backticks with the language name
${styleBlock}${userBlock}${activityBlock}${contextBlock}${buildProjectContext(projectData)}${buildUserContext(userData)}`;
}

// ─── Suggested prompts ───────────────────────────────────────────
const SUGGESTIONS = {
  ht: [
    { icon: '📊', text: 'Ki progress aprantisaj mwen?' },
    { icon: '💰', text: 'Ki solde bous mwen?' },
    { icon: '📅', text: 'Ki evènman ki ap vini?' },
    { icon: '📚', text: 'Ki kou ou genyen sou pwogramasyon?' },
    { icon: '🎨', text: 'Ede m kreye yon logo pou biznis mwen.' },
    { icon: '🎓', text: 'Ki sa mwen dwe aprann pou vin yon devlopè?', _mentor: 'learning-path' },
    { icon: '💼', text: 'Ban m konsèy sou karyè mwen.', _mentor: 'career-advice' },
    { icon: '🔧', text: 'Ki konpetans ki manke m?', _mentor: 'skill-gaps' },
  ],
  en: [
    { icon: '📊', text: 'What is my learning progress?' },
    { icon: '💰', text: 'What is my wallet balance?' },
    { icon: '📅', text: 'What events are coming up?' },
    { icon: '📚', text: 'What courses do you offer on programming?' },
    { icon: '🎨', text: 'Help me create a logo for my business.' },
    { icon: '🎓', text: 'What should I learn to become a developer?', _mentor: 'learning-path' },
    { icon: '💼', text: 'Give me career advice.', _mentor: 'career-advice' },
    { icon: '🔧', text: 'What skills am I missing?', _mentor: 'skill-gaps' },
  ],
  fr: [
    { icon: '📊', text: 'Quel est mon progrès d\'apprentissage?' },
    { icon: '💰', text: 'Quel est le solde de mon portefeuille?' },
    { icon: '📅', text: 'Quels événements à venir?' },
    { icon: '📚', text: 'Quels cours proposez-vous en programmation?' },
    { icon: '🎨', text: 'Aidez-moi à créer un logo pour mon entreprise.' },
    { icon: '🎓', text: 'Que dois-je apprendre pour devenir développeur?', _mentor: 'learning-path' },
    { icon: '💼', text: 'Donnez-moi des conseils de carrière.', _mentor: 'career-advice' },
    { icon: '🔧', text: 'Quelles compétences me manquent?', _mentor: 'skill-gaps' },
  ],
  es: [
    { icon: '📊', text: '¿Cuál es mi progreso de aprendizaje?' },
    { icon: '💰', text: '¿Cuál es el saldo de mi billetera?' },
    { icon: '📅', text: '¿Qué eventos vienen?' },
    { icon: '📚', text: '¿Qué cursos ofrecen sobre programación?' },
    { icon: '🎨', text: 'Ayúdame a crear un logo para mi negocio.' },
    { icon: '🎓', text: '¿Qué debo aprender para ser desarrollador?', _mentor: 'learning-path' },
    { icon: '💼', text: 'Dame consejos de carrera.', _mentor: 'career-advice' },
    { icon: '🔧', text: '¿Qué habilidades me faltan?', _mentor: 'skill-gaps' },
  ],
};

// ─── Context-aware follow-up suggestions ─────────────────────────
function _getFollowUpSuggestions(lastBotText, lang) {
  if (!lastBotText) return [];
  const text = lastBotText.toLowerCase();
  const suggestions = [];

  if (/course|kou|learn|approndi/i.test(text)) {
    suggestions.push(
      { icon: '🔍', text: lang === 'ht' ? 'Chèche kou sou pwogramasyon' : 'Search courses on programming' },
      { icon: '🔗', text: lang === 'ht' ? 'Mwen vle wè tout kou yo' : lang === 'fr' ? 'Je veux voir tous les cours' : lang === 'es' ? 'Quiero ver todos los cursos' : 'Show me all courses' },
      { icon: '💰', text: lang === 'ht' ? 'Ki kou gratis?' : 'What free courses are there?' },
    );
  } else if (/premium|plan|abone/i.test(text)) {
    suggestions.push(
      { icon: '💳', text: lang === 'ht' ? 'Kijan mwen ka achte Premium?' : lang === 'fr' ? 'Comment puis-je acheter Premium?' : lang === 'es' ? '¿Cómo puedo comprar Premium?' : 'How do I buy Premium?' },
    );
  } else if (/creator|kreyatè|studio/i.test(text)) {
    suggestions.push(
      { icon: '📚', text: lang === 'ht' ? 'Ki kou pou kreyatè?' : lang === 'fr' ? 'Cours pour créateurs?' : lang === 'es' ? '¿Cursos para creadores?' : 'Courses for creators?' },
    );
  }

  // Progress / learning follow-ups
  if (/progress|apprantisaj|learning|cours|mwen enskri/i.test(text)) {
    suggestions.push(
      { icon: '📅', text: lang === 'ht' ? 'Ki evènman ki ap vini?' : lang === 'fr' ? 'Quels événements à venir?' : lang === 'es' ? '¿Qué eventos vienen?' : 'What events are coming up?' },
    );
  }

  // Wallet follow-ups
  if (/wallet|bous|lajan|balance|solde/i.test(text)) {
    suggestions.push(
      { icon: '⭐', text: lang === 'ht' ? 'Moun yo sove mwen' : lang === 'fr' ? 'Mes éléments sauvegardés' : lang === 'es' ? 'Mis elementos guardados' : 'My saved items' },
    );
  }

  // Mentor follow-ups — personalized guidance
  if (/skill|konpetans|learn|approndi|career|karye/i.test(text)) {
    suggestions.push(
      { icon: '🎓', text: lang === 'ht' ? 'Ki sa mwen dwe aprann?' : 'What should I learn next?', _mentor: 'learning-path' },
    );
    suggestions.push(
      { icon: '🔧', text: lang === 'ht' ? 'Ki konpetans ki manke m?' : 'What skills am I missing?', _mentor: 'skill-gaps' },
    );
  }

  // Always add explore link
  suggestions.push(
    { icon: '🔍', text: lang === 'ht' ? 'Eseye Explore' : lang === 'fr' ? 'Essayer Explore' : lang === 'es' ? 'Probar Explorar' : 'Try Explore' },
  );

  return suggestions.slice(0, 3);
}

const MAX_CHARS = 8000;
const STORAGE_KEY = 'atelnyo_chat_messages';

function _loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-50) : null;
  } catch { return null; }
}

function _saveMessages(msgs) {
  try {
    const toSave = msgs.filter(m => m.role === 'user' || (m.role === 'bot' && m.text && !m.text.includes('Bonjou') && !m.text.includes('Welcome')));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave.slice(-50)));
  } catch { /* ignore */ }
}

// ─── Copy Button Component ───────────────────────────────────────
function CopyButton({ text, lang }) {
  const [isCopied, setIsCopied] = useState(false);
  const isHt = lang === 'ht';
  return (
    <button
      className="msg-copy-btn"
      onClick={() => _copyToClipboard(text, setIsCopied)}
      title={isCopied ? (isHt ? 'Kopye!' : 'Copied!') : (isHt ? 'Kopye repons lan' : 'Copy response')}
      aria-label={isHt ? 'Kopye repons lan' : 'Copy response'}
    >
      <i className={isCopied ? 'fas fa-check' : 'fas fa-copy'} />
    </button>
  );
}

const Chatbot = React.memo(({ lang = 'ht', translations }) => {
  const t = translations?.[lang] || translations?.['ht'] || {};
  const isHt = lang === 'ht';

  const [themeKey, setThemeKey] = useState(() => {
    try { return localStorage.getItem(THEME_STORAGE_KEY) || 'pink'; }
    catch { return 'pink'; }
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const theme = THEMES[themeKey] || THEMES.pink;

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, themeKey); }
    catch { /* ignore */ }
  }, [themeKey]);

  const welcomeMsg = useMemo(() => ({
    role: 'bot',
    text: t.bot_welcome || (isHt ? 'Bonjou! Mwen se Atelnyo AI 🤖. Mwen ka ede ou jwenn kou, kreye kontni, oswa reponn kesyon ou. Kijan mwen ka ede ou jodi a?' : 'Hello! I\'m Atelnyo AI 🤖. I can help you find courses, create content, or answer your questions. How can I help you today?'),
    timestamp: Date.now(),
  }), [t.bot_welcome, isHt]);

  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [messages, setMessages] = useState(() => _loadMessages() || [welcomeMsg]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [detectedIntent, setDetectedIntent] = useState(null);
  const user = useAuthStore(s => s.user);
  const msgsEndRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom
  useEffect(() => {
    if (msgsEndRef.current) {
      msgsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  useEffect(() => { _saveMessages(messages); }, [messages]);
  useEffect(() => { setMessages([welcomeMsg]); }, [welcomeMsg]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  // ─── Real-time notifications: show in chatbot when they arrive ──
  const notifCountRef = useRef(0);
  useEffect(() => {
    const handleNotif = (e) => {
      const { event, unread } = e.detail || {};
      if (!event) return;
      // Only show notification in chatbot if chatbot is open
      if (!isOpen) return;
      // Build a friendly notification message
      const actor = event.actor_display_name || event.actor_username || 'Someone';
      const action = event.verb || event.action || '';
      const target = event.target_title || event.target_name || '';
      const notifText = `${actor} ${action}${target ? ': ' + target : ''}`;
      // Add as a system message (not from AI)
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `🔔 **${isHt ? 'Notifikasyon' : 'Notification'}:** ${notifText}`,
        timestamp: Date.now(),
        isNotification: true,
      }]);
      notifCountRef.current = unread || notifCountRef.current + 1;
    };
    window.addEventListener('atelnyo:notif:new', handleNotif);
    return () => window.removeEventListener('atelnyo:notif:new', handleNotif);
  }, [isOpen, isHt]);

  // ─── WebMCP: Listen for open/close from AI agents ─────────────
  useEffect(() => {
    const handleWebMCP = (e) => {
      const { action } = e.detail || {};
      if (action === 'open' && !isOpen) {
        setIsOpen(true);
        setIsAnimating(false);
      } else if (action === 'close' && isOpen) {
        setIsAnimating(true);
        setTimeout(() => { setIsOpen(false); setIsAnimating(false); }, 250);
      }
    };
    window.addEventListener('webmcp:chatbot', handleWebMCP);
    return () => window.removeEventListener('webmcp:chatbot', handleWebMCP);
  }, [isOpen]);

  // ─── Auth: detect login/logout without page refresh ───────────
  useEffect(() => {
    const handleLogout = () => {
      // User logged out — clear chat and show goodbye
      setMessages([{
        role: 'bot',
        text: isHt ? 'Ou dekonekte. Lè ou rekonekte, mwen ap remember konvèsasyon an! 👋' : 'You logged out. When you log back in, I\'ll remember our conversation! 👋',
        timestamp: Date.now(),
      }]);
    };
    const handleUserUpdated = (e) => {
      // User profile updated or logged in — greet them
      const updatedUser = e.detail?.user;
      if (updatedUser && updatedUser.username) {
        const greetMsg = isHt
          ? `Byenveni ${updatedUser.display_name || updatedUser.username}! 🎉 Mwen se Atelnyo AI. Kijan mwen ka ede ou?`
          : `Welcome ${updatedUser.display_name || updatedUser.username}! 🎉 I'm Atelnyo AI. How can I help you?`;
        setMessages(prev => [...prev, {
          role: 'bot',
          text: greetMsg,
          timestamp: Date.now(),
          isGreeting: true,
        }]);
      }
    };
    window.addEventListener('atelnyo:auth:logout', handleLogout);
    window.addEventListener('atelnyo:auth:user-updated', handleUserUpdated);
    return () => {
      window.removeEventListener('atelnyo:auth:logout', handleLogout);
      window.removeEventListener('atelnyo:auth:user-updated', handleUserUpdated);
    };
  }, [isHt]);

  // Detect intent as user types
  useEffect(() => {
    if (input.length > 3) {
      const intent = _detectIntent(input);
      setDetectedIntent(intent);
    } else {
      setDetectedIntent(null);
    }
  }, [input]);

  const toggleChat = useCallback(() => {
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => { setIsOpen(false); setIsAnimating(false); }, 250);
    } else {
      setIsOpen(true);
      setIsAnimating(false);
    }
  }, [isOpen]);

  // ─── DEIE Mentor Action Handler ──────────────────────────────────
  const _handleMentorAction = useCallback(async (action) => {
    if (isThinking) return;
    setError(null);
    setIsThinking(true);

    const actionLabels = {
      'learning-path': isHt ? '🎓 Montre m chimen aprantisaj mwen' : '🎓 Show my learning path',
      'career-advice': isHt ? '💼 Ban m konsèy karyè' : '💼 Give me career advice',
      'skill-gaps': isHt ? '🔧 Ki konpetans ki manke m' : '🔧 What skills am I missing',
    };

    const userText = actionLabels[action] || action;
    setMessages(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);

    try {
      let res;
      if (action === 'learning-path') res = await getMentorLearningPath();
      else if (action === 'career-advice') res = await getMentorCareerAdvice();
      else if (action === 'skill-gaps') res = await getMentorSkillGaps();

      const answer = res?.data?.recommendation || res?.data?.message ||
        (isHt ? 'Pa gen enfòmasyon disponib.' : 'No information available.');
      setMessages(prev => [...prev, {
        role: 'bot',
        text: answer,
        timestamp: Date.now(),
        isMentor: true,
        source: 'mentor',
      }]);
    } catch (err) {
      console.warn('[chatbot] Mentor action failed:', err.message);
      setMessages(prev => [...prev, {
        role: 'bot',
        text: isHt ? 'Mwen pa ka jwenn enfòmasyon sa a kounye a. Eseye ankò.' : 'I cannot get this information right now. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, isHt]);

  const handleSend = useCallback(async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || isThinking) return;
    if (userMsg.length > MAX_CHARS) {
      setError(isHt ? `Tèks la twò long (maksimòm ${MAX_CHARS} karaktè).` : `Text too long (max ${MAX_CHARS} characters).`);
      return;
    }

    setError(null);
    setRetryCount(0);
    setDetectedIntent(null);
    setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: Date.now() }]);
    setInput('');
    setIsThinking(true);

    // ─── Command Detection — try to execute action first ──────
    const command = _parseCommand(userMsg);
    if (command) {
      const result = await _executeCommand(command, lang);
      if (result.executed) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: result.message,
          timestamp: Date.now(),
          isCommand: true,
        }]);
        setIsThinking(false);
        return;
      }
      // URL detected — show link preview but still ask AI
      if (result.url) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: '',
          timestamp: Date.now(),
          linkPreview: result.url,
        }]);
      }
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // ─── DEIE Mentor Routing — personalized guidance ───────────
    if (user && _isMentorIntent(userMsg)) {
      try {
        const mentorRes = await askMentor(userMsg);
        if (mentorRes?.data?.answer) {
          setMessages(prev => [...prev, {
            role: 'bot',
            text: mentorRes.data.answer,
            timestamp: Date.now(),
            isMentor: true,
            source: mentorRes.data.source || 'mentor',
          }]);
          setIsThinking(false);
          return;
        }
      } catch (mentorErr) {
        console.warn('[chatbot] Mentor API failed, falling back to AI:', mentorErr.message);
        // Fall through to regular AI chat
      }
    }

    // Build conversation history for context (last 6 messages)
    const historyForAI = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
    const activityCtx = userActivity.getContext();

    // Fetch live project data for context (cached 5 min)
    let projectData = null;
    try {
      projectData = await fetchProjectData();
    } catch { /* non-critical */ }

    // Fetch user-specific data for context (cached 2 min)
    let userData = null;
    try {
      userData = await fetchUserData(user);
    } catch { /* non-critical */ }

    const systemPrompt = _buildSystemPrompt(lang, historyForAI, user, activityCtx, projectData, userData);

    try {
      const data = await aiWorkerService.chat({
        prompt: userMsg,
        system_instruction: systemPrompt,
        lang,
        // Wire the abort signal into the fetch itself — previously the
        // controller only gated UI state while the HTTP request kept
        // running in the background.
        signal: abortRef.current.signal,
      });

      if (abortRef.current?.signal.aborted) return;

      // Check if AI response contains URLs → add link preview.
      // Skip URLs the AI already rendered as [label](url) markdown links —
      // previewing the same link reads as a duplicate in the UI.
      const mdTargets = new Set(
        [...(data.text || '').matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]),
      );
      const aiUrls = (data.text || '').match(/https?:\/\/[^\s)\]>"']+/g) || [];
      const previewUrl = aiUrls.find(u => u.includes('atelnyo.site') && !mdTargets.has(u)) || null;

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.text || (isHt ? 'Pa gen repons.' : 'No response.'),
        model: data.model,
        duration_ms: data.duration_ms,
        timestamp: Date.now(),
        linkPreview: previewUrl,
      }]);
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      console.error('[chatbot] AI error:', err);
      setError(isHt ? 'Erè nan konekte ak AI a.' : 'Error connecting to AI.');
    } finally {
      if (!abortRef.current?.signal.aborted) setIsThinking(false);
    }
  }, [input, isThinking, lang, isHt, messages]);

  const handleRetry = useCallback(() => {
    if (messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setMessages(prev => prev.slice(0, -1));
      handleSend(lastUserMsg.text);
    }
  }, [messages, handleSend]);

  const handleClear = useCallback(() => {
    setMessages([welcomeMsg]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [welcomeMsg]);

  // Stop an in-flight reply: abort the real fetch (via the signal now
  // wired into aiWorkerService.chat), drop the pending state, and show
  // a graceful "stopped" note instead of an error.
  const handleStop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsThinking(false);
    setMessages(prev => [...prev, {
      role: 'bot',
      text: isHt ? '⏹️ Repons lan kanpe.' : '⏹️ Reply stopped.',
      timestamp: Date.now(),
      isStopped: true,
    }]);
  }, [isHt]);

  // Handle quick action clicks
  const handleQuickAction = useCallback((action) => {
    const prompts = {
      browse_courses: isHt ? 'Montre m tout kou ki disponib sou Atelnyo' : 'Show me all available courses on Atelnyo',
      browse_explore: isHt ? 'Mwen vle eksplore tout sa Atelnyo genyen' : 'I want to explore everything Atelnyo offers',
      show_premium: isHt ? 'Explike m sou Premium ak ki jan li mache' : 'Tell me about Premium and how it works',
      get_help: isHt ? 'Mwen bezwen èd pou kòmanse sou platfòm lan' : 'I need help getting started on the platform',
      creator_info: isHt ? 'Mwen vle kòmanse kreye kontni sou Atelnyo' : 'I want to start creating content on Atelnyo',
      show_progress: isHt ? 'Ki kou mwen ap suiv kounye a?' : 'What courses am I taking right now?',
      show_calendar: isHt ? 'Ki evènman ki ap vini sou Atelnyo?' : 'What events are coming up on Atelnyo?',
      show_wallet: isHt ? 'Ki solde bous mwen?' : 'What is my wallet balance?',
      show_saved: isHt ? 'Ban m wè sa mwen sove a' : 'Show me my saved items',
      follow_creator: isHt ? 'Follow @Atelnyo' : 'Follow @Atelnyo',
      send_message: isHt ? 'Voye mesaj bay @Atelnyo' : 'Send message to @Atelnyo',
      join_community: isHt ? 'Rejwine kominote' : 'Join a community',
      notifications: isHt ? 'Ban m wè notifikasyon mwen' : 'Show my notifications',
      mark_read: isHt ? 'Make tout notifikasyon kom li' : 'Mark all notifications read',
    };
    handleSend(prompts[action] || 'Hello');
  }, [handleSend, isHt]);

  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.en;
  const showSuggestions = messages.length <= 1 && !isThinking;
  const lastBotMsg = [...messages].reverse().find(m => m.role === 'bot');
  const followUps = showSuggestions ? [] : _getFollowUpSuggestions(lastBotMsg?.text, lang);

  const windowStyle = isOpen
    ? { opacity: 1, transform: 'translateY(0) scale(1)', pointerEvents: 'auto' }
    : isAnimating
      ? { opacity: 0, transform: 'translateY(20px) scale(0.95)', pointerEvents: 'none' }
      : { opacity: 0, transform: 'translateY(20px) scale(0.95)', pointerEvents: 'none', display: 'none' };

  const themeVars = {
    '--chat-primary': theme.primary,
    '--chat-primary-dark': theme.primaryDark,
    '--chat-light': theme.light,
    '--chat-gradient': theme.gradient,
    '--chat-user-gradient': theme.userGradient,
    '--chat-shadow': theme.shadow,
  };

  return (
    <>
      <button
        className={`chat-btn ${isOpen ? 'chat-btn--open' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Open AI chat'}
        style={{ '--chat-primary': theme.primary, '--chat-shadow': theme.shadow }}
      >
        <i className={isOpen ? 'fas fa-times' : 'fas fa-robot'} />
        {!isOpen && <span className="chat-btn-pulse" style={{ background: theme.primary }} />}
      </button>

      <div className="chat-window" style={{ ...windowStyle, ...themeVars }} role="dialog" aria-label="Atelnyo AI Chat" aria-modal="false">
        {/* Header */}
        <div className="chat-header" style={{ background: theme.gradient }}>
          <div className="chat-header-left">
            <div className="chat-header-avatar" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <i className="fas fa-robot" />
            </div>
            <div className="chat-header-info">
              <span className="chat-header-name">Atelnyo AI</span>
              <span className="chat-header-status">
                <span className="chat-status-dot" />
                {isHt ? 'An liy' : lang === 'fr' ? 'En ligne' : lang === 'es' ? 'En línea' : 'Online'}
              </span>
            </div>
          </div>
          <div className="chat-header-actions">
            <div className="chat-theme-picker-wrap">
              <button className="chat-header-btn" onClick={() => setShowThemePicker(!showThemePicker)} title="Theme" aria-label="Change theme">
                <i className="fas fa-palette" />
              </button>
              {showThemePicker && (
                <div className="chat-theme-picker">
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button key={key} className={`chat-theme-option ${themeKey === key ? 'chat-theme-option--active' : ''}`} onClick={() => { setThemeKey(key); setShowThemePicker(false); }} title={t.name}>
                      <span className="chat-theme-swatch" style={{ background: t.primary }} />
                      <span className="chat-theme-name">{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="chat-header-btn" onClick={handleClear} title={isHt ? 'Efase konvèsasyon' : 'Clear conversation'}>
              <i className="fas fa-trash" />
            </button>
            <button className="chat-header-btn" onClick={toggleChat} aria-label="Close chat">
              <i className="fas fa-chevron-down" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              {msg.role === 'bot' && (
                <div className="msg-avatar msg-avatar--bot" style={{ background: theme.gradient }}>
                  <i className="fas fa-robot" />
                </div>
              )}
              <div className="msg-content">
                {msg.role === 'bot' ? (
                  <>
                    {msg.text && <div dangerouslySetInnerHTML={{ __html: _renderMarkdown(msg.text) }} />}
                    {msg.linkPreview && <_LinkPreview url={msg.linkPreview} />}
                  </>
                ) : (
                  <span>{msg.text}</span>
                )}
                <div className="msg-meta">
                  {msg.timestamp && <span className="msg-time">{_formatTime(msg.timestamp)}</span>}
                  {msg.model && <span className="msg-model">{msg.model}{msg.duration_ms ? ` · ${msg.duration_ms}ms` : ''}</span>}
                </div>
              </div>
              {msg.role === 'bot' && <CopyButton text={msg.text} lang={lang} />}
              {msg.role === 'user' && (
                <div className="msg-avatar msg-avatar--user">
                  <i className="fas fa-user" />
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="msg bot">
              <div className="msg-avatar msg-avatar--bot" style={{ background: theme.gradient }}>
                <i className="fas fa-robot" />
              </div>
              <div className="msg-content">
                <div className="thinking-indicator">
                  <span className="thinking-dot" style={{ background: theme.primary }} />
                  <span className="thinking-dot" style={{ background: theme.primary }} />
                  <span className="thinking-dot" style={{ background: theme.primary }} />
                </div>
                <span className="thinking-label">{isHt ? 'Ap panse...' : lang === 'fr' ? 'Réflexion...' : lang === 'es' ? 'Pensando...' : 'Thinking...'}</span>
              </div>
            </div>
          )}

          {/* Error + retry */}
          {error && !isThinking && (
            <div className="msg bot">
              <div className="msg-avatar msg-avatar--bot" style={{ background: theme.gradient }}>
                <i className="fas fa-robot" />
              </div>
              <div className="msg-content msg-content--error">
                <div className="msg-error-text">
                  <i className="fas fa-exclamation-triangle" />
                  {error}
                </div>
                <button className="msg-retry-btn" onClick={handleRetry}>
                  <i className="fas fa-redo" /> {isHt ? 'Eseye ankò' : 'Retry'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Action Buttons */}
          {showSuggestions && (
            <div className="chat-quick-actions">
              <div className="chat-quick-actions-label">
                {isHt ? '⚡ Aksyon rapid:' : lang === 'fr' ? '⚡ Actions rapides :' : lang === 'es' ? '⚡ Acciones rápidas:' : '⚡ Quick actions:'}
              </div>
              {Object.entries(INTENTS).map(([key, intent]) => (
                <button key={key} className="chat-quick-action-btn" onClick={() => handleQuickAction(intent.action)} style={{ '--hover-bg': theme.light, '--hover-border': theme.primary }}>
                  <span>{intent.label[lang] || intent.label.en}</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggested prompts */}
          {showSuggestions && (
            <div className="chat-suggestions">
              <div className="chat-suggestions-label">
                {isHt ? '💡 Eseye poze kesyon sa yo:' : lang === 'fr' ? '💡 Essayez ces questions :' : '💡 Try asking:'}
              </div>
              {suggestions.map((s, i) => (
                <button key={i} className="chat-suggestion-btn" onClick={() => { if (s._mentor) { _handleMentorAction(s._mentor); } else { handleSend(s.text); } }} style={{ '--hover-bg': theme.light, '--hover-border': theme.primary }}>
                  <span className="chat-suggestion-icon">{s.icon}</span>
                  <span className="chat-suggestion-text">{s.text}</span>
                  <i className="fas fa-arrow-right chat-suggestion-arrow" />
                </button>
              ))}
            </div>
          )}

          {/* Follow-up suggestions after bot reply */}
          {followUps.length > 0 && !isThinking && (
            <div className="chat-follow-ups">
              {followUps.map((s, i) => (
                <button key={i} className="chat-follow-up-btn" onClick={() => { if (s._mentor) { _handleMentorAction(s._mentor); } else { handleSend(s.text); } }} style={{ borderColor: theme.primary + '30' }}>
                  <span>{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={msgsEndRef} />
        </div>

        {/* Intent Detection Banner */}
        {detectedIntent && !isThinking && (
          <div className="chat-intent-banner" style={{ background: theme.light, borderColor: theme.primary + '30' }}>
            <span className="chat-intent-icon">{detectedIntent.key === 'course' ? '📚' : detectedIntent.key === 'explore' ? '🔍' : detectedIntent.key === 'premium' ? '⭐' : detectedIntent.key === 'help' ? '💡' : '🎨'}</span>
            <span className="chat-intent-text">{isHt ? 'Mwen panse ou ap chèche:' : 'I think you\'re looking for:'}</span>
            <button className="chat-intent-action" onClick={() => handleQuickAction(detectedIntent.action)} style={{ color: theme.primary }}>
              {detectedIntent.label[lang] || detectedIntent.label.en}
            </button>
          </div>
        )}

        {/* Input */}
        <div className="chat-input-area" role="form">
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={isHt ? 'Ekri mesaj ou...' : lang === 'fr' ? 'Écrivez un message...' : lang === 'es' ? 'Escribe un mensaje...' : 'Type a message...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              disabled={isThinking}
              maxLength={MAX_CHARS}
              style={{ '--input-focus': theme.primary }}
            />
            {input.length > MAX_CHARS * 0.8 && (
              <span className={`chat-char-count ${input.length >= MAX_CHARS ? 'chat-char-count--limit' : ''}`}>
                {input.length}/{MAX_CHARS}
              </span>
            )}
          </div>
          <button
            className="chat-send-btn"
            onClick={isThinking ? handleStop : () => handleSend()}
            disabled={!isThinking && !input.trim()}
            style={{ background: theme.gradient, boxShadow: `0 2px 8px ${theme.shadow}` }}
            aria-label={isThinking ? (isHt ? 'Kanpe' : 'Stop') : (isHt ? 'Voye' : 'Send')}
            title={isThinking ? (isHt ? 'Kanpe repons lan' : 'Stop the reply') : (isHt ? 'Voye' : 'Send')}
          >
            <i className={isThinking ? 'fas fa-stop' : 'fas fa-paper-plane'} />
          </button>
        </div>
      </div>

      <style>{`
        /* ── Floating Button ──────────────────────────────────── */
        .chat-btn { position: fixed; bottom: 90px; left: 20px; width: 60px; height: 60px; border-radius: 50%; background: var(--chat-gradient, linear-gradient(135deg, #d81b60, #ad1457)); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 20px var(--chat-shadow, rgba(216, 27, 96, 0.4)); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; z-index: 2600; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: none; outline: none; }
        .chat-btn:hover { transform: scale(1.08); box-shadow: 0 6px 25px var(--chat-shadow, rgba(216, 27, 96, 0.5)); }
        .chat-btn:active { transform: scale(0.95); }
        .chat-btn--open { background: linear-gradient(135deg, #666, #444); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .chat-btn-pulse { position: absolute; width: 100%; height: 100%; border-radius: 50%; animation: chatPulse 2s infinite; pointer-events: none; }
        @keyframes chatPulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.8); opacity: 0; } }

        /* ── Chat Window ─────────────────────────────────────── */
        .chat-window { position: fixed; bottom: 160px; left: 20px; width: 380px; height: 520px; background: var(--glass-bg, rgba(255,255,255,0.95)); backdrop-filter: blur(20px); border-radius: 24px; box-shadow: 0 8px 40px rgba(0,0,0,0.15); display: flex; flex-direction: column; z-index: 2600; overflow: hidden; border: 1px solid var(--border-color, rgba(0,0,0,0.08)); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        @media (max-width: 600px) { .chat-window { width: calc(100% - 24px); height: 65vh; bottom: 150px; left: 12px; } }
        body.dark-mode .chat-window { background: rgba(30,30,30,0.95); box-shadow: 0 8px 40px rgba(0,0,0,0.4); }

        /* ── Header ──────────────────────────────────────────── */
        .chat-header { color: white; padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .chat-header-left { display: flex; align-items: center; gap: 12px; }
        .chat-header-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .chat-header-info { display: flex; flex-direction: column; gap: 2px; }
        .chat-header-name { font-weight: 700; font-size: 1rem; }
        .chat-header-status { display: flex; align-items: center; gap: 5px; font-size: 0.7rem; opacity: 0.85; }
        .chat-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4caf50; box-shadow: 0 0 6px rgba(76,175,80,0.6); }
        .chat-header-actions { display: flex; gap: 4px; }
        .chat-header-btn { background: rgba(255,255,255,0.15); border: none; color: white; cursor: pointer; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: background 0.15s; }
        .chat-header-btn:hover { background: rgba(255,255,255,0.25); }

        /* ── Theme Picker ─────────────────────────────────────── */
        .chat-theme-picker-wrap { position: relative; }
        .chat-theme-picker { position: absolute; top: 40px; right: 0; background: var(--card-bg, #fff); border: 1px solid var(--border-color, rgba(0,0,0,0.1)); border-radius: 12px; padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 10; min-width: 140px; }
        body.dark-mode .chat-theme-picker { background: rgba(40,40,40,0.98); }
        .chat-theme-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; transition: background 0.15s; font-size: 0.8rem; color: var(--text-main, #222); }
        body.dark-mode .chat-theme-option { color: #eee; }
        .chat-theme-option:hover { background: rgba(0,0,0,0.05); }
        .chat-theme-option--active { background: rgba(0,0,0,0.08); font-weight: 600; }
        .chat-theme-swatch { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; }
        .chat-theme-name { flex: 1; text-align: left; }

        /* ── Messages ────────────────────────────────────────── */
        .chat-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: rgba(255,255,255,0.02); scroll-behavior: smooth; }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
        body.dark-mode .chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }

        .msg { display: flex; align-items: flex-end; gap: 8px; max-width: 88%; animation: msgSlideIn 0.3s ease-out; }
        @keyframes msgSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .msg.user { align-self: flex-end; flex-direction: row-reverse; }
        .msg.bot { align-self: flex-start; }

        .msg-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .msg-avatar--bot { color: white; }
        .msg-avatar--user { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; }

        .msg-content { padding: 10px 14px; border-radius: 16px; font-size: 0.85rem; line-height: 1.5; word-wrap: break-word; }
        .msg.bot .msg-content { background: var(--chat-light, #fce4ec); color: var(--chat-primary, #d81b60); border-bottom-left-radius: 4px; }
        .msg.user .msg-content { background: var(--chat-user-gradient, linear-gradient(135deg, #d81b60, #ad1457)); color: white; border-bottom-right-radius: 4px; }
        body.dark-mode .msg.bot .msg-content { background: color-mix(in srgb, var(--chat-primary, #d81b60) 12%, transparent); }
        body.dark-mode .msg.user .msg-content { background: linear-gradient(135deg, #6366f1, #4f46e5); }

        .msg-copy-btn { background: none; border: none; cursor: pointer; font-size: 0.7rem; color: var(--text-secondary, #888); padding: 4px 6px; border-radius: 6px; transition: all 0.2s; opacity: 0; flex-shrink: 0; }
        .msg:hover .msg-copy-btn { opacity: 1; }
        .msg-copy-btn:hover { background: rgba(0,0,0,0.06); color: var(--chat-primary, #d81b60); }

        .msg-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 0.6rem; opacity: 0.5; }
        .msg.user .msg-meta { justify-content: flex-end; color: rgba(255,255,255,0.7); }

        .msg-content--error { background: rgba(239,68,68,0.08) !important; border: 1px solid rgba(239,68,68,0.2); }
        .msg-error-text { display: flex; align-items: center; gap: 6px; color: #ef4444; }
        .msg-retry-btn { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; padding: 6px 14px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; color: #ef4444; cursor: pointer; font-size: 0.75rem; }
        .msg-retry-btn:hover { background: rgba(239,68,68,0.18); }

        /* ── Link Preview Card ───────────────────────────── */
        .chat-link-preview {
          display: flex;
          flex-direction: column;
          margin-top: 8px;
          border: 1px solid var(--border-color, rgba(0,0,0,0.08));
          border-radius: 12px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.2s;
          max-width: 320px;
        }
        .chat-link-preview:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .chat-link-preview--loading { padding: 12px; }
        .chat-link-preview-skeleton {
          height: 60px;
          border-radius: 8px;
          background: linear-gradient(90deg, var(--border-color, rgba(0,0,0,0.06)) 25%, rgba(0,0,0,0.02) 50%, var(--border-color, rgba(0,0,0,0.06)) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .chat-link-preview-img { width: 100%; height: 140px; object-fit: cover; }
        .chat-link-preview-body { padding: 10px 12px; }
        .chat-link-preview-domain { font-size: 0.65rem; color: var(--text-secondary, #999); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .chat-link-preview-title { font-size: 0.82rem; font-weight: 600; color: var(--text-main, #222); line-height: 1.3; margin-bottom: 2px; }
        .chat-link-preview-desc { font-size: 0.72rem; color: var(--text-secondary, #777); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        body.dark-mode .chat-link-preview { border-color: rgba(255,255,255,0.1); }
        body.dark-mode .chat-link-preview-title { color: #eee; }
        body.dark-mode .chat-link-preview-desc { color: #aaa; }

        /* ── Thinking ─────────────────────────────────────────── */
        .thinking-indicator { display: inline-flex; gap: 5px; padding: 6px 0; }
        .thinking-dot { width: 8px; height: 8px; border-radius: 50%; animation: dotBounce 1.4s infinite ease-in-out; }
        .thinking-dot:nth-child(2) { animation-delay: 0.16s; }
        .thinking-dot:nth-child(3) { animation-delay: 0.32s; }
        @keyframes dotBounce { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.7); } 40% { opacity: 1; transform: scale(1.1); } }
        .thinking-label { font-size: 0.7rem; opacity: 0.6; margin-top: 2px; }

        /* ── Quick Actions ────────────────────────────────────── */
        .chat-quick-actions { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
        .chat-quick-actions-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary, #888); padding: 0 4px 4px; }
        .chat-quick-action-btn { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color, rgba(0,0,0,0.08)); background: var(--card-bg, #fff); cursor: pointer; font-size: 0.82rem; color: var(--text-main, #222); transition: all 0.2s; text-align: left; }
        .chat-quick-action-btn:hover { background: var(--hover-bg, #fce4ec); border-color: var(--hover-border, var(--chat-primary, #d81b60)); transform: translateX(4px); }
        body.dark-mode .chat-quick-action-btn { background: rgba(255,255,255,0.03); color: #eee; }

        /* ── Suggestions ──────────────────────────────────────── */
        .chat-suggestions { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
        .chat-suggestions-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary, #888); padding: 0 4px 4px; }
        .chat-suggestion-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; border: 1px solid var(--border-color, rgba(0,0,0,0.08)); background: var(--card-bg, #fff); cursor: pointer; text-align: left; font-size: 0.8rem; color: var(--text-main, #222); transition: all 0.2s; }
        .chat-suggestion-btn:hover { background: var(--hover-bg, #fce4ec); border-color: var(--hover-border, var(--chat-primary, #d81b60)); transform: translateX(4px); }
        body.dark-mode .chat-suggestion-btn { background: rgba(255,255,255,0.03); color: #eee; }
        .chat-suggestion-icon { font-size: 1.2rem; }
        .chat-suggestion-text { flex: 1; }
        .chat-suggestion-arrow { font-size: 0.65rem; opacity: 0.3; transition: all 0.2s; }
        .chat-suggestion-btn:hover .chat-suggestion-arrow { opacity: 0.7; transform: translateX(2px); }

        /* ── Follow-up Suggestions ────────────────────────────── */
        .chat-follow-ups { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 0; }
        .chat-follow-up-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 16px; border: 1px solid; background: transparent; cursor: pointer; font-size: 0.75rem; color: var(--text-main, #222); transition: all 0.2s; white-space: nowrap; }
        .chat-follow-up-btn:hover { background: rgba(0,0,0,0.04); transform: translateY(-1px); }
        body.dark-mode .chat-follow-up-btn { color: #eee; border-color: rgba(255,255,255,0.15); }

        /* ── Intent Detection Banner ──────────────────────────── */
        .chat-intent-banner { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin: 0 16px; border-radius: 10px; border: 1px solid; font-size: 0.75rem; animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .chat-intent-icon { font-size: 1rem; }
        .chat-intent-text { flex: 1; opacity: 0.7; }
        .chat-intent-action { background: none; border: none; cursor: pointer; font-weight: 600; font-size: 0.75rem; text-decoration: underline; }
        .chat-intent-action:hover { opacity: 0.8; }

        /* ── Code Blocks ──────────────────────────────────────── */
        .chat-code-block { margin: 8px 0; border-radius: 10px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); }
        body.dark-mode .chat-code-block { border-color: rgba(255,255,255,0.1); }
        .chat-code-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(0,0,0,0.06); }
        body.dark-mode .chat-code-header { background: rgba(255,255,255,0.06); }
        .chat-code-lang { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; color: var(--text-secondary, #888); }
        .chat-code-copy { background: none; border: none; cursor: pointer; font-size: 0.7rem; color: var(--text-secondary, #888); padding: 4px 8px; border-radius: 6px; }
        .chat-code-copy:hover { background: rgba(0,0,0,0.08); }
        .chat-code { background: rgba(0,0,0,0.04); padding: 12px 14px; font-size: 0.75rem; overflow-x: auto; margin: 0; border: none; }
        body.dark-mode .chat-code { background: rgba(0,0,0,0.2); }
        .chat-inline-code { background: rgba(0,0,0,0.06); border-radius: 4px; padding: 2px 6px; font-size: 0.8em; }
        body.dark-mode .chat-inline-code { background: rgba(255,255,255,0.08); }
        .chat-code code, .chat-inline-code { font-family: 'Fira Code', monospace; }

        .code-keyword { color: #d81b60; font-weight: 600; }
        .code-string { color: #2e7d32; }
        .code-comment { color: #9e9e9e; font-style: italic; }
        .code-number { color: #e65100; }
        .code-function { color: #1976d2; }
        body.dark-mode .code-keyword { color: #f48fb1; }
        body.dark-mode .code-string { color: #81c784; }
        body.dark-mode .code-comment { color: #757575; }
        body.dark-mode .code-number { color: #ffb74d; }
        body.dark-mode .code-function { color: #64b5f6; }

        /* ── Links ────────────────────────────────────────────── */
        .chat-window .msg.bot a.chat-link { color: var(--chat-primary, #d81b60); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; font-weight: 500; padding: 1px 5px; border-radius: 4px; }
        .chat-window .msg.bot a.chat-link:hover { background: rgba(216,27,96,0.1); }
        body.dark-mode .chat-window .msg.bot a.chat-link { color: #f48fb1; }
        .chat-window .msg.bot strong { color: var(--chat-primary, #d81b60); font-weight: 700; }
        body.dark-mode .chat-window .msg.bot strong { color: #f48fb1; }
        .chat-window .msg.bot p { margin: 4px 0; }
        .chat-window .msg.bot ul { margin: 6px 0; padding-left: 20px; }

        /* ── Input Area — fully responsive ──────────────────── */
        .chat-input-area {
          padding: 10px 12px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          border-top: 1px solid var(--border-color, rgba(0,0,0,0.06));
          background: var(--white, #fff);
          flex-shrink: 0;
          min-height: 56px;
        }
        body.dark-mode .chat-input-area {
          background: rgba(30,30,30,0.98);
          border-color: rgba(255,255,255,0.08);
        }
        .chat-input-wrapper {
          flex: 1;
          position: relative;
          min-width: 0;
          display: flex;
          align-items: flex-end;
        }
        .chat-input {
          width: 100%;
          height: 42px;
          min-height: 42px;
          max-height: 120px;
          border: 1.5px solid var(--border-color, rgba(0,0,0,0.1));
          padding: 10px 40px 10px 14px;
          border-radius: 22px;
          outline: none;
          background: var(--surface-page, #f8f9fa);
          color: var(--text-main, #222);
          font-size: 0.88rem;
          font-family: inherit;
          line-height: 1.4;
          resize: none;
          overflow-y: auto;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .chat-input:focus {
          border-color: var(--input-focus, var(--chat-primary, #d81b60));
          box-shadow: 0 0 0 3px rgba(216,27,96,0.1);
        }
        body.dark-mode .chat-input {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.12);
          color: #eee;
        }
        .chat-input::placeholder {
          color: var(--text-secondary, #aaa);
        }
        .chat-char-count {
          position: absolute;
          right: 12px;
          bottom: 8px;
          font-size: 0.6rem;
          color: var(--text-secondary, #aaa);
          pointer-events: none;
        }
        .chat-char-count--limit {
          color: #ef4444;
          font-weight: 600;
        }
        .chat-send-btn {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border-radius: 50%;
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
          flex-shrink: 0;
          flex-grow: 0;
          margin-bottom: 0;
          padding: 0;
          box-sizing: border-box;
        }
        .chat-send-btn:hover:not(:disabled) { transform: scale(1.08); }
        .chat-send-btn:active:not(:disabled) { transform: scale(0.95); }
        .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Mobile responsive ───────────────────────────────── */
        @media (max-width: 600px) {
          .chat-window {
            width: calc(100% - 16px) !important;
            height: calc(100vh - 140px) !important;
            max-height: calc(100vh - 140px);
            bottom: 80px !important;
            left: 8px !important;
            right: 8px !important;
            border-radius: 20px !important;
          }
          .chat-btn {
            width: 56px;
            height: 56px;
            font-size: 22px;
            bottom: 84px;
            left: 16px;
          }
          .chat-input-area {
            padding: 8px 10px;
            gap: 6px;
          }
          .chat-input {
            font-size: 16px; /* Prevent iOS zoom */
            padding: 10px 36px 10px 12px;
            min-height: 40px;
          }
          .chat-send-btn {
            width: 40px;
            height: 40px;
            min-width: 40px;
          }
          .msg {
            max-width: 90%;
          }
          .msg-content {
            padding: 8px 12px;
            font-size: 0.82rem;
          }
          .chat-header {
            padding: 12px 14px;
          }
          .chat-header-avatar {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }
          .chat-messages {
            padding: 12px;
            gap: 10px;
          }
          .chat-suggestion-btn,
          .chat-quick-action-btn {
            padding: 8px 12px;
            font-size: 0.78rem;
          }
          .chat-follow-ups {
            gap: 4px;
          }
          .chat-follow-up-btn {
            padding: 5px 10px;
            font-size: 0.7rem;
          }
        }
        /* Small phones */
        @media (max-width: 380px) {
          .chat-window {
            width: calc(100% - 8px) !important;
            height: calc(100vh - 120px) !important;
            bottom: 70px !important;
            left: 4px !important;
            right: 4px !important;
          }
          .chat-btn {
            width: 50px;
            height: 50px;
            bottom: 70px;
            left: 12px;
          }
        }
        /* Landscape mode */
        @media (max-height: 500px) and (orientation: landscape) {
          .chat-window {
            height: calc(100vh - 100px) !important;
            bottom: 70px !important;
          }
          .chat-header {
            padding: 8px 12px;
          }
          .chat-header-avatar {
            width: 32px;
            height: 32px;
          }
          .chat-messages {
            padding: 8px;
            gap: 6px;
          }
        }
        /* Safe area (notch phones) */
        @supports (padding: env(safe-area-inset-bottom)) {
          .chat-input-area {
            padding-bottom: calc(10px + env(safe-area-inset-bottom));
          }
          .chat-window {
            bottom: calc(80px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </>
  );
});

export default Chatbot;
