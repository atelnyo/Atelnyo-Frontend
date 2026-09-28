/**
 * UniversalContentBuilder — Reusable multi-step content creation workflow.
 *
 * Used by: Courses, Marketplace, Music, Portfolio, Communities, Events,
 * Podcasts, Documents, Certificates, Spotlight, Homepage CMS, Admin CMS.
 *
 * Steps:
 *   1. Basic Information (title, description, tags, category)
 *   2. Media (pick existing or create new via Media Picker)
 *   3. Description (detailed / rich text)
 *   4. Visibility (public, private, followers, etc.)
 *   5. SEO (slug, meta description, OG image)
 *   6. Preview (see how it looks before publishing)
 *   7. Publish (quality check → publish → done)
 *
 * Each module passes its own field config so this component
 * can adapt to any content type without modification.
 */
import React, { useState, useCallback, useMemo } from 'react';
import SmartMediaSuggestions from './SmartMediaSuggestions';
import ContentPreview from './ContentPreview';
import ContentQualityChecker from './ContentQualityChecker';
import MediaPicker from './MediaPicker';

// ─── Default Steps ─────────────────────────────────────────────────────

const DEFAULT_STEPS = [
  { id: 'basic', icon: 'fa-info-circle', labelEn: 'Basic Info', labelHt: 'Enfòmasyon Debaz' },
  { id: 'media', icon: 'fa-photo-video', labelEn: 'Media', labelHt: 'Medya' },
  { id: 'description', icon: 'fa-align-left', labelEn: 'Description', labelHt: 'Deskripsyon' },
  { id: 'visibility', icon: 'fa-eye', labelEn: 'Visibility', labelHt: 'Vizibilite' },
  { id: 'seo', icon: 'fa-search', labelEn: 'SEO', labelHt: 'SEO' },
  { id: 'preview', icon: 'fa-eye', labelEn: 'Preview', labelHt: 'Aperçu' },
  { id: 'publish', icon: 'fa-globe', labelEn: 'Publish', labelHt: 'Pibliye' },
];

// ─── Visibility Options ────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: 'public', icon: 'fa-globe', labelEn: 'Public', labelHt: 'Piblik', descEn: 'Anyone can see', descHt: 'Tout moun ka wè' },
  { value: 'followers', icon: 'fa-users', labelEn: 'Followers', labelHt: 'Swivè', descEn: 'Followers only', descHt: 'Swivè sèlman' },
  { value: 'students', icon: 'fa-graduation-cap', labelEn: 'Students', labelHt: 'Elèv', descEn: 'Enrolled students only', descHt: 'Elèv enskri sèlman' },
  { value: 'customers', icon: 'fa-shopping-cart', labelEn: 'Customers', labelHt: 'Kliyan', descEn: 'Customers only', descHt: 'Kliyan sèlman' },
  { value: 'community', icon: 'fa-users-cog', labelEn: 'Community', labelHt: 'Kominote', descEn: 'Community members only', descHt: 'Manm kominote sèlman' },
  { value: 'premium', icon: 'fa-crown', labelEn: 'Premium', labelHt: 'Premium', descEn: 'Premium subscribers only', descHt: 'Abònn premium sèlman' },
  { value: 'private', icon: 'fa-lock', labelEn: 'Private', labelHt: 'Prive', descEn: 'Only you', descHt: 'Ou sèlman' },
  { value: 'schedule', icon: 'fa-clock', labelEn: 'Scheduled', labelHt: 'Pwograme', descEn: 'Publish at a specific date', descHt: 'Pibliye nan yon dat espesifik' },
];


