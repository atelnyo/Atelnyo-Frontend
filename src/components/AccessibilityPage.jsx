/**
 * src/components/AccessibilityPage.jsx
 *
 * Atelnyo Accessibility Statement — official page documenting our
 * commitment to web accessibility, WCAG conformance, known limitations,
 * and how to report issues.
 *
 * URL: /accessibility
 * Public, crawlable, multilingual (ht/en/fr/es).
 */
import React from 'react';
import SEOHead from './shared/SEOHead';
import { t2 } from '../utils/i18n';

const SEO = {
  en: { title: 'Accessibility Statement', description: 'Atelnyo is committed to ensuring digital accessibility for all users. Read our accessibility statement, WCAG conformance goals, and how to report issues.' },
  ht: { title: 'Deklarasyon Aksesibilite', description: 'Atelnyo angaje pou asire aksesibilite digital pou tout itilizatè. Li deklarasyon aksesibilite nou, objektif konfòmite WCAG, ak kijan pou rapòte pwoblèm.' },
  fr: { title: 'Déclaration d\'Accessibilité', description: 'Atelnyo s\'engage à garantir l\'accessibilité numérique pour tous. Lisez notre déclaration d\'accessibilité et comment signaler un problème.' },
  es: { title: 'Declaración de Accesibilidad', description: 'Atelnyo se compromete a garantizar la accesibilidad digital para todos. Lea nuestra declaración de accesibilidad y cómo reportar problemas.' },
};

