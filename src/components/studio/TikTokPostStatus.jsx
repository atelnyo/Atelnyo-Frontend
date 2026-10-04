/**
 * src/components/studio/TikTokPostStatus.jsx
 *
 * Status badge + polling for ONE TikTok post (Faz C.4).
 *
 * Mirrors the backend's async lifecycle (pending → uploading → processing
 * → published | failed): while the row is inflight AND has a publish_id,
 * this component polls GET /api/tiktok/posts/{id}/status/ every 5s and
 * lifts each fresh row to the parent via ``onUpdate``. Polling stops on
 * terminal states, when the row has no publish_id yet, and on unmount.
 *
 * The "private (dev mode)" hint follows plan decision #5: before TikTok's
 * audit, every post is forced to SELF_ONLY — the UI says so honestly.
 *
 * Plan: docs/features/TIKTOK_INTEGRATION_PLAN.md (C.4)
 */
import React, { useEffect, useRef } from 'react';
import { tiktokService } from '../../services/tiktokService';
import styles from './TikTokConnect.module.css';

const POLL_INTERVAL_MS = 5000;

const STATUS_LABELS = {
  pending: { ht: 'An atant…', en: 'Pending…', fr: 'En attente…', es: 'Pendiente…' },
  uploading: { ht: 'Ap voye…', en: 'Uploading…', fr: 'Envoi…', es: 'Subiendo…' },
  processing: { ht: 'TikTok ap trete videyo a…', en: 'TikTok is processing…', fr: 'TikTok traite la vidéo…', es: 'TikTok está procesando el video…' },
  published: { ht: 'Pibliye ✓', en: 'Published ✓', fr: 'Publié ✓', es: 'Publicado ✓' },
  failed: { ht: 'Echwe ✗', en: 'Failed ✗', fr: 'Échec ✗', es: 'Error ✗' },
};

const INFLIGHT = ['pending', 'uploading', 'processing'];

function label(lang, status) {
  const entry = STATUS_LABELS[status];
  return entry ? (entry[lang] || entry.en) : status;
}

export default function TikTokPostStatus({ post, lang = 'ht', onUpdate }) {
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  const status = post?.status || '';
  const inflight = INFLIGHT.includes(status);
  const hasPublishId = Boolean(post?.publish_id);
  // Derived (not stored): the spinner means "the backend row is still
  // inflight" — which is exactly the condition that starts polling.
  const polling = inflight && hasPublishId;

  useEffect(() => {
    stoppedRef.current = false;

    if (!post || !inflight || !hasPublishId) {
      return undefined; // nothing to poll
    }

    const tick = async () => {
      if (stoppedRef.current) return;
      try {
        const { data } = await tiktokService.postStatus(post.id);
        const fresh = data && data.post;
        if (fresh && !stoppedRef.current) {
          onUpdate?.(fresh);
          if (!INFLIGHT.includes(fresh.status)) {
            stoppedRef.current = true;
          }
        }
      } catch {
        // Transient poll failures (plan B.4) — keep the loop alive; the
        // backend keeps its own state when TikTok is unreachable.
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    timerRef.current = interval;
    return () => {
      stoppedRef.current = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, post?.status, hasPublishId]);

  if (!post) return null;

  const tone = status === 'published'
    ? styles.badgeOk
    : status === 'failed'
      ? styles.badgeOff
      : styles.badgeBusy;

  const isPrivateDev = status === 'published'
    && post.privacy_level !== 'PUBLIC_TO_EVERYONE';

  return (
    <div className={styles.statusRow} data-tiktok-post-status={post.id}>
      <span className={`${styles.statusBadge} ${tone}`}>
        {polling && <span className={styles.spinnerTiny} aria-hidden="true" />}
        {label(lang, status)}
      </span>

      {status === 'published' && post.tiktok_url && (
        <a
          className={styles.statusLink}
          href={post.tiktok_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fab fa-tiktok" aria-hidden="true" />
          {lang === 'ht' ? 'Gade sou TikTok'
            : lang === 'fr' ? 'Voir sur TikTok'
              : lang === 'es' ? 'Ver en TikTok' : 'View on TikTok'}
        </a>
      )}

      {isPrivateDev && (
        <span className={styles.statusHint}>
          {lang === 'ht'
            ? 'Pòs prive — mode dev (piblik vini apre audit TikTok la).'
            : lang === 'fr'
              ? 'Publication privée — mode développement (le mode public attend l’audit TikTok).'
              : lang === 'es'
                ? 'Publicación privada — modo de desarrollo (lo público requiere la auditoría de TikTok).'
                : 'Private post — dev mode (public arrives after TikTok\'s audit).'}
        </span>
      )}

      {status === 'failed' && (post.error_message || post.error_code) && (
        <span className={styles.statusError}>
          {post.error_message || post.error_code}
        </span>
      )}
    </div>
  );
}
