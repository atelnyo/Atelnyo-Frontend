/**
 * src/components/studio/modals/shared.jsx
 *
 * Shared modal primitives — reused by all modal components.
 *   - StudioModal: backdrop + card + header + close
 *   - FormField: label + input wrapper + error + hint
 *   - FormSection: logical grouping (title + icon + hint + fields)
 *   - ImageUrlField: URL input with debounced validation + preview
 *   - LoadingOverlay: spinner overlay during API calls
 *
 * Extracted from StudioModals.jsx during Etap 3 refactor; the section +
 * image-URL primitives were added during the Creator Studio creation-UI
 * professionalization so every creation form shares one field system
 * instead of four hand-rolled copies of the validation block.
 */
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { mediaProviderService } from '../../../services/api';
import styles from './modals.module.css';

// react-player is lazy-loaded so the base modal bundle never pays its
// weight — the player chunk only downloads the first time a creator
// opens a media field that actually renders video. It plays YouTube /
// Vimeo / direct MP4 / WebM through one component.
// react-player v3 has no `lazy` subpath (removed in v3 — that was a v2
// entry). We still React.lazy the whole module so the studio modal bundle
// never pays its cost: the player chunk downloads only when a creator
// actually pastes a video URL into a media field.
const ReactPlayer = lazy(() => import('react-player'));

// Shared field-education copy. Every media modal can pass these as the
// ``help`` prop of a HelpTip so creators understand WHAT the field does
// and WHY the format matters — in Kreyòl + English.
export const HELP_COPY = {
  cover: {
    ht: 'Kole yon URL imaj DIRÈK (.jpg, .png, .webp). Li pa dwe yon paj galri — browser a bezwen wè fichye imaj la pou montre l sou kard la. Yon bon kouvèti (carre oswa 16:9) fè kontni ou parèt nan Explore.',
    en: 'Paste a DIRECT image URL (.jpg, .png, .webp). It must not be a gallery page — the browser needs the actual image file to render it on the card. A strong cover (square or 16:9) makes your content stand out in Explore.',
  },
  video: {
    ht: 'Ou ka kole: 1) yon lyen videyo YouTube, Vimeo, Facebook oswa TikTok, oswa 2) yon URL dirèk nan yon fichye videyo (.mp4, .webm). Preview la ap jwe anba a pou w konfime li byen mache anvan w sove. YouTube ak Vimeo jwe otomatik sou kard la lè w hover; Facebook, TikTok ak lòt yo jwe sou paj detay la.',
    en: 'You can paste: 1) a video link from YouTube, Vimeo, Facebook or TikTok, or 2) a direct video file URL (.mp4, .webm). The preview below lets you confirm it plays before saving. YouTube and Vimeo autoplay on the card when hovered; Facebook, TikTok and other embeds play on the detail page.',
  },
  audio: {
    ht: 'Kole yon URL dirèk nan yon fichye odyo (.mp3, .ogg). Preview a jwe anba a pou verifye l. Sistèm nan ap detekte dire a otomatikman lè w kite jaden an.',
    en: 'Paste a direct audio file URL (.mp3, .ogg). The preview below lets you verify it. The system auto-detects the duration when you leave the field.',
  },
  hashtags: {
    ht: 'Hashtags ede moun jwenn kontni ou. Separe yo ak espas: #Kreyol #Music. Yo alimante mòd "tande" (trending) sou Explore epi yo pa janm obligatwa pou pibliye.',
    en: 'Hashtags help people discover your content. Separate them with spaces: #Kreyol #Music. They feed the trending rail on Explore and are never required to publish.',
  },
};