const PAGE = {
  en: {
    heroTitle: 'Accessibility Statement',
    heroDesc: 'Atelnyo is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards.',

    conformanceTitle: 'Conformance Status',
    conformanceText: [
      'Atelnyo aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. These guidelines explain how to make web content more accessible for people with disabilities and more user-friendly for everyone.',
      'We are actively working to increase the accessibility of our platform and ensure that no user is excluded from accessing our content and services.',
    ],

    measuresTitle: 'Accessibility Measures',
    measures: [
      { heading: 'Semantic HTML', text: 'We use proper HTML elements (header, main, nav, footer, article, section) to provide meaningful structure that assistive technologies can interpret.' },
      { heading: 'Keyboard Navigation', text: 'All interactive elements — buttons, links, forms, modals, and navigation — are fully accessible via keyboard. Tab order follows logical content flow.' },
      { heading: 'Focus Management', text: 'Visible focus indicators are provided on all focusable elements. Focus is managed correctly in modals, route transitions, and dynamic content updates.' },
      { heading: 'Screen Reader Support', text: 'ARIA labels, roles, states, and live regions are used where semantic HTML alone is insufficient. Decorative elements are marked aria-hidden.' },
      { heading: 'Color & Contrast', text: 'Our design system uses CSS custom properties with sufficient color contrast ratios. Multiple theme modes (light, dark, AMOLED, high-contrast) accommodate different visual needs.' },
      { heading: 'Reduced Motion', text: 'Atelnyo respects the prefers-reduced-motion media query. All animations and transitions are automatically disabled for users who prefer reduced motion.' },
      { heading: 'Responsive Design', text: 'The platform works on screen sizes from 320px mobile to large desktop displays. Touch targets meet minimum 44x44px size requirements.' },
      { heading: 'Skip Navigation', text: 'A "Skip to content" link allows keyboard users to bypass navigation and go directly to the main content area.' },
      { heading: 'Accessible Forms', text: 'All form inputs use associated labels, required fields are clearly indicated, and error messages are announced to screen readers.' },
      { heading: 'Alt Text', text: 'Meaningful images include descriptive alt text. Decorative images are marked with empty alt attributes or aria-hidden.' },
    ],

    knownTitle: 'Known Limitations',
    known: [
      { issue: 'Third-party embedded content', text: 'Some pages may contain embedded content from third-party services (YouTube, Vimeo) that we cannot fully control for accessibility.' },
      { issue: 'User-generated content', text: 'Content uploaded by creators (course materials, descriptions) may not always meet accessibility standards. We provide guidelines to creators but cannot guarantee their compliance.' },
      { issue: 'Complex data visualizations', text: 'Some analytics dashboards and data visualizations may not be fully accessible to screen readers. We are working to add text alternatives.' },
    ],

    testingTitle: 'Testing Approach',
    testing: [
      'Automated testing with axe-core and Lighthouse accessibility audits',
      'Manual keyboard navigation testing across all major features',
      'Screen reader testing with NVDA (Windows) and VoiceOver (macOS/iOS)',
      'Color contrast verification using the WebAIM contrast checker',
      'Responsive testing across mobile, tablet, and desktop viewports',
    ],

    feedbackTitle: 'Feedback & Contact',
    feedbackText: 'We welcome your feedback on the accessibility of Atelnyo. If you encounter accessibility barriers or have suggestions for improvement, please contact us:',
    feedbackEmail: 'accessibility@atelnyo.site',
    feedbackResponse: 'We aim to respond to accessibility feedback within 5 business days.',
  },

  ht: {
    heroTitle: 'Deklarasyon Aksesibilite',
    heroDesc: 'Atelnyo angaje pou asire aksesibilite digital pou moun ak andicap. Nou amelyore kontinyèlman eksperyans itilizatè pou tout moun epi nou aplike estanda aksesibilite ki enpòtan.',

    conformanceTitle: 'Estati Konfòmite',
    conformanceText: [
      'Atelnyo vle konfòm ak Guidelines Aksesibilite Kontni Entènèt (WCAG) 2.1 Nivo AA. Gid sa yo eksplike kijan pou fè kontni entènèt pi aksesib pou moun ak andicap.',
      'Nou ap travay aktivman pou ogmante aksesibilite platfòm nou epi asire ke pa gen okenn itilizatè ki eksklude nan akses kontni ak sèvis yo.',
    ],

    measuresTitle: 'Mezi Aksesibilite',
    measures: [
      { heading: 'HTML Semantik', text: 'Nou itilize eleman HTML ki kòrèk (header, main, nav, footer) pou bay estrikti ki gen siyifikasyon pou teknoloji asistif.' },
      { heading: 'Navigasyon ak Kle', text: 'Tout eleman entèraktif — bouton, lyen, fòm, modals, ak navigasyon — aksesib avèk kle.' },
      { heading: 'Sipò Lecteur Ekran', text: 'ARIA labels, wòl, ak viv rejion yo itilize lè HTML semantik pou kont pa ensifisan.' },
      { heading: 'Mòd Redui Motion', text: 'Atelnyo respekte media query prefers-reduced-motion. Animasyon yo disable otomatikman.' },
    ],

    knownTitle: 'Limitasyon Konu',
    known: [
      { issue: 'Kontni entegre twazyèm pati', text: 'Gen kèk paj ki ka genyen kontni entegre sèvis twazyèm pati (YouTube, Vimeo) ke nou pa ka konplètman kontwole.' },
      { issue: 'Kontni ki gen itilizatè', text: 'Kontni kreyatè yo telechaje ka pa toujou satisfè estanda aksesibilite.' },
    ],

    testingTitle: 'Apwòch Tès',
    testing: [
      'Tès otomatik ak axe-core ak Lighthouse accessibility audits',
      'Tès navigasyon kle manyèl atravè tout fonksyonalite prensipal',
      'Tès lecteur ekran ak NVDA (Windows) ak VoiceOver (macOS/iOS)',
    ],

    feedbackTitle: 'Fidbak & Kontak',
    feedbackText: 'Nou akeyi fidbak ou sou aksesibilite Atelnyo. Si ou rankontre baryè aksesibilite, kontakte nou:',
    feedbackEmail: 'accessibility@atelnyo.site',
    feedbackResponse: 'Nou vle reponn fidbak aksesibilite nan 5 jou biznis.',
  },

  fr: {
    heroTitle: 'Déclaration d\'Accessibilité',
    heroDesc: 'Atelnyo s\'engage à garantir l\'accessibilité numérique pour les personnes en situation de handicap. Nous améliorons continuellement l\'expérience utilisateur pour tous.',

    conformanceTitle: 'État de Conformité',
    conformanceText: [
      'Atelnyo vise la conformité aux Directives d\'Accessibilité du Contenu Web (WCAG) 2.1 Niveau AA.',
      'Nous travaillons activement à augmenter l\'accessibilité de notre plateforme.',
    ],

    measuresTitle: 'Mesures d\'Accessibilité',
    measures: [
      { heading: 'HTML Sémantique', text: 'Nous utilisons les éléments HTML appropriés pour fournir une structure significative.' },
      { heading: 'Navigation au Clavier', text: 'Tous les éléments interactifs sont accessibles via le clavier.' },
      { heading: 'Support Lecteur d\'Écran', text: 'Les labels ARIA, rôles et régions vivantes sont utilisés lorsque le HTML sémantique seul est insuffisant.' },
      { heading: 'Mouvement Réduit', text: 'Atelnyo respecte la media query prefers-reduced-motion.' },
    ],

    knownTitle: 'Limitations Connues',
    known: [
      { issue: 'Contenu intégré tiers', text: 'Certaines pages peuvent contenir du contenu intégré de services tiers que nous ne pouvons pas entièrement contrôler.' },
      { issue: 'Contenu généré par les utilisateurs', text: 'Le contenu téléchargé par les créateurs peut ne pas toujours respecter les normes d\'accessibilité.' },
    ],

    testingTitle: 'Approche de Test',
    testing: [
      'Tests automatisés avec axe-core et Lighthouse',
      'Tests de navigation au clavier manuels',
      'Tests de lecteur d\'écran avec NVDA et VoiceOver',
    ],

    feedbackTitle: 'Retours & Contact',
    feedbackText: 'Nous accueillons vos retours sur l\'accessibilité d\'Atelnyo. Contactez-nous :',
    feedbackEmail: 'accessibility@atelnyo.site',
    feedbackResponse: 'Nous visons une réponse sous 5 jours ouvrables.',
  },

  es: {
    heroTitle: 'Declaración de Accesibilidad',
    heroDesc: 'Atelnyo se compromete a garantizar la accesibilidad digital para personas con discapacidades. Mejoramos continuamente la experiencia de usuario para todos.',

    conformanceTitle: 'Estado de Conformidad',
    conformanceText: [
      'Atelnyo tiene como objetivo conformarse con las Pautas de Accesibilidad del Contenido Web (WCAG) 2.1 Nivel AA.',
      'Estamos trabajando activamente para aumentar la accesibilidad de nuestra plataforma.',
    ],

    measuresTitle: 'Medidas de Accesibilidad',
    measures: [
      { heading: 'HTML Semántico', text: 'Utilizamos elementos HTML apropiados para proporcionar una estructura significativa.' },
      { heading: 'Navegación por Teclado', text: 'Todos los elementos interactivos son accesibles mediante teclado.' },
      { heading: 'Soporte de Lector de Pantalla', text: 'Las etiquetas ARIA, roles y regiones en vivo se utilizan cuando el HTML semántico solo no es suficiente.' },
      { heading: 'Movimiento Reducido', text: 'Atelnyo respeta la media query prefers-reduced-motion.' },
    ],

    knownTitle: 'Limitaciones Conocidas',
    known: [
      { issue: 'Contenido incrustado de terceros', text: 'Algunas páginas pueden contener contenido incrustado de servicios de terceros que no podemos controlar completamente.' },
      { issue: 'Contenido generado por usuarios', text: 'El contenido subido por creadores puede no cumplir siempre con los estándares de accesibilidad.' },
    ],

    testingTitle: 'Enfoque de Pruebas',
    testing: [
      'Pruebas automatizadas con axe-core y Lighthouse',
      'Pruebas manuales de navegación por teclado',
      'Pruebas de lector de pantalla con NVDA y VoiceOver',
    ],

    feedbackTitle: 'Comentarios y Contacto',
    feedbackText: 'Agradecemos sus comentarios sobre la accesibilidad de Atelnyo. Contáctenos:',
    feedbackEmail: 'accessibility@atelnyo.site',
    feedbackResponse: 'Nuestro objetivo es responder en 5 días hábiles.',
  },
};

