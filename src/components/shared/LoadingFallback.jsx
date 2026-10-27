/**
 * src/components/shared/LoadingFallback.jsx
 *
 * Suspense fallback with a deadline.
 *
 * A lazy chunk (or any code-split route) normally resolves in well under a
 * second. But a request that is accepted and never answered — a hung
 * connection, a captive portal, an edge node serving a stale asset — leaves
 * <Suspense> showing a spinner indefinitely, and the page reads as frozen.
 * This fallback shows the same spinner at first, then (after `timeoutMs`)
 * replaces it with an explanation and a one-tap reload, so the user is never
 * stuck on a spinner with no explanation and no way out.
 *
 * Usage:
 *   <Suspense fallback={<LoadingFallback fullPage lang={lang} />}>
 *     <LazyThing />
 *   </Suspense>
 */
import React, { useEffect, useState } from 'react';

const COPY = {
  en: {
    loading: 'Loading…',
    slow_title: 'This is taking longer than usual',
    slow_body: 'The connection may be slow or interrupted. Check your network, then reload the page.',
    reload: 'Reload page',
  },
  ht: {
    loading: 'Chajman…',
    slow_title: 'Sa ap pran twòp tan',
    slow_body: 'Koneksyon an ka dous oswa koupe. Verifye rezo w, epi rechaje paj la.',
    reload: 'Rechaje paj la',
  },
  fr: {
    loading: 'Chargement…',
    slow_title: 'Cela prend plus de temps que prévu',
    slow_body: 'La connexion est peut-être lente ou interrompue. Vérifiez votre réseau, puis rechargez la page.',
    reload: 'Recharger la page',
  },
  es: {
    loading: 'Cargando…',
    slow_title: 'Esto está tardando más de lo normal',
    slow_body: 'Es posible que la conexión esté lenta o interrumpida. Revisa tu red y recarga la página.',
    reload: 'Recargar la página',
  },
};

export default function LoadingFallback({
  lang = 'en',
  fullPage = false,
  timeoutMs = 12000,
  color = '#6366f1',
}) {
  const [timedOut, setTimedOut] = useState(false);
  const t = COPY[lang] || COPY.en;

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div
        role="alert"
        style={{
          ...(fullPage ? { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--surface-page, var(--bg-page, #fff))' } : null),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: fullPage ? 24 : '40px 16px',
          textAlign: 'center',
        }}
      >
        <i className="fas fa-triangle-exclamation fa-2x" style={{ color: '#f59e0b' }} aria-hidden="true" />
        <strong style={{ fontSize: '0.95rem' }}>{t.slow_title}</strong>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', maxWidth: 420 }}>
          {t.slow_body}
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: '9px 18px',
            border: 'none',
            borderRadius: 8,
            background: color,
            color: '#fff',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          {t.reload}
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...(fullPage ? { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--surface-page, var(--bg-page, #ffdae9))' } : null),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: fullPage ? 0 : '60px 0',
      }}
    >
      <i className="fas fa-spinner fa-pulse fa-2x" style={{ color }} aria-hidden="true" />
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>{t.loading}</span>
    </div>
  );
}
