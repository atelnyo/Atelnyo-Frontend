/**
 * src/components/studio/modals/MusicUploadModal.jsx
 *
 * Modal for adding a music track. POSTs to /api/explore/music/.
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor.
 * Fixed to post to explore/music/ — not media/assets/ — so the
 * track appears in the Creator Studio's music section and in
 * the Explore catalog for all visitors.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api, { musicService } from '../../../services/api';
import {
  StudioModal, FormField, FormSection, ImageUrlField,
  LoadingOverlay, MediaUrlField, HelpTip, FieldTip, HELP_COPY,
} from './shared';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import styles from './modals.module.css';

/** Format seconds → "M:SS" (the Explore catalog's canonical shape). */
function secondsToDuration(secs) {
  const total = Math.max(0, Math.round(secs));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format seconds → "H:MM:SS" for videos ≥ 1h, "M:SS" otherwise. */
function secondsToVideoDuration(secs) {
  const total = Math.max(0, Math.round(secs));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Probe an AUDIO URL for its duration using a throwaway HTML5 <audio>
 * element (``preload="metadata"`` → ``loadedmetadata``).
 *
 * Resolves the duration in seconds, or ``null`` when the URL is not
 * a playable direct audio file (CORS-blocked hosts, dead links). 20s
 * timeout so a hanging URL never spins the UI forever. Works for any
 * server that serves the file with Range support or full playback
 * (Wikimedia/typical CDNs do).
 *
 * Note: the VIDEO field does NOT use this — react-player's
 * ``onDuration`` callback (via MediaUrlField) is strictly better there
 * because it covers YouTube/Vimeo pages too, which a raw <video>
 * element cannot load.
 */
function probeAudioDuration(url) {
  return new Promise((resolve) => {
    const trimmed = (url || '').trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      resolve(null);
      return;
    }
    let el = null;
    const timeout = setTimeout(() => { cleanup(); resolve(null); }, 20000);
    function cleanup() {
      clearTimeout(timeout);
      if (el) {
        el.removeEventListener('loadedmetadata', onLoaded);
        el.removeEventListener('error', onError);
        el.removeAttribute('src');
        if (typeof el.load === 'function') el.load();
        el = null;
      }
    }
    function onLoaded() {
      const d = el && typeof el.duration === 'number' ? el.duration : null;
      const secs = (typeof d === 'number' && Number.isFinite(d) && d > 0) ? d : null;
      cleanup();
      resolve(secs);
    }
    function onError() {
      cleanup();
      resolve(null);
    }
    el = new Audio();
    el.preload = 'metadata';
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onError);
    el.src = trimmed;
  });
}