export default function AccessibilityPage({ lang = 'en', market = '' }) {
  const t = PAGE[lang] || PAGE.en;
  const s = SEO[lang] || SEO.en;
  const locale = market ? `${lang}-${market}` : '';

  return (
    <>
      <SEOHead
        title={s.title}
        description={s.description}
        image="https://atelnyo.site/og-banner-en.svg"
        url="/accessibility"
        type="website"
        lang={lang}
        locale={locale}
        breadcrumbs={[{ label: 'Home', url: '/' }, { label: 'Accessibility', url: '/accessibility' }]}
      />

      <main style={styles.main} role="main">
        <header style={styles.hero}>
          <div style={styles.heroIcon}>♿</div>
          <h1 style={styles.heroTitle}>{t.heroTitle}</h1>
          <p style={styles.heroDesc}>{t.heroDesc}</p>
        </header>

        {/* Conformance */}
        <section style={styles.section} aria-labelledby="conformance">
          <h2 id="conformance" style={styles.h2}>{t.conformanceTitle}</h2>
          {t.conformanceText.map((p, i) => (
            <p key={i} style={styles.p}>{p}</p>
          ))}
        </section>

        {/* Measures */}
        <section style={styles.section} aria-labelledby="measures">
          <h2 id="measures" style={styles.h2}>{t.measuresTitle}</h2>
          {t.measures.map((m, i) => (
            <div key={i} style={styles.card}>
              <h3 style={styles.cardH3}>{m.heading}</h3>
              <p style={styles.cardP}>{m.text}</p>
            </div>
          ))}
        </section>

        {/* Known Limitations */}
        <section style={styles.section} aria-labelledby="known-limitations">
          <h2 id="known-limitations" style={styles.h2}>{t.knownTitle}</h2>
          {t.known.map((k, i) => (
            <div key={i} style={styles.card}>
              <h3 style={styles.cardH3}>{k.issue}</h3>
              <p style={styles.cardP}>{k.text}</p>
            </div>
          ))}
        </section>

        {/* Testing */}
        <section style={styles.section} aria-labelledby="testing">
          <h2 id="testing" style={styles.h2}>{t.testingTitle}</h2>
          <ul style={styles.ul}>
            {t.testing.map((item, i) => (
              <li key={i} style={styles.li}>{item}</li>
            ))}
          </ul>
        </section>

        {/* Feedback */}
        <section style={{ ...styles.section, ...styles.highlight }} aria-labelledby="feedback">
          <h2 id="feedback" style={styles.h2}>{t.feedbackTitle}</h2>
          <p style={styles.p}>{t.feedbackText}</p>
          <a href={`mailto:${t.feedbackEmail}`} style={styles.emailBtn}>{t.feedbackEmail}</a>
          <p style={{ ...styles.p, ...styles.note }}>⏱️ {t.feedbackResponse}</p>
        </section>
      </main>
    </>
  );
}

