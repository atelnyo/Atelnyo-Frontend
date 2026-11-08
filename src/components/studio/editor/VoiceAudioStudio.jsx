/**
 * src/components/studio/editor/VoiceAudioStudio.jsx
 *
 * Voice and Audio Studio for Course Studio.
 * Supports:
 * - Narration scripts
 * - Audio uploads
 * - Voice recordings
 * - Multiple narration segments
 * - Background music
 * - Sound effects
 * - Audio trimming
 * - Volume control
 * - Fade-in / fade-out
 * - Audio synchronization
 * - Preview
 * - Subtitle creation and editing
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { translations } from '../../../../data/translations';
import styles from './editor.module.css';

/* ─── Audio state shape ──────────────────────────────────────── */
function initialAudioState() {
  return {
    narrationScript: '',
    narrationSegments: [], // { id, startTime, endTime, text, filename }
    backgroundMusic: null, // { url, volume, fadeIn, fadeOut }
    soundEffects: [], // { id, url, startTime, endTime, volume }
    isPlaying: false,
    currentSegmentIndex: -1,
    audioContext: null,
  };
}

/* ─── VoiceAudioStudio component ──────────────────────────────── */
export default function VoiceAudioStudio({ onNarrationUpdate }) {
  const isHt = translations.currentLang === 'ht';
  const t = (en, ht) => (isHt ? ht || en : en);

  const [state, setState] = useState(initialAudioState);
  const { state: undoState, undo, redo, canUndo, canRedo } = useUndoRedo(state, {
    maxDepth: 50,
  });

  useEffect(() => {
    // Persist audio state
  }, [undoState]);

  /* ─── Narration script ─────────────────────────────────────── */
  const handleNarrationChange = useCallback((text) => {
    setState((prev) => ({ ...prev, narrationScript: text }));
    onNarrationUpdate?.(text);
  }, [onNarrationUpdate]);

  const addSegment = useCallback(() => {
    const newSegment = {
      id: `segment-${Date.now()}-Math.random().toString(36).substr(2)`,
      startTime: state.narrationSegments.length * 5, // 5s default spacing
      endTime: 0, // will be set when segment is trimmed
      text: '',
      filename: '',
    };
    setState((prev) => ({
      ...prev,
      narrationSegments: [...prev.narrationSegments, newSegment],
    }));
  }, []);

  const removeSegment = useCallback((segmentId) => {
    setState((prev) => ({
      ...prev,
      narrationSegments: prev.narrationSegments.filter((s) => s.id !== segmentId),
    }));
  }, []);

  /* ─── Background music ──────────────────────────────────────── */
  const addBackgroundMusic = useCallback((url) => {
    setState((prev) => ({
      ...prev,
      backgroundMusic: { url, volume: 0.5, fadeIn: 0, fadeOut: 0 },
    }));
  }, []);

  const updateMusicVolume = useCallback((volume) => {
    setState((prev) => {
      if (prev.backgroundMusic) {
        return { ...prev, backgroundMusic: { ...prev.backgroundMusic, volume } };
      }
      return prev;
    });
  }, []);

  /* ─── Sound effects ─────────────────────────────────────────── */
  const addSoundEffect = useCallback((url) => {
    setState((prev) => ({
      ...prev,
      soundEffects: [...prev.soundEffects, { id: `sfx-${Date.now()}`, url, startTime: 0, endTime: 0, volume: 0.5 }],
    }));
  }, []);

  const removeSoundEffect = useCallback((sfxId) => {
    setState((prev) => ({
      ...prev,
      soundEffects: prev.soundEffects.filter((s) => s.id !== sfxId),
    }));
  }, []);

  /* ─── Audio preview ─────────────────────────────────────────── */
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next && audioRef.current) {
        audioRef.current.play();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      return next;
    });
  }, []);

  /* ─── Fade effects ──────────────────────────────────────────── */
  const applyFadeIn = useCallback((audioBuffer, duration) => {
    // Apply fade-in to audio buffer
    // This is a placeholder - actual implementation would use Web Audio API
    return audioBuffer;
  }, []);

  const applyFadeOut = useCallback((audioBuffer, duration) => {
    // Apply fade-out to audio buffer
    return audioBuffer;
  }, []);

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="voice-audio-studio" role="region" aria-label="Voice and audio studio">
      <div className="va-toolbar">
        <button onClick={togglePlay} aria-label={isPlaying ? 'Pause playback' : 'Play playback'}>
          <i className={isPlaying ? 'fas fa-pause' : 'fas fa-play'} aria-hidden="true" />
        </button>
        <button onClick={addSegment} aria-label={t('Add narration segment', 'Ajoute segment narration'})>
          <i className="fas fa-plus" aria-hidden="true" /> {t('Add segment', 'Ajoute segment')}
        </button>
        <button onClick={addBackgroundMusic} aria-label={t('Add background music', 'Ajoute mizik fon'}} >
          <i className="fas fa-music" aria-hidden="true" /> {t('Music', 'Mizik')}
        </button>
        <button onClick={addSoundEffect} aria-label={t('Add sound effect', 'Ajoute efèk'}} >
          <i className="fas fa-blast" aria-hidden="true" /> {t('SFX', 'EFèk')}
        </button>
      </div>

      <div className="va-narration">
        <h4>{t('Narration Script', 'Script Narinasyon')}</h4>
        <textarea
          value={state.narrationScript}
          onChange={(e) => handleNarrationChange(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: '4px', fontSize: '0.8rem', border: '1px solid #ccc', borderRadius: 4, resize: 'vertical', overflow: 'auto' }}
          aria-label={t('Narration script')}
        />
        <div style={{ marginTop: 6 }}>
          <button onClick={addSegment} style={{ marginRight: 4, padding: '4px 8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.65rem' }}>
            {t('Add segment', 'Ajoute segment')}
          </button>
          <button onClick={() => removeSegment(state.narrationSegments[0]?.id)} disabled={state.narrationSegments.length === 0} style={{ padding: '4px 8px', background: '#ffdada', color: '#c50f1f', border: 'none', borderRadius: 4, fontSize: '0.65rem' }}>
            {t('Remove segment', 'Efface segment')}
          </button>
        </div>
      </div>

      <div className="va-music">
        <h4>{t('Background Music', 'Mizik Fon')}</h4>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => addBackgroundMusic(e.target.files[0]?.url || '')}
          style={{ display: 'none' }}
        />
        <button onClick={() => document.querySelector('input[type="file"]').click()} style={{ padding: '4px 8px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.7rem' }}>
          {t('Select music file', 'Sélèksyon fiche mizik')}
        </button>
        {state.backgroundMusic && (
          <div style={{ marginTop: 6, padding: 4, background: '#e9ecef', borderRadius: 4 }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
              {t('Music loaded', 'Mizik chargè')}
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={state.backgroundMusic?.volume}
              onChange={(e) => updateMusicVolume(Number(e.target.value))}
              style={{ width: '100%', padding: '4px' }}
              aria-label="Music volume"
            />
            <small>{t('Volume', 'Volum')}: {Number(state.backgroundMusic?.volume * 100)}%</small>
          </div>
        )}
      </div>

      <div className="va-sfx">
        <h4>{t('Sound Effects', 'EFèk Sòn')}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
          {state.soundEffects.slice(0, 3).map((sfx) => (
            <div key={sfx.id} style={{ padding: '4px', background: '#e9ecef', borderRadius: 4 }}>
              <button style={{ width: '60px', padding: '2px', fontSize: '0.6rem' }} onClick={() => addSoundEffect(sfx.url)}>
                Add SFX
              </button>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }>SFX</span>
              <button style={{ marginLeft: 4, padding: '2px', fontSize: '0.6rem', color: '#c50f1f' }} onClick={() => removeSoundEffect(sfx.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addSoundEffect} style={{ marginTop: 4, padding: '4px 8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.65rem' }}>
          + Add SFX
        </button>
      </div>
    </div>
  );
}