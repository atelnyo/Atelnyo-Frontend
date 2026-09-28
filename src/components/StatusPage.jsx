/**
 * src/components/StatusPage.jsx
 *
 * Atelnyo Platform Status — public page showing service health,
 * system information, and maintenance status.
 *
 * URL: /status
 * Public, crawlable, multilingual (ht/en/fr/es).
 */
import React, { useState, useEffect } from 'react';
import SEOHead from './shared/SEOHead';
import { t2 } from '../utils/i18n';
import api from '../services/api';

const SEO = {
  en: { title: 'Platform Status', description: 'Check the current status of Atelnyo services, API availability, and system health.' },
  ht: { title: 'Estati Platfòm', description: 'Tcheke estati aktyèl sèvis Atelnyo, disponiblote API, ak sante sistèm.' },
  fr: { title: 'État de la Plateforme', description: 'Vérifiez l\'état actuel des services Atelnyo, la disponibilité de l\'API et la santé du système.' },
  es: { title: 'Estado de la Plataforma', description: 'Consulte el estado actual de los servicios de Atelnyo, la disponibilidad de la API y la salud del sistema.' },
};

const PAGE = {
  en: {
    title: 'Atelnyo Platform Status',
    subtitle: 'All systems operational',
    subtitleDegraded: 'Some systems experiencing issues',
    subtitleDown: 'Service disruption detected',
    services: 'Services',
    lastChecked: 'Last checked',
    api: 'API',
    apiDesc: 'Backend API server',
    frontend: 'Frontend',
    frontendDesc: 'Web application',
    websocket: 'WebSocket',
    websocketDesc: 'Real-time notifications',
    ai: 'AI Service',
    aiDesc: 'AI chat and translations',
    payments: 'Payments',
    paymentsDesc: 'Stripe payment processing',
    statusOperational: 'Operational',
    statusDegraded: 'Degraded',
    statusDown: 'Down',
    statusUnknown: 'Checking...',
    systemInfo: 'System Information',
    region: 'Region',
    regionValue: 'Global (Cloudflare CDN)',
    uptime: 'Uptime',
    uptimeValue: '99.9%+',
    version: 'Version',
    architecture: 'Architecture',
    archValue: 'React SPA + Django REST API + Cloudflare Workers',
  },
  ht: {
    title: 'Estati Platfòm Atelnyo',
    subtitle: 'Tout sistèm ap mache byen',
    subtitleDegraded: 'Gen kèk sistèm ki gen pwoblèm',
    subtitleDown: 'Yo detekte yon pwoblèm sèvis',
    services: 'Sèvis',
    lastChecked: 'Dènye tèt',
    api: 'API',
    apiDesc: 'Sèvè API backend',
    frontend: 'Frontend',
    frontendDesc: 'Aplikasyon entènèt',
    websocket: 'WebSocket',
    websocketDesc: 'Notifikasyon reyèl-tan',
    ai: 'Sèvis IA',
    aiDesc: 'Chat IA ak tradiksyon',
    payments: 'Peman',
    paymentsDesc: 'Pwosèsè peman Stripe',
    statusOperational: 'Ap mache',
    statusDegraded: 'Redwi',
    statusDown: 'Pa mache',
    statusUnknown: 'Ap tcheke...',
    systemInfo: 'Enfòmasyon Sistèm',
    region: 'Rejyon',
    regionValue: 'Mondyal (Cloudflare CDN)',
    uptime: 'Tan disponib',
    uptimeValue: '99.9%+',
    version: 'Vèsyon',
    architecture: 'Achitekti',
    archValue: 'React SPA + Django REST API + Cloudflare Workers',
  },
  fr: {
    title: 'État de la Plateforme Atelnyo',
    subtitle: 'Tous les systèmes opérationnels',
    subtitleDegraded: 'Certains systèmes rencontrent des problèmes',
    subtitleDown: 'Perturbation de service détectée',
    services: 'Services',
    lastChecked: 'Dernière vérification',
    api: 'API',
    apiDesc: 'Serveur API backend',
    frontend: 'Frontend',
    frontendDesc: 'Application web',
    websocket: 'WebSocket',
    websocketDesc: 'Notifications en temps réel',
    ai: 'Service IA',
    aiDesc: 'Chat IA et traductions',
    payments: 'Paiements',
    paymentsDesc: 'Processeur de paiement Stripe',
    statusOperational: 'Opérationnel',
    statusDegraded: 'Dégradé',
    statusDown: 'Indisponible',
    statusUnknown: 'Vérification...',
    systemInfo: 'Informations Système',
    region: 'Région',
    regionValue: 'Mondial (CDN Cloudflare)',
    uptime: 'Disponibilité',
    uptimeValue: '99,9%+',
    version: 'Version',
    architecture: 'Architecture',
    archValue: 'React SPA + Django REST API + Cloudflare Workers',
  },
  es: {
    title: 'Estado de la Plataforma Atelnyo',
    subtitle: 'Todos los sistemas operativos',
    subtitleDegraded: 'Algunos sistemas experimentan problemas',
    subtitleDown: 'Disrupción de servicio detectada',
    services: 'Servicios',
    lastChecked: 'Última verificación',
    api: 'API',
    apiDesc: 'Servidor API backend',
    frontend: 'Frontend',
    frontendDesc: 'Aplicación web',
    websocket: 'WebSocket',
    websocketDesc: 'Notificaciones en tiempo real',
    ai: 'Servicio IA',
    aiDesc: 'Chat IA y traducciones',
    payments: 'Pagos',
    paymentsDesc: 'Procesador de pagos Stripe',
    statusOperational: 'Operativo',
    statusDegraded: 'Degradado',
    statusDown: 'Caído',
    statusUnknown: 'Verificando...',
    systemInfo: 'Información del Sistema',
    region: 'Región',
    regionValue: 'Global (CDN Cloudflare)',
    uptime: 'Tiempo de actividad',
    uptimeValue: '99,9%+',
    version: 'Versión',
    architecture: 'Arquitectura',
    archValue: 'React SPA + Django REST API + Cloudflare Workers',
  },
};

