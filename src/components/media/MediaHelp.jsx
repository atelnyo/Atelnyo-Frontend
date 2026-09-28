/**
 * MediaHelp — Bouton èd kontèks pou chak ekran medya.
 *
 * Chak ekran dwe genyen: Help Button, Tutorial, FAQ,
 * Troubleshooting, Contact Support, Documentation, Video Guide.
 */
import React, { useState } from 'react';

const HELP_CONTENT = {
  library: {
    titleEn: 'Media Library Help',
    titleHt: 'Èd Bibliyotèk Medya',
    icon: 'fa-photo-video',
    tutorial: {
      en: 'Your Media Library shows all URLs you have connected. You can filter by type, check health status, replace broken URLs, and manage references.',
      ht: 'Bibliyotèk Medya ou montre tout URL ou konekte. Ou ka filtre pa kalite, tcheke estati sante, ranplase URL kase, epi jere referans.',
    },
    faq: [
      { q: { en: 'How do I add media?', ht: 'Kijan pou m ajoute medya?' }, a: { en: 'Click "Add Media" and paste a public URL from your provider.', ht: 'Klike "Ajoute Medya" epi kole yon URL piblik soti nan provider ou.' } },
      { q: { en: 'What does "broken" mean?', ht: 'Kisa "kase" vle di?' }, a: { en: 'The URL is not accessible. The file may have been moved or deleted.', ht: 'URL la pa aksesib. Fichye a ka te deplase oswa efase.' } },
    ],
  },
  collections: {
    titleEn: 'Collections Help',
    titleHt: 'Èd Koleksyon',
    icon: 'fa-folder',
    tutorial: {
      en: 'Collections help you organize your media. Create collections by project, type, or theme. Adding media to a collection does not move or copy the file.',
      ht: 'Koleksyon ede ou òganize medya ou. Kreye koleksyon pa pwojè, kalite, oswa tèm. Ajoute medya nan yon koleksyon pa deplase oswa kopi fichye a.',
    },
  },
  detail: {
    titleEn: 'Media Detail Help',
    titleHt: 'Èd Detay Medya',
    icon: 'fa-info-circle',
    tutorial: {
      en: 'The detail panel shows everything about your media: preview, metadata, where it\'s used, and its history. You can replace the URL, copy it, or remove the reference.',
      ht: 'Panno detay la montre tout bagay sou medya ou: preview, metadone, kote li itilize, ak istwa li. Ou ka ranplase URL la, kopi li, oswa retire referans lan.',
    },
  },
};

export default function MediaHelp({ context = 'library', lang = 'ht', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tutorial');
  const isHt = lang === 'ht';
  const content = HELP_CONTENT[context] || HELP_CONTENT.library;

  const tabs = [
    { id: 'tutorial', icon: 'fa-book', labelEn: 'Tutorial', labelHt: 'Toryèl' },
    { id: 'faq', icon: 'fa-question-circle', labelEn: 'FAQ', labelHt: 'FAQ' },
    { id: 'troubleshooting', icon: 'fa-wrench', labelEn: 'Troubleshooting', labelHt: 'Depanaj' },
    { id: 'contact', icon: 'fa-headset', labelEn: 'Contact', labelHt: 'Kontak' },
  ];

  if (!isOpen) {
    return (
      <button
        type="button"
        className={`media-help-trigger ${className}`}
        onClick={() => setIsOpen(true)}
        title={isHt ? 'Èd' : 'Help'}
        aria-label={isHt ? 'Èd' : 'Help'}
      >
        <i className="fas fa-question-circle" />
      </button>
    );
  }

  return (
    <div className="media-help-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
      <div className="media-help-modal" role="dialog" aria-label={isHt ? 'Èd' : 'Help'}>
        <div className="media-help-header">
          <div className="media-help-header-icon">
            <i className={`fas ${content.icon}`} />
          </div>
          <h3 className="media-help-title">{isHt ? content.titleHt : content.titleEn}</h3>
          <button type="button" className="media-help-close" onClick={() => setIsOpen(false)}>
            <i className="fas fa-times" />
          </button>
        </div>

        <nav className="media-help-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`media-help-tab ${activeTab === tab.id ? 'media-help-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fas ${tab.icon}`} />
              {isHt ? tab.labelHt : tab.labelEn}
            </button>
          ))}
        </nav>

        <div className="media-help-body">
          {activeTab === 'tutorial' && (
            <div className="media-help-section">
              <p className="media-help-text">{isHt ? content.tutorial.ht : content.tutorial.en}</p>
              <div className="media-help-video-placeholder">
                <i className="fas fa-play-circle" />
                <span>{isHt ? 'Pa gen videyo dispo pou kounye a.' : 'No video available at this time.'}</span>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="media-help-section">
              {(content.faq || []).map((item, i) => (
                <details key={i} className="media-help-faq-item">
                  <summary className="media-help-faq-q">
                    {isHt ? item.q.ht : item.q.en}
                  </summary>
                  <p className="media-help-faq-a">
                    {isHt ? item.a.ht : item.a.en}
                  </p>
                </details>
              ))}
              {(!content.faq || content.faq.length === 0) && (
                <p className="media-help-empty">{isHt ? 'Pa gen FAQ pou ekran sa a.' : 'No FAQ for this screen.'}</p>
              )}
            </div>
          )}

          {activeTab === 'troubleshooting' && (
            <div className="media-help-section">
              <ul className="media-help-troubleshoot-list">
                <li>{isHt ? 'Tcheke koneksyon entènèt ou' : 'Check your internet connection'}</li>
                <li>{isHt ? 'Verifye fichye a toujou sou provider ou' : 'Verify the file is still on your provider'}</li>
                <li>{isHt ? 'Eseye yon lòt provider' : 'Try a different provider'}</li>
                <li>{isHt ? 'Kontakte sipò si pwoblèm nan pèsiste' : 'Contact support if the issue persists'}</li>
              </ul>
              <a
                href="/docs/media"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ marginTop: 12 }}
              >
                <i className="fas fa-book" />
                {isHt ? 'Li Dokimantasyon' : 'Read Documentation'}
              </a>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="media-help-section">
              <p className="media-help-text">
                {isHt
                  ? 'Si w bezwen èd anplis, kontakte ekip sipò atelnyo.'
                  : 'If you need additional help, contact the Atelnyo support team.'}
              </p>
              <a
                href="mailto:support@atelnyo.site"
                className="btn-primary"
                style={{ marginTop: 8 }}
              >
                <i className="fas fa-envelope" />
                {isHt ? 'Voye yon imèl' : 'Send an email'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
