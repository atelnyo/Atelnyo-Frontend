/**
 * src/components/studio/editor/MusicEditor.jsx
 *
 * EDITOR-FIRST music creation workspace (replaces MusicUploadModal).
 *
 * Music is MEDIA, so the workspace leads with the media:
 *   • CENTER — cover artwork + live audio player + track title/artist
 *   • RIGHT  — contextual properties: genre, duration (with the same
 *              auto-detect), cover/preview/video URLs, hashtags
 *
 * Save behavior mirrors the existing music API exactly (POST
 * /api/explore/music/ or PUT via musicService). Autosave kicks in once
 * the track exists; saveState drives the shell pill.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api, { musicService } from '../../../services/api';
import useSafeNavigate from '../../../hooks/useSafeNavigate';
import { parseHashtags, hashtagsToInput } from '../../../utils/hashtags';
import MusicSheet from '../../explore/MusicSheet';
import MediaUploadButton from './MediaUploadButton';
import AudioLibraryModal from './AudioLibraryModal';
import './MediaUploadButton.css';
import StudioEditorShell from './StudioEditorShell';
import StudioPropertiesPanel, {
  PropertyGroup, PropField, PropInput,
} from './StudioPropertiesPanel';
import { ImageUrlField, MediaUrlField, HelpTip, HELP_COPY } from '../modals/shared';
import styles from './editor.module.css';

function secondsToDuration(secs) {
  const total = Math.max(0, Math.round(secs));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Probe an AUDIO URL for its duration (existing behavior, preserved). */
function probeAudioDuration(url) {
  return new Promise((resolve) => {
    const trimmed = (url || '').trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) { resolve(null); return; }
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
    function onError() { cleanup(); resolve(null); }
    el = new Audio();
    el.preload = 'metadata';
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('error', onError);
    el.src = trimmed;
  });
}

