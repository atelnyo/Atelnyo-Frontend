/**
 * src/modules/learning/serverTranscription.js
 *
 * Second chance for a take the browser recognizer missed.
 *
 * When the learner clearly recorded audio (blob has real bytes) but
 * the on-device recognizer returned nothing — the classic Creole-into-
 * French-model miss — this helper sends the blob to the platform's own
 * transcription endpoint (Whisper, language='ht') and returns its
 * transcript.
 *
 * Contract (never throws, never fakes):
 *   • Returns { transcript, source: 'server', meanTokenProbability }
 *     on success.
 *   • Returns null when there is no point asking (no course context,
 *     empty blob) or when the server can't help (503 engine missing,
 *     network error, empty server transcript). The caller then keeps
 *     its honest "not understood" message — the recording stays.
 */
import { speechSubmissionService } from '../../services/api';

// Blobs at/below this size are header-only (cancelled/empty take) —
// don't waste a server round-trip on silence.
export const MIN_TRANSCRIBABLE_BYTES = 800;

export async function transcribeTakeOnServer({ courseId, blob }) {
  if (!courseId || !blob || typeof blob.size !== 'number') return null;
  if (blob.size <= MIN_TRANSCRIBABLE_BYTES) return null;
  let res;
  try {
    res = await speechSubmissionService.transcribe(courseId, blob);
  } catch (e) {
    return null; // 503 / network / 403 — caller falls back gracefully
  }
  const data = res?.data || {};
  const transcript = typeof data.transcript === 'string' ? data.transcript.trim() : '';
  if (!transcript) return null;
  return {
    transcript,
    source: 'server',
    meanTokenProbability: typeof data.mean_token_probability === 'number'
      ? data.mean_token_probability
      : null,
  };
}
