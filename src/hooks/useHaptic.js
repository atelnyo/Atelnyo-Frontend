/**
 * useHaptic.js — Haptic / vibration feedback hook.
 *
 * Provides short vibration pulses for touch interactions:
 *   • tap()       — 15ms tap feedback
 *   • success()   — double pulse (success confirm)
 *   • error()     — triple pulse (error feedback)
 *   • custom(ms)  — custom duration
 *
 * Auto-detects vibration support. No-ops on desktop/unavailable.
 */

import { useCallback } from 'react';

const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export default function useHaptic() {
  const tap = useCallback(() => {
    if (!isSupported) return;
    try { navigator.vibrate(15); } catch (_) {}
  }, []);

  const success = useCallback(() => {
    if (!isSupported) return;
    try { navigator.vibrate([20, 50, 40]); } catch (_) {}
  }, []);

  const error = useCallback(() => {
    if (!isSupported) return;
    try { navigator.vibrate([30, 40, 30, 40, 60]); } catch (_) {}
  }, []);

  const custom = useCallback((pattern) => {
    if (!isSupported) return;
    try { navigator.vibrate(pattern); } catch (_) {}
  }, []);

  return { tap, success, error, custom, isSupported };
}