export default function MusicEditor({ onClose, onSuccess, lang = 'ht', showToast, user, item }) {
  const isPremium = !!(user?.premium?.is_premium);
  const isEdit = Boolean(item);
  const navigate = useSafeNavigate();
  const isHt = lang === 'ht';

  const [form, setForm] = useState({
    title: item?.title || '',
    artist: item?.artist || '',
    genre: item?.genre || '',
    cover_url: item?.cover_url || '',
    preview_url: item?.preview_url || '',
    video_url: item?.video_url || '',
    duration: item?.duration || '',
    hashtags: hashtagsToInput(item?.tags),
  });
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState('idle');
  const [detectStatus, setDetectStatus] = useState('idle'); // idle|detecting|ok|failed
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTrack, setPreviewTrack] = useState(null);
  const [hasSaved, setHasSaved] = useState(isEdit);
  const savedIdRef = useRef(isEdit ? item.id : null);
  const autoSaveTimer = useRef(null);
  const probeSeqRef = useRef(0);
  const detectTimerRef = useRef(null);
  // ``dirty`` state drives the shell's unsaved-changes guard; the ref
  // mirrors it for effects/handlers only.
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
      setSaveState('dirty');
    }
  }, []);

  const runDetection = useCallback(async (url, force = false) => {
    const mySeq = probeSeqRef.current;
    setDetectStatus('detecting');
    const secs = await probeAudioDuration(url);
    if (probeSeqRef.current !== mySeq) return;
    if (secs != null) {
      setForm((f) => {
        const current = (f.duration || '').trim();
        if (!force && current) return f;
        return { ...f, duration: secondsToDuration(secs) };
      });
      setDetectStatus('ok');
    } else {
      setDetectStatus('failed');
    }
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
    markDirty();
    if (field === 'preview_url') {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
      probeSeqRef.current += 1;
      const url = value.trim();
      if (url && !(form.duration || '').trim()) {
        detectTimerRef.current = setTimeout(() => runDetection(url), 900);
      } else if (!url) {
        setDetectStatus('idle');
      }
    }
  }, [errors, form.duration, markDirty, runDetection]);

  // ─── Validation (mirrors MusicUploadModal) ───────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!form.title.trim()) errs.title = isHt ? 'Tit oblije' : 'Title required';
    if (!form.artist.trim()) errs.artist = isHt ? 'Non atis oblije' : 'Artist name required';
    if (!form.duration.trim()) errs.duration = isHt ? 'Dire oblije' : 'Duration required';
    if (form.duration.trim() && !/^\d{1,2}:[0-5]\d$/.test(form.duration.trim())) {
      errs.duration = isHt ? 'Fòma: M:SS (egzanp: 3:42)' : 'Format: M:SS (e.g. 3:42)';
    }
    if (!form.cover_url.trim()) errs.cover_url = isHt ? 'URL kouvèti oblije' : 'Cover URL required';
    return errs;
  }, [form.title, form.artist, form.duration, form.cover_url, isHt]);

  const readiness = useCallback(() => {
    const items = [];
    if (!form.title.trim()) items.push({ message: isHt ? 'Ajoute tit mizik la' : 'Add the track title', target: 'canvas' });
    if (!form.artist.trim()) items.push({ message: isHt ? 'Ajoute non atis la' : 'Add the artist name', target: 'canvas' });
    if (!form.cover_url.trim()) items.push({ message: isHt ? 'Ajoute yon kouvèti' : 'Add cover art', target: 'props' });
    if (!form.duration.trim()) items.push({ message: isHt ? 'Ajoute dire a (M:SS)' : 'Add the duration (M:SS)', target: 'props' });
    return items;
  }, [form.title, form.artist, form.cover_url, form.duration, isHt]);

  const doSave = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSaveState('dirty');
      return false;
    }
    setErrors({});
    setSaveState('saving');
    const payload = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      genre: form.genre.trim() || undefined,
      cover_url: form.cover_url.trim(),
      preview_url: form.preview_url.trim() || undefined,
      video_url: form.video_url.trim() || undefined,
      duration: form.duration.trim(),
      tags: parseHashtags(form.hashtags),
    };
    try {
      let saved;
      if (savedIdRef.current) {
        saved = await musicService.update(savedIdRef.current, payload);
      } else {
        const res = await api.post('explore/music/', payload);
        saved = res.data;
      }
      if (saved?.id) savedIdRef.current = saved.id;
      setHasSaved(true);
      dirtyRef.current = false;
      setDirty(false);
      setSaveState('saved');
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.title?.[0]
        || err?.response?.data?.artist?.[0]
        || err?.response?.data?.cover_url?.[0]
        || err?.message
        || (isHt ? 'Pa t kapab sove mizik la.' : 'Could not save the music track.');
      setSaveState('error');
      showToast?.(detail, 'circle-exclamation');
      return false;
    }
  }, [form, validate, isHt, showToast]);

  // ─── Debounced autosave after the track exists ───────────────────────
  useEffect(() => {
    if (!dirtyRef.current || saveState === 'saving' || !savedIdRef.current) return undefined;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { doSave(); }, 2200);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, saveState, doSave]);

  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
  }, []);

  const handleSave = useCallback(() => { doSave(); }, [doSave]);

  const handlePreview = useCallback(() => {
    const draftTrack = {
      id: savedIdRef.current || 'draft-music',
      title: form.title.trim() || (isHt ? 'Mizik Sans Tit' : 'Untitled track'),
      artist: form.artist.trim() || (isHt ? 'Atis Enkoni' : 'Unknown artist'),
      genre: form.genre.trim(),
      cover: form.cover_url.trim(),
      cover_url: form.cover_url.trim(),
      preview: form.preview_url.trim(),
      preview_url: form.preview_url.trim(),
      video: form.video_url.trim(),
      video_url: form.video_url.trim(),
      duration: form.duration.trim() || '0:00',
      description: '',
      tags: parseHashtags(form.hashtags),
      slug: (form.title.trim() || 'draft-music').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    };
    setPreviewTrack(draftTrack);
    setPreviewOpen(true);
  }, [form, isHt]);

  // ─── Media-first canvas ──────────────────────────────────────────────
  const editorPanel = (
    <div className={styles.editorSection}>
      <header className={styles.editorSectionHeader}>
        <span className={styles.editorSectionIcon}>
          <i className="fas fa-music" aria-hidden="true" />
        </span>
        <div>
          <h2 className={styles.editorSectionTitle}>{isHt ? 'Workshop Mizik' : 'Music Workspace'}</h2>
          <p className={styles.editorSectionHint}>
            {isHt ? 'Kouvèti, tit ak preview — pataje mizik ou vit.' : 'Cover art, title and preview — share your track fast.'}
          </p>
        </div>
      </header>
      <div className={`${styles.canvas} ${styles.mediaCanvas}`}>
        <div className={styles.mediaPreview}>
          {form.cover_url ? (
            <img src={form.cover_url} alt={isHt ? 'Kouvèti mizik' : 'Track cover'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className={styles.mediaPreviewPlaceholder}>
              <i className="fas fa-compact-disc" aria-hidden="true" />
              <span>{isHt ? 'Ajoute yon kouvèti (jaden Media a)' : 'Add cover art (via the Media panel)'}</span>
            </div>
          )}
          <span className={styles.mediaPreviewBadge}>
            {form.duration ? <><i className="fas fa-clock" aria-hidden="true" /> {form.duration}</> : isHt ? 'Kouvèti' : 'Cover'}
          </span>
        </div>

        {form.preview_url && (
          <div className={styles.mediaPreview}>
            <audio controls src={form.preview_url} style={{ width: '100%', margin: 'var(--sp-2xl)' }} />
            <span className={styles.mediaPreviewBadge}>
              <i className="fas fa-headphones" aria-hidden="true" /> {isHt ? 'Preview odyo' : 'Audio preview'}
            </span>
          </div>
        )}

        <input
          className={styles.canvasTitle}
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder={isHt ? 'Tit mizik la...' : 'Track title…'}
          maxLength={200}
          aria-invalid={errors.title ? 'true' : 'false'}
        />
        {errors.title && (
          <span className={styles.propsError} role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.title}
          </span>
        )}
        <input
          className={styles.canvasTitle}
          value={form.artist}
          onChange={(e) => handleChange('artist', e.target.value)}
          placeholder={isHt ? 'Non atis la...' : 'Artist name…'}
          maxLength={200}
          style={{ fontSize: 'var(--text-xl)', borderBottom: '1px solid var(--border-color)' }}
          aria-invalid={errors.artist ? 'true' : 'false'}
        />
        {errors.artist && (
          <span className={styles.propsError} role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.artist}
          </span>
        )}
      </div>
    </div>
  );

  // ─── Properties ──────────────────────────────────────────────────────
  const propsPanel = (
    <>
      <PropertyGroup icon="fa-circle-info" label="Track Information" labelHt="Enfòmasyon Mizik" lang={lang} defaultOpen>
        <PropField label="Genre" labelHt="Jen" lang={lang}>
          <PropInput
            value={form.genre}
            onChange={(e) => handleChange('genre', e.target.value)}
            placeholder={isHt ? 'Rap, Kompa, Jazz...' : 'Rap, Kompa, Jazz…'}
          />
        </PropField>
        <PropField
          label="Duration"
          labelHt="Dire"
          lang={lang}
          required
          error={errors.duration}
          hint={detectStatus === 'ok'
            ? (isHt ? `Detekte otomatikman: ${form.duration} ✓` : `Auto-detected: ${form.duration} ✓`)
            : detectStatus === 'failed'
              ? (isHt ? 'Pa t kapab detekte — antre l manyèlman (M:SS)' : 'Could not detect — enter manually (M:SS)')
              : detectStatus === 'detecting'
                ? (isHt ? 'Ap detekte dire a...' : 'Detecting duration…')
                : (isHt ? 'M:SS (3:42) — oswa kite sistèm lan detekte l' : 'M:SS (3:42) — or let the system detect it')}
        >
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'stretch' }}>
            <PropInput
              value={form.duration}
              onChange={(e) => handleChange('duration', e.target.value)}
              placeholder="3:42"
              disabled={detectStatus === 'detecting'}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const url = form.preview_url.trim();
                if (!url) {
                  showToast?.(isHt ? 'Antre URL preview a an premye' : 'Add the preview URL first', 'circle-exclamation');
                  return;
                }
                if (detectTimerRef.current) { clearTimeout(detectTimerRef.current); detectTimerRef.current = null; }
                runDetection(url, true);
              }}
              disabled={detectStatus === 'detecting' || !form.preview_url.trim()}
              title={isHt ? 'Detekte dire a otomatikman' : 'Auto-detect the duration'}
            >
              {detectStatus === 'detecting' ? (
                <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              ) : (
                <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
              )}
            </button>
          </div>
        </PropField>
      </PropertyGroup>

      <PropertyGroup icon="fa-image" label="Media" labelHt="Medya" lang={lang}>
        <MediaUploadButton
          value={form.cover_url}
          onChange={(v) => handleChange('cover_url', v)}
          kind="image"
          label={isHt ? 'Imaj Kouvèti' : 'Cover Image'}
          placeholder="https://example.com/cover.jpg"
          isPremium={isPremium}
          required
          error={errors.cover_url}
          lang={lang}
        />
        <PropField
          label="Preview URL"
          labelHt="URL Preview"
          lang={lang}
          hint={isHt ? 'Lyen dirèk nan fichye odyo a (MP3, OGG) — opsyonèl' : 'Direct audio file link (MP3, OGG) — optional'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <div style={{ flex: 1 }}>
              <MediaUploadButton
                value={form.preview_url}
                onChange={(v) => handleChange('preview_url', v)}
                kind="audio"
                label={isHt ? 'Preview Odyo' : 'Audio Preview'}
                placeholder="https://storage.example.com/track.mp3"
                isPremium={isPremium}
                lang={lang}
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowLibrary(true)}
              title={isHt ? 'Chwazi odyo nan bibliyotèk la' : 'Choose audio from your library'}
              style={{ minWidth: 90 }}
            >
              <i className="fas fa-folder-music" aria-hidden="true" /> {' '}
              {isHt ? 'Bibliyotèk' : 'Library'}
            </button>
            <HelpTip help={HELP_COPY.audio} lang={lang} />
          </div>
        </PropField>
        <MediaUploadButton
          value={form.video_url}
          onChange={(v) => handleChange('video_url', v)}
          kind="video"
          label={isHt ? 'Videyo' : 'Video'}
          placeholder="https://www.youtube.com/watch?v=..."
          isPremium={isPremium}
          lang={lang}
        />
      </PropertyGroup>

      <PropertyGroup icon="fa-hashtag" label="Discovery" labelHt="Dekouvèt" lang={lang}>
        <PropField
          label="Hashtags"
          labelHt="Hashtags"
          lang={lang}
          hint={isHt ? 'Separe ak espas — #Kreyol #Music' : 'Separate with spaces — #Kreyol #Music'}
        >
          <PropInput
            value={form.hashtags}
            onChange={(e) => handleChange('hashtags', e.target.value)}
            placeholder="#Kreyol #Music #Haiti"
            maxLength={120}
          />
        </PropField>
      </PropertyGroup>

      <PropertyGroup icon="fa-rocket" label="Publishing" labelHt="Piblikasyon" lang={lang}>
        <p className={styles.propsHint}>
          {isHt
            ? 'Mizik pibliye imedyatman lè w sove — pa gen eta bouyon pou mizik.'
            : 'Music publishes immediately on save — there is no draft state for tracks.'}
        </p>
      </PropertyGroup>
    </>
  );

  return (
    <>
      <StudioEditorShell
        title={isHt ? 'Editè Mizik' : 'Music Editor'}
        icon="fa-music"
        lang={lang}
        docTitle={form.title.trim()}
        isNew={!isEdit}
        dirty={dirty}
        saveState={saveState}
        onBack={onClose}
        onPreview={handlePreview}
        onSave={handleSave}
        saveLabel={hasSaved ? (isHt ? 'Sove' : 'Save') : (isHt ? 'Kreye Mizik' : 'Create Track')}
        canSave
        validation={readiness()}
        onFixValidation={() => {}}
        editor={editorPanel}
        properties={<StudioPropertiesPanel lang={lang}>{propsPanel}</StudioPropertiesPanel>}
      />

      {previewOpen && previewTrack && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.72)', zIndex: 3000, overflowY: 'auto' }}>
          <div style={{ position: 'relative', minHeight: '100%' }}>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{ position: 'absolute', top: 18, right: 18, zIndex: 1, border: 'none', borderRadius: 999, width: 42, height: 42, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              aria-label={isHt ? 'Fèmen preview' : 'Close preview'}
            >
              <i className="fas fa-xmark" aria-hidden="true" />
            </button>
            <MusicSheet
              lang={lang}
              track={previewTrack}
              user={user}
              showToast={showToast}
              onBack={() => setPreviewOpen(false)}
            />
          </div>
        </div>
      )}

      {showLibrary && (
        <AudioLibraryModal
          lang={lang}
          onClose={() => setShowLibrary(false)}
          onSelect={(item) => {
            const url = item?.media_url || '';
            if (url) {
              handleChange('preview_url', url);
              if (!form.duration.trim()) {
                runDetection(url, true);
              }
            }
            setShowLibrary(false);
          }}
        />
      )}
    </>
  );
}