export default function UniversalContentBuilder({
  moduleName = '',
  moduleIcon = 'fa-cube',
  steps = DEFAULT_STEPS,
  fields = {},
  mediaItems = [],
  onSubmit,
  onCancel,
  lang = 'ht',
  className = '',
}) {
  const isHt = lang === 'ht';
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    title: fields.title || '',
    subtitle: fields.subtitle || '',
    description: fields.description || '',
    tags: fields.tags || [],
    category: fields.category || '',
    visibility: fields.visibility || 'public',
    scheduleDate: fields.scheduleDate || '',
    slug: fields.slug || '',
    metaDescription: fields.metaDescription || '',
    ogImage: fields.ogImage || '',
    media: fields.media || [],
    featuredMedia: fields.featuredMedia || null,
    language: fields.language || 'ht',
  });
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const updateField = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleMediaSelect = useCallback((media) => {
    setFormData((prev) => {
      const currentMedia = Array.isArray(prev.media) ? prev.media : [];
      if (Array.isArray(media)) {
        return { ...prev, media: [...currentMedia, ...media] };
      }
      return { ...prev, media: [...currentMedia, media] };
    });
    setShowMediaPicker(false);
  }, []);

  const removeMedia = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }));
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      if (onSubmit) await onSubmit(formData);
      setPublished(true);
    } catch (err) {
      // Error handled by parent
    } finally {
      setPublishing(false);
    }
  };

  const canProceed = useMemo(() => {
    const step = steps[currentStep];
    if (!step) return true;
    switch (step.id) {
      case 'basic': return formData.title.trim().length > 0;
      case 'media': return formData.media.length > 0;
      case 'description': return formData.description.trim().length > 0;
      case 'visibility': return true;
      case 'seo': return true;
      case 'preview': return true;
      case 'publish': return true;
      default: return true;
    }
  }, [currentStep, steps, formData]);

  const progress = ((currentStep + 1) / steps.length) * 100;

  // ─── Render Step Content ─────────────────────────────────────────

  const renderStep = () => {
    if (published) {
      return (
        <div className="cb-published">
          <div className="cb-published-icon">
            <i className="fas fa-check-circle" />
          </div>
          <h2 className="cb-published-title">
            {isHt ? 'Pibliye avèk siksè!' : 'Published successfully!'}
          </h2>
          <p className="cb-published-desc">
            {isHt
              ? 'Kontni ou te kreye a kounye a disponib sou platfòm nan.'
              : 'Your content is now available on the platform.'}
          </p>
          <button type="button" className="btn-primary" onClick={onCancel}>
            <i className="fas fa-th-large" />
            {isHt ? 'Retounen nan tablo' : 'Back to dashboard'}
          </button>
        </div>
      );
    }

    const step = steps[currentStep];
    if (!step) return null;

    switch (step.id) {
      // ─── STEP 1: Basic Information ─────────────────────────────
      case 'basic':
        return (
          <div className="cb-step">
            <div className="cb-field">
              <label className="cb-label">
                {isHt ? 'Tit' : 'Title'} <span className="cb-required">*</span>
              </label>
              <input
                type="text"
                className="cb-input"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder={isHt ? 'Antre yon tit pou kontni w...' : 'Enter a title for your content...'}
                autoFocus
              />
            </div>
            <div className="cb-field">
              <label className="cb-label">{isHt ? 'Sou-tit' : 'Subtitle'}</label>
              <input
                type="text"
                className="cb-input"
                value={formData.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder={isHt ? 'Yon sou-tit si ou vle...' : 'An optional subtitle...'}
              />
            </div>
            <div className="cb-field-row">
              <div className="cb-field cb-field-half">
                <label className="cb-label">{isHt ? 'Kategori' : 'Category'}</label>
                <select
                  className="cb-input"
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value)}
                >
                  <option value="">{isHt ? '— Chwazi —' : '— Select —'}</option>
                  <option value="education">{isHt ? 'Edikasyon' : 'Education'}</option>
                  <option value="entertainment">{isHt ? 'Divètisman' : 'Entertainment'}</option>
                  <option value="music">{isHt ? 'Mizik' : 'Music'}</option>
                  <option value="technology">{isHt ? 'Teknoloji' : 'Technology'}</option>
                  <option value="art">{isHt ? 'Atis' : 'Art'}</option>
                  <option value="business">{isHt ? 'Biznis' : 'Business'}</option>
                </select>
              </div>
              <div className="cb-field cb-field-half">
                <label className="cb-label">{isHt ? 'Lang' : 'Language'}</label>
                <select
                  className="cb-input"
                  value={formData.language}
                  onChange={(e) => updateField('language', e.target.value)}
                >
                  <option value="ht">{isHt ? 'Kreyòl' : 'Creole'}</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
          </div>
        );

      // ─── STEP 2: Media ────────────────────────────────────────
      case 'media':
        return (
          <div className="cb-step">
            <SmartMediaSuggestions
              mediaItems={mediaItems}
              onSelect={(item) => handleMediaSelect(item)}
              lang={lang}
            />
            <div className="cb-media-divider">
              <span>{isHt ? ' Oswa ' : ' OR '}</span>
            </div>
            <button
              type="button"
              className="btn-primary cb-add-media-btn"
              onClick={() => setShowMediaPicker(true)}
            >
              <i className="fas fa-plus" />
              {isHt ? 'Ajoute Nouvo Medya' : 'Add New Media'}
            </button>
            {formData.media.length > 0 && (
              <div className="cb-media-list">
                {formData.media.map((m, i) => (
                  <div key={i} className="cb-media-chip">
                    <i className={`fas ${m.media_type === 'image' ? 'fa-image' : m.media_type === 'video' ? 'fa-video' : m.media_type === 'audio' ? 'fa-music' : 'fa-file'}`} />
                    <span>{m.title || m.url?.slice(0, 50) || `Media #${i + 1}`}</span>
                    <button type="button" className="cb-media-remove" onClick={() => removeMedia(i)}>
                      <i className="fas fa-times" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showMediaPicker && (
              <MediaPicker
                onSelect={handleMediaSelect}
                onCancel={() => setShowMediaPicker(false)}
                multiSelect
                lang={lang}
              />
            )}
          </div>
        );

      // ─── STEP 3: Description ──────────────────────────────────
      case 'description':
        return (
          <div className="cb-step">
            <div className="cb-field">
              <label className="cb-label">
                {isHt ? 'Deskripsyon' : 'Description'} <span className="cb-required">*</span>
              </label>
              <textarea
                className="cb-textarea"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={isHt ? 'Dekri kontni w an detay...' : 'Describe your content in detail...'}
                rows={6}
              />
            </div>
            <div className="cb-field">
              <label className="cb-label">{isHt ? 'Tags' : 'Tags'}</label>
              <div className="cb-tags">
                <input
                  type="text"
                  className="cb-input"
                  placeholder={isHt ? 'Antre yon tag epi peze Enter' : 'Type a tag and press Enter'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.target.value.trim();
                      if (val && !formData.tags.includes(val)) {
                        updateField('tags', [...formData.tags, val]);
                      }
                      e.target.value = '';
                    }
                  }}
                />
                <div className="cb-tag-list">
                  {formData.tags.map((tag, i) => (
                    <span key={i} className="cb-tag">
                      {tag}
                      <button type="button" className="cb-tag-remove" onClick={() => updateField('tags', formData.tags.filter((_, j) => j !== i))}>
                        <i className="fas fa-times" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      // ─── STEP 4: Visibility ──────────────────────────────────
      case 'visibility':
        return (
          <div className="cb-step">
            <p className="cb-step-hint">
              {isHt ? 'Chwazi ki moun ki kapab wè kontni w:' : 'Choose who can see your content:'}
            </p>
            <div className="cb-visibility-grid">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`cb-visibility-card ${formData.visibility === opt.value ? 'cb-visibility-active' : ''}`}
                  onClick={() => {
                    updateField('visibility', opt.value);
                    if (opt.value !== 'schedule') updateField('scheduleDate', '');
                  }}
                >
                  <div className="cb-visibility-icon">
                    <i className={`fas ${opt.icon}`} />
                  </div>
                  <div className="cb-visibility-body">
                    <div className="cb-visibility-label">{isHt ? opt.labelHt : opt.labelEn}</div>
                    <div className="cb-visibility-desc">{isHt ? opt.descHt : opt.descEn}</div>
                  </div>
                  {formData.visibility === opt.value && (
                    <div className="cb-visibility-check">
                      <i className="fas fa-check" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {formData.visibility === 'schedule' && (
              <div className="cb-field">
                <label className="cb-label">{isHt ? 'Dat piblikasyon' : 'Publish date'}</label>
                <input
                  type="datetime-local"
                  className="cb-input"
                  value={formData.scheduleDate}
                  onChange={(e) => updateField('scheduleDate', e.target.value)}
                />
              </div>
            )}
          </div>
        );

      // ─── STEP 5: SEO ─────────────────────────────────────────
      case 'seo':
        return (
          <div className="cb-step">
            <div className="cb-field">
              <label className="cb-label">{isHt ? 'Slug URL' : 'URL Slug'}</label>
              <div className="cb-input-prefix">
                <span className="cb-prefix">atelnyo.site/</span>
                <input
                  type="text"
                  className="cb-input"
                  value={formData.slug}
                  onChange={(e) => updateField('slug', e.target.value.replace(/\s+/g, '-').toLowerCase())}
                  placeholder={formData.title?.toLowerCase().replace(/\s+/g, '-') || 'my-content'}
                />
              </div>
            </div>
            <div className="cb-field">
              <label className="cb-label">{isHt ? 'Deskripsyon Meta' : 'Meta Description'}</label>
              <textarea
                className="cb-textarea"
                value={formData.metaDescription}
                onChange={(e) => updateField('metaDescription', e.target.value)}
                placeholder={isHt ? 'Kout deskripsyon pou motè rechèch...' : 'Brief description for search engines...'}
                rows={3}
                maxLength={160}
              />
              <span className="cb-char-count">{formData.metaDescription.length}/160</span>
            </div>
          </div>
        );

      // ─── STEP 6: Preview ─────────────────────────────────────
      case 'preview':
        return (
          <div className="cb-step">
            <ContentPreview formData={formData} lang={lang} />
          </div>
        );

      // ─── STEP 7: Publish ─────────────────────────────────────
      case 'publish':
        return (
          <div className="cb-step">
            <ContentQualityChecker formData={formData} steps={steps} isHt={isHt} />
          </div>
        );

      default:
        return <p className="cb-unknown">{isHt ? 'Etap sa poko pare' : 'This step is not ready yet'}</p>;
    }
  };

  return (
    <div className={`cb-container ${className}`}>
      {/* Header */}
      <div className="cb-header">
        <div className="cb-header-left">
          <h2 className="cb-title">
            <i className={`fas ${moduleIcon}`} />
            {moduleName || (isHt ? 'Kreye Kontni' : 'Create Content')}
          </h2>
        </div>
        <div className="cb-header-right">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              <i className="fas fa-times" />
              {isHt ? 'Fèmen' : 'Close'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="cb-progress-bar">
        <div className="cb-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step Indicators */}
      <nav className="cb-steps">
        {steps.map((step, i) => (
          <button
            key={step.id}
            type="button"
            className={`cb-step-btn ${i === currentStep ? 'cb-step-active' : ''} ${i < currentStep ? 'cb-step-done' : ''}`}
            onClick={() => { if (i < currentStep) setCurrentStep(i); }}
            disabled={i > currentStep}
          >
            <span className="cb-step-number">
              {i < currentStep ? <i className="fas fa-check" /> : i + 1}
            </span>
            <span className="cb-step-label">
              {isHt ? step.labelHt : step.labelEn}
            </span>
          </button>
        ))}
      </nav>

      {/* Current Step Content */}
      <div className="cb-body">
        {renderStep()}
      </div>

      {/* Footer Actions */}
      {!published && (
        <div className="cb-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
          >
            <i className="fas fa-chevron-left" />
            {isHt ? 'Retou' : 'Back'}
          </button>

          <div className="cb-footer-right">
            {currentStep === steps.length - 1 ? (
              <button
                type="button"
                className="btn-primary cb-publish-btn"
                onClick={handlePublish}
                disabled={publishing || !canProceed}
              >
                {publishing ? (
                  <>
                    <i className="fas fa-spinner fa-spin" />
                    {isHt ? 'Ap pibliye...' : 'Publishing...'}
                  </>
                ) : (
                  <>
                    <i className="fas fa-globe" />
                    {isHt ? 'Pibliye' : 'Publish'}
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                disabled={!canProceed}
              >
                {isHt ? 'Kontinye' : 'Continue'}
                <i className="fas fa-chevron-right" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
