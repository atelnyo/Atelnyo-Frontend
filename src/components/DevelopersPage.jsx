/**
 * src/components/DevelopersPage.jsx
 *
 * Atelnyo Developer Platform — public landing page for developers
 * building on Atelnyo.
 *
 * URL: /developers
 * Public, crawlable, multilingual (ht/en/fr/es).
 */
import React, { useState } from 'react';
import SEOHead from './shared/SEOHead';
import api from '../services/api';

const SEO = {
  en: { title: 'Developers', description: 'Atelnyo developer documentation, API reference, integration guides, and open-source resources.' },
  ht: { title: 'Devlopè', description: 'Dokimantasyon devlopè Atelnyo, referans API, gid entegrasyon, ak resous sous-ouvert.' },
  fr: { title: 'Développeurs', description: 'Documentation développeur Atelnyo, référence API, guides d\'intégration et ressources open-source.' },
  es: { title: 'Desarrolladores', description: 'Documentación de desarrolladores de Atelnyo, referencia API, guías de integración y recursos de código abierto.' },
};

// Quickstart snippets. Same two-step flow (authenticate, then call an
// authenticated endpoint) in the three languages developers ask for most.
const SAMPLES = [
  {
    id: 'curl',
    label: 'cURL',
    code: [
      '# 1. Get an access token',
      'curl -X POST https://api.atelnyo.site/api/login/ \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"username": "you", "password": "********"}\'',
      '',
      '# 2. Call any endpoint with the token',
      'curl https://api.atelnyo.site/api/courses/ \\',
      '  -H "Authorization: Bearer $ACCESS_TOKEN"',
    ].join('\n'),
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    code: [
      '// 1. Get an access token',
      'const token = await fetch(\'https://api.atelnyo.site/api/login/\', {',
      '  method: \'POST\',',
      '  headers: { \'Content-Type\': \'application/json\' },',
      '  body: JSON.stringify({ username: \'you\', password: \'********\' }),',
      '}).then((res) => res.json());',
      '',
      '// 2. Call any endpoint with the token',
      'const courses = await fetch(\'https://api.atelnyo.site/api/courses/\', {',
      '  headers: { Authorization: `Bearer ${token.access}` },',
      '}).then((res) => res.json());',
    ].join('\n'),
  },
  {
    id: 'python',
    label: 'Python',
    code: [
      'import requests',
      '',
      '# 1. Get an access token',
      'token = requests.post(',
      '    "https://api.atelnyo.site/api/login/",',
      '    json={"username": "you", "password": "********"},',
      ').json()',
      '',
      '# 2. Call any endpoint with the token',
      'courses = requests.get(',
      '    "https://api.atelnyo.site/api/courses/",',
      '    headers={"Authorization": f"Bearer {token[\'access\']}"},',
      ').json()',
    ].join('\n'),
  },
];
// Retry helper shown next to the 429 guidance. Kept as an array join so the
// snippet stays readable here without escaping a template literal.
const BACKOFF_SAMPLE = [
  '// Retry a throttled request, honouring Retry-After.',
  'async function getWithRetry(url, attempt = 0) {',
  '  const res = await fetch(url);',
  '',
  '  if (res.status === 429 && attempt < 3) {',
  '    const wait = Number(res.headers.get(\'Retry-After\') || 2 ** (attempt + 1));',
  '    await new Promise((resolve) => setTimeout(resolve, wait * 1000));',
  '    return getWithRetry(url, attempt + 1);',
  '  }',
  '',
  '  return res;',
  '}',
].join('\n');