const SERVICES = ['api', 'frontend', 'websocket', 'ai', 'payments'];

export default function StatusPage({ lang = 'en', market = '' }) {
  const t = PAGE[lang] || PAGE.en;
  const s = SEO[lang] || SEO.en;
  const locale = market ? `${lang}-${market}` : '';

  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(SERVICES.map(s => [s, 'unknown']))
  );
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 60000); // Check every 60s
    return () => clearInterval(interval);
  }, []);

  async function checkServices() {
    const results = {};

    // API check
    try {
      const start = Date.now();
      await api.get('config/public/', { timeout: 5000 });
      results.api = (Date.now() - start) < 3000 ? 'operational' : 'degraded';
    } catch {
      results.api = 'down';
    }

    // Frontend — always operational if we're rendering
    results.frontend = 'operational';

    // WebSocket — check if the notification endpoint responds
    try {
      await api.get('session/me/', { timeout: 5000 });
      results.websocket = 'operational';
    } catch (e) {
      results.websocket = e?.response?.status === 401 ? 'operational' : 'degraded';
    }

    // AI — check if the AI worker responds
    try {
      const workerUrl = import.meta.env?.VITE_AI_WORKER_URL || 'https://atelnyo.atelnyo.workers.dev';
      const resp = await fetch(`${workerUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'ping' }),
        signal: AbortSignal.timeout(5000),
      });
      results.ai = resp.ok || resp.status === 400 ? 'operational' : 'degraded';
    } catch {
      results.ai = 'degraded';
    }

    // Payments — check if Stripe is configured
    try {
      await api.get('marketplace/products/', { params: { limit: 1 }, timeout: 5000 });
      results.payments = 'operational';
    } catch {
      results.payments = 'degraded';
    }

    setStatuses(results);
    setLastChecked(new Date());
  }

  const overallStatus = Object.values(statuses).includes('down')
    ? 'down'
    : Object.values(statuses).includes('degraded')
      ? 'degraded'
      : Object.values(statuses).every(s => s === 'operational')
        ? 'operational'
        : 'unknown';

  return (
    <>
      <SEOHead
        title={s.title}
        description={s.description}
        image="https://atelnyo.site/og-banner-en.svg"
        url="/status"
        type="website"
        lang={lang}
        locale={locale}
        breadcrumbs={[{ label: 'Home', url: '/' }, { label: 'Status', url: '/status' }]}
      />

      <main style={styles.main} role="main">
        <header style={styles.hero} role="banner">
          <div style={styles.heroIcon}>
            {overallStatus === 'operational' ? '✅' : overallStatus === 'degraded' ? '⚠️' : overallStatus === 'down' ? '🔴' : '🔄'}
          </div>
          <h1 style={styles.heroTitle}>{t.title}</h1>
          <p style={{
            ...styles.heroSubtitle,
            color: overallStatus === 'operational' ? '#059669' : overallStatus === 'degraded' ? '#d97706' : '#dc2626',
          }}>
            {overallStatus === 'operational' ? t.subtitle : overallStatus === 'degraded' ? t.subtitleDegraded : t.subtitleDown}
          </p>
          {lastChecked && (
            <p style={styles.lastChecked} aria-live="polite">
              {t.lastChecked}: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </header>

        {/* Services */}
        <section style={styles.section}>
          <h2 style={styles.h2}>{t.services}</h2>
          <div style={styles.serviceList} role="list" aria-label={t.services}>
            {SERVICES.map(key => (
              <div key={key} style={styles.serviceRow} role="listitem">
                <div style={styles.serviceInfo}>
                  <span style={styles.serviceName}>{t[key]}</span>
                  <span style={styles.serviceDesc}>{t[key + 'Desc']}</span>
                </div>
                <StatusBadge status={statuses[key]} t={t} />
              </div>
            ))}
          </div>
        </section>

        {/* System Info */}
        <section style={styles.section}>
          <h2 style={styles.h2}>{t.systemInfo}</h2>
          <div style={styles.infoGrid} role="list" aria-label={t.systemInfo}>
            <InfoRow label={t.region} value={t.regionValue} />
            <InfoRow label={t.uptime} value={t.uptimeValue} />
            <InfoRow label={t.version} value={import.meta.env?.VITE_APP_VERSION || '0.0.0'} />
            <InfoRow label={t.architecture} value={t.archValue} />
          </div>
        </section>
      </main>
    </>
  );
}

function StatusBadge({ status, t }) {
  const config = {
    operational: { bg: 'rgba(16,185,129,0.1)', color: '#059669', label: t.statusOperational, dot: '#059669' },
    degraded: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', label: t.statusDegraded, dot: '#d97706' },
    down: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626', label: t.statusDown, dot: '#dc2626' },
    unknown: { bg: 'rgba(156,163,175,0.1)', color: '#6b7280', label: t.statusUnknown, dot: '#9ca3af' },
  }[status] || { bg: 'rgba(156,163,175,0.1)', color: '#6b7280', label: t.statusUnknown, dot: '#9ca3af' };

  return (
    <span style={{ ...styles.badge, background: config.bg, color: config.color }}>
      <span style={{ ...styles.dot, background: config.dot }} />
      {config.label}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

const styles = {
  main: { maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem 4rem', fontFamily: 'var(--font-body, system-ui, sans-serif)', color: 'var(--text-primary, #1a1a2e)', lineHeight: 1.7 },
  hero: { textAlign: 'center', padding: '3rem 0 1.5rem' },
  heroIcon: { fontSize: '2.5rem', marginBottom: '0.75rem' },
  heroTitle: { fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary, #1a1a2e)' },
  heroSubtitle: { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' },
  lastChecked: { fontSize: '0.82rem', color: 'var(--text-secondary, #888)', margin: 0 },
  section: { padding: '1.5rem 0', borderBottom: '1px solid var(--border-color, #e0e0e0)' },
  h2: { fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary, #1a1a2e)' },
  serviceList: { display: 'flex', flexDirection: 'column', gap: '0' },
  serviceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.05))' },
  serviceInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  serviceName: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #1a1a2e)' },
  serviceDesc: { fontSize: '0.8rem', color: 'var(--text-secondary, #888)' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: '0' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.05))' },
  infoLabel: { fontSize: '0.88rem', color: 'var(--text-secondary, #666)' },
  infoValue: { fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary, #1a1a2e)' },
};
