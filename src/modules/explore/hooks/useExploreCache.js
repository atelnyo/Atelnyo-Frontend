/**
 * useExploreCache — localStorage cache pou done Explore + rechèch/filtè.
 *
 * Pwoblèm: lè ou navige soti nan Explore (egzanp: klike sou yon kou → CourseDetail)
 * epi revini, Explore.jsx demount epi remount → tout state reset → 9+ API apèl.
 * Solisyon: cache done yo nan localStorage ak yon TTL 5 minit, epi prezève
 * rechèch/filtè ant navigasyon yo.
 *
 * Konpòtman:
 *   1. Lè monte: li cache nan localStorage → retounen done yo imedyatman
 *   2. Si cache egziste epi li fre (< 5 min): sèvi ak cache a, pa fè fetch
 *   3. Si cache egziste men li vye (> 5 min): sèvi ak cache a, men fè yon
 *      fetch silansye nan background pou rafrechi
 *   4. Si pa gen cache: fè fetch nòmal
 *   5. Tout done ki sot nan API sove nan localStorage apre chak fetch reyisi
 *   6. Rechèch ak filtè prezève nan localStorage tou
 */

const ANON_CACHE_KEY = 'atelnyo_explore_cache_anon';
const SEARCH_STATE_KEY = 'atelnyo_explore_search_state';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minit

// The cache is scoped PER USER (key includes the user id) so one
// visitor's data never bleeds into another's — an anonymous guest and a
// logged-in member each get their own snapshot, and logout→login as a
// different account starts fresh. This is what lets the zero-request
// gate below apply to LOGGED-IN users too: a fresh-at-mount cache was
// necessarily written by the SAME user who is mounting.
const cacheKeyFor = (userId) => (
  userId ? `atelnyo_explore_cache_u${userId}` : ANON_CACHE_KEY
);

/**
 * Retounen done ki nan cache si yo toujou fre (< TTL).
 * Si cache vye, retounen done yo menm si yo vye — men siyal ke nou bezwen rafrechi.
 *
 * @returns {{ data: object|null, isFresh: boolean, isStale: boolean }}
 */
export function readExploreCache(userId) {
  const key = cacheKeyFor(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: null, isFresh: false, isStale: false };

    const cached = JSON.parse(raw);
    const age = Date.now() - (cached._timestamp || 0);
    const isFresh = age < CACHE_TTL_MS;
    const isStale = age >= CACHE_TTL_MS;

    return { data: cached, isFresh, isStale };
  } catch {
    // JSON koronpi — efase epi rekoumanse
    localStorage.removeItem(key);
    return { data: null, isFresh: false, isStale: false };
  }
}

/**
 * Sove tout done Explore nan localStorage.
 * Ajoute yon timestamp pou TTL.
 *
 * @param {object} data - Tout eta Explore (courses, music, talents, etc.)
 * @param {number|null} userId - owner of this snapshot (null = anonymous)
 */
export function writeExploreCache(data, userId) {
  try {
    const payload = { ...data, _timestamp: Date.now() };
    localStorage.setItem(cacheKeyFor(userId), JSON.stringify(payload));
  } catch {
    // localStorage plen oswa pa disponib — pa bloke UI a
  }
}

/**
 * Efase cache Explore la (seulement pou itilizatè sa a).
 *
 * @param {number|null} userId - owner of the snapshot (null = anonymous)
 */
export function clearExploreCache(userId) {
  localStorage.removeItem(cacheKeyFor(userId));
  localStorage.removeItem(SEARCH_STATE_KEY);
}

/**
 * Li eta rechèch/filtè ki prezève nan localStorage.
 *
 * @returns {{ search: string, filter: string }}
 */
export function readSearchState() {
  try {
    const raw = localStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return { search: '', filter: 'all' };
    return JSON.parse(raw);
  } catch {
    return { search: '', filter: 'all' };
  }
}

/**
 * Sove eta rechèch/filtè nan localStorage pou prezève ant navigasyon.
 *
 * @param {string} search - Tèks rechèch la
 * @param {string} filter - Filtè ki seleksyone a (all, courses, music, etc.)
 */
export function writeSearchState(search, filter) {
  try {
    localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ search, filter }));
  } catch {
    // pa bloke UI a
  }
}
