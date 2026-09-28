/**
 * src/components/DevelopersPage.jsx
 *
 * Atelnyo Developer Documentation — public page for developers
 * wanting to integrate with or build on Atelnyo.
 *
 * URL: /developers
 * Public, crawlable, multilingual (ht/en/fr/es).
 */
import React from 'react';
import SEOHead from './shared/SEOHead';
import { t2 } from '../utils/i18n';

const SEO = {
  en: { title: 'Developers', description: 'Atelnyo developer documentation, API reference, integration guides, and open-source resources.' },
  ht: { title: 'Devlopè', description: 'Dokimantasyon devlopè Atelnyo, referans API, gid entegrasyon, ak resous sous-ouvert.' },
  fr: { title: 'Développeurs', description: 'Documentation développeur Atelnyo, référence API, guides d\'intégration et ressources open-source.' },
  es: { title: 'Desarrolladores', description: 'Documentación de desarrolladores de Atelnyo, referencia API, guías de integración y recursos de código abierto.' },
};

const PAGE = {
  en: {
    title: 'Atelnyo for Developers',
    subtitle: 'Build with Atelnyo — API, integrations, and open-source tools.',
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

    integrationTitle: 'Integrations',
    integrations: [
      { name: 'Webhooks', desc: 'Receive real-time notifications for platform events (course enrollment, payment, etc.)', status: 'Available' },
      { name: 'OAuth2', desc: 'Authenticate users via Google OAuth', status: 'Available' },
      { name: 'Embed', desc: 'Embed Atelnyo courses on external websites', status: 'Planned' },
      { name: 'Mobile SDK', desc: 'Native Android/iOS integration', status: 'In Development' },
    ],

    openSourceTitle: 'Open Source',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA built with Vite', url: 'https://github.com/Atelnyo/frontend', license: 'MIT' },
      { name: 'Atelnyo Android', desc: 'Native Android app (Kotlin)', url: 'https://github.com/Atelnyo/android', license: 'MIT' },
    ],

    toolsTitle: 'Developer Tools',
    tools: [
      { name: 'WebMCP', desc: 'AI agent integration via Model Context Protocol', status: 'Active' },
      { name: 'Workers AI', desc: 'AI chat powered by Cloudflare Workers AI', status: 'Active' },
      { name: 'Content Intelligence', desc: 'AI-powered SEO optimization for courses', status: 'Active' },
    ],

    contactTitle: 'Get in Touch',
    contactDesc: 'Have questions about the API, want to partner, or need help with integration?',
    contactEmail: 'developers@atelnyo.site',
  },
  ht: {
    title: 'Atelnyo pou Devlopè',
    subtitle: 'Bati ak Atelnyo — API, entegrasyon, ak zouti sous-ouvert.',
    apiTitle: 'REST API',
    apiDesc: 'Atelnyo ekspoze yon REST API pou tout operasyon platfòm. Otentifye ak token JWT, enteraktye ak kou, kreyatè, mizik, pwodwi, kominote, ak plis.',
    apiBase: 'URL Baz',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Otentifikasyon',
    apiAuthValue: 'Token JWT Bearer (access + refresh)',
    apiEndpoints: 'Prensipal Endpoint',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'Li kou pibliye' },
      { method: 'GET', path: '/explore/music/', desc: 'Li travay mizik' },
      { method: 'POST', path: '/login/', desc: 'Otentifye itilizatè' },
      { method: 'GET', path: '/me/', desc: 'Jwenn itilizatè aktyèl' },
    ],
    integrationTitle: 'Entegrasyon',
    integrations: [
      { name: 'Webhooks', desc: 'Resevi notifikasyon reyèl-tan pou evènman platfòm', status: 'Disponib' },
      { name: 'OAuth2', desc: 'Otentifye itilizatè via Google OAuth', status: 'Disponib' },
    ],
    openSourceTitle: 'Sous-Ouvert',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA ak Vite', url: 'https://github.com/Atelnyo/frontend', license: 'MIT' },
    ],
    toolsTitle: 'Zouti Devlopè',
    tools: [
      { name: 'WebMCP', desc: 'Entegrasyon ajans AI via Model Context Protocol', status: 'Aktif' },
      { name: 'Workers AI', desc: 'Chat AI ki mache ak Cloudflare Workers AI', status: 'Aktif' },
    ],
    contactTitle: 'Kontakte Nou',
    contactDesc: 'Gen kesyon sou API a, ou vle patenarye, oswa ou bezwen èd ak entegrasyon?',
    contactEmail: 'developers@atelnyo.site',
  },
  fr: {
    title: 'Atelnyo pour Développeurs',
    subtitle: 'Construisez avec Atelnyo — API, intégrations et outils open-source.',
    apiTitle: 'API REST',
    apiDesc: 'Atelnyo expose une API RESTful pour toutes les opérations de la plateforme.',
    apiBase: 'URL de Base',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Authentification',
    apiAuthValue: 'Tokens JWT Bearer (access + refresh)',
    apiEndpoints: 'Points d\'Entrée Clés',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'Lister les cours publiés' },
      { method: 'POST', path: '/login/', desc: 'Authentifier l\'utilisateur' },
      { method: 'GET', path: '/me/', desc: 'Obtenir l\'utilisateur actuel' },
    ],
    integrationTitle: 'Intégrations',
    integrations: [
      { name: 'Webhooks', desc: 'Notifications en temps réel pour les événements', status: 'Disponible' },
    ],
    openSourceTitle: 'Open Source',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA avec Vite', url: 'https://github.com/Atelnyo/frontend', license: 'MIT' },
    ],
    toolsTitle: 'Outils Développeur',
    tools: [
      { name: 'WebMCP', desc: 'Intégration agent AI via Model Context Protocol', status: 'Actif' },
    ],
    contactTitle: 'Contactez-nous',
    contactDesc: 'Des questions sur l\'API ou besoin d\'aide ?',
    contactEmail: 'developers@atelnyo.site',
  },
  es: {
    title: 'Atelnyo para Desarrolladores',
    subtitle: 'Construya con Atelnyo — API, integraciones y herramientas de código abierto.',
    apiTitle: 'API REST',
    apiDesc: 'Atelnyo expone una API RESTful para todas las operaciones de la plataforma.',
    apiBase: 'URL Base',
    apiBaseValue: 'https://api.atelnyo.site/api/',
    apiAuth: 'Autenticación',
    apiAuthValue: 'Tokens JWT Bearer (access + refresh)',
    apiEndpoints: 'Puntos de Entrada Clave',
    endpoints: [
      { method: 'GET', path: '/courses/', desc: 'Listar cursos publicados' },
      { method: 'POST', path: '/login/', desc: 'Autenticar usuario' },
      { method: 'GET', path: '/me/', desc: 'Obtener usuario actual' },
    ],
    integrationTitle: 'Integraciones',
    integrations: [
      { name: 'Webhooks', desc: 'Notificaciones en tiempo real para eventos', status: 'Disponible' },
    ],
    openSourceTitle: 'Código Abierto',
    openSource: [
      { name: 'Atelnyo Frontend', desc: 'React SPA con Vite', url: 'https://github.com/Atelnyo/frontend', license: 'MIT' },
    ],
    toolsTitle: 'Herramientas de Desarrollador',
    tools: [
      { name: 'WebMCP', desc: 'Integración de agente AI vía Model Context Protocol', status: 'Activo' },
    ],
    contactTitle: 'Contáctenos',
    contactDesc: '¿Preguntas sobre la API o necesita ayuda?',
    contactEmail: 'developers@atelnyo.site',
  },
};

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
        <header style={styles.hero}>
          <div style={styles.heroIcon}>💻</div>
          <h1 style={styles.heroTitle}>{t.title}</h1>
          <p style={styles.heroSubtitle}>{t.subtitle}</p>
        </header>

        {/* API Reference */}
        <section style={styles.section}>
          <h2 style={styles.h2} id="api">🔌 {t.apiTitle}</h2>
          <p style={styles.p}>{t.apiDesc}</p>

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
            {t.endpoints.map((ep, i) => {
              const mc = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;
              return (
                <div key={i} style={styles.endpointRow} role="listitem">
                  <span style={{ ...styles.method, background: mc.bg, color: mc.color }}>{ep.method}</span>
                  <code style={styles.endpointPath}>{ep.path}</code>
                  <span style={styles.endpointDesc}>{ep.desc}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Integrations */}
        <section style={styles.section}>
          <h2 style={styles.h2} id="integrations">🔗 {t.integrationTitle}</h2>
          <div style={styles.cardGrid} role="list">
            {t.integrations.map((int, i) => (
              <div key={i} style={styles.card} role="listitem">
                <h3 style={styles.cardTitle}>{int.name}</h3>
                <p style={styles.cardDesc}>{int.desc}</p>
                <span style={styles.statusBadge}>{int.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Open Source */}
        <section style={styles.section}>
          <h2 style={styles.h2} id="open-source">🌐 {t.openSourceTitle}</h2>
          <div style={styles.cardGrid} role="list">
            {t.openSource.map((os, i) => (
              <div key={i} style={styles.card} role="listitem">
                <h3 style={styles.cardTitle}>{os.name}</h3>
                <p style={styles.cardDesc}>{os.desc}</p>
                <div style={styles.cardMeta}>
                  <a href={os.url} target="_blank" rel="noopener noreferrer" style={styles.link}>{os.url}</a>
                  <span style={styles.license}>{os.license}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Developer Tools */}
        <section style={styles.section}>
          <h2 style={styles.h2} id="tools">🛠️ {t.toolsTitle}</h2>
          <div style={styles.cardGrid} role="list">
            {t.tools.map((tool, i) => (
              <div key={i} style={styles.card} role="listitem">
                <h3 style={styles.cardTitle}>{tool.name}</h3>
                <p style={styles.cardDesc}>{tool.desc}</p>
                <span style={styles.statusBadge}>{tool.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section style={{ ...styles.section, ...styles.highlight }}>
          <h2 style={styles.h2}>📧 {t.contactTitle}</h2>
          <p style={styles.p}>{t.contactDesc}</p>
          <a href={`mailto:${t.contactEmail}`} style={styles.emailBtn}>{t.contactEmail}</a>
        </section>
      </main>
    </>
  );
}

const styles = {
  main: { maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem 4rem', fontFamily: 'var(--font-body, system-ui, sans-serif)', color: 'var(--text-primary, #1a1a2e)', lineHeight: 1.7 },
  hero: { textAlign: 'center', padding: '3rem 0 1.5rem' },
  heroIcon: { fontSize: '2.5rem', marginBottom: '0.75rem' },
  heroTitle: { fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary, #1a1a2e)' },
  heroSubtitle: { fontSize: '1.05rem', color: 'var(--text-secondary, #555)', maxWidth: '600px', margin: '0 auto' },
  section: { padding: '2rem 0', borderBottom: '1px solid var(--border-color, #e0e0e0)' },
  highlight: { background: 'var(--surface-secondary, #f8f9fa)', margin: '0 -1.5rem', padding: '2rem 1.5rem', borderRadius: '12px' },
  h2: { fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--text-primary, #1a1a2e)' },
  h3: { fontSize: '1.05rem', fontWeight: 600, margin: '1.25rem 0 0.5rem', color: 'var(--text-primary, #1a1a2e)' },
  p: { fontSize: '0.95rem', color: 'var(--text-secondary, #555)', margin: '0 0 1rem', lineHeight: 1.6 },
  infoCard: { background: 'var(--surface-card, #fff)', border: '1px solid var(--border-color, #e0e0e0)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', flexWrap: 'wrap', gap: '0.5rem' },
  infoLabel: { fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary, #1a1a2e)' },
  infoValue: { fontSize: '0.85rem', color: 'var(--text-secondary, #666)' },
  code: { fontSize: '0.82rem', background: 'var(--surface-secondary, #f0f0f0)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', color: 'var(--pink-primary, #d81b60)' },
  endpointList: { display: 'flex', flexDirection: 'column', gap: '0' },
  endpointRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.05))', flexWrap: 'wrap' },
  method: { fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', minWidth: '48px', textAlign: 'center' },
  endpointPath: { fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-primary, #1a1a2e)', minWidth: '160px' },
  endpointDesc: { fontSize: '0.82rem', color: 'var(--text-secondary, #888)' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' },
  card: { background: 'var(--surface-card, #fff)', border: '1px solid var(--border-color, #e0e0e0)', borderRadius: '10px', padding: '1.25rem' },
  cardTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem', color: 'var(--text-primary, #1a1a2e)' },
  cardDesc: { fontSize: '0.85rem', color: 'var(--text-secondary, #666)', margin: '0 0 0.5rem', lineHeight: 1.5 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  link: { fontSize: '0.8rem', color: 'var(--pink-primary, #d81b60)', textDecoration: 'none', wordBreak: 'break-all' },
  license: { fontSize: '0.7rem', background: 'var(--surface-secondary, #f0f0f0)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary, #888)' },
  statusBadge: { display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16,185,129,0.1)', color: '#059669' },
  emailBtn: { display: 'inline-block', padding: '10px 24px', background: 'var(--pink-primary, #d81b60)', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', margin: '0.5rem 0' },
};
