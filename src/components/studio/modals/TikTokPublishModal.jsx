/**
 * src/components/studio/modals/TikTokPublishModal.jsx
 *
 * Direct Post publish modal (Faz C.1–C.3 + C.7).
 *
 *   C.1  pick a video from the creator's media engine (media/assets/)
 *   C.2  privacy choices come from TikTok (creator_info), not from us
 *   C.3  creator info (@username, max duration) shown BEFORE confirm —
 *        TikTok's own UX guideline; options the creator disallows are
 *        disabled, and pre-audit only SELF_ONLY is selectable (decision #5)
 *   C.7  "Generate caption + hashtags" — one Gemini call via the backend
 *        (same GEMINI_API_KEY as DEIE), fills the title field
 *
 * Server errors surface verbatim codes translated below; the backend owns
 * every rule (audit gate, rate limit, duration, idempotency) — the modal
 * only pre-renders it honestly.
 *
 * Plan: docs/features/TIKTOK_INTEGRATION_PLAN.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { mediaProviderService } from '../../../services/api';
import { tiktokService } from '../../../services/tiktokService';
import { StudioModal, FormField } from './shared';
import styles from './modals.module.css';
import css from './TikTokPublishModal.module.css';

const MAX_TITLE = 2200;

const T = {
  title: { ht: 'Pataje sou TikTok', en: 'Share to TikTok', fr: 'Partager sur TikTok', es: 'Compartir en TikTok' },
  subtitle: {
    ht: 'Chwazi yon videyo, ekri kaptyen an, pibliye.',
    en: 'Pick a video, write the caption, publish.',
    fr: 'Choisissez une vidéo, rédigez une légende et publiez.',
    es: 'Elige un video, escribe el texto y publícalo.',
  },
  pick: { ht: 'Chwazi videyo a', en: 'Pick the video', fr: 'Choisir la vidéo', es: 'Elegir el video' },
  noVideos: {
    ht: 'Pa gen videyo nan librairi medya ou — upload youn nan Media Hub anvan.',
    en: 'No videos in your media library — upload one in Media Hub first.',
    fr: 'Aucune vidéo dans votre bibliothèque — téléversez-en une dans Media Hub.',
    es: 'No hay videos en tu biblioteca; primero sube uno desde Media Hub.',
  },
  caption: { ht: 'Kaptyen (tit TikTok)', en: 'Caption (TikTok title)', fr: 'Légende (titre TikTok)', es: 'Texto (título de TikTok)' },
  aiGenerate: { ht: 'Jenere kaptyen + hashtag', en: 'Generate caption + hashtags', fr: 'Générer une légende + hashtags', es: 'Generar texto + hashtags' },
  aiWorking: { ht: 'AI ap ekri…', en: 'AI is writing…', fr: 'L’IA rédige…', es: 'La IA está escribiendo…' },
  privacy: { ht: 'Kiyès ka wè pòs la?', en: 'Who can see this post?', fr: 'Qui peut voir cette publication ?', es: '¿Quién puede ver esta publicación?' },
  privPublic: { ht: 'Tout moun', en: 'Everyone', fr: 'Tout le monde', es: 'Todos' },
  privFriends: { ht: 'Zanmi anseyans', en: 'Mutual follow friends', fr: 'Amis (abonnements mutuels)', es: 'Amigos (seguimiento mutuo)' },
  privSelf: { ht: 'Selman mwen', en: 'Only me', fr: 'Moi uniquement', es: 'Solo yo' },
  auditedHint: {
    ht: 'Mode dev: jiskaske TikTok apwouve audit la, pòs yo sòti prive.',
    en: 'Dev mode: until TikTok approves the audit, posts go out private.',
    fr: 'Mode développement : les publications restent privées jusqu’à l’audit de TikTok.',
    es: 'Modo de desarrollo: las publicaciones serán privadas hasta que TikTok apruebe la auditoría.',
  },
  comment: { ht: 'Entèdi kòmante', en: 'Disable comments', fr: 'Désactiver les commentaires', es: 'Desactivar comentarios' },
  duet: { ht: 'Entèdi duet', en: 'Disable duet', fr: 'Désactiver les Duos', es: 'Desactivar Dúos' },
  stitch: { ht: 'Entèdi stitch', en: 'Disable stitch', fr: 'Désactiver les Collages', es: 'Desactivar Pegar' },
  as: { ht: 'Pòs lan ap sòti sou kont', en: 'Post will go out from', fr: 'La publication sera envoyée depuis', es: 'La publicación se enviará desde' },
  maxLen: { ht: 'Dire maksimòm videyo', en: 'Max video length', fr: 'Durée maximale de la vidéo', es: 'Duración máxima del video' },
  submit: { ht: 'Pibliye sou TikTok', en: 'Publish to TikTok', fr: 'Publier sur TikTok', es: 'Publicar en TikTok' },
  submitting: { ht: 'Ap voye…', en: 'Sending…', fr: 'Envoi…', es: 'Enviando…' },
  posted: { ht: 'Videyo a ale sou TikTok — TikTok ap trete l.', en: 'Sent to TikTok — it is processing.', fr: 'Vidéo envoyée à TikTok — traitement en cours.', es: 'Video enviado a TikTok; se está procesando.' },
  postedDup: { ht: 'Videyo sa a deja an pwosesis sou TikTok.', en: 'This video is already processing on TikTok.', fr: 'Cette vidéo est déjà en cours de traitement sur TikTok.', es: 'Este video ya se está procesando en TikTok.' },
  notConnected: { ht: 'Konekte kont TikTok ou anvan.', en: 'Connect your TikTok account first.', fr: 'Connectez d’abord votre compte TikTok.', es: 'Primero conecta tu cuenta de TikTok.' },
  reconnect: {
    ht: 'Sesyon TikTok ou fin ekspire — rekonekte kont ou.',
    en: 'Your TikTok session expired — reconnect your account.',
    fr: 'Votre session TikTok a expiré — reconnectez votre compte.',
    es: 'Tu sesión de TikTok venció; vuelve a conectar tu cuenta.',
  },
  needAudit: {
    ht: 'Piblikasyon piblik mande audit TikTok — pibliye prive kounye a.',
    en: 'Public posting requires TikTok audit — publish privately for now.',
    fr: 'La publication publique nécessite l’audit TikTok — publiez en privé pour le moment.',
    es: 'La publicación pública requiere la auditoría de TikTok; por ahora, publica en privado.',
  },
  rateLimited: { ht: 'Limit 6 pòs pa minit rive — tann yon ti moman.', en: '6 posts/minute limit reached — wait a moment.', fr: 'Limite de 6 publications par minute atteinte — patientez.', es: 'Se alcanzó el límite de 6 publicaciones por minuto; espera un momento.' },
  privNotAllowed: { ht: 'TikTok pa pèmèt nivo privas sa a pou kont ou.', en: 'TikTok does not allow this privacy level for your account.', fr: 'TikTok n’autorise pas ce niveau de confidentialité pour votre compte.', es: 'TikTok no permite este nivel de privacidad para tu cuenta.' },
  tooLong: { ht: 'Videyo a twò long pou TikTok.', en: 'The video is too long for TikTok.', fr: 'La vidéo est trop longue pour TikTok.', es: 'El video es demasiado largo para TikTok.' },
  titleTooLong: { ht: 'Kaptyen an twò long (2200 maks).', en: 'Caption too long (2200 max).', fr: 'Légende trop longue (2 200 caractères max.).', es: 'El texto es demasiado largo (máximo 2200 caracteres).' },
  pickOne: { ht: 'Chwazi yon videyo anvan ou pibliye.', en: 'Pick a video before publishing.', fr: 'Choisissez une vidéo avant de publier.', es: 'Elige un video antes de publicar.' },
  aiError: { ht: 'AI a pa reponn — ekri kaptyen ou menm.', en: 'AI did not answer — write the caption yourself.', fr: 'L’IA n’a pas répondu — rédigez votre légende.', es: 'La IA no respondió; escribe el texto manualmente.' },
  error: { ht: 'Erè — eseye ankò.', en: 'Something went wrong — try again.', fr: 'Une erreur est survenue — réessayez.', es: 'Ocurrió un error — inténtalo de nuevo.' },
};

function tt(lang, key) {
  const e = T[key];
  return e ? (e[lang] || e.en) : '';
}

const ERROR_TOAST = {
  not_connected: 'notConnected',
  token_invalid: 'reconnect',
  public_requires_audit: 'needAudit',
  rate_limited: 'rateLimited',
  privacy_not_allowed: 'privNotAllowed',
  video_too_long: 'tooLong',
  title_too_long: 'titleTooLong',
};

export default function TikTokPublishModal({ onClose, lang = 'ht', showToast, onPosted }) {
  const [info, setInfo] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true); // true: mount-fetch runs immediately
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState('SELF_ONLY');
  const [noComment, setNoComment] = useState(false);
  const [noDuet, setNoDuet] = useState(false);
  const [noStitch, setNoStitch] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mounted once (stable deps): ``loading`` starts true so no sync
  // setState is needed inside the effect body.
  const load = useCallback(async () => {
    try {
      const [infoRes, mediaRes] = await Promise.allSettled([
        tiktokService.creatorInfo(),
        mediaProviderService.userMedia(),
      ]);
      if (infoRes.status === 'fulfilled') setInfo(infoRes.value.data || null);
      const raw = mediaRes.status === 'fulfilled' ? mediaRes.value.data : null;
      const rows = Array.isArray(raw) ? raw : (raw?.results || []);
      setVideos(rows.filter((a) => (
        (a.media_type || '').toLowerCase() === 'video'
        && a.url
        && a.is_valid !== false
        && a.is_active !== false
      )));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(
    () => videos.find((v) => v.id === selectedId) || null,
    [videos, selectedId],
  );

  const generateCaption = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const { data } = await tiktokService.generateCaption({
        title: selected?.title || title.slice(0, 300),
        media_kind: 'video',
        creator_name: info?.username || '',
      });
      if (data && data.caption) {
        const tags = Array.isArray(data.hashtags) && data.hashtags.length
          ? ` ${data.hashtags.map((h) => `#${h}`).join(' ')}` : '';
        setTitle(`${data.caption}${tags}`.slice(0, MAX_TITLE));
      } else if (showToast) {
        showToast(tt(lang, 'aiError'));
      }
    } catch {
      showToast?.(tt(lang, 'aiError'));
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!selected) { showToast?.(tt(lang, 'pickOne')); return; }
    setSubmitting(true);
    try {
      const { data } = await tiktokService.createPost({
        media_url: selected.url,
        media_id: String(selected.id || ''),
        title,
        privacy_level: privacy,
        disable_comment: noComment,
        disable_duet: noDuet,
        disable_stitch: noStitch,
      });
      const post = data && data.post;
      showToast?.(tt(lang, data && data.duplicate ? 'postedDup' : 'posted'));
      if (post) onPosted?.(post);
      onClose?.();
    } catch (err) {
      const code = err?.response?.data?.error || '';
      showToast?.(tt(lang, ERROR_TOAST[code] || 'error'));
      if (code === 'token_invalid' || err?.response?.status === 401) onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  const audited = Boolean(info?.audited);
  const privacyOptions = (info?.privacy_level_options && info.privacy_level_options.length)
    ? info.privacy_level_options
    : ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'];
  const PRIV_LABEL = {
    PUBLIC_TO_EVERYONE: 'privPublic',
    MUTUAL_FOLLOW_FRIENDS: 'privFriends',
    SELF_ONLY: 'privSelf',
  };
  const maxDur = info?.max_video_post_duration_sec || 0;

  return (
    <StudioModal onClose={onClose} title={tt(lang, 'title')} subtitle={tt(lang, 'subtitle')}>
      <form onSubmit={submit} className={styles.form}>
        {/* C.3 — TikTok UX guideline: creator info BEFORE the post */}
        {info?.connected && info.username && (
          <div className={css.creatorStrip}>
            <i className="fab fa-tiktok" aria-hidden="true" />
            <span>{tt(lang, 'as')} <strong>@{info.username}</strong></span>
            {maxDur > 0 && (
              <span className={css.creatorMax}>
                {tt(lang, 'maxLen')}: {Math.floor(maxDur / 60)}:{String(maxDur % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        <FormField label={tt(lang, 'pick')} required>
          {loading ? (
            <div className={css.pickerLoading}><i className="fas fa-spinner fa-spin" aria-hidden="true" /></div>
          ) : videos.length === 0 ? (
            <p className={css.empty}>{tt(lang, 'noVideos')}</p>
          ) : (
            <div className={css.videoGrid} role="listbox" aria-label={tt(lang, 'pick')}>
              {videos.slice(0, 12).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="option"
                  aria-selected={v.id === selectedId}
                  className={`${css.videoTile} ${v.id === selectedId ? css.videoTileActive : ''}`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <i className="fas fa-film" aria-hidden="true" />
                  <span className={css.videoName}>{v.title || v.url}</span>
                </button>
              ))}
            </div>
          )}
        </FormField>

        <FormField label={tt(lang, 'caption')} hint={`${title.length}/${MAX_TITLE}`}>
          <textarea
            className={styles.textarea}
            value={title}
            maxLength={MAX_TITLE}
            rows={3}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={lang === 'ht' ? 'Kisa videyo a ye sou…' : 'What is this video about…'}
          />
          <button
            type="button"
            className={css.aiBtn}
            onClick={generateCaption}
            disabled={aiBusy}
          >
            <i className={aiBusy ? 'fas fa-spinner fa-spin' : 'fas fa-wand-magic-sparkles'} aria-hidden="true" />
            {aiBusy ? tt(lang, 'aiWorking') : tt(lang, 'aiGenerate')}
          </button>
        </FormField>

        <FormField label={tt(lang, 'privacy')} hint={!audited ? tt(lang, 'auditedHint') : undefined}>
          <div className={css.privacyList}>
            {privacyOptions.map((opt) => {
              const blocked = opt !== 'SELF_ONLY' && !audited;
              return (
                <label
                  key={opt}
                  className={`${css.privacyRow} ${privacy === opt ? css.privacyRowActive : ''} ${blocked ? css.privacyRowBlocked : ''}`}
                >
                  <input
                    type="radio"
                    name="tiktok_privacy"
                    value={opt}
                    checked={privacy === opt}
                    disabled={blocked}
                    onChange={() => setPrivacy(opt)}
                  />
                  <span>{tt(lang, PRIV_LABEL[opt] || opt)}</span>
                  {blocked && <i className="fas fa-lock" aria-hidden="true" />}
                </label>
              );
            })}
          </div>
        </FormField>

        <div className={css.switches}>
          {[
            ['comment', noComment, setNoComment, info?.comment_disabled],
            ['duet', noDuet, setNoDuet, info?.duet_disabled],
            ['stitch', noStitch, setNoStitch, info?.stitch_disabled],
          ].map(([key, val, setVal, disabledByCreator]) => (
            <label key={key} className={`${css.switchRow} ${disabledByCreator ? css.privacyRowBlocked : ''}`}>
              <input
                type="checkbox"
                checked={val}
                disabled={disabledByCreator}
                onChange={(e) => setVal(e.target.checked)}
              />
              <span>{tt(lang, key)}</span>
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              {lang === 'ht' ? 'Anile'
                : lang === 'fr' ? 'Annuler'
                  : lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          <button type="submit" className="btn-primary" disabled={submitting || loading || !selected}>
            {submitting
              ? <><i className="fas fa-spinner fa-spin" /> {tt(lang, 'submitting')}</>
              : <><i className="fab fa-tiktok" /> {tt(lang, 'submit')}</>}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
