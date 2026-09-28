/**
 * src/services/projectDataEngine.js
 *
 * Project Data Engine — automatically fetches real-time data from the
 * Atelnyo API and provides it as context for the chatbot.
 *
 * Fetches:
 *   - Course catalog (top courses, counts by category)
 *   - Creator profiles (top creators, counts)
 *   - Music tracks, talents, jobs, products
 *   - Communities, events
 *   - Platform stats (total users, courses, etc.)
 *
 * Data is cached for 5 minutes to avoid hammering the API.
 */

import api from './api';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cache = null;
let lastFetch = 0;

/**
 * Fetch all project data from the API.
 * Returns a structured object the chatbot can use as context.
 */
async function fetchProjectData() {
  const now = Date.now();
  if (cache && (now - lastFetch) < CACHE_TTL) {
    return cache;
  }

  try {
    const [
      coursesRes,
      creatorsRes,
      musicRes,
      talentsRes,
      jobsRes,
      productsRes,
      communitiesRes,
    ] = await Promise.allSettled([
      api.get('courses/', { params: { page_size: 10, status: 'published' } }),
      api.get('creator-profiles/', { params: { page_size: 10 } }),
      api.get('explore/music/', { params: { page_size: 5 } }),
      api.get('explore/talents/', { params: { page_size: 5 } }),
      api.get('explore/recommended/jobs/', { params: { page_size: 5 } }),
      api.get('explore/recommended/products/', { params: { page_size: 5 } }),
      api.get('communities/', { params: { page_size: 5 } }),
    ]);

    const courses = coursesRes.status === 'fulfilled' ? coursesRes.value.data : {};
    const creators = creatorsRes.status === 'fulfilled' ? creatorsRes.value.data : {};
    const music = musicRes.status === 'fulfilled' ? musicRes.value.data : {};
    const talents = talentsRes.status === 'fulfilled' ? talentsRes.value.data : {};
    const jobs = jobsRes.status === 'fulfilled' ? jobsRes.value.data : {};
    const products = productsRes.status === 'fulfilled' ? productsRes.value.data : {};
    const communities = communitiesRes.status === 'fulfilled' ? communitiesRes.value.data : {};

    cache = {
      courses: {
        total: courses.count || 0,
        // 6 items — this list is serialized into EVERY chat system
        // prompt; the free daily Neuron allocation scales inversely
        // with how much we stuff in here.
        top: (courses.results || []).slice(0, 6).map(c => ({
          id: c.id,
          title: c.title,
          creator: c.created_by_username || c.creator?.username || 'Unknown',
          price: c.price,
          status: c.status,
          slug: c.slug,
        })),
      },
      creators: {
        total: creators.count || 0,
        top: (creators.results || []).slice(0, 6).map(c => ({
          id: c.id,
          slug: c.slug,
          display_name: c.display_name,
          is_verified: c.is_verified,
          is_featured: c.is_featured,
          followers: c.followers_count || 0,
          courses: c.courses_count || 0,
        })),
      },
      music: {
        total: music.count || 0,
        top: (music.results || []).slice(0, 3).map(m => ({
          id: m.id,
          title: m.title,
          creator: m.user?.username || 'Unknown',
        })),
      },
      talents: {
        total: talents.count || 0,
        top: (talents.results || []).slice(0, 3).map(t => ({
          id: t.id,
          name: t.name || t.display_name,
          category: t.category,
        })),
      },
      jobs: {
        total: jobs.count || 0,
        top: (jobs.results || []).slice(0, 3).map(j => ({
          id: j.id,
          title: j.title,
          company: j.company_name,
        })),
      },
      products: {
        total: products.count || 0,
        top: (products.results || []).slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
        })),
      },
      communities: {
        total: communities.count || 0,
        top: (communities.results || []).slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          members: c.member_count || 0,
        })),
      },
      fetched_at: new Date().toISOString(),
    };

    lastFetch = now;
    return cache;
  } catch (err) {
    console.warn('[ProjectDataEngine] Failed to fetch project data:', err.message);
    return cache || { error: 'Failed to load project data', fetched_at: new Date().toISOString() };
  }
}