export function StudioModal({ onClose, title, icon, subtitle, children, wide }) {
  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }, [onClose]);

  // Phase 10: Focus trap — focus first focusable element on mount
  const cardRef = useCallback((node) => {
    if (node) {
      // Focus the first focusable element inside the modal
      const focusable = node.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus();
    }
  }, []);

  // Phase 10: Escape key to close + body scroll lock
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={cardRef}
        className={`${styles.card} ${wide ? styles.cardWide : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
            <div>
              <h3 className={styles.title}>{title}</h3>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, error, children, required, hint }) {
  return (
    <label className={`${styles.field} ${error ? styles.fieldErrorVisible : ''}`}>
      <span className={styles.fieldLabel}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true"> *</span>
        )}
      </span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span className={styles.fieldError} role="alert">{error}</span>
      )}
    </label>
  );
}

/**
 * HelpTip — a small "?" chip that expands an inline explanation under
 * the field. Pass ``help`` as a plain string (already-localized) or as
 * a ``{ ht, en }`` object and it resolves against ``lang``. Keeps the
 * form clutter-free while still teaching the creator why a format
 * matters (see HELP_COPY above for the shared copy bank).
 */
export function HelpTip({ help, lang = 'ht' }) {
  const [open, setOpen] = useState(false);
  if (!help) return null;
  const text = typeof help === 'string' ? help : (help[lang] || help.ht || help.en || '');
  if (!text) return null;
  return (
    <div className={styles.helpTipWrap}>
      <button
        type="button"
        className={`${styles.helpTipBtn}${open ? ' ' + styles.helpTipBtnOpen : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={lang === 'ht' ? 'Eksplikasyon' : 'Help'}
        title={lang === 'ht' ? 'Eksplikasyon' : 'Help'}
      >
        <i className="fas fa-circle-question" aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.helpTipBody} role="note">
          {text}
        </div>
      )}
    </div>
  );
}

/**
 * FieldTip — a compact "how-to" line rendered between the label and
 * the control. Lighter than HelpTip: always visible, one short line.
 * Use for format reminders ("M:SS", "separate with spaces").
 */
export function FieldTip({ children }) {
  if (!children) return null;
  return <span className={styles.fieldTip}>{children}</span>;
}

/**
 * MediaUrlField — a URL input with a LIVE preview:
 *
 *   • ``kind="image"``  → image thumbnail preview (same contract as
 *     ImageUrlField, minus the debounced server validation).
 *   • ``kind="video"``  → plays the URL in a lazy-loaded react-player
 *     (YouTube / Vimeo / direct MP4/WebM) + reports the duration via
 *     ``onDuration`` when the metadata loads. This is the modern,
 *     dependency-free way to preview a music-video / course-video /
 *     event-video URL before saving.
 *   • ``kind="auto"``   → guesses image vs video from the URL (used
 *     for fields that accept either).
 *
 * Props mirror FormField inputs: label, value, onChange, required,
 * error, placeholder, hint (small line under the control), help
 * ({ht,en} teaching copy → HelpTip), lang, disabled.
 */
export function MediaUrlField({
  label,
  value,
  onChange,
  required,
  error,
  placeholder,
  hint,
  help,
  lang = 'ht',
  disabled,
  kind = 'auto',
  onDuration,
  inputProps = {},
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const trimmed = (value || '').trim();
  const isHttp = /^https?:\/\//i.test(trimmed);

  const isImageUrl = () => {
    if (!isHttp) return false;
    const path = trimmed.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?|#|$)/.test(path)) return true;
    if (kind === 'image') return true;
    return false;
  };
  const isVideoUrl = () => {
    if (!isHttp) return false;
    // A URL that clearly points at an image file is NEVER a video —
    // even for kind="video", mounting react-player on a .jpg/.png
    // would just show the player's error state. Other unknown URLs
    // (kind="video") are treated as video so YouTube/Vimeo pages and
    // bare CDN links (no extension) still render the player.
    if (isImageUrl()) return false;
    if (kind === 'video') return true;
    const path = trimmed.toLowerCase();
    if (/\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/.test(path)) return true;
    if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(trimmed)) return true;
    return false;
  };

  const showImage = kind !== 'video' && isImageUrl() && !previewFailed;
  const showVideo = kind !== 'image' && isVideoUrl();

  // URL changed → the old error state no longer applies. Reset it in
  // the change handler (NOT an effect) so a broken image recovers as
  // soon as the creator edits the URL.
  const handleChange = (v) => {
    setPreviewFailed(false);
    onChange(v);
  };

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <div className={styles.inputWithHelp}>
        <input
          className={styles.input}
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          {...inputProps}
        />
        {help && <HelpTip help={help} lang={lang} />}
      </div>
      {showImage && (
        <img
          className={styles.imagePreview}
          src={trimmed}
          alt="Preview"
          onError={() => setPreviewFailed(true)}
        />
      )}
      {showVideo && (
        <div className={styles.videoPreviewWrap}>
          <Suspense
            fallback={
              <div className={styles.videoPreviewLoading}>
                <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                <span>{lang === 'ht' ? 'Ap chaje videyo a...' : 'Loading video...'}</span>
              </div>
            }
          >
            <ReactPlayer
              url={trimmed}
              controls
              width="100%"
              height="100%"
              light={false}
              playing={false}
              onDuration={onDuration}
            />
          </Suspense>
        </div>
      )}
    </FormField>
  );
}

