/**
 * src/components/TrustCenter.jsx
 *
 * Atelnyo Trust Center — official page consolidating trust signals:
 * security, privacy, accessibility, browser compatibility, PWA info,
 * data controls, and contact.
 *
 * URL: /trust
 * Public, crawlable, multilingual (ht/en/fr/es).
 */
import React from 'react';
import SEOHead from './shared/SEOHead';
import { t2 } from '../utils/i18n';

const SEO = {
  en: {
    title: 'Trust Center — Security, Privacy & Accessibility',
    description: 'Atelnyo Trust Center: learn about our security practices, privacy policies, accessibility commitment, browser compatibility, and how we protect your data.',
  },
  ht: {
    title: 'San Konfyans — Sekirite, Vie Prive & Aksesibilite',
    description: 'San Konfyans Atelnyo: aprann sou pratik sekirite nou, politik vie prive nou, angajman aksesibilite nou, ak konpatibilite navigatè.',
  },
  fr: {
    title: 'Centre de Confiance — Sécurité, Confidentialité & Accessibilité',
    description: 'Centre de confiance Atelnyo : découvrez nos pratiques de sécurité, politiques de confidentialité, engagement en matière d\'accessibilité et compatibilité navigateur.',
  },
  es: {
    title: 'Centro de Confianza — Seguridad, Privacidad y Accesibilidad',
    description: 'Centro de confianza de Atelnyo: conozca nuestras prácticas de seguridad, políticas de privacidad, compromiso de accesibilidad y compatibilidad con navegadores.',
  },
};

