/**
 * src/components/community/CommunityPosts.jsx
 *
 * /community/:slug/posts — member-authored feed with emoji reactions.
 *
 * Reads { community, lang, t, user, showToast } from the parent
 * <Outlet context> (same contract as the other CommunityDetail tabs)
 * and owns its own list fetch. Reactions update optimistically and
 * roll back on error; posting and deleting patch the local list so
 * the UI never waits on a refetch.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import SEOHead from '../shared/SEOHead';
import api, { communitiesService } from '../../services/api';
import { t as t4 } from '../../utils/i18n';
import { countWithUnit } from '../../utils/plural';
import { resolveVideoSource, youtubeThumbnail } from '../../modules/explore/utils/videoSource';
import VideoEmbedFrame from '../media/VideoEmbedFrame';
import ContentFeedbackMenu from '../shared/ContentFeedbackMenu';
import CommentListSkeleton from './CommentListSkeleton';
import { buildIntroDraft } from './communityOnboarding';
import { POST_MAX_LENGTH, countPostChars } from './postRules';

const POST_FORMS = {
  ht: { one: 'pòs', many: 'pòs' },
  en: { one: 'post', many: 'posts' },
  fr: { one: 'publication', many: 'publications' },
  es: { one: 'publicación', many: 'publicaciones' },
};
const COMMENT_FORMS = {
  ht: { one: 'kòmantè', many: 'kòmantè' },
  en: { one: 'comment', many: 'comments' },
  fr: { one: 'commentaire', many: 'commentaires' },
  es: { one: 'comentario', many: 'comentarios' },
};

// Compose limits mirror CommunityPostSerializer.validate_content:
// 2000 code points, not UTF-16 units (an emoji must count as one).
const DRAFT_MAX = POST_MAX_LENGTH;
const POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// The backend's magic-byte validator accepts MP4 video only (not WebM/MOV),
// so the picker mirrors that exactly instead of offering files it will reject.
const POST_VIDEO_TYPES = ['video/mp4'];
const POST_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const DRAFT_MAX_HEIGHT = 220;

/** Only http(s) links with a hostname — blocks javascript:, data:, etc. */
function normalizeHttpUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
    ? value
    : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!url.hostname || !url.hostname.includes('.')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/** Post body with real clickable http(s) links and safe wrapping. */
function PostContent({ content }) {
  const text = String(content || '');
  if (!text.trim()) return null;
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return (
    <p className="c-post-content">
      {parts.map((part, index) => {
        if (!/^https?:\/\//i.test(part)) {
          return <React.Fragment key={index}>{part}</React.Fragment>;
        }
        const href = part.replace(/[.,;:!?)\]]+$/, '');
        const trailing = part.slice(href.length);
        return (
          <React.Fragment key={index}>
            <a href={href} target="_blank" rel="noopener noreferrer">{href}</a>
            {trailing}
          </React.Fragment>
        );
      })}
    </p>
  );
}

function visibilityHint(lang, joinMode, readVisibility) {
  if (readVisibility === 'members') {
    return t4(
      lang,
      'Sèlman manm aktif yo ka li pòs sa a.',
      'Only active members can read this post.',
      'Seuls les membres actifs peuvent lire cette publication.',
      'Solo los miembros activos pueden leer esta publicación.',
    );
  }
  if (joinMode === 'approval') {
    return t4(
      lang,
      'Tout moun ka li pòs sa a. Pou antre nan kominote a, apwobasyon nesesè.',
      'Anyone can read this post. Joining this community requires approval.',
      'Tout le monde peut lire cette publication. L’adhésion nécessite une approbation.',
      'Cualquiera puede leer esta publicación. Unirse requiere aprobación.',
    );
  }
  if (joinMode === 'invite') {
    return t4(
      lang,
      'Tout moun ka li pòs sa a. Se sèlman manm yo ki ka pibliye.',
      'Anyone can read this post. Only members can publish.',
      'Tout le monde peut lire cette publication. Seuls les membres peuvent publier.',
      'Cualquiera puede leer esta publicación. Solo los miembros pueden publicar.',
    );
  }
  return t4(
    lang,
    'Pòs sa a vizib pou tout moun.',
    'This post is visible to everyone.',
    'Cette publication est visible par tous.',
    'Esta publicación es visible para todos.',
  );
}

/** First playable video URL inside a post body (YouTube/Vimeo/direct file), or '' — same resolver as Music. */
function firstVideoUrl(text) {
  if (!text || typeof text !== 'string') return '';
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const raw of urls) {
    const u = raw.replace(/[.,;:!?)\]}]+$/, '');
    if (u && resolveVideoSource(u)) return u;
  }
  return '';
}

/** First non-video http(s) URL in a text, or '' — used for generic link unfurl. */
function firstGenericLinkUrl(text) {
  if (!text || typeof text !== 'string') return '';
  const urls = text.match(/https?:\/\/[^\s)]+/gi) || [];
  for (const raw of urls) {
    const u = raw.replace(/[.,;:!?]+$/, '');
    if (!u) continue;
    try {
      const scheme = new URL(u).protocol;
      if (scheme !== 'http:' && scheme !== 'https:') continue;
    } catch { continue; }
    if (resolveVideoSource(u)) continue;
    return u;
  }
  return '';
}

/** In-memory preview cache + in-flight dedup — avoids refetching the same link while typing/scrolling. */
const _previewCache = new Map();
const _previewInflight = new Map();
function fetchLinkPreview(url) {
  if (_previewCache.has(url)) return Promise.resolve(_previewCache.get(url));
  if (_previewInflight.has(url)) return _previewInflight.get(url);
  const p = api.get(`link-preview/?url=${encodeURIComponent(url)}`, { timeout: 15000 })
    .then((r) => {
      const data = r?.data || null;
      // Cache only usable cards (skip detail/error payloads).
      if (data && (data.title || data.description || data.image)) _previewCache.set(url, data);
      return data;
    })
    .catch(() => null)
    .finally(() => { _previewInflight.delete(url); });
  _previewInflight.set(url, p);
  if (_previewCache.size > 200) { const k = _previewCache.keys().next().value; _previewCache.delete(k); }
  return p;
}

/** Generic link preview card (og:title / og:description / og:image via /api/link-preview/).
 * Debounced 500ms so typing a link doesn't fire one request per keystroke. */
