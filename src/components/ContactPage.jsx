/**
 * src/components/ContactPage.jsx
 *
 * Atelnyo Official Contact Page.
 * URL: /contact
 * Public, crawlable, multilingual (ht/en/fr/es).
 */
import React, { useState } from 'react';
import SEOHead from './shared/SEOHead';
import { t2 } from '../utils/i18n';

const SEO = {
  en: { title: 'Contact Us', description: 'Get in touch with Atelnyo support. We respond to all inquiries about courses, accounts, privacy, security, and general questions.' },
  ht: { title: 'Kontakte Nou', description: 'Kontakte sipò Atelnyo. Nou reponn tout kesyon sou kou, kompt, vie prive, sekirite, ak kesyon jeneral.' },
  fr: { title: 'Contactez-nous', description: 'Contactez le support Atelnyo. Nous répondons à toutes les demandes concernant les cours, les comptes, la confidentialité et la sécurité.' },
  es: { title: 'Contáctenos', description: 'Ponte en contacto con el soporte de Atelnyo. Respondemos todas las consultas sobre cursos, cuentas, privacidad y seguridad.' },
};

const PAGE = {
  en: {
    heroTitle: 'Contact Atelnyo',
    heroDesc: 'We\'re here to help. Reach out to us for support, questions, or feedback.',
    generalTitle: 'General Support',
    generalDesc: 'For questions about your account, courses, payments, or general platform inquiries.',
    generalEmail: 'support@atelnyo.site',
    privacyTitle: 'Privacy & Data',
    privacyDesc: 'For questions about your personal data, privacy policy, GDPR requests, or data deletion.',
    privacyEmail: 'privacy@atelnyo.site',
    securityTitle: 'Security Reports',
    securityDesc: 'If you discover a security vulnerability, please report it responsibly. We take all security reports seriously.',
    securityEmail: 'security@atelnyo.site',
    accessibilityTitle: 'Accessibility Feedback',
    accessibilityDesc: 'We welcome feedback on accessibility. Help us make Atelnyo better for everyone.',
    accessibilityEmail: 'accessibility@atelnyo.site',
    responseNote: 'We aim to respond within 48 hours during business days.',
    socialTitle: 'Follow Us',
  },
  ht: {
    heroTitle: 'Kontakte Atelnyo',
    heroDesc: 'Nou la pou ede ou. Kontakte nou pou sipò, kesyon, oswa fidbak.',
    generalTitle: 'Sipò Jeneral',
    generalDesc: 'Pou kesyon sou kompt ou, kou, peman, oswa kesyon jeneral sou platfòm la.',
    generalEmail: 'support@atelnyo.site',
    privacyTitle: 'Vie Prive & Done',
    privacyDesc: 'Pou kesyon sou done pèsonèl ou, politik vie prive, demann GDPR, oswa efase done.',
    privacyEmail: 'privacy@atelnyo.site',
    securityTitle: 'Rapò Sekirite',
    securityDesc: 'Si ou dekouvri yon vagabondaj sekirite, rapòte li responsab.',
    securityEmail: 'security@atelnyo.site',
    accessibilityTitle: 'Fidbak Aksesibilite',
    accessibilityDesc: 'Nou akeyi fidbak sou aksesibilite. Ede nou fè Atelnyo pi bon pou tout moun.',
    accessibilityEmail: 'accessibility@atelnyo.site',
    responseNote: 'Nou vle reponn nan 48 èdtan pandan jou biznis.',
    socialTitle: 'Siyvi Nou',
  },
  fr: {
    heroTitle: 'Contactez Atelnyo',
    heroDesc: 'Nous sommes là pour vous aider. Contactez-nous pour du support, des questions ou des retours.',
    generalTitle: 'Support Général',
    generalDesc: 'Pour des questions sur votre compte, vos cours, vos paiements ou des demandes générales.',
    generalEmail: 'support@atelnyo.site',
    privacyTitle: 'Confidentialité & Données',
    privacyDesc: 'Pour des questions sur vos données personnelles, la politique de confidentialité, les demandes RGPD.',
    privacyEmail: 'privacy@atelnyo.site',
    securityTitle: 'Rapports de Sécurité',
    securityDesc: 'Si vous découvrez une vulnérabilité de sécurité, veuillez la signaler de manière responsable.',
    securityEmail: 'security@atelnyo.site',
    accessibilityTitle: 'Retours Accessibilité',
    accessibilityDesc: 'Nous accueillons les retours sur l\'accessibilité. Aidez-nous à améliorer Atelnyo pour tous.',
    accessibilityEmail: 'accessibility@atelnyo.site',
    responseNote: 'Nous visons une réponse sous 48 heures pendant les jours ouvrables.',
    socialTitle: 'Suivez-nous',
  },
  es: {
    heroTitle: 'Contáctenos',
    heroDesc: 'Estamos aquí para ayudarle. Contáctenos para soporte, preguntas o comentarios.',
    generalTitle: 'Soporte General',
    generalDesc: 'Para preguntas sobre su cuenta, cursos, pagos o consultas generales de la plataforma.',
    generalEmail: 'support@atelnyo.site',
    privacyTitle: 'Privacidad y Datos',
    privacyDesc: 'Para preguntas sobre sus datos personales, política de privacidad, solicitudes RGPD.',
    privacyEmail: 'privacy@atelnyo.site',
    securityTitle: 'Reportes de Seguridad',
    securityDesc: 'Si descubre una vulnerabilidad de seguridad, repórtela de manera responsable.',
    securityEmail: 'security@atelnyo.site',
    accessibilityTitle: 'Comentarios de Accesibilidad',
    accessibilityDesc: 'Agradecemos los comentarios sobre accesibilidad. Ayúdenos a mejorar Atelnyo para todos.',
    accessibilityEmail: 'accessibility@atelnyo.site',
    responseNote: 'Nuestro objetivo es responder dentro de 48 horas en días hábiles.',
    socialTitle: 'Síguenos',
  },
};

