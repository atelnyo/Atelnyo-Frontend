/**
 * src/components/settings/InstallAppPanel.jsx
 *
 * PWA Installation Manager — Settings surface.
 *
 * Renders the full install lifecycle for the current device, driven
 * entirely by ``installationManager.getState()``:
 *
 *   • installed         → green status: "Atelnyo enstale ✓"
 *   • prompt_available  → primary "Enstale" button (fires the captured
 *                         native dialog) + store availability buttons
 *   • installable       → browser hasn't fired the event yet (waiting)
 *   • requested         → native dialog is open
 *   • accepted          → UX outcome: user accepted the dialog. NOT
 *                         proof of installation — the real install may
 *                         still be finishing (or have failed); only the
 *                         appinstalled event confirms completion.
 *   • instructions      → step-by-step Add-to-Home-Screen / Install app
 *                         fallback for iOS Safari and non-prompt
 *                         browsers (platform-aware)
 *   • unsupported       → honest "no install path on this browser"
 *
 * Integration points (mirrors the Atelnyo architecture):
 *   App controller (installationManager) · manifest.json · sw.js · UI.
 */
import React, { useEffect, useState } from 'react';
import installationManager from '../../pwa/installation/InstallationManager';
import { INSTALL_STATES } from '../../pwa/installation/installationTypes';