const styles = {
  main: {
    maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem 4rem',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    color: 'var(--text-primary, #1a1a2e)', lineHeight: 1.7,
  },
  hero: { textAlign: 'center', padding: '3rem 0 2rem' },
  heroIcon: { fontSize: '2.5rem', marginBottom: '0.75rem' },
  heroTitle: { fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary, #1a1a2e)' },
  heroDesc: { fontSize: '1.05rem', color: 'var(--text-secondary, #555)', maxWidth: '700px', margin: '0 auto' },
  section: { padding: '2rem 0', borderBottom: '1px solid var(--border-color, #e0e0e0)' },
  highlight: { background: 'var(--surface-secondary, #f8f9fa)', margin: '0 -1.5rem', padding: '2rem 1.5rem', borderRadius: '12px' },
  h2: { fontSize: '1.4rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary, #1a1a2e)' },
  p: { fontSize: '0.95rem', color: 'var(--text-secondary, #555)', margin: '0 0 0.75rem', lineHeight: 1.6 },
  card: { background: 'var(--surface-card, #fff)', border: '1px solid var(--border-color, #e0e0e0)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '0.6rem' },
  cardH3: { fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.3rem', color: 'var(--pink-primary, #d81b60)' },
  cardP: { fontSize: '0.88rem', margin: 0, color: 'var(--text-secondary, #555)', lineHeight: 1.5 },
  ul: { paddingLeft: '1.5rem', margin: '0.5rem 0' },
  li: { fontSize: '0.92rem', marginBottom: '0.5rem', color: 'var(--text-secondary, #555)' },
  emailBtn: {
    display: 'inline-block', padding: '10px 24px', background: 'var(--pink-primary, #d81b60)',
    color: '#fff', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', margin: '0.5rem 0',
  },
  note: { fontSize: '0.85rem', fontStyle: 'italic', marginTop: '0.75rem', color: 'var(--text-secondary, #888)' },
};
