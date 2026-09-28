/**
 * src/components/studio/MediaProviderSection.jsx
 *
 * Media Provider Center — full page inside Creator Studio.
 *
 * Views:
 *   empty       – No provider connected yet → "Connect Storage" CTA
 *   marketplace – Grid of provider cards (Recommended + Professional)
 *   detail      – Learn More page for a single provider
 *   readme      – Setup instructions for a single provider
 *   wizard      – 5-step Connect Wizard (Setup → Credentials → Test → Validate → Done)
 *   connected   – Currently connected providers
 *   validate    – URL validation interface
 *
 * Uses the same Theme Engine (dark/light mode), responsive, accessible,
 * and translation-ready.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { mediaProviderService } from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────────────

function tLabel(key, lang) {
  // Simple inline i18n; the caller passes `lang` from CreatorStudio.
  const EN = {
    media_center: 'Media Provider Center',
    media_center_desc: 'Connect your media storage to manage images and videos for your content.',
    empty_title: 'Connect your media storage',
    empty_desc: 'Atelnyo does not store your large media files. We only use public URLs that you control.',
    empty_cta: 'Connect Storage',
    empty_learn: 'Learn More',
    marketplace_title: 'Storage Marketplace',
    marketplace_desc: 'Choose a provider that fits your needs — connect once, use everywhere.',
    recommended: '⭐ Recommended',
    professional: 'Professional',
    difficulty_beginner: 'Beginner',
    difficulty_intermediate: 'Intermediate',
    difficulty_professional: 'Professional',
    media_images: 'Images',
    media_videos: 'Videos',
    media_documents: 'Documents',
    free_plan: 'Free Plan',
    official_website: 'Official Website',
    learn_more: 'Learn More',
    connect: 'Connect',
    back: 'Back',
    back_to_marketplace: 'Back to Marketplace',
    readme_title: 'Setup Guide',
    readme_how_to: 'How to connect',
    start_setup: 'Start Setup',
    wizard_title: 'Connect Provider',
    wizard_step_1: 'Prepare Provider',
    wizard_step_1_desc: 'Make sure you have an account with {name}. Have your credentials ready.',
    wizard_step_2: 'Enter Credentials',
    wizard_step_2_desc: 'Enter the public URL or API details provided by your storage service.',
    wizard_step_3: 'Test Connection',
    wizard_step_3_desc: 'We will try to access a test URL to verify the connection works.',
    wizard_step_4: 'Validate',
    wizard_step_4_desc: 'Confirm the connection is working and the correct media type is detected.',
    wizard_step_5: 'Finish',
    wizard_step_5_desc: 'Your provider is now connected! You can start using it in your content.',
    wizard_input_label: 'Public Media URL',
    wizard_input_placeholder: 'https://example.com/your-image.jpg',
    wizard_test: 'Test Connection',
    wizard_testing: 'Testing...',
    wizard_test_success: 'Connection successful!',
    wizard_test_fail: 'Connection failed. Check your URL and try again.',
    wizard_validate: 'Validate & Finish',
    wizard_complete: 'Connected Successfully!',
    wizard_complete_desc: 'Your {name} provider is now active. You can use it to add images and videos to your content.',
    wizard_go_to_center: 'Go to Media Center',
    connected_title: 'Connected Providers',
    connected_empty: 'No providers connected yet.',
    connected_status_active: 'Active',
    connected_status_inactive: 'Inactive',
    connected_disconnect: 'Disconnect',
    validate_title: 'Validate Media URL',
    validate_desc: 'Paste a public media URL to verify it is accessible and detect the provider.',
    validate_placeholder: 'https://...',
    validate_btn: 'Validate',
    validate_validating: 'Validating...',
    validate_success: 'URL is valid!',
    validate_error: 'Invalid URL',
    validate_https: 'HTTPS is required',
    validate_timeout: 'Timed out — provider did not respond',
    validate_not_found: 'File not found (404)',
    validate_forbidden: 'Permission denied (403)',
    validate_no_media: 'No media detected at this URL',
    detected_provider: 'Detected Provider',
    media_type: 'Media Type',
    dimensions: 'Dimensions',
    thumbnail: 'Preview',
    loading_providers: 'Loading providers...',
    loading_error: 'Could not load providers.',
    retry: 'Retry',
    provider_detail_about: 'About',
    provider_detail_advantages: 'Advantages',
    provider_detail_disadvantages: 'Disadvantages',
    provider_detail_who: 'Who is it for?',
    provider_detail_privacy: 'Privacy & Security',
    provider_detail_cdn: 'CDN & Performance',
    provider_detail_streaming: 'Streaming Support',
    provider_detail_optimization: 'Image Optimization',
    provider_detail_limits: 'Free Plan Limits',
    creator: 'Creator',
    admin: 'Admin',
  };

  const HT = {
    media_center: 'Media Provider Center',
    media_center_desc: 'Konekte depo medya ou a pou jere imaj ak videyo pou kontni ou.',
    empty_title: 'Konekte depo medya ou',
    empty_desc: 'Atelnyo pa estoke gwo fichye medya ou yo. Nou itilize sèlman URL piblik ou kontwole.',
    empty_cta: 'Konekte Depo',
    empty_learn: 'Aprann Plis',
    marketplace_title: 'Marketplace Depo',
    marketplace_desc: 'Chwazi yon provider ki adapte bezwen ou — konekte yon fwa, itilize toupatou.',
    recommended: '⭐ Rekòmande',
    professional: 'Pwofesyonèl',
    difficulty_beginner: 'Kòmanse',
    difficulty_intermediate: 'Mwayen',
    difficulty_professional: 'Pwofesyonèl',
    media_images: 'Imaj',
    media_videos: 'Videyo',
    media_documents: 'Dokiman',
    free_plan: 'Plan Gratis',
    official_website: 'Sit Ofisyèl',
    learn_more: 'Aprann Plis',
    connect: 'Konekte',
    back: 'Retounen',
    back_to_marketplace: 'Retounen nan Marketplace',
    readme_title: 'Gid Enstalasyon',
    readme_how_to: 'Kijan pou konekte',
    start_setup: 'Kòmanse Enstalasyon',
    wizard_title: 'Konekte Provider',
    wizard_step_1: 'Prepare Provider',
    wizard_step_1_desc: 'Asire w ou gen yon kont ak {name}. Gen krentif ou yo pare.',
    wizard_step_2: 'Antre Krentif',
    wizard_step_2_desc: 'Antre URL piblik la oswa detay API soti nan sèvis depo ou a.',
    wizard_step_3: 'Teste Koneksyon',
    wizard_step_3_desc: 'N ap eseye aksede yon URL tès pou verifye koneksyon an mache.',
    wizard_step_4: 'Valide',
    wizard_step_4_desc: 'Konfime koneksyon an ap mache epi kalite medya a detekte kòrèkteman.',
    wizard_step_5: 'Fini',
    wizard_step_5_desc: 'Provider ou konekte kounye a! Ou ka kòmanse itilize l nan kontni ou.',
    wizard_input_label: 'URL Medya Piblik',
    wizard_input_placeholder: 'https://example.com/your-image.jpg',
    wizard_test: 'Teste Koneksyon',
    wizard_testing: 'Ap teste...',
    wizard_test_success: 'Koneksyon an mache!',
    wizard_test_fail: 'Koneksyon echwe. Tcheke URL la epi eseye ankò.',
    wizard_validate: 'Valide & Fini',
    wizard_complete: 'Konekte ak Siksè!',
    wizard_complete_desc: 'Provider {name} ou an aktif kounye a. Ou ka itilize l pou ajoute imaj ak videyo nan kontni ou.',
    wizard_go_to_center: 'Ale nan Media Center',
    connected_title: 'Providers Konekte',
    connected_empty: 'Poko gen provider konekte.',
    connected_status_active: 'Aktif',
    connected_status_inactive: 'Inaktif',
    connected_disconnect: 'Dekonekte',
    validate_title: 'Valide URL Medya',
    validate_desc: 'Kole yon URL medya piblik pou verifye li aksesib epi detekte provider la.',
    validate_placeholder: 'https://...',
    validate_btn: 'Valide',
    validate_validating: 'Ap valide...',
    validate_success: 'URL la valid!',
    validate_error: 'URL pa valid',
    validate_https: 'HTTPS obligatwa',
    validate_timeout: 'Tan ekspire — provider pa reponn',
    validate_not_found: 'Fichye pa jwenn (404)',
    validate_forbidden: 'Pèmisyon refize (403)',
    validate_no_media: 'Pa gen medya detekte nan URL sa a',
    detected_provider: 'Provider Detekte',
    media_type: 'Kalite Medya',
    dimensions: 'Dimansyon',
    thumbnail: 'Aperçu',
    loading_providers: 'Ap chaje providers...',
    loading_error: 'Pa kapab chaje providers yo.',
    retry: 'Eseye ankò',
    provider_detail_about: 'Sou',
    provider_detail_advantages: 'Avantaj',
    provider_detail_disadvantages: 'Dezavantaj',
    provider_detail_who: 'Pou kiyès li fèt?',
    provider_detail_privacy: 'Vi prive & Sekirite',
    provider_detail_cdn: 'CDN & Pèfòmans',
    provider_detail_streaming: 'Sipò Streaming',
    provider_detail_optimization: 'Optimizasyon Imaj',
    provider_detail_limits: 'Limit Plan Gratis',
    creator: 'Kreyatè',
    admin: 'Admin',
  };

  return (lang === 'ht' ? HT : EN)[key] || EN[key] || key;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return '—'; }
}

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// ─── Provider difficulty badges ────────────────────────────────────────────

const DIFFICULTY_META = {
  beginner: { className: 'mpc-difficulty-beginner', labelKey: 'difficulty_beginner' },
  intermediate: { className: 'mpc-difficulty-intermediate', labelKey: 'difficulty_intermediate' },
  professional: { className: 'mpc-difficulty-professional', labelKey: 'difficulty_professional' },
};

// ─── Media type icons ──────────────────────────────────────────────────────

const MEDIA_TYPE_ICONS = {
  image: 'fa-image',
  video: 'fa-video',
  audio: 'fa-music',
  document: 'fa-file-alt',
};

// ─── Provider logo placeholder ─────────────────────────────────────────────

function ProviderLogo({ name, size = 40 }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'MP';
  return (
    <div
      className="mpc-provider-logo"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonCards({ count = 6 }) {
  return (
    <div className="mpc-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mpc-card mpc-card-skeleton" aria-hidden="true">
          <div className="mpc-skel-logo" />
          <div className="mpc-skel-line" style={{ width: '60%' }} />
          <div className="mpc-skel-line" style={{ width: '40%' }} />
          <div className="mpc-skel-line" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────

function EmptyState({ onConnect, onLearn, t }) {
  return (
    <div className="mpc-empty" role="status">
      <div className="mpc-empty-illustration" aria-hidden="true">
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="20" width="120" height="90" rx="10" fill="var(--pink-light, #fce4ec)" stroke="var(--pink-primary, #d81b60)" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="100" cy="55" r="16" fill="var(--pink-primary, #d81b60)" opacity="0.3" />
          <polygon points="100,43 108,58 92,58" fill="var(--pink-primary, #d81b60)" opacity="0.6" />
          <rect x="70" y="82" width="60" height="16" rx="3" fill="var(--pink-primary, #d81b60)" opacity="0.15" />
          <line x1="75" y1="90" x2="100" y2="90" stroke="var(--pink-primary, #d81b60)" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <rect x="55" y="0" width="25" height="40" rx="5" fill="var(--pink-primary, #d81b60)" opacity="0.1" />
          <rect x="120" y="0" width="25" height="40" rx="5" fill="var(--pink-primary, #d81b60)" opacity="0.1" />
        </svg>
      </div>
      <h3 className="mpc-empty-title">{t('empty_title')}</h3>
      <p className="mpc-empty-desc">{t('empty_desc')}</p>
      <div className="mpc-empty-actions">
        <button type="button" className="btn-primary" onClick={onConnect}>
          <i className="fas fa-plug" aria-hidden="true" />
          {t('empty_cta')}
        </button>
        <button type="button" className="btn-secondary" onClick={onLearn}>
          <i className="fas fa-lightbulb" aria-hidden="true" />
          {t('empty_learn')}
        </button>
      </div>
    </div>
  );
}

// ─── Provider Card ─────────────────────────────────────────────────────────

function ProviderCard({ provider, t, onLearnMore, onConnect }) {
  const difficulty = DIFFICULTY_META[provider.difficulty] || DIFFICULTY_META.beginner;
  const mediaTypes = provider.media_types
    ? provider.media_types.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="mpc-card" role="article" aria-label={provider.name}>
      <div className="mpc-card-top">
        <ProviderLogo name={provider.name} size={44} />
        <div className="mpc-card-header">
          <h4 className="mpc-card-name">{provider.name}</h4>
          <span className={`mpc-difficulty-badge ${difficulty.className}`}>
            {t(difficulty.labelKey)}
          </span>
        </div>
      </div>

      {(provider.description || provider.short_description) && (
        <p className="mpc-card-desc">{provider.description || provider.short_description}</p>
      )}

      <div className="mpc-card-tags">
        {mediaTypes.map((mt) => (
          <span key={mt} className="mpc-tag">
            <i className={`fas ${MEDIA_TYPE_ICONS[mt] || 'fa-file'}`} aria-hidden="true" />
            {t(`media_${mt}`) || mt}
          </span>
        ))}
      </div>

      <div className="mpc-card-meta">
        {provider.free_plan ? (
          <span className="mpc-card-free">
            <i className="fas fa-check-circle" aria-hidden="true" />
            {provider.free_plan}
          </span>
        ) : null}
        {provider.website_url && (
          <a
            href={provider.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mpc-card-link"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fas fa-external-link-alt" aria-hidden="true" />
            {t('official_website')}
          </a>
        )}
      </div>

      <div className="mpc-card-actions">
        <button
          type="button"
          className="btn-secondary mpc-card-btn-learn"
          onClick={() => onLearnMore(provider)}
        >
          <i className="fas fa-info-circle" aria-hidden="true" />
          {t('learn_more')}
        </button>
        <button
          type="button"
          className="btn-primary mpc-card-btn-connect"
          onClick={() => onConnect(provider)}
        >
          <i className="fas fa-plug" aria-hidden="true" />
          {t('connect')}
        </button>
      </div>
    </div>
  );
}

// ─── Provider Detail (Learn More) ──────────────────────────────────────────

function ProviderDetail({ provider, t, onBack, onStartSetup }) {
  const difficulty = DIFFICULTY_META[provider.difficulty] || DIFFICULTY_META.beginner;
  const mediaTypes = provider.media_types
    ? provider.media_types.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="mpc-detail">
      <button type="button" className="mpc-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        {t('back_to_marketplace')}
      </button>

      <div className="mpc-detail-hero">
        <ProviderLogo name={provider.name} size={64} />
        <div className="mpc-detail-hero-text">
          <h2 className="mpc-detail-name">{provider.name}</h2>
          <span className={`mpc-difficulty-badge ${difficulty.className} mpc-detail-badge`}>
            {t(difficulty.labelKey)}
          </span>
        </div>
      </div>

      {(provider.description || provider.short_description) && (
        <p className="mpc-detail-short-desc">{provider.description || provider.short_description}</p>
      )}

      <div className="mpc-detail-section">
        <h3>{t('provider_detail_about')}</h3>
        <p>{provider.description || provider.short_description || '—'}</p>
      </div>

      <div className="mpc-detail-grid">
        <div className="mpc-detail-card">
          <i className="fas fa-check-circle" aria-hidden="true" />
          <h4>{t('provider_detail_about')}</h4>
          <div className="mpc-detail-list">
            {provider.learn_more_md ? (
              <div className="mpc-readme-md">
                {provider.learn_more_md.split('\n').map((l, i) => {
                  if (l.startsWith('## ')) return <h3 key={i} className="mpc-readme-h3">{l.slice(3)}</h3>;
                  if (l.startsWith('**') && l.endsWith('**')) return <strong key={i} className="mpc-readme-strong">{l.slice(2, -2)}</strong>;
                  if (l.startsWith('- ')) return <li key={i} className="mpc-readme-li">{l.slice(2)}</li>;
                  if (!l.trim()) return <br key={i} />;
                  return <p key={i} className="mpc-readme-p">{l}</p>;
                })}
              </div>
            ) : (
              <p className="mpc-readme-p" style={{ textAlign: 'center', padding: 20 }}>—</p>
            )}
          </div>
        </div>
      </div>

      <div className="mpc-detail-features">
        {provider.free_plan ? (
          <div className="mpc-detail-feat">
            <i className="fas fa-gift" aria-hidden="true" />
            <span>{t('provider_detail_limits')}: {provider.free_plan}</span>
          </div>
        ) : null}
        <div className="mpc-detail-feat">
          <i className="fas fa-shield-alt" aria-hidden="true" />
          <span>{t('provider_detail_privacy')}</span>
        </div>
        <div className="mpc-detail-feat">
          <i className="fas fa-tachometer-alt" aria-hidden="true" />
          <span>{t('provider_detail_cdn')}</span>
        </div>
        {mediaTypes.includes('video') && (
          <div className="mpc-detail-feat">
            <i className="fas fa-play-circle" aria-hidden="true" />
            <span>{t('provider_detail_streaming')}</span>
          </div>
        )}
        {mediaTypes.includes('image') && (
          <div className="mpc-detail-feat">
            <i className="fas fa-magic" aria-hidden="true" />
            <span>{t('provider_detail_optimization')}</span>
          </div>
        )}
      </div>

      {provider.website_url && (
        <div className="mpc-detail-website">
          <a
            href={provider.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <i className="fas fa-external-link-alt" aria-hidden="true" />
            {t('official_website')}
          </a>
        </div>
      )}

      <div className="mpc-detail-cta">
        <button type="button" className="btn-primary" onClick={() => onStartSetup(provider)}>
          <i className="fas fa-plug" aria-hidden="true" />
          {t('start_setup')}
        </button>
      </div>
    </div>
  );
}

// ─── Provider README — Enhanced Tutorial Experience ────────────────────────
// Prompt 22 v2: Overview, Advantages, Limitations, Supported Formats,
// Step by Step, Screenshots, FAQ, Common Errors, Troubleshooting,
// Example URLs, Wrong URLs, Security Tips, Contact Support.

const README_SECTIONS = ['overview','advantages','limitations','supported_formats','step_by_step','faq','common_errors','troubleshooting','example_urls','wrong_urls','security_tips','contact_support'];

const README_SECTION_LABELS = {
  overview: { en: 'Overview', ht: 'Apèsi' },
  advantages: { en: 'Advantages', ht: 'Avantaj' },
  limitations: { en: 'Limitations', ht: 'Limit' },
  supported_formats: { en: 'Supported Formats', ht: 'Fòma Sipòte' },
  step_by_step: { en: 'Step by Step Guide', ht: 'Gid Etap pa Etap' },
  faq: { en: 'Frequently Asked Questions', ht: 'Kesyon yo poze souvan' },
  common_errors: { en: 'Common Errors', ht: 'Erè komen' },
  troubleshooting: { en: 'Troubleshooting', ht: 'Depanaj' },
  example_urls: { en: 'Example URLs', ht: 'Egzanp URL' },
  wrong_urls: { en: 'Wrong URLs', ht: 'Move URL' },
  security_tips: { en: 'Security Tips', ht: 'Konsèy Sekirite' },
  contact_support: { en: 'Contact Support', ht: 'Kontakte Sipò' },
};

const README_SECTION_ICONS = {
  overview: 'fa-info-circle',
  advantages: 'fa-star',
  limitations: 'fa-exclamation-triangle',
  supported_formats: 'fa-file-alt',
  step_by_step: 'fa-list-ol',
  faq: 'fa-question-circle',
  common_errors: 'fa-times-circle',
  troubleshooting: 'fa-wrench',
  example_urls: 'fa-check-circle',
  wrong_urls: 'fa-ban',
  security_tips: 'fa-shield-alt',
  contact_support: 'fa-headset',
};

function ReadmeFaqSection({ questions, lang }) {
  const [openIndex, setOpenIndex] = useState(null);
  if (!questions || questions.length === 0) return null;
  return (
    <div className="mpc-readme-faq">
      {questions.map((q, i) => (
        <div key={i} className={`mpc-faq-item${openIndex === i ? ' mpc-faq-open' : ''}`}>
          <button
            type="button"
            className="mpc-faq-question"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
            aria-controls={`faq-answer-${i}`}
          >
            <span>{q.question?.[lang] || q.question?.en || ''}</span>
            <i className={`fas fa-chevron-${openIndex === i ? 'up' : 'down'}`} aria-hidden="true" />
          </button>
          <div id={`faq-answer-${i}`} className="mpc-faq-answer" role="region" hidden={openIndex !== i}>
            <p>{q.answer?.[lang] || q.answer?.en || ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadmeErrorCard({ error, index }) {
  return (
    <div className="mpc-error-card">
      <div className="mpc-error-card-header">
        <i className="fas fa-exclamation-circle" aria-hidden="true" />
        <strong>{error.error?.['en'] || error.error || `Error #${index + 1}`}</strong>
      </div>
      <p className="mpc-error-card-cause">
        <i className="fas fa-search" aria-hidden="true" />
        <strong>Cause: </strong>{error.cause?.['en'] || error.cause || ''}
      </p>
      <p className="mpc-error-card-fix">
        <i className="fas fa-wrench" aria-hidden="true" />
        <strong>Fix: </strong>{error.fix?.['en'] || error.fix || ''}
      </p>
    </div>
  );
}

function ReadmeUrlExample({ url, isValid, index }) {
  return (
    <div className={`mpc-url-example ${isValid ? 'mpc-url-valid' : 'mpc-url-invalid'}`}>
      <i className={`fas ${isValid ? 'fa-check-circle' : 'fa-times-circle'}`} aria-hidden="true" />
      <code className="mpc-url-code">{url}</code>
      {!isValid && <span className="mpc-url-why">— Why: {isValid === false ? 'Missing required params' : 'Invalid format'}</span>}
    </div>
  );
}

function ProviderReadme({ provider, readme, t, onBack, onStartSetup, lang: propLang = 'en' }) {
  const [activeSection, setActiveSection] = useState('step_by_step');
  const lang = propLang;
  const isHt = lang === 'ht';

  // Build structured sections from readme markdown or defaults
  const sections = {
    overview: provider.description || (isHt ? 'Pa gen deskripsyon' : 'No description'),
    advantages: [
      isHt ? 'Fasil pou itilize' : 'Easy to use',
      isHt ? 'Gratis pou kòmanse' : 'Free to start',
      isHt ? 'Bon pèfòmans' : 'Good performance',
    ],
    limitations: [
      isHt ? 'Limit depo gratis' : 'Free storage limit',
      isHt ? 'Bezon koneksyon entènèt' : 'Requires internet connection',
    ],
    supported_formats: provider.media_types
      ? provider.media_types.split(',').map((mt) => mt.trim()).filter(Boolean)
      : ['image', 'video'],
    step_by_step: [
      { step: 1, en: `Create an account on ${provider.name}`, ht: `Kreye yon kont sou ${provider.name}` },
      { step: 2, en: 'Upload your media file', ht: 'Mete fichye medya ou a' },
      { step: 3, en: 'Get the public URL', ht: 'Jwenn URL piblik la' },
      { step: 4, en: 'Copy the URL', ht: 'Kopi URL la' },
      { step: 5, en: 'Paste it back in Atelnyo', ht: 'Kole l tounen nan Atelnyo' },
      { step: 6, en: 'Wait for validation', ht: 'Tann validasyon an' },
      { step: 7, en: 'Preview your media', ht: 'Aperçu medya ou' },
      { step: 8, en: 'Set visibility & publish', ht: 'Mete vizibilite & pibliye' },
    ],
    faq: [
      {
        question: { en: `Is ${provider.name} free?`, ht: `Èske ${provider.name} gratis?` },
        answer: { en: provider.free_plan || 'Yes, there is a free tier available.', ht: 'Wi, gen yon nivo gratis.' },
      },
      {
        question: { en: 'How do I get a public URL?', ht: 'Kijan pou m jwenn yon URL piblik?' },
        answer: { en: 'Upload your file to the provider and use the Share/Public Link option.', ht: 'Mete fichye ou a sou provider la epi itilize opsyon Share/Public Link.' },
      },
      {
        question: { en: 'Can I replace a URL later?', ht: 'Èske m ka ranplase yon URL pita?' },
        answer: { en: 'Yes. Just paste the new URL and re-validate. The system will detect the type.', ht: 'Wi. Jis kole nouvo URL la epi re-valide. Sistèm nan pral detekte kalite a.' },
      },
    ],
    common_errors: [
      {
        error: { en: 'URL not accessible', ht: 'URL pa aksesib' },
        cause: { en: 'The URL might be private or require authentication.', ht: 'URL la ka prive oswa bezwen otantifikasyon.' },
        fix: { en: 'Make sure the file is set to public or shared with "Anyone with the link".', ht: 'Asire fichye a mete an piblik oswa pataje ak "Anyone with the link".' },
      },
      {
        error: { en: 'Invalid file format', ht: 'Fòma fichye pa valid' },
        cause: { en: 'The file extension is not among supported types.', ht: 'Ekstansyon fichye a pa nan fòma sipòte yo.' },
        fix: { en: 'Convert to a supported format (JPEG, PNG, MP4, MP3, PDF).', ht: 'Konvèti nan yon fòma sipòte (JPEG, PNG, MP4, MP3, PDF).' },
      },
      {
        error: { en: 'File too large', ht: 'Fichye twò gwo' },
        cause: { en: 'Some providers have file size limits.', ht: 'Gen kèk provider ki gen limit sou gwosè fichye.' },
        fix: { en: 'Compress the file or upgrade your provider plan.', ht: 'Konprese fichye a oswa amelyore plan provider ou.' },
      },
    ],
    troubleshooting: [
      { en: 'Check your internet connection', ht: 'Tcheke koneksyon entènèt ou' },
      { en: 'Verify the file is still in your provider account', ht: 'Verifye fichye a toujou nan kont provider ou' },
      { en: 'The URL may have expired — upload again', ht: 'URL la ka ekspire — mete l ankò' },
      { en: 'Ensure the URL starts with https://', ht: 'Asire URL la kòmanse ak https://' },
    ],
    example_urls: [
      'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=800',
      'https://www.w3schools.com/html/mov_bbb.mp4',
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    ],
    wrong_urls: [
      { url: 'http://example.com/image.jpg', reason: 'Uses http:// instead of https://' },
      { url: 'file:///C:/Users/.../image.jpg', reason: 'Local file path — not publicly accessible' },
      { url: 'drive.google.com/file/d/.../view', reason: 'Google Drive viewing page, not direct image URL' },
    ],
    security_tips: [
      { en: 'Never share private or unlisted URLs publicly if they contain sensitive data.', ht: 'Pa janm pataje URL prive oswa gen done sansib an piblik.' },
      { en: 'Use HTTPS URLs only — they are encrypted.', ht: 'Itilize sèlman URL HTTPS — yo chifre.' },
      { en: 'Set expiry dates on temporary share links when possible.', ht: 'Mete dat ekspirasyon sou lyen pataj tanporè lè posib.' },
    ],
    contact_support: provider.website_url
      ? { en: `Visit ${provider.name} support at ${provider.website_url}`, ht: `Vizite sipò ${provider.name} nan ${provider.website_url}` }
      : { en: 'Visit the provider website for support.', ht: 'Vizite sit provider la pou sipò.' },
  };

  return (
    <div className="mpc-readme">
      <button type="button" className="mpc-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        {t('back_to_marketplace')}
      </button>

      <div className="mpc-readme-header">
        <ProviderLogo name={provider.name} size={48} />
        <div>
          <h2 className="mpc-readme-title">
            {t('readme_title')} — {provider.name}
          </h2>
          <p className="mpc-readme-subtitle">{t('readme_how_to')}</p>
        </div>
      </div>

      {/* Quick Jump Navigation */}
      <nav className="mpc-readme-nav" aria-label={isHt ? 'Navigasyon rapid' : 'Quick navigation'}>
        {README_SECTIONS.map((section) => (
          <button
            key={section}
            type="button"
            className={`mpc-readme-nav-btn${activeSection === section ? ' mpc-readme-nav-active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            <i className={`fas ${README_SECTION_ICONS[section] || 'fa-circle'}`} aria-hidden="true" />
            {isHt ? (README_SECTION_LABELS[section]?.ht || section) : (README_SECTION_LABELS[section]?.en || section)}
          </button>
        ))}
      </nav>

      <div className="mpc-readme-content">
        {/* Overview */}
        {activeSection === 'overview' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Apèsi' : 'Overview'}</h3>
            <p className="mpc-readme-p">{sections.overview}</p>
          </div>
        )}

        {/* Advantages */}
        {activeSection === 'advantages' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Avantaj' : 'Advantages'}</h3>
            <ul className="mpc-readme-ul">
              {sections.advantages.map((adv, i) => (
                <li key={i} className="mpc-readme-li"><i className="fas fa-check-circle mpc-readme-check" aria-hidden="true" /> {adv}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Limitations */}
        {activeSection === 'limitations' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Limit' : 'Limitations'}</h3>
            <ul className="mpc-readme-ul">
              {sections.limitations.map((lim, i) => (
                <li key={i} className="mpc-readme-li mpc-readme-li-warn"><i className="fas fa-exclamation-triangle" aria-hidden="true" /> {lim}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Supported Formats */}
        {activeSection === 'supported_formats' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Fòma Sipòte' : 'Supported Formats'}</h3>
            <div className="mpc-readme-formats">
              {sections.supported_formats.map((fmt, i) => (
                <span key={i} className="mpc-readme-format-badge">
                  <i className={`fas ${fmt === 'image' ? 'fa-image' : fmt === 'video' ? 'fa-video' : fmt === 'audio' ? 'fa-music' : 'fa-file-alt'}`} aria-hidden="true" />
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Step by Step */}
        {activeSection === 'step_by_step' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Gid Etap pa Etap' : 'Step by Step Guide'}</h3>
            <div className="mpc-readme-steps">
              {sections.step_by_step.map((s) => (
                <div key={s.step} className="mpc-readme-step-card">
                  <span className="mpc-readme-step-num">{s.step}</span>
                  <span>{isHt ? s.ht : s.en}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        {activeSection === 'faq' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Kesyon yo poze souvan' : 'FAQ'}</h3>
            <ReadmeFaqSection questions={sections.faq} lang={lang} />
          </div>
        )}

        {/* Common Errors */}
        {activeSection === 'common_errors' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Erè komen' : 'Common Errors'}</h3>
            {sections.common_errors.map((err, i) => (
              <ReadmeErrorCard key={i} error={err} index={i} />
            ))}
          </div>
        )}

        {/* Troubleshooting */}
        {activeSection === 'troubleshooting' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Depanaj' : 'Troubleshooting'}</h3>
            <ul className="mpc-readme-ul">
              {sections.troubleshooting.map((tip, i) => (
                <li key={i} className="mpc-readme-li"><i className="fas fa-wrench" aria-hidden="true" /> {isHt ? tip.ht : tip.en}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Example URLs */}
        {activeSection === 'example_urls' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Egzanp URL' : 'Example URLs'}</h3>
            <p className="mpc-readme-p">{isHt ? 'Men kèk egzanp URL ki valab :' : 'Here are some valid example URLs:'}</p>
            {sections.example_urls.map((url, i) => (
              <ReadmeUrlExample key={i} url={url} isValid={true} index={i} />
            ))}
          </div>
        )}

        {/* Wrong URLs */}
        {activeSection === 'wrong_urls' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Move URL' : 'Wrong URLs'}</h3>
            <p className="mpc-readme-p">{isHt ? 'Men egzanp URL ki pa ap mache :' : 'Here are examples of URLs that will NOT work:'}</p>
            {sections.wrong_urls.map((item, i) => (
              <ReadmeUrlExample key={i} url={item.url} isValid={false} index={i} />
            ))}
          </div>
        )}

        {/* Security Tips */}
        {activeSection === 'security_tips' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Konsèy Sekirite' : 'Security Tips'}</h3>
            <ul className="mpc-readme-ul">
              {sections.security_tips.map((tip, i) => (
                <li key={i} className="mpc-readme-li mpc-readme-li-sec"><i className="fas fa-shield-alt" aria-hidden="true" /> {isHt ? tip.ht : tip.en}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact Support */}
        {activeSection === 'contact_support' && (
          <div className="mpc-readme-section">
            <h3 className="mpc-readme-h3">{isHt ? 'Kontakte Sipò' : 'Contact Support'}</h3>
            <div className="mpc-readme-support-card">
              <i className="fas fa-headset" aria-hidden="true" />
              <p>{isHt ? sections.contact_support.ht : sections.contact_support.en}</p>
              {provider.website_url && (
                <a href={provider.website_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  <i className="fas fa-external-link-alt" aria-hidden="true" /> {isHt ? 'Vizite Sit' : 'Visit Site'}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mpc-readme-cta">
        <button type="button" className="btn-primary" onClick={() => onStartSetup(provider)}>
          <i className="fas fa-plug" aria-hidden="true" />
          {t('start_setup')}
        </button>
      </div>
    </div>
  );
}

// ─── Connect Wizard (5 steps) ──────────────────────────────────────────────

function ConnectWizard({ provider, t, onComplete, onBack }) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState(null);
  const [error, setError] = useState('');

  const totalSteps = 5;

  const handleNext = useCallback(() => {
    setError('');
    if (step < totalSteps) setStep((s) => s + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    setError('');
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const handleTestConnection = useCallback(async () => {
    if (!url.trim()) {
      setError(t('wizard_test_fail'));
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await mediaProviderService.validateUrl(url.trim());
      if (res.data?.is_valid) {
        setTestResult('success');
      } else {
        setTestResult('fail');
        setError(res.data?.error || t('wizard_test_fail'));
      }
    } catch (err) {
      setTestResult('fail');
      setError(err.response?.data?.error || t('wizard_test_fail'));
    } finally {
      setTesting(false);
    }
  }, [url, t]);

  const handleValidate = useCallback(async () => {
    if (!url.trim()) {
      setError(t('wizard_test_fail'));
      return;
    }
    setValidating(true);
    setValidateResult(null);
    setError('');
    try {
      const res = await mediaProviderService.detectProvider(url.trim());
      setValidateResult(res.data || { provider: '—' });
      handleNext();
    } catch (err) {
      setValidateResult({ provider: '—', error: err.response?.data?.error || t('wizard_test_fail') });
      handleNext();
    } finally {
      setValidating(false);
    }
  }, [url, t, handleNext]);

  return (
    <div className="mpc-wizard">
      <button type="button" className="mpc-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        {t('back_to_marketplace')}
      </button>

      <div className="mpc-wizard-header">
        <ProviderLogo name={provider.name} size={40} />
        <div>
          <h2 className="mpc-wizard-title">
            {t('wizard_title')}: {provider.name}
          </h2>
        </div>
      </div>

      {/* Step indicators */}
      <div className="mpc-wizard-steps" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div
              key={stepNum}
              className={classNames(
                'mpc-wizard-step-dot',
                isActive && 'mpc-wizard-step-active',
                isDone && 'mpc-wizard-step-done',
              )}
            >
              <span className="mpc-wizard-step-num">
                {isDone ? <i className="fas fa-check" /> : stepNum}
              </span>
              <span className="mpc-wizard-step-label">
                {t(`wizard_step_${stepNum}`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="mpc-wizard-body">
        {step === 1 && (
          <div className="mpc-wizard-step-content">
            <i className="fas fa-server mpc-wizard-step-icon" aria-hidden="true" />
            <h3>{t('wizard_step_1')}</h3>
            <p>{t('wizard_step_1_desc', { name: provider.name })}</p>
            <ul className="mpc-wizard-checklist">
              <li><i className="fas fa-user-check" aria-hidden="true" /> {t('creator')}</li>
              <li><i className="fas fa-id-card" aria-hidden="true" /> {t('admin')}</li>
            </ul>
          </div>
        )}

        {step === 2 && (
          <div className="mpc-wizard-step-content">
            <i className="fas fa-key mpc-wizard-step-icon" aria-hidden="true" />
            <h3>{t('wizard_step_2')}</h3>
            <p>{t('wizard_step_2_desc')}</p>
            <div className="mpc-wizard-field">
              <label className="mpc-wizard-field-label" htmlFor="wizard-url">
                {t('wizard_input_label')}
              </label>
              <input
                id="wizard-url"
                type="url"
                className="field-input"
                placeholder={t('wizard_input_placeholder')}
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); }}
              />
            </div>
          </div>
        )}            {step === 3 && (
          <div className="mpc-wizard-step-content">
            <i className="fas fa-plug mpc-wizard-step-icon" aria-hidden="true" />
            <h3>{t('wizard_step_3')}</h3>
            <p>{t('wizard_step_3_desc')}</p>
            <div className="mpc-wizard-field">
              <label className="mpc-wizard-field-label" htmlFor="wizard-test-url">
                {t('wizard_input_label')}
              </label>
              <input
                id="wizard-test-url"
                type="url"
                className="field-input"
                placeholder={t('wizard_input_placeholder')}
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={testing || !url.trim()}
              onClick={handleTestConnection}
            >
              {testing ? (
                <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('wizard_testing')}</>
              ) : (
                <><i className="fas fa-vial" aria-hidden="true" /> {t('wizard_test')}</>
              )}
            </button>
            {testResult === 'success' && (
              <div className="mpc-wizard-success">
                <i className="fas fa-check-circle" aria-hidden="true" />
                {t('wizard_test_success')}
              </div>
            )}
            {error && (
              <div className="mpc-wizard-error">
                <i className="fas fa-times-circle" aria-hidden="true" />
                {error}
              </div>
            )}
            {testResult !== 'success' && (
              <p className="mpc-wizard-hint" style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-secondary, #888)' }}>
                <i className="fas fa-info-circle" aria-hidden="true" />{' '}
                Run the test above to proceed to the next step.
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="mpc-wizard-step-content">
            <i className="fas fa-search mpc-wizard-step-icon" aria-hidden="true" />
            <h3>{t('wizard_step_4')}</h3>
            <p>{t('wizard_step_4_desc')}</p>
            <div className="mpc-wizard-detection">
              <div className="mpc-wizard-detection-item">
                <span className="mpc-wizard-detection-label">{t('validate_placeholder')}</span>
                <span className="mpc-wizard-detection-value">{url || '—'}</span>
              </div>
              <div className="mpc-wizard-detection-item">
                <span className="mpc-wizard-detection-label">{t('detected_provider')}</span>
                <span className="mpc-wizard-detection-value">
                  {validating ? <i className="fas fa-spinner fa-spin" /> : (validateResult?.provider || t('wizard_test_fail'))}
                </span>
              </div>
              {validateResult?.media_type && (
                <div className="mpc-wizard-detection-item">
                  <span className="mpc-wizard-detection-label">{t('media_type')}</span>
                  <span className="mpc-wizard-detection-value">{validateResult.media_type}</span>
                </div>
              )}
              {validateResult?.thumbnail_url && (
                <div className="mpc-wizard-detection-item">
                  <span className="mpc-wizard-detection-label">{t('thumbnail')}</span>
                  <img src={validateResult.thumbnail_url} alt="Preview" className="mpc-wizard-preview" />
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={validating || !url.trim()}
              onClick={handleValidate}
            >
              {validating ? (
                <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('wizard_testing')}</>
              ) : (
                <><i className="fas fa-check-double" aria-hidden="true" /> {t('wizard_validate')}</>
              )}
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="mpc-wizard-step-content mpc-wizard-done">
            <div className="mpc-wizard-success-icon">
              <i className="fas fa-check-circle" aria-hidden="true" />
            </div>
            <h3>{t('wizard_complete')}</h3>
            <p>{t('wizard_complete_desc', { name: provider.name })}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={onComplete}
            >
              <i className="fas fa-arrow-right" aria-hidden="true" />
              {t('wizard_go_to_center')}
            </button>
          </div>
        )}
      </div>

      {/* Step navigation */}
      {step < 5 && (
        <div className="mpc-wizard-nav">
          {step > 1 && (
            <button type="button" className="btn-secondary" onClick={handleBack}>
              <i className="fas fa-arrow-left" aria-hidden="true" />
              {t('back')}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={(step === 2 && !url.trim()) || (step === 3 && testResult !== 'success')}
            onClick={handleNext}
            style={{ marginLeft: 'auto' }}
          >
            {step === totalSteps - 1 ? t('wizard_validate') || 'Validate' : t('common_next') || 'Next'}
            <i className="fas fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Connected Providers ───────────────────────────────────────────────────

function ConnectedProviders({ providers, t, onDisconnect, onAddNew }) {
  if (!providers || providers.length === 0) {
    return (
      <div className="mpc-connected-empty">
        <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
        <p>{t('connected_empty')}</p>
        <button type="button" className="btn-primary" onClick={onAddNew}>
          <i className="fas fa-plus" aria-hidden="true" />
          {t('empty_cta')}
        </button>
      </div>
    );
  }

  return (
    <div className="mpc-connected-list">
      <div className="mpc-connected-header">
        <h3>{t('connected_title')}</h3>
        <button type="button" className="btn-primary" onClick={onAddNew}>
          <i className="fas fa-plus" aria-hidden="true" />
          {t('empty_cta')}
        </button>
      </div>
      {providers.map((p) => (
        <div key={p.id || p.key} className="mpc-connected-item">
          <ProviderLogo name={p.name} size={36} />
          <div className="mpc-connected-info">
            <span className="mpc-connected-name">{p.name}</span>
            <span className="mpc-connected-meta">
              {p.is_active ? (
                <span className="mpc-connected-status mpc-connected-status-active">
                  <i className="fas fa-circle" aria-hidden="true" /> {t('connected_status_active')}
                </span>
              ) : (
                <span className="mpc-connected-status mpc-connected-status-inactive">
                  <i className="fas fa-circle" aria-hidden="true" /> {t('connected_status_inactive')}
                </span>
              )}
              {p.connected_at && <span>· {fmtDate(p.connected_at)}</span>}
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary mpc-connected-disconnect"
            onClick={() => onDisconnect(p)}
          >
            <i className="fas fa-unlink" aria-hidden="true" />
            {t('connected_disconnect')}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── URL Validation — Step-by-Step ──────────────────────────────────────────
// Prompt 22 v2: Shows live progress: Checking URL... → Checking HTTPS... →
// Checking Provider... → Checking Accessibility... → Checking Media Type... →
// Generating Preview... → Reading Metadata... → Validation Complete

const VALIDATION_STEPS = [
  { key: 'url',        en: 'Checking URL format...',          ht: 'Ap tcheke fòma URL la...' },
  { key: 'https',      en: 'Checking HTTPS...',               ht: 'Ap tcheke HTTPS...' },
  { key: 'provider',   en: 'Detecting provider...',           ht: 'Ap detekte provider...' },
  { key: 'access',     en: 'Checking accessibility...',       ht: 'Ap tcheke aksesibilite...' },
  { key: 'mime',       en: 'Checking media type...',          ht: 'Ap tcheke kalite medya...' },
  { key: 'preview',    en: 'Generating preview...',           ht: 'Ap jenere aperçu...' },
  { key: 'metadata',   en: 'Reading metadata...',             ht: 'Ap li metadata...' },
  { key: 'done',       en: 'Validation Complete',             ht: 'Validasyon Finì' },
];

function ValidationProgress({ currentStep, lang }) {
  const isHt = lang === 'ht';
  const currentIndex = VALIDATION_STEPS.findIndex(s => s.key === currentStep);
  if (currentIndex < 0) return null;

  return (
    <div className="mpc-validation-progress" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={VALIDATION_STEPS.length}>
      {VALIDATION_STEPS.map((step, i) => {
        const isComplete = i < currentIndex;
        const isActive = i === currentIndex;
        const isPending = i > currentIndex;
        return (
          <div key={step.key} className={`mpc-vp-item${isComplete ? ' mpc-vp-done' : ''}${isActive ? ' mpc-vp-active' : ''}${isPending ? ' mpc-vp-pending' : ''}`}>
            <span className="mpc-vp-dot">
              {isComplete ? <i className="fas fa-check" /> : isActive ? <i className="fas fa-spinner fa-spin" /> : i + 1}
            </span>
            <span className="mpc-vp-label">
              {isHt ? step.ht : step.en}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Preview Page ───────────────────────────────────────────────────────────
// Shows full preview before save: thumbnail, dimensions, aspect ratio,
// provider, visibility, media type, estimated loading speed, file info.
// Creator can edit URL without restarting workflow.

function MediaPreview({ url, validationResult, onEditUrl, onSave, lang }) {
  const isHt = lang === 'ht';
  const r = validationResult || {};
  const isImage = r.mime_type?.startsWith?.('image/');
  const isVideo = r.mime_type?.startsWith?.('video/');
  const isAudio = r.mime_type?.startsWith?.('audio/');
  const aspectRatio = r.width && r.height ? (r.width / r.height).toFixed(2) : '—';

  return (
    <div className="mpc-preview-page">
      <h3 className="mpc-preview-title">
        <i className="fas fa-eye" aria-hidden="true" />
        {isHt ? 'Aperçu Medya' : 'Media Preview'}
      </h3>

      {/* URL Editor */}
      <div className="mpc-preview-url-edit">
        <label className="mpc-preview-url-label">
          {isHt ? 'URL Medya' : 'Media URL'}
        </label>
        <div className="mpc-preview-url-row">
          <input
            type="url"
            className="field-input mpc-preview-url-input"
            value={url}
            onChange={(e) => onEditUrl(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => onSave(r)}>
            <i className="fas fa-save" aria-hidden="true" /> {isHt ? 'Sove' : 'Save'}
          </button>
        </div>
      </div>

      {/* Preview Display */}
      <div className="mpc-preview-display">
        {isImage && r.thumbnail_url && (
          <img src={r.thumbnail_url} alt="Preview" className="mpc-preview-image" />
        )}
        {isVideo && r.thumbnail_url && (
          <div className="mpc-preview-video-wrap">
            <img src={r.thumbnail_url} alt="Video thumbnail" className="mpc-preview-image" />
            <div className="mpc-preview-play-overlay">
              <i className="fas fa-play-circle" aria-hidden="true" />
            </div>
          </div>
        )}
        {isAudio && (
          <div className="mpc-preview-audio-placeholder">
            <i className="fas fa-music" aria-hidden="true" />
            <p>{isHt ? 'Fichye Audio' : 'Audio File'}</p>
          </div>
        )}
        {!isImage && !isVideo && !isAudio && r.thumbnail_url && (
          <div className="mpc-preview-doc-placeholder">
            <i className="fas fa-file-alt" aria-hidden="true" />
            <p>{isHt ? 'Dokiman' : 'Document'}</p>
          </div>
        )}
        {!r.thumbnail_url && !r.mime_type && (
          <div className="mpc-preview-no-media">
            <i className="fas fa-question-circle" aria-hidden="true" />
            <p>{isHt ? 'Pa gen aperçu disponib' : 'No preview available'}</p>
          </div>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="mpc-preview-meta-grid">
        {r.mime_type && (
          <div className="mpc-preview-meta-item">
            <span className="mpc-preview-meta-label">{isHt ? 'Kalite' : 'Type'}</span>
            <span className="mpc-preview-meta-value">{r.mime_type}</span>
          </div>
        )}
        {r.width && r.height && (
          <>
            <div className="mpc-preview-meta-item">
              <span className="mpc-preview-meta-label">{isHt ? 'Dimansyon' : 'Dimensions'}</span>
              <span className="mpc-preview-meta-value">{r.width} × {r.height}px</span>
            </div>
            <div className="mpc-preview-meta-item">
              <span className="mpc-preview-meta-label">{isHt ? 'Rapò' : 'Aspect Ratio'}</span>
              <span className="mpc-preview-meta-value">{aspectRatio}</span>
            </div>
          </>
        )}
        {r.detected_provider && (
          <div className="mpc-preview-meta-item">
            <span className="mpc-preview-meta-label">{isHt ? 'Provider' : 'Provider'}</span>
            <span className="mpc-preview-meta-value">{r.detected_provider}</span>
          </div>
        )}
        {r.file_size != null && (
          <div className="mpc-preview-meta-item">
            <span className="mpc-preview-meta-label">{isHt ? 'Gwosè' : 'Size'}</span>
            <span className="mpc-preview-meta-value">
              {r.file_size > 1_000_000
                ? `${(r.file_size / 1_000_000).toFixed(1)} MB`
                : r.file_size > 1_000
                  ? `${(r.file_size / 1_000).toFixed(1)} KB`
                  : `${r.file_size} B`}
            </span>
          </div>
        )}
        {r.response_time_ms != null && (
          <div className="mpc-preview-meta-item">
            <span className="mpc-preview-meta-label">{isHt ? 'Vitès Chajman' : 'Load Speed'}</span>
            <span className={`mpc-preview-meta-value ${r.response_time_ms < 500 ? 'mpc-speed-fast' : r.response_time_ms < 2000 ? 'mpc-speed-ok' : 'mpc-speed-slow'}`}>
              {r.response_time_ms}ms
              {r.response_time_ms < 500 ? ` ✓` : r.response_time_ms < 2000 ? ` ⚠` : ` ✗`}
            </span>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mpc-preview-actions">
        <button type="button" className="btn-primary" onClick={() => onSave(r)}>
          <i className="fas fa-check-circle" aria-hidden="true" /> {isHt ? 'Konfime epi Sove' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  );
}

function URLValidation({ t }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [validationStep, setValidationStep] = useState(null); // current step key
  const [showPreview, setShowPreview] = useState(false);

  // ─── Step-by-step validation ─────────────────────────────────────
  // Order: make API call first, then animate steps on success only.
  // This prevents showing "Validation Complete" when the API fails.
  const handleValidate = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setShowPreview(false);

    try {
      const res = await mediaProviderService.validateUrl(url.trim());
      if (res.data?.is_valid) {
        setResult(res.data);
        // Animate through validation steps on success
        const steps = ['url', 'https', 'provider', 'access', 'mime', 'preview', 'metadata', 'done'];
        for (const step of steps) {
          setValidationStep(step);
          await new Promise(r => setTimeout(r, 200 + Math.random() * 200));
        }
      } else {
        setError(res.data?.error || t('validate_error'));
        setValidationStep(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || t('validate_error'));
      setValidationStep(null);
    } finally {
      setLoading(false);
    }
  }, [url, t]);

  const handlePreview = useCallback(() => {
    setShowPreview(true);
  }, []);

  const handleEditUrl = useCallback((newUrl) => {
    setUrl(newUrl);
    setResult(null);
    setError('');
  }, []);

  const handleSave = useCallback((data) => {
    // In a real implementation, this would call mediaProviderService.create()
    // with the validated URL data. For now, show a toast.
    setShowPreview(false);
    setResult(null);
    setUrl('');
    // Toast would be shown by parent
  }, []);

  return (
    <div className="mpc-validate">
      <h3 className="mpc-validate-title">
        <i className="fas fa-search" aria-hidden="true" />
        {t('validate_title')}
      </h3>
      <p className="mpc-validate-desc">{t('validate_desc')}</p>

      <div className="mpc-validate-input-row">
        <input
          type="url"
          className="field-input mpc-validate-input"
          placeholder={t('validate_placeholder')}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); setResult(null); setShowPreview(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleValidate(); }}
          aria-label={t('validate_placeholder')}
        />
        <button
          type="button"
          className="btn-primary mpc-validate-btn"
          disabled={loading || !url.trim()}
          onClick={handleValidate}
          aria-label={loading ? t('validate_validating') : t('validate_btn')}
        >
          {loading ? (
            <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {t('validate_validating')}</>
          ) : (
            <>{t('validate_btn')}</>
          )}
        </button>
      </div>

      {/* Step-by-step progress */}
      {loading && validationStep && (
        <ValidationProgress currentStep={validationStep} lang={'ht'} />
      )}

      {error && (
        <div className="mpc-validate-error" role="alert">
          <i className="fas fa-times-circle" aria-hidden="true" />
          <div>
            <strong>{t('validate_error')}</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {result && !showPreview && (
        <div className="mpc-validate-success">
          <div className="mpc-validate-success-header">
            <i className="fas fa-check-circle" aria-hidden="true" />
            <strong>{t('validate_success')}</strong>
          </div>
          <div className="mpc-validate-details">
            {result.detected_provider && (
              <div className="mpc-validate-detail-item">
                <span className="mpc-validate-detail-label">{t('detected_provider')}</span>
                <span className="mpc-validate-detail-value">
                  <span className="mpc-provider-badge">{result.detected_provider}</span>
                </span>
              </div>
            )}
            {result.mime_type && (
              <div className="mpc-validate-detail-item">
                <span className="mpc-validate-detail-label">{t('media_type')}</span>
                <span className="mpc-validate-detail-value">{result.mime_type}</span>
              </div>
            )}
            {result.width && result.height && (
              <div className="mpc-validate-detail-item">
                <span className="mpc-validate-detail-label">{t('dimensions')}</span>
                <span className="mpc-validate-detail-value">{result.width} × {result.height}</span>
              </div>
            )}
            {result.thumbnail_url && (
              <div className="mpc-validate-detail-item">
                <span className="mpc-validate-detail-label">{t('thumbnail')}</span>
                <img src={result.thumbnail_url} alt="Preview" className="mpc-validate-thumb" />
              </div>
            )}
          </div>
          <button type="button" className="btn-primary mpc-preview-btn" onClick={handlePreview}>
            <i className="fas fa-eye" aria-hidden="true" /> {t('thumbnail')}
          </button>
        </div>
      )}

      {/* Full Preview Page */}
      {showPreview && result && (
        <MediaPreview
          url={url}
          validationResult={result}
          onEditUrl={handleEditUrl}
          onSave={handleSave}
          lang="ht"
        />
      )}
    </div>
  );
}

// ─── ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function MediaProviderSection({ lang = 'ht', showToast }) {
  const t = useCallback((key, vars) => {
    let val = tLabel(key, lang);
    if (vars) {
      Object.keys(vars).forEach((k) => {
        val = val.replace(`{${k}}`, vars[k]);
      });
    }
    return val;
  }, [lang]);

  const [view, setView] = useState('loading'); // loading | empty | marketplace | detail | readme | wizard | connected | validate
  const [providers, setProviders] = useState([]);
  const [connectedProviders, setConnectedProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [readme, setReadme] = useState('');
  const [error, setError] = useState('');

  // ─── Load providers ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setError('');
    mediaProviderService.list()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.results || res.data || [];
        const list = Array.isArray(data) ? data : (data?.results || []);
        setProviders(list);
        // If there are connected providers, show connected view
        const active = list.filter((p) => p.is_active);
        setConnectedProviders(active);
        if (active.length > 0) {
          setView('connected');
        } else {
          setView('empty');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('loading_error'));
          setView('empty');
        }
      });
    return () => { cancelled = true; };
  }, [t]);

  // ─── Load readme ───────────────────────────────────────────────────
  const loadReadme = useCallback(async (provider) => {
    try {
      const res = await mediaProviderService.readme(provider.key);
      setReadme(res.data?.readme_md || res.data?.content || '');
    } catch {
      setReadme('');
    }
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleConnect = useCallback((provider) => {
    setSelectedProvider(provider);
    loadReadme(provider);
    setView('readme');
  }, [loadReadme]);

  const handleLearnMore = useCallback((provider) => {
    setSelectedProvider(provider);
    setView('detail');
  }, []);

  const handleStartSetup = useCallback((provider) => {
    setSelectedProvider(provider);
    setView('wizard');
  }, []);

  const handleWizardComplete = useCallback(() => {
    // Add the newly connected provider to the connected list
    if (selectedProvider) {
      setConnectedProviders((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.key === selectedProvider.key)) return prev;
        return [{ ...selectedProvider, is_active: true, connected_at: new Date().toISOString() }, ...prev];
      });
    }
    showToast?.(t('wizard_complete'), 'check');
    setView('connected');
  }, [showToast, t, selectedProvider]);

  const handleDisconnect = useCallback((provider) => {
    setConnectedProviders((prev) => prev.filter((p) => p.key !== provider.key));
    showToast?.(`${provider.name} disconnected`, 'info');
  }, [showToast]);

  const handleBackToMarketplace = useCallback(() => {
    setView('marketplace');
    setSelectedProvider(null);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setView('marketplace');
    setSelectedProvider(null);
  }, []);

  const handleBackFromReadme = useCallback(() => {
    setView('marketplace');
    setSelectedProvider(null);
  }, []);

  const handleBackFromWizard = useCallback(() => {
    setView('marketplace');
    setSelectedProvider(null);
  }, []);

  // ─── Render current view ───────────────────────────────────────────
  const renderView = () => {
    switch (view) {
      case 'loading':
        return <SkeletonCards count={6} />;

      case 'empty':
        return (
          <EmptyState
            t={t}
            onConnect={() => setView('marketplace')}
            onLearn={() => setView('marketplace')}
          />
        );

      case 'marketplace':
        return (
          <div className="mpc-marketplace">
            <div className="studio-section-header">
              <h2 className="studio-section-title">
                <i className="fas fa-cloud" aria-hidden="true" />
                {t('marketplace_title')}
              </h2>
            </div>
            <p className="mpc-marketplace-desc">{t('marketplace_desc')}</p>

            {error && (
              <div className="mpc-error-banner">
                <i className="fas fa-exclamation-circle" aria-hidden="true" />
                <span>{error}</span>
                <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
                  {t('retry')}
                </button>
              </div>
            )}

            {/* Recommended */}
            {providers.filter((p) => p.category === 'recommended').length > 0 && (
              <div className="mpc-category">
                <h3 className="mpc-category-title">{t('recommended')}</h3>
                <div className="mpc-grid">
                  {providers
                    .filter((p) => p.category === 'recommended')
                    .map((p) => (
                      <ProviderCard
                        key={p.id || p.key}
                        provider={p}
                        t={t}
                        onLearnMore={handleLearnMore}
                        onConnect={handleConnect}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Professional */}
            {providers.filter((p) => p.category === 'professional').length > 0 && (
              <div className="mpc-category">
                <h3 className="mpc-category-title">{t('professional')}</h3>
                <div className="mpc-grid">
                  {providers
                    .filter((p) => p.category === 'professional')
                    .map((p) => (
                      <ProviderCard
                        key={p.id || p.key}
                        provider={p}
                        t={t}
                        onLearnMore={handleLearnMore}
                        onConnect={handleConnect}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'detail':
        return selectedProvider ? (
          <ProviderDetail
            provider={selectedProvider}
            t={t}
            onBack={handleBackFromDetail}
            onStartSetup={handleStartSetup}
          />
        ) : (
          <EmptyState t={t} onConnect={() => setView('marketplace')} onLearn={() => {}} />
        );

      case 'readme':
        return selectedProvider ? (
          <ProviderReadme
            provider={selectedProvider}
            readme={readme}
            t={t}
            lang={lang}
            onBack={handleBackFromReadme}
            onStartSetup={handleStartSetup}
          />
        ) : (
          <EmptyState t={t} onConnect={() => setView('marketplace')} onLearn={() => {}} />
        );

      case 'wizard':
        return selectedProvider ? (
          <ConnectWizard
            provider={selectedProvider}
            t={t}
            onComplete={handleWizardComplete}
            onBack={handleBackFromWizard}
          />
        ) : (
          <EmptyState t={t} onConnect={() => setView('marketplace')} onLearn={() => {}} />
        );

      case 'connected':
        return (
          <ConnectedProviders
            providers={connectedProviders}
            t={t}
            onDisconnect={handleDisconnect}
            onAddNew={() => setView('marketplace')}
          />
        );

      case 'validate':
        return <URLValidation t={t} />;

      default:
        return <EmptyState t={t} onConnect={() => setView('marketplace')} onLearn={() => {}} />;
    }
  };

  return (
    <div className="studio-section mpc-section">
      <div className="studio-section-header">
        <h2 className="studio-section-title">
          <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
          {t('media_center')}
        </h2>
        <div className="mpc-header-actions">
          {(view === 'connected' || view === 'marketplace') && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setView('validate')}
              title={t('validate_title')}
            >
              <i className="fas fa-search" aria-hidden="true" />
              <span className="mpc-hide-mobile">{t('validate_title')}</span>
            </button>
          )}
          {view !== 'marketplace' && view !== 'loading' && view !== 'empty' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setView('marketplace')}
            >
              <i className="fas fa-store" aria-hidden="true" />
              <span className="mpc-hide-mobile">{t('marketplace_title')}</span>
            </button>
          )}
          {view === 'validate' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setView('connected')}
            >
              <i className="fas fa-arrow-left" aria-hidden="true" />
              {t('back')}
            </button>
          )}
        </div>
      </div>

      <p className="studio-section-subtitle" style={{ marginTop: -12, marginBottom: 16, fontWeight: 400 }}>
        <i className="fas fa-info-circle" aria-hidden="true" />
        {t('media_center_desc')}
      </p>

      {renderView()}
    </div>
  );
}
