/**
 * src/components/learning/AudioPlayer.jsx
 *
 * Reference-audio player for language practice — a real player card,
 * not a bare browser control:
 *   • Big play/pause button + clickable progress bar + time display.
 *   • Playback-rate toggle (1x → 1.25x → 1.5x → 0.75x) for slow listening.
 *   • Loading spinner while the file buffers, honest error state.
 *   • The <audio> element is kept (ref-driven) so assistive tech and
 *     keyboard users still get a real media element; the native
 *     controls are replaced by the card UI.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './learning.module.css';

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const RATES = [1, 1.25, 1.5, 0.75];

export default function AudioPlayer({ src, label, lang = 'ht', compact }) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht : en);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setLoading(true);
    setFailed(false);
    setCurrent(0);
    setDuration(0);
    setRateIdx(0);
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onTime = () => setCurrent(el.currentTime || 0);
    const onMeta = () => {
      setDuration(el.duration || 0);
      setLoading(false);
    };
    const onCanPlay = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => { setPlaying(true); setLoading(false); };
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => { setFailed(true); setLoading(false); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [src]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || failed) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => { setFailed(true); });
    }
  }, [playing, failed]);

  const seek = useCallback((e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  }, [duration]);

  const cycleRate = useCallback(() => {
    setRateIdx((i) => {
      const next = (i + 1) % RATES.length;
      if (audioRef.current) audioRef.current.playbackRate = RATES[next];
      return next;
    });
  }, []);

  if (!src) return null;

  if (failed) {
    return (
      <div className={compact ? styles.audioPlayerFailedCompact : styles.audioPlayerFailed} role="status">
        <i className="fas fa-volume-xmark" aria-hidden="true" />
        {t('Could not load the audio.', 'Pa t kapab chaje odyo a.')}
      </div>
    );
  }

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div className={compact ? styles.audioPlayerCardCompact : styles.audioPlayerCard}>
      <audio ref={audioRef} preload="metadata" src={src} className={styles.audioPlayerHidden} />
      {label && !compact && (
        <span className={styles.audioPlayerLabel}>
          <i className="fas fa-volume-high" aria-hidden="true" /> {label}
        </span>
      )}
      <div className={styles.audioPlayerRow}>
        <button
          type="button"
          className={styles.audioPlayerPlay}
          onClick={toggle}
          aria-label={playing ? t('Pause audio', 'Kanpe odyo a') : t('Play audio', 'Jwe odyo a')}
          disabled={failed}
        >
          {loading
            ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            : <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={styles.audioPlayerBar}
          onClick={seek}
          aria-label={t('Seek', 'Chèche nan odyo a')}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          role="slider"
        >
          <span className={styles.audioPlayerBarTrack}>
            <span className={styles.audioPlayerBarFill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </button>
        <span className={styles.audioPlayerTime}>
          {formatTime(current)} / {formatTime(duration)}
        </span>
        {!compact && (
          <button
            type="button"
            className={styles.audioPlayerRate}
            onClick={cycleRate}
            aria-label={t('Playback speed', 'Vitès lekti')}
            title={t('Playback speed', 'Vitès lekti')}
          >
            {RATES[rateIdx]}x
          </button>
        )}
      </div>
    </div>
  );
}
