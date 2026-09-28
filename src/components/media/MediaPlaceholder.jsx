/**
 * MediaPlaceholder — Plas-holdè pou eta vid.
 *
 * Montre:
 *   - Illustration (SVG)
 *   - Tit
 *   - Deskripsyon
 *   - How it Works (lis etap)
 *   - Supported Providers (lis provider)
 *   - Bouton "Choose Provider"
 *   - Lyen "Read Documentation"
 *   - Plas-holdè Video Tutorial
 *   - FAQ
 */
import React, { useState } from 'react';

export default function MediaPlaceholder({
  title,
  description,
  onChooseProvider,
  onReadDocs,
  lang = 'ht',
  variant = 'library',
  className = '',
}) {
  const [showFaq, setShowFaq] = useState(false);
  const isHt = lang === 'ht';

  const defaultTitle = isHt
    ? 'Konekte depo medya ou'
    : 'Connect your media storage';
  const defaultDesc = isHt
    ? 'Atelnyo pa estoke gwo fichye medya ou yo. Nou itilize sèlman URL piblik ou kontwole.'
    : 'Atelnyo does not store your large media files. We only use public URLs that you control.';

  const howItWorks = isHt
    ? [
      'Chwazi yon provider depo medya',
      'Kreye yon kont sou provider la (si ou poko genyen)',
      'Mete medya ou a sou provider la',
      'Jwenn URL piblik la',
      'Kole URL la nan Atelnyo',
      'Verifye URL la epi pibliye',
    ]
    : [
      'Choose a media storage provider',
      'Create an account on the provider (if you don\'t have one)',
      'Upload your media to the provider',
      'Get the public URL',
      'Paste the URL in Atelnyo',
      'Validate and publish',
    ];

  const supportedProviders = [
    { name: 'ImgBB', icon: 'fa-image', type: 'image' },
    { name: 'ImageKit', icon: 'fa-images', type: 'image,video' },
    { name: 'Cloudinary', icon: 'fa-cloud', type: 'all' },
    { name: 'Cloudflare R2', icon: 'fa-globe', type: 'all' },
    { name: 'AWS S3', icon: 'fa-server', type: 'all' },
    { name: 'YouTube', icon: 'fa-video', type: 'video' },
    { name: 'Vimeo', icon: 'fa-film', type: 'video' },
    { name: 'GitHub', icon: 'fa-code', type: 'all' },
    { name: 'Dropbox', icon: 'fa-dropbox', type: 'all' },
  ];

  const faqItems = isHt
    ? [
      { q: 'Kisa sa ye "Media Provider" la?', a: 'Se yon sèvis ekstèn kote ou estoke medya ou (imaj, videyo, odyo, dokiman). Atelnyo itilize URL piblik ou bay la pou montre medya ou.' },
      { q: 'Poukisa Atelnyo pa estoke medya direkteman?', a: 'Pou kenbe platfòm nan lejè, rapid, ak pri-efikas. Epitou, ou gen tout kontwòl sou medya ou yo.' },
      { q: 'Ki provider m ta dwe itilize?', a: 'Nou rekòmande ImgBB (gratis, senp), Cloudinary (pwofesyonèl), oswa yon sèvis S3.' },
      { q: 'Èske m ka chanje provider pita?', a: 'Wi. Ou ka ajoute nouvo URL nan nenpòt moman, menm si ou deja gen medya nan yon lòt provider.' },
    ]
    : [
      { q: 'What is a "Media Provider"?', a: 'An external service where you store your media (images, videos, audio, documents). Atelnyo uses the public URL you provide to display your media.' },
      { q: 'Why doesn\'t Atelnyo store media directly?', a: 'To keep the platform lightweight, fast, and cost-effective. Plus you have full control over your media files.' },
      { q: 'Which provider should I use?', a: 'We recommend ImgBB (free, simple), Cloudinary (professional), or an S3-compatible service.' },
      { q: 'Can I change providers later?', a: 'Yes. You can add new URLs at any time, even if you already have media from another provider.' },
    ];

  return (
    <div className={`media-placeholder ${className}`} role="status">
      {/* ─── Illustration ─────────────────────────────────────── */}
      <div className="media-placeholder-illustration" aria-hidden="true">
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="20" width="120" height="90" rx="10" fill="var(--media-placeholder-fill, rgba(216,27,96,0.08))" stroke="var(--media-placeholder-stroke, rgba(216,27,96,0.3))" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="100" cy="55" r="16" fill="var(--media-placeholder-accent, rgba(216,27,96,0.15))" />
          <polygon points="100,43 108,58 92,58" fill="var(--media-placeholder-accent-solid, rgba(216,27,96,0.4))" />
          <rect x="70" y="82" width="60" height="16" rx="3" fill="var(--media-placeholder-accent, rgba(216,27,96,0.12))" />
          <line x1="75" y1="90" x2="100" y2="90" stroke="var(--media-placeholder-accent-solid, rgba(216,27,96,0.3))" strokeWidth="2" strokeLinecap="round" />
          <rect x="55" y="0" width="25" height="40" rx="5" fill="var(--media-placeholder-accent, rgba(216,27,96,0.08))" />
          <rect x="120" y="0" width="25" height="40" rx="5" fill="var(--media-placeholder-accent, rgba(216,27,96,0.08))" />
        </svg>
      </div>

      {/* ─── Text ─────────────────────────────────────────────── */}
      <h3 className="media-placeholder-title">{title || defaultTitle}</h3>
      <p className="media-placeholder-desc">{description || defaultDesc}</p>

      {/* ─── How it Works ─────────────────────────────────────── */}
      <div className="media-placeholder-section">
        <h4 className="media-placeholder-section-title">
          <i className="fas fa-list-ol" aria-hidden="true" />
          {isHt ? 'Kijan li mache' : 'How it Works'}
        </h4>
        <ol className="media-placeholder-steps">
          {howItWorks.map((step, i) => (
            <li key={i} className="media-placeholder-step">{step}</li>
          ))}
        </ol>
      </div>

      {/* ─── Supported Providers ──────────────────────────────── */}
      <div className="media-placeholder-section">
        <h4 className="media-placeholder-section-title">
          <i className="fas fa-cloud" aria-hidden="true" />
          {isHt ? 'Providers Sipòte' : 'Supported Providers'}
        </h4>
        <div className="media-placeholder-providers">
          {supportedProviders.map((p, i) => (
            <span key={i} className="media-placeholder-provider-chip">
              <i className={`fas ${p.icon}`} aria-hidden="true" />
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Buttons ──────────────────────────────────────────── */}
      <div className="media-placeholder-actions">
        {onChooseProvider && (
          <button type="button" className="btn-primary" onClick={onChooseProvider}>
            <i className="fas fa-plug" aria-hidden="true" />
            {isHt ? 'Chwazi Provider' : 'Choose Provider'}
          </button>
        )}
        {onReadDocs && (
          <button type="button" className="btn-secondary" onClick={onReadDocs}>
            <i className="fas fa-book" aria-hidden="true" />
            {isHt ? 'Li Dokimantasyon' : 'Read Documentation'}
          </button>
        )}
      </div>

      {/* ─── Video Tutorial Placeholder ───────────────────────── */}
      <div className="media-placeholder-video">
        <div className="media-placeholder-video-thumb">
          <i className="fas fa-play-circle" aria-hidden="true" />
          <span>{isHt ? 'Tutorial Videyo prèsto' : 'Video Tutorial Coming Soon'}</span>
        </div>
      </div>

      {/* ─── FAQ ──────────────────────────────────────────────── */}
      <div className="media-placeholder-faq">
        <button
          type="button"
          className="media-placeholder-faq-toggle"
          onClick={() => setShowFaq(!showFaq)}
          aria-expanded={showFaq}
        >
          <i className={`fas fa-chevron-${showFaq ? 'up' : 'down'}`} aria-hidden="true" />
          {isHt ? 'Kesyon yo poze souvan' : 'FAQ'}
        </button>
        {showFaq && (
          <div className="media-placeholder-faq-items">
            {faqItems.map((item, i) => (
              <div key={i} className="media-placeholder-faq-item">
                <strong className="media-placeholder-faq-q">{item.q}</strong>
                <p className="media-placeholder-faq-a">{item.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
