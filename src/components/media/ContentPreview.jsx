/**
 * ContentPreview — Pre-publish content preview.
 *
 * Shows: Title, Description, Media, Layout, Buttons, Cards, Theme,
 * Dark Mode, Light Mode, Mobile, Tablet, Desktop.
 *
 * Creator sees exactly what the end user will see before publishing.
 */
import React, { useState } from 'react';
import MediaPreview from './MediaPreview';

export default function ContentPreview({
  formData = {},
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [previewMode, setPreviewMode] = useState('desktop');
  const [previewTheme, setPreviewTheme] = useState('light');

  const previewClass = `cp-frame cp-frame--${previewMode} cp-theme--${previewTheme}`;

  return (
    <div className={`cp-container ${className}`}>
      <div className="cp-header">
        <h3 className="cp-title">
          <i className="fas fa-eye" />
          {isHt ? 'Aperçu Kontni' : 'Content Preview'}
        </h3>
        <p className="cp-hint">
          {isHt
            ? 'Wè egzakteman sa itilizatè w ap wè anvan piblikasyon.'
            : 'See exactly what your audience will see before publishing.'}
        </p>
      </div>

      {/* Toolbar */}
      <div className="cp-toolbar">
        <div className="cp-toolbar-group">
          <span className="cp-toolbar-label">{isHt ? 'Ekipman' : 'Device'}</span>
          <div className="cp-toolbar-btns">
            {[
              { id: 'mobile', icon: 'fa-mobile-alt' },
              { id: 'tablet', icon: 'fa-tablet-alt' },
              { id: 'desktop', icon: 'fa-desktop' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`cp-toolbar-btn ${previewMode === d.id ? 'cp-toolbar-active' : ''}`}
                onClick={() => setPreviewMode(d.id)}
                title={d.id}
              >
                <i className={`fas ${d.icon}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="cp-toolbar-group">
          <span className="cp-toolbar-label">{isHt ? 'Tèm' : 'Theme'}</span>
          <div className="cp-toolbar-btns">
            <button
              type="button"
              className={`cp-toolbar-btn ${previewTheme === 'light' ? 'cp-toolbar-active' : ''}`}
              onClick={() => setPreviewTheme('light')}
            >
              <i className="fas fa-sun" /> {isHt ? 'Limyè' : 'Light'}
            </button>
            <button
              type="button"
              className={`cp-toolbar-btn ${previewTheme === 'dark' ? 'cp-toolbar-active' : ''}`}
              onClick={() => setPreviewTheme('dark')}
            >
              <i className="fas fa-moon" /> {isHt ? 'Fè nwa' : 'Dark'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Frame */}
      <div className={previewClass}>
        <div className="cp-content">
          {/* Title */}
          <h1 className="cp-content-title">
            {formData.title || (isHt ? 'Tit Kontni' : 'Content Title')}
          </h1>

          {/* Subtitle */}
          {formData.subtitle && (
            <p className="cp-content-subtitle">{formData.subtitle}</p>
          )}

          {/* Metadata */}
          <div className="cp-content-meta">
            {formData.category && (
              <span className="cp-content-tag">{formData.category}</span>
            )}
            {formData.language && (
              <span className="cp-content-tag">{formData.language === 'ht' ? 'Kreyòl' : formData.language === 'fr' ? 'Français' : 'English'}</span>
            )}
            <span className="cp-content-date">{new Date().toLocaleDateString()}</span>
          </div>

          {/* Media Grid */}
          {formData.media && formData.media.length > 0 && (
            <div className="cp-content-media">
              <div className={`cp-media-grid cp-media-grid--${Math.min(formData.media.length, 3)}`}>
                {formData.media.slice(0, 6).map((m, i) => (
                  <div key={i} className="cp-media-item">
                    <MediaPreview data={m} lang={lang} />
                  </div>
                ))}
              </div>
              {formData.media.length > 6 && (
                <p className="cp-media-more">
                  +{formData.media.length - 6} {isHt ? 'plis medya' : 'more media'}
                </p>
              )}
            </div>
          )}

          {/* Featured Media */}
          {formData.featuredMedia && !formData.media?.length && (
            <div className="cp-content-media">
              <div className="cp-media-grid cp-media-grid--1">
                <div className="cp-media-item">
                  <MediaPreview data={formData.featuredMedia} lang={lang} />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="cp-content-body">
            <p className="cp-content-description">
              {formData.description || (isHt ? 'Deskripsyon kontni w pral parèt isit la.' : 'Your content description will appear here.')}
            </p>
          </div>

          {/* Tags */}
          {formData.tags && formData.tags.length > 0 && (
            <div className="cp-content-tags">
              {formData.tags.map((tag, i) => (
                <span key={i} className="cp-tag">#{tag}</span>
              ))}
            </div>
          )}

          {/* Visibility Badge */}
          <div className="cp-content-footer">
            <span className="cp-visibility-badge">
              <i className={`fas ${formData.visibility === 'public' ? 'fa-globe' : formData.visibility === 'private' ? 'fa-lock' : formData.visibility === 'followers' ? 'fa-users' : 'fa-eye'}`} />
              {formData.visibility || 'public'}
            </span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="cp-bottom-hint">
        <i className="fas fa-info-circle" />
        {isHt
          ? 'Sa a se yon aperçu. Kontni final la ka parèt yon ti kòt diferan selon modil la.'
          : 'This is a preview. The final content may appear slightly different depending on the module.'}
      </p>
    </div>
  );
}
