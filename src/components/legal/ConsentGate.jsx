/**
 * ConsentGate.jsx — Consent-driven feature gate (Faz 5c).
 *
 * Renders BEFORE the main app when the user hasn't accepted the Terms
 * of Service and Privacy Policy. Explains what is requested, why, what
 * data is involved, and what happens if the user refuses.
 *
 * "Never force" principle:
 *   • "Accept & Continue"   → grant consent via consentEngine, enter app
 *   • "Continue without advanced features" → skip consent, enter app
 *     with advanced PWA features (offline storage, push, etc.) disabled
 *
 * Design: full-screen overlay with bilingual text (en/ht), scrollable
 * policy summaries, and clear action buttons.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// ─── Policy text snippets (full policies at /legal/terms-of-service, /legal/privacy-policy) ──

const POLICIES = {
  what: {
    ht: (
      <span>
        Atelnyo mande konsantman ou pou estoke done lokalman sou aparèy ou
        (IndexedDB, cache) pou app la mache ofline — epi pou voye notifikasyon
        push sou kou, mesaj, ak aktivite kreyatè. Nou detekte kapasite aparèy ou
        tou (memwa, CPU, rezo) pou nou adapte eksperyans lan byen mache sou
        telefòn ou.
      </span>
    ),
    en: (
      <span>
        Atelnyo asks for your consent to store data locally on your device
        (IndexedDB, cache) so the app works offline — and to send you push
        notifications about courses, messages, and creator activity. We also
        detect your device capabilities (memory, CPU, network) so we can adapt
        the experience to run smoothly on your phone.
      </span>
    ),
    fr: (
      <span>
        Atelnyo demande votre consentement pour stocker des données localement
        sur votre appareil (IndexedDB, cache) afin que l'application fonctionne
        hors ligne — et pour vous envoyer des notifications push concernant
        les cours, messages et activités des créateurs. Nous détectons également
        les capacités de votre appareil (mémoire, CPU, réseau) pour adapter
        l'expérience et la faire fonctionner correctement sur votre téléphone.
      </span>
    ),
    es: (
      <span>
        Atelnyo solicita tu consentimiento para almacenar datos localmente en
        tu dispositivo (IndexedDB, caché) para que la aplicación funcione sin
        conexión — y para enviarte notificaciones push sobre cursos, mensajes
        y actividad de creadores. También detectamos las capacidades de tu
        dispositivo (memoria, CPU, red) para adaptar la experiencia y que
        funcione sin problemas en tu teléfono.
      </span>
    ),
  },
  why: {
    en: (
      <ul>
        <li><strong>Offline mode:</strong> Continue browsing courses, your saved items, and your portfolio even without internet.</li>
        <li><strong>Fast startup:</strong> Cached resources load instantly instead of waiting for the network.</li>
        <li><strong>Push notifications:</strong> Get notified when a creator you follow publishes a new course or when someone replies to your message.</li>
        <li><strong>Adaptive performance:</strong> On low-end devices we disable heavy animations and reduce background work to save battery.</li>
      </ul>
    ),
    ht: (
      <ul>
        <li><strong>Mode ofline:</strong> Kontinye navige kou, atik sove yo, ak pòtfolyo ou menm san entènèt.</li>
        <li><strong>Demaraj rapid:</strong> Resous ki nan cache chaje imedyatman olye rete tann rezo a.</li>
        <li><strong>Notifikasyon push:</strong> Resevwa avi lè yon kreyatè ou suiv pibliye yon nouvo kou oswa lè yon moun reponn mesaj ou.</li>
        <li><strong>Pèfòmans adaptatif:</strong> Sou aparèy ki pa pisan nou dezaktive animasyon lou epi redwi travay background pou ekonomize batri.</li>
      </ul>
    ),
    fr: (
      <ul>
        <li><strong>Mode hors ligne :</strong> Continuez à parcourir les cours, vos éléments enregistrés et votre portfolio même sans Internet.</li>
        <li><strong>Démarrage rapide :</strong> Les ressources en cache se chargent instantanément au lieu d'attendre le réseau.</li>
        <li><strong>Notifications push :</strong> Soyez notifié lorsqu'un créateur que vous suivez publie un nouveau cours ou lorsque quelqu'un répond à votre message.</li>
        <li><strong>Performance adaptative :</strong> Sur les appareils bas de gamme, nous désactivons les animations lourdes et réduisons le travail en arrière-plan pour économiser la batterie.</li>
      </ul>
    ),
    es: (
      <ul>
        <li><strong>Modo sin conexión:</strong> Sigue navegando cursos, tus elementos guardados y tu portafolio incluso sin Internet.</li>
        <li><strong>Inicio rápido:</strong> Los recursos en caché se cargan instantáneamente en lugar de esperar la red.</li>
        <li><strong>Notificaciones push:</strong> Recibe notificaciones cuando un creador que sigues publique un nuevo curso o cuando alguien responda a tu mensaje.</li>
        <li><strong>Rendimiento adaptativo:</strong> En dispositivos de gama baja deshabilitamos animaciones pesadas y reducimos el trabajo en segundo plano para ahorrar batería.</li>
      </ul>
    ),
  },
  data: {
    en: (
      <ul>
        <li><strong>Stored locally:</strong> Your language preference, theme (dark/light), saved items list, welcome checklist progress. This never leaves your device.</li>
        <li><strong>Sent to our server:</strong> Anonymous crash reports (error message + page URL only — no personal data). Device capability profile (memory, CPU — not your identity).</li>
        <li><strong>Never collected:</strong> Your passwords, private keys, browsing history, or message content.</li>
      </ul>
    ),
    ht: (
      <ul>
        <li><strong>Estoke lokalman:</strong> Preferans lang ou, tèm (nwa/klè), lis atik sove, pwogrè checklist akeyi. Sa pa janm kite aparèy ou.</li>
        <li><strong>Voye sou sèvè nou:</strong> Rapò erè anonim (mesaj erè + URL paj la sèlman — pa gen done pèsonèl). Pwofil kapasite aparèy (memwa, CPU — pa idantite ou).</li>
        <li><strong>Pa janm kolekte:</strong> Modpas ou, kle prive, istorik navigasyon, oswa kontni mesaj.</li>
      </ul>
    ),
    fr: (
      <ul>
        <li><strong>Stocké localement :</strong> Votre préférence de langue, votre thème (sombre/clair), votre liste d'éléments enregistrés, la progression de la liste de bienvenue. Ces données ne quittent jamais votre appareil.</li>
        <li><strong>Envoyé à notre serveur :</strong> Rapports de plantage anonymes (message d'erreur + URL de la page uniquement — aucune donnée personnelle). Profil de capacités de l'appareil (mémoire, CPU — pas votre identité).</li>
        <li><strong>Jamais collecté :</strong> Vos mots de passe, clés privées, historique de navigation ou contenu des messages.</li>
      </ul>
    ),
    es: (
      <ul>
        <li><strong>Almacenado localmente:</strong> Tu preferencia de idioma, tema (oscuro/claro), lista de elementos guardados, progreso de la lista de bienvenida. Esto nunca sale de tu dispositivo.</li>
        <li><strong>Enviado a nuestro servidor:</strong> Informes de fallos anónimos (solo mensaje de error + URL de la página, sin datos personales). Perfil de capacidades del dispositivo (memoria, CPU, no tu identidad).</li>
        <li><strong>Nunca se recopila:</strong> Tus contraseñas, claves privadas, historial de navegación o contenido de mensajes.</li>
      </ul>
    ),
  },
  refuse: {
    en: (
      <span>
        You can still use Atelnyo — browse courses, view creator profiles,
        and explore music/talent. Advanced features like <strong>offline mode</strong>,
        <strong>push notifications</strong>, and <strong>local storage of your settings</strong>
        will be unavailable. You can grant consent later in Settings → Permissions.
      </span>
    ),
    ht: (
      <span>
        Ou ka toujou itilize Atelnyo — navige kou, gade pwofil kreyatè, epi
        eksplore mizik/talan. Fonksyonalite avanse tankou <strong>mode ofline</strong>,
        <strong>notifikasyon push</strong>, ak <strong>estokaj lokal paramèt ou yo</strong>
        p ap disponib. Ou ka bay konsantman pita nan Paramèt → Pèmisyon.
      </span>
    ),
    fr: (
      <span>
        Vous pouvez toujours utiliser Atelnyo — parcourir les cours, consulter
        les profils de créateurs et explorer la musique/talent. Les fonctionnalités
        avancées comme le <strong>mode hors ligne</strong>, les
        <strong>notifications push</strong> et le <strong>stockage local de vos paramètres</strong>
        ne seront pas disponibles. Vous pouvez accorder votre consentement plus tard
        dans Paramètres → Permissions.
      </span>
    ),
    es: (
      <span>
        Todavía puedes usar atelnyo: explorar cursos, ver perfiles de creadores
        y descubrir música/talentos. Las funciones avanzadas como el <strong>modo
        sin conexión</strong>, las <strong>notificaciones push</strong> y el
        <strong>almacenamiento local de tu configuración</strong> no estarán
        disponibles. Puedes otorgar tu consentimiento más tarde en Configuración → Permisos.
      </span>
    ),
  },
  privacy: {
    en: (
      <span>
        By continuing, you agree to our{' '}
        <Link to="/legal/terms-of-service">Terms of Service</Link>{' '}
        and{' '}
        <Link to="/legal/privacy-policy">Privacy Policy</Link>.
      </span>
    ),
    ht: (
      <span>
        Lè w kontinye, ou dakò ak{' '}
        <Link to="/legal/terms-of-service">Kondisyon Sèvis</Link>{' '}
        nou yo ak{' '}
        <Link to="/legal/privacy-policy">Politik Konfidansyalite</Link>{' '}
        nou an.
      </span>
    ),
    fr: (
      <span>
        En continuant, vous acceptez nos{' '}
        <Link to="/legal/terms-of-service">Conditions d'utilisation</Link>{' '}
        et notre{' '}
        <Link to="/legal/privacy-policy">Politique de confidentialité</Link>.
      </span>
    ),
    es: (
      <span>
        Al continuar, aceptas nuestros{' '}
        <Link to="/legal/terms-of-service">Términos de servicio</Link>{' '}
        y nuestra{' '}
        <Link to="/legal/privacy-policy">Política de privacidad</Link>.
      </span>
    ),
  },
};

// ─── Component ──────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string} props.lang       — 'ht' | 'en'
 * @param {function} props.onAccept — called when user clicks "Accept & Continue"
 * @param {function} props.onSkip   — called when user clicks "Continue without..."
 */
