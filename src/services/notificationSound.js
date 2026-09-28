/**
 * src/services/notificationSound.js
 *
 * Plays a short synthetic notification chime using the Web Audio API.
 * Honours the user's `notification_prefs.sound` flag from `/api/me/`.
 *
 * Design choices:
 *   • No external audio files — the chime is synthesized so the app
 *     stays offline-capable and there is no extra bundle cost.
 *   • Uses a quiet sine+tone burst that works well on laptop + mobile
 *     speakers without being jarring.
 *   • Fire-and-forget: failures are swallowed so a broken AudioContext
 *     never blocks the notification UI.
 */

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function playNotificationSound({ volume = 0.12 } = {}) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    osc2.frequency.setValueAtTime(1760, now + 0.04);
    osc2.frequency.setValueAtTime(0, now + 0.22);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.22);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.22);
  } catch {
    // best-effort
  }
}

export function isSoundEnabled(user) {
  if (!user) return false;
  const prefs = user?.notification_prefs || {};
  return prefs.sound ?? true;
}