/**
 * FormSection — logical grouping inside a creation form ("Basic
 * Information", "Pricing", "Publishing", ...). Adds a visual divider +
 * iconed heading so the creator understands what they are filling out
 * and why. Purely presentational — children are the fields.
 */
export function FormSection({ icon, title, hint, children }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        {icon && (
          <span className={styles.sectionIcon} aria-hidden="true">
            <i className={`fas ${icon}`} />
          </span>
        )}
        <div>
          <h4 className={styles.sectionTitle}>{title}</h4>
          {hint && <p className={styles.sectionHint}>{hint}</p>}
        </div>
      </header>
      <div className={styles.sectionFields}>{children}</div>
    </section>
  );
}

/**
 * ImageUrlField — a URL input with debounced server-side validation and
 * a live preview. Encapsulates the validation block that Course, Music,
 * Product and Project modals each hand-rolled (800ms debounce, 422
 * handling, thumbnail preview, valid/invalid status line) so a single
 * component owns the logic + styling.
 */
export function ImageUrlField({
  label, value, onChange, hint, required, error, placeholder, lang, disabled, help,
}) {
  const [validation, setValidation] = useState(null);
  const timerRef = useRef(null);

  // Debounced URL validation (mirrors the previous per-modal logic).
  // The synchronous ``setValidation`` calls below are the point of the
  // effect — reset/enter the checking state as the URL changes — so the
  // project-wide react-hooks/set-state-in-effect rule is disabled per
  // call (same convention as Explore.jsx and Mwen.jsx).
  useEffect(() => {
    const url = (value || '').trim();
    if (!url || !url.startsWith('https://')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValidation(null);
      return undefined;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValidation({ checking: true });
    timerRef.current = setTimeout(async () => {
      try {
        const res = await mediaProviderService.validateUrl(url);
        setValidation(res.data);
      } catch (err) {
        if (err.response?.status === 422) {
          setValidation(err.response.data);
        } else {
          setValidation({ checking: false, error_message: err.message || 'Validation failed' });
        }
      }
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  const showPreview = Boolean(value && value.startsWith('https://'));

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <div className={styles.inputWithHelp}>
        <input
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          type="url"
          inputMode="url"
        />
        {help && <HelpTip help={help} lang={lang} />}
      </div>
      {showPreview && (
        <img
          className={styles.imagePreview}
          src={(validation && !validation.checking && validation.is_valid && validation.thumbnail_base64)
            ? validation.thumbnail_base64
            : value}
          alt="Preview"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {validation && (
        <div className={styles.imageStatus} aria-live="polite">
          {validation.checking ? (
            <span className={styles.imageStatusChecking}>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" />
              <span>{lang === 'ht' ? 'Ap verifye...' : 'Checking...'}</span>
            </span>
          ) : validation.is_valid ? (
            <>
              <span className={styles.imageStatusValid}>
                <i className="fas fa-check-circle" aria-hidden="true" />
                <span>{lang === 'ht' ? 'Imaj valab' : 'Valid image'}</span>
              </span>
              {validation.mime_type && (
                <span className={styles.imageMeta}>{validation.mime_type}</span>
              )}
              {validation.width && validation.height && (
                <span className={styles.imageMeta}>
                  {validation.width}×{validation.height}
                </span>
              )}
              {validation.provider_name && (
                <span className={styles.imageProvider}>{validation.provider_name}</span>
              )}
            </>
          ) : (
            <span className={styles.imageStatusInvalid}>
              <i className="fas fa-exclamation-triangle" aria-hidden="true" />
              <span>
                {validation.error_message
                  || (lang === 'ht' ? 'URL pa valab — pa yon imaj' : 'Not a valid image URL')}
              </span>
            </span>
          )}
        </div>
      )}
    </FormField>
  );
}

export function LoadingOverlay({ loading, children }) {
  return (
    <div className={styles.loadingWrap}>
      {loading && (
        <div className={styles.loading} role="status" aria-busy="true">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
        </div>
      )}
      <div className={loading ? styles.loadingContent : ''}>
        {children}
      </div>
    </div>
  );
}
