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
 * Stability details:
 *   • Double-tap guard — tapping Record twice can't start two recorders.
 *   • Elapsed timer + live voice-level meter so the learner SEES the
 *     microphone is hearing them while they speak.
 *   • Auto-stop at MAX_DURATION_SEC (no runaway 10-minute blob).
 *   • Level meter drives a DOM node directly (ref) — no re-render storm.
 *   • Tracks + AudioContext + timer + object URL always cleaned up.
 *
 * Privacy: recordings stay in memory (blob URL) — nothing is uploaded
 * unless a caller explicitly does so, and the URL is revoked on
 * unmount. Tracks are always stopped.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SPEECH_CAPS } from '../../modules/learning/speech';
import styles from './learning.module.css';

// Longest single take: 90s. Language-practice answers are seconds long;
// this only stops runaway recordings (learner walks away mid-take).
const MAX_DURATION_SEC = 90;

function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

export default function SpeechRecorder({
  lang = 'ht',
  onRecorded,          // (blobUrl, blob, durationSec) => void
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
  const [elapsed, setElapsed] = useState(0);
  const [takeDuration, setTakeDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const meterFillRef = useRef(null);
  const stateRef = useRef('idle');
  stateRef.current = state;

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    stopTimer();
    stopMeter();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
    }
    mediaRecorderRef.current = null;
  }, [stopTimer, stopMeter]);

  // Always clean up on unmount — never leave the microphone running.
  useEffect(() => {
    return () => {
      stopTracks();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [stopTracks, recordingUrl]);

  const startMeter = useCallback((stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (stateRef.current !== 'recording') return;
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i += 2) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        if (meterFillRef.current) {
          meterFillRef.current.style.transform = `scaleX(${Math.min(1, peak * 1.6).toFixed(2)})`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) { /* meter is decorative — recording works without it */ }
  }, []);

  const beginRecording = useCallback(async () => {
    // Double-tap guard: never start two recorders.
    if (stateRef.current === 'recording' || stateRef.current === 'permission') return;
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
    setElapsed(0);
    setTakeDuration(0);
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
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(url);
        setTakeDuration(durationSec);
        setElapsed(0);
        setState('recorded');
        onRecorded?.(url, blob, durationSec);
        stopTracks();
      };
      recorder.start();
      startTimeRef.current = Date.now();
      setState('recording');
      onStart?.();
      startMeter(stream);
      timerRef.current = setInterval(() => {
        const sec = (Date.now() - startTimeRef.current) / 1000;
        setElapsed(sec);
        if (sec >= MAX_DURATION_SEC) {
          try { recorder.stop(); } catch (e) { /* onstop handles the rest */ }
        }
      }, 250);
    } catch (err) {
      stopTracks();
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setState('error');
        // NotAllowedError is also what a Permissions-Policy block (or a
        // non-secure context) returns — the browser never says which.
        // Telling the learner "you denied it" sent them to their browser
        // settings for something the SERVER had disabled.
        setErrorMsg(isHt
          ? 'Mikwo a bloke. Si w pa t refize l, se yon politik sit oswa yon ekstansyon navigatè ki bloke l — eseye nan yon fenèt nòmal (pa incognito) epi re-aktive pèmisyon an.'
          : 'Microphone is blocked. If you did not decline it, a site policy or a browser extension is blocking it — try a normal (non-private) window and re-enable the permission.');
      } else if (name === 'SecurityError') {
        setState('error');
        setErrorMsg(isHt
          ? 'Navigatè a bloke mikwo a sou paj sa a (politik sit oswa iframe). Louvri leson an nan yon onglet dirèk epi eseye ankò.'
          : 'The browser blocked the microphone on this page (site policy or iframe). Open the lesson in a normal tab and try again.');
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
  }, [supported, isHt, onRecorded, onStart, recordingUrl, stopTracks, startMeter, stopTimer, stopMeter]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      stopTracks();
    }
  }, [stopTracks]);

  const retry = useCallback(() => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false);
    setRecordingUrl(null);
    setErrorMsg('');
    setTakeDuration(0);
    setState('idle');
    onRecorded?.(null, null, 0);
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
          <span className={styles.recorderLiveLabel}>{t('Recording…', 'Ap anrejistre…')}</span>
          <span className={styles.recorderTimer} aria-label={t('Elapsed time', 'Tan pase')}>
            {formatDuration(elapsed)}
          </span>
          <span className={styles.recorderMeter} aria-hidden="true">
            <span ref={meterFillRef} className={styles.recorderMeterFill} />
          </span>
          <button type="button" className={styles.recorderStop} onClick={stopRecording}>
            <i className="fas fa-stop" aria-hidden="true" /> {t('Stop', 'Kanpe')}
          </button>
        </div>
      )}

      {state === 'recorded' && (
        <div className={styles.recorderRecorded}>
          <span className={styles.recorderDone} role="status">
            <i className="fas fa-circle-check" aria-hidden="true" /> {t('Recorded', 'Anrejistre')}
            {takeDuration > 0 && (
              <span className={styles.recorderDuration}> · {formatDuration(takeDuration)}</span>
            )}
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
