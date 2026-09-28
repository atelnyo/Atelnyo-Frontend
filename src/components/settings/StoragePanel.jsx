/**
 * src/components/settings/StoragePanel.jsx
 *
 * STORAGE MANAGER — Settings surface (FAZ C — User Storage UI).
 *
 * Renders the FULL storage picture for the current device, driven
 * reactively by ``storageManager.getState()`` (the same contract as
 * InstallAppPanel ← installationManager), and acts through the
 * sanctioned ``storageManager`` methods — components never touch a
 * FileSystemDirectoryHandle.
 *
 *   • PRIVATE APP STORAGE  — the browser sandbox (IndexedDB / OPFS):
 *     automatic, NO permission, invisible in the phone's files.
 *     Shows backend · file backend · usage/quota · space level ·
 *     persistence.
 *   • USER STORAGE         — the user-chosen root folder (File System
 *     Access): the ONLY thing that asks permission. Driven by the
 *     9-state machine (userStorage.status):
 *       not-connected       → "Connect a folder" (chooseRootFolder
 *                             READWRITE — a FRESH user folder has no
 *                             Atelnyo/ layout; read-only connect would
 *                             make every operation fail with
 *                             'missing-folder' (the browser denied
 *                             creating the anchor). The picker IS the
 *                             informed consent for the anchor to be
 *                             created. Per-operation minimum access is
 *                             still enforced by the adapter gate.)
 *       permission-required → "Re-apwouve"       (reapproveRootFolder)
 *       read-only           → badge + "grant write" (requestRootWriteAccess
 *                             — legacy/restored read-only roots)
 *       read-write          → badge "Read + write"
 *       revoked/error       → reconnect / choose another folder
 *       disconnected        → reconnect (folder never deleted)
 *   • ACTIONS               — Connect · Change root · Re-apwouve ·
 *     Bay aksè ekri · Disconnect vs Revoke (two-tap confirm that
 *     explains the DIFFERENCE) · Re-valide.
 *   • ERRORS                — canonical STORAGE_ERRORS via
 *     storageManager.errorCategory(result) → localized copy. Never a
 *     raw DOMException name.
 *
 * Loading: `ready` / `userStorage.ready` distinguish "still
 * initializing" from "ready" — health/usage are placeholders before
 * the first async pass settles.
 */
import React, { useEffect, useRef, useState } from 'react';
import storageManager from '../../pwa/storage/StorageManager';
import { ACCESS_MODES, STORAGE_ERRORS, EXPORT_TYPES } from '../../pwa/storage/storageTypes';
// The sanctioned façades for the data a local backup packages (WHICH
// data is backupable is the product's explicit decision — these are
// the app-state / settings / consent / drafts domains).
import { restoreAppState } from '../../services/appStateStore';
import { getOfflineSettings } from '../../services/offlineSettings';
import consentEngine from '../../services/consentEngine';

/* ── Localized copy (ht / en / fr / es) ─────────────────────────── */
function _t(map, lang) {
  return map[lang] || map.en;
}