function LinkPreviewCard({ url }) {
  const [meta, setMeta] = useState(() => (_previewCache.get(url) || null));
  const [loading, setLoading] = useState(() => (!_previewCache.has(url) && Boolean(url)));
  useEffect(() => {
    if (!url) return;
    if (_previewCache.has(url)) { setMeta(_previewCache.get(url)); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchLinkPreview(url)
        .then((data) => { if (!cancelled && data) setMeta(data); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [url]);
  if (!url) return null;
  if (loading) {
    return (
      <div style={{ marginTop: 8, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, height: 72, background: 'var(--surface-highlight, #f8fafc)' }} data-testid="link-preview-loading" />
    );
  }
  // Fetch failed (WhatsApp/Facebook login walls, offline host...): still
  // render a minimal tappable card so every pasted link shows something.
  if (!meta || (!meta.title && !meta.description && !meta.image)) {
    let domain = '';
    try { domain = new URL(url).hostname; } catch { domain = ''; }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 8, overflow: 'hidden', textDecoration: 'none', color: 'inherit', background: 'var(--surface-highlight, #fff)', padding: '8px 10px' }}
        data-testid="link-preview-card">
        <span style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-highlight, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true"><i className="fas fa-link" /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          {domain && <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>{domain}</span>}
          <span style={{ display: 'block', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span>
        </span>
        <span style={{ opacity: 0.5 }} aria-hidden="true"><i className="fas fa-external-link-alt" /></span>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ marginTop: 8, display: 'flex', gap: 10, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, overflow: 'hidden', textDecoration: 'none', color: 'inherit', background: 'var(--surface-highlight, #fff)' }}
      data-testid="link-preview-card">
      {meta.image && (
        <img src={meta.image} alt="" loading="lazy" style={{ width: 96, height: 72, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <span style={{ padding: '8px 10px 8px 0', minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.6 }}>{meta.domain || (() => { try { return new URL(url).hostname; } catch { return ''; } })()}</span>
        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.title || url}</span>
        {meta.description && (
          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.72rem', opacity: 0.75, lineHeight: 1.4 }}>{meta.description}</span>
        )}
      </span>
      <span style={{ alignSelf: 'center', paddingRight: 10, opacity: 0.5 }} aria-hidden="true"><i className="fas fa-external-link-alt" /></span>
    </a>
  );
}

/** Inline poll ballot for a post (single/multiple choice, live bars). */
function PostPoll({ post, lang, user, onVoted, showToast }) {
  const opts = Array.isArray(post.poll_options) ? post.poll_options : [];
  const total = opts.reduce((s, o) => s + (Number(o?.votes) || 0), 0);
  const myVote = Array.isArray(post.poll_user_vote) ? post.poll_user_vote : [];
  const [picked, setPicked] = useState(myVote);
  const [voting, setVoting] = useState(false);
  useEffect(() => { setPicked(Array.isArray(post.poll_user_vote) ? post.poll_user_vote : []); }, [post.id, JSON.stringify(post.poll_user_vote)]);
  if (!post.poll_question || opts.length < 2) return null;
  const expired = post.poll_expires_at ? new Date(post.poll_expires_at) <= new Date() : false;
  const hasVoted = myVote.length > 0;
  const showBars = hasVoted || expired;
  function toggle(i) {
    if (hasVoted || expired || voting) return;
    if (post.poll_allow_multiple) {
      setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].slice(0, 10)));
    } else {
      setPicked([i]);
    }
  }
  async function submit() {
    if (!user) { showToast?.(t4(lang, 'Konekte pou w vote', 'Sign in to vote', 'Connectez-vous pour voter', 'Inicia sesión para votar'), 'user-lock'); return; }
    if (picked.length === 0 || voting || hasVoted || expired) return;
    setVoting(true);
    try {
      const res = await communitiesService.votePoll(post.id, picked);
      if (res?.data?.id) onVoted?.(res.data);
    } catch (err) {
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka vote.', 'Could not vote.', 'Vote impossible.', 'No se pudo votar.'), 'circle-exclamation');
    } finally { setVoting(false); }
  }
  return (
    <div style={{ marginTop: 8, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 10, background: 'var(--surface-highlight, #fff)' }} data-testid={`post-poll-${post.id}`}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}><i className="fas fa-chart-bar" aria-hidden="true" style={{ marginRight: 6 }} />{post.poll_question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map((o, i) => {
          const votes = Number(o?.votes) || 0;
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
          const active = picked.includes(i);
          if (!showBars) {
            return (
              <button key={i} type="button" onClick={() => toggle(i)} data-testid={`post-poll-opt-${post.id}-${i}`} aria-pressed={active}
                style={{ textAlign: 'left', border: active ? '2px solid #7c3aed' : '1px solid var(--border-color, #cbd5e1)', background: active ? '#f5f3ff' : '#fff', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: '0.82rem' }}>
                {post.poll_allow_multiple ? (active ? '☑ ' : '☐ ') : (active ? '● ' : '○ ')}{o?.text}
              </button>
            );
          }
          return (
            <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: active ? '2px solid #7c3aed' : '1px solid var(--border-color, #e2e8f0)', background: '#fff' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: active ? '#ddd6fe' : '#f1f5f9' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', fontSize: '0.82rem', fontWeight: active ? 700 : 400 }}>
                <span>{o?.text}</span><span>{votes} · {pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.75rem', opacity: 0.8 }}>
        <span data-testid={`post-poll-total-${post.id}`}>{total} {t4(lang, 'vòt', 'votes', 'votes', 'votos')}</span>
        {expired && <span>· {t4(lang, 'Sondaj fini', 'Poll ended', 'Sondage terminé', 'Encuesta terminada')}</span>}
        {post.poll_allow_multiple && !expired && !hasVoted && <span>· {t4(lang, 'Chwazi plizyè', 'Multiple choice', 'Choix multiple', 'Opción múltiple')}</span>}
        {!hasVoted && !expired && (
          <button type="button" onClick={submit} disabled={picked.length === 0 || voting} data-testid={`post-poll-vote-${post.id}`}
            style={{ marginLeft: 'auto', borderRadius: 20, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>
            {voting ? '...' : t4(lang, 'Vòte', 'Vote', 'Voter', 'Votar')}
          </button>
        )}
      </div>
    </div>
  );
}

function videoProviderName(url) {
  const source = resolveVideoSource(url);
  if (source?.provider === 'youtube') return 'YouTube';
  if (source?.provider === 'vimeo') return 'Vimeo';
  if (source?.provider === 'facebook') return 'Facebook';
  if (source?.provider === 'tiktok') return 'TikTok';
  if (source?.kind === 'file') return 'Video';
  return '';
}

/** Rich YouTube/Vimeo card shown while drafting a post. */
function ComposerVideoLink({ url, lang }) {
  const source = resolveVideoSource(url);
  if (!source) return null;
  const thumb = youtubeThumbnail(url);
  const provider = videoProviderName(url);
  const icon = source.provider === 'youtube'
    ? 'fab fa-youtube'
    : source.provider === 'vimeo'
      ? 'fab fa-vimeo-v'
      : 'fas fa-play-circle';
  return (
    <div className="c-post-composer-video-link" data-testid="post-composer-video-thumb">
      {thumb
        ? <img src={thumb} alt="" loading="lazy" />
        : <span className="c-video-link-thumb" aria-hidden="true"><i className={icon} /></span>}
      <div className="c-post-composer-video-link-body">
        <span className="c-post-composer-video-link-provider">
          {provider || t4(lang, 'Videyo', 'Video', 'Vidéo', 'Video')}
        </span>
        <VideoTitleLink url={url} />
      </div>
    </div>
  );
}

/** Clickable video title (YouTube/Vimeo/...): fetches the real title via
 * /api/link-preview/ (oEmbed server-side) so a pasted video shows more
 * than a bare thumbnail — and the link opens the source on tap. */
function VideoTitleLink({ url }) {
  const [meta, setMeta] = useState(() => (_previewCache.get(url) || null));
  const [loading, setLoading] = useState(() => (!_previewCache.has(url) && Boolean(url)));
  useEffect(() => {
    if (!url) return;
    if (_previewCache.has(url)) { setMeta(_previewCache.get(url)); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchLinkPreview(url)
        .then((data) => { if (!cancelled && data) setMeta(data); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [url]);
  if (!url) return null;
  let domain = '';
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
  const title = meta?.title && meta.title !== meta?.domain ? meta.title : null;
  const source = resolveVideoSource(url);
  const provider = videoProviderName(url);
  const icon = source?.provider === 'youtube'
    ? 'fab fa-youtube'
    : source?.provider === 'vimeo'
      ? 'fab fa-vimeo-v'
      : 'fas fa-play-circle';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" data-testid="video-title-link"
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>
      <i className={icon} aria-hidden="true" style={{ color: '#e11d48' }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loading ? '...' : (title || domain || url)}</span>
      {domain && <span style={{ fontWeight: 400, fontSize: '0.7rem', opacity: 0.6 }}>{provider || domain}</span>}
      <i className="fas fa-external-link-alt" aria-hidden="true" style={{ fontSize: '0.7rem', opacity: 0.5 }} />
    </a>
  );
}

const REACTION_EMOJIS = ['❤️', '👍', '🎉', '😮', '😢'];

function PostSkeleton() {
  return (
    <div className="c-post-card c-post-skeleton" aria-hidden="true">
      <div className="c-post-skeleton-line c-post-skeleton-line--head" />
      <div className="c-post-skeleton-line" />
      <div className="c-post-skeleton-line c-post-skeleton-line--short" />
      <div className="c-post-skeleton-reactions">
        <span className="c-post-skeleton-pill" />
        <span className="c-post-skeleton-pill" />
        <span className="c-post-skeleton-pill" />
      </div>
    </div>
  );
}

function postLocale(lang) {
  return lang === 'ht' ? 'fr-HT' : lang === 'fr' ? 'fr' : lang === 'es' ? 'es' : 'en';
}

/** Full timestamp for the tooltip / screen readers. */
function formatPostTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    // A post from a previous year must not read as if it were this year:
    // "Mar 5, 2:30 PM" is ambiguous in a feed that mixes old and new posts.
    return d.toLocaleString(postLocale(lang), {
      ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

/** Compact relative timestamp; falls back to an absolute date for old posts. */
function formatRelativePostTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  try {
    const rtf = new Intl.RelativeTimeFormat(postLocale(lang), { numeric: 'auto' });
    if (abs < 60_000) return rtf.format(Math.round(diffMs / 1000), 'second');
    if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
    if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
    if (abs < 7 * 86_400_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  } catch { /* older engines — use the absolute date */ }
  return formatPostTime(iso, lang);
}

export default function CommunityPosts() {
  const { community, lang = 'en', user, showToast, onPostCountChange } = useOutletContext();
  // /community/:slug/posts/:postId — the same feed serves as the post
  // permalink: the requested post is pinned to the top, highlighted and
  // gets its own OG/canonical tags.
  const { postId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const permalinkId = /^\d+$/.test(postId || '') ? Number(postId) : null;
  const [focusedPost, setFocusedPost] = useState(null);
  const [focusMissing, setFocusMissing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageError, setImageError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState('');
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [composerNode, setComposerNode] = useState(null);
  const draftInputRef = useRef(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const draftLength = countPostChars(draft);

  function focusDraft() { try { draftInputRef.current?.focus(); } catch { /* noop */ } }

  function appendLinkToDraft(raw) {
    const url = normalizeHttpUrl(raw);
    if (!url) {
      setLinkError(t4(
        lang,
        'Antre yon lyen http(s) valab, pa egzanp https://atelnyo.site.',
        'Enter a valid http(s) link, for example https://atelnyo.site.',
        'Entrez un lien http(s) valide, par exemple https://atelnyo.site.',
        'Introduce un enlace http(s) válido, por ejemplo https://atelnyo.site.',
      ));
      return;
    }
    setLinkError('');
    setDraft((current) => {
      const next = current && !current.endsWith('\n')
        ? `${current}\n${url}`
        : `${current || ''}${url}`;
      return countPostChars(next) <= DRAFT_MAX ? next : current;
    });
    setLinkValue('');
    setShowLinkInput(false);
    focusDraft();
  }

  function insertEmoji(emoji) {
    const input = draftInputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    if (countPostChars(next) > DRAFT_MAX) return;
    setDraft(next);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      try {
        input?.focus();
        input?.setSelectionRange(start + emoji.length, start + emoji.length);
      } catch { /* noop */ }
    });
  }

  // ── Poll composer state ──────────────────────────────────
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

  function resetPollCreator() {
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollAllowMultiple(false);
  }

  function pollPayload() {
    const q = pollQuestion.trim();
    if (!showPollCreator || !q) return {};
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean).slice(0, 10);
    if (opts.length < 2) return { __invalid: true };
    return {
      poll_question: q.slice(0, 300),
      poll_options: opts.map((text) => ({ text, votes: 0 })),
      poll_allow_multiple: pollAllowMultiple,
    };
  }

  const canPublish = Boolean(
    draft.trim()
    || imageUrl
    || videoUrl
    || (showPollCreator && pollQuestion.trim() && pollOptions.filter((option) => option.trim()).length >= 2),
  );

  async function handlePickImage(file) {
    if (!file) return;
    setImageError('');
    if (!POST_IMAGE_TYPES.includes(file.type)) {
      setImageError(t4(
        lang,
        'Fòma imaj la pa sipòte. Sèvi ak JPG, PNG, WEBP oswa GIF.',
        'Unsupported image format. Use JPG, PNG, WEBP or GIF.',
        'Format d’image non pris en charge. Utilisez JPG, PNG, WEBP ou GIF.',
        'Formato de imagen no compatible. Usa JPG, PNG, WEBP o GIF.',
      ));
      return;
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      setImageError(t4(
        lang,
        'Imaj la twò gwo (maksimòm 10 MB).',
        'Image is too large (10 MB maximum).',
        'Image trop volumineuse (10 Mo maximum).',
        'La imagen es demasiado grande (máximo 10 MB).',
      ));
      return;
    }
    setUploadingImage(true);
    setUploadProgress(0);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      const res = await api.post(
        'media/upload/',
        { file: base64, kind: 'image', filename: file.name || 'post-image' },
        {
          onUploadProgress: (event) => {
            if (!event?.total) return;
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          },
        },
      );
      if (!res?.data?.url) throw new Error('missing_url');
      setImageUrl(res.data.url);
      setVideoUrl('');
      setVideoError('');
      setVideoProgress(0);
      setUploadProgress(100);
    } catch (err) {
      setUploadProgress(0);
      setImageError(
        err?.response?.data?.error
        || t4(lang, 'Erè nan telechaje imaj.', 'Image upload failed.', 'Échec du téléversement.', 'Falló la subida.'),
      );
    } finally {
      setUploadingImage(false);
    }
  }
  async function handlePickVideo(file) {
    if (!file) return;
    setVideoError('');
    const isMp4 = POST_VIDEO_TYPES.includes(file.type) || /\.mp4$/i.test(file.name || '');
    if (!isMp4) {
      setVideoError(t4(
        lang,
        'Fòma videyo a pa sipòte. Sèvi ak MP4.',
        'Unsupported video format. Use MP4.',
        'Format vidéo non pris en charge. Utilisez MP4.',
        'Formato de video no compatible. Usa MP4.',
      ));
      return;
    }
    if (file.size > POST_VIDEO_MAX_BYTES) {
      setVideoError(t4(
        lang,
        'Videyo a twò gwo (maksimòm 50 MB).',
        'Video is too large (50 MB maximum).',
        'Vidéo trop volumineuse (50 Mo maximum).',
        'El video es demasiado grande (máximo 50 MB).',
      ));
      return;
    }
    setUploadingVideo(true);
    setVideoProgress(0);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });
      const res = await api.post(
        'media/upload/',
        { file: base64, kind: 'video', filename: file.name || 'post-video.mp4' },
        {
          onUploadProgress: (event) => {
            if (!event?.total) return;
            setVideoProgress(Math.round((event.loaded / event.total) * 100));
          },
        },
      );
      if (!res?.data?.url) throw new Error('missing_url');
      setVideoUrl(res.data.url);
      setImageUrl('');
      setImageError('');
      setUploadProgress(0);
      setVideoProgress(100);
    } catch (err) {
      setVideoProgress(0);
      setVideoError(
        err?.response?.data?.error
        || t4(lang, 'Erè nan telechaje videyo.', 'Video upload failed.', 'Échec du téléversement de la vidéo.', 'Falló la subida del video.'),
      );
    } finally {
      setUploadingVideo(false);
    }
  }

  const [reacting, setReacting] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentLists, setCommentLists] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [sendingComment, setSendingComment] = useState({});

  const slug = community?.slug;
  const isMember = Boolean(community?.is_member);
  const myRole = community?.current_user_role;
  const canModerate = ['owner', 'admin', 'moderator'].includes(myRole);

  // The welcome checklist sends new members here with ?compose=intro:
  // rather than facing an empty box, they get a three-question draft they
  // can rewrite. The param is consumed so a reload does not refill a
  // draft they already edited or cleared.
  useEffect(() => {
    if (!isMember || searchParams.get('compose') !== 'intro') return undefined;
    setDraft((current) => current || buildIntroDraft(community, user, lang));
    const focusTimer = setTimeout(() => { try { draftInputRef.current?.focus(); } catch { /* noop */ } }, 60);
    const next = new URLSearchParams(searchParams);
    next.delete('compose');
    setSearchParams(next, { replace: true });
    showToast?.(
      t4(lang, 'Nou mete yon kòmansman pou ou — chanje l jan w vle.', 'We drafted a starting point — edit it however you like.', 'Nous avons préparé un brouillon — modifiez-le librement.'),
      'wand-magic-sparkles',
    );
    return () => clearTimeout(focusTimer);
  }, [searchParams, isMember, community, user, lang, setSearchParams, showToast]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [searching, setSearching] = useState(false);
  const loadedSlugRef = useRef(null);

  // Debounce search typing 400ms so one request per query, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Keep the query in the URL so a permalink/back navigation does not
  // silently drop the user's search context.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (search) next.set('q', search);
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [search, searchParams, setSearchParams]);

  // Browser back/forward restores ?q= into the field as well.
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchInput((current) => (current === q ? current : q));
  }, [searchParams]);

  const load = useCallback(() => {
    if (!slug) return;
    let cancelled = false;
    // A new community needs the full skeleton; a search inside the same
    // community keeps the search field and existing feed visible while
    // the new results arrive.
    const slugChanged = loadedSlugRef.current !== slug;
    if (slugChanged) setLoading(true);
    else setSearching(true);
    setPage(1);
    setFocusMissing(false);
    // A permalink can point at an old post that isn't on page 1, so fetch
    // it directly and merge it into the list instead of hoping it appears.
    const focusReq = permalinkId
      ? communitiesService.getPost(permalinkId).catch((err) => {
        if (!cancelled && err?.response?.status === 404) setFocusMissing(true);
        return null;
      })
      : Promise.resolve(null);
    Promise.all([
      communitiesService.posts(slug, { page: 1, ...(search ? { search } : {}) }),
      focusReq,
    ])
      .then(([r, focusRes]) => {
        if (cancelled) return;
        const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        const count = Array.isArray(r?.data) ? r.data.length : (r?.data?.count ?? data.length);
        const next = Array.isArray(r?.data) ? null : (r?.data?.next || null);
        const focusData = focusRes?.data;
        const focusPost = focusData && String(focusData.community_slug) === String(slug)
          ? focusData
          : null;
        // A post from another community must never render under this
        // slug, even if someone hand-crafts the URL.
        if (focusData && !focusPost) setFocusMissing(true);
        setFocusedPost(focusPost);
        setPosts(focusPost
          ? [focusPost, ...data.filter((p) => p.id !== focusPost.id)]
          : data);
        setTotalCount(count);
        // next URL from DRF, or heuristic: full page => probably more.
        setHasMore(Boolean(next) || data.length >= 20);
      })
      .catch(() => { /* silent — empty state covers failure */ })
      .finally(() => {
        if (!cancelled) {
          loadedSlugRef.current = slug;
          setLoading(false);
          setSearching(false);
        }
      });
    return () => { cancelled = true; };
  }, [slug, search, permalinkId]);

  // Bring the shared post into view once it is actually painted.
  useEffect(() => {
    if (!permalinkId || loading) return;
    const el = document.querySelector(`[data-testid="community-post-${permalinkId}"]`);
    try { el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); } catch { /* jsdom */ }
  }, [permalinkId, loading, posts.length]);

  async function handleShare(post) {
    const url = `${window.location.origin}/community/${encodeURIComponent(slug)}/posts/${post.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Clipboard API needs HTTPS; the local/dev HTTP build still
        // needs a working share button.
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast?.(t4(lang, 'Lyen pòs la kopye.', 'Post link copied.', 'Lien de la publication copié.', 'Enlace de la publicación copiado.'), 'link');
    } catch {
      showToast?.(t4(lang, 'Pa t kapab kopye lyen an.', 'Could not copy the link.', 'Impossible de copier le lien.', 'No se pudo copiar el enlace.'), 'circle-exclamation');
    }
  }

  useEffect(() => load(), [load]);

  // Auto-grow the editor with its content; scroll internally past the
  // cap instead of reserving a tall empty box or showing a resize handle.
  useEffect(() => {
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const next = Math.min(input.scrollHeight || 0, DRAFT_MAX_HEIGHT);
    input.style.height = `${next}px`;
    input.style.overflowY = (input.scrollHeight || 0) > DRAFT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [draft]);

  // The global assistant FAB is fixed on mobile; hide it while the
  // composer is focused so it can never cover the editor or publish row.
  useEffect(() => {
    if (!composerFocused) return undefined;
    document.body.classList.add('community-composing');
    return () => document.body.classList.remove('community-composing');
  }, [composerFocused]);

  // Stronger FAB protection: on mobile, keep the global assistant hidden
  // whenever any part of the composer is visible in the viewport — not just
  // while a field has focus. Scrolling past the composer restores the FAB,
  // so the assistant remains available across the rest of the community.
  useEffect(() => {
    const node = composerNode;
    if (!node || !isMember || typeof window === 'undefined') return undefined;
    if (typeof IntersectionObserver === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(max-width: 768px)');
    let observer = null;

    const disconnect = () => {
      if (observer) observer.disconnect();
      observer = null;
      document.body.classList.remove('community-composer-visible');
    };

    const sync = () => {
      disconnect();
      if (!media.matches) return;
      observer = new IntersectionObserver((entries) => {
        document.body.classList.toggle(
          'community-composer-visible',
          entries.some((entry) => entry.isIntersecting),
        );
      }, { threshold: 0.01 });
      observer.observe(node);
    };

    sync();
    media.addEventListener?.('change', sync);
    return () => {
      disconnect();
      media.removeEventListener?.('change', sync);
    };
  }, [composerNode, isMember, permalinkId]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const r = await communitiesService.posts(slug, { page: nextPage, ...(search ? { search } : {}) });
      const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
      const next = Array.isArray(r?.data) ? null : (r?.data?.next || null);
      if (data.length === 0) { setHasMore(false); return; }
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !seen.has(p.id))];
      });
      setPage(nextPage);
      setHasMore(Boolean(next) || data.length >= 20);
    } catch { /* silent — button stays so user can retry */ }
    finally { setLoadingMore(false); }
  }

  async function handlePublish(e) {
    e?.preventDefault?.();
    if (publishing) return;
    const content = draft.trim();
    const poll = pollPayload();
    const hasPoll = Boolean(poll.poll_question);
    if (!content && !imageUrl && !videoUrl && !hasPoll) return;
    if (!user) {
      showToast?.(t4(lang, 'Konekte pou w pibliye', 'Sign in to publish', 'Connectez-vous pour publier', 'Inicia sesión para publicar'), 'user-lock');
      return;
    }
    if (poll.__invalid) {
      showToast?.(t4(lang, 'Sondaj bezwen yon kesyon + omwen 2 opsyon.', 'A poll needs a question + at least 2 options.', 'Un sondage exige une question + 2 options.', 'Una encuesta necesita pregunta + 2 opciones.'), 'circle-exclamation');
      return;
    }
    setPublishing(true);
    try {
      // A YouTube link already carries artwork — reuse its thumbnail when
      // the user didn't attach a photo or a native video.
      const autoThumb = !imageUrl && !videoUrl ? youtubeThumbnail(firstVideoUrl(content)) : '';
      const finalImage = imageUrl || autoThumb;
      const base = {
        content,
        ...(finalImage ? { image_url: finalImage } : {}),
        ...(videoUrl ? { video_url: videoUrl } : {}),
      };
      const payload = { ...base, ...poll };
      const res = await communitiesService.createPost(slug, payload);
      const created = res?.data?.id ? res.data : null;
      if (!created) throw new Error('publish_failed');
      // Backend order is pinned-first then newest: insert the new post
      // right after the pinned block so epengle posts never move.
      setPosts((prev) => {
        const rest = prev.filter((p) => p.id !== created.id);
        const idx = rest.findIndex((p) => !p.is_pinned);
        if (created.is_pinned || idx === -1) return [created, ...rest];
        return [...rest.slice(0, idx), created, ...rest.slice(idx)];
      });
      setTotalCount((c) => c + 1);
      onPostCountChange?.(1);
      // A search-filtered feed must not keep showing a post that may not
      // match the query. Return to the normal feed after publishing.
      if (search) { setSearchInput(''); setSearch(''); }
      // Clear only after the server confirmed the row — a failed publish
      // keeps the user's text and attachment intact.
      setDraft('');
      setImageUrl('');
      setImageError('');
      setUploadProgress(0);
      setVideoUrl('');
      setVideoError('');
      setVideoProgress(0);
      setLinkError('');
      setDraftError('');
      setShowEmoji(false);
      resetPollCreator();
      setComposerFocused(false);
      showToast?.(t4(lang, 'Pòs pibliye!', 'Post published!', 'Publication réussie !', '¡Publicación exitosa!'), 'check-circle');
    } catch (err) {
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka pibliye.', 'Could not publish.', 'Publication impossible.', 'No se pudo publicar.'), 'circle-exclamation');
    } finally {
      setPublishing(false);
    }
  }

  async function handleReact(post, emoji) {
    if (reacting[post.id]) return;
    if (!user) {
      showToast?.(t4(lang, 'Konekte pou w reyaji', 'Sign in to react', 'Connectez-vous pour réagir', 'Inicia sesión para reaccionar'), 'user-lock');
      return;
    }
    const prev = posts;
    const had = post.my_reaction === emoji;
    // Optimistic toggle: same emoji removes, different one swaps.
    const nextReactions = { ...(post.reactions || {}) };
    if (post.my_reaction) {
      nextReactions[post.my_reaction] = Math.max(0, (nextReactions[post.my_reaction] || 1) - 1);
      if (nextReactions[post.my_reaction] === 0) delete nextReactions[post.my_reaction];
    }
    // The selected emoji itself must appear optimistically too — not just
    // the total counter — so the tapped pill immediately shows its count.
    if (!had) {
      nextReactions[emoji] = (nextReactions[emoji] || 0) + 1;
    }
    // Same emoji → count drops by 1; swap → count unchanged; fresh → +1.
    const nextCount = Math.max(0, (post.reaction_count || 0) + (had ? -1 : (post.my_reaction ? 0 : 1)));
    setPosts((list) => list.map((p) => (p.id === post.id
      ? { ...p, my_reaction: had ? null : emoji, reactions: nextReactions, reaction_count: Math.max(0, nextCount) }
      : p)));
    setReacting((m) => ({ ...m, [post.id]: true }));
    try {
      const res = await communitiesService.reactToPost(post.id, emoji);
      if (res?.data?.id) {
        setPosts((list) => list.map((p) => (p.id === post.id ? res.data : p)));
      }
    } catch (err) {
      setPosts(prev); // roll back the optimistic flip
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka reyaji.', 'Could not react.', 'Réaction impossible.', 'No se pudo reaccionar.'), 'circle-exclamation');
    } finally {
      setReacting((m) => ({ ...m, [post.id]: false }));
    }
  }

  async function handleDelete(post) {
    if (deletingId) return;
    if (!window.confirm(t4(lang, 'Efase pòs sa a?', 'Delete this post?', 'Supprimer cette publication ?', '¿Eliminar esta publicación?'))) return;
    const prev = posts;
    setDeletingId(post.id);
    setPosts((list) => list.filter((p) => p.id !== post.id));
    try {
      await communitiesService.deletePost(post.id);
      setTotalCount((c) => Math.max(0, c - 1));
      onPostCountChange?.(-1);
      setFocusedPost((current) => (current && current.id === post.id ? null : current));
      showToast?.(t4(lang, 'Pòs efase.', 'Post deleted.', 'Publication supprimée.', 'Publicación eliminada.'), 'trash');
    } catch (err) {
      setPosts(prev);
      showToast?.(err?.response?.data?.detail || t4(lang, 'Pa t kapab efase.', 'Could not delete.', 'Suppression impossible.', 'No se pudo eliminar.'), 'circle-exclamation');
    } finally {
      setDeletingId(null);
    }
  }

  function isPostAuthor(post) {
    return Boolean(user && (user.id === post.author || user.username === post.author_username));
  }

  function canEdit(post) {
    return isPostAuthor(post);
  }

  function canDelete(post) {
    if (!user) return false;
    return canModerate || isPostAuthor(post);
  }

  function postActionsFor(post) {
    const actions = [];
    if (canModerate) {
      actions.push({
        key: 'pin',
        label: post.is_pinned
          ? t4(lang, 'Retire epeng', 'Unpin post', 'Désépingler', 'Quitar fijado')
          : t4(lang, 'Epengle pòs', 'Pin post', 'Épingler', 'Fijar publicación'),
        icon: 'fa-thumbtack',
        onSelect: () => handleTogglePin(post),
        testId: `post-pin-${post.id}`,
      });
    }
    if (canEdit(post)) {
      actions.push({
        key: 'edit',
        label: t4(lang, 'Modifye pòs', 'Edit post', 'Modifier', 'Editar'),
        icon: 'fa-pen',
        onSelect: () => startEdit(post),
        testId: `post-edit-${post.id}`,
      });
    }
    if (canDelete(post)) {
      actions.push({
        key: 'delete',
        label: t4(lang, 'Efase', 'Delete', 'Supprimer', 'Eliminar'),
        icon: 'fa-trash',
        danger: true,
        disabled: deletingId === post.id,
        onSelect: () => handleDelete(post),
        testId: `post-delete-${post.id}`,
      });
    }
    return actions;
  }

  function startEdit(post) {
    setEditingId(post.id);
    setEditDraft(post.content || '');
  }

  async function handleSaveEdit(post) {
    const content = editDraft.trim();
    const hasMedia = Boolean(post.image_url || post.video_url || post.poll_question);
    if ((!content && !hasMedia) || editSaving) return;
    if (countPostChars(content) > DRAFT_MAX) return;
    setEditSaving(true);
    try {
      const res = await communitiesService.updatePost(post.id, { content });
      if (!res?.data?.id) throw new Error('edit_failed');
      setPosts((list) => list.map((p) => (p.id === post.id ? res.data : p)));
      setEditingId(null);
      setEditDraft('');
      showToast?.(t4(lang, 'Pòs ajoune.', 'Post updated.', 'Publication mise à jour.', 'Publicación actualizada.'), 'check-circle');
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail
        || t4(lang, 'Pa t kapab ajoune pòs la.', 'Could not update the post.', 'Impossible de mettre à jour.', 'No se pudo actualizar.'),
        'circle-exclamation',
      );
    } finally {
      setEditSaving(false);
    }
  }

  async function handleTogglePin(post) {
    try {
      const res = await communitiesService.updatePost(post.id, { is_pinned: !post.is_pinned });
      if (!res?.data?.id) throw new Error('pin_failed');
      setPosts((list) => list.map((p) => (p.id === post.id ? res.data : p)));
    } catch (err) {
      showToast?.(
        err?.response?.data?.detail
        || t4(lang, 'Pa t kapab epengle pòs la.', 'Could not pin the post.', 'Impossible d’épingler.', 'No se pudo fijar.'),
        'circle-exclamation',
      );
    }
  }

  function canDeleteComment(comment) {
    if (!user) return false;
    if (canModerate) return true;
    return user.id === comment.author || user.username === comment.author_username;
  }

  function toggleComments(post) {
    const willOpen = !openComments[post.id];
    setOpenComments((m) => ({ ...m, [post.id]: willOpen }));
    if (willOpen && commentLists[post.id] === undefined && !commentsLoading[post.id]) {
      setCommentsLoading((m) => ({ ...m, [post.id]: true }));
      communitiesService.postComments(post.id)
        .then((r) => {
          const data = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
          setCommentLists((m) => ({ ...m, [post.id]: data }));
        })
        .catch(() => { setCommentLists((m) => ({ ...m, [post.id]: [] })); })
        .finally(() => { setCommentsLoading((m) => ({ ...m, [post.id]: false })); });
    }
  }

  async function handleSendComment(post) {
    const content = (commentDrafts[post.id] || '').trim();
    if (!content || sendingComment[post.id]) return;
    if (!user) {
      showToast?.(t4(lang, 'Konekte pou w kòmante', 'Sign in to comment', 'Connectez-vous pour commenter', 'Inicia sesión para comentar'), 'user-lock');
      return;
    }
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId, content, author: user.id, author_username: user.username,
      created_at: new Date().toISOString(),
    };
    setCommentLists((m) => ({ ...m, [post.id]: [...(m[post.id] || []), optimistic] }));
    setCommentDrafts((m) => ({ ...m, [post.id]: '' }));
    setSendingComment((m) => ({ ...m, [post.id]: true }));
    try {
      const res = await communitiesService.createComment(post.id, content);
      if (res?.data?.id) {
        setCommentLists((m) => ({
          ...m,
          [post.id]: (m[post.id] || []).map((c) => (c.id === tempId ? res.data : c)),
        }));
      }
      setPosts((list) => list.map((p) => (p.id === post.id
        ? { ...p, comment_count: (p.comment_count || 0) + 1 }
        : p)));
    } catch (err) {
      setCommentLists((m) => ({
        ...m, [post.id]: (m[post.id] || []).filter((c) => c.id !== tempId),
      }));
      showToast?.(err?.response?.data?.detail || t4(lang, 'Nou pa ka kòmante.', 'Could not comment.', 'Commentaire impossible.', 'No se pudo comentar.'), 'circle-exclamation');
    } finally {
      setSendingComment((m) => ({ ...m, [post.id]: false }));
    }
  }

  async function handleDeleteComment(post, comment) {
    if (String(comment.id).startsWith('temp-')) return;
    const prev = commentLists[post.id] || [];
    setCommentLists((m) => ({
      ...m, [post.id]: prev.filter((c) => c.id !== comment.id),
    }));
    try {
      await communitiesService.deleteComment(comment.id);
      setPosts((list) => list.map((p) => (p.id === post.id
        ? { ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) }
        : p)));
    } catch (err) {
      setCommentLists((m) => ({ ...m, [post.id]: prev }));
      showToast?.(err?.response?.data?.detail || t4(lang, 'Pa t kapab efase.', 'Could not delete.', 'Suppression impossible.', 'No se pudo eliminar.'), 'circle-exclamation');
    }
  }

  if (loading) {
    return (
      <div
        className="c-list c-list--gap12"
        data-testid="posts-skeleton"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t4(lang, 'Ap chaje pòs yo…', 'Loading posts…', 'Chargement des publications…', 'Cargando publicaciones…')}
      >
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  return (
    <div className="c-list c-list--gap12" aria-busy={searching || undefined}>
      {focusedPost && (
        <SEOHead
          title={`Post by @${focusedPost.author_username || 'member'} in ${community?.name || 'community'}`}
          description={focusedPost.content}
          image={focusedPost.image_url || youtubeThumbnail(focusedPost.video_url || firstVideoUrl(focusedPost.content)) || community?.banner_url || community?.avatar_url}
          url={`/community/${slug}/posts/${focusedPost.id}`}
          type="article"
          lang={lang}
          author={focusedPost.author_username}
          publishedTime={focusedPost.created_at}
          breadcrumbs={[
            { label: 'Home', url: '/' },
            { label: community?.name || 'Community', url: `/community/${slug}` },
            { label: `Post by @${focusedPost.author_username || 'member'}`, url: `/community/${slug}/posts/${focusedPost.id}` },
          ]}
        />
      )}
      {permalinkId && (
        <div className="c-post-permalink-bar">
          <NavLink to={`/community/${slug}/posts`} className="c-post-permalink-back">
            <i className="fas fa-arrow-left" aria-hidden="true" /> {t4(lang, 'Tout pòs yo', 'All posts', 'Toutes les publications', 'Todas las publicaciones')}
          </NavLink>
          <span>{community?.name}</span>
        </div>
      )}
      {focusMissing && (
        <p className="c-post-missing" role="status">
          <i className="fas fa-link-slash" aria-hidden="true" /> {t4(lang, 'Pòs sa a pa egziste ankò oswa li pa disponib.', 'This post no longer exists or is unavailable.', 'Cette publication n\u2019existe plus ou n\u2019est pas disponible.', 'Esta publicación ya no existe o no está disponible.')}
        </p>
      )}
      {!permalinkId && (
      <header className="c-posts-intro">
        <div>
          <h2>{t4(lang, 'Pòs ak diskisyon', 'Posts & discussions', 'Publications et discussions', 'Publicaciones y debates')}</h2>
          <p>{t4(lang, 'Pataje yon lide, poze yon kesyon oswa reponn yon pòs — se piblikasyon ak kòmantè ki fè kominote a grandi.', 'Share an idea, ask a question, or reply to a post — this community grows through posts and comments.', 'Partagez vos idées, posez vos questions et échangez avec les membres à travers les publications et les commentaires.', 'Comparte ideas, haz preguntas y conversa con los miembros mediante publicaciones y comentarios.')}</p>
        </div>
        <span className="c-posts-count" data-testid="posts-count">{countWithUnit(lang, totalCount, POST_FORMS)}</span>
      </header>
      )}
      {!permalinkId && isMember && (
        <form
          ref={setComposerNode}
          className={`c-post-composer c-post-composer--nice${composerFocused ? ' c-post-composer--focused' : ''}`}
          onSubmit={handlePublish}
          onFocus={() => setComposerFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setComposerFocused(false);
          }}
          aria-label={t4(lang, 'Kreye yon pòs', 'Write a post', 'Écrire une publication', 'Escribir una publicación')}
        >
          <div className="c-post-composer-heading">
            <i className="fas fa-pen-to-square" aria-hidden="true" />
            <div>
              <strong>{t4(lang, 'Kreye yon pòs', 'Write a post', 'Écrire une publication', 'Escribir una publicación')}</strong>
              <span>{t4(lang, 'Pataje sa w ap panse ak tout manm yo.', 'Share what’s on your mind with the community.', 'Partagez vos idées avec la communauté.', 'Comparte tus ideas con la comunidad.')}</span>
            </div>
          </div>
          <div className="c-post-composer-editor">
            <span className="c-post-composer-avatar" aria-hidden="true">
              {((user?.username || '?')[0] || '?').toUpperCase()}
            </span>
            <textarea
              ref={draftInputRef}
              id="post-composer-input"
              className="c-post-composer-input"
              value={draft}
              onChange={(event) => {
                const next = event.target.value;
                if (countPostChars(next) > DRAFT_MAX) {
                  setDraft(Array.from(next).slice(0, DRAFT_MAX).join(''));
                  setDraftError(t4(
                    lang,
                    `Maksimòm ${DRAFT_MAX} karaktè. Tèks la koupe.`,
                    `Maximum ${DRAFT_MAX} characters. The text was shortened.`,
                    `Maximum ${DRAFT_MAX} caractères. Le texte a été raccourci.`,
                    `Máximo ${DRAFT_MAX} caracteres. El texto se acortó.`,
                  ));
                  return;
                }
                setDraft(next);
                if (draftError) setDraftError('');
              }}
              rows={1}
              placeholder={t4(lang, 'Ekri pòs ou la a… Pataje yon lide oswa poze yon kesyon.', 'Write your post here… Share an idea or ask a question.', 'Écrivez votre publication ici… Partagez une idée ou posez une question.', 'Escribe tu publicación aquí… Comparte una idea o haz una pregunta.')}
              aria-label={t4(lang, 'Nouvo pòs', 'New post', 'Nouvelle publication', 'Nueva publicación')}
              aria-invalid={draftError ? 'true' : undefined}
              aria-describedby={draftError
                ? 'post-composer-hint post-composer-count post-composer-length-error'
                : 'post-composer-hint post-composer-count'}
              data-testid="post-composer-input"
            />
          </div>
          {draftError && (
            <p id="post-composer-length-error" className="c-post-composer-error" role="alert" data-testid="post-composer-length-error">
              {draftError}
            </p>
          )}
          {(() => {
            if (imageUrl || videoUrl) return null;
            const vUrl = firstVideoUrl(draft);
            if (!vUrl) return null;
            return <ComposerVideoLink url={vUrl} lang={lang} />;
          })()}
          {(() => {
            const link = firstGenericLinkUrl(draft);
            if (!link) return null;
            return <LinkPreviewCard url={link} />;
          })()}
          {imageUrl && (
            <div className="c-post-composer-image">
              <img
                src={imageUrl}
                alt={t4(lang, 'Apèsi imaj pòs la', 'Post image preview', 'Aperçu de l’image', 'Vista previa de la imagen')}
                loading="lazy"
                data-testid="post-composer-preview"
              />
              <button
                type="button"
                className="c-post-composer-image-remove"
                onClick={() => { setImageUrl(''); setImageError(''); setUploadProgress(0); }}
                aria-label={t4(lang, 'Retire imaj', 'Remove image', 'Retirer l’image', 'Quitar imagen')}
                data-testid="post-composer-remove-image"
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          )}
          {videoUrl && (
            <div className="c-post-composer-video">
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                aria-label={t4(lang, 'Apèsi videyo pòs la', 'Post video preview', 'Aperçu de la vidéo', 'Vista previa del video')}
                data-testid="post-composer-video-preview"
              />
              <button
                type="button"
                className="c-post-composer-image-remove"
                onClick={() => { setVideoUrl(''); setVideoError(''); setVideoProgress(0); }}
                aria-label={t4(lang, 'Retire videyo', 'Remove video', 'Retirer la vidéo', 'Quitar video')}
                data-testid="post-composer-remove-video"
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          )}
          {imageError && (
            <p className="c-post-composer-error" role="alert" data-testid="post-composer-image-error">
              {imageError}
            </p>
          )}
          {videoError && (
            <p className="c-post-composer-error" role="alert" data-testid="post-composer-video-error">
              {videoError}
            </p>
          )}
          {showPollCreator && (
            <div style={{ marginTop: 8, border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 8, padding: 10 }} data-testid="post-composer-poll-creator">
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={300}
                placeholder={t4(lang, 'Kesyon sondaj la...', 'Poll question...', 'Question du sondage...', 'Pregunta de la encuesta...')}
                aria-label={t4(lang, 'Kesyon sondaj', 'Poll question', 'Question', 'Pregunta')}
                data-testid="post-composer-poll-question"
                style={{ width: '100%', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, background: 'var(--surface-card, transparent)', color: 'var(--text-primary, inherit)' }}
              />
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={opt}
                    onChange={(e) => setPollOptions((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                    maxLength={200}
                    placeholder={t4(lang, `Opsyon ${i + 1}`, `Option ${i + 1}`, `Option ${i + 1}`, `Opción ${i + 1}`)}
                    data-testid={`post-composer-poll-opt-${i}`}
                    style={{ flex: 1, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 8, padding: '6px 10px', background: 'var(--surface-card, transparent)', color: 'var(--text-primary, inherit)' }}
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions((list) => list.filter((_, j) => j !== i))} data-testid={`post-composer-poll-del-${i}`} aria-label={t4(lang, 'Retire opsyon', 'Remove option', 'Retirer l’option', 'Quitar opción')}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><i className="fas fa-times" aria-hidden="true" /></button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: '0.78rem', flexWrap: 'wrap' }}>
                {pollOptions.length < 10 && (
                  <button type="button" onClick={() => setPollOptions((list) => [...list, ''])} data-testid="post-composer-poll-add"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary, #1f2937)', fontWeight: 700, textDecoration: 'underline' }}>
                    + {t4(lang, 'Ajoute opsyon', 'Add option', 'Ajouter', 'Añadir')}
                  </button>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={pollAllowMultiple} onChange={(e) => setPollAllowMultiple(e.target.checked)} data-testid="post-composer-poll-multi" />
                  {t4(lang, 'Plizyè chwa', 'Multiple choice', 'Choix multiple', 'Opción múltiple')}
                </label>
                <button type="button" onClick={resetPollCreator} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.7 }}>
                  {t4(lang, 'Retire sondaj', 'Remove poll', 'Retirer', 'Quitar')}
                </button>
              </div>
            </div>
          )}
          {showLinkInput && (
            <div className="c-post-composer-link-row" data-testid="post-composer-link-row">
              <input
                type="url"
                value={linkValue}
                onChange={(event) => { setLinkValue(event.target.value); setLinkError(''); }}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); appendLinkToDraft(linkValue); } }}
                placeholder="https://atelnyo.site"
                inputMode="url"
                autoComplete="url"
                aria-label={t4(lang, 'Kole link', 'Paste link', 'Coller le lien', 'Pegar enlace')}
                aria-invalid={linkError ? 'true' : undefined}
                aria-describedby={linkError ? 'post-composer-link-error' : undefined}
                data-testid="post-composer-link-input"
              />
              <button
                type="button"
                onClick={() => appendLinkToDraft(linkValue)}
                disabled={!linkValue.trim()}
                data-testid="post-composer-link-add"
              >
                {t4(lang, 'Ajoute', 'Add', 'Ajouter', 'Añadir')}
              </button>
            </div>
          )}
          {linkError && (
            <p id="post-composer-link-error" className="c-post-composer-error" role="alert" data-testid="post-composer-link-error">
              {linkError}
            </p>
          )}
          <div className="c-post-composer-tools" role="group" aria-label={t4(lang, 'Zouti pou pòs', 'Post tools', 'Outils de publication', 'Herramientas de publicación')}>
            <button
              type="button"
              className={`c-post-composer-tool${imageUrl ? ' is-active' : ''}`}
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage || uploadingVideo || publishing}
              title={t4(lang, 'Ajoute yon foto', 'Add a photo', 'Ajouter une photo', 'Añadir una foto')}
              aria-label={t4(lang, 'Ajoute yon foto', 'Add a photo', 'Ajouter une photo', 'Añadir una foto')}
              data-testid="post-composer-gallery"
            >
              <i className={`fas ${uploadingImage ? 'fa-spinner fa-spin' : 'fa-image'}`} aria-hidden="true" />
              {uploadingImage ? `${uploadProgress}%` : t4(lang, 'Foto', 'Photo', 'Photo', 'Foto')}
            </button>
            <button
              type="button"
              className={`c-post-composer-tool${videoUrl ? ' is-active' : ''}`}
              onClick={() => videoInputRef.current?.click()}
              disabled={uploadingVideo || uploadingImage || publishing}
              title={t4(lang, 'Ajoute yon videyo', 'Add a video', 'Ajouter une vidéo', 'Añadir un video')}
              aria-label={t4(lang, 'Ajoute yon videyo MP4', 'Add an MP4 video', 'Ajouter une vidéo MP4', 'Añadir un video MP4')}
              data-testid="post-composer-video"
            >
              <i className={`fas ${uploadingVideo ? 'fa-spinner fa-spin' : 'fa-video'}`} aria-hidden="true" />
              {uploadingVideo ? `${videoProgress}%` : t4(lang, 'Videyo', 'Video', 'Vidéo', 'Video')}
            </button>
            <button
              type="button"
              className={`c-post-composer-tool${showLinkInput || firstGenericLinkUrl(draft) ? ' is-active' : ''}`}
              onClick={() => { setShowLinkInput((value) => !value); setLinkError(''); }}
              aria-expanded={showLinkInput}
              title={t4(lang, 'Ajoute yon lyen', 'Add a link', 'Ajouter un lien', 'Añadir un enlace')}
              aria-label={t4(lang, 'Ajoute yon lyen', 'Add a link', 'Ajouter un lien', 'Añadir un enlace')}
              data-testid="post-composer-link-btn"
            >
              <i className="fas fa-link" aria-hidden="true" /> {t4(lang, 'Lyen', 'Link', 'Lien', 'Enlace')}
            </button>
            <div className="c-post-composer-popover-wrap">
              <button
                type="button"
                className={`c-post-composer-tool${showEmoji ? ' is-active' : ''}`}
                onClick={() => setShowEmoji((value) => !value)}
                aria-expanded={showEmoji}
                aria-haspopup="menu"
                title={t4(lang, 'Ajoute yon emoji', 'Add an emoji', 'Ajouter un emoji', 'Añadir un emoji')}
                aria-label={t4(lang, 'Ajoute yon emoji', 'Add an emoji', 'Ajouter un emoji', 'Añadir un emoji')}
                data-testid="post-composer-emoji-btn"
              >
                <i className="far fa-smile" aria-hidden="true" /> {t4(lang, 'Emoji', 'Emoji', 'Emoji', 'Emoji')}
              </button>
              {showEmoji && (
                <div className="c-post-composer-emoji-menu" role="menu" aria-label={t4(lang, 'Emoji', 'Emoji', 'Emoji', 'Emoji')}>
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="menuitem"
                      onClick={() => insertEmoji(emoji)}
                      aria-label={t4(lang, 'Ensere yon emoji', 'Insert an emoji', 'Insérer un emoji', 'Insertar un emoji')}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className={`c-post-composer-tool${showPollCreator ? ' is-active' : ''}`}
              onClick={() => setShowPollCreator((value) => !value)}
              aria-expanded={showPollCreator}
              title={t4(lang, 'Sondaj', 'Poll', 'Sondage', 'Encuesta')}
              aria-label={t4(lang, 'Sondaj', 'Poll', 'Sondage', 'Encuesta')}
              data-testid="post-composer-poll-btn"
            >
              <i className="fas fa-chart-bar" aria-hidden="true" /> {t4(lang, 'Sondaj', 'Poll', 'Sondage', 'Encuesta')}
            </button>
          </div>
          <div className="c-post-composer-row">
            <span id="post-composer-hint" className="c-post-composer-hint">
              {visibilityHint(lang, community?.join_mode, community?.read_visibility)}
            </span>
            <span id="post-composer-count" className="c-post-composer-length" aria-live="polite">
              {draftLength}/{DRAFT_MAX}
            </span>
            <button
              type="submit"
              className="c-post-composer-btn"
              disabled={publishing || uploadingImage || uploadingVideo || !canPublish}
              aria-busy={publishing || undefined}
              data-testid="post-composer-submit"
            >
              {publishing
                ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t4(lang, 'Ap pibliye…', 'Publishing…', 'Publication…', 'Publicando…')}</>
                : <><i className="fas fa-paper-plane" aria-hidden="true" /> {t4(lang, 'Pibliye pòs', 'Publish post', 'Publier', 'Publicar')}</>}
            </button>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            className="c-post-composer-file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label={t4(lang, 'Chwazi yon foto', 'Choose a photo', 'Choisir une photo', 'Elegir una foto')}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) handlePickImage(file); event.target.value = ''; }}
            data-testid="post-composer-file"
          />
          <input
            ref={videoInputRef}
            type="file"
            className="c-post-composer-file"
            accept="video/mp4,.mp4"
            aria-label={t4(lang, 'Chwazi yon videyo MP4', 'Choose an MP4 video', 'Choisir une vidéo MP4', 'Elegir un video MP4')}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) handlePickVideo(file); event.target.value = ''; }}
            data-testid="post-composer-video-file"
          />
        </form>
      )}
      {!permalinkId && !isMember && (
        <p className="c-posts-join-note">
          <i className="fas fa-circle-info" aria-hidden="true" />
          {t4(lang, 'Antre nan kominote a pou w pibliye epi patisipe nan diskisyon yo.', 'Join this community to publish posts and join discussions.', 'Rejoignez la communauté pour publier et participer aux discussions.', 'Únete a la comunidad para publicar y participar en las conversaciones.')}
        </p>
      )}

      {!permalinkId && (
      <>
      <div className="c-post-search" role="search">
        <div className="c-post-search-field">
          <i className="fas fa-search c-post-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="c-post-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t4(lang, 'Chache yon pòs... (tèks oswa @user)', 'Search posts... (text or @user)', 'Rechercher... (texte ou @user)', 'Buscar... (texto o @usuario)')}
            aria-label={t4(lang, 'Chache pòs', 'Search posts', 'Rechercher', 'Buscar')}
            data-testid="posts-search-input"
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput('')} aria-label={t4(lang, 'Efase rechèch', 'Clear search', 'Effacer la recherche', 'Borrar búsqueda')} data-testid="posts-search-clear"
              className="c-post-search-clear">
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {search && (
        <div className="c-post-search-status" data-testid="posts-search-status" role="status" aria-live="polite">
          <span>
            {searching && <i className="fas fa-spinner fa-spin" aria-hidden="true" />}{' '}
            {t4(lang, `Rezilta pou "${search}" — ${totalCount}`, `Results for "${search}" — ${totalCount}`, `Résultats pour "${search}" — ${totalCount}`, `Resultados para "${search}" — ${totalCount}`)}
          </span>
          <button
            type="button"
            className="c-post-search-reset"
            data-testid="posts-search-reset"
            onClick={() => { setSearchInput(''); setSearch(''); }}
          >
            <i className="fas fa-arrow-left" aria-hidden="true" /> {t4(lang, 'Retounen nan fil la', 'Back to feed', 'Retour au fil', 'Volver al feed')}
          </button>
        </div>
      )}
      </>
      )}

      {posts.length === 0 ? (
        searching ? (
          <div className="c-state" data-testid="posts-search-loading" role="status">
            <i className="fas fa-spinner fa-spin c-state-icon" aria-hidden="true" />
            <p className="c-state-text">
              {t4(lang, 'Ap chèche pòs…', 'Searching posts…', 'Recherche des publications…', 'Buscando publicaciones…')}
            </p>
          </div>
        ) : (
        <div className="c-state">
          <i className="fas fa-comments c-state-icon" aria-hidden="true" />
          <p className="c-state-text">
            {search
              ? t4(lang, `Pa gen pòs ki koresponn ak "${search}".`, `No posts match "${search}".`, `Aucune publication ne correspond à « ${search} ».`, `Ninguna publicación coincide con « ${search} ».`)
              : isMember
              ? t4(lang, 'Pa gen pòs ankò — se premye moun ki pibliye!', 'No posts yet — be the first to publish!', 'Aucune publication — soyez le premier !', '¡Sin publicaciones — sé el primero!')
              : t4(lang, 'Pa gen pòs ankò.', 'No posts yet.', 'Aucune publication.', 'Sin publicaciones.')}
          </p>
          {!search && !isMember && (
            <p className="c-state-text">
              {t4(lang, 'Antre nan kominote a pou w patisipe.', 'Join the community to take part.', 'Rejoignez la communauté pour participer.', 'Únete a la comunidad para participar.')}
            </p>
          )}
        </div>
        )
      ) : posts.map((post) => (
        <article key={post.id} className={`c-post-card${post.is_pinned ? ' c-post-card--pinned' : ''}${permalinkId === post.id ? ' c-post-card--focus' : ''}`} data-testid={`community-post-${post.id}`}>
          <div className="c-post-header">
            <span className="c-post-avatar" aria-hidden="true">
              {post.author_avatar
                ? <img src={post.author_avatar} alt="" loading="lazy" />
                : (post.author_username || '?')[0].toUpperCase()}
            </span>
            <div className="c-post-meta">
              <span className="c-title c-title--xs" title={`@${post.author_username}`}>@{post.author_username}</span>
              <time className="c-post-time" dateTime={post.created_at} title={formatPostTime(post.created_at, lang)}>
                {formatRelativePostTime(post.created_at, lang)}
              </time>
            </div>
            {post.is_pinned && (
              <span className="c-post-pinned" title={t4(lang, 'Epinglé pa moderatè', 'Pinned by moderators', 'Épinglé par les modérateurs', 'Fijado por moderadores')}>
                <i className="fas fa-thumbtack" aria-hidden="true" />
              </span>
            )}
            <div className="c-post-actions">
              {/* One consistent menu: report for non-authors, plus edit/pin/
                  delete only when the viewer is authorized. Reporting reuses
                  the platform-wide /api/content/reports/ endpoint. */}
              <ContentFeedbackMenu
                contentType="community_post"
                contentId={post.id}
                lang={lang}
                actions={postActionsFor(post)}
                showReport={Boolean(user && !isPostAuthor(post))}
                showFeedback={Boolean(user && !isPostAuthor(post))}
              />
            </div>
          </div>
          {editingId === post.id ? (
            <div className="c-post-edit">
              <textarea
                className="c-post-edit-input"
                value={editDraft}
                onChange={(event) => {
                  const next = event.target.value;
                  if (countPostChars(next) <= DRAFT_MAX) setEditDraft(next);
                }}
                rows={3}
                aria-label={t4(lang, 'Modifye pòs', 'Edit post', 'Modifier la publication', 'Editar publicación')}
                data-testid={`post-edit-input-${post.id}`}
              />
              <div className="c-post-edit-actions">
                <button
                  type="button"
                  className="c-post-edit-save"
                  onClick={() => handleSaveEdit(post)}
                  disabled={editSaving || (!editDraft.trim() && !post.image_url && !post.video_url && !post.poll_question)}
                  data-testid={`post-edit-save-${post.id}`}
                >
                  {editSaving
                    ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                    : t4(lang, 'Sove', 'Save', 'Enregistrer', 'Guardar')}
                </button>
                <button
                  type="button"
                  className="c-post-edit-cancel"
                  onClick={() => { setEditingId(null); setEditDraft(''); }}
                >
                  {t4(lang, 'Anile', 'Cancel', 'Annuler', 'Cancelar')}
                </button>
              </div>
            </div>
          ) : (
            <PostContent content={post.content} />
          )}
          {(() => {
            const vidUrl = post.video_url || firstVideoUrl(post.content);
            const video = vidUrl ? resolveVideoSource(vidUrl) : null;
            // Same as Music: YouTube link carries its own thumbnail when
            // the author didn't attach a photo.
            const img = post.image_url || (vidUrl ? youtubeThumbnail(vidUrl) : '');
            const link = firstGenericLinkUrl(post.content);
            return (
              <>
                {img && <img className="c-post-image" src={img} alt="" loading="lazy" />}
                {vidUrl && <VideoTitleLink url={vidUrl} />}
                {video && (
                  video.kind === 'embed' ? (
                    <VideoEmbedFrame
                      src={video.src}
                      title={t4(lang, 'Videyo pòs la', 'Post video', 'Vidéo de la publication', 'Video de la publicación')}
                      lang={lang}
                      className="c-post-video-embed"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    <video
                      className="c-post-video"
                      src={video.src}
                      controls
                      preload="metadata"
                      playsInline
                      poster={img || undefined}
                      aria-label={t4(lang, 'Videyo pòs la', 'Post video', 'Vidéo de la publication', 'Video de la publicación')}
                    />
                  )
                )}
                {link && <LinkPreviewCard url={link} />}
                {post.poll_question && (
                  <PostPoll post={post} lang={lang} user={user} showToast={showToast}
                    onVoted={(updated) => setPosts((list) => list.map((p) => (p.id === updated.id ? updated : p)))} />
                )}
              </>
            );
          })()}
          <div className="c-post-foot">
            <button
              type="button"
              className="c-post-share"
              onClick={() => handleShare(post)}
              title={t4(lang, 'Kopye lyen pòs la', 'Copy post link', 'Copier le lien', 'Copiar enlace')}
              aria-label={t4(lang, 'Pataje pòs', 'Share post', 'Partager la publication', 'Compartir publicación')}
              data-testid={`post-share-${post.id}`}
            >
              <i className="fas fa-link" aria-hidden="true" /> {t4(lang, 'Pataje', 'Share', 'Partager', 'Compartir')}
            </button>
            <button
              type="button"
              className={`c-comment-toggle${openComments[post.id] ? ' c-comment-toggle--open' : ''}`}
              onClick={() => toggleComments(post)}
              aria-expanded={Boolean(openComments[post.id])}
              data-testid={`post-comments-toggle-${post.id}`}
            >
              <i className="fas fa-comment" aria-hidden="true" /> {countWithUnit(lang, post.comment_count || 0, COMMENT_FORMS)}
            </button>
          </div>
          {openComments[post.id] && (
            <div className="c-comments" data-testid={`post-comments-${post.id}`}>
              {commentsLoading[post.id] ? (
                <CommentListSkeleton lang={lang} />
              ) : (commentLists[post.id] || []).length === 0 ? (
                <p className="c-comments-empty">
                  {t4(lang, 'Pa gen kòmantè ankò — kòmanse diskisyon an!', 'No comments yet — start the discussion!', 'Aucun commentaire — lancez la discussion !', '¡Sin comentarios — inicia la discusión!')}
                </p>
              ) : (commentLists[post.id] || []).map((comment) => (
                <div key={comment.id} className="c-comment">
                  <span className="c-comment-avatar" aria-hidden="true">
                    {(comment.author_username || '?')[0].toUpperCase()}
                  </span>
                  <div className="c-comment-body">
                    <span className="c-comment-author">@{comment.author_username}</span>
                    <span className="c-comment-text">{comment.content}</span>
                  </div>
                  {canDeleteComment(comment) && (
                    <button
                      type="button"
                      className="c-comment-delete"
                      onClick={() => handleDeleteComment(post, comment)}
                      title={t4(lang, 'Efase', 'Delete', 'Supprimer', 'Eliminar')}
                      aria-label={t4(lang, 'Efase kòmantè', 'Delete comment', 'Supprimer', 'Eliminar')}
                      data-testid={`comment-delete-${comment.id}`}
                    >
                      <i className="fas fa-trash" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {isMember && (
                <div className="c-comment-form">
                  <input
                    className="c-comment-input"
                    value={commentDrafts[post.id] || ''}
                    onChange={(e) => setCommentDrafts((m) => ({ ...m, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendComment(post); }}
                    maxLength={1000}
                    placeholder={t4(lang, 'Ekri yon kòmantè...', 'Write a comment...', 'Écrivez un commentaire...', 'Escribe un comentario...')}
                    aria-label={t4(lang, 'Nouvo kòmantè', 'New comment', 'Nouveau commentaire', 'Nuevo comentario')}
                    data-testid={`comment-input-${post.id}`}
                  />
                  <button
                    type="button"
                    className="c-comment-send"
                    onClick={() => handleSendComment(post)}
                    disabled={sendingComment[post.id] || !(commentDrafts[post.id] || '').trim()}
                    aria-label={t4(lang, 'Voye kòmantè', 'Send comment', 'Envoyer', 'Enviar')}
                    data-testid={`comment-send-${post.id}`}
                  >
                    {sendingComment[post.id]
                      ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      : <i className="fas fa-paper-plane" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="c-post-reactions" role="group" aria-label={t4(lang, 'Reyaksyon', 'Reactions', 'Réactions', 'Reacciones')}>
            {REACTION_EMOJIS.map((emoji) => {
              const count = post.reactions?.[emoji] || 0;
              const active = post.my_reaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`c-react-btn${active ? ' c-react-btn--active' : ''}`}
                  onClick={() => handleReact(post, emoji)}
                  disabled={Boolean(reacting[post.id])}
                  aria-pressed={active}
                  aria-label={`${emoji} ${count}`}
                  data-testid={`post-react-${post.id}-${emoji}`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {count > 0 && <span className="c-react-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </article>
      ))}
      {hasMore && posts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            data-testid="posts-load-more"
            style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: 20, padding: '8px 20px', cursor: 'pointer', background: '#fff', fontWeight: 600 }}
          >
            {loadingMore
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> ...</>
              : <>{t4(lang, `Chaje plis (${posts.length}/${totalCount || '?'})`, `Load more (${posts.length}/${totalCount || '?'})`, `Charger plus (${posts.length}/${totalCount || '?'})`, `Cargar más (${posts.length}/${totalCount || '?'})`)}</>}
          </button>
        </div>
      )}
    </div>
  );
}