/**
 * Build a context string from project data for the system prompt.
 */
function buildProjectContext(data) {
  if (!data || data.error) return '';

  const lines = [];
  // Cap each item line — long titles would inflate every prompt.
  const clip = (s, n = 60) => String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || '');

  // Course catalog
  if (data.courses?.total > 0) {
    lines.push(`COURSE CATALOG (${data.courses.total} total):`);
    for (const c of data.courses.top) {
      const price = c.price ? `$${c.price}` : 'Free';
      lines.push(`  - [${c.id}] "${clip(c.title, 48)}" @${clip(c.creator, 24)} — ${price}`);
    }
  }

  // Creators
  if (data.creators?.total > 0) {
    lines.push(`\nCREATOR PROFILES (${data.creators.total} total):`);
    for (const c of data.creators.top) {
      const badges = [];
      if (c.is_verified) badges.push('✓');
      if (c.is_featured) badges.push('★');
      lines.push(`  - @${clip(c.slug, 24)} — ${c.followers} followers, ${c.courses} courses ${badges.join('')}`);
    }
  }

  // Music
  if (data.music?.total > 0) {
    lines.push(`\nMUSIC TRACKS (${data.music.total} total):`);
    for (const m of data.music.top) {
      lines.push(`  - "${clip(m.title, 48)}" @${clip(m.creator, 24)}`);
    }
  }

  // Talents
  if (data.talents?.total > 0) {
    lines.push(`\nTALENTS (${data.talents.total} total):`);
    for (const t of data.talents.top) {
      lines.push(`  - ${clip(t.name, 40)} (${t.category || 'general'})`);
    }
  }

  // Jobs
  if (data.jobs?.total > 0) {
    lines.push(`\nJOBS (${data.jobs.total} total):`);
    for (const j of data.jobs.top) {
      lines.push(`  - "${clip(j.title, 48)}" at ${clip(j.company || 'Various', 30)}`);
    }
  }

  // Products
  if (data.products?.total > 0) {
    lines.push(`\nPRODUCTS (${data.products.total} total):`);
    for (const p of data.products.top) {
      const price = p.price ? `$${p.price}` : 'Free';
      lines.push(`  - "${clip(p.title, 48)}" — ${price}`);
    }
  }

  // Communities
  if (data.communities?.total > 0) {
    lines.push(`\nCOMMUNITIES (${data.communities.total} total):`);
    for (const c of data.communities.top) {
      lines.push(`  - "${clip(c.name, 40)}" — ${c.members} members`);
    }
  }

  return lines.length > 0
    ? `\n\nLIVE PLATFORM DATA (auto-fetched at ${data.fetched_at}):\n${lines.join('\n')}`
    : '';
}

export { fetchProjectData, buildProjectContext };

// ─── User-Specific Data Engine ────────────────────────────────
// Fetches the logged-in user's personal data: progress, wallet,
// saved items, events — cached for 2 minutes.

const USER_CACHE_TTL = 2 * 60 * 1000;
let userCache = null;
let userLastFetch = 0;
let userCacheKey = null; // invalidate when user changes