export default function ContactPage({ lang = 'en', market = '' }) {
  const t = PAGE[lang] || PAGE.en;
  const s = SEO[lang] || SEO.en;
  const locale = market ? `${lang}-${market}` : '';

  return (
    <>
      <SEOHead
        title={s.title}
        description={s.description}
        image="https://atelnyo.site/og-banner-en.svg"
        url="/contact"
        type="website"
        lang={lang}
        locale={locale}
        breadcrumbs={[{ label: 'Home', url: '/' }, { label: 'Contact', url: '/contact' }]}
      />

      <main style={styles.main} role="main">
        <header style={styles.hero}>
          <div style={styles.heroIcon}>✉️</div>
          <h1 style={styles.heroTitle}>{t.heroTitle}</h1>
          <p style={styles.heroDesc}>{t.heroDesc}</p>
        </header>

        <div style={styles.grid} role="list">
          <ContactCard title={t.generalTitle} desc={t.generalDesc} email={t.generalEmail} icon="💬" />
          <ContactCard title={t.privacyTitle} desc={t.privacyDesc} email={t.privacyEmail} icon="🔒" />
          <ContactCard title={t.securityTitle} desc={t.securityDesc} email={t.securityEmail} icon="🛡️" />
          <ContactCard title={t.accessibilityTitle} desc={t.accessibilityDesc} email={t.accessibilityEmail} icon="♿" />
        </div>

        <p style={styles.note}>⏱️ {t.responseNote}</p>
      </main>
    </>
  );
}

function ContactCard({ title, desc, email, icon }) {
  return (
    <div style={styles.card} role="listitem">
      <span style={styles.cardIcon}>{icon}</span>
      <h2 style={styles.cardTitle}>{title}</h2>
      <p style={styles.cardDesc}>{desc}</p>
      <a href={`mailto:${email}`} style={styles.cardEmail}>{email}</a>
    </div>
  );
}

const styles = {
  main: {
    maxWidth: '800px',
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
  heroIcon: { fontSize: '2.5rem', marginBottom: '0.75rem' },
  heroTitle: {
    fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  heroDesc: {
    fontSize: '1.05rem', color: 'var(--text-secondary, #555)', maxWidth: '600px', margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.25rem',
    marginTop: '1.5rem',
  },
  card: {
    background: 'var(--surface-card, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '12px',
    padding: '1.5rem',
  },
  cardIcon: { fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' },
  cardTitle: {
    fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.4rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  cardDesc: {
    fontSize: '0.88rem', color: 'var(--text-secondary, #666)', margin: '0 0 0.75rem', lineHeight: 1.5,
  },
  cardEmail: {
    display: 'inline-block',
    padding: '6px 14px',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '0.82rem',
    fontWeight: 600,
    textDecoration: 'none',
  },
  note: {
    textAlign: 'center',
    fontSize: '0.88rem',
    color: 'var(--text-secondary, #888)',
    marginTop: '2rem',
    fontStyle: 'italic',
  },
};