const PAGE = {
  en: {
    heroTitle: 'Atelnyo Trust Center',
    heroSubtitle: 'Transparency, Security & User Protection',
    heroDesc: 'Atelnyo is built on trust. This page explains how we protect your data, secure our platform, respect your privacy, and maintain accessibility for all users.',

    securityTitle: 'Security',
    securityItems: [
      { heading: 'Transport Encryption', text: 'All connections to Atelnyo use HTTPS (TLS 1.2+). Data in transit is encrypted between your device and our servers.' },
      { heading: 'Authentication', text: 'Atelnyo supports JWT-based authentication with automatic token rotation, optional two-factor authentication (TOTP), and passkey (WebAuthn) support.' },
      { heading: 'Session Management', text: 'Access tokens expire after 15 minutes and are automatically refreshed. Sessions can be revoked from any device. Suspicious activity triggers session invalidation.' },
      { heading: 'Rate Limiting', text: 'API endpoints are protected by rate limiting to prevent abuse, brute-force attacks, and automated scraping.' },
      { heading: 'Content Security', text: 'We implement Content Security Policy (CSP) headers, X-Content-Type-Options, X-Frame-Options, and other security headers to protect against XSS, clickjacking, and MIME sniffing attacks.' },
      { heading: 'Admin Controls', text: 'Administrative access is protected by role-based permissions, IP restrictions, and audit logging. Staff actions are tracked and reviewed.' },
      { heading: 'Payment Security', text: 'E-commerce transactions are processed through Stripe, a PCI DSS Level 1 certified payment processor. Atelnyo never stores raw credit card numbers.' },
      { heading: 'Error Monitoring', text: 'We use Sentry for error monitoring with PII (personally identifiable information) suppression enabled. No personal data is sent to monitoring services.' },
    ],

    privacyTitle: 'Privacy',
    privacyItems: [
      { heading: 'Data Collection', text: 'Atelnyo collects only the data necessary to operate the platform: account information (email, username), course progress, and usage analytics. We do not collect data merely because it is technically possible.' },
      { heading: 'No Data Sales', text: 'User data is never sold to third parties. We do not share personal information with advertisers or data brokers.' },
      { heading: 'Data Storage', text: 'Data is stored on secure servers with encryption at rest. Database access is restricted to authorized personnel only.' },
      { heading: 'Data Retention', text: 'Account data is retained while your account is active. You can delete your account at any time from Settings, which permanently removes your personal data.' },
      { heading: 'Analytics', text: 'We use privacy-respecting analytics to understand how the platform is used. Analytics data is aggregated and does not identify individual users.' },
      { heading: 'Third-Party Services', text: 'We use established third-party services (Stripe for payments, Firebase for notifications, Cloudflare for hosting). Each service has its own privacy policy. We do not authorize these services to use your data for their own purposes.' },
      { heading: 'Your Controls', text: 'You can access, export, and delete your data from the Settings page. You can revoke any granted permissions at any time.' },
      { heading: 'GDPR Compliance', text: 'Atelnyo complies with GDPR requirements for users in the European Union. You have the right to access, rectify, port, and erase your personal data.' },
    ],

    accessibilityTitle: 'Accessibility',
    accessibilityItems: [
      { heading: 'Semantic HTML', text: 'Atelnyo uses semantic HTML elements (header, main, nav, footer, article) to provide meaningful structure for assistive technologies.' },
      { heading: 'Keyboard Navigation', text: 'All interactive elements are accessible via keyboard. Tab order follows logical content flow. Focus indicators are visible on all focusable elements.' },
      { heading: 'Screen Reader Support', text: 'ARIA labels, roles, and live regions are used where semantic HTML alone is insufficient. Decorative icons are marked aria-hidden.' },
      { heading: 'Color Contrast', text: 'Our design system uses CSS custom properties with sufficient color contrast ratios. Multiple theme modes (light, dark, AMOLED, high-contrast) accommodate different visual needs.' },
      { heading: 'Reduced Motion', text: 'Atelnyo respects the prefers-reduced-motion media query. Animations and transitions are automatically disabled for users who have indicated a preference for reduced motion.' },
      { heading: 'Responsive Design', text: 'The platform is fully responsive and works on screen sizes from 320px mobile to large desktop displays. Touch targets meet minimum size requirements.' },
      { heading: 'Skip Navigation', text: 'A "Skip to content" link is available for keyboard users to bypass navigation and go directly to the main content.' },
      { heading: 'Accessible Forms', text: 'Form inputs use associated labels, error messages are announced to screen readers, and required fields are clearly indicated.' },
    ],

    browserTitle: 'Browser Compatibility',
    browserDesc: 'Atelnyo is designed as a progressive web application that works across modern browsers.',
    browsers: [
      { name: 'Google Chrome', support: 'Full support', notes: 'PWA install, all features' },
      { name: 'Microsoft Edge', support: 'Full support', notes: 'PWA install, all features' },
      { name: 'Mozilla Firefox', support: 'Core support', notes: 'All core features; PWA install via browser menu' },
      { name: 'Apple Safari', support: 'Core support', notes: 'Core features; PWA via Add to Home Screen' },
      { name: 'Samsung Internet', support: 'Full support', notes: 'PWA install, all features' },
    ],
    enhancedTitle: 'Enhanced Features (browser-dependent)',
    enhanced: [
      { feature: 'PWA Installation', browsers: 'Chrome, Edge, Samsung Internet (native prompt); Safari, Firefox (manual instructions)' },
      { feature: 'Offline Mode', browsers: 'All modern browsers with Service Worker support' },
      { feature: 'File System Access', browsers: 'Chrome, Edge only' },
      { feature: 'Web Share API', browsers: 'Chrome, Safari, Edge' },
      { feature: 'Push Notifications', browsers: 'Chrome, Edge, Firefox, Safari (via Firebase Cloud Messaging)' },
      { feature: 'Wake Lock', browsers: 'Chrome, Edge, Safari' },
      { feature: 'WebAuthn (Passkeys)', browsers: 'Chrome, Edge, Safari' },
    ],

    dataTitle: 'Your Data Controls',
    dataItems: [
      { heading: 'Account Settings', text: 'Update your profile, email, and preferences from the Settings page.' },
      { heading: 'Data Export', text: 'Request a copy of your data from the Settings page.' },
      { heading: 'Account Deletion', text: 'Permanently delete your account and all associated data from Settings → Account → Delete Account. This action is irreversible.' },
      { heading: 'Permission Management', text: 'Revoke camera, microphone, notification, or storage permissions at any time from your browser settings or the Atelnyo Settings page.' },
      { heading: 'Notification Preferences', text: 'Control which notifications you receive from the Settings → Notifications page.' },
    ],

    contactTitle: 'Contact & Support',
    contactItems: [
      { heading: 'General Support', text: 'Email: support@atelnyo.site' },
      { heading: 'Privacy Inquiries', text: 'Email: privacy@atelnyo.site' },
      { heading: 'Security Reports', text: 'If you discover a security vulnerability, please report it responsibly to: security@atelnyo.site' },
      { heading: 'Accessibility Feedback', text: 'We welcome accessibility feedback. Email: accessibility@atelnyo.site' },
    ],
  },

  ht: {
    heroTitle: 'San Konfyans Atelnyo',
    heroSubtitle: 'Transparans, Sekirite & Pwoteksyon Itilizatè',
    heroDesc: 'Atelnyo bati sou konfyans. Paj sa a eksplike kijan nou pwoteje done ou, sekirite platfòm nou, respekte vie prive nou, ak kenbe aksesibilite pou tout itilizatè.',

    securityTitle: 'Sekirite',
    securityItems: [
      { heading: 'Chifreman Transport', text: 'Tout koneksyon nan Atelnyo itilize HTTPS (TLS 1.2+). Done an transi chifre ant aparèy ou ak sèvè nou.' },
      { heading: 'Otentifikasyon', text: 'Atelnyo sipòte otentifikasyon ki bati sou JWT ak rotasyon token otomatik, otentifikasyon faktè de (TOTP) opsyonèl, ak sipò passkey (WebAuthn).' },
      { heading: 'Jesyon Sesyon', text: 'Access token ekspire apre 15 minit epi refreshe otomatikman. Sesyon ka revoke depi nenpòt aparèy.' },
      { heading: 'Limit To', text: 'API yo pwoteje pa limit to pou anpeche abi, atak br-force, ak scraping otomatik.' },
      { heading: 'Sekirite Peman', text: 'Tranzaksyon e-commerce trese atravè Stripe, yon procesè peman ki gen sètifikasyon PCI DSS Level 1. Atelnyo pa janm estoke nimewo kat kredi bri.' },
    ],

    privacyTitle: 'Vie Prive',
    privacyItems: [
      { heading: 'Koleksyon Done', text: 'Atelnyo ranmase sèlman done ki nesesè pou opere platfòm la: enfòmasyon kompt (imèl, non itilizatè), pwogrè kou, ak analitik itilizasyon.' },
      { heading: 'Pa Vann Done', text: 'Done itilizatè pa janm vann nan twazyèm pati. Pa janm pataje enfòmasyon pèsonèl ak reklamè oswa brokè done.' },
      { heading: 'Kontwòl Ou', text: 'Ou ka akses, ekspòte, efase done ou depi paj Settings. Ou ka revoke nenpòt pèmisyon ba nenpòt lè.' },
      { heading: 'Konfòmite GDPR', text: 'Atelnyo konfòm ak rezilta GDPR pou itilizatè nan Inyon Ewopeyen an. Ou gen dwa akses, rectify, pòte, ak efase done pèsonèl ou.' },
    ],

    accessibilityTitle: 'Aksesibilite',
    accessibilityItems: [
      { heading: 'HTML Semantik', text: 'Atelnyo itilize eleman HTML semantik (header, main, nav, footer) pou bay estrikti siyifikatif pou teknoloji asistif.' },
      { heading: 'Navigasyon ak Kle', text: 'Tout eleman entèraktif aksesib avèk kle. Lòd tab swiv flòks kontni lojik.' },
      { heading: 'Sipò Lecteur Ekran', text: 'ARIA labels, wòl, ak viv rejion yo itilize lè HTML semantik pou kont pa ensifisan.' },
      { heading: 'Mòd Redui Motion', text: 'Atelnyo respekte media query prefers-reduced-motion. Animasyon yo disable otomatikman.' },
    ],

    browserTitle: 'Konpatibilite Navigatè',
    browserDesc: 'Atelnyo fèt kòm yon aplikasyon entènèt pwogresif ki travay atravè navigatè modèn.',
    browsers: [
      { name: 'Google Chrome', support: 'Sipò total', notes: 'Enstalasyon PWA, tout fonksyonalite' },
      { name: 'Microsoft Edge', support: 'Sipò total', notes: 'Enstalasyon PWA, tout fonksyonalite' },
      { name: 'Mozilla Firefox', support: 'Sipò kot', notes: 'Tout fonksyonalite kot; enstalasyon PWA via meni navigatè' },
      { name: 'Apple Safari', support: 'Sipò kot', notes: 'Fonksyonalite kot; PWA via Ajoute nan Ekran Akèy' },
      { name: 'Samsung Internet', support: 'Sipò total', notes: 'Enstalasyon PWA, tout fonksyonalite' },
    ],
    enhancedTitle: 'Fonksyonalite Avanse (depann navigatè)',
    enhanced: [
      { feature: 'Enstalasyon PWA', browsers: 'Chrome, Edge, Samsung Internet (prompt natif); Safari, Firefox (enstriksyon manyèl)' },
      { feature: 'Mòd Offline', browsers: 'Tout navigatè modèn ak sipò Service Worker' },
      { feature: 'Pataje Web', browsers: 'Chrome, Safari, Edge' },
      { feature: 'Notifikasyon', browsers: 'Chrome, Edge, Firefox, Safari (via Firebase Cloud Messaging)' },
    ],

    dataTitle: 'Kontwòl Done Ou',
    dataItems: [
      { heading: 'Konfigirasyon Kompt', text: 'Majou pwofil ou, imèl, ak preferans yo depi paj Settings.' },
      { heading: 'Efase Kompt', text: 'Efase pèmanman kompt ou ak tout done asosye yo depi Settings → Kompt → Efase Kompt.' },
    ],

    contactTitle: 'Kontak & Sipò',
    contactItems: [
      { heading: 'Sipò Jeneral', text: 'Imèl: support@atelnyo.site' },
      { heading: 'Enviztasyon Vie Prive', text: 'Imèl: privacy@atelnyo.site' },
      { heading: 'Rapò Sekirite', text: 'Si ou dekouvri yon vagabondaj sekirite, rapòte li responsab nan: security@atelnyo.site' },
    ],
  },
};