function copy(lang, key) {
  const T = {
    installedTitle: { ht: 'Atelnyo enstale sou aparèy ou', en: 'Atelnyo is installed on your device', fr: 'Atelnyo est installé sur votre appareil', es: 'Atelnyo está instalado en su dispositivo' },
    installedBody: { ht: 'W ap jwenn aksè rapid, menm offline. Louvri l nan meni aplikasyon ou yo.', en: 'You get quick access, even offline. Open it from your app menu.', fr: 'Accès rapide, même hors ligne. Ouvrez-le depuis votre menu d’applications.', es: 'Acceso rápido, incluso sin conexión. Ábrelo desde su menú de aplicaciones.' },
    installedStandalone: { ht: 'W ap kouri Atelnyo kòm aplikasyon endepandan (standalone) — pa yon tab browser.', en: 'You are running Atelnyo as a standalone app — not a browser tab.', fr: 'Vous exécutez Atelnyo en tant qu’application autonome — pas un onglet navigateur.', es: 'Está ejecutando Atelnyo como aplicación independiente, no una pestaña del navegador.' },
    installTitle: { ht: 'Enstale Atelnyo', en: 'Install Atelnyo', fr: 'Installer Atelnyo', es: 'Instalar Atelnyo' },
    installBody: { ht: 'Ajoute Atelnyo sou ekran akèy ou pou aksè rapid ak itilizasyon offline.', en: 'Add Atelnyo to your home screen for quick access and offline use.', fr: 'Ajoutez Atelnyo à votre écran d’accueil pour un accès rapide et hors ligne.', es: 'Añada Atelnyo a su pantalla de inicio para acceso rápido y uso sin conexión.' },
    installBtn: { ht: 'Enstale kounye a', en: 'Install now', fr: 'Installer maintenant', es: 'Instalar ahora' },
    waitingTitle: { ht: 'Browser la ap prepare enstalasyon an…', en: 'Your browser is preparing the install…', fr: 'Votre navigateur prépare l’installation…', es: 'Su navegador está preparando la instalación…' },
    waitingBody: { ht: 'Klike ankò nan kèk segonn — opsyon an ap parèt.', en: 'Tap again in a moment — the option is coming.', fr: 'Réessayez dans un instant — l’option apparaît.', es: 'Toque de nuevo en un momento: la opción aparece.' },
    manualBtn: { ht: 'Enstale manyèlman', en: 'Install manually', fr: 'Installer manuellement', es: 'Instalar manualmente' },
    resetDetect: { ht: 'Reyajiste deteksyon', en: 'Re-detect', fr: 'Redétecter', es: 'Redetectar' },
    requestedBody: { ht: 'Ap tann repons ou nan dyalòg la…', en: 'Waiting for your choice in the dialog…', fr: 'En attente de votre choix dans la boîte de dialogue…', es: 'Esperando su elección en el cuadro de diálogo…' },
    acceptedStatus: { ht: 'Ou aksepte', en: 'Accepted', fr: 'Accepté', es: 'Aceptado' },
    acceptedTitle: { ht: 'Enstalasyon an ap finalize…', en: 'Your install is finishing…', fr: 'Votre installation se termine…', es: 'Su instalación está finalizando…' },
    acceptedBody: { ht: 'Ou aksepte dyalòg la. Lè enstalasyon an fini VRE, Atelnyo ap konfime li — sa ka pran kèk segonn.', en: 'You accepted the dialog. Once the install truly finishes, Atelnyo will confirm — this can take a moment.', fr: 'Vous avez accepté la boîte de dialogue. Lorsque l’installation sera réellement terminée, Atelnyo le confirmera — cela peut prendre un instant.', es: 'Aceptó el diálogo. Cuando la instalación termine realmente, Atelnyo lo confirmará; puede tomar un momento.' },
    acceptedConfirmedStatus: { ht: 'Konplete', en: 'Completed', fr: 'Terminé', es: 'Completado' },
    acceptedConfirmedTitle: { ht: 'Enstalasyon konplete', en: 'Install completed', fr: 'Installation terminée', es: 'Instalación completada' },
    acceptedConfirmedBody: { ht: 'Browser la konplete enstalasyon an. Atelnyo ap konfime lè w relanse li kòm aplikasyon (standalone) — se deteksyon sa a ki fè `installed = true`.', en: 'The browser finished installing atelnyo. It will set the installed state when you relaunch it as an app (standalone) — that detection is what makes `installed = true`.', fr: 'Le navigateur a terminé l’installation d’atelnyo. Il définira l’état installé lorsque vous le relancerez en tant qu’application (autonome) — c’est cette détection qui rend `installed = true`.', es: 'El navegador terminó de instalar atelnyo. Establecerá el estado instalado cuando lo relance como aplicación (independiente); esa detección es lo que hace `installed = true`.' },
    instructionsTitle: { ht: 'Enstale manyèlman sou aparèy ou', en: 'Install manually on your device', fr: 'Installer manuellement sur votre appareil', es: 'Instalar manualmente en su dispositivo' },
    instructionsBody: { ht: 'Browser sa a pa gen bouton enstalasyon otomatik. Swiv etap sa yo:', en: 'This browser has no automatic install button. Follow these steps:', fr: 'Ce navigateur n’a pas de bouton d’installation automatique. Suivez ces étapes :', es: 'Este navegador no tiene botón de instalación automática. Siga estos pasos:' },
    iosStep1: { ht: 'Tape ikon Share (📤) anba a', en: 'Tap the Share icon (📤) at the bottom', fr: 'Touchez l’icône Partager (📤) en bas', es: 'Toque el icono Compartir (📤) en la parte inferior' },
    iosStep2: { ht: 'Chwazi “Add to Home Screen” nan lis la', en: 'Choose “Add to Home Screen” from the list', fr: 'Choisissez « Ajouter à l’écran d’accueil » dans la liste', es: 'Elija « Agregar a pantalla de inicio » de la lista' },
    iosStep3: { ht: 'Tape “Add” pou konfime.', en: 'Tap “Add” to confirm.', fr: 'Touchez « Ajouter » pour confirmer.', es: 'Toque « Agregar » para confirmar.' },
    browserMenuStep1: { ht: 'Tape ikon meni a (⋮) anwo adwat la', en: 'Tap the ⋮ menu icon at the top right', fr: 'Touchez l’icône de menu (⋮) en haut à droite', es: 'Toque el icono de menú (⋮) en la parte superior derecha' },
    browserMenuStep2: { ht: 'Chwazi “Add to Home screen” / “Install app”', en: 'Choose “Add to Home screen” / “Install app”', fr: 'Choisissez « Ajouter à l’écran d’accueil » / « Installer l’application »', es: 'Elija « Agregar a pantalla de inicio » / « Instalar aplicación »' },
    browserMenuStep3: { ht: 'Konfime ak “Add” / “Install”.', en: 'Confirm with “Add” / “Install”.', fr: 'Confirmez avec « Ajouter » / « Installer ».', es: 'Confirme con « Agregar » / « Instalar ».' },
    samsungStep1: { ht: 'Tape meni a (≡) anba adwat la', en: 'Tap the ≡ menu at the bottom right', fr: 'Touchez le menu (≡) en bas à droite', es: 'Toque el menú (≡) en la parte inferior derecha' },
    samsungStep2: { ht: 'Chwazi “Add page to” epi “Home screen”', en: 'Choose “Add page to” then “Home screen”', fr: 'Choisissez « Ajouter la page à » puis « Écran d’accueil »', es: 'Elija « Agregar página a » y luego « Pantalla de inicio »' },
    samsungStep3: { ht: 'Konfime ak “Add”.', en: 'Confirm with “Add”.', fr: 'Confirmez avec « Ajouter ».', es: 'Confirme con « Agregar ».' },
    macStep1: { ht: 'Klike Share (📤) nan ba zouti Safari a', en: 'Click the Share (📤) button in the Safari toolbar', fr: 'Cliquez sur le bouton Partager (📤) de la barre d’outils Safari', es: 'Haga clic en el botón Compartir (📤) de la barra de herramientas de Safari' },
    macStep2: { ht: 'Chwazi “Add to Dock” / “Ajoute nan Dock la”', en: 'Choose “Add to Dock”', fr: 'Choisissez « Ajouter au Dock »', es: 'Elija « Agregar al Dock »' },
    macStep3: { ht: 'Klike “Add” pou konfime — Atelnyo parèt nan Dock la.', en: 'Click “Add” to confirm — Atelnyo appears in your Dock.', fr: 'Cliquez sur « Ajouter » pour confirmer — Atelnyo apparaît dans le Dock.', es: 'Haga clic en « Agregar » para confirmar: Atelnyo aparece en el Dock.' },
    desktopStep1: { ht: 'Klike ikon enstalasyon an nan ba adrès la (oswa meni ⋮)', en: 'Click the install icon in the address bar (or the ⋮ menu)', fr: 'Cliquez sur l’icône d’installation dans la barre d’adresse (ou le menu ⋮)', es: 'Haga clic en el icono de instalación en la barra de direcciones (o el menú ⋮)' },
    desktopStep2: { ht: 'Chwazi “Install page as app” / “Enstale aplikasyon an”', en: 'Choose “Install page as app” / “Install app”', fr: 'Choisissez « Installer la page en tant qu’application »', es: 'Elija « Instalar página como aplicación »' },
    desktopStep3: { ht: 'Konfime ak “Install”.', en: 'Confirm with “Install”.', fr: 'Confirmez avec « Installer ».', es: 'Confirme con « Instalar ».' },
    edgeStep1: { ht: 'Klike meni a (⋯) anwo adwat la, epi chwazi “Apps”', en: 'Click the ⋯ menu at the top right, then choose “Apps”', fr: 'Cliquez sur le menu (⋯) en haut à droite, puis « Applications »', es: 'Haga clic en el menú (⋯) en la parte superior derecha y elija « Aplicaciones »' },
    edgeStep2: { ht: 'Chwazi “Install this site as an app”', en: 'Choose “Install this site as an app”', fr: 'Choisissez « Installer ce site en tant qu’application »', es: 'Elija « Instalar este sitio como aplicación »' },
    edgeStep3: { ht: 'Konfime ak “Install”.', en: 'Confirm with “Install”.', fr: 'Confirmez avec « Installer ».', es: 'Confirme con « Instalar ».' },
    operaStep1: { ht: 'Klike meni a (⋮) anwo adwat la', en: 'Click the ⋮ menu at the top right', fr: 'Cliquez sur le menu (⋮) en haut à droite', es: 'Haga clic en el menú (⋮) en la parte superior derecha' },
    operaStep2: { ht: 'Chwazi “Install page as app…” / “Enstale aplikasyon an”', en: 'Choose “Install page as app…” / “Install app”', fr: 'Choisissez « Installer la page en tant qu’application… »', es: 'Elija « Instalar página como aplicación… »' },
    operaStep3: { ht: 'Konfime ak “Install”.', en: 'Confirm with “Install”.', fr: 'Confirmez avec « Installer ».', es: 'Confirme con « Instalar ».' },
    methodShareSheet: { ht: 'Share sheet', en: 'Share sheet', fr: 'Feuille de partage', es: 'Hoja de compartir' },
    methodBrowserMenu: { ht: 'Meni browser la', en: 'Browser menu', fr: 'Menu du navigateur', es: 'Menú del navegador' },
    methodSamsungMenu: { ht: 'Meni Samsung (≡)', en: 'Samsung menu (≡)', fr: 'Menu Samsung (≡)', es: 'Menú de Samsung (≡)' },
    methodAddressBar: { ht: 'Ikon nan ba adrès la', en: 'Address-bar icon', fr: 'Icône de la barre d’adresse', es: 'Icono de la barra de direcciones' },
    methodAppsMenu: { ht: 'Meni Apps (⋯)', en: 'Apps menu (⋯)', fr: 'Menu Applications (⋯)', es: 'Menú de aplicaciones (⋯)' },
    methodShareDock: { ht: 'Share → Add to Dock', en: 'Share → Add to Dock', fr: 'Partager → Ajouter au Dock', es: 'Compartir → Agregar al Dock' },
    unsupportedTitle: { ht: 'Enstalasyon pa disponib sou browser sa a', en: 'Installation not available on this browser', fr: 'Installation non disponible sur ce navigateur', es: 'Instalación no disponible en este navegador' },
    unsupportedBody: { ht: 'Browser sa a pa ofri enstalasyon PWA pou kounye a. Men Atelnyo rete aksesib nan browser la — oswa enstale l ak Chrome, Edge, oswa Safari pou jwenn opsyon an.', en: 'This browser does not offer PWA installs right now. Atelnyo still works fine here — or install it with Chrome, Edge, or Safari to get the option.', fr: 'Ce navigateur ne propose pas l’installation PWA pour l’instant. Atelnyo reste accessible ici — ou installez-la avec Chrome, Edge ou Safari pour obtenir l’option.', es: 'Este navegador no ofrece instalaciones PWA por ahora. Atelnyo sigue funcionando aquí; o instálela con Chrome, Edge o Safari para obtener la opción.' },
    storeTitle: { ht: 'Oswa telechaje nan magazen an', en: 'Or download from the store', fr: 'Ou téléchargez depuis le magasin', es: 'O descárguela desde la tienda' },
    playStore: { ht: 'Google Play', en: 'Google Play', fr: 'Google Play', es: 'Google Play' },
    appStore: { ht: 'App Store', en: 'App Store', fr: 'App Store', es: 'App Store' },
    statusInstalled: { ht: 'Enstale', en: 'Installed', fr: 'Installé', es: 'Instalado' },
    statusAvailable: { ht: 'Disponib', en: 'Available', fr: 'Disponible', es: 'Disponible' },
    factInstallable: { ht: 'PWA enstalab?', en: 'PWA installable?', fr: 'PWA installable ?', es: '¿PWA instalable?' },
    factPrompt: { ht: 'Prompt enstalasyon?', en: 'Install prompt?', fr: 'Invite d\'installation ?', es: '¿Solicitud de instalación?' },
    factStandalone: { ht: 'Standalone?', en: 'Standalone?', fr: 'Standalone ?', es: '¿Standalone?' },
    yesWord: { ht: 'WI', en: 'YES', fr: 'OUI', es: 'SÍ' },
    noWord: { ht: 'NON', en: 'NO', fr: 'NON', es: 'NO' },
    unknownWord: { ht: 'ENKÒN', en: 'UNKNOWN', fr: 'INCONNU', es: 'DESCONOCIDO' },
    capsTitle: { ht: 'Kapasite enstalasyon', en: 'Install capabilities', fr: 'Capacités d\'installation', es: 'Capacidades de instalación' },
    capInstallability: { ht: 'Enstalab', en: 'Installable', fr: 'Installable', es: 'Instalable' },
    capPrompt: { ht: 'Prompt dispo', en: 'Prompt ready', fr: 'Invite prête', es: 'Solicitud lista' },
  };
  return T[key]?.[lang] || T[key]?.en || '';
}

