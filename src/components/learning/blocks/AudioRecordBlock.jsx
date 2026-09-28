/**
 * src/components/learning/blocks/AudioRecordBlock.jsx
 *
 * Audio recording practice block. The learner records their voice
 * and can play it back to compare with the reference audio.
 *
 * Block data shape:
 *   { id, type: 'audio_record', title, prompt, referenceAudio, targetText, hint }
 *
 * Uses the MediaRecorder API (broadly supported).
 * Reports completion when the learner records and plays back their audio.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

export default function AudioRecordBlock({
  block,
  lang = 'ht',
  index = 0,
  courseId,
  moduleIndex,
  onComplete,
  reportComplete,
  onViewed,
}) {
  const isHt = lang === 'ht';
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    onViewed?.(block.id);
    return () => {
      // Stop any active recording + release the microphone stream
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
        // Stop all tracks from the captured stream
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [block.id, onViewed]);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setError(isHt
        ? 'Pa t kapab jwenn mikwofòn la. Tcheke pèmisyon navigatè a.'
        : 'Could not access microphone. Check browser permissions.');
    }
  }, [isHt]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [recording]);

  const handlePlayback = useCallback(() => {
    setHasPlayed(true);
    if (!completed) {
      setCompleted(true);
      reportComplete?.();
    }
  }, [completed, block.id, onComplete]);

  const handleReRecord = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setHasPlayed(false);
    setDuration(0);
  }, [recordedUrl]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="ls-block ls-block--audio-record" data-block-type="audio_record">
      {/* Header */}
      <div className="ls-block-header">
        <span className="ls-block-badge">🎙️ {isHt ? 'Anrejistre' : 'Record'}</span>
        <h3 className="ls-block-title">{block.title || (isHt ? 'Anrejistre vwa ou' : 'Record your voice')}</h3>
      </div>

      {/* Prompt */}
      {(block.prompt || block.targetText) && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'var(--bg-surface, #f8fafc)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          fontSize: '1.1rem', lineHeight: 1.5, marginBottom: 16,
          fontWeight: 500,
        }}>
          {block.prompt || block.targetText}
        </div>
      )}

      {/* Hint */}
      {block.hint && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          💡 {block.hint}
        </p>
      )}

      {/* Reference audio */}
      {block.referenceAudio && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
            {isHt ? '🔊 Odyo referans:' : '🔊 Reference audio:'}
          </p>
          <audio controls src={block.referenceAudio} style={{ width: '100%', maxWidth: 400 }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          fontSize: '0.85rem', marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {/* Recording controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {!recordedUrl ? (
          <>
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: '#ef4444', color: '#fff',
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <i className="fas fa-circle" style={{ fontSize: '0.7rem' }} />
                {isHt ? 'Kòmanse anrejistre' : 'Start recording'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: '#6b7280', color: '#fff',
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <i className="fas fa-stop" />
                {isHt ? 'Stop' : 'Stop'} ({formatDuration(duration)})
              </button>
            )}
            {recording && (
              <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                <i className="fas fa-circle" style={{ animation: 'pulse 1s infinite', marginRight: 4 }} />
                {isHt ? 'Ap anrejistre...' : 'Recording...'}
              </span>
            )}
          </>
        ) : (
          <>
            {/* Playback */}
            <audio
              controls
              src={recordedUrl}
              onPlay={handlePlayback}
              style={{ maxWidth: 400, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleReRecord}
              style={{
                padding: '10px 16px', borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'transparent', color: 'var(--text-primary)',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <i className="fas fa-redo" style={{ marginRight: 4 }} />
              {isHt ? 'Rekòmanse' : 'Re-record'}
            </button>
          </>
        )}
      </div>

      {/* Duration info */}
      {recordedUrl && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
          {isHt ? 'Dire:' : 'Duration:'} {formatDuration(duration)}
          {hasPlayed && (
            <span style={{ color: '#10b981', marginLeft: 8 }}>
              <i className="fas fa-check-circle" /> {isHt ? 'Tande!' : 'Listened!'}
            </span>
          )}
        </p>
      )}

      {/* Completion */}
      {completed && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(16,185,129,0.1)', color: '#10b981',
          fontSize: '0.9rem', fontWeight: 600,
        }}>
          🎉 {isHt ? 'Brav! Ou anrejistre epi tande vwa ou!' : 'Well done! You recorded and listened to your voice!'}
        </div>
      )}
    </div>
  );
}