const PAGE = {
  en: {
    badge: 'Developer Platform',
    title: 'Build on Atelnyo',
    subtitle: 'One API for courses, music, creators, products, and communities.',
    heroDesc: 'Ship integrations that reach creators and learners across the Atelnyo ecosystem — documented REST endpoints, JWT authentication, webhooks, and open-source tooling.',
    ctaPrimary: 'Explore the API',
    ctaSecondary: 'View on GitHub',
    heroNote: 'No SDK required — start with a single HTTP request.',
    ctaAbout: 'About Atelnyo',
    stats: [
      { value: '50+', label: 'REST endpoints' },
      { value: 'JWT', label: 'Auth built in' },
      { value: '4', label: 'Locales served' },
      { value: 'Webhooks', label: 'Real-time events' },
    ],

    quickstartTitle: 'Quickstart',
    quickstartDesc: 'Authenticate, grab an access token, and make your first request in under a minute.',
    copyLabel: 'Copy',
    copiedLabel: 'Copied!',
    navLabel: 'Page sections',
    nav: {
      quickstart: 'Quickstart',
      features: 'Features',
      api: 'API',
      errors: 'Limits & Errors',
      integrations: 'Integrations',
      openSource: 'Open Source',
      tools: 'Tools',
      contact: 'Contact',
    },

    featuresTitle: 'Everything you need to integrate',
    featuresDesc: 'A small, predictable surface area — HTTP and JSON, with no proprietary SDK to learn.',
    features: [
      { icon: '🔌', title: 'REST API', desc: 'JSON endpoints for courses, music, talent, products, communities, and payments.' },
      { icon: '🔐', title: 'JWT authentication', desc: 'Short-lived access tokens with refresh tokens for secure sessions.' },
      { icon: '🪝', title: 'Webhooks', desc: 'Real-time event notifications for enrollments, payments, and more.' },
      { icon: '🌍', title: 'Multilingual data', desc: 'Content available in Haitian Creole, English, French, and Spanish.' },
    ],

    apiTitle: 'REST API',
    apiDesc: 'Atelnyo exposes a RESTful API for all platform operations. Authenticate with JWT tokens, interact with courses, creators, music, products, communities, and more.',
    apiBase: 'Base URL',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Authentication',
    apiAuthValue: 'JWT Bearer tokens (access + refresh)',
    apiEndpoints: 'Key Endpoints',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'List published courses' },
      { method: 'GET', path: '/explore/music/', desc: 'List music tracks' },
      { method: 'GET', path: '/explore/talents/', desc: 'List talent profiles' },
      { method: 'GET', path: '/jobs/', desc: 'List job postings' },
      { method: 'GET', path: '/communities/', desc: 'List communities' },
      { method: 'POST', path: '/login/', desc: 'Authenticate user' },
      { method: 'POST', path: '/refresh/', desc: 'Refresh access token' },
      { method: 'GET', path: '/me/', desc: 'Get current user' },
      { method: 'GET', path: '/config/public/', desc: 'Public platform config' },
    ],
    tryTitle: 'Try it',
    rowTry: 'Try',
    tryDesc: 'Send a real unauthenticated request to the public API and inspect the raw response.',
    tryEndpoint: 'Endpoint',
    trySend: 'Send request',
    trySending: 'Sending…',
    tryError: 'Request failed',
    tryNote: 'No token required. Some endpoints may be rate-limited or unavailable while the API is offline.',

    limitsTitle: 'Rate limits & errors',
    limitsDesc: 'Every endpoint is throttled so a single client cannot starve the API. Budgets are per client IP — sending a token raises the ceiling.',
    limits: [
      { label: 'Public API (no token)', value: '300–600 requests / min per IP' },
      { label: 'Signed-in requests', value: 'up to 900 requests / min per IP' },
      { label: 'Discover & explore', value: '200 / min anonymous · 600 / min signed in' },
      { label: 'Search', value: '60 / min anonymous · 180 / min signed in' },
      { label: 'Login & signup', value: '5 / min per IP' },
    ],
    limitsNote: 'A throttled request returns 429 with a Retry-After header in seconds. Back off exponentially instead of retrying in a tight loop.',
    backoffTitle: 'Retry with backoff',
    backoffNote: 'Respect Retry-After — a tight retry loop only burns your remaining budget and keeps returning 429.',
    errorsTitle: 'Error responses',
    errorsDesc: 'Errors are JSON: {"detail": "…"} for HTTP errors and {"field": ["…"]} for validation failures. Treat the status code as the contract.',
    errorColStatus: 'Status',
    errorColMeaning: 'Meaning',
    errorColFix: 'What to do',
    errorRows: [
      { code: 400, meaning: 'Validation failed', fix: 'Read the field errors in the body, then resend with valid data.' },
      { code: 401, meaning: 'Missing or expired token', fix: 'Send Authorization: Bearer <access>; refresh via POST /refresh/ when it expires.' },
      { code: 403, meaning: 'Authenticated, but not allowed', fix: 'The account lacks the role or ownership this resource requires.' },
      { code: 404, meaning: 'Not found or not visible', fix: 'Draft and private objects return 404 rather than 403, by design.' },
      { code: 429, meaning: 'Rate limit exceeded', fix: 'Wait out Retry-After, then back off exponentially.' },
      { code: 500, meaning: 'Unexpected server error', fix: 'Retry once; if it persists, email developers@atelnyo.site with the time and path.' },
      { code: 503, meaning: 'Dependency unavailable', fix: 'The database or an upstream provider is down — retry with backoff.' },
    ],

    integrationTitle: 'Integrations',
    integrationDesc: 'Connect Atelnyo to the tools you already use — or let it call you.',
    integrations: [
      { name: 'Webhooks', desc: 'Receive real-time notifications for platform events (course enrollment, payment, etc.)', status: 'Available', tone: 'on' },
      { name: 'OAuth2', desc: 'Authenticate users via Google OAuth', status: 'Available', tone: 'on' },
      { name: 'Embed', desc: 'Embed Atelnyo courses on external websites', status: 'Planned', tone: 'soon' },
      { name: 'Mobile SDK', desc: 'Native Android/iOS integration', status: 'In Development', tone: 'soon' },
    ],

    openSourceTitle: 'Open Source',
    openSourceDesc: 'Read the code, file an issue, and build alongside us.',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA built with Vite', url: 'https://github.com/atelnyo/Atelnyo-Frontend', license: 'GPL-3.0' },
      { name: 'Atelnyo Android', desc: 'Native Android app (Kotlin)', url: 'https://github.com/Atelnyo/android', license: 'MIT' },
    ],

    toolsTitle: 'Developer Tools',
    tools: [
      { name: 'WebMCP', desc: 'AI agent integration via Model Context Protocol', status: 'Active', tone: 'on' },
      { name: 'Workers AI', desc: 'AI chat powered by Cloudflare Workers AI', status: 'Active', tone: 'on' },
      { name: 'Content Intelligence', desc: 'AI-powered SEO optimization for courses', status: 'Active', tone: 'on' },
    ],

    contactTitle: 'Get in Touch',
    contactDesc: 'Have questions about the API, want to partner, or need help with integration?',
    contactEmail: 'developers@atelnyo.site',
  },
  ht: {
    badge: 'Platfòm Devlopè',
    title: 'Bati sou Atelnyo',
    subtitle: 'Yon sèl API pou kou, mizik, kreyatè, pwodwi, ak kominote.',
    heroDesc: 'Kreye entegrasyon ki rive jwenn kreyatè ak elèv nan tout ekosistèm Atelnyo — pwen final REST dokimante, otantifikasyon JWT, webhooks, ak zouti sous-ouvert.',
    ctaPrimary: 'Eksplore API a',
    ctaSecondary: 'Wè sou GitHub',
    heroNote: 'Pa gen SDK obligatwa — kòmanse ak yon sèl demann HTTP.',
    ctaAbout: 'Sou Atelnyo',
    stats: [
      { value: '50+', label: 'Pwen final REST' },
      { value: 'JWT', label: 'Otantifikasyon entegre' },
      { value: '4', label: 'Lang sipòte' },
      { value: 'Webhooks', label: 'Evènman an tan reyèl' },
    ],

    quickstartTitle: 'Demaraj rapid',
    quickstartDesc: 'Otantifye, jwenn yon token, epi fè premye demann ou an an mwens pase yon minit.',
    copyLabel: 'Kopye',
    copiedLabel: 'Kopye!',
    navLabel: 'Seksyon paj la',
    nav: {
      quickstart: 'Demaraj',
      features: 'Fonksyon',
      api: 'API',
      errors: 'Limit ak Erè',
      integrations: 'Entegrasyon',
      openSource: 'Sous-Ouvert',
      tools: 'Zouti',
      contact: 'Kontak',
    },

    featuresTitle: 'Tout sa ou bezwen pou entegre',
    featuresDesc: 'Yon sipèfisi senp ak previzib — HTTP ak JSON, san okenn SDK propriyetè pou aprann.',
    features: [
      { icon: '🔌', title: 'REST API', desc: 'Pwen final JSON pou kou, mizik, talan, pwodwi, kominote, ak peman.' },
      { icon: '🔐', title: 'Otantifikasyon JWT', desc: 'Token access kout dire ak token refresh pou sesyon sekirize.' },
      { icon: '🪝', title: 'Webhooks', desc: 'Notifikasyon evènman an tan reyèl pou enskripsyon, peman, ak plis.' },
      { icon: '🌍', title: 'Done miltileng', desc: 'Kontni disponib an kreyòl ayisyen, anglè, franse, ak panyòl.' },
    ],

    apiTitle: 'REST API',
    apiDesc: 'Atelnyo ekspoze yon REST API pou tout operasyon platfòm. Otantifye ak token JWT, enteraktye ak kou, kreyatè, mizik, pwodwi, kominote, ak plis.',
    apiBase: 'URL Baz',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Otantifikasyon',
    apiAuthValue: 'Token JWT Bearer (access + refresh)',
    apiEndpoints: 'Prensipal Pwen Final',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'Li kou pibliye' },
      { method: 'GET', path: '/explore/music/', desc: 'Li travay mizik' },
      { method: 'GET', path: '/explore/talents/', desc: 'Li pwofil talan' },
      { method: 'GET', path: '/jobs/', desc: 'Li òf travay' },
      { method: 'GET', path: '/communities/', desc: 'Li kominote' },
      { method: 'POST', path: '/login/', desc: 'Otantifye itilizatè' },
      { method: 'POST', path: '/refresh/', desc: 'Rafrechi token access' },
      { method: 'GET', path: '/me/', desc: 'Jwenn itilizatè aktyèl' },
      { method: 'GET', path: '/config/public/', desc: 'Konfigirasyon piblik platfòm' },
    ],
    tryTitle: 'Eseye l',
    rowTry: 'Eseye',
    tryDesc: 'Voye yon vre demann san token sou API piblik la epi gade repons brit la.',
    tryEndpoint: 'Pwen final',
    trySend: 'Voye demann',
    trySending: 'Ap voye…',
    tryError: 'Demann echwe',
    tryNote: 'Pa bezwen token. Gen pwen final ki ka limite oswa endisponib si API a pa sou liy.',

    limitsTitle: 'Limit ak erè',
    limitsDesc: 'Chak pwen final gen yon limit pou yon sèl kliyan pa ka vide API a. Bidjè yo se pa IP kliyan — lè w voye yon token, plafon an monte.',
    limits: [
      { label: 'API piblik (san token)', value: '300–600 demann / min pa IP' },
      { label: 'Demann ak sesyon', value: 'jiska 900 demann / min pa IP' },
      { label: 'Dekouvri ak eksplore', value: '200 / min anonim · 600 / min konekte' },
      { label: 'Rechèch', value: '60 / min anonim · 180 / min konekte' },
      { label: 'Login ak enskripsyon', value: '5 / min pa IP' },
    ],
    limitsNote: 'Yon demann ki limite retounen 429 ak yon header Retry-After an segonn. Ralanti davans olye w reeseye nan yon bouk sere.',
    backoffTitle: 'Reeseye ak yon delè k ap grandi',
    backoffNote: 'Respekte Retry-After — yon bouk sere jis boule bidjè ki rete w epi l ap kontinye retounen 429.',
    errorsTitle: 'Repons erè',
    errorsDesc: 'Erè yo se JSON: {"detail": "…"} pou erè HTTP ak {"field": ["…"]} pou erè validasyon. Konsidere kòd estati a kòm kontra a.',
    errorColStatus: 'Estati',
    errorColMeaning: 'Siyifikasyon',
    errorColFix: 'Sa pou w fè',
    errorRows: [
      { code: 400, meaning: 'Validasyon echwe', fix: 'Li erè jaden yo nan kò a, epi voye ankò ak done valid.' },
      { code: 401, meaning: 'Token ki manke oswa ki ekspire', fix: 'Voye Authorization: Bearer <access>; rafrechi ak POST /refresh/ lè l ekspire.' },
      { code: 403, meaning: 'Otantifye, men pa pèmèt', fix: 'Kont lan pa gen wòl oswa pwopriyetè resous sa a mande.' },
      { code: 404, meaning: 'Pa jwenn oswa pa vizib', fix: 'Objè bouyon ak prive retounen 404 olye 403, se konsa li fèt.' },
      { code: 429, meaning: 'Limit demann depase', fix: 'Tann Retry-After, epi ralanti davans.' },
      { code: 500, meaning: 'Erè sèvè ki pa prevwa', fix: 'Reeseye yon fwa; si l kontinye, ekri developers@atelnyo.site ak lè a ak chemen an.' },
      { code: 503, meaning: 'Yon depandans pa disponib', fix: 'Baz done a oswa yon founisè anwo pa la — reeseye ak yon delè k ap grandi.' },
    ],

    integrationTitle: 'Entegrasyon',
    integrationDesc: 'Konekte Atelnyo ak zouti ou deja itilize — oswa kite li rele ou.',
    integrations: [
      { name: 'Webhooks', desc: 'Resevi notifikasyon an tan reyèl pou evènman platfòm', status: 'Disponib', tone: 'on' },
      { name: 'OAuth2', desc: 'Otantifye itilizatè via Google OAuth', status: 'Disponib', tone: 'on' },
      { name: 'Embed', desc: 'Entegre kou Atelnyo sou sit wèb ekstèn', status: 'Planifye', tone: 'soon' },
      { name: 'Mobile SDK', desc: 'Entegrasyon natif Android/iOS', status: 'Nan Devlopman', tone: 'soon' },
    ],

    openSourceTitle: 'Sous-Ouvert',
    openSourceDesc: 'Li kòd la, ouvri yon pwoblèm, epi bati ansanm ak nou.',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA ak Vite', url: 'https://github.com/atelnyo/Atelnyo-Frontend', license: 'GPL-3.0' },
      { name: 'Atelnyo Android', desc: 'Aplikasyon Android natif (Kotlin)', url: 'https://github.com/Atelnyo/android', license: 'MIT' },
    ],

    toolsTitle: 'Zouti Devlopè',
    tools: [
      { name: 'WebMCP', desc: 'Entegrasyon ajans AI via Model Context Protocol', status: 'Aktif', tone: 'on' },
      { name: 'Workers AI', desc: 'Chat AI ki mache ak Cloudflare Workers AI', status: 'Aktif', tone: 'on' },
      { name: 'Content Intelligence', desc: 'Optimizasyon SEO ak AI pou kou', status: 'Aktif', tone: 'on' },
    ],

    contactTitle: 'Kontakte Nou',
    contactDesc: 'Gen kesyon sou API a, ou vle patenarye, oswa ou bezwen èd ak entegrasyon?',
    contactEmail: 'developers@atelnyo.site',
  },
  fr: {
    badge: 'Plateforme Développeur',
    title: 'Construisez sur Atelnyo',
    subtitle: 'Une API pour les cours, la musique, les créateurs, les produits et les communautés.',
    heroDesc: 'Développez des intégrations qui touchent les créateurs et les apprenants de tout l\'écosystème Atelnyo — API REST documentée, authentification JWT, webhooks et outils open source.',
    ctaPrimary: 'Explorer l\'API',
    ctaSecondary: 'Voir sur GitHub',
    heroNote: 'Aucun SDK requis — commencez par une seule requête HTTP.',
    ctaAbout: 'À propos d\'Atelnyo',
    stats: [
      { value: '50+', label: 'Points d\'entrée REST' },
      { value: 'JWT', label: 'Authentification intégrée' },
      { value: '4', label: 'Langues servies' },
      { value: 'Webhooks', label: 'Événements temps réel' },
    ],

    quickstartTitle: 'Démarrage rapide',
    quickstartDesc: 'Authentifiez-vous, obtenez un token et effectuez votre première requête en moins d\'une minute.',
    copyLabel: 'Copier',
    copiedLabel: 'Copié !',
    navLabel: 'Sections de la page',
    nav: {
      quickstart: 'Démarrage',
      features: 'Fonctionnalités',
      api: 'API',
      errors: 'Limites et erreurs',
      integrations: 'Intégrations',
      openSource: 'Open Source',
      tools: 'Outils',
      contact: 'Contact',
    },

    featuresTitle: 'Tout ce qu\'il faut pour intégrer',
    featuresDesc: 'Une surface simple et prévisible — HTTP et JSON, sans SDK propriétaire à apprendre.',
    features: [
      { icon: '🔌', title: 'API REST', desc: 'Points d\'entrée JSON pour les cours, la musique, les talents, les produits, les communautés et les paiements.' },
      { icon: '🔐', title: 'Authentification JWT', desc: 'Tokens d\'accès à courte durée et tokens de rafraîchissement pour des sessions sécurisées.' },
      { icon: '🪝', title: 'Webhooks', desc: 'Notifications d\'événements en temps réel pour les inscriptions, paiements et plus.' },
      { icon: '🌍', title: 'Données multilingues', desc: 'Contenu disponible en créole haïtien, anglais, français et espagnol.' },
    ],

    apiTitle: 'API REST',
    apiDesc: 'Atelnyo expose une API RESTful pour toutes les opérations de la plateforme. Authentifiez-vous avec des tokens JWT et interagissez avec les cours, créateurs, musiques, produits et communautés.',
    apiBase: 'URL de Base',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Authentification',
    apiAuthValue: 'Tokens JWT Bearer (access + refresh)',
    apiEndpoints: 'Points d\'Entrée Clés',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'Lister les cours publiés' },
      { method: 'GET', path: '/explore/music/', desc: 'Lister les morceaux de musique' },
      { method: 'GET', path: '/explore/talents/', desc: 'Lister les profils de talents' },
      { method: 'GET', path: '/jobs/', desc: 'Lister les offres d\'emploi' },
      { method: 'GET', path: '/communities/', desc: 'Lister les communautés' },
      { method: 'POST', path: '/login/', desc: 'Authentifier l\'utilisateur' },
      { method: 'POST', path: '/refresh/', desc: 'Rafraîchir le token d\'accès' },
      { method: 'GET', path: '/me/', desc: 'Obtenir l\'utilisateur actuel' },
      { method: 'GET', path: '/config/public/', desc: 'Configuration publique de la plateforme' },
    ],
    tryTitle: 'Essayez',
    rowTry: 'Essayer',
    tryDesc: 'Envoyez une vraie requête non authentifiée à l\'API publique et inspectez la réponse brute.',
    tryEndpoint: 'Point d\'entrée',
    trySend: 'Envoyer la requête',
    trySending: 'Envoi…',
    tryError: 'Échec de la requête',
    tryNote: 'Aucun token requis. Certains points d\'entrée peuvent être limités ou indisponibles si l\'API est hors ligne.',

    limitsTitle: 'Limites et erreurs',
    limitsDesc: 'Chaque endpoint est limité pour qu\'un seul client ne puisse pas saturer l\'API. Les quotas sont par IP client — envoyer un token relève le plafond.',
    limits: [
      { label: 'API publique (sans token)', value: '300–600 requêtes / min par IP' },
      { label: 'Requêtes authentifiées', value: 'jusqu\'à 900 requêtes / min par IP' },
      { label: 'Découverte et exploration', value: '200 / min anonyme · 600 / min connecté' },
      { label: 'Recherche', value: '60 / min anonyme · 180 / min connecté' },
      { label: 'Connexion et inscription', value: '5 / min par IP' },
    ],
    limitsNote: 'Une requête limitée renvoie 429 avec un en-tête Retry-After en secondes. Attendez, puis augmentez progressivement le délai au lieu de réessayer en boucle.',
    backoffTitle: 'Réessayer avec un délai croissant',
    backoffNote: 'Respectez Retry-After — une boucle serrée consomme votre quota restant et renvoie toujours 429.',
    errorsTitle: 'Réponses d\'erreur',
    errorsDesc: 'Les erreurs sont en JSON : {"detail": "…"} pour les erreurs HTTP et {"field": ["…"]} pour les échecs de validation. Le code de statut fait foi.',
    errorColStatus: 'Statut',
    errorColMeaning: 'Signification',
    errorColFix: 'Que faire',
    errorRows: [
      { code: 400, meaning: 'Échec de validation', fix: 'Lisez les erreurs de champ dans le corps, puis renvoyez des données valides.' },
      { code: 401, meaning: 'Token absent ou expiré', fix: 'Envoyez Authorization: Bearer <access> ; rafraîchissez via POST /refresh/ à expiration.' },
      { code: 403, meaning: 'Authentifié, mais non autorisé', fix: 'Le compte n\'a pas le rôle ou la propriété requis pour cette ressource.' },
      { code: 404, meaning: 'Introuvable ou non visible', fix: 'Les brouillons et objets privés renvoient 404 plutôt que 403, par conception.' },
      { code: 429, meaning: 'Limite de requêtes atteinte', fix: 'Attendez Retry-After, puis augmentez le délai entre les essais.' },
      { code: 500, meaning: 'Erreur serveur inattendue', fix: 'Réessayez une fois ; si cela persiste, écrivez à developers@atelnyo.site avec la date et le chemin.' },
      { code: 503, meaning: 'Dépendance indisponible', fix: 'La base de données ou un fournisseur amont est indisponible — réessayez avec un délai croissant.' },
    ],

    integrationTitle: 'Intégrations',
    integrationDesc: 'Connectez Atelnyo aux outils que vous utilisez déjà — ou laissez-le vous appeler.',
    integrations: [
      { name: 'Webhooks', desc: 'Notifications en temps réel pour les événements de la plateforme', status: 'Disponible', tone: 'on' },
      { name: 'OAuth2', desc: 'Authentifier les utilisateurs via Google OAuth', status: 'Disponible', tone: 'on' },
      { name: 'Embed', desc: 'Intégrer les cours Atelnyo sur des sites externes', status: 'Prévu', tone: 'soon' },
      { name: 'Mobile SDK', desc: 'Intégration native Android/iOS', status: 'En développement', tone: 'soon' },
    ],

    openSourceTitle: 'Open Source',
    openSourceDesc: 'Lisez le code, ouvrez une issue et construisez avec nous.',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA construit avec Vite', url: 'https://github.com/atelnyo/Atelnyo-Frontend', license: 'GPL-3.0' },
      { name: 'Atelnyo Android', desc: 'Application Android native (Kotlin)', url: 'https://github.com/Atelnyo/android', license: 'MIT' },
    ],

    toolsTitle: 'Outils Développeur',
    tools: [
      { name: 'WebMCP', desc: 'Intégration d\'agents AI via Model Context Protocol', status: 'Actif', tone: 'on' },
      { name: 'Workers AI', desc: 'Chat AI propulsé par Cloudflare Workers AI', status: 'Actif', tone: 'on' },
      { name: 'Content Intelligence', desc: 'Optimisation SEO des cours par IA', status: 'Actif', tone: 'on' },
    ],

    contactTitle: 'Contactez-nous',
    contactDesc: 'Des questions sur l\'API, un partenariat ou besoin d\'aide pour l\'intégration ?',
    contactEmail: 'developers@atelnyo.site',
  },
  es: {
    badge: 'Plataforma para Desarrolladores',
    title: 'Construye sobre Atelnyo',
    subtitle: 'Una API para cursos, música, creadores, productos y comunidades.',
    heroDesc: 'Crea integraciones que lleguen a creadores y estudiantes de todo el ecosistema Atelnyo — endpoints REST documentados, autenticación JWT, webhooks y herramientas de código abierto.',
    ctaPrimary: 'Explorar la API',
    ctaSecondary: 'Ver en GitHub',
    heroNote: 'No se requiere SDK — empieza con una sola petición HTTP.',
    ctaAbout: 'Sobre Atelnyo',
    stats: [
      { value: '50+', label: 'Endpoints REST' },
      { value: 'JWT', label: 'Autenticación integrada' },
      { value: '4', label: 'Idiomas servidos' },
      { value: 'Webhooks', label: 'Eventos en tiempo real' },
    ],

    quickstartTitle: 'Inicio rápido',
    quickstartDesc: 'Autentícate, obtén un token y haz tu primera petición en menos de un minuto.',
    copyLabel: 'Copiar',
    copiedLabel: '¡Copiado!',
    navLabel: 'Secciones de la página',
    nav: {
      quickstart: 'Inicio',
      features: 'Funciones',
      api: 'API',
      errors: 'Límites y errores',
      integrations: 'Integraciones',
      openSource: 'Código abierto',
      tools: 'Herramientas',
      contact: 'Contacto',
    },

    featuresTitle: 'Todo lo necesario para integrar',
    featuresDesc: 'Una superficie simple y predecible — HTTP y JSON, sin SDK propietario que aprender.',
    features: [
      { icon: '🔌', title: 'API REST', desc: 'Endpoints JSON para cursos, música, talento, productos, comunidades y pagos.' },
      { icon: '🔐', title: 'Autenticación JWT', desc: 'Tokens de acceso de corta duración y tokens de refresco para sesiones seguras.' },
      { icon: '🪝', title: 'Webhooks', desc: 'Notificaciones de eventos en tiempo real para inscripciones, pagos y más.' },
      { icon: '🌍', title: 'Datos multilingües', desc: 'Contenido disponible en criollo haitiano, inglés, francés y español.' },
    ],

    apiTitle: 'API REST',
    apiDesc: 'Atelnyo expone una API RESTful para todas las operaciones de la plataforma. Autentícate con tokens JWT e interactúa con cursos, creadores, música, productos y comunidades.',
    apiBase: 'URL Base',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Autenticación',
    apiAuthValue: 'Tokens JWT Bearer (access + refresh)',
    apiEndpoints: 'Endpoints Clave',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'Listar cursos publicados' },
      { method: 'GET', path: '/explore/music/', desc: 'Listar pistas de música' },
      { method: 'GET', path: '/explore/talents/', desc: 'Listar perfiles de talento' },
      { method: 'GET', path: '/jobs/', desc: 'Listar ofertas de empleo' },
      { method: 'GET', path: '/communities/', desc: 'Listar comunidades' },
      { method: 'POST', path: '/login/', desc: 'Autenticar usuario' },
      { method: 'POST', path: '/refresh/', desc: 'Renovar el token de acceso' },
      { method: 'GET', path: '/me/', desc: 'Obtener el usuario actual' },
      { method: 'GET', path: '/config/public/', desc: 'Configuración pública de la plataforma' },
    ],
    tryTitle: 'Pruébalo',
    rowTry: 'Probar',
    tryDesc: 'Envía una petición real sin autenticación a la API pública e inspecciona la respuesta sin procesar.',
    tryEndpoint: 'Endpoint',
    trySend: 'Enviar petición',
    trySending: 'Enviando…',
    tryError: 'La petición falló',
    tryNote: 'No requiere token. Algunos endpoints pueden estar limitados o no disponibles si la API está caída.',

    limitsTitle: 'Límites y errores',
    limitsDesc: 'Cada endpoint está limitado para que un solo cliente no sature la API. Los cupos son por IP de cliente — enviar un token eleva el techo.',
    limits: [
      { label: 'API pública (sin token)', value: '300–600 peticiones / min por IP' },
      { label: 'Peticiones autenticadas', value: 'hasta 900 peticiones / min por IP' },
      { label: 'Descubrir y explorar', value: '200 / min anónimo · 600 / min con sesión' },
      { label: 'Búsqueda', value: '60 / min anónimo · 180 / min con sesión' },
      { label: 'Inicio de sesión y registro', value: '5 / min por IP' },
    ],
    limitsNote: 'Una petición limitada devuelve 429 con la cabecera Retry-After en segundos. Espera y aumenta el intervalo en vez de reintentar en bucle.',
    backoffTitle: 'Reintentar con espera creciente',
    backoffNote: 'Respeta Retry-After — un bucle apretado solo consume tu cupo restante y sigue devolviendo 429.',
    errorsTitle: 'Respuestas de error',
    errorsDesc: 'Los errores son JSON: {"detail": "…"} para errores HTTP y {"field": ["…"]} para fallos de validación. El código de estado es el contrato.',
    errorColStatus: 'Estado',
    errorColMeaning: 'Significado',
    errorColFix: 'Qué hacer',
    errorRows: [
      { code: 400, meaning: 'Validación fallida', fix: 'Lee los errores de campo del cuerpo y reenvía datos válidos.' },
      { code: 401, meaning: 'Token ausente o caducado', fix: 'Envía Authorization: Bearer <access>; renueva con POST /refresh/ al caducar.' },
      { code: 403, meaning: 'Autenticado, pero no autorizado', fix: 'La cuenta no tiene el rol o la propiedad que exige este recurso.' },
      { code: 404, meaning: 'No encontrado o no visible', fix: 'Los borradores y objetos privados devuelven 404 en lugar de 403, por diseño.' },
      { code: 429, meaning: 'Límite de peticiones superado', fix: 'Espera Retry-After y luego aumenta el intervalo entre intentos.' },
      { code: 500, meaning: 'Error de servidor inesperado', fix: 'Reintenta una vez; si persiste, escribe a developers@atelnyo.site con la hora y la ruta.' },
      { code: 503, meaning: 'Dependencia no disponible', fix: 'La base de datos o un proveedor externo está caído — reintenta con espera creciente.' },
    ],

    integrationTitle: 'Integraciones',
    integrationDesc: 'Conecta Atelnyo con las herramientas que ya usas — o deja que te llame.',
    integrations: [
      { name: 'Webhooks', desc: 'Notificaciones en tiempo real para eventos de la plataforma', status: 'Disponible', tone: 'on' },
      { name: 'OAuth2', desc: 'Autenticar usuarios vía Google OAuth', status: 'Disponible', tone: 'on' },
      { name: 'Embed', desc: 'Insertar cursos de Atelnyo en sitios externos', status: 'Planificado', tone: 'soon' },
      { name: 'Mobile SDK', desc: 'Integración nativa Android/iOS', status: 'En desarrollo', tone: 'soon' },
    ],

    openSourceTitle: 'Código Abierto',
    openSourceDesc: 'Lee el código, abre un issue y construye junto a nosotros.',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA construido con Vite', url: 'https://github.com/atelnyo/Atelnyo-Frontend', license: 'GPL-3.0' },
      { name: 'Atelnyo Android', desc: 'Aplicación Android nativa (Kotlin)', url: 'https://github.com/Atelnyo/android', license: 'MIT' },
    ],

    toolsTitle: 'Herramientas de Desarrollador',
    tools: [
      { name: 'WebMCP', desc: 'Integración de agentes AI vía Model Context Protocol', status: 'Activo', tone: 'on' },
      { name: 'Workers AI', desc: 'Chat AI impulsado por Cloudflare Workers AI', status: 'Activo', tone: 'on' },
      { name: 'Content Intelligence', desc: 'Optimización SEO de cursos con IA', status: 'Activo', tone: 'on' },
    ],

    contactTitle: 'Contáctanos',
    contactDesc: '¿Preguntas sobre la API, una alianza o ayuda con la integración?',
    contactEmail: 'developers@atelnyo.site',
  },
};

