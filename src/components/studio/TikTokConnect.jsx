/**
 * src/components/studio/TikTokConnect.jsx
 *
 * Media tab → "TikTok" sub-tab (4th of hub/provider/library/tiktok):
 * the OAuth connection card (Faz A.6) + mobile redirect fallback (A.9).
 *
 * Flow (decision #1 — no TikTok token ever reaches this component):
 *   1. POST /api/tiktok/auth/start/  → { auth_url }
 *   2. Open it in a popup (desktop) or same-tab redirect (mobile —
 *      mobile browsers block OAuth popups, A.9).
 *   3. TikTok consent → backend /auth/callback/ validates the signed
 *      one-time state, persists tokens server-side, then closes the
 *      popup via postMessage + window.close.
 *
 * Plan: docs/features/TIKTOK_INTEGRATION_PLAN.md
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../services/api';
import { tiktokService } from '../../services/tiktokService';
import TikTokPostStatus from './TikTokPostStatus';
import { TikTokPublishModal } from './modals';
import styles from './TikTokConnect.module.css';

// Localized copy (ht primary — plan C.5). Fallback keys follow the `t.x || 'default'`
// convention used across Creator Studio.
const T = {
  title: { ht: 'TikTok', en: 'TikTok', fr: 'TikTok', es: 'TikTok' },
  subtitle: {
    ht: 'Pibliye videyo Atelnyo ou yo dirèkteman sou TikTok.',
    en: 'Publish your Atelnyo videos straight to TikTok.',
    fr: 'Publiez vos vidéos Atelnyo directement sur TikTok.',
    es: 'Publica tus videos de Atelnyo directamente en TikTok.',
  },
  connect: { ht: 'Konekte kont TikTok ou', en: 'Connect your TikTok account', fr: 'Connecter votre compte TikTok', es: 'Conectar tu cuenta de TikTok' },
  connecting: { ht: 'Ap konekte…', en: 'Connecting…', fr: 'Connexion…', es: 'Conectando…' },
  disconnect: { ht: 'Dekonekte', en: 'Disconnect', fr: 'Déconnecter', es: 'Desconectar' },
  connected: { ht: 'Konekte', en: 'Connected', fr: 'Connecté', es: 'Conectado' },
  notConnected: { ht: 'Pa konekte', en: 'Not connected', fr: 'Non connecté', es: 'No conectado' },
  disconnectedToast: { ht: 'Kont TikTok dekonekte.', en: 'TikTok account disconnected.', fr: 'Compte TikTok déconnecté.', es: 'Cuenta de TikTok desconectada.' },
  connectedToast: { ht: 'Kont TikTok konekte ✓', en: 'TikTok account connected ✓', fr: 'Compte TikTok connecté ✓', es: 'Cuenta de TikTok conectada ✓' },
  notConfigured: {
    ht: 'TikTok poko configure sou serveur a (TIKTOK_ENABLED / kredansyèl yo).',
    en: 'TikTok is not configured on the server yet (TIKTOK_ENABLED / credentials).',
    fr: 'TikTok n’est pas encore configuré sur le serveur (TIKTOK_ENABLED / identifiants).',
    es: 'TikTok aún no está configurado en el servidor (TIKTOK_ENABLED / credenciales).',
  },
  error: { ht: 'Erè — eseye ankò.', en: 'Something went wrong — try again.', fr: 'Une erreur est survenue — réessayez.', es: 'Ocurrió un error — inténtalo de nuevo.' },
  popupBlocked: {
    ht: 'Popup la bloke — pèmèt popup pou sit sa a epi eseye ankò.',
    en: 'Popup blocked — allow popups for this site and retry.',
    fr: 'Fenêtre bloquée — autorisez les fenêtres pour ce site, puis réessayez.',
    es: 'Ventana bloqueada: permite las ventanas emergentes de este sitio e inténtalo de nuevo.',
  },
  expires: { ht: 'Token fini nan', en: 'Token expires in', fr: 'Le jeton expire dans', es: 'El token vence en' },
  hours: { ht: 'è', en: 'h', fr: 'h', es: 'h' },
  days: { ht: 'jou', en: 'd', fr: 'j', es: 'd' },
  // C.5 — publish entry + post history (in the same media sub-tab)
  newPost: { ht: 'Nouvo pòs TikTok', en: 'New TikTok post', fr: 'Nouvelle publication TikTok', es: 'Nueva publicación de TikTok' },
  history: { ht: 'Istory pòs ou yo', en: 'Your post history', fr: 'Historique de vos publications', es: 'Historial de publicaciones' },
  historyEmpty: { ht: 'Ou poko pibliye anyen sou TikTok depi isit la.', en: 'You have not published to TikTok from here yet.', fr: 'Vous n’avez encore rien publié sur TikTok depuis ici.', es: 'Aún no has publicado nada en TikTok desde aquí.' },
  historyError: { ht: 'Istory a pa chaje — eseye ankò.', en: 'History failed to load — try again.', fr: 'Impossible de charger l’historique — réessayez.', es: 'No se pudo cargar el historial — inténtalo de nuevo.' },
};

function tt(lang, key) {
  const entry = T[key];
  if (!entry) return '';
  return entry[lang] || entry.en;
}

export default function TikTokConnect({ lang = 'ht', showToast }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const popupRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tiktokService.status();
      setStatus(data || { connected: false, configured: false });
    } catch {
      setStatus({ connected: false, configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  // C.5 — own post history, fetched once connected.
  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const { data } = await tiktokService.listPosts();
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch {
      if (showToast) showToast(tt(lang, 'historyError'));
    } finally {
      setPostsLoading(false);
    }
  }, [showToast, lang]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) load();
    });
    return () => { cancelled = true; };
  }, [load]);

  // Same-tab OAuth fallback returns to the Studio with a one-time result.
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('tiktok_auth');
    if (!result) return;

    if (result === 'ok') {
      Promise.resolve().then(() => {
        load();
        loadPosts();
      });
      showToast?.(tt(lang, 'connectedToast'));
    } else {
      showToast?.(url.searchParams.get('message') || tt(lang, 'error'));
    }
    url.searchParams.delete('tiktok_auth');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [load, loadPosts, showToast, lang]);

  // The backend callback bridge posts { ok: 'true'|'false', message }.
  useEffect(() => {
    function onMessage(ev) {
      const d = ev && ev.data;
      const expectedOrigin = new URL(API_URL, window.location.href).origin;
      if (
        ev.origin !== expectedOrigin
        || ev.source !== popupRef.current
        || !d
        || typeof d.ok === 'undefined'
      ) return;
      setConnecting(false);
      setPopupBlocked(false);
      load();
      if (d.ok === 'true') loadPosts();
      if (showToast) {
        showToast(d.ok === 'true' ? tt(lang, 'connectedToast') : (d.message || tt(lang, 'error')));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [load, loadPosts, showToast, lang]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const connected = Boolean(status && status.connected);
  // C.5 — history loads when the account is connected (and reloads after
  // an OAuth popup completes, via the message listener above).
  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadPosts();
    });
    return () => { cancelled = true; };
  }, [connected, loadPosts]);

  // C.4 — TikTokPostStatus polls inflight rows and lifts fresh state up.
  const onPostUpdate = useCallback((fresh) => {
    setPosts((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
  }, []);

  const connect = async () => {
    setConnecting(true);
    setPopupBlocked(false);
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
    if (!isMobile) {
      const w = 560;
      const h = 760;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 3);
      popupRef.current = window.open(
        'about:blank',
        'tiktok_oauth',
        `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
      );
      if (!popupRef.current || popupRef.current.closed) {
        setConnecting(false);
        setPopupBlocked(true);
        return;
      }
    }
    try {
      const { data } = await tiktokService.startAuth();
      const url = data && data.auth_url;
      if (!url) throw new Error('no auth_url');

      // A.9 — mobile: popups get blocked, use a same-tab redirect.
      if (isMobile) {
        window.location.href = url;
        return;
      }

      popupRef.current.location.href = url;
      // Closed manually without messaging → refresh status anyway.
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (!popupRef.current || popupRef.current.closed) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setConnecting(false);
          load();
        }
      }, 800);
    } catch (err) {
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      setConnecting(false);
      if (showToast) {
        showToast(
          err && err.response && err.response.status === 503
            ? tt(lang, 'notConfigured')
            : tt(lang, 'error'),
        );
      }
    }
  };

  const disconnect = async () => {
    try {
      await tiktokService.disconnect();
      if (showToast) showToast(tt(lang, 'disconnectedToast'));
      await load();
    } catch {
      if (showToast) showToast(tt(lang, 'error'));
    }
  };

  const expiryLabel = (() => {
    const sec = status && status.token_expires_in_sec;
    if (typeof sec !== 'number') return '';
    if (sec >= 86400) return `${Math.floor(sec / 86400)} ${tt(lang, 'days')}`;
    return `${Math.floor(sec / 3600)} ${tt(lang, 'hours')}`;
  })();

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.brandIcon} aria-hidden="true">
          <i className="fab fa-tiktok" />
        </div>
        <div>
          <h3 className={styles.title}>{tt(lang, 'title')}</h3>
          <p className={styles.subtitle}>{tt(lang, 'subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.row}>
          <span className={styles.spinner} aria-hidden="true" />
        </div>
      ) : (
        <>
          {status && status.configured === false && (
            <p className={styles.warn}>{tt(lang, 'notConfigured')}</p>
          )}

          {status && status.connected ? (
            <div className={styles.row}>
              {status.avatar_url
                ? <img className={styles.avatar} src={status.avatar_url} alt="" />
                : <div className={styles.brandIcon} aria-hidden="true"><i className="fas fa-user" /></div>}
              <div>
                <div className={styles.name}>{status.display_name || tt(lang, 'title')}</div>
                {expiryLabel && (
                  <p className={styles.muted}>
                    {tt(lang, 'expires')} {expiryLabel}
                  </p>
                )}
              </div>
              <span className={`${styles.badge} ${styles.badgeOk}`}>{tt(lang, 'connected')}</span>
            </div>
          ) : (
            <div className={styles.row}>
              <span className={`${styles.badge} ${styles.badgeOff}`}>{tt(lang, 'notConnected')}</span>
            </div>
          )}

          {status && status.connected ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={disconnect}
            >
              <i className="fas fa-unlink" aria-hidden="true" />
              {tt(lang, 'disconnect')}
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={connect}
              disabled={connecting}
            >
              {connecting
                ? <span className={styles.spinner} aria-hidden="true" />
                : <i className="fab fa-tiktok" aria-hidden="true" />}
              {connecting ? tt(lang, 'connecting') : tt(lang, 'connect')}
            </button>
          )}

          {popupBlocked && (
            <p className={styles.warn}>{tt(lang, 'popupBlocked')}</p>
          )}
        </>
      )}

      {/* ── Faz C: publish entry + post history (same sub-tab) ─────── */}
      {connected && (
        <div className={styles.section}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setShowPublish(true)}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            {tt(lang, 'newPost')}
          </button>

          <h4 className={styles.sectionTitle}>{tt(lang, 'history')}</h4>
          {postsLoading ? (
            <div className={styles.row}>
              <span className={styles.spinner} aria-hidden="true" />
            </div>
          ) : posts.length === 0 ? (
            <p className={styles.muted}>{tt(lang, 'historyEmpty')}</p>
          ) : (
            <ul className={styles.postList}>
              {posts.slice(0, 10).map((p) => (
                <li key={p.id} className={styles.postItem}>
                  <span className={styles.postTitle}>
                    {p.title || (lang === 'ht' ? '(san tit)' : '(untitled)')}
                  </span>
                  <TikTokPostStatus post={p} lang={lang} onUpdate={onPostUpdate} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showPublish && (
        <TikTokPublishModal
          onClose={() => setShowPublish(false)}
          lang={lang}
          showToast={showToast}
          onPosted={(post) => {
            setPosts((prev) => [post, ...prev.filter((x) => x.id !== post.id)]);
          }}
        />
      )}
    </div>
  );
}
