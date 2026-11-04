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
      postsRes,
    ] = await Promise.allSettled([
      api.get('courses/', { params: { page_size: 10, status: 'published' } }),
      api.get('creator-profiles/', { params: { page_size: 10 } }),
      api.get('explore/music/', { params: { page_size: 5 } }),
      api.get('explore/talents/', { params: { page_size: 5 } }),
      api.get('explore/recommended/jobs/', { params: { page_size: 5 } }),
      api.get('explore/recommended/products/', { params: { page_size: 5 } }),
      api.get('communities/', { params: { page_size: 5 } }),
      // Recent creator posts platform-wide (public). The preview carries
      // the canonical post URL (/c/{username}/post/{slug}) so the chatbot
      // can answer post questions with REAL links instead of guessing.
      api.get('feed/latest/', { params: { limit: 6, content_type: 'post' } }),
    ]);

    const courses = coursesRes.status === 'fulfilled' ? coursesRes.value.data : {};
    const creators = creatorsRes.status === 'fulfilled' ? creatorsRes.value.data : {};
    const music = musicRes.status === 'fulfilled' ? musicRes.value.data : {};
    const talents = talentsRes.status === 'fulfilled' ? talentsRes.value.data : {};
    const jobs = jobsRes.status === 'fulfilled' ? jobsRes.value.data : {};
    const products = productsRes.status === 'fulfilled' ? productsRes.value.data : {};
    const communities = communitiesRes.status === 'fulfilled' ? communitiesRes.value.data : {};
    const latestPosts = postsRes.status === 'fulfilled' ? postsRes.value.data : {};

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
          username: c.username || c.slug,
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
        // Full commerce fields so the chatbot can answer price, stock
        // and "what is it" questions with REAL data + canonical link.
        top: (products.results || []).slice(0, 3).map(p => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description || '',
          price: p.price,
          stock: p.stock ?? null,
          seller: p.user_key || p.seller_username || 'atelnyo',
        })),
      },
      communities: {
        total: communities.count || 0,
        top: (communities.results || []).slice(0, 3).map(c => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          members: c.member_count || 0,
        })),
      },
      posts: {
        total: (latestPosts.results || []).length,
        // Newest creator posts platform-wide. Each carries its REAL
        // canonical URL — the ONLY post links the bot may emit.
        top: (latestPosts.results || []).slice(0, 5).map(r => {
          const p = r.preview || {};
          const author = p.creator_name || '';
          const slug = p.slug || '';
          const url = p.url || (author && slug ? `/c/${author}/post/${slug}` : '');
          return {
            id: p.id ?? r.object_id,
            excerpt: (p.title || p.text || '').slice(0, 120),
            author_username: author,
            slug,
            url,
            published_at: r.published_at || null,
          };
        }).filter(p => p.url),
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

  // Course catalog — every line carries its REAL canonical URL so the
  // bot never has to guess a link.
  if (data.courses?.total > 0) {
    lines.push(`COURSE CATALOG (${data.courses.total} total):`);
    for (const c of data.courses.top) {
      const price = c.price ? `$${c.price}` : 'Free';
      const key = c.slug || c.id;
      const url = `https://atelnyo.site/${encodeURIComponent(key)}/by/${encodeURIComponent(c.creator || 'atelnyo')}/course`;
      lines.push(`  - [${c.id}] "${clip(c.title, 48)}" @${clip(c.creator, 24)} — ${price}\n    Link: ${url}`);
    }
  }

  // Creators
  if (data.creators?.total > 0) {
    lines.push(`\nCREATOR PROFILES (${data.creators.total} total):`);
    for (const c of data.creators.top) {
      const badges = [];
      if (c.is_verified) badges.push('✓');
      if (c.is_featured) badges.push('★');
      const uname = c.username || c.slug;
      lines.push(`  - @${clip(uname, 24)} — ${c.followers} followers, ${c.courses} courses ${badges.join('')}\n    Link: https://atelnyo.site/c/${encodeURIComponent(uname)}`);
    }
  }

  // Recent creator posts — with REAL canonical URLs.
  if (data.posts?.top?.length > 0) {
    lines.push(`\nRECENT CREATOR POSTS (newest first — use these EXACT links when asked about posts):`);
    for (const p of data.posts.top) {
      const when = p.published_at ? new Date(p.published_at).toLocaleDateString() : '';
      lines.push(`  - @${clip(p.author_username, 24)}: "${clip(p.excerpt, 80)}"${when ? ` (${when})` : ''}\n    Link: https://atelnyo.site${p.url}`);
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
    lines.push(`\nTALENT SHOWCASES (${data.talents.total} total):`);
    for (const t of data.talents.top) {
      lines.push(`  - ${clip(t.name, 40)} (${t.category || 'general'})`);
    }
  }

  // Jobs
  if (data.jobs?.total > 0) {
    lines.push(`\nJOB LISTINGS (${data.jobs.total} total):`);
    for (const j of data.jobs.top) {
      lines.push(`  - "${clip(j.title, 48)}" at ${clip(j.company || 'Various', 30)}`);
    }
  }

  // Products — price + stock + short description + REAL canonical link.
  if (data.products?.total > 0) {
    lines.push(`\nMARKETPLACE PRODUCTS (${data.products.total} total):`);
    for (const p of data.products.top) {
      const price = p.price ? `$${p.price}` : 'Free';
      const stock = p.stock == null
        ? 'Available'
        : (Number(p.stock) > 0 ? `${p.stock} in stock` : 'OUT OF STOCK');
      const key = p.slug || p.id;
      const url = `https://atelnyo.site/${encodeURIComponent(key)}/by/${encodeURIComponent(p.seller || 'atelnyo')}/product`;
      const desc = p.description ? `\n    About: ${clip(p.description, 120)}` : '';
      lines.push(`  - "${clip(p.title, 48)}" — ${price} — ${stock}${desc}\n    Link: ${url}`);
    }
  }

  // Communities
  if (data.communities?.total > 0) {
    lines.push(`\nCOMMUNITIES (${data.communities.total} total):`);
    for (const c of data.communities.top) {
      const link = c.slug ? `\n    Link: https://atelnyo.site/community/${encodeURIComponent(c.slug)}` : '';
      lines.push(`  - "${clip(c.name, 40)}" — ${c.members} members${link}`);
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

    // The user's OWN creator posts (best-effort, creators only): my public
    // profile slug, then my newest posts. Gives the bot REAL links to the
    // user's posts so it can answer "my post" questions precisely.
    let myPosts = [];
    const myUsername = user.username || '';
    try {
      const meRes = await api.get('creator-profiles/me/');
      const mySlug = meRes?.data?.slug;
      if (mySlug && myUsername) {
        const postsRes = await api.get(
          `creator-profiles/${encodeURIComponent(mySlug)}/posts/`,
          { params: { page_size: 5 } },
        );
        const rows = Array.isArray(postsRes?.data) ? postsRes.data : (postsRes?.data?.results || []);
        myPosts = rows.slice(0, 5).map(p => ({
          slug: p.slug,
          excerpt: String(p.body || '').slice(0, 120),
          url: `/c/${myUsername}/post/${p.slug}`,
          created_at: p.created_at || null,
        })).filter(p => p.slug);
      }
    } catch { /* not a creator or offline — myPosts stays empty */ }

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
      username: myUsername,
      my_posts: myPosts,
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

  // The user's OWN creator posts — REAL links, newest first.
  if (userData.my_posts?.length > 0) {
    const uname = userData.username || 'you';
    lines.push(`\nUSER'S OWN POSTS (${userData.my_posts.length} newest — these are YOUR posts, @${uname}):`);
    for (const p of userData.my_posts) {
      const date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '';
      lines.push(`  - "${clipU(p.excerpt, 80)}"${date ? ` (${date})` : ''}\n    Link: https://atelnyo.site${p.url}`);
    }
  }

  return lines.length > 0
    ? `\n\nUSER'S PERSONAL DATA (auto-fetched at ${userData.fetched_at}):\n${lines.join('\n')}`
    : '';
}

export { fetchUserData, buildUserContext };
