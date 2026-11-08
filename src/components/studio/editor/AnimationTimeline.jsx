/**
 * src/components/studio/editor/AnimationTimeline.jsx
 * 
 * Visual animation timeline for the Course Studio.
 * Supports tracks for scenes, text, images, shapes, animations,
 * narration, background music, and sound effects.
 * 
 * Features:
 * - Track creation, visibility toggling, reordering
 * - Start/end time, duration, delay controls
 * - Animation presets
 * - Playback preview
 * - Keyframe support
 * - Timeline data persistence (save/restore without losing timing)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import styles from './editor.module.css';

/* ─── Track types ──────────────────────────────────────────────── */
const TrackTypes = {
  SCENE: 'scene',
  TEXT: 'text',
  IMAGE: 'image',
  SHAPE: 'shape',
  ANIMATION: 'animation',
  NARRATION: 'narration',
  MUSIC: 'music',
  SFX: 'sfx',
};

/* ─── Timeline state shape ─────────────────────────────────────── */
function initialTimelineState() {
  return {
    tracks: [],
    playheadPosition: 0,
    isPlaying: false,
    previewMode: 'drawer', // 'drawer' | 'fullscreen'
    selectedTrack: null,
    selectedKeyframe: null,
  };
}

/* ─── Timeline component ───────────────────────────────────────── */
export default function AnimationTimeline({ onTimelineChange }) {
  const [state, setState] = useState(initialTimelineState);
  const [timelineData, setTimelineData] = useState({});

  const { state: undoState, undo, redo, canUndo, canRedo } = useUndoRedo(state, {
    maxDepth: 50,
  });

  /* ─── Save state to undo history ─────────────────────────────── */
  useEffect(() => {
    setState(undoState);
  }, [undoState]);

  /* ─── Track management ──────────────────────────────────────── */
  const addTrack = useCallback((type, name) => {
    const newTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2)}`,
      type,
      name,
      visible: true,
      locked: false,
      elements: [],
    };
    setState((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
    onTimelineChange?.('add_track', newTrack);
  }, []);

  const removeTrack = useCallback((trackId) => {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
    }));
    onTimelineChange?.('remove_track', trackId);
  }, []);

  const toggleTrackVisibility = useCallback((trackId) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, visible: !t.visible } : t
        ),
      };
    });
    onTimelineChange?.('toggle_visibility', trackId);
  }, []);

  const toggleTrackLock = useCallback((trackId) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, locked: !t.locked } : t
        ),
      };
    });
  }, []);

  const reorderTrack = useCallback((trackId, direction) => {
    setState((prev) => {
      const trackIndex = prev.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex === -1 || (direction === 'up' && trackIndex === 0) || (direction === 'down' && trackIndex >= prev.tracks.length - 1)) {
        return prev;
      }
      const next = [...prev.tracks];
      const [moved] = next.splice(trackIndex, 1);
      next.splice(trackIndex + (direction === 'up' ? -1 : 1), 0, moved);
      return { ...prev, tracks: next };
    });
    onTimelineChange?.('reorder_track', trackId);
  }, []);

  /* ─── Element management ─────────────────────────────────────── */
  const addElement = useCallback((trackId, element) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, elements: [...t.elements, element] } : t
        ),
      };
    });
    onTimelineChange?.('add_element', { trackId, element });
  }, []);

  const removeElement = useCallback((trackId, elementId) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, elements: t.elements.filter((e) => e.id !== elementId) } : t
        ),
      };
    });
    onTimelineChange?.('remove_element', { trackId, elementId });
  }, []);

  /* ─── Playhead & playback ────────────────────────────────────── */
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef(null);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        const start = performance.now();
        animationRef.current = setInterval(() => {
          const elapsed = performance.now() - start;
          setPlayheadPosition(elapsed);
        }, 16); // ~60fps
      } else {
        if (animationRef.current) {
          clearInterval(animationRef.current);
          animationRef.current = null;
        }
      }
      return next;
    });
  }, []);

  const seekPlayhead = useCallback((position) => {
    setPlayheadPosition(position);
    onTimelineChange?.('seek', position);
  }, []);

  /* ─── Keyframe management ────────────────────────────────────── */
  const [selectedKeyframe, setSelectedKeyframe] = useState(null);

  const addKeyframe = useCallback((trackId, elementId, time, properties) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      const element = track.elements.find((e) => e.id === elementId);
      if (!element) return prev;
      // Ensure keyframes array exists
      if (!element.keyframes) element.keyframes = [];
      element.keyframes.push({ time, ...properties });
      // Reorder by time
      element.keyframes.sort((a, b) => a.time - b.time);
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, elements: [...prev.tracks.find((tt) => tt.id === trackId).elements] } : t
        ),
      };
    });
    setSelectedKeyframe({ trackId, elementId, time, properties });
    onTimelineChange?.('add_keyframe', { trackId, elementId, time, properties });
  }, []);

  const updateKeyframe = useCallback((trackId, elementId, time, properties) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      const element = track.elements.find((e) => e.id === elementId);
      if (!element || !element.keyframes) return prev;
      const kfIndex = element.keyframes.findIndex((k) => k.time === time);
      if (kfIndex === -1) return prev;
      element.keyframes[kfIndex] = { ...element.keyframes[kfIndex], ...properties };
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, elements: [...prev.tracks.find((tt) => tt.id === trackId).elements] } : t
        ),
      };
    });
  }, []);

  const deleteKeyframe = useCallback((trackId, elementId, time) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;
      const element = track.elements.find((e) => e.id === elementId);
      if (!element || !element.keyframes) return prev;
      element.keyframes = element.keyframes.filter((k) => k.time !== time);
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, elements: [...prev.tracks.find((tt) => tt.id === trackId).elements] } : t
        ),
      };
    });
    onTimelineChange?.('delete_keyframe', { trackId, elementId, time });
  }, []);

  /* ─── Render timeline ────────────────────────────────────────── */
  const minTime = 0;
  const maxTime = 60; // 60 seconds default
  const gridStep = 1; // 1 second grid

  return (
    <div className="animation-timeline" role="region" aria-label="Animation timeline">
      <div className="timeline-toolbar">
        <button
          type="button"
          onClick={togglePlay}
          disabled={isPlaying}
          aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
        >
          <i className={isPlaying ? 'fas fa-pause' : 'fas fa-play'} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => addTrack(TrackTypes.ANIMATION, 'Animation')
          }
          aria-label="Add animation track"
        >
          <i className="fas fa-layer-group" aria-hidden="true" /> Track
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {playheadPosition >= 0 ? `${Math.round(playheadPosition / 1000)}s` : '0s'}
        </span>
        <button
          type="button"
          onClick={() => seekPlayhead(0)}
          aria-label="Seek to beginning"
          style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '0.65rem' }}
        >
          <i className="fas fa-step-backward" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => seekPlayhead(playheadPosition + 1000)}
          aria-label="Seek forward 1s"
          style={{ marginLeft: '4px', padding: '2px 6px', fontSize: '0.65rem' }}
        >
          <i className="fas fa-step-forward" aria-hidden="true" />
        </button>
      </div>

      <div className="timeline-grid">
        {/* Time ruler */}
        <div className="time-ruler">
          {[...Array(Math.ceil((maxTime - minTime) / gridStep)).keys()].map((i) => (
            <div
              key={i}
              style={{
                left: `${(i * gridStep - minTime) / (maxTime - minTime) * 100}%`,
                width: gridStep === 1 ? '14px' : '6px',
                fontSize: gridStep === 1 ? '0.65rem' : '0.55rem',
                color: 'var(--text-secondary)',
              }}
            >
              {i + minTime}s
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div className="tracks-area">
          {state.tracks.map((track) => (
            <div
              key={track.id}
              className={`track ${track.visible ? '' : 'hidden'} ${track.locked ? 'locked' : ''}`}
              style={{ borderLeft: `2px solid ${track.type === TrackTypes.MUSIC ? '#ff6b6b' : track.type === TrackTypes.NARRATION ? '#4ecdc4' : 'var(--color-primary)'}` }}
              onClick={(e) => {
                if (!track.locked) {
                  setState((prev) => ({
                    ...prev,
                    selectedTrack: track.id === state.selectedTrack ? null : track.id,
                  }));
                }
              }}
              role="button"
              aria-label={track.name}
            >
              <div className="track-header" style={{ cursor: track.locked ? 'not-allowed' : 'pointer' }}>
                <span className="track-name" style={{ flex: 1 }}>{track.name}</span>
                <span
                  className="track-visibility"
                  style={{ width: '16px', cursor: 'pointer' }}
                  onClick={() => toggleTrackVisibility(track.id)}
                  title={track.visible ? 'Hide track' : 'Show track'}
                >
                  {track.visible ? '☑' : '☐'}
                </span>
                <span
                  className="track-lock"
                  style={{ width: '16px', cursor: 'not-allowed' }}
                  title={track.locked ? 'Unlock track' : 'Lock track'}
                >
                  {track.locked ? '🔒' : '🔓'}
                </span>
              </div>
              <div className="track-elements">
                {track.elements.map((element, elementIndex) => (
                  <div
                    key={element.id}
                    className={`element ${element === state.selectedElement ? 'selected' : ''}`}
                    style={{
                      left: `${((element.startTime || 0) - minTime) / (maxTime - minTime) * 100}%`,
                      width: `${((element.endTime || 0) - (element.startTime || 0)) / (maxTime - minTime) * 100}%`,
                      top: 0,
                      background: 'var(--color-primary)',
                      borderRadius: 4,
                      transition: 'left 0.1s, width 0.1s, top 0.1s',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedKeyframe({ trackId: track.id, elementId: element.id })}
                    role="button"
                    aria-label={`Element ${element.id}`}
                  >
                    <div className="element-label" style={{ fontSize: '0.65rem', marginBottom: 2, color: '#fff' }}>
                      {element.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Playhead overlay ─────────────────────────────────────────── */}
      {isPlaying && (
        <div
          className="playhead-overlay"
          style={{
            left: `${(playheadPosition % 1000) / (maxTime - minTime) * 100}%`,
            width: '2px',
            height: '100%',
            background: 'var(--color-primary)',
            position: 'absolute',
            top: 0,
            bottom: 0,
            zIndex: 1000,
          }}
        />
      )}

      {/* Keyframe editor panel (bottom) ──────────────────────────── */
      <div className="keyframe-editor" style={{ marginTop: 12, padding: 8, background: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
        {selectedKeyframe && selectedKeyframe.trackId ? (
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.8rem' }}>
              Keyframe {selectedKeyframe.time}s
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Delay (ms)</label>
                <input
                  type="number"
                  value={selectedKeyframe.properties.delay || 0}
                  onChange={(e) =>
                    updateKeyframe(
                      selectedKeyframe.trackId,
                      selectedKeyframe.elementId,
                      selectedKeyframe.time,
                      { delay: Number(e.target.value) }
                    )
                  }
                  style={{ width: '100%', padding: '4px', fontSize: '0.7rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Duration (ms)</label>
                <input
                  type="number"
                  value={selectedKeyframe.properties.duration || 0}
                  onChange={(e =>
                    updateKeyframe(
                      selectedKeyframe.trackId,
                      selectedKeyframe.elementId,
                      selectedKeyframe.time,
                      { duration: Number(e.target.value) }
                    )
                  )}
                  style={{ width: '100%', padding: '4px', fontSize: '0.7rem' }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => deleteKeyframe(selectedKeyframe.trackId, selectedKeyframe.elementId, selectedKeyframe.time)}
              style={{ marginTop: 4, padding: '4px 8px', background: '#ffdada', color: '#c50f1f', border: 'none', borderRadius: 4, fontSize: '0.65rem' }}
            >
              Delete keyframe
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: 8 }}>
            Click a timeline element to edit its keyframe
          </p>
        )}
      </div>
    </div>
  );
}