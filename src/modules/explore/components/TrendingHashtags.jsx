/**
 * src/modules/explore/components/TrendingHashtags.jsx
 *
 * "Hashtags ki ap monte" — a ranked chip rail fed by
 * GET /api/search/trending/hashtags/ (Trending Score: velocity +
 * acceleration + engagement + unique creators + geo spread, NOT raw
 * popularity). Rendered above the HomeFeed on the Explore page.
 *
 * Each chip shows the rank, the #tag, and a growth badge
 * (e.g. "+450% / 2h" when the backend reports a growth %).
 * Silent empty state — the rail disappears when nothing is trending
 * or the endpoint is unreachable, so the feed below is never blocked.
 */
import React, { useEffect, useState } from 'react';
import { searchService } from '../../../services/api';
import './TrendingHashtags.css';

// ─── Trending-rail localStorage cache (second-visit zero-request) ─────
// The rail is public + short-lived, so a 5-min snapshot (mirroring the
// explore + feed caches) lets a revisit render it with ZERO requests.
const TRENDING_CACHE_KEY = 'atelnyo_trending_cache';
const TRENDING_CACHE_TTL_MS = 5 * 60 * 1000;

function readTrendingCache() {
  try {
    const raw = localStorage.getItem(TRENDING_CACHE_KEY);
    if (!raw) return { tags: null, isFresh: false };
    const cached = JSON.parse(raw);
    return {
      tags: Array.isArray(cached.tags) ? cached.tags : null,
      isFresh: Date.now() - (cached._timestamp || 0) < TRENDING_CACHE_TTL_MS,
    };
  } catch {
    return { tags: null, isFresh: false };
  }
}

function growthLabel(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const n = Math.round(Number(pct));
  if (n <= 0) return null;
  return `+${n}%`;
}

export default function TrendingHashtags({ lang = 'ht', limit = 8, onSearch }) {
  // Seed state from a fresh cache snapshot (instant paint on revisits).
  // ``isFresh`` alone gates the fetch — an EMPTY trending result (e.g. a
  // fresh install with no interactions) is a valid answer that must also
  // skip the network on a revisit within the 5-min TTL.
  const [tags, setTags] = useState(() => {
    const cached = readTrendingCache();
    return cached.isFresh && cached.tags ? cached.tags.slice(0, limit) : [];
  });
  const [ready, setReady] = useState(() => {
    const cached = readTrendingCache();
    return Boolean(cached.isFresh);
  });

  useEffect(() => {
    // Second-visit zero-request gate: a fresh cached rail (empty or
    // not) renders from localStorage with NO network request.
    // Re-checked per run — StrictMode's dev double-mount sees the same
    // snapshot and skips both times; an expired cache falls through to
    // the fetch.
    const cached = readTrendingCache();
    if (cached.isFresh) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTags(cached.tags ? cached.tags.slice(0, limit) : []);
      setReady(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    setReady(false);
    searchService
      .trendingHashtags({ hours: 24, limit })
      .then((r) => {
        if (cancelled) return;
        const items = Array.isArray(r?.data)
          ? r.data
          : (r?.data?.trending || []);
        const sliced = items.slice(0, limit);
        setTags(sliced);
        // Persist the rail so the next visit within 5 minutes renders
        // it with zero requests (never blocks the UI on storage errors).
        try {
          localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({
            tags: sliced,
            _timestamp: Date.now(),
          }));
        } catch { /* storage full/unavailable */ }
      })
      .catch(() => {
        // Trending is a progressive enhancement — never block Explore.
        if (!cancelled) setTags([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, [limit]);

  if (!ready || tags.length === 0) return null;

  const title = lang === 'ht'
    ? 'Hashtags ki ap monte'
    : 'Rising Hashtags';

  return (
    <div className="tr-trending" aria-label={title}>
      <div className="tr-head">
        <span className="tr-title">
          <i className="fas fa-fire" aria-hidden="true" />
          {title}
        </span>
        <span className="tr-hint">
          {lang === 'ht' ? 'Klike pou chèche' : 'Tap to search'}
        </span>
      </div>
      <div className="tr-rail">
        {tags.map((t, i) => {
          const tagKey = t.key || String(t.tag || '').replace(/^#/, '');
          const growth = growthLabel(t.growth_pct);
          const handleClick = (e) => {
            e.preventDefault();
            onSearch?.(tagKey);
          };
          return (
            <a
              key={tagKey || i}
              className="tr-chip"
              href={`#search-${tagKey}`}
              onClick={handleClick}
              title={t.tag || `#${tagKey}`}
            >
              <span className="tr-rank">{i + 1}</span>
              <span className="tr-tag">{t.tag || `#${tagKey}`}</span>
              {growth && (
                <span className="tr-growth">{growth}</span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