export default function InstallAppPanel({ lang = 'ht' }) {
  const [snap, setSnap] = useState(() => installationManager.getState());
  const [busy, setBusy] = useState(false);

  useEffect(() => installationManager.subscribe(setSnap), []);

  const { state, stores } = snap;

  const handleInstall = async () => {
    setBusy(true);
    try {
      await installationManager.install();
    } finally {
      setBusy(false);
    }
  };

  // ─── Installed (C) ────────────────────────────────────────────────
  // Two sub-cases, shown distinctly:
  //   • standalone        → running AS an installed app right now.
  //   • device_installed  → on the device, but this session is a tab.
  if (state === INSTALL_STATES.INSTALLED) {
    const isStandaloneSession = snap.standalone === true;
    return (
      <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="installed">
        <div className="inst-app-status inst-app-status--ok" data-testid="install-state-badge">
          <i className="fas fa-check-circle" aria-hidden="true" />
          {copy(lang, 'statusInstalled')}
        </div>
        <InstallFacts snap={snap} lang={lang} />
        <div className="inst-app-title">{copy(lang, 'installedTitle')}</div>
        <p className="inst-app-body">
          {isStandaloneSession ? copy(lang, 'installedStandalone') : copy(lang, 'installedBody')}
        </p>
      </div>
    );
  }

  // ─── Native prompt ready → primary install button ────────────────
  if (state === INSTALL_STATES.PROMPT_AVAILABLE) {
    return (
      <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="prompt_available">
        <div className="inst-app-status inst-app-status--ready" data-testid="install-state-badge">
          <i className="fas fa-download" aria-hidden="true" />
          {copy(lang, 'statusAvailable')}
        </div>
        <InstallFacts snap={snap} lang={lang} />
        <div className="inst-app-title">{copy(lang, 'installTitle')}</div>
        <p className="inst-app-body">{copy(lang, 'installBody')}</p>
        <button
          type="button"
          className="inst-app-btn"
          onClick={handleInstall}
          disabled={busy}
          data-testid="install-app-cta"
        >
          <i className="fas fa-download" aria-hidden="true" />
          {copy(lang, 'installBtn')}
        </button>
        {stores.googlePlay || stores.appleAppStore ? (
          <div className="inst-app-store">
            <span className="inst-app-store-label">{copy(lang, 'storeTitle')}</span>
            <div className="inst-app-store-buttons">
              {stores.googlePlay && (
                <a className="inst-app-store-btn" href={stores.googlePlay} target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-google-play" aria-hidden="true" /> {copy(lang, 'playStore')}
                </a>
              )}
              {stores.appleAppStore && (
                <a className="inst-app-store-btn" href={stores.appleAppStore} target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-apple" aria-hidden="true" /> {copy(lang, 'appStore')}
                </a>
              )}
            </div>
          </div>
        ) : null}
        <ResetDetect lang={lang} />
      </div>
    );
  }

  // ─── Native dialog open / event not fired yet ─────────────────────
  if (state === INSTALL_STATES.REQUESTED) {
    return (
      <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="requested">
        <div className="inst-app-status inst-app-status--ready" data-testid="install-state-badge">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          {copy(lang, 'installBtn')}
        </div>
        <InstallFacts snap={snap} lang={lang} />
        <div className="inst-app-title">{copy(lang, 'requestedBody')}</div>
      </div>
    );
  }

  // ─── User accepted the native dialog (UX outcome, NOT proof) ─────
  // 'accepted' is a UX state: even after the browser's appinstalled
  // event (installConfirmed), installed = true is ONLY set when
  // Atelnyo later DETECTS itself running as an app (standalone).
  // The panel shows an honest "finalizing" surface before the event
  // and a "completed — will confirm on relaunch" surface after it.
  if (state === INSTALL_STATES.ACCEPTED) {
    const confirmed = snap.installConfirmed === true;
    return (
      <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="accepted">
        <div className="inst-app-status inst-app-status--ready" data-testid="install-state-badge">
          <i className={`fas ${confirmed ? 'fa-check-circle' : 'fa-spinner fa-spin'}`} aria-hidden="true" />
          {copy(lang, confirmed ? 'acceptedConfirmedStatus' : 'acceptedStatus')}
        </div>
        <InstallFacts snap={snap} lang={lang} />
        <div className="inst-app-title">{copy(lang, confirmed ? 'acceptedConfirmedTitle' : 'acceptedTitle')}</div>
        <p className="inst-app-body">{copy(lang, confirmed ? 'acceptedConfirmedBody' : 'acceptedBody')}</p>
        <ResetDetect lang={lang} />
      </div>
    );
  }

  if (state === INSTALL_STATES.INSTALLABLE) {
    return (
      <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="installable">
        <div className="inst-app-status inst-app-status--ready" data-testid="install-state-badge">
          <i className="fas fa-hourglass-half" aria-hidden="true" />
          {copy(lang, 'statusAvailable')}
        </div>
        <InstallFacts snap={snap} lang={lang} />
        <div className="inst-app-title">{copy(lang, 'waitingTitle')}</div>
        <p className="inst-app-body">{copy(lang, 'waitingBody')}</p>
        <button
          type="button"
          className="inst-app-link"
          onClick={() => installationManager.routeToInstructions()}
          data-testid="install-manual-link"
        >
          <i className="fas fa-list-ol" aria-hidden="true" />
          {copy(lang, 'manualBtn')}
        </button>
        <ResetDetect lang={lang} />
      </div>
    );
  }

  // ─── Browser fallback: step-by-step manual install ────────────────
  // "No programmatic prompt" is NOT "cannot be installed": this browser
  // has its OWN install mechanism in its native UI. The manager exposes
  // the exact mechanism per browser+platform (getInstallationInstructions
  // → { platform, browser, method, steps }) — different browsers get
  // different wording AND different paths, never one hard-coded message.
  // null only for genuinely pathless browsers (Firefox desktop stable)
  // — handled by the UNSUPPORTED branch below.
  if (state === INSTALL_STATES.INSTRUCTIONS) {
    // _recomputeState()/routeToInstructions() guarantee this state is
    // only reached when a real fallback path exists, so non-null here.
    const inst = snap.installation || installationManager.getInstallationInstructions()
      || { method: null, instructions: [] };
    const steps = inst.instructions.map((s) => copy(lang, s.label));
    return (
      <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="instructions">
        <div className="inst-app-status inst-app-status--ready" data-testid="install-state-badge">
          <i className="fas fa-circle-info" aria-hidden="true" />
          {copy(lang, 'statusAvailable')}
        </div>
        <InstallFacts snap={snap} lang={lang} />
        <div className="inst-app-title">{copy(lang, 'instructionsTitle')}</div>
        <p className="inst-app-body">{copy(lang, 'instructionsBody')}</p>
        {inst.method ? (
          <div className="inst-app-method" data-testid="install-method">
            <i className="fas fa-route" aria-hidden="true" />
            <span className="inst-app-method-label">{copy(lang, inst.method)}</span>
          </div>
        ) : null}
        <ol className="inst-app-steps">
          {steps.map((step, i) => (
            <li key={i} className="inst-app-step">
              <span className="inst-app-step-num">{i + 1}</span>
              <span className="inst-app-step-text">{step}</span>
            </li>
          ))}
        </ol>
        {stores.googlePlay || stores.appleAppStore ? (
          <div className="inst-app-store">
            <span className="inst-app-store-label">{copy(lang, 'storeTitle')}</span>
            <div className="inst-app-store-buttons">
              {stores.googlePlay && (
                <a className="inst-app-store-btn" href={stores.googlePlay} target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-google-play" aria-hidden="true" /> {copy(lang, 'playStore')}
                </a>
              )}
              {stores.appleAppStore && (
                <a className="inst-app-store-btn" href={stores.appleAppStore} target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-apple" aria-hidden="true" /> {copy(lang, 'appStore')}
                </a>
              )}
            </div>
          </div>
        ) : null}
        <ResetDetect lang={lang} />
      </div>
    );
  }

  // ─── Unsupported ──────────────────────────────────────────────────
  return (
    <div className="inst-app-panel" data-testid="install-app-panel" data-install-state="unsupported">
      <div className="inst-app-status inst-app-status--neutral" data-testid="install-state-badge">
        <i className="fas fa-ban" aria-hidden="true" />
        {copy(lang, 'unsupportedTitle')}
      </div>
      <InstallFacts snap={snap} lang={lang} />
      <div className="inst-app-title">{copy(lang, 'unsupportedTitle')}</div>
      <p className="inst-app-body">{copy(lang, 'unsupportedBody')}</p>
      <ResetDetect lang={lang} />
    </div>
  );
}

