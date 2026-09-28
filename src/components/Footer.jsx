import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { t2 } from '../utils/i18n';
import legalService from '../services/legalService';

/**
 * Footer — social links + legal policy links.
 *
 * Legal links are fetched from the API so only published policies
 * are shown. Each link points to /legal/<slug> rendered by PolicyPageView.
 */
const Footer = ({ lang, translations }) => {
  const t = translations[lang];
  const navigate = useNavigate();
  const location = useLocation();
  const [publishedSlugs, setPublishedSlugs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    legalService.listPolicies({ lang })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        const list = Array.isArray(data) ? data : (data?.results || []);
        setPublishedSlugs(list.map((p) => p.slug));
      })
      .catch(() => {
        if (!cancelled) setPublishedSlugs([]);
      });
    return () => { cancelled = true; };
  }, [lang]);

  const handleSectionLink = (e, anchor) => {
    e.preventDefault();
    const id = anchor.slice(1);
    if (location.pathname !== '/') {
      navigate('/' + anchor);
    } else {
      window.history.replaceState(null, '', anchor);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Label fallback map — translations key → fallback per language.
  // Used when the API returns a slug but we need a display label.
  const legalLabelMap = {
    'terms-of-service':          { ht: 'Kondisyon Itilizasyon',          en: 'Terms of Service' },
    'privacy-policy':            { ht: 'Politik Konfidansyalite',        en: 'Privacy Policy' },
    'cookie-policy':             { ht: 'Politik Cookie',                 en: 'Cookie Policy' },
    'refund-policy':             { ht: 'Politik Rembousman',             en: 'Refund Policy' },
    'copyright-policy':          { ht: 'Dwa Otè & DMCA',                 en: 'Copyright & DMCA' },
    'content-policy':            { ht: 'Politik Kontni',                 en: 'Content Policy' },
    'acceptable-use-policy':     { ht: 'Itilizasyon Akseptab',           en: 'Acceptable Use' },
    'creator-agreement':         { ht: 'Kontra Kreyatè',                 en: 'Creator Agreement' },
    'commission-fee-policy':     { ht: 'Komisyon ak Frè',                en: 'Commission & Fees' },
    'withdrawal-payout-policy':  { ht: 'Retrè ak Peman',                 en: 'Withdrawals & Payouts' },
    'moderation-appeals-policy': { ht: 'Moderasyon ak Apèl',             en: 'Moderation & Appeals' },
    'gdpr-compliance':           { ht: 'Konfòmite GDPR',                 en: 'GDPR' },
    'security-policy':           { ht: 'Politik Sekirite',               en: 'Security Policy' },
    'third-party-services-policy': { ht: 'Sèvis Twazyèm Pati',           en: 'Third-Party Services' },
    'mentions-legales':          { ht: 'Mansyon Legal',                  en: 'Mentions Légales' },
  };

  // Icon map for legal policies
  const legalIconMap = {
    'terms-of-service':          'fa-file-signature',
    'privacy-policy':            'fa-user-shield',
    'cookie-policy':             'fa-cookie-bite',
    'refund-policy':             'fa-money-bill-wave',
    'copyright-policy':          'fa-copyright',
    'content-policy':            'fa-shield-halved',
    'acceptable-use-policy':     'fa-hand',
    'creator-agreement':         'fa-handshake',
    'commission-fee-policy':     'fa-percent',
    'withdrawal-payout-policy':  'fa-wallet',
    'moderation-appeals-policy': 'fa-scale-balanced',
    'gdpr-compliance':           'fa-user-lock',
    'security-policy':           'fa-lock',
    'third-party-services-policy': 'fa-plug',
    'mentions-legales':          'fa-gavel',
  };

  // Fallback static list when API is slow or fails
  const fallbackLegalLinks = [
    { slug: 'terms-of-service',          labelKey: 'footer_link_terms' },
    { slug: 'privacy-policy',            labelKey: 'footer_link_privacy' },
    { slug: 'cookie-policy',             labelKey: 'footer_link_cookie' },
    { slug: 'refund-policy',             labelKey: 'footer_link_refund' },
    { slug: 'copyright-policy',          labelKey: 'footer_link_dmca' },
    { slug: 'content-policy',            labelKey: 'footer_link_content' },
    { slug: 'acceptable-use-policy',     labelKey: 'footer_link_acceptable' },
    { slug: 'creator-agreement',         labelKey: 'footer_link_creator' },
    { slug: 'commission-fee-policy',     labelKey: 'footer_link_commission' },
    { slug: 'withdrawal-payout-policy',  labelKey: 'footer_link_withdrawal' },
    { slug: 'moderation-appeals-policy', labelKey: 'footer_link_moderation' },
    { slug: 'gdpr-compliance',           labelKey: 'footer_link_gdpr' },
    { slug: 'security-policy',           labelKey: 'footer_link_security' },
    { slug: 'third-party-services-policy', labelKey: 'footer_link_third_party' },
    { slug: 'mentions-legales',          labelKey: 'footer_link_mentions' },
  ];

  // Build visible legal links: prefer API-published slugs, fallback to static
  const getLegalLinks = () => {
    if (publishedSlugs === null) {
      // Still loading — show static fallback
      return fallbackLegalLinks.map((l) => ({
        slug: l.slug,
        label: t[l.labelKey] || legalLabelMap[l.slug]?.[lang] || legalLabelMap[l.slug]?.en || l.slug,
      }));
    }
    if (publishedSlugs.length === 0) {
      // API returned empty — show static fallback with translation labels
      return fallbackLegalLinks.map((l) => ({
        slug: l.slug,
        label: t[l.labelKey] || legalLabelMap[l.slug]?.[lang] || legalLabelMap[l.slug]?.en || l.slug,
      }));
    }
    // API returned published slugs — filter to only those
    return fallbackLegalLinks
      .filter((l) => publishedSlugs.includes(l.slug))
      .map((l) => ({
        slug: l.slug,
        label: t[l.labelKey] || legalLabelMap[l.slug]?.[lang] || legalLabelMap[l.slug]?.en || l.slug,
      }));
  };

  const visibleLegalLinks = getLegalLinks();

  // Social links
  const socialLinks = [
    { platform: 'facebook', href: 'https://facebook.com/Atelnyo', icon: 'fab fa-facebook', label: t2(lang, { ht: 'Atelnyo sou Facebook', fr: 'Atelnyo sur Facebook', es: 'Atelnyo en Facebook', en: 'Atelnyo on Facebook' }) },
    { platform: 'instagram', href: 'https://instagram.com/Atelnyo', icon: 'fab fa-instagram', label: t2(lang, { ht: 'Atelnyo sou Instagram', fr: 'Atelnyo sur Instagram', es: 'Atelnyo en Instagram', en: 'Atelnyo on Instagram' }) },
    { platform: 'whatsapp', href: 'https://wa.me/18495025014', icon: 'fab fa-whatsapp', label: t2(lang, { ht: 'Atelnyo sou WhatsApp', fr: 'Atelnyo sur WhatsApp', es: 'Atelnyo en WhatsApp', en: 'Atelnyo on WhatsApp' }) },
    { platform: 'github', href: 'https://github.com/Atelnyo', icon: 'fab fa-github', label: t2(lang, { ht: 'Atelnyo sou GitHub', fr: 'Atelnyo sur GitHub', es: 'Atelnyo en GitHub', en: 'Atelnyo on GitHub' }) },
  ];

  // Section anchor links — deep-link to Explore page sections.
  const sectionLinks = [
    { anchor: '#explore-courses', icon: 'fa-graduation-cap', label: t.explore_section_courses || (t2(lang, { ht: 'Kou', fr: 'Cours', es: 'Cursos', en: 'Courses' })) },
    { anchor: '#explore-music', icon: 'fa-music', label: t.explore_section_music || (t2(lang, { ht: 'Mizik', fr: 'Musique', es: 'Música', en: 'Music' })) },
    { anchor: '#explore-talents', icon: 'fa-star', label: t.explore_section_talents || (t2(lang, { ht: 'Talan', fr: 'Talents', es: 'Talentos', en: 'Talents' })) },
    { anchor: '#explore-communities', icon: 'fa-users', label: t.explore_section_communities || (t2(lang, { ht: 'Kominote', fr: 'Communautés', es: 'Comunidades', en: 'Communities' })) },
    { anchor: '#explore-jobs', icon: 'fa-briefcase', label: t.explore_section_jobs || (t2(lang, { ht: 'Travay', fr: 'Emplois', es: 'Empleos', en: 'Jobs' })) },
    { anchor: '#explore-marketplace', icon: 'fa-shopping-bag', label: t.explore_section_marketplace || (t2(lang, { ht: 'Mache', fr: 'Marché', es: 'Mercado', en: 'Market' })) },
    { anchor: '#explore-events', icon: 'fa-calendar-alt', label: t.explore_section_events || (t2(lang, { ht: 'Evènman', fr: 'Événements', es: 'Eventos', en: 'Events' })) },
    { anchor: '#explore-spotlight', icon: 'fa-lightbulb', label: t.explore_section_spotlight || (t2(lang, { ht: 'Envansyon', fr: 'Inventions', es: 'Inventos', en: 'Spotlight' })) },
  ];

  return (
    <footer className="app-footer" role="contentinfo" aria-label={lang === 'ht' ? 'Pyè paj la' : 'Page footer'}>
      <div className="app-footer-social">
        {socialLinks.map((link) => (
          <a
            key={link.platform}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="app-footer-social-link"
            aria-label={link.label}
          >
            <i className={link.icon} aria-hidden="true"></i>
          </a>
        ))}
      </div>

      <nav className="app-footer-sections" aria-label={t2(lang, { ht: 'Seksyon sit', en: 'Site sections' })}>
        <span className="app-footer-links-title"><i className="fas fa-compass" aria-hidden="true" /> {t2(lang, { ht: 'Eksplore', en: 'Explore' })}</span>
        <div className="app-footer-links-grid">
          {sectionLinks.map((link) => (
            <a key={link.anchor} href={link.anchor} className="app-footer-link" onClick={(e) => handleSectionLink(e, link.anchor)}>
              <i className={`fas ${link.icon}`} aria-hidden="true" /> {link.label}
            </a>
          ))}
        </div>
      </nav>

      <nav className="app-footer-links" aria-label={t.footer_legal_title}>
        <span className="app-footer-links-title"><i className="fas fa-scale-balanced" aria-hidden="true" /> {t.footer_legal_title}</span>
        <div className="app-footer-legal-info">
          <Link to="/legal" className="app-footer-link app-footer-link-legal-index">
            <i className="fas fa-file-contract" aria-hidden="true" /> {t2(lang, { ht: 'Sit Legal', en: 'Legal Hub' })}
          </Link>
          <Link to="/help" className="app-footer-link">
            <i className="fas fa-life-ring" aria-hidden="true" /> {t2(lang, { ht: 'Èd', en: 'Help' })}
          </Link>
          <Link to="/about" className="app-footer-link app-footer-link-about">
            <i className="fas fa-info-circle" aria-hidden="true" /> {t2(lang, { ht: 'Sou Atelnyo', en: 'About Atelnyo' })}
          </Link>
          <Link to="/trust" className="app-footer-link">
            <i className="fas fa-shield-halved" aria-hidden="true" /> {t2(lang, { ht: 'San Konfyans', en: 'Trust Center' })}
          </Link>
          <Link to="/contact" className="app-footer-link">
            <i className="fas fa-envelope" aria-hidden="true" /> {t2(lang, { ht: 'Kontakte', en: 'Contact' })}
          </Link>
          <Link to="/accessibility" className="app-footer-link">
            <i className="fas fa-universal-access" aria-hidden="true" /> {t2(lang, { ht: 'Aksesibilite', en: 'Accessibility' })}
          </Link>
          <Link to="/status" className="app-footer-link">
            <i className="fas fa-heartbeat" aria-hidden="true" /> {t2(lang, { ht: 'Estati', en: 'Status' })}
          </Link>
          <Link to="/developers" className="app-footer-link">
            <i className="fas fa-code" aria-hidden="true" /> {t2(lang, { ht: 'Devlopè', en: 'Developers' })}
          </Link>
          <Link to="/themes" className="app-footer-link app-footer-link-themes">
            <i className="fas fa-palette" aria-hidden="true" /> {t.footer_link_themes}
          </Link>
        </div>
        <div className="app-footer-legal-policies">
          {visibleLegalLinks.map((link) => (
            <Link key={link.slug} to={`/legal/${link.slug}`} className="app-footer-link">
              <i className={`fas ${legalIconMap[link.slug] || 'fa-scale-balanced'}`} aria-hidden="true" /> {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <button
        type="button"
        className="app-footer-back-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={t2(lang, { ht: 'Remonte nan tèt paj la', en: 'Back to top' })}
      >
        <i className="fas fa-arrow-up" aria-hidden="true" /> {t2(lang, { ht: 'Tèt paj', en: 'Top' })}
      </button>

      <p className="app-footer-text">{t.footer_rights} © {new Date().getFullYear()}</p>
    </footer>
  );
};

export default Footer;
