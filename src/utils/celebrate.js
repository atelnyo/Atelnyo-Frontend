/**
 * src/utils/celebrate.js — Duolingo-style celebration helpers.
 *
 *   • playChime(kind)  — WebAudio synth (no audio assets): a short
 *     ascending arpeggio for correct answers, a low buzz for mistakes,
 *     a fuller fanfare for module/level completion.
 *   • burstConfetti()  — a lightweight canvas-confetti overlay that
 *     spawns ~90 coloured particles for ~1.4s and tears itself down.
 *
 * Everything degrades silently: no AudioContext / canvas / reduced
 * motion → no-op. Never throws.
 */

const COLORS = ['#58cc02', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff', '#ff4b4b'];

let _audioCtx = null;

function _ctx() {
  try {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      return null;
    }
    if (!_audioCtx) _audioCtx = new window.AudioContext();
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
    return _audioCtx;
  } catch (_) {
    return null;
  }
}

function _tone(ctx, { freq, start, duration = 0.16, type = 'sine', gain = 0.18 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

/** Ascending major arpeggio (correct answer / small win). */
function _chimeCorrect() {
  const ctx = _ctx();
  if (!ctx) return;
  [523.25, 659.25, 783.99].forEach((f, i) => _tone(ctx, { freq: f, start: i * 0.07, duration: 0.22 }));
}

/** Low double-buzz (wrong answer). */
function _chimeWrong() {
  const ctx = _ctx();
  if (!ctx) return;
  _tone(ctx, { freq: 196, start: 0, duration: 0.18, type: 'square', gain: 0.08 });
  _tone(ctx, { freq: 147, start: 0.16, duration: 0.26, type: 'square', gain: 0.08 });
}

/** Fuller fanfare (module / level / course completion). */
function _chimeComplete() {
  const ctx = _ctx();
  if (!ctx) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => _tone(ctx, { freq: f, start: i * 0.09, duration: 0.34 }));
  [523.25, 783.99, 1046.5].forEach((f, i) => _tone(ctx, { freq: f, start: 0.4 + i * 0.09, duration: 0.4, gain: 0.14 }));
}

export function playChime(kind = 'correct') {
  try {
    if (kind === 'wrong') _chimeWrong();
    else if (kind === 'complete' || kind === 'levelup') _chimeComplete();
    else _chimeCorrect();
  } catch (_) { /* silent */ }
}

/** Lightweight canvas confetti. `count` defaults to 90. */
export function burstConfetti({ count = 90 } = {}) {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const style = canvas.style;
    style.position = 'fixed';
    style.inset = '0';
    style.width = '100%';
    style.height = '100%';
    style.pointerEvents = 'none';
    style.zIndex = '9999';
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    const W = canvas.width;
    const H = canvas.height;
    const parts = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: -20 * dpr - Math.random() * H * 0.3,
      w: (6 + Math.random() * 6) * dpr,
      h: (10 + Math.random() * 8) * dpr,
      vy: (2.2 + Math.random() * 2.6) * dpr,
      vx: (Math.random() - 0.5) * 1.6 * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.22,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const started = performance.now();
    const DURATION = 1400;
    const tick = (now) => {
      const t = now - started;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y += p.vy;
        p.x += p.vx + Math.sin((t / 400) + p.rot) * 0.6 * dpr;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < DURATION) {
        window.requestAnimationFrame(tick);
      } else {
        canvas.remove();
      }
    };
    window.requestAnimationFrame(tick);
  } catch (_) { /* silent */ }
}