export default function TrustCenter({ lang = 'en', market = '' }) {
  const t = PAGE[lang] || PAGE.en;
  const s = SEO[lang] || SEO.en;
  const locale = market ? `${lang}-${market}` : '';

  return (
    <>
      <SEOHead
        title={s.title}
        description={s.description}
        image="https://atelnyo.site/og-banner-en.svg"
        url="/trust"
        type="website"
        lang={lang}
        locale={locale}
        breadcrumbs={[{ label: 'Home', url: '/' }, { label: 'Trust Center', url: '/trust' }]}
      />

      <main style={styles.main} role="main">
        {/* Hero */}
        <header style={styles.hero}>
          <div style={styles.heroIcon}>🛡️</div>
          <h1 style={styles.heroTitle}>{t.heroTitle}</h1>
          <p style={styles.heroSubtitle}>{t.heroSubtitle}</p>
          <p style={styles.heroDesc}>{t.heroDesc}</p>
        </header>

        {/* Security */}
        <Section title={t.securityTitle} icon="🔒">
          {t.securityItems.map((item, i) => (
            <Card key={i} heading={item.heading} text={item.text} />
          ))}
        </Section>

        {/* Privacy */}
        <Section title={t.privacyTitle} icon="👁️">
          {t.privacyItems.map((item, i) => (
            <Card key={i} heading={item.heading} text={item.text} />
          ))}
        </Section>

        {/* Accessibility */}
        <Section title={t.accessibilityTitle} icon="♿">
          {t.accessibilityItems.map((item, i) => (
            <Card key={i} heading={item.heading} text={item.text} />
          ))}
        </Section>

        {/* Browser Compatibility */}
        <Section title={t.browserTitle} icon="🌐">
          <p style={styles.sectionDesc}>{t.browserDesc}</p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{lang === 'ht' ? 'Navigatè' : 'Browser'}</th>
                <th style={styles.th}>{lang === 'ht' ? 'Estati' : 'Support'}</th>
                <th style={styles.th}>{lang === 'ht' ? 'Nòt' : 'Notes'}</th>
              </tr>
            </thead>
            <tbody>
              {t.browsers.map((b, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{b.name}</td>
                  <td style={styles.td}><span style={{ ...styles.badge, ...styles.badgeGreen }}>{b.support}</span></td>
                  <td style={styles.td}>{b.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={styles.h3}>{t.enhancedTitle}</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{lang === 'ht' ? 'Fonksyonalite' : 'Feature'}</th>
                <th style={styles.th}>{lang === 'ht' ? 'Navigatè' : 'Browsers'}</th>
              </tr>
            </thead>
            <tbody>
              {t.enhanced.map((e, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{e.feature}</td>
                  <td style={styles.td}>{e.browsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Data Controls */}
        <Section title={t.dataTitle} icon="⚙️">
          {t.dataItems.map((item, i) => (
            <Card key={i} heading={item.heading} text={item.text} />
          ))}
        </Section>

        {/* Contact */}
        <Section title={t.contactTitle} icon="📧">
          {t.contactItems.map((item, i) => (
            <Card key={i} heading={item.heading} text={item.text} />
          ))}
        </Section>
      </main>
    </>
  );
}

function Section({ title, icon, children }) {
  return (
    <section style={styles.section} aria-labelledby={title.replace(/\s+/g, '-').toLowerCase()}>
      <h2 style={styles.h2}>{icon} {title}</h2>
      {children}
    </section>
  );
}

function Card({ heading, text }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardH3}>{heading}</h3>
      <p style={styles.cardP}>{text}</p>
    </div>
  );
}

const styles = {
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    color: 'var(--text-primary, #1a1a2e)',
    lineHeight: 1.7,
  },
  hero: {
    textAlign: 'center',
    padding: '3rem 0 2rem',
  },
  heroIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  heroTitle: {
    fontSize: '2.2rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  heroSubtitle: {
    fontSize: '1.2rem',
    fontWeight: 500,
    color: 'var(--pink-primary, #d81b60)',
    margin: '0 0 1rem',
  },
  heroDesc: {
    fontSize: '1rem',
    color: 'var(--text-secondary, #555)',
    maxWidth: '700px',
    margin: '0 auto',
  },
  section: {
    padding: '2rem 0',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },
  sectionDesc: {
    fontSize: '1rem',
    color: 'var(--text-secondary, #555)',
    marginBottom: '1rem',
  },
  h2: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 1.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  h3: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: '1.5rem 0 0.75rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  card: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '12px',
    padding: '1.25rem',
    marginBottom: '0.75rem',
  },
  cardH3: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 0.4rem',
    color: 'var(--pink-primary, #d81b60)',
  },
  cardP: {
    fontSize: '0.92rem',
    margin: 0,
    color: 'var(--text-secondary, #555)',
    lineHeight: 1.6,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '1rem 0',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    borderBottom: '2px solid var(--border-color, #e0e0e0)',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a2e)',
  },
  td: {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
    color: 'var(--text-secondary, #555)',
  },
  trEven: { background: 'transparent' },
  trOdd: { background: 'var(--surface-secondary, #f8f9fa)' },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  badgeGreen: {
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#059669',
  },
};
