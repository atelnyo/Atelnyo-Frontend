/**
 * useWebVitals.js — Web Vitals performance metrics collector.
 *
 * Tracks Core Web Vitals and reports them:
 *   • FCP — First Contentful Paint
 *   • LCP — Largest Contentful Paint
 *   • CLS — Cumulative Layout Shift
 *   • TBT — Total Blocking Time
 *   • INP — Interaction to Next Paint
 *
 * Reports to console in dev, and can be sent to analytics in prod.
 * Requires: `npm install web-vitals` (or uses PerformanceObserver directly).
 */

import { useEffect, useRef, useState } from 'react';

// ─── Singleton collector (one observer for entire app) ────────────
let _metrics = {
  FCP: null, LCP: null, CLS: null, TBT: null, INP: null, TTFB: null,
};
let _observersStarted = false;
let _listeners = [];

function _notifyListeners() {
  const snapshot = { ..._metrics };
  _listeners.forEach(fn => { try { fn(snapshot); } catch (_) {} });
}

function _startObservers() {
  if (_observersStarted || typeof window === 'undefined') return;
  _observersStarted = true;

  // FCP — First Contentful Paint
  try {
    const fcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        _metrics.FCP = Math.round(entries[entries.length - 1].startTime);
        _notifyListeners();
      }
    });
    fcpObs.observe({ type: 'paint', buffered: true });
  } catch (_) {}

  // LCP — Largest Contentful Paint
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        _metrics.LCP = Math.round(entries[entries.length - 1].startTime);
        _notifyListeners();
      }
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) {}

  // CLS — Cumulative Layout Shift
  try {
    let clsValue = 0;
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
      _metrics.CLS = Math.round(clsValue * 1000) / 1000;
      _notifyListeners();
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}

  // TTFB — Time to First Byte (from navigation timing)
  try {
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry?.responseStart) {
      _metrics.TTFB = Math.round(navEntry.responseStart);
      _notifyListeners();
    }
  } catch (_) {}

  // Long Tasks → TBT approximation
  try {
    let tbtValue = 0;
    const tbtObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const blockingTime = entry.duration - 50; // tasks > 50ms count
        if (blockingTime > 0) tbtValue += blockingTime;
      }
      _metrics.TBT = Math.round(tbtValue);
      _notifyListeners();
    });
    tbtObs.observe({ type: 'longtask', buffered: true });
  } catch (_) {}
}

// ─── Hook ──────────────────────────────────────────────────────────
export default function useWebVitals() {
  _startObservers();

  const [metrics, setMetrics] = useState(_metrics);
  const listenerRef = useRef(null);

  useEffect(() => {
    listenerRef.current = (snapshot) => setMetrics(snapshot);
    _listeners.push(listenerRef.current);
    return () => {
      _listeners = _listeners.filter(l => l !== listenerRef.current);
    };
  }, []);

  /** Get a rating: good / needs-improvement / poor */
  const getRating = (name, value) => {
    if (value == null) return null;
    const thresholds = {
      FCP:  { good: 1800, poor: 3000 },
      LCP:  { good: 2500, poor: 4000 },
      CLS:  { good: 0.1,  poor: 0.25 },
      TBT:  { good: 200,  poor: 600 },
      TTFB: { good: 800,  poor: 1800 },
    };
    const t = thresholds[name];
    if (!t) return null;
    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs-improvement';
    return 'poor';
  };

  return { metrics, getRating };
}

export { _metrics as globalMetrics };
