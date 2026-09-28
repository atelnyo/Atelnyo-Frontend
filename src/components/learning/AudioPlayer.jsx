/**
 * src/components/learning/AudioPlayer.jsx
 *
 * Reusable audio player for reference audio in language practice.
 * Plain <audio controls> with a compact wrapper — lazy-loads the media
 * (no preload), keeps the native control for accessibility.
 */
import React, { useState } from 'react';
import styles from './learning.module.css';

export default function AudioPlayer({ src, label, lang = 'ht', compact }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (failed) {
    return (
      <div className={styles.audioPlayerFailed} role="status">
        <i className="fas fa-volume-xmark" aria-hidden="true" />
        {lang === 'ht'
          ? 'Pa t kapab chaje odyo a.'
          : 'Could not load the audio.'}
      </div>
    );
  }
  if (compact) {
    // Slim inline player for media-library rows — same native <audio>
    // control, smaller footprint, no label row.
    return (
      <audio
        controls
        preload="none"
        src={src}
        onError={() => setFailed(true)}
        className={styles.audioPlayerCompact}
      />
    );
  }
  return (
    <div className={styles.audioPlayer}>
      {label && (
        <span className={styles.audioPlayerLabel}>
          <i className="fas fa-volume-high" aria-hidden="true" /> {label}
        </span>
      )}
      <audio
        controls
        preload="none"
        src={src}
        onError={() => setFailed(true)}
        className={styles.audioPlayerControl}
      />
    </div>
  );
}