export default function ConsentGate({ lang = 'ht', onAccept, onSkip }) {
  const isHt = lang === 'ht';
  const isFr = lang === 'fr';
  const isEs = lang === 'es';

  const t = (ht, en, fr, es) => {
    if (isHt) return ht;
    if (isFr) return fr;
    if (isEs) return es;
    return en;
  };

  const [busy, setBusy] = useState(false);

  const T = {
    title: t('Byenveni sou Atelnyo', 'Welcome to Atelnyo', 'Bienvenue sur Atelnyo', 'Bienvenido a Atelnyo'),
    subtitle: t(
      'Pou nou ka ofri ou pi bon eksperyans posib, nou bezwen konsantman ou pou kèk fonksyonalite.',
      'To give you the best possible experience, we need your consent for a few features.',
      'Pour vous offrir la meilleure expérience possible, nous avons besoin de votre consentement pour certaines fonctionnalités.',
      'Para brindarte la mejor experiencia posible, necesitamos tu consentimiento para algunas funcionalidades.'
    ),
    whatTitle: t('Kisa nou mande', 'What we ask', 'Ce que nous demandons', 'Lo que pedimos'),
    whyTitle: t('Poukisa nou bezwen li', 'Why we need it', 'Pourquoi nous en avons besoin', 'Por qué lo necesitamos'),
    dataTitle: t('Ki done ki enplike', 'What data is involved', 'Quelles données sont impliquées', 'Qué datos intervienen'),
    refuseTitle: t('Kisa k ap pase si w refize', 'What happens if you refuse', 'Ce qui se passe si vous refusez', 'Qué pasa si rechazas'),
    acceptBtn: t('Aksepte epi Kontinye', 'Accept & Continue', 'Accepter et continuer', 'Aceptar y continuar'),
    skipBtn: t(
      'Kontinye san fonksyonalite avanse',
      'Continue without advanced features',
      'Continuer sans fonctionnalités avancées',
      'Continuar sin funcionalidades avanzadas'
    ),
    privacyLine: t(
      'Lè w kontinye, ou dakò ak Kondisyon Sèvis ak Politik Konfidansyalite nou yo.',
      'By continuing, you agree to our Terms of Service and Privacy Policy.',
      'En continuant, vous acceptez nos Conditions d\'utilisation et notre Politique de confidentialité.',
      'Al continuar, aceptas nuestros Términos de servicio y Política de privacidad.'
    ),
    links: isHt ? (
      <span>
        <Link to="/legal/terms-of-service">Kondisyon Sèvis</Link>
        {' '}ak{' '}
        <Link to="/legal/privacy-policy">Politik Konfidansyalite</Link>
      </span>
    ) : isFr ? (
      <span>
        <Link to="/legal/terms-of-service">Conditions d'utilisation</Link>
        {' '}et{' '}
        <Link to="/legal/privacy-policy">Politique de confidentialité</Link>
      </span>
    ) : isEs ? (
      <span>
        <Link to="/legal/terms-of-service">Términos de servicio</Link>
        {' '}y{' '}
        <Link to="/legal/privacy-policy">Política de privacidad</Link>
      </span>
    ) : (
      <span>
        <Link to="/legal/terms-of-service">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/legal/privacy-policy">Privacy Policy</Link>
      </span>
    ),
  };

  const handleAccept = async () => {
    setBusy(true);
    try { if (onAccept) await onAccept(); } catch (_) {}
    setBusy(false);
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
  };

  return (
    <div className="consent-gate-overlay" role="dialog" aria-modal="true" aria-label={T.title}>
      <div className="consent-gate-card">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="consent-gate-header">
          <div className="consent-gate-logo">
            <i className="fas fa-shield-haltered" aria-hidden="true" />
          </div>
          <h1 className="consent-gate-title">{T.title}</h1>
          <p className="consent-gate-subtitle">{T.subtitle}</p>
        </div>

        {/* ── Policy sections ────────────────────────────────── */}
        <div className="consent-gate-sections">
          <Section icon="fa-circle-info" title={T.whatTitle}>
            {POLICIES.what[lang]}
          </Section>

          <Section icon="fa-lightbulb" title={T.whyTitle}>
            {POLICIES.why[lang]}
          </Section>

          <Section icon="fa-database" title={T.dataTitle}>
            {POLICIES.data[lang]}
          </Section>

          <Section icon="fa-hand" title={T.refuseTitle}>
            {POLICIES.refuse[lang]}
          </Section>
        </div>

        {/* ─── Privacy links ─────────────────────────────────── */}
        <p className="consent-gate-privacy">
          <i className="fas fa-lock" aria-hidden="true" />{' '}
          {T.privacyLine}{' '}
          {T.links}
        </p>

        {/* ── Actions ────────────────────────────────────────── */}
        <div className="consent-gate-actions">
          <button
            type="button"
            className="consent-gate-btn consent-gate-btn--primary"
            onClick={handleAccept}
            disabled={busy}
          >
            {busy ? '…' : (
              <>
                <i className="fas fa-check" aria-hidden="true" /> {T.acceptBtn}
              </>
            )}
          </button>
          <button
            type="button"
            className="consent-gate-btn consent-gate-btn--secondary"
            onClick={handleSkip}
            disabled={busy}
          >
            {T.skipBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: collapsible policy section ────────────────────────────
function Section({ icon, title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <details className="consent-gate-section" open={open} onToggle={e => setOpen(e.target.open)}>
      <summary className="consent-gate-section-title">
        <i className={`fas ${icon}`} aria-hidden="true" /> {title}
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} consent-gate-chevron`} aria-hidden="true" />
      </summary>
      <div className="consent-gate-section-body">{children}</div>
    </details>
  );
}