export default function MusicUploadModal({ onClose, onSuccess, lang, showToast, item }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    title: item?.title || '', artist: item?.artist || '', genre: item?.genre || '',
    cover_url: item?.cover_url || '', preview_url: item?.preview_url || '',
    video_url: item?.video_url || '',
    duration: item?.duration || '',
    hashtags: hashtagsToInput(item?.tags),
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  // Auto-duration detection status: 'idle' | 'detecting' | 'ok' | 'failed'.
  // Drives the hint under the Duration field so the creator always knows
  // whether the system probed the preview URL or needs a manual entry.
  const [detectStatus, setDetectStatus] = useState('idle');
  const detectTimerRef = useRef(null);
  const mountedRef = useRef(true);
  // Probe-sequence guard: bumped every time preview_url changes/clears
  // so a probe started for an OLD URL can never fill the field or set
  // the status after the user moved on (see handleChange).
  const probeSeqRef = useRef(0);
  // ── Music-video duration detection ────────────────────────────────
  // Status: 'idle' | 'detecting' | 'ok' | 'failed'; the detected
  // H:MM:SS string is kept separately so the hint can render it.
  // react-player reports the duration when the video metadata loads
  // (via MediaUrlField's ``onDuration``) — it works for YouTube and
  // Vimeo pages AND direct MP4/WebM files, so it is the single source
  // of truth here (no separate <video> probe — that would fail on
  // YouTube and fight this path).
  const [videoDetectStatus, setVideoDetectStatus] = useState('idle');
  const [videoDetectedDuration, setVideoDetectedDuration] = useState('');
  const handleVideoDuration = useCallback((secs) => {
    if (mountedRef.current && typeof secs === 'number' && Number.isFinite(secs) && secs > 0) {
      setVideoDetectedDuration(secondsToVideoDuration(secs));
      setVideoDetectStatus('ok');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    };
  }, []);

  // ─── Auto-detect duration from the preview URL ─────────────────────
  // Debounced (900ms) so pasting a long URL doesn't fire mid-typing.
  // Only auto-runs when the duration field is empty — a creator who
  // already typed a value keeps their value (the Detect button on the
  // Duration field still re-probes on demand).
  //
  // ``force=true`` (explicit Detect click) always overwrites whatever
  // is in the field; the debounced auto path (``force=false``) only
  // fills when the field is still empty, so a value typed while the
  // probe ran is never clobbered.
  const runDurationDetection = useCallback(async (url, force = false) => {
    if (!mountedRef.current) return;
    const mySeq = probeSeqRef.current;
    setDetectStatus('detecting');
    const secs = await probeAudioDuration(url);
    // Ignore stale results — the URL changed/cleared while we probed.
    if (!mountedRef.current || probeSeqRef.current !== mySeq) return;
    if (secs != null) {
      setForm((f) => {
        const current = (f.duration || '').trim();
        // Auto path: a manual value appeared while we probed → keep it.
        if (!force && current) return f;
        return { ...f, duration: secondsToDuration(secs) };
      });
      setDetectStatus('ok');
      if (errors.duration) setErrors((e) => ({ ...e, duration: null }));
    } else {
      setDetectStatus('failed');
    }
  }, [errors.duration]);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    // New/edited preview URL + empty duration → auto-probe after the
    // user stops typing. The explicit Detect button covers retries.
    if (field === 'preview_url') {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
      // Any URL edit invalidates in-flight probes for the old URL.
      probeSeqRef.current += 1;
      const url = value.trim();
      const hasManualDuration = Boolean((form.duration || '').trim());
      if (url && !hasManualDuration) {
        detectTimerRef.current = setTimeout(() => {
          runDurationDetection(url);
        }, 900);
      } else if (!url) {
        setDetectStatus('idle');
      }
    }
    if (field === 'video_url') {
      // The video duration is reported by react-player's onDuration
      // (MediaUrlField) — no timer or probe needed here. Reset the
      // hint when the field is cleared so a stale duration can't
      // linger next to an empty URL.
      if (!value.trim()) {
        setVideoDetectStatus('idle');
        setVideoDetectedDuration('');
      }
    }
  }, [errors, form.duration, runDurationDetection]);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = lang === 'ht' ? 'Tit oblije' : 'Title required';
    if (!form.artist.trim()) errs.artist = lang === 'ht' ? 'Non atis oblije' : 'Artist name required';
    if (!form.duration.trim()) errs.duration = lang === 'ht' ? 'Dire oblije' : 'Duration required';
    if (form.duration.trim() && !/^\d{1,2}:[0-5]\d$/.test(form.duration.trim())) {
      errs.duration = lang === 'ht' ? 'Fòma: M:SS (egzanp: 3:42)' : 'Format: M:SS (e.g. 3:42)';
    }
    if (!form.cover_url.trim()) errs.cover_url = lang === 'ht' ? 'URL kouvèti oblije' : 'Cover URL required';
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await musicService.update(item.id, {
          title: form.title.trim(),
          artist: form.artist.trim(),
          genre: form.genre.trim() || undefined,
          cover_url: form.cover_url.trim(),
          preview_url: form.preview_url.trim() || undefined,
          video_url: form.video_url.trim() || undefined,
          duration: form.duration.trim(),
          tags: parseHashtags(form.hashtags),
        });
      } else {
        await api.post('explore/music/', {
          title: form.title.trim(),
          artist: form.artist.trim(),
          genre: form.genre.trim() || undefined,
          cover_url: form.cover_url.trim(),
          preview_url: form.preview_url.trim() || undefined,
          video_url: form.video_url.trim() || undefined,
          duration: form.duration.trim(),
          tags: parseHashtags(form.hashtags),
        });
      }
      showToast?.(
        isEdit
          ? (lang === 'ht' ? '✅ Mizik mete ajou!' : '✅ Music track updated!')
          : (lang === 'ht' ? '✅ Mizik ajoute avèk siksè!' : '✅ Music track added successfully!'),
        'check-circle',
      );
      onSuccess?.(); onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.title?.[0]
        || err?.response?.data?.artist?.[0]
        || err?.response?.data?.cover_url?.[0]
        || err?.message
        || (lang === 'ht' ? 'Pa t kapab ajoute mizik la.' : 'Could not add music track.');
      setErrors((e) => ({ ...e, _api: detail }));
      showToast?.(detail, 'circle-exclamation');
    } finally { setLoading(false); }
  }, [form, lang, showToast, onSuccess, onClose]);

  return (
    <StudioModal onClose={onClose} icon="fa-music"
      title={lang === 'ht' ? 'Ajoute Mizik' : 'Add Music Track'}
      subtitle={isEdit
        ? (lang === 'ht' ? 'Modifye mizik la' : 'Edit this music track')
        : (lang === 'ht' ? 'Pataje yon track mizik ou kreye' : 'Share a music track you created')}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errors._api && <div className={styles.apiError} role="alert">{errors._api}</div>}
        {isEdit && (
          <div className={styles.editBanner}>
            <i className="fas fa-pen" aria-hidden="true" /> {lang === 'ht' ? 'Ap modifye' : 'Editing'} <strong>{form.title}</strong>
          </div>
        )}
        <LoadingOverlay loading={loading}>
          <FormSection
            icon="fa-info-circle"
            title={lang === 'ht' ? 'Enfòmasyon Mizik' : 'Track Information'}
            hint={lang === 'ht' ? 'Detay debaz sou track la.' : 'Basic details about the track.'}
          >
            <FormField label={lang === 'ht' ? 'Tit' : 'Title'} required error={errors.title}>
              <input className={styles.input} value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={lang === 'ht' ? 'Antre tit mizik la' : 'Enter track title'}
                maxLength={200} autoFocus />
            </FormField>
            <div className={styles.row}>
              <FormField label={lang === 'ht' ? 'Atis' : 'Artist'} required error={errors.artist}>
                <input className={styles.input} value={form.artist}
                  onChange={(e) => handleChange('artist', e.target.value)}
                  placeholder={lang === 'ht' ? 'Non atis la' : 'Artist name'} />
              </FormField>
              <FormField label={lang === 'ht' ? 'Jen' : 'Genre'}>
                <input className={styles.input} value={form.genre}
                  onChange={(e) => handleChange('genre', e.target.value)}
                  placeholder={lang === 'ht' ? 'Rap, Kompa, Jazz...' : 'Rap, Kompa, Jazz...'} />
              </FormField>
            </div>
            <FormField label={lang === 'ht' ? 'Dire' : 'Duration'} required error={errors.duration}
              hint={detectStatus === 'ok'
                ? (lang === 'ht' ? `Detekte otomatikman: ${form.duration} ✓` : `Auto-detected: ${form.duration} ✓`)
                : detectStatus === 'failed'
                  ? (lang === 'ht' ? 'Pa t kapab detekte — antre l manyèlman (M:SS)' : 'Could not detect — enter manually (M:SS)')
                  : detectStatus === 'detecting'
                    ? (lang === 'ht' ? 'Ap detekte dire a...' : 'Detecting duration...')
                    : 'M:SS (3:42) — oswa kite sistèm lan detekte l'}> 
              <div className={styles.durationRow}>
                <input className={styles.input} value={form.duration}
                  onChange={(e) => handleChange('duration', e.target.value)}
                  placeholder="3:42"
                  disabled={detectStatus === 'detecting'} />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const url = form.preview_url.trim();
                    if (!url) {
                      showToast?.(lang === 'ht' ? 'Antre URL preview a an premye' : 'Add the preview URL first', 'circle-exclamation');
                      return;
                    }
                    // Explicit click → overwrite any existing value with
                    // the freshly detected duration. Cancel any queued
                    // auto-probe so the two don't both run.
                    if (detectTimerRef.current) {
                      clearTimeout(detectTimerRef.current);
                      detectTimerRef.current = null;
                    }
                    runDurationDetection(url, true);
                  }}
                  disabled={detectStatus === 'detecting' || !form.preview_url.trim()}
                  title={lang === 'ht' ? 'Detekte dire a otomatikman' : 'Auto-detect the duration'}
                  style={{ flexShrink: 0 }}
                >
                  {detectStatus === 'detecting' ? (
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                  ) : (
                    <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
                  )}
                  <span>{lang === 'ht' ? 'Detekte' : 'Detect'}</span>
                </button>
              </div>
              <HelpTip help={{
                ht: 'Fòma a se M:SS (egzanp: 3:42 = twa minit karant-de segonn). Si ou bay yon URL preview, sistèm nan detekte dire a otomatikman — pa bezwen kalkile li.',
                en: 'Format is M:SS (e.g. 3:42 = three minutes, forty-two seconds). If you provide a preview URL, the system detects the duration automatically — no math needed.',
              }} lang={lang} />
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-hashtag"
            title={lang === 'ht' ? 'Dekouvèt' : 'Discovery'}
            hint={lang === 'ht' ? 'Hashtags yo alimante trending sou Explore.' : 'Hashtags feed trending on Explore.'}
          >
            <FormField label={lang === 'ht' ? 'Hashtags' : 'Hashtags'}
              hint={lang === 'ht' ? 'Separe ak espas — #Kreyol #Music' : 'Separate with spaces — #Kreyol #Music'}>
              <div className={styles.inputWithHelp}>
                <input className={styles.input} value={form.hashtags}
                  onChange={(e) => handleChange('hashtags', e.target.value)}
                  placeholder="#Kreyol #Music #Haiti" maxLength={120} />
                <HelpTip help={HELP_COPY.hashtags} lang={lang} />
              </div>
            </FormField>
          </FormSection>

          <FormSection
            icon="fa-image"
            title={lang === 'ht' ? 'Kouvèti & Preview' : 'Cover & Preview'}
            hint={lang === 'ht' ? 'Imaj kouvèti a oblije; preview odyo a opsyonèl.' : 'Cover image is required; audio preview is optional.'}
          >
            <FieldTip>
              {lang === 'ht'
                ? 'Chak lyen ou mete a gen yon preview anba a — tcheke l anvan ou sove!'
                : 'Every link you add has a live preview below — check it before saving!'}
            </FieldTip>
            <ImageUrlField
              label={lang === 'ht' ? 'URL Kouvèti' : 'Cover URL'}
              value={form.cover_url}
              onChange={(v) => handleChange('cover_url', v)}
              required
              error={errors.cover_url}
              placeholder="https://example.com/cover.jpg"
              lang={lang}
              hint={lang === 'ht' ? 'URL DIRÈK imaj kouvèti a (.jpg, .png, .webp)' : 'Direct cover image URL (.jpg, .png, .webp)'}
            />
            <FormField label={lang === 'ht' ? 'URL Preview' : 'Preview URL'}
              hint={lang === 'ht' ? 'Lyen dirèk nan fichye odyo a (MP3, OGG) — opsyonèl' : 'Direct audio file link (MP3, OGG) — optional'}>
              <div className={styles.inputWithHelp}>
                <input className={styles.input} value={form.preview_url}
                  onChange={(e) => handleChange('preview_url', e.target.value)}
                  placeholder="https://storage.example.com/track.mp3" />
                <HelpTip help={HELP_COPY.audio} lang={lang} />
              </div>
            </FormField>
            <MediaUrlField
              label={lang === 'ht' ? 'URL Videyo' : 'Video URL'}
              value={form.video_url}
              onChange={(v) => handleChange('video_url', v)}
              kind="video"
              lang={lang}
              help={HELP_COPY.video}
              onDuration={handleVideoDuration}
              placeholder="https://www.youtube.com/watch?v=..."
              hint={videoDetectStatus === 'ok'
                ? (lang === 'ht' ? `Dire videyo a: ${videoDetectedDuration} ✓` : `Video duration: ${videoDetectedDuration} ✓`)
                : videoDetectStatus === 'failed'
                  ? (lang === 'ht' ? 'Pa t kapab detekte dire a — antre l manyèlman si li nesesè' : 'Could not detect the duration — enter it manually if needed')
                  : videoDetectStatus === 'detecting'
                    ? (lang === 'ht' ? 'Ap detekte dire videyo a...' : 'Detecting video duration...')
                    : (lang === 'ht' ? 'YouTube, Vimeo oswa fichye MP4/WebM — jwe preview anba a' : 'YouTube, Vimeo or direct MP4/WebM — preview plays below')}
            />
          </FormSection>
        </LoadingOverlay>
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {lang === 'ht' ? 'Anile' : 'Cancel'}
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap sove...' : 'Saving...'}</>
            ) : (
              <><i className={`fas ${isEdit ? 'fa-save' : 'fa-upload'}`} /> {isEdit
                ? (lang === 'ht' ? 'Mete ajou' : 'Update')
                : (lang === 'ht' ? 'Ajoute Mizik' : 'Add Track')}</>
            )}
          </button>
        </div>
      </form>
    </StudioModal>
  );
}
