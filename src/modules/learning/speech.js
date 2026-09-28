/**
 * src/modules/learning/speech.js
 *
 * Browser speech infrastructure for Atelnyo language practice.
 *
 * Everything here is REAL browser capability — nothing is faked:
 *   • Feature detection for getUserMedia / MediaRecorder /
 *     SpeechRecognition / SpeechSynthesis.
 *   • A thin, provider-agnostic wrapper over the Web Speech API that
 *     returns honest transcript + per-result confidence. It is NOT a
 *     scoring engine: confidence is the recognizer's own estimate, and
 *     feedback in the UI must never present it as objective truth.
 *
 * Speech recognition is a BROWSER capability (Chrome/Edge/Safari ship
 * it; Firefox does not). When unavailable, callers must fall back to a
 * text exercise — never pretend voice recognition exists.
 */

export const SPEECH_CAPS = {
  mediaRecorder: typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined',
  getUserMedia: typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  speechRecognition: typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  speechSynthesis: typeof window !== 'undefined' && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance),
};

export function speechCapabilities() {
  return { ...SPEECH_CAPS };
}

/**
 * Normalize a spoken transcript for an exact-match comparison.
 * Lowercase, collapse whitespace, strip punctuation. The target and the
 * recognized transcript both go through this before comparing, so minor
 * punctuation/case differences don't fail a repeat exercise.
 */
export function normalizeSpeechText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[.,!?;:'"()\-—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create a live speech recognizer for the current browser.
 *
 * Returns null when unsupported (caller must fall back). Otherwise
 * returns an object with:
 *   { recognize({ onInterim, onResult }), stop(), supported: true }
 *
 * onResult receives { transcript, confidence, isFinal } where
 * confidence ∈ [0,1] and is the recognizer's own estimate — shown to
 * the learner as "recognition confidence", never as a pronunciation
 * score.
 */
export function createSpeechRecognizer(lang = 'en-US') {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  return {
    supported: true,
    recognize({ onInterim, onResult, onError }) {
      let finalText = '';
      rec.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const chunk = result[0]?.transcript || '';
          if (result.isFinal) {
            finalText += chunk;
          } else {
            interim += chunk;
          }
        }
        if (interim && onInterim) onInterim(interim);
        if (finalText && onResult) {
          const last = event.results[event.results.length - 1];
          const confidence = last && last.length > 0 ? last[0].confidence : 0;
          onResult({ transcript: finalText, confidence, isFinal: true });
        }
      };
      rec.onerror = (e) => { if (onError) onError(e?.error || 'error'); };
      try {
        rec.start();
      } catch (e) {
        if (onError) onError('already-started');
      }
    },
    stop() {
      try { rec.stop(); } catch (e) { /* already stopped */ }
    },
    abort() {
      try { rec.abort(); } catch (e) { /* ignore */ }
    },
  };
}

/**
 * Convenience exact-match check for repeat/guided exercises.
 * Returns { matched, normalizedTranscript } — the UI decides the tone.
 */
export function exactMatch(target, transcript) {
  const normTarget = normalizeSpeechText(target);
  const normTranscript = normalizeSpeechText(transcript);
  return {
    matched: normTarget.length > 0 && normTarget === normTranscript,
    normalizedTranscript: normTranscript,
  };
}

/**
 * Levenshtein edit distance — the basis for NEAR-miss detection, so a
 * pronunciation slip the recognizer transcribed slightly off ("bonjou"
 * vs "bonzou") is shown as "almost" instead of a flat wrong.
 */
export function levenshtein(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (sa === sb) return 0;
  if (!sa.length) return sb.length;
  if (!sb.length) return sa.length;
  let prev = Array.from({ length: sb.length + 1 }, (_, j) => j);
  for (let i = 1; i <= sa.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= sb.length; j += 1) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[sb.length];
}

/**
 * Word similarity in [0, 1] — 1.0 when identical, lower as words
 * diverge (normalized edit distance).
 */
export function wordSimilarity(a, b) {
  const max = Math.max(String(a || '').length, String(b || '').length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Split a spoken transcript (or target) into normalized words.
 */
export function tokenizeSpeech(text) {
  return normalizeSpeechText(text).split(' ').filter(Boolean);
}

// Tuning knobs for the speech analysis. Near-misses count half a word
// toward the score; extras never fail the learner (recognizers add
// filler words) but are still shown so the comparison stays honest.
export const SPEECH_ANALYSIS = {
  PASS_THRESHOLD: 0.7, // say 3 of 4 words well → pass
  NEAR_SIMILARITY: 0.66, // "bonjou" vs "bonzou" (~0.83) is a near miss
  LOOKAHEAD: 3, // tolerate minor word-order shuffling from the recognizer
};

/**
 * Real word-level speech analysis for repeat/pronunciation exercises.
 *
 * Compares the recognized transcript against the target phrase WORD BY
 * WORD (ordered greedy alignment) and reports exactly what happened:
 *
 *   matchedWords — target words recognized correctly
 *   nearMisses   — target words the recognizer heard slightly off
 *                  ({ target, said } — a pronunciation hint)
 *   missingWords — target words not found in what was said
 *   extraWords   — extra words the learner said that aren't in the target
 *   score        — (exact + near×0.5) / total target words
 *   passed       — score >= PASS_THRESHOLD
 *
 * This is the "did they say it well or not" answer the learner needs:
 * a flat correct/incorrect hides the error; this shows WHICH word was
 * wrong so they can fix exactly that.
 */
export function analyzeSpeech(target, transcript) {
  const targetWords = tokenizeSpeech(target);
  const spoken = tokenizeSpeech(transcript);
  if (targetWords.length === 0) {
    return {
      score: 0, totalWords: 0, passed: false,
      matchedWords: [], nearMisses: [], missingWords: [], extraWords: spoken,
    };
  }
  const { NEAR_SIMILARITY, LOOKAHEAD } = SPEECH_ANALYSIS;
  const matchedWords = [];
  const nearMisses = [];
  const missingWords = [];
  const extraWords = [...spoken];

  for (const tw of targetWords) {
    let bestIdx = -1;
    let bestSim = 0;
    const window = Math.min(LOOKAHEAD, extraWords.length);
    for (let j = 0; j < window; j += 1) {
      const sim = wordSimilarity(tw, extraWords[j]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = j;
        if (sim === 1) {
          break; // exact — no need to look further
        }
      }
    }
    if (bestIdx >= 0 && bestSim >= NEAR_SIMILARITY) {
      const said = extraWords.splice(bestIdx, 1)[0];
      if (bestSim === 1) {
        matchedWords.push(tw);
      } else {
        nearMisses.push({ target: tw, said });
      }
    } else {
      missingWords.push(tw);
    }
  }

  const totalWords = targetWords.length;
  const score = (matchedWords.length + nearMisses.length * 0.5) / totalWords;
  return {
    score,
    totalWords,
    passed: score >= SPEECH_ANALYSIS.PASS_THRESHOLD,
    matchedWords,
    nearMisses,
    missingWords,
    extraWords,
  };
}