// ─── Three-fact diagnostic strip (A/B/C never conflated). Renders the
//      exact three questions from the spec with a YES / NO / UNKNOWN
//      verdict each (UNKNOWN is a real answer — the prompt event may
//      still fire). ──
const VERDICT_UI = {
  yes: { cls: 'inst-app-fact--yes', icon: 'fa-circle-check', word: 'yesWord' },
  no: { cls: 'inst-app-fact--no', icon: 'fa-circle-xmark', word: 'noWord' },
  unknown: { cls: 'inst-app-fact--unknown', icon: 'fa-circle-question', word: 'unknownWord' },
};

// Human-readable browser names for the detection meta line.
const BROWSER_LABELS = {
  chrome: 'Chrome',
  edge: 'Microsoft Edge',
  firefox: 'Firefox',
  safari: 'Safari',
  opera: 'Opera',
  samsung: 'Samsung Internet',
  other: 'Browser',
  unknown: 'Browser',
};

function InstallFacts({ snap, lang }) {
  const facts = [
    { label: copy(lang, 'factInstallable'), verdict: snap.facts?.installable },
    { label: copy(lang, 'factPrompt'), verdict: snap.facts?.prompt },
    { label: copy(lang, 'factStandalone'), verdict: snap.facts?.standalone },
  ];
  return (
    <>
      <div className="inst-app-facts" data-testid="install-facts">
        {facts.map((f) => {
          const ui = VERDICT_UI[f.verdict] || VERDICT_UI.unknown;
          return (
            <span
              key={f.label}
              className={`inst-app-fact ${ui.cls}`}
              data-verdict={f.verdict || 'unknown'}
            >
              <i className={`fas ${ui.icon}`} aria-hidden="true" />
              <span className="inst-app-fact-label">{f.label}</span>
              <strong>{copy(lang, ui.word)}</strong>
            </span>
          );
        })}
      </div>
      {/* Installation Detection output — browser + active display-mode. */}
      <div className="inst-app-meta" data-testid="install-detect-meta">
        <i className="fas fa-window-restore" aria-hidden="true" />
        {BROWSER_LABELS[snap.browser] || BROWSER_LABELS.other}
        <span className="inst-app-meta-sep">·</span>
        <code>display-mode: {snap.displayMode}</code>
      </div>
      {/* ── The two SEPARATE capabilities — installability is NOT the
             same as prompt availability (Chrome pre-event: installable
             YES, prompt NO, still installable via browser UI). ── */}
      <div className="inst-app-caps" data-testid="install-capabilities">
        <span className="inst-app-caps-title">{copy(lang, 'capsTitle')}</span>
        {[
          { label: copy(lang, 'capInstallability'), verdict: snap.capabilities?.installability },
          { label: copy(lang, 'capPrompt'), verdict: snap.capabilities?.promptAvailability },
        ].map((c) => {
          const ui = VERDICT_UI[c.verdict] || VERDICT_UI.unknown;
          return (
            <span key={c.label} className={`inst-app-cap ${ui.cls}`} data-verdict={c.verdict || 'unknown'}>
              <i className={`fas ${ui.icon}`} aria-hidden="true" />
              <span className="inst-app-cap-label">{c.label}</span>
              <strong>{copy(lang, ui.word)}</strong>
            </span>
          );
        })}
      </div>
    </>
  );
}

// ─── Shared footer: a muted re-detect affordance (wires the manager's
//      public initialize() — re-runs the whole detection pipeline
//      without destroying any persisted facts, unlike reset()). ──
function ResetDetect({ lang }) {
  return (
    <button
      type="button"
      className="inst-app-reset"
      onClick={() => installationManager.initialize()}
      data-testid="install-reset-link"
    >
      <i className="fas fa-rotate-right" aria-hidden="true" />
      {copy(lang, 'resetDetect')}
    </button>
  );
}