const T = {
  loading: { ht: 'Ap chaje…', en: 'Loading…', fr: 'Chargement…', es: 'Cargando…' },
  privateTitle: {
    ht: 'Depo prive app la',
    en: 'Private app storage',
    fr: 'Stockage privé de l’application',
    es: 'Almacenamiento privado de la app',
  },
  privateBody: {
    ht: 'Andedan sandbox browser la (IndexedDB / OPFS) — otomatik, san pèmisyon, invisib nan fichye telefòn ou.',
    en: 'Inside the browser sandbox (IndexedDB / OPFS) — automatic, no permission, invisible in your phone’s files.',
    fr: 'Dans le bac à sable du navigateur (IndexedDB / OPFS) — automatique, sans permission, invisible dans vos fichiers.',
    es: 'Dentro del sandbox del navegador (IndexedDB / OPFS): automático, sin permiso, invisible en sus archivos.',
  },
  userTitle: {
    ht: 'Folder ou',
    en: 'Your folder',
    fr: 'Votre dossier',
    es: 'Su carpeta',
  },
  userBody: {
    ht: 'Yon folder ou chwazi tèt ou. Se sèl bagay ki mande pèmisyon — ou kontwole tout.',
    en: 'A folder you choose. The only thing that asks permission — you control everything.',
    fr: 'Un dossier que vous choisissez. La seule chose qui demande une permission — vous contrôlez tout.',
    es: 'Una carpeta que usted elige. Lo único que pide permiso: usted controla todo.',
  },
  connectBtn: {
    ht: 'Konekte yon folder',
    en: 'Connect a folder',
    fr: 'Connecter un dossier',
    es: 'Conectar una carpeta',
  },
  changeBtn: {
    ht: 'Chanje folder',
    en: 'Change folder',
    fr: 'Changer de dossier',
    es: 'Cambiar de carpeta',
  },
  reapproveBtn: {
    ht: 'Re-apwouve',
    en: 'Re-approve',
    fr: 'Réapprouver',
    es: 'Reaprobar',
  },
  writeBtn: {
    ht: 'Bay aksè ekri',
    en: 'Grant write access',
    fr: 'Autoriser l’écriture',
    es: 'Conceder escritura',
  },
  writeHint: {
    ht: 'Nesesè sèlman pou export / backup.',
    en: 'Only needed for export / backup.',
    fr: 'Nécessaire seulement pour export / sauvegarde.',
    es: 'Solo necesario para exportar / respaldar.',
  },
  revalidateBtn: {
    ht: 'Verifye koneksyon',
    en: 'Re-validate',
    fr: 'Revalider',
    es: 'Revalidar',
  },
  disconnectBtn: {
    ht: 'Dekonekte',
    en: 'Disconnect',
    fr: 'Déconnecter',
    es: 'Desconectar',
  },
  revokeBtn: {
    ht: 'Revoke aksè',
    en: 'Revoke access',
    fr: 'Révoquer l’accès',
    es: 'Revocar acceso',
  },
  confirm: { ht: 'Konfime', en: 'Confirm', fr: 'Confirmer', es: 'Confirmar' },
  cancel: { ht: 'Anile', en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  disconnectExplain: {
    ht: 'Atelnyo sispann sèvi ak folder la. FOLDER LA PA EFAse — ou ka rekonekte nenpòt lè.',
    en: 'Atelnyo stops using the folder. THE FOLDER IS NOT DELETED — you can reconnect anytime.',
    fr: 'Atelnyo cesse d’utiliser le dossier. LE DOSSIER N’EST PAS SUPPRIMÉ — vous pouvez vous reconnecter à tout moment.',
    es: 'Atelnyo deja de usar la carpeta. LA CARPETA NO SE ELIMINA: puede volver a conectarla cuando quiera.',
  },
  revokeExplain: {
    ht: 'Pi fò pase dekonekte: aksè pa fiable ankò. Folder la rete, men pou retire pèmisyon browser a nèt, netwaye permissions sit la nan paramèt browser ou.',
    en: 'Stronger than disconnect: access is no longer trusted. The folder stays, but to fully clear the browser grant, clear this site’s permissions in browser settings.',
    fr: 'Plus fort qu’une simple déconnexion : l’accès n’est plus fiable. Le dossier reste, mais pour révoquer entièrement l’autorisation du navigateur, effacez les permissions du site dans les paramètres.',
    es: 'Más fuerte que desconectar: el acceso ya no es de confianza. La carpeta permanece, pero para revocar totalmente el permiso del navegador, borre los permisos del sitio en la configuración.',
  },
  permissionLabel: { ht: 'Pèmisyon', en: 'Permission', fr: 'Permission', es: 'Permiso' },
  modeLabel: { ht: 'Mod aksè', en: 'Access mode', fr: 'Mode d’accès', es: 'Modo de acceso' },
  validatedLabel: {
    ht: 'Dènye validasyon',
    en: 'Last validated',
    fr: 'Dernière validation',
    es: 'Última validación',
  },
  backendLabel: { ht: 'Backend', en: 'Backend', fr: 'Backend', es: 'Backend' },
  fileBackendLabel: {
    ht: 'Backend fichye',
    en: 'File backend',
    fr: 'Backend fichiers',
    es: 'Backend de archivos',
  },
  usageLabel: { ht: 'Itilizasyon', en: 'Usage', fr: 'Utilisation', es: 'Uso' },
  quotaLabel: { ht: 'Kwota', en: 'Quota', fr: 'Quota', es: 'Cuota' },
  persistedBtn: {
    ht: 'Fè depo pèsistan',
    en: 'Make storage persistent',
    fr: 'Rendre le stockage persistant',
    es: 'Hacer el almacenamiento persistente',
  },
  persistedNote: {
    ht: 'Pwoteje done Atelnyo yo kont efasman otomatik (eviction) lè espas ba.',
    en: 'Protects Atelnyo data from automatic eviction under storage pressure.',
    fr: 'Protège les données d’Atelnyo contre l’éviction automatique en cas de pression de stockage.',
    es: 'Protege los datos de Atelnyo contra la expulsión automática bajo presión de almacenamiento.',
  },
  persistedYes: { ht: 'Pèsistan ✓', en: 'Persistent ✓', fr: 'Persistant ✓', es: 'Persistente ✓' },
  lowSpace: {
    ht: 'Espas ap fini — libère espas oswa estoke pi piti.',
    en: 'Running low on space — free some space or store smaller.',
    fr: 'Espace presque plein — libérez de l’espace ou stockez plus petit.',
    es: 'Espacio casi lleno: libere espacio o guarde archivos más pequeños.',
  },
  lowSpaceCritical: {
    ht: 'Depo a prèske plen — gwo ekriti yo bloke. Libère espas.',
    en: 'Storage is almost full — large writes are discouraged. Free space.',
    fr: 'Stockage presque plein — grandes écritures déconseillées. Libérez de l’espace.',
    es: 'Almacenamiento casi lleno: se desaconsejan escrituras grandes. Libere espacio.',
  },
  notConnectedHint: {
    ht: 'Konekte yon folder pou Atelnyo ka ekri fichye (Atelnyo/Media, Documents, Backups, Exports…) sou aparèy ou.',
    en: 'Connect a folder so Atelnyo can write files (Atelnyo/Media, Documents, Backups, Exports…) on your device.',
    fr: 'Connectez un dossier pour qu’Atelnyo puisse écrire des fichiers (Atelnyo/Media, Documents, Backups, Exports…) sur votre appareil.',
    es: 'Conecte una carpeta para que Atelnyo pueda escribir archivos (Atelnyo/Media, Documents, Backups, Exports…) en su dispositivo.',
  },
  errorGoneHint: {
    ht: 'Folder la te deplase oswa efase. Chwazi yon lòt folder oswa verifye koneksyon an.',
    en: 'The folder was moved or deleted. Choose another folder or re-validate.',
    fr: 'Le dossier a été déplacé ou supprimé. Choisissez un autre dossier ou revalidez.',
    es: 'La carpeta se movió o se eliminó. Elija otra carpeta o revalide.',
  },
  unavailableHint: {
    ht: 'Browser sa a pa sipòte folder user (File System Access). Nwayo Atelnyo a kontinye mache — depo prive a disponib.',
    en: 'This browser does not support user folders (File System Access). Atelnyo’s core keeps working — private storage is available.',
    fr: 'Ce navigateur ne prend pas en charge les dossiers utilisateur (File System Access). Le cœur d’Atelnyo continue de fonctionner — le stockage privé est disponible.',
    es: 'Este navegador no admite carpetas de usuario (File System Access). El núcleo de Atelnyo sigue funcionando: el almacenamiento privado está disponible.',
  },
  browseTitle: {
    ht: 'Browse Atelnyo',
    en: 'Browse Atelnyo',
    fr: 'Parcourir Atelnyo',
    es: 'Explorar Atelnyo',
  },
  browseBody: {
    ht: 'Wè fichye ki nan folder ou a — Atelnyo/Media, Documents, Backups…',
    en: 'See the files in your folder — Atelnyo/Media, Documents, Backups…',
    fr: 'Voyez les fichiers de votre dossier — Atelnyo/Media, Documents, Backups…',
    es: 'Vea los archivos de su carpeta: Atelnyo/Media, Documents, Backups…',
  },
  browseLoad: { ht: 'Chaje fichye', en: 'Load files', fr: 'Charger les fichiers', es: 'Cargar archivos' },
  browseRefresh: { ht: 'Rafrechi', en: 'Refresh', fr: 'Rafraîchir', es: 'Actualizar' },
  browseWriteTest: {
    ht: 'Teste ekriti',
    en: 'Test write',
    fr: 'Tester l’écriture',
    es: 'Probar escritura',
  },
  browseWriteTestHint: {
    ht: 'Ekri yon fichye tès nan Atelnyo/Exports pou verifye tout chèn nan mache (adapter → browser API).',
    en: 'Write a test file to Atelnyo/Exports to prove the whole chain works (adapter → browser API).',
    fr: 'Écrivez un fichier de test dans Atelnyo/Exports pour prouver que toute la chaîne fonctionne (adapter → API navigateur).',
    es: 'Escriba un archivo de prueba en Atelnyo/Exports para comprobar que toda la cadena funciona (adapter → API del navegador).',
  },
  browseEmpty: {
    ht: 'Pa gen fichye pou kounye a — premye ekriti ap kreye Atelnyo/ ak layout la.',
    en: 'No files yet — the first write creates Atelnyo/ and its layout.',
    fr: 'Aucun fichier pour l’instant — la première écriture crée Atelnyo/ et sa structure.',
    es: 'Aún no hay archivos: la primera escritura crea Atelnyo/ y su estructura.',
  },
  browseWriteOk: {
    ht: '✓ Ekriti travay! Fichye tès la: {file}',
    en: '✓ Write works! Test file: {file}',
    fr: '✓ Écriture OK ! Fichier de test : {file}',
    es: '✓ ¡La escritura funciona! Archivo de prueba: {file}',
  },
  browseWritePerm: {
    ht: 'Ekriti mande pèmisyon — tape “Bay aksè ekri” epi eseye ankò.',
    en: 'Write needs permission — tap “Grant write access” and try again.',
    fr: 'L’écriture requiert une permission — appuyez sur « Autoriser l’écriture » puis réessayez.',
    es: 'La escritura requiere permiso: toque «Conceder escritura» e intente de nuevo.',
  },
  toolsTitle: { ht: 'Zouti', en: 'Tools', fr: 'Outils', es: 'Herramientas' },
  toolsBody: {
    ht: 'Backup, export ak download — Storage Manager a chwazi pi bon mekanis la (folder → picker → download browser).',
    en: 'Backup, export and download — the Storage Manager picks the best mechanism (folder → picker → browser download).',
    fr: 'Sauvegarde, export et téléchargement — le Storage Manager choisit le meilleur mécanisme (dossier → sélecteur → téléchargement).',
    es: 'Copia de seguridad, exportación y descarga: el Storage Manager elige el mejor mecanismo (carpeta → selector → descarga).',
  },
  backupBtn: { ht: 'Backup done', en: 'Backup data', fr: 'Sauvegarder', es: 'Respaldar datos' },
  exportBtn: { ht: 'Export done (JSON)', en: 'Export data (JSON)', fr: 'Exporter (JSON)', es: 'Exportar datos (JSON)' },
  downloadBtn: { ht: 'Download rapò', en: 'Download report', fr: 'Télécharger le rapport', es: 'Descargar informe' },
  toolHint: {
    ht: 'San folder konekte, done a desann via download browser a — toujou disponib.',
    en: 'Without a connected folder, files go through the browser download — always available.',
    fr: 'Sans dossier connecté, les fichiers passent par le téléchargement du navigateur — toujours disponible.',
    es: 'Sin carpeta conectada, los archivos se descargan con el navegador: siempre disponible.',
  },
  toolResult: {
    ht: '✓ Done: {file} → {method}',
    en: '✓ Done: {file} → {method}',
    fr: '✓ Terminé : {file} → {method}',
    es: '✓ Hecho: {file} → {method}',
  },
  toolVerified: { ht: 'verifye', en: 'verified', fr: 'vérifié', es: 'verificado' },
  writeBlocked: {
    ht: 'Depo prive a bloke/plen — libère espas anvan gwo ekriti.',
    en: 'Private storage is blocked/full — free space before large writes.',
    fr: 'Stockage privé bloqué/plein — libérez de l’espace avant les grandes écritures.',
    es: 'Almacenamiento privado bloqueado/lleno: libere espacio antes de escrituras grandes.',
  },
  writeQuota: {
    ht: 'Ekriti a rive sou quota a — eta depo a mete ajou.',
    en: 'The write hit the quota — storage state updated.',
    fr: 'L’écriture a atteint le quota — état du stockage mis à jour.',
    es: 'La escritura alcanzó la cuota: estado del almacenamiento actualizado.',
  },
  // ── File manager (open/preview · rename · delete) ───────────────
  fileOpenHint: {
    ht: 'Ouvri fichye a',
    en: 'Open the file',
    fr: 'Ouvrir le fichier',
    es: 'Abrir el archivo',
  },
  previewText: { ht: 'Tekst', en: 'Text', fr: 'Texte', es: 'Texto' },
  previewImage: { ht: 'Imaj', en: 'Image', fr: 'Image', es: 'Imagen' },
  previewMeta: { ht: 'Preview', en: 'Preview', fr: 'Aperçu', es: 'Vista previa' },
  previewTruncated: {
    ht: '… preview koupe (fichye a pi gwo)',
    en: '… preview truncated (the file is larger)',
    fr: '… aperçu tronqué (le fichier est plus volumineux)',
    es: '… vista previa truncada (el archivo es más grande)',
  },
  previewNoPreview: {
    ht: 'Preview pa disponib pou kalite fichye sa a — telechaje l.',
    en: 'No preview for this file type — download it instead.',
    fr: 'Pas d’aperçu pour ce type de fichier — téléchargez-le.',
    es: 'Sin vista previa para este tipo de archivo: descárguelo.',
  },
  previewDownload: {
    ht: 'Telechaje fichye a',
    en: 'Download the file',
    fr: 'Télécharger le fichier',
    es: 'Descargar el archivo',
  },
  renameHint: { ht: 'Chanje non', en: 'Rename', fr: 'Renommer', es: 'Renombrar' },
  deleteHint: { ht: 'Efase', en: 'Delete', fr: 'Supprimer', es: 'Eliminar' },
  fileRenamed: {
    ht: '✓ Non chanje: {name} → {newName}',
    en: '✓ Renamed: {name} → {newName}',
    fr: '✓ Renommé : {name} → {newName}',
    es: '✓ Renombrado: {name} → {newName}',
  },
  fileDeleted: {
    ht: '✓ Fichye efase: {name}',
    en: '✓ Deleted: {name}',
    fr: '✓ Supprimé : {name}',
    es: '✓ Eliminado: {name}',
  },
  fileDeleteExplain: {
    ht: 'Efase {name} definitivman nan folder la — aksyon sa a pa ka defèt.',
    en: 'Delete {name} permanently from the folder — this cannot be undone.',
    fr: 'Supprimer {name} définitivement du dossier — action irréversible.',
    es: 'Eliminar {name} permanentemente de la carpeta: no se puede deshacer.',
  },
  fileWritePerm: {
    ht: 'Aksyon sa a mande pèmisyon ekri — tape "Bay aksè ekri" epi eseye ankò.',
    en: 'This action needs write permission — tap "Grant write access" and try again.',
    fr: 'Cette action nécessite l’autorisation d’écriture — appuyez sur « Autoriser l’écriture » puis réessayez.',
    es: 'Esta acción requiere permiso de escritura: toque «Conceder escritura» e intente de nuevo.',
  },
  // ── File catalog (search · stars · persistent index) ───────────
  catTitle: {
    ht: 'Katalòg fichye',
    en: 'File catalog',
    fr: 'Catalogue de fichiers',
    es: 'Catálogo de archivos',
  },
  catBody: {
    ht: 'Endèks pèsistan nan folder ou a (Exports/atelnyo-catalog.json) — rechèch rapid ak etwal sou tout dosye yo.',
    en: 'Persistent index in your folder (Exports/atelnyo-catalog.json) — fast search and stars across all files.',
    fr: 'Index persistant dans votre dossier (Exports/atelnyo-catalog.json) — recherche rapide et favoris sur tous les fichiers.',
    es: 'Índice persistente en su carpeta (Exports/atelnyo-catalog.json): búsqueda rápida y favoritos en todos los archivos.',
  },
  catSearchPh: {
    ht: 'Chèche yon fichye…',
    en: 'Search a file…',
    fr: 'Rechercher un fichier…',
    es: 'Buscar un archivo…',
  },
  catStarred: { ht: 'Etwal', en: 'Starred', fr: 'Favoris', es: 'Favoritos' },
  catResync: {
    ht: 'Re-sync katalòg',
    en: 'Re-sync catalog',
    fr: 'Resynchroniser le catalogue',
    es: 'Resincronizar catálogo',
  },
  catStatus: {
    ht: '{files} fichye · {dirs} kat · {stars} etwal',
    en: '{files} files · {dirs} folders · {stars} stars',
    fr: '{files} fichiers · {dirs} dossiers · {stars} favoris',
    es: '{files} archivos · {dirs} carpetas · {stars} favoritos',
  },
  catPersisted: {
    ht: 'Endèks la pèsiste nan atelnyo-catalog.json',
    en: 'Index persisted in atelnyo-catalog.json',
    fr: 'Index persisté dans atelnyo-catalog.json',
    es: 'Índice persistido en atelnyo-catalog.json',
  },
  catMemoryOnly: {
    ht: 'Endèks nan memwa sèlman — pa gen pèmisyon ekri pou katalòg la.',
    en: 'In-memory index only — no write permission for the catalog file.',
    fr: 'Index en mémoire uniquement — pas de permission d’écriture pour le fichier catalogue.',
    es: 'Solo índice en memoria: no hay permiso de escritura para el archivo de catálogo.',
  },
  catNoResults: {
    ht: 'Pa gen rezilta — chanjman an ka bezwen yon re-sync.',
    en: 'No results — a re-sync may be needed after changes.',
    fr: 'Aucun résultat — une resynchronisation peut être nécessaire après des changements.',
    es: 'Sin resultados: puede ser necesaria una resincronización tras los cambios.',
  },
  catIndexing: {
    ht: 'Ap endèkse…',
    en: 'Indexing…',
    fr: 'Indexation…',
    es: 'Indexando…',
  },
  catErr: {
    ht: 'Katalòg la te rive sou yon pwoblèm: {err}',
    en: 'The catalog hit a problem: {err}',
    fr: 'Le catalogue a rencontré un problème : {err}',
    es: 'El catálogo encontró un problema: {err}',
  },
  starHint: { ht: 'Etwal fichye a', en: 'Star the file', fr: 'Mettre en favori', es: 'Marcar con estrella' },
  starOn: { ht: 'Retire etwal', en: 'Unstar', fr: 'Retirer le favori', es: 'Quitar estrella' },
};

// Where a Backup/Export/Download result went (method vocabulary).
const METHOD_COPY = {
  'user-folder': { ht: 'folder ou', en: 'your folder', fr: 'votre dossier', es: 'su carpeta' },
  picker: { ht: 'picker', en: 'picker', fr: 'sélecteur', es: 'selector' },
  browser: { ht: 'download browser', en: 'browser download', fr: 'téléchargement', es: 'descarga' },
};

const STATUS_COPY = {
  'not-connected': { icon: 'fa-folder-open', tone: 'neutral' },
  connected: { icon: 'fa-check-circle', tone: 'ok' },
  'permission-required': { icon: 'fa-hand-pointer', tone: 'warn' },
  'read-only': { icon: 'fa-eye', tone: 'ok' },
  'read-write': { icon: 'fa-pen-to-square', tone: 'ok' },
  revoked: { icon: 'fa-ban', tone: 'bad' },
  disconnected: { icon: 'fa-plug-circle-xmark', tone: 'neutral' },
  unavailable: { icon: 'fa-circle-xmark', tone: 'neutral' },
  error: { icon: 'fa-triangle-exclamation', tone: 'bad' },
};

const STATUS_LABEL = {
  'not-connected': { ht: 'Pa konekte', en: 'Not connected', fr: 'Non connecté', es: 'No conectado' },
  connected: { ht: 'Konekte', en: 'Connected', fr: 'Connecté', es: 'Conectado' },
  'permission-required': { ht: 'Pèmisyon nesesè', en: 'Permission required', fr: 'Permission requise', es: 'Permiso requerido' },
  'read-only': { ht: 'Li sèlman', en: 'Read only', fr: 'Lecture seule', es: 'Solo lectura' },
  'read-write': { ht: 'Li + Ekri', en: 'Read & write', fr: 'Lecture + écriture', es: 'Lectura y escritura' },
  revoked: { ht: 'Aksè revoke', en: 'Access revoked', fr: 'Accès révoqué', es: 'Acceso revocado' },
  disconnected: { ht: 'Dekonekte', en: 'Disconnected', fr: 'Déconnecté', es: 'Desconectado' },
  unavailable: { ht: 'Pa disponib isit', en: 'Unavailable here', fr: 'Indisponible ici', es: 'No disponible aquí' },
  error: { ht: 'Erè', en: 'Error', fr: 'Erreur', es: 'Error' },
};

// Fixed-layout folder icons for the Browse Atelnyo tree.
const FOLDER_ICONS = {
  Media: 'fa-photo-film',
  Documents: 'fa-file-lines',
  Downloads: 'fa-download',
  Backups: 'fa-database',
  Exports: 'fa-file-export',
};

const LEVEL_COPY = {
  ok: { ht: 'An sante', en: 'Healthy', fr: 'En bonne santé', es: 'Sano' },
  degraded: { ht: 'Degrade (folder kase)', en: 'Degraded (folder broken)', fr: 'Dégradé (dossier cassé)', es: 'Degradado (carpeta rota)' },
  warning: { ht: 'Avètisman', en: 'Warning', fr: 'Avertissement', es: 'Advertencia' },
  low: { ht: 'Espas ba', en: 'Low space', fr: 'Espace faible', es: 'Espacio bajo' },
  blocked: { ht: 'Depo bloke', en: 'Storage blocked', fr: 'Stockage bloqué', es: 'Almacenamiento bloqueado' },
  unknown: { ht: 'Enkoni', en: 'Unknown', fr: 'Inconnu', es: 'Desconocido' },
};

const ERROR_COPY = {
  [STORAGE_ERRORS.PERMISSION_DENIED]: {
    ht: 'Aksè pa otorize — eseye "Re-apwouve" oswa rekonekte.',
    en: 'Access not allowed — try “Re-approve” or reconnect.',
    fr: 'Accès non autorisé — essayez « Réapprouver » ou reconnectez-vous.',
    es: 'Acceso no permitido: intente «Reaprobar» o vuelva a conectar.',
  },
  [STORAGE_ERRORS.PERMISSION_REVOKED]: {
    ht: 'Aksè la te revoke. Rekonekte yon folder.',
    en: 'Access was revoked. Reconnect a folder.',
    fr: 'L’accès a été révoqué. Reconnectez un dossier.',
    es: 'Se revocó el acceso. Vuelva a conectar una carpeta.',
  },
  [STORAGE_ERRORS.NOT_CONNECTED]: {
    ht: 'Konekte yon folder anvan.',
    en: 'Connect a folder first.',
    fr: 'Connectez d’abord un dossier.',
    es: 'Conecte primero una carpeta.',
  },
  [STORAGE_ERRORS.FILE_NOT_FOUND]: {
    ht: 'Fichye/folder la pa la ankò — li te deplase oswa efase.',
    en: 'The file/folder is gone — it was moved or deleted.',
    fr: 'Le fichier/dossier n’existe plus — déplacé ou supprimé.',
    es: 'El archivo/carpeta ya no existe: se movió o eliminó.',
  },
  [STORAGE_ERRORS.QUOTA_EXCEEDED]: {
    ht: 'Depo a plen — libère espas.',
    en: 'Storage is full — free some space.',
    fr: 'Stockage plein — libérez de l’espace.',
    es: 'Almacenamiento lleno: libere espacio.',
  },
  [STORAGE_ERRORS.UNSUPPORTED]: {
    ht: 'Op sa pa disponib nan browser sa a.',
    en: 'This operation is not supported in this browser.',
    fr: 'Cette opération n’est pas prise en charge par ce navigateur.',
    es: 'Esta operación no es compatible con este navegador.',
  },
  [STORAGE_ERRORS.INVALID_OPERATION]: {
    ht: 'Yon erè nan demand la.',
    en: 'Something was invalid in the request.',
    fr: 'Une erreur dans la requête.',
    es: 'Algo no era válido en la solicitud.',
  },
  [STORAGE_ERRORS.CANCELLED]: {
    ht: 'Ou anile.',
    en: 'Cancelled.',
    fr: 'Annulé.',
    es: 'Cancelado.',
  },
  [STORAGE_ERRORS.NEEDS_APPROVAL]: {
    ht: 'Pèmisyon nesesè — tape "Re-apwouve".',
    en: 'Permission needed — tap “Re-approve”.',
    fr: 'Permission requise — appuyez sur « Réapprouver ».',
    es: 'Permiso necesario: toque «Reaprobar».',
  },
  unknown: {
    ht: 'Gen yon erè ki fèt. Eseye ankò.',
    en: 'Something went wrong. Try again.',
    fr: 'Une erreur est survenue. Réessayez.',
    es: 'Algo salió mal. Intente de nuevo.',
  },
};

function _copyError(lang, category) {
  const cat = category || STORAGE_ERRORS.UNKNOWN;
  return _t(ERROR_COPY[cat] || ERROR_COPY.unknown, lang);
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatWhen(ms) {
  if (!ms) {
    return null;
  }
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return null;
  }
}

const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  ico: 'image/x-icon',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', log: 'text/plain',
  json: 'application/json', xml: 'application/xml', html: 'text/html',
  css: 'text/css', js: 'text/javascript', srt: 'text/plain',
};

