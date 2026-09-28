/**
 * src/components/learning/SpeechRecorder.jsx
 *
 * Reusable speech-recording control for language practice.
 *
 * Responsibilities (only): microphone permission, recording, stop,
 * playback, retry, error state, cleanup. It does NOT do any
 * course-specific scoring — callers receive the recorded blob URL.
 *
 * Microphone permission is requested CONTEXTUALLY — only when the
 * learner taps "Record". Before requesting, an explainer states why
 * the microphone is needed. Permission denied / dismissed / browser
 * unsupported / recording failure are all handled gracefully.
 *
 * Privacy: recordings stay in memory (blob URL) — nothing is uploaded
 * unless a caller explicitly does so, and the URL is revoked on
 * unmount. Tracks are always stopped.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SPEECH_CAPS } from '../../modules/learning/speech';
import styles from './learning.module.css';

export default function SpeechRecorder({
  lang = 'ht',
  onRecorded,          // (blobUrl, blob) => void
  onStart,             // () => void — fired when recording actually begins
  recordLabel,
  ariaLabel,
}) {
  const isHt = lang === 'ht';
  const supported = SPEECH_CAPS.getUserMedia && SPEECH_CAPS.mediaRecorder;

  // idle | permission | recording | recorded | error
  const [state, setState] = useState('idle');
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [playing, setPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
    }
    mediaRecorderRef.current = null;
  }, []);

  // Always clean up on unmount — never leave the microphone running.
  useEffect(() => {
    return () => {
      stopTracks();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [stopTracks, recordingUrl]);

  const beginRecording = useCallback(async () => {
    if (!supported) {
      setState('error');
      setErrorMsg(isHt
        ? 'Anrejistreman vwa pa sipòte nan navigatè sa a.'
        : 'Voice recording is not supported in this browser.');
      return;
    }
    setPermissionAsked(true);
    setState('permission');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4',
      ].find((m) => window.MediaRecorder.isTypeSupported(m)) || '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(url);
        setState('recorded');
        onRecorded?.(url, blob);
        stopTracks();
      };
      recorder.start();
      setState('recording');
      onStart?.();
    } catch (err) {
      stopTracks();
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setState('error');
        setErrorMsg(isHt
          ? 'Ou refize aksè mikro a. Ou ka re-aktive l nan anviwònman navigatè a epi eseye ankò.'
          : 'Microphone access was denied. You can re-enable it in the browser settings and try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setState('error');
        setErrorMsg(isHt ? 'Pa jwenn okenn mikro.' : 'No microphone was found.');
      } else {
        setState('error');
        setErrorMsg(isHt
          ? 'Pa t kapab kòmanse anrejistreman an. Tcheke mikro ou epi eseye ankò.'
          : 'Could not start recording. Check your microphone and try again.');
      }
    }
  }, [supported, isHt, onRecorded, onStart, recordingUrl, stopTracks]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
    }
  }, [stopTracks]);

  const retry = useCallback(() => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl(null);
    setErrorMsg('');
    setState('idle');
    onRecorded?.(null, null);
  }, [recordingUrl, onRecorded]);

  const togglePlayback = useCallback(() => {
    if (!recordingUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(recordingUrl);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onpause = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [recordingUrl, playing]);

  const t = (en, ht) => (isHt ? ht : en);

  if (!supported) {
    return (
      <div className={styles.recorderUnsupported} role="status">
        <i className="fas fa-microphone-slash" aria-hidden="true" />
        {t(
          'Voice practice is not supported in this browser. You can continue with the text exercise.',
          'Pratik vwa pa sipòte nan navigatè sa a. Ou ka kontinye ak egzèsis tèks la.',
        )}
      </div>
    );
  }

  return (
    <div className={styles.recorder} data-state={state}>
      {state === 'idle' && !permissionAsked && (
        <div className={styles.recorderPermissionNote}>
          {t(
            'Atelnyo needs microphone access so you can practice speaking.',
            'Atelnyo bezwen aksè mikro a pou w ka pratike pale.',
          )}
        </div>
      )}

      {state === 'permission' && (
        <div className={styles.recorderWaiting} role="status">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          {t('Requesting microphone…', 'Ap mande aksè mikro…')}
        </div>
      )}

      {state === 'recording' && (
        <div className={styles.recorderLive} role="status" aria-live="polite">
          <span className={styles.recorderLiveDot} aria-hidden="true" />
          {t('Recording…', 'Ap anrejistre…')}
          <button type="button" className={styles.recorderStop} onClick={stopRecording}>
            <i className="fas fa-stop" aria-hidden="true" /> {t('Stop', 'Kanpe')}
          </button>
        </div>
      )}

      {state === 'recorded' && (
        <div className={styles.recorderRecorded}>
          <span className={styles.recorderDone} role="status">
            <i className="fas fa-circle-check" aria-hidden="true" /> {t('Recorded', 'Anrejistre')}
          </span>
          <div className={styles.recorderActions}>
            <button type="button" className={styles.recorderPlay} onClick={togglePlayback} aria-label={t('Play recording', 'Jwe anrejistreman')}>
              <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
              {playing ? t('Pause', 'Pòz') : t('Play', 'Jwe')}
            </button>
            <button type="button" className={styles.recorderRetry} onClick={retry}>
              <i className="fas fa-rotate-left" aria-hidden="true" /> {t('Try again', 'Eseye ankò')}
            </button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className={styles.recorderError} role="alert">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{errorMsg}</span>
          <button type="button" className={styles.recorderRetry} onClick={() => { setErrorMsg(''); setState('idle'); }}>
            {t('Retry', 'Eseye ankò')}
          </button>
        </div>
      )}

      {(state === 'idle' || state === 'error') && !(state === 'error' && permissionAsked && !supported) && (
        <button
          type="button"
          className={styles.recorderStart}
          onClick={beginRecording}
          aria-label={ariaLabel || recordLabel || t('Tap to speak', 'Tape pou pale')}
        >
          <i className="fas fa-microphone" aria-hidden="true" />
          {recordLabel || t('Tap to speak', 'Tape pou pale')}
        </button>
      )}
    </div>
  );
}
