/**
 * src/services/userActivity.js
 *
 * Lightweight user activity tracker — detects:
 *   - Current page & content context
 *   - Navigation flow (where they came from, where they're going)
 *   - Content being viewed (course, music, talent, etc.)
 *   - Session behavior (time on page, scroll depth, interaction patterns)
 *
 * Provides real-time context for the chatbot and other UI components.
 * All data stays client-side (localStorage) — no server calls.
 */

const STORAGE_KEY = 'atelnyo_user_activity';
const MAX_HISTORY = 20;
const MAX_SESSION = 30 * 60 * 1000; // 30 min session window

// ─── Content type detection from URL ────────────────────────────
const PATH_PATTERNS = [
  { pattern: /^\/explore/, type: 'explore', label: 'Explore' },
  { pattern: /^\/sheet\/community\//, type: 'community', label: 'Community' },
  { pattern: /^\/sheet\/learn\//, type: 'learning', label: 'Learning Space' },
  { pattern: /^\/sheet\/studio/, type: 'studio', label: 'Creator Studio' },
  { pattern: /^\/sheet\/settings/, type: 'settings', label: 'Settings' },
  { pattern: /^\/sheet\/mwen/, type: 'profile', label: 'Profile' },
  { pattern: /^\/sheet\/wallet/, type: 'wallet', label: 'Wallet' },
  { pattern: /^\/sheet\/messages/, type: 'messages', label: 'Messages' },
  { pattern: /^\/sheet\/notifications/, type: 'notifications', label: 'Notifications' },
  { pattern: /^\/sheet\/dashboard/, type: 'dashboard', label: 'Dashboard' },
  { pattern: /^\/c\//, type: 'creator_profile', label: 'Creator Profile' },
  { pattern: /^\/marketplace\//, type: 'marketplace', label: 'Marketplace' },
  { pattern: /^\/login|^\/signup/, type: 'auth', label: 'Authentication' },
  { pattern: /^\/creator/, type: 'creator_apply', label: 'Creator Application' },
];

// Content type from URL segment patterns
const CONTENT_PATTERNS = [
  { pattern: /\/course$/, type: 'course' },
  { pattern: /\/music$/, type: 'music' },
  { pattern: /\/talent$/, type: 'talent' },
  { pattern: /\/job$/, type: 'job' },
  { pattern: /\/portfolio$/, type: 'portfolio' },
  { pattern: /\/product$/, type: 'product' },
  { pattern: /\/spotlight$/, type: 'spotlight' },
  { pattern: /\/event$/, type: 'event' },
];

class UserActivityTracker {
  constructor() {
    this._session = this._loadSession();
    this._listeners = new Set();
    this._scrollHandler = this._onScroll.bind(this);
    this._clickHandler = this._onClick.bind(this);
    this._pageVisible = true;
    this._lastActivity = Date.now();

    if (typeof window !== 'undefined') {
      // Track scroll depth
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
      // Track clicks on links/content
      document.addEventListener('click', this._clickHandler, { passive: true });
      // Track page visibility
      document.addEventListener('visibilitychange', () => {
        this._pageVisible = !document.hidden;
        if (!document.hidden) this._lastActivity = Date.now();
      });
      // Track navigation
      window.addEventListener('popstate', () => this._onNavigate());
      // Intercept pushState/replaceState
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = (...args) => { origPush.apply(history, args); this._onNavigate(); };
      history.replaceState = (...args) => { origReplace.apply(history, args); this._onNavigate(); };
    }
  }

  /** Start tracking a new page visit */
  trackPage(pathname) {
    if (!pathname) return;
    const prev = this._session.current;
    const context = this._parsePath(pathname);

    // Don't re-track same page
    if (prev?.pathname === pathname) return;

    // Save previous page to history
    if (prev) {
      prev.leftAt = Date.now();
      prev.timeSpent = (prev.leftAt - (prev.enteredAt || prev.leftAt));
      this._session.history.push({ ...prev });
      if (this._session.history.length > MAX_HISTORY) {
        this._session.history.shift();
      }
    }

    // Set current page
    this._session.current = {
      pathname,
      ...context,
      enteredAt: Date.now(),
      leftAt: null,
      timeSpent: 0,
      scrollDepth: 0,
      clicks: 0,
    };

    this._session.lastUpdated = Date.now();
    this._saveSession();
    this._notify();
  }

  /** Get current activity context (for chatbot) */
  getContext() {
    const now = Date.now();
    const current = this._session.current;
    const history = this._session.history || [];

    // Determine user's "flow" — what they've been doing recently
    const recentTypes = history.slice(-5).map(h => h.type).filter(Boolean);
    const dominantType = this._mostFrequent(recentTypes);

    // Time on current page
    const timeOnPage = current ? Math.round((now - (current.enteredAt || now)) / 1000) : 0;

    // Browsing pattern
    const pattern = this._detectPattern(history);

    return {
      current: current ? {
        page: current.label || current.pathname,
        type: current.type,
        contentType: current.contentType,
        contentId: current.contentId,
        creatorSlug: current.creatorSlug,
        timeOnPage,
        scrollDepth: current.scrollDepth || 0,
      } : null,
      recentPages: history.slice(-5).map(h => ({
        page: h.label || h.pathname,
        type: h.type,
        timeSpent: Math.round((h.timeSpent || 0) / 1000),
      })),
      flow: {
        pattern, // 'browsing', 'learning', 'shopping', 'creating', 'exploring'
        dominantType,
        totalSessionPages: history.length + (current ? 1 : 0),
      },
      sessionDuration: Math.round((now - (this._session.startedAt || now)) / 1000),
    };
  }

  /** Generate a natural-language summary of user activity */
  getActivitySummary(lang = 'en') {
    const ctx = this.getContext();
    if (!ctx.current) return null;

    const isHt = lang === 'ht';
    const c = ctx.current;
    const parts = [];

    // Current page
    if (c.type === 'course' && c.contentId) {
      parts.push(isHt ? `li sou yon kou (${c.contentId})` : `viewing a course (${c.contentId})`);
    } else if (c.type === 'creator_profile' && c.creatorSlug) {
      parts.push(isHt ? `li sou paj kreyatè: ${c.creatorSlug}` : `viewing creator: ${c.creatorSlug}`);
    } else if (c.type === 'community') {
      parts.push(isHt ? 'li sou yon kominote' : 'viewing a community');
    } else if (c.type === 'learning') {
      parts.push(isHt ? 'li nan espas aprantisaj' : 'in the learning space');
    } else if (c.type === 'studio') {
      parts.push(isHt ? 'li nan Studio Kreyatè' : 'in Creator Studio');
    } else if (c.type === 'marketplace') {
      parts.push(isHt ? 'li sou mache a' : 'browsing the marketplace');
    } else {
      parts.push(isHt ? `li sou ${c.page}` : `on ${c.page}`);
    }

    // Time context
    if (c.timeOnPage > 120) {
      parts.push(isHt ? `depui ${Math.round(c.timeOnPage / 60)} min` : `for ${Math.round(c.timeOnPage / 60)} min`);
    }

    // Flow context
    if (ctx.flow.pattern === 'browsing' && ctx.recentPages.length > 2) {
      parts.push(isHt ? 'ap browse diferan kontni' : 'browsing different content');
    } else if (ctx.flow.pattern === 'learning') {
      parts.push(isHt ? 'ap aprann' : 'learning');
    }

    // Scroll engagement
    if (c.scrollDepth > 80) {
      parts.push(isHt ? 'li manyen anba paj la' : 'scrolled deep into the page');
    }

    return parts.join(' · ') || null;
  }

  // ─── Internal ───────────────────────────────────────────────

  _parsePath(pathname) {
    let path = pathname.replace(/^\/+/, '');
    // Strip locale prefix
    path = path.replace(/^(en|ht|fr|es)-[A-Z]{2}\//i, '');

    let type = 'page';
    let label = path || 'Home';
    let contentType = null;
    let contentId = null;
    let creatorSlug = null;

    // Match page type
    for (const { pattern, type: t, label: l } of PATH_PATTERNS) {
      if (pattern.test(pathname)) {
        type = t;
        label = l;
        break;
      }
    }

    // Extract creator slug from /c/slug or /@slug
    const creatorMatch = pathname.match(/\/c\/([^/]+)/);
    if (creatorMatch) creatorSlug = creatorMatch[1];

    // Extract content type from URL end
    for (const { pattern, type: ct } of CONTENT_PATTERNS) {
      if (pattern.test(pathname)) {
        contentType = ct;
        break;
      }
    }

    // Extract content ID/slug from path
    const slugMatch = path.match(/\/([^/]+?)(?:\/(course|music|talent|job|portfolio|product|spotlight|event))?$/);
    if (slugMatch && slugMatch[1]) {
      contentId = slugMatch[1];
    }

    return { type, label, contentType, contentId, creatorSlug };
  }

  _onScroll() {
    if (!this._session.current) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const depth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
    if (depth > (this._session.current.scrollDepth || 0)) {
      this._session.current.scrollDepth = depth;
      this._lastActivity = Date.now();
    }
  }

  _onClick(e) {
    if (!this._session.current) return;
    this._session.current.clicks = (this._session.current.clicks || 0) + 1;
    this._lastActivity = Date.now();
  }

  _onNavigate() {
    // Small delay to let the URL update
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        this.trackPage(window.location.pathname);
      }
    }, 50);
  }

  _detectPattern(history) {
    if (history.length < 2) return 'exploring';
    const types = history.slice(-6).map(h => h.type);
    if (types.includes('learning')) return 'learning';
    if (types.includes('studio')) return 'creating';
    if (types.includes('marketplace') || types.includes('course')) return 'shopping';
    return 'browsing';
  }

  _mostFrequent(arr) {
    if (!arr.length) return null;
    const counts = {};
    arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  _loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // Reset if session expired (>30 min)
        if (Date.now() - (data.lastUpdated || 0) > MAX_SESSION) {
          return this._newSession();
        }
        return data;
      }
    } catch { /* ignore */ }
    return this._newSession();
  }

  _newSession() {
    return {
      startedAt: Date.now(),
      lastUpdated: Date.now(),
      current: null,
      history: [],
    };
  }

  _saveSession() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._session));
    } catch { /* ignore */ }
  }

  _notify() {
    this._listeners.forEach(fn => {
      try { fn(this.getContext()); } catch { /* ignore */ }
    });
  }

  /** Subscribe to activity changes */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Destroy tracker */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler);
      document.removeEventListener('click', this._clickHandler);
    }
    this._listeners.clear();
  }
}

// Singleton
const userActivity = new UserActivityTracker();

export default userActivity;