/** Rough content-type for a preview/download (plain ext map, never trusted). */
function mimeFor(name) {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

/**
 * One row of the Browse Atelnyo tree — a file (or directory) with
 * the real file-manager actions: open/preview · rename (root entries
 * only — the adapter's rename is folder-level; renaming a category
 * file would silently move it out of its category) · delete (two-tap
 * confirm). The action buttons enable/disable from the per-op
 * capability matrix (fs.capabilities) so an operation the browser
 * cannot perform is never offered.
 */
/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere; this is a props-only row */
function FileRow({
  entry,
  folder,
  category,
  lang,
  onOpen,
  onRenameStart,
  renaming,
  renameDraft,
  onRenameChange,
  onRenameKey,
  onRenameOk,
  onRenameCancel,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  onDoDelete,
  onToggleStar,
  starred,
  fileBusy,
  capRename,
  capDelete,
}) {
  const isFile = !entry.isDirectory;
  const cat = category || null;
  const renamingThis = renaming
    && renaming.folder === folder
    && (renaming.category || null) === cat
    && renaming.name === entry.name;
  const deletingThis = confirmDelete
    && confirmDelete.folder === folder
    && (confirmDelete.category || null) === cat
    && confirmDelete.name === entry.name;
  const canRename = isFile && cat === null && capRename !== 'unavailable';
  const canDelete = isFile && capDelete !== 'unavailable';
  return (
    <li className="stg-tree-file">
      <button
        type="button"
        className="stg-tree-file-open"
        title={isFile ? _t(T.fileOpenHint, lang) : undefined}
        disabled={!isFile || !!fileBusy}
        onClick={() => { if (isFile) { onOpen({ folder, category: cat, name: entry.name }); } }}
      >
        <i className={`fas ${entry.isDirectory ? 'fa-folder' : 'fa-file'}`} aria-hidden="true" />
        <span className="stg-mono">{entry.name}</span>
      </button>
      {isFile && onToggleStar && (
        <button
          type="button"
          className={`stg-file-btn stg-file-btn--star${starred ? ' is-starred' : ''}`}
          title={starred ? _t(T.starOn, lang) : _t(T.starHint, lang)}
          disabled={!!fileBusy}
          onClick={() => onToggleStar({ folder, category: cat, name: entry.name })}
        >
          <i className={`fas ${starred ? 'fa-star' : 'fa-star-regular'}`} aria-hidden="true" />
        </button>
      )}
      {canRename && (
        <button
          type="button"
          className="stg-file-btn"
          title={_t(T.renameHint, lang)}
          disabled={!!fileBusy || capRename !== 'available'}
          onClick={() => onRenameStart({ folder, category: cat, name: entry.name })}
        >
          <i className="fas fa-pen" aria-hidden="true" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="stg-file-btn stg-file-btn--danger"
          title={_t(T.deleteHint, lang)}
          disabled={!!fileBusy || capDelete !== 'available'}
          onClick={() => onConfirmDelete({ folder, category: cat, name: entry.name })}
        >
          <i className="fas fa-trash-can" aria-hidden="true" />
        </button>
      )}
      {renamingThis && (
        <div className="stg-rename-row">
          <input
            className="stg-rename-input"
            value={renameDraft}
            onChange={onRenameChange}
            onKeyDown={onRenameKey}
            autoFocus
            aria-label={_t(T.renameHint, lang)}
          />
          <button type="button" className="stg-btn stg-btn--primary" title={_t(T.renameHint, lang)} disabled={!!fileBusy} onClick={onRenameOk}>
            <i className="fas fa-check" aria-hidden="true" />
          </button>
          <button type="button" className="stg-btn stg-btn--ghost" disabled={!!fileBusy} onClick={onRenameCancel}>
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
      )}
      {deletingThis && (
        <div className="stg-confirm">
          <p className="stg-confirm-text"><i className="fas fa-circle-info" aria-hidden="true" /> {_t(T.fileDeleteExplain, lang).replace('{name}', entry.name)}</p>
          <div className="stg-confirm-actions">
            <button type="button" className="stg-btn stg-btn--danger" disabled={!!fileBusy} onClick={onDoDelete}>
              {fileBusy === 'delete' && <i className="fas fa-spinner fa-spin" />} {_t(T.confirm, lang)}
            </button>
            <button type="button" className="stg-btn stg-btn--ghost" disabled={!!fileBusy} onClick={onCancelDelete}>{_t(T.cancel, lang)}</button>
          </div>
        </div>
      )}
    </li>
  );
}
/* eslint-enable react/prop-types */

/**
 * Faz C — the Settings surface for the Storage subsystem. Subscribes
 * DIRECTLY to the manager (the InstallAppPanel contract), so every
 * storage change (quota refresh, root-folder connect/disconnect,
 * revalidation) re-renders the panel with the honest facts.
 */
const StoragePanel = ({ lang }) => {
  const [snap, setSnap] = useState(() => storageManager.getState());
  // Which action is running (disables its button + shows a spinner).
  const [busy, setBusy] = useState(null);
  // Inline notice (localized outcome / error message).
  const [notice, setNotice] = useState('');
  // Two-tap confirm state: null | 'disconnect' | 'revoke'.
  const [confirming, setConfirming] = useState(null);
  // Browse Atelnyo tree (storageManager.fs.browse) + write test.
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeBusy, setTreeBusy] = useState(null);
  // Expanded category keys, e.g. 'Media/Images'.
  const [expanded, setExpanded] = useState(() => new Set());
  // Inline notice for the browse card: null | { tone, text }.
  const [treeNotice, setTreeNotice] = useState(null);
  // ── File-manager state (open/preview · rename · delete) ────────
  // Per-op capability matrix (fs.capabilities) — the file-action
  // buttons enable/disable from it ('available' | 'permission-required'
  // | 'unavailable'), so an operation this browser cannot perform is
  // never offered.
  const [capMatrix, setCapMatrix] = useState(null);
  // Open preview: { folder, category, name, kind, url?, text?, blob?, mime? } | null.
  const [preview, setPreview] = useState(null);
  // Two-tap delete confirm: a FileRef or null.
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Inline rename row: { folder, category, name } | null + the draft.
  const [renaming, setRenaming] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  // Which file action is running ('delete' | 'rename' | 'download' | 'preview').
  const [fileBusy, setFileBusy] = useState(null);
  // ── File catalog (search · stars · persistent index) ───────────
  // The catalog snapshot (storageManager.catalog = fileCatalog) — the
  // persistent index that lives AS A FILE in the user's folder
  // (Exports/atelnyo-catalog.json): search across all files + stars
  // (the one thing the filesystem cannot store). Subscribed the same
  // reactive way as the storage manager itself.
  const [catSnap, setCatSnap] = useState(() => storageManager.catalog.getState());
  // Live search query (empty = browse the whole index).
  const [catQuery, setCatQuery] = useState('');
  // Star-only filter (☆ button) — "show the files I starred".
  const [starredOnly, setStarredOnly] = useState(false);

  useEffect(() => storageManager.subscribe(setSnap), []);
  useEffect(() => storageManager.catalog.subscribe(setCatSnap), []);

  const userStorage = snap.userStorage || {};
  const privateStorage = snap.privateStorage || {};
  const aggregate = snap.storageHealth || {};

  const status = userStorage.status || 'not-connected';
  const statusInfo = STATUS_COPY[status] || STATUS_COPY['not-connected'];
  const statusLabel = _t(STATUS_LABEL[status] || STATUS_LABEL['not-connected'], lang);

  // ── Aggregate + private storage facts ───────────────────────────
  const aggregateLevel = aggregate.level || snap.health || 'unknown';
  const spaceLevel = aggregate.quota?.spaceLevel || privateStorage.spaceLevel || null;
  const lastError = aggregate.lastError || null;
  // The user-side error (e.g. 'permission-revoked', 'restore failed') —
  // separate from the private-core lastError; both surfaced, never mixed.
  const userError = aggregate.userStorage?.error || null;
  const lowSpace = spaceLevel === 'warning' || spaceLevel === 'critical';
  const criticalSpace = spaceLevel === 'critical';

  // ── Actions ─────────────────────────────────────────────────────
  const run = async (action, fn) => {
    if (busy) {
      return;
    }
    setBusy(action);
    setNotice('');
    try {
      const res = await fn();
      // Tagged results: cancelled is an OUTCOME (no error message);
      // ok:false → canonical category → localized copy.
      if (res && res.cancelled === true) {
        setNotice(_copyError(lang, STORAGE_ERRORS.CANCELLED));
      } else if (res && res.ok === false) {
        setNotice(_copyError(lang, storageManager.errorCategory(res)));
      }
    } catch (err) {
      setNotice(_copyError(lang, storageManager.errorCategory(err)));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  // FIRST CONNECT is READWRITE: a fresh user folder has NO Atelnyo/
  // layout, and a read-only connect cannot create it (resolveUserSubfolder
  // is read-first-then-create — creation is denied under READ, so every
  // fixed-layout operation returns 'missing-folder' and the user sees
  // "permission granted but nothing works"). The picker gesture IS the
  // informed consent for the readwrite grant (Chrome's own dialog shows
  // the scope); the adapter still gates every operation on the CURRENT
  // grant, and legacy READ-only roots (connected before this change,
  // mode persisted as read) recover via the "Bay aksè ekri" button.
  const connect = () => run('connect', () => storageManager.chooseRootFolder(ACCESS_MODES.READWRITE));
  const changeRoot = () => run('change', () => storageManager.changeRootFolder());
  const reapprove = () => run('reapprove', () => storageManager.reapproveRootFolder());
  const grantWrite = () => run('write', () => storageManager.requestRootWriteAccess());
  const revalidate = () => run('revalidate', () => storageManager.revalidateRootFolder());
  const makePersistent = () => run('persist', () => storageManager.requestPersistence());
  const doDisconnect = () => run('disconnect', () => storageManager.disconnectRootFolder());
  const doRevoke = () => run('revoke', () => storageManager.revokeRootFolderAccess());

  // ── Browse Atelnyo (file manager surface) ──────────────────────
  const rootConnected = !!userStorage.rootFolderConnected;

  const countEntries = (node) => node.entries.length
    + Object.values(node.categoryEntries || {}).reduce((sum, arr) => sum + arr.length, 0);

  // Load the whole fixed layout via the sanctioned public module
  // (storageManager.fs.browse → adapter → browser API). `silent` keeps
  // the current tree on screen while refreshing after a write.
  const loadTree = async (silent) => {
    if (!silent) {
      setTreeLoading(true);
    }
    // Never wipe a notice on a SILENT refresh (post-write refresh keeps
    // the success message visible). Explicit refreshes start clean.
    if (!silent) {
      setTreeNotice(null);
    }
    try {
      const res = await storageManager.fs.browse();
      setTree(res);
      if (res && res.ok === false) {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(res)) });
      }
    } catch (err) {
      setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(err)) });
    } finally {
      setTreeLoading(false);
    }
    // Refresh the per-op capability matrix alongside the tree — the
    // file actions (open/rename/delete) enable/disable from it. Kept
    // OFF the browse path (separate promise) so a matrix failure can
    // never paint a successful browse as an error.
    storageManager.fs.capabilities().then(setCapMatrix).catch(() => { /* non-fatal */ });
    // Keep the CATALOG in step with the tree: every browse re-syncs
    // the index (walk the truth → prune vanished entries → keep
    // surviving stars → persist). Covers write-test / rename / delete
    // refreshes too — the catalog never lags behind the real folder.
    // The browse result is PASSED IN (existingWalk) so sync() never
    // re-walks the layout it just got — no double browse.
    storageManager.catalog.sync(res && res.ok === true ? res : undefined)
      .catch(() => { /* handled inside */ });
  };

  // Auto-load the tree as soon as a root folder is connected (and on
  // mount when one is already restored). Never prompts — browse is
  // query/read-only. Deferred via a macrotask so the effect itself
  // never calls setState synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (rootConnected) {
      const id = setTimeout(() => loadTree(), 0);
      return () => clearTimeout(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootConnected]);

  // NOTE: must stay a wrapper — `onClick={loadTree}` would pass the
  // click event as the `silent` param (truthy → silently skips the
  // spinner and the notice clear).
  const refreshTree = () => loadTree();

  // Proves the FULL write chain (UI → fs.write → adapter → browser)
  // by writing a tiny marker into Atelnyo/Exports, then refreshes the
  // tree so the new file is visible.
  const testWrite = async () => {
    if (treeBusy) {
      return;
    }
    setTreeBusy('write');
    setTreeNotice(null);
    // QUOTA GATE pre-check (getWriteStatus) — storage must warn
    // BEFORE a write, never fail silently. ok:false = blocked/low:
    // surface the warning instead of attempting a doomed write.
    const gate = storageManager.getWriteStatus();
    if (gate && gate.ok === false) {
      setTreeBusy(null);
      setTreeNotice({ tone: 'warn', scope: 'browse', text: _t(T.writeBlocked, lang) });
      return;
    }
    try {
      const name = `atelnyo-connect-test-${Date.now()}.txt`;
      const res = await storageManager.fs.write(
        { folder: storageManager.fs.FOLDERS.EXPORTS, name },
        `Atelnyo storage test — ${new Date().toISOString()}\n`,
      );
      if (res && res.ok) {
        setTreeNotice({ tone: 'ok', scope: 'browse', text: _t(T.browseWriteOk, lang).replace('{file}', name) });
        await loadTree(true);
      } else if (res && (res.error === 'permission-prompt'
        || storageManager.errorCategory(res) === STORAGE_ERRORS.NEEDS_APPROVAL)) {
        setTreeNotice({ tone: 'warn', scope: 'browse', text: _t(T.browseWritePerm, lang) });
      } else {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(res)) });
      }
    } catch (err) {
      if (storageManager.normalizeError(err) === STORAGE_ERRORS.QUOTA_EXCEEDED) {
        // A real quota failure is a STATE change, never silent —
        // record + degrade + refresh via the manager.
        await storageManager.handleQuotaFailure(err);
        setTreeNotice({ tone: 'warn', scope: 'browse', text: _t(T.writeQuota, lang) });
      } else {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(err)) });
      }
    } finally {
      setTreeBusy(null);
    }
  };

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── File-manager actions (open / rename / delete) ──────────────
  const capOf = (op) => (capMatrix && capMatrix[op]) || 'unavailable';
  // Supersession token for in-flight opens: a close (or a second open)
  // bumps it so a stale fs.read that resolves late can never re-open a
  // preview the user already dismissed.
  const openTokenRef = useRef(0);

  // Open a file: read it through the sanctioned fs layer (category-
  // aware), then render an inline preview — image → object-URL img,
  // text-like → capped <pre>, anything else → "download it" note.
  const openFile = async (ref) => {
    if (fileBusy) { return; }
    const token = openTokenRef.current + 1;
    openTokenRef.current = token;
    if (preview && preview.url) { try { URL.revokeObjectURL(preview.url); } catch { /* ignore */ } }
    setFileBusy('preview');
    setPreview(null);
    try {
      const res = await storageManager.fs.read(ref, { as: 'blob' });
      if (token !== openTokenRef.current) { return; } // superseded (closed / another open)
      if (!res || res.ok !== true) {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(res)) });
        return;
      }
      const mime = mimeFor(ref.name);
      const ext = (String(ref.name).split('.').pop() || '').toLowerCase();
      if (mime.startsWith('image/')) {
        setPreview({ ...ref, kind: 'image', url: URL.createObjectURL(res.blob), blob: res.blob, mime });
      } else if (mime.startsWith('text/') || ['txt', 'md', 'csv', 'log', 'json', 'xml', 'html', 'css', 'js', 'srt'].includes(ext)) {
        let text = '';
        try { text = await res.blob.text(); } catch { text = ''; }
        const truncated = text.length > 16000;
        setPreview({
          ...ref,
          kind: 'text',
          text: truncated ? `${text.slice(0, 16000)}\n${_t(T.previewTruncated, lang)}` : text,
          blob: res.blob,
          mime,
        });
      } else {
        setPreview({ ...ref, kind: 'none', blob: res.blob, mime });
      }
    } catch (err) {
      setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(err)) });
    } finally {
      setFileBusy(null);
    }
  };

  const closePreview = () => {
    openTokenRef.current += 1; // cancel any in-flight open
    if (preview && preview.url) { try { URL.revokeObjectURL(preview.url); } catch { /* ignore */ } }
    setPreview(null);
  };

  // Download the opened file — the Storage Manager picks the best
  // mechanism (user folder → picker → browser download), never the UI.
  const downloadPreview = async () => {
    if (!preview || fileBusy) { return; }
    setFileBusy('download');
    try {
      const res = await storageManager.saveDownload(preview.name, preview.blob, { mime: preview.mime || 'application/octet-stream' });
      if (res && res.ok) {
        setTreeNotice({ tone: 'ok', scope: 'browse', text: _t(T.toolResult, lang).replace('{file}', preview.name).replace('{method}', _t(METHOD_COPY[res.method] || METHOD_COPY.browser, lang)) });
      } else if (res && res.cancelled === true) {
        setTreeNotice({ tone: 'warn', scope: 'browse', text: _copyError(lang, STORAGE_ERRORS.CANCELLED) });
      } else {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(res)) });
      }
    } catch (err) {
      setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(err)) });
    } finally {
      setFileBusy(null);
    }
  };

  // ── Catalog actions (star · re-sync) ───────────────────────────
  // Star/unstar a file. USER METADATA — the filesystem has no xattr,
  // so this is exactly what the catalog file exists for (it travels
  // with the folder and survives browser data wipes).
  const toggleStar = (ref) => {
    const starred = storageManager.catalog.isStarred(ref);
    storageManager.catalog.setStar(ref, !starred);
  };

  // Explicit re-sync (the ↻ button): recover stars from the catalog
  // file + re-walk the folder (the truth) + persist. Fire-and-forget;
  // sync() reports failures through catSnap.lastError, never a throw.
  const resyncCatalog = () => storageManager.catalog.sync().catch(() => { /* handled inside */ });

  const startRename = (ref) => { setRenaming(ref); setRenameDraft(ref.name); };
  const cancelRename = () => setRenaming(null);
  const doRename = async () => {
    if (!renaming || fileBusy) { return; }
    const newName = renameDraft.trim();
    if (!newName || newName === renaming.name) { setRenaming(null); return; }
    setFileBusy('rename');
    try {
      const res = await storageManager.fs.rename(renaming.folder, renaming.name, newName);
      if (res && res.ok) {
        setRenaming(null);
        closePreview();
        setTreeNotice({ tone: 'ok', scope: 'browse', text: _t(T.fileRenamed, lang).replace('{name}', renaming.name).replace('{newName}', newName) });
        await loadTree(true);
      } else if (res && (res.error === 'permission-prompt' || storageManager.errorCategory(res) === STORAGE_ERRORS.NEEDS_APPROVAL)) {
        setTreeNotice({ tone: 'warn', scope: 'browse', text: _t(T.fileWritePerm, lang) });
      } else {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(res)) });
      }
    } catch (err) {
      setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(err)) });
    } finally {
      setFileBusy(null);
    }
  };

  const onRenameKey = (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); doRename(); }
    if (ev.key === 'Escape') { ev.preventDefault(); cancelRename(); }
  };

  const confirmDeleteFile = (ref) => setConfirmDelete(ref);
  const cancelDeleteFile = () => setConfirmDelete(null);
  const doDeleteFile = async () => {
    if (!confirmDelete || fileBusy) { return; }
    setFileBusy('delete');
    try {
      const res = await storageManager.fs.remove(confirmDelete);
      if (res && res.ok) {
        const deletedName = confirmDelete.name;
        setConfirmDelete(null);
        closePreview();
        setTreeNotice({ tone: 'ok', scope: 'browse', text: _t(T.fileDeleted, lang).replace('{name}', deletedName) });
        await loadTree(true);
      } else if (res && (res.error === 'permission-prompt' || storageManager.errorCategory(res) === STORAGE_ERRORS.NEEDS_APPROVAL)) {
        setTreeNotice({ tone: 'warn', scope: 'browse', text: _t(T.fileWritePerm, lang) });
      } else {
        setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(res)) });
      }
    } catch (err) {
      setTreeNotice({ tone: 'err', scope: 'browse', text: _copyError(lang, storageManager.errorCategory(err)) });
    } finally {
      setFileBusy(null);
    }
  };

  // ── Zouti (Backup / Export / Download) ──────────────────────────
  // The Tool Runner — same tagged-result contract as `run`, but
  // scoped to the tools card notice. `method` is the honest outcome
  // ('user-folder' | 'picker' | 'browser' — the UI never chose it).
  const runTool = async (action, fn) => {
    if (treeBusy) {
      return;
    }
    setTreeBusy(action);
    setTreeNotice(null);
    try {
      const res = await fn();
      if (res && res.ok) {
        const method = _t(METHOD_COPY[res.method] || METHOD_COPY.browser, lang);
        const verified = res.verified === true ? ` (${_t(T.toolVerified, lang)})` : '';
        // The honest fallback note (e.g. WHY the user-folder write was
        // skipped) must reach the user — never dropped silently.
        const note = res.note ? ` — ${res.note}` : '';
        setTreeNotice({
          tone: 'ok',
          scope: 'tools',
          text: _t(T.toolResult, lang)
            .replace('{file}', res.fileName || '?')
            .replace('{method}', method) + verified + note,
        });
        // A user-folder write changes the tree — refresh it silently.
        if (res.method === 'user-folder') {
          await loadTree(true);
        }
      } else if (res && res.cancelled === true) {
        setTreeNotice({ tone: 'warn', scope: 'tools', text: _copyError(lang, STORAGE_ERRORS.CANCELLED) });
      } else if (res && res.ok === false) {
        setTreeNotice({ tone: 'err', scope: 'tools', text: _copyError(lang, storageManager.errorCategory(res)) });
      }
    } catch (err) {
      setTreeNotice({ tone: 'err', scope: 'tools', text: _copyError(lang, storageManager.errorCategory(err)) });
    } finally {
      setTreeBusy(null);
    }
  };

  // WHAT a backup contains — the explicit product decision (never an
  // implicit DB dump): app state + offline settings + consent status +
  // the saved-draft index (metadata only — form ids + timestamps). A
  // collection failure is RECORDED in the envelope (warnings) — a
  // partial backup must never present as complete.
  const collectData = async () => {
    const warnings = [];
    let appState = null;
    let settings = null;
    let consent = null;
    let drafts = [];
    try { appState = await restoreAppState(); } catch { warnings.push('appState'); }
    try { settings = await getOfflineSettings(); } catch { warnings.push('settings'); }
    try { consent = await consentEngine.status(); } catch { warnings.push('consent'); }
    const dl = await storageManager.drafts.list().catch(() => null);
    if (dl && dl.ok) { drafts = dl.drafts; } else if (!dl) { warnings.push('drafts'); }
    return {
      appState: appState || {},
      settings: settings || {},
      consent: consent || null,
      drafts,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  };

  // NOTE: NO private-quota gate here — backup/export write to the USER
  // folder or the browser download, never to private storage; the
  // getWriteStatus gate lives in the write TEST (where it is honest).
  const doBackup = () => runTool('backup', () => storageManager.createBackup({ collect: collectData }));

  const doExport = () => runTool('export', async () => {
      const data = await collectData();
      const fileName = `atelnyo-done_${Date.now()}.json`;
      return storageManager.createExport({
        type: EXPORT_TYPES.DATA,
        fileName,
        data: JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2),
        mime: 'application/json',
      });
    });

  const doDownload = () => runTool('download', () => {
    const st = storageManager.getState();
    const report = {
      exportedAt: new Date().toISOString(),
      backend: st.backend,
      fileBackend: st.fileBackend,
      health: st.health,
      spaceLevel: st.spaceLevel,
      usage: st.usage,
      quota: st.quota,
      persisted: st.persisted,
      userStorage: {
        connected: !!st.userStorage?.rootFolderConnected,
        rootName: st.userStorage?.rootName || null,
        status: st.userStorage?.status || null,
        permission: st.userStorage?.permissionState || null,
        accessible: st.userStorage?.accessible ?? null,
      },
    };
    return storageManager.saveDownload(
      `atelnyo-rapo_${Date.now()}.json`,
      JSON.stringify(report, null, 2),
      { mime: 'application/json' },
    );
  });

  const confirmRow = (kind) => {
    if (confirming !== kind) {
      return null;
    }
    const explain = kind === 'disconnect'
      ? _t(T.disconnectExplain, lang)
      : _t(T.revokeExplain, lang);
    return (
      <div className="stg-confirm">
        <p className="stg-confirm-text"><i className="fas fa-circle-info" aria-hidden="true" /> {explain}</p>
        <div className="stg-confirm-actions">
          <button
            type="button"
            className="stg-btn stg-btn--danger"
            disabled={busy}
            onClick={kind === 'disconnect' ? doDisconnect : doRevoke}
          >
            {busy === kind && <i className="fas fa-spinner fa-spin" />}
            {_t(T.confirm, lang)}
          </button>
          <button
            type="button"
            className="stg-btn stg-btn--ghost"
            disabled={busy}
            onClick={() => setConfirming(null)}
          >
            {_t(T.cancel, lang)}
          </button>
        </div>
      </div>
    );
  };

  const actionBtn = (action, label, opts = {}) => (
    <button
      type="button"
      className={`stg-btn${opts.danger ? ' stg-btn--danger' : ''}${opts.ghost ? ' stg-btn--ghost' : ''}${opts.primary ? ' stg-btn--primary' : ''}`}
      disabled={busy}
      onClick={opts.onClick}
    >
      {busy === action && <i className="fas fa-spinner fa-spin" />}
      {label}
    </button>
  );

  // ── User-storage state-dependent actions ────────────────────────
  const renderUserActions = () => {
    switch (status) {
      case 'not-connected':
      case 'disconnected':
      case 'revoked':
        return (
          <>
            {actionBtn('connect', _t(T.connectBtn, lang), { primary: true, onClick: connect })}
            <p className="stg-hint">{_t(T.notConnectedHint, lang)}</p>
          </>
        );
      case 'permission-required':
        return (
          <>
            {actionBtn('reapprove', _t(T.reapproveBtn, lang), { primary: true, onClick: reapprove })}
            <p className="stg-hint">{_t(T.notConnectedHint, lang)}</p>
          </>
        );
      case 'error':
        return (
          <>
            <div className="stg-actions">
              {actionBtn('revalidate', _t(T.revalidateBtn, lang), { onClick: revalidate })}
              {actionBtn('connect', _t(T.connectBtn, lang), { primary: true, onClick: connect })}
            </div>
            <p className="stg-hint">{_t(T.errorGoneHint, lang)}</p>
          </>
        );
      case 'unavailable':
        return <p className="stg-hint">{_t(T.unavailableHint, lang)}</p>;
      default:
        // connected / read-only / read-write — the root is live.
        return (
          <>
            <div className="stg-actions">
              {actionBtn('change', _t(T.changeBtn, lang), { onClick: changeRoot })}
              {actionBtn('revalidate', _t(T.revalidateBtn, lang), { onClick: revalidate })}
            </div>
            {userStorage.readable && !userStorage.writable && (
              <div className="stg-write-upgrade">
                {actionBtn('write', _t(T.writeBtn, lang), { primary: true, onClick: grantWrite })}
                <span className="stg-write-hint">{_t(T.writeHint, lang)}</span>
              </div>
            )}
            <div className="stg-actions stg-actions--danger">
              <button
                type="button"
                className="stg-btn stg-btn--ghost"
                disabled={busy}
                onClick={() => setConfirming(confirming === 'disconnect' ? null : 'disconnect')}
              >
                {_t(T.disconnectBtn, lang)}
              </button>
              <button
                type="button"
                className="stg-btn stg-btn--ghost stg-btn--danger-text"
                disabled={busy}
                onClick={() => setConfirming(confirming === 'revoke' ? null : 'revoke')}
              >
                {_t(T.revokeBtn, lang)}
              </button>
            </div>
            {confirmRow('disconnect')}
            {confirmRow('revoke')}
          </>
        );
    }
  };

  const validatedAt = formatWhen(userStorage.lastValidated);

  // ── Catalog search results (computed each render — the index is an
  //    in-memory Map; search is a cheap scan). star-only mode lists
  //    every starred entry; a query filters by name/path.
  const catResults = starredOnly
    ? storageManager.catalog.search('').filter((r) => r.starred)
    : storageManager.catalog.search(catQuery);

  return (
    <div className="stg-panel">
      {/* ── Aggregate status pill ─────────────────────────────── */}
      <div className="stg-aggregate">
        <span className={`stg-pill stg-pill--${aggregateLevel}`}>
          <i className={`fas ${aggregateLevel === 'ok' || aggregateLevel === 'unknown' ? 'fa-heart-pulse' : 'fa-triangle-exclamation'}`} aria-hidden="true" />
          {_t(LEVEL_COPY[aggregateLevel] || LEVEL_COPY.unknown, lang)}
        </span>
        {lastError && (
          <span className="stg-last-error" title={lastError}>
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {lastError}
          </span>
        )}
        {userError && (
          <span className="stg-last-error stg-last-error--user" title={userError}>
            <i className="fas fa-folder-exclamation" aria-hidden="true" /> {userError}
          </span>
        )}
      </div>

      {/* ── Private app storage ───────────────────────────────── */}
      <div className="stg-card">
        <div className="stg-card-head">
          <i className="fas fa-box-archive stg-card-icon" aria-hidden="true" />
          <div>
            <div className="stg-card-title">{_t(T.privateTitle, lang)}</div>
            <div className="stg-card-sub">{_t(T.privateBody, lang)}</div>
          </div>
        </div>
        {!snap.ready ? (
          <div className="stg-loading"><i className="fas fa-spinner fa-spin" /> {_t(T.loading, lang)}</div>
        ) : (
          <>
            {(lowSpace || criticalSpace) && (
              <div className={`stg-banner stg-banner--${criticalSpace ? 'critical' : 'warn'}`}>
                <i className="fas fa-database" aria-hidden="true" />
                {criticalSpace ? _t(T.lowSpaceCritical, lang) : _t(T.lowSpace, lang)}
              </div>
            )}
            <div className="stg-facts">
              <div className="stg-fact">
                <span className="stg-fact-label">{_t(T.backendLabel, lang)}</span>
                <span className="stg-fact-value stg-mono">{snap.backend || '—'}</span>
              </div>
              <div className="stg-fact">
                <span className="stg-fact-label">{_t(T.fileBackendLabel, lang)}</span>
                <span className="stg-fact-value stg-mono">{privateStorage.fileBackend || '—'}</span>
              </div>
              <div className="stg-fact">
                <span className="stg-fact-label">{_t(T.usageLabel, lang)}</span>
                <span className="stg-fact-value">{formatBytes(snap.usage)}</span>
              </div>
              <div className="stg-fact">
                <span className="stg-fact-label">{_t(T.quotaLabel, lang)}</span>
                <span className="stg-fact-value">{formatBytes(snap.quota)}</span>
              </div>
            </div>
            {!snap.persisted ? (
              <div className="stg-persist">
                {actionBtn('persist', _t(T.persistedBtn, lang), { onClick: makePersistent })}
                <span className="stg-write-hint">{_t(T.persistedNote, lang)}</span>
              </div>
            ) : (
              <div className="stg-persist-ok">
                <i className="fas fa-shield-halved" aria-hidden="true" /> {_t(T.persistedYes, lang)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── User storage ──────────────────────────────────────── */}
      <div className="stg-card">
        <div className="stg-card-head">
          <i className="fas fa-folder-tree stg-card-icon" aria-hidden="true" />
          <div>
            <div className="stg-card-title">{_t(T.userTitle, lang)}</div>
            <div className="stg-card-sub">{_t(T.userBody, lang)}</div>
          </div>
        </div>
        {!userStorage.ready ? (
          <div className="stg-loading"><i className="fas fa-spinner fa-spin" /> {_t(T.loading, lang)}</div>
        ) : (
          <>
            <div className={`stg-status stg-status--${statusInfo.tone}`}>
              <i className={`fas ${statusInfo.icon}`} aria-hidden="true" />
              <span>{statusLabel}</span>
              {userStorage.writable && (
                <span className="stg-status-extra">
                  · <i className="fas fa-pen" aria-hidden="true" /> {_t(T.writeBtn, lang)}
                </span>
              )}
            </div>
            {userStorage.rootName && (
              <div className="stg-rootname">
                <i className="fas fa-folder" aria-hidden="true" />
                <span className="stg-mono">{userStorage.rootName}</span>
              </div>
            )}
            {userStorage.rootFolderConnected && (
              <div className="stg-facts">
                <div className="stg-fact">
                  <span className="stg-fact-label">{_t(T.permissionLabel, lang)}</span>
                  <span className="stg-fact-value stg-mono">{userStorage.permissionState || '—'}</span>
                </div>
                <div className="stg-fact">
                  <span className="stg-fact-label">{_t(T.modeLabel, lang)}</span>
                  <span className="stg-fact-value stg-mono">{userStorage.accessMode || '—'}</span>
                </div>
                {validatedAt && (
                  <div className="stg-fact">
                    <span className="stg-fact-label">{_t(T.validatedLabel, lang)}</span>
                    <span className="stg-fact-value">{validatedAt}</span>
                  </div>
                )}
              </div>
            )}
            <div className="stg-actions">{renderUserActions()}</div>
            {notice && (
              <div className="stg-notice">
                <i className="fas fa-circle-info" aria-hidden="true" /> {notice}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Browse Atelnyo (file manager surface) ────────────── */}
      {rootConnected && (
        <div className="stg-card">
          <div className="stg-card-head">
            <i className="fas fa-sitemap stg-card-icon" aria-hidden="true" />
            <div>
              <div className="stg-card-title">{_t(T.browseTitle, lang)}</div>
              <div className="stg-card-sub">{_t(T.browseBody, lang)}</div>
            </div>
          </div>
          <div className="stg-browse-actions">
            <button
              type="button"
              className="stg-btn"
              disabled={busy || treeLoading || !!treeBusy}
              onClick={refreshTree}
            >
              {treeLoading && <i className="fas fa-spinner fa-spin" />}
              {_t(tree ? T.browseRefresh : T.browseLoad, lang)}
            </button>
            <button
              type="button"
              className="stg-btn stg-btn--ghost"
              disabled={busy || treeLoading || !!treeBusy}
              onClick={testWrite}
            >
              {treeBusy === 'write' && <i className="fas fa-spinner fa-spin" />}
              {_t(T.browseWriteTest, lang)}
            </button>
          </div>
          <p className="stg-hint">{_t(T.browseWriteTestHint, lang)}</p>
          {/* ── File catalog: search + stars + persistent index ── */}
          <div className="stg-cat">
            <div className="stg-cat-bar">
              <div className="stg-cat-search-wrap">
                <i className="fas fa-magnifying-glass stg-cat-search-icon" aria-hidden="true" />
                <input
                  className="stg-cat-search"
                  type="search"
                  value={catQuery}
                  onChange={(ev) => setCatQuery(ev.target.value)}
                  placeholder={_t(T.catSearchPh, lang)}
                  aria-label={_t(T.catSearchPh, lang)}
                />
              </div>
              <button
                type="button"
                className={`stg-btn stg-cat-star-btn${starredOnly ? ' is-active' : ''}`}
                disabled={!catSnap.ready || !!treeBusy}
                onClick={() => setStarredOnly((prev) => !prev)}
                title={_t(T.catStarred, lang)}
              >
                <i className="fas fa-star" aria-hidden="true" />
                {catSnap.starsCount > 0 && <span className="stg-cat-star-count">{catSnap.starsCount}</span>}
              </button>
              <button
                type="button"
                className="stg-btn stg-btn--ghost"
                disabled={!rootConnected || !!treeBusy}
                onClick={resyncCatalog}
                title={_t(T.catResync, lang)}
              >
                <i className="fas fa-rotate" aria-hidden="true" />
              </button>
            </div>
            {(catQuery || starredOnly) && (
              <div className="stg-cat-results">
                <div className="stg-cat-results-head">
                  <span className="stg-cat-results-title">
                    <i className="fas fa-star" aria-hidden="true" /> {_t(T.catTitle, lang)}
                  </span>
                  {!catSnap.ready ? (
                    <span className="stg-hint">{_t(T.catIndexing, lang)}</span>
                  ) : catResults.length === 0 ? (
                    <span className="stg-hint">{_t(T.catNoResults, lang)}</span>
                  ) : (
                    <span className="stg-cat-results-count">{catResults.length}</span>
                  )}
                </div>
                {catSnap.ready && catResults.length > 0 && (
                  <ul className="stg-tree-files">
                    {catResults.map((r) => (
                      <li key={`${r.folder}/${r.category || ''}/${r.name}`} className="stg-tree-file">
                        <button
                          type="button"
                          className="stg-tree-file-open"
                          title={_t(T.fileOpenHint, lang)}
                          // Directories are browsable in the tree, not
                          // openable here — match the tree's FileRow
                          // (open + star are file-only actions).
                          disabled={!!fileBusy || r.kind === 'directory'}
                          onClick={() => { if (r.kind !== 'directory') { openFile({ folder: r.folder, category: r.category, name: r.name }); } }}
                        >
                          <i className={`fas ${r.kind === 'directory' ? 'fa-folder' : 'fa-file'}`} aria-hidden="true" />
                          <span className="stg-mono">{r.name}</span>
                          <span className="stg-cat-result-path">{r.folder}{r.category ? `/${r.category}` : ''}</span>
                        </button>
                        {r.kind !== 'directory' && (
                          <button
                            type="button"
                            className={`stg-file-btn stg-file-btn--star${r.starred ? ' is-starred' : ''}`}
                            title={r.starred ? _t(T.starOn, lang) : _t(T.starHint, lang)}
                            disabled={!!fileBusy}
                            onClick={() => toggleStar({ folder: r.folder, category: r.category, name: r.name })}
                          >
                            <i className={`fas ${r.starred ? 'fa-star' : 'fa-star-regular'}`} aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="stg-cat-status" title={_t(T.catBody, lang)}>
              <i className="fas fa-book" aria-hidden="true" />
              {!catSnap.ready ? (
                <span className="stg-hint">{_t(T.catIndexing, lang)}</span>
              ) : (
                <>
                  <span>{_t(T.catStatus, lang).replace('{files}', catSnap.files).replace('{dirs}', catSnap.dirs).replace('{stars}', catSnap.starsCount)}</span>
                  <span className={`stg-cat-persist${catSnap.persisted ? ' is-persisted' : ''}`}>
                    <i className={`fas ${catSnap.persisted ? 'fa-file-circle-check' : 'fa-memory'}`} aria-hidden="true" />
                    {catSnap.persisted ? _t(T.catPersisted, lang) : _t(T.catMemoryOnly, lang)}
                  </span>
                </>
              )}
            </div>
            {catSnap.lastError && (
              <div className="stg-notice stg-notice--err">
                <i className="fas fa-circle-exclamation" aria-hidden="true" />
                {_t(T.catErr, lang).replace('{err}', catSnap.lastError)}
              </div>
            )}
          </div>
          {preview && (
            <div className="stg-preview">
              <div className="stg-preview-head">
                <i className={`fas ${preview.kind === 'image' ? 'fa-image' : 'fa-file-lines'}`} aria-hidden="true" />
                <span className="stg-mono">{preview.name}</span>
                <span className="stg-preview-meta">
                  {preview.kind === 'image' ? _t(T.previewImage, lang) : preview.kind === 'text' ? _t(T.previewText, lang) : _t(T.previewMeta, lang)}
                </span>
                <button type="button" className="stg-preview-close" onClick={closePreview} title={_t(T.cancel, lang)} aria-label={_t(T.cancel, lang)}>
                  <i className="fas fa-xmark" aria-hidden="true" />
                </button>
              </div>
              <div className="stg-preview-body">
                {preview.kind === 'image' ? (
                  <img src={preview.url} alt={preview.name} className="stg-preview-img" />
                ) : preview.kind === 'text' ? (
                  <pre className="stg-preview-text">{preview.text}</pre>
                ) : (
                  <p className="stg-preview-none">{_t(T.previewNoPreview, lang)}</p>
                )}
              </div>
              <div className="stg-preview-actions">
                <button type="button" className="stg-btn" disabled={!!fileBusy} onClick={downloadPreview}>
                  {fileBusy === 'download' && <i className="fas fa-spinner fa-spin" />}
                  <i className="fas fa-download" aria-hidden="true" /> {_t(T.previewDownload, lang)}
                </button>
              </div>
            </div>
          )}
          {treeLoading && (
            <div className="stg-loading"><i className="fas fa-spinner fa-spin" /> {_t(T.loading, lang)}</div>
          )}
          {!treeLoading && tree && tree.ok === true && (
            <div className="stg-tree">
              {tree.folders.map((node) => (
                <div key={node.folder} className="stg-tree-folder">
                  <div className="stg-tree-folder-head">
                    <i className={`fas ${FOLDER_ICONS[node.folder] || 'fa-folder'}`} aria-hidden="true" />
                    <span>{node.folder}</span>
                    {countEntries(node) > 0 && <span className="stg-tree-count">{countEntries(node)}</span>}
                  </div>
                  {node.error && (
                    <div className="stg-tree-node-error">
                      <i className="fas fa-triangle-exclamation" aria-hidden="true" />{' '}
                      {_copyError(lang, storageManager.errorCategory({ ok: false, error: node.error }))}
                    </div>
                  )}
                  {node.entries.length > 0 && (
                    <ul className="stg-tree-files">
                      {node.entries.map((e) => (
                        <FileRow
                          key={e.name}
                          entry={e}
                          folder={node.folder}
                          category={null}
                          lang={lang}
                          onOpen={openFile}
                          onRenameStart={startRename}
                          renaming={renaming}
                          renameDraft={renameDraft}
                          onRenameChange={(ev) => setRenameDraft(ev.target.value)}
                          onRenameKey={onRenameKey}
                          onRenameOk={doRename}
                          onRenameCancel={cancelRename}
                          confirmDelete={confirmDelete}
                          onConfirmDelete={confirmDeleteFile}
                          onCancelDelete={cancelDeleteFile}
                          onDoDelete={doDeleteFile}
                          onToggleStar={toggleStar}
                          starred={storageManager.catalog.isStarred({ folder: node.folder, category: null, name: e.name })}
                          fileBusy={fileBusy}
                          capRename={capOf(storageManager.fs.OPS.RENAME)}
                          capDelete={capOf(storageManager.fs.OPS.DELETE)}
                        />
                      ))}
                    </ul>
                  )}
                  {node.categories.length > 0 && (
                    <div className="stg-tree-cats">
                      {node.categories.map((cat) => {
                        const entries = (node.categoryEntries && node.categoryEntries[cat]) || [];
                        const key = `${node.folder}/${cat}`;
                        const open = expanded.has(key);
                        return (
                          <div key={key} className="stg-tree-cat">
                            <button
                              type="button"
                              className="stg-tree-cat-head"
                              aria-expanded={open}
                              onClick={() => toggleExpand(key)}
                            >
                              <i className={`fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'}`} aria-hidden="true" />
                              <span>{cat}</span>
                              {entries.length > 0 && <span className="stg-tree-count">{entries.length}</span>}
                            </button>
                            {open && (
                              entries.length > 0 ? (
                                <ul className="stg-tree-files">
                                  {entries.map((e) => (
                                    <FileRow
                                      key={e.name}
                                      entry={e}
                                      folder={node.folder}
                                      category={cat}
                                      lang={lang}
                                      onOpen={openFile}
                                      onRenameStart={startRename}
                                      renaming={renaming}
                                      renameDraft={renameDraft}
                                      onRenameChange={(ev) => setRenameDraft(ev.target.value)}
                                      onRenameKey={onRenameKey}
                                      onRenameOk={doRename}
                                      onRenameCancel={cancelRename}
                                      confirmDelete={confirmDelete}
                                      onConfirmDelete={confirmDeleteFile}
                                      onCancelDelete={cancelDeleteFile}
                                      onDoDelete={doDeleteFile}
                                      onToggleStar={toggleStar}
                                      starred={storageManager.catalog.isStarred({ folder: node.folder, category: cat, name: e.name })}
                                      fileBusy={fileBusy}
                                      capRename={capOf(storageManager.fs.OPS.RENAME)}
                                      capDelete={capOf(storageManager.fs.OPS.DELETE)}
                                    />
                                  ))}
                                </ul>
                              ) : (
                                <p className="stg-tree-empty">—</p>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {tree.folders.every((n) => countEntries(n) === 0) && (
                <p className="stg-hint">{_t(T.browseEmpty, lang)}</p>
              )}
            </div>
          )}
          {treeNotice && treeNotice.scope === 'browse' && (
            <div className={`stg-notice stg-notice--${treeNotice.tone}`}>
              <i className="fas fa-circle-info" aria-hidden="true" /> {treeNotice.text}
            </div>
          )}
        </div>
      )}

      {/* ── Zouti (Backup / Export / Download) ──────────────────── */}
      <div className="stg-card">
        <div className="stg-card-head">
          <i className="fas fa-toolbox stg-card-icon" aria-hidden="true" />
          <div>
            <div className="stg-card-title">{_t(T.toolsTitle, lang)}</div>
            <div className="stg-card-sub">{_t(T.toolsBody, lang)}</div>
          </div>
        </div>
        <div className="stg-browse-actions">
          <button
            type="button"
            className="stg-btn"
            disabled={busy || treeLoading || !!treeBusy}
            onClick={doBackup}
          >
            {treeBusy === 'backup' && <i className="fas fa-spinner fa-spin" />}
            <i className="fas fa-database" aria-hidden="true" /> {_t(T.backupBtn, lang)}
          </button>
          <button
            type="button"
            className="stg-btn"
            disabled={busy || treeLoading || !!treeBusy}
            onClick={doExport}
          >
            {treeBusy === 'export' && <i className="fas fa-spinner fa-spin" />}
            <i className="fas fa-file-export" aria-hidden="true" /> {_t(T.exportBtn, lang)}
          </button>
          <button
            type="button"
            className="stg-btn stg-btn--ghost"
            disabled={busy || treeLoading || !!treeBusy}
            onClick={doDownload}
          >
            {treeBusy === 'download' && <i className="fas fa-spinner fa-spin" />}
            <i className="fas fa-download" aria-hidden="true" /> {_t(T.downloadBtn, lang)}
          </button>
        </div>
        <p className="stg-hint">{_t(T.toolHint, lang)}</p>
        {treeNotice && treeNotice.scope === 'tools' && (
          <div className={`stg-notice stg-notice--${treeNotice.tone}`}>
            <i className="fas fa-circle-info" aria-hidden="true" /> {treeNotice.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoragePanel;