// Public GET endpoints the in-page explorer may call. Paths omit the leading
// slash because the axios client already appends the API base (…/api/).
const EXPLORER_ENDPOINTS = [
  'courses/',
  'explore/music/',
  'explore/talents/',
  'jobs/',
  'communities/',
  'config/public/',
];

// In-page navigation. Keys map to both the section ids below and the short
// `nav` labels in PAGE, so the chips stay aligned with the page structure.
const NAV_ITEMS = [
  { id: 'quickstart', key: 'quickstart' },
  { id: 'features', key: 'features' },
  { id: 'api', key: 'api' },
  { id: 'errors', key: 'errors' },
  { id: 'integrations', key: 'integrations' },
  { id: 'open-source', key: 'openSource' },
  { id: 'tools', key: 'tools' },
  { id: 'contact', key: 'contact' },
];

const METHOD_COLORS = {
  GET: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  POST: { bg: 'rgba(59,130,246,0.1)', color: '#2563eb' },
  PUT: { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  PATCH: { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  DELETE: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626' },
};

export default function DevelopersPage({ lang = 'en', market = '' }) {
  const t = PAGE[lang] || PAGE.en;
  const s = SEO[lang] || SEO.en;
  const locale = market ? `${lang}-${market}` : '';
  const [copied, setCopied] = useState(false);
  const [activeSample, setActiveSample] = useState(SAMPLES[0].id);
  const [explorerPath, setExplorerPath] = useState(EXPLORER_ENDPOINTS[0]);
  const [explorerResult, setExplorerResult] = useState(null);
  const sample = SAMPLES.find((s) => s.id === activeSample) || SAMPLES[0];

  // Live "try it" call so developers can see a real payload before writing
  // any code. Deliberately limited to public GET endpoints — no auth, no
  // writes, and a short timeout so a sleeping backend cannot hang the page.
  const runExplorerRequest = async () => {
    setExplorerResult({ state: 'loading' });
    const startedAt = Date.now();
    try {
      const res = await api.get(explorerPath, { timeout: 8000 });
      const body = JSON.stringify(res.data, null, 2);
      setExplorerResult({
        state: 'success',
        status: res.status,
        ms: Date.now() - startedAt,
        body: body.length > 4000 ? `${body.slice(0, 4000)}\n…` : body,
      });
    } catch (err) {
      setExplorerResult({
        state: 'error',
        ms: Date.now() - startedAt,
        message: err?.response ? `HTTP ${err.response.status}` : (err?.message || 'Network error'),
      });
    }
  };

  // Jump from an endpoint row to the explorer with that path preselected.
  // The row buttons only exist for public GET endpoints the explorer can
  // actually call, so no token-protected path is ever suggested.
  const selectExplorerEndpoint = (path) => {
    setExplorerPath(path);
    const select = document.getElementById('try-endpoint');
    if (!select) {
      return;
    }
    if (typeof select.scrollIntoView === 'function') {
      select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    select.focus({ preventScroll: true });
  };

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(sample.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <SEOHead
        title={s.title}
        description={s.description}
        image="https://atelnyo.site/og-banner-en.svg"
        url="/developers"
        type="website"
        lang={lang}
        locale={locale}
        breadcrumbs={[{ label: 'Home', url: '/' }, { label: 'Developers', url: '/developers' }]}
      />

      <main style={styles.main} role="main">

        {/* ── Hero ── */}
        <header style={styles.hero}>
          <div style={styles.heroInner}>
            <span style={styles.badge}>{t.badge}</span>
            <h1 style={styles.heroTitle}>{t.title}</h1>
            <p style={styles.heroSubtitle}>{t.subtitle}</p>
            <p style={styles.heroDesc}>{t.heroDesc}</p>
            <div style={styles.heroActions}>
              <a href="#api" style={styles.ctaPrimary}>{t.ctaPrimary}</a>
              <a href="https://github.com/atelnyo/Atelnyo-Frontend" target="_blank" rel="noopener noreferrer" style={styles.ctaSecondary}>
                {t.ctaSecondary}
              </a>
            </div>
            <p style={styles.heroNote}>{t.heroNote}</p>

            <div style={styles.stats}>
              {t.stats.map((stat) => (
                <div key={stat.label} style={styles.stat}>
                  <span style={styles.statValue}>{stat.value}</span>
                  <span style={styles.statLabel}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── In-page navigation ── */}
        <nav aria-label={t.navLabel} style={styles.toc}>
          <div style={styles.tocInner}>
            {NAV_ITEMS.map((item) => (
              <a key={item.id} href={`#${item.id}`} style={styles.tocLink}>
                {t.nav[item.key]}
              </a>
            ))}
          </div>
        </nav>

        {/* ── Quickstart ── */}
        <section style={styles.band} id="quickstart" aria-labelledby="quickstart-title">
          <div style={styles.section}>
            <h2 id="quickstart-title" style={styles.h2}>{t.quickstartTitle}</h2>
            <p style={styles.sectionDesc}>{t.quickstartDesc}</p>

            <div style={styles.codePanel}>
              <div style={styles.codeBar}>
                <span style={styles.dots} aria-hidden="true">
                  <span style={styles.dot} />
                  <span style={styles.dot} />
                  <span style={styles.dot} />
                </span>
                <div role="tablist" aria-label={t.quickstartTitle} style={styles.tabs}>
                  {SAMPLES.map((s) => {
                    const isActive = s.id === activeSample;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        id={`sample-tab-${s.id}`}
                        aria-selected={isActive}
                        aria-controls="sample-panel"
                        onClick={() => setActiveSample(s.id)}
                        style={isActive ? styles.tabActive : styles.tab}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={handleCopy} style={styles.copyBtn}>
                  {copied ? t.copiedLabel : t.copyLabel}
                </button>
              </div>
              <pre
                id="sample-panel"
                role="tabpanel"
                aria-labelledby={`sample-tab-${activeSample}`}
                style={styles.pre}
              >
                <code>{sample.code}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section style={styles.section} id="features" aria-labelledby="features-title">
          <h2 id="features-title" style={styles.h2}>{t.featuresTitle}</h2>
          <p style={styles.sectionDesc}>{t.featuresDesc}</p>
          <div style={styles.cardGrid} role="list">
            {t.features.map((feature) => (
              <div key={feature.title} style={styles.card} role="listitem">
                <span style={styles.featureIcon} aria-hidden="true">{feature.icon}</span>
                <h3 style={styles.cardTitle}>{feature.title}</h3>
                <p style={styles.cardDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── API Reference ── */}
        <section style={styles.band} id="api" aria-labelledby="api-title">
          <div style={styles.section}>
            <h2 id="api-title" style={styles.h2}>🔌 {t.apiTitle}</h2>
            <p style={styles.sectionDesc}>{t.apiDesc}</p>

            <div style={styles.infoCard}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t.apiBase}</span>
                <code style={styles.code}>{t.apiBaseValue}</code>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t.apiAuth}</span>
                <span style={styles.infoValue}>{t.apiAuthValue}</span>
              </div>
            </div>

            <h3 style={styles.h3}>{t.apiEndpoints}</h3>
            <div style={styles.endpointList} role="list" aria-label={t.apiEndpoints}>
              {t.endpoints.map((ep) => {
                const mc = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;
                const tryPath = ep.method === 'GET' ? ep.path.replace(/^\//, '') : '';
                const canTry = EXPLORER_ENDPOINTS.includes(tryPath);
                return (
                  <div key={`${ep.method} ${ep.path}`} style={styles.endpointRow} role="listitem">
                    <span style={{ ...styles.method, background: mc.bg, color: mc.color }}>{ep.method}</span>
                    <code style={styles.endpointPath}>{ep.path}</code>
                    <span style={styles.endpointDesc}>{ep.desc}</span>
                    {canTry && (
                      <button
                        type="button"
                        onClick={() => selectExplorerEndpoint(tryPath)}
                        style={styles.rowTry}
                        aria-label={`${t.tryTitle}: GET ${ep.path}`}
                      >
                        {t.rowTry}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.tryPanel}>
              <h3 style={styles.tryTitle}>{t.tryTitle}</h3>
              <p style={styles.tryDesc}>{t.tryDesc}</p>
              <div style={styles.tryControls}>
                <label htmlFor="try-endpoint" style={styles.tryLabel}>{t.tryEndpoint}</label>
                <select
                  id="try-endpoint"
                  value={explorerPath}
                  onChange={(e) => setExplorerPath(e.target.value)}
                  style={styles.select}
                >
                  {EXPLORER_ENDPOINTS.map((path) => (
                    <option key={path} value={path}>GET /{path}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={runExplorerRequest}
                  disabled={explorerResult?.state === 'loading'}
                  style={styles.sendBtn}
                >
                  {explorerResult?.state === 'loading' ? t.trySending : t.trySend}
                </button>
              </div>

              <div aria-live="polite" style={styles.tryResult}>
                {explorerResult?.state === 'loading' && (
                  <p style={styles.tryMeta}>{t.trySending}</p>
                )}
                {explorerResult?.state === 'error' && (
                  <p style={styles.tryErrorText}>
                    {t.tryError} — {explorerResult.message} ({explorerResult.ms} ms)
                  </p>
                )}
                {explorerResult?.state === 'success' && (
                  <>
                    <p style={styles.tryMeta}>
                      <span style={styles.tryStatus}>HTTP {explorerResult.status}</span>
                      <span>{explorerResult.ms} ms</span>
                    </p>
                    <pre style={styles.tryPre}><code>{explorerResult.body}</code></pre>
                  </>
                )}
              </div>
              <p style={styles.tryNote}>{t.tryNote}</p>
            </div>
          </div>
        </section>

        {/* ── Rate limits & errors ── */}
        <section style={styles.section} id="errors" aria-labelledby="errors-title">
          <h2 id="errors-title" style={styles.h2}>🚦 {t.limitsTitle}</h2>
          <p style={styles.sectionDesc}>{t.limitsDesc}</p>

          <div style={styles.infoCard}>
            {t.limits.map((limit) => (
              <div key={limit.label} style={styles.infoRow}>
                <span style={styles.infoLabel}>{limit.label}</span>
                <span style={styles.infoValue}>{limit.value}</span>
              </div>
            ))}
          </div>
          <p style={styles.noteText}>{t.limitsNote}</p>

          <div style={styles.tryPanel}>
            <h3 style={styles.tryTitle}>{t.backoffTitle}</h3>
            <p style={styles.tryDesc}>{t.backoffNote}</p>
            <pre style={styles.tryPre}><code>{BACKOFF_SAMPLE}</code></pre>
          </div>

          <h3 style={styles.h3}>{t.errorsTitle}</h3>
          <p style={styles.sectionDesc}>{t.errorsDesc}</p>
          <div style={styles.tableWrap}>
            <table style={styles.table} aria-label={t.errorsTitle}>
              <thead>
                <tr>
                  <th scope="col" style={styles.th}>{t.errorColStatus}</th>
                  <th scope="col" style={styles.th}>{t.errorColMeaning}</th>
                  <th scope="col" style={styles.th}>{t.errorColFix}</th>
                </tr>
              </thead>
              <tbody>
                {t.errorRows.map((row) => {
                  const tone = row.code >= 500 || row.code === 429
                    ? { bg: 'rgba(220,38,38,0.1)', color: '#dc2626' }
                    : { bg: 'rgba(245,158,11,0.12)', color: '#b45309' };
                  return (
                    <tr key={row.code}>
                      <td style={styles.td}>
                        <span style={{ ...styles.method, background: tone.bg, color: tone.color }}>{row.code}</span>
                      </td>
                      <td style={styles.tdMeaning}>{row.meaning}</td>
                      <td style={styles.td}>{row.fix}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Integrations ── */}
        <section style={styles.section} id="integrations" aria-labelledby="integrations-title">
          <h2 id="integrations-title" style={styles.h2}>🔗 {t.integrationTitle}</h2>
          <p style={styles.sectionDesc}>{t.integrationDesc}</p>
          <div style={styles.cardGrid} role="list">
            {t.integrations.map((int) => (
              <div key={int.name} style={styles.card} role="listitem">
                <h3 style={styles.cardTitle}>{int.name}</h3>
                <p style={styles.cardDesc}>{int.desc}</p>
                <span style={int.tone === 'soon' ? styles.statusSoon : styles.statusOn}>{int.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Open Source ── */}
        <section style={styles.band} id="open-source" aria-labelledby="open-source-title">
          <div style={styles.section}>
            <h2 id="open-source-title" style={styles.h2}>🌐 {t.openSourceTitle}</h2>
            <p style={styles.sectionDesc}>{t.openSourceDesc}</p>
            <div style={styles.cardGrid} role="list">
              {t.openSource.map((os) => (
                <div key={os.name} style={styles.card} role="listitem">
                  <h3 style={styles.cardTitle}>{os.name}</h3>
                  <p style={styles.cardDesc}>{os.desc}</p>
                  <div style={styles.cardMeta}>
                    <a href={os.url} target="_blank" rel="noopener noreferrer" style={styles.link}>{os.url}</a>
                    <span style={styles.license}>{os.license}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Developer Tools ── */}
        <section style={styles.section} id="tools" aria-labelledby="tools-title">
          <h2 id="tools-title" style={styles.h2}>🛠️ {t.toolsTitle}</h2>
          <div style={styles.cardGrid} role="list">
            {t.tools.map((tool) => (
              <div key={tool.name} style={styles.card} role="listitem">
                <h3 style={styles.cardTitle}>{tool.name}</h3>
                <p style={styles.cardDesc}>{tool.desc}</p>
                <span style={styles.statusOn}>{tool.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact CTA ── */}
        <section style={styles.ctaBand} id="contact" aria-labelledby="contact-title">
          <div style={styles.ctaInner}>
            <h2 id="contact-title" style={styles.ctaTitle}>{t.contactTitle}</h2>
            <p style={styles.ctaDesc}>{t.contactDesc}</p>
            <div style={styles.ctaActions}>
              <a href={`mailto:${t.contactEmail}`} style={styles.ctaPrimary}>{t.contactEmail}</a>
              <a href="/about" style={styles.ctaSecondary}>{t.ctaAbout}</a>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}

const styles = {
  main: {
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    color: 'var(--text-primary, #1a1a2e)',
    lineHeight: 1.7,
  },

  /* Hero */
  hero: {
    background: 'linear-gradient(135deg, #0b1120 0%, #1e1b4b 55%, #831843 100%)',
    color: '#fff',
    padding: '4.5rem 1.5rem 3.5rem',
  },
  heroInner: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 12px',
    borderRadius: '9999px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#f9a8d4',
    marginBottom: '1.25rem',
  },
  heroTitle: {
    fontSize: 'clamp(2rem, 5vw, 3.25rem)',
    fontWeight: 800,
    lineHeight: 1.15,
    margin: '0 0 0.75rem',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
    fontWeight: 500,
    margin: '0 0 1rem',
    color: '#e9d5ff',
  },
  heroDesc: {
    fontSize: '1.05rem',
    maxWidth: '680px',
    margin: 0,
    color: 'rgba(255,255,255,0.75)',
  },
  heroActions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginTop: '1.75rem',
  },
  ctaPrimary: {
    display: 'inline-block',
    padding: '12px 28px',
    background: '#fff',
    color: '#831843',
    borderRadius: '9999px',
    fontWeight: 600,
    fontSize: '0.95rem',
    textDecoration: 'none',
  },
  ctaSecondary: {
    display: 'inline-block',
    padding: '12px 28px',
    background: 'transparent',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '9999px',
    fontWeight: 600,
    fontSize: '0.95rem',
    textDecoration: 'none',
  },
  heroNote: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.55)',
    margin: '1rem 0 0',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1.25rem',
    margin: '2.5rem 0 0',
    paddingTop: '1.75rem',
    borderTop: '1px solid rgba(255,255,255,0.15)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
  },
  statValue: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '0.78rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },

  /* Sections */
  section: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '3.5rem 1.5rem',
    scrollMarginTop: '64px',
  },
  toc: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--surface-primary, #fff)',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },
  tocInner: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0.6rem 1.5rem',
    display: 'flex',
    gap: '0.4rem',
    overflowX: 'auto',
  },
  tocLink: {
    flex: '0 0 auto',
    padding: '4px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary, #555)',
    textDecoration: 'none',
    borderRadius: '9999px',
    border: '1px solid var(--border-color, #e0e0e0)',
    whiteSpace: 'nowrap',
  },
  band: {
    background: 'var(--surface-secondary, #f8f9fa)',
    borderTop: '1px solid var(--border-color, #e0e0e0)',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
    scrollMarginTop: '64px',
  },
  h2: {
    fontSize: '1.6rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  h3: {
    fontSize: '1.05rem',
    fontWeight: 600,
    margin: '1.5rem 0 0.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  sectionDesc: {
    fontSize: '0.98rem',
    color: 'var(--text-secondary, #555)',
    maxWidth: '680px',
    margin: '0 0 1.75rem',
  },

  /* Quickstart */
  codePanel: {
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#0b1120',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 10px 30px rgba(15,23,42,0.15)',
  },
  codeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0.6rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  dots: {
    display: 'inline-flex',
    gap: '6px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '3px 10px',
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.55)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  tabActive: {
    padding: '3px 10px',
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#f9a8d4',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  copyBtn: {
    marginLeft: 'auto',
    padding: '4px 12px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#f9a8d4',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  pre: {
    margin: 0,
    padding: '1.25rem',
    overflowX: 'auto',
    fontSize: '0.85rem',
    lineHeight: 1.7,
    color: '#e2e8f0',
    fontFamily: 'monospace',
  },

  /* Cards */
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '12px',
    padding: '1.5rem',
  },
  featureIcon: {
    display: 'inline-block',
    fontSize: '1.5rem',
    marginBottom: '0.5rem',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 0.4rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  cardDesc: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary, #666)',
    margin: '0 0 0.75rem',
    lineHeight: 1.55,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  link: {
    fontSize: '0.8rem',
    color: 'var(--pink-primary, #d81b60)',
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
  license: {
    fontSize: '0.7rem',
    background: 'var(--surface-secondary, #f0f0f0)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: 'var(--text-secondary, #888)',
  },
  statusOn: {
    display: 'inline-block',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '9999px',
    background: 'rgba(16,185,129,0.1)',
    color: '#059669',
  },
  statusSoon: {
    display: 'inline-block',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '9999px',
    background: 'rgba(245,158,11,0.12)',
    color: '#b45309',
  },

  /* API reference */
  infoCard: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  infoLabel: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a2e)',
  },
  infoValue: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary, #666)',
  },
  code: {
    fontSize: '0.82rem',
    background: 'var(--surface-secondary, #f0f0f0)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    color: 'var(--pink-primary, #d81b60)',
  },
  endpointList: {
    display: 'flex',
    flexDirection: 'column',
  },
  endpointRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.05))',
    flexWrap: 'wrap',
  },
  method: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    minWidth: '48px',
    textAlign: 'center',
  },
  endpointPath: {
    fontSize: '0.82rem',
    fontFamily: 'monospace',
    color: 'var(--text-primary, #1a1a2e)',
    minWidth: '160px',
  },
  endpointDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary, #888)',
  },
  rowTry: {
    marginLeft: 'auto',
    padding: '2px 10px',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--pink-primary, #d81b60)',
    background: 'transparent',
    border: '1px solid var(--pink-primary, #d81b60)',
    borderRadius: '9999px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  /* Try-it explorer */
  tryPanel: {
    marginTop: '1.5rem',
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '10px',
    padding: '1.25rem',
  },
  tryTitle: {
    fontSize: '1.05rem',
    fontWeight: 600,
    margin: '0 0 0.35rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  tryDesc: {
    fontSize: '0.88rem',
    color: 'var(--text-secondary, #666)',
    margin: '0 0 1rem',
  },
  tryControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tryLabel: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a2e)',
  },
  select: {
    flex: '1 1 220px',
    minWidth: '200px',
    padding: '7px 10px',
    fontSize: '0.82rem',
    fontFamily: 'monospace',
    color: 'var(--text-primary, #1a1a2e)',
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #ccc)',
    borderRadius: '6px',
  },
  sendBtn: {
    padding: '7px 16px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--pink-primary, #d81b60)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  tryResult: {
    marginTop: '0.9rem',
  },
  tryMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '0 0 0.5rem',
    fontSize: '0.78rem',
    color: 'var(--text-secondary, #666)',
    fontFamily: 'monospace',
  },
  tryStatus: {
    fontWeight: 700,
    color: '#059669',
  },
  tryErrorText: {
    margin: 0,
    fontSize: '0.82rem',
    color: '#b91c1c',
  },
  tryPre: {
    margin: 0,
    maxHeight: '320px',
    overflow: 'auto',
    padding: '0.9rem',
    borderRadius: '8px',
    background: '#0b1120',
    color: '#e2e8f0',
    fontSize: '0.78rem',
    lineHeight: 1.6,
    fontFamily: 'monospace',
  },
  tryNote: {
    margin: '0.75rem 0 0',
    fontSize: '0.75rem',
    color: 'var(--text-muted, #888)',
  },

  /* Rate limits & errors */
  noteText: {
    margin: '0.75rem 0 0',
    fontSize: '0.78rem',
    color: 'var(--text-secondary, #666)',
    maxWidth: '760px',
  },
  tableWrap: {
    overflowX: 'auto',
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.65rem 0.9rem',
    fontSize: '0.72rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary, #666)',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.65rem 0.9rem',
    verticalAlign: 'top',
    color: 'var(--text-secondary, #555)',
    borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.05))',
    lineHeight: 1.55,
  },
  tdMeaning: {
    padding: '0.65rem 0.9rem',
    verticalAlign: 'top',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a2e)',
    borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.05))',
    lineHeight: 1.55,
  },

  /* Contact CTA */
  ctaBand: {
    background: 'linear-gradient(135deg, #0b1120 0%, #1e1b4b 55%, #831843 100%)',
    color: '#fff',
    padding: '4rem 1.5rem',
  },
  ctaInner: {
    maxWidth: '700px',
    margin: '0 auto',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: '1.8rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
    color: '#fff',
  },
  ctaDesc: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.75)',
    margin: '0 0 1.5rem',
  },
  ctaActions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
};