async function fetchUserData(user) {
  if (!user?.id) return null;
  const now = Date.now();
  if (userCache && userCacheKey === user.id && (now - userLastFetch) < USER_CACHE_TTL) {
    return userCache;
  }

  try {
    const [
      progressRes,
      walletRes,
      savedCoursesRes,
      savedMusicRes,
      savedTalentsRes,
      eventsRes,
      activityRes,
    ] = await Promise.allSettled([
      api.get('progress/', { params: { page_size: 20 } }),
      api.get('wallet/me/'),
      api.get('explore/saved/items/', { params: { item_type: 'course', page_size: 5 } }),
      api.get('explore/saved/music/', { params: { page_size: 5 } }),
      api.get('explore/saved/talents/', { params: { page_size: 5 } }),
      api.get('community-events/upcoming/', { params: { page_size: 5 } }).catch(() => ({ data: { results: [] } })),
      api.get('activity/feed/', { params: { page_size: 5 } }).catch(() => ({ data: { results: [] } })),
    ]);

    const progress = progressRes.status === 'fulfilled' ? progressRes.value.data : {};
    const wallet = walletRes.status === 'fulfilled' ? walletRes.value.data : {};
    const savedCourses = savedCoursesRes.status === 'fulfilled' ? savedCoursesRes.value.data : {};
    const savedMusic = savedMusicRes.status === 'fulfilled' ? savedMusicRes.value.data : {};
    const savedTalents = savedTalentsRes.status === 'fulfilled' ? savedTalentsRes.value.data : {};
    const events = eventsRes.status === 'fulfilled' ? eventsRes.value.data : {};
    const activity = activityRes.status === 'fulfilled' ? activityRes.value.data : {};

    userCache = {
      progress: {
        total: progress.count || 0,
        courses: (progress.results || []).slice(0, 5).map(p => ({
          course_id: p.course,
          course_title: p.course_title || p.title || 'Course',
          progress_pct: p.progress_percentage || p.progress || 0,
          completed: p.completed || false,
          last_activity: p.last_activity || p.updated_at || null,
        })),
      },
      wallet: {
        balance: wallet.balance || 0,
        lifetime_earned: wallet.lifetime_earned || 0,
        currency: wallet.currency || 'USD',
      },
      saved: {
        courses: savedCourses.count || 0,
        music: savedMusic.count || 0,
        talents: savedTalents.count || 0,
      },
      events: {
        total: events.count || 0,
        upcoming: (events.results || []).slice(0, 3).map(e => ({
          id: e.id,
          title: e.title,
          date: e.date || e.start_date,
          location: e.location,
        })),
      },
      activity: {
        unread: activity.unread_count || 0,
        total: activity.count || 0,
      },
      fetched_at: new Date().toISOString(),
    };

    userCacheKey = user.id;
    userLastFetch = now;
    return userCache;
  } catch (err) {
    console.warn('[ProjectDataEngine] Failed to fetch user data:', err.message);
    return userCache || null;
  }
}

/**
 * Build user-specific context string for the system prompt.
 */
function buildUserContext(userData) {
  if (!userData) return '';
  const lines = [];

  // Learning progress
  const clipU = (s, n = 48) => String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || '');
  if (userData.progress?.courses?.length > 0) {
    lines.push(`USER'S LEARNING PROGRESS:`);
    for (const c of userData.progress.courses) {
      const status = c.completed ? '✅ COMPLETED' : `${c.progress_pct}%`;
      lines.push(`  - "${clipU(c.course_title)}" — ${status}`);
    }
  }

  // Wallet
  if (userData.wallet && (userData.wallet.balance > 0 || userData.wallet.lifetime_earned > 0)) {
    lines.push(`\nUSER'S WALLET: Balance: $${userData.wallet.balance} | Lifetime earned: $${userData.wallet.lifetime_earned}`);
  }

  // Saved items
  if (userData.saved) {
    const parts = [];
    if (userData.saved.courses > 0) parts.push(`${userData.saved.courses} courses`);
    if (userData.saved.music > 0) parts.push(`${userData.saved.music} music tracks`);
    if (userData.saved.talents > 0) parts.push(`${userData.saved.talents} talents`);
    if (parts.length > 0) lines.push(`\nUSER'S SAVED ITEMS: ${parts.join(', ')}`);
  }

  // Upcoming events
  if (userData.events?.upcoming?.length > 0) {
    lines.push(`\nUPCOMING EVENTS:`);
    for (const e of userData.events.upcoming) {
      const date = e.date ? new Date(e.date).toLocaleDateString() : 'TBD';
      lines.push(`  - "${clipU(e.title)}" on ${date}${e.location ? ' @ ' + clipU(e.location, 30) : ''}`);
    }
  }

  // Unread activity
  if (userData.activity?.unread > 0) {
    lines.push(`\nUNREAD ACTIVITY: ${userData.activity.unread} unread notifications`);
  }

  return lines.length > 0
    ? `\n\nUSER'S PERSONAL DATA (auto-fetched at ${userData.fetched_at}):\n${lines.join('\n')}`
    : '';
}

export { fetchUserData, buildUserContext };
