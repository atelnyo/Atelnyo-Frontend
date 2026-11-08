/**
 * src/components/learning/blocks/SlidesBlock.jsx
 *
 * Slide deck block — the "PowerPoint-like" lesson format.
 *
 * Why it exists: long lessons used to be a single wall of text. A deck
 * lets a creator tell one idea per card — with an image, short bullets
 * (a diagram/schema), optional background music, and a smooth transition
 * between cards — while the learner keeps reading at their own pace.
 *
 * Behaviour:
 *   • One card at a time, Prev/Next + progress dots + arrow-key support.
 *   • Optional auto-advance (`autoplaySeconds`, 0 = manual).
 *   • Optional background music (`audioUrl`) — never autoplays (browsers
 *     block it); the learner taps play, and it pauses with the deck.
 *   • Whole deck marks complete only when the LAST card has been seen —
 *     honest progress, same contract as the video block.
 *   • Respects prefers-reduced-motion and stays readable on phones.
 *
 * Block data shape:
 *   { id, type: 'slides', title,
 *     slides: [{ title, body, imageUrl, alt }],
 *     audioUrl: '', autoplaySeconds: 0, theme: 'brand' | 'light' | 'dark' }
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './SlidesBlock.css';

/** Small markdown-lite renderer: **bold**, *italic*, `code`, - bullets. */
function renderInline(text, keyBase) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={`${keyBase}-b-${key}`}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={`${keyBase}-i-${key}`}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={`${keyBase}-c-${key}`} className="ls-slides-code">{match[4]}</code>);
    last = match.index + match[0].length;
    key += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

/** Split a slide body into paragraphs and bullet groups. */
export function parseSlideBody(body) {
  if (!body) return [];
  const blocks = [];
  String(body).split(/\n{2,}/).forEach((chunk) => {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const bullets = lines.filter((l) => /^[-*•]\s+/.test(l));
    if (bullets.length === lines.length) {
      blocks.push({ type: 'ul', items: lines.map((l) => l.replace(/^[-*•]\s+/, '')) });
    } else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      blocks.push({ type: 'ol', items: lines.map((l) => l.replace(/^\d+[.)]\s+/, '')) });
    } else {
      blocks.push({ type: 'p', text: lines.join(' ') });
    }
  });
  return blocks;
}

