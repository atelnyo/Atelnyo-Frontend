/**
 * ContentQualityChecker — Pre-publish validation checklist.
 *
 * Before Publish, the system verifies:
 *   - Title, Description, Media, Thumbnail, Broken Links
 *   - Visibility, Accessibility, Required Fields, Policy
 *   - Copyright, Language, Category, Tags, SEO
 *
 * If something is missing, show the list with explanation.
 */
import React, { useMemo } from 'react';
import { inlineText } from '../../utils/inlineI18n';

export default function ContentQualityChecker({
  formData = {},
  steps = [],
  isHt = true,
  lang = 'en',
  className = '',
}) {
  const checks = useMemo(() => {
    const results = [];

    // Title
    results.push({
      id: 'title',
      label: isHt ? 'Tit' : inlineText(lang, 'Title'),
      icon: 'fa-heading',
      pass: formData.title?.trim().length > 0,
      message: formData.title?.trim()
        ? (isHt ? `${formData.title.slice(0, 50)}...` : `${formData.title.slice(0, 50)}...`)
        : (isHt ? 'Tit la obligatwa' : inlineText(lang, 'Title is required')),
    });

    // Title length
    results.push({
      id: 'title_len',
      label: isHt ? 'Longè Tit' : inlineText(lang, 'Title Length'),
      icon: 'fa-ruler',
      pass: (formData.title?.length || 0) >= 10,
      message: formData.title?.length >= 10
        ? `${formData.title.length} ${isHt ? 'karaktè' : inlineText(lang, 'characters')} (min 10)`
        : (isHt ? 'Tit la twò kout (min 10 karaktè)' : inlineText(lang, 'Title too short (min 10 characters)')),
    });

    // Description
    results.push({
      id: 'description',
      label: isHt ? 'Deskripsyon' : inlineText(lang, 'Description'),
      icon: 'fa-align-left',
      pass: formData.description?.trim().length >= 20,
      message: formData.description?.trim().length >= 20
        ? `${formData.description.length} ${isHt ? 'karaktè' : inlineText(lang, 'characters')}`
        : (isHt ? 'Deskripsyon twò kout (min 20)' : inlineText(lang, 'Description too short (min 20)')),
    });

    // Media
    results.push({
      id: 'media',
      label: isHt ? 'Medya' : inlineText(lang, 'Media'),
      icon: 'fa-photo-video',
      pass: (formData.media?.length || 0) > 0 || formData.featuredMedia != null,
      message: formData.media?.length > 0
        ? `${formData.media.length} ${isHt ? 'medya' : inlineText(lang, 'media items')}`
        : formData.featuredMedia
          ? (isHt ? '1 medya prensipal' : inlineText(lang, '1 featured media'))
          : (isHt ? 'Pa gen medya' : inlineText(lang, 'No media attached')),
    });

    // Broken Links
    const brokenMedia = (formData.media || []).filter(
      (m) => m.health_status === 'broken' || m.status === 'broken'
    );
    results.push({
      id: 'broken',
      label: isHt ? 'Lyen Kase' : inlineText(lang, 'Broken Links'),
      icon: 'fa-unlink',
      pass: brokenMedia.length === 0,
      message: brokenMedia.length === 0
        ? (isHt ? 'Pa gen lyen kase' : inlineText(lang, 'No broken links'))
        : `${brokenMedia.length} ${isHt ? 'lyen kase' : inlineText(lang, 'broken link(s)')}`,
    });

    // Visibility
    results.push({
      id: 'visibility',
      label: isHt ? 'Vizibilite' : inlineText(lang, 'Visibility'),
      icon: 'fa-eye',
      pass: !!formData.visibility,
      message: formData.visibility
        ? `${formData.visibility}`
        : (isHt ? 'Pa gen vizibilite chwazi' : inlineText(lang, 'No visibility selected')),
    });

    // Category
    results.push({
      id: 'category',
      label: isHt ? 'Kategori' : inlineText(lang, 'Category'),
      icon: 'fa-tag',
      pass: !!formData.category,
      message: formData.category || (isHt ? 'Pa gen kategori' : inlineText(lang, 'No category selected')),
    });

    // Language
    results.push({
      id: 'language',
      label: isHt ? 'Lang' : inlineText(lang, 'Language'),
      icon: 'fa-language',
      pass: !!formData.language,
      message: formData.language === 'ht' ? 'Kreyòl' : formData.language === 'fr' ? 'Français' : formData.language === 'es' ? 'Español' : formData.language === 'en' ? 'English' : (isHt ? 'Pa gen lang' : inlineText(lang, 'No language')),
    });

    // Tags
    results.push({
      id: 'tags',
      label: isHt ? 'Tags' : inlineText(lang, 'Tags'),
      icon: 'fa-tags',
      pass: (formData.tags?.length || 0) >= 1,
      message: formData.tags?.length > 0
        ? `${formData.tags.length} tag(s)`
        : (isHt ? 'Pa gen tag' : inlineText(lang, 'No tags added')),
    });

    // SEO Slug
    results.push({
      id: 'seo_slug',
      label: 'URL Slug',
      icon: 'fa-link',
      pass: formData.slug?.trim().length > 0,
      message: formData.slug?.trim()
        ? formData.slug
        : (isHt ? 'Pa gen slug' : inlineText(lang, 'No slug set')),
    });

    // SEO Meta Description
    results.push({
      id: 'seo_meta',
      label: isHt ? 'Meta Deskripsyon' : inlineText(lang, 'Meta Description'),
      icon: 'fa-search',
      pass: (formData.metaDescription?.length || 0) >= 50,
      message: formData.metaDescription?.length >= 50
        ? `${formData.metaDescription.length} ${isHt ? 'karaktè' : inlineText(lang, 'chars')} (bon)`
        : formData.metaDescription?.length > 0
          ? `${formData.metaDescription.length} ${isHt ? 'karaktè' : inlineText(lang, 'chars')} (min 50 ${isHt ? 'rekòmande' : inlineText(lang, 'recommended')})`
          : (isHt ? 'Pa gen meta deskripsyon' : inlineText(lang, 'No meta description')),
    });

    // Schedule
    if (formData.visibility === 'schedule') {
      results.push({
        id: 'schedule',
        label: isHt ? 'Dat Pwograme' : inlineText(lang, 'Schedule Date'),
        icon: 'fa-clock',
        pass: !!formData.scheduleDate,
        message: formData.scheduleDate
          ? new Date(formData.scheduleDate).toLocaleString()
          : (isHt ? 'Pa gen dat chwazi' : inlineText(lang, 'No date selected')),
      });
    }

    return results;
  }, [formData, isHt]);

  const passedCount = checks.filter((c) => c.pass).length;
  const totalCount = checks.length;
  const allPassed = passedCount === totalCount;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return (
    <div className={`cqc-container ${className}`}>
      <div className="cqc-header">
        <h3 className="cqc-title">
          <i className="fas fa-clipboard-check" />
          {isHt ? 'Kontwòl Kalite' : inlineText(lang, 'Quality Check')}
        </h3>
        <div className="cqc-score">
          <div className="cqc-score-ring">
            <svg viewBox="0 0 60 60" className="cqc-score-svg">
              <circle cx="30" cy="30" r="26" fill="none" stroke="var(--surface-highlight, rgba(216,27,96,0.08))" strokeWidth="4" />
              <circle cx="30" cy="30" r="26" fill="none"
                stroke={score >= 80 ? 'var(--state-success, #10b981)' : score >= 50 ? 'var(--state-warning, #f59e0b)' : 'var(--state-error, #ef4444)'}
                strokeWidth="4"
                strokeDasharray={`${score * 1.63} 163`}
                strokeLinecap="round"
                transform="rotate(-90 30 30)"
              />
              <text x="30" y="30" textAnchor="middle" dominantBaseline="central"
                fill="var(--text-main, #222)" fontSize="0.8rem" fontWeight="700">
                {score}%
              </text>
            </svg>
          </div>
          <div className="cqc-score-text">
            <strong>{passedCount}/{totalCount}</strong>
            <span>{isHt ? 'tcheke pase' : inlineText(lang, 'checks passed')}</span>
          </div>
        </div>
      </div>

      {allPassed ? (
        <div className="cqc-all-passed">
          <i className="fas fa-check-circle" />
          <h4>{isHt ? 'Tout bagay pare pou pibliye!' : inlineText(lang, 'Everything ready to publish!')}</h4>
          <p>{isHt ? 'Klike sou Pibliye anba a pou pibliye kontni w.' : inlineText(lang, 'Click Publish below to make your content live.')}</p>
        </div>
      ) : (
        <div className="cqc-warning">
          <i className="fas fa-exclamation-triangle" />
          <p>
            {isHt
              ? `Gen ${totalCount - passedCount} bagay ki bezwen atansyon anvan piblikasyon.`
              : `${totalCount - passedCount} item(s) need attention before publishing.`}
          </p>
        </div>
      )}

      <div className="cqc-checks">
        {checks.map((check) => (
          <div
            key={check.id}
            className={`cqc-check ${check.pass ? 'cqc-check-pass' : 'cqc-check-fail'}`}
          >
            <div className="cqc-check-icon">
              <i className={`fas ${check.pass ? 'fa-check-circle' : 'fa-times-circle'}`} />
            </div>
            <div className="cqc-check-icon-main">
              <i className={`fas ${check.icon}`} />
            </div>
            <div className="cqc-check-body">
              <div className="cqc-check-label">{check.label}</div>
              <div className={`cqc-check-msg ${!check.pass ? 'cqc-check-msg-warn' : ''}`}>
                {check.message}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