export default function SlidesBlock({
  block,
  lang = 'ht',
  index,
  courseId,
  moduleIndex,
  onComplete,
  reportComplete,
}) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);

  const slides = useMemo(() => {
    const raw = Array.isArray(block?.slides) ? block.slides : [];
    const cleaned = raw
      .map((s, i) => {
        if (!s) return null;
        if (typeof s === 'string') return { title: `Slide ${i + 1}`, body: s, imageUrl: '', alt: '' };
        return {
          title: typeof s.title === 'string' ? s.title : '',
          body: typeof s.body === 'string' ? s.body : (Array.isArray(s.bullets) ? s.bullets.map((b) => `- ${b}`).join('\n') : ''),
          imageUrl: s.imageUrl || '',
          alt: s.alt || '',
        };
      })
      .filter(Boolean);
    return cleaned;
  }, [block?.slides]);

  const theme = block?.theme === 'dark' || block?.theme === 'light' ? block.theme : 'brand';
  const autoplaySeconds = Number(block?.autoplaySeconds) || 0;
  const audioUrl = block?.audioUrl || '';

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});
  const completedRef = useRef(false);
  const slideRef = useRef(null);
  const audioRef = useRef(null);

  const lastIndex = Math.max(slides.length - 1, 0);
  const slide = slides[current] || null;

  /** Mark the deck complete once the last card is actually seen. */
  const markComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    (reportComplete || onComplete)?.(moduleIndex, block?.id, 'slides');
  }, [reportComplete, onComplete, moduleIndex, block?.id]);

  useEffect(() => {
    if (slides.length > 0 && current >= lastIndex) markComplete();
  }, [current, lastIndex, slides.length, markComplete]);

  const go = useCallback((next) => {
    setCurrent((prev) => {
      const target = Math.min(Math.max(next, 0), lastIndex);
      return target;
    });
  }, [lastIndex]);

  // Autoplay — pauses when the tab is hidden so nobody loses their place.
  useEffect(() => {
    if (!playing || autoplaySeconds <= 0 || slides.length <= 1) return undefined;
    if (current >= lastIndex) { setPlaying(false); return undefined; }
    const timer = window.setTimeout(() => go(current + 1), autoplaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, autoplaySeconds, current, go, lastIndex, slides.length]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Keep music in sync with the deck's own pause state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!musicOn) el.pause();
    else el.play().catch(() => setMusicOn(false)); // autoplay-blocked → stay off
  }, [musicOn]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
  }, [current, go]);

  if (slides.length === 0) {
    return (
      <div className="ls-slides-block ls-slides--empty">
        <p>{t('This deck has no slides yet.', 'Diaporama sa a pa gen okenn kat ankò.')}</p>
      </div>
    );
  }

  const bodyBlocks = parseSlideBody(slide.body);
  const dots = slides.length;

  return (
    <div
      className={`ls-slides-block ls-slides--${theme}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={block?.title || t('Slide deck', 'Diaporama')}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={slideRef}
    >
      <div className="ls-slides-head">
        <h3 className="ls-slides-title">{block?.title || t('Slide deck', 'Diaporama')}</h3>
        <div className="ls-slides-head-tools">
          {audioUrl && (
            <button
              type="button"
              className="ls-slides-tool"
              onClick={() => setMusicOn((v) => !v)}
              aria-pressed={musicOn}
              title={t('Background music', 'Mizik an fon')}
            >
              <i className={`fas ${musicOn ? 'fa-volume-high' : 'fa-volume-xmark'}`} aria-hidden="true" />
              <span>{musicOn ? t('Music on', 'Mizik ouvè') : t('Music', 'Mizik')}</span>
            </button>
          )}
          {autoplaySeconds > 0 && slides.length > 1 && (
            <button
              type="button"
              className="ls-slides-tool"
              onClick={() => setPlaying((v) => !v)}
              aria-pressed={playing}
              title={t('Auto-play', 'Defile otomatik')}
            >
              <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
              <span>{playing ? t('Pause', 'Poz') : t('Play', 'Jwe')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="ls-slides-stage">
        <div
          className="ls-slides-card"
          key={`slide-${current}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {slide.imageUrl && (
            <div className="ls-slides-media">
              {!loadedImages[current] && <span className="ls-slides-skeleton" aria-hidden="true" />}
              <img
                src={slide.imageUrl}
                alt={slide.alt || slide.title || `${t('Slide', 'Kat')} ${current + 1}`}
                loading="lazy"
                className="ls-slides-image"
                style={{ opacity: loadedImages[current] ? 1 : 0 }}
                onLoad={() => setLoadedImages((prev) => ({ ...prev, [current]: true }))}
                onError={() => setLoadedImages((prev) => ({ ...prev, [current]: true }))}
              />
            </div>
          )}

          <div className="ls-slides-body">
            {slide.title && <h4 className="ls-slides-card-title">{renderInline(slide.title, `t-${current}`)}</h4>}
            {bodyBlocks.map((chunk, bi) => {
              // Elements reveal one after another (like a presentation build),
              // capped so a long card never takes forever to finish.
              const stepDelay = Math.min(bi, 6) * 90;

              if (chunk.type === 'ul' || chunk.type === 'ol') {
                const ListTag = chunk.type === 'ul' ? 'ul' : 'ol';
                return (
                  <ListTag
                    key={`b-${bi}`}
                    className={`ls-slides-list${chunk.type === 'ol' ? ' ls-slides-list--ol' : ''}`}
                  >
                    {chunk.items.map((item, ii) => (
                      <li
                        key={`i-${ii}`}
                        className="ls-slides-item"
                        style={{ animationDelay: `${stepDelay + ii * 80}ms` }}
                      >
                        {renderInline(item, `u-${bi}-${ii}`)}
                      </li>
                    ))}
                  </ListTag>
                );
              }
              return (
                <p
                  key={`b-${bi}`}
                  className="ls-slides-text ls-slides-item"
                  style={{ animationDelay: `${stepDelay}ms` }}
                >
                  {renderInline(chunk.text, `p-${bi}`)}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ls-slides-footer">
        <button
          type="button"
          className="ls-slides-nav"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          aria-label={t('Previous slide', 'Kat anvan')}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>

        <div className="ls-slides-dots" role="tablist" aria-label={t('Slides', 'Kat yo')}>
          {Array.from({ length: dots }).map((_, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`${t('Slide', 'Kat')} ${i + 1} / ${dots}`}
              className={`ls-slides-dot${i === current ? ' is-active' : ''}${i < current ? ' is-done' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <span className="ls-slides-count" aria-hidden="true">{current + 1}/{dots}</span>

        <button
          type="button"
          className="ls-slides-nav ls-slides-nav--next"
          onClick={() => go(current + 1)}
          disabled={current >= lastIndex}
          aria-label={t('Next slide', 'Pwochen kat')}
        >
          <i className="fas fa-arrow-right" aria-hidden="true" />
        </button>
      </div>

      {current >= lastIndex && (
        <p className="ls-slides-done" role="status">
          <i className="fas fa-circle-check" aria-hidden="true" />{' '}
          {t('Deck finished — you can keep reading or continue.', 'Ou fin gade tout kat yo — ou ka kontinye.')}
        </p>
      )}

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} loop preload="none" className="ls-slides-audio">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}
